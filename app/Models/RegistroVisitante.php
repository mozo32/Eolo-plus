<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RegistroVisitante extends Model
{
    use HasFactory;
    protected $table = 'registro_visitantes';

    protected $fillable = [
        'nombre',
        'procedencia',
        'a_quien_visita',
        'gafete',
        'empresa',
        'autoriza',
        'fecha_entrada',
        'hora_entrada',
        'fecha_salida',
        'hora_salida',
        'user_id',
        'tipo_gafete',
    ];

    protected $casts = [
        'fecha_entrada' => 'date',
        'fecha_salida'  => 'date',
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

    public function firmasAll()
    {
        return $this->morphToMany(Firma::class, 'firmable')
            ->withPivot(['rol', 'tag', 'orden', 'status']);
    }
}
