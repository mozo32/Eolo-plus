<?php

namespace App\Http\Requests\EntregaTurnoSeguridad;

use App\Models\EntregaTurnoSeguridad;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Lo que se admite en el query string del listado.
 *
 * Existe por un 500 al alcance de cualquiera con sesión: un `?search[]=x`
 * llegaba como arreglo a `$request->string('search')` y lanzaba `TypeError`.
 * Y `estado` era peor, porque su `->string()` corría SIN guardia de `filled`,
 * así que un `?estado[]=1` reventaba siempre. No había consecuencia de
 * seguridad —todo va con bindings—, pero el CLAUDE.md del proyecto pide Form
 * Request para validar y aquí no había ninguno.
 *
 * El piso y el techo de `per_page` NO se repiten aquí: los aplica el
 * controlador, y hay pruebas que exigen que un 0 o un -5 den 1 y que un
 * 100000 dé 100. Lo único que hace falta es que sea un entero para que un
 * arreglo no llegue nunca a `->integer()`.
 */
class IndexEntregaTurnoSeguridadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer'],
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
            'seccion' => ['sometimes', 'nullable', Rule::in(EntregaTurnoSeguridad::SECCIONES)],
            'estado' => ['sometimes', 'nullable', Rule::in(['falta_fbo', 'completas'])],
            'fecha_inicio' => ['sometimes', 'nullable', 'date'],
            'fecha_fin' => ['sometimes', 'nullable', 'date'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'seccion.in' => 'La sección solo puede ser frente o atrás.',
            'estado.in' => 'El estado solo puede ser «falta la firma del FBO» o «completas».',
            'search.max' => 'El texto que se busca es demasiado largo.',
        ];
    }
}
