<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Aeronave extends Model
{
    use HasFactory;

    protected $table = 'aeronaves';

    protected $fillable = [
        'matricula',
        'aeronave_id',
        'tipo_aeronave'
    ];

    public function tipoAeronave()
    {
        return $this->belongsTo(TipoAeronave::class, 'aeronave_id');
    }

    /** Atributos de cobro de esta matrícula; null si nunca se ha facturado. */
    public function facturacion()
    {
        return $this->hasOne(FactAeronave::class, 'aeronave_id');
    }
}

