<?php

namespace App\Console\Commands;

use App\Services\CalculadoraEstancia;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Contrasta `CalculadoraEstancia` contra lo que el sistema viejo cobró de verdad.
 *
 * Es el criterio de aceptación de la regla, no un informe más: sobre el volcado
 * completo debe reportar 86,1% de acierto en 2803 folios. Si da otra cifra, el
 * código no implementa la regla que se midió al diseñar esto.
 *
 * Solo lectura, como `comparar-prefacturas` y `comparar-pagos`.
 */
class CompararEstancia extends Command
{
    protected $signature = 'facturacion:comparar-estancia
        {--detalle=10 : Cuántos patrones de desajuste enumerar}';

    protected $description = 'Compara las cantidades de estancia históricas contra CalculadoraEstancia (solo lectura)';

    /** `tb_venta.id_servicio` de los tres tramos en el sistema viejo. */
    private const S_2H = 2;

    private const S_12H = 3;

    private const S_PERNOCTA = 4;

    public function handle(): int
    {
        $origen = config('database.connections.remota.database');
        $this->line("Comparando contra '{$origen}'. Este comando no escribe nada.");

        $conexion = DB::connection('remota');

        $reales = [];
        foreach ($conexion->table('tb_venta')
            ->whereIn('id_servicio', [self::S_2H, self::S_12H, self::S_PERNOCTA])
            ->selectRaw('fol_prefactura, id_servicio, sum(cantidad) c')
            ->groupBy('fol_prefactura', 'id_servicio')
            ->get() as $fila) {
            $reales[$fila->fol_prefactura][$fila->id_servicio] = (int) $fila->c;
        }

        $aciertos = 0;
        $fallos = 0;
        $inservibles = 0;
        $patrones = [];

        foreach ($conexion->table('tb_llegadas')->get() as $llegada) {
            $folio = $llegada->fol_prefactura;

            if (! isset($reales[$folio])) {
                continue;
            }

            $ini = $this->momento($llegada->Fecha_lleg);
            $fin = $this->momento($llegada->Fecha_sal);

            if ($ini === null || $fin === null || $fin->lessThanOrEqualTo($ini)) {
                $inservibles++;

                continue;
            }

            $pred = CalculadoraEstancia::tramos($ini, $fin);

            $realP = $reales[$folio][self::S_PERNOCTA] ?? 0;
            $real12 = $reales[$folio][self::S_12H] ?? 0;
            $real2 = $reales[$folio][self::S_2H] ?? 0;

            if ($pred['pernoctas'] === $realP && $pred['transitos12h'] === $real12 && $pred['transitos2h'] === $real2) {
                $aciertos++;

                continue;
            }

            $fallos++;
            $clave = sprintf('pred %d/%d/%d vs real %d/%d/%d',
                $pred['pernoctas'], $pred['transitos12h'], $pred['transitos2h'], $realP, $real12, $real2);
            $patrones[$clave] = ($patrones[$clave] ?? 0) + 1;
        }

        $total = $aciertos + $fallos;

        $this->newLine();
        $this->line(sprintf('Folios comparados: %d', $total));
        $this->line(sprintf('  La regla acierta en: %d  (%.1f%%)', $aciertos, $total ? 100 * $aciertos / $total : 0));
        $this->line(sprintf('  Falla en:            %d  (%.1f%%)', $fallos, $total ? 100 * $fallos / $total : 0));
        $this->line(sprintf('  Con fechas inservibles: %d', $inservibles));

        if ($patrones !== []) {
            arsort($patrones);
            $this->newLine();
            $this->line('Los desajustes más frecuentes (pernocta/12h/2h):');

            foreach (array_slice($patrones, 0, (int) $this->option('detalle'), true) as $clave => $cuantos) {
                $this->line(sprintf('  %5d x  %s', $cuantos, $clave));
            }
        }

        $this->newLine();
        $this->line('Qué prueba esto: que la regla reproduce lo que el sistema viejo cobró.');
        $this->line('Qué NO prueba: que el cobro del viejo fuera correcto. Un desajuste puede');
        $this->line('ser una cortesía del operador o un acuerdo a tanto alzado, no un defecto.');

        return self::SUCCESS;
    }

    private function momento(mixed $valor): ?Carbon
    {
        if (! $valor) {
            return null;
        }

        try {
            return Carbon::parse((string) $valor);
        } catch (\Throwable) {
            return null;
        }
    }
}
