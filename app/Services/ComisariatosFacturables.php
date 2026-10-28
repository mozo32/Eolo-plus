<?php

namespace App\Services;

use App\Models\FactPrefactura;
use App\Models\FactPrefacturaComisariatoExcluido;
use App\Models\ServicioComisariato;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Qué comisariatos puede cobrar una prefactura.
 *
 * Hermano de `RemisionesFacturables`, y más simple que él: aquí «tomado» es UNA sola cosa
 * —existe un renglón que lo referencia en una prefactura con `status = 'A'`— porque no hay
 * una marca manual anterior equivalente a `status_prefactura`. Una fuente de verdad, no dos.
 *
 * Como allí, la regla vive en un solo sitio porque la consultan tres caminos: el endpoint que
 * sincroniza, el buscador del modal y la validación del alta a mano. Repartida, las tres
 * copias se desalinearían y el síntoma sería cobrar dos veces el mismo comisariato.
 *
 * La regla mira el estado de la PREFACTURA y no solo la existencia del renglón, y eso es lo que
 * hace que no haya contabilidad manual: descartar una prefactura solo pone `status = 'N'` y
 * deja sus renglones en pie, así que el comisariato vuelve a estar libre solo. Quitar el
 * renglón lo libera igual.
 */
final class ComisariatosFacturables
{
    /**
     * Los comisariatos LIBRES de la matrícula de la prefactura dentro de su estancia.
     *
     * Es lo que la sincronización agrega. La ventana va de `llegada_at` al `salida_at` si lo
     * hay y a `now()` si no: al capturar la prefactura casi nunca hay salida todavía.
     *
     * Trae cada comisariato con su proveedor ya cargado (`with('factServicio')`): quien arma el renglón
     * lo lee, y cargarlo aquí evita una consulta por comisariato sin que el llamador tenga que
     * suponer qué tipo de colección le llega en las salidas tempranas.
     *
     * Excluye los que no tienen proveedor: `fact_prefactura_renglones.servicio_id` es NOT NULL,
     * así que sin servicio no hay renglón posible. NO excluye los de importe 0: esos entran y
     * la pantalla los marca, porque pueden ser una cortesía o un importe que falta por
     * capturar, y eso lo sabe quien factura.
     *
     * @return Collection<int, ServicioComisariato>
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

        // El filtro por DIA va en SQL y la hora exacta en PHP, igual que en remisiones y por el
        // mismo motivo: combinar fecha y hora en SQL pediría `timestamp()` o `CONCAT()`, que son
        // de MySQL y que sqlite —donde corren las pruebas— no tiene.
        //
        // El día final va como «menor que el día SIGUIENTE» y no como `whereBetween`: el modelo
        // castea `fecha_entrega` como `date`, y Eloquent la guarda con su formato de fecha-hora
        // (`2026-10-21 00:00:00`) en sqlite. Comparada como texto contra `2026-10-21`, esa fila
        // queda FUERA del último día. En MySQL la columna `date` la trunca y no se notaría;
        // así el filtro es correcto en las dos.
        return self::deLaMatricula($matricula)
            ->with('factServicio')
            ->whereNotNull('fact_servicio_id')
            ->where('fecha_entrega', '>=', $inicio->toDateString())
            ->where('fecha_entrega', '<', $fin->copy()->addDay()->toDateString())
            ->whereNotExists(self::yaCobradoEnUnaPrefacturaActiva(...))
            ->whereNotExists(fn (QueryBuilder $consulta) => self::excluidoAMano($consulta, $prefactura->id))
            ->orderBy('fecha_entrega')
            ->orderBy('hora_entrega')
            ->orderBy('id')
            ->get()
            ->filter(fn (ServicioComisariato $c) => self::momentoDe($c)->betweenIncluded($inicio, $fin))
            ->values();
    }

    /**
     * Cuándo se entregó.
     *
     * El modelo castea `hora_entrega` como `datetime:H:i`, así que llega como una fecha-hora
     * con el día de HOY. Se toma SOLO su parte horaria y se monta sobre `fecha_entrega`. Sin
     * `hora_entrega`, cuenta como las 00:00 de su día.
     */
    public static function momentoDe(ServicioComisariato $comisariato): Carbon
    {
        return Carbon::parse($comisariato->fecha_entrega)
            ->setTimeFromTimeString($comisariato->hora_entrega?->format('H:i:s') ?: '00:00:00');
    }

