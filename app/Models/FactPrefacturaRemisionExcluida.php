<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * La decisión del operador de que ESTA remisión no va en ESTA prefactura.
 *
 * La consulta `RemisionesFacturables::candidatas()`, que es lo que la sincronización trae
 * sola; el buscador manual NO la consulta, porque excluirla del automático no es prohibirla.
 */
class FactPrefacturaRemisionExcluida extends Model
{
    protected $table = 'fact_prefactura_remisiones_excluidas';

    protected $fillable = ['prefactura_id', 'remision_id', 'user_id'];

    public function prefactura()
    {
        return $this->belongsTo(FactPrefactura::class, 'prefactura_id');
    }

    public function remision()
    {
        return $this->belongsTo(Remision::class, 'remision_id');
    }
}
