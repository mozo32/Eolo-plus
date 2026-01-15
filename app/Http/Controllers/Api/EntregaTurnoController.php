<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\EntregaTurno;
class EntregaTurnoController extends Controller
{
     public function store(Request $request)
    {
        $validated = $request->validate([
            'fecha' => ['required', 'date'],
            'nombre' => ['required', 'string', 'max:255'],
            'nombreQuienEntrega' => ['required', 'string', 'max:255'],
            'nombreJefeTurnoDespacho' => ['required', 'string', 'max:255'],

            'checklistComunicacion' => ['nullable', 'array'],
            'equipoOficina' => ['nullable', 'array'],
            'copiadoras' => ['nullable', 'array'],
            'fondoDocumentacion' => ['nullable', 'array'],
            'estadoCajaFuerte' => ['nullable', 'string'],
        ]);

        $entrega = EntregaTurno::create([
            'fecha' => $validated['fecha'],
            'nombre' => $validated['nombre'],
            'nombre_quien_entrega' => $validated['nombreQuienEntrega'],
            'nombre_jefe_turno_despacho' => $validated['nombreJefeTurnoDespacho'],
            'checklist_comunicacion' => $validated['checklistComunicacion'] ?? null,
            'equipo_oficina' => $validated['equipoOficina'] ?? null,
            'copiadoras' => $validated['copiadoras'] ?? null,
            'fondo_documentacion' => $validated['fondoDocumentacion'] ?? null,
            'estado_caja_fuerte' => $validated['estadoCajaFuerte'] ?? null,
        ]);

        return response()->json([
            'message' => 'Entrega de turno guardada correctamente',
            'data' => $entrega
        ], 201);
    }
    public function index(Request $request)
    {
        $q = trim((string) $request->get('q', ''));

        $query = EntregaTurno::query()
            ->select([
                'id',
                'fecha',
                'nombre',
                'nombre_quien_entrega',
                'nombre_jefe_turno_despacho',
            ])
            ->where('status', 'A')
            ->orderByDesc('id');

        if ($q !== '') {
            $query->where(function ($sub) use ($q) {
                $sub->where('nombre', 'like', "%{$q}%")
                    ->orWhere('nombre_quien_entrega', 'like', "%{$q}%")
                    ->orWhere('nombre_jefe_turno_despacho', 'like', "%{$q}%");
            });
        }

        if ($request->filled('fecha_inicio')) {
            $query->whereDate('fecha', '>=', $request->fecha_inicio);
        }

        if ($request->filled('fecha_fin')) {
            $query->whereDate('fecha', '<=', $request->fecha_fin);
        }

        return response()->json(
            $query->paginate(5)
        );
    }
    public function show(EntregaTurno $entregarTurno)
    {
        return response()->json($entregarTurno);
    }
    public function destroy(EntregaTurno $entregarTurno)
    {
        DB::beginTransaction();

        try {
            $entregarTurno->update(['status' => 'N']);

            DB::commit();

            return response()->json([
                'message' => 'Eliminado correctamente'
            ]);

        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Error al eliminar WalkAround',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
    public function update(Request $request, EntregaTurno $entregarTurno)
    {
        $validated = $request->validate([
            'fecha' => ['required', 'date'],
            'nombre' => ['required', 'string', 'max:255'],
            'nombreQuienEntrega' => ['required', 'string', 'max:255'],
            'nombreJefeTurnoDespacho' => ['required', 'string', 'max:255'],

            'checklistComunicacion' => ['nullable', 'array'],
            'equipoOficina' => ['nullable', 'array'],
            'copiadoras' => ['nullable', 'array'],
            'fondoDocumentacion' => ['nullable', 'array'],
            'estadoCajaFuerte' => ['nullable', 'string'],
        ]);

        DB::beginTransaction();

        try {
            $entregarTurno->update([
                'fecha' => $validated['fecha'],
                'nombre' => $validated['nombre'],
                'nombre_quien_entrega' => $validated['nombreQuienEntrega'],
                'nombre_jefe_turno_despacho' => $validated['nombreJefeTurnoDespacho'],
                'checklist_comunicacion' => $validated['checklistComunicacion'] ?? null,
                'equipo_oficina' => $validated['equipoOficina'] ?? null,
                'copiadoras' => $validated['copiadoras'] ?? null,
                'fondo_documentacion' => $validated['fondoDocumentacion'] ?? null,
                'estado_caja_fuerte' => $validated['estadoCajaFuerte'] ?? null,
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Entrega de turno actualizada correctamente',
                'data' => $entregarTurno
            ]);

        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Error al actualizar la entrega de turno',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

}
