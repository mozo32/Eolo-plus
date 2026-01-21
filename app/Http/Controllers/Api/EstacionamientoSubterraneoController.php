<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\EstacionamientoSubterraneo;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Auth;

class EstacionamientoSubterraneoController extends Controller
{
    public function index(Request $request)
    {
        $query = EstacionamientoSubterraneo::query()
            ->with('user')
            ->orderByDesc('fecha_ingreso');

        if ($request->filled('search')) {
            $search = $request->search;

            $query->where(function ($q) use ($search) {
                $q->where('placas', 'like', "%{$search}%")
                  ->orWhere('vehiculo', 'like', "%{$search}%")
                  ->orWhere('responsable', 'like', "%{$search}%");
            });
        }

        $registros = $query->paginate(10);

        return response()->json($registros);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'vehiculo'        => ['required', 'string', 'max:100'],
            'color'           => ['nullable', 'string', 'max:50'],
            'placas'          => [
                'required',
                'string',
                'max:20',
                Rule::unique('estacionamiento_subterraneos', 'placas')
                    ->whereNull('fecha_salida'),
            ],
            'matricula'       => ['nullable', 'string', 'max:50'],
            'responsable'     => ['required', 'string', 'max:150'],
            'fecha_ingreso'   => ['required', 'date'],
            'fecha_salida'    => ['nullable', 'date', 'after_or_equal:fecha_ingreso'],
            'oficial'         => ['required', 'string', 'max:150'],
        ]);

        EstacionamientoSubterraneo::create([
            ...$validated,
            'user_id' => Auth::id(),
        ]);

        return back()->with('success', 'Vehículo registrado correctamente.');
    }

    public function updateSalida(Request $request, EstacionamientoSubterraneo $estacionamiento)
    {
        $request->validate([
            'fecha_salida' => ['required', 'date', 'after_or_equal:fecha_ingreso'],
        ]);

        $estacionamiento->update([
            'fecha_salida' => $request->fecha_salida,
        ]);

        return response()->json([
            'message' => 'Salida registrada correctamente.',
            'data' =>  $estacionamiento
        ]);
    }
    public function show(EstacionamientoSubterraneo $estacionamiento)
    {
        return response()->json($estacionamiento);
    }
}
