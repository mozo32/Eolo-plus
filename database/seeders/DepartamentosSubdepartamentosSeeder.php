<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
class DepartamentosSubdepartamentosSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::transaction(function () {
            $data = [
                'Despacho' => [
                    'entregaTurno',
                    'walkAround',
                ],

                'Rampa' => [
                    'entregaTurno',
                ],

                'Atención a Clientes' => [
                    'entregaTurno',
                ],
            ];

            foreach ($data as $departamentoNombre => $subdepartamentos) {

                $departamentoId = DB::table('departamentos')->insertGetId([
                    'nombre' => $departamentoNombre,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                foreach ($subdepartamentos as $subNombre) {
                    DB::table('subdepartamentos')->insert([
                        'departamento_id' => $departamentoId,
                        'nombre' => $subNombre,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        });
    }
}
