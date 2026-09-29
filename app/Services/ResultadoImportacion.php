<?php

namespace App\Services;

/** Lo que dejó una corrida del importador: conteos, hallazgos y si escribió o solo simuló. */
final class ResultadoImportacion
{
    /** @var array<string,int> */
    public array $conteos = [];

    /** @var string[] */
    public array $hallazgos = [];

    /** False cuando fue una simulación: se revirtió todo al final. */
    public bool $aplicado = false;

    public function contar(string $clave, int $cuantos = 1): void
    {
        $this->conteos[$clave] = ($this->conteos[$clave] ?? 0) + $cuantos;
    }

    public function hallazgo(string $texto): void
    {
        $this->hallazgos[] = $texto;
    }
}
