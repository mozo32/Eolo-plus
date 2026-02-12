<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

use Illuminate\Database\Eloquent\Relations\BelongsTo; // <--- AGREGAR ESTO
use App\Models\User;

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
        'nombre_entrega',
        'nombre_jefe_area',
        'nombre_recibe',
        'user_id',
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
    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
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
        return $this->morphToMany(Firma::class, 'firmable', 'firmables')
        ->withPivot(['rol', 'tag', 'orden', 'status']);
    }
}


