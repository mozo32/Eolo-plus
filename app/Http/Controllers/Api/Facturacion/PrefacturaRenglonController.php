<?php

namespace App\Http\Controllers\Api\Facturacion;

use App\Http\Controllers\Api\Facturacion\Concerns\RechazaPrefacturaCerrada;
use App\Http\Controllers\Controller;
use App\Http\Requests\Facturacion\StoreRenglonRequest;
use App\Models\Bitacora;
use App\Models\FactPrefactura;
use App\Models\FactServicio;
use App\Services\CargosEstancia;
use App\Services\ServicioDeEstanciaNoDisponibleException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Renglones de una prefactura: alta y baja, y los dos recálculos de cargos.
 *
 * Cada escritura toma el candado de la prefactura DENTRO de su transacción, el
 * mismo que toma `CierrePrefactura`, de modo que cerrar y escribir renglones se
 * serializan. Si la prefactura se cierra entre el chequeo rápido del trait y el
 * candado, la guarda del modelo o `CargosEstancia` lanzan
 * `RenglonDePrefacturaCerradaException`, que se traduce sola a 409.
 *
 * Nunca se usa `increment()`/`decrement()` ni escrituras masivas sobre renglones:
 * se saltan la guarda del modelo.
 */
class PrefacturaRenglonController extends Controller
{
    use RechazaPrefacturaCerrada;

