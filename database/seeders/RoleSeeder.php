<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Role;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            ['nombre' => 'Administrador', 'slug' => 'admin'],
            ['nombre' => 'Empleado', 'slug' => 'empleado'],
            ['nombre' => 'Jefe de Área', 'slug' => 'jefe_area'],
            ['nombre' => 'FBO', 'slug' => 'fbo'],
        ];

        foreach ($roles as $role) {
            Role::firstOrCreate(['slug' => $role['slug']], $role);
        }
    }
}
