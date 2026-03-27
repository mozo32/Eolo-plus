<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

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
}
