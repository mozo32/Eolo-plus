<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\PernoctaDia;

class PernoctaDiaController extends Controller
{
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
                    throw new \Exception(
                        "La aeronave con matrícula {$item['matricula']} no está registrada"
                    );
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
