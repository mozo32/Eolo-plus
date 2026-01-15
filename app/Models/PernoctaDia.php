<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PernoctaDia extends Model
{
    protected $table = 'pernocta_dia';

    protected $fillable = [
        'fecha',
        'matricula',
        'nombre',
        'observaciones',
        'ubicacion',
        'aeronave',
        'tipo_cliente',
        'categoria',
    ];
}
