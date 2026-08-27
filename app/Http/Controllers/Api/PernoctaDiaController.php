<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\PernoctaDia;
use Carbon\Carbon;
use App\Models\OperacionDiaria;
use Illuminate\Support\Facades\Validator;

class PernoctaDiaController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'fechaInicio' => [
                'nullable',
                'date',
                'required_with:fechaFin',
            ],
            'fechaFin' => [
                'nullable',
                'date',
                'required_with:fechaInicio',
                'after_or_equal:fechaInicio',
            ],
            'periodo' => [
                'nullable',
                'in:dia,rango,mes,año',
            ],
            'matricula' => [
                'nullable',
                'string',
                'max:30',
            ],
            'ubicacion' => [
                'nullable',
                'in:H1,H2',
            ],
            'responsable' => [
                'nullable',
                'string',
                'max:150',
            ],
            'per_page' => [
                'nullable',
                'integer',
                'in:5,10,20,50,100',
            ],
            'page' => [
                'nullable',
                'integer',
                'min:1',
            ],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 20);

        /*
        * Se utiliza una función para aplicar los mismos filtros
        * tanto a los grupos como a sus registros.
        */
        $aplicarFiltros = function ($query) use ($validated) {
            return $query
                ->when(
                    !empty($validated['matricula']),
                    function ($query) use ($validated) {
                        $query->where(
                            'matricula',
                            'like',
                            '%' . trim($validated['matricula']) . '%'
                        );
                    }
                )
                ->when(
                    !empty($validated['ubicacion']),
                    function ($query) use ($validated) {
                        $query->where(
                            'ubicacion',
                            $validated['ubicacion']
                        );
                    }
                )
                ->when(
                    !empty($validated['responsable']),
                    function ($query) use ($validated) {
                        $query->where(
                            'nombre',
                            'like',
                            '%' . trim($validated['responsable']) . '%'
                        );
                    }
                )
                ->when(
                    !empty($validated['fechaInicio']),
                    function ($query) use ($validated) {
                        $query->whereDate(
                            'fecha',
                            '>=',
                            $validated['fechaInicio']
                        );
                    }
                )
                ->when(
                    !empty($validated['fechaFin']),
                    function ($query) use ($validated) {
                        $query->whereDate(
                            'fecha',
                            '<=',
                            $validated['fechaFin']
                        );
                    }
                );
        };

        /*
        * Consulta base con los filtros.
        */
        $queryBase = $aplicarFiltros(
            PernoctaDia::query()
        );

        /*
        * Agrupa los registros por fecha y minuto.
        *
        * Ejemplo:
        * 2026-07-24 10:35
        */
        $grupos = (clone $queryBase)
            ->selectRaw('DATE(fecha) as fecha_grupo')
            ->selectRaw("
                DATE_FORMAT(created_at, '%H:%i') as hora_grupo
            ")
            ->selectRaw('COUNT(*) as total_registros')
            ->groupByRaw("
                DATE(fecha),
                DATE_FORMAT(created_at, '%H:%i')
            ")
            ->orderByDesc('fecha_grupo')
            ->orderByDesc('hora_grupo')
            ->paginate($perPage);

        $gruposPagina = collect(
            $grupos->items()
        );

        $detalles = collect();

        /*
        * Solamente consulta los registros pertenecientes
        * a los grupos de la página actual.
        */
        if ($gruposPagina->isNotEmpty()) {
            $queryDetalles = (clone $queryBase)
                ->select([
                    'id',
                    'fecha',
                    'matricula',
                    'nombre',
                    'observaciones',
                    'ubicacion',
                    'aeronave',
                    'tipo_cliente',
                    'categoria',
                    'created_at',
                ])
                ->where(function ($query) use ($gruposPagina) {
                    foreach ($gruposPagina as $grupo) {
                        $query->orWhere(
                            function ($subQuery) use ($grupo) {
                                $subQuery
                                    ->whereDate(
                                        'fecha',
                                        $grupo->fecha_grupo
                                    )
                                    ->whereRaw(
                                        "DATE_FORMAT(created_at, '%H:%i') = ?",
                                        [$grupo->hora_grupo]
                                    );
                            }
                        );
                    }
                })
                ->orderByDesc('fecha')
                ->orderByDesc('created_at')
                ->orderByDesc('id');

            $detalles = $queryDetalles->get();
        }

        /*
        * Organiza las aeronaves utilizando la misma clave:
        * fecha|hora.
        */
        $detallesAgrupados = $detalles->groupBy(
            function ($registro) {
                $fecha = Carbon::parse(
                    $registro->fecha
                )->format('Y-m-d');

                $hora = Carbon::parse(
                    $registro->created_at
                )->format('H:i');

                return $fecha . '|' . $hora;
            }
        );

        /*
        * Modifica la colección paginada para agregar
        * los registros dentro de cada grupo.
        */
        $grupos->setCollection(
            $grupos->getCollection()->map(
                function ($grupo) use ($detallesAgrupados) {
                    $claveGrupo =
                        $grupo->fecha_grupo .
                        '|' .
                        $grupo->hora_grupo;

                    $registrosGrupo = $detallesAgrupados
                        ->get($claveGrupo, collect())
                        ->values()
                        ->map(function ($registro) {
                            return [
                                'id' => $registro->id,

                                'fecha' => Carbon::parse(
                                    $registro->fecha
                                )->format('Y-m-d'),

                                'hora' => $registro->created_at
                                    ? Carbon::parse(
                                        $registro->created_at
                                    )->format('H:i:s')
                                    : '',

                                'matricula' => $registro->matricula,
                                'ubicacion' => $registro->ubicacion,
                                'observaciones' => $registro->observaciones,
                                'nombre' => $registro->nombre,
                                'aeronave' => $registro->aeronave,
                                'tipo_cliente' => $registro->tipo_cliente,
                                'categoria' => $registro->categoria,
                            ];
                        });

                    return [
                        'id' => $claveGrupo,
                        'fecha' => $grupo->fecha_grupo,
                        'hora' => $grupo->hora_grupo,
                        'total' => (int) $grupo->total_registros,
                        'registros' => $registrosGrupo,
                    ];
                }
            )
        );

        return response()->json([
            'data' => $grupos->items(),

            'meta' => [
                'current_page' => $grupos->currentPage(),
                'last_page' => $grupos->lastPage(),
                'per_page' => $grupos->perPage(),
                'total' => $grupos->total(),
                'from' => $grupos->firstItem(),
                'to' => $grupos->lastItem(),
            ],
        ]);
    }
    public function store(Request $request)
    {
        $validator = Validator::make(
            $request->all(),
            [
                '*.fecha' => 'required|date',
                '*.hora' => 'nullable|string',
                '*.matricula' => 'required|string|max:20',
                '*.nombre' => 'required|string|max:255',
                '*.observaciones' => 'nullable|string',
                '*.ubicacion' => 'required|string|max:20',
            ]
        );

        if ($validator->fails()) {
            return response()->json([
                'message' =>
                    'La información enviada no es válida.',
                'errors' =>
                    $validator->errors(),
            ], 422);
        }

        $normalizarMatricula =
            static function ($matricula): string {
                return mb_strtoupper(
                    trim((string) $matricula)
                );
            };

        $data = collect($validator->validated())
            ->map(
                function ($item) use (
                    $normalizarMatricula
                ) {
                    $item['matricula'] =
                        $normalizarMatricula(
                            $item['matricula']
                        );

                    return $item;
                }
            )
            ->values()
            ->all();

        if (count($data) === 0) {
            return response()->json([
                'message' =>
                    'No hay pernoctas para guardar.',
            ], 422);
        }

        $matriculas = collect($data)
            ->pluck('matricula')
            ->filter()
            ->unique()
            ->values();

        $operaciones = OperacionDiaria::query()
            ->whereIn('matricula', $matriculas)
            ->orderBy('fecha', 'asc')
            ->orderBy('hora', 'asc')
            ->orderBy('id', 'asc')
            ->get([
                'id',
                'tipo',
                'matricula',
                'fecha',
                'hora',
            ]);

        $operacionesPorMatricula =
            $operaciones->groupBy(
                function ($operacion) use (
                    $normalizarMatricula
                ) {
                    return $normalizarMatricula(
                        $operacion->matricula
                    );
                }
            );

        $crearFechaHoraOperacion =
            static function ($operacion): Carbon {
                return Carbon::parse(
                    $operacion->fecha
                )->setTimeFromTimeString(
                    (string) (
                        $operacion->hora
                        ?: '00:00:00'
                    )
                );
            };

        $aeronavesFueraHangar = [];

        foreach ($data as $item) {
            $matricula =
                $normalizarMatricula(
                    $item['matricula']
                );

            $fechaPernocta =
                Carbon::parse(
                    $item['fecha']
                )->startOfDay();

            $operacionesMatricula =
                $operacionesPorMatricula->get(
                    $matricula,
                    collect()
                );

            $ultimaOperacion =
                $operacionesMatricula
                    ->filter(
                        function ($operacion) use (
                            $fechaPernocta
                        ) {
                            $fechaOperacion =
                                Carbon::parse(
                                    $operacion->fecha
                                )->startOfDay();

                            return $fechaOperacion
                                ->lessThanOrEqualTo(
                                    $fechaPernocta
                                );
                        }
                    )
                    ->last();

            if (!$ultimaOperacion) {
                $aeronavesFueraHangar[] = [
                    'matricula' => $matricula,
                    'motivo' =>
                        'No tiene operaciones registradas hasta la fecha de la pernocta.',
                    'ultima_operacion' => null,
                    'fecha_hora_ultima_operacion' =>
                        null,
                ];

                continue;
            }

            $tipoUltimaOperacion =
                mb_strtoupper(
                    trim(
                        (string)
                            $ultimaOperacion->tipo
                    )
                );

            $estaDentro = in_array(
                $tipoUltimaOperacion,
                [
                    'LLEGADA',
                    'ENTRADA',
                ],
                true
            );

            if (!$estaDentro) {
                $fechaUltimaOperacion =
                    $crearFechaHoraOperacion(
                        $ultimaOperacion
                    );

                $aeronavesFueraHangar[] = [
                    'matricula' => $matricula,
                    'motivo' =>
                        'La última operación registrada es una salida.',
                    'ultima_operacion' =>
                        $tipoUltimaOperacion,
                    'fecha_hora_ultima_operacion' =>
                        $fechaUltimaOperacion->format(
                            'd/m/Y H:i:s'
                        ),
                ];
            }
        }

        if (
            count($aeronavesFueraHangar) > 0
        ) {
            return response()->json([
                'message' =>
                    'No se guardaron las pernoctas porque una o más aeronaves no se encuentran dentro del hangar.',
                'codigo' =>
                    'AERONAVE_FUERA_HANGAR',
                'aeronaves_fuera_hangar' =>
                    $aeronavesFueraHangar,
            ], 422);
        }

        DB::beginTransaction();

        try {
            foreach ($data as $item) {
                $infoMatricula =
                    DB::connection('remota')
                        ->table(
                            'tb_matricula as m'
                        )
                        ->leftJoin(
                            'tb_estatus as e',
                            'e.id_estatus',
                            '=',
                            'm.id_estatus'
                        )
                        ->leftJoin(
                            'tb_tipo as t',
                            't.id_tipo',
                            '=',
                            'm.id_tipo'
                        )
                        ->leftJoin(
                            'tb_categoria as c',
                            'c.id_categoria',
                            '=',
                            'm.id_categoria'
                        )
                        ->where(
                            'm.matricula',
                            $item['matricula']
                        )
                        ->select(
                            'm.matricula',
                            'e.estatus',
                            't.tipo',
                            'c.categoria'
                        )
                        ->first();

                if (!$infoMatricula) {
                    DB::connection('remota')
                        ->table('tb_matricula')
                        ->insert([
                            'matricula' =>
                                $item['matricula'],
                            'id_estatus' => 1,
                            'id_tipo' => 0,
                            'id_categoria' => 0,
                            'id_motor' => 0,
                            'id_aterrizaje' => 0,
                            'id_transito2h' => 0,
                            'id_transito12h' => 0,
                            'id_pernocta' => 0,
                            'd_vuelos' => 0,
                        ]);

                    $infoMatricula = (object) [
                        'tipo' => '',
                        'estatus' => '',
                        'categoria' => '',
                    ];
                }

                PernoctaDia::create([
                    'fecha' =>
                        $item['fecha'],
                    'matricula' =>
                        $item['matricula'],
                    'nombre' =>
                        $item['nombre'],
                    'observaciones' =>
                        $item['observaciones']
                        ?? null,
                    'ubicacion' =>
                        $item['ubicacion'],
                    'aeronave' =>
                        $infoMatricula->tipo,
                    'tipo_cliente' =>
                        $infoMatricula->estatus,
                    'categoria' =>
                        $infoMatricula->categoria,
                ]);
            }

            DB::commit();

            return response()->json([
                'message' =>
                    'Pernoctas guardadas correctamente',
                'total' =>
                    count($data),
            ], 201);
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' =>
                    'No se pudieron guardar las pernoctas.',
                'error' =>
                    $e->getMessage(),
            ], 422);
        }
    }
    public function buscar(Request $request)
    {
        $q = $request->get('q');

        if (!$q || strlen($q) < 1) {
            return response()->json([]);
        }

        $matriculas = DB::connection('remota')
            ->table('tb_matricula')
            ->where('matricula', 'like', "%{$q}%")
            ->limit(10)
            ->pluck('matricula');

        return response()->json($matriculas);
    }
    public function anios()
    {
        $anios = DB::table('pernocta_dia')
            ->selectRaw('YEAR(fecha) as anio')
            ->groupByRaw('YEAR(fecha)')
            ->orderBy('anio', 'desc')
            ->pluck('anio');

        return response()->json($anios);
    }
}
