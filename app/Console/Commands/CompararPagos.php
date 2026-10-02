<?php

namespace App\Console\Commands;

use App\Services\PagosPrefactura;
use App\Support\ComisionAmex;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Verifica contra el histórico del sistema viejo que los pagos, la comisión Amex, el
 * sobrepago y las cortesías del bloque 3 dan los mismos números. SOLO LEE: no escribe en
 * ninguna de las dos bases, y por eso es seguro correrlo en producción antes de que nadie
 * cobre con el sistema nuevo. Lo fijan tres pruebas (cero filas nuevas, mismos conteos en
 * el origen antes y después, y una captura de toda sentencia en cualquier conexión que
 * exige que todas sean `select` y todas vayan por `remota`).
 *
 * Qué prueba: que lo que el bloque 3 va a guardar (`decimal(12,2)`) reproduce lo que el
 * sistema viejo tiene, y que las reglas nuevas —la comisión Amex con su ajuste, el sobrepago
 * derivado, la cortesía por importe en cero— dicen sobre el histórico lo que el diseño afirma.
 *
 * Qué NO prueba: que se cobre lo correcto. Los montos los teclea una persona; este comando
 * mide si la aritmética del sistema nuevo habría llegado a la misma cifra, no si la cifra
 * era la que correspondía.
 *
 * Reporta CINCO comparaciones, cada una con etiquetas propias que no se mezclan con las de
 * otra. El bloque 2 aprendió por qué: una desviación de un centavo en el IVA pasó 19 pruebas
 * porque el IVA y el total compartían etiqueta en la salida.
 *   1. PAGOS. Que cada `monto` del origen (un DOUBLE) quepa en `decimal(12,2)` sin perder
 *      centavos, cuántos se REDONDEAN al importar (y cuánto suma esa diferencia), y que la
 *      suma por folio coincida.
 *   2. COMISIÓN AMEX. La comisión guardada (renglón `id_servicio = 100`) contra
 *      `ComisionAmex::calcular()` con el monto del pago Amex del folio, al centavo, en tres
 *      grupos: la fórmula, la segunda rama del viejo (`monto × 0.06`) y las que no siguen
 *      ninguna. Los folios de los dos últimos grupos se listan uno por uno: el bloque 6 tiene
 *      que decidir qué hace con ellos al importar.
 *   3. EL AJUSTE. Las comisiones que `PagosPrefactura::comisionQueCuadra()` ajusta, con su
 *      desvío máximo, y los folios para los que no hay candidato en la ventana. La cuenta de
 *      los ajustes existe para DEMOSTRAR que la comisión ajustada coincide al centavo con la
 *      que guardó el sistema viejo; no para excusar una diferencia. Si alguna no coincidiera,
 *      sale en su propia línea y en su propia lista.
 *   4. EL SOBREPAGO derivado (`pagado − Total`) contra el `Cambio` guardado, que está mal en
 *      las dos direcciones y por eso son dos listas: sobrepagados con `Cambio` en cero, y con
 *      `Cambio` distinto de cero sin estar sobrepagados.
 *   5. LAS CORTESÍAS. Que `remision = 'cortesia'` coincida con las filas de `importe` 0 y
 *      `precio_u > 0`, que es la condición con la que el bloque 6 las traducirá a
 *      `es_cortesia`.
 *
 * LAS DOS TRAMPAS DEL DATO (hay que conocerlas antes de leer la salida):
 *
 * 1. `tb_formas_pago.monto` es DOUBLE. Hay montos con tres y cuatro decimales (105.2816,
 *    647.9992): NO son errores, son el bruto que Amex cargó. Al importarlos a `decimal(12,2)`
 *    se redondean, y el comando dice cuántos y cuánto suma la diferencia en lugar de
 *    esconderlo. Para no mezclar el ruido binario del DOUBLE con los decimales reales, el
 *    valor se lee como texto a seis decimales y de ahí en adelante todo es `bc` sobre
 *    cadenas: ningún float en el camino del dinero. Un monto cuenta como redondeado cuando
 *    sus decimales más allá del segundo no son cero.
 *
 * 2. `tb_hprefactura` tiene 207 folios duplicados, y la causa es mecánica: `invoice.php`
 *    inserta el encabezado histórico ANTES de validar cliente y fecha de salida, y solo borra
 *    de `tb_prefcatura` cuando la validación pasa, así que cada intento fallido de imprimir
 *    deja un encabezado. Por eso este comando toma LA ÚLTIMA FILA DE CADA FOLIO (la del
 *    intento que sí imprimió) para el `Total` y el `Cambio`, y lo dice en la salida. Sin
 *    esto, un folio repetido contaría sus pagos tantas veces como encabezados tenga.
 *
 * COSAS QUE LA MEDICIÓN DEL DISEÑO NO DECÍA Y ESTE COMANDO SÍ DICE:
 *
 * - Los conteos de las poblaciones Amex del diseño (771 y 765) eran FILAS, no folios: venían de
 *   un join contra `tb_hprefactura`, que multiplica cada pago por cada encabezado repetido
 *   (los 781 «comparables» son exactamente las filas de ese join, sobre 729 pagos distintos).
 *   Contados por folio, con el último encabezado, los folios cuyo único pago es un Amex son
 *   729, y 719 de ellos tienen encabezado con subtotal mayor que cero. Para la comparación de
 *   la fórmula la población es de 718: el único pago del folio es un Amex, con una sola línea
 *   de comisión y partida mayor que cero, SIN exigir encabezado (los folios 2061 y 2062 no lo
 *   tienen y están entre los 718). Las comisiones son 733, una por folio.
 * - El monto con el que se calcula la comisión es el IMPORTABLE (el del pago redondeado a
 *   centavos), porque es el que el sistema nuevo tendrá en `fact_prefactura_pagos.monto`.
 * - `remision = 'cortesia'` se evalúa EN SQL, con la collation del origen, que no distingue
 *   mayúsculas ni acentos: así salen las 130 del diseño. Seis de ellas están escritas
 *   «Cortesía» y NO son cortesías sino renglones de precio e importe negativos (descuentos,
 *   del bloque 5). La condición del bloque 6, «importe 0 con precio_u > 0», no captura las 130:
 *   deja fuera esos seis y un renglón marcado con importe, y captura 19 que no llevan marca,
 *   una de ellas con una errata en el origen («cortecia»). El comando separa las tres cosas.
 *
 * El sobrepago NO tiene tolerancia: `pagado − Total` mayor que cero es sobrepago, como lo
 * calcula el sistema nuevo, y el comando no debe ser más laxo que el sistema que verifica. Los
 * que lo son por un solo centavo salen aparte, nombrados, con su causa: si el centavo ya está en
 * el origen o lo crea el redondeo de cada pago al importarlo (dos pagos Amex de cuatro decimales
 * que se redondean hacia arriba suman un centavo más que su Total). El diseño midió con un centavo
 * de tolerancia que no declaró; por eso sus cifras son tres menos que las de este comando.
 *
 * Las tolerancias no se ajustan para que la corrida cuadre con un número esperado: si el
 * resultado cambia, es un hallazgo.
 *
 * `--detalle` acota solo las listas LARGAS (pagos redondeados, en cero, sumas distintas).
 * Las listas que nombran folios para que alguien decida (comisiones, ajustes, sobrepago,
 * cortesías) salen completas.
 */
