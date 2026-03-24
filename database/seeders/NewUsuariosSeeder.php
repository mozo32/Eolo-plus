<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class NewUsuariosSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $usuarios = [
            [
                'name'     => 'ROVEGLIA VAZQUEZ DANIEL',
                'email'    => 'daniel.roveglia@Eolo.com',
                'password' => Hash::make('894'),
            ],
            [
                'name'     => 'GARCIA GARCIA ANA CRISTINA',
                'email'    => 'ana.garcia@Eolo.com',
                'password' => Hash::make('976'),
            ],
            [
                'name'     => 'SUAREZ RAMIREZ KAREN',
                'email'    => 'karen.suarez@Eolo.com',
                'password' => Hash::make('460'),
            ],
        ];

        foreach ($usuarios as $usuario) {
            // updateOrCreate evita duplicados si corres el seeder varias veces
            User::updateOrCreate(
                ['name' => $usuario['name']],
                $usuario
            );
        }
    }
}
