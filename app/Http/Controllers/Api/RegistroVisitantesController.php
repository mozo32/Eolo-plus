<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\RegistroVisitante;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class RegistroVisitantesController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'nombre'         => 'required|string|max:255',
            'procedencia'    => 'required|string|max:255',
            'a_quien_visita' => 'required|string|max:255',
            'gafete'         => 'required|string|max:50',
            'empresa'        => 'required|string',
            'autoriza'       => 'required|string',
            'fechaRegistro'       => 'required|string',
            'horaEntrada'       => 'required|string',
        ]);

        $registro = RegistroVisitante::create([
            ...$validated,
            'fecha_entrada' => $validated['fechaRegistro'],
            'hora_entrada'  => $validated['horaEntrada'],
            'user_id'       => Auth::id(),
        ]);

        return response()->json([
            'message' => 'Entrada registrada con éxito',
            'data'    => $registro
        ], 201);
    }
    public function salida(Request $request, RegistroVisitante $registroVisitante)
    {
        DB::beginTransaction();
        try {
            $validated = $request->validate([
                'fechaSalida'       => 'required|string',
                'horaSalida'       => 'required|string',
            ]);

            $registroVisitante->update([
                'fecha_salida'    => $validated['fechaSalida'] ?? null,
                'hora_salida' => $validated['horaSalida'] ?? null,
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Salida registrada correctamente',
                'data' => $registroVisitante,
            ]);

        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Error al actualizar salida',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
    public function index(Request $request)
    {
        $query = RegistroVisitante::query();
        $query->whereNull('hora_salida');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('nombre', 'like', "%{$search}%")
                ->orWhere('gafete', 'like', "%{$search}%");
            });
        }

        if ($request->filled('fecha')) {
            $query->whereDate('created_at', $request->fecha);
        } else {
            $query->whereDate('created_at', today());
        }
        $data = $query->orderBy('hora_entrada', 'desc')->get();
        return response()->json($data);
    }
}
