<?php

namespace App\Http\Requests\RelacionPlanta;

use Illuminate\Foundation\Http\FormRequest;

class FinalizarRelacionPlantaRequest extends FormRequest
{
    /** El acceso lo resuelve el middleware subdep:relacionPlanta. */
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        // Un tiempo vacío significa "calcúlalo tú".
        if ($this->input('tiempo') === '') {
            $this->merge(['tiempo' => null]);
        }
    }

    public function rules(): array
    {
        return [
            'horometro_fin' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
            'tiempo' => ['nullable', 'numeric', 'min:0', 'max:999999.99'],
        ];
    }

    public function messages(): array
    {
        return [
            'horometro_fin.required' => 'El horómetro final es obligatorio.',
            'horometro_fin.numeric' => 'El horómetro final debe ser numérico.',
            'horometro_fin.min' => 'El horómetro final no puede ser negativo.',
            'tiempo.numeric' => 'El tiempo de uso debe ser numérico.',
            'tiempo.min' => 'El tiempo de uso no puede ser negativo.',
        ];
    }
}
