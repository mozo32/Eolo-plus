<?php

namespace App\Services;

use App\Models\FactFormaPago;
use App\Models\FactPrefactura;
use App\Models\FactPrefacturaPago;
use App\Models\FactServicio;

/**
 * La regla: un mismo documento NO puede llevar combustible y un pago con AvCard.
 *
 * AvCard liquida el combustible por su cuenta, así que cobrarle además el renglón al cliente
 * es cobrarlo dos veces.
 *
 * Vive aquí, en un solo sitio, porque se comprueba en DOS puntos del camino y en los dos tiene
 * que significar lo mismo:
 *
 * 1. Al REGISTRAR el pago (`PagosPrefactura`): el combustible ya está y llega el pago.
 * 2. Al CERRAR (`CierrePrefactura`): el pago ya estaba y el combustible llegó después —la
 *    sincronización de remisiones lo trae sola al abrir la pantalla—. Sin esta segunda, el
 *    documento sale emitido y con folio en el estado que la primera existe para impedir.
 *
 * El combustible se reconoce por CONCEPTO y no por el nombre del servicio, que se edita en el
 * catálogo y además queda congelado en el renglón.
 */
final class ReglaAvcardSinCombustible
{
    /** El código con el que las dos vías nombran esta regla en sus respuestas. */
    public const CODIGO = 'avcard_con_combustible';

    public static function tieneCombustible(FactPrefactura $prefactura): bool
    {
        return $prefactura->renglones()
            ->where('concepto', FactServicio::CONCEPTO_COMBUSTIBLE)
            ->exists();
    }

    /**
     * El pago con AvCard ACTIVO de la prefactura, o null.
     *
     * Sale de `pagos()`, que ya filtra la baja lógica: un pago retirado no bloquea nada, y
     * retirarlo es justo la salida que el mensaje del cierre le ofrece al operador.
     */
    public static function pagoAvcard(FactPrefactura $prefactura): ?FactPrefacturaPago
    {
        return $prefactura->pagos()
            ->whereHas('formaPago', fn ($consulta) => $consulta->where('concepto', FactFormaPago::CONCEPTO_AVCARD))
            ->with('formaPago')
            ->first();
    }
}
