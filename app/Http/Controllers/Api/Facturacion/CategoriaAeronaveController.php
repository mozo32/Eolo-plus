<?php

namespace App\Http\Controllers\Api\Facturacion;

use App\Http\Controllers\Controller;
use App\Http\Requests\Facturacion\StoreCategoriaAeronaveRequest;
use App\Http\Requests\Facturacion\UpdateCategoriaAeronaveRequest;
use App\Models\Bitacora;
use App\Models\FactCategoriaAeronave;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Catálogo de categorías de aeronave y sus tarifas de estancia.
 *
 * Consultar es para cualquier usuario con sesión; escribir exige el
 * subdepartamento factCategoriasAeronave (ver routes/api.php). Las categorías
 * no se borran: se dan de baja con una actualización atómica.
 */
class CategoriaAeronaveController extends Controller
{
    /** Todas, ordenadas por nombre. `?activas=1` deja fuera las dadas de baja. */
    public function index(Request $request): JsonResponse
    {
        $query = FactCategoriaAeronave::query()->orderBy('nombre');

        if ($request->boolean('activas')) {
            $query->activas();
        }

        return response()->json(['categorias' => $query->get()]);
    }

    public function store(StoreCategoriaAeronaveRequest $request): JsonResponse
    {
        $categoria = FactCategoriaAeronave::create($request->validated() + [
            'status' => FactCategoriaAeronave::STATUS_ACTIVO,
        ]);

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_CREAR,
            descripcion: "Se dio de alta la categoría de aeronave {$categoria->nombre}.",
            registroId: $categoria->id,
            datosNuevos: $this->datosBitacora($categoria),
        );

        return response()->json([
            'message' => 'Categoría registrada correctamente.',
            'categoria' => $categoria,
        ], 201);
    }

    public function update(UpdateCategoriaAeronaveRequest $request, int $id): JsonResponse
    {
        $categoria = FactCategoriaAeronave::query()->findOrFail($id);
        $anteriores = $this->datosBitacora($categoria);

        $categoria->update($request->validated());

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_ACTUALIZAR,
            descripcion: "Se actualizó la categoría de aeronave {$categoria->nombre}.",
            registroId: $categoria->id,
            datosAnteriores: $anteriores,
            datosNuevos: $this->datosBitacora($categoria),
        );

        return response()->json([
            'message' => 'Categoría actualizada correctamente.',
            'categoria' => $categoria,
        ]);
    }

    /** Baja lógica atómica: solo una petición encuentra la fila todavía activa. */
    public function desactivar(int $id): JsonResponse
    {
        $filas = FactCategoriaAeronave::query()
            ->where('id', $id)
            ->where('status', FactCategoriaAeronave::STATUS_ACTIVO)
            ->update(['status' => FactCategoriaAeronave::STATUS_INACTIVO, 'updated_at' => now()]);

        if ($filas === 0) {
            $existe = FactCategoriaAeronave::query()->whereKey($id)->exists();

            abort_if(! $existe, 404);

            return response()->json([
                'message' => 'Esta categoría ya estaba dada de baja.',
                'codigo' => 'ya_desactivada',
            ], 409);
        }

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_DESACTIVAR,
            descripcion: "Se dio de baja la categoría de aeronave {$id}.",
            registroId: $id,
        );

        return response()->json(['message' => 'Categoría dada de baja.']);
    }

    /** Reactivación atómica: deshace una baja por error sin tocar la base de datos. */
    public function reactivar(int $id): JsonResponse
    {
        $filas = FactCategoriaAeronave::query()
            ->where('id', $id)
            ->where('status', FactCategoriaAeronave::STATUS_INACTIVO)
            ->update(['status' => FactCategoriaAeronave::STATUS_ACTIVO, 'updated_at' => now()]);

        if ($filas === 0) {
            $existe = FactCategoriaAeronave::query()->whereKey($id)->exists();

            abort_if(! $existe, 404);

            return response()->json([
                'message' => 'Esta categoría ya estaba activa.',
                'codigo' => 'ya_activa',
            ], 409);
        }

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_ACTIVAR,
            descripcion: "Se reactivó la categoría de aeronave {$id}.",
            registroId: $id,
        );

        return response()->json(['message' => 'Categoría reactivada.']);
    }

    private function datosBitacora(FactCategoriaAeronave $categoria): array
    {
        return [
            'nombre' => $categoria->nombre,
            'tarifa_pernocta' => $categoria->tarifa_pernocta,
            'tarifa_transito_2h' => $categoria->tarifa_transito_2h,
            'tarifa_transito_12h' => $categoria->tarifa_transito_12h,
            'status' => $categoria->status,
        ];
    }
}
