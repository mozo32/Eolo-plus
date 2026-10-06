<?php

namespace App\Services;

use App\Models\Aeronave;
use App\Models\FactAeronave;
use App\Models\FactCategoriaAeronave;
use App\Models\FactCliente;
use App\Models\FactFormaPago;
use App\Models\FactPrefactura;
use App\Models\FactPrefacturaPago;
use App\Models\TipoAeronave;
use Illuminate\Support\Collection;

/**
 * El documento de una prefactura: lo que se imprime, en un solo lugar.
 *
 * Existe para que la instantánea que se guarda al reabrir y el papel que se imprime salgan
 * de la MISMA función. Si fueran dos copias podrían divergir, y entonces la versión
 * guardada no sería el documento que el cliente tiene en la mano, que es todo el propósito
 * del bloque.
 *
 * Nada de aquí se llama desde la vista: todo se llama desde el `try/catch` del controlador,
 * porque `importe()` y `ivaTasaEtiqueta()` pueden lanzar y la vista se renderiza después.
 */
class DocumentoDePrefactura
{
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
     *
     * @throws \UnexpectedValueException si un renglón no se reconoce.
     */
    public function filas(FactPrefactura $prefactura): array
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

    /**
     * Las seis cifras de una cerrada, SELLADAS. Nunca la derivación: el papel muestra lo
     * que el cliente vio cuando se emitió.
     *
     * @return array{subtotal: string, iva: string, ivaEtiqueta: string, total: string, cambio: string, filas: array}
     *
     * @throws \UnexpectedValueException si un renglón o la tasa no se reconocen.
     */
    public function cifrasDeCerrada(FactPrefactura $prefactura): array
    {
        return [
            'subtotal' => (string) $prefactura->subtotal_sellado,
            'iva' => (string) $prefactura->iva_sellado,
            'ivaEtiqueta' => $prefactura->ivaTasaEtiqueta(),
            'total' => (string) $prefactura->total_sellado,
            'cambio' => $prefactura->cambio(),
            'filas' => $this->filas($prefactura),
        ];
    }

    /**
     * El documento entero, listo para guardar como JSON.
     *
     * Las claves salen de LEER la plantilla, no de suponer: son exactamente lo que
     * `pdf.prefactura` lee de `$prefactura` más las cifras calculadas. `tipo_destino` no va
     * porque la plantilla no lo lee; la tasa que de él se derivó viaja en `ivaEtiqueta`.
     *
     * @throws \UnexpectedValueException si un renglón o la tasa no se reconocen.
     */
    public function instantanea(FactPrefactura $prefactura): array
    {
        return [
            'folio' => $prefactura->folio,
            'cerrada_at' => $prefactura->cerrada_at?->toIso8601String(),
            'llegada_at' => $prefactura->llegada_at?->toIso8601String(),
            'salida_at' => $prefactura->salida_at?->toIso8601String(),
            'origen' => $prefactura->origen,
            'destino' => $prefactura->destino,
            'nota_externa' => $prefactura->nota_externa,
            'cliente' => $prefactura->cliente === null ? null : [
                'nombre' => $prefactura->cliente->nombre,
                'telefono' => $prefactura->cliente->telefono,
                'correo' => $prefactura->cliente->correo,
            ],
            'aeronave' => $prefactura->aeronave === null ? null : [
                'matricula' => $prefactura->aeronave->matricula,
                'tipo' => $prefactura->aeronave->tipoAeronave?->nombre,
                'categoria' => $prefactura->satelite?->categoria?->nombre,
            ],
            'pagos' => $prefactura->pagos
                ->map(fn ($pago) => ['forma' => $pago->formaPago?->nombre, 'monto' => (string) $pago->monto])
                ->values()
                ->all(),
            'elaboradoPor' => $prefactura->cerradaPor?->name ?? 'Sin registrar',
        ] + $this->cifrasDeCerrada($prefactura);
    }

    /**
     * Reconstruye el modelo que la plantilla necesita, SIN persistirlo.
     *
     * Se hidrata un modelo en vez de refactorizar la plantilla para que reciba sus veinte
     * valores como claves planas: esa refactorización pondría en riesgo el invariante del
     * bloque 4 —la vista no llama a nada que pueda lanzar— sin comprar nada.
     *
     * Las relaciones se ponen con `setRelation`, así que la vista no dispara ni una consulta
     * y `$prefactura->aeronave?->tipoAeronave?->nombre` resuelve contra estos objetos.
     */
    public function hidratar(array $documento): FactPrefactura
    {
        $prefactura = new FactPrefactura([
            'folio' => $documento['folio'],
            'cerrada_at' => $documento['cerrada_at'],
            'llegada_at' => $documento['llegada_at'],
            'salida_at' => $documento['salida_at'],
            'origen' => $documento['origen'],
            'destino' => $documento['destino'],
            'nota_externa' => $documento['nota_externa'],
            'estado' => FactPrefactura::ESTADO_CERRADA,
        ]);

        $prefactura->setRelation('cliente', $documento['cliente'] === null ? null : new FactCliente([
            'nombre' => $documento['cliente']['nombre'],
            'telefono' => $documento['cliente']['telefono'],
            'correo' => $documento['cliente']['correo'],
        ]));

        // `aeronave` y `satelite` son DOS modelos distintos, no dos vistas del mismo:
        // `aeronave` es `App\Models\Aeronave` (tabla `aeronaves`, con la matrícula) y
        // `satelite` es `App\Models\FactAeronave` (tabla `fact_aeronaves`, con la categoría
        // y las tarifas propias). La plantilla lee la matrícula y el tipo del primero y la
        // categoría del segundo.
        $aeronave = null;
        $satelite = null;

        if ($documento['aeronave'] !== null) {
            $aeronave = new Aeronave(['matricula' => $documento['aeronave']['matricula']]);
            $aeronave->setRelation('tipoAeronave', $documento['aeronave']['tipo'] === null
                ? null
                : new TipoAeronave(['nombre' => $documento['aeronave']['tipo']]));

            $satelite = new FactAeronave;
            $satelite->setRelation('categoria', $documento['aeronave']['categoria'] === null
                ? null
                : new FactCategoriaAeronave(['nombre' => $documento['aeronave']['categoria']]));
        }

        $prefactura->setRelation('aeronave', $aeronave);

        // `satelite` es un `hasOne`: se pone UN modelo, no una colección.
        $prefactura->setRelation('satelite', $satelite);

        $prefactura->setRelation('pagos', Collection::make($documento['pagos'])->map(function (array $pago) {
            $modelo = new FactPrefacturaPago(['monto' => $pago['monto']]);
            $modelo->setRelation('formaPago', $pago['forma'] === null
                ? null
                : new FactFormaPago(['nombre' => $pago['forma']]));

            return $modelo;
        }));

        return $prefactura;
    }
}
