<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Models\Role;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::updateOrCreate(
            ['email' => 'adminDespacho@eolo.com'],
            [
                'name' => 'Administrador EOLO',
                'password' => Hash::make('admin123'),
            ]
        );

        $adminRole = Role::where('slug', 'admin')->first();

        if (! $adminRole) {
            $this->command->error('El rol admin no existe. Ejecuta RoleSeeder primero.');
            return;
        }

        $user->roles()->syncWithoutDetaching([$adminRole->id]);

        $this->command->info('Usuario administrador creado y rol asignado');
    }
}