    /**
     * Los comisariatos de una matrícula para el buscador del modal: TODOS, con o sin proveedor,
     * con o sin importe y tomados o no, cada uno con `tomado_por`, `en_este_documento`,
     * `sin_proveedor` y `sin_importe` puestos.
     *
     * No acota por ventana a propósito: el buscador manual es justo para los casos que la
     * automática no cubre.
     *
     * Trae el proveedor de cada comisariato con `with('factServicio')` DENTRO, igual que
     * `candidatas()`: el llamador no carga nada por fuera. Un `->load()` de quien llama es la forma
     * que ya reventó una vez, cuando una salida temprana devolvió un `collect()` pelado.
     *
     * `$excluyePrefacturaId` es la prefactura que se está editando: un comisariato que ya tiene
     * renglón ahí sale con `en_este_documento` en verdadero y sin `tomado_por`, no como libre:
     * `tomado_por` es solo de quién lo tiene OTRO documento.
     *
     * @return Collection<int, ServicioComisariato>
     */
    public static function paraElegir(string $matricula, ?int $excluyePrefacturaId = null): Collection
    {
        return self::deLaMatricula($matricula)
            ->with('factServicio')
            ->orderByDesc('fecha_entrega')
            ->orderByDesc('hora_entrega')
            ->orderByDesc('id')
            ->get()
            ->each(function (ServicioComisariato $comisariato) use ($excluyePrefacturaId) {
                $comisariato->sin_proveedor = $comisariato->fact_servicio_id === null;
                $comisariato->sin_importe = (float) $comisariato->subtotal === 0.0;
                $comisariato->en_este_documento = self::estaEnEsteDocumento($comisariato, $excluyePrefacturaId);
                $comisariato->tomado_por = $comisariato->en_este_documento ? null : self::quienLoTiene($comisariato);
            });
    }

    /**
     * La matrícula como se compara: Tráfico la teclea a mano, así que minúsculas y espacios de
     * sobra no son otra aeronave.
     *
     * La usa `deLaMatricula()`, o sea la vía AUTOMÁTICA y el buscador, que emparejan por texto
     * exacto (lo aceptó el usuario). El alta a mano NO se limita a esto: `StoreRenglonRequest`
     * tolera además guiones y espacios interiores. La comparación de la vía automática tiene DOS
     * lados: esta función (el parámetro) y el `upper(trim(matricula))` del SQL de `deLaMatricula()`.
     * Aflojar solo uno NO ensancha el emparejamiento, lo rompe: el parámetro pasaría a `XAAMI` y la
     * columna seguiría siendo `XA-AMI`, y la sincronización dejaría de traer toda matrícula con
     * guion. Arrastrar comisariatos de una grafía a prefacturas de otra exige cambiar los dos
     * lados, y eso es una decisión con dinero detrás que no debe tomarse de pasada.
     */
    public static function normalizarMatricula(?string $matricula): string
    {
        return mb_strtoupper(trim((string) $matricula));
    }

    /** @return Builder<ServicioComisariato> */
    private static function deLaMatricula(string $matricula): Builder
    {
        return ServicioComisariato::query()
            ->where('status', 'A')
            ->whereRaw('upper(trim(matricula)) = ?', [self::normalizarMatricula($matricula)]);
    }

