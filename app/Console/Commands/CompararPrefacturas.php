<?php

namespace App\Console\Commands;

use App\Models\FactPrefactura;
use App\Support\ImporteServicio;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Verifica contra el histórico del sistema viejo que la aritmética del bloque 2
 * da los mismos números. SOLO LEE: no escribe en ninguna de las dos bases, y
 * por eso es seguro correrlo en producción antes de que nadie facture con el
 * sistema nuevo.
 *
 * Qué prueba: dados los mismos renglones, el mismo precio y la misma cantidad,
 * la fórmula da el mismo importe, el subtotal es la suma, el IVA es 16% y el
 * total es la suma.
 *
 * Qué NO prueba: el extremo a extremo. Las cantidades de estancia las teclea una
 * persona y no son reproducibles desde el dato, así que si alguien cobró dos
 * pernoctas donde correspondían tres, esto no lo detecta.
 *
 * Reporta CUATRO comparaciones distintas, que diagnostican cosas distintas y no se
 * mezclan (las dos primeras son las del subtotal y los renglones; las otras dos
 * cierran el resto de la aritmética que promete el comando):
 *   1. Subtotal guardado contra la suma RECALCULADA de sus renglones
 *      (`precio_u × cantidad`): si el encabezado cuadra con la aritmética.
 *   2. `importe` guardado de cada renglón contra su propio `precio_u × cantidad`:
 *      si el renglón cuadra consigo mismo.
 *   3. IVA guardado contra el 16% del subtotal GUARDADO (no del recalculado, para
 *      aislar el IVA de la diferencia del subtotal).
 *   4. Total guardado contra subtotal guardado + IVA guardado.
 * La 3 y la 4 no cuentan las prefacturas sin renglones ni las de subtotal en cero.
 *
 * `precio_u` e `iva` son FLOAT en el origen y se pueden leer de dos maneras: SQL
 * multiplica el float32 binario, y PDO entrega el texto corto que PHP vuelve double.
 * Son dos lecturas del mismo dato y ninguna es «la verdadera»; esta usa la de PDO,
 * y por eso difiere en unos centavos de una medición hecha dentro de SQL.
 *
 * Hay además un tercer mecanismo, latente: MySQL entrega un FLOAT por texto con
 * unos 6 dígitos significativos (el IVA 46316.8984375 llega como «46316.9»), así
 * que a partir de un IVA de 10,000 se pierde resolución de centavo, y a partir de
 * 100,000 la resolución es de un peso. El máximo de este volcado es 98,215.4, o
 * sea que todavía no cruza ese umbral; si lo cruza, la comparación del IVA dejará
 * de ser confiable al peso y habrá que leer el valor binario (`iva + 0e0`). Este
 * mecanismo NO explica los IVA de «redondeo» ni los totales de «redondeo» de la
 * corrida: salen idénticos con ambas lecturas.
 *
 * Lo que sí los explica: el encabezado guarda un subtotal redondeado mientras
 * que el total y el IVA salen de la suma exacta de los renglones (folio 5:
 * subtotal guardado 289,480.00, renglones 289,480.50, total = 1.16 × 289,480.50).
 * Por eso el IVA y el total se juzgan contra el subtotal GUARDADO y no contra el
 * recalculado. Las diferencias se inclinan algo hacia positivo (230 contra 187)
 * (un truncamiento iría a la baja, así que esto no lo esconde).
 *
 * Comparar el subtotal contra la suma de los importes GUARDADOS en lugar de la
 * recalculada da otra clasificación (muchos menos estructurales) porque esconde
 * la segunda inconsistencia dentro de la primera.
 *
 * Las tolerancias no se ajustan para que la corrida cuadre con un número
 * esperado: si el resultado cambia, es un hallazgo.
 */
class CompararPrefacturas extends Command
{
    protected $signature = 'facturacion:comparar-prefacturas {--detalle=20 : Cuántos casos enumerar en cada lista}';

    protected $description = 'Compara la aritmética de las prefacturas históricas contra la del bloque 2 (solo lectura)';

    /** Hasta aquí es redondeo del float del sistema viejo, no un defecto. */
    private const TOLERANCIA_IDENTICA = '0.02';

    private const TOLERANCIA_REDONDEO = '1.00';

