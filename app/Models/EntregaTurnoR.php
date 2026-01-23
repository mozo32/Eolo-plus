<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EntregaTurnoR extends Model
{
    protected $table = 'entrega_turno_r';

    protected $fillable = [
        'encabezado',
        'comunicaciones',
        'vehiculos',
        'barras_remolque',
        'gpus',
        'carrito_golf',
        'aeronaves',
    ];

    protected $casts = [
        'encabezado' => 'array',
        'comunicaciones' => 'array',
        'vehiculos' => 'array',
        'barras_remolque' => 'array',
        'gpus' => 'array',
        'carrito_golf' => 'array',
        'aeronaves' => 'array',
    ];

    /* ================= FIRMAS ================= */

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

    public function firmasAll()
    {
        return $this->morphToMany(Firma::class, 'firmable')
            ->withPivot(['rol', 'tag', 'orden', 'status']);
    }
}


