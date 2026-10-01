<?php

namespace Database\Seeders;

use App\Models\Departamento;
use App\Models\SubDepartamento;
use Illuminate\Database\Seeder;

/**
 * Departamento Facturación y los subdepartamentos de los bloques 1a, 1b y 2.
 *
 * Cada pantalla lleva el suyo porque el menú se arma a partir de los
 * subdepartamentos del usuario: `HandleInertiaRequests` publica
 * `slug(departamento).slug(subdepartamento)` y `navigation.ts` lo resuelve
 * contra ROUTE_CONFIG. Un solo subdepartamento daría una sola entrada.
 */
class FacturacionSubdepartamentosSeeder extends Seeder
{
    public function run(): void
    {
        $departamento = Departamento::firstOrCreate(['nombre' => 'Facturacion']);

        foreach ([
            'factAeronaves', 'factCategoriasAeronave', 'factTiposMotor', 'factCombustible',
            'factClientes', 'factServicios', 'factFormasPago', 'factProveedores', 'factPrefacturas',
        ] as $nombre) {
            SubDepartamento::firstOrCreate(
                ['departamento_id' => $departamento->id, 'nombre' => $nombre],
                ['status' => 'A'],
            );
        }
    }
}
