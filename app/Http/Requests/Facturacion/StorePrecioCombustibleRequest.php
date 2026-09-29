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
     * El precio del combustible no puede ser cero (a diferencia de una tarifa
     * de matrícula, que sí puede ser una cortesía). Sin precio Eolo se calcula
     * con la fórmula de la configuración.
     */
    public function rules(): array
    {
        return [
            'precio_asa' => ['required', 'numeric', 'gt:0', 'max:999999.9999'],
            'precio_eolo' => ['nullable', 'numeric', 'gt:0', 'max:999999.9999'],
        ];
    }

    public function messages(): array
    {
        return [
            'precio_asa.required' => 'El precio ASA es obligatorio.',
            'precio_asa.numeric' => 'El precio ASA debe ser numérico.',
            'precio_asa.gt' => 'El precio ASA debe ser mayor que cero.',
            'precio_asa.max' => 'El precio ASA es demasiado grande.',
            'precio_eolo.numeric' => 'El precio Eolo debe ser numérico.',
            'precio_eolo.gt' => 'El precio Eolo debe ser mayor que cero.',
            'precio_eolo.max' => 'El precio Eolo es demasiado grande.',
        ];
    }
}
