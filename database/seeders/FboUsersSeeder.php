<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Models\Role;

class FboUsersSeeder extends Seeder
{
    public function run(): void
    {
        $usuariosFbo = [
            ['clave' => 27,   'nombre' => 'PEÑA FABIAN JESUS ALEJANDRO'],
            ['clave' => 479,  'nombre' => 'OCAMPO CONTRERAS ALFONSO'],
            ['clave' => 790,  'nombre' => 'SALAZAR OVANDO EDGAR'],
            ['clave' => 805,  'nombre' => 'DURO HERAS CARLOS IGNACIO'],
            ['clave' => 813,  'nombre' => 'GARCIA RODRIGUEZ JESSICA MONSERRAT'],
            ['clave' => 829,  'nombre' => 'DE LA O MARTINEZ LEONEL'],
            ['clave' => 926,  'nombre' => 'GARCIA ROSALES ALEJANDRO'],
            ['clave' => 929,  'nombre' => 'GUTIERREZ CARMONA JOSE LUIS'],
            ['clave' => 940,  'nombre' => 'PEÑA GONZALEZ ALDAIR'],
            ['clave' => 956,  'nombre' => 'NOLASCO SEGURA JULIO CESAR'],
            ['clave' => 962,  'nombre' => 'SANCHEZ VENTOLERO JOSE LUIS'],
            ['clave' => 964,  'nombre' => 'SANCHEZ INIESTA RICARDO'],
            ['clave' => 972,  'nombre' => 'OSORIO ALVAREZ CARLOS EDUARDO'],
            ['clave' => 984,  'nombre' => 'REYES CASTILLO DENIS'],
            ['clave' => 985,  'nombre' => 'SERRANO LOPEZ CARLOS EMILIANO'],
            ['clave' => 990,  'nombre' => 'CARBAJAL FABELA CASSANDRA DESIREE'],
            ['clave' => 993,  'nombre' => 'ESPINOSA NAVA DANIEL'],
            ['clave' => 996,  'nombre' => 'SERRANO PIÑA RAYMUNDO'],
            ['clave' => 997,  'nombre' => 'LUGO PATIÑO BRYAN RUBEN'],
            ['clave' => 1000, 'nombre' => 'MIRANDA BELTRAN LAURA NABETSE'],
            ['clave' => 1003, 'nombre' => 'CARO AYALA ULISES'],
            ['clave' => 1007, 'nombre' => 'HUERTA ROMERO BRANDON JAVIER'],
            ['clave' => 1009, 'nombre' => 'SERRATO VARGAS MARIA GUADALUPE'],
            ['clave' => 1011, 'nombre' => 'ENRIQUEZ VALDEZ CRISTIAN DANIEL'],
            ['clave' => 1012, 'nombre' => 'DIAZ GONZALEZ ROGELIO JAIR'],
            ['clave' => 1014, 'nombre' => 'MARTINEZ HERNANDEZ LUIS ALEJANDRO'],
            ['clave' => 1015, 'nombre' => 'JARQUIN CORTEZ AXEL'],
            ['clave' => 1016, 'nombre' => 'GARCIA GOMORA JOSE SAMUEL'],
            ['clave' => 1019, 'nombre' => 'VALDES SALAZAR FERNANDO'],
            ['clave' => 1021, 'nombre' => 'BELTRAN HIDALGO SAMUEL'],
            ['clave' => 1023, 'nombre' => 'MARTINEZ ROSAS OCTAVIO'],
            ['clave' => 1027, 'nombre' => 'CARRASCO DIAZ JORGE'],
            ['clave' => 1031, 'nombre' => 'PINEDA ORTEGA ADRIANA ODETTE'],
            ['clave' => 1035, 'nombre' => 'BECERRIL MARQUEZ DIEGO'],
        ];

        $rolFbo = Role::where('slug', 'fbo')->first();

        if (! $rolFbo) {
            $this->command->error('El rol fbo no existe. Ejecuta RoleSeeder primero.');
            return;
        }

        foreach ($usuariosFbo as $u) {
            $email = strtolower(str_replace(' ', '.', $u['nombre'])) . '@eolo.com';

            $user = User::updateOrCreate(
                ['email' => $email],
                [
                    'name' => $u['nombre'],
                    'password' => Hash::make((string) $u['clave']),
                ]
            );

            $user->roles()->syncWithoutDetaching([$rolFbo->id]);
        }

        $this->command->info('Usuarios FBO creados correctamente');
    }
}
