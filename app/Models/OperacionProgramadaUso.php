<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class OperacionProgramadaUso extends Model
{
    protected $table = 'operacion_programada_usos';

    protected $fillable = [
        'operacion_programada_id',
        'usable_type',
        'usable_id',
        'user_id',
    ];

    public function operacionProgramada(): BelongsTo
    {
        return $this->belongsTo(OperacionProgramada::class);
    }

    public function usable(): MorphTo
    {
        return $this->morphTo();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
