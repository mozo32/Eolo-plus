<?php

namespace App\Services;

use RuntimeException;

/**
 * Se intentó CERRAR una prefactura que tiene combustible y un pago con AvCard activo.
 *
 * Es la misma regla que `PagosPrefactura` aplica al registrar el pago, vista desde el otro
 * extremo: allí el combustible ya está y llega el pago; aquí el pago ya estaba y el
 * combustible llegó después (la sincronización lo trae sola al abrir la pantalla). El cierre
 * es la puerta por la que sale un documento emitido, así que la regla se vuelve a comprobar
 * aquí: una vez dado el folio, el cobro doble ya salió.
 */
class AvcardConCombustibleException extends RuntimeException
{
    public const CODIGO = 'avcard_con_combustible';
}
