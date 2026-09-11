<?php

namespace App\Events;

use App\Models\OperacionProgramada;
use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Cambio en una operación programada, transmitido en tiempo real.
 *
 * Sigue el mismo patrón que RemisionCreada: canal público, ShouldBroadcastNow y
 * una carga mínima. El cliente no reconstruye la operación con estos datos; los
 * usa para decidir si le conviene volver a consultar la API. Una pantalla
 * situada en otra fecha ignora el evento sin tocar la red.
 */
class OperacionProgramadaCambio implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    public const CANAL = 'operaciones-programadas';
    /**
     * Canal público de la televisión. Solo recibe este evento, cuya carga ya es
     * segura: sin usuarios, sin restricciones, sin nada administrativo. Las
     * restricciones de matrícula no se emiten aquí.
     */
    public const CANAL_PANTALLA = 'pantalla-programadas';

    public const ACCION_CREADA = 'creada';
    public const ACCION_ACTUALIZADA = 'actualizada';
    public const ACCION_ELIMINADA = 'eliminada';
    public const ACCION_UTILIZADA = 'utilizada';
    /** Finalizada a mano desde el tablero de Despacho, sin registro diario. */
    public const ACCION_FINALIZADA = 'finalizada';

    public function __construct(
        public int $id,
        public string $accion,
        public ?string $fecha = null,
        public ?string $tipo = null,
        public ?string $fechaAnterior = null,
        public ?string $modulo = null,
    ) {
    }

    /**
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new Channel(self::CANAL),
            new Channel(self::CANAL_PANTALLA),
        ];
    }

    public function broadcastWith(): array
    {
        return [
            'id' => $this->id,
            'accion' => $this->accion,
            'fecha' => $this->fecha,
            'tipo' => $this->tipo,
            'fecha_anterior' => $this->fechaAnterior,
            'modulo' => $this->modulo,
        ];
    }

    /**
     * Emite el evento sin poner en riesgo la operación que acaba de guardarse.
     *
     * Igual que en Remisiones: si el servidor de websockets no responde se deja
     * constancia en el log y el request continúa con normalidad.
     */
    public static function emitir(
        OperacionProgramada $operacion,
        string $accion,
        ?string $fechaAnterior = null,
        ?string $modulo = null
    ): void {
        try {
            event(new self(
                id: $operacion->id,
                accion: $accion,
                fecha: self::soloFecha($operacion->fecha),
                tipo: $operacion->tipo,
                fechaAnterior: $fechaAnterior,
                modulo: $modulo,
            ));
        } catch (\Throwable $e) {
            Log::warning('No se pudo emitir el evento OperacionProgramadaCambio', [
                'operacion_programada_id' => $operacion->id,
                'accion' => $accion,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public static function soloFecha($fecha): ?string
    {
        if (! $fecha) {
            return null;
        }

        if ($fecha instanceof \DateTimeInterface) {
            return $fecha->format('Y-m-d');
        }

        return substr(str_replace('T', ' ', (string) $fecha), 0, 10);
    }
}
