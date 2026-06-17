<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bitacora;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BitacoraController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'q' => ['nullable', 'string', 'max:150'],
            'modulo' => ['nullable', 'string', 'max:100'],
            'accion' => ['nullable', 'string', 'max:50'],
            'usuario_id' => [
                'nullable',
                'integer',
                'exists:users,id',
            ],
            'desde' => ['nullable', 'date'],
            'hasta' => [
                'nullable',
                'date',
                'after_or_equal:desde',
            ],
            'per_page' => [
                'nullable',
                'integer',
                'min:5',
                'max:100',
            ],
            'page' => [
                'nullable',
                'integer',
                'min:1',
            ],
        ]);

        $perPage = (int) ($datos['per_page'] ?? 20);

        $query = Bitacora::query()
            ->with([
                'usuario:id,name,email',
            ]);

        if (!empty($datos['q'])) {
            $texto = trim($datos['q']);

            $query->where(function ($subQuery) use ($texto) {
                $subQuery
                    ->where('modulo', 'like', "%{$texto}%")
                    ->orWhere('accion', 'like', "%{$texto}%")
                    ->orWhere('descripcion', 'like', "%{$texto}%")
                    ->orWhere('elabora', 'like', "%{$texto}%")
                    ->orWhereHas(
                        'usuario',
                        function ($usuarioQuery) use ($texto) {
                            $usuarioQuery
                                ->where('name', 'like', "%{$texto}%")
                                ->orWhere(
                                    'email',
                                    'like',
                                    "%{$texto}%"
                                );
                        }
                    );
            });
        }

        if (!empty($datos['modulo'])) {
            $query->where(
                'modulo',
                strtoupper(trim($datos['modulo']))
            );
        }

        if (!empty($datos['accion'])) {
            $query->where(
                'accion',
                strtoupper(trim($datos['accion']))
            );
        }

        if (!empty($datos['usuario_id'])) {
            $query->where(
                'usuario_id',
                $datos['usuario_id']
            );
        }

        if (!empty($datos['desde'])) {
            $query->whereDate(
                'fecha',
                '>=',
                $datos['desde']
            );
        }

        if (!empty($datos['hasta'])) {
            $query->whereDate(
                'fecha',
                '<=',
                $datos['hasta']
            );
        }

        $bitacoras = $query
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();

        return response()->json($bitacoras);
    }

    public function show(Bitacora $bitacora): JsonResponse
    {
        $bitacora->load([
            'usuario:id,name,email',
        ]);

        return response()->json($bitacora);
    }

    public function filtros(): JsonResponse
    {
        $modulos = Bitacora::query()
            ->whereNotNull('modulo')
            ->where('modulo', '!=', '')
            ->distinct()
            ->orderBy('modulo')
            ->pluck('modulo')
            ->values();

        $acciones = Bitacora::query()
            ->whereNotNull('accion')
            ->where('accion', '!=', '')
            ->distinct()
            ->orderBy('accion')
            ->pluck('accion')
            ->values();

        return response()->json([
            'modulos' => $modulos,
            'acciones' => $acciones,
        ]);
    }
}
