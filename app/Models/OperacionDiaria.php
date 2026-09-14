<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;


class OperacionDiaria extends Model
{
    use HasFactory;

    protected $table = 'operaciones_diarias';

    /**
     * Campos asignables masivamente
     */
    protected $fillable = [
        'user_id',
        'fecha',
        'tipo',
        'matricula',
        'equipo',
        'hora',
        'lugar',
        'pax',
        'departamento',
        'equipaje',
        'observaciones',
        'impulso',
        'nombre',
        'tipo_cliente',
        'tipo_operacion',
        'validaciones',
        'status',
    ];

    /**
     * Casts de atributos
     */
    protected $casts = [
        'validaciones' => 'array',
        'fecha' => 'date',
        'status' => 'boolean',
    ];

    /**
     * Relación: operación pertenece a un usuario
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Scope: solo operaciones activas (no canceladas).
     *
     * Es el filtro que usan las consultas operativas: último movimiento,
     * pernocta, conteos y pendientes. El historial no lo aplica.
     */
    public function scopeActivas($query)
    {
        return $query->where('status', true);
    }

    /**
     * Scope: solo llegadas
     */
    public function scopeLlegadas($query)
    {
        return $query->where('tipo', 'llegada');
    }

    /**
     * Scope: solo salidas
     */
    public function scopeSalidas($query)
    {
        return $query->where('tipo', 'salida');
    }
}
