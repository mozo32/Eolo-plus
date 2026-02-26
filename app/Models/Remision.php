<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Remision extends Model
{
    protected $table = 'remisiones';

    protected $fillable = [
        'folio','fecha', 'operador', 'cliente', 'requisicion', 'forma_pago',
        'aeronave_tipo', 'matricula', 'destino', 'hora_llegada',
        'hora_inicial', 'hora_final', 'lectura_inicial',
        'lectura_final', 'total_litros'
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
        return $this->morphToMany(Firma::class, 'firmable', 'firmables')
        ->withPivot(['rol', 'tag', 'orden', 'status']);
    }

}
