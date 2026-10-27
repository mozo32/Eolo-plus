<?php

namespace App\Http\Requests\Trafico;

use App\Rules\DentroDeLaVentana;
use App\Rules\ProveedorDeComisariato;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreServicioComisariatoRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'proveedorId' => ['bail', 'required', 'integer', new ProveedorDeComisariato],
            'formaPago' => ['nullable', 'string', 'max:100'],
            'fechaEntrega' => ['required', 'date', new DentroDeLaVentana('comisariato.entrega')],
            'horaEntrega' => ['required', 'date_format:H:i'],
            // La matricula se elige de la lista de aeronaves registradas: el alta ya no las crea.
            // Antes, el controlador llamaba a `buscarOCrear()` con lo que se tecleara, y de ahi
            // salieron matriculas duplicadas que son la misma aeronave con otra grafia.
            'matricula' => ['nullable', 'string', 'max:50', Rule::exists('aeronaves', 'matricula')],
            'detalle' => ['nullable', 'string'],
            'solicitadoPor' => ['nullable', 'string', 'max:150'],
            'atendio' => ['nullable', 'string', 'max:150'],
            'subtotal' => ['required', 'numeric', 'min:0'],
            'total' => ['required', 'numeric', 'min:0'],
        ];
    }

    public function messages(): array
    {
        return [
            'matricula.exists' => 'Esa matricula no esta registrada. Da de alta la aeronave antes de capturar el comisariato.',
            'proveedorId.required' => 'Elige el proveedor del comisariato.',
            'proveedorId.integer' => 'El proveedor no es válido.',
            'fechaEntrega.required' => 'La fecha de entrega es obligatoria.',
            'horaEntrega.required' => 'La hora de entrega es obligatoria.',
            'horaEntrega.date_format' => 'La hora de entrega va en formato de 24 horas, HH:MM.',
            'subtotal.required' => 'El subtotal es obligatorio.',
            'total.required' => 'El total es obligatorio.',
        ];
    }
}
