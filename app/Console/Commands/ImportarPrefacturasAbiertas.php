<?php

namespace App\Console\Commands;

use App\Models\FactServicio;
use App\Models\User;
use App\Services\ImportadorPrefacturasAbiertas;
use Illuminate\Console\Command;

/**
 * Trae las prefacturas ABIERTAS del sistema viejo como borradores, con su folio.
 *
 * Las CERRADAS no: eso es otro trabajo y depende de decisiones que el departamento
 * todavía no ha tomado. Si alguien espera ver aquí el histórico, no está roto.
 */
class ImportarPrefacturasAbiertas extends Command
{
    protected $signature = 'facturacion:importar-prefacturas-abiertas
        {--aplicar : Escribe los cambios; sin esta bandera solo simula}
        {--usuario= : Id del usuario al que se atribuyen los borradores; por omisión, el admin de menor id}';

    protected $description = 'Importa las prefacturas ABIERTAS (tb_prefcatura) del sistema viejo como borradores, conservando su folio de origen';

    public function handle(ImportadorPrefacturasAbiertas $importador): int
    {
        $aplicar = (bool) $this->option('aplicar');
        $origen = config('database.connections.remota.database');

        // Sin catálogos, cada prefactura se rechazaría por «matrícula que no está en el
        // catálogo» y el informe sería una lista de ruido. Mejor decirlo antes.
        if (FactServicio::query()->count() === 0) {
            $this->error('No hay catálogos importados: cada prefactura se rechazaría por falta de matrícula o de servicio.');
            $this->line('Corre antes `php artisan facturacion:importar-matriculas --aplicar`.');

            return self::FAILURE;
        }

        $usuario = $this->usuario();

        if ($usuario === null) {
            $this->error('No se encontró a quién atribuir los borradores: no hay ningún usuario con rol admin.');
            $this->line('Pasa uno con --usuario=<id>.');

            return self::FAILURE;
        }

        $this->info($aplicar
            ? "Importando las abiertas desde '{$origen}'; se atribuyen a {$usuario->name} (id {$usuario->id})."
            : "Simulación desde '{$origen}': no se escribirá nada.");

        try {
            $resultado = $importador->ejecutar($aplicar, $usuario->id);
        } catch (\Throwable $e) {
            // El servicio ya revirtió la transacción; nada quedó a medias.
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

        $this->newLine();
        $this->comment('Las prefacturas CERRADAS del sistema viejo no se importan: eso es otro trabajo.');
        $this->comment('Lo importado entra como BORRADOR con su folio de origen; revísalo y descarta lo que no sirva antes de cerrar nada.');

        if (! $aplicar) {
            $this->comment('Fue una simulación: se revirtió todo. Corre con --aplicar para escribir.');
        }

        return self::SUCCESS;
    }

    private function usuario(): ?User
    {
        $id = $this->option('usuario');

        if ($id !== null) {
            return User::query()->find((int) $id);
        }

        return User::query()
            ->whereHas('roles', fn ($q) => $q->where('slug', 'admin'))
            ->orderBy('id')
            ->first();
    }
}
