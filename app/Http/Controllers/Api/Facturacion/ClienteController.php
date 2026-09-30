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
    private const PER_PAGE_PERMITIDOS = [10, 20, 50, 100];

    private const ESTADO_ACTIVAS = 'activas';

    private const ESTADO_BAJA = 'baja';

    /**
     * Ordenado por nombre y paginado (es el único catálogo que crece sin techo).
     *
     * Filtros:
     *  - `q`: busca en el nombre y en el RFC. Va AGRUPADO: sin el paréntesis, el
     *    OR se comería el filtro de estado y devolvería filas de cualquier estado.
     *    Un RFC nulo no coincide con nada, que es lo correcto.
     *  - `estado`: `activas`, `baja` o `todas` (por omisión, `todas`: desde esta
     *    lista se llega a un cliente dado de baja para reactivarlo).
     *  - `activas=1`: atajo de `estado=activas`, para los desplegables de otras
     *    pantallas. Se normaliza primero, en un solo lugar.
     *  - `per_page` (10, 20, 50 o 100) y `page`.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        if (! in_array($perPage, self::PER_PAGE_PERMITIDOS, true)) {
            $perPage = 20;
        }

        $estado = $request->boolean('activas') ? self::ESTADO_ACTIVAS : $request->query('estado');

        $query = FactCliente::query()->orderBy('nombre')->orderBy('id');

        match ($estado) {
            self::ESTADO_ACTIVAS => $query->where('status', FactCliente::STATUS_ACTIVO),
            self::ESTADO_BAJA => $query->where('status', FactCliente::STATUS_INACTIVO),
            default => null,
        };

        if ($request->filled('q')) {
            $patron = '%'.trim((string) $request->query('q')).'%';

            $query->where(function ($busqueda) use ($patron) {
                $busqueda->where('nombre', 'LIKE', $patron)->orWhere('rfc', 'LIKE', $patron);
            });
        }

        return response()->json($query->paginate($perPage)->appends($request->query()));
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
