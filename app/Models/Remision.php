<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Remision extends Model
{
    protected $table = 'remisiones';

    protected $fillable = [
        'folio',
        'fecha',
        'es_vuelo',
        'cliente_vuelo',
        'requisicion',
        'forma_pago',
        'tipo_aeronave',
        'matricula',
        'destino',
        'hora_llegada',
        'hora_inicio',
        'hora_final',
        'lectura_inicial',
        'lectura_final',
        'total_litros',
        'observaciones',
        'nombre_cliente_firma',
        'nombre_operador_firma',
    ];

    protected $casts = [
        'es_vuelo' => 'boolean',
        'fecha' => 'date',
        'lectura_inicial' => 'integer',
        'lectura_final' => 'integer',
        'total_litros' => 'integer',
    ];
}
