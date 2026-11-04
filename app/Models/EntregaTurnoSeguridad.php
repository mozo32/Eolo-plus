<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphToMany;

/**
 * El relevo de turno de UN puesto de Seguridad.
 *
 * Un día normal tiene dos filas, una del frente y una de atrás. No hay
 * índice único sobre día y sección a propósito: un relevo extra —un turno
 * partido, una emergencia— es un dato verdadero y el sistema no debe
 * negarse a guardarlo. Quien agrupe por día tiene que saber que una
 * sección puede traer más de una fila.
 */
class EntregaTurnoSeguridad extends Model
{
    protected $table = 'entregas_turno_seguridad';

    public const SECCION_FRENTE = 'frente';

    public const SECCION_ATRAS = 'atras';

    /** @var list<string> */
    public const SECCIONES = [self::SECCION_FRENTE, self::SECCION_ATRAS];

    public const PERNOCTA_HECHA = 'S';

    public const PERNOCTA_NO_HECHA = 'N';

    public const PERNOCTA_SIN_REVISAR = 'R';

    /** @var list<string> */
    public const PERNOCTA_ESTADOS = [
        self::PERNOCTA_HECHA,
        self::PERNOCTA_NO_HECHA,
        self::PERNOCTA_SIN_REVISAR,
    ];

    public const ROL_QUIEN_ENTREGA = 'quien_entrega';

    public const ROL_FBO = 'fbo';

    /**
     * Los ocho apartados que se contestan con una casilla.
     *
     * La pernocta mensual NO está aquí: lleva tres estados porque es una
     * tarea mensual y «hoy no la hice» es lo normal casi todos los días.
     *
     * @var list<string>
     */
    public const CASILLAS = [
        'aviones_csae',
        'combustible',
        'resguardo_vehicular',
        'estacionamiento',
        'posiciones',
        'vehiculos',
        'operaciones',
        'visitantes',
    ];

    /** @var list<string> */
    protected $fillable = [
        'user_id',
        'fecha_hora',
        'seccion',
        'aviones_csae',
        'combustible',
        'resguardo_vehicular',
        'estacionamiento',
        'posiciones',
        'vehiculos',
        'operaciones',
        'visitantes',
        'pernocta_mensual',
        'observaciones',
        'status',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'fecha_hora' => 'datetime',
            'aviones_csae' => 'boolean',
            'combustible' => 'boolean',
            'resguardo_vehicular' => 'boolean',
            'estacionamiento' => 'boolean',
            'posiciones' => 'boolean',
            'vehiculos' => 'boolean',
            'operaciones' => 'boolean',
            'visitantes' => 'boolean',
        ];
    }

    public function scopeActivas(Builder $query): Builder
    {
        return $query->where('status', 'A');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** Solo las firmas vigentes: el pivote retirado queda en `N`. */
    public function firmas(): MorphToMany
    {
        return $this->morphToMany(Firma::class, 'firmable', 'firmables')
            ->withPivot(['rol', 'tag', 'orden', 'status'])
            ->wherePivot('status', 'A')
            ->withTimestamps();
    }

    /** Todas, incluidas las retiradas. La usan el historial y las pruebas. */
    public function firmasAll(): MorphToMany
    {
        return $this->morphToMany(Firma::class, 'firmable', 'firmables')
            ->withPivot(['rol', 'tag', 'orden', 'status']);
    }

    /**
     * Si ya hay firma vigente de ese rol.
     *
     * Lee la relación YA CARGADA para no disparar una consulta por
     * renglón al armar el listado. Quien la llame tiene que haber hecho
     * `load('firmas')` o `with('firmas')`.
     */
    public function tieneFirmaDe(string $rol): bool
    {
        return $this->firmas->contains(
            fn (Firma $firma): bool => $firma->pivot->rol === $rol
        );
    }
}
