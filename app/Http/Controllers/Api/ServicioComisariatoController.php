<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\ServicioComisariato;
use App\Services\CatalogoAeronaves;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ServicioComisariatoController extends Controller
{
    public function __construct(private readonly CatalogoAeronaves $catalogo) {}

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
        // La matrícula es opcional. El resultado de la búsqueda nunca se usó:
        // solo importa que la aeronave quede dada de alta en el catálogo.
        if (filled($validated['matricula'] ?? null)) {
            $this->catalogo->buscarOCrear($validated['matricula']);
        }

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
        $query = ServicioComisariato::query()
            ->where('status', 'A');

        if ($request->filled('id')) {
            $query->where('id', $request->id);
        }

        if ($request->filled('search')) {
            $search = trim($request->search);

            $query->where(function ($q) use ($search) {
                $q->where('matricula', 'like', "%{$search}%")
                    ->orWhere('catering', 'like', "%{$search}%")
                    ->orWhere('forma_pago', 'like', "%{$search}%")
                    ->orWhere('detalle', 'like', "%{$search}%")
                    ->orWhere('solicitado_por', 'like', "%{$search}%")
                    ->orWhere('atendio', 'like', "%{$search}%");
            });
        }

        if ($request->filled('catering')) {
            $query->where('catering', 'like', '%' . trim($request->catering) . '%');
        }

        if ($request->filled('matricula')) {
            $query->where('matricula', 'like', '%' . trim($request->matricula) . '%');
        }

        if ($request->filled('forma_pago')) {
            $query->where('forma_pago', 'like', '%' . trim($request->forma_pago) . '%');
        }

        if ($request->filled('fechaInicio') && $request->filled('fechaFin')) {
            $query->whereBetween('fecha_entrega', [
                $request->fechaInicio,
                $request->fechaFin,
            ]);
        } elseif ($request->filled('fechaInicio')) {
            $query->whereDate('fecha_entrega', $request->fechaInicio);
        }

        $perPage = (int) $request->get('per_page', 10);

        return response()->json(
            $query->orderBy('created_at', 'desc')
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
    public function eliminar($id)
    {
        try {
            $comisariato = ServicioComisariato::find($id);

            if (!$comisariato) {
                return response()->json([
                    'message' => 'El registro no existe.'
                ], 404);
            }
            DB::transaction(function () use ($comisariato, $id) {
                $comisariato->update([
                    'status' => 'N'
                ]);
            });

            return response()->json([
                'message' => 'Registro cancelados correctamente',
                'data' => $comisariato
            ]);

        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Error al intentar eliminar el registro',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
