<?php

namespace App\Http\Requests\Facturacion;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProveedorRequest extends FormRequest
{
    /** El acceso lo resuelve el middleware subdep:factProveedores. */
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
                'required', 'string', 'max:120',
                Rule::unique('fact_proveedores', 'nombre')->ignore($this->route('id')),
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'nombre.required' => 'El nombre del proveedor es obligatorio.',
            'nombre.string' => 'El nombre del proveedor debe ser texto.',
            'nombre.max' => 'El nombre no puede pasar de 120 caracteres.',
            'nombre.unique' => 'Ya existe un proveedor con ese nombre.',
        ];
    }
}
