<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\ChecklistEquipoSeguridad;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ChecklistEquipoSeguridadController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'user_id' => 'required|exists:users,id',
            'nombre' => 'required|string',
        ],
        [
            'user_id.required' => 'Debes seleccionar un usuario o el usuario no esta registrado.',
            'user_id.exists'   => 'El usuario seleccionado no es válido.',
            'nombre.required' => 'El nombre es obligatorio.',
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
            ->whereMonth('created_at', $now->month)
            ->latest()
            ->first();

        if (!$checklist) {
            return response()->json([
                'message' => 'El usuario no tiene checklist este mes',
                'alreadyCheckedThisMonth' => false,
                'data' => null,
            ], 200);
        }

        return response()->json([
            'message' => 'Ya se hizo el checklist de este mes',
            'alreadyCheckedThisMonth' => true,
            'data' => $checklist,
        ]);
    }
    public function index(Request $request)
    {

        $query = ChecklistEquipoSeguridad::query();

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('nombre_empleado', 'like', "%{$search}%");
            });
        }

        $perPage = $request->get('per_page', 10);

        return response()->json(
            $query->orderBy('created_at', 'desc')
                ->paginate($perPage)
        );
    }
    public function update(Request $request, ChecklistEquipoSeguridad $ChecklistEquipoSeguridad)
    {
         DB::beginTransaction();

        try {
            $validated = $request->validate([
                'user_id' => 'required|exists:users,id',
                'nombre' => 'required|string',
                'checklist' => 'required|array',
            ]);

            $ChecklistEquipoSeguridad->update([
                'user_id' => $validated['user_id'],
                'nombre' => $validated['nombre'],
                'checklist' => $validated['checklist'] ?? null,
                'observaciones' => $request->observaciones,
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Checklist actualizado correctamente',
                'data' => $ChecklistEquipoSeguridad,
            ]);

        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Error al actualizar checklist',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
