<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class FactCategoriaServicio extends Model
{
    public const STATUS_ACTIVO = 'A';
    public const STATUS_INACTIVO = 'N';

    protected $table = 'fact_categorias_servicio';

    protected $fillable = ['nombre', 'status'];

    public function scopeActivos(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVO);
    }

    public function servicios()
    {
        return $this->hasMany(FactServicio::class, 'categoria_servicio_id');
    }
}
