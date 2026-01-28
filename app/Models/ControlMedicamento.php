<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ControlMedicamento extends Model
{
    protected $table = 'control_medicamentos';

    protected $fillable = [
        'responsable',
        'fecha',
        'dia',
        'medicamentos',
        'user_id',
    ];

    protected $casts = [
        'fecha' => 'date',
        'medicamentos' => 'array',
    ];
    public function firmas()
    {
        return $this->morphToMany(
            Firma::class,
            'firmable',
            'firmables'
        )->withPivot(['rol', 'tag', 'orden', 'status'])
        ->wherePivot('status', 'A')
        ->withTimestamps();
    }
}
