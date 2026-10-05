<?php

namespace App\Http\Controllers\Api\Facturacion;

use App\Http\Controllers\Api\Facturacion\Concerns\RechazaPrefacturaCerrada;
use App\Http\Controllers\Controller;
use App\Models\Bitacora;
use App\Models\FactPrefactura;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;
use UnexpectedValueException;

/**
 * La impresión de una prefactura. Una sola plantilla y dos acciones: `pdf()`, el documento
 * oficial de una cerrada, y `cotizacion()`, la hoja de un borrador.
 *
 * ESTE CONTROLADOR NO ESCRIBE NADA salvo la bitácora, y eso es deliberado. En el sistema
 * viejo imprimir escribía: `invoice.php` insertaba el encabezado histórico antes de
 * validar, y `invoice21.php` —el que se llama desde la lista de cerradas— lo vuelve a
 * insertar en cada reimpresión, sin guarda. Es una de las causas de sus 207 folios
 * duplicados, y explica que 424 de las filas repetidas tengan cliente.
 *
 * Por eso aquí **reimprimir no tiene ruta propia**: es volver a pedir `pdf()`.
 */
class PrefacturaPdfController extends Controller
{
    use RechazaPrefacturaCerrada;

    /**
     * El documento oficial de una prefactura cerrada, con sus cifras SELLADAS.
     *
     * Nunca la derivación: el papel tiene que mostrar lo que el cliente vio cuando se
     * emitió, que es justamente para lo que el sello existe.
     */
    public function pdf(Request $request, int $id): Response|JsonResponse
    {
        $prefactura = FactPrefactura::with(['renglones', 'pagos.formaPago', 'cliente', 'aeronave.tipoAeronave', 'satelite.categoria', 'cerradaPor'])
            ->findOrFail($id);

        if ($respuesta = $this->rechazarSiDescartada($prefactura)) {
            return $respuesta;
        }

        if (! $prefactura->estaCerrada()) {
            return response()->json([
                'message' => 'Esta prefactura todavía es un borrador: sin folio no hay documento. Imprime una cotización, o ciérrala primero.',
                'codigo' => 'sin_folio',
            ], 422);
        }

        // Un sello que ya no corresponde a sus renglones NO se imprime. Un PDF es papel que
        // sale de la oficina: emitir un documento del que el propio sistema sabe que no
        // cuadra es peor que no emitirlo.
        // El `try` abarca TAMBIÉN las cifras, no solo la verificación: `filasDe()`,
        // `cambio()` y `ivaTasaEtiqueta()` pueden lanzar, y si lo hicieran fuera de aquí
        // sería un 500 en lugar de un 422 — justo lo que la vista promete que no pasa.
        try {
            $discrepancias = $prefactura->discrepanciasDelSello();

            $cifras = [
                'subtotal' => (string) $prefactura->subtotal_sellado,
                'iva' => (string) $prefactura->iva_sellado,
                'ivaEtiqueta' => $prefactura->ivaTasaEtiqueta(),
                'total' => (string) $prefactura->total_sellado,
                'cambio' => $prefactura->cambio(),
                'filas' => $this->filasDe($prefactura),
            ];
        } catch (UnexpectedValueException $e) {
            report($e);

            return response()->json([
                'message' => 'No se puede verificar el documento: un renglón o la tasa de IVA tienen un valor que no se reconoce. Corrige el ajuste del renglón o la tasa en la configuración.',
                'codigo' => 'totales_no_calculables',
            ], 422);
        }

        if ($discrepancias !== []) {
            $total = $discrepancias['total'] ?? null;

            return response()->json([
                'message' => $total === null
                    ? 'El sello de esta prefactura no coincide con sus renglones, así que no se puede imprimir. Aclara la diferencia antes de emitir el documento.'
                    : "El sello de esta prefactura dice {$total['sellado']} y sus renglones suman {$total['derivado']}, así que no se puede imprimir. Aclara la diferencia antes de emitir el documento.",
                'codigo' => 'sello_inconsistente',
            ], 409);
        }

        // Renderizar, registrar, devolver: en ese orden. Si el PDF falla al armarse lanza
        // antes de registrar, y no queda en la bitácora un «se imprimió» de un documento que
        // nunca salió; si el registro falla lanza antes de devolver, y no sale un documento
        // sin dejar rastro. Ninguna de las dos mitades queda sin la otra.
        $documento = $this->render($prefactura, esCotizacion: false, cifras: $cifras,
            elaboradoPor: $prefactura->cerradaPor?->name ?? 'Sin registrar');

        $this->registrar(
            $request->user()->id,
            $prefactura,
            "Se imprimió el documento de la prefactura con folio {$prefactura->folio}.",
            ['folio' => $prefactura->folio, 'total' => (string) $prefactura->total_sellado],
        );

        return $documento;
    }

