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
        'fact_servicio_id',
        'forma_pago',
        'fecha_entrega',
        'hora_entrega',
        'matricula',
        'detalle',
        'solicitado_por',
        'atendio',
        'subtotal',
        'total',
        'status',
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

    /** El servicio del catálogo con el que se cobrará este comisariato. Nulo en las filas anteriores a la lista. */
    public function factServicio(): BelongsTo
    {
        return $this->belongsTo(FactServicio::class, 'fact_servicio_id');
    }
}
