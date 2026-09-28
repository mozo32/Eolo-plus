<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class FactTipoMotor extends Model
{
    public const STATUS_ACTIVO = 'A';
    public const STATUS_INACTIVO = 'N';

    protected $table = 'fact_tipos_motor';

    protected $fillable = ['nombre', 'tarifa_aterrizaje', 'status'];

    protected $casts = ['tarifa_aterrizaje' => 'decimal:2'];

    public function scopeActivas(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVO);
    }

    public function aeronaves()
    {
        return $this->hasMany(FactAeronave::class, 'tipo_motor_id');
    }
}
