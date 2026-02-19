<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EntregaMedicamento extends Model
{
    protected $table = 'entrega_medicamentos';

    protected $fillable = [
        'medicamento_id',
        'receptor',
        'cantidad',
        'user_id',
    ];
    public function medicamento()
    {
        return $this->belongsTo(Medicamento::class, 'medicamento_id');
    }
}
