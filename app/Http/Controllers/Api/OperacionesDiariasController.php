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
            ->select(['id', 'tipo', 'matricula', 'equipo', 'fecha', 'hora', 'lugar', 'tipo_operacion', 'pax', 'equipaje', 'tipo_cliente',
                DB::raw("
                    DATE_FORMAT(
                        STR_TO_DATE(CONCAT(fecha, ' ', hora), '%Y-%m-%d %H:%i:%s'),
                        '%d/%m/%Y %H:%i:%s'
                    ) as fecha_hora
                ")
            ]);

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


        $registros = $query
            ->orderBy('fecha', 'asc')
            ->orderBy('hora', 'asc')
            ->get();


        $matriculas = $registros
            ->pluck('matricula')
            ->filter()
            ->unique()
            ->values();

        $movimientosCSAE = MovimientoCSAE::query()
            ->whereIn('matricula', $matriculas)
            ->whereNotNull('fecha_hora_entrada')
            ->orderBy('fecha_hora_entrada', 'asc')
            ->get();


        $registros = $registros->map(function ($op) use ($movimientosCSAE) {

            $fechaOperacion = Carbon::parse($op->fecha)
                ->setTimeFromTimeString($op->hora);

            $movimiento = $movimientosCSAE
                ->where('matricula', $op->matricula)
                ->first(function ($mov) use ($fechaOperacion) {

                    return Carbon::parse($mov->fecha_hora_entrada)
                        ->greaterThan($fechaOperacion);

                });

            $op->mantenimiento_csae = $movimiento ? true : false;

            $op->fecha_hora_csae = $movimiento
                ? Carbon::parse($movimiento->fecha_hora_entrada)
                    ->format('d/m/Y H:i:s')
                : null;

            return $op;
        });

        return response()->json($registros);
    }
    public function obtenerPdf(Request $request)
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
            ]);

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

        $registros = $query
            ->orderBy('fecha', 'asc')
            ->orderBy('hora', 'asc')
            ->get();

        $dias = [
            'Monday' => 'LUNES',
            'Tuesday' => 'MARTES',
            'Wednesday' => 'MIERCOLES',
            'Thursday' => 'JUEVES',
            'Friday' => 'VIERNES',
            'Saturday' => 'SABADO',
            'Sunday' => 'DOMINGO',
        ];

        $normalizarCliente = function ($cliente) {
            $valor = strtoupper(trim((string) $cliente));

            $valor = str_replace(
                ['Á', 'É', 'Í', 'Ó', 'Ú', 'Ü'],
                ['A', 'E', 'I', 'O', 'U', 'U'],
                $valor
            );

            return $valor;
        };

        $resumen = $registros
            ->groupBy(function ($item) {
                return Carbon::parse($item->fecha)->format('Y-m-d');
            })
            ->map(function ($items, $fecha) use ($dias, $normalizarCliente) {
                $carbon = Carbon::parse($fecha);
                $diaNombre = $dias[$carbon->format('l')] ?? strtoupper($carbon->locale('es')->dayName);

                $fila = [
                    'fecha' => $diaNombre . '-' . $carbon->format('d'),
                    'fecha_original' => $carbon->format('Y-m-d'),
                    'transito' => 0,
                    'guarda' => 0,
                    'aerotaxi' => 0,
                    'handling' => 0,
                    'total_pax_dia' => 0,
                ];

                foreach ($items as $item) {
                    $cliente = $normalizarCliente($item->tipo_cliente);

                    if ($cliente === 'TRANSITO') {
                        $fila['transito']++;
                    } elseif ($cliente === 'GUARDA') {
                        $fila['guarda']++;
                    } elseif ($cliente === 'AEROTAXI') {
                        $fila['aerotaxi']++;
                    } elseif ($cliente === 'HANDLING') {
                        $fila['handling']++;
                    }

                    $fila['total_pax_dia'] += is_numeric($item->pax) ? (int) $item->pax : 0;
                }

                return $fila;
            })
            ->values();

        $totales = [
            'transito' => $resumen->sum('transito'),
            'guarda' => $resumen->sum('guarda'),
            'aerotaxi' => $resumen->sum('aerotaxi'),
            'handling' => $resumen->sum('handling'),
            'total_pax_dia' => $resumen->sum('total_pax_dia'),
        ];

        return response()->json([
            'ok' => true,
            'data' => $resumen,
            'totales' => $totales,
        ]);
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
}
