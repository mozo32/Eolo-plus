<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Model;

class NotaOperacional extends Model
{
    protected $table = 'notas_operacionales';
    protected $fillable = [
        'descripcion',
        'departamento_id',
        'subdepartamento_id',
        'creado_por_user_id',
        'validado_por_user_id',
    ];

    public function departamento(): BelongsTo
    {
        return $this->belongsTo(Departamento::class, 'departamento_id');
    }

    /**
     * Obtiene el subdepartamento asociado a la nota.
     */
    public function subdepartamento(): BelongsTo
    {
        return $this->belongsTo(SubDepartamento::class, 'subdepartamento_id');
    }
}
