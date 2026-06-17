<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Auth;

class Bitacora extends Model
{
    protected $table = 'bitacoras';

    public const MODULO_WALKAROUND = 'WALKAROUND';
    public const MODULO_OPERACIONES_DIARIAS = 'OPERACIONES_DIARIAS';

    public const ACCION_CREAR = 'CREAR';
    public const ACCION_ACTUALIZAR = 'ACTUALIZAR';
    public const ACCION_ELIMINAR = 'ELIMINAR';
    public const ACCION_ACTIVAR = 'ACTIVAR';
    public const ACCION_DESACTIVAR = 'DESACTIVAR';
    public const ACCION_FIRMAR = 'FIRMAR';
    public const ACCION_EXPORTAR = 'EXPORTAR';
    public const ACCION_CONSULTAR = 'CONSULTAR';

    protected $fillable = [
        'fecha',
        'hora',
        'modulo',
        'accion',
        'registro_id',
        'descripcion',
        'datos_anteriores',
        'datos_nuevos',
        'usuario_id',
        'elabora',
    ];

    protected $casts = [
        'fecha' => 'date:Y-m-d',
        'datos_anteriores' => 'array',
        'datos_nuevos' => 'array',
    ];


    public function usuario(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'usuario_id'
        );
    }

    public static function log(
        string $modulo,
        string $accion,
        string $descripcion,
        ?int $usuarioId = null,
        ?string $elabora = null,
        ?int $registroId = null,
        ?array $datosAnteriores = null,
        ?array $datosNuevos = null
    ): self {
        $usuario = $usuarioId !== null
            ? User::query()
                ->select('id', 'name')
                ->find($usuarioId)
            : Auth::user();

        return self::create([
            'fecha' => now()->toDateString(),
            'hora' => now()->format('H:i:s'),
            'modulo' => strtoupper(trim($modulo)),
            'accion' => strtoupper(trim($accion)),
            'registro_id' => $registroId,
            'descripcion' => trim($descripcion),
            'datos_anteriores' => $datosAnteriores,
            'datos_nuevos' => $datosNuevos,
            'usuario_id' => $usuario?->id,
            'elabora' => $elabora
                ?? $usuario?->name
                ?? 'Sistema',
        ]);
    }
}
