<?php

namespace App\Http\Controllers\Api\Facturacion;

use App\Http\Controllers\Api\Facturacion\Concerns\RechazaPrefacturaCerrada;
use App\Http\Controllers\Controller;
use App\Http\Requests\Facturacion\StoreRenglonRequest;
use App\Models\Bitacora;
use App\Models\FactPrefactura;
use App\Models\FactServicio;
use App\Services\CargosEstancia;
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
            $actual = FactPrefactura::query()->whereKey($id)->lockForUpdate()->firstOrFail();

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

        DB::transaction(function () use ($request, $id, $renglon) {
            $actual = FactPrefactura::query()->whereKey($id)->lockForUpdate()->firstOrFail();

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
        });

        return response()->json(['message' => 'Renglón eliminado.']);
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
        ]);

        // La transacción de afuera deja la bitácora en la misma que el servicio:
        // `CargosEstancia` abre la suya, que aquí queda anidada.
        $resultado = DB::transaction(function () use ($request, $prefactura, $cargos, $datos) {
            $resultado = $cargos->recalcular($prefactura, $datos['pernoctas'], $datos['transitos_2h'], $datos['transitos_12h']);

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

        $agregados = DB::transaction(function () use ($request, $prefactura, $cargos) {
            // El servicio toma el candado y rechaza una cerrada ANTES de que se escriba
            // nada: por eso el cambio de destino va después, ya con la fila bloqueada y
            // comprobada como borrador.
            $agregados = $cargos->agregarPaqueteInternacional($prefactura);
            $prefactura->update(['tipo_destino' => FactPrefactura::DESTINO_INTERNACIONAL]);

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_ACTUALIZAR,
                descripcion: "Se marcó internacional la prefactura {$prefactura->id} y se agregaron {$agregados} servicios del paquete.",
                usuarioId: $request->user()->id,
                registroId: $prefactura->id,
                datosNuevos: ['tipo_destino' => FactPrefactura::DESTINO_INTERNACIONAL, 'servicios_agregados' => $agregados],
            );

            return $agregados;
        });

        return response()->json(['message' => 'Paquete internacional agregado.', 'renglones' => $agregados]);
    }

    /** El chequeo rápido de las dos guardas que comparten todas las escrituras de renglones. */
    private function rechazoRapido(FactPrefactura $prefactura): ?JsonResponse
    {
        return $this->rechazarSiCerrada($prefactura) ?? $this->rechazarSiDescartada($prefactura);
    }
}
