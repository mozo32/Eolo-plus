<?php

namespace App\Http\Requests\EntregaTurnoSeguridad;

use App\Rules\DentroDeLaVentana;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Lo que se admite al crear un relevo.
 *
 * `user_id` NO está en las reglas a propósito: el nombre de quien entrega
 * sale del usuario autenticado y no de la petición. Si estuviera aquí,
 * cualquiera podría firmar un relevo a nombre de otro.
 *
 * `fecha_hora` solo admite hoy y ayer (`seguridad.entrega_turno`).
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
            'fecha_hora' => ['required', 'date', new DentroDeLaVentana('seguridad.entrega_turno')],
            'observaciones' => ['nullable', 'string'],
            /*
             * El `=` solo se admite como relleno FINAL, y el cierre es `\z` y
             * no `$`.
             *
             * Con `[A-Za-z0-9+\/=]{16,}$` dieciséis `=` pasaban la
             * validación: `base64_decode` devolvía cadena vacía, se escribía
             * un archivo de cero bytes y se creaba el renglón de `Firma`. El
             * `detalle()` solo descarta las firmas cuyo archivo NO existe, y
             * éste existe, así que el relevo quedaba «firmado» con una imagen
             * rota. En este módulo la firma es lo que da valor al registro.
             *
             * El `\z` cierra además que `$` en PHP, sin el modificador `D`,
             * acepta un salto de línea final.
             *
             * La MISMA regla va en UpdateEntregaTurnoSeguridadRequest, tres
             * veces: si se cambia una, se cambian las cuatro.
             */
            'firma_quien_entrega' => [
                'required',
                'string',
                'regex:/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+\/]{16,}={0,2}\z/',
            ],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'firma_quien_entrega.required' => 'Falta la firma de quien entrega el turno.',
            'firma_quien_entrega.regex' => 'La firma de quien entrega no llegó como una imagen válida.',
        ];
    }
}
