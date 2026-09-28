<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FactAeronave extends Model
{
    /** Paga estancia (pernocta y tránsitos). */
    public const ESTATUS_GUARDA = 'guarda';

    /** Está de paso: no genera cargos de estancia. */
    public const ESTATUS_TRANSITO = 'transito';

    protected $table = 'fact_aeronaves';

    protected $fillable = [
        'aeronave_id',
        'categoria_aeronave_id',
        'tipo_motor_id',
        'estatus',
        'cobra_derecho_vuelos',
    ];

    protected $casts = ['cobra_derecho_vuelos' => 'boolean'];

    public function aeronave()
    {
        return $this->belongsTo(Aeronave::class);
    }

    public function categoria()
    {
        return $this->belongsTo(FactCategoriaAeronave::class, 'categoria_aeronave_id');
    }

    public function tipoMotor()
    {
        return $this->belongsTo(FactTipoMotor::class, 'tipo_motor_id');
    }
}
