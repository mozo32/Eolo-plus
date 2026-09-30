<?php

namespace App\Console\Commands;

use App\Models\FactAeronave;
use App\Models\FactCategoriaAeronave;
use App\Models\FactCategoriaServicio;
use App\Models\FactCliente;
use App\Models\FactFormaPago;
use App\Models\FactPrecioCombustible;
use App\Models\FactProveedor;
use App\Models\FactServicio;
use App\Models\FactTipoMotor;
use App\Services\ImportadorMatriculas;
use Illuminate\Console\Command;

class ImportarMatriculasPrefactura extends Command
{
    protected $signature = 'facturacion:importar-matriculas {--aplicar : Escribe los cambios; sin esta bandera solo simula}
        {--forzar : Con --aplicar, corre aunque fact_aeronaves ya tenga filas (las sobreescribe)}';

    protected $description = 'Importa matrículas, tipos, categorías, motores, tarifas, combustible y los catálogos de facturación (clientes, servicios, formas de pago, proveedores) desde la base de Prefacturas';

    /**
     * Tablas que la importación pisa con `updateOrCreate` / `update`: lo que
     * alguien haya editado desde la aplicación se perdería. Varias guardan
     * tarifas que se cobran y tienen pantalla de edición.
     *
     * @var array<class-string<\Illuminate\Database\Eloquent\Model>,string>
     */
    private const SOBREESCRIBEN = [
        FactAeronave::class => 'estatus, categoría, motor, derecho de vuelos y tarifas propias',
        FactCategoriaAeronave::class => 'tarifas de pernocta y tránsito 2 h / 12 h',
        FactTipoMotor::class => 'tarifa de aterrizaje',
        FactPrecioCombustible::class => 'el precio vigente que dejó el importador',
        FactCliente::class => 'RFC, correo y teléfono',
        FactServicio::class => 'categoría, precio, margen y ajuste de precio',
    ];

    /**
     * Tablas que solo reciben lo que falta (`firstOrCreate` por nombre). No
     * pisan nada, pero si en pantalla se renombró una fila, volver a aplicar
     * recrea la original y quedan dos.
     *
     * @var array<int,class-string<\Illuminate\Database\Eloquent\Model>>
     */
    private const SOLO_AGREGAN = [
        FactCategoriaServicio::class,
        FactFormaPago::class,
        FactProveedor::class,
    ];

    public function handle(ImportadorMatriculas $importador): int
    {
        $aplicar = (bool) $this->option('aplicar');
        $origen = config('database.connections.remota.database');

        try {
            // Volver a importar pisa lo que alguien haya editado desde la aplicación,
            // y no solo en fact_aeronaves: también las tarifas de categorías y
            // motores, el precio de combustible y los catálogos de facturación.
            [$sobreescriben, $soloAgregan] = $this->tablasConFilas();

            if (($sobreescriben !== [] || $soloAgregan !== []) && $aplicar && ! $this->option('forzar')) {
                $this->error('--aplicar se negó porque Eolo-plus ya tiene datos en tablas que la importación toca. No se escribió nada.');
                $this->avisarTablasConFilas($sobreescriben, $soloAgregan);
                $this->line('Revisa con la simulación (sin --aplicar) y, si de verdad quieres seguir, agrega --forzar.');

                return self::FAILURE;
            }

            if ($sobreescriben !== [] || $soloAgregan !== []) {
                $this->warn('Eolo-plus ya tiene datos en tablas que la importación toca:');
                $this->avisarTablasConFilas($sobreescriben, $soloAgregan);
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

    /**
     * @return array{0: array<string,array{0:int,1:string}>, 1: array<string,array{0:int,1:string}>}
     *                                                                                               tabla => [filas, detalle], para las que sobreescribe y las que solo agrega
     */
    private function tablasConFilas(): array
    {
        $sobreescriben = [];
        $soloAgregan = [];

        foreach (self::SOBREESCRIBEN as $modelo => $detalle) {
            $filas = $modelo::query()->count();

            if ($filas > 0) {
                $sobreescriben[(new $modelo)->getTable()] = [$filas, $detalle];
            }
        }

        foreach (self::SOLO_AGREGAN as $modelo) {
            $filas = $modelo::query()->count();

            if ($filas > 0) {
                $soloAgregan[(new $modelo)->getTable()] = [$filas, ''];
            }
        }

        return [$sobreescriben, $soloAgregan];
    }

    private function avisarTablasConFilas(array $sobreescriben, array $soloAgregan): void
    {
        if ($sobreescriben !== []) {
            $this->line('Se sobreescriben (lo editado desde la aplicación se pierde):');

            foreach ($sobreescriben as $tabla => [$filas, $detalle]) {
                $this->line("  - {$tabla}: {$filas} filas ({$detalle})");
            }
        }

        if ($soloAgregan !== []) {
            $this->line('Solo se agrega lo que falta (nada se pisa, pero una fila renombrada en pantalla se recrea con su nombre original y quedan dos):');

            foreach ($soloAgregan as $tabla => [$filas]) {
                $this->line("  - {$tabla}: {$filas} filas");
            }
        }
    }
}
