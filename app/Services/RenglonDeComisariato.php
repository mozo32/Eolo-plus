<?php

namespace App\Services;

use App\Models\ServicioComisariato;

/**
 * Qué lleva un renglón nacido de un comisariato. EL ÚNICO SITIO donde se decide.
 *
 * Existe por una cicatriz: en el trabajo de remisiones, el alta automática y la manual armaban
 * el renglón cada una por su cuenta y divergieron en `margen`, `ajuste_precio` y
 * `es_de_tercero` sin que nadie lo viera hasta la revisión final. El mismo combustible se
 * cobraba distinto según por dónde hubiera entrado. Con un solo sitio, no pueden separarse.
 *
 * El margen y el ajuste salen DEL SERVICIO, al revés que en combustible. Allí el precio de la
 * remisión era el final y un margen encima lo habría falseado; aquí el margen es el negocio:
 * Comexa al 0 % y los otros cuatro al 50 % con su ajuste. Ponerlos a cero cobraría de menos en
 * cuatro de los cinco proveedores.
 */
final class RenglonDeComisariato
{
    /** @return array<string, mixed> */
    public static function atributos(ServicioComisariato $comisariato, int $orden): array
    {
        $servicio = $comisariato->factServicio;

        return [
            'servicio_id' => $servicio->id,
            'servicio_comisariato_id' => $comisariato->id,
            'nombre_servicio' => $servicio->nombre,
            'precio_unitario' => $comisariato->subtotal,
            'cantidad' => 1,
            'es_de_tercero' => $servicio->es_de_tercero,
            'margen' => $servicio->margen,
            'ajuste_precio' => $servicio->ajuste_precio,
            'orden' => $orden,
        ];
    }
}
