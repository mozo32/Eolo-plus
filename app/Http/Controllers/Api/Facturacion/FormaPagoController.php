<?php

namespace App\Http\Controllers\Api\Facturacion;

use App\Http\Controllers\Controller;
use App\Http\Requests\Facturacion\StoreFormaPagoRequest;
use App\Http\Requests\Facturacion\UpdateFormaPagoRequest;
use App\Models\Bitacora;
use App\Models\FactFormaPago;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Catálogo de formas de pago de facturación.
 *
 * Consultar es para cualquier usuario con sesión; escribir exige el
 * subdepartamento factFormasPago (ver routes/api.php). Nada se borra: se da de
 * baja con una actualización atómica.
 */
class FormaPagoController extends Controller
{
    /** Ordenado por nombre. `?activas=1` deja fuera lo dado de baja. */
    public function index(Request $request): JsonResponse
    {
        $query = FactFormaPago::query()->orderBy('nombre');

        if ($request->boolean('activas')) {
            $query->activos();
        }

        return response()->json(['formas_pago' => $query->get()]);
    }

    public function store(StoreFormaPagoRequest $request): JsonResponse
    {
        $formaPago = FactFormaPago::create($request->validated() + [
            'status' => FactFormaPago::STATUS_ACTIVO,
        ]);

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_CREAR,
            descripcion: "Se dio de alta la forma de pago {$formaPago->nombre}.",
            registroId: $formaPago->id,
            datosNuevos: $this->datosBitacora($formaPago),
        );

        return response()->json([
            'message' => 'Forma de pago registrada correctamente.',
            'forma_pago' => $formaPago,
        ], 201);
    }

    public function update(UpdateFormaPagoRequest $request, int $id): JsonResponse
    {
        $formaPago = FactFormaPago::query()->findOrFail($id);
        $anteriores = $this->datosBitacora($formaPago);

        $formaPago->update($request->validated());

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_ACTUALIZAR,
            descripcion: "Se actualizó la forma de pago {$formaPago->nombre}.",
            registroId: $formaPago->id,
            datosAnteriores: $anteriores,
            datosNuevos: $this->datosBitacora($formaPago),
        );

        return response()->json([
            'message' => 'Forma de pago actualizada correctamente.',
            'forma_pago' => $formaPago,
        ]);
    }

    /** Baja lógica atómica: solo una petición encuentra la fila todavía activa. */
    public function desactivar(int $id): JsonResponse
    {
        $filas = FactFormaPago::query()
            ->where('id', $id)
            ->where('status', FactFormaPago::STATUS_ACTIVO)
            ->update(['status' => FactFormaPago::STATUS_INACTIVO, 'updated_at' => now()]);

        if ($filas === 0) {
            $existe = FactFormaPago::query()->whereKey($id)->exists();

            abort_if(! $existe, 404);

            return response()->json([
                'message' => 'Esta forma de pago ya estaba dada de baja.',
                'codigo' => 'ya_desactivada',
            ], 409);
        }

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_DESACTIVAR,
            descripcion: "Se dio de baja la forma de pago {$id}.",
            registroId: $id,
        );

        return response()->json(['message' => 'Forma de pago dada de baja.']);
    }

    /** Reactivación atómica: deshace una baja por error sin tocar la base de datos. */
    public function reactivar(int $id): JsonResponse
    {
        $filas = FactFormaPago::query()
            ->where('id', $id)
            ->where('status', FactFormaPago::STATUS_INACTIVO)
            ->update(['status' => FactFormaPago::STATUS_ACTIVO, 'updated_at' => now()]);

        if ($filas === 0) {
            $existe = FactFormaPago::query()->whereKey($id)->exists();

            abort_if(! $existe, 404);

            return response()->json([
                'message' => 'Esta forma de pago ya estaba activa.',
                'codigo' => 'ya_activa',
            ], 409);
        }

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_ACTIVAR,
            descripcion: "Se reactivó la forma de pago {$id}.",
            registroId: $id,
        );

        return response()->json(['message' => 'Forma de pago reactivada.']);
    }

    private function datosBitacora(FactFormaPago $formaPago): array
    {
        return [
            'nombre' => $formaPago->nombre,
            'status' => $formaPago->status,
        ];
    }
}
