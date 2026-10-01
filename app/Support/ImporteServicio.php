<?php

namespace App\Support;

use UnexpectedValueException;

/**
 * La fórmula del importe de un servicio, en un solo lugar.
 *
 * Existe porque tres cosas la necesitan: el catálogo (`FactServicio::importe()`),
 * el renglón de una prefactura —que usa sus propios valores congelados y no los
 * del catálogo— y la pantalla, que la reproduce en TypeScript
 * (`importeVistaPrevia` en `resources/js/pages/Facturacion/components/formato.ts`).
 * Esa copia de TypeScript es una vista previa y su autoridad es este archivo.
 *
 * La fórmula es la del sistema viejo (`Prefectura/altaserv.php`), reproducida
 * literalmente, incluido el orden y el redondeo final a dos decimales.
 */
final class ImporteServicio
{
    public const AJUSTE_NINGUNO = 'ninguno';

    public const AJUSTE_MAS_5 = 'mas_5';

    public const AJUSTE_SIN_IVA = 'sin_iva';

    public const AJUSTE_COMISION_131 = 'comision_131';

    public static function calcular(float $precio, int $cantidad, float $margen, ?string $ajuste): string
    {
        $ajustado = self::aplicarAjuste($precio, $ajuste);
        $conMargen = $ajustado + ($ajustado * $margen / 100);

        return number_format($conMargen * $cantidad, 2, '.', '');
    }

    /**
     * `match` estricto a propósito: con `switch`, un `case null` aceptaría
     * también la cadena vacía por comparación laxa, y un ajuste que no se
     * reconoce tiene que lanzar en lugar de cobrar de más o de menos.
     */
    private static function aplicarAjuste(float $precio, ?string $ajuste): float
    {
        return match ($ajuste) {
            null, self::AJUSTE_NINGUNO => $precio,
            self::AJUSTE_MAS_5 => $precio * 1.05,
            self::AJUSTE_SIN_IVA => $precio / 1.16,
            self::AJUSTE_COMISION_131 => self::comision131($precio),
            default => throw new UnexpectedValueException("ajuste_precio desconocido: '{$ajuste}'"),
        };
    }

    /**
     * Escrita igual que el original, no en su forma reducida (× 1.15): el
     * sistema viejo calcula así y reescribirla invita a que alguien "la
     * simplifique" y cambie el último centavo.
     */
    private static function comision131(float $precio): float
    {
        $precio1 = $precio / 1.31;

        return $precio1 * .15 + $precio1;
    }
}
