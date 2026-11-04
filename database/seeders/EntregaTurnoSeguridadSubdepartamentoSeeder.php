<?php

namespace Database\Seeders;

use App\Models\Departamento;
use App\Models\SubDepartamento;
use Illuminate\Database\Seeder;

/**
 * Subdepartamento que habilita "Entrega de Turno" dentro de Seguridad.
 *
 * El nombre coincide con la llave de ROUTE_CONFIG en navigation.ts
 * (Str::slug del nombre: "entregaturnoseguridad"). A diferencia de sus tres
 * hermanos NO hay middleware `subdep:` que lo acompañe: `routes/web.php` no
 * usa ninguno en este proyecto.
 *
 * Sin este renglón el menú no enseña el módulo a nadie que no sea
 * administrador, porque para el resto de los usuarios `getNavModules` recorre
 * `user.departamentos[].subdepartamentos[]` y descarta en silencio lo que no
 * esté en ROUTE_CONFIG. Las dos ramas son excluyentes:
 * `HandleInertiaRequests` manda `departamentos` vacío a los administradores.
 *
 * El nombre del departamento es 'Seguridad', el mismo con el que la rama de
 * administrador de navigation.ts rotula ese grupo. No está en
 * DepartamentosSubdepartamentosSeeder —ese seeder solo trae Despacho, Rampa y
 * Atención a Clientes—, igual que 'Trafico' y 'Rampa' tampoco estaban cuando
 * se escribieron los seeders de Préstamo de chalecos y Relación de planta. De
 * ahí el `firstOrCreate`: si el departamento ya existe en la base real se
 * reutiliza, y si no, se crea.
 */
class EntregaTurnoSeguridadSubdepartamentoSeeder extends Seeder
{
    public function run(): void
    {
        $departamento = Departamento::firstOrCreate(['nombre' => 'Seguridad']);

        SubDepartamento::firstOrCreate(
            [
                'departamento_id' => $departamento->id,
                'nombre' => 'entregaTurnoSeguridad',
            ],
            [
                'status' => 'A',
            ]
        );
    }
}
