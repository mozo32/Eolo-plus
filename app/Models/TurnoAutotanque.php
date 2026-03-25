<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;
class TurnoAutotanque extends Model
{
    protected $table = 'turnos_autotanque';
    protected $fillable = [
        'user_id','nombre', 'fecha', 'cmIni', 'litrosIni', 'totalizadorIni',
        'nombreCierre', 'fechaCierre', 'cmCierre', 'litrosCierre', 'totalizadorCierre',
        'totalVendidos', 'balanceAritmetico', 'balanceFisico', 'diferenciaFinal','status'
    ];
    public function inspeccion(): HasOne
    {
        return $this->hasOne(inspeccionAutotanque::class, 'turno_autotanque_id');
    }
}
