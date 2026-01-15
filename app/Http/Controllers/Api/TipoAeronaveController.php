<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\TipoAeronave;
class TipoAeronaveController extends Controller
{
    public function index()
    {
        return TipoAeronave::select('id', 'nombre')->orderBy('nombre')->get();
    }
    public function newTipoAeronave(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nombre'    => ['required', 'string', 'max:100'],
        ]);
        $tipo = TipoAeronave::create([
            'nombre'       => $validated['nombre'],
        ]);
        return response()->json($tipo, 201);
    }
}
