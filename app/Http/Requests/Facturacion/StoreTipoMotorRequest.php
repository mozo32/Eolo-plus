<?php

namespace App\Http\Requests\Facturacion;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTipoMotorRequest extends FormRequest
{
    /** El acceso lo resuelve el middleware subdep:factTiposMotor. */
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        // Solo se normaliza un valor escalar: un arreglo (nombre[]=x) debe llegar a la
        // validación y fallar con 422, no romper aquí con un 500.
        if (is_scalar($this->input('nombre')) || $this->input('nombre') === null) {
            $this->merge(['nombre' => trim((string) $this->input('nombre'))]);
        }
    }

    /** Cero es una tarifa de aterrizaje válida. */
    public function rules(): array
    {
        return [
            'nombre' => [
                'required', 'string', 'max:60',
                Rule::unique('fact_tipos_motor', 'nombre')->ignore($this->route('id')),
            ],
            'tarifa_aterrizaje' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
        ];
    }

    public function messages(): array
    {
        return [
            'nombre.required' => 'El nombre del tipo de motor es obligatorio.',
            'nombre.string' => 'El nombre del tipo de motor debe ser texto.',
            'nombre.max' => 'El nombre no puede pasar de 60 caracteres.',
            'nombre.unique' => 'Ya existe un tipo de motor con ese nombre.',
            'tarifa_aterrizaje.required' => 'La tarifa de aterrizaje es obligatoria.',
            'tarifa_aterrizaje.numeric' => 'La tarifa de aterrizaje debe ser numérica.',
            'tarifa_aterrizaje.min' => 'La tarifa de aterrizaje no puede ser negativa.',
            'tarifa_aterrizaje.max' => 'La tarifa de aterrizaje es demasiado grande.',
        ];
    }
}
