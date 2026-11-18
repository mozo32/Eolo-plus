<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphToMany;

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

    /**
     * Las evidencias fotográficas vigentes del servicio.
     *
     * El pivote retirado queda en `N` y deja de verse, igual que hacen las
     * firmas en el resto del proyecto: en un documento que sirve de prueba,
     * lo retirado tiene que poder recuperarse.
     */
    public function evidencias(): MorphToMany
    {
        return $this->morphToMany(Imagen::class, 'imageable', 'imageables')
            ->withPivot(['tag', 'orden', 'status'])
            ->wherePivot('status', 'A')
            ->withTimestamps();
    }

    /**
     * Todas, incluidas las retiradas.
     *
     * La usa el cálculo del `orden`: si contara solo las vigentes, borrar la
     * última y subir otra reutilizaría un número ya usado.
     */
    public function evidenciasAll(): MorphToMany
    {
        return $this->morphToMany(Imagen::class, 'imageable', 'imageables')
            ->withPivot(['tag', 'orden', 'status']);
    }
}
