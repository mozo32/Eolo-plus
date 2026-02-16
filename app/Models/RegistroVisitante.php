<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RegistroVisitante extends Model
{
    use HasFactory;
    protected $table = 'registro_visitantes';

    protected $fillable = [
        'nombre',
        'procedencia',
        'a_quien_visita',
        'gafete',
        'empresa',
        'autoriza',
        'fecha_entrada',
        'hora_entrada',
        'fecha_salida',
        'hora_salida',
        'user_id',
    ];

    protected $casts = [
        'fecha_entrada' => 'date',
        'fecha_salida'  => 'date',
    ];
}
