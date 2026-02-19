<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class medicamento extends Model
{
    protected $table = 'medicamentos';

    protected $fillable = [
        'nombre',
        'cantidad',
    ];
    public function entregas()
    {
        return $this->hasMany(EntregaMedicamento::class, 'medicamento_id');
    }
}
