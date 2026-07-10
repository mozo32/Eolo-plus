<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Remision extends Model
{
    protected $table = 'remisiones';

    protected $fillable = [
        'folio','fecha', 'operador', 'cliente', 'forma_pago','presionDif',
        'aeronave_tipo', 'matricula', 'destino', 'hora_llegada',
        'hora_inicial', 'hora_final', 'lectura_inicial',
        'lectura_final', 'total_litros', 'id_turno','status', 'precio','status_prefactura','folio_orden_venta',
    ];
    protected $casts = [
        'status_prefactura' => 'boolean',
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
