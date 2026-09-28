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
        'tarifa_pernocta',
        'tarifa_transito_2h',
        'tarifa_transito_12h',
        'tarifa_aterrizaje',
        'estatus',
        'cobra_derecho_vuelos',
    ];

    protected $casts = [
        'cobra_derecho_vuelos' => 'boolean',
        'tarifa_pernocta' => 'decimal:2',
        'tarifa_transito_2h' => 'decimal:2',
        'tarifa_transito_12h' => 'decimal:2',
        'tarifa_aterrizaje' => 'decimal:2',
    ];

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

    /**
     * Tarifa efectiva: la propia de la matrícula si la tiene, si no la de su
     * categoría. Un valor en cero es una tarifa válida, así que la comprobación
     * es contra null y no contra "vacío".
     */
    public function tarifaPernocta(): ?string
    {
        return $this->tarifa_pernocta ?? $this->categoria?->tarifa_pernocta;
    }

    public function tarifaTransito2h(): ?string
    {
        return $this->tarifa_transito_2h ?? $this->categoria?->tarifa_transito_2h;
    }

    public function tarifaTransito12h(): ?string
    {
        return $this->tarifa_transito_12h ?? $this->categoria?->tarifa_transito_12h;
    }

    /** El aterrizaje hereda del tipo de motor, no de la categoría. */
    public function tarifaAterrizaje(): ?string
    {
        return $this->tarifa_aterrizaje ?? $this->tipoMotor?->tarifa_aterrizaje;
    }
}
