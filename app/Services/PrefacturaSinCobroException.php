<?php

namespace App\Services;

use RuntimeException;

/**
 * Se intentó cerrar una prefactura cuyos pagos no cubren el total, sin confirmarlo.
 *
 * No es un error del operador: el sistema viejo imprime sin cobrar y 289 de sus
 * 3,764 folios cerrados no tienen ningún pago. Lo que no hacía era DECIRLO.
 */
class PrefacturaSinCobroException extends RuntimeException
{
    public function __construct(public readonly string $faltante)
    {
        parent::__construct("Faltan {$faltante} por cobrar. Confirma si quieres cerrar la prefactura sin el cobro completo.");
    }
}
