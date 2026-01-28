<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\ServicioComisariato;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ServicioComisariatoController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'catering'       => ['nullable', 'string', 'max:150'],
            'formaPago'      => ['nullable', 'string', 'max:100'],
            'fechaEntrega'   => ['required', 'date'],
            'horaEntrega'    => ['required', 'date_format:H:i'],
            'matricula'      => ['nullable', 'string', 'max:50'],
            'detalle'        => ['nullable', 'string'],
            'solicitadoPor'  => ['nullable', 'string', 'max:150'],
            'atendio'        => ['nullable', 'string', 'max:150'],
            'subtotal'       => ['required', 'numeric', 'min:0'],
            'total'          => ['required', 'numeric', 'min:0'],
        ]);

        $servicio = ServicioComisariato::create([
            'user_id'        => Auth::id(),
            'catering'       => $validated['catering'] ?? null,
            'forma_pago'     => $validated['formaPago'] ?? null,
            'fecha_entrega'  => $validated['fechaEntrega'],
            'hora_entrega'   => $validated['horaEntrega'],
            'matricula'      => $validated['matricula'] ?? null,
            'detalle'        => $validated['detalle'] ?? null,
            'solicitado_por' => $validated['solicitadoPor'] ?? null,
            'atendio'        => $validated['atendio'] ?? null,
            'subtotal'       => $validated['subtotal'],
            'total'          => $validated['total'],
        ]);
        return response()->json([
            'message' => 'Servicio de comisariato guardado correctamente',
            'data' => $servicio,
        ], 201);
    }
    public function index(Request $request)
    {

        $query = ServicioComisariato::query();

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('matricula', 'like', "%{$search}%");
                $q->where('catering', 'like', "%{$search}%");
            });
        }

        $perPage = $request->get('per_page', 10);

        return response()->json(
            $query->orderBy('created_at', 'asc')
                ->paginate($perPage)
        );
    }
    public function show(ServicioComisariato $servicioComisariato)
    {

        return response()->json($servicioComisariato);
    }
    public function update(Request $request, ServicioComisariato $servicioComisariato)
    {
        DB::beginTransaction();

        try {
            $validated = $request->validate([
                'catering'       => ['nullable', 'string', 'max:150'],
                'formaPago'      => ['nullable', 'string', 'max:100'],
                'fechaEntrega'   => ['required', 'date'],
                'horaEntrega'    => ['required', 'date_format:H:i'],
                'matricula'      => ['nullable', 'string', 'max:50'],
                'detalle'        => ['nullable', 'string'],
                'solicitadoPor'  => ['nullable', 'string', 'max:150'],
                'atendio'        => ['nullable', 'string', 'max:150'],
                'subtotal'       => ['required', 'numeric', 'min:0'],
                'total'          => ['required', 'numeric', 'min:0'],
            ]);

            $servicioComisariato->update([
                'user_id'        => Auth::id(),
                'catering'       => $validated['catering'] ?? null,
                'forma_pago'     => $validated['formaPago'] ?? null,
                'fecha_entrega'  => $validated['fechaEntrega'],
                'hora_entrega'   => $validated['horaEntrega'],
                'matricula'      => $validated['matricula'] ?? null,
                'detalle'        => $validated['detalle'] ?? null,
                'solicitado_por' => $validated['solicitadoPor'] ?? null,
                'atendio'        => $validated['atendio'] ?? null,
                'subtotal'       => $validated['subtotal'],
                'total'          => $validated['total'],
                ]);


            DB::commit();


            return response()->json([
                'message' => 'Actualizado correctamente',
                'data' => $servicioComisariato,
            ]);

        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Error al actualizar',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
