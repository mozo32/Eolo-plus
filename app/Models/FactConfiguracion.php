<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FactConfiguracion extends Model
{
    protected $table = 'fact_configuracion';

    protected $fillable = ['clave', 'valor', 'descripcion'];

    public static function valor(string $clave, $default = null)
    {
        return static::query()->where('clave', $clave)->value('valor') ?? $default;
    }

    /**
     * Precio que se cobra, derivado del costo. Reproduce la fórmula de
     * `actualizar_combustible.php`: ($pasa + 0.50) * 1.15.
     */
    public static function precioEoloSugerido(float $precioAsa): float
    {
        ['ajuste' => $ajuste, 'margen' => $margen] = static::formulaCombustible();

        return round(($precioAsa + $ajuste) * $margen, 4);
    }

    /**
     * Los dos números de la fórmula del precio Eolo. Es la única fuente: la
     * pantalla los pide al servidor en vez de repetirlos, para que la propuesta
     * que ve el usuario sea la que el servidor calcularía.
     *
     * @return array{ajuste: float, margen: float}
     */
    public static function formulaCombustible(): array
    {
        return [
            'ajuste' => (float) static::valor('combustible_ajuste', 0.50),
            'margen' => (float) static::valor('combustible_margen', 1.15),
        ];
    }
}