class CompararPagos extends Command
{
    protected $signature = 'facturacion:comparar-pagos
        {--folio= : Acota la comparación a un solo folio}
        {--limite= : Acota la comparación a los primeros N folios, por número (una corrida corta)}
        {--detalle=20 : Cuántos casos enumerar en las listas largas}';

    protected $description = 'Compara los pagos, la comisión Amex, el sobrepago y las cortesías históricos contra las reglas del bloque 3 (solo lectura)';

    /**
     * La tasa del sistema viejo (`$ivaRate = 0.16`), no la de `fact_configuracion`: aquí se mide
     * lo que el viejo hizo. Además, leer la configuración abriría una consulta a la conexión
     * por omisión y la prueba de «solo lectura sobre `remota`» la rechazaría.
     */
    private const IVA_TASA = '0.1600';

    /** `tb_venta.id_servicio` de la comisión Amex en el sistema viejo. */
    private const SERVICIO_COMISION = 100;

    /** El nombre con el que el catálogo viejo (`tb_tip_fpago`) llama a la forma Amex. */
    private const FORMA_AMEX = 'amex';

    public function handle(): int
    {
        $folioOpcion = $this->option('folio');
        $limiteOpcion = $this->option('limite');

        if ($folioOpcion !== null && ! ctype_digit((string) $folioOpcion)) {
            $this->error("--folio debe ser un número entero, y recibió: '{$folioOpcion}'.");

            return self::FAILURE;
        }

        if ($limiteOpcion !== null && (! ctype_digit((string) $limiteOpcion) || (int) $limiteOpcion < 1)) {
            $this->error("--limite debe ser un entero mayor que cero, y recibió: '{$limiteOpcion}'.");

            return self::FAILURE;
        }

        $origen = config('database.connections.remota.database');
        $this->info("Comparando contra '{$origen}'. Este comando no escribe nada.");

        $remota = DB::connection('remota');
        $detalle = max(0, (int) $this->option('detalle'));

        $formas = $remota->table('tb_tip_fpago')->select('id_tipo_formas', 'tipo_forma')->orderBy('id_tipo_formas')->get();
        $encabezados = $remota->table('tb_hprefactura')
            ->select('id_prefactura', 'fol_prefactura', 'subtotal', 'Total', 'Cambio')
            ->orderBy('id_prefactura')
            ->get();
        $pagos = $remota->table('tb_formas_pago')
            ->select('id_forma_pago', 'id_tipo_formas', 'fol_prefactura', 'monto')
            ->orderBy('id_forma_pago')
            ->get();
        // La igualdad con 'cortesia' se evalúa en SQL: con la collation del origen no distingue
        // mayúsculas ni acentos, y es exactamente la que usará el bloque 6.
        $renglones = $remota->table('tb_venta')
            ->select('id_venta', 'fol_prefactura', 'id_servicio', 'precio_u', 'importe', 'cantidad', 'remision')
            ->selectRaw("(remision = 'cortesia') as marcada_cortesia")
            ->orderBy('id_venta')
            ->get();

        // El alcance: todo, un folio, o los primeros N. Sale de la unión de los tres orígenes,
        // porque hay pagos y renglones de folios sin encabezado.
        $alcance = $this->alcance($encabezados, $pagos, $renglones, $folioOpcion, $limiteOpcion);

        if ($alcance !== null) {
            $encabezados = $encabezados->filter(fn ($h) => isset($alcance[$h->fol_prefactura]))->values();
            $pagos = $pagos->filter(fn ($p) => isset($alcance[$p->fol_prefactura]))->values();
            $renglones = $renglones->filter(fn ($r) => isset($alcance[$r->fol_prefactura]))->values();
        }

        $this->line(match (true) {
            $folioOpcion !== null => "Alcance: solo el folio {$folioOpcion}.",
            $limiteOpcion !== null => "Alcance: los primeros {$limiteOpcion} folios, por número (".count($alcance).' con datos).',
            default => 'Alcance: todo el origen.',
        });

        // ---- Lo que se prepara una sola vez ---------------------------------------------

        $nombres = $formas->pluck('tipo_forma', 'id_tipo_formas')->all();
        $amexId = $formas->first(fn ($f) => strtolower(trim((string) $f->tipo_forma)) === self::FORMA_AMEX)?->id_tipo_formas;

        // Cada pago con su monto del origen leído como texto a seis decimales y con el que
        // tendrá al importarse. Agrupados por folio.
        $pagosPorFolio = [];
        $pagosLeidos = [];
        foreach ($pagos as $p) {
            $origenMonto = $this->seisDecimales($p->monto);
            $leido = (object) [
                'folio' => $p->fol_prefactura,
                'tipo' => $p->id_tipo_formas,
                'origen' => $origenMonto,
                'importado' => $this->redondear($origenMonto),
            ];
            $pagosLeidos[] = $leido;
            $pagosPorFolio[$p->fol_prefactura][] = $leido;
        }

        $renglonesPorFolio = [];
        foreach ($renglones as $r) {
            $renglonesPorFolio[$r->fol_prefactura][] = $r;
        }

        // El encabezado de cada folio es su ÚLTIMA fila (orden por id): la del intento que sí
        // imprimió. Ver la segunda trampa en la cabecera.
        $ultimo = [];
        $filasPorFolio = [];
        foreach ($encabezados as $h) {
            $ultimo[$h->fol_prefactura] = $h;
            $filasPorFolio[$h->fol_prefactura] = ($filasPorFolio[$h->fol_prefactura] ?? 0) + 1;
        }
        $repetidos = array_filter($filasPorFolio, fn ($n) => $n > 1);

        $this->newLine();
        $this->line("Encabezados históricos: {$encabezados->count()} filas en ".count($ultimo).' folios');
        $this->line('Folios con encabezado repetido: '.count($repetidos).' ('.array_sum($repetidos).' filas). De cada folio se toma la última fila, la del intento que sí imprimió.');

        if ($amexId === null) {
            $this->warn("tb_tip_fpago no tiene una forma llamada 'Amex': las comparaciones de la comisión no encuentran ningún pago Amex.");
        }

        // El ajuste se analiza antes de reportar las comisiones: la lista de las que no siguen
        // ninguna fórmula dice cuáles de ellas reproduce `comisionQueCuadra()`.
        $ajuste = $this->analizarAjustes($renglonesPorFolio, $pagosPorFolio, $ultimo, $amexId);

        $this->compararPagos($pagosLeidos, $pagosPorFolio, $ultimo, $nombres, $amexId, $detalle);
        $this->compararComisiones($renglonesPorFolio, $pagosPorFolio, $amexId, $ajuste);
        $this->reportarAjustes($ajuste);
        $this->compararSobrepago($ultimo, $pagosPorFolio);
        $this->compararCortesias($renglones);

        $this->newLine();
        $this->line('Qué prueba esto: que lo que el bloque 3 va a guardar reproduce el histórico, y que la comisión');
        $this->line('Amex, el sobrepago derivado y la cortesía dicen sobre él lo que el diseño afirma.');
        $this->line('Qué NO prueba: que se cobre lo correcto. Los montos los teclea una persona y no son reproducibles');
        $this->line('desde el dato. "Todo cuadra" aquí no significa más que eso.');

        return self::SUCCESS;
    }

