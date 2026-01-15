<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class TipoAeronave extends Model
{
    use HasFactory;

    protected $table = 'tipo_aeronaves';

    protected $fillable = [
        'nombre',
    ];

    public function aeronaves()
    {
        return $this->hasMany(Aeronave::class, 'tipo_aeronave_id');
    }

}
