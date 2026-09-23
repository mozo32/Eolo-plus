<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RelacionPlanta\FinalizarRelacionPlantaRequest;
use App\Http\Requests\RelacionPlanta\PrestarRelacionPlantaRequest;
use App\Models\Bitacora;
use App\Models\RelacionPlanta;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Control de préstamo de la GPU N.115.
 *
 * Solo existe una planta, así que a lo sumo hay un registro en_uso. Prestar y
 * finalizar corren dentro de una transacción con bloqueo para que dos usuarios
 * simultáneos no abran dos préstamos ni cierren dos veces el mismo.
 */
class RelacionPlantaController extends Controller
{
    private const PER_PAGE_PERMITIDOS = [10, 20, 50, 100];

    /**
     * Préstamo abierto (o null) y el último horómetro final registrado.
     *
     * El horómetro de la planta es continuo: la lectura con la que terminó el
     * préstamo anterior es la que se espera al iniciar el siguiente, así que se
     * envía para precargar el formulario (el usuario puede cambiarla).
     */
    public function actual(): JsonResponse
    {
        return response()->json([
            'prestamo' => RelacionPlanta::enUso()->latest('id')->first(),
            'ultimo_horometro_fin' => RelacionPlanta::finalizadas()
                ->whereNotNull('horometro_fin')
                ->latest('id')
                ->value('horometro_fin'),
        ]);
    }

    public function prestar(PrestarRelacionPlantaRequest $request): JsonResponse
    {
        $datos = $request->validated();

        $resultado = DB::transaction(function () use ($datos) {
            // FOR UPDATE sobre status='en_uso' (indexado): en InnoDB bloquea el
            // hueco y serializa a quien intente prestar al mismo tiempo.
            $abierto = RelacionPlanta::enUso()->lockForUpdate()->latest('id')->first();

            if ($abierto) {
                return ['ocupado' => $abierto];
            }

            $prestamo = RelacionPlanta::create([
                'fecha' => $datos['fecha'],
                'empresa' => $datos['empresa'],
                'matricula' => $datos['matricula'],
                'horometro_inicio' => $datos['horometro_inicio'],
                'horometro_fin' => null,
                'tiempo' => null,
                'status' => RelacionPlanta::STATUS_EN_USO,
            ]);

            Bitacora::log(
                modulo: Bitacora::MODULO_RELACION_PLANTA,
                accion: Bitacora::ACCION_CREAR,
                descripcion: "Se prestó la {$prestamo->equipo} a la matrícula {$prestamo->matricula} ({$prestamo->empresa}) con horómetro inicial {$prestamo->horometro_inicio}.",
                registroId: $prestamo->id,
                datosAnteriores: null,
                datosNuevos: $this->datosBitacora($prestamo),
            );

            return ['prestamo' => $prestamo];
        });

        if (isset($resultado['ocupado'])) {
            $ocupado = $resultado['ocupado'];

            return response()->json([
                'message' => "La GPU N.115 se encuentra en uso por la matrícula {$ocupado->matricula}. Debe registrarse su entrega antes de iniciar otro préstamo.",
                'codigo' => 'gpu_en_uso',
                'matricula' => $ocupado->matricula,
                'prestamo' => $ocupado,
            ], 409);
        }

        return response()->json([
            'message' => 'Préstamo registrado correctamente.',
            'prestamo' => $resultado['prestamo'],
        ], 201);
    }

