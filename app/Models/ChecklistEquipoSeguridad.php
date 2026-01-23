<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChecklistEquipoSeguridad extends Model
{
    protected $table = 'checklist_equipo_seguridad';

    protected $fillable = [
        'user_id',
        'nombre',
        'checklist',
        'observaciones',
    ];

    protected $casts = [
        'checklist' => 'array',
    ];
}
