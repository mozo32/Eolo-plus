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

            return static::create([
                'precio_asa' => $precioAsa,
                'precio_eolo' => $precioEolo ?? FactConfiguracion::precioEoloSugerido($precioAsa),
                'vigencia_inicio' => $hoy,
                'vigencia_fin' => null,
                'user_id' => $userId,
            ]);
        });
    }

    public function capturadoPor()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
