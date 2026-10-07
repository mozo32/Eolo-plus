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
 *
 * EXIGE ir acompañada de `date` y delante de ella: esta regla no valida el formato. Una
 * fecha ilegible se deja pasar (para que el error no salga dos veces, con dos mensajes) y
 * eso incluye cualquier valor que no sea una fecha, como un arreglo. Sin `date` en la
 * lista, la validación pasa con lo que no sea una fecha.
 */
class DentroDeLaVentana implements ValidationRule
{
    public function __construct(private string $clave) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        ['min' => $min, 'max' => $max] = VentanasDeFecha::para($this->clave);

        // Sin convertir de zona A PROPOSITO: el modelo guarda el dia tal como viene escrito en la
        // cadena (el cast `date` no cambia de zona), asi que la regla tiene que juzgar ese mismo
        // dia. Convertirlo aqui dejaba pasar `2026-10-08T00:30:00+14:00` como «hoy en Mexico» y
        // la base lo guardaba como el dia 8.
        $fecha = rescue(fn () => Carbon::parse($value)->toDateString(), null, false);

        // Una fecha ilegible no es cosa de esta regla: solo la atrapa `date`, si quien usa
        // la regla lo puso en la lista (ver el docblock de la clase).
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
