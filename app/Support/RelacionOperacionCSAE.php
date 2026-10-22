<?php

namespace App\Support;

use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Qué corridas de motor de CSAE pertenecen a cada estancia de Operaciones Diarias.
 *
 * Reglas del negocio: la operación diaria se registra ANTES que la entrada a CSAE; la salida de
 * operación diaria puede registrarse sin que exista salida de CSAE (las entradas y salidas de CSAE
 * son para correr motores); y dentro de UNA llegada/salida puede haber MUCHOS pares de CSAE.
 *
 * La pertenencia es por SOLAPE, no por contención. El intervalo de la corrida va de su entrada a su
 * salida (o hasta `$ahora` si no tiene salida); el de la estancia, de la llegada a la primera salida
 * posterior de la misma matrícula (o sin techo si no la hay). Una corrida es de la estancia si los
 * dos intervalos se cruzan, extremos incluidos. Así una corrida registrada un minuto antes de la
 * llegada no se pierde, y una cuya salida se registró después de la salida de operación diaria
 * tampoco.
 *
 * Una corrida se MUESTRA en todas las estancias que solapan con ella, y se CUENTA en una sola: la
 * de llegada más reciente. Las demás la enseñan como referencia, con `csae_es_referencia` en true
 * y sus agregados en cero, de modo que la suma de visitas sobre todas las filas sigue siendo el
 * número de corridas. Las que no solapan con ninguna estancia son los huérfanos.
 *
 * CUIDADO con las estancias sin salida. No tienen techo, así que solapan con todo lo posterior.
 * Mientras cada corrida se asignaba a una sola estancia eso era inofensivo: la llegada más
 * reciente se la quedaba y la fila abierta salía vacía. Ahora la fila abierta las MUESTRA todas,
 * así que a una llegada a la que se le olvidó registrar la salida le aparecerán corridas
 * posteriores que no son suyas. Los totales no se ven afectados, porque la dueña sigue siendo la
 * llegada más reciente. Ponerle techo en la siguiente llegada --solo para lo que se muestra, no
 * para elegir dueña-- cerraría el hueco; hoy no cambiaría ni una fila de los datos reales.
 *
 * No toca la base de datos ni la petición: recibe colecciones y devuelve datos, así que se prueba
 * sin HTTP. A las operaciones les añade, sin quitar ni renombrar nada, los campos que el Excel del
 * navegador ya lee: `mantenimiento_csae`, `fecha_hora_csae`, `fecha_hora_salida_csae`,
 * `movimientos_csae`, `csae_es_referencia`, `cantidad_visitas_csae`, `minutos_estancia_csae_total`
 * y `salidas_csae_pendientes`.
 */
final class RelacionOperacionCSAE
{
    private const FORMATO_FECHA_HORA = 'd/m/Y H:i:s';

    /**
     * @param  Collection<int, object>  $operaciones  Las filas que se van a decorar y devolver (las que
     *                                                pasaron los filtros de la petición). Cada una con
     *                                                `id`, `tipo`, `matricula`, `fecha` y `hora`.
     * @param  Collection<int, object>  $movimientos  Las corridas de CSAE candidatas, con `id`,
     *                                                `matricula`, `fecha_hora_entrada` y
     *                                                `fecha_hora_salida`. Las que no tengan entrada se
     *                                                ignoran.
     * @param  Collection<int, object>|null  $historial  La línea de tiempo con la que se decide qué
     *                                                   estancia es la «más reciente» y cuándo cierra
     *                                                   cada una: TODAS las operaciones de esas
     *                                                   matrículas, no solo las filtradas. Si se omite,
     *                                                   se usa `$operaciones`. Sin ella, un filtro por
     *                                                   fechas haría que una estancia sin salida a la
     *                                                   vista se quedara con las corridas de la
     *                                                   siguiente.
     * @param  CarbonInterface|null  $ahora  Hasta cuándo dura una corrida sin salida (por defecto,
     *                                       ahora).
     * @return array{operaciones: Collection<int, object>, huerfanos: Collection<int, array<string, mixed>>}
     */
    public static function relacionar(
        Collection $operaciones,
        Collection $movimientos,
        ?Collection $historial = null,
        ?CarbonInterface $ahora = null,
    ): array {
        $ahora = $ahora ? Carbon::instance($ahora) : Carbon::now();

        $estanciasPorMatricula = self::estanciasPorMatricula($historial ?? $operaciones);
        $mostradas = [];
        $poseidas = [];
        $huerfanos = collect();

        foreach (self::corridasEnOrden($movimientos) as $corrida) {
            $estancias = self::estanciasQueSolapan(
                $estanciasPorMatricula->get($corrida['matricula'], []),
                $corrida,
                $ahora,
            );

            if ($estancias === []) {
                $huerfanos->push(self::huerfano($corrida));

                continue;
            }

            $visita = self::visita($corrida);

            // Las estancias vienen de la mas antigua a la mas reciente, asi que la
            // dueña es la ultima: la misma regla de siempre.
            $claveDeLaDuena = $estancias[array_key_last($estancias)]['clave'];

            foreach ($estancias as $estancia) {
                $mostradas[$estancia['clave']][] = $visita;
            }

            $poseidas[$claveDeLaDuena][] = $visita;
        }

        $operaciones->each(function ($operacion) use ($mostradas, $poseidas) {
            $clave = self::claveDe($operacion);

            self::decorar(
                $operacion,
                $mostradas[$clave] ?? [],
                $poseidas[$clave] ?? [],
            );
        });

        return [
            'operaciones' => $operaciones->values(),
            'huerfanos' => $huerfanos,
        ];
    }