    // ---- 1. Pagos ----------------------------------------------------------------------

    private function compararPagos(array $pagos, array $pagosPorFolio, array $ultimo, array $nombres, mixed $amexId, int $detalle): void
    {
        $maximo = PagosPrefactura::MONTO_MAXIMO;

        $caben = 0;
        $redondeados = [];
        $fuera = 0;
        $enCero = [];
        $porDecimales = ['tres' => 0, 'cuatro' => 0, 'mas' => 0];
        $diferencia = '0.000000';
        $diferenciaAbsoluta = '0.000000';
        $redondeadosAmex = 0;
        $porForma = [];

        foreach ($pagos as $p) {
            $porForma[$p->tipo]['n'] = ($porForma[$p->tipo]['n'] ?? 0) + 1;
            $porForma[$p->tipo]['origen'] = bcadd($porForma[$p->tipo]['origen'] ?? '0.000000', $p->origen, 6);
            $porForma[$p->tipo]['importado'] = bcadd($porForma[$p->tipo]['importado'] ?? '0.00', $p->importado, 2);

            if (bccomp($this->absoluta($p->origen), $maximo, 6) > 0) {
                $fuera++;

                continue;
            }

            if (bccomp($p->origen, '0', 6) <= 0) {
                $enCero[] = $p;
            }

            if (bccomp($p->origen, $p->importado, 6) === 0) {
                $caben++;

                continue;
            }

            $dif = bcsub($p->importado, $p->origen, 6);
            $diferencia = bcadd($diferencia, $dif, 6);
            $diferenciaAbsoluta = bcadd($diferenciaAbsoluta, $this->absoluta($dif), 6);
            $redondeados[] = ['folio' => $p->folio, 'tipo' => $p->tipo, 'origen' => $this->recortar($p->origen), 'importado' => $p->importado, 'diferencia' => $this->recortar($this->absoluta($dif), 4)];

            $decimales = strlen(rtrim(substr($p->origen, strpos($p->origen, '.') + 1), '0'));
            $grupo = match (true) {
                $decimales <= 3 => 'tres',
                $decimales === 4 => 'cuatro',
                default => 'mas',
            };
            $porDecimales[$grupo]++;

            if ($amexId !== null && $p->tipo === $amexId) {
                $redondeadosAmex++;
            }
        }

        // La suma por folio: lo que el origen suma (redondeado a centavos) contra lo que sumarán
        // los pagos ya redondeados uno a uno.
        $sumasDistintas = [];
        foreach ($pagosPorFolio as $folio => $delFolio) {
            $exacta = '0.000000';
            $importada = '0.00';
            foreach ($delFolio as $p) {
                $exacta = bcadd($exacta, $p->origen, 6);
                $importada = bcadd($importada, $p->importado, 2);
            }

            $delOrigen = $this->redondear($exacta);
            if (bccomp($delOrigen, $importada, 2) !== 0) {
                $sumasDistintas[] = ['folio' => $folio, 'origen' => $delOrigen, 'importado' => $importada, 'diferencia' => $this->absoluta(bcsub($importada, $delOrigen, 2))];
            }
        }

        $sinEncabezado = array_filter($pagosPorFolio, fn ($ps, $folio) => ! isset($ultimo[$folio]), ARRAY_FILTER_USE_BOTH);

        $this->newLine();
        $this->line('Pagos: el monto del origen (un DOUBLE) contra lo que cabe en decimal(12,2)');
        $this->line('Pagos comparados: '.count($pagos));
        $this->line('Folios con pagos: '.count($pagosPorFolio));
        $this->line("Pagos que caben en decimal(12,2) sin perder centavos: {$caben}");
        $this->line('Pagos que se redondean al importar: '.count($redondeados));
        $this->line("  con tres decimales: {$porDecimales['tres']}");
        $this->line("  con cuatro decimales: {$porDecimales['cuatro']}");
        $this->line("  con más de cuatro decimales: {$porDecimales['mas']}");
        $this->line("  de ellos, pagos Amex: {$redondeadosAmex}");
        $this->line('  diferencia que suma el redondeo, importado menos origen: '.$this->recortar($diferencia, 4).' (en valor absoluto: '.$this->recortar($diferenciaAbsoluta, 4).')');
        $this->line("Pagos fuera del rango de decimal(12,2): {$fuera}");
        $this->line('Pagos con monto en cero o negativo: '.count($enCero).' (caben, pero un pago válido exige un monto mayor que cero)');
        $this->line('Folios cuya suma de pagos importados no coincide con la del origen, al centavo: '.count($sumasDistintas));
        $this->line('Pagos de folios sin encabezado en tb_hprefactura: '.array_sum(array_map('count', $sinEncabezado)).' (en '.count($sinEncabezado).' folios)');

        foreach ($porForma as $tipo => $f) {
            $nombre = $nombres[$tipo] ?? "forma {$tipo}";
            $this->line("  {$nombre}: {$f['n']} pagos, {$this->redondear($f['origen'])} en el origen, {$f['importado']} importados");
        }

        if ($redondeados !== []) {
            $this->newLine();
            $this->warn('Los pagos que se redondean al importar (los de mayor diferencia primero):');
            $this->table(
                ['Folio', 'Forma', 'Monto del origen', 'Monto importado', 'Diferencia'],
                $this->peores(array_map(fn ($r) => $r + ['forma' => $nombres[$r['tipo']] ?? "forma {$r['tipo']}"], $redondeados), $detalle, ['folio', 'forma', 'origen', 'importado', 'diferencia']),
            );
            $this->restantes(count($redondeados), $detalle);
        }

        if ($enCero !== []) {
            $this->newLine();
            $this->warn('Los pagos con monto en cero o negativo:');
            $this->table(
                ['Folio', 'Forma', 'Monto del origen'],
                array_map(fn ($p) => [(string) $p->folio, $nombres[$p->tipo] ?? "forma {$p->tipo}", $this->recortar($p->origen)], array_slice($enCero, 0, $detalle)),
            );
            $this->restantes(count($enCero), $detalle);
        }

        if ($sumasDistintas !== []) {
            $this->newLine();
            $this->warn('Los folios cuya suma importada no coincide con la del origen:');
            $this->table(
                ['Folio', 'Suma del origen', 'Suma importada', 'Diferencia'],
                $this->peores($sumasDistintas, $detalle, ['folio', 'origen', 'importado', 'diferencia']),
            );
            $this->restantes(count($sumasDistintas), $detalle);
        }
    }

