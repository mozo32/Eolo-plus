<?php

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind a different classes or traits.
|
*/

pest()->extend(Tests\TestCase::class)
    ->use(Illuminate\Foundation\Testing\RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

function something()
{
    // ..
}

/**
 * Usuario con rol admin: pasa cualquier verificación de subdepartamento.
 */
function usuarioAdmin(): App\Models\User
{
    $usuario = App\Models\User::factory()->create();
    $rol = App\Models\Role::firstOrCreate(
        ['slug' => 'admin'],
        ['nombre' => 'Administrador']
    );
    $usuario->roles()->attach($rol->id);

    return $usuario;
}

/**
 * Usuario de Despacho con acceso al subdepartamento indicado.
 */
function usuarioConSubdepartamento(
    string $subdepartamento = 'operacionesProgramadas',
    string $departamento = 'Despacho',
    string $rol = 'empleado'
): App\Models\User {
    $usuario = App\Models\User::factory()->create();

    $rolModelo = App\Models\Role::firstOrCreate(
        ['slug' => $rol],
        ['nombre' => ucfirst($rol)]
    );
    $usuario->roles()->attach($rolModelo->id);

    $departamentoModelo = App\Models\Departamento::firstOrCreate(['nombre' => $departamento]);
    $subdepartamentoModelo = App\Models\SubDepartamento::firstOrCreate([
        'departamento_id' => $departamentoModelo->id,
        'nombre' => $subdepartamento,
    ]);

    $usuario->subdepartamentos()->attach($subdepartamentoModelo->id);

    return $usuario;
}

/**
 * Usuario de otra área, sin el subdepartamento de Operaciones Programadas.
 */
function usuarioSinAcceso(): App\Models\User
{
    return usuarioConSubdepartamento('entregaTurno', 'Rampa', 'empleado');
}

/**
 * Vehículo de la flota Eolo. El id ES el número económico, una cadena.
 */
function vehiculoDePrueba(
    string $id,
    string $nombre,
    string $estado = 'En Planta',
    bool $activo = true
): App\Models\Vehiculo {
    return App\Models\Vehiculo::create([
        'id' => $id,
        'nombre' => $nombre,
        'estado' => $estado,
        'activo' => $activo,
    ]);
}

/**
 * Usuario con un rol concreto, para los candados de MovimientosVehiculoEolo.
 *
 * No se llama `usuarioConRol`: ese nombre ya está tomado como función global
 * en tests/Feature/OperacionesDiarias/CancelarOperacionTest.php.
 */
function usuarioVehiculosConRol(string $slug): App\Models\User
{
    $usuario = App\Models\User::factory()->create();
    $rol = App\Models\Role::firstOrCreate(
        ['slug' => $slug],
        ['nombre' => ucfirst($slug)]
    );
    $usuario->roles()->attach($rol->id);

    return $usuario;
}

/**
 * N movimientos de un vehículo, para las pruebas de conteo y orden.
 */
function movimientosDePrueba(string $vehiculoId, int $cuantos): void
{
    foreach (range(1, $cuantos) as $i) {
        $movimiento = App\Models\movimientoVehiculo::create([
            'vehiculo_id' => $vehiculoId,
            'tipo' => $i % 2 === 1 ? 'Salida' : 'Entrada',
            'chofer' => 'Chofer de prueba',
            'kilometraje' => 1000 + $i,
            'gasolina' => '1/2',
        ]);

        // Marcas de tiempo separadas a propósito. Creados todos en el mismo
        // segundo, el orden por `created_at` sería un empate y la prueba del
        // orden pasaría o fallaría según el humor de la base. `created_at` no
        // está en $fillable, así que se escribe con forceFill.
        $movimiento->forceFill(['created_at' => now()->addSeconds($i)])->save();
    }
}
