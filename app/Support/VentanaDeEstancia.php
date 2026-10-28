<?php

namespace App\Support;

use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/**
 * La ventana de una estancia: desde cuándo y hasta cuándo cuenta un servicio de esa aeronave
 * como parte de su prefactura.
 *
 * Pura a propósito, igual que `App\Services\CalculadoraEstancia`: recibe dos momentos y no sabe
 * nada de la base de datos. Quien la usa le pasa `llegada_at` y `salida_at`.
 *
 * **Sin salida registrada la estancia sigue abierta y la ventana NO tiene tope.** Antes el tope
 * era `now()`, y eso escondía un error real: Tráfico anota un servicio a las 18:00 cuando el
 * reloj va por la mañana y no aparecía en la prefactura hasta que pasaban las 18:00. Registrar
 * la salida es lo que cierra la ventana.
 *
 * El coste de esa regla, que es conocido: mientras la estancia esté abierta entra CUALQUIER
 * servicio de esa matrícula, por lejana que sea su fecha, incluido uno teclado por error para
 * el mes que viene. Se ve en la prefactura y se puede quitar a mano.
 *
 * Existe para que la regla esté en UN solo sitio. Estaba copiada en tres —las dos
 * `*Facturables` y el aviso de «fuera de ventana» del controlador— y tres copias de la misma
 * regla divergen: arreglar dos y olvidar la tercera habría dejado al controlador avisando de
 * que un renglón se salió de una ventana que para los otros dos sigue conteniéndolo.
 */
final class VentanaDeEstancia
{
    private function __construct(
        public readonly Carbon $inicio,
        public readonly ?Carbon $fin,
    ) {}

    /**
     * La ventana de esa llegada y esa salida, o `null` si no hay ventana posible.
     *
     * No hay ventana sin llegada, ni con una salida anterior a la llegada. Ese segundo caso lo
     * rechaza el editor antes de guardar; aquí se responde «nada entra» en vez de lanzar, para
     * no ser una segunda puerta con otra respuesta.
     */
    public static function de(CarbonInterface|string|null $llegada, CarbonInterface|string|null $salida): ?self
    {
        if ($llegada === null) {
            return null;
        }

        $inicio = Carbon::parse($llegada);
        $fin = $salida === null ? null : Carbon::parse($salida);

        if ($fin !== null && $fin->lessThan($inicio)) {
            return null;
        }

        return new self($inicio, $fin);
    }

    /** Si ese momento cae dentro, con los dos extremos incluidos. */
    public function contiene(CarbonInterface $momento): bool
    {
        if ($momento->lessThan($this->inicio)) {
            return false;
        }

        return $this->fin === null || $momento->lessThanOrEqualTo($this->fin);
    }

    /** Si la estancia sigue abierta, o sea si la ventana no tiene tope. */
    public function estaAbierta(): bool
    {
        return $this->fin === null;
    }

    /**
     * El día de la llegada, para el filtro por DÍA que va en SQL.
     *
     * El filtro se parte en dos —el día en SQL y la hora exacta en PHP con `contiene()`—
     * porque combinar fecha y hora en SQL pediría `timestamp()` o `CONCAT()`, que son de MySQL
     * y que sqlite, donde corren las pruebas, no tiene.
     */
    public function diaInicial(): string
    {
        return $this->inicio->toDateString();
    }

    /** El día de la salida, o `null` si la estancia sigue abierta: entonces no hay tope en SQL. */
    public function diaFinal(): ?string
    {
        return $this->fin?->toDateString();
    }

    /**
     * El día SIGUIENTE al de la salida, para comparar con `<` en vez de con `<=`.
     *
     * Lo necesitan las columnas casteadas como `date`: Eloquent las guarda con su formato de
     * fecha-hora (`2026-10-22 00:00:00`) en sqlite, y comparadas como texto contra
     * `2026-10-22` esas filas quedarían FUERA de su propio día.
     */
    public function diaSiguienteAlFinal(): ?string
    {
        return $this->fin?->copy()->addDay()->toDateString();
    }
}
