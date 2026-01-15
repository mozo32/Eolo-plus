<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\User;

class Bitacora extends Model
{
    protected $table = 'bitacoras';

    protected $fillable = [
        'fecha',
        'hora',
        'modulo',
        'accion',
        'descripcion',
        'usuario_id',
        'elabora',
    ];

    protected $casts = [
        'fecha' => 'date',
        'hora'  => 'datetime:H:i',
    ];

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public static function log(
        string $modulo,
        string $accion,
        string $descripcion,
        ?int $usuarioId = null,
        ?string $elabora = null
    ): self {
        return self::create([
            'fecha' => now()->toDateString(),
            'hora' => now()->toTimeString(),
            'modulo' => $modulo,
            'accion' => $accion,
            'descripcion' => $descripcion,
            'usuario_id' => $usuarioId ?? auth()->id(),
            'elabora' => $elabora,
        ]);
    }
}
