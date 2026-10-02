<?php

namespace App\Support;

use UnexpectedValueException;

/**
 * La comisión Amex, en un solo lugar.
 *
 * El sistema viejo escribe `$camex = $monto * (0.06 / 1.2296)`
 * (`Prefectura/mpamex.php:40`), y ese `1.2296` es `1.16 × 1.06` precalculado: la
 * tasa de IVA por el 6% de la comisión. La fórmula no es un parche, es exacta — si
 * el operador teclea lo que se le va a cargar a la tarjeta:
 *
 *     base     = monto / ((1 + iva) × 1.06)
 *     comisión = base × 0.06
 *     subtotal = base + comisión = base × 1.06
 *     total    = subtotal × (1 + iva) = monto
 *
 * Aquí la tasa se LEE en lugar de fijarse. Con 16% da el mismo número que las 765
 * comisiones del histórico que siguen esta fórmula; el día que la tasa cambie,
 * sigue siendo correcta, lo que el literal `1.2296` no haría.
 *
 * `mpamex.php` tiene una SEGUNDA fórmula (`monto * 0.06`) para cuando ya había
 * pagos registrados. Se descarta a propósito: aparece 5 veces contra 765, y aplica
 * el 6% a un monto bruto como si fuera neto, lo que hace que la misma cantidad
 * cargada a la tarjeta produzca dos comisiones distintas según el orden en que se
 * capturó. El comando `facturacion:comparar-pagos` nombra esos 5 folios.
 */
final class ComisionAmex
{
    /** El 6% que Amex cobra, como fracción. */
    public const TASA = '0.06';

    public static function calcular(string $montoBruto, string $tasaIva): string
    {
        // Recortar una sola vez y usar los valores limpios en todo el cálculo: los
        // espacios no son decimales, son ruido de entrada. La validación los permite
        // porque la entrada web casi siempre trae espacios sin saberlo.
        $montoBruto = trim($montoBruto);
        $tasaIva = trim($tasaIva);

        self::exigirDecimal($montoBruto, 'monto bruto');
        self::exigirDecimal($tasaIva, 'tasa de IVA');

        // (1 + iva) × 1.06. A escala 6: la tasa tiene 4 decimales y 1.06 tiene 2.
        $divisor = bcmul(bcadd('1', $tasaIva, 4), bcadd('1', self::TASA, 2), 6);

        if (bccomp($divisor, '0', 6) <= 0) {
            throw new UnexpectedValueException("El divisor de la comisión Amex no es positivo: '{$divisor}'");
        }

        // Medio centavo antes de truncar, en aritmética de cadenas: redondea hacia
        // arriba en el medio sin pasar por float, igual que `FactPrefactura::calcularIva()`.
        return bcadd(bcdiv(bcmul($montoBruto, self::TASA, 6), $divisor, 6), '0.005', 2);
    }

    /**
     * Valida que sea un decimal. Un signo menos SÍ se acepta: lo rechaza el
     * `bccomp` del divisor con su propio mensaje. Se asume que el valor ya ha
     * sido recortado en `calcular()`: esto previene que una entrada con espacios
     * lance `ValueError` en `bcmul` en lugar de `UnexpectedValueException`.
     */
    private static function exigirDecimal(string $valor, string $que): void
    {
        if (preg_match('/^-?(\d+(\.\d+)?|\.\d+)$/', $valor) !== 1) {
            throw new UnexpectedValueException("La comisión Amex necesita un decimal como {$que}, y recibió: '{$valor}'");
        }
    }
}
