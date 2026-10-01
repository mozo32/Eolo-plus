<?php
// tests/Feature/Facturacion/CompararPrefacturasTest.php

use Illuminate\Support\Facades\DB;

/*
 * `TestCase` apunta la conexión `remota` a un destino inválido para que ninguna
 * prueba pueda escribir en la base real del sistema viejo. Aquí se reemplaza por
 * sqlite en memoria, y hace falta `DB::purge` porque si no Laravel devuelve la
 * conexión ya resuelta con la configuración inválida.
 */
beforeEach(function () {
    config(['database.connections.remota' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
    DB::purge('remota');

    $esquema = DB::connection('remota')->getSchemaBuilder();

    $esquema->create('tb_hprefactura', function ($t) {
        $t->integer('id_prefactura', true);
        $t->integer('fol_prefactura');
        $t->decimal('subtotal', 18, 2);
        $t->float('iva');
        $t->decimal('Total', 18, 2);
    });

    $esquema->create('tb_venta', function ($t) {
        $t->integer('id_venta', true);
        $t->integer('fol_prefactura');
        $t->integer('id_servicio');
        $t->float('precio_u');
        $t->decimal('importe', 18, 2);
        $t->integer('cantidad');
    });
});

function legacyPref(int $folio, float $subtotal, float $iva, float $total): void
{
    DB::connection('remota')->table('tb_hprefactura')->insert([
        'fol_prefactura' => $folio, 'subtotal' => $subtotal, 'iva' => $iva, 'Total' => $total,
    ]);
}

function legacyVenta(int $folio, float $precio, int $cantidad, float $importe): void
{
    DB::connection('remota')->table('tb_venta')->insert([
        'fol_prefactura' => $folio, 'id_servicio' => 50, 'precio_u' => $precio, 'cantidad' => $cantidad, 'importe' => $importe,
    ]);
}

test('una prefactura que cuadra sale como identica', function () {
    legacyPref(1, 2000.00, 320.00, 2320.00);
    legacyVenta(1, 1000.00, 2, 2000.00);

    $this->artisan('facturacion:comparar-prefacturas')
        ->expectsOutputToContain('Idénticas: 1')
        ->assertExitCode(0);
});

test('una diferencia de centavos se clasifica como redondeo, no como defecto', function () {
    legacyPref(1, 24342.40, 3894.79, 28237.24);
    legacyVenta(1, 8114.15, 3, 24342.45);

    $this->artisan('facturacion:comparar-prefacturas')
        ->expectsOutputToContain('Redondeo: 1')
        ->assertExitCode(0);
});

test('un total que no corresponde a sus renglones se enumera como estructural', function () {
    legacyPref(2622, 33744.00, 5399.04, 39143.04);
    legacyVenta(2622, 4744.00, 1, 4744.00);

    $this->artisan('facturacion:comparar-prefacturas')
        ->expectsOutputToContain('Estructurales: 1')
        ->expectsOutputToContain('2622')
        ->assertExitCode(0);
});

test('los folios duplicados se excluyen y se reportan aparte', function () {
    legacyPref(3922, 100.00, 16.00, 116.00);
    legacyPref(3922, 100.00, 16.00, 116.00);
    legacyVenta(3922, 100.00, 1, 100.00);

    $this->artisan('facturacion:comparar-prefacturas')
        ->expectsOutputToContain('Folios duplicados en el origen: 1')
        ->expectsOutputToContain('Comparadas: 0')
        ->assertExitCode(0);
});

test('los renglones de un folio duplicado no contaminan a las demas prefacturas', function () {
    // El folio 7 está repetido y tiene un renglón enorme; el folio 8 no se toca.
    legacyPref(7, 100.00, 16.00, 116.00);
    legacyPref(7, 100.00, 16.00, 116.00);
    legacyVenta(7, 999999.00, 1, 999999.00);
    legacyPref(8, 100.00, 16.00, 116.00);
    legacyVenta(8, 100.00, 1, 100.00);

    $this->artisan('facturacion:comparar-prefacturas')
        ->expectsOutputToContain('Comparadas: 1')
        ->expectsOutputToContain('Idénticas: 1')
        ->expectsOutputToContain('Estructurales: 0')
        ->assertExitCode(0);
});

test('los limites de tolerancia se respetan al centavo exacto', function () {
    // 0.02 de diferencia es todavía idéntica; 0.03 ya es redondeo; 1.00 es
    // redondeo; 1.01 es estructural. Con floats, los bordes caerían del lado
    // equivocado según el signo del error binario.
    legacyPref(1, 100.02, 0, 0);
    legacyVenta(1, 100.00, 1, 100.00);
    legacyPref(2, 100.03, 0, 0);
    legacyVenta(2, 100.00, 1, 100.00);
    legacyPref(3, 101.00, 0, 0);
    legacyVenta(3, 100.00, 1, 100.00);
    legacyPref(4, 101.01, 0, 0);
    legacyVenta(4, 100.00, 1, 100.00);

    $this->artisan('facturacion:comparar-prefacturas')
        ->expectsOutputToContain('Idénticas: 1')
        ->expectsOutputToContain('Redondeo: 2')
        ->expectsOutputToContain('Estructurales: 1')
        ->assertExitCode(0);
});

test('un renglon cuyo importe guardado no cuadra con su precio por cantidad se reporta aparte', function () {
    // El encabezado cuadra con la aritmética de sus renglones, pero el importe
    // guardado del renglón (500.00) no es su propio 100.00 × 2. Son dos
    // diagnósticos distintos y no se mezclan en una sola clase.
    legacyPref(5, 200.00, 32.00, 232.00);
    legacyVenta(5, 100.00, 2, 500.00);
    legacyPref(6, 300.00, 48.00, 348.00);
    legacyVenta(6, 150.00, 2, 300.00);

    $this->artisan('facturacion:comparar-prefacturas')
        ->expectsOutputToContain('Idénticas: 2')
        ->expectsOutputToContain('Renglones revisados: 2')
        ->expectsOutputToContain('Renglones cuyo importe guardado no cuadra: 1')
        ->assertExitCode(0);
});

test('la salida dice lo que prueba y lo que no', function () {
    legacyPref(1, 2000.00, 320.00, 2320.00);
    legacyVenta(1, 1000.00, 2, 2000.00);

    $this->artisan('facturacion:comparar-prefacturas')
        ->expectsOutputToContain('NO prueba el extremo a extremo')
        ->assertExitCode(0);
});

test('el comando no escribe nada en la base local', function () {
    legacyPref(1, 2000.00, 320.00, 2320.00);
    legacyVenta(1, 1000.00, 2, 2000.00);

    $this->artisan('facturacion:comparar-prefacturas')->assertExitCode(0);

    expect(App\Models\FactPrefactura::count())->toBe(0);
});

test('el comando no escribe nada en la base legada', function () {
    legacyPref(1, 2000.00, 320.00, 2320.00);
    legacyVenta(1, 1000.00, 2, 2000.00);

    $this->artisan('facturacion:comparar-prefacturas')->assertExitCode(0);

    expect(DB::connection('remota')->table('tb_hprefactura')->count())->toBe(1)
        ->and(DB::connection('remota')->table('tb_venta')->count())->toBe(1);
});

test('toda sentencia que el comando emite, en cualquier conexion, es una lectura', function () {
    legacyPref(1, 2000.00, 320.00, 2320.00);
    legacyVenta(1, 1000.00, 2, 2000.00);
    legacyPref(2, 10.00, 1.60, 11.60);
    legacyPref(2, 10.00, 1.60, 11.60);
    legacyPref(3, 5.00, 0.80, 5.80);
    legacyVenta(3, 9.00, 1, 3.00);

    $sentencias = [];
    DB::listen(function ($consulta) use (&$sentencias) {
        $sentencias[] = [$consulta->connectionName, $consulta->sql];
    });

    $this->artisan('facturacion:comparar-prefacturas')->assertExitCode(0);

    expect($sentencias)->not->toBeEmpty();
    foreach ($sentencias as [$conexion, $sql]) {
        expect($conexion)->toBe('remota')
            ->and(ltrim($sql))->toStartWith('select');
    }
});

test('las estructurales se separan por motivo: registro incompleto contra aritmetica que no cuadra', function () {
    legacyPref(10, 500.00, 80.00, 580.00);                     // dinero y ningún renglón
    legacyPref(11, 0.00, 0.00, 0.00);                          // subtotal en cero con renglones
    legacyVenta(11, 300.00, 1, 300.00);
    legacyPref(12, 900.00, 144.00, 1044.00);                   // ambos, y no cuadran
    legacyVenta(12, 100.00, 1, 100.00);

    $this->artisan('facturacion:comparar-prefacturas')
        ->expectsOutputToContain('Estructurales: 3')
        ->expectsOutputToContain('de ellas, subtotal y renglones que no cuadran: 1')
        ->expectsOutputToContain('de ellas, subtotal guardado en cero: 1')
        ->expectsOutputToContain('de ellas, sin renglones: 1')
        ->assertExitCode(0);
});

test('un renglon que difiere un solo centavo cuenta, separado de los que son dinero', function () {
    legacyPref(1, 100.00, 16.00, 116.00);
    legacyVenta(1, 100.00, 1, 100.01);   // un centavo
    legacyPref(2, 100.00, 16.00, 116.00);
    legacyVenta(2, 100.00, 1, 105.00);   // cinco pesos

    $this->artisan('facturacion:comparar-prefacturas')
        ->expectsOutputToContain('Renglones cuyo importe guardado no cuadra: 2')
        ->expectsOutputToContain('por más de 2 centavos: 1')
        ->expectsOutputToContain('por 2 centavos o menos (redondeo del float del origen): 1')
        ->assertExitCode(0);
});
