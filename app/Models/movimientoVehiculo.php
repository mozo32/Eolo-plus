<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\MorphToMany;

class movimientoVehiculo extends Model
{
    use HasFactory;

    protected $table = 'movimientos_vehiculos';

    protected $fillable = [
        'vehiculo_id',
        'tipo',
        'chofer',
        'kilometraje',
        'gasolina',
        'destino',
        'autoriza',
        'observaciones',
        'matricula',
        'motivo',
    ];

    protected $casts = [
        'created_at' => 'datetime:Y-m-d H:i',
    ];

    public function imagenes(): MorphToMany
    {
        return $this->morphToMany(
            Imagen::class,
            'imageable',
            'imageables',
            'imageable_id',
            'imagen_id'
        )
            ->wherePivot('status', 'A')
            ->withPivot(['tag', 'orden', 'status'])
            ->withTimestamps()
            ->orderBy('imageables.orden');
    }

    public function imagenesAll(): MorphToMany
    {
        return $this->morphToMany(
            Imagen::class,
            'imageable',
            'imageables',
            'imageable_id',
            'imagen_id'
        )
            ->withPivot(['tag', 'orden', 'status'])
            ->withTimestamps();
    }
}
