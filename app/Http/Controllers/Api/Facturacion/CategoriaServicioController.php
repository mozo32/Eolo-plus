<?php

namespace App\Http\Controllers\Api\Facturacion;

use App\Http\Controllers\Controller;
use App\Http\Requests\Facturacion\StoreCategoriaServicioRequest;
use App\Http\Requests\Facturacion\UpdateCategoriaServicioRequest;
use App\Models\Bitacora;
use App\Models\FactCategoriaServicio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Catálogo de categorías de servicio de facturación.
 *
 * Consultar es para cualquier usuario con sesión; escribir exige el
 * subdepartamento factServicios (ver routes/api.php). Nada se borra: se da de
 * baja con una actualización atómica.
 */
class CategoriaServicioController extends Controller
{
    /** Ordenado por nombre. `?activas=1` deja fuera lo dado de baja. */
    public function index(Request $request): JsonResponse
    {
        $query = FactCategoriaServicio::query()->orderBy('nombre');

        if ($request->boolean('activas')) {
            $query->activos();
        }

        return response()->json(['categorias' => $query->get()]);
    }

    public function store(StoreCategoriaServicioRequest $request): JsonResponse
    {
        $categoria = FactCategoriaServicio::create($request->validated() + [
            'status' => FactCategoriaServicio::STATUS_ACTIVO,
        ]);

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_CREAR,
            descripcion: "Se dio de alta la categoría de servicio {$categoria->nombre}.",
            registroId: $categoria->id,
            datosNuevos: $this->datosBitacora($categoria),
        );

        return response()->json([
            'message' => 'Categoría de servicio registrada correctamente.',
            'categoria' => $categoria,
        ], 201);
    }

    public function update(UpdateCategoriaServicioRequest $request, int $id): JsonResponse
    {
        $categoria = FactCategoriaServicio::query()->findOrFail($id);
        $anteriores = $this->datosBitacora($categoria);

        $categoria->update($request->validated());

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_ACTUALIZAR,
            descripcion: "Se actualizó la categoría de servicio {$categoria->nombre}.",
            registroId: $categoria->id,
            datosAnteriores: $anteriores,
            datosNuevos: $this->datosBitacora($categoria),
        );

        return response()->json([
            'message' => 'Categoría de servicio actualizada correctamente.',
            'categoria' => $categoria,
        ]);
    }

    /** Baja lógica atómica: solo una petición encuentra la fila todavía activa. */
    public function desactivar(int $id): JsonResponse
    {
        $filas = FactCategoriaServicio::query()
            ->where('id', $id)
            ->where('status', FactCategoriaServicio::STATUS_ACTIVO)
            ->update(['status' => FactCategoriaServicio::STATUS_INACTIVO, 'updated_at' => now()]);

        if ($filas === 0) {
            $existe = FactCategoriaServicio::query()->whereKey($id)->exists();

            abort_if(! $existe, 404);

            return response()->json([
                'message' => 'Esta categoría de servicio ya estaba dada de baja.',
                'codigo' => 'ya_desactivada',
            ], 409);
        }

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_DESACTIVAR,
            descripcion: "Se dio de baja la categoría de servicio {$id}.",
            registroId: $id,
        );

        return response()->json(['message' => 'Categoría de servicio dada de baja.']);
    }

    /** Reactivación atómica: deshace una baja por error sin tocar la base de datos. */
    public function reactivar(int $id): JsonResponse
    {
        $filas = FactCategoriaServicio::query()
            ->where('id', $id)
            ->where('status', FactCategoriaServicio::STATUS_INACTIVO)
            ->update(['status' => FactCategoriaServicio::STATUS_ACTIVO, 'updated_at' => now()]);

        if ($filas === 0) {
            $existe = FactCategoriaServicio::query()->whereKey($id)->exists();

            abort_if(! $existe, 404);

            return response()->json([
                'message' => 'Esta categoría de servicio ya estaba activa.',
                'codigo' => 'ya_activa',
            ], 409);
        }

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_ACTIVAR,
            descripcion: "Se reactivó la categoría de servicio {$id}.",
            registroId: $id,
        );

        return response()->json(['message' => 'Categoría de servicio reactivada.']);
    }

    private function datosBitacora(FactCategoriaServicio $categoria): array
    {
        return [
            'nombre' => $categoria->nombre,
            'status' => $categoria->status,
        ];
    }
}
