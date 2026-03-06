<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class inspeccionAutotanque extends Model
{
    protected $table = 'inspecciones_autotanque';

    protected $fillable = [
        'fecha_inspeccion',
        'operador',
        'kilometraje',
        'porcentaje_combustible',
        'checklist_respuestas',
        'danos_grafico',
    ];
    protected $casts = [
        'checklist_respuestas' => 'array',
        'danos_grafico' => 'array',
    ];
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
