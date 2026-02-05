<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Vehiculo;
use App\Models\movimientoVehiculo;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class VehiculoEoloController extends Controller
{
    public function index()
    {
        try {
            $vehiculos = Vehiculo::all()->map(function ($v) {
                return [
                    'id' => $v->id,
                    'nombre' => $v->nombre,
                    'estado' => $v->estado,
                    'ultimaActividad' => $v->ultima_actividad ?? 'N/A'
                ];
            });

            return response()->json($vehiculos, 200);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function registrarMovimiento(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'vehiculo_id'  => 'required|exists:vehiculos,id',
            'movimiento'   => 'required|in:Salida,Entrada',
            'chofer'       => 'required|string|max:255',
            'kilometraje'  => 'required|numeric',
            'gasolina'     => 'required|string',
            'destino'      => 'nullable|string',
            'autoriza'     => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            return DB::transaction(function () use ($request) {
                $movimiento = movimientoVehiculo::create([
                    'vehiculo_id' => $request->vehiculo_id,
                    'tipo'        => $request->movimiento,
                    'chofer'      => $request->chofer,
                    'kilometraje' => $request->kilometraje,
                    'gasolina'    => $request->gasolina,
                    'destino'     => $request->destino,
                    'autoriza'    => $request->autoriza,
                ]);

                $vehiculo = Vehiculo::find($request->vehiculo_id);
                $vehiculo->update([
                    'estado'           => ($request->movimiento === 'Salida') ? 'En Ruta' : 'En Planta',
                    'ultima_actividad' => now(),
                ]);

                return response()->json([
                    'message' => 'Movimiento registrado con éxito',
                    'vehiculo' => $vehiculo,
                    'movimiento' => $movimiento
                ], 201);
            });
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error al procesar el registro',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function obtenerHistorial($id)
    {
        $movimientos = movimientoVehiculo::where('vehiculo_id', $id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($movimientos);
    }
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id' => 'required|string|unique:vehiculos,id|max:50',
            'nombre' => 'required|string|max:255',
            'estado' => 'required|in:En Planta,En Ruta'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'El ID ya existe o los datos son inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $vehiculo = Vehiculo::create([
                'id' => $request->id,
                'nombre' => $request->nombre,
                'estado' => $request->estado,
                'ultima_actividad' => null
            ]);

            return response()->json([
                'message' => 'Vehículo creado con éxito',
                'vehiculo' => $vehiculo
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error al guardar en la base de datos',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
