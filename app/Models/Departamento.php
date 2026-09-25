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

    /**
     * Usuarios vinculados al departamento. La usa Gestion de usuarios para
     * contar cuantas personas hay en cada area.
     */
    public function users()
    {
        return $this->belongsToMany(
            User::class,
            'user_departamentos',
            'departamento_id',
            'user_id'
        );
    }
}
