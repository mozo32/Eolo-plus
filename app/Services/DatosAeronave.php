<?php
// app/Services/DatosAeronave.php

namespace App\Services;

/**
 * Los cuatro campos que el sistema viejo obtenía con un join entre
 * tb_matricula, tb_estatus, tb_tipo y tb_categoria. Es el contrato que
 * consumen los controladores reapuntados.
 */
final class DatosAeronave
{
    public function __construct(
        public readonly string $matricula,
        public readonly ?string $tipo,
        public readonly string $estatus,
        public readonly ?string $categoria,
    ) {}

    public function toArray(): array
    {
        return [
            'matricula' => $this->matricula,
            'tipo' => $this->tipo,
            'estatus' => $this->estatus,
            'categoria' => $this->categoria,
        ];
    }
}
