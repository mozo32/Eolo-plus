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
 * Rutas de facturación del bloque 1b (catálogos de prefactura).
 *
 * ÚNICA lista de esos prefijos. Dos pruebas son complementarias y la usan:
 * EndpointsCatalogos1bTest.php INCLUYE solo estas rutas y EndpointsCatalogosTest.php
 * (bloque 1a) las EXCLUYE. Un prefijo nuevo se agrega aquí y en ningún otro lado;
 * agregarlo a una sola de las pruebas dejaría una ruta de escritura sin revisar.
 */
function esRutaFacturacion1b(string $uri): bool
{
    return preg_match('#^api/facturacion/(clientes|servicios|categorias-servicio|formas-pago|proveedores)(/|$)#', $uri) === 1;
}

/**
 * Rutas de prefacturas (bloque 2).
 *
 * ÚNICO prefijo de esas rutas, con la misma lógica de complemento que
 * `esRutaFacturacion1b()`: EndpointsPrefacturaTest.php INCLUYE solo estas rutas y
 * EndpointsCatalogosTest.php (bloque 1a) las EXCLUYE. Un literal propio en cada
 * archivo se desalinearía en silencio (por ejemplo, una barra final dejaría
 * `POST api/facturacion/prefacturas` fuera de una prueba y sin entrar en la otra).
 */
function esRutaPrefacturas(string $uri): bool
{
    return str_starts_with($uri, 'api/facturacion/prefacturas');
}

/*
|--------------------------------------------------------------------------
| Ayudantes de prefactura (bloque 2, Tasks 3 a 6)
|--------------------------------------------------------------------------
|
| Viven aquí y no en los archivos de prueba porque una función declarada en un
| archivo de prueba es global al cargarse: dos archivos que declaren la misma
| revientan por redeclaración. Las firmas son contrato de las Tasks 4, 5 y 6.
*/

/**
 * Una matrícula distinta en cada llamada, determinista: un contador y no
 * `uniqid()` recortado, que colisionaría de vez en cuando contra el índice único
 * de `aeronaves.matricula`.
 */
function matriculaDePrueba(): string
{
    static $contador = 0;

    return 'XA-T'.str_pad((string) ++$contador, 4, '0', STR_PAD_LEFT);
}

/**
 * Una prefactura en borrador con su matrícula en Tránsito.
 */
function prefacturaBorrador(): App\Models\FactPrefactura
{
    // Matrícula distinta en cada llamada: `aeronaves.matricula` es única desde el
    // bloque 1a y varias pruebas crean dos borradores en la misma prueba.
    $aeronave = App\Models\Aeronave::create(['matricula' => matriculaDePrueba()]);
    App\Models\FactAeronave::create(['aeronave_id' => $aeronave->id, 'estatus' => App\Models\FactAeronave::ESTATUS_TRANSITO]);

    return App\Models\FactPrefactura::create([
        'aeronave_id' => $aeronave->id,
        'estado' => App\Models\FactPrefactura::ESTADO_BORRADOR,
        'tipo_destino' => App\Models\FactPrefactura::DESTINO_NACIONAL,
        'user_id' => App\Models\User::factory()->create()->id,
    ]);
}

/**
 * Agrega a la prefactura un renglón con los valores congelados indicados.
 */
function renglonDe(App\Models\FactPrefactura $p, float $precio, int $cantidad, float $margen = 0, string $ajuste = 'ninguno'): App\Models\FactPrefacturaRenglon
{
    $servicio = App\Models\FactServicio::create(['nombre' => 'Servicio '.uniqid(), 'precio_unitario' => $precio]);

    return $p->renglones()->create([
        'servicio_id' => $servicio->id,
        'nombre_servicio' => $servicio->nombre,
        'precio_unitario' => $precio,
        'cantidad' => $cantidad,
        'es_de_tercero' => $margen > 0,
        'margen' => $margen,
        'ajuste_precio' => $ajuste,
        'orden' => 1,
    ]);
}

/**
 * Devuelve [$prefactura, $usuario]: con cliente y un renglón, lista para cerrar.
 */
function prefacturaCompleta(float $precio = 100.0, int $cantidad = 1): array
{
    $usuario = App\Models\User::factory()->create();
    $aeronave = App\Models\Aeronave::create(['matricula' => matriculaDePrueba()]);
    App\Models\FactAeronave::create(['aeronave_id' => $aeronave->id, 'estatus' => App\Models\FactAeronave::ESTATUS_TRANSITO]);
    $cliente = App\Models\FactCliente::create(['nombre' => 'Cliente '.uniqid()]);
    $servicio = App\Models\FactServicio::create(['nombre' => 'Servicio '.uniqid(), 'precio_unitario' => $precio]);

    $p = App\Models\FactPrefactura::create([
        'aeronave_id' => $aeronave->id,
        'cliente_id' => $cliente->id,
        'estado' => App\Models\FactPrefactura::ESTADO_BORRADOR,
        'tipo_destino' => App\Models\FactPrefactura::DESTINO_NACIONAL,
        'user_id' => $usuario->id,
    ]);

    $p->renglones()->create([
        'servicio_id' => $servicio->id,
        'nombre_servicio' => $servicio->nombre,
        'precio_unitario' => $precio,
        'cantidad' => $cantidad,
        'es_de_tercero' => false,
        'margen' => 0,
        'ajuste_precio' => 'ninguno',
        'orden' => 1,
    ]);

    return [$p->fresh(), $usuario];
}

