<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PuestosSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('puestos')->insert([
            ['nombre' => 'EJECUTIVO DE TRAFICO', 'departamento_id' => 1],
            ['nombre' => 'GESTOR VEHICULAR', 'departamento_id' => 2],
            ['nombre' => 'CHOFER', 'departamento_id' => 3],
            ['nombre' => 'GERENTE DE SERV COMERCIALES', 'departamento_id' => 4],
            ['nombre' => 'TRACTORISTA', 'departamento_id' => 1],
            ['nombre' => 'GTE DE CONSERVACION Y MANTENI', 'departamento_id' => 5],
            ['nombre' => 'JEFE DE RAMPA', 'departamento_id' => 1],
            ['nombre' => 'ENCARGADO DE TURNO DE RAMPA', 'departamento_id' => 1],
            ['nombre' => 'COORDINADOR DE DESPACHO', 'departamento_id' => 1],
            ['nombre' => 'OFICIAL DE RAMPA', 'departamento_id' => 1],
            ['nombre' => 'JEFE CONTABLE ADMINISTRATIVO', 'departamento_id' => 2],
            ['nombre' => 'AUX CONTRALORIA', 'departamento_id' => 2],
            ['nombre' => 'EJECUTIVO DE SISTEMAS', 'departamento_id' => 2],
            ['nombre' => 'ENCARGADO DE COMBUSTIBLE', 'departamento_id' => 1],
            ['nombre' => 'DESPACHADOR', 'departamento_id' => 1],
            ['nombre' => 'ANALISTA COMERCIAL', 'departamento_id' => 4],
            ['nombre' => 'GERENTE OPERACIONES FBO', 'departamento_id' => 1],
            ['nombre' => 'JEFE DE TRAFICO', 'departamento_id' => 1],
            ['nombre' => 'EJECUTIVO DE FACTURACION', 'departamento_id' => 2],
            ['nombre' => 'EJECUTIVO DE CUENTAS POR COBRA', 'departamento_id' => 2],
            ['nombre' => 'ENCARGADO DE MANTENIMIENTO', 'departamento_id' => 5],
            ['nombre' => 'AUX DE SEGURIDAD Y CALIDAD', 'departamento_id' => 5],
            ['nombre' => 'AUX DE MANTENIMIENTO', 'departamento_id' => 5],
            ['nombre' => 'DESARROLADOR WEB', 'departamento_id' => 2],
        ]);
    }
}