    public function store(StoreRenglonRequest $request, int $id): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazoRapido($prefactura)) {
            return $respuesta;
        }

        $servicio = FactServicio::findOrFail($request->validated()['servicio_id']);

        $renglon = DB::transaction(function () use ($request, $id, $servicio) {
            $actual = $this->bloquear($id);

            if ($respuesta = $this->rechazarSiDescartada($actual)) {
                return $respuesta;
            }

            // El renglón CONGELA lo que determina su importe: si el catálogo cambia
            // mañana, este documento no se mueve.
            $renglon = $actual->renglones()->create([
                'servicio_id' => $servicio->id,
                'nombre_servicio' => $servicio->nombre,
                'precio_unitario' => $servicio->precio_unitario,
                'cantidad' => $request->validated()['cantidad'],
                'es_de_tercero' => $servicio->es_de_tercero,
                'margen' => $servicio->margen,
                'ajuste_precio' => $servicio->ajuste_precio,
                'concepto' => $servicio->concepto,
                'proveedor_id' => $request->validated()['proveedor_id'] ?? null,
                'remision' => $request->validated()['remision'] ?? null,
                // `reorder()`: la relación trae ORDER BY, que un agregado no admite en MySQL estricto.
                'orden' => (int) $actual->renglones()->reorder()->max('orden') + 1,
            ]);

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_CREAR,
                descripcion: "Se agregó el servicio {$renglon->nombre_servicio} a la prefactura {$actual->id} por {$renglon->importe()}.",
                usuarioId: $request->user()->id,
                registroId: $actual->id,
                datosNuevos: ['renglon_id' => $renglon->id, 'importe' => $renglon->importe()],
            );

            return $renglon;
        });

        if ($renglon instanceof JsonResponse) {
            return $renglon;
        }

        return response()->json([
            'message' => 'Renglón agregado.',
            'renglon_id' => $renglon->id,
        ], 201);
    }

    public function destroy(Request $request, int $id, int $renglon): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazoRapido($prefactura)) {
            return $respuesta;
        }

        $rechazo = DB::transaction(function () use ($request, $id, $renglon) {
            $actual = $this->bloquear($id);

            if ($respuesta = $this->rechazarSiDescartada($actual)) {
                return $respuesta;
            }

            // Borrado por modelo: dispara `deleting` y con él la guarda de cerrada.
            $fila = $actual->renglones()->whereKey($renglon)->firstOrFail();
            $nombre = $fila->nombre_servicio;
            $fila->delete();

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_ELIMINAR,
                descripcion: "Se quitó el servicio {$nombre} de la prefactura {$actual->id}.",
                usuarioId: $request->user()->id,
                registroId: $actual->id,
                datosAnteriores: ['renglon_id' => $renglon, 'nombre_servicio' => $nombre],
            );

            return null;
        });

        return $rechazo ?? response()->json(['message' => 'Renglón eliminado.']);
    }

    /**
     * Marca o desmarca un renglón como cortesía: se sigue viendo en el documento,
     * pero su importe es 0.
     *
     * Escritura POR MODELO (`$fila->update()`), nunca masiva: así pasa por la guarda
     * de `saving` que rechaza una prefactura cerrada.
     *
     * La bitácora dice la cifra que deja de cobrarse (al marcar) o que vuelve a
     * cobrarse (al quitar): en los dos casos `importeSinCortesia()`, que no depende
     * del estado del renglón. Tomar `importe()` antes del cambio al marcar y después
     * al quitar da lo mismo solo si la petición cambia algo; si repite el valor
     * actual, `importe()` ya es 0.00 y el registro diría «por 0.00».
     */
    public function cortesia(Request $request, int $id, int $renglon): JsonResponse
    {
        $datos = $request->validate(['es_cortesia' => ['required', 'boolean']]);
        $marcar = (bool) $datos['es_cortesia'];

        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazoRapido($prefactura)) {
            return $respuesta;
        }

        $resultado = DB::transaction(function () use ($request, $id, $renglon, $marcar) {
            $actual = $this->bloquear($id);

            if ($respuesta = $this->rechazarSiDescartada($actual)) {
                return $respuesta;
            }

            $fila = $actual->renglones()->whereKey($renglon)->firstOrFail();

            // Sin cambio no hay escritura ni bitácora. Se escribe igual por modelo
            // cuando hay cambio, para que la guarda de cerrada se dispare.
            if ($fila->es_cortesia === $marcar) {
                return $actual;
            }

            $fila->update(['es_cortesia' => $marcar]);

            $importe = $fila->importeSinCortesia();
            $descripcion = $marcar
                ? "Se marcó como cortesía el servicio {$fila->nombre_servicio} de la prefactura {$actual->id}: deja de cobrarse {$importe}."
                : "Se quitó la cortesía del servicio {$fila->nombre_servicio} de la prefactura {$actual->id}: vuelve a cobrarse {$importe}.";

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_ACTUALIZAR,
                descripcion: $descripcion,
                usuarioId: $request->user()->id,
                registroId: $actual->id,
                datosAnteriores: ['renglon_id' => $fila->id, 'es_cortesia' => ! $marcar],
                datosNuevos: ['renglon_id' => $fila->id, 'es_cortesia' => $marcar, 'importe' => $importe],
            );

            return $actual;
        });

        if ($resultado instanceof JsonResponse) {
            return $resultado;
        }

        return response()->json([
            'message' => $marcar ? 'Renglón marcado como cortesía.' : 'Cortesía quitada.',
            'prefactura' => app(PrefacturaController::class)->fichaDe($resultado->id),
        ]);
    }

    public function estancia(Request $request, int $id, CargosEstancia $cargos): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazoRapido($prefactura)) {
            return $respuesta;
        }

        $datos = $request->validate([
            'pernoctas' => ['required', 'integer', 'min:0', 'max:999'],
            'transitos_2h' => ['required', 'integer', 'min:0', 'max:999'],
            'transitos_12h' => ['required', 'integer', 'min:0', 'max:999'],
            'ajustes_2h_12h' => ['sometimes', 'integer', 'min:0', 'max:999'],
            'ajustes_12h_pernocta' => ['sometimes', 'integer', 'min:0', 'max:999'],
        ], $this->mensajesDeEstancia());

        // La transacción de afuera deja la bitácora en la misma que el servicio:
        // `CargosEstancia` abre la suya, que aquí queda anidada.
        try {
            $resultado = DB::transaction(function () use ($request, $prefactura, $cargos, $datos) {
                // Candado y guarda de descartada ANTES del servicio. La de cerrada sigue
                // siendo del servicio (su excepción se traduce sola a 409).
                if ($respuesta = $this->rechazarSiDescartada($this->bloquear($prefactura->id))) {
                    return $respuesta;
                }

                $resultado = $cargos->recalcular(
                    $prefactura,
                    $datos['pernoctas'],
                    $datos['transitos_2h'],
                    $datos['transitos_12h'],
                    $datos['ajustes_2h_12h'] ?? 0,
                    $datos['ajustes_12h_pernocta'] ?? 0,
                );

                Bitacora::log(
                    modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                    accion: Bitacora::ACCION_ACTUALIZAR,
                    descripcion: "Se recalculó la estancia de la prefactura {$prefactura->id}: {$resultado['renglones']} renglones.",
                    usuarioId: $request->user()->id,
                    registroId: $prefactura->id,
                    datosNuevos: $datos,
                );

                return $resultado;
            });
        } catch (ServicioDeEstanciaNoDisponibleException $e) {
            // Nada quedó escrito (la transacción se revirtió). El mensaje ya dice qué
            // hacer; sin esta captura, con APP_DEBUG=false Laravel lo reemplaza por
            // un «Server Error» y la persona nunca lo lee.
            return response()->json(['message' => $e->getMessage(), 'codigo' => 'servicio_estancia_no_disponible'], 422);
        }

        if ($resultado instanceof JsonResponse) {
            return $resultado;
        }

        return response()->json([
            'message' => $resultado['motivo'] ?? 'Estancia recalculada.',
            'renglones' => $resultado['renglones'],
            'motivo' => $resultado['motivo'],
        ]);
    }

    public function internacional(Request $request, int $id, CargosEstancia $cargos): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazoRapido($prefactura)) {
            return $respuesta;
        }

        $resultado = DB::transaction(function () use ($request, $prefactura, $cargos) {
            if ($respuesta = $this->rechazarSiDescartada($this->bloquear($prefactura->id))) {
                return $respuesta;
            }

            // El servicio toma el candado y rechaza una cerrada ANTES de que se escriba
            // nada: por eso el cambio de destino va después, ya con la fila bloqueada y
            // comprobada como borrador.
            $resultado = $cargos->agregarPaqueteInternacional($prefactura);

            // Solo se marca internacional si la prefactura TIENE algo del paquete (lo que
            // se agregó ahora o lo que ya estaba). Marcarla sin ninguno la deja en un
            // callejón: la insignia dice Internacional, la tabla no tiene el paquete y el
            // editor ya no ofrece el botón, que solo sale con destino nacional.
            $marcada = $resultado['en_paquete'] > 0;

            if ($marcada) {
                $prefactura->update(['tipo_destino' => FactPrefactura::DESTINO_INTERNACIONAL]);
            }

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_ACTUALIZAR,
                descripcion: $marcada
                    ? "Se marcó internacional la prefactura {$prefactura->id} y se agregaron {$resultado['renglones']} servicios del paquete."
                    : "Se intentó marcar internacional la prefactura {$prefactura->id}: no se agregó ningún servicio del paquete y sigue nacional.",
                usuarioId: $request->user()->id,
                registroId: $prefactura->id,
                datosNuevos: [
                    'tipo_destino' => $marcada ? FactPrefactura::DESTINO_INTERNACIONAL : $prefactura->tipo_destino,
                    'servicios_agregados' => $resultado['renglones'],
                    'servicios_faltantes' => $resultado['faltantes'],
                ],
            );

            return $resultado;
        });

        if ($resultado instanceof JsonResponse) {
            return $resultado;
        }

        return response()->json([
            'message' => $resultado['motivo'] ?? 'Paquete internacional agregado.',
            'renglones' => $resultado['renglones'],
            'motivo' => $resultado['motivo'],
        ]);
    }

    /**
     * La prefactura leída con candado, dentro de la transacción. Con ella se
     * comprueba «descartada» bajo el mismo candado que `descartar`, no solo en el
     * chequeo rápido: entre el `findOrFail` y aquí otra sesión pudo descartarla.
     */
    private function bloquear(int $id): FactPrefactura
    {
        return FactPrefactura::query()->whereKey($id)->lockForUpdate()->firstOrFail();
    }

    private function mensajesDeEstancia(): array
    {
        $mensajes = [];

        foreach (['pernoctas' => 'las pernoctas', 'transitos_2h' => 'los tránsitos de 2 horas', 'transitos_12h' => 'los tránsitos de 12 horas', 'ajustes_2h_12h' => 'los ajustes de 2 h a 12 h', 'ajustes_12h_pernocta' => 'los ajustes de 12 h a pernocta'] as $campo => $nombre) {
            $mensajes["{$campo}.required"] = "Indica la cantidad de {$nombre} (puede ser 0).";
            $mensajes["{$campo}.integer"] = "La cantidad de {$nombre} debe ser un número entero.";
            $mensajes["{$campo}.min"] = "La cantidad de {$nombre} no puede ser negativa.";
            $mensajes["{$campo}.max"] = "La cantidad de {$nombre} no puede pasar de 999.";
        }

        return $mensajes;
    }
}
