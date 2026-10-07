<?php

namespace App\Rules;

use App\Support\VentanasDeFecha;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Carbon;

/**
 * Hace cumplir la ventana de un formulario. El calendario del navegador GUÍA; esta regla
 * DECIDE: un `min`/`max` en un input se salta con las herramientas del navegador o con una
 * petición directa, así que sin esto la regla sería decoración.
 */
class DentroDeLaVentana implements ValidationRule
{
    public function __construct(private string $clave) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        ['min' => $min, 'max' => $max] = VentanasDeFecha::para($this->clave);

        $fecha = rescue(fn () => Carbon::parse($value)->toDateString(), null, false);

        // Una fecha ilegible no es cosa de esta regla: la atrapa `date`, que va antes.
        if ($fecha === null) {
            return;
        }

        if (($min !== null && $fecha < $min) || ($max !== null && $fecha > $max)) {
            $fail($this->mensaje($min, $max));
        }
    }

    /** El mensaje nombra las dos fechas: quien lo lea sabe qué hacer sin preguntar. */
    private function mensaje(?string $min, ?string $max): string
    {
        $bonita = fn (string $f) => Carbon::parse($f)->format('d/m/Y');

        if ($min !== null && $max !== null) {
            return "La fecha tiene que estar entre el {$bonita($min)} y el {$bonita($max)}.";
        }

        return $max !== null
            ? "La fecha no puede ser posterior al {$bonita($max)}."
            : "La fecha no puede ser anterior al {$bonita($min)}.";
    }
}
