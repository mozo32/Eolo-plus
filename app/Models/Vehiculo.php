<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Vehiculo extends Model
{
    use HasFactory;

    protected $table = 'vehiculos';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'nombre',
        'estado',
        'activo',
        'ultima_actividad',
    ];

    protected function casts(): array
    {
        return [
            'activo' => 'boolean',
        ];
    }

    /**
     * Movimientos del vehículo, del más reciente al más antiguo.
     *
     * Apuntaba a `Movimiento::class`, que no existe: el modelo se llama
     * `movimientoVehiculo`. Nadie la usaba, así que el defecto estaba dormido.
     */
    public function movimientos(): HasMany
    {
        return $this->hasMany(movimientoVehiculo::class, 'vehiculo_id')
            ->orderBy('created_at', 'desc');
    }
}
