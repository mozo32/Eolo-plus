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
            'nombre' => 'required|string',
        ],
        [
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
                'status' => 'A',
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
            'status' => 'A',
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

        $checklist = ChecklistEquipoSeguridad::where('id', (int)$userId)
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

        $query->where('status', 'A');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where('nombre', 'like', "%{$search}%");
        }

        if ($request->filled('date')) {
            $query->whereDate('created_at', $request->date);
        }
        elseif ($request->filled('start_date') && $request->filled('end_date')) {
            $startDate = Carbon::parse($request->start_date)->startOfDay();
            $endDate = Carbon::parse($request->end_date)->endOfDay();

            $query->whereBetween('created_at', [$startDate, $endDate]);
        }
        $perPage = $request->get('per_page', 20);

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
                'nombre' => 'required|string',
                'checklist' => 'required|array',
            ]);

            $ChecklistEquipoSeguridad->update([
                'user_id' => $validated['user_id']?? null,
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
    public function eliminar($id)
    {
        try {
            $registro = ChecklistEquipoSeguridad::find($id);

            if (!$registro) {
                return response()->json([
                    'message' => 'El registro no existe.'
                ], 404);
            }
            $registro->update([
                'status' => 'N'
            ]);
            return response()->json([
                'message' => 'Checklist eliminado correctamente (lógicamente)',
                'data' => $registro
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Error al intentar eliminar el registro',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function usuariosSinChecklist()
    {
        $now = Carbon::now();
        $usuariosPendientes = \App\Models\User::whereDoesntHave('checklists', function ($query) use ($now) {
            $query->where('status', 'A')
                ->whereYear('created_at', $now->year)
                ->whereMonth('created_at', $now->month);
        })
        ->whereHas('departamentos', function ($query) {
            $query->where('nombre', 'Rampa');
        })
        ->whereHas('roles', function ($query) {
            $query->whereIn('slug', ['empleado', 'jefe_area']);
        })
        ->select('id', 'name', 'email')
        ->orderBy('name', 'asc')
        ->get();

        return response()->json([
            'ok' => true,
            'count' => $usuariosPendientes->count(),
            'data' => $usuariosPendientes
        ]);
    }
}
