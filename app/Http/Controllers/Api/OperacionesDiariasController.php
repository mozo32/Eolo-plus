<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\OperacionDiaria;
use App\Models\MovimientoCSAE;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Carbon\Carbon;
use App\Models\Bitacora;

class OperacionesDiariasController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'fecha' => ['required', 'date'],
            'movimiento' => ['required', 'in:Llegada,Salida'],
            'matricula' => ['required', 'string', 'max:20'],
            'equipo' => ['required', 'string', 'max:50'],
            'hora' => ['required', 'date_format:H:i'],
            'pax' => ['required', 'integer', 'min:0'],
            'departamento' => ['required', 'string'],
            'procedencia' => ['nullable', 'string', 'max:100'],
            'equipaje' => ['nullable', 'integer'],
            'observaciones' => ['nullable', 'string'],
            'destino' => ['nullable', 'string', 'max:100'],
            'tipo_cliente' => ['nullable', 'string', 'max:100'],
            'tipo_operacion' => ['nullable', 'string', 'max:100'],
            'nombre' => ['nullable', 'string', 'max:100'],
            'impulso' => ['nullable', 'string', 'max:100'],
        ]);

        return DB::transaction(function () use ($validated) {
            $matricula = strtoupper(trim($validated['matricula']));
            $movimiento = strtolower(trim($validated['movimiento']));

            $ultimoRegistro = OperacionDiaria::query()
                ->where('matricula', $matricula)
                ->orderByDesc('fecha')
                ->orderByDesc('hora')
                ->orderByDesc('id')
                ->first();

            if (
                $ultimoRegistro &&
                strtolower($ultimoRegistro->tipo) === $movimiento
            ) {
                $movimientoRequerido =
                    $movimiento === 'llegada'
                        ? 'Salida'
                        : 'Llegada';

                return response()->json([
                    'message' =>
                        "La matrícula ya cuenta con un registro de " .
                        "{$validated['movimiento']}. Debe registrar una " .
                        "{$movimientoRequerido} primero.",
                    'data' => null,
                ], 422);
            }

            $tipoExistente = DB::connection('remota')
                ->table('tb_tipo')
                ->where('tipo', $validated['equipo'])
                ->first();

            if ($tipoExistente) {
                $idTipo = $tipoExistente->id_tipo;
            } else {
                $idTipo = DB::connection('remota')
                    ->table('tb_tipo')
                    ->insertGetId([
                        'tipo' => $validated['equipo'],
                    ]);
            }

            $infoMatricula = DB::connection('remota')
                ->table('tb_matricula')
                ->where('matricula', $matricula)
                ->first();

            if (!$infoMatricula) {
                DB::connection('remota')
                    ->table('tb_matricula')
                    ->insert([
                        'matricula' => $matricula,
                        'id_estatus' => 1,
                        'id_tipo' => $idTipo,
                        'id_categoria' => 0,
                        'id_motor' => 0,
                        'id_aterrizaje' => 0,
                        'id_transito2h' => 0,
                        'id_transito12h' => 0,
                        'id_pernocta' => 0,
                        'd_vuelos' => 0,
                    ]);
            }

            $operacion = OperacionDiaria::create([
                'user_id' => Auth::id(),
                'fecha' => $validated['fecha'],
                'tipo' => $movimiento,
                'matricula' => $matricula,
                'equipo' => $validated['equipo'],
                'hora' => $validated['hora'],
                'lugar' => $validated['procedencia']
                    ?? $validated['destino']
                    ?? null,
                'pax' => $validated['pax'],
                'departamento' => $validated['departamento'],
                'equipaje' => $validated['equipaje'] ?? null,
                'observaciones' => $validated['observaciones'] ?? null,
                'validaciones' => [
                    $validated['departamento'],
                ],
                'impulso' => $validated['impulso'] ?? null,
                'nombre' => $validated['nombre'] ?? null,
                'tipo_cliente' => $validated['tipo_cliente'] ?? null,
                'tipo_operacion' => $validated['tipo_operacion'] ?? null,
            ]);

            $datosNuevos = [
                'tipo' => $operacion->tipo,
                'matricula' => $operacion->matricula,
                'equipo' => $operacion->equipo,
                'fecha' => $operacion->fecha,
                'hora' => $operacion->hora,
                'lugar' => $operacion->lugar,
                'pax' => $operacion->pax,
                'departamento' => $operacion->departamento,
                'equipaje' => $operacion->equipaje,
                'observaciones' => $operacion->observaciones,
                'validaciones' => $operacion->validaciones,
                'impulso' => $operacion->impulso,
                'nombre' => $operacion->nombre,
                'tipo_cliente' => $operacion->tipo_cliente,
                'tipo_operacion' => $operacion->tipo_operacion,
            ];

            Bitacora::log(
                modulo: 'OPERACIONES_DIARIAS',
                accion: Bitacora::ACCION_CREAR,
                descripcion:
                    "Se registró una {$operacion->tipo} " .
                    "en Operaciones Diarias #{$operacion->id} " .
                    "de la matrícula {$operacion->matricula}.",
                registroId: $operacion->id,
                datosAnteriores: null,
                datosNuevos: [
                    'datos_principales' => $datosNuevos,
                ],
            );

            return response()->json([
                'message' => 'Operación guardada correctamente',
                'operacion' => $operacion,
            ], 201);
        });
    }

    public function index(Request $request)
    {
        $query = OperacionDiaria::with('user');

        if ($request->filled('buscar')) {
            $query->where('matricula', 'LIKE', '%' . $request->buscar . '%');
        }

        if ($request->filled('tipo')) {
            $query->where('tipo', $request->tipo);
        }

        if ($request->filled('fechaInicio') && $request->filled('fechaFin')) {
            $query->whereBetween('fecha', [$request->fechaInicio, $request->fechaFin]);
        } elseif ($request->filled('fechaInicio')) {
            $query->whereDate('fecha', $request->fechaInicio);
        }

        if ($request->filled('lugar')) {
            $query->where('lugar', 'LIKE', '%' . $request->lugar . '%');
        }

        if ($request->filled('tipo_operacion')) {
            $query->where('tipo_operacion', $request->tipo_operacion);
        }

        if ($request->filled('pax')) {
            $query->where(function ($q) use ($request) {
                $q->where('pax', $request->pax);

                if ($request->pax == 0) {
                    $q->orWhereNull('pax')
                    ->orWhere('pax', '');
                }
            });
        }

        if ($request->filled('eqp')) {
            $query->where(function ($q) use ($request) {
                $q->where('equipaje', $request->eqp);

                if ($request->eqp == 0) {
                    $q->orWhereNull('equipaje')
                    ->orWhere('equipaje', '');
                }
            });
        }

        if ($request->filled('cliente')) {
            $query->where('tipo_cliente', $request->cliente);
        }

        $registros = $query->orderBy('fecha', 'desc')
                        ->orderBy('hora', 'desc')
                        ->paginate(20);

        return response()->json($registros);
    }
    public function obtenerExcel(Request $request)
    {
        $query = OperacionDiaria::query()
            ->select([
                'id',
                'tipo',
                'matricula',
                'equipo',
                'fecha',
                'hora',
                'lugar',
                'tipo_operacion',
                'pax',
                'equipaje',
                'tipo_cliente',
                DB::raw("
                    DATE_FORMAT(
                        STR_TO_DATE(
                            CONCAT(fecha, ' ', hora),
                            '%Y-%m-%d %H:%i:%s'
                        ),
                        '%d/%m/%Y %H:%i:%s'
                    ) AS fecha_hora
                "),
            ]);

        if ($request->filled('buscar')) {
            $query->where(
                'matricula',
                'LIKE',
                '%' . $request->buscar . '%'
            );
        }

        if ($request->filled('tipo')) {
            $query->where('tipo', $request->tipo);
        }

        if (
            $request->filled('fechaInicio') &&
            $request->filled('fechaFin')
        ) {
            $query->whereBetween('fecha', [
                $request->fechaInicio,
                $request->fechaFin,
            ]);
        } elseif ($request->filled('fechaInicio')) {
            $query->whereDate(
                'fecha',
                $request->fechaInicio
            );
        }

        if ($request->filled('lugar')) {
            $query->where(
                'lugar',
                'LIKE',
                '%' . $request->lugar . '%'
            );
        }

        if ($request->filled('tipo_operacion')) {
            $query->where(
                'tipo_operacion',
                $request->tipo_operacion
            );
        }

        if ($request->filled('pax')) {
            $query->where(function ($q) use ($request) {
                $q->where('pax', $request->pax);

                if ($request->pax == 0) {
                    $q->orWhereNull('pax')
                        ->orWhere('pax', '');
                }
            });
        }

        if ($request->filled('eqp')) {
            $query->where(function ($q) use ($request) {
                $q->where(
                    'equipaje',
                    $request->eqp
                );

                if ($request->eqp == 0) {
                    $q->orWhereNull('equipaje')
                        ->orWhere('equipaje', '');
                }
            });
        }

        if ($request->filled('cliente')) {
            $query->where(
                'tipo_cliente',
                $request->cliente
            );
        }

        $registros = $query
            ->orderBy('fecha', 'asc')
            ->orderBy('hora', 'asc')
            ->get();

        $crearFechaHoraOperacion = static function (
            $operacion
        ): Carbon {
            return Carbon::parse($operacion->fecha)
                ->setTimeFromTimeString(
                    (string) (
                        $operacion->hora ?: '00:00:00'
                    )
                );
        };

        $matriculas = $registros
            ->pluck('matricula')
            ->filter()
            ->unique()
            ->values();

        $movimientosCSAE = MovimientoCSAE::query()
            ->whereIn('matricula', $matriculas)
            ->where('status', 'A')
            ->whereNotNull('fecha_hora_entrada')
            ->orderBy('fecha_hora_entrada', 'asc')
            ->get([
                'id',
                'matricula',
                'fecha_hora_entrada',
                'fecha_hora_salida',
            ]);

        $operacionesPorMatricula = $registros->groupBy(
            function ($operacion) {
                return mb_strtoupper(
                    trim((string) $operacion->matricula)
                );
            }
        );

        $movimientosPorMatricula =
            $movimientosCSAE->groupBy(
                function ($movimiento) {
                    return mb_strtoupper(
                        trim(
                            (string) $movimiento->matricula
                        )
                    );
                }
            );

        $registros = $registros->map( function ($operacion) use (
            $operacionesPorMatricula,
            $movimientosPorMatricula,
            $crearFechaHoraOperacion
        ) {
            $operacion->mantenimiento_csae = false;
            $operacion->fecha_hora_csae = null;
            $operacion->fecha_hora_salida_csae = null;
            $operacion->movimientos_csae = [];
            $operacion->cantidad_visitas_csae = 0;
            $operacion->minutos_estancia_csae_total = 0;
            $operacion->salidas_csae_pendientes = 0;

            $tipoOperacion = mb_strtoupper(
                trim((string) $operacion->tipo)
            );

            if (
                !in_array(
                    $tipoOperacion,
                    ['LLEGADA', 'ENTRADA'],
                    true
                )
            ) {
                return $operacion;
            }

            $matricula = mb_strtoupper(
                trim((string) $operacion->matricula)
            );

            $fechaLlegada =
                $crearFechaHoraOperacion($operacion);

            $operacionesMismaMatricula =
                $operacionesPorMatricula->get(
                    $matricula,
                    collect()
                );

            $salidaOperacion =
                $operacionesMismaMatricula->first(
                    function ($posibleSalida) use (
                        $fechaLlegada,
                        $crearFechaHoraOperacion
                    ) {
                        $tipo = mb_strtoupper(
                            trim(
                                (string) $posibleSalida->tipo
                            )
                        );

                        if ($tipo !== 'SALIDA') {
                            return false;
                        }

                        $fechaSalida =
                            $crearFechaHoraOperacion(
                                $posibleSalida
                            );

                        return $fechaSalida->greaterThan(
                            $fechaLlegada
                        );
                    }
                );

            $fechaSalidaOperacion =
                $salidaOperacion
                    ? $crearFechaHoraOperacion(
                        $salidaOperacion
                    )
                    : null;

            $movimientosMismaMatricula =
                $movimientosPorMatricula->get(
                    $matricula,
                    collect()
                );

            $movimientosEncontrados =
                $movimientosMismaMatricula
                    ->filter(
                        function ($movimiento) use (
                            $fechaLlegada,
                            $fechaSalidaOperacion
                        ) {
                            $entradaCSAE =
                                $movimiento
                                    ->fecha_hora_entrada
                                    ->copy();

                            if (
                                $entradaCSAE->lessThan(
                                    $fechaLlegada
                                )
                            ) {
                                return false;
                            }

                            if (
                                $fechaSalidaOperacion &&
                                $entradaCSAE->greaterThan(
                                    $fechaSalidaOperacion
                                )
                            ) {
                                return false;
                            }

                            if (
                                $fechaSalidaOperacion &&
                                $movimiento
                                    ->fecha_hora_salida
                            ) {
                                $salidaCSAE =
                                    $movimiento
                                        ->fecha_hora_salida
                                        ->copy();

                                if (
                                    $salidaCSAE->greaterThan(
                                        $fechaSalidaOperacion
                                    )
                                ) {
                                    return false;
                                }
                            }

                            return true;
                        }
                    )
                    ->values();

            if ($movimientosEncontrados->isEmpty()) {
                return $operacion;
            }

            $visitasCSAE = $movimientosEncontrados
                ->map(function ($movimiento) {
                    $entrada =
                        $movimiento
                            ->fecha_hora_entrada
                            ->copy();

                    $salida =
                        $movimiento->fecha_hora_salida
                            ? $movimiento
                                ->fecha_hora_salida
                                ->copy()
                            : null;

                    $minutosEstancia = null;

                    if (
                        $salida &&
                        $salida->greaterThanOrEqualTo(
                            $entrada
                        )
                    ) {
                        $minutosEstancia = (int) floor(
                            $entrada->diffInSeconds(
                                $salida
                            ) / 60
                        );
                    }

                    return [
                        'id' => $movimiento->id,

                        'fecha_hora_entrada' =>
                            $entrada->format(
                                'd/m/Y H:i:s'
                            ),

                        'fecha_hora_salida' =>
                            $salida
                                ? $salida->format(
                                    'd/m/Y H:i:s'
                                )
                                : null,

                        'minutos_estancia' =>
                            $minutosEstancia,

                        'pendiente' =>
                            $salida === null,
                    ];
                })
                ->values();

            $primerMovimiento =
                $visitasCSAE->first();

            $totalMinutos = $visitasCSAE->sum(
                function ($visita) {
                    return $visita['minutos_estancia']
                        ?? 0;
                }
            );

            $salidasPendientes =
                $visitasCSAE->filter(
                    function ($visita) {
                        return $visita['pendiente'];
                    }
                )->count();

            $operacion->mantenimiento_csae = true;

            $operacion->fecha_hora_csae =
                $primerMovimiento[
                    'fecha_hora_entrada'
                ];

            $operacion->fecha_hora_salida_csae =
                $primerMovimiento[
                    'fecha_hora_salida'
                ];

            $operacion->movimientos_csae =
                $visitasCSAE->all();

            $operacion->cantidad_visitas_csae =
                $visitasCSAE->count();

            $operacion->minutos_estancia_csae_total =
                $totalMinutos;

            $operacion->salidas_csae_pendientes =
                $salidasPendientes;

            return $operacion;
        }
    );

        return response()->json(
            $registros->values()
        );
    }

    public function update(Request $request, $id)
    {
        return DB::transaction(function () use ($request, $id) {
            $operacion = OperacionDiaria::findOrFail($id);

            $validacionesAnteriores = is_array(
                $operacion->validaciones
            )
                ? $operacion->validaciones
                : [];

            $valorAValidar = $request->nombreRol === 'FBO'
                ? $request->nombreRol
                : $request->departamento;

            $validacionesNuevas = $validacionesAnteriores;

            if (
                is_string($valorAValidar) &&
                trim($valorAValidar) !== ''
            ) {
                $validacionesNuevas[] = trim($valorAValidar);
            }

            $validacionesNuevas = array_values(
                array_unique($validacionesNuevas)
            );

            $nuevosDatos = [
                'matricula' => strtoupper(
                    (string) $request->matricula
                ),
                'equipo' => $request->equipo,
                'hora' => $request->hora,
                'lugar' => $request->procedencia
                    ?? $request->destino
                    ?? null,
                'pax' => $request->pax,
                'fecha' => $request->fecha,
                'validaciones' => $validacionesNuevas,
                'equipaje' => $request->equipaje,
                'observaciones' => $request->observaciones,
                'tipo_cliente' => $request->tipo_cliente,
                'tipo_operacion' => $request->tipo_operacion,
                'nombre' => $request->nombre,
                'impulso' => $request->impulso,
            ];

            $valoresAnteriores = [];

            foreach (array_keys($nuevosDatos) as $campo) {
                $valoresAnteriores[$campo] =
                    $operacion->getAttribute($campo);
            }

            $operacion->fill($nuevosDatos);

            $camposSucios = array_keys(
                $operacion->getDirty()
            );

            $datosAnteriores = [];
            $datosNuevos = [];

            foreach ($camposSucios as $campo) {
                $datosAnteriores[$campo] =
                    $valoresAnteriores[$campo] ?? null;

                $datosNuevos[$campo] =
                    $operacion->getAttribute($campo);
            }

            $operacion->save();

            if (!empty($datosNuevos)) {
                $nombresCampos = [
                    'matricula' => 'matrícula',
                    'equipo' => 'equipo',
                    'hora' => 'hora',
                    'lugar' => 'procedencia o destino',
                    'pax' => 'pasajeros',
                    'fecha' => 'fecha',
                    'validaciones' => 'validaciones',
                    'equipaje' => 'equipaje',
                    'observaciones' => 'observaciones',
                    'tipo_cliente' => 'tipo de cliente',
                    'tipo_operacion' => 'tipo de operación',
                    'nombre' => 'nombre',
                    'impulso' => 'impulso',
                ];

                $camposDescripcion = array_map(
                    function ($campo) use ($nombresCampos) {
                        return $nombresCampos[$campo] ?? $campo;
                    },
                    array_keys($datosNuevos)
                );

                Bitacora::log(
                    modulo: 'OPERACIONES_DIARIAS',
                    accion: Bitacora::ACCION_ACTUALIZAR,
                    descripcion:
                        "Se actualizó la operación diaria " .
                        "#{$operacion->id} de la matrícula " .
                        "{$operacion->matricula}. Campos modificados: " .
                        implode(', ', $camposDescripcion) .
                        '.',
                    registroId: $operacion->id,
                    datosAnteriores: [
                        'datos_principales' => $datosAnteriores,
                    ],
                    datosNuevos: [
                        'datos_principales' => $datosNuevos,
                    ],
                );
            }

            return response()->json([
                'message' => 'Operación actualizada correctamente',
                'operacion' => $operacion->fresh(),
                'cambios_registrados' => !empty($datosNuevos),
                'campos_modificados' => array_keys($datosNuevos),
            ]);
        });
    }
    public function buscarPorMatricula(string $matricula): JsonResponse
    {
        try {
            $infoMatricula = DB::connection('remota')
                ->table('tb_matricula as m')
                ->leftJoin('tb_estatus as e', 'e.id_estatus', '=', 'm.id_estatus')
                ->leftJoin('tb_tipo as t', 't.id_tipo', '=', 'm.id_tipo')
                ->leftJoin('tb_categoria as c', 'c.id_categoria', '=', 'm.id_categoria')
                ->where('m.matricula', $matricula)
                ->select(
                    't.tipo',
                )
                ->first();
            return response()->json($infoMatricula);

        } catch (\Throwable $e) {
            \Log::error('Error al buscar aeronave: ' . $e->getMessage());
            return response()->json(['error' => 'Error interno del servidor'], 500);
        }
    }
    public function autocomplete(Request $request): JsonResponse
    {
        try {
            $q = trim($request->query('q', ''));

            if ($q === '') {
                return response()->json([]);
            }

            $matriculas = DB::connection('remota')
                ->table('tb_matricula')
                ->where('matricula', 'like', '%' . strtoupper($q) . '%')
                ->limit(10)
                ->select('matricula')
                ->get();

            if (empty($matriculas)) {
                return response()->json([]);
            }


            $result = collect($matriculas)->map(function ($matricula) {
                return [
                    'matricula'  => $matricula,
                ];
            })->values();

            return response()->json($result);

        } catch (\Throwable $e) {
            Log::error('Autocomplete Error', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([]);
        }
    }
    public function verificarExistente(Request $request)
    {
        $request->validate([
            'matricula' => 'required|string',
            'fecha' => 'required|date',
            'tipo' => 'required|string',
            'modulo' => 'required|string'
        ]);

        $operacion = OperacionDiaria::where('matricula', $request->matricula)
            ->where('fecha', $request->fecha)
            ->where('tipo', $request->tipo)
            ->first();

        if ($operacion) {
            $yaValidadoPorMi = collect($operacion->validaciones ?? [])->contains($request->modulo);
            if ($yaValidadoPorMi) {
                return response()->json(['existe' => false]);
            }
            return response()->json([
                'existe' => true,
                'operacion' => $operacion,
                'message' => "Registro encontrado. Falta validación de {$request->modulo}."
            ]);
        }

        return response()->json(['existe' => false]);
    }
    public function obtenerNombresPorMatricula(string $matricula): JsonResponse
    {
        $nombres = OperacionDiaria::where('matricula', $matricula)
            ->whereNotNull('nombre')
            ->where('nombre', '!=', '')
            ->select(DB::raw('DISTINCT UPPER(TRIM(nombre)) as nombre_limpio'))
            ->pluck('nombre_limpio');

        return response()->json($nombres);
    }
    public function obtenerPendientes(Request $request): JsonResponse
    {
        $modulo = $request->query('modulo');

        if (!$modulo) {
            return response()->json(['error' => 'El módulo es requerido'], 400);
        }
        $pendientes = OperacionDiaria::where(function ($query) use ($modulo) {
                $query->whereJsonDoesntContain('validaciones', $modulo)
                    ->orWhereNull('validaciones');
            })
            ->orderBy('hora', 'asc')
            ->get();

        return response()->json($pendientes);
    }
    public function obtenerPdf(Request $request)
    {
        $query = OperacionDiaria::query();

        if ($request->filled('buscar')) {
            $query->where(
                'matricula',
                'LIKE',
                '%' . $request->buscar . '%'
            );
        }

        if ($request->filled('tipo')) {
            $query->where(
                'tipo',
                $request->tipo
            );
        }

        if (
            $request->filled('fechaInicio') &&
            $request->filled('fechaFin')
        ) {
            $query->whereBetween('fecha', [
                $request->fechaInicio,
                $request->fechaFin,
            ]);
        } elseif ($request->filled('fechaInicio')) {
            $query->whereDate(
                'fecha',
                $request->fechaInicio
            );
        }

        if ($request->filled('equipo')) {
            $query->where(
                'equipo',
                'LIKE',
                '%' . $request->equipo . '%'
            );
        }

        if ($request->filled('lugar')) {
            $query->where(
                'lugar',
                'LIKE',
                '%' . $request->lugar . '%'
            );
        }

        if ($request->filled('tipo_operacion')) {
            $query->where(
                'tipo_operacion',
                $request->tipo_operacion
            );
        }

        if ($request->filled('pax')) {
            $query->where(function ($q) use ($request) {
                $q->where(
                    'pax',
                    $request->pax
                );

                if ($request->pax == 0) {
                    $q->orWhereNull('pax')
                        ->orWhere('pax', '');
                }
            });
        }

        if ($request->filled('eqp')) {
            $query->where(function ($q) use ($request) {
                $q->where(
                    'equipaje',
                    $request->eqp
                );

                if ($request->eqp == 0) {
                    $q->orWhereNull('equipaje')
                        ->orWhere('equipaje', '');
                }
            });
        }

        if ($request->filled('cliente')) {
            $query->where(
                'tipo_cliente',
                $request->cliente
            );
        }

        $operaciones = $query
            ->orderBy('fecha', 'asc')
            ->orderBy('hora', 'asc')
            ->get();

        $normalizarTipo = static function ($valor): string {
            $valor = mb_strtoupper(
                trim((string) $valor)
            );

            return str_replace(
                ['Á', 'É', 'Í', 'Ó', 'Ú', 'Ü'],
                ['A', 'E', 'I', 'O', 'U', 'U'],
                $valor
            );
        };

        $filas = $operaciones
            ->groupBy(function ($operacion) {
                return Carbon::parse(
                    $operacion->fecha
                )->format('Y-m-d');
            })
            ->map(function ($registros, $fecha) use ($normalizarTipo) {
                $transito = 0;
                $guarda = 0;
                $aerotaxi = 0;
                $handling = 0;
                $mantenimiento = 0;
                $totalPax = 0;

                foreach ($registros as $operacion) {
                    $tipoCliente = $normalizarTipo(
                        $operacion->tipo_cliente
                    );

                    switch ($tipoCliente) {
                        case 'TRANSITO':
                            $transito++;
                            break;

                        case 'GUARDA':
                            $guarda++;
                            break;

                        case 'AEROTAXI':
                            $aerotaxi++;
                            break;

                        case 'HANDLING':
                            $handling++;
                            break;

                        case 'MANTENIMIENTO':
                            $mantenimiento++;
                            break;
                    }

                    $totalPax += (int) (
                        $operacion->pax ?? 0
                    );
                }

                return [
                    'fecha' => Carbon::parse(
                        $fecha
                    )->format('d/m/Y'),

                    'fecha_original' => $fecha,

                    'transito' => $transito,
                    'guarda' => $guarda,
                    'aerotaxi' => $aerotaxi,
                    'handling' => $handling,
                    'mantenimiento' => $mantenimiento,
                    'total_pax_dia' => $totalPax,
                ];
            })
            ->values();

        $totales = [
            'transito' => $filas->sum('transito'),
            'guarda' => $filas->sum('guarda'),
            'aerotaxi' => $filas->sum('aerotaxi'),
            'handling' => $filas->sum('handling'),
            'mantenimiento' => $filas->sum('mantenimiento'),
            'total_pax_dia' => $filas->sum('total_pax_dia'),
        ];

        return response()->json([
            'data' => $filas,
            'totales' => $totales,
        ]);
    }
}
