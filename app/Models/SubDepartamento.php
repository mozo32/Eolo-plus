<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubDepartamento extends Model
{
    protected $table = 'subdepartamentos';
    protected $fillable = ['nombre', 'departamento_id'];

    public function departamento()
    {
        return $this->belongsTo(Departamento::class);
    }
    public function users()
    {
        return $this->belongsToMany(
            User::class,
            'user_subdepartamentos',
            'subdepartamento_id',
            'user_id'
        );
    }
}
