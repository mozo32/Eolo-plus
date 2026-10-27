<?php

namespace App\Http\Requests\Trafico;

use App\Rules\DentroDeLaVentana;
use App\Rules\ProveedorDeComisariato;
use Illuminate\Foundation\Http\FormRequest;

class StoreServicioComisariatoRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'proveedorId' => ['bail', 'required', 'integer', new ProveedorDeComisariato],
            'formaPago' => ['nullable', 'string', 'max:100'],
            'fechaEntrega' => ['required', 'date', new DentroDeLaVentana('comisariato.entrega')],
            'horaEntrega' => ['required', 'date_format:H:i'],
            'matricula' => ['nullable', 'string', 'max:50'],
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
