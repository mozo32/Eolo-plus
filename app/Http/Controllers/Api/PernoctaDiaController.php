<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\PernoctaDia;
use Carbon\Carbon;

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

        $query = PernoctaDia::query()
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
            )
            ->orderByDesc('fecha')
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        $registros = $query->paginate($perPage);

        $registros->getCollection()->transform(
            function ($registro) {
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
            }
        );

        return response()->json([
            'data' => $registros->items(),
            'meta' => [
                'current_page' => $registros->currentPage(),
                'last_page' => $registros->lastPage(),
                'per_page' => $registros->perPage(),
                'total' => $registros->total(),
                'from' => $registros->firstItem(),
                'to' => $registros->lastItem(),
            ],
        ]);
    }
    public function store(Request $request)
    {
        $data = $request->all();

        DB::beginTransaction();

        try {
            foreach ($data as $item) {

                $infoMatricula = DB::connection('remota')
                    ->table('tb_matricula as m')
                    ->leftJoin('tb_estatus as e', 'e.id_estatus', '=', 'm.id_estatus')
                    ->leftJoin('tb_tipo as t', 't.id_tipo', '=', 'm.id_tipo')
                    ->leftJoin('tb_categoria as c', 'c.id_categoria', '=', 'm.id_categoria')
                    ->where('m.matricula', $item['matricula'])
                    ->select(
                        'm.matricula',
                        'e.estatus',
                        't.tipo',
                        'c.categoria'
                    )
                    ->first();

                if (!$infoMatricula) {
                    DB::connection('remota')->table('tb_matricula')->insert([
                        'matricula'      => $item['matricula'],
                        'id_estatus'     => 1,
                        'id_tipo'        => 0,
                        'id_categoria'   => 0,
                        'id_motor'       => 0,
                        'id_aterrizaje'  => 0,
                        'id_transito2h'  => 0,
                        'id_transito12h' => 0,
                        'id_pernocta'    => 0,
                        'd_vuelos'       => 0,
                    ]);

                    $infoMatricula = (object) [
                        'tipo'      => '',
                        'estatus'   => '',
                        'categoria' => ''
                    ];
                }

                PernoctaDia::create([
                    'fecha'         => $item['fecha'],
                    'matricula'     => $item['matricula'],
                    'nombre'        => $item['nombre'],
                    'observaciones' => $item['observaciones'] ?? null,
                    'ubicacion'     => $item['ubicacion'],
                    'aeronave'      => $infoMatricula->tipo,
                    'tipo_cliente'  => $infoMatricula->estatus,
                    'categoria'     => $infoMatricula->categoria,
                ]);
            }

            DB::commit();

            return response()->json([
                'message' => 'Pernoctas guardadas correctamente',
                'total'   => count($data),
            ], 201);

        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => $e->getMessage(),
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
