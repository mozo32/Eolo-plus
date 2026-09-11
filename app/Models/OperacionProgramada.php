<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Services\SecuenciaMovimientoService;

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
     * Programadas que todavía están pendientes para el módulo indicado.
     *
     * Para Operaciones Diarias, "realizada" significa que ya no le hace falta,
     * haya llegado por su propio registro o por la mano de Despacho: solo cuentan
     * las activas. Para WalkAround, una realizada sigue pendiente hasta que él
     * mismo la use. Las canceladas quedan fuera para ambos.
     */
    public function scopePendientesPara(Builder $query, string $modulo): Builder
    {
        $clase = self::claseDeModulo($modulo);

        $estados = $clase === OperacionDiaria::class
            ? [self::STATUS_ACTIVA]
            : [self::STATUS_ACTIVA, self::STATUS_REALIZADA];

        return $query->whereIn('status', $estados)
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

        // Una realizada ya no le sirve a Operaciones Diarias, la haya cerrado su
        // propio registro o Despacho a mano. WalkAround sí puede seguir usándola.
        if (
            $programada->status === self::STATUS_REALIZADA
            && $registro->getMorphClass() === OperacionDiaria::class
        ) {
            abort(422, 'La operación programada indicada ya fue finalizada.');
        }

        $yaUsada = $programada->usos()
            ->where('usable_type', $registro->getMorphClass())
            ->exists();

        if ($yaUsada) {
            abort(422, 'Esta operación programada ya fue utilizada en este módulo.');
        }

        // Solo se vincula por ID explícito, y ese ID tiene que corresponder al
        // registro que se está guardando. Nunca se relaciona por coincidencia.
        self::exigirCoherencia($programada, $registro);

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
     * La programada debe describir la misma operación que el registro final:
     * misma matrícula, mismo movimiento y mismo día. Entiende el vocabulario de
     * WalkAround (entrada) y el de Operaciones Diarias (llegada).
     */
    private static function exigirCoherencia(self $programada, Model $registro): void
    {
        $matriculaRegistro = strtoupper(trim((string) $registro->getAttribute('matricula')));

        if (strtoupper(trim((string) $programada->matricula)) !== $matriculaRegistro) {
            abort(422, "La operación programada corresponde a la matrícula {$programada->matricula}, no a {$matriculaRegistro}.");
        }

        // En WalkAround "tipo" es avión/helicóptero; el movimiento va en otra
        // columna. En Operaciones Diarias el movimiento sí se llama "tipo".
        $columnaMovimiento = $registro instanceof WalkAround ? 'movimiento' : 'tipo';

        $movimientoRegistro = SecuenciaMovimientoService::normalizar(
            (string) $registro->getAttribute($columnaMovimiento)
        );

        if (SecuenciaMovimientoService::normalizar($programada->tipo) !== $movimientoRegistro) {
            abort(422, "La operación programada es una {$programada->tipo}; no coincide con el movimiento que se está registrando.");
        }

        $fechaProgramada = self::soloDia($programada->fecha);
        $fechaRegistro = self::soloDia($registro->getAttribute('fecha'));

        if ($fechaProgramada !== $fechaRegistro) {
            abort(422, "La operación programada es del {$fechaProgramada} y el registro es del {$fechaRegistro}.");
        }
    }

    private static function soloDia($fecha): string
    {
        if ($fecha instanceof \DateTimeInterface) {
            return $fecha->format('Y-m-d');
        }

        return substr(str_replace('T', ' ', (string) $fecha), 0, 10);
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
