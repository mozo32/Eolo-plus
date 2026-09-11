<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\OperacionPantallaResource;
use App\Models\OperacionProgramada;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

/**
 * Lectura pública para la televisión. Es un controlador aparte a propósito: el
 * administrativo sigue completo detrás de la autenticación y aquí no existe
 * ninguna acción de escritura.
 *
 * No acepta fecha: siempre es el día local de hoy, calculado en el servidor.
 */
class PantallaProgramadasController extends Controller
{
    public function index(): JsonResponse
    {
        $hoy = Carbon::now(config('app.timezone'))->toDateString();

        $operaciones = OperacionProgramada::query()
            ->activas()
            ->whereDate('fecha', $hoy)
            ->orderBy('hora')
            ->orderBy('id')
            ->get();

        return response()->json([
            'fecha' => $hoy,
            'salidas' => OperacionPantallaResource::collection($operaciones->where('tipo', 'salida')->values()),
            'llegadas' => OperacionPantallaResource::collection($operaciones->where('tipo', 'llegada')->values()),
        ]);
    }
}
