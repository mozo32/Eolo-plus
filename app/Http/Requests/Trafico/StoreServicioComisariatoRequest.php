<?php

namespace App\Http\Requests\Trafico;

use App\Models\FactCategoriaServicio;
use App\Models\FactServicio;
use App\Rules\DentroDeLaVentana;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreServicioComisariatoRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            // `bail`: la comprobación de la categoría consulta el catálogo y solo tiene sentido si el servicio existe.
            'proveedorId' => ['bail', 'required', 'integer', Rule::exists('fact_servicios', 'id')->where('status', 'A'), $this->esProveedorDeComisariato(...)],
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

    /**
     * Que el servicio exista no basta: tiene que ser de la categoría Comisariatos.
     *
     * Sin esta comprobación, el id de Combustible o de un Tránsito pasaría, y el comisariato
     * acabaría cobrándose como otra cosa, con el margen y el ajuste de otro servicio.
     */
    protected function esProveedorDeComisariato(string $atributo, mixed $valor, \Closure $fallar): void
    {
        $esDeComisariato = FactServicio::query()
            ->whereKey($valor)
            ->whereIn('categoria_servicio_id', FactCategoriaServicio::where('nombre', 'Comisariatos')->select('id'))
            ->exists();

        if (! $esDeComisariato) {
            $fallar('Ese proveedor no es de comisariato.');
        }
    }

    public function messages(): array
    {
        return [
            'proveedorId.required' => 'Elige el proveedor del comisariato.',
            'proveedorId.integer' => 'El proveedor no es válido.',
            'proveedorId.exists' => 'Ese proveedor no existe o está dado de baja.',
            'fechaEntrega.required' => 'La fecha de entrega es obligatoria.',
            'horaEntrega.required' => 'La hora de entrega es obligatoria.',
            'horaEntrega.date_format' => 'La hora de entrega va en formato de 24 horas, HH:MM.',
            'subtotal.required' => 'El subtotal es obligatorio.',
            'total.required' => 'El total es obligatorio.',
        ];
    }
}
