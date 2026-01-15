<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EntregaTurno extends Model
{
    protected $table = 'entregas_turno';

    protected $fillable = [
        'fecha',
        'nombre',
        'nombre_quien_entrega',
        'nombre_jefe_turno_despacho',
        'checklist_comunicacion',
        'equipo_oficina',
        'copiadoras',
        'fondo_documentacion',
        'estado_caja_fuerte',
        'status',
    ];

    protected $casts = [
        'fecha' => 'date',
        'checklist_comunicacion' => 'array',
        'equipo_oficina' => 'array',
        'copiadoras' => 'array',
        'fondo_documentacion' => 'array',
    ];
}
