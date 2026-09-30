<?php

namespace App\Http\Requests\Facturacion;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFormaPagoRequest extends FormRequest
{
    /** El acceso lo resuelve el middleware subdep:factFormasPago. */
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

    /** En la edición el nombre se compara contra las demás filas, no contra sí misma. */
    public function rules(): array
    {
        return [
            'nombre' => [
                'required', 'string', 'max:60',
                Rule::unique('fact_formas_pago', 'nombre')->ignore($this->route('id')),
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'nombre.required' => 'El nombre de la forma de pago es obligatorio.',
            'nombre.string' => 'El nombre de la forma de pago debe ser texto.',
            'nombre.max' => 'El nombre no puede pasar de 60 caracteres.',
            'nombre.unique' => 'Ya existe una forma de pago con ese nombre.',
        ];
    }
}
