<?php

namespace Database\Seeders;

use App\Models\Departamento;
use App\Models\SubDepartamento;
use Illuminate\Database\Seeder;

/**
 * Da de alta el subdepartamento que habilita el módulo Operaciones Programadas
 * dentro de Despacho. El nombre debe coincidir con el parámetro del middleware
 * subdep:operacionesProgramadas y con la llave de ROUTE_CONFIG en navigation.ts
 * (Str::slug del nombre: "operacionesprogramadas").
 */
class OperacionesProgramadasSubdepartamentoSeeder extends Seeder
{
    public function run(): void
    {
        $departamento = Departamento::firstOrCreate(['nombre' => 'Despacho']);

        SubDepartamento::firstOrCreate(
            [
                'departamento_id' => $departamento->id,
                'nombre' => 'operacionesProgramadas',
            ],
            [
                'status' => 'A',
            ]
        );
    }
}
