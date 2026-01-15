<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class DespachoController extends Controller
{
    public function store(Request $request)
    {
        // Validación
        $validated = $request->validate([
            'estado' => 'required|string',
            'procedencia' => 'required|string|max:255',
            'matricula' => 'required|string|max:255',
            'photos.*' => 'nullable|image|max:5000',
        ]);

        $paths = [];
        if ($request->hasFile('photos')) {
            foreach ($request->file('photos') as $photo) {
                $paths[] = $photo->store('despacho/photos', 'public');
            }
        }

        $registro = Despacho::create([
            'estado' => $validated['estado'],
            'procedencia' => $validated['procedencia'],
            'matricula' => $validated['matricula'],
            'photos' => json_encode($paths),
        ]);

        return response()->json([
            'message' => 'Guardado correctamente',
            'photos' => $paths,
        ], 201);
    }
}
