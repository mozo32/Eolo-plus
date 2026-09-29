<?php

namespace App\Console\Commands;

use App\Services\ImportadorMatriculas;
use Illuminate\Console\Command;

class ImportarMatriculasPrefactura extends Command
{
    protected $signature = 'facturacion:importar-matriculas {--aplicar : Escribe los cambios; sin esta bandera solo simula}';

    protected $description = 'Importa matrículas, tipos, categorías, motores y combustible desde la base de Prefacturas';

    public function handle(ImportadorMatriculas $importador): int
    {
        $aplicar = (bool) $this->option('aplicar');
        $origen = config('database.connections.remota.database');

        $this->info($aplicar
            ? "Importando desde '{$origen}'..."
            : "Simulación desde '{$origen}': no se escribirá nada.");

        try {
            $resultado = $importador->ejecutar($aplicar);
        } catch (\Throwable $e) {
            // El importador ya revirtió la transacción; nada quedó a medias.
            $this->error('No se pudo completar la importación y no se escribió nada: '.$e->getMessage());

            return self::FAILURE;
        }

        $this->newLine();
        $this->table(
            ['Concepto', 'Cantidad'],
            collect($resultado->conteos)->map(fn ($v, $k) => [$k, $v])->values()->all(),
        );

        if ($resultado->hallazgos === []) {
            $this->info('Sin hallazgos.');
        } else {
            $this->newLine();
            $this->warn('Hallazgos que conviene revisar'.($aplicar ? '' : ' antes de aplicar').':');

            foreach ($resultado->hallazgos as $hallazgo) {
                $this->line("  - {$hallazgo}");
            }
        }

        if (! $aplicar) {
            $this->newLine();
            $this->comment('Fue una simulación: se revirtió todo. Corre con --aplicar para escribir.');
        }

        return self::SUCCESS;
    }
}
