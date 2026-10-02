<?php

namespace App\Services;

use RuntimeException;

/**
 * Una regla de cobro rechazó el pago. Lleva su propio `codigo` para que el
 * controlador lo traduzca a 422 sin una cadena de `catch` por cada regla: las
 * reglas son del dominio y su identificador viaja con la excepción.
 */
class PagoNoPermitidoException extends RuntimeException
{
    public function __construct(string $mensaje, public readonly string $codigo)
    {
        parent::__construct($mensaje);
    }
}
