<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Vehiculo extends Model
{
    use HasFactory;

    protected $table = 'vehiculos';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'nombre',
        'estado',
        'ultima_actividad',
    ];

    public function movimientos() {
        return $this->hasMany(Movimiento::class)->orderBy('created_at', 'desc');
    }
}
