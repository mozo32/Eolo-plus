<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Firmable extends Model
{
    protected $fillable = [
        'firma_id',
        'firmable_type',
        'firmable_id',
        'rol',
        'tag',
        'orden',
        'status',
    ];

    public function firma()
    {
        return $this->belongsTo(Firma::class);
    }

    public function firmable()
    {
        return $this->morphTo();
    }
}
