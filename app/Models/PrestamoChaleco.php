<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Préstamo de un chaleco al personal visitante. La INE que se deja en
 * garantía vive en `imagens` (disco privado) y se sirve por un endpoint con
 * sesión, nunca por URL pública.
 */
class PrestamoChaleco extends Model
{
    protected $table = 'prestamos_chalecos';

    public const ESTADO_PRESTADO = 'prestado';

    public const ESTADO_DEVUELTO = 'devuelto';

    protected $fillable = [
        'fecha',
        'nombre_recibe',
        'usuario_entrega_id',
        'foto_ine_imagen_id',
        'estado',
        'fecha_devolucion',
        'devuelto_por_user_id',
        'user_id',
    ];

    protected $casts = [
        'fecha' => 'date:Y-m-d',
        'fecha_devolucion' => 'datetime',
    ];

    public function scopePrestados(Builder $query): Builder
    {
        return $query->where('estado', self::ESTADO_PRESTADO);
    }

    public function scopeDevueltos(Builder $query): Builder
    {
        return $query->where('estado', self::ESTADO_DEVUELTO);
    }

    public function entregadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'usuario_entrega_id');
    }

    public function devueltoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'devuelto_por_user_id');
    }

    /** Auditoría: quién capturó el registro. */
    public function capturadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function fotoIne(): BelongsTo
    {
        return $this->belongsTo(Imagen::class, 'foto_ine_imagen_id');
    }
}
