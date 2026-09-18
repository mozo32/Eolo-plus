<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ControlMedicamento;
use App\Models\Medicamento;
use App\Models\EntregaMedicamento;
use App\Models\MovimientoMedicamento;
use App\Models\User;
use App\Models\Firma;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Barryvdh\DomPDF\Facade\Pdf;
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

            // Las entregas abiertas quedan cerradas y ligadas a este cierre:
            // así el PDF sabe qué se entregó durante el turno.
            EntregaMedicamento::where('status', 'A')
                ->update([
                    'status' => 'N',
                    'control_medicamento_id' => $control->id,
                ]);

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
        $query = ControlMedicamento::with([
            'firmas',
            'entregas' => fn ($q) => $q->orderBy('created_at'),
            'entregas.medicamento:id,nombre',
            'entregas.entregadoPor:id,name',
            'entregas.capturadoPor:id,name',
        ])
            ->orderBy('fecha', 'desc')
            ->orderBy('created_at', 'desc');
        if ($request->filled('fecha_inicio') && $request->filled('fecha_fin')) {
            // Comparación por fecha (no por texto) para que funcione igual en MySQL y sqlite.
            $query->whereDate('fecha', '>=', Carbon::parse($request->fecha_inicio)->toDateString())
                ->whereDate('fecha', '<=', Carbon::parse($request->fecha_fin)->toDateString());
        }

        if ($request->filled('fecha') && !$request->filled('fecha_inicio') && !$request->filled('fecha_fin')) {
            $query->whereDate('fecha', $request->fecha);
        }
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
        $data = Medicamento::withSum(['entregas as total_entregado' => function ($query) {
                $query->where('status', 'A');
            }], 'cantidad')
            ->where('status', 'A')
            ->orderBy('nombre', 'asc')
            ->get();

        return response()->json($data);
    }

    public function ultimosMovimientos(Request $request)
    {
        $validated = $request->validate([
            'periodo' => [
                'nullable',
                'in:todos,dia,rango,mes,anio',
            ],
            'tipo' => [
                'nullable',
                'in:todos,ENTREGA,CIERRE,NUEVO,REABASTECIMIENTO',
            ],
            'fecha' => [
                'nullable',
                'required_if:periodo,dia',
                'date_format:Y-m-d',
            ],
            'fecha_inicio' => [
                'nullable',
                'required_if:periodo,rango',
                'date_format:Y-m-d',
            ],
            'fecha_fin' => [
                'nullable',
                'required_if:periodo,rango',
                'date_format:Y-m-d',
                'after_or_equal:fecha_inicio',
            ],
            'mes' => [
                'nullable',
                'required_if:periodo,mes',
                'date_format:Y-m',
            ],
            'anio' => [
                'nullable',
                'required_if:periodo,anio',
                'integer',
                'min:2000',
                'max:2100',
            ],
            'page' => [
                'nullable',
                'integer',
                'min:1',
            ],
            'per_page' => [
                'nullable',
                'integer',
                'min:1',
                'max:50',
            ],
        ]);

        try {
            $periodo = $validated['periodo'] ?? 'todos';
            $tipo = $validated['tipo'] ?? 'todos';
            $pagina = (int) ($validated['page'] ?? 1);
            $porPagina = (int) ($validated['per_page'] ?? 5);

            $tablaEntregas = (new EntregaMedicamento())->getTable();
            $tablaMedicamentos = (new Medicamento())->getTable();
            $tablaControles = (new ControlMedicamento())->getTable();
            $tablaMovimientos = (new MovimientoMedicamento())->getTable();
            $tablaUsuarios = (new User())->getTable();

            $aplicarPeriodo = function (
                $query,
                string $columnaFecha
            ) use ($periodo, $validated) {
                if ($periodo === 'dia') {
                    $query->whereDate(
                        $columnaFecha,
                        $validated['fecha']
                    );
                }

                if ($periodo === 'rango') {
                    $fechaInicio = Carbon::createFromFormat(
                        'Y-m-d',
                        $validated['fecha_inicio']
                    )->startOfDay();

                    $fechaFin = Carbon::createFromFormat(
                        'Y-m-d',
                        $validated['fecha_fin']
                    )->endOfDay();

                    $query->whereBetween($columnaFecha, [
                        $fechaInicio,
                        $fechaFin,
                    ]);
                }

                if ($periodo === 'mes') {
                    [$anio, $mes] = explode(
                        '-',
                        $validated['mes']
                    );

                    $query
                        ->whereYear($columnaFecha, (int) $anio)
                        ->whereMonth($columnaFecha, (int) $mes);
                }

                if ($periodo === 'anio') {
                    $query->whereYear(
                        $columnaFecha,
                        (int) $validated['anio']
                    );
                }

                return $query;
            };

            $consultas = [];

            if ($tipo === 'todos' || $tipo === 'ENTREGA') {
                // Quien entregó: la persona elegida o, en registros viejos, quien capturó.
                $consultaEntregas = DB::table(
                    "{$tablaEntregas} as entregas"
                )
                    ->join(
                        "{$tablaMedicamentos} as medicamentos",
                        'medicamentos.id',
                        '=',
                        'entregas.medicamento_id'
                    )
                    ->leftJoin("{$tablaUsuarios} as entregadores", 'entregadores.id', '=', 'entregas.entregado_por_user_id')
                    ->leftJoin("{$tablaUsuarios} as capturistas", 'capturistas.id', '=', 'entregas.user_id')
                    ->where('medicamentos.status', 'A')
                    ->select([
                        DB::raw("'ENTREGA' as tipo"),
                        'entregas.id as registro_id',
                        'medicamentos.nombre as titulo',
                        'entregas.receptor as responsable',
                        'entregas.cantidad as cantidad',
                        'entregas.created_at as fecha_raw',
                        'entregas.status as estado_raw',
                        DB::raw('COALESCE(entregadores.name, capturistas.name) as usuario'),
                    ]);

                $aplicarPeriodo(
                    $consultaEntregas,
                    'entregas.created_at'
                );

                $consultas[] = $consultaEntregas;
            }

            if ($tipo === 'todos' || $tipo === 'CIERRE') {
                $consultaCierres = DB::table(
                    "{$tablaControles} as controles"
                )
                    ->leftJoin("{$tablaUsuarios} as usuarios", 'usuarios.id', '=', 'controles.user_id')
                    ->select([
                        DB::raw("'CIERRE' as tipo"),
                        'controles.id as registro_id',
                        DB::raw("'Corte de Turno' as titulo"),
                        'controles.responsable as responsable',
                        DB::raw('NULL as cantidad'),
                        'controles.created_at as fecha_raw',
                        DB::raw("'Finalizado' as estado_raw"),
                        'usuarios.name as usuario',
                    ]);

                $aplicarPeriodo(
                    $consultaCierres,
                    'controles.created_at'
                );

                $consultas[] = $consultaCierres;
            }

            if (in_array($tipo, ['todos', 'NUEVO', 'REABASTECIMIENTO'], true)) {
                // Altas y reabastecimientos: se persisten en movimientos_medicamentos.
                $consultaMovimientos = DB::table(
                    "{$tablaMovimientos} as movimientos"
                )
                    ->join(
                        "{$tablaMedicamentos} as medicamentos",
                        'medicamentos.id',
                        '=',
                        'movimientos.medicamento_id'
                    )
                    ->leftJoin("{$tablaUsuarios} as usuarios", 'usuarios.id', '=', 'movimientos.user_id')
                    ->select([
                        'movimientos.tipo as tipo',
                        'movimientos.id as registro_id',
                        'medicamentos.nombre as titulo',
                        DB::raw('NULL as responsable'),
                        'movimientos.cantidad as cantidad',
                        'movimientos.created_at as fecha_raw',
                        DB::raw("'Registrado' as estado_raw"),
                        'usuarios.name as usuario',
                    ]);

                if ($tipo !== 'todos') {
                    $consultaMovimientos->where('movimientos.tipo', $tipo);
                }

                $aplicarPeriodo(
                    $consultaMovimientos,
                    'movimientos.created_at'
                );

                $consultas[] = $consultaMovimientos;
            }

            $consultaUnificada = array_shift($consultas);

            foreach ($consultas as $consulta) {
                $consultaUnificada->unionAll($consulta);
            }

            $movimientos = DB::query()
                ->fromSub(
                    $consultaUnificada,
                    'movimientos_unificados'
                )
                ->orderByDesc('fecha_raw')
                ->paginate(
                    $porPagina,
                    ['*'],
                    'page',
                    $pagina
                );

            $movimientos->setCollection(
                $movimientos
                    ->getCollection()
                    ->map(function ($movimiento) {
                        $tipo = $movimiento->tipo;
                        $fecha = Carbon::parse($movimiento->fecha_raw)->format('d/m/Y H:i');
                        $usuario = $movimiento->usuario ?? null;

                        if ($tipo === 'ENTREGA') {
                            return [
                                'id' => 'ent-'.$movimiento->registro_id,
                                'tipo' => 'ENTREGA',
                                'titulo' => $movimiento->titulo,
                                'detalle' => "Recibe: {$movimiento->responsable}",
                                'cantidad' => '-'.$movimiento->cantidad,
                                'fecha' => $fecha,
                                'estado' => $movimiento->estado_raw === 'A' ? 'Activo' : 'Cerrado',
                                'usuario' => $usuario,
                            ];
                        }

                        if ($tipo === 'CIERRE') {
                            return [
                                'id' => 'cie-'.$movimiento->registro_id,
                                'tipo' => 'CIERRE',
                                'titulo' => $movimiento->titulo,
                                'detalle' => "Resp: {$movimiento->responsable}",
                                'cantidad' => 'OK',
                                'fecha' => $fecha,
                                'estado' => 'Finalizado',
                                'usuario' => $usuario,
                            ];
                        }

                        // NUEVO o REABASTECIMIENTO
                        return [
                            'id' => 'mov-'.$movimiento->registro_id,
                            'tipo' => $tipo,
                            'titulo' => $movimiento->titulo,
                            'detalle' => $tipo === MovimientoMedicamento::TIPO_NUEVO
                                ? 'Nuevo medicamento'
                                : 'Reabastecimiento',
                            'cantidad' => '+'.$movimiento->cantidad,
                            'fecha' => $fecha,
                            'estado' => 'Registrado',
                            'usuario' => $usuario,
                        ];
                    })
            );

            return response()->json($movimientos);
        } catch (\Throwable $e) {
            return response()->json([
                'message' =>
                    'No se pudieron obtener los movimientos.',
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
            // Quien entrega se elige (solo personal de Tráfico); quien captura
            // sigue siendo el autenticado.
            'entregaUserId' => [
                'required',
                'integer',
                Rule::exists('users', 'id'),
                function (string $attribute, mixed $value, \Closure $fail) {
                    if (! $this->usuariosDeTrafico()->whereKey($value)->exists()) {
                        $fail('La persona seleccionada no pertenece al área de Tráfico.');
                    }
                },
            ],
        ]);

        try {
            return DB::transaction(function () use ($validated) {
                $medicamento = Medicamento::where('status', 'A')
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
                    'entregado_por_user_id' => $validated['entregaUserId'],
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
        // Solo jefe de área, FBO y administrador; ocultar el botón no basta.
        if (! $request->user()?->hasAnyRole(['admin', 'jefe_area', 'fbo'])) {
            return response()->json([
                'status' => 'error',
                'message' => 'No tienes permiso para reabastecer stock.',
            ], 403);
        }

        $validated = $request->validate([
            'cantidad' => 'required|integer|min:1',
        ]);

        try {
            return DB::transaction(function () use ($validated, $id) {
                $medicamento = Medicamento::where('status', 'A')
                    ->findOrFail($id);

                $medicamento->increment('cantidad', $validated['cantidad']);

                MovimientoMedicamento::create([
                    'medicamento_id' => $medicamento->id,
                    'tipo' => MovimientoMedicamento::TIPO_REABASTECIMIENTO,
                    'cantidad' => $validated['cantidad'],
                    'user_id' => Auth::id(),
                ]);

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
    public function medicamentosDeshabilitados()
    {
        try {
            $medicamentos = Medicamento::query()
                ->where('status', 'N')
                ->orderBy('nombre')
                ->get([
                    'id',
                    'nombre',
                    'cantidad',
                    'status',
                ]);

            return response()->json($medicamentos);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'No se pudieron obtener los medicamentos deshabilitados.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
    public function deshabilitar($id)
    {
        try {
            return DB::transaction(function () use ($id) {
                $medicamento = Medicamento::where('status', 'A')
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
    public function habilitar($id)
    {
        try {
            return DB::transaction(function () use ($id) {
                $medicamento = Medicamento::findOrFail($id);

                if ($medicamento->status === 'A') {
                    return response()->json([
                        'status' => 'error',
                        'message' => 'El medicamento ya se encuentra habilitado.',
                    ], 422);
                }

                $medicamento->status = 'A';
                $medicamento->save();

                return response()->json([
                    'status' => 'success',
                    'message' => 'Medicamento habilitado correctamente',
                    'nuevo_stock' => $medicamento->cantidad,
                    'medicamento' => $medicamento->nombre,
                ]);
            });
        } catch (\Throwable $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'No se pudo habilitar el medicamento: ' . $e->getMessage(),
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
                $medicamento = Medicamento::create([
                    'nombre' => trim($validated['nombre']),
                    'cantidad' => $validated['stockInicial'],
                    'status' => 'A',
                ]);

                MovimientoMedicamento::create([
                    'medicamento_id' => $medicamento->id,
                    'tipo' => MovimientoMedicamento::TIPO_NUEVO,
                    'cantidad' => $validated['stockInicial'],
                    'user_id' => Auth::id(),
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
    /**
     * Usuarios que pueden figurar como "Quién entrega": los del área de
     * Tráfico con vínculo activo. El filtro se hace en la consulta; el
     * historial no pasa por aquí, así que quien salió del área conserva
     * su nombre en las entregas anteriores.
     */
    private function usuariosDeTrafico()
    {
        return User::query()->whereHas('departamentos', function ($q) {
            // Con y sin acento, por si el nombre se corrige en el catálogo.
            $q->whereIn('departamentos.nombre', ['Trafico', 'Tráfico'])
                ->where('departamentos.status', 'A')
                ->where('user_departamentos.status', 'A');
        });
    }

    /** Usuarios para el selector "Quién entrega": solo personal de Tráfico, id y nombre. */
    public function personal()
    {
        return response()->json(
            $this->usuariosDeTrafico()->orderBy('name')->get(['id', 'name'])
        );
    }

    public function exportarPdf(Request $request)
    {
        $validated = $request->validate([
            'fecha_inicio' => 'required|date',
            'fecha_fin' => 'required|date|after_or_equal:fecha_inicio',
        ]);

        $fechaInicio = Carbon::parse($validated['fecha_inicio'])->toDateString();
        $fechaFin = Carbon::parse($validated['fecha_fin'])->toDateString();

        $cierres = ControlMedicamento::query()
            ->whereBetween('fecha', [$fechaInicio, $fechaFin])
            ->orderBy('fecha', 'asc')
            ->orderBy('created_at', 'asc')
            ->get();

        $pdf = Pdf::loadView('pdf.control-medicamento-cierres', [
            'cierres' => $cierres,
            'fechaInicio' => $fechaInicio,
            'fechaFin' => $fechaFin,
        ])->setPaper('letter', 'portrait');

        return $pdf->download("cierres_medicamento_{$fechaInicio}_{$fechaFin}.pdf");
    }
}
