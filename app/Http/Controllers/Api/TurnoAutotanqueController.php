<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\TurnoAutotanque;

use App\Models\Remision;
use App\Models\SumaAutotanque;

use Illuminate\Support\Facades\DB;
use Exception;
use Illuminate\Support\Facades\Auth;

class TurnoAutotanqueController extends Controller
{
    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'id'                        => 'nullable|integer',
                'nombre'                    => 'required|string',
                'fecha'                     => 'required|date',
                'cmIni'                     => 'required|numeric',
                'litrosIni'                 => 'required|numeric',
                'totalizadorIni'            => 'required|numeric',
                'resumen.totalVendidos'     => 'required|numeric',
                'resumen.balanceAritmetico' => 'required|numeric',
                'resumen.balanceFisico'     => 'required|numeric',
                'resumen.diferenciaFinal'   => 'required|numeric',
                'remisiones'                => 'present|array',
                'entradasASA'               => 'present|array',
            ]);

            $turno = DB::transaction(function () use ($validated, $request) {
                $turno = TurnoAutotanque::updateOrCreate(
                    ['id' => $request->id],
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

                if (!empty($request->remisiones)) {
                    $folios = collect($request->remisiones)->pluck('folio');
                    Remision::whereIn('folio', $folios)
                        ->update(['id_turno' => $turno->id]);
                }

                SumaAutotanque::where('id_turno', $turno->id)->delete();

                foreach ($request->entradasASA as $entrada) {
                    SumaAutotanque::create([
                        'id_turno' => $turno->id,
                        'litros'   => $entrada['litros'],
                        'folio'    => $entrada['remision'],
                    ]);
                }

                return $turno;
            });

            return response()->json([
                'message' => $request->id ? 'Turno actualizado correctamente' : 'Turno creado correctamente',
                'data' => $turno
            ], 201);

        } catch (\Exception $e) {
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
                        ->orWhere('nombreCierre','')
                        ->orWhere('fechaCierre','')
                        ->orWhere('cmCierre',0)
                        ->orWhere('litrosCierre',0)
                        ->orWhere('totalizadorCierre',0);
                })
                ->latest()
                ->first();

            $remision = Remision::where('id_turno', $turnoActivo->id)->get();
            $sumaAutotanque = SumaAutotanque::where('id_turno', $turnoActivo->id)->get();
            if (!$turnoActivo) {
                return response()->json(['active' => false]);
            }

            return response()->json([
                'active' => true,
                'data' => [
                    'turno' => $turnoActivo,
                    'remision' => $remision,
                    'sumaAutotanque' => $sumaAutotanque,
                ],
            ]);

        } catch (Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
    public function getLastTotalizador()
    {
        $ultimoTurno = TurnoAutotanque::latest('id')->first();

        return response()->json([
            'totalizador' => $ultimoTurno ? $ultimoTurno->totalizadorCierre : null
        ]);
    }
    public function cancelarRemision(Request $request, $folio)
    {
        try {
            $remision = \App\Models\Remision::where('id', $folio)->first();

            if (!$remision) {
                return response()->json(['error' => 'Remisión no encontrada: ' . $folio], 404);
            }
            $remision->update(['status' => 'N']);

            return response()->json([
                'message' => 'Remisión cancelada correctamente',
                'folio'   => $folio
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'No se pudo cancelar la remisión',
                'details' => $e->getMessage()
            ], 500);
        }
    }
    public function index(Request $request)
    {
        $search = $request->query('search');
        $fecha  = $request->query('date');
        $perPage = $request->query('per_page', 10);

        $turnos = TurnoAutotanque::query()
            // Cargamos la relación para verificar la inspección
            ->with('inspeccion:id,turno_autotanque_id')
            ->when($search, function ($query, $search) {
                $query->where(function($q) use ($search) {
                    $q->where('nombre', 'like', "%{$search}%")
                    ->orWhere('nombreCierre', 'like', "%{$search}%");
                });
            })
            ->when($fecha, function ($query, $fecha) {
                $query->whereDate('fecha', $fecha);
            })
            ->where('status', 'A')
            ->orderBy('id', 'desc')
            ->paginate($perPage);

        $turnos->getCollection()->transform(function ($turno) {
            // 1. Verificación de Inspección (la que ya tenías)
            $turno->tiene_inspeccion = $turno->inspeccion !== null;
            unset($turno->inspeccion);

            // 2. Verificación de Finalizado
            // Comprobamos que todos los campos requeridos para el cierre tengan contenido
            $turno->finalizado = !empty($turno->nombreCierre) &&
                                !empty($turno->fechaCierre) &&
                                $turno->cmCierre !== null &&
                                $turno->litrosCierre !== null &&
                                $turno->totalizadorCierre !== null;

            return $turno;
        });

        return response()->json($turnos);
    }
    public function show($id)
    {
        $turno = TurnoAutotanque::with('inspeccion')
            ->where('id', $id)
            ->first();

        if (!$turno) {
            return response()->json(['message' => 'Registro no encontrado'], 404);
        }

        $remision = Remision::where('id_turno', $id)->get();
        $sumaAutotanque = SumaAutotanque::where('id_turno', $id)->get();

        return response()->json([
            'message' => 'Se encontró el registro',
            'data' => [
                'turno'          => $turno,
                'remision'       => $remision,
                'sumaAutotanque' => $sumaAutotanque,
                'inspeccion'     => $turno->inspeccion,
            ],
        ]);
    }
    public function eliminar($id)
    {
        try {
            $autotanque = TurnoAutotanque::with('inspeccion')->find($id);

            if (!$autotanque) {
                return response()->json([
                    'message' => 'El registro no existe.'
                ], 404);
            }

            DB::transaction(function () use ($autotanque, $id) {
                $autotanque->update([
                    'status' => 'N'
                ]);
                Remision::where('id_turno', $id)->update([
                    'status' => 'N'
                ]);
                if ($autotanque->inspeccion) {
                    $autotanque->inspeccion->update([
                        'status' => 'N'
                    ]);
                }
            });

            return response()->json([
                'message' => 'Registro, remisiones e inspección cancelados correctamente',
                'data' => $autotanque
            ]);

        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Error al intentar eliminar el registro',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
