<?php

namespace App\Http\Requests\Facturacion;

/**
 * El pago Amex no lleva `forma_pago_id`: la forma la resuelve el servicio por su
 * concepto, porque este endpoint es solo de Amex. Las reglas del monto son las
 * mismas, y heredarlas evita que las dos se desalineen.
 */
class StorePagoAmexRequest extends StorePagoRequest
{
    public function rules(): array
    {
        $reglas = parent::rules();
        unset($reglas['forma_pago_id']);

        return $reglas;
    }

    public function messages(): array
    {
        $mensajes = parent::messages();
        unset($mensajes['forma_pago_id.required'], $mensajes['forma_pago_id.exists']);

        return $mensajes;
    }
}
