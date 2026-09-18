<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EntregaMedicamento extends Model
{
    protected $table = 'entrega_medicamentos';

    protected $fillable = [
        'medicamento_id',
        'receptor',
        'cantidad',
        'user_id',
        'status',
        // Cierre de turno que finalizó la entrega (null mientras está abierta).
        'control_medicamento_id',
        // Persona que realmente entregó; user_id es quien capturó.
        'entregado_por_user_id',
    ];

    public function medicamento()
    {
        return $this->belongsTo(Medicamento::class, 'medicamento_id');
    }

    public function cierre(): BelongsTo
    {
        return $this->belongsTo(ControlMedicamento::class, 'control_medicamento_id');
    }

    public function entregadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'entregado_por_user_id');
    }

    public function capturadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
