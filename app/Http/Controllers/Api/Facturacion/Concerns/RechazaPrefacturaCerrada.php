<?php

namespace App\Http\Controllers\Api\Facturacion\Concerns;

use App\Models\FactPrefactura;
use Illuminate\Http\JsonResponse;

/**
 * Una prefactura cerrada es un documento que ya salió al cliente: no se edita.
 * Lo hace cumplir el endpoint, no solo la pantalla.
 *
 * Esto es el camino rápido: rechaza el caso común antes de abrir transacción. No
 * sustituye al candado: entre esta comprobación y el candado de la operación otra
 * sesión puede cerrar, y ahí la excepción de dominio
 * (`RenglonDePrefacturaCerradaException`) se traduce sola a 409.
 */
trait RechazaPrefacturaCerrada
{
    private function rechazarSiCerrada(FactPrefactura $prefactura): ?JsonResponse
    {
        if (! $prefactura->estaCerrada()) {
            return null;
        }

        return response()->json([
            'message' => 'Esta prefactura ya está cerrada: un documento emitido no se modifica.',
            'codigo' => 'ya_cerrada',
        ], 409);
    }

    /**
     * Un borrador descartado salió de la lista: no se le agregan renglones ni se
     * cierra (cerrarlo consumiría un folio para un documento que nadie ve).
     */
    private function rechazarSiDescartada(FactPrefactura $prefactura): ?JsonResponse
    {
        if ($prefactura->status !== FactPrefactura::STATUS_INACTIVO) {
            return null;
        }

        return response()->json([
            'message' => 'Este borrador está descartado: ya no se puede modificar ni cerrar.',
            'codigo' => 'ya_descartada',
        ], 409);
    }

    /**
     * El camino rápido completo: una cerrada y un borrador descartado se rechazan
     * igual, con el mismo orden (primero la cerrada). Lo comparten todas las
     * escrituras sobre una prefactura: renglones y pagos.
     */
    private function rechazoRapido(FactPrefactura $prefactura): ?JsonResponse
    {
        return $this->rechazarSiCerrada($prefactura) ?? $this->rechazarSiDescartada($prefactura);
    }
}
