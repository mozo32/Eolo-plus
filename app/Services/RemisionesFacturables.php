<?php

namespace App\Services;

use App\Models\FactPrefactura;
use App\Models\Remision;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Qué remisiones de combustible puede cobrar una prefactura.
 *
 * La regla de «tomada» vive aquí y en un solo sitio, porque la consultan tres caminos: el
 * endpoint que sincroniza, el buscador del modal y la validación del alta a mano. Repartida,
 * las tres copias se desalinearían y el síntoma sería cobrar dos veces el mismo combustible.
 *
 * Una remisión está TOMADA si cualquiera de las dos:
 *
 * 1. `status_prefactura = 1`, que es la marca manual que Rampa ya pone desde su propia
 *    pantalla (89 remisiones de 330 lo están hoy).
 * 2. Existe un renglón que la referencia en una prefactura con `status = 'A'`.
 *
 * La segunda mira el estado de la PREFACTURA y no solo la existencia del renglón, y eso es lo
 * que hace que no haya contabilidad manual: descartar una prefactura solo pone `status = 'N'` y
 * deja sus renglones en pie, así que la remisión vuelve a estar libre sola. Quitar el renglón
 * la libera igual.
 */
final class RemisionesFacturables
{
    /**
     * Las remisiones LIBRES de la matrícula de la prefactura dentro de su estancia.
     *
     * Es lo que la sincronización agrega. La ventana va de `llegada_at` al `salida_at` si lo
     * hay y a `now()` si no: al capturar la prefactura casi nunca hay salida todavía.
     *
     * @return Collection<int, Remision>
     */
    public static function candidatas(FactPrefactura $prefactura): Collection
    {
        $matricula = $prefactura->aeronave?->matricula;

        if ($matricula === null || $prefactura->llegada_at === null) {
            return collect();
        }

        $inicio = Carbon::parse($prefactura->llegada_at);
        $fin = $prefactura->salida_at ? Carbon::parse($prefactura->salida_at) : now();

        if ($fin->lessThan($inicio)) {
            return collect();
        }

        // El filtro por DIA va en SQL y la hora exacta en PHP. Combinar fecha y hora en SQL
        // pediría `timestamp()`, que es de MySQL y que sqlite —donde corren las pruebas— no
        // tiene; y el resto de facturación no usa SQL crudo en ningún sitio. Con 330 remisiones
        // y 93 matrículas, lo que llega a PHP tras el filtro por día son unas pocas filas.
        return self::deLaMatricula($matricula)
            ->whereNotNull('precio')
            ->whereBetween('fecha', [$inicio->toDateString(), $fin->toDateString()])
            ->where('status_prefactura', false)
            ->whereNotExists(self::yaCobradaEnUnaPrefacturaActiva(...))
            ->orderBy('fecha')
            ->orderBy('hora_inicial')
            ->orderBy('id')
            ->get()
            ->filter(fn (Remision $r) => self::momentoDe($r)->betweenIncluded($inicio, $fin))
            ->values();
    }

    /** Cuándo empezó la carga. Sin `hora_inicial`, cuenta como las 00:00 de su día. */
    public static function momentoDe(Remision $remision): Carbon
    {
        return Carbon::parse($remision->fecha)
            ->setTimeFromTimeString($remision->hora_inicial ?: '00:00:00');
    }

    /**
     * Las remisiones de una matrícula para el buscador del modal: TODAS, con o sin precio y
     * tomadas o no, cada una con `tomada_por` y `sin_precio` puestos.
     *
     * No acota por ventana a propósito: el buscador manual es justo para los casos que la
     * automática no cubre.
     *
     * @return Collection<int, Remision>
     */
    public static function paraElegir(string $matricula, ?int $excluyePrefacturaId = null): Collection
    {
        return self::deLaMatricula($matricula)
            ->orderByDesc('fecha')
            ->orderByDesc('hora_inicial')
            ->orderByDesc('id')
            ->get()
            ->each(function (Remision $remision) use ($excluyePrefacturaId) {
                $remision->sin_precio = $remision->precio === null;
                $remision->tomada_por = self::quienLaTiene($remision, $excluyePrefacturaId);
            });
    }

    /** @return Builder<Remision> */
    private static function deLaMatricula(string $matricula): Builder
    {
        return Remision::query()
            ->where('status', 'A')
            ->whereRaw('upper(trim(matricula)) = ?', [mb_strtoupper(trim($matricula))]);
    }

    /**
     * LA mitad 2 de la regla de «tomada»: los renglones (alias `r`) que viven en una prefactura
     * ACTIVA (alias `p`). Es el único sitio donde está escrito el `join` y el `p.status = 'A'`;
     * `candidatas()` y `quienLaTiene()` parten los dos de aquí, de modo que no se puede quitar
     * el filtro en uno y dejarlo en el otro.
     */
    private static function renglonesEnPrefacturaActiva(QueryBuilder $consulta): QueryBuilder
    {
        return $consulta
            ->from('fact_prefactura_renglones as r')
            ->join('fact_prefacturas as p', 'p.id', '=', 'r.prefactura_id')
            ->where('p.status', 'A');
    }

    private static function yaCobradaEnUnaPrefacturaActiva(QueryBuilder $consulta): void
    {
        self::renglonesEnPrefacturaActiva($consulta->select(DB::raw(1)))
            ->whereColumn('r.remision_combustible_id', 'remisiones.id');
    }

    /** El documento que ya la tiene, o null si está libre. */
    private static function quienLaTiene(Remision $remision, ?int $excluyePrefacturaId): ?string
    {
        if ($remision->status_prefactura) {
            return $remision->folio_orden_venta ?: 'otro documento';
        }

        $renglon = self::renglonesEnPrefacturaActiva(DB::query())
            ->where('r.remision_combustible_id', $remision->id)
            ->when($excluyePrefacturaId !== null, fn ($q) => $q->where('p.id', '<>', $excluyePrefacturaId))
            ->select('p.id', 'p.folio')
            ->first();

        if ($renglon === null) {
            return null;
        }

        return $renglon->folio ?: "borrador #{$renglon->id}";
    }
}