    /**
     * Por qué una prefactura es estructural. Se separan porque no son el mismo
     * hallazgo: un encabezado con dinero y sin renglones, o con subtotal en cero
     * y renglones, es un registro incompleto; el que sí tiene ambos y no cuadra
     * es una discrepancia de aritmética.
     */
    private const SIN_RENGLONES = 'sin renglones';

    private const SUBTOTAL_EN_CERO = 'subtotal guardado en cero';

    private const NO_CUADRA = 'subtotal y renglones que no cuadran';

    /**
     * La tasa con la que se recalcula el IVA. Es la del sistema viejo
     * (`$caja * 0.16`), no la de `fact_configuracion`: aquí se mide si lo guardado
     * es el 16%. La fórmula NO se copia: se llama a `FactPrefactura::calcularIva()`, la
     * misma que usa el modelo (medio centavo antes de truncar, o sea redondeo, no
     * truncamiento), para que esta red no pueda desalinearse de lo que verifica.
     */
    private const IVA_TASA = '0.16';

    public function handle(): int
    {
        $origen = config('database.connections.remota.database');
        $this->info("Comparando contra '{$origen}'. Este comando no escribe nada.");

        $remota = DB::connection('remota');
        $detalle = max(0, (int) $this->option('detalle'));

        // `tb_venta` cuelga del folio, no del id del encabezado: con un folio
        // repetido, agrupar por folio suma los renglones de todos los
        // encabezados y contamina la comparación. Se excluyen.
        $repetidos = $remota->table('tb_hprefactura')
            ->select('fol_prefactura')
            ->selectRaw('COUNT(*) as filas')
            ->groupBy('fol_prefactura')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        $duplicados = $repetidos->pluck('fol_prefactura')->flip();
        $filasDuplicadas = (int) $repetidos->sum('filas');

        $renglones = $remota->table('tb_venta')
            ->select('id_venta', 'fol_prefactura', 'precio_u', 'cantidad', 'importe')
            ->get();

        $renglonesPorFolio = $renglones->groupBy('fol_prefactura');

        $comparadas = 0;
        $identicas = 0;
        $redondeo = 0;
        $estructurales = [];
        $iva = $this->acumulador();
        $total = $this->acumulador();
        $comparadasIvaTotal = 0;

        $encabezados = $remota->table('tb_hprefactura')
            ->select('fol_prefactura', 'subtotal', 'iva', 'Total')
            ->orderBy('fol_prefactura')
            ->get();

        foreach ($encabezados as $h) {
            if ($duplicados->has($h->fol_prefactura)) {
                continue;
            }

            $comparadas++;

            $suma = '0.00';
            foreach ($renglonesPorFolio[$h->fol_prefactura] ?? [] as $r) {
                $suma = bcadd($suma, $this->recalcular($r), 2);
            }

            $guardado = $this->centavos($h->subtotal);
            $diferencia = $this->absoluta(bcsub($guardado, $suma, 2));

            $clase = $this->clasificar($diferencia);
            if ($clase === 'identica') {
                $identicas++;
            } elseif ($clase === 'redondeo') {
                $redondeo++;
            } else {
                $estructurales[] = [
                    'folio' => $h->fol_prefactura,
                    'guardado' => $guardado,
                    'recalculado' => $suma,
                    'diferencia' => $diferencia,
                    'motivo' => match (true) {
                        ! isset($renglonesPorFolio[$h->fol_prefactura]) => self::SIN_RENGLONES,
                        bccomp($guardado, '0.00', 2) === 0 => self::SUBTOTAL_EN_CERO,
                        default => self::NO_CUADRA,
                    },
                ];
            }

            // IVA y total se juzgan solo en las prefacturas que tienen renglones y
            // subtotal: las demás ya están contadas arriba por motivo, y volver a
            // contarlas aquí las contaría dos veces.
            if (isset($renglonesPorFolio[$h->fol_prefactura]) && bccomp($guardado, '0.00', 2) > 0) {
                $comparadasIvaTotal++;
                $ivaGuardado = $this->centavos($h->iva);

                // El IVA se recalcula desde el subtotal GUARDADO, no desde el
                // recalculado: así aísla el IVA y no arrastra la diferencia del subtotal.
                $ivaRecalculado = FactPrefactura::calcularIva($guardado, self::IVA_TASA);
                $this->acumular($iva, $h->fol_prefactura, $ivaGuardado, $ivaRecalculado);

                // El total que el sistema viejo dice calcular: subtotal + IVA, ambos guardados.
                $this->acumular($total, $h->fol_prefactura, $this->centavos($h->Total), bcadd($guardado, $ivaGuardado, 2));
            }
        }

        // Segunda comparación: el renglón contra sí mismo. Es independiente de
        // los folios duplicados (no suma nada entre renglones), así que se
        // revisan todos los de `tb_venta`. Aquí cualquier diferencia de un
        // centavo cuenta, y el reporte separa las de centavos (ruido del float
        // del origen) de las que son dinero.
        $incongruentes = [];
        foreach ($renglones as $r) {
            $esperado = $this->recalcular($r);
            $guardado = $this->centavos($r->importe);
            $diferencia = $this->absoluta(bcsub($guardado, $esperado, 2));

            if (bccomp($diferencia, '0.00', 2) > 0) {
                $incongruentes[] = [
                    'folio' => $r->fol_prefactura,
                    'renglon' => $r->id_venta,
                    'guardado' => $guardado,
                    'recalculado' => $esperado,
                    'diferencia' => $diferencia,
                ];
            }
        }

        $this->newLine();
        $this->line('Prefacturas: subtotal guardado contra la suma recalculada de sus renglones');
        $this->line("Comparadas: {$comparadas}");
        $this->line("Idénticas: {$identicas}");
        $this->line("Redondeo: {$redondeo}");
        $this->line('Estructurales: '.count($estructurales));
        foreach ([self::NO_CUADRA, self::SUBTOTAL_EN_CERO, self::SIN_RENGLONES] as $motivo) {
            $n = count(array_filter($estructurales, fn ($e) => $e['motivo'] === $motivo));
            $this->line("  de ellas, {$motivo}: {$n}");
        }
        $this->line("Folios duplicados en el origen: {$repetidos->count()} ({$filasDuplicadas} filas, excluidas de lo anterior)");

        if ($estructurales !== []) {
            $this->newLine();
            $this->warn('Prefacturas cuyo subtotal guardado no corresponde a sus renglones (las peores primero):');
            $this->table(
                ['Folio', 'Subtotal guardado', 'Recalculado', 'Diferencia', 'Motivo'],
                $this->peores($estructurales, $detalle, ['folio', 'guardado', 'recalculado', 'diferencia', 'motivo']),
            );
            $this->restantes(count($estructurales), $detalle);
        }

        $this->newLine();
        $this->line('IVA y total: el IVA guardado contra el 16% del subtotal guardado, y el total');
        $this->line('guardado contra subtotal guardado + IVA guardado (sin las prefacturas ya contadas');
        $this->line('arriba como sin renglones o con subtotal en cero).');
        $this->line("IVA y total comparados: {$comparadasIvaTotal}");
        $this->reportar('IVA', $iva, $detalle, 'IVA guardado', 'IVA recalculado');
        $this->reportar('Total', $total, $detalle, 'Total guardado', 'Subtotal + IVA guardados');

        $this->newLine();
        $this->line('Renglones: importe guardado contra su propio precio_u × cantidad');
        $this->line("Renglones revisados: {$renglones->count()}");
        $this->line('Renglones cuyo importe guardado no cuadra: '.count($incongruentes));
        $mayores = count(array_filter($incongruentes, fn ($i) => bccomp($i['diferencia'], self::TOLERANCIA_IDENTICA, 2) > 0));
        $this->line("  por más de 2 centavos: {$mayores}");
        $this->line('  por 2 centavos o menos (redondeo del float del origen): '.(count($incongruentes) - $mayores));

        if ($incongruentes !== []) {
            $this->newLine();
            $this->warn('Los peores renglones:');
            $this->table(
                ['Folio', 'Renglón', 'Importe guardado', 'Recalculado', 'Diferencia'],
                $this->peores($incongruentes, $detalle, ['folio', 'renglon', 'guardado', 'recalculado', 'diferencia']),
            );
            $this->restantes(count($incongruentes), $detalle);
        }

        $this->newLine();
        $this->line('Qué prueba esto: la fidelidad de la aritmética. Dados los mismos renglones,');
        $this->line('el mismo precio y la misma cantidad, la fórmula da el mismo importe y el');
        $this->line('subtotal es la suma de los importes, el IVA es el 16% del subtotal guardado y el total es subtotal + IVA.');
        $this->line('Qué NO prueba el extremo a extremo: las cantidades de estancia las teclea una');
        $this->line('persona y no son reproducibles desde el dato. Si alguien cobró dos pernoctas');
        $this->line('donde correspondían tres, esto no lo detecta. "Todo cuadra" aquí no significa más que eso.');

        return self::SUCCESS;
    }

