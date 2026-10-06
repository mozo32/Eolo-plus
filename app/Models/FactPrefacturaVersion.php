<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Una versión sustituida de una prefactura: el documento tal como se imprimió antes de
 * que alguien lo corrigiera.
 *
 * `documento` es dato muerto: no se consulta relacionalmente, solo se lee entero para
 * reimprimir. Por eso es JSON y no tablas hijas.
 */
class FactPrefacturaVersion extends Model
{
    protected $table = 'fact_prefactura_versiones';

    protected $fillable = [
        'prefactura_id', 'version', 'folio',
        'subtotal_sellado', 'iva_sellado', 'total_sellado', 'iva_tasa_sellada',
        'cerrada_at', 'cerrada_por',
        'reabierta_at', 'reabierta_por', 'motivo',
        'documento',
    ];

    protected $casts = [
        'version' => 'integer',
        'folio' => 'integer',
        'subtotal_sellado' => 'decimal:2',
        'iva_sellado' => 'decimal:2',
        'total_sellado' => 'decimal:2',
        'iva_tasa_sellada' => 'decimal:4',
        'cerrada_at' => 'datetime',
        'reabierta_at' => 'datetime',
        'documento' => 'array',
    ];

    public function prefactura(): BelongsTo
    {
        return $this->belongsTo(FactPrefactura::class, 'prefactura_id');
    }

    public function cerradaPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cerrada_por');
    }

    public function reabiertaPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reabierta_por');
    }
}
