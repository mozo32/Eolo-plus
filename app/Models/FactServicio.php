<?php
// app/Models/FactServicio.php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class FactServicio extends Model
{
    public const STATUS_ACTIVO = 'A';
    public const STATUS_INACTIVO = 'N';

    /** Sin ajuste: el precio se cobra tal cual. */
    public const AJUSTE_NINGUNO = 'ninguno';

    /** Servicio 106 del sistema viejo: precio × 1.05. */
    public const AJUSTE_MAS_5 = 'mas_5';

    /** Servicio 107: precio ÷ 1.16, para descontarle el IVA. */
    public const AJUSTE_SIN_IVA = 'sin_iva';

    /** Servicio 113: (precio ÷ 1.31) × 1.15. */
    public const AJUSTE_COMISION_131 = 'comision_131';

    protected $table = 'fact_servicios';

    protected $fillable = [
        'categoria_servicio_id',
        'nombre',
        'precio_unitario',
        'es_de_tercero',
        'margen',
        'ajuste_precio',
        'status',
    ];

    protected $casts = [
        'precio_unitario' => 'decimal:4',
        'margen' => 'decimal:2',
        'es_de_tercero' => 'boolean',
    ];

    public function scopeActivos(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVO);
    }

    public function categoria()
    {
        return $this->belongsTo(FactCategoriaServicio::class, 'categoria_servicio_id');
    }

    /**
     * Importe de una línea de prefactura, reproduciendo `altaserv.php`: primero
     * el ajuste sobre el precio unitario, después el margen, y al final la
     * cantidad. El precio se recibe por parámetro porque en los servicios de
     * tercero se teclea al capturar y no sale del catálogo.
     */
    public function importe(float $precio, int $cantidad): string
    {
        $ajustado = $this->aplicarAjuste($precio);
        $conMargen = $ajustado + ($ajustado * (float) $this->margen / 100);

        return number_format($conMargen * $cantidad, 2, '.', '');
    }

    private function aplicarAjuste(float $precio): float
    {
        return match ($this->ajuste_precio) {
            self::AJUSTE_MAS_5 => $precio * 1.05,
            self::AJUSTE_SIN_IVA => $precio / 1.16,
            self::AJUSTE_COMISION_131 => ($precio / 1.31) * 1.15,
            default => $precio,
        };
    }
}
