<?php

namespace App\Http\Requests\EntregaTurnoSeguridad;

use App\Models\EntregaTurnoSeguridad;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Lo que se admite al editar un relevo.
 *
 * `user_id` no está, igual que al crear: el dueño del relevo no se
 * cambia. Por aquí entra también la firma del FBO, en `firma_fbo`.
 *
 * El rol se revisa en el controlador y no aquí, que es la costumbre del
 * proyecto: no hay `app/Policies`.
 */
class UpdateEntregaTurnoSeguridadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Una firma vacía es «no mandé firma», no una firma mal formada.
     *
     * `nullable` solo se salta las reglas siguientes cuando el valor es
     * `null`, no cuando es `''`. Un formulario de React que arranque con
     * `useState('')` manda la cadena vacía, y sin esto chocaría con la regex
     * y devolvería 422 por no haber firmado, que no es un error.
     */
    protected function prepareForValidation(): void
    {
        foreach (['firma_quien_entrega', 'firma_fbo'] as $campo) {
            if ($this->input($campo) === '') {
                $this->merge([$campo => null]);
            }
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'fecha_hora' => ['sometimes', 'date'],
            'seccion' => ['sometimes', Rule::in(EntregaTurnoSeguridad::SECCIONES)],
            'aviones_csae' => ['sometimes', 'boolean'],
            'combustible' => ['sometimes', 'boolean'],
            'resguardo_vehicular' => ['sometimes', 'boolean'],
            'estacionamiento' => ['sometimes', 'boolean'],
            'posiciones' => ['sometimes', 'boolean'],
            'vehiculos' => ['sometimes', 'boolean'],
            'operaciones' => ['sometimes', 'boolean'],
            'visitantes' => ['sometimes', 'boolean'],
            'pernocta_mensual' => ['sometimes', Rule::in(EntregaTurnoSeguridad::PERNOCTA_ESTADOS)],
            'observaciones' => ['sometimes', 'nullable', 'string'],
            /*
             * La misma regla de forma que al crear, y por lo mismo: sin ella
             * un PUT con `firma_fbo => "abc"` pasaba la validación, el guardia
             * hacía `return` en silencio y el relevo se quedaba sin la firma
             * del FBO mientras la respuesta decía que todo salió bien.
             *
             * `nullable` va por delante para que un `null` explícito —no
             * mandar firma— siga siendo válido: la regex solo juzga lo que
             * llega con contenido.
             */
            'firma_quien_entrega' => [
                'sometimes',
                'nullable',
                'string',
                'regex:/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+\/=]{16,}$/',
            ],
            'firma_fbo' => [
                'sometimes',
                'nullable',
                'string',
                'regex:/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+\/=]{16,}$/',
            ],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'seccion.in' => 'La sección solo puede ser frente o atrás.',
            'pernocta_mensual.in' => 'La pernocta mensual solo puede estar hecha, no hecha o sin revisar.',
            'firma_quien_entrega.regex' => 'La firma de quien entrega no llegó en un formato válido.',
            'firma_fbo.regex' => 'La firma del FBO no llegó en un formato válido.',
        ];
    }
}
