<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphToMany;

class Imagen extends Model
{
    protected $table = 'imagens';

    protected $fillable = [
        'disk',
        'path',
        'original_name',
        'mime',
        'size',
        'status',
    ];

    public function getUrlAttribute(): string
    {
        return \Storage::disk($this->disk ?? 'public')->url($this->path);
    }

    public function walkarounds(): MorphToMany
    {
        return $this->morphedByMany(WalkAround::class, 'imageable', 'imageables', 'imagen_id', 'imageable_id')
            ->withPivot(['tag', 'orden'])
            ->withTimestamps();
    }

}
