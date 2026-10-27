<?php

namespace App\Http\Requests\Trafico;

use App\Models\FactCategoriaServicio;
use App\Models\FactServicio;
use App\Models\ServicioComisariato;
use App\Rules\DentroDeLaVentana;
use App\Support\VentanasDeFecha;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateServicioComisariatoRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'proveedorId' => ['bail', 'required', 'integer', Rule::exists('fact_servicios', 'id')->where('status', 'A'), $this->esProveedorDeComisariato(...)],
            'formaPago' => ['nullable', 'string', 'max:100'],
            'fechaEntrega' => $this->reglasDeLaFecha(),
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
     * Una edición solo juzga la fecha de entrega cuando CAMBIA.
     *
     * Un servicio guardado con una fecha que ya quedó fuera de la ventana conserva esa fecha
     * intacta; exigirle la ventana bloquearía cualquier corrección del resto del registro. Lo
     * que la ventana impide es poner una fecha fuera de ella.
     *
     * @return array<int, mixed>
     */
    protected function reglasDeLaFecha(): array
    {
        $comisariato = $this->route('servicioComisariato');
        $recibidaComoDia = VentanasDeFecha::diaQueGuardaElModelo($this->input('fechaEntrega'));

        $noCambia = $comisariato instanceof ServicioComisariato
            && $recibidaComoDia !== null
            && $recibidaComoDia === $comisariato->fecha_entrega?->toDateString();

        return $noCambia
            ? ['required', 'date']
            : ['required', 'date', new DentroDeLaVentana('comisariato.entrega')];
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
