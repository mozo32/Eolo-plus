<?php

namespace App\Http\Requests\EntregaTurnoSeguridad;

use App\Models\EntregaTurnoSeguridad;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Lo que se admite al crear un relevo.
 *
 * `user_id` NO está en las reglas a propósito: el nombre de quien entrega
 * sale del usuario autenticado y no de la petición. Si estuviera aquí,
 * cualquiera podría firmar un relevo a nombre de otro.
 *
 * La regla de ventana de fecha se agrega en la Tarea 8, cuando el
 * formulario ya exista: una clave usada en un solo lado deja en rojo
 * `tests/Feature/VentanasDeFechaTest.php`.
 */
class StoreEntregaTurnoSeguridadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'fecha_hora' => ['required', 'date'],
            'seccion' => ['required', Rule::in(EntregaTurnoSeguridad::SECCIONES)],
            'aviones_csae' => ['sometimes', 'boolean'],
            'combustible' => ['sometimes', 'boolean'],
            'resguardo_vehicular' => ['sometimes', 'boolean'],
            'estacionamiento' => ['sometimes', 'boolean'],
            'posiciones' => ['sometimes', 'boolean'],
            'vehiculos' => ['sometimes', 'boolean'],
            'operaciones' => ['sometimes', 'boolean'],
            'visitantes' => ['sometimes', 'boolean'],
            'pernocta_mensual' => ['sometimes', Rule::in(EntregaTurnoSeguridad::PERNOCTA_ESTADOS)],
            'observaciones' => ['nullable', 'string'],
            'firma_quien_entrega' => ['required', 'string'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'seccion.required' => 'Hay que decir si el relevo es del frente o de atrás.',
            'seccion.in' => 'La sección solo puede ser frente o atrás.',
            'pernocta_mensual.in' => 'La pernocta mensual solo puede estar hecha, no hecha o sin revisar.',
            'firma_quien_entrega.required' => 'Falta la firma de quien entrega el turno.',
        ];
    }
}
