<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\OperacionDiaria;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class OperacionesDiariasController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'fecha'     => ['required', 'date'],
            'tipo'      => ['required', 'in:llegada,salida'],
            'matricula' => ['required', 'string', 'max:20'],
            'equipo'    => ['required', 'string', 'max:50'],
            'hora'      => ['required', 'date_format:H:i'],
            'lugar'     => ['required', 'string', 'max:100'],
            'pax'       => ['required', 'integer', 'min:0'],
        ]);

        $operacion = OperacionDiaria::create([
            'user_id'   => Auth::id(),
            'fecha'     => $validated['fecha'],
            'tipo'      => $validated['tipo'],
            'matricula' => $validated['matricula'],
            'equipo'    => $validated['equipo'],
            'hora'      => $validated['hora'],
            'lugar'     => $validated['lugar'],
            'pax'       => $validated['pax'],
        ]);

        return response()->json([
            'message'   => 'Operación guardada correctamente',
            'operacion' => $operacion,
        ], 201);
    }

    public function index(Request $request)
    {
        $request->validate([
            'fecha' => ['required', 'date'],
        ]);

        $fecha = $request->query('fecha');

        $operaciones = OperacionDiaria::whereDate('fecha', $fecha)
            ->orderBy('hora')
            ->get();

        return response()->json([
            'fecha' => $fecha,
            'llegadas' => $operaciones
                ->where('tipo', 'llegada')
                ->values(),
            'salidas' => $operaciones
                ->where('tipo', 'salida')
                ->values(),
        ]);
    }
}
