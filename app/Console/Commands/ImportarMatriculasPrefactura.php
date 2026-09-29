<?php

namespace App\Console\Commands;

use App\Models\FactAeronave;
use App\Services\ImportadorMatriculas;
use Illuminate\Console\Command;

class ImportarMatriculasPrefactura extends Command
{
    protected $signature = 'facturacion:importar-matriculas {--aplicar : Escribe los cambios; sin esta bandera solo simula}
        {--forzar : Con --aplicar, corre aunque fact_aeronaves ya tenga filas (las sobreescribe)}';

    protected $description = 'Importa matrículas, tipos, categorías, motores y combustible desde la base de Prefacturas';

    public function handle(ImportadorMatriculas $importador): int
    {
        $aplicar = (bool) $this->option('aplicar');
        $origen = config('database.connections.remota.database');

        try {
            // Volver a importar sobreescribe estatus, categoría, motor, derecho de
            // vuelos y tarifas propias de todas las matrículas: lo que alguien haya
            // editado desde la aplicación se perdería sin aviso.
            $existentes = FactAeronave::query()->count();

            if ($existentes > 0 && $aplicar && ! $this->option('forzar')) {
                $this->error("fact_aeronaves ya tiene {$existentes} filas y --aplicar las sobreescribiría (estatus, categoría, motor, derecho de vuelos y tarifas propias). No se escribió nada.");
                $this->line('Revisa con la simulación (sin --aplicar) y, si de verdad quieres sobreescribir, agrega --forzar.');

                return self::FAILURE;
            }

            if ($existentes > 0) {
                $this->warn("fact_aeronaves ya tiene {$existentes} filas: la importación las sobreescribiría.");
            }

            $this->info($aplicar
                ? "Importando desde '{$origen}'..."
                : "Simulación desde '{$origen}': no se escribirá nada.");

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
