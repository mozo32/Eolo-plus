<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SumaAutotanque extends Model
{
    protected $table = 'sumas_autotanque';

    protected $fillable = [
        'id_turno',
        'litros',
        'folio'
    ];

    // Relación inversa: Una suma pertenece a un turno
    public function turno()
    {
        return $this->belongsTo(TurnoAutotanque::class, 'id_turno');
    }
}
