<?php

namespace App\Http\Requests\RelacionPlanta;

use App\Rules\DentroDeLaVentana;
use Illuminate\Foundation\Http\FormRequest;

class PrestarRelacionPlantaRequest extends FormRequest
{
    /** El acceso lo resuelve el middleware subdep:relacionPlanta. */
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'empresa' => trim((string) $this->input('empresa')),
            'matricula' => strtoupper(trim((string) $this->input('matricula'))),
        ]);
    }

    public function rules(): array
    {
        return [
            'fecha' => ['required', 'date_format:Y-m-d', new DentroDeLaVentana('planta.prestamo')],
            'empresa' => ['required', 'string', 'max:120'],
            'matricula' => ['required', 'string', 'max:20'],
            'horometro_inicio' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
        ];
    }

    public function messages(): array
    {
        return [
            'fecha.required' => 'La fecha es obligatoria.',
            'fecha.date_format' => 'La fecha debe tener el formato AAAA-MM-DD.',
            'empresa.required' => 'La empresa es obligatoria.',
            'matricula.required' => 'La matrícula es obligatoria.',
            'horometro_inicio.required' => 'El horómetro inicial es obligatorio.',
            'horometro_inicio.numeric' => 'El horómetro inicial debe ser numérico.',
            'horometro_inicio.min' => 'El horómetro inicial no puede ser negativo.',
        ];
    }
}
