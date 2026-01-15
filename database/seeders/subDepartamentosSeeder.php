<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class subDepartamentosSeeder extends Seeder
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
