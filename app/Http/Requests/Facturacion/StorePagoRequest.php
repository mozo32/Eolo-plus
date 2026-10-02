<?php

namespace App\Http\Requests\Facturacion;

use App\Models\FactFormaPago;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePagoRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'forma_pago_id' => [
                'required', 'integer',
                Rule::exists('fact_formas_pago', 'id')->where('status', FactFormaPago::STATUS_ACTIVO),
            ],
            // `decimal:0,2` rechaza 1.234; `min:0.01` rechaza 0 y los negativos. El monto
            // viaja como cadena a propósito: entra a `bc` sin pasar por float.
            'monto' => ['required', 'numeric', 'decimal:0,2', 'min:0.01', 'max:9999999999.99'],
        ];
    }

    public function messages(): array
    {
        return [
            'forma_pago_id.required' => 'Indica la forma de pago.',
            'forma_pago_id.exists' => 'Esa forma de pago no existe o está dada de baja.',
            'monto.required' => 'Indica el monto del pago.',
            'monto.decimal' => 'El monto no puede tener más de dos decimales.',
            'monto.min' => 'El monto tiene que ser mayor que cero.',
        ];
    }
}
