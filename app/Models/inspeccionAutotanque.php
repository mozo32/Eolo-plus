<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphToMany;
class inspeccionAutotanque extends Model
{
    protected $table = 'inspecciones_autotanque';

    protected $fillable = [
        'turno_autotanque_id',
        'fecha_inspeccion',
        'operador',
        'kilometraje',
        'porcentaje_combustible',
        'checklist_respuestas',
        'danos_grafico',
        'status',
    ];
    protected $casts = [
        'checklist_respuestas' => 'array',
        'danos_grafico' => 'array',
    ];
    public function turno(): BelongsTo
    {
        return $this->belongsTo(TurnoAutotanque::class, 'turno_autotanque_id');
    }
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
    public function imagenes(): MorphToMany
    {
        return $this->morphToMany(Imagen::class, 'imageable', 'imageables')
            ->withPivot(['tag', 'orden', 'status', 'observacion', 'alerta'])
            ->withTimestamps();
    }
    public function imagenesAll(): MorphToMany
    {
        return $this->morphToMany(
            Imagen::class,
            'imageable',
            'imageables',
            'imageable_id',
            'imagen_id'
        );
    }
}