/**
 * Prefactura en borrador con los tres servicios de estancia creados con su
 * `concepto` y una matrícula con las tres tarifas.
 */
function conEstancia(string $estatus = App\Models\FactAeronave::ESTATUS_TRANSITO): App\Models\FactPrefactura
{
    foreach ([
        App\Models\FactServicio::CONCEPTO_ESTANCIA_PERNOCTA => 'Transito 24 hrs - pernocta',
        App\Models\FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H => 'Transito 02 hrs',
        App\Models\FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H => 'Transito 12 hrs',
    ] as $concepto => $nombre) {
        App\Models\FactServicio::firstOrCreate(['nombre' => $nombre], ['precio_unitario' => 99.0, 'concepto' => $concepto]);
    }

    $aeronave = App\Models\Aeronave::create(['matricula' => matriculaDePrueba()]);
    App\Models\FactAeronave::create([
        'aeronave_id' => $aeronave->id,
        'estatus' => $estatus,
        'tarifa_pernocta' => 4676.00,
        'tarifa_transito_2h' => 1144.50,
        'tarifa_transito_12h' => 2338.00,
    ]);

    return App\Models\FactPrefactura::create([
        'aeronave_id' => $aeronave->id,
        'estado' => App\Models\FactPrefactura::ESTADO_BORRADOR,
        'tipo_destino' => App\Models\FactPrefactura::DESTINO_NACIONAL,
        'user_id' => App\Models\User::factory()->create()->id,
    ]);
}

/**
 * Cierra a mano una prefactura con el sello indicado (sin pasar por el servicio de
 * cierre de la Task 4): sirve para probar la rama sellada.
 *
 * Pone TAMBIÉN `cerrada_at` y `cerrada_por`, como lo hace el cierre de verdad. Si no los
 * pusiera, todo papel de prueba saldría con `Fecha: —` y `Elaborado por: Sin registrar`, y
 * ninguna prueba distinguiría el nombre de quien cerró del de quien imprime, ni la fecha de
 * cierre de la de hoy: es el hueco que este ayudante ya produjo una vez. `$cierra` es quien
 * cierra; por omisión, quien creó la prefactura.
 */
function cerrarConSello(App\Models\FactPrefactura $p, string $subtotal, string $iva, string $total, string $tasa = '0.1600', ?App\Models\User $cierra = null): App\Models\FactPrefactura
{
    $p->update([
        'estado' => App\Models\FactPrefactura::ESTADO_CERRADA,
        'folio' => 10000,
        'subtotal_sellado' => $subtotal,
        'iva_sellado' => $iva,
        'total_sellado' => $total,
        'iva_tasa_sellada' => $tasa,
        'cerrada_at' => now(),
        'cerrada_por' => $cierra?->id ?? $p->user_id,
    ]);

    return $p->fresh();
}

/**
 * Las siete formas de pago del catálogo, con el concepto de las tres que el
 * código reconoce. Devuelve [concepto o nombre => modelo] para poder tomar una
 * por su concepto sin otra consulta.
 *
 * @return array<string, App\Models\FactFormaPago>
 */
function formasDePago(): array
{
    $definicion = [
        'Visa' => null,
        'Mastercard' => null,
        'Amex' => App\Models\FactFormaPago::CONCEPTO_AMEX,
        'Efectivo' => App\Models\FactFormaPago::CONCEPTO_EFECTIVO,
        'AvCard by WFS' => App\Models\FactFormaPago::CONCEPTO_AVCARD,
        'Transferencia' => null,
        'Tarjeta Remota' => null,
    ];

    $formas = [];

    foreach ($definicion as $nombre => $concepto) {
        $formas[$concepto ?? $nombre] = App\Models\FactFormaPago::firstOrCreate(
            ['nombre' => $nombre],
            ['concepto' => $concepto],
        );
    }

    return $formas;
}

/**
 * Registra un pago a mano, sin pasar por el servicio de la Task 5: sirve para
 * probar los derivados y la rama de una prefactura cerrada.
 */
function pagoDe(App\Models\FactPrefactura $p, App\Models\FactFormaPago $forma, string $monto): App\Models\FactPrefacturaPago
{
    return $p->pagos()->create([
        'forma_pago_id' => $forma->id,
        'monto' => $monto,
        'user_id' => $p->user_id,
    ]);
}