    // ---- 2. La comisión Amex, en tres grupos -------------------------------------------

    private function compararComisiones(array $renglonesPorFolio, array $pagosPorFolio, mixed $amexId, array $ajuste): void
    {
        $revisadas = 0;
        $exactas = 0;
        $segundaRama = [];
        $ningunaFormula = [];
        $noComparables = [];

        foreach ($renglonesPorFolio as $folio => $renglones) {
            $comisiones = array_values(array_filter($renglones, fn ($r) => (int) $r->id_servicio === self::SERVICIO_COMISION));
            if ($comisiones === []) {
                continue;
            }

            $amex = array_values(array_filter($pagosPorFolio[$folio] ?? [], fn ($p) => $amexId !== null && $p->tipo === $amexId));

            foreach ($comisiones as $comision) {
                $revisadas++;
                $guardada = $this->centavos($comision->importe);

                $motivo = match (true) {
                    count($amex) === 0 => 'el folio no tiene pago Amex',
                    count($amex) > 1 => 'el folio tiene más de un pago Amex',
                    count($comisiones) > 1 => 'el folio tiene más de una línea de comisión',
                    default => null,
                };

                if ($motivo !== null) {
                    $noComparables[] = ['folio' => $folio, 'guardada' => $guardada, 'motivo' => $motivo];

                    continue;
                }

                $monto = $amex[0]->importado;
                $formula = ComisionAmex::calcular($monto, self::IVA_TASA);
                $diferencia = $this->absoluta(bcsub($guardada, $formula, 2));

                if ($diferencia === '0.00') {
                    $exactas++;

                    continue;
                }

                // La segunda rama de mpamex.php: el 6% del monto como si fuera neto.
                $rama2 = bcadd(bcmul($monto, ComisionAmex::TASA, 6), '0.005', 2);

                if ($guardada === $rama2) {
                    $segundaRama[] = ['folio' => $folio, 'monto' => $monto, 'guardada' => $guardada, 'formula' => $formula, 'diferencia' => $diferencia, 'rama2' => $rama2];

                    continue;
                }

                $ningunaFormula[] = [
                    'folio' => $folio, 'monto' => $monto, 'guardada' => $guardada, 'formula' => $formula, 'diferencia' => $diferencia,
                    'ajuste' => isset($ajuste['reproducidas'][$folio]) ? 'la reproduce' : 'no',
                ];
            }
        }

        $explicadas = count(array_filter($ningunaFormula, fn ($c) => $c['ajuste'] === 'la reproduce'));

        $this->newLine();
        $this->line('Comisión Amex: la guardada (servicio 100) contra ComisionAmex::calcular() con el monto del pago Amex del folio');
        $this->line("Comisiones revisadas: {$revisadas}");
        $this->line('Comisión Amex, no comparables: '.count($noComparables));
        $this->line('Comisión Amex, comparables: '.($revisadas - count($noComparables)));
        $this->line("Comisión Amex, exactas al centavo: {$exactas}");
        $this->line('Comisión Amex, segunda rama del sistema viejo (monto × 0.06): '.count($segundaRama));
        $this->line('Comisión Amex, no siguen ninguna fórmula: '.count($ningunaFormula));
        $this->line("  de ellas, las que comisionQueCuadra() reproduce al centavo: {$explicadas} (se cuentan en la sección del ajuste)");
        $this->line('  de ellas, las que ningún ajuste reproduce: '.(count($ningunaFormula) - $explicadas));

        if ($noComparables !== []) {
            $this->newLine();
            $this->warn('Comisiones que no se pueden comparar con un pago Amex:');
            $this->table(
                ['Folio', 'Comisión guardada', 'Por qué'],
                array_map(fn ($c) => [(string) $c['folio'], $c['guardada'], $c['motivo']], $noComparables),
            );
        }

        if ($segundaRama !== []) {
            $this->newLine();
            $this->warn('Folios de la segunda rama del sistema viejo (la comisión es el 6% del monto):');
            $this->table(
                ['Folio', 'Monto del pago', 'Comisión guardada', 'ComisionAmex::calcular()', 'Diferencia'],
                array_map(fn ($c) => [(string) $c['folio'], $c['monto'], $c['guardada'], $c['formula'], $c['diferencia']], $segundaRama),
            );
        }

        if ($ningunaFormula !== []) {
            usort($ningunaFormula, fn ($a, $b) => bccomp($b['diferencia'], $a['diferencia'], 2));
            $this->newLine();
            $this->warn('Folios cuya comisión no sigue ninguna fórmula (las mayores diferencias primero):');
            $this->table(
                ['Folio', 'Monto del pago', 'Comisión guardada', 'ComisionAmex::calcular()', 'Diferencia', 'comisionQueCuadra()'],
                array_map(fn ($c) => [(string) $c['folio'], $c['monto'], $c['guardada'], $c['formula'], $c['diferencia'], $c['ajuste']], $ningunaFormula),
            );
        }
    }

