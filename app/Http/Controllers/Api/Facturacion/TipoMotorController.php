<?php

namespace App\Http\Controllers\Api\Facturacion;

use App\Http\Controllers\Controller;
use App\Http\Requests\Facturacion\StoreTipoMotorRequest;
use App\Http\Requests\Facturacion\UpdateTipoMotorRequest;
use App\Models\Bitacora;
use App\Models\FactTipoMotor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Catálogo de tipos de motor y su tarifa de aterrizaje.
 *
 * Consultar es para cualquier usuario con sesión; escribir exige el
 * subdepartamento factTiposMotor (ver routes/api.php).
 */
class TipoMotorController extends Controller
{
    /** Todos, ordenados por nombre. `?activas=1` deja fuera los dados de baja. */
    public function index(Request $request): JsonResponse
    {
        $query = FactTipoMotor::query()->orderBy('nombre');

        if ($request->boolean('activas')) {
            $query->activas();
        }

        return response()->json(['tipos_motor' => $query->get()]);
    }

    public function store(StoreTipoMotorRequest $request): JsonResponse
    {
        $motor = FactTipoMotor::create($request->validated() + [
            'status' => FactTipoMotor::STATUS_ACTIVO,
        ]);

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_CREAR,
            descripcion: "Se dio de alta el tipo de motor {$motor->nombre}.",
            registroId: $motor->id,
            datosNuevos: $this->datosBitacora($motor),
        );

        return response()->json([
            'message' => 'Tipo de motor registrado correctamente.',
            'tipo_motor' => $motor,
        ], 201);
    }

    public function update(UpdateTipoMotorRequest $request, int $id): JsonResponse
    {
        $motor = FactTipoMotor::query()->findOrFail($id);
        $anteriores = $this->datosBitacora($motor);

        $motor->update($request->validated());

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_ACTUALIZAR,
            descripcion: "Se actualizó el tipo de motor {$motor->nombre}.",
            registroId: $motor->id,
            datosAnteriores: $anteriores,
            datosNuevos: $this->datosBitacora($motor),
        );

        return response()->json([
            'message' => 'Tipo de motor actualizado correctamente.',
            'tipo_motor' => $motor,
        ]);
    }

    /** Baja lógica atómica: solo una petición encuentra la fila todavía activa. */
    public function desactivar(int $id): JsonResponse
    {
        $filas = FactTipoMotor::query()
            ->where('id', $id)
            ->where('status', FactTipoMotor::STATUS_ACTIVO)
            ->update(['status' => FactTipoMotor::STATUS_INACTIVO, 'updated_at' => now()]);

        if ($filas === 0) {
            $existe = FactTipoMotor::query()->whereKey($id)->exists();

            abort_if(! $existe, 404);

            return response()->json([
                'message' => 'Este tipo de motor ya estaba dado de baja.',
                'codigo' => 'ya_desactivado',
            ], 409);
        }

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_DESACTIVAR,
            descripcion: "Se dio de baja el tipo de motor {$id}.",
            registroId: $id,
        );

        return response()->json(['message' => 'Tipo de motor dado de baja.']);
    }

    /** Reactivación atómica: deshace una baja por error sin tocar la base de datos. */
    public function reactivar(int $id): JsonResponse
    {
        $filas = FactTipoMotor::query()
            ->where('id', $id)
            ->where('status', FactTipoMotor::STATUS_INACTIVO)
            ->update(['status' => FactTipoMotor::STATUS_ACTIVO, 'updated_at' => now()]);

        if ($filas === 0) {
            $existe = FactTipoMotor::query()->whereKey($id)->exists();

            abort_if(! $existe, 404);

            return response()->json([
                'message' => 'Este tipo de motor ya estaba activo.',
                'codigo' => 'ya_activo',
            ], 409);
        }

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_ACTIVAR,
            descripcion: "Se reactivó el tipo de motor {$id}.",
            registroId: $id,
        );

        return response()->json(['message' => 'Tipo de motor reactivado.']);
    }

    private function datosBitacora(FactTipoMotor $motor): array
    {
        return [
            'nombre' => $motor->nombre,
            'tarifa_aterrizaje' => $motor->tarifa_aterrizaje,
            'status' => $motor->status,
        ];
    }
}
