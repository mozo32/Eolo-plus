<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphToMany;

/**
 * El relevo de turno de UN puesto de Seguridad.
 *
 * Un día normal tiene dos filas, una de caseta y una de plataforma. No hay
 * índice único sobre día y sección a propósito: un relevo extra —un turno
 * partido, una emergencia— es un dato verdadero y el sistema no debe
 * negarse a guardarlo. Quien agrupe por día tiene que saber que una
 * sección puede traer más de una fila.
 */
class EntregaTurnoSeguridad extends Model
{
    protected $table = 'entregas_turno_seguridad';

    public const SECCION_CASETA = 'caseta';

    public const SECCION_PLATAFORMA = 'plataforma';

    /** @var list<string> */
    public const SECCIONES = [self::SECCION_CASETA, self::SECCION_PLATAFORMA];

    public const ROL_QUIEN_ENTREGA = 'quien_entrega';

    public const ROL_JEFE_AREA = 'jefe_area';

    public const ROL_FBO = 'fbo';

    /**
     * Los dos roles que CIERRAN el relevo, en el orden en que se enseñan.
     *
     * `quien_entrega` no está: esa firma entra al crear y sin ella no hay
     * relevo. Estos dos son los que pueden faltar, los que alimentan la cola
     * de pendientes y los que, al completarse, congelan el resumen.
     *
     * @var list<string>
     */
    public const ROLES_DE_CIERRE = [self::ROL_JEFE_AREA, self::ROL_FBO];

    /** @var list<string> */
    protected $fillable = [
        'user_id',
        'fecha_hora',
        'seccion',
        'resumen',
        'observaciones',
        'status',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'fecha_hora' => 'datetime',
            'resumen' => 'array',
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

    /**
     * Los roles de cierre que todavía no han firmado, en el orden de
     * `ROLES_DE_CIERRE`.
     *
     * Lee la relación YA CARGADA, igual que `tieneFirmaDe`: quien la llame
     * tiene que haber hecho `load('firmas')` o `with('firmas')`.
     *
     * @return list<string>
     */
    public function firmasFaltantes(): array
    {
        return array_values(array_filter(
            self::ROLES_DE_CIERRE,
            fn (string $rol): bool => ! $this->tieneFirmaDe($rol),
        ));
    }

    /**
     * Las tres firmas están puestas: el relevo es un documento cerrado.
     *
     * Incluye la de quien entrega aunque `store` siempre la adjunte: si
     * alguna vez se retirara, el relevo dejaría de estar cerrado y el
     * resumen no debería congelarse.
     */
    public function estaCerrado(): bool
    {
        return $this->tieneFirmaDe(self::ROL_QUIEN_ENTREGA)
            && $this->firmasFaltantes() === [];
    }
}
