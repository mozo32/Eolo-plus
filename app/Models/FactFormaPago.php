<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class FactFormaPago extends Model
{
    public const STATUS_ACTIVO = 'A';

    public const STATUS_INACTIVO = 'N';

    /** Las tres con regla de cobro propia en el código (el saldo a favor, más abajo, solo se identifica). */
    public const CONCEPTO_EFECTIVO = 'efectivo';

    public const CONCEPTO_AMEX = 'amex';

    public const CONCEPTO_AVCARD = 'avcard';

    /**
     * Dinero que el cliente ya tenía a su favor, aplicado contra la cuenta.
     *
     * Es una forma de pago y no un renglón negativo a propósito: un saldo a favor es
     * dinero, no un precio menor, así que la cuenta conserva su base gravable y su IVA.
     * El sistema viejo lo capturaba como renglón con precio negativo —4 casos en el
     * histórico, con la remisión «SaldoaFavor»— y eso bajaba el IVA.
     *
     * No genera cambio: `cambio()` se acota al efectivo cobrado y este pago no es
     * efectivo, así que un sobrepago con saldo a favor es `cobradoDeMas()`.
     *
     * El sistema NO lleva la cuenta del saldo de cada cliente: el importe lo escribe el
     * operador, igual que el efectivo.
     */
    public const CONCEPTO_SALDO_A_FAVOR = 'saldo_a_favor';

    protected $table = 'fact_formas_pago';

    protected $fillable = ['nombre', 'concepto', 'status'];

    public function scopeActivos(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVO);
    }

    public function scopePorConcepto(Builder $query, string $concepto): Builder
    {
        return $query->where('concepto', $concepto);
    }
}
