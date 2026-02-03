<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MovimientoCSAE extends Model
{
    use HasFactory;

    protected $table = 'movimientos_csae';

    /**
     * Campos asignables masivamente
     */
    protected $fillable = [
        'user_entrada_id',
        'user_salida_id',
        // ENTRADA
        'fecha_hora_entrada',
        'matricula',
        'tipo_aeronave',
        'como_llega',
        'transportista',
        'observaciones_entrada',

        // SALIDA
        'fecha_hora_salida',
        'observaciones_salida',
    ];

    /**
     * Casts para manejo correcto de fechas
     */
    protected $casts = [
        'fecha_hora_entrada' => 'datetime',
        'fecha_hora_salida'  => 'datetime',
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
