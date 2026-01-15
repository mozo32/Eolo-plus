<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Personal extends Model
{
    protected $table = 'personal';

    protected $fillable = [
        'clave',
        'nombre',
        'puesto_id',
    ];

    public function puesto()
    {
        return $this->belongsTo(Puesto::class);
    }

    public function departamento()
    {
        return $this->hasOneThrough(
            Departamento::class,
            Puesto::class,
            'id',
            'id',
            'puesto_id',
            'departamento_id'
        );
    }
}
