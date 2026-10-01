<?php

namespace App\Http\Requests\Facturacion;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRenglonRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'servicio_id' => ['required', 'integer', Rule::exists('fact_servicios', 'id')->where('status', 'A')],
            'cantidad' => ['required', 'integer', 'min:1', 'max:9999'],
            'proveedor_id' => ['nullable', 'integer', Rule::exists('fact_proveedores', 'id')->where('status', 'A')],
            'remision' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'servicio_id.exists' => 'El servicio no existe o está dado de baja.',
            'cantidad.min' => 'La cantidad debe ser al menos 1.',
        ];
    }
}
