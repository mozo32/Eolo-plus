<?php

namespace App\Http\Requests\Facturacion;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Las tres notas, todas opcionales. `sometimes` y no `nullable` a secas: una clave
 * ausente deja la nota como estaba, y una clave con `null` la vacía. Sin
 * `sometimes`, guardar solo la externa borraría las otras dos.
 */
class UpdateNotasRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'nota_interna' => ['sometimes', 'nullable', 'string', 'max:200'],
            'nota_externa' => ['sometimes', 'nullable', 'string', 'max:200'],
            'nota_factura' => ['sometimes', 'nullable', 'string', 'max:100'],
        ];
    }

    public function messages(): array
    {
        return [
            'nota_interna.max' => 'La nota interna no puede pasar de 200 caracteres.',
            'nota_externa.max' => 'La nota externa no puede pasar de 200 caracteres.',
            'nota_factura.max' => 'La nota de factura no puede pasar de 100 caracteres.',
            'nota_interna.string' => 'La nota interna debe ser texto.',
            'nota_externa.string' => 'La nota externa debe ser texto.',
            'nota_factura.string' => 'La nota de factura debe ser texto.',
        ];
    }
}
