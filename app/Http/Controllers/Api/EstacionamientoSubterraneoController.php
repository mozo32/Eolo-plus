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
        $validated = $request->validate(
            [
                'vehiculo' => [
                    'required',
                    'string',
                    'max:100',
                ],

                'color' => [
                    'nullable',
                    'string',
                    'max:50',
                ],

                'placas' => [
                    'required',
                    'string',
                    'max:20',
                    Rule::unique('estacionamiento_subterraneos', 'placas')
                        ->whereNull('fecha_salida'),
                ],

                'matricula' => [
                    'nullable',
                    'string',
                    'max:50',
                    Rule::unique('estacionamiento_subterraneos', 'matricula')
                        ->whereNull('fecha_salida'),
                ],

                'responsable' => [
                    'required',
                    'string',
                    'max:150',
                ],

                'fecha_ingreso' => [
                    'required',
                    'date',
                ],

                'fecha_salida' => [
                    'nullable',
                    'date',
                    'after_or_equal:fecha_ingreso',
                ],

                'oficial' => [
                    'required',
                    'string',
                    'max:150',
                ],
            ],
            [
                'vehiculo.required' => 'El campo vehículo es obligatorio.',
                'vehiculo.max' => 'El vehículo no debe exceder los 100 caracteres.',
                'color.max' => 'El color no debe exceder los 50 caracteres.',
                'placas.required' => 'Las placas son obligatorias.',
                'placas.max' => 'Las placas no deben exceder los 20 caracteres.',
                'placas.unique' =>
                    'Estas placas ya se encuentran registradas y no tienen fecha de salida.',
                'matricula.max' => 'La matrícula no debe exceder los 50 caracteres.',
                'matricula.unique' =>
                    'Esta matrícula ya se encuentra registrada y no tiene fecha de salida.',
                'responsable.required' => 'El responsable es obligatorio.',
                'responsable.max' => 'El responsable no debe exceder los 150 caracteres.',
                'fecha_ingreso.required' => 'La fecha de ingreso es obligatoria.',
                'fecha_ingreso.date' => 'La fecha de ingreso no es válida.',
                'fecha_salida.date' => 'La fecha de salida no es válida.',
                'fecha_salida.after_or_equal' =>
                    'La fecha de salida debe ser igual o posterior a la fecha de ingreso.',
                'oficial.required' => 'El nombre del oficial es obligatorio.',
                'oficial.max' => 'El nombre del oficial no debe exceder los 150 caracteres.',
            ]
        );

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
