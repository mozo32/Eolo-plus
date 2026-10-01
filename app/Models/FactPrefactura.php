<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use UnexpectedValueException;

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

    /**
     * La tasa vigente, o la sellada si la prefactura ya se cerró.
     *
     * La tasa se normaliza como cadena, sin pasar por float.
     */
    public function ivaTasa(): string
    {
        $sellada = $this->sellado('iva_tasa_sellada');

        if ($sellada !== null) {
            return $sellada;
        }

        $vigente = trim((string) FactConfiguracion::valor('iva_tasa', self::IVA_TASA_POR_OMISION));

        // Una tasa ilegible no se interpreta: cobrar con una tasa inventada es peor
        // que fallar. `bcadd` con medio punto base redondea a los 4 decimales.
        if (preg_match('/^(\d+(\.\d+)?|\.\d+)$/', $vigente) !== 1) {
            throw new UnexpectedValueException("iva_tasa de fact_configuracion no es un decimal: '{$vigente}'");
        }

        return bcadd($vigente, '0.00005', 4);
    }

    /**
     * Suma de los importes derivados (o el sello, si ya está cerrada). Se suma con
     * bcadd para no pasar por float: cada importe ya viene como cadena de dos
     * decimales.
     */
    public function subtotal(): string
    {
        return $this->sellado('subtotal_sellado') ?? $this->subtotalDerivado();
    }

    /**
     * El IVA se REDONDEA al centavo, no se trunca. Referencia: el sistema viejo
     * (`Prefectura/prefactura.php:102`) hace `$iv = $caja * 0.16` y lo muestra con
     * `number_format` (línea 556), que redondea. Truncar cobraría hasta un centavo
     * menos de IVA en una fracción considerable de las prefacturas (26.06 da 4.16
     * truncado contra 4.17 redondeado).
     */
    public function iva(): string
    {
        return $this->sellado('iva_sellado') ?? $this->ivaDerivado($this->subtotal(), $this->ivaTasa());
    }

    public function total(): string
    {
        return $this->sellado('total_sellado') ?? bcadd($this->subtotal(), $this->iva(), 2);
    }

    /**
     * Compara el sello de una prefactura cerrada contra lo que hoy derivan sus
     * renglones, y devuelve en qué difieren: `['total' => ['sellado' => '232.00',
     * 'derivado' => '105099.00']]`. Vacío si coinciden o si es borrador (un borrador
     * no tiene sello que comparar).
     *
     * Existe porque el sello es redundante a propósito, y toda redundancia puede
     * separarse: eso es lo que produjo los 37 encabezados del sistema viejo cuyo
     * total no corresponde a sus renglones. Si al leer una prefactura cerrada la
     * derivación no coincide con su foto, el sistema lo dice en lugar de callarlo.
     * Un campo del sello que falte en una cerrada también cuenta como discrepancia.
     *
     * La derivación usa la tasa sellada, no la vigente: la tasa de hoy puede
     * legítimamente ser otra.
     *
     * @return array<string, array{sellado: ?string, derivado: string}>
     */
    public function discrepanciasDelSello(): array
    {
        if (! $this->estaCerrada()) {
            return [];
        }

        $tasa = $this->ivaTasa();
        $subtotal = $this->subtotalDerivado();
        $iva = $this->ivaDerivado($subtotal, $tasa);

        $diferencias = [];

        foreach ([
            'subtotal' => [$this->sellado('subtotal_sellado'), $subtotal],
            'iva' => [$this->sellado('iva_sellado'), $iva],
            'total' => [$this->sellado('total_sellado'), bcadd($subtotal, $iva, 2)],
        ] as $campo => [$sellado, $derivado]) {
            if ($sellado === null || bccomp($sellado, $derivado, 2) !== 0) {
                $diferencias[$campo] = ['sellado' => $sellado, 'derivado' => $derivado];
            }
        }

        if ($this->sellado('iva_tasa_sellada') === null) {
            $diferencias['iva_tasa'] = ['sellado' => null, 'derivado' => $tasa];
        }

        return $diferencias;
    }

    public function selloDiscrepa(): bool
    {
        return $this->discrepanciasDelSello() !== [];
    }

    /**
     * El sello de una columna, solo si la prefactura está cerrada. Decide el
     * estado y no que la columna sea no nula: un sello parcial en un borrador no
     * puede mandar sobre la derivación.
     */
    private function sellado(string $columna): ?string
    {
        if (! $this->estaCerrada() || $this->{$columna} === null) {
            return null;
        }

        return (string) $this->{$columna};
    }

    /**
     * Lee los renglones de la base y no la relación cacheada: un total derivado
     * que no ve el renglón recién agregado a la misma instancia miente en silencio.
     */
    private function subtotalDerivado(): string
    {
        $suma = '0.00';

        foreach ($this->renglones()->get() as $renglon) {
            $suma = bcadd($suma, $renglon->importe(), 2);
        }

        return $suma;
    }

    /**
     * Delega en `calcularIva()`, igual que `FactServicio::importe()` delega en
     * `ImporteServicio::calcular()`: la fórmula vive en un solo lugar.
     */
    private function ivaDerivado(string $subtotal, string $tasa): string
    {
        return self::calcularIva($subtotal, $tasa);
    }

    /**
     * La fórmula del IVA, en un solo lugar. Pública y estática para que quien
     * necesite el mismo número sin tener una prefactura —el comando
     * `facturacion:comparar-prefacturas`, que la aplica al subtotal GUARDADO del
     * histórico— llame a esta y no escriba otra copia: si hubiera dos, la red que
     * existe para detectar una divergencia podría desalinearse de lo que verifica.
     *
     * Medio centavo antes de truncar, en aritmética de cadenas: redondea hacia
     * arriba en el medio sin pasar por float. `bcmul` a escala 6 es exacto
     * (subtotal de 2 decimales por tasa de 4).
     */
    public static function calcularIva(string $subtotal, string $tasa): string
    {
        return bcadd(bcmul($subtotal, $tasa, 6), '0.005', 2);
    }
}
