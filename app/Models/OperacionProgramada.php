<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OperacionProgramada extends Model
{
    use HasFactory;

    protected $table = 'operaciones_programadas';

    public const STATUS_ACTIVA = 'A';
    public const STATUS_CANCELADA = 'I';
    /** Ya se registró en Operaciones Diarias: sale del tablero de Despacho. */
    public const STATUS_REALIZADA = 'R';

    public const MODULO_OPERACIONES_DIARIAS = 'operaciones_diarias';
    public const MODULO_WALKAROUND = 'walkaround';

    protected $fillable = [
        'user_id',
        'fecha',
        'tipo',
        'matricula',
        'equipo',
        'hora',
        'lugar',
        'pax',
        'fp',
        'fp_folio',
        'observaciones',
        'status',
    ];

    protected $casts = [
        'fecha' => 'date:Y-m-d',
        'pax' => 'integer',
    ];

    /**
     * Módulos que pueden consumir una operación programada.
     *
     * @return array<string, class-string>
     */
    public static function modulos(): array
    {
        return [
            self::MODULO_OPERACIONES_DIARIAS => OperacionDiaria::class,
            self::MODULO_WALKAROUND => WalkAround::class,
        ];
    }

    /**
     * Traduce el nombre de módulo al modelo que registra el uso.
     */
    public static function claseDeModulo(?string $modulo): ?string
    {
        return self::modulos()[strtolower(trim((string) $modulo))] ?? null;
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function usos(): HasMany
    {
        return $this->hasMany(OperacionProgramadaUso::class);
    }

    public function scopeActivas(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVA);
    }

    /**
     * Programadas que todavía no han sido usadas por el módulo indicado.
     *
     * Se aceptan las activas y las ya realizadas: que Operaciones Diarias la
     * registre la saca del tablero de Despacho, pero WalkAround la sigue viendo
     * pendiente hasta que también la use. Solo las canceladas quedan fuera.
     */
    public function scopePendientesPara(Builder $query, string $modulo): Builder
    {
        $clase = self::claseDeModulo($modulo);

        return $query->whereIn('status', [self::STATUS_ACTIVA, self::STATUS_REALIZADA])
            ->whereDoesntHave('usos', function ($usos) use ($clase) {
                $usos->where('usable_type', $clase);
            });
    }

    public function usadaEn(string $modulo): bool
    {
        $clase = self::claseDeModulo($modulo);

        return $this->usos()
            ->where('usable_type', $clase)
            ->exists();
    }

    /**
     * Vincula una operación programada con el registro final que la consumió.
     *
     * Se usa dentro de la transacción de Operaciones Diarias y de WalkAround.
     * Si la programación ya fue utilizada por ese mismo módulo aborta con 422
     * y la transacción hace rollback, de modo que una programación nunca genera
     * dos registros en el mismo módulo.
     */
    public static function vincular(
        ?int $operacionProgramadaId,
        Model $registro,
        ?int $userId = null
    ): ?OperacionProgramadaUso {
        if (! $operacionProgramadaId) {
            return null;
        }

        $programada = self::query()->find($operacionProgramadaId);

        if (! $programada) {
            abort(422, 'La operación programada indicada no existe.');
        }

        if ($programada->status === self::STATUS_CANCELADA) {
            abort(422, 'La operación programada indicada fue cancelada.');
        }

        $yaUsada = $programada->usos()
            ->where('usable_type', $registro->getMorphClass())
            ->exists();

        if ($yaUsada) {
            abort(422, 'Esta operación programada ya fue utilizada en este módulo.');
        }

        $uso = $programada->usos()->create([
            'usable_type' => $registro->getMorphClass(),
            'usable_id' => $registro->getKey(),
            'user_id' => $userId,
        ]);

        // El registro en Operaciones Diarias es el que da por realizada la
        // programación. El de WalkAround solo deja su uso: la operación sigue
        // disponible para el otro módulo.
        if ($registro->getMorphClass() === OperacionDiaria::class) {
            $programada->update(['status' => self::STATUS_REALIZADA]);
        }

        return $uso;
    }

    /**
     * Nombres de módulo donde ya se utilizó esta programación.
     *
     * @return array<int, string>
     */
    public function getModulosUsadosAttribute(): array
    {
        $porClase = array_flip(self::modulos());

        return $this->usos
            ->map(fn ($uso) => $porClase[$uso->usable_type] ?? null)
            ->filter()
            ->values()
            ->all();
    }
}
