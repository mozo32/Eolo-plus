<?php

// app/Models/FactServicio.php

namespace App\Models;

use App\Support\ImporteServicio;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class FactServicio extends Model
{
    public const STATUS_ACTIVO = 'A';

    public const STATUS_INACTIVO = 'N';

    /** Sin ajuste: el precio se cobra tal cual. */
    public const AJUSTE_NINGUNO = ImporteServicio::AJUSTE_NINGUNO;

    /** Servicio 106 del sistema viejo: precio × 1.05. */
    public const AJUSTE_MAS_5 = ImporteServicio::AJUSTE_MAS_5;

    /** Servicio 107: precio ÷ 1.16, para descontarle el IVA. */
    public const AJUSTE_SIN_IVA = ImporteServicio::AJUSTE_SIN_IVA;

    /** Servicio 113: (precio ÷ 1.31) × 1.15. */
    public const AJUSTE_COMISION_131 = ImporteServicio::AJUSTE_COMISION_131;

    /** El servicio cuyo precio sigue al precio Eolo del combustible. */
    public const CONCEPTO_COMBUSTIBLE = 'combustible';

    /** Los cinco de estancia: su precio NO sale del catálogo, sale de la tarifa de la matrícula. */
    public const CONCEPTO_ESTANCIA_PERNOCTA = 'estancia_pernocta';

    public const CONCEPTO_ESTANCIA_TRANSITO_2H = 'estancia_transito_2h';

    public const CONCEPTO_ESTANCIA_TRANSITO_12H = 'estancia_transito_12h';

    /** El ajuste cobra la DIFERENCIA entre dos tramos, no el tramo entero. */
    public const CONCEPTO_ESTANCIA_AJUSTE_2H_12H = 'estancia_ajuste_2h_12h';

    public const CONCEPTO_ESTANCIA_AJUSTE_12H_PERNOCTA = 'estancia_ajuste_12h_pernocta';

    /** El renglón que agrega el pago Amex: en el origen es `id_servicio = 100`, «Comisión AMEX». */
    public const CONCEPTO_COMISION_AMEX = 'comision_amex';

    /** @var list<string> */
    public const CONCEPTOS_ESTANCIA = [
        self::CONCEPTO_ESTANCIA_PERNOCTA,
        self::CONCEPTO_ESTANCIA_TRANSITO_2H,
        self::CONCEPTO_ESTANCIA_TRANSITO_12H,
        self::CONCEPTO_ESTANCIA_AJUSTE_2H_12H,
        self::CONCEPTO_ESTANCIA_AJUSTE_12H_PERNOCTA,
    ];

    protected $table = 'fact_servicios';

    protected $fillable = [
        'categoria_servicio_id',
        'nombre',
        'concepto',
        'en_paquete_internacional',
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
        'en_paquete_internacional' => 'boolean',
    ];

    public function scopeActivos(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVO);
    }

    public function scopePorConcepto($query, string $concepto)
    {
        return $query->where('concepto', $concepto);
    }

    public function categoria()
    {
        return $this->belongsTo(FactCategoriaServicio::class, 'categoria_servicio_id');
    }

    /** El importe de `$cantidad` unidades a `$precio`, con el margen y el ajuste de este servicio. */
    public function importe(float $precio, int $cantidad): string
    {
        return ImporteServicio::calcular($precio, $cantidad, (float) $this->margen, $this->ajuste_precio);
    }
}
