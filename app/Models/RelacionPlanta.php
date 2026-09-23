<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Préstamo de la GPU N.115. Solo puede existir un registro en_uso a la vez;
 * esa regla la garantiza el controlador con bloqueo dentro de transacción.
 */
class RelacionPlanta extends Model
{
    protected $table = 'relaciones_planta';

    public const EQUIPO = 'GPU N.115';

    public const STATUS_EN_USO = 'en_uso';

    public const STATUS_FINALIZADO = 'finalizado';

    protected $fillable = [
        'fecha',
        'empresa',
        'matricula',
        'horometro_inicio',
        'horometro_fin',
        'tiempo',
        'status',
    ];

    protected $casts = [
        'fecha' => 'date:Y-m-d',
        'horometro_inicio' => 'decimal:2',
        'horometro_fin' => 'decimal:2',
        'tiempo' => 'decimal:2',
    ];

    protected $appends = ['equipo'];

    public function getEquipoAttribute(): string
    {
        return self::EQUIPO;
    }

    public function scopeEnUso(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_EN_USO);
    }

    public function scopeFinalizadas(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_FINALIZADO);
    }
}
