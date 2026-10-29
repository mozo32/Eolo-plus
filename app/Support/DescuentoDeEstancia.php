<?php

namespace App\Support;

use App\Models\FactAeronave;
use App\Models\FactServicio;
use InvalidArgumentException;

/**
 * Qué es un descuento de estancia, en un solo lugar.
 *
 * Existe porque cuatro sitios necesitan la misma respuesta y cada copia se separaría
 * de las otras: el endpoint que lo aplica, la bitácora que lo cuenta, `CargosEstancia`
 * cuando lo retira, y las pruebas que fijan los nombres que ve el cliente.
 *
 * Replica el descuento del sistema viejo (`obtener_datos_modal.php` y
 * `aplicar_descuento.php`): los tres tramos de estancia, la tarifa de la matrícula y un
 * renglón negativo de cantidad 1. Los dos AJUSTES de estancia no se descuentan, igual
 * que en el viejo.
 */
final class DescuentoDeEstancia
{
    /**
     * Cómo se llama cada tramo en una frase. De aquí sale el nombre del renglón y la
     * línea de bitácora, para que no se puedan separar.
     *
     * @var array<string, string>
     */
    private const ETIQUETAS = [
        FactServicio::CONCEPTO_ESTANCIA_PERNOCTA => 'pernocta',
        FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H => 'tránsito de 2 horas',
        FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H => 'tránsito de 12 horas',
    ];

    /** @var array<string, string> concepto de estancia => concepto del descuento */
    private const CONCEPTOS = [
        FactServicio::CONCEPTO_ESTANCIA_PERNOCTA => FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA,
        FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H => FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_TRANSITO_2H,
        FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H => FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_TRANSITO_12H,
    ];

    /**
     * Los tres conceptos DE ESTANCIA que admiten descuento, en el orden en que se
     * enseñan y en que se nombran los avisos.
     *
     * @return list<string>
     */
    public static function conceptosDescontables(): array
    {
        return array_keys(self::CONCEPTOS);
    }

    /**
     * Los tres conceptos DEL DESCUENTO.
     *
     * @return list<string>
     */
    public static function conceptos(): array
    {
        return array_values(self::CONCEPTOS);
    }

    public static function conceptoDe(string $conceptoDeEstancia): string
    {
        return self::CONCEPTOS[$conceptoDeEstancia] ?? throw self::noSeDescuenta($conceptoDeEstancia);
    }

    /** El nombre con el que el renglón sale en la prefactura y en el documento. */
    public static function nombreDe(string $conceptoDeEstancia): string
    {
        return 'Descuento '.self::etiquetaDe($conceptoDeEstancia);
    }

    public static function etiquetaDe(string $conceptoDeEstancia): string
    {
        return self::ETIQUETAS[$conceptoDeEstancia] ?? throw self::noSeDescuenta($conceptoDeEstancia);
    }

    /** La tarifa de ese tramo para esa matrícula, o `null` si no hay ninguna. */
    public static function tarifaDe(FactAeronave $satelite, string $conceptoDeEstancia): ?string
    {
        return match ($conceptoDeEstancia) {
            FactServicio::CONCEPTO_ESTANCIA_PERNOCTA => $satelite->tarifaPernocta(),
            FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H => $satelite->tarifaTransito2h(),
            FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H => $satelite->tarifaTransito12h(),
            default => throw self::noSeDescuenta($conceptoDeEstancia),
        };
    }

    /**
     * El precio del renglón: la tarifa en negativo, con los cuatro decimales de la
     * columna.
     *
     * Aritmética de cadenas y no float, como el resto del dinero de este módulo. El
     * valor absoluto es el `-abs()` del sistema viejo y no es decorativo: una tarifa
     * capturada en negativo produciría, sin él, un descuento positivo, o sea un cobro
     * que nadie pidió.
     */
    public static function precioDe(string $tarifa): string
    {
        $positiva = bccomp($tarifa, '0', 4) < 0 ? bcmul($tarifa, '-1', 4) : $tarifa;

        return bcmul($positiva, '-1', 4);
    }

    private static function noSeDescuenta(string $concepto): InvalidArgumentException
    {
        return new InvalidArgumentException("El concepto '{$concepto}' no admite descuento de estancia.");
    }
}