    public function finalizar(FinalizarRelacionPlantaRequest $request, int $id): JsonResponse
    {
        $datos = $request->validated();

        $resultado = DB::transaction(function () use ($datos, $id) {
            $prestamo = RelacionPlanta::query()->whereKey($id)->lockForUpdate()->firstOrFail();

            if ($prestamo->status !== RelacionPlanta::STATUS_EN_USO) {
                return ['ya_finalizado' => true];
            }

            $inicio = (float) $prestamo->horometro_inicio;
            $fin = (float) $datos['horometro_fin'];

            if ($fin < $inicio) {
                return ['menor' => true];
            }

            // El tiempo de uso es el transcurrido entre el registro del préstamo
            // y la entrega, no la diferencia de horómetros. El backend no confía
            // en el cálculo de React: si no viene, lo hace; si viene (editado),
            // se acepta porque ya pasó la validación.
            $tiempo = array_key_exists('tiempo', $datos) && $datos['tiempo'] !== null
                ? round((float) $datos['tiempo'], 2)
                : round($prestamo->created_at->diffInSeconds(now()) / 3600, 2);

            $anteriores = $this->datosBitacora($prestamo);

            // Atómico: solo cierra si sigue en uso.
            $afectadas = RelacionPlanta::query()
                ->whereKey($prestamo->id)
                ->where('status', RelacionPlanta::STATUS_EN_USO)
                ->update([
                    'horometro_fin' => $fin,
                    'tiempo' => $tiempo,
                    'status' => RelacionPlanta::STATUS_FINALIZADO,
                    'updated_at' => now(),
                ]);

            if ($afectadas !== 1) {
                return ['ya_finalizado' => true];
            }

            $prestamo->refresh();

            Bitacora::log(
                modulo: Bitacora::MODULO_RELACION_PLANTA,
                accion: Bitacora::ACCION_FINALIZAR,
                descripcion: "Se registró la entrega de la {$prestamo->equipo} por la matrícula {$prestamo->matricula}: horómetro final {$prestamo->horometro_fin}, tiempo {$prestamo->tiempo} h.",
                registroId: $prestamo->id,
                datosAnteriores: $anteriores,
                datosNuevos: $this->datosBitacora($prestamo),
            );

            return ['prestamo' => $prestamo];
        });

        if (isset($resultado['menor'])) {
            return response()->json([
                'message' => 'El horómetro final no puede ser menor que el horómetro inicial.',
                'errors' => ['horometro_fin' => ['El horómetro final no puede ser menor que el horómetro inicial.']],
            ], 422);
        }

        if (isset($resultado['ya_finalizado'])) {
            return response()->json([
                'message' => 'Este préstamo ya fue finalizado por otro usuario.',
                'codigo' => 'ya_finalizado',
            ], 409);
        }

        return response()->json([
            'message' => 'Entrega registrada correctamente.',
            'prestamo' => $resultado['prestamo'],
        ]);
    }

    /** Histórico paginado: en_uso arriba, luego del más reciente al más antiguo. */
    public function historico(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        if (! in_array($perPage, self::PER_PAGE_PERMITIDOS, true)) {
            $perPage = 20;
        }

        $query = RelacionPlanta::query();

        if ($request->filled('fecha_inicio')) {
            $query->whereDate('fecha', '>=', $request->query('fecha_inicio'));
        }

        if ($request->filled('fecha_fin')) {
            $query->whereDate('fecha', '<=', $request->query('fecha_fin'));
        }

        if ($request->filled('empresa')) {
            $query->where('empresa', 'LIKE', '%'.trim((string) $request->query('empresa')).'%');
        }

        if ($request->filled('matricula')) {
            $query->where('matricula', 'LIKE', '%'.strtoupper(trim((string) $request->query('matricula'))).'%');
        }

        if (in_array($request->query('status'), [RelacionPlanta::STATUS_EN_USO, RelacionPlanta::STATUS_FINALIZADO], true)) {
            $query->where('status', $request->query('status'));
        }

        $registros = $query
            ->orderByRaw("CASE WHEN status = '".RelacionPlanta::STATUS_EN_USO."' THEN 0 ELSE 1 END")
            ->orderByDesc('fecha')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->appends($request->query());

        return response()->json($registros);
    }

    /** Empresas ya usadas en este módulo, para sugerirlas al capturar. */
    public function empresas(Request $request): JsonResponse
    {
        $query = RelacionPlanta::query()->select('empresa')->distinct()->orderBy('empresa');

        if ($request->filled('q')) {
            $query->where('empresa', 'LIKE', '%'.trim((string) $request->query('q')).'%');
        }

        return response()->json($query->limit(20)->pluck('empresa')->values());
    }

    private function datosBitacora(RelacionPlanta $prestamo): array
    {
        return [
            'equipo' => $prestamo->equipo,
            'fecha' => $prestamo->fecha?->format('Y-m-d'),
            'empresa' => $prestamo->empresa,
            'matricula' => $prestamo->matricula,
            'horometro_inicio' => $prestamo->horometro_inicio,
            'horometro_fin' => $prestamo->horometro_fin,
            'tiempo' => $prestamo->tiempo,
            'status' => $prestamo->status,
        ];
    }
}
