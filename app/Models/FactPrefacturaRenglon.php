<?php

namespace App\Models;

use App\Services\RenglonDePrefacturaCerradaException;
use App\Support\ImporteServicio;
use Illuminate\Database\Eloquent\Model;

class FactPrefacturaRenglon extends Model
{
    protected $table = 'fact_prefactura_renglones';

    protected $fillable = [
        'prefactura_id', 'servicio_id', 'nombre_servicio', 'precio_unitario', 'cantidad',
        'es_de_tercero', 'margen', 'ajuste_precio', 'concepto', 'proveedor_id', 'remision', 'orden', 'es_cortesia', 'grupo',
    ];

    protected $casts = [
        'precio_unitario' => 'decimal:4',
        'margen' => 'decimal:2',
        'es_de_tercero' => 'boolean',
        'cantidad' => 'integer',
        'es_cortesia' => 'boolean',
    ];

    protected $appends = ['importe'];

    /**
     * Un renglón de una prefactura cerrada no se crea, no se edita, no se mueve y
     * no se borra. La guarda vive aquí y no solo en el controlador para que el
     * invariante se sostenga con cualquier camino que pase por el modelo.
     *
     * El estado se consulta en la base y no en la relación cacheada: una instancia
     * de prefactura obsoleta en memoria no debe dejar pasar la escritura.
     *
     * Límite conocido: las escrituras masivas del constructor de consultas
     * (`renglones()->update()`, `->delete()`) y la cascada de la llave foránea no
     * disparan eventos del modelo y no pasan por esta guarda.
     */
    protected static function booted(): void
    {
        static::saving(function (self $renglon) {
            $destino = $renglon->prefactura_id;
            $origen = $renglon->exists ? $renglon->getOriginal('prefactura_id') : null;

            foreach (array_unique(array_filter([$destino, $origen])) as $prefacturaId) {
                self::rechazarSiCerrada($prefacturaId);
            }
        });

        static::deleting(function (self $renglon) {
            self::rechazarSiCerrada($renglon->prefactura_id);
        });
    }

    private static function rechazarSiCerrada(int|string $prefacturaId): void
    {
        $estado = FactPrefactura::query()->whereKey($prefacturaId)->value('estado');

        if ($estado === FactPrefactura::ESTADO_CERRADA) {
            throw new RenglonDePrefacturaCerradaException;
        }
    }

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
     *
     * Un renglón de cortesía no cobra. La comprobación va AQUÍ y no en
     * `ImporteServicio::calcular()`: esa es la fórmula compartida —la usan también el
     * catálogo y la vista previa de la pantalla— y no tiene por qué saber de
     * cortesías. Los valores congelados no se tocan, así que quitar la cortesía
     * devuelve el importe exacto, con su margen y su ajuste; el sistema viejo lo
     * recalcula como `precio × cantidad` y pierde los dos (`cortecia.php:24`).
     */
    public function importe(): string
    {
        if ($this->es_cortesia) {
            return '0.00';
        }

        return $this->importeSinCortesia();
    }

    /**
     * Lo que el renglón cobraría si no fuera cortesía: la cifra que la cortesía
     * deja de cobrar (o que vuelve a cobrar al quitarla). No depende de si
     * `es_cortesia` está puesta, por eso sirve para registrar el cambio en la
     * bitácora en los dos sentidos con la misma cifra.
     */
    public function importeSinCortesia(): string
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
