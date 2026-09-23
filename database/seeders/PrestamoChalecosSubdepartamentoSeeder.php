<?php

namespace Database\Seeders;

use App\Models\Departamento;
use App\Models\SubDepartamento;
use Illuminate\Database\Seeder;

/**
 * Subdepartamento que habilita "Préstamo de chalecos" dentro de Tráfico. El
 * nombre coincide con el middleware subdep:prestamoChalecos y con la llave de
 * ROUTE_CONFIG en navigation.ts (Str::slug: "prestamochalecos").
 */
class PrestamoChalecosSubdepartamentoSeeder extends Seeder
{
    public function run(): void
    {
        $departamento = Departamento::firstOrCreate(['nombre' => 'Trafico']);

        SubDepartamento::firstOrCreate(
            [
                'departamento_id' => $departamento->id,
                'nombre' => 'prestamoChalecos',
            ],
            [
                'status' => 'A',
            ]
        );
    }
}
