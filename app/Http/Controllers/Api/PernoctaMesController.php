<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
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
                'pernocta_dia.id',
                'pernocta_dia.fecha',
                'pernocta_dia.matricula',
                'pernocta_dia.aeronave',
                DB::raw('pernocta_dia.tipo_cliente as estatus'),
                'pernocta_dia.ubicacion',
                'pernocta_dia.categoria',
                'pernocta_dia.nombre',
                'pernocta_dia.observaciones',
                'pernocta_dia.created_at',
            ])
            ->when(
                !empty($validated['desde']),
                function ($query) use ($validated) {
                    $query->whereDate(
                        'pernocta_dia.fecha',
                        '>=',
                        $validated['desde']
                    );
                }
            )
            ->when(
                !empty($validated['hasta']),
                function ($query) use ($validated) {
                    $query->whereDate(
                        'pernocta_dia.fecha',
                        '<=',
                        $validated['hasta']
                    );
                }
            )
            ->when(
                !empty($validated['matricula']),
                function ($query) use ($validated) {
                    $query->where(
                        'pernocta_dia.matricula',
                        'like',
                        '%' . trim($validated['matricula']) . '%'
                    );
                }
            )
            ->when(
                !empty($validated['ubicacion']),
                function ($query) use ($validated) {
                    $query->where(
                        'pernocta_dia.ubicacion',
                        $validated['ubicacion']
                    );
                }
            )
            ->when(
                !empty($validated['responsable']),
                function ($query) use ($validated) {
                    $query->where(
                        'pernocta_dia.nombre',
                        'like',
                        '%' . trim($validated['responsable']) . '%'
                    );
                }
            )
            ->orderBy('pernocta_dia.fecha')
            ->orderBy('pernocta_dia.created_at')
            ->orderBy('pernocta_dia.matricula');

        // Las tablas del catálogo de facturación no tienen migración en esta rama: sus
        // migraciones viven en la rama `facturacion`, sin fusionar, y existen en la base
        // de desarrollo porque se importó un volcado. Unirlas a ciegas dejaría el Excel
        // de Pernocta del Día sin funcionar donde no están, que es mucho peor que el
        // «SIN DATO» que esto viene a resolver.
        $hayCatalogo = Schema::hasTable('fact_aeronaves')
            && Schema::hasTable('fact_categorias_aeronave');

        if ($hayCatalogo) {
            $query
                ->leftJoin('aeronaves', function ($join) {
                    $join->on(
                        DB::raw('upper(trim(aeronaves.matricula))'),
                        '=',
                        DB::raw('upper(trim(pernocta_dia.matricula))')
                    );
                })
                ->leftJoin(
                    'fact_aeronaves',
                    'fact_aeronaves.aeronave_id',
                    '=',
                    'aeronaves.id'
                )
                ->leftJoin(
                    'fact_categorias_aeronave',
                    'fact_categorias_aeronave.id',
                    '=',
                    'fact_aeronaves.categoria_aeronave_id'
                )
                ->addSelect([
                    DB::raw('fact_categorias_aeronave.nombre as categoria_catalogo'),
                    DB::raw('fact_aeronaves.estatus as estatus_catalogo'),
                ]);
        }

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
                'estatus' => $this->conRespaldoDelCatalogo(
                    $registro->estatus,
                    $registro->estatus_catalogo ?? null,
                    true
                ),
                'ubicacion' => $registro->ubicacion,
                'categoria' => $this->conRespaldoDelCatalogo(
                    $registro->categoria,
                    $registro->categoria_catalogo ?? null,
                    false
                ),
                'nombre' => $registro->nombre,
                'observaciones' => $registro->observaciones,
            ];
        });

        return response()->json([
            'data' => $rows,
            'total' => $rows->count(),
        ]);
    }

    /**
     * El valor capturado en la pernocta manda; si viene vacío, se hereda del catálogo de
     * facturación. Una cadena de solo espacios cuenta como vacía, igual que la trata el
     * Excel del cliente, que descarta lo que quede vacío tras recortar.
     */
    private function conRespaldoDelCatalogo(
        ?string $propio,
        ?string $catalogo,
        bool $capitalizar
    ): ?string {
        $propio = trim((string) $propio);

        if ($propio !== '') {
            return $propio;
        }

        $catalogo = trim((string) $catalogo);

        if ($catalogo === '') {
            return null;
        }

        // El catálogo guarda `transito`/`guarda` en minúsculas y la pernocta `Transito`.
        // Sin igualarlos, el Excel agrupa por matrícula y uniría los dos con « / ».
        return $capitalizar
            ? Str::ucfirst(Str::lower($catalogo))
            : $catalogo;
    }
}
