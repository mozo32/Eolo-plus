<?php

namespace App\Events;

use App\Models\MatriculaRestringida;
use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Cambio en la lista de matrículas restringidas, transmitido en tiempo real.
 *
 * Viaja por el mismo canal público que OperacionProgramadaCambio y sigue el
 * mismo patrón de Remisiones: ShouldBroadcastNow y carga mínima.
 */
class MatriculaRestringidaCambio implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    public const ACCION_AGREGADA = 'agregada';
    public const ACCION_ACTUALIZADA = 'actualizada';
    public const ACCION_ELIMINADA = 'eliminada';

    public function __construct(
        public string $matricula,
        public string $accion,
        public bool $llegada = false,
        public bool $salida = false,
    ) {
    }

    public function broadcastOn(): Channel
    {
        return new Channel(OperacionProgramadaCambio::CANAL);
    }

    public function broadcastWith(): array
    {
        return [
            'matricula' => $this->matricula,
            'accion' => $this->accion,
            'llegada' => $this->llegada,
            'salida' => $this->salida,
        ];
    }

    /**
     * Emite sin poner en riesgo la operación que ya se guardó: si el servidor de
     * websockets no responde, queda constancia en el log y el request continúa.
     */
    public static function emitir(MatriculaRestringida $restriccion, string $accion): void
    {
        try {
            event(new self(
                matricula: $restriccion->matricula,
                accion: $accion,
                llegada: (bool) $restriccion->llegada,
                salida: (bool) $restriccion->salida,
            ));
        } catch (\Throwable $e) {
            Log::warning('No se pudo emitir el evento MatriculaRestringidaCambio', [
                'matricula' => $restriccion->matricula,
                'accion' => $accion,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
