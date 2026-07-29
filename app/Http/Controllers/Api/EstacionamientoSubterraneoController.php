<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\EstacionamientoSubterraneo;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class EstacionamientoSubterraneoController extends Controller
{
    public function index(Request $request)
    {
        $mes = $request->query('mes');
        $anio = $request->query('anio');

        $query = EstacionamientoSubterraneo::selectRaw("
                DISTINCT(DATE_FORMAT(fecha_ingreso, '%Y-%m-01')) as mes_completo
            ");

        $query->when($anio, function ($q) use ($anio) {
            return $q->whereYear('fecha_ingreso', $anio);
        });
        $query->when($mes, function ($q) use ($mes) {
            return $q->whereMonth('fecha_ingreso', $mes);
        });

        $meses = $query->orderBy('mes_completo', 'desc')
            ->get()
            ->map(function ($item) {
                return [
                    'valor' => \Carbon\Carbon::parse($item->mes_completo)->format('Y-m'),
                    'label' => \Carbon\Carbon::parse($item->mes_completo)
                                ->locale('es')
                                ->isoFormat('MMMM YYYY')
                ];
            });

        return response()->json($meses);
    }

    public function store(Request $request)
    {
        $request->validate([
            'vehiculos' => 'required|array',
            'vehiculos.*.placas' => 'required|string',
            'oficial' => 'required|string'
        ]);

        $oficial = $request->oficial;
        $userId = Auth::id();
        $registrados = 0;
        $fecha = $request->fecha_ingreso;

        foreach ($request->vehiculos as $item) {
            $ultimo = EstacionamientoSubterraneo::where('placas', $item['placas'])
                ->latest()
                ->first();
            EstacionamientoSubterraneo::create([
                'placas'      => strtoupper($item['placas']),
                'vehiculo'    => $item['vehiculo'] ?? ($ultimo->vehiculo ?? 'N/A'),
                'color'       => $item['color'] ?? ($ultimo->color ?? 'N/A'),
                'responsable' => $item['responsable'] ?? ($ultimo->responsable ?? 'N/A'),
                'matricula'   => $item['matricula'] ?? ($ultimo->matricula ?? 'N/A'),
                'llaves'      => $item['llaves'] ?? ($ultimo->llaves ?? 'N/A'),
                'fecha_ingreso' => $fecha,
                'oficial'     => $oficial,
                'user_id'     => $userId,
            ]);

            $registrados++;
        }

        return response()->json([
            'message' => "Ronda completada: $registrados vehículos registrados correctamente."
        ]);
    }

    public function show($fecha)
    {
        $registros = EstacionamientoSubterraneo::whereRaw("DATE_FORMAT(fecha_ingreso, '%Y-%m') = ?", [$fecha])
            ->select('placas', 'vehiculo', 'matricula')
            ->selectRaw("GROUP_CONCAT(DISTINCT DAY(fecha_ingreso)) as dias_asistencia")
            ->groupBy('placas', 'vehiculo', 'matricula')
            ->get()
            ->map(function ($item) {
                return [
                    'id' => $item->placas,
                    'nombre' => $item->vehiculo,
                    'matricula' => $item->matricula,
                    'asistencias' => array_map('intval', explode(',', $item->dias_asistencia))
                ];
            });

        return response()->json($registros);
    }
    public function buscarPlacas(Request $request)
    {
        $term = $request->query('q');
        if (!$term) return response()->json([]);

        $placas = EstacionamientoSubterraneo::where('placas', 'LIKE', "%{$term}%")
            ->select('placas') // Solo traemos la placa
            ->distinct()
            ->limit(10)
            ->get();

        return response()->json($placas);
    }

    public function vehiculosMasDeCincoDias(Request $request)
    {
        $request->validate([
            'fecha' => 'nullable|date',
        ]);

        $fechaCorte = $request->filled('fecha')
            ? Carbon::parse($request->query('fecha'))->toDateString()
            : Carbon::today()->toDateString();

        if ($fechaCorte) {
            $fechaCorte = Carbon::parse($fechaCorte)->toDateString();
        } else {
            $ultimoRegistro = EstacionamientoSubterraneo::max('fecha_ingreso');

            if (!$ultimoRegistro) {
                return response()->json([
                    'fecha_corte' => null,
                    'total' => 0,
                    'vehiculos' => [],
                ]);
            }

            $fechaCorte = Carbon::parse($ultimoRegistro)->toDateString();
        }

        $vehiculos = DB::select("
            WITH registros_diarios AS (
                SELECT
                    UPPER(placas) AS placas,
                    DATE(fecha_ingreso) AS fecha_registro
                FROM estacionamiento_subterraneos
                WHERE DATE(fecha_ingreso) <= ?
                GROUP BY
                    UPPER(placas),
                    DATE(fecha_ingreso)
            ),

            registros_numerados AS (
                SELECT
                    placas,
                    fecha_registro,
                    DATEDIFF(fecha_registro, '2000-01-01')
                        - ROW_NUMBER() OVER (
                            PARTITION BY placas
                            ORDER BY fecha_registro
                        ) AS grupo_racha
                FROM registros_diarios
            ),

            rachas AS (
                SELECT
                    placas,
                    MIN(fecha_registro) AS fecha_inicio,
                    MAX(fecha_registro) AS fecha_ultimo_registro,
                    COUNT(*) AS dias_estacionado
                FROM registros_numerados
                GROUP BY
                    placas,
                    grupo_racha
            ),

            rachas_actuales AS (
                SELECT
                    placas,
                    fecha_inicio,
                    fecha_ultimo_registro,
                    dias_estacionado
                FROM rachas
                WHERE fecha_ultimo_registro = ?
                AND dias_estacionado > 5
            ),

            ultimo_registro_del_dia AS (
                SELECT
                    UPPER(placas) AS placas,
                    MAX(id) AS ultimo_id
                FROM estacionamiento_subterraneos
                WHERE DATE(fecha_ingreso) = ?
                GROUP BY UPPER(placas)
            )

            SELECT
                es.id,
                UPPER(es.placas) AS placas,
                es.vehiculo,
                es.color,
                es.responsable,
                es.matricula,
                es.llaves,
                es.oficial,
                ra.fecha_inicio,
                ra.fecha_ultimo_registro,
                ra.dias_estacionado
            FROM rachas_actuales AS ra

            INNER JOIN ultimo_registro_del_dia AS ultimo
                ON ultimo.placas = ra.placas

            INNER JOIN estacionamiento_subterraneos AS es
                ON es.id = ultimo.ultimo_id

            ORDER BY
                ra.dias_estacionado DESC,
                es.placas ASC
        ", [
            $fechaCorte,
            $fechaCorte,
            $fechaCorte,
        ]);

        return response()->json([
            'fecha_corte' => $fechaCorte,
            'total' => count($vehiculos),
            'vehiculos' => $vehiculos,
        ]);
    }
    public function detallePorPlaca($placa)
    {
        $registros = EstacionamientoSubterraneo::where('placas', $placa)
            ->select('vehiculo', 'color', 'responsable', 'matricula', 'llaves')
            ->latest()
            ->limit(3)
            ->get();

        return response()->json($registros);
    }

}
