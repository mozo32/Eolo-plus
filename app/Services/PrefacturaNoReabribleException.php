<?php

namespace App\Services;

use DomainException;
use Illuminate\Http\JsonResponse;

/**
 * No se puede reabrir: no está cerrada, o su sello no coincide con sus renglones.
 *
 * Lo segundo importa más de lo que parece: reabrir guarda una instantánea, y guardar como
 * «esto es lo que se imprimió» un documento del que el propio sistema sabe que no cuadra
 * convertiría una discrepancia detectable en un registro histórico falso.
 */
class PrefacturaNoReabribleException extends DomainException
{
    /**
     * Se mapea aquí, igual que `RenglonDePrefacturaCerradaException`: Laravel llama a
     * `render()` por convención, no a otro nombre.
     */
    public function render(): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'codigo' => 'no_reabrible',
        ], 409);
    }
}
