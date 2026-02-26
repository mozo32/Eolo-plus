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
            'nombre'       => ['nullable', 'string', 'max:100'],
            'impulso'      => ['nullable', 'string', 'max:100'],
        ]);

        $ver = OperacionDiaria::where('matricula', $validated['matricula'])
                                ->where('tipo', $validated['movimiento'])
                                ->first();

        // if ($ver) {
        //     return response()->json([
        //         'message' => 'ya hay un registro de esta matricula',
        //         'data' => null,
        //     ], 422);
        // }
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
        ]);

        return response()->json([
            'message'   => 'Operación guardada correctamente',
            'operacion' => $operacion,
        ], 201);
    }

    public function index(Request $request)
    {
        $query = OperacionDiaria::with('user');
        if ($request->has('buscar') && $request->buscar != '') {
            $query->where('matricula', 'LIKE', '%' . $request->buscar . '%');
        }
        if ($request->has('tipo') && $request->tipo != '') {
            $query->where('tipo', $request->tipo);
        }
        if ($request->has('fecha') && $request->fecha != '') {
            $query->whereDate('created_at', $request->fecha);
        }
        $registros = $query->orderBy('fecha', 'desc')
                   ->orderBy('hora', 'desc')
                   ->paginate(100);

        return response()->json($registros);
    }

    public function update(Request $request, $id)
    {
        $operacion = OperacionDiaria::findOrFail($id);

        $validaciones = $operacion->validaciones ?? [];

        if ($request->departamento) {
            $validaciones[] = $request->departamento;
        }

        $validaciones = array_unique($validaciones);

        $operacion->update([
            'matricula'    => $request->matricula,
            'equipo'       => $request->equipo,
            'hora'         => $request->hora,
            'lugar'        => $request->procedencia ?? $request->destino,
            'pax'          => $request->pax,
            'fecha'        => $request->fecha,
            'validaciones' => array_values($validaciones),
            'equipaje'     => $request->equipaje,
            'observaciones'=> $request->observaciones,
            'tipo_cliente' => $request->tipo_cliente,
            'nombre'       => $request->nombre,
            'impulso'      => $request->impulso,
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
                ->pluck('matricula')
                ->toArray();

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
}
