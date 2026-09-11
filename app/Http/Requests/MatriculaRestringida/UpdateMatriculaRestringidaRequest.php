<?php

namespace App\Http\Requests\MatriculaRestringida;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Cambio de los switches. Cada uno se puede mandar por separado: lo que no
 * viaja, no se toca.
 */
class UpdateMatriculaRestringidaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'llegada' => ['sometimes', 'boolean'],
            'salida' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * Solo los campos realmente enviados, ya convertidos a booleano.
     */
    public function cambios(): array
    {
        $cambios = [];

        foreach (['llegada', 'salida'] as $campo) {
            if ($this->has($campo)) {
                $cambios[$campo] = $this->boolean($campo);
            }
        }

        return $cambios;
    }
}