    // ---- 3. El ajuste de comisionQueCuadra() -------------------------------------------

    /**
     * La población del ajuste: folios cuyo ÚNICO pago es un Amex (así `pagado` antes del pago
     * es cero y el total buscado es el monto), con una sola línea de comisión y partida mayor
     * que cero. La partida es `SUM(importe)` SIN el servicio 100, exacta: derivarla restando
     * la comisión al subtotal guardado, que es FLOAT, mete de 2 a 4 centavos de ruido que no
     * existen.
     */
    private function analizarAjustes(array $renglonesPorFolio, array $pagosPorFolio, array $ultimo, mixed $amexId): array
    {
        $resultado = [
            'solo_amex' => 0, 'con_encabezado' => 0, 'una_comision' => 0, 'comparadas' => 0,
            'formula_sola' => 0, 'formula_sola_distinta' => [],
            'ajustadas' => [], 'ajustadas_distintas' => [], 'reproducidas' => [],
            'sin_candidato' => [], 'desvio_maximo' => '0.00', 'desvio_minimo' => null,
        ];

        if ($amexId === null) {
            return $resultado;
        }

        foreach ($pagosPorFolio as $folio => $pagos) {
            if (count($pagos) !== 1 || $pagos[0]->tipo !== $amexId) {
                continue;
            }
            $resultado['solo_amex']++;

            if (isset($ultimo[$folio]) && bccomp($this->centavos($ultimo[$folio]->subtotal), '0.00', 2) > 0) {
                $resultado['con_encabezado']++;
            }

            $renglones = $renglonesPorFolio[$folio] ?? [];
            $comisiones = array_values(array_filter($renglones, fn ($r) => (int) $r->id_servicio === self::SERVICIO_COMISION));
            if (count($comisiones) !== 1) {
                continue;
            }
            $resultado['una_comision']++;

            $partida = '0.00';
            foreach ($renglones as $r) {
                if ((int) $r->id_servicio !== self::SERVICIO_COMISION) {
                    $partida = bcadd($partida, $this->centavos($r->importe), 2);
                }
            }
            if (bccomp($partida, '0.00', 2) <= 0) {
                continue;
            }
            $resultado['comparadas']++;

            $monto = $pagos[0]->importado;
            $guardada = $this->centavos($comisiones[0]->importe);
            $formula = ComisionAmex::calcular($monto, self::IVA_TASA);
            $candidata = PagosPrefactura::comisionQueCuadra($formula, $partida, self::IVA_TASA, $monto);

            if ($candidata === null) {
                $totalFormula = PagosPrefactura::totalConComision($partida, $formula, self::IVA_TASA);
                $viejo = isset($ultimo[$folio]) ? $this->centavos($ultimo[$folio]->Total) : null;

                $resultado['sin_candidato'][] = [
                    'folio' => $folio,
                    'monto' => $monto,
                    'guardada' => $guardada,
                    'formula' => $formula,
                    'diferencia' => $this->absoluta(bcsub($guardada, $formula, 2)),
                    'por_cobrar' => bcsub($totalFormula, $monto, 2),
                    'total_viejo' => $viejo ?? 'sin encabezado',
                    'caso' => match (true) {
                        $viejo === null => 'sin encabezado',
                        bccomp($viejo, $monto, 2) === 0 => 'pago completo',
                        default => 'monto distinto del total viejo',
                    },
                ];

                continue;
            }

            if ($candidata === $formula) {
                $resultado['formula_sola']++;
                if ($guardada !== $formula) {
                    $resultado['formula_sola_distinta'][] = ['folio' => $folio, 'guardada' => $guardada, 'formula' => $formula, 'diferencia' => $this->absoluta(bcsub($guardada, $formula, 2))];
                }

                continue;
            }

            $desvio = $this->absoluta(bcsub($candidata, $formula, 2));
            $resultado['ajustadas'][] = ['folio' => $folio, 'formula' => $formula, 'ajustada' => $candidata, 'guardada' => $guardada, 'desvio' => $desvio];
            if (bccomp($desvio, $resultado['desvio_maximo'], 2) > 0) {
                $resultado['desvio_maximo'] = $desvio;
            }
            if ($resultado['desvio_minimo'] === null || bccomp($desvio, $resultado['desvio_minimo'], 2) < 0) {
                $resultado['desvio_minimo'] = $desvio;
            }

            if ($guardada === $candidata) {
                $resultado['reproducidas'][$folio] = true;
            } else {
                $resultado['ajustadas_distintas'][] = ['folio' => $folio, 'formula' => $formula, 'ajustada' => $candidata, 'guardada' => $guardada, 'diferencia' => $this->absoluta(bcsub($guardada, $candidata, 2))];
            }
        }

        return $resultado;
    }

