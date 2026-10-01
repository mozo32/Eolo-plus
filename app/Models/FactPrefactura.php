<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FactPrefactura extends Model
{
    public const ESTADO_BORRADOR = 'borrador';

    public const ESTADO_CERRADA = 'cerrada';

    public const DESTINO_NACIONAL = 'nacional';

    public const DESTINO_INTERNACIONAL = 'internacional';

    public const STATUS_ACTIVO = 'A';

    public const STATUS_INACTIVO = 'N';

    /** Tasa por omisión si `fact_configuracion` no trae `iva_tasa`. */
    public const IVA_TASA_POR_OMISION = '0.16';

    protected $table = 'fact_prefacturas';

    protected $fillable = [
        'folio', 'estado', 'aeronave_id', 'cliente_id', 'llegada_at', 'salida_at',
        'origen', 'destino', 'operacion_llegada_id', 'operacion_salida_id', 'tipo_destino',
        'subtotal_sellado', 'iva_sellado', 'total_sellado', 'iva_tasa_sellada',
        'cerrada_at', 'cerrada_por', 'user_id', 'status',
    ];

    protected $casts = [
        'llegada_at' => 'datetime',
        'salida_at' => 'datetime',
        'cerrada_at' => 'datetime',
        'subtotal_sellado' => 'decimal:2',
        'iva_sellado' => 'decimal:2',
        'total_sellado' => 'decimal:2',
        'iva_tasa_sellada' => 'decimal:4',
    ];

    public function renglones()
    {
        return $this->hasMany(FactPrefacturaRenglon::class, 'prefactura_id')->orderBy('orden')->orderBy('id');
    }

    public function aeronave()
    {
        return $this->belongsTo(Aeronave::class);
    }

    public function satelite()
    {
        return $this->hasOne(FactAeronave::class, 'aeronave_id', 'aeronave_id');
    }

    public function cliente()
    {
        return $this->belongsTo(FactCliente::class, 'cliente_id');
    }

    public function scopeBorradores($query)
    {
        return $query->where('estado', self::ESTADO_BORRADOR);
    }

    public function scopeCerradas($query)
    {
        return $query->where('estado', self::ESTADO_CERRADA);
    }

    public function estaCerrada(): bool
    {
        return $this->estado === self::ESTADO_CERRADA;
    }

    /** La tasa vigente, o la sellada si la prefactura ya se cerró. */
    public function ivaTasa(): string
    {
        if ($this->iva_tasa_sellada !== null) {
            return (string) $this->iva_tasa_sellada;
        }

        return number_format((float) FactConfiguracion::valor('iva_tasa', self::IVA_TASA_POR_OMISION), 4, '.', '');
    }

    /**
     * Suma de los importes derivados. Se suma con bcadd para no pasar por float:
     * cada importe ya viene como cadena de dos decimales.
     */
    public function subtotal(): string
    {
        if ($this->subtotal_sellado !== null) {
            return (string) $this->subtotal_sellado;
        }

        $suma = '0.00';

        foreach ($this->renglones as $renglon) {
            $suma = bcadd($suma, $renglon->importe(), 2);
        }

        return $suma;
    }

    public function iva(): string
    {
        if ($this->iva_sellado !== null) {
            return (string) $this->iva_sellado;
        }

        return bcmul($this->subtotal(), $this->ivaTasa(), 2);
    }

    public function total(): string
    {
        if ($this->total_sellado !== null) {
            return (string) $this->total_sellado;
        }

        return bcadd($this->subtotal(), $this->iva(), 2);
    }
}
