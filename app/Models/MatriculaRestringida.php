<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Restricción de movimientos de una matrícula.
 *
 * La matrícula es la llave primaria y no hay timestamps: la tabla guarda solo
 * los tres datos funcionales. El registro de quién restringió y cuándo vive en
 * la bitácora.
 */
class MatriculaRestringida extends Model
{
    protected $table = 'matriculas_restringidas';

    protected $primaryKey = 'matricula';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = [
        'matricula',
        'llegada',
        'salida',
    ];

    protected $casts = [
        'llegada' => 'boolean',
        'salida' => 'boolean',
    ];

    /**
     * Normaliza igual que el resto del sistema: sin espacios sobrantes, en
     * mayúsculas y conservando guiones.
     */
    public static function normalizar(?string $matricula): string
    {
        return strtoupper(trim((string) $matricula));
    }

    /**
     * ¿Este movimiento está restringido para esta matrícula?
     */
    public function restringe(string $tipo): bool
    {
        return $tipo === 'llegada' ? $this->llegada : $this->salida;
    }
}
