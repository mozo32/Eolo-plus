<?php

namespace App\Services;

use DomainException;
use Illuminate\Http\JsonResponse;

/**
 * Se intentó crear, modificar, mover o borrar un renglón de una prefactura cerrada.
 *
 * Una prefactura cerrada es un documento que ya salió al cliente: su sello
 * (`*_sellado`) es una foto, y un renglón que cambie debajo de esa foto es
 * justamente el defecto de los 830 encabezados del sistema viejo cuyo total no
 * corresponde a sus renglones (el 22% de sus 3,764 folios). Lo lanza el propio
 * modelo del renglón, de modo que el invariante no depende de que cada controlador
 * se acuerde de revisarlo.
 */
class RenglonDePrefacturaCerradaException extends DomainException
{
    public function __construct(string $message = 'La prefactura está cerrada: sus renglones ya no se pueden modificar.')
    {
        parent::__construct($message);
    }

    /**
     * Siempre significa lo mismo para un cliente HTTP: la prefactura esta cerrada y
     * no se puede tocar. Se mapea aqui, en un solo lugar, porque esta excepcion la
     * lanzan la guarda del modelo y las dos operaciones de CargosEstancia.
     */
    public function render(): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'codigo' => 'ya_cerrada',
        ], 409);
    }
}
