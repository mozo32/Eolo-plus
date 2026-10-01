<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class FactPrecioCombustible extends Model
{
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
            // combustible se cobraría al precio anterior. Va dentro de la
            // transacción: o se registran el precio nuevo, la sincronía y su
            // rastro, o no se registra nada.
            static::sincronizarServicio($precio, $userId);

            return $precio;
        });
    }

    /**
     * Restablece el invariante «el precio del servicio de combustible es igual al
     * precio Eolo vigente» sin registrar ningún precio nuevo.
     *
     * Existe para el importador: `ImportadorMatriculas::importarServicios()`
     * reescribe el precio de TODOS los servicios con el valor del origen, y este
     * servicio es uno de ellos. `importarCombustible()` protege el precio Eolo
     * vigente, pero corre antes y no protege el precio del servicio, así que una
     * corrida con `--forzar` dejaba la pantalla de Combustible mostrando el precio
     * capturado y el catálogo cobrando el del sistema viejo. Llamar a esto al
     * final de la importación deja el invariante cumplido sin depender del orden.
     *
     * Misma guarda y mismo rastro que la sincronía de `registrar()`: si el precio
     * ya coincide no escribe nada ni reporta nada.
     *
     * @return list<array{servicio: string, anterior: string, nuevo: string}> lo que hubo que corregir
     */
    public static function sincronizarConVigente(int $userId): array
    {
        $vigente = static::vigente();

        return $vigente === null ? [] : static::sincronizarServicio($vigente, $userId);
    }

    /**
     * Fija el precio del servicio de combustible al precio Eolo recién
     * registrado y deja rastro del cambio, con el valor anterior.
     *
     * Es el único precio que el bloque 1b cambia a propósito, así que es el que
     * hay que poder explicar después. Se busca por su concepto
     * (`FactServicio::CONCEPTO_COMBUSTIBLE`, columna única) y no por su nombre, así
     * que el servicio se puede renombrar sin romper la sincronía, y ningún otro
     * servicio puede quedar dentro de ella por llamarse igual. Solo entre los
     * activos: si no existe o está dado de baja no actualiza nada y tampoco falla.
     *
     * @return list<array{servicio: string, anterior: string, nuevo: string}> lo que cambió
     */
    private static function sincronizarServicio(self $precio, int $userId): array
    {
        $cambios = [];

        $servicios = FactServicio::query()
            ->porConcepto(FactServicio::CONCEPTO_COMBUSTIBLE)
            ->where('status', FactServicio::STATUS_ACTIVO)
            ->get();

        foreach ($servicios as $servicio) {
            $anterior = $servicio->precio_unitario;

            if ((float) $anterior === (float) $precio->precio_eolo) {
                continue;
            }

            $servicio->update(['precio_unitario' => $precio->precio_eolo]);

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
                accion: Bitacora::ACCION_ACTUALIZAR,
                descripcion: "El precio del servicio '{$servicio->nombre}' pasó de {$anterior} a {$precio->precio_eolo} al registrar el precio del combustible.",
                usuarioId: $userId,
                registroId: $servicio->id,
                datosAnteriores: ['precio_unitario' => $anterior],
                datosNuevos: ['precio_unitario' => $servicio->precio_unitario],
            );

            $cambios[] = [
                'servicio' => $servicio->nombre,
                'anterior' => (string) $anterior,
                'nuevo' => (string) $servicio->precio_unitario,
            ];
        }

        return $cambios;
    }

    public function capturadoPor()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