    /**
     * Las estancias de cada matrícula: una por llegada, con su inicio y su fin (o `null` si no tiene
     * salida registrada). Ordenadas de la más antigua a la más reciente.
     *
     * @return Collection<string, array<int, array{clave: string, inicio: Carbon, fin: ?Carbon}>>
     */
    private static function estanciasPorMatricula(Collection $operaciones): Collection
    {
        return $operaciones
            ->map(fn ($operacion) => [
                'clave' => self::claveDe($operacion),
                'matricula' => self::matricula($operacion->matricula),
                'tipo' => mb_strtoupper(trim((string) $operacion->tipo)),
                'momento' => self::momentoDe($operacion),
            ])
            ->sort(fn (array $a, array $b) => [$a['momento'], $a['clave']] <=> [$b['momento'], $b['clave']])
            ->groupBy('matricula')
            ->map(function (Collection $deLaMatricula) {
                $salidas = $deLaMatricula->where('tipo', 'SALIDA');

                return $deLaMatricula
                    ->whereIn('tipo', ['LLEGADA', 'ENTRADA'])
                    ->map(function (array $llegada) use ($salidas) {
                        $salida = $salidas->first(
                            fn (array $posible) => $posible['momento']->greaterThan($llegada['momento'])
                        );

                        return [
                            'clave' => $llegada['clave'],
                            'inicio' => $llegada['momento'],
                            'fin' => $salida['momento'] ?? null,
                        ];
                    })
                    ->values()
                    ->all();
            });
    }

    /**
     * Las corridas con entrada, normalizadas y de la más antigua a la más reciente.
     *
     * @return Collection<int, array{id: mixed, matricula: string, entrada: Carbon, salida: ?Carbon}>
     */
    private static function corridasEnOrden(Collection $movimientos): Collection
    {
        return $movimientos
            ->filter(fn ($movimiento) => $movimiento->fecha_hora_entrada !== null)
            ->map(fn ($movimiento) => [
                'id' => $movimiento->id,
                'matricula' => self::matricula($movimiento->matricula),
                'entrada' => Carbon::parse($movimiento->fecha_hora_entrada),
                'salida' => $movimiento->fecha_hora_salida
                    ? Carbon::parse($movimiento->fecha_hora_salida)
                    : null,
            ])
            ->sort(fn (array $a, array $b) => [$a['entrada'], $a['id']] <=> [$b['entrada'], $b['id']])
            ->values();
    }

    /**
     * Todas las estancias que solapan con la corrida, de la mas antigua a la mas reciente.
     *
     * La aritmetica del solape es la de siempre: el intervalo de la corrida va de su entrada a su
     * salida (o hasta `$ahora`), el de la estancia de la llegada a la primera salida posterior (o
     * sin techo), y pertenecen si se cruzan con los extremos incluidos.
     *
     * @param  array<int, array{clave: string, inicio: Carbon, fin: ?Carbon}>  $estancias  De la mas antigua a la mas reciente.
     * @param  array{entrada: Carbon, salida: ?Carbon}  $corrida
     * @return array<int, array{clave: string, inicio: Carbon, fin: ?Carbon}>
     */
    private static function estanciasQueSolapan(array $estancias, array $corrida, Carbon $ahora): array
    {
        $finDeLaCorrida = $corrida['salida'] ?? $ahora;

        if ($finDeLaCorrida->lessThan($corrida['entrada'])) {
            $finDeLaCorrida = $corrida['entrada'];
        }

        return array_values(array_filter(
            $estancias,
            function (array $estancia) use ($corrida, $finDeLaCorrida) {
                $empiezaAntesDeQueTermineLaCorrida = $estancia['inicio']->lessThanOrEqualTo($finDeLaCorrida);
                $terminaDespuesDeQueEmpieceLaCorrida = $estancia['fin'] === null
                    || $estancia['fin']->greaterThanOrEqualTo($corrida['entrada']);

                return $empiezaAntesDeQueTermineLaCorrida && $terminaDespuesDeQueEmpieceLaCorrida;
            }
        ));
    }

