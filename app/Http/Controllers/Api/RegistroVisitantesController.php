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
    public function index(){
        $data = RegistroVisitante::get();
        return response()->json($data);
    }
}
