<?php

namespace App\Http\Controllers\Api\Facturacion;

use App\Http\Controllers\Controller;
use App\Http\Requests\Facturacion\StoreServicioRequest;
use App\Http\Requests\Facturacion\UpdateServicioRequest;
use App\Models\Bitacora;
use App\Models\FactServicio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Catálogo de servicios de facturación.
 *
 * Consultar es para cualquier usuario con sesión; escribir exige el
 * subdepartamento factServicios (ver routes/api.php). Nada se borra: se da de
 * baja con una actualización atómica.
 */
class ServicioController extends Controller
{
    /** Ordenado por nombre. `?activas=1` deja fuera lo dado de baja. */
    public function index(Request $request): JsonResponse
    {
        $query = FactServicio::query()->with('categoria')->orderBy('nombre');

        if ($request->boolean('activas')) {
            $query->activos();
        }

        return response()->json(['servicios' => $query->get()]);
    }

    public function store(StoreServicioRequest $request): JsonResponse
    {
        $servicio = FactServicio::create($request->validated() + [
            'status' => FactServicio::STATUS_ACTIVO,
        ]);

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_CREAR,
            descripcion: "Se dio de alta el servicio {$servicio->nombre}.",
            registroId: $servicio->id,
            datosNuevos: $this->datosBitacora($servicio),
        );

        return response()->json([
            'message' => 'Servicio registrado correctamente.',
            'servicio' => $servicio,
        ], 201);
    }

    public function update(UpdateServicioRequest $request, int $id): JsonResponse
    {
        $servicio = FactServicio::query()->findOrFail($id);
        $anteriores = $this->datosBitacora($servicio);

        $servicio->update($request->validated());

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_ACTUALIZAR,
            descripcion: "Se actualizó el servicio {$servicio->nombre}.",
            registroId: $servicio->id,
            datosAnteriores: $anteriores,
            datosNuevos: $this->datosBitacora($servicio),
        );

        return response()->json([
            'message' => 'Servicio actualizado correctamente.',
            'servicio' => $servicio,
        ]);
    }

    /** Baja lógica atómica: solo una petición encuentra la fila todavía activa. */
    public function desactivar(int $id): JsonResponse
    {
        $filas = FactServicio::query()
            ->where('id', $id)
            ->where('status', FactServicio::STATUS_ACTIVO)
            ->update(['status' => FactServicio::STATUS_INACTIVO, 'updated_at' => now()]);

        if ($filas === 0) {
            $existe = FactServicio::query()->whereKey($id)->exists();

            abort_if(! $existe, 404);

            return response()->json([
                'message' => 'Este servicio ya estaba dado de baja.',
                'codigo' => 'ya_desactivado',
            ], 409);
        }

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_DESACTIVAR,
            descripcion: "Se dio de baja el servicio {$id}.",
            registroId: $id,
        );

        return response()->json(['message' => 'Servicio dado de baja.']);
    }

    /** Reactivación atómica: deshace una baja por error sin tocar la base de datos. */
    public function reactivar(int $id): JsonResponse
    {
        $filas = FactServicio::query()
            ->where('id', $id)
            ->where('status', FactServicio::STATUS_INACTIVO)
            ->update(['status' => FactServicio::STATUS_ACTIVO, 'updated_at' => now()]);

        if ($filas === 0) {
            $existe = FactServicio::query()->whereKey($id)->exists();

            abort_if(! $existe, 404);

            return response()->json([
                'message' => 'Este servicio ya estaba activo.',
                'codigo' => 'ya_activo',
            ], 409);
        }

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_ACTIVAR,
            descripcion: "Se reactivó el servicio {$id}.",
            registroId: $id,
        );

        return response()->json(['message' => 'Servicio reactivado.']);
    }

    private function datosBitacora(FactServicio $servicio): array
    {
        return [
            'categoria_servicio_id' => $servicio->categoria_servicio_id,
            'nombre' => $servicio->nombre,
            'precio_unitario' => $servicio->precio_unitario,
            'es_de_tercero' => $servicio->es_de_tercero,
            'margen' => $servicio->margen,
            'ajuste_precio' => $servicio->ajuste_precio,
            'status' => $servicio->status,
        ];
    }
}
