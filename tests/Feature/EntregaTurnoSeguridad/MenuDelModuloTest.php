<?php

use App\Models\Departamento;
use App\Models\SubDepartamento;
use Database\Seeders\EntregaTurnoSeguridadSubdepartamentoSeeder;
use Illuminate\Support\Str;

/*
 * El menú en sí NO se puede probar desde aquí: lo arma `navigation.ts` en el
 * navegador y el proyecto no tiene corredor de pruebas de JavaScript. Lo que
 * sí se puede fijar es la mitad del contrato que vive en PHP: que el seeder
 * cree el subdepartamento y que su nombre slugifique EXACTAMENTE a la llave
 * de ROUTE_CONFIG. Un renombre del subdepartamento apaga el renglón del menú
 * en silencio para todos los que no son administradores, y el rol `fbo` —el
 * que cierra el relevo con su firma— está entre ellos.
 */

test('el seeder crea el subdepartamento dentro de Seguridad', function () {
    (new EntregaTurnoSeguridadSubdepartamentoSeeder)->run();

    $departamento = Departamento::where('nombre', 'Seguridad')->sole();
    $sub = SubDepartamento::where('nombre', 'entregaTurnoSeguridad')->sole();

    expect($sub->departamento_id)->toBe($departamento->id)
        ->and($sub->status)->toBe('A');
});

test('el nombre del subdepartamento slugifica a la llave de ROUTE_CONFIG', function () {
    // `HandleInertiaRequests` publica `route` como
    // `Str::slug(departamento).'.'.Str::slug(subdepartamento)`, y
    // `navigation.ts` se queda con el último trozo para buscarlo en
    // ROUTE_CONFIG. Si este valor cambia, hay que cambiar el mapa.
    expect(Str::slug('entregaTurnoSeguridad'))->toBe('entregaturnoseguridad');
});

test('correrlo dos veces no duplica el renglón', function () {
    (new EntregaTurnoSeguridadSubdepartamentoSeeder)->run();
    (new EntregaTurnoSeguridadSubdepartamentoSeeder)->run();

    expect(Departamento::where('nombre', 'Seguridad')->count())->toBe(1)
        ->and(SubDepartamento::where('nombre', 'entregaTurnoSeguridad')->count())->toBe(1);
});
