<?php

namespace App\Http\Requests\ServicioComisariato;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Lo que se admite al subir UNA evidencia.
 *
 * Una foto por petición y no todas juntas: veinte imágenes en base64 dentro
 * de un solo cuerpo chocan con `post_max_size` de PHP, y un fallo tumbaría
 * la tanda entera en vez de una foto.
 */
class GuardarEvidenciaComisariatoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            /*
             * El `=` solo se admite como relleno FINAL, y el cierre es `\z`.
             *
             * Con `[A-Za-z0-9+\/=]{16,}$` dieciséis `=` pasaban la validación:
             * `base64_decode` devolvía cadena vacía, se escribía un archivo de
             * cero bytes y se creaba el renglón de la imagen. En un módulo de
             * evidencias, una foto de cero bytes es una prueba que no existe.
             *
             * El `\z` cierra además que `$` en PHP, sin el modificador `D`,
             * acepta un salto de línea final.
             *
             * Es la MISMA regla que usa el módulo de Seguridad para las firmas:
             * si se cambia una, se cambian las dos.
             */
            'foto' => [
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
            'foto.required' => 'No llegó ninguna fotografía.',
            'foto.regex' => 'La fotografía no llegó como una imagen válida.',
        ];
    }
}
