<?php

namespace App\Http\Requests\Facturacion;

use App\Models\FactPrefactura;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePrefacturaRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'aeronave_id' => ['required', 'integer', 'exists:aeronaves,id'],
            'cliente_id' => ['nullable', 'integer', Rule::exists('fact_clientes', 'id')->where('status', 'A')],
            'llegada_at' => ['nullable', 'date'],
            'salida_at' => ['nullable', 'date', 'after_or_equal:llegada_at'],
            'origen' => ['nullable', 'string', 'max:120'],
            'destino' => ['nullable', 'string', 'max:120'],
            'operacion_llegada_id' => ['nullable', 'integer', 'exists:operaciones_diarias,id'],
            'operacion_salida_id' => ['nullable', 'integer', 'exists:operaciones_diarias,id'],
            'tipo_destino' => ['required', Rule::in([FactPrefactura::DESTINO_NACIONAL, FactPrefactura::DESTINO_INTERNACIONAL])],
        ];
    }

    public function messages(): array
    {
        return [
            'salida_at.after_or_equal' => 'La salida no puede ser anterior a la llegada.',
            'cliente_id.exists' => 'El cliente no existe o está dado de baja.',
        ];
    }
}