    /**
     * La cotización: la misma hoja de un BORRADOR, con cifras derivadas y sin folio.
     *
     * Es la acción menos grave de las tres —no emite nada ni consume folio— y por eso la
     * puede hacer cualquiera que pueda facturar. Lo que sustituye al código `'1234'` que el
     * sistema viejo lleva en el JavaScript del cliente es la bitácora: hoy, quién cotizó y
     * cuándo no queda en ninguna parte.
     */
    public function cotizacion(Request $request, int $id): Response|JsonResponse
    {
        $prefactura = FactPrefactura::with(['renglones', 'pagos.formaPago', 'cliente', 'aeronave.tipoAeronave', 'satelite.categoria'])
            ->findOrFail($id);

        if ($respuesta = $this->rechazarSiDescartada($prefactura)) {
            return $respuesta;
        }

        if ($prefactura->estaCerrada()) {
            return response()->json([
                'message' => 'Esta prefactura ya está emitida con folio '.$prefactura->folio.': imprime el documento, no una cotización.',
                'codigo' => 'ya_cerrada',
            ], 422);
        }

        // Un borrador no tiene sello, así que las cifras son las derivadas. Si un renglón o
        // la tasa son ilegibles, eso es 422 y no un 500.
        try {
            $cifras = [
                'subtotal' => $prefactura->subtotal(),
                'iva' => $prefactura->iva(),
                'ivaEtiqueta' => $prefactura->ivaTasaEtiqueta(),
                'total' => $prefactura->total(),
                'cambio' => $prefactura->cambio(),
                'filas' => $this->filasDe($prefactura),
            ];
        } catch (UnexpectedValueException $e) {
            report($e);

            return response()->json([
                'message' => 'No se pueden calcular los totales: un renglón o la tasa de IVA tienen un valor que no se reconoce. Corrige el ajuste del renglón o la tasa en la configuración.',
                'codigo' => 'totales_no_calculables',
            ], 422);
        }

        // Se renderiza ANTES de registrar, y el orden importa: si DomPDF fallara, lanzaría
        // aquí y no quedaría en la bitácora un «se imprimió» de un documento que nunca salió;
        // y si fallara el registro, lanzaría antes del `return` y no se entregaría un PDF sin
        // registrar. Ninguna de las dos mitades puede quedar sin la otra.
        $documento = $this->render($prefactura, esCotizacion: true, cifras: $cifras,
            elaboradoPor: $request->user()->name);

        $this->registrar(
            $request->user()->id,
            $prefactura,
            "Se imprimió una cotización de la prefactura {$prefactura->id} por {$cifras['total']}: no se emitió ningún documento y no se consumió folio.",
            ['total' => $cifras['total'], 'emitido' => false],
        );

        return $documento;
    }

