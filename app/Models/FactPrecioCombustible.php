<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class FactPrecioCombustible extends Model
{
    /**
     * Nombre del servicio cuyo precio sigue al precio Eolo del combustible.
     *
     * El sistema viejo lo apunta por id fijo (`actualizar_combustible.php` hace
     * `WHERE id_servicio='7'`, y el 7 es esta fila). Aqui no hay un id estable que
     * sobreviva a la importacion, asi que el vinculo es el nombre; por eso
     * `UpdateServicioRequest` impide renombrarlo: si se renombra, la sincronia deja
     * de encontrarlo y el combustible se cobraria al precio anterior sin aviso.
     */
    public const SERVICIO_COMBUSTIBLE = 'Combustible JET A-1';

    protected $table = 'fact_precios_combustible';

    protected $fillable = [
        'precio_asa',
        'precio_eolo',
        'vigencia_inicio',
        'vigencia_fin',
        'user_id',
    ];

    protected $casts = [
        'precio_asa' => 'decimal:4',
        'precio_eolo' => 'decimal:4',
        'vigencia_inicio' => 'date',
        'vigencia_fin' => 'date',
    ];

    /** El precio en uso: el único sin fecha de cierre. */
    public static function vigente(): ?self
    {
        return static::query()->whereNull('vigencia_fin')->latest('id')->first();
    }

    /**
     * Registra un precio nuevo y cierra el anterior. Si no se indica el precio
     * de Eolo se calcula con la fórmula de la configuración.
     */
    public static function registrar(float $precioAsa, ?float $precioEolo, int $userId): self
    {
        return DB::transaction(function () use ($precioAsa, $precioEolo, $userId) {
            $hoy = now()->timezone('America/Mexico_City')->toDateString();

            static::query()
                ->whereNull('vigencia_fin')
                ->update(['vigencia_fin' => $hoy, 'updated_at' => now()]);

            $precio = static::create([
                'precio_asa' => $precioAsa,
                'precio_eolo' => $precioEolo ?? FactConfiguracion::precioEoloSugerido($precioAsa),
                'vigencia_inicio' => $hoy,
                'vigencia_fin' => null,
                'user_id' => $userId,
            ]);

            // El sistema viejo sincroniza el precio del servicio de combustible
            // con el precio Eolo (`actualizar_combustible.php`). Sin esto, el
            // combustible se cobraría al precio anterior.
            //
            // Se busca por nombre (ver SERVICIO_COMBUSTIBLE): si no existe o está
            // dado de baja no actualiza nada y tampoco falla. Es el único punto
            // donde un renombrado silencioso dejaría el precio desfasado, y de
            // ahí la guarda en `UpdateServicioRequest`. El `where` lo resuelve
            // MySQL con la collation de la columna, la misma comparación
            // insensible a la caja que aplica esa guarda.
            FactServicio::query()
                ->where('nombre', self::SERVICIO_COMBUSTIBLE)
                ->where('status', FactServicio::STATUS_ACTIVO)
                ->update(['precio_unitario' => $precio->precio_eolo, 'updated_at' => now()]);

            return $precio;
        });
    }

    public function capturadoPor()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
