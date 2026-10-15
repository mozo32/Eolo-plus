<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * El comando es de SOLO LECTURA sobre `remota`. Aquí se le da una sqlite en memoria
 * con cuatro folios de forma conocida y se comprueba que cuenta bien los aciertos.
 */
function prepararLegacyEstancia(array $llegadas, array $ventas): void
{
    config(['database.connections.remota' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
    DB::purge('remota');

    $esquema = Schema::connection('remota');

    $esquema->create('tb_llegadas', function ($t) {
        $t->integer('id_llegada', true);
        $t->integer('fol_prefactura');
        $t->dateTime('Fecha_lleg')->nullable();
        $t->dateTime('Fecha_sal')->nullable();
    });
    $esquema->create('tb_venta', function ($t) {
        $t->integer('id_venta', true);
        $t->integer('fol_prefactura');
        $t->integer('id_servicio');
        $t->integer('cantidad');
    });

    DB::connection('remota')->table('tb_llegadas')->insert($llegadas);
    DB::connection('remota')->table('tb_venta')->insert($ventas);
}

test('cuenta como acierto el folio cuyas cantidades coinciden con la regla', function () {
    prepararLegacyEstancia(
        [['fol_prefactura' => 100, 'Fecha_lleg' => '2026-10-15 12:00:00', 'Fecha_sal' => '2026-10-22 12:00:00']],
        [['fol_prefactura' => 100, 'id_servicio' => 4, 'cantidad' => 7]],
    );

    $this->artisan('facturacion:comparar-estancia')
        ->expectsOutputToContain('Folios comparados: 1')
        ->expectsOutputToContain('La regla acierta en: 1  (100.0%)')
        ->expectsOutputToContain('Falla en:            0')
        ->assertSuccessful();
});

test('cuenta como fallo el folio cuyas cantidades no coinciden, y dice el patron', function () {
    prepararLegacyEstancia(
        [['fol_prefactura' => 101, 'Fecha_lleg' => '2026-10-15 12:00:00', 'Fecha_sal' => '2026-10-22 12:00:00']],
        [['fol_prefactura' => 101, 'id_servicio' => 4, 'cantidad' => 1]],
    );

    $this->artisan('facturacion:comparar-estancia')
        ->expectsOutputToContain('La regla acierta en: 0  (0.0%)')
        ->expectsOutputToContain('Falla en:            1')
        ->expectsOutputToContain('pred 7/0/0 vs real 1/0/0')
        ->assertSuccessful();
});

test('las fechas inservibles se cuentan aparte y no como fallo', function () {
    prepararLegacyEstancia(
        [
            ['fol_prefactura' => 102, 'Fecha_lleg' => '2026-10-22 12:00:00', 'Fecha_sal' => '2026-10-15 12:00:00'],
            ['fol_prefactura' => 103, 'Fecha_lleg' => '2026-10-15 12:00:00', 'Fecha_sal' => null],
        ],
        [
            ['fol_prefactura' => 102, 'id_servicio' => 4, 'cantidad' => 1],
            ['fol_prefactura' => 103, 'id_servicio' => 4, 'cantidad' => 1],
        ],
    );

    $this->artisan('facturacion:comparar-estancia')
        ->expectsOutputToContain('Folios comparados: 0')
        ->expectsOutputToContain('Con fechas inservibles: 2')
        ->assertSuccessful();
});

test('el folio sin renglones de estancia no entra en la comparacion', function () {
    prepararLegacyEstancia(
        [['fol_prefactura' => 104, 'Fecha_lleg' => '2026-10-15 12:00:00', 'Fecha_sal' => '2026-10-22 12:00:00']],
        [['fol_prefactura' => 104, 'id_servicio' => 7, 'cantidad' => 1]],
    );

    $this->artisan('facturacion:comparar-estancia')
        ->expectsOutputToContain('Folios comparados: 0')
        ->assertSuccessful();
});

test('una fecha cero en la llegada o en la salida es inservible, no un fallo', function (string $llegada, string $salida) {
    prepararLegacyEstancia(
        [['fol_prefactura' => 106, 'Fecha_lleg' => $llegada, 'Fecha_sal' => $salida]],
        [['fol_prefactura' => 106, 'id_servicio' => 4, 'cantidad' => 1]],
    );

    $this->artisan('facturacion:comparar-estancia')
        ->expectsOutputToContain('Folios comparados: 0')
        ->expectsOutputToContain('Falla en:            0')
        ->expectsOutputToContain('Con fechas inservibles: 1')
        ->assertSuccessful();
})->with([
    'llegada en cero' => ['0000-00-00 00:00:00', '2026-10-22 12:00:00'],
    'salida en cero' => ['2026-10-15 12:00:00', '0000-00-00 00:00:00'],
]);

test('toda sentencia que el comando emite, en cualquier conexion, es una lectura', function () {
    prepararLegacyEstancia(
        [['fol_prefactura' => 105, 'Fecha_lleg' => '2026-10-15 12:00:00', 'Fecha_sal' => '2026-10-22 12:00:00']],
        [['fol_prefactura' => 105, 'id_servicio' => 4, 'cantidad' => 7]],
    );

    $sentencias = [];
    DB::listen(function ($consulta) use (&$sentencias) {
        $sentencias[] = [$consulta->connectionName, $consulta->sql];
    });

    $this->artisan('facturacion:comparar-estancia')->assertSuccessful();

    expect($sentencias)->not->toBeEmpty();
    foreach ($sentencias as [$conexion, $sql]) {
        expect($conexion)->toBe('remota')
            ->and(ltrim($sql))->toStartWith('select');
    }
});

test('el comando NO escribe en la conexion remota', function () {
    prepararLegacyEstancia(
        [['fol_prefactura' => 105, 'Fecha_lleg' => '2026-10-15 12:00:00', 'Fecha_sal' => '2026-10-22 12:00:00']],
        [['fol_prefactura' => 105, 'id_servicio' => 4, 'cantidad' => 7]],
    );

    $antes = DB::connection('remota')->table('tb_venta')->count();
    $this->artisan('facturacion:comparar-estancia')->assertSuccessful();

    expect(DB::connection('remota')->table('tb_venta')->count())->toBe($antes)
        ->and(DB::connection('remota')->table('tb_llegadas')->count())->toBe(1);
});
