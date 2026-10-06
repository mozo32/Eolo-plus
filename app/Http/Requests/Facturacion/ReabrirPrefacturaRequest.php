<?php

namespace App\Http\Requests\Facturacion;

use Illuminate\Foundation\Http\FormRequest;

/**
 * El motivo de una reapertura es obligatorio: sin él la historia no sirve para nada, que es
 * todo el argumento de poder reabrir.
 *
 * `min:10` no es un capricho: «error» o «ajuste» no explican nada al que lea el registro en
 * seis meses. Y un motivo de puros espacios llega como `null` —`ConvertEmptyStringsToNull`
 * actúa DESPUÉS de `TrimStrings`—, así que `required` lo atrapa solo.
 */
class ReabrirPrefacturaRequest extends FormRequest
{
    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'motivo' => ['required', 'string', 'min:10', 'max:500'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'motivo.required' => 'Escribe por qué se reabre: queda en la historia del documento.',
            'motivo.string' => 'El motivo debe ser texto.',
            'motivo.min' => 'El motivo es demasiado corto: explica qué hay que corregir.',
            'motivo.max' => 'El motivo no puede pasar de 500 caracteres.',
        ];
    }
}
