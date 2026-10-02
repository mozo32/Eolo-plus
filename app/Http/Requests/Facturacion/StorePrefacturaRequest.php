<?php

namespace App\Http\Requests\Facturacion;

use App\Models\FactPrefactura;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePrefacturaRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'aeronave_id' => ['required', 'integer', 'exists:aeronaves,id'],
            'cliente_id' => ['nullable', 'integer', Rule::exists('fact_clientes', 'id')->where('status', 'A')],
            'llegada_at' => ['nullable', 'date'],
            'salida_at' => ['nullable', 'date', 'after_or_equal:llegada_at'],
            'origen' => ['nullable', 'string', 'max:120'],
            'destino' => ['nullable', 'string', 'max:120'],
            'operacion_llegada_id' => ['nullable', 'integer', 'exists:operaciones_diarias,id'],
            'operacion_salida_id' => ['nullable', 'integer', 'exists:operaciones_diarias,id'],
            // Un borrador SIEMPRE se abre nacional. El destino internacional lo pone
            // `PrefacturaRenglonController::internacional()` y solo si agregó el paquete:
            // aceptarlo aquí crearía, por API, una prefactura que dice Internacional sin
            // los servicios del paquete y sin el botón del editor para agregarlos.
            'tipo_destino' => [
                'required',
                Rule::in([FactPrefactura::DESTINO_NACIONAL, FactPrefactura::DESTINO_INTERNACIONAL]),
                function (string $atributo, mixed $valor, Closure $falla): void {
                    if ($valor === FactPrefactura::DESTINO_INTERNACIONAL) {
                        $falla('Un borrador se abre como nacional; el paquete internacional se agrega después desde el editor.');
                    }
                },
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'aeronave_id.required' => 'La matrícula es obligatoria.',
            'aeronave_id.integer' => 'La matrícula no es válida.',
            'aeronave_id.exists' => 'La matrícula no existe.',
            'cliente_id.integer' => 'El cliente no es válido.',
            'cliente_id.exists' => 'El cliente no existe o está dado de baja.',
            'llegada_at.date' => 'La fecha de llegada no es una fecha válida.',
            'salida_at.date' => 'La fecha de salida no es una fecha válida.',
            'salida_at.after_or_equal' => 'La salida no puede ser anterior a la llegada.',
            'origen.string' => 'El origen debe ser texto.',
            'origen.max' => 'El origen no puede pasar de 120 caracteres.',
            'destino.string' => 'El destino debe ser texto.',
            'destino.max' => 'El destino no puede pasar de 120 caracteres.',
            'operacion_llegada_id.integer' => 'La operación de llegada no es válida.',
            'operacion_llegada_id.exists' => 'La operación de llegada no existe.',
            'operacion_salida_id.integer' => 'La operación de salida no es válida.',
            'operacion_salida_id.exists' => 'La operación de salida no existe.',
            'tipo_destino.required' => 'Indica si el destino es nacional o internacional.',
            'tipo_destino.in' => 'El tipo de destino debe ser nacional o internacional.',
        ];
    }
}
