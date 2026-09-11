<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\OperacionProgramada\StoreOperacionProgramadaRequest;
use App\Http\Requests\OperacionProgramada\UpdateOperacionProgramadaRequest;
use App\Events\OperacionProgramadaCambio;
use App\Models\Bitacora;
use App\Models\OperacionProgramada;
use App\Services\RestriccionMatriculaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class OperacionProgramadaController extends Controller
{
    /**
     * Operaciones programadas de una fecha, separadas en salidas y llegadas.
     */
    public function index(Request $request): JsonResponse
    {
        $fecha = $this->fechaSolicitada($request);

        $operaciones = OperacionProgramada::query()
            ->activas()
            ->with('usos')
            ->whereDate('fecha', $fecha)
            ->when($request->filled('matricula'), function ($query) use ($request) {
                $query->where('matricula', 'like', '%' . strtoupper(trim($request->query('matricula'))) . '%');
            })
            ->orderBy('hora')
            ->orderBy('id')
            ->get();

        return response()->json([
            'fecha' => $fecha,
            'salidas' => $operaciones
                ->where('tipo', 'salida')
                ->map(fn ($operacion) => $this->serializar($operacion))
                ->values(),
            'llegadas' => $operaciones
                ->where('tipo', 'llegada')
                ->map(fn ($operacion) => $this->serializar($operacion))
                ->values(),
        ]);
    }

    /**
     * Programadas que todavía no han sido usadas por el módulo solicitante.
     * El estado es independiente por módulo: usarla en Operaciones Diarias no
     * la retira de WalkAround ni al revés.
     */
    public function pendientes(Request $request): JsonResponse
    {
        $request->validate([
            'modulo' => ['required', 'string'],
            'tipo' => ['nullable', 'in:llegada,salida'],
            'fecha' => ['nullable', 'date'],
        ]);

        $modulo = strtolower(trim($request->query('modulo')));

        if (! OperacionProgramada::claseDeModulo($modulo)) {
            return response()->json([
                'message' => 'El módulo indicado no es válido.',
            ], 422);
        }

        $operaciones = OperacionProgramada::query()
            ->pendientesPara($modulo)
            ->with('usos')
            ->when($request->filled('fecha'), fn ($query) => $query->whereDate('fecha', $request->query('fecha')))
            ->when($request->filled('tipo'), fn ($query) => $query->where('tipo', $request->query('tipo')))
            ->orderBy('fecha')
            ->orderBy('hora')
            ->get()
            ->map(fn ($operacion) => $this->serializar($operacion))
            ->values();

        return response()->json($operaciones);
    }

    /**
     * Operaciones programadas que coinciden con lo que el usuario está
     * capturando a mano en Operaciones Diarias o WalkAround: misma matrícula,
     * mismo día, mismo tipo y todavía disponibles para ese módulo.
     *
     * Devuelve también cuántas hay del tipo contrario, para que el formulario
     * pueda avisarlo de forma discreta sin cargarlas ni bloquear nada.
     */
    public function coincidencias(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'matricula' => ['required', 'string', 'max:20'],
            'tipo' => ['required', 'string'],
            'modulo' => ['required', 'string'],
            'fecha' => ['nullable', 'date'],
        ]);

        $modulo = strtolower(trim($datos['modulo']));

        if (! OperacionProgramada::claseDeModulo($modulo)) {
            return response()->json(['message' => 'El módulo indicado no es válido.'], 422);
        }

        $matricula = strtoupper(trim($datos['matricula']));
        // Entiende el vocabulario de WalkAround (Entrada) y el de Operaciones Diarias.
        $tipo = \App\Services\SecuenciaMovimientoService::normalizar($datos['tipo']);
        $fecha = $this->fechaSolicitada($request);

        $delDia = OperacionProgramada::query()
            ->pendientesPara($modulo)
            ->with('usos')
            ->where('matricula', $matricula)
            ->whereDate('fecha', $fecha)
            ->orderBy('hora')
            ->orderBy('id')
            ->get();

        return response()->json([
            'coincidencias' => $delDia
                ->where('tipo', $tipo)
                ->map(fn ($operacion) => $this->serializar($operacion))
                ->values(),
            'del_otro_tipo' => $delDia->where('tipo', '!=', $tipo)->count(),
        ]);
    }

    /**
     * Vista previa para el formulario: adelanta si el movimiento está restringido.
     * La validación que manda sigue siendo la del backend en store/update.
     */
    public function validarMovimiento(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'matricula' => ['required', 'string', 'max:20'],
            'tipo' => ['required', 'in:llegada,salida'],
            'fecha' => ['required', 'date'],
            'hora' => ['required', 'date_format:H:i'],
            'id' => ['nullable', 'integer'],
        ]);

        $matricula = strtoupper(trim($datos['matricula']));

        $restriccion = RestriccionMatriculaService::validar($matricula, $datos['tipo']);

        return response()->json([
            'restriccion' => [
                'restringido' => ! $restriccion['permitido'],
                'message' => $restriccion['message'],
            ],
        ]);
    }

    public function show(OperacionProgramada $operacionProgramada): JsonResponse
    {
        $operacionProgramada->load('usos');

        return response()->json($this->serializar($operacionProgramada));
    }

    public function store(StoreOperacionProgramadaRequest $request): JsonResponse
    {
        $datos = $request->datosOperacion();

        // Primero la restricción: es la consulta más barata y su mensaje es el
        // más accionable. La regla de secuencia se sigue evaluando después.
        $restriccion = RestriccionMatriculaService::validar($datos['matricula'], $datos['tipo']);

        if (! $restriccion['permitido']) {
            return response()->json([
                'message' => $restriccion['message'],
                'codigo' => RestriccionMatriculaService::CODIGO,
            ], 422);
        }

        $operacion = DB::transaction(function () use ($datos) {
            $operacion = OperacionProgramada::create([
                ...$datos,
                'user_id' => Auth::id(),
                'status' => OperacionProgramada::STATUS_ACTIVA,
            ]);

            Bitacora::log(
                modulo: Bitacora::MODULO_OPERACIONES_PROGRAMADAS,
                accion: Bitacora::ACCION_CREAR,
                descripcion: "Se programó una {$operacion->tipo} #{$operacion->id} de la matrícula {$operacion->matricula}.",
                registroId: $operacion->id,
                datosAnteriores: null,
                datosNuevos: ['datos_principales' => $this->datosBitacora($operacion)],
            );

            return $operacion;
        });

        OperacionProgramadaCambio::emitir($operacion, OperacionProgramadaCambio::ACCION_CREADA);

        return response()->json([
            'message' => 'Operación programada correctamente',
            'operacion' => $this->serializar($operacion->load('usos')),
        ], 201);
    }

    public function update(
        UpdateOperacionProgramadaRequest $request,
        OperacionProgramada $operacionProgramada
    ): JsonResponse {
        if ($operacionProgramada->status === OperacionProgramada::STATUS_REALIZADA) {
            return response()->json([
                'message' => 'La operación programada ya fue realizada y ya no puede editarse.',
            ], 422);
        }

        if ($operacionProgramada->status !== OperacionProgramada::STATUS_ACTIVA) {
            return response()->json([
                'message' => 'La operación programada fue cancelada y ya no puede editarse.',
            ], 422);
        }

        $datos = $request->datosOperacion();

        // Al actualizar, la restricción solo bloquea si la operación cambia de
        // matrícula o de tipo. Así una operación que ya existía puede corregirse
        // en hora, destino o PAX aunque su movimiento se haya restringido
        // después, pero no puede convertirse en un movimiento restringido.
        $cambiaDeMovimiento = $datos['matricula'] !== $operacionProgramada->matricula
            || $datos['tipo'] !== $operacionProgramada->tipo;

        if ($cambiaDeMovimiento) {
            $restriccion = RestriccionMatriculaService::validar($datos['matricula'], $datos['tipo']);

            if (! $restriccion['permitido']) {
                return response()->json([
                    'message' => $restriccion['message'],
                    'codigo' => RestriccionMatriculaService::CODIGO,
                ], 422);
            }
        }

        $anteriores = $this->datosBitacora($operacionProgramada);
        // Se guarda para que los clientes sepan si la operación salió del día
        // que están viendo.
        $fechaAnterior = OperacionProgramadaCambio::soloFecha($operacionProgramada->fecha);

        DB::transaction(function () use ($operacionProgramada, $datos, $anteriores) {
            $operacionProgramada->update($datos);

            Bitacora::log(
                modulo: Bitacora::MODULO_OPERACIONES_PROGRAMADAS,
                accion: Bitacora::ACCION_ACTUALIZAR,
                descripcion: "Se actualizó la operación programada #{$operacionProgramada->id} de la matrícula {$operacionProgramada->matricula}.",
                registroId: $operacionProgramada->id,
                datosAnteriores: ['datos_principales' => $anteriores],
                datosNuevos: ['datos_principales' => $this->datosBitacora($operacionProgramada->fresh())],
            );
        });

        OperacionProgramadaCambio::emitir(
            $operacionProgramada->fresh(),
            OperacionProgramadaCambio::ACCION_ACTUALIZADA,
            fechaAnterior: $fechaAnterior,
        );

        return response()->json([
            'message' => 'Operación programada actualizada',
            'operacion' => $this->serializar($operacionProgramada->fresh()->load('usos')),
        ]);
    }

    /**
     * Finalización manual desde el tablero de Despacho.
     *
     * No crea registro en Operaciones Diarias ni intenta relacionarse con él:
     * solo cambia el estado. La atomicidad la da la propia sentencia: se
     * actualiza únicamente si la fila sigue activa, así que de dos peticiones
     * concurrentes solo una afecta la fila; la otra recibe 409 y no emite nada.
     */
    public function finalizar(OperacionProgramada $operacionProgramada): JsonResponse
    {
        $anteriores = $this->datosBitacora($operacionProgramada);

        $afectadas = DB::transaction(function () use ($operacionProgramada, $anteriores) {
            $afectadas = OperacionProgramada::query()
                ->whereKey($operacionProgramada->id)
                ->where('status', OperacionProgramada::STATUS_ACTIVA)
                ->update(['status' => OperacionProgramada::STATUS_REALIZADA]);

            if ($afectadas !== 1) {
                return $afectadas;
            }

            Bitacora::log(
                modulo: Bitacora::MODULO_OPERACIONES_PROGRAMADAS,
                accion: Bitacora::ACCION_FINALIZAR,
                descripcion: "Se finalizó manualmente la operación programada #{$operacionProgramada->id} de la matrícula {$operacionProgramada->matricula}, sin registro en Operaciones Diarias.",
                registroId: $operacionProgramada->id,
                datosAnteriores: ['datos_principales' => $anteriores],
                datosNuevos: ['datos_principales' => $anteriores + ['status' => OperacionProgramada::STATUS_REALIZADA]],
            );

            return $afectadas;
        });

        if ($afectadas !== 1) {
            $vigente = $operacionProgramada->fresh();

            return response()->json([
                'message' => $vigente?->status === OperacionProgramada::STATUS_REALIZADA
                    ? 'La operación ya había sido finalizada por otro usuario.'
                    : 'La operación ya no está pendiente.',
                'codigo' => 'ya_no_pendiente',
                'status' => $vigente?->status,
            ], 409);
        }

        OperacionProgramadaCambio::emitir(
            $operacionProgramada->fresh(),
            OperacionProgramadaCambio::ACCION_FINALIZADA,
        );

        return response()->json([
            'message' => 'Operación finalizada',
            'operacion' => $this->serializar($operacionProgramada->fresh()->load('usos')),
        ]);
    }

    /**
     * Borrado lógico. Nunca se elimina físicamente, ni siquiera cuando no tiene
     * usos, para conservar la trazabilidad igual que en el resto del sistema.
     */
    public function destroy(OperacionProgramada $operacionProgramada): JsonResponse
    {
        if ($operacionProgramada->status === OperacionProgramada::STATUS_REALIZADA) {
            return response()->json([
                'message' => 'La operación programada ya fue realizada y no puede eliminarse.',
            ], 422);
        }

        if ($operacionProgramada->status !== OperacionProgramada::STATUS_ACTIVA) {
            return response()->json([
                'message' => 'La operación programada ya estaba cancelada.',
            ], 422);
        }

        $usada = $operacionProgramada->usos()->exists();
        $anteriores = $this->datosBitacora($operacionProgramada);

        DB::transaction(function () use ($operacionProgramada, $anteriores, $usada) {
            $operacionProgramada->update([
                'status' => OperacionProgramada::STATUS_CANCELADA,
            ]);

            Bitacora::log(
                modulo: Bitacora::MODULO_OPERACIONES_PROGRAMADAS,
                accion: Bitacora::ACCION_ELIMINAR,
                descripcion: $usada
                    ? "Se canceló la operación programada #{$operacionProgramada->id} de la matrícula {$operacionProgramada->matricula}; conserva su vínculo con registros ya terminados."
                    : "Se eliminó la operación programada #{$operacionProgramada->id} de la matrícula {$operacionProgramada->matricula}.",
                registroId: $operacionProgramada->id,
                datosAnteriores: ['datos_principales' => $anteriores],
                datosNuevos: null,
            );
        });

        OperacionProgramadaCambio::emitir($operacionProgramada, OperacionProgramadaCambio::ACCION_ELIMINADA);

        return response()->json([
            'message' => $usada
                ? 'La operación quedó cancelada. Como ya está vinculada a un registro terminado, se conserva para la trazabilidad.'
                : 'Operación programada eliminada',
        ]);
    }

    /**
     * Fecha consultada, con la zona horaria configurada en el proyecto.
     */
    private function fechaSolicitada(Request $request): string
    {
        $fecha = $request->query('fecha');

        if (! $fecha) {
            return Carbon::now(config('app.timezone'))->toDateString();
        }

        return Carbon::parse($fecha)->toDateString();
    }

    private function serializar(OperacionProgramada $operacion): array
    {
        return [
            'id' => $operacion->id,
            'fecha' => $operacion->fecha instanceof \DateTimeInterface
                ? $operacion->fecha->format('Y-m-d')
                : $operacion->fecha,
            'tipo' => $operacion->tipo,
            'matricula' => $operacion->matricula,
            'equipo' => $operacion->equipo,
            'hora' => substr((string) $operacion->hora, 0, 5),
            'lugar' => $operacion->lugar,
            'pax' => $operacion->pax,
            // FP es texto libre y opcional. fp_folio queda fuera de la respuesta
            // porque hoy no se muestra en formularios ni tablas.
            'fp' => $operacion->fp,
            'observaciones' => $operacion->observaciones,
            'status' => $operacion->status,
            'modulos_usados' => $operacion->modulos_usados,
        ];
    }

    private function datosBitacora(OperacionProgramada $operacion): array
    {
        return [
            'tipo' => $operacion->tipo,
            'matricula' => $operacion->matricula,
            'equipo' => $operacion->equipo,
            'fecha' => $operacion->fecha instanceof \DateTimeInterface
                ? $operacion->fecha->format('Y-m-d')
                : $operacion->fecha,
            'hora' => $operacion->hora,
            'lugar' => $operacion->lugar,
            'pax' => $operacion->pax,
            'fp' => $operacion->fp,
            'fp_folio' => $operacion->fp_folio,
            'observaciones' => $operacion->observaciones,
        ];
    }
}
