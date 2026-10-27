<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Trafico\StoreServicioComisariatoRequest;
use App\Http\Requests\Trafico\UpdateServicioComisariatoRequest;
use Illuminate\Http\Request;
use App\Models\FactServicio;
use App\Models\ServicioComisariato;
use App\Services\CatalogoAeronaves;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ServicioComisariatoController extends Controller
{
    public function __construct(private readonly CatalogoAeronaves $catalogo) {}

    public function store(StoreServicioComisariatoRequest $request)
    {
        $validated = $request->validated();

        // La matrícula es opcional. El resultado de la búsqueda nunca se usó:
        // solo importa que la aeronave quede dada de alta en el catálogo.
        if (filled($validated['matricula'] ?? null)) {
            $this->catalogo->buscarOCrear($validated['matricula']);
        }

        $servicio = ServicioComisariato::create([
            'user_id'        => Auth::id(),
            'fact_servicio_id' => $validated['proveedorId'],
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
            ->with('factServicio:id,nombre')
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

        // `sin` son las filas anteriores a la lista de proveedores, que quedaron sin elegir.
        if ($request->filled('proveedorId')) {
            $proveedorId = is_string($request->proveedorId) ? strtolower(trim($request->proveedorId)) : '';

            if ($proveedorId === 'sin') {
                $query->whereNull('fact_servicio_id');
            } elseif (ctype_digit($proveedorId)) {
                $query->where('fact_servicio_id', $proveedorId);
            } else {
                $query->whereRaw('1 = 0');
            }
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
    /**
     * Los proveedores entre los que elige Tráfico al capturar.
     *
     * Del otro lado son servicios del catálogo de facturación, y lo que llevan dentro —precio,
     * margen, ajuste— es asunto de facturación: este endpoint devuelve SOLO id y nombre. Eso es una
     * propiedad de este endpoint, no del sistema: `GET /api/facturacion/servicios` está abierta a
     * cualquier usuario con sesión y sí devuelve precio, margen y ajuste (ver la spec, "La lista").
     *
     * Responde `{ proveedores: [{id, nombre}], estado }`, con estado `disponibles`, `todos-de-baja`
     * o `sin-configurar`, para que la pantalla diga por qué la lista viene vacía.
     */
    public function proveedores()
    {
        $delCatalogo = fn () => FactServicio::query()
            ->whereHas('categoria', fn ($q) => $q->where('nombre', 'Comisariatos'));

        $activos = $delCatalogo()
            ->where('status', 'A')
            ->orderBy('nombre')
            ->get(['id', 'nombre']);

        // Cuando la lista viene vacía, la pantalla necesita saber por qué: "no hay ninguno" (hay que
        // crearlos) no es "están todos de baja" (hay que reactivar uno), y mandar a reactivar lo que
        // nunca existió es un diagnóstico falso.
        $estado = match (true) {
            $activos->isNotEmpty() => 'disponibles',
            $delCatalogo()->exists() => 'todos-de-baja',
            default => 'sin-configurar',
        };

        return response()->json(['proveedores' => $activos, 'estado' => $estado]);
    }

    public function show(ServicioComisariato $servicioComisariato)
    {

        return response()->json($servicioComisariato->load('factServicio:id,nombre'));
    }
    public function update(UpdateServicioComisariatoRequest $request, ServicioComisariato $servicioComisariato)
    {
        DB::beginTransaction();

        try {
            $validated = $request->validated();

            $servicioComisariato->update([
                'user_id'        => Auth::id(),
                'fact_servicio_id' => $validated['proveedorId'],
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
