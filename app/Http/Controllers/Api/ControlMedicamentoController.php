<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ControlMedicamento;
use App\Models\medicamento;
use App\Models\EntregaMedicamento;
use App\Models\Firma;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Carbon\Carbon;

class ControlMedicamentoController extends Controller
{
    public function store(Request $request)
    {
        DB::beginTransaction();

        try {
            $validated = $request->validate([
                'responsable'   => 'required|string|max:255',
                'fecha'         => 'required|date',
                'dia'           => 'required|string|max:15',
                'aparatos'      => 'required|array|min:1',
                'firma'         => 'required|string',
                'medicamentos'  => 'required|array|min:1',
            ]);

            foreach ($validated['medicamentos'] as $nombre => $data) {
                if (!isset($data['inicio'], $data['final'])) {
                    return response()->json([
                        'message' => "El medicamento {$nombre} está incompleto",
                    ], 422);
                }

                if ($data['final'] > $data['inicio']) {
                    return response()->json([
                        'message' => "En {$nombre}, el FINAL no puede ser mayor al INICIO",
                    ], 422);
                }
            }

            $control = ControlMedicamento::create([
                'responsable'  => $validated['responsable'],
                'fecha'        => $validated['fecha'],
                'dia'          => $validated['dia'],
                'aparatos'     => $validated['aparatos'],
                'medicamentos' => $validated['medicamentos'],
                'user_id'      => auth()->id(),
            ]);

            $this->guardarFirmaBase64($validated['firma'], 'firma_responsable', $control);

            EntregaMedicamento::where('status', 'A')
                ->update(['status' => 'N']);

            DB::commit();

            return response()->json([
                'message' => 'Control guardado y entregas finalizadas correctamente',
                'data'    => $control->load('firmas'),
            ], 201);

        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Error al guardar el control de medicamentos',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    private function guardarFirmaBase64(
        string $value,
        string $rol,
        ControlMedicamento $control
    ): void {
        if (trim($value) === '') return;
        if (!str_contains($value, 'base64,')) return;

        $control->firmas()
            ->newPivotStatement()
            ->where('firmable_type', ControlMedicamento::class)
            ->where('firmable_id', $control->id)
            ->where('rol', $rol)
            ->where('status', 'A')
            ->update(['status' => 'N']);

        $firma = $this->guardarFirmaArchivoBase64(
            $value,
            'firmas/ControlMedicamento/' . now()->format('Y/m')
        );

        $control->firmas()->attach($firma->id, [
            'rol'    => $rol,
            'tag'    => $this->humanizeRol($rol),
            'orden'  => 0,
            'status' => 'A',
        ]);
    }

    private function guardarFirmaArchivoBase64(string $base64, string $folder): Firma
    {
        [$meta, $content] = explode(',', $base64);
        preg_match('/data:(.*?);base64/', $meta, $matches);

        $mime = $matches[1] ?? 'image/png';
        $extension = explode('/', $mime)[1] ?? 'png';

        $fileName = Str::uuid() . '.' . $extension;
        $path = $folder . '/' . $fileName;

        Storage::disk('public')->put($path, base64_decode($content));

        return Firma::create([
            'disk'          => 'public',
            'path'          => $path,
            'original_name' => $fileName,
            'mime'          => $mime,
            'size'          => Storage::disk('public')->size($path),
            'sha1'          => sha1_file(Storage::disk('public')->path($path)),
        ]);
    }

    private function humanizeRol(string $rol): string
    {
        return match ($rol) {
            'firma_responsable' => 'Firma Responsable',
            default => ucfirst(str_replace('_', ' ', $rol)),
        };
    }

    public function index(Request $request)
    {
        $query = ControlMedicamento::with('firmas')
            ->orderBy('fecha', 'desc')
            ->orderBy('created_at', 'desc');

        if ($request->filled('fecha')) {
            $query->whereDate('fecha', $request->fecha);
        }

        if ($request->filled('week')) {
            [$year, $week] = explode('-W', $request->week);

            $startOfWeek = Carbon::now()
                ->setISODate($year, $week)
                ->startOfWeek(Carbon::MONDAY)
                ->toDateString();

            $endOfWeek = Carbon::now()
                ->setISODate($year, $week)
                ->endOfWeek(Carbon::SUNDAY)
                ->toDateString();

            $query->whereBetween('fecha', [$startOfWeek, $endOfWeek]);
        }

        if ($request->filled('search')) {
            $query->where('responsable', 'like', '%' . $request->search . '%');
        }

        $controles = $query->get()->map(function ($control) {
            $control->setRelation(
                'firmas',
                $control->firmas->map(function (Firma $firma) {
                    $disk = $firma->disk ?? 'public';
                    $path = $firma->path;

                    $base = [
                        'id'     => $firma->id,
                        'rol'    => $firma->pivot->rol ?? null,
                        'tag'    => $firma->pivot->tag ?? null,
                        'orden'  => $firma->pivot->orden ?? 0,
                        'status' => $firma->pivot->status ?? 'A',
                    ];

                    if (!$path || !Storage::disk($disk)->exists($path)) {
                        return array_merge($base, [
                            'url'   => null,
                            'error' => 'firma_no_encontrada',
                        ]);
                    }

                    return array_merge($base, [
                        'url' => Storage::disk($disk)->url($path),
                    ]);
                })->values()
            );

            return $control;
        });

        return response()->json($controles);
    }

    public function current(Request $request)
    {
        $today = Carbon::today()->toDateString();
        $yesterday = Carbon::yesterday()->toDateString();

        $control = ControlMedicamento::with('firmas')
            ->whereDate('fecha', $today)
            ->orderBy('created_at', 'desc')
            ->first();

        $dataYesterday = ControlMedicamento::with('firmas')
            ->whereDate('fecha', $yesterday)
            ->orderBy('created_at', 'desc')
            ->first();

        if (!$control) {
            return response()->json(null);
        }

        $control->setRelation(
            'firmas',
            $control->firmas->map(function ($firma) {
                $disk = $firma->disk ?? 'public';
                $path = $firma->path;

                return [
                    'id'     => $firma->id,
                    'rol'    => $firma->pivot->rol ?? null,
                    'tag'    => $firma->pivot->tag ?? null,
                    'orden'  => $firma->pivot->orden ?? 0,
                    'status' => $firma->pivot->status ?? 'A',
                    'url'    => $path ? Storage::disk($disk)->url($path) : null,
                ];
            })->values()
        );

        return response()->json($control);
    }

    public function update(Request $request, ControlMedicamento $controlMedicamento)
    {
        DB::beginTransaction();

        try {
            $validated = $request->validate([
                'responsable'   => 'required|string|max:255',
                'fecha'         => 'required|date',
                'dia'           => 'required|string|max:15',
                'firma'         => 'nullable|string',
                'medicamentos'  => 'required|array|min:1',
            ]);

            foreach ($validated['medicamentos'] as $nombre => $data) {
                if (!isset($data['inicio'], $data['final'])) {
                    return response()->json([
                        'message' => "El medicamento {$nombre} está incompleto",
                    ], 422);
                }

                if (!is_numeric($data['inicio']) || !is_numeric($data['final'])) {
                    return response()->json([
                        'message' => "Inicio y Final deben ser numéricos en {$nombre}",
                    ], 422);
                }

                if ($data['final'] > $data['inicio']) {
                    return response()->json([
                        'message' => "En {$nombre}, el FINAL no puede ser mayor al INICIO",
                    ], 422);
                }
            }

            $controlMedicamento->update([
                'responsable'  => $validated['responsable'],
                'fecha'        => $validated['fecha'],
                'dia'          => $validated['dia'],
                'medicamentos' => $validated['medicamentos'],
            ]);

            if (!empty($validated['firma'])) {
                $this->guardarFirmaBase64(
                    $validated['firma'],
                    'firma_responsable',
                    $controlMedicamento
                );
            }

            DB::commit();

            return response()->json([
                'message' => 'Control de medicamentos actualizado correctamente',
                'data'    => $controlMedicamento->load('firmas'),
            ], 200);

        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Error al actualizar el control de medicamentos',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    public function medicamentos()
    {
        $data = medicamento::withSum(['entregas as total_entregado' => function ($query) {
                $query->where('status', 'A');
            }], 'cantidad')
            ->where('status', 'A')
            ->orderBy('nombre', 'asc')
            ->get();

        return response()->json($data);
    }

    public function ultimosMovimientos()
    {
        try {
            $entregas = EntregaMedicamento::with(['medicamento' => function ($query) {
                    $query->select('id', 'nombre', 'status')
                        ->where('status', 'A');
                }])
                ->whereHas('medicamento', function ($query) {
                    $query->where('status', 'A');
                })
                ->orderBy('created_at', 'desc')
                ->limit(5)
                ->get()
                ->map(function ($e) {
                    return [
                        'id' => 'ent-' . $e->id,
                        'tipo' => 'ENTREGA',
                        'titulo' => $e->medicamento->nombre,
                        'detalle' => "Recibe: {$e->receptor}",
                        'cantidad' => "-" . $e->cantidad,
                        'fecha' => $e->created_at->format('d/m/Y H:i'),
                        'fecha_raw' => $e->created_at,
                        'estado' => $e->status == 'A' ? 'Activo' : 'Cerrado',
                    ];
                });

            $cierres = ControlMedicamento::orderBy('created_at', 'desc')
                ->limit(5)
                ->get()
                ->map(function ($c) {
                    return [
                        'id' => 'cie-' . $c->id,
                        'tipo' => 'CIERRE',
                        'titulo' => 'Corte de Turno',
                        'detalle' => "Resp: {$c->responsable}",
                        'cantidad' => 'OK',
                        'fecha' => $c->created_at->format('d/m/Y H:i'),
                        'fecha_raw' => $c->created_at,
                        'estado' => 'Finalizado',
                    ];
                });

            $movimientos = $entregas->concat($cierres)
                ->sortByDesc('fecha_raw')
                ->take(10)
                ->values();

            return response()->json($movimientos);

        } catch (\Throwable $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function storeEntrega(Request $request)
    {
        $validated = $request->validate([
            'medicamentoId' => [
                'required',
                Rule::exists('medicamentos', 'id')->where(function ($query) {
                    $query->where('status', 'A');
                }),
            ],
            'recibe' => 'required|string|max:255',
            'cantidad' => 'required|integer|min:1',
        ]);

        try {
            return DB::transaction(function () use ($validated) {
                $medicamento = medicamento::where('status', 'A')
                    ->findOrFail($validated['medicamentoId']);

                if ($medicamento->cantidad < $validated['cantidad']) {
                    return response()->json([
                        'status' => 'error',
                        'message' => "Stock insuficiente. Solo quedan {$medicamento->cantidad} unidades.",
                    ], 422);
                }

                EntregaMedicamento::create([
                    'medicamento_id' => $validated['medicamentoId'],
                    'receptor' => $validated['recibe'],
                    'cantidad' => $validated['cantidad'],
                    'user_id' => Auth::id(),
                    'status' => 'A',
                ]);

                $medicamento->decrement('cantidad', $validated['cantidad']);

                return response()->json([
                    'status' => 'success',
                    'message' => 'Entrega registrada exitosamente',
                    'nuevo_stock' => $medicamento->cantidad,
                    'medicamento' => $medicamento->nombre,
                ], 201);
            });

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'No se pudo registrar la entrega: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function reabastecer(Request $request, $id)
    {
        $validated = $request->validate([
            'cantidad' => 'required|integer|min:1',
        ]);

        try {
            return DB::transaction(function () use ($validated, $id) {
                $medicamento = medicamento::where('status', 'A')
                    ->findOrFail($id);

                $medicamento->increment('cantidad', $validated['cantidad']);

                return response()->json([
                    'status' => 'success',
                    'message' => 'Stock actualizado correctamente',
                    'nuevo_stock' => $medicamento->cantidad,
                    'medicamento' => $medicamento->nombre,
                ], 200);
            });

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'No se pudo actualizar el inventario: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function deshabilitar($id)
    {
        try {
            return DB::transaction(function () use ($id) {
                $medicamento = medicamento::where('status', 'A')
                    ->findOrFail($id);

                $medicamento->status = 'N';
                $medicamento->save();

                return response()->json([
                    'status' => 'success',
                    'message' => 'Medicamento deshabilitado correctamente',
                    'nuevo_stock' => $medicamento->cantidad,
                    'medicamento' => $medicamento->nombre,
                ], 200);
            });

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'No se pudo deshabilitar el medicamento: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function agregarMedicamento(Request $request)
    {
        try {
            $validated = $request->validate([
                'nombre' => ['required', 'string', 'max:255'],
                'stockInicial' => ['required', 'integer', 'min:0'],
            ]);

            return DB::transaction(function () use ($validated) {
                $medicamento = medicamento::create([
                    'nombre' => trim($validated['nombre']),
                    'cantidad' => $validated['stockInicial'],
                    'status' => 'A',
                ]);

                return response()->json([
                    'status' => 'success',
                    'message' => 'Medicamento agregado correctamente',
                    'medicamento' => $medicamento,
                ], 201);
            });

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'No se pudo agregar el medicamento: ' . $e->getMessage(),
            ], 500);
        }
    }
}
