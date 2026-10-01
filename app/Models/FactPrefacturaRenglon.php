<?php

namespace App\Models;

use App\Support\ImporteServicio;
use Illuminate\Database\Eloquent\Model;

class FactPrefacturaRenglon extends Model
{
    protected $table = 'fact_prefactura_renglones';

    protected $fillable = [
        'prefactura_id', 'servicio_id', 'nombre_servicio', 'precio_unitario', 'cantidad',
        'es_de_tercero', 'margen', 'ajuste_precio', 'concepto', 'proveedor_id', 'remision', 'orden',
    ];

    protected $casts = [
        'precio_unitario' => 'decimal:4',
        'margen' => 'decimal:2',
        'es_de_tercero' => 'boolean',
        'cantidad' => 'integer',
    ];

    protected $appends = ['importe'];

    public function prefactura()
    {
        return $this->belongsTo(FactPrefactura::class, 'prefactura_id');
    }

    public function servicio()
    {
        return $this->belongsTo(FactServicio::class, 'servicio_id');
    }

    /**
     * El importe se deriva de los valores CONGELADOS del renglón, nunca de los
     * del catálogo: el servicio pudo cambiar de precio después.
     */
    public function importe(): string
    {
        return ImporteServicio::calcular(
            (float) $this->precio_unitario,
            (int) $this->cantidad,
            (float) $this->margen,
            $this->ajuste_precio,
        );
    }

    public function getImporteAttribute(): string
    {
        return $this->importe();
    }
}
