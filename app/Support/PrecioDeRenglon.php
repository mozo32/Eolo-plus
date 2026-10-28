<?php

namespace App\Support;

/**
 * Qué precio se guarda en un renglón y si cuenta como capturado a mano. EN UN SOLO SITIO.
 *
 * Pura a propósito, igual que `VentanaDeEstancia` y `CalculadoraEstancia`: recibe dos cifras y
 * no sabe nada de la base de datos.
 *
 * La necesitan `PrefacturaRenglonController::store()` —para el catálogo, la remisión y el
 * tránsito ajeno— y `RenglonDeComisariato::atributos()`. Dos copias de la misma comparación
 * divergen: en el trabajo de remisiones las dos vías armaban el renglón por separado y se
 * separaron en `margen`, `ajuste_precio` y `es_de_tercero` sin que nadie lo viera hasta la
 * revisión final de rama.
 *
 * `$pedido` nulo es «no se tecleó nada»; `'0'` es un precio de cero, que es una tarifa válida.
 * Es la misma regla que gobierna los importes del front: un campo vacío y un cero no son lo
 * mismo.
 */
final class PrecioDeRenglon
{
    /**
     * Quien llama entrega `null` o un número (o una cadena numérica ya validada por `StoreRenglonRequest`). No se valida aquí: una cadena vacía o un texto no numérico pasarían por `(float)` y darían `0.0000` en silencio, pero lanzar en esta capa añadiría un error 500 que la petición no debe producir.
     *
     * @param  string|float|null  $pedido  Lo que llegó en la petición, o null si no llegó nada.
     * @param  string|float  $delRegistro  El precio que aplicaría sin él: el del catálogo, el de
     *                                     la remisión, el subtotal del comisariato o la tarifa
     *                                     del tramo de la aeronave.
     * @return array{precio: string, capturado: bool}
     */
    public static function resolver(string|float|null $pedido, string|float $delRegistro): array
    {
        $delRegistro = self::aCuatroDecimales($delRegistro);

        if ($pedido === null) {
            return ['precio' => $delRegistro, 'capturado' => false];
        }

        $tecleado = self::aCuatroDecimales($pedido);

        return ['precio' => $tecleado, 'capturado' => $tecleado !== $delRegistro];
    }

    /**
     * La cifra tal como la guarda `decimal(10,4)`.
     *
     * Normalizar los dos lados a esto ES la comparación: así `500`, `500.00` y `500.0000` son el
     * mismo precio, y la marca solo aparece cuando de verdad se cobra otra cosa.
     */
    private static function aCuatroDecimales(string|float $valor): string
    {
        return number_format((float) $valor, 4, '.', '');
    }
}
