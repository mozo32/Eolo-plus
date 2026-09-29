<?php

namespace App\Http\Requests\Facturacion;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCategoriaAeronaveRequest extends FormRequest
{
    /** El acceso lo resuelve el middleware subdep:factCategoriasAeronave. */
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['nombre' => trim((string) $this->input('nombre'))]);
    }

    /**
     * Cero es una tarifa válida (una cortesía): el mínimo es 0, nunca "no vacío".
     * En la edición el nombre se compara contra las demás categorías, no contra sí misma.
     */
    public function rules(): array
    {
        return [
            'nombre' => [
                'required', 'string', 'max:60',
                Rule::unique('fact_categorias_aeronave', 'nombre')->ignore($this->route('id')),
            ],
            'tarifa_pernocta' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
            'tarifa_transito_2h' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
            'tarifa_transito_12h' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
        ];
    }

    public function messages(): array
    {
        return [
            'nombre.required' => 'El nombre de la categoría es obligatorio.',
            'nombre.max' => 'El nombre no puede pasar de 60 caracteres.',
            'nombre.unique' => 'Ya existe una categoría con ese nombre.',
            'tarifa_pernocta.required' => 'La tarifa de pernocta es obligatoria.',
            'tarifa_pernocta.numeric' => 'La tarifa de pernocta debe ser numérica.',
            'tarifa_pernocta.min' => 'La tarifa de pernocta no puede ser negativa.',
            'tarifa_pernocta.max' => 'La tarifa de pernocta es demasiado grande.',
            'tarifa_transito_2h.required' => 'La tarifa de tránsito de 2 horas es obligatoria.',
            'tarifa_transito_2h.numeric' => 'La tarifa de tránsito de 2 horas debe ser numérica.',
            'tarifa_transito_2h.min' => 'La tarifa de tránsito de 2 horas no puede ser negativa.',
            'tarifa_transito_2h.max' => 'La tarifa de tránsito de 2 horas es demasiado grande.',
            'tarifa_transito_12h.required' => 'La tarifa de tránsito de 12 horas es obligatoria.',
            'tarifa_transito_12h.numeric' => 'La tarifa de tránsito de 12 horas debe ser numérica.',
            'tarifa_transito_12h.min' => 'La tarifa de tránsito de 12 horas no puede ser negativa.',
            'tarifa_transito_12h.max' => 'La tarifa de tránsito de 12 horas es demasiado grande.',
        ];
    }
}
