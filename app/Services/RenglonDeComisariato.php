<?php

namespace App\Services;

use App\Models\ServicioComisariato;
use App\Support\PrecioDeRenglon;

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
    /**
     * El precio que un comisariato aporta al renglón cuando nadie teclea otro: su subtotal.
     *
     * Existe para que «cuál es el precio heredado de un comisariato» se decida en UN solo sitio.
     * `atributos()` lo compara con el tecleado para saber si el renglón queda marcado, y el
     * controlador lo cita en la bitácora; si cada uno leyera `subtotal` por su cuenta, un cambio
     * de referencia aquí haría que la bitácora dijera una cifra distinta de la que se comparó.
     */
    public static function precioHeredado(ServicioComisariato $comisariato): string|float
    {
        return $comisariato->subtotal;
    }

    /**
     * @param  string|float|null  $precioPedido  El precio tecleado en el alta a mano, o null. La
     *                                           vía AUTOMÁTICA no pasa ninguno: sigue cobrando
     *                                           el subtotal del comisariato, que es su contrato.
     * @return array<string, mixed>
     */
    public static function atributos(ServicioComisariato $comisariato, int $orden, string|float|null $precioPedido = null): array
    {
        $servicio = $comisariato->factServicio;
        $precio = PrecioDeRenglon::resolver($precioPedido, self::precioHeredado($comisariato));

        return [
            'servicio_id' => $servicio->id,
            'servicio_comisariato_id' => $comisariato->id,
            'nombre_servicio' => $servicio->nombre,
            'precio_unitario' => $precio['precio'],
            'precio_capturado' => $precio['capturado'],
            'cantidad' => 1,
            'es_de_tercero' => $servicio->es_de_tercero,
            'margen' => $servicio->margen,
            'ajuste_precio' => $servicio->ajuste_precio,
            'orden' => $orden,
        ];
    }
}