    /**
     * La regla de «tomado»: los renglones (alias `r`) que viven en una prefactura ACTIVA (alias
     * `p`). Es el único sitio donde está escrito el `join` y el `p.status = 'A'`;
     * `candidatas()` y `quienLoTiene()` parten los dos de aquí, de modo que no se puede quitar
     * el filtro en uno y dejarlo en el otro.
     */
    private static function renglonesEnPrefacturaActiva(QueryBuilder $consulta): QueryBuilder
    {
        return $consulta
            ->from('fact_prefactura_renglones as r')
            ->join('fact_prefacturas as p', 'p.id', '=', 'r.prefactura_id')
            ->where('p.status', 'A');
    }

    private static function yaCobradoEnUnaPrefacturaActiva(QueryBuilder $consulta): void
    {
        self::renglonesEnPrefacturaActiva($consulta->select(DB::raw(1)))
            ->whereColumn('r.servicio_comisariato_id', 'servicio_comisariatos.id');
    }

    /** Los que el operador quitó A MANO de ESTA prefactura. Ver `excluir()`. */
    private static function excluidoAMano(QueryBuilder $consulta, int $prefacturaId): void
    {
        $consulta->select(DB::raw(1))
            ->from('fact_prefactura_comisariatos_excluidos as x')
            ->where('x.prefactura_id', $prefacturaId)
            ->whereColumn('x.servicio_comisariato_id', 'servicio_comisariatos.id');
    }

    /**
     * Apunta que el operador quitó este comisariato de esta prefactura a propósito.
     *
     * Se llama al borrar un renglón que lleva `servicio_comisariato_id`. Sin esto, quitar el
     * renglón libera el comisariato y la siguiente carga de la pantalla —que sincroniza
     * siempre, y eso es deliberado— lo vuelve a meter con su importe.
     *
     * Idempotente: quitar y volver a quitar es la misma decisión, y la tabla tiene un único
     * por la pareja.
     */
    public static function excluir(FactPrefactura $prefactura, int $comisariatoId, int $userId): void
    {
        FactPrefacturaComisariatoExcluido::firstOrCreate(
            ['prefactura_id' => $prefactura->id, 'servicio_comisariato_id' => $comisariatoId],
            ['user_id' => $userId],
        );
    }

    /**
     * Borra la exclusión: volver a poner el comisariato A MANO en esa misma prefactura revoca
     * la decisión anterior.
     *
     * Si no, el comisariato quedaría marcado como «este no entra» mientras su renglón está
     * puesto, y la contradicción se vería en cuanto el renglón se tocara por otra vía.
     */
    public static function revocarExclusion(FactPrefactura $prefactura, int $comisariatoId): void
    {
        FactPrefacturaComisariatoExcluido::query()
            ->where('prefactura_id', $prefactura->id)
            ->where('servicio_comisariato_id', $comisariatoId)
            ->delete();
    }

    /**
     * Si el comisariato ya tiene renglón en la prefactura que se está editando.
     *
     * Hay tres estados y no dos: libre, tomado por OTRO documento y ya en ESTE documento. Ni el
     * segundo ni el tercero se pueden elegir: los dos son cobrar dos veces la misma entrega (a
     * diferencia de remisiones, donde «tomada» puede ser una marca a mano sin renglón detrás y
     * por eso se puede rescatar). Por eso la propia prefactura no se excluye: se nombra aparte,
     * con un booleano y no con una frase que la pantalla compare.
     */
    private static function estaEnEsteDocumento(ServicioComisariato $comisariato, ?int $enPrefacturaId): bool
    {
        return $enPrefacturaId !== null && self::renglonesEnPrefacturaActiva(DB::query())
            ->where('r.servicio_comisariato_id', $comisariato->id)
            ->where('p.id', $enPrefacturaId)
            ->exists();
    }

    /** El documento que ya lo tiene (otro, o este si se llama sin excluirlo), o null si está libre. */
    public static function quienLoTiene(ServicioComisariato $comisariato): ?string
    {
        $renglon = self::renglonesEnPrefacturaActiva(DB::query())
            ->where('r.servicio_comisariato_id', $comisariato->id)
            ->select('p.id', 'p.folio')
            ->first();

        if ($renglon === null) {
            return null;
        }

        return $renglon->folio ?: "borrador #{$renglon->id}";
    }
}