    /**
     * Sin margen ni ajuste: el histórico ya guarda el precio final de cada
     * renglón, así que esto comprueba la multiplicación y el redondeo, que es
     * lo que la fórmula hace con esos datos.
     */
    private function recalcular(object $renglon): string
    {
        return ImporteServicio::calcular(
            (float) $renglon->precio_u,
            (int) $renglon->cantidad,
            0.0,
            ImporteServicio::AJUSTE_NINGUNO,
        );
    }

    /**
     * Lleva un valor del origen a una cadena de dos decimales para compararlo
     * con `bc`. Los DECIMAL(18,2) de MySQL ya llegan así; lo demás (sqlite en
     * pruebas) pasa por un formato, nunca por restas de float.
     */
    private function centavos(mixed $valor): string
    {
        if (is_string($valor) && preg_match('/^-?\d+\.\d{2}$/', $valor) === 1) {
            return $valor;
        }

        return number_format((float) $valor, 2, '.', '');
    }

    /** @return 'identica'|'redondeo'|'estructural' */
    private function clasificar(string $diferencia): string
    {
        if (bccomp($diferencia, self::TOLERANCIA_IDENTICA, 2) <= 0) {
            return 'identica';
        }

        return bccomp($diferencia, self::TOLERANCIA_REDONDEO, 2) <= 0 ? 'redondeo' : 'estructural';
    }

