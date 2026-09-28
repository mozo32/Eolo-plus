<?php
// tests/Feature/Facturacion/CatalogoAeronavesTest.php

use App\Models\Aeronave;
use App\Models\FactAeronave;
use App\Models\FactCategoriaAeronave;
use App\Models\TipoAeronave;
use App\Services\CatalogoAeronaves;

function catalogo(): CatalogoAeronaves
{
    return app(CatalogoAeronaves::class);
}

test('buscar devuelve los cuatro campos que daba el join remoto', function () {
    $tipo = TipoAeronave::create(['nombre' => 'Learjet 45']);
    $aeronave = Aeronave::create(['matricula' => 'XA-ABC', 'aeronave_id' => $tipo->id]);
    $categoria = FactCategoriaAeronave::create(['nombre' => 'Ejecutiva', 'tarifa_pernocta' => 100, 'tarifa_transito_2h' => 50, 'tarifa_transito_12h' => 80]);
    FactAeronave::create([
        'aeronave_id' => $aeronave->id,
        'categoria_aeronave_id' => $categoria->id,
        'estatus' => 'transito',
    ]);

    $datos = catalogo()->buscar('XA-ABC');

    expect($datos->matricula)->toBe('XA-ABC')
        ->and($datos->tipo)->toBe('Learjet 45')
        ->and($datos->estatus)->toBe('transito')
        ->and($datos->categoria)->toBe('Ejecutiva');
});

test('buscar devuelve null si la matricula no existe', function () {
    expect(catalogo()->buscar('XA-NADA'))->toBeNull();
});

test('buscar funciona con una matricula incompleta, sin tipo ni categoria', function () {
    Aeronave::create(['matricula' => 'XA-DEF']);

    $datos = catalogo()->buscar('XA-DEF');

    expect($datos->tipo)->toBeNull()
        ->and($datos->categoria)->toBeNull()
        ->and($datos->estatus)->toBe('guarda');
});

test('buscar normaliza la matricula a mayusculas y sin espacios', function () {
    Aeronave::create(['matricula' => 'XA-GHI']);

    expect(catalogo()->buscar('  xa-ghi  ')->matricula)->toBe('XA-GHI');
});

test('buscarOCrear crea la matricula con su satelite cuando no existe', function () {
    $aeronave = catalogo()->buscarOCrear('XA-JKL', 'Cessna 208');

    expect(Aeronave::count())->toBe(1)
        ->and($aeronave->matricula)->toBe('XA-JKL')
        ->and($aeronave->tipoAeronave->nombre)->toBe('Cessna 208')
        ->and($aeronave->facturacion)->not->toBeNull()
        ->and($aeronave->facturacion->categoria_aeronave_id)->toBeNull();
});

test('buscarOCrear no duplica: dos llamadas dejan una sola fila', function () {
    $primera = catalogo()->buscarOCrear('XA-MNO', 'Learjet 45');
    $segunda = catalogo()->buscarOCrear('xa-mno', 'Learjet 45');

    expect($primera->id)->toBe($segunda->id)
        ->and(Aeronave::count())->toBe(1)
        ->and(TipoAeronave::count())->toBe(1);
});

test('buscarOCrear reutiliza el tipo si ya existe con ese nombre', function () {
    $tipo = TipoAeronave::create(['nombre' => 'Learjet 45']);

    $aeronave = catalogo()->buscarOCrear('XA-PQR', 'learjet 45');

    expect(TipoAeronave::count())->toBe(1)
        ->and($aeronave->aeronave_id)->toBe($tipo->id);
});

test('buscarOCrear sin tipo deja la aeronave sin tipo y no crea uno vacio', function () {
    $aeronave = catalogo()->buscarOCrear('XA-STU');

    expect($aeronave->aeronave_id)->toBeNull()
        ->and(TipoAeronave::count())->toBe(0);
});

test('buscarOCrear respeta una aeronave existente sin pisarle el tipo', function () {
    $tipo = TipoAeronave::create(['nombre' => 'Original']);
    Aeronave::create(['matricula' => 'XA-VWX', 'aeronave_id' => $tipo->id]);

    $aeronave = catalogo()->buscarOCrear('XA-VWX', 'Otro distinto');

    expect($aeronave->aeronave_id)->toBe($tipo->id)
        ->and(TipoAeronave::count())->toBe(1);
});

test('buscarOCrear le pone satelite a una aeronave vieja que no la tenia', function () {
    $aeronave = Aeronave::create(['matricula' => 'XA-YZA']);

    catalogo()->buscarOCrear('XA-YZA');

    expect($aeronave->fresh()->facturacion)->not->toBeNull();
});

test('autocompletar busca por coincidencia parcial y respeta el limite', function () {
    foreach (['XA-AAA', 'XA-AAB', 'XB-CCC'] as $matricula) {
        Aeronave::create(['matricula' => $matricula]);
    }

    expect(catalogo()->autocompletar('xa-aa'))->toBe(['XA-AAA', 'XA-AAB'])
        ->and(catalogo()->autocompletar('xa-aa', 1))->toBe(['XA-AAA'])
        ->and(catalogo()->autocompletar(''))->toBe([])
        ->and(catalogo()->autocompletar('   '))->toBe([]);
});

test('buscarOCrear sobre una aeronave vieja deja un solo satelite y la segunda llamada no intenta crear otro', function () {
    Aeronave::create(['matricula' => 'XA-BCD']);

    catalogo()->buscarOCrear('XA-BCD');

    // El evento creating salta antes del INSERT, aunque este fallara por el
    // indice unico; QueryExecuted no lo veria.
    $intentos = 0;
    FactAeronave::creating(function () use (&$intentos) {
        $intentos++;
    });

    catalogo()->buscarOCrear('XA-BCD');

    expect($intentos)->toBe(0)
        ->and(FactAeronave::count())->toBe(1);
});
