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
    ];

    /**
     * Casts de atributos
     */
    protected $casts = [
        'fecha' => 'date',
        'hora'  => 'datetime:H:i',
        'pax'   => 'integer',
    ];

    /**
     * Relación: operación pertenece a un usuario
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
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
