<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Lo único que la televisión pública llega a ver de una operación programada.
 *
 * Es una lista blanca explícita: nada de estado, usos, usuario, timestamps ni
 * restricciones. Si algún día hace falta un campo más, se agrega aquí a
 * propósito, nunca por accidente.
 */
class OperacionPantallaResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            // Necesario como llave de React y para no duplicar filas cuando
            // llegan varios eventos de la misma operación. Es un entero
            // secuencial sin significado fuera del sistema.
            'id' => $this->id,
            'tipo' => $this->tipo,
            'matricula' => $this->matricula,
            'equipo' => $this->equipo,
            'hora' => substr((string) $this->hora, 0, 5),
            'lugar' => $this->lugar,
            'pax' => $this->pax,
            'fp' => $this->fp,
            'observaciones' => $this->observaciones,
        ];
    }
}
