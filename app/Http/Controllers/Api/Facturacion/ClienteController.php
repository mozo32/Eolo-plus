<?php

namespace App\Http\Controllers\Api\Facturacion;

use App\Http\Controllers\Controller;
use App\Http\Requests\Facturacion\StoreClienteRequest;
use App\Http\Requests\Facturacion\UpdateClienteRequest;
use App\Models\Bitacora;
use App\Models\FactCliente;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Catálogo de clientes de facturación.
 *
 * Consultar es para cualquier usuario con sesión; escribir exige el
 * subdepartamento factClientes (ver routes/api.php). Nada se borra: se da de
 * baja con una actualización atómica.
 */
class ClienteController extends Controller
{
    /** Ordenado por nombre. `?activas=1` deja fuera lo dado de baja. */
    public function index(Request $request): JsonResponse
    {
        $query = FactCliente::query()->orderBy('nombre');

        if ($request->boolean('activas')) {
            $query->activos();
        }

        return response()->json(['clientes' => $query->get()]);
    }

    public function store(StoreClienteRequest $request): JsonResponse
    {
        $cliente = FactCliente::create($request->validated() + [
            'status' => FactCliente::STATUS_ACTIVO,
        ]);

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_CREAR,
            descripcion: "Se dio de alta el cliente {$cliente->nombre}.",
            registroId: $cliente->id,
            datosNuevos: $this->datosBitacora($cliente),
        );

        return response()->json([
            'message' => 'Cliente registrado correctamente.',
            'cliente' => $cliente,
        ], 201);
    }

    public function update(UpdateClienteRequest $request, int $id): JsonResponse
    {
        $cliente = FactCliente::query()->findOrFail($id);
        $anteriores = $this->datosBitacora($cliente);

        $cliente->update($request->validated());

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_ACTUALIZAR,
            descripcion: "Se actualizó el cliente {$cliente->nombre}.",
            registroId: $cliente->id,
            datosAnteriores: $anteriores,
            datosNuevos: $this->datosBitacora($cliente),
        );

        return response()->json([
            'message' => 'Cliente actualizado correctamente.',
            'cliente' => $cliente,
        ]);
    }

    /** Baja lógica atómica: solo una petición encuentra la fila todavía activa. */
    public function desactivar(int $id): JsonResponse
    {
        $filas = FactCliente::query()
            ->where('id', $id)
            ->where('status', FactCliente::STATUS_ACTIVO)
            ->update(['status' => FactCliente::STATUS_INACTIVO, 'updated_at' => now()]);

        if ($filas === 0) {
            $existe = FactCliente::query()->whereKey($id)->exists();

            abort_if(! $existe, 404);

            return response()->json([
                'message' => 'Este cliente ya estaba dado de baja.',
                'codigo' => 'ya_desactivado',
            ], 409);
        }

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_DESACTIVAR,
            descripcion: "Se dio de baja el cliente {$id}.",
            registroId: $id,
        );

        return response()->json(['message' => 'Cliente dado de baja.']);
    }

    /** Reactivación atómica: deshace una baja por error sin tocar la base de datos. */
    public function reactivar(int $id): JsonResponse
    {
        $filas = FactCliente::query()
            ->where('id', $id)
            ->where('status', FactCliente::STATUS_INACTIVO)
            ->update(['status' => FactCliente::STATUS_ACTIVO, 'updated_at' => now()]);

        if ($filas === 0) {
            $existe = FactCliente::query()->whereKey($id)->exists();

            abort_if(! $existe, 404);

            return response()->json([
                'message' => 'Este cliente ya estaba activo.',
                'codigo' => 'ya_activo',
            ], 409);
        }

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_ACTIVAR,
            descripcion: "Se reactivó el cliente {$id}.",
            registroId: $id,
        );

        return response()->json(['message' => 'Cliente reactivado.']);
    }

    private function datosBitacora(FactCliente $cliente): array
    {
        return [
            'nombre' => $cliente->nombre,
            'rfc' => $cliente->rfc,
            'correo' => $cliente->correo,
            'telefono' => $cliente->telefono,
            'status' => $cliente->status,
        ];
    }
}