    private function acumulador(): array
    {
        return ['identicas' => 0, 'exactas' => 0, 'redondeo' => 0, 'estructurales' => []];
    }

    private function acumular(array &$acumulador, mixed $folio, string $guardado, string $esperado): void
    {
        $diferencia = $this->absoluta(bcsub($guardado, $esperado, 2));

        switch ($this->clasificar($diferencia)) {
            case 'identica':
                $acumulador['identicas']++;
                if (bccomp($diferencia, '0.00', 2) === 0) {
                    $acumulador['exactas']++;
                }
                break;
            case 'redondeo':
                $acumulador['redondeo']++;
                break;
            default:
                $acumulador['estructurales'][] = [
                    'folio' => $folio,
                    'guardado' => $guardado,
                    'recalculado' => $esperado,
                    'diferencia' => $diferencia,
                ];
        }
    }

    /**
     * Las «idénticas» admiten hasta 2 centavos, que es el ruido del float del
     * origen; un truncamiento de un centavo caería ahí. Por eso se informa aparte
     * cuántas son exactas al centavo, para que una desviación sistemática de un
     * centavo no quede escondida dentro de «idénticas».
     */
    private function reportar(string $nombre, array $a, int $detalle, string $colGuardado, string $colEsperado): void
    {
        $this->line("{$nombre} idénticas: {$a['identicas']}");
        $this->line("{$nombre}, exactas al centavo: {$a['exactas']}");
        $this->line("{$nombre} redondeo: {$a['redondeo']}");
        $this->line("{$nombre} estructurales: ".count($a['estructurales']));

        if ($a['estructurales'] !== []) {
            $this->warn("{$nombre}: las peores diferencias:");
            $this->table(
                ['Folio', $colGuardado, $colEsperado, 'Diferencia'],
                $this->peores($a['estructurales'], $detalle, ['folio', 'guardado', 'recalculado', 'diferencia']),
            );
            $this->restantes(count($a['estructurales']), $detalle);
        }
    }

    private function absoluta(string $valor): string
    {
        return ltrim($valor, '-');
    }

    /** @return list<list<string>> */
    private function peores(array $casos, int $cuantos, array $columnas): array
    {
        usort($casos, fn ($a, $b) => bccomp($b['diferencia'], $a['diferencia'], 2));

        return array_map(
            fn ($caso) => array_map(fn ($c) => (string) $caso[$c], $columnas),
            array_slice($casos, 0, $cuantos),
        );
    }

    private function restantes(int $total, int $mostrados): void
    {
        if ($total > $mostrados) {
            $this->line('... y '.($total - $mostrados).' más. Usa --detalle=N para ver más.');
        }
    }
}
