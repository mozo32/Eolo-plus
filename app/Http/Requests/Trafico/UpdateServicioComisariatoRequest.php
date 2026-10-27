<?php

namespace App\Http\Requests\Trafico;

use App\Models\ServicioComisariato;
use App\Rules\DentroDeLaVentana;
use App\Rules\ProveedorDeComisariato;
use App\Support\VentanasDeFecha;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateServicioComisariatoRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'proveedorId' => ['bail', 'required', 'integer', new ProveedorDeComisariato($this->route('servicioComisariato')?->fact_servicio_id)],
            'formaPago' => ['nullable', 'string', 'max:100'],
            'fechaEntrega' => $this->reglasDeLaFecha(),
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