    private function reportarAjustes(array $a): void
    {
        $ajustes = count($a['ajustadas']);
        $sin = $a['sin_candidato'];
        $porCaso = fn (string $caso) => count(array_filter($sin, fn ($s) => $s['caso'] === $caso));
        $conDiferencia = count(array_filter($sin, fn ($s) => $s['diferencia'] !== '0.00'));

        $this->newLine();
        $this->line('Ajuste de la comisión: PagosPrefactura::comisionQueCuadra() sobre los folios de un solo pago Amex');
        $this->line("Folios cuyo único pago es un Amex: {$a['solo_amex']}");
        $this->line("  de ellos, con encabezado de subtotal mayor que cero (el último de cada folio): {$a['con_encabezado']}");
        $this->line("  con exactamente una línea de comisión: {$a['una_comision']}");
        $this->line("  y partida mayor que cero (los que se comparan): {$a['comparadas']}");
        $this->line("La fórmula sola cuadra el total, sin ajuste: {$a['formula_sola']}");
        $this->line('  de ellas, con la comisión guardada distinta de la fórmula: '.count($a['formula_sola_distinta']));
        $this->line("Comisiones que comisionQueCuadra() ajusta: {$ajustes}");
        $this->line('  desvío máximo del ajuste respecto a la fórmula: '.$a['desvio_maximo'].($ajustes > 0 ? " (el mínimo, {$a['desvio_minimo']})" : ''));
        $this->line('  ajustadas que coinciden al centavo con la comisión guardada por el sistema viejo: '.count($a['reproducidas']));
        $this->line('  ajustadas que NO coinciden con la comisión guardada: '.count($a['ajustadas_distintas']));
        $this->line('  (Esta cuenta existe para demostrar que el ajuste reproduce lo que cobró el sistema viejo, no para excusar una diferencia.)');
        $this->line('Folios sin candidato en la ventana de ±'.(PagosPrefactura::VENTANA_AJUSTE_COMISION).' centavos: '.count($sin));
        $this->line('  sin candidato, pago completo (el total viejo cuadra con el monto): '.$porCaso('pago completo'));
        $this->line('  sin candidato, monto distinto del total viejo: '.$porCaso('monto distinto del total viejo'));
        $this->line('  sin candidato, folio sin encabezado en tb_hprefactura: '.$porCaso('sin encabezado'));
        $this->line("  sin candidato, con la comisión guardada distinta de la fórmula: {$conDiferencia}");

        if ($a['formula_sola_distinta'] !== []) {
            $this->newLine();
            $this->warn('Folios donde la fórmula sola cuadra el total pero el sistema viejo guardó otra comisión:');
            $this->table(
                ['Folio', 'Comisión guardada', 'ComisionAmex::calcular()', 'Diferencia'],
                array_map(fn ($c) => [(string) $c['folio'], $c['guardada'], $c['formula'], $c['diferencia']], $a['formula_sola_distinta']),
            );
        }

        if ($a['ajustadas_distintas'] !== []) {
            $this->newLine();
            $this->warn('Ajustes cuya comisión NO coincide con la que guardó el sistema viejo:');
            $this->table(
                ['Folio', 'Fórmula', 'Ajustada', 'Guardada', 'Diferencia'],
                array_map(fn ($c) => [(string) $c['folio'], $c['formula'], $c['ajustada'], $c['guardada'], $c['diferencia']], $a['ajustadas_distintas']),
            );
        }

        if ($a['ajustadas'] !== []) {
            $this->newLine();
            $this->line('Las comisiones ajustadas, con la que guardó el sistema viejo:');
            $this->table(
                ['Folio', 'Fórmula', 'Ajustada', 'Guardada', 'Desvío'],
                array_map(fn ($c) => [(string) $c['folio'], $c['formula'], $c['ajustada'], $c['guardada'], $c['desvio']], $a['ajustadas']),
            );
        }

        if ($sin !== []) {
            $this->newLine();
            $this->warn('Folios sin candidato: se quedan con la fórmula. "Por cobrar" es lo que quedaría con la comisión de la fórmula:');
            $this->table(
                ['Folio', 'Monto del pago', 'Comisión guardada', 'ComisionAmex::calcular()', 'Diferencia', 'Por cobrar con la fórmula', 'Total viejo', 'Caso'],
                array_map(fn ($s) => [(string) $s['folio'], $s['monto'], $s['guardada'], $s['formula'], $s['diferencia'], $s['por_cobrar'], $s['total_viejo'], $s['caso']], $sin),
            );
        }
    }

    // ---- 4. El sobrepago derivado contra el Cambio guardado ---------------------------

