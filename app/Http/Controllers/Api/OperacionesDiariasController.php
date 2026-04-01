<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\OperacionDiaria;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;

class OperacionesDiariasController extends Controller
{
    public function store(Request $request)
    {

        $validated = $request->validate([
            'fecha'        => ['required', 'date'],
            'movimiento'   => ['required', 'in:Llegada,Salida'],
            'matricula'    => ['required', 'string', 'max:20'],
            'equipo'       => ['required', 'string', 'max:50'],
            'hora'         => ['required', 'date_format:H:i'],
            'pax'          => ['required', 'integer', 'min:0'],
            'departamento' => ['required', 'string'],
            'procedencia'  => ['nullable', 'string', 'max:100'],
            'equipaje'     => ['nullable','integer'],
            'observaciones'=> ['nullable','string'],
            'destino'      => ['nullable', 'string', 'max:100'],
            'tipo_cliente' => ['nullable', 'string', 'max:100'],
            'tipo_operacion' => ['nullable', 'string', 'max:100'],
            'nombre'       => ['nullable', 'string', 'max:100'],
            'impulso'      => ['nullable', 'string', 'max:100'],
        ]);
        return DB::transaction(function () use ($validated, $request) {
            $ver = OperacionDiaria::where('matricula', $validated['matricula'])
                                    ->where('tipo', $validated['movimiento'])
                                    ->first();

            if ($ver) {
                return response()->json([
                    'message' => 'ya hay un registro de esta matricula',
                    'data' => null,
                ], 422);
            }
            $tipoExistente = DB::connection('remota')
                    ->table('tb_tipo')
                    ->where('tipo', $validated['equipo'])
                    ->first();

            if (!$tipoExistente) {
                $idTipo = DB::connection('remota')->table('tb_tipo')->insertGetId([
                    'tipo' => $validated['equipo']
                ]);
            } else {
                $idTipo = $tipoExistente->id_tipo;
            }
            $infoMatricula = DB::connection('remota')
                    ->table('tb_matricula as m')
                    ->where('m.matricula', $validated['matricula'])
                    ->first();

            if (!$infoMatricula) {
                DB::connection('remota')->table('tb_matricula')->insert([
                    'matricula'      => $validated['matricula'],
                    'id_estatus'     => 1,
                    'id_tipo'        => $idTipo,
                    'id_categoria'   => 0,
                    'id_motor'       => 0,
                    'id_aterrizaje'  => 0,
                    'id_transito2h'  => 0,
                    'id_transito12h' => 0,
                    'id_pernocta'    => 0,
                    'd_vuelos'       => 0,
                ]);
            }
            $operacion = OperacionDiaria::create([
                'user_id'      => Auth::id(),
                'fecha'        => $validated['fecha'],
                'tipo'         => strtolower($validated['movimiento']),
                'matricula'    => $validated['matricula'],
                'equipo'       => $validated['equipo'],
                'hora'         => $validated['hora'],
                'lugar'        => $request->procedencia ?? $request->destino,
                'pax'          => $validated['pax'],
                'departamento' => $validated['departamento'],
                'equipaje'     => $validated['equipaje'],
                'observaciones'=> $validated['observaciones'],
                'validaciones' => [$validated['departamento']],
                'impulso'      => $validated['impulso'],
                'nombre'       => $validated['nombre'],
                'tipo_cliente' => $validated['tipo_cliente'],
                'tipo_operacion' => $validated['tipo_operacion'],
            ]);
            return response()->json([
                'message'   => 'Operación guardada correctamente',
                'operacion' => $operacion,
            ], 201);
        });
    }

    public function index(Request $request)
    {
        $query = OperacionDiaria::with('user');

        if ($request->filled('buscar')) {
            $query->where('matricula', 'LIKE', '%' . $request->buscar . '%');
        }

        if ($request->filled('tipo')) {
            $query->where('tipo', $request->tipo);
        }

        if ($request->filled('fechaInicio') && $request->filled('fechaFin')) {
            $query->whereBetween('fecha', [$request->fechaInicio, $request->fechaFin]);
        } elseif ($request->filled('fechaInicio')) {
            $query->whereDate('fecha', $request->fechaInicio);
        }

        if ($request->filled('lugar')) {
            $query->where('lugar', 'LIKE', '%' . $request->lugar . '%');
        }

        if ($request->filled('tipo_operacion')) {
            $query->where('tipo_operacion', $request->tipo_operacion);
        }

        if ($request->filled('pax')) {
            $query->where(function ($q) use ($request) {
                $q->where('pax', $request->pax);

                if ($request->pax == 0) {
                    $q->orWhereNull('pax')
                    ->orWhere('pax', '');
                }
            });
        }

        if ($request->filled('eqp')) {
            $query->where(function ($q) use ($request) {
                $q->where('equipaje', $request->eqp);

                if ($request->eqp == 0) {
                    $q->orWhereNull('equipaje')
                    ->orWhere('equipaje', '');
                }
            });
        }

        if ($request->filled('cliente')) {
            $query->where('tipo_cliente', $request->cliente);
        }

        $registros = $query->orderBy('fecha', 'desc')
                        ->orderBy('hora', 'desc')
                        ->paginate(20);

        return response()->json($registros);
    }
    public function obtenerExcel(Request $request)
    {
        $query = OperacionDiaria::with('user');

        if ($request->filled('buscar')) {
            $query->where('matricula', 'LIKE', '%' . $request->buscar . '%');
        }

        if ($request->filled('tipo')) {
            $query->where('tipo', $request->tipo);
        }

        if ($request->filled('fechaInicio') && $request->filled('fechaFin')) {
            $query->whereBetween('fecha', [$request->fechaInicio, $request->fechaFin]);
        } elseif ($request->filled('fechaInicio')) {
            $query->whereDate('fecha', $request->fechaInicio);
        }

        if ($request->filled('lugar')) {
            $query->where('lugar', 'LIKE', '%' . $request->lugar . '%');
        }

        if ($request->filled('tipo_operacion')) {
            $query->where('tipo_operacion', $request->tipo_operacion);
        }

        if ($request->filled('pax')) {
            $query->where(function ($q) use ($request) {
                $q->where('pax', $request->pax);

                if ($request->pax == 0) {
                    $q->orWhereNull('pax')
                    ->orWhere('pax', '');
                }
            });
        }

        if ($request->filled('eqp')) {
            $query->where(function ($q) use ($request) {
                $q->where('equipaje', $request->eqp);

                if ($request->eqp == 0) {
                    $q->orWhereNull('equipaje')
                    ->orWhere('equipaje', '');
                }
            });
        }

        if ($request->filled('cliente')) {
            $query->where('tipo_cliente', $request->cliente);
        }

        $registros = $query->orderBy('fecha', 'desc')
                        ->orderBy('hora', 'desc')
                        ->get();

        return response()->json($registros);
    }

