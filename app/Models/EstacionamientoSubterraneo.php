<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EstacionamientoSubterraneo extends Model
{
    use HasFactory;

    protected $table = 'estacionamiento_subterraneos';

    protected $fillable = [
        'user_id',
        'vehiculo',
        'color',
        'placas',
        'matricula',
        'responsable',
        'fecha_ingreso',
        'fecha_salida',
        'oficial',
    ];

    protected $casts = [
        'fecha_ingreso' => 'datetime',
        'fecha_salida'  => 'datetime',
    ];

    /**
     * Usuario que registró el vehículo
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
