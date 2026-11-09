<?php

namespace App\Support;

use App\Models\EstacionamientoSubterraneo;
use App\Models\MovimientoCSAE;
use App\Models\movimientoVehiculo;
use App\Models\OperacionDiaria;
use App\Models\PernoctaDia;
use App\Models\RegistroVisitante;
use Carbon\CarbonInterface;

/**
 * El resumen de un día de Seguridad, leído de los módulos que lo registran.
 *
 * Sustituye a las ocho casillas que alguien marcaba: el relevo ya no
 * pregunta «¿revisaste los vehículos?», dice cuántos movimientos de
 * vehículos hubo.
 *
 * No conoce relevos, solo fechas. Quien lo llame decide si el número se
 * enseña en vivo o se guarda congelado.
 *
 * Son nueve consultas y no seis porque tres de las tablas guardan la entrada
 * y la salida en columnas distintas y cada lado necesita su propio conteo.
 * Juntarlos con sumas condicionales pediría `DATE()` en crudo, que no se
 * comporta igual en MySQL y en el sqlite de las pruebas.
 */
final class ResumenDelDiaSeguridad
{
    /**
     * @return list<array{clave: string, titulo: string, texto: string, entradas?: int, salidas?: int, total?: int}>
     */
    public static function para(CarbonInterface $dia): array
    {
        $fecha = $dia->toDateString();

        /*
         * `where` y `whereDate` conviven a propósito: lo decide el TIPO de la
         * columna, y no se deben «unificar».
         *
         * DATETIME (`whereDate` es imprescindible: una igualdad con
         * `'2026-11-09'` solo atraparía las 00:00:00 y perdería el día):
         * `movimientos_csae.fecha_hora_entrada` / `fecha_hora_salida`,
         * `estacionamiento_subterraneos.fecha_ingreso` / `fecha_salida` y
         * `movimientos_vehiculos.created_at`.
         *
         * DATE (una igualdad directa con `where` basta y deja usar el índice;
         * `whereDate` envuelve la columna en `DATE()` y lo anula):
         * `pernocta_dia.fecha`, que es la única que hoy usa `where`, y
         * `operaciones_diarias.fecha` y `registro_visitantes.fecha_entrada` /
         * `fecha_salida`, que hoy usan `whereDate` sin necesitarlo (da el
         * mismo conteo; solo pierde el índice).
         *
         * Cambiar un DATETIME a `where` rompe el conteo; cambiar un DATE a
         * `whereDate` solo cuesta el índice. Por eso el criterio es el tipo.
         */

        $vehiculos = movimientoVehiculo::query()
            ->whereDate('created_at', $fecha)
            ->selectRaw('tipo, COUNT(*) as total')
            ->groupBy('tipo')
            ->pluck('total', 'tipo');

        $operaciones = OperacionDiaria::activas()
            ->whereDate('fecha', $fecha)
            ->selectRaw('tipo, COUNT(*) as total')
            ->groupBy('tipo')
            ->pluck('total', 'tipo');

        return [
            self::dosLados(
                'aviones_csae',
                'Aviones de CSAE',
                'entrada',
                MovimientoCSAE::query()->where('status', 'A')->whereDate('fecha_hora_entrada', $fecha)->count(),
                MovimientoCSAE::query()->where('status', 'A')->whereDate('fecha_hora_salida', $fecha)->count(),
            ),
            self::dosLados(
                'resguardo_vehicular',
                'Resguardo vehicular',
                'ingreso',
                EstacionamientoSubterraneo::query()->whereDate('fecha_ingreso', $fecha)->count(),
                EstacionamientoSubterraneo::query()->whereDate('fecha_salida', $fecha)->count(),
            ),
            self::dosLados(
                'vehiculos',
                'Vehículos',
                'entrada',
                (int) ($vehiculos['Entrada'] ?? 0),
                (int) ($vehiculos['Salida'] ?? 0),
            ),
            self::dosLados(
                'operaciones',
                'Operaciones',
                'llegada',
                (int) ($operaciones['llegada'] ?? 0),
                (int) ($operaciones['salida'] ?? 0),
            ),
            self::dosLados(
                'visitantes',
                'Visitantes',
                'entrada',
                RegistroVisitante::query()->whereDate('fecha_entrada', $fecha)->count(),
                RegistroVisitante::query()->whereDate('fecha_salida', $fecha)->count(),
            ),
            self::pernocta(PernoctaDia::query()->where('fecha', $fecha)->count()),
        ];
    }

    /**
     * Un renglón de los que tienen dos lados.
     *
     * `$palabraEntrada` cambia por módulo —entrada, ingreso, llegada— porque
     * es la palabra que usa cada pantalla, y quien lee el relevo es la misma
     * gente que las usa. El plural se hace añadiendo una `s`, que vale para
     * las tres.
     *
     * El texto se arma aquí y no en la pantalla para que el navegador no
     * tenga que saber pluralizar en español.
     *
     * @return array{clave: string, titulo: string, texto: string, entradas: int, salidas: int}
     */
    private static function dosLados(
        string $clave,
        string $titulo,
        string $palabraEntrada,
        int $entradas,
        int $salidas,
    ): array {
        return [
            'clave' => $clave,
            'titulo' => $titulo,
            'texto' => $entradas === 0 && $salidas === 0
                ? 'Sin registros'
                : sprintf(
                    '%d %s y %d %s',
                    $entradas,
                    $entradas === 1 ? $palabraEntrada : $palabraEntrada.'s',
                    $salidas,
                    $salidas === 1 ? 'salida' : 'salidas',
                ),
            'entradas' => $entradas,
            'salidas' => $salidas,
        ];
    }

    /** @return array{clave: string, titulo: string, texto: string, total: int} */
    private static function pernocta(int $total): array
    {
        return [
            'clave' => 'pernocta',
            'titulo' => 'Pernocta del día',
            'texto' => match (true) {
                $total === 0 => 'Sin pernoctas',
                $total === 1 => '1 aeronave',
                default => $total.' aeronaves',
            },
            'total' => $total,
        ];
    }
}
