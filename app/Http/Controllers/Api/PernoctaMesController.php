<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PernoctaMesController extends Controller
{
    public function index(Request $request)
    {
        $anio = $request->get('anio');
        $mes = $request->get('mes'); // opcional
        $desde = $request->get('desde');
        $hasta = $request->get('hasta');

        $query = DB::table('pernocta_dia')
            ->select(
                'fecha',
                'matricula',
                'aeronave',
                DB::raw('tipo_cliente as estatus'),
                'ubicacion',
                'categoria',
            )
            ->whereYear('fecha', $anio);

        if ($mes) {
            $query->whereMonth('fecha', $mes);
        }

        if ($desde && $hasta) {
            $query->whereBetween('fecha', [$desde, $hasta]);
        }

        $rows = $query->get();

        return response()->json($rows);
    }
}
