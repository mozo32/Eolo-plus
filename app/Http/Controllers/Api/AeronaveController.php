<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\Aeronave;
use App\Models\WalkAround;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;

class AeronaveController extends Controller
{
    public function buscarPorMatricula(string $matricula): JsonResponse
    {
        try {
            $aeronave = Aeronave::where('matricula', $matricula)->first();

            $ultimoWalk = WalkAround::where('matricula', $matricula)
                ->latest('id')
                ->first();

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
            return response()->json([
                'matricula'      => $aeronave->matricula ?? $matricula,
                'destino'        => $ultimoWalk->destino ?? null,
                'procedensia'    => $ultimoWalk->procedensia ?? null,
                'idTipoAeronave' => $aeronave->aeronave_id ?? ($ultimoWalk->tipo_aeronave_id ?? null),
                'movimiento'     => $ultimoWalk->movimiento ?? null,
                'tipo_aeronave'  => $aeronave->tipo_aeronave ?? ($ultimoWalk->tipo ?? null),
                'tipo_aeronave'  => $infoMatricula->tipo ?? null,
            ]);

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

            $walkarounds = DB::table('walk_arounds as wa')
                ->select('wa.matricula', 'wa.movimiento')
                ->whereIn('wa.matricula', $matriculas)
                ->where('wa.status', 'A')
                ->whereRaw('wa.id = (
                    select max(id)
                    from walk_arounds
                    where walk_arounds.matricula = wa.matricula
                    and walk_arounds.status = "A"
                )')
                ->get()
                ->keyBy('matricula');

            $result = collect($matriculas)->map(function ($matricula) use ($walkarounds) {
                return [
                    'matricula'  => $matricula,
                    'movimiento' => $walkarounds[$matricula]->movimiento ?? null,
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

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'matricula'    => ['required', 'string', 'max:50', 'unique:aeronaves,matricula'],
            'tipo'         => ['required', 'string', 'max:100'],
            'tipoAeronave' => ['required', 'integer', 'exists:tipo_aeronaves,id'],
        ]);
        $aeronave = Aeronave::create([
            'matricula'       => $validated['matricula'],
            'aeronave_id'            => $validated['tipoAeronave'],
            'tipo_aeronave'   => $validated['tipo'],
        ]);

        return response()->json($aeronave, 201);
    }
}
