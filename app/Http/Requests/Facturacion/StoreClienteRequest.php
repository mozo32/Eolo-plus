<?php

namespace App\Http\Requests\Facturacion;

use Illuminate\Foundation\Http\FormRequest;

class StoreClienteRequest extends FormRequest
{
    /** El acceso lo resuelve el middleware subdep:factClientes. */
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

    /**
     * Ni el RFC ni el nombre llevan `unique`: el RFC genérico XAXX010101000 lo
     * comparten 22 clientes reales, y nada garantiza que dos clientes distintos
     * no se llamen igual.
     */
    public function rules(): array
    {
        return [
            'nombre' => ['required', 'string', 'max:160'],
            'rfc' => ['nullable', 'string', 'max:20'],
            'correo' => ['nullable', 'email', 'max:120'],
            'telefono' => ['nullable', 'string', 'max:20'],
        ];
    }

    public function messages(): array
    {
        return [
            'nombre.required' => 'El nombre del cliente es obligatorio.',
            'nombre.string' => 'El nombre del cliente debe ser texto.',
            'nombre.max' => 'El nombre no puede pasar de 160 caracteres.',
            'rfc.string' => 'El RFC debe ser texto.',
            'rfc.max' => 'El RFC no puede pasar de 20 caracteres.',
            'correo.email' => 'El correo no tiene un formato válido.',
            'correo.max' => 'El correo no puede pasar de 120 caracteres.',
            'telefono.string' => 'El teléfono debe ser texto.',
            'telefono.max' => 'El teléfono no puede pasar de 20 caracteres.',
        ];
    }
}
