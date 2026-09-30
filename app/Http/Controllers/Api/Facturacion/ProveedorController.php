<?php

namespace App\Http\Controllers\Api\Facturacion;

use App\Http\Controllers\Controller;
use App\Http\Requests\Facturacion\StoreProveedorRequest;
use App\Http\Requests\Facturacion\UpdateProveedorRequest;
use App\Models\Bitacora;
use App\Models\FactProveedor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Catálogo de proveedores de facturación.
 *
 * Consultar es para cualquier usuario con sesión; escribir exige el
 * subdepartamento factProveedores (ver routes/api.php). Nada se borra: se da de
 * baja con una actualización atómica.
 */
class ProveedorController extends Controller
{
    /** Ordenado por nombre. `?activas=1` deja fuera lo dado de baja. */
    public function index(Request $request): JsonResponse
    {
        $query = FactProveedor::query()->orderBy('nombre');

        if ($request->boolean('activas')) {
            $query->activos();
        }

        return response()->json(['proveedores' => $query->get()]);
    }

    public function store(StoreProveedorRequest $request): JsonResponse
    {
        $proveedor = FactProveedor::create($request->validated() + [
            'status' => FactProveedor::STATUS_ACTIVO,
        ]);

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_CREAR,
            descripcion: "Se dio de alta el proveedor {$proveedor->nombre}.",
            registroId: $proveedor->id,
            datosNuevos: $this->datosBitacora($proveedor),
        );

        return response()->json([
            'message' => 'Proveedor registrado correctamente.',
            'proveedor' => $proveedor,
        ], 201);
    }

    public function update(UpdateProveedorRequest $request, int $id): JsonResponse
    {
        $proveedor = FactProveedor::query()->findOrFail($id);
        $anteriores = $this->datosBitacora($proveedor);

        $proveedor->update($request->validated());

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_ACTUALIZAR,
            descripcion: "Se actualizó el proveedor {$proveedor->nombre}.",
            registroId: $proveedor->id,
            datosAnteriores: $anteriores,
            datosNuevos: $this->datosBitacora($proveedor),
        );

        return response()->json([
            'message' => 'Proveedor actualizado correctamente.',
            'proveedor' => $proveedor,
        ]);
    }

    /** Baja lógica atómica: solo una petición encuentra la fila todavía activa. */
    public function desactivar(int $id): JsonResponse
    {
        $filas = FactProveedor::query()
            ->where('id', $id)
            ->where('status', FactProveedor::STATUS_ACTIVO)
            ->update(['status' => FactProveedor::STATUS_INACTIVO, 'updated_at' => now()]);

        if ($filas === 0) {
            $existe = FactProveedor::query()->whereKey($id)->exists();

            abort_if(! $existe, 404);

            return response()->json([
                'message' => 'Este proveedor ya estaba dado de baja.',
                'codigo' => 'ya_desactivado',
            ], 409);
        }

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_DESACTIVAR,
            descripcion: "Se dio de baja el proveedor {$id}.",
            registroId: $id,
        );

        return response()->json(['message' => 'Proveedor dado de baja.']);
    }

    /** Reactivación atómica: deshace una baja por error sin tocar la base de datos. */
    public function reactivar(int $id): JsonResponse
    {
        $filas = FactProveedor::query()
            ->where('id', $id)
            ->where('status', FactProveedor::STATUS_INACTIVO)
            ->update(['status' => FactProveedor::STATUS_ACTIVO, 'updated_at' => now()]);

        if ($filas === 0) {
            $existe = FactProveedor::query()->whereKey($id)->exists();

            abort_if(! $existe, 404);

            return response()->json([
                'message' => 'Este proveedor ya estaba activo.',
                'codigo' => 'ya_activo',
            ], 409);
        }

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_ACTIVAR,
            descripcion: "Se reactivó el proveedor {$id}.",
            registroId: $id,
        );

        return response()->json(['message' => 'Proveedor reactivado.']);
    }

    private function datosBitacora(FactProveedor $proveedor): array
    {
        return [
            'nombre' => $proveedor->nombre,
            'status' => $proveedor->status,
        ];
    }
}