    /**
     * Pone en la operacion los ocho campos del contrato: vacios, y llenos si la estancia cruza
     * alguna corrida.
     *
     * `$mostradas` son todas las corridas que la estancia cruza; `$poseidas`, las que ademas
     * cuenta. Los agregados salen SOLO de las poseidas, para que la suma sobre todas las filas
     * siga siendo el numero de corridas y no una por cada fila que la enseña.
     *
     * @param  array<int, array<string, mixed>>  $mostradas
     * @param  array<int, array<string, mixed>>  $poseidas
     */
    private static function decorar(object $operacion, array $mostradas, array $poseidas): void
    {
        $operacion->mantenimiento_csae = false;
        $operacion->fecha_hora_csae = null;
        $operacion->fecha_hora_salida_csae = null;
        $operacion->movimientos_csae = [];
        $operacion->csae_es_referencia = false;
        $operacion->cantidad_visitas_csae = 0;
        $operacion->minutos_estancia_csae_total = 0;
        $operacion->salidas_csae_pendientes = 0;

        if ($mostradas === []) {
            return;
        }

        $primera = $mostradas[0];

        $operacion->mantenimiento_csae = true;
        $operacion->fecha_hora_csae = $primera['fecha_hora_entrada'];
        $operacion->fecha_hora_salida_csae = $primera['fecha_hora_salida'];
        $operacion->movimientos_csae = $mostradas;
        $operacion->csae_es_referencia = $poseidas === [];
        $operacion->cantidad_visitas_csae = count($poseidas);
        $operacion->minutos_estancia_csae_total = (int) array_sum(array_column($poseidas, 'minutos_estancia'));
        $operacion->salidas_csae_pendientes = count(array_filter($poseidas, fn (array $visita) => $visita['pendiente']));
    }

    /**
     * La corrida tal como la lee el navegador.
     *
     * @param  array{id: mixed, entrada: Carbon, salida: ?Carbon}  $corrida
     * @return array{id: mixed, fecha_hora_entrada: string, fecha_hora_salida: ?string, minutos_estancia: ?int, pendiente: bool}
     */
    private static function visita(array $corrida): array
    {
        $minutos = null;

        if ($corrida['salida'] !== null && $corrida['salida']->greaterThanOrEqualTo($corrida['entrada'])) {
            $minutos = (int) floor($corrida['entrada']->diffInSeconds($corrida['salida']) / 60);
        }

        return [
            'id' => $corrida['id'],
            'fecha_hora_entrada' => $corrida['entrada']->format(self::FORMATO_FECHA_HORA),
            'fecha_hora_salida' => $corrida['salida']?->format(self::FORMATO_FECHA_HORA),
            'minutos_estancia' => $minutos,
            'pendiente' => $corrida['salida'] === null,
        ];
    }

    /**
     * Un huérfano es una visita que además dice de qué matrícula es.
     *
     * @param  array{id: mixed, matricula: string, entrada: Carbon, salida: ?Carbon}  $corrida
     * @return array{id: mixed, matricula: string, fecha_hora_entrada: string, fecha_hora_salida: ?string, minutos_estancia: ?int, pendiente: bool}
     */
    private static function huerfano(array $corrida): array
    {
        $visita = self::visita($corrida);

        return [
            'id' => $visita['id'],
            'matricula' => $corrida['matricula'],
            'fecha_hora_entrada' => $visita['fecha_hora_entrada'],
            'fecha_hora_salida' => $visita['fecha_hora_salida'],
            'minutos_estancia' => $visita['minutos_estancia'],
            'pendiente' => $visita['pendiente'],
        ];
    }

    private static function matricula(mixed $matricula): string
    {
        return mb_strtoupper(trim((string) $matricula));
    }

    private static function momentoDe(object $operacion): Carbon
    {
        return Carbon::parse($operacion->fecha)
            ->setTimeFromTimeString((string) ($operacion->hora ?: '00:00:00'));
    }

    /**
     * Cómo se reconoce una operación entre el historial y las filas a decorar: por `id`, que es lo
     * que tienen en común aunque sean instancias distintas; sin `id` (modelos sin guardar), por
     * identidad de objeto.
     */
    private static function claveDe(object $operacion): string
    {
        return $operacion->id !== null ? 'id:'.$operacion->id : 'objeto:'.spl_object_id($operacion);
    }
}
