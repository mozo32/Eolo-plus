<?php

namespace App\Services;

use DomainException;

/**
 * Se intentó crear, modificar, mover o borrar un renglón de una prefactura cerrada.
 *
 * Una prefactura cerrada es un documento que ya salió al cliente: su sello
 * (`*_sellado`) es una foto, y un renglón que cambie debajo de esa foto es
 * justamente el defecto de los 37 encabezados del sistema viejo cuyo total no
 * corresponde a sus renglones. Lo lanza el propio modelo del renglón, de modo que
 * el invariante no depende de que cada controlador se acuerde de revisarlo.
 */
class RenglonDePrefacturaCerradaException extends DomainException
{
    public function __construct(string $message = 'La prefactura está cerrada: sus renglones ya no se pueden modificar.')
    {
        parent::__construct($message);
    }
}
