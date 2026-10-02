<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FactPrefacturaPago extends Model
{
    public const STATUS_ACTIVO = 'A';

    public const STATUS_INACTIVO = 'N';

    protected $table = 'fact_prefactura_pagos';

    protected $fillable = ['prefactura_id', 'forma_pago_id', 'monto', 'renglon_comision_id', 'user_id', 'status'];

    protected $casts = ['monto' => 'decimal:2'];

    public function prefactura()
    {
        return $this->belongsTo(FactPrefactura::class, 'prefactura_id');
    }

    public function formaPago()
    {
        return $this->belongsTo(FactFormaPago::class, 'forma_pago_id');
    }

    public function renglonComision()
    {
        return $this->belongsTo(FactPrefacturaRenglon::class, 'renglon_comision_id');
    }
}
