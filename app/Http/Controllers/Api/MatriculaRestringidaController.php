<?php

namespace App\Http\Controllers\Api;

use App\Events\MatriculaRestringidaCambio;
use App\Http\Controllers\Controller;
use App\Http\Requests\MatriculaRestringida\StoreMatriculaRestringidaRequest;
use App\Http\Requests\MatriculaRestringida\UpdateMatriculaRestringidaRequest;
use App\Models\Bitacora;
use App\Models\MatriculaRestringida;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class MatriculaRestringidaController extends Controller
{
    public function index(): JsonResponse
    {
        $restricciones = MatriculaRestringida::query()
            ->orderBy('matricula')
            ->get()
            ->map(fn (MatriculaRestringida $restriccion) => $this->serializar($restriccion))
            ->values();

        return response()->json($restricciones);
    }

    /**
     * Alta. Ambos movimientos quedan permitidos hasta que se active un switch.
     * Se acepta cualquier matrícula válida, exista o no en el catálogo remoto,
     * para poder restringir de forma preventiva.
     */
    public function store(StoreMatriculaRestringidaRequest $request): JsonResponse
    {
        $matricula = $request->matriculaNormalizada();

        if (MatriculaRestringida::query()->whereKey($matricula)->exists()) {
            return response()->json([
                'message' => 'La matrícula seleccionada ya se encuentra en la lista de restricciones.',
            ], 422);
        }

        $restriccion = DB::transaction(function () use ($matricula) {
            $restriccion = MatriculaRestringida::create([
                'matricula' => $matricula,
                'llegada' => false,
                'salida' => false,
            ]);

            Bitacora::log(
                modulo: Bitacora::MODULO_MATRICULAS_RESTRINGIDAS,
                accion: Bitacora::ACCION_CREAR,
                descripcion: "Se agregó la matrícula {$matricula} a la lista de restricciones.",
                datosAnteriores: null,
                datosNuevos: ['datos_principales' => $this->serializar($restriccion)],
            );

            return $restriccion;
        });

        MatriculaRestringidaCambio::emitir($restriccion, MatriculaRestringidaCambio::ACCION_AGREGADA);

        return response()->json([
            'message' => 'Matrícula agregada a la lista de restricciones',
            'restriccion' => $this->serializar($restriccion),
        ], 201);
    }

    /**
     * Cambio de los switches. Cada movimiento se actualiza por separado.
     */
    public function update(UpdateMatriculaRestringidaRequest $request, string $matricula): JsonResponse
    {
        $restriccion = $this->buscar($matricula);

        if (! $restriccion) {
            return response()->json([
                'message' => 'La matrícula no está en la lista de restricciones.',
            ], 404);
        }

        $cambios = $request->cambios();

        if ($cambios === []) {
            return response()->json([
                'message' => 'No se recibió ningún cambio.',
            ], 422);
        }

        $anteriores = $this->serializar($restriccion);

        DB::transaction(function () use ($restriccion, $cambios, $anteriores) {
            $restriccion->update($cambios);

            Bitacora::log(
                modulo: Bitacora::MODULO_MATRICULAS_RESTRINGIDAS,
                accion: Bitacora::ACCION_ACTUALIZAR,
                descripcion: "Se actualizaron las restricciones de la matrícula {$restriccion->matricula}.",
                datosAnteriores: ['datos_principales' => $anteriores],
                datosNuevos: ['datos_principales' => $this->serializar($restriccion->fresh())],
            );
        });

        $restriccion->refresh();

        MatriculaRestringidaCambio::emitir($restriccion, MatriculaRestringidaCambio::ACCION_ACTUALIZADA);

        return response()->json([
            'message' => 'Restricciones actualizadas',
            'restriccion' => $this->serializar($restriccion),
        ]);
    }

    /**
     * Quita la matrícula de la lista. No toca el catálogo de aeronaves ni las
     * operaciones programadas o históricas de esa matrícula.
     */
    public function destroy(string $matricula): JsonResponse
    {
        $restriccion = $this->buscar($matricula);

        if (! $restriccion) {
            return response()->json([
                'message' => 'La matrícula no está en la lista de restricciones.',
            ], 404);
        }

        $anteriores = $this->serializar($restriccion);

        DB::transaction(function () use ($restriccion, $anteriores) {
            Bitacora::log(
                modulo: Bitacora::MODULO_MATRICULAS_RESTRINGIDAS,
                accion: Bitacora::ACCION_ELIMINAR,
                descripcion: "Se quitó la matrícula {$restriccion->matricula} de la lista de restricciones.",
                datosAnteriores: ['datos_principales' => $anteriores],
                datosNuevos: null,
            );

            $restriccion->delete();
        });

        MatriculaRestringidaCambio::emitir($restriccion, MatriculaRestringidaCambio::ACCION_ELIMINADA);

        return response()->json([
            'message' => 'Restricciones eliminadas',
        ]);
    }

    /**
     * Se resuelve a mano y no por binding implícito, para que una matrícula
     * escrita en minúsculas encuentre su registro.
     */
    private function buscar(string $matricula): ?MatriculaRestringida
    {
        return MatriculaRestringida::query()
            ->find(MatriculaRestringida::normalizar($matricula));
    }

    private function serializar(MatriculaRestringida $restriccion): array
    {
        return [
            'matricula' => $restriccion->matricula,
            'llegada' => (bool) $restriccion->llegada,
            'salida' => (bool) $restriccion->salida,
        ];
    }
}
