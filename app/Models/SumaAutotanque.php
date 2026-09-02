<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphToMany;

class SumaAutotanque extends Model
{
    protected $table = 'sumas_autotanque';

    protected $fillable = [
        'id_turno',
        'litros',
        'costo',
        'folio',
        'toma_fisica_cm',
        'toma_fisica_litros',
    ];

    protected $casts = [
        'litros' => 'decimal:2',
        'costo' => 'decimal:2',
        'toma_fisica_cm' => 'decimal:2',
        'toma_fisica_litros' => 'decimal:2',
    ];

    public function turno(): BelongsTo
    {
        return $this->belongsTo(
            TurnoAutotanque::class,
            'id_turno',
        );
    }

    public function imagenes(): MorphToMany
    {
        return $this
            ->morphToMany(
                Imagen::class,
                'imageable',
                'imageables',
                'imageable_id',
                'imagen_id',
            )
            ->withPivot([
                'tag',
                'observacion',
                'alerta',
                'orden',
                'status',
            ])
            ->withTimestamps();
    }
}
