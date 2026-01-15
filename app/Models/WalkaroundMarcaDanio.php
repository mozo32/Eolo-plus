<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WalkaroundMarcaDanio extends Model
{
    protected $table = 'walkaround_marca_danios';

    protected $fillable = [
        'walk_around_id',
        'x',
        'y',
        'z',
        'descripcion',
        'severidad',
        'status',
    ];

    protected $casts = [
        'x' => 'float',
        'y' => 'float',
        'z' => 'float',
    ];

    public function walkAround(): BelongsTo
    {
        return $this->belongsTo(WalkAround::class, 'walk_around_id');
    }
}
