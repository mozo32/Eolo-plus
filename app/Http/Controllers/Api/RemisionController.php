<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Remision;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class RemisionController extends Controller
{
    public function store(Request $request)
    {
        try {
            $validatedData = $request->validate([
                'folio' => 'required|string',
                'fecha' => 'required|date',
                'es_vuelo' => 'required|boolean',
                'cliente_vuelo' => 'required_if:es_vuelo,true|nullable|string',
                'requisicion' => 'required_if:es_vuelo,true|nullable|string',
                'forma_pago' => 'required_if:es_vuelo,true|nullable|string',

                'tipo_aeronave' => 'required|string',
                'matricula' => 'required|string',
                'destino' => 'required|string',

                'hora_llegada' => 'nullable',
                'hora_inicio' => 'nullable',
                'hora_final' => 'nullable',

                'lectura_inicial' => 'required|numeric',
                'lectura_final' => 'required|numeric|gte:lectura_inicial',
                'total_litros' => 'required|numeric',

                'observaciones' => 'nullable|string',
                'nombre_cliente_firma' => 'required|string',
                'nombre_operador_firma' => 'required|string',
            ]);

            $remision = DB::transaction(function () use ($validatedData) {
                return Remision::create($validatedData);
            });

            return response()->json([
                'status' => 'success',
                'message' => 'Remisión guardada correctamente',
                'data' => $remision
            ], 201);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error("Error al guardar remisión: " . $e->getMessage());
            return response()->json([
                'status' => 'error',
                'message' => 'Error interno del servidor'
            ], 500);
        }
    }
    public function index()
    {
        $remisiones = Remision::whereDate('fecha', now()->toDateString())
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($remisiones);
    }
}
