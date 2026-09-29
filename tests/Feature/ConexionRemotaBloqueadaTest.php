<?php

use Illuminate\Support\Facades\DB;

/*
 * La conexión `remota` apunta en .env a una MySQL real. Las pruebas la
 * redirigen a un destino inexistente para que ningún código pueda escribir ahí
 * sin que la suite lo note.
 */

test('usar la conexion remota en una prueba revienta en lugar de tocar la base real', function () {
    expect(fn () => DB::connection('remota')->table('tb_matricula')->count())
        ->toThrow(Exception::class);

    expect(fn () => DB::connection('remota')->table('tb_matricula')->insert(['matricula' => 'XA-FUGA']))
        ->toThrow(Exception::class);
});

test('una prueba concreta puede sobrescribir la conexion remota con config', function () {
    config(['database.connections.remota' => [
        'driver' => 'sqlite',
        'database' => ':memory:',
        'prefix' => '',
    ]]);
    DB::purge('remota');

    DB::connection('remota')->getSchemaBuilder()->create('tb_prueba', fn ($t) => $t->id());

    expect(DB::connection('remota')->table('tb_prueba')->count())->toBe(0);
});
