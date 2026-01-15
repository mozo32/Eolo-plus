<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Firma extends Model
{
    protected $fillable = [
        'disk',
        'path',
        'original_name',
        'mime',
        'size',
        'sha1',
        'status',
    ];

    public function url(): string
    {
        return Storage::disk($this->disk ?? 'public')->url($this->path);
    }
}
