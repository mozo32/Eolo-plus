<?php

namespace Database\Seeders;

use Illuminate\Support\Facades\DB;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class tipoiAeronaveSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('tipo_aeronaves')->insert([
            [
                'nombre' => 'avion',
            ],
            [
                'nombre' => 'helicoptero',
            ]
        ]);
    }
}
