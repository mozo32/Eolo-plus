<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\TurnoAutotanque;
use Illuminate\Support\Facades\DB;
use Exception;
use Illuminate\Support\Facades\Auth;

class TurnoAutotanqueController extends Controller
{
    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'id'                => 'nullable|integer',
                'nombre'            => 'required|string',
                'fecha'             => 'required|date',
                'cmIni'             => 'required|numeric',
                'litrosIni'         => 'required|numeric',
                'totalizadorIni'    => 'required|numeric',
                'resumen.totalVendidos'     => 'required|numeric',
                'resumen.balanceAritmetico' => 'required|numeric',
                'resumen.balanceFisico'     => 'required|numeric',
                'resumen.diferenciaFinal'   => 'required|numeric',
            ]);

            $turno = DB::transaction(function () use ($validated, $request) {
                return TurnoAutotanque::updateOrCreate(
                    ['id'      => $request->id],
                    [
                        'user_id'           => Auth::id(),
                        'nombre'            => $validated['nombre'],
                        'fecha'             => $validated['fecha'],
                        'cmIni'             => $validated['cmIni'],
                        'litrosIni'         => $validated['litrosIni'],
                        'totalizadorIni'    => $validated['totalizadorIni'],
                        'nombreCierre'      => $request->nombreCierre ?? '',
                        'fechaCierre'       => $request->fechaCierre ?? now(),
                        'cmCierre'          => $request->cmCierre ?? 0,
                        'litrosCierre'      => $request->litrosCierre ?? 0,
                        'totalizadorCierre' => $request->totalizadorCierre ?? 0,
                        'totalVendidos'     => $validated['resumen']['totalVendidos'],
                        'balanceAritmetico' => $validated['resumen']['balanceAritmetico'],
                        'balanceFisico'     => $validated['resumen']['balanceFisico'],
                        'diferenciaFinal'   => $validated['resumen']['diferenciaFinal'],
                    ]
                );
            });

            return response()->json([
                'message' => $request->id ? 'Turno actualizado' : 'Turno creado',
                'data' => $turno
            ], 201);

        } catch (Exception $e) {
            return response()->json([
                'message' => 'Error al procesar el turno',
                'error' => $e->getMessage()
            ], 500);
        }
    }
    public function checkActiveTurno()
    {
        try {
            $turnoActivo = TurnoAutotanque::where(function($query) {
                    $query->whereNull('totalizadorCierre')
                        ->orWhere('totalizadorCierre', 0);
                })
                ->latest()
                ->first();

            if (!$turnoActivo) {
                return response()->json(['active' => false]);
            }

            return response()->json([
                'active' => true,
                'turno' => $turnoActivo
            ]);

        } catch (Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}