    public function update(Request $request, $id)
    {
        $operacion = OperacionDiaria::findOrFail($id);

        $validaciones = $operacion->validaciones ?? [];

        $valorAValidar = ($request->nombreRol === 'FBO') ? $request->nombreRol : $request->departamento;

        if ($valorAValidar) {
            $validaciones[] = $valorAValidar;
        }

        $validaciones = array_values(array_unique($validaciones));

        $operacion->update([
            'matricula'      => $request->matricula,
            'equipo'         => $request->equipo,
            'hora'           => $request->hora,
            'lugar'          => $request->procedencia ?? $request->destino,
            'pax'            => $request->pax,
            'fecha'          => $request->fecha,
            'validaciones'   => $validaciones, // Array actualizado
            'equipaje'       => $request->equipaje,
            'observaciones'  => $request->observaciones,
            'tipo_cliente'   => $request->tipo_cliente,
            'tipo_operacion' => $request->tipo_operacion,
            'nombre'         => $request->nombre,
            'impulso'        => $request->impulso,
        ]);

        return response()->json($operacion);
    }
    public function buscarPorMatricula(string $matricula): JsonResponse
    {
        try {
            $infoMatricula = DB::connection('remota')
                ->table('tb_matricula as m')
                ->leftJoin('tb_estatus as e', 'e.id_estatus', '=', 'm.id_estatus')
                ->leftJoin('tb_tipo as t', 't.id_tipo', '=', 'm.id_tipo')
                ->leftJoin('tb_categoria as c', 'c.id_categoria', '=', 'm.id_categoria')
                ->where('m.matricula', $matricula)
                ->select(
                    't.tipo',
                )
                ->first();
            return response()->json($infoMatricula);

        } catch (\Throwable $e) {
            \Log::error('Error al buscar aeronave: ' . $e->getMessage());
            return response()->json(['error' => 'Error interno del servidor'], 500);
        }
    }
    public function autocomplete(Request $request): JsonResponse
    {
        try {
            $q = trim($request->query('q', ''));

            if ($q === '') {
                return response()->json([]);
            }

            $matriculas = DB::connection('remota')
                ->table('tb_matricula')
                ->where('matricula', 'like', '%' . strtoupper($q) . '%')
                ->limit(10)
                ->select('matricula')
                ->get();

            if (empty($matriculas)) {
                return response()->json([]);
            }


            $result = collect($matriculas)->map(function ($matricula) {
                return [
                    'matricula'  => $matricula,
                ];
            })->values();

            return response()->json($result);

        } catch (\Throwable $e) {
            Log::error('Autocomplete Error', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([]);
        }
    }
    public function verificarExistente(Request $request)
    {
        $request->validate([
            'matricula' => 'required|string',
            'fecha' => 'required|date',
            'tipo' => 'required|string',
            'modulo' => 'required|string'
        ]);

        $operacion = OperacionDiaria::where('matricula', $request->matricula)
            ->where('fecha', $request->fecha)
            ->where('tipo', $request->tipo)
            ->first();

        if ($operacion) {
            $yaValidadoPorMi = collect($operacion->validaciones ?? [])->contains($request->modulo);
            if ($yaValidadoPorMi) {
                return response()->json(['existe' => false]);
            }
            return response()->json([
                'existe' => true,
                'operacion' => $operacion,
                'message' => "Registro encontrado. Falta validación de {$request->modulo}."
            ]);
        }

        return response()->json(['existe' => false]);
    }
    public function obtenerNombresPorMatricula(string $matricula): JsonResponse
    {
        $nombres = OperacionDiaria::where('matricula', $matricula)
            ->whereNotNull('nombre')
            ->where('nombre', '!=', '')
            ->select(DB::raw('DISTINCT UPPER(TRIM(nombre)) as nombre_limpio'))
            ->pluck('nombre_limpio');

        return response()->json($nombres);
    }
}
