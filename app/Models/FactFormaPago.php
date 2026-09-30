<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class FactFormaPago extends Model
{
    public const STATUS_ACTIVO = 'A';
    public const STATUS_INACTIVO = 'N';

    protected $table = 'fact_formas_pago';

    protected $fillable = ['nombre', 'status'];

    public function scopeActivos(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVO);
    }
}
