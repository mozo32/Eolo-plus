<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use App\Models\NotaOperacional;

class NotaOperacionalController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        // 1. Validar únicamente la descripción ya que el resto viene del sistema/auth
        $request->validate([
            'descripcion' => 'required|string|min:3',
        ]);

        // Cargar las relaciones dinámicamente en el usuario autenticado para el dd()

        try {
            // 2. Buscar dinámicamente tus IDs de estructura (Operaciones / Checklist de Turno)
            $departamentoId = DB::table('departamentos')
                ->where('nombre', 'like', '%OPERACIONES%')
                ->value('id');
            dd($departamentoId);
            $subdepartamentoId = DB::table('subdepartamentos')
                ->where('nombre', 'like', '%CHECKLIST%')
                ->value('id');

            // Fail-safe por si aún no están creados en los catálogos base de la DB
            if (!$departamentoId) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Estructura organizacional base (departamento) no encontrada.'
                ], 422);
            }

            // 3. Crear el registro inyectando el ID del usuario en sesión
            $nota = NotaOperacional::create([
                // Corregido: Se cambia 'uppercase()' por soporte nativo multibyte de PHP para evitar errores
                'descripcion'          => mb_strtoupper($request->descripcion, 'UTF-8'),
                'departamento_id'      => $departamentoId,
                'subdepartamento_id'   => $subdepartamentoId,
                'creado_por_user_id'   => Auth::id(),
                'validado_por_user_id' => null,
            ]);

            return response()->json([
                'ok' => true,
                'message' => 'Nota registrada con éxito.',
                'data' => $nota
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'ok' => false,
                'message' => 'Error interno al procesar el guardado de la nota.',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
