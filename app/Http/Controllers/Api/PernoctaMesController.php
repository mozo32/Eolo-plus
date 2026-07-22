<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class PernoctaMesController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'desde' => [
                'nullable',
                'date',
                'required_with:hasta',
            ],
            'hasta' => [
                'nullable',
                'date',
                'required_with:desde',
                'after_or_equal:desde',
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
        ]);

        $query = DB::table('pernocta_dia')
            ->select([
                'id',
                'fecha',
                'matricula',
                'aeronave',
                DB::raw('tipo_cliente as estatus'),
                'ubicacion',
                'categoria',
                'nombre',
                'observaciones',
                'created_at',
            ])
            ->when(
                !empty($validated['desde']),
                function ($query) use ($validated) {
                    $query->whereDate(
                        'fecha',
                        '>=',
                        $validated['desde']
                    );
                }
            )
            ->when(
                !empty($validated['hasta']),
                function ($query) use ($validated) {
                    $query->whereDate(
                        'fecha',
                        '<=',
                        $validated['hasta']
                    );
                }
            )
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
            ->orderBy('fecha')
            ->orderBy('created_at')
            ->orderBy('matricula');

        $rows = $query->get()->map(function ($registro) {
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
                'aeronave' => $registro->aeronave,
                'estatus' => $registro->estatus,
                'ubicacion' => $registro->ubicacion,
                'categoria' => $registro->categoria,
                'nombre' => $registro->nombre,
                'observaciones' => $registro->observaciones,
            ];
        });

        return response()->json([
            'data' => $rows,
            'total' => $rows->count(),
        ]);
    }
}
