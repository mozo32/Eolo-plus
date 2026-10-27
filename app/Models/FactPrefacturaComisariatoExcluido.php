<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * La decisión del operador de que ESTE comisariato no va en ESTA prefactura.
 *
 * La sincronización automática de la prefactura la consultará para no volver a traer un
 * comisariato quitado a mano (`ComisariatosFacturables::candidatas()`, que llega en una tarea
 * posterior y todavía no existe). El buscador manual NO la consultará: excluirlo del
 * automático no es prohibirlo.
 */
class FactPrefacturaComisariatoExcluido extends Model
{
    protected $table = 'fact_prefactura_comisariatos_excluidos';

    protected $fillable = ['prefactura_id', 'servicio_comisariato_id', 'user_id'];

    public function prefactura()
    {
        return $this->belongsTo(FactPrefactura::class, 'prefactura_id');
    }

    public function servicioComisariato()
    {
        return $this->belongsTo(ServicioComisariato::class, 'servicio_comisariato_id');
    }
}
