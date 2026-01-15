<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Role extends Model
{
    protected $table = 'roles';
    protected $fillable = ['nombre', 'slug'];

    public function users()
    {
        return $this->belongsToMany(User::class);
    }
}

