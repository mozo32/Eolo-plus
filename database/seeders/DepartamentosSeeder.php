<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
class DepartamentosSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('departamentos')->insert([
            ['nombre' => 'FBO'],
            ['nombre' => 'ADMINISTRACION'],
            ['nombre' => 'DIRECCION GENERAL'],
            ['nombre' => 'SERVICIOS COMERCIALES'],
            ['nombre' => 'INGENIERIA'],
        ]);
    }
}
