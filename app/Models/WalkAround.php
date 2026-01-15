<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphToMany;

class WalkAround extends Model
{
    protected $table = 'walk_arounds';

    protected $fillable = [
        'fecha',
        'movimiento',
        'matricula',
        'tipo_aeronave_id',
        'tipo',
        'tipo_aeronave',
        'hora',
        'destino',
        'procedensia',
        'observaciones',
        'elabora_departamento_id',
        'elabora_personal_id',
        'elabora',
        'responsable',
        'jefe_area',
        'fbo',
        'numero_estaticas',
        'status',
    ];

    protected $casts = [
        'fecha' => 'date',
        'hora' => 'string',
    ];

    public function marcasDanio()
    {
        return $this->hasMany(WalkaroundMarcaDanio::class)
            ->where('status', 'A');
    }

    public function checklist()
    {
        return $this->hasOne(WalkaroundChecklist::class)
            ->where('status', 'A');
    }

    public function imagenes(): MorphToMany
    {
        return $this->morphToMany(
            Imagen::class,
            'imageable',
            'imageables',
            'imageable_id',
            'imagen_id'
        )
            ->wherePivot('status', 'A')
            ->withPivot(['tag', 'orden', 'status'])
            ->withTimestamps()
            ->orderBy('imageables.orden');
    }

    public function firmas(): MorphToMany
    {
        return $this->morphToMany(
            Firma::class,
            'firmable',
            'firmables',
            'firmable_id',
            'firma_id'
        )
            ->wherePivot('status', 'A')
            ->withPivot(['rol', 'tag', 'orden', 'status'])
            ->withTimestamps()
            ->orderBy('firmables.orden');
    }

    protected static function booted()
    {
        static::addGlobalScope('activos', function ($q) {
            $q->where('status', 'A');
        });
    }

    public function checklistAll()
    {
        return $this->hasOne(WalkaroundChecklist::class);
    }

    public function marcasDanioAll()
    {
        return $this->hasMany(WalkaroundMarcaDanio::class);
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

    public function firmasAll(): MorphToMany
    {
        return $this->morphToMany(
            Firma::class,
            'firmable',
            'firmables',
            'firmable_id',
            'firma_id'
        );
    }
    public function elaboraDepartamento()
    {
        return $this->belongsTo(Departamento::class, 'elabora_departamento_id');
    }

    public function elaboraPersonal()
    {
        return $this->belongsTo(Personal::class, 'elabora_personal_id');
    }
}
