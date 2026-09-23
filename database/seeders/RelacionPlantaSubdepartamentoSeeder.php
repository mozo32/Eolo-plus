<?php

namespace Database\Seeders;

use App\Models\Departamento;
use App\Models\SubDepartamento;
use Illuminate\Database\Seeder;

/**
 * Subdepartamento que habilita "Relación de planta" dentro de Rampa. El nombre
 * coincide con el middleware subdep:relacionPlanta y con la llave de
 * ROUTE_CONFIG en navigation.ts (Str::slug del nombre: "relacionplanta").
 */
class RelacionPlantaSubdepartamentoSeeder extends Seeder
{
    public function run(): void
    {
        $departamento = Departamento::firstOrCreate(['nombre' => 'Rampa']);

        SubDepartamento::firstOrCreate(
            [
                'departamento_id' => $departamento->id,
                'nombre' => 'relacionPlanta',
            ],
            [
                'status' => 'A',
            ]
        );
    }
}
