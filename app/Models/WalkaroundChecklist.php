<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WalkaroundChecklist extends Model
{
    protected $table = 'walkaround_checklists';

    protected $fillable = [
        'walk_around_id',
        'checklist_avion',
        'checklist_helicoptero',
        'status',
    ];

    protected $casts = [
        'checklist_avion'       => 'array',
        'checklist_helicoptero' => 'array',
    ];

    public function walkAround(): BelongsTo
    {
        return $this->belongsTo(WalkAround::class, 'walk_around_id');
    }
}
