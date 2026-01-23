<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\ChecklistEquipoSeguridad;
use Carbon\Carbon;

class ChecklistEquipoSeguridadController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'user_id' => 'required|exists:users,id',
            'nombre' => 'required|string',
            'checklist' => 'required|array',
        ]);

        $now = Carbon::now();

        $registro = ChecklistEquipoSeguridad::where('user_id', $request->user_id)
            ->whereYear('created_at', $now->year)
            ->whereMonth('created_at', $now->month)
            ->first();

        if ($registro) {
            $registro->update([
                'nombre' => $request->nombre,
                'checklist' => $request->checklist,
                'observaciones' => $request->observaciones,
            ]);

            return response()->json([
                'message' => 'El checklist de este mes ya existía y fue actualizado',
                'alreadyCheckedThisMonth' => true,
                'data' => $registro
            ]);
        }

        $registro = ChecklistEquipoSeguridad::create([
            'user_id' => $request->user_id,
            'nombre' => $request->nombre,
            'checklist' => $request->checklist,
            'observaciones' => $request->observaciones,
        ]);

        return response()->json([
            'message' => 'Checklist creado correctamente',
            'alreadyCheckedThisMonth' => false,
            'data' => $registro
        ]);
    }
    public function show($userId)
    {
        $now = Carbon::now();

        $checklist = ChecklistEquipoSeguridad::where('user_id', $userId)
            ->whereYear('created_at', $now->year)
            ->latest()
            ->first();

        if (!$checklist) {
            return response()->json([
                'message' => 'El usuario no tiene checklist este año',
                'data' => null,
                'alreadyCheckedThisMonth' => false,
            ], 404);
        }

        $sameMonth = $checklist->created_at->month === $now->month;

        return response()->json([
            'message' => $sameMonth
                ? 'Ya se hizo el checklist de este mes'
                : 'Checklist encontrado (mes anterior)',
            'alreadyCheckedThisMonth' => $sameMonth,
            'data' => $checklist,
        ]);
    }

}