    private function compararSobrepago(array $ultimo, array $pagosPorFolio): void
    {
        $sinPagos = 0;
        $sobrepagadas = 0;
        $cambioDistintoDeCero = 0;
        $sobreSinCambio = [];
        $cambioSinSobrepago = [];
        $porUnCentavo = [];

        foreach ($ultimo as $folio => $h) {
            $pagado = '0.00';
            $origen = '0.000000';
            foreach ($pagosPorFolio[$folio] ?? [] as $p) {
                $pagado = bcadd($pagado, $p->importado, 2);
                $origen = bcadd($origen, $p->origen, 6);
            }
            if (! isset($pagosPorFolio[$folio])) {
                $sinPagos++;
            }

            $total = $this->centavos($h->Total);
            $cambio = $this->centavos($h->Cambio);
            $sobrepago = bcsub($pagado, $total, 2);
            $estaSobrepagada = bccomp($sobrepago, '0.00', 2) > 0;
            $conCambio = bccomp($cambio, '0.00', 2) !== 0;

            if ($conCambio) {
                $cambioDistintoDeCero++;
            }

            if ($estaSobrepagada) {
                $sobrepagadas++;

                // Un sobrepago de un solo centavo puede venir del origen o del redondeo de cada
                // pago al importarlo: se distingue mirando si la suma del ORIGEN, a centavos, ya
                // pasaba del Total.
                if ($sobrepago === '0.01') {
                    $delOrigen = $this->redondear($origen);
                    $yaEnElOrigen = bccomp($delOrigen, $total, 2) > 0;
                    $porUnCentavo[] = [
                        'folio' => $folio, 'total' => $total, 'pagado' => $pagado, 'origen' => $delOrigen, 'cambio' => $cambio,
                        'en_origen' => $yaEnElOrigen,
                        'causa' => $yaEnElOrigen
                            ? 'ya está en el origen (la suma del origen pasa del Total)'
                            : 'lo crea el redondeo al importar (la suma del origen cuadra con el Total)',
                    ];
                }

                if (! $conCambio) {
                    $sobreSinCambio[] = ['folio' => $folio, 'total' => $total, 'pagado' => $pagado, 'sobrepago' => $sobrepago, 'cambio' => $cambio];
                }
            } elseif ($conCambio) {
                $cambioSinSobrepago[] = ['folio' => $folio, 'total' => $total, 'pagado' => $pagado, 'sobrepago' => $sobrepago, 'cambio' => $cambio];
            }
        }

        $creadas = count(array_filter($porUnCentavo, fn ($c) => ! $c['en_origen']));

        $this->newLine();
        $this->line('Sobrepago derivado (pagado menos el Total guardado, cada pago a centavos, sin tolerancia) contra el Cambio guardado');
        $this->line('Folios con encabezado: '.count($ultimo));
        $this->line("Folios con encabezado y sin ningún pago: {$sinPagos}");
        $this->line("Sobrepagadas: {$sobrepagadas}");
        $this->line('  de ellas, por un solo centavo: '.count($porUnCentavo));
        $this->line("    de esas, creadas por el redondeo al importar (no existen en el origen): {$creadas}");
        $this->line('    de esas, que ya existen en el origen: '.(count($porUnCentavo) - $creadas));
        $this->line("Cambio guardado distinto de cero: {$cambioDistintoDeCero}");
        $this->line('Sobrepagadas con Cambio en cero: '.count($sobreSinCambio));
        $this->line('Sobrepagadas con Cambio guardado: '.($sobrepagadas - count($sobreSinCambio)));
        $this->line('Cambio guardado sin sobrepago: '.count($cambioSinSobrepago));

        if ($porUnCentavo !== []) {
            $this->newLine();
            $this->warn('Sobrepagadas por un solo centavo, y de dónde viene ese centavo:');
            $this->table(
                ['Folio', 'Total guardado', 'Pagado importado', 'Suma del origen', 'Cambio guardado', 'Causa'],
                array_map(fn ($c) => [(string) $c['folio'], $c['total'], $c['pagado'], $c['origen'], $c['cambio'], $c['causa']], $porUnCentavo),
            );
        }

        if ($sobreSinCambio !== []) {
            $this->newLine();
            $this->warn('Sobrepagadas con Cambio en cero (un pago posterior lo pisó, mpago.php):');
            $this->table(
                ['Folio', 'Total guardado', 'Pagado', 'Sobrepago', 'Cambio guardado'],
                array_map(fn ($c) => [(string) $c['folio'], $c['total'], $c['pagado'], $c['sobrepago'], $c['cambio']], $sobreSinCambio),
            );
        }

        if ($cambioSinSobrepago !== []) {
            $this->newLine();
            $this->warn('Cambio guardado sin estar sobrepagadas (el cambio quedó escrito y luego cambió el documento):');
            $this->table(
                ['Folio', 'Total guardado', 'Pagado', 'Pagado menos Total', 'Cambio guardado'],
                array_map(fn ($c) => [(string) $c['folio'], $c['total'], $c['pagado'], $c['sobrepago'], $c['cambio']], $cambioSinSobrepago),
            );
        }
    }

    // ---- 5. Las cortesías ---------------------------------------------------------------

