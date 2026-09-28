<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\Aeronave;
use App\Models\WalkAround;
use App\Services\CatalogoAeronaves;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
class AeronaveController extends Controller
{
    public function __construct(private readonly CatalogoAeronaves $catalogo) {}

    public function buscarPorMatricula(string $matricula): JsonResponse
    {
        try {
            $aeronave = Aeronave::where('matricula', $matricula)->first();

            $ultimoWalk = WalkAround::where('matricula', $matricula)
                ->orderByDesc('fecha')
                ->orderByDesc('hora')
                ->first();

            $datos = $this->catalogo->buscar($matricula);

            return response()->json([
                'matricula'      => $aeronave->matricula ?? $matricula,
                'destino'        => $ultimoWalk->destino ?? null,
                'procedensia'    => $ultimoWalk->procedensia ?? null,
                'idTipoAeronave' => $aeronave->aeronave_id ?? ($ultimoWalk->tipo_aeronave_id ?? null),
                'movimiento'     => $ultimoWalk->movimiento ?? null,
                'tipo_aeronave'  => $aeronave->tipo_aeronave ?? ($ultimoWalk->tipo ?? null),
                'tipo'           => $datos?->tipo,
                'categoria'      => $datos?->categoria,
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

            $matriculas = $this->catalogo->autocompletar($q);

            if (empty($matriculas)) {
                return response()->json([]);
            }

            $walkarounds = DB::table('walk_arounds as wa')
                ->select('wa.matricula', 'wa.movimiento')
                ->whereIn('wa.matricula', $matriculas)
                ->where('wa.status', 'A')
                ->where('wa.id', function($sub) {
                    $sub->select('id')
                        ->from('walk_arounds')
                        ->whereColumn('matricula', 'wa.matricula')
                        ->where('status', 'A')
                        ->orderByDesc('fecha')
                        ->orderByDesc('hora')
                        ->limit(1);
                })
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

    public function tipoAeronave(string $matricula)
    {
        $datos = $this->catalogo->buscar($matricula);

        return response()->json($datos ? ['tipo' => $datos->tipo] : null);
    }
}
