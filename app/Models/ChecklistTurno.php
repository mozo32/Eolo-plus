<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChecklistTurno extends Model
{
    protected $table = 'checklist_turnos';

    protected $fillable = [
        'nombre_empleado',
        'fecha',
        'recibe_turno_con',
        'observaciones_recibe',
        'revision_salas',
        'hot_tras_comi_coor',
        'revision_base_operaciones',
        'envia_informe_diario',
        'envia_resumen_semanal',
        'entrega_turno_con',
        'observaciones_entrega',
        'cantidad_pasajeros',
        'cantidad_operaciones',
        'firma',
    ];

    protected $casts = [
        'recibe_turno_con' => 'array',
        'revision_salas' => 'array',
        'hot_tras_comi_coor' => 'array',
        'entrega_turno_con' => 'array',
        'revision_base_operaciones' => 'boolean',
        'envia_informe_diario' => 'boolean',
        'envia_resumen_semanal' => 'boolean',
        'fecha' => 'date',
    ];
    public function firmas()
    {
        return $this->morphToMany(Firma::class, 'firmable')
            ->withPivot(['rol', 'tag', 'orden', 'status'])
            ->withTimestamps();
    }
}