    /**
     * Las filas del documento, ya resueltas, en el orden en que se imprimen.
     *
     * Un renglón sin grupo es una fila. Los renglones que comparten etiqueta de `grupo` se
     * colapsan en UNA fila con la etiqueta como concepto, sin precio, cantidad ni remisión
     * (no hay un valor que valga para el conjunto) y con la suma de sus importes, hecha con
     * `bcadd` porque `array_sum` pasaría por `float`. Es solo presentación: el subtotal
     * sigue sumando el `importe()` de cada renglón, y esta suma no entra en ninguna cifra.
     *
     * Un renglón en cortesía aporta `0.00` a su grupo, y la fila del grupo no lleva la marca
     * «Cortesía»: esa marca describe un renglón, no una suma.
     *
     * El grupo ocupa el lugar de su renglón de `orden` MENOR. Los renglones ya llegan
     * ordenados por `orden` y luego `id`, así que basta emitir el grupo la PRIMERA vez que
     * aparece; ordenar aparte, o emitirlo en su última aparición, lo movería de sitio.
     *
     * Las dos cosas que la hacen segura, y que no se pueden cambiar sin romper un
     * invariante del bloque 4:
     *
     * - La construye el CONTROLADOR, dentro de su `try/catch`, y no la vista: la vista se
     *   renderiza después de ese `try/catch`, así que una excepción de `importe()` ahí
     *   sería un 500 en lugar de un 422.
     * - Usa la colección `$prefactura->renglones` YA CARGADA y no otra lectura, porque
     *   `subtotalDerivado()` sí relee: si alguien corrigiera un `ajuste_precio` desconocido
     *   entre la carga y esa relectura, la verificación no lanzaría y esto sí, sobre el
     *   objeto viejo, y saldría un 500 en un documento cuyos datos vigentes están bien.
     *
     * @return list<array{concepto: string, cortesia: bool, remision: ?string, precio: ?string, cantidad: ?int, importe: string}>
     */
    private function filasDe(FactPrefactura $prefactura): array
    {
        $filas = [];
        $lugarDelGrupo = [];

        foreach ($prefactura->renglones as $renglon) {
            if ($renglon->grupo === null) {
                $filas[] = [
                    'concepto' => $renglon->nombre_servicio,
                    'cortesia' => (bool) $renglon->es_cortesia,
                    'remision' => $renglon->remision,
                    'precio' => (string) $renglon->precio_unitario,
                    'cantidad' => $renglon->cantidad,
                    'importe' => $renglon->importe(),
                ];

                continue;
            }

            if (! isset($lugarDelGrupo[$renglon->grupo])) {
                $lugarDelGrupo[$renglon->grupo] = count($filas);
                $filas[] = [
                    'concepto' => $renglon->grupo,
                    'cortesia' => false,
                    'remision' => null,
                    'precio' => null,
                    'cantidad' => null,
                    'importe' => '0.00',
                ];
            }

            $lugar = $lugarDelGrupo[$renglon->grupo];
            $filas[$lugar]['importe'] = bcadd($filas[$lugar]['importe'], $renglon->importe(), 2);
        }

        return $filas;
    }

    /** Arma el PDF. La plantilla solo formatea: las cifras llegan ya calculadas. */
    private function render(FactPrefactura $prefactura, bool $esCotizacion, array $cifras, string $elaboradoPor): Response
    {
        $pdf = Pdf::loadView('pdf.prefactura', [
            'prefactura' => $prefactura,
            'esCotizacion' => $esCotizacion,
            'elaboradoPor' => $elaboradoPor,
        ] + $cifras)->setPaper('letter', 'portrait');

        $nombre = $esCotizacion
            ? "cotizacion-{$prefactura->id}.pdf"
            : "prefactura-{$prefactura->folio}.pdf";

        return $pdf->stream($nombre);
    }

    /** La bitácora, dentro de su transacción. Es la trazabilidad que el sistema viejo no tiene. */
    private function registrar(int $userId, FactPrefactura $prefactura, string $descripcion, array $datos): void
    {
        DB::transaction(fn () => Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
            accion: Bitacora::ACCION_EXPORTAR,
            descripcion: $descripcion,
            usuarioId: $userId,
            registroId: $prefactura->id,
            datosNuevos: $datos,
        ));
    }
}
