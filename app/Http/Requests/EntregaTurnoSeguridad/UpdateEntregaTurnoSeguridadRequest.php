<?php

namespace App\Http\Requests\EntregaTurnoSeguridad;

use App\Models\EntregaTurnoSeguridad;
use App\Rules\DentroDeLaVentana;
use App\Support\VentanasDeFecha;
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

    /*
     * NO hace falta un `prepareForValidation` que pase `''` a `null`.
     *
     * Una versión anterior de este plan lo mandaba, razonando que `nullable`
     * solo se salta las reglas siguientes con `null` y no con `''`, y que un
     * formulario de React que arranque con `useState('')` chocaría con la
     * regex. El razonamiento es correcto en abstracto y falso aquí: Laravel
     * registra `ConvertEmptyStringsToNull` en su pila global de middleware
     * (`Foundation\Configuration\Middleware`) y `bootstrap/app.php` no lo
     * quita, así que la cadena vacía llega ya como `null`. El método era
     * código inalcanzable y su prueba pasaba sin él.
     */

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'fecha_hora' => $this->cambiaElDia()
                ? ['sometimes', 'date', new DentroDeLaVentana('seguridad.entrega_turno')]
                : ['sometimes', 'date'],
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

    /**
     * Si la fecha recibida es un día DISTINTO del que ya está guardado.
     *
     * La regla del proyecto al editar es «no puedes PONER una fecha fuera de
     * ventana, pero puedes DEJAR la que ya estaba». Sin esto, el FBO no
     * podría firmar un relevo de hace tres días: el formulario manda
     * `fecha_hora` siempre, esa fecha está fuera de «hoy y ayer», y el
     * servidor devolvería 422 —justo con los relevos viejos que la cola de
     * pendientes existe para sacar a flote, ordenados de más viejo primero.
     *
     * Tampoco se puede «lavar» una fecha: cada petición se juzga contra lo
     * que hay guardado en ese momento, así que pasar por una fecha válida y
     * volver a la vieja se rechaza en el segundo paso.
     *
     * El día se compara con `diaQueGuardaElModelo` y no con `Carbon::parse`,
     * por lo mismo que la regla: difieren con una cadena numérica y con un
     * desfase de zona.
     */
    private function cambiaElDia(): bool
    {
        $relevo = EntregaTurnoSeguridad::activas()->find($this->route('id'));

        if ($relevo === null) {
            return true;
        }

        $recibido = VentanasDeFecha::diaQueGuardaElModelo($this->input('fecha_hora'));

        return $recibido !== $relevo->fecha_hora?->toDateString();
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
