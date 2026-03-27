<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\EstacionamientoSubterraneo;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Auth;

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

    // 2. Detalle de la placa (Trae registros previos para sugerir datos)
    public function detallePorPlaca($placa)
    {
        $registros = EstacionamientoSubterraneo::where('placas', $placa)
            ->select('vehiculo', 'color', 'responsable', 'matricula', 'llaves')
            ->latest() // Trae los más recientes primero
            ->limit(3) // Traemos los últimos 3 responsables/configuraciones diferentes
            ->get();

        return response()->json($registros);
    }

}
