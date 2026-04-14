<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphToMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InspeccionCombustibles extends Model
{
    protected $table = 'inspeccion_combustibles';

    protected $fillable = [
        'user_id',
        'fecha',
        'status',
    ];
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
    public function imagenes(): MorphToMany
    {
        return $this->morphToMany(Imagen::class, 'imageable', 'imageables')
            ->withPivot(['tag', 'orden', 'status', 'observacion', 'alerta'])
            ->withTimestamps();
    }
    public function firmasAll(): MorphToMany
    {
        return $this->morphToMany(
            Firma::class,
            'firmable',
            'firmables',
            'firmable_id',
            'firma_id'
        );
    }
    public function imagenesAll(): MorphToMany
    {
        return $this->morphToMany(
            Imagen::class,
            'imageable',
            'imageables',
            'imageable_id',
            'imagen_id'
        );
    }
}
