<?php

namespace App\Services;

use Carbon\CarbonInterface;

/**
 * Las cantidades de estancia que corresponden a una llegada y una salida.
 *
 * Pura a propósito: sin base de datos y sin estado. Así se puede contrastar contra
 * los 2803 folios históricos (`facturacion:comparar-estancia`) sin montar nada, y
 * esa comparación es el criterio de aceptación de la regla.
 *
 * La regla se midió, no se acordó. Días completos son pernoctas y el resto cae en
 * un tramo. Un resto de MÁS de 12 h redondea a una pernocta más: medido, esa
 * variante acierta en el 86,1% y cobrarlo como «Tránsito 12 hrs» baja al 62,0%.
 *
 * Quien ponga aquí las tarifas se equivoca de sitio: esto solo cuenta. El precio
 * sale de la matrícula, en `CargosEstancia::recalcular()`.
 */
final class CalculadoraEstancia
{
    private const MINUTOS_POR_DIA = 1440;

    private const TOPE_TRANSITO_2H = 120;

    private const TOPE_TRANSITO_12H = 720;

    /**
     * @return array{pernoctas: int, transitos2h: int, transitos12h: int}
     */
    public static function tramos(CarbonInterface $llegada, CarbonInterface $salida): array
    {
        // Sin valor absoluto: una salida anterior a la llegada da negativo y no cobra.
        // El editor ya rechaza ese caso; aquí se responde igual en vez de lanzar, para
        // no ser una segunda puerta con otra respuesta.
        $minutos = (int) $llegada->diffInMinutes($salida, false);

        if ($minutos <= 0) {
            return self::nada();
        }

        $dias = intdiv($minutos, self::MINUTOS_POR_DIA);
        $resto = $minutos % self::MINUTOS_POR_DIA;

        if ($resto === 0) {
            return self::nada(pernoctas: $dias);
        }

        if ($resto <= self::TOPE_TRANSITO_2H) {
            return self::nada(pernoctas: $dias, transitos2h: 1);
        }

        if ($resto <= self::TOPE_TRANSITO_12H) {
            return self::nada(pernoctas: $dias, transitos12h: 1);
        }

        return self::nada(pernoctas: $dias + 1);
    }

    /**
     * @return array{pernoctas: int, transitos2h: int, transitos12h: int}
     */
    private static function nada(int $pernoctas = 0, int $transitos2h = 0, int $transitos12h = 0): array
    {
        return ['pernoctas' => $pernoctas, 'transitos2h' => $transitos2h, 'transitos12h' => $transitos12h];
    }
}
