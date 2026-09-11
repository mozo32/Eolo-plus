<?php

namespace App\Http\Requests\MatriculaRestringida;

use App\Models\MatriculaRestringida;
use Illuminate\Foundation\Http\FormRequest;

class StoreMatriculaRestringidaRequest extends FormRequest
{
    /**
     * El acceso lo resuelve el middleware subdep:operacionesProgramadas.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Se normaliza igual que en el resto del sistema: sin espacios sobrantes,
     * en mayúsculas y conservando los guiones.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'matricula' => MatriculaRestringida::normalizar($this->input('matricula')),
        ]);
    }

    public function rules(): array
    {
        return [
            'matricula' => ['required', 'string', 'max:20'],
        ];
    }

    public function messages(): array
    {
        return [
            'matricula.required' => 'Captura la matrícula que deseas restringir.',
        ];
    }

    public function matriculaNormalizada(): string
    {
        return $this->validated()['matricula'];
    }
}
