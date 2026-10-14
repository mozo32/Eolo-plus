<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Algo cambió en la lista de llegadas pendientes de prefactura.
 *
 * Sigue el patrón de `OperacionProgramadaCambio`: canal público, `ShouldBroadcastNow` y
 * una carga mínima. La pantalla no reconstruye nada con estos datos; los usa para decidir
 * si le conviene volver a preguntar al servidor. Por eso la carga puede ser pública: no
 * lleva importes, ni clientes, ni nada que no esté ya en el tablero de Operaciones.
 */
class PrefacturaPendienteCambio implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    public const CANAL = 'prefacturas-pendientes';

    /** Se registró una llegada: hay una pendiente más. */
    public const ACCION_CREADA = 'creada';

    /** Cambió una llegada ya registrada (matrícula o fecha): puede entrar o salir de la ventana. */
    public const ACCION_ACTUALIZADA = 'actualizada';

    /** Se canceló la llegada: deja de estar pendiente. */
    public const ACCION_ELIMINADA = 'eliminada';

    /** Se abrió una prefactura sobre esa llegada: deja de estar pendiente. */
    public const ACCION_TOMADA = 'tomada';

    /** Se descartó la prefactura: la llegada vuelve a quedar pendiente. */
    public const ACCION_LIBERADA = 'liberada';

    public function __construct(
        public string $accion,
        public ?int $operacionId = null,
        public ?string $matricula = null,
    ) {}

    /**
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [new Channel(self::CANAL)];
    }

    /**
     * @return array{accion: string, operacion_id: int|null, matricula: string|null}
     */
    public function broadcastWith(): array
    {
        return [
            'accion' => $this->accion,
            'operacion_id' => $this->operacionId,
            'matricula' => $this->matricula,
        ];
    }

    /**
     * Avisa sin poner en riesgo lo que se acaba de guardar.
     *
     * Igual que en programadas y en remisiones: si el servidor de websockets no responde,
     * queda constancia en el log y la petición sigue su curso. Registrar una llegada no
     * puede fallar porque Reverb esté caído.
     */
    public static function emitir(string $accion, ?int $operacionId = null, ?string $matricula = null): void
    {
        try {
            event(new self($accion, $operacionId, $matricula));
        } catch (\Throwable $e) {
            Log::warning('No se pudo emitir el evento PrefacturaPendienteCambio', [
                'accion' => $accion,
                'operacion_id' => $operacionId,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