    /**
     * La condición con la que el bloque 6 traducirá a `es_cortesia` («importe 0 con precio_u > 0»)
     * contra la marca del origen. No son el mismo conjunto, y el bloque 6 necesita las tres
     * diferencias para no perder ni inventar cortesías: las marcadas que la condición no captura
     * (entre ellas los descuentos, que son renglones negativos del bloque 5), las que la condición
     * captura sin marca, y entre estas las que tienen una errata en la remisión.
     */
    private function compararCortesias($renglones): void
    {
        $marcadas = 0;
        $otraGrafia = 0;
        $importeEnCero = 0;
        $marcadasConImporteEnCero = 0;
        $marcadasSinImporteEnCero = [];
        $descuentos = 0;
        $sinMarca = [];
        $erratas = 0;

        foreach ($renglones as $r) {
            $marcada = (int) $r->marcada_cortesia === 1;
            $importe = $this->centavos($r->importe);
            $precio = $this->seisDecimales($r->precio_u);
            $esCortesia = bccomp($importe, '0.00', 2) === 0 && bccomp($precio, '0', 6) > 0;
            $esDescuento = bccomp($importe, '0.00', 2) < 0 && bccomp($precio, '0', 6) < 0;
            $remision = (string) $r->remision;

            $fila = [(string) $r->fol_prefactura, (string) $r->id_venta, (string) $r->id_servicio, $this->recortar($precio), $importe, (string) $r->cantidad, $remision];

            if ($marcada) {
                $marcadas++;
                if ($r->remision !== 'cortesia') {
                    $otraGrafia++;
                }
            }

            if ($esCortesia) {
                $importeEnCero++;
            }

            if ($marcada && $esCortesia) {
                $marcadasConImporteEnCero++;
            } elseif ($marcada) {
                $marcadasSinImporteEnCero[] = array_merge($fila, [$esDescuento ? 'descuento (renglón negativo, bloque 5)' : 'con importe']);
                $descuentos += $esDescuento ? 1 : 0;
            } elseif ($esCortesia) {
                // Una remisión que no es 'cortesia' pero se le parece: una errata de ella.
                $errata = $remision !== '' && levenshtein(strtolower(trim($remision)), 'cortesia') <= 2;
                $erratas += $errata ? 1 : 0;
                $sinMarca[] = array_merge($fila, [$errata ? 'errata de «cortesia»' : '']);
            }
        }

        $this->newLine();
        $this->line("Cortesías: remision = 'cortesia' contra importe 0 con precio_u mayor que 0");
        $this->line("Cortesías marcadas: {$marcadas}");
        $this->line("  de ellas, escritas con otra grafía (mayúsculas o acento): {$otraGrafia}");
        $this->line("Importe en cero con precio mayor que cero: {$importeEnCero}");
        $this->line("Cortesías marcadas con importe en cero: {$marcadasConImporteEnCero}");
        $this->line('Marcadas como cortesía sin importe en cero: '.count($marcadasSinImporteEnCero));
        $this->line("  de ellas, con precio e importe negativos (descuentos, del bloque 5): {$descuentos}");
        $this->line('  de ellas, con importe distinto de cero y sin ser negativas: '.(count($marcadasSinImporteEnCero) - $descuentos));
        $this->line('Importe en cero sin marca de cortesía: '.count($sinMarca));
        $this->line("  de ellas, con una remisión que parece una errata de «cortesia»: {$erratas}");
        $this->line("La condición «importe 0 con precio mayor que 0» NO captura las {$marcadas} marcadas: deja fuera ".count($marcadasSinImporteEnCero).' y agrega '.count($sinMarca).' sin marca.');

        $columnas = ['Folio', 'Renglón', 'Servicio', 'Precio', 'Importe', 'Cantidad', 'Remisión', 'Qué es'];

        if ($marcadasSinImporteEnCero !== []) {
            $this->newLine();
            $this->warn('Marcadas como cortesía con un importe que no es cero:');
            $this->table($columnas, $marcadasSinImporteEnCero);
        }

        if ($sinMarca !== []) {
            $this->newLine();
            $this->warn('Importe en cero con precio mayor que cero, sin la marca de cortesía:');
            $this->table($columnas, $sinMarca);
        }
    }

    // ---- Apoyo --------------------------------------------------------------------------

    /**
     * Los folios dentro del alcance, como llaves de un arreglo; `null` si es todo el origen.
     * Salen de la unión de encabezados, pagos y renglones, en orden numérico.
     *
     * @return array<int, true>|null
     */
    private function alcance($encabezados, $pagos, $renglones, mixed $folio, mixed $limite): ?array
    {
        if ($folio === null && $limite === null) {
            return null;
        }

        if ($folio !== null) {
            return [(int) $folio => true];
        }

        $todos = [];
        foreach ([$encabezados, $pagos, $renglones] as $filas) {
            foreach ($filas as $fila) {
                $todos[$fila->fol_prefactura] = true;
            }
        }
        ksort($todos);

        return array_slice($todos, 0, (int) $limite, true);
    }

    /**
     * Un valor del origen leído como texto a seis decimales, para compararlo con `bc`. Un DOUBLE
     * o un FLOAT llega a PHP como float: el formato a seis decimales conserva los cuatro reales
     * (105.2816) y desecha el ruido binario (el 1e-13 de una resta del sistema viejo), y de ahí en
     * adelante no se vuelve a operar con floats.
     */
    private function seisDecimales(mixed $valor): string
    {
        return number_format((float) $valor, 6, '.', '');
    }

    /**
     * Un valor del origen a una cadena de dos decimales. Los DECIMAL(18,2) de MySQL ya llegan así;
     * lo demás (sqlite en pruebas) pasa por un formato, nunca por restas de float.
     */
    private function centavos(mixed $valor): string
    {
        if (is_string($valor) && preg_match('/^-?\d+\.\d{2}$/', $valor) === 1) {
            return $valor;
        }

        return number_format((float) $valor, 2, '.', '');
    }

    /** A centavos, el medio centavo hacia arriba (lejos del cero), en aritmética de cadenas. */
    private function redondear(string $seisDecimales): string
    {
        $redondeado = bcadd($this->absoluta($seisDecimales), '0.005', 2);

        return ($seisDecimales[0] === '-' && bccomp($redondeado, '0', 2) !== 0 ? '-' : '').$redondeado;
    }

    /** Una cadena de seis decimales sin los ceros de sobra, pero con al menos `$minimo`. */
    private function recortar(string $valor, int $minimo = 2): string
    {
        [$entero, $decimales] = explode('.', $valor) + [1 => ''];

        return $entero.'.'.str_pad(rtrim($decimales, '0'), $minimo, '0');
    }

    private function absoluta(string $valor): string
    {
        return ltrim($valor, '-');
    }

    /** @return list<list<string>> */
    private function peores(array $casos, int $cuantos, array $columnas): array
    {
        usort($casos, fn ($a, $b) => bccomp($b['diferencia'], $a['diferencia'], 6));

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
