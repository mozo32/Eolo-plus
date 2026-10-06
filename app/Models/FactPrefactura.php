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
        'nota_interna', 'nota_externa', 'nota_factura',
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

    /**
     * Quien cerró la prefactura, que es quien la emitió. El documento lo nombra en
     * «Elaborado por», en lugar del literal «AJE» que el PDF viejo trae escrito a mano
     * mientras `id_elaborador` no lo lee nadie.
     */
    public function cerradaPor()
    {
        return $this->belongsTo(User::class, 'cerrada_por');
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
     * La tasa como la lleva el papel: `'16%'` para `0.1600`, `'8%'` para `0.0800`,
     * `'16.5%'` para `0.1650`. Existe porque el documento impreso lleva un porcentaje y
     * la columna guarda una razón. Sigue a `ivaTasa()`, así que usa la tasa sellada si ya
     * se cerró y no pasa por `float`. Lanza igual que `ivaTasa()`.
     */
    public function ivaTasaEtiqueta(): string
    {
        // Con escala 2 `bcmul` siempre devuelve un punto, así que recortar ceros no se
        // come cifras enteras ('100.00' queda '100').
        $porcentaje = bcmul($this->ivaTasa(), '100', 2);

        return rtrim(rtrim($porcentaje, '0'), '.').'%';
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
     * Solo los pagos activos: la baja es lógica, igual que en el resto del módulo.
     *
     * Las restricciones de un `hasMany` no se copian como atributos al crear: un
     * pago creado por aquí toma su `status` del default de la columna ('A').
     */
    public function pagos()
    {
        return $this->hasMany(FactPrefacturaPago::class, 'prefactura_id')
            ->where('status', FactPrefacturaPago::STATUS_ACTIVO)
            ->orderBy('id');
    }

    /**
     * Suma de los pagos activos. Los seis derivados del cobro consultan la base
     * (`pagos()->...`) y no la relación cacheada (`$this->pagos`), por la misma razón
     * que `subtotalDerivado()` con los renglones: un número de cobro que no ve el pago
     * recién registrado en esta misma instancia miente en silencio.
     *
     * No depende de la tasa de IVA, así que puede devolver su número aunque
     * `porCobrar()` y `sobrepago()` lancen por una tasa ilegible en `total()`.
     */
    public function pagado(): string
    {
        $suma = '0.00';

        foreach ($this->pagos()->get() as $pago) {
            $suma = bcadd($suma, (string) $pago->monto, 2);
        }

        return $suma;
    }

    /**
     * Lo que falta por cobrar. Nunca negativo: el exceso es `sobrepago()`. Lanza
     * `UnexpectedValueException` si `total()` lo hace (tasa de IVA ilegible).
     */
    public function porCobrar(): string
    {
        $falta = bcsub($this->total(), $this->pagado(), 2);

        return bccomp($falta, '0.00', 2) > 0 ? $falta : '0.00';
    }

    /**
     * Lo cobrado por encima del total. Nunca negativo. Lanza igual que `porCobrar()`.
     *
     * Lo que SIGNIFICA se reparte entre `cambio()` (lo que se devuelve, hasta el
     * efectivo que entró) y `cobradoDeMas()` (el resto, que se corrige en el pago).
     */
    public function sobrepago(): string
    {
        $exceso = bcsub($this->pagado(), $this->total(), 2);

        return bccomp($exceso, '0.00', 2) > 0 ? $exceso : '0.00';
    }

    /**
     * Suma de los pagos activos cuya forma de pago tiene concepto efectivo. Se busca
     * por el CONCEPTO y no por el nombre, que se edita en pantalla. Lee la base y no
     * la relación cacheada, igual que `pagado()`.
     *
     * No depende de la tasa de IVA: no lanza aunque `total()` sí lo haga.
     */
    public function efectivoPagado(): string
    {
        $suma = '0.00';

        $enEfectivo = $this->pagos()
            ->whereHas('formaPago', fn ($q) => $q->porConcepto(FactFormaPago::CONCEPTO_EFECTIVO))
            ->get();

        foreach ($enEfectivo as $pago) {
            $suma = bcadd($suma, (string) $pago->monto, 2);
        }

        return $suma;
    }

    /**
     * Lo que se DEVUELVE al cliente: el menor entre el sobrepago y el efectivo que
     * entró. No puede pasar del efectivo recibido: no se da en cambio dinero que no
     * se cobró en efectivo. Es lo que hace el sistema viejo (`mpago.php`: monto menos
     * total, acotado por el efectivo). Se compara con `bccomp` y no con `min()` de PHP por
     * la misma regla del resto del camino del dinero: todo se compara como decimal
     * de escala fija, sin depender de cómo PHP ordene dos cadenas numéricas.
     *
     * Lanza `UnexpectedValueException` si `total()` lo hace (tasa de IVA ilegible),
     * porque depende de `sobrepago()`.
     */
    public function cambio(): string
    {
        $sobrepago = $this->sobrepago();
        $efectivo = $this->efectivoPagado();

        return bccomp($sobrepago, $efectivo, 2) <= 0 ? $sobrepago : $efectivo;
    }

    /**
     * El resto del sobrepago: lo cobrado de más que NO se devuelve sino que se
     * corrige en el pago. Nace cuando se cobra y luego el documento se edita (se
     * quita un servicio) o cuando se paga con tarjeta por encima del total.
     *
     * `cambio()` y `cobradoDeMas()` pueden ser distintos de cero A LA VEZ: sobre un
     * total de 116.00, Visa 200.00 más efectivo 10.00 dan sobrepago 94.00, cambio
     * 10.00 (el efectivo que entró) y cobrado de más 84.00 (el resto, de la tarjeta).
     * Los tres suman: `cambio() + cobradoDeMas() = sobrepago()`.
     *
     * Lanza `UnexpectedValueException` si `total()` lo hace, porque depende de
     * `sobrepago()`. De los seis derivados del cobro, solo `pagado()` y
     * `efectivoPagado()` están a salvo de la tasa.
     */
    public function cobradoDeMas(): string
    {
        return bcsub($this->sobrepago(), $this->cambio(), 2);
    }

    /**
     * Compara el sello de una prefactura cerrada contra lo que hoy derivan sus
     * renglones, y devuelve en qué difieren: `['total' => ['sellado' => '232.00',
     * 'derivado' => '105099.00']]`. Vacío si coinciden o si es borrador (un borrador
     * no tiene sello que comparar).
     *
     * Existe porque el sello es redundante a propósito, y toda redundancia puede
     * separarse: eso es lo que produjo los 830 encabezados del sistema viejo cuyo
     * total no corresponde a sus renglones —el 22% de sus 3,764 folios, medido—. Si
     * al leer una prefactura cerrada la derivación no coincide con su foto, el
     * sistema lo dice en lugar de callarlo.
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
