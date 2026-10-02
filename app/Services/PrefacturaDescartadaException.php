<?php

namespace App\Services;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * Se intentó cerrar, o cobrar, un borrador descartado: cerrarlo consumiría un folio para un
 * documento que la lista nunca muestra, y un pago sobre él quedaría en un documento que nadie ve.
 */
class PrefacturaDescartadaException extends RuntimeException
{
    /**
     * Para un cliente HTTP siempre significa lo mismo: el borrador está descartado y no se
     * toca. Se mapea aquí, en un solo lugar, igual que `RenglonDePrefacturaCerradaException`,
     * y ningún controlador tiene que acordarse de atraparla.
     */
    public function render(): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage() ?: 'Este borrador está descartado: ya no se puede modificar ni cerrar.',
            'codigo' => 'ya_descartada',
        ], 409);
    }
}
