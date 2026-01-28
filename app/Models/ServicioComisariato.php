<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ServicioComisariato extends Model
{
    use HasFactory;

    protected $table = 'servicio_comisariatos';

    protected $fillable = [
        'user_id',
        'catering',
        'forma_pago',
        'fecha_entrega',
        'hora_entrega',
        'matricula',
        'detalle',
        'solicitado_por',
        'atendio',
        'subtotal',
        'total',
    ];

    /**
     * Casts automáticos
     */
    protected $casts = [
        'fecha_entrega' => 'date',
        'hora_entrega'  => 'datetime:H:i',
        'subtotal'      => 'decimal:2',
        'total'         => 'decimal:2',
    ];

    /**
     * Relación: quien creó el servicio
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
