<?php

namespace App\Http\Requests\Facturacion;

use Illuminate\Foundation\Http\FormRequest;

class StorePrecioCombustibleRequest extends FormRequest
{
    /** El acceso lo resuelve el middleware subdep:factCombustible. */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * El precio del combustible no puede ser cero (a diferencia de una tarifa de
     * matrícula, que sí puede ser una cortesía). El mínimo es 0.0001 y no `gt:0`:
     * un 0.00001 pasaría `gt:0` pero se guardaría como 0.0000 en decimal(10,4).
     * Sin precio Eolo se calcula con la fórmula de la configuración.
     */
    public function rules(): array
    {
        return [
            'precio_asa' => ['required', 'numeric', 'min:0.0001', 'max:999999.9999'],
            'precio_eolo' => ['nullable', 'numeric', 'min:0.0001', 'max:999999.9999'],
        ];
    }

    public function messages(): array
    {
        return [
            'precio_asa.required' => 'El precio ASA es obligatorio.',
            'precio_asa.numeric' => 'El precio ASA debe ser numérico.',
            'precio_asa.min' => 'El precio ASA debe ser de al menos 0.0001.',
            'precio_asa.max' => 'El precio ASA es demasiado grande.',
            'precio_eolo.numeric' => 'El precio Eolo debe ser numérico.',
            'precio_eolo.min' => 'El precio Eolo debe ser de al menos 0.0001.',
            'precio_eolo.max' => 'El precio Eolo es demasiado grande.',
        ];
    }
}
