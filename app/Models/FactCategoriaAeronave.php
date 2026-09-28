<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class FactCategoriaAeronave extends Model
{
    public const STATUS_ACTIVO = 'A';
    public const STATUS_INACTIVO = 'N';

    protected $table = 'fact_categorias_aeronave';

    protected $fillable = [
        'nombre',
        'tarifa_pernocta',
        'tarifa_transito_2h',
        'tarifa_transito_12h',
        'status',
    ];

    protected $casts = [
        'tarifa_pernocta' => 'decimal:2',
        'tarifa_transito_2h' => 'decimal:2',
        'tarifa_transito_12h' => 'decimal:2',
    ];

    public function scopeActivas(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVO);
    }

    public function aeronaves()
    {
        return $this->hasMany(FactAeronave::class, 'categoria_aeronave_id');
    }
}
