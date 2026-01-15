<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Departamento extends Model
{
    protected $table = 'departamentos';

    protected $fillable = [
        'nombre',
    ];

    public function puestos()
    {
        return $this->hasMany(Puesto::class);
    }
    public function subdepartamentos()
    {
        return $this->hasMany(SubDepartamento::class);
    }
}
