<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Alta o reabastecimiento de un medicamento. Las entregas y los cierres
 * tienen su propia tabla; Últimos Movimientos une las tres.
 */
class MovimientoMedicamento extends Model
{
    protected $table = 'movimientos_medicamentos';

    public const TIPO_NUEVO = 'NUEVO';

    public const TIPO_REABASTECIMIENTO = 'REABASTECIMIENTO';

    protected $fillable = [
        'medicamento_id',
        'tipo',
        'cantidad',
        'user_id',
    ];

    public function medicamento(): BelongsTo
    {
        return $this->belongsTo(Medicamento::class, 'medicamento_id');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
