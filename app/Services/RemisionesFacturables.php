<?php

namespace App\Services;

use App\Models\FactPrefactura;
use App\Models\FactPrefacturaRemisionExcluida;
use App\Models\Remision;
use App\Support\VentanaDeEstancia;
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
     * Es lo que la sincronización agrega. La ventana la decide `VentanaDeEstancia`: empieza en
     * `llegada_at` y termina en `salida_at` si lo hay; si no lo hay —el caso normal al capturar
     * la prefactura— la estancia sigue abierta y NO tiene tope.
     *
     * @return Collection<int, Remision>
     */
    public static function candidatas(FactPrefactura $prefactura): Collection
    {
        $matricula = $prefactura->aeronave?->matricula;

        if ($matricula === null || $prefactura->llegada_at === null) {
            return collect();
        }

        $ventana = VentanaDeEstancia::de($prefactura->llegada_at, $prefactura->salida_at);

        if ($ventana === null) {
            return collect();
        }

        // El filtro por DIA va en SQL y la hora exacta en PHP. Combinar fecha y hora en SQL
        // pediría `timestamp()`, que es de MySQL y que sqlite —donde corren las pruebas— no
        // tiene; y el resto de facturación no usa SQL crudo en ningún sitio. Con 330 remisiones
        // y 93 matrículas, lo que llega a PHP tras el filtro por día son unas pocas filas.
        //
        // El tope por día solo se pone si la estancia está cerrada: abierta no tiene ninguno.
        return self::deLaMatricula($matricula)
            ->whereNotNull('precio')
            ->where('fecha', '>=', $ventana->diaInicial())
            ->when($ventana->diaFinal(), fn (Builder $consulta, string $dia) => $consulta->where('fecha', '<=', $dia))
            ->where('status_prefactura', false)
            ->whereNotExists(self::yaCobradaEnUnaPrefacturaActiva(...))
            ->whereNotExists(fn (QueryBuilder $consulta) => self::excluidaAMano($consulta, $prefactura->id))
            ->orderBy('fecha')
            ->orderBy('hora_inicial')
            ->orderBy('id')
            ->get()
            ->filter(fn (Remision $r) => $ventana->contiene(self::momentoDe($r)))
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
     * tomadas o no, cada una con `tomada_por`, `en_este_documento` y `sin_precio` puestos.
     *
     * No acota por ventana a propósito: el buscador manual es justo para los casos que la
     * automática no cubre.
     *
     * `$excluyePrefacturaId` es la prefactura que se está editando: una remisión que ya tiene
     * renglón ahí sale con `en_este_documento` en verdadero y sin `tomada_por`, no como libre:
     * `tomada_por` es solo de quién la tiene OTRO documento.
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
                $remision->en_este_documento = self::estaEnEsteDocumento($remision, $excluyePrefacturaId);
                $remision->tomada_por = $remision->en_este_documento ? null : self::quienLaTiene($remision);
            });
    }

    /**
     * La matrícula como se compara: Rampa la teclea a mano, así que minúsculas y espacios de
     * sobra no son otra aeronave.
     *
     * Vive aquí porque la comparan DOS vías y tienen que coincidir: `deLaMatricula()`, que es
     * la automática, y `StoreRenglonRequest`, que ata el alta a mano a la matrícula de la
     * prefactura. Una de las dos normalizando distinto sería la divergencia de vuelta.
     */
    public static function normalizarMatricula(?string $matricula): string
    {
        return mb_strtoupper(trim((string) $matricula));
    }

    /** @return Builder<Remision> */
    private static function deLaMatricula(string $matricula): Builder
    {
        return Remision::query()
            ->where('status', 'A')
            ->whereRaw('upper(trim(matricula)) = ?', [self::normalizarMatricula($matricula)]);
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

    /** Las que el operador quitó A MANO de ESTA prefactura. Ver `excluir()`. */
    private static function excluidaAMano(QueryBuilder $consulta, int $prefacturaId): void
    {
        $consulta->select(DB::raw(1))
            ->from('fact_prefactura_remisiones_excluidas as x')
            ->where('x.prefactura_id', $prefacturaId)
            ->whereColumn('x.remision_id', 'remisiones.id');
    }

    /**
     * Apunta que el operador quitó esta remisión de esta prefactura a propósito.
     *
     * Se llama al borrar un renglón que lleva `remision_combustible_id`. Sin esto, quitar el
     * renglón libera la remisión y la siguiente carga de la pantalla —que sincroniza siempre,
     * y eso es deliberado— la vuelve a meter con su importe.
     *
     * Idempotente: quitar y volver a quitar es la misma decisión, y la tabla tiene un único
     * por la pareja.
     */
    public static function excluir(FactPrefactura $prefactura, int $remisionId, int $userId): void
    {
        FactPrefacturaRemisionExcluida::firstOrCreate(
            ['prefactura_id' => $prefactura->id, 'remision_id' => $remisionId],
            ['user_id' => $userId],
        );
    }

    /**
     * Borra la exclusión: volver a poner la remisión A MANO en esa misma prefactura revoca la
     * decisión anterior.
     *
     * Si no, la remisión quedaría marcada como «esta no entra» mientras su renglón está puesto,
     * y la contradicción se vería en cuanto el renglón se tocara por otra vía.
     */
    public static function revocarExclusion(FactPrefactura $prefactura, int $remisionId): void
    {
        FactPrefacturaRemisionExcluida::query()
            ->where('prefactura_id', $prefactura->id)
            ->where('remision_id', $remisionId)
            ->delete();
    }

    /**
     * Si la remisión ya tiene renglón en la prefactura que se está editando.
     *
     * Hay tres estados y no dos: libre, tomada por OTRO documento (que se puede elegir a mano
     * para rescatar una marca puesta por error) y ya en ESTE documento, que no se puede repetir
     * porque sería cobrar dos veces el mismo despacho. Por eso la propia prefactura no se
     * excluye: se nombra aparte, con un booleano y no con una frase que la pantalla compare.
     */
    private static function estaEnEsteDocumento(Remision $remision, ?int $enPrefacturaId): bool
    {
        return $enPrefacturaId !== null && self::renglonesEnPrefacturaActiva(DB::query())
            ->where('r.remision_combustible_id', $remision->id)
            ->where('p.id', $enPrefacturaId)
            ->exists();
    }

    /** El documento que ya la tiene (otro, o este si se llama sin excluirlo), o null si está libre. */
    private static function quienLaTiene(Remision $remision): ?string
    {
        if ($remision->status_prefactura) {
            return $remision->folio_orden_venta ?: 'otro documento';
        }

        $renglon = self::renglonesEnPrefacturaActiva(DB::query())
            ->where('r.remision_combustible_id', $remision->id)
            ->select('p.id', 'p.folio')
            ->first();

        if ($renglon === null) {
            return null;
        }

        return $renglon->folio ?: "borrador #{$renglon->id}";
    }
}
