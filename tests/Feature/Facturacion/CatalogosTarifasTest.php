<?php
// tests/Feature/Facturacion/CatalogosTarifasTest.php

use App\Models\FactCategoriaAeronave;
use App\Models\FactTipoMotor;

test('la categoria guarda sus tres tarifas con dos decimales', function () {
    $categoria = FactCategoriaAeronave::create([
        'nombre' => 'Ejecutiva',
        'tarifa_pernocta' => 1250.50,
        'tarifa_transito_2h' => 300,
        'tarifa_transito_12h' => 700.25,
    ]);

    $guardada = $categoria->fresh();

    expect($guardada->status)->toBe('A')
        ->and((float) $guardada->tarifa_pernocta)->toBe(1250.50)
        ->and((float) $guardada->tarifa_transito_12h)->toBe(700.25);
});

test('el tipo de motor guarda su tarifa de aterrizaje', function () {
    $motor = FactTipoMotor::create(['nombre' => 'Turbohelice', 'tarifa_aterrizaje' => 980.75]);

    expect((float) $motor->fresh()->tarifa_aterrizaje)->toBe(980.75)
        ->and($motor->fresh()->status)->toBe('A');
});

test('el scope activas excluye las dadas de baja', function () {
    FactCategoriaAeronave::create(['nombre' => 'Viva', 'tarifa_pernocta' => 1, 'tarifa_transito_2h' => 1, 'tarifa_transito_12h' => 1]);
    FactCategoriaAeronave::create(['nombre' => 'Baja', 'tarifa_pernocta' => 1, 'tarifa_transito_2h' => 1, 'tarifa_transito_12h' => 1, 'status' => 'N']);
    FactTipoMotor::create(['nombre' => 'Motor vivo', 'tarifa_aterrizaje' => 1]);
    FactTipoMotor::create(['nombre' => 'Motor baja', 'tarifa_aterrizaje' => 1, 'status' => 'N']);

    expect(FactCategoriaAeronave::activas()->pluck('nombre')->all())->toBe(['Viva'])
        ->and(FactTipoMotor::activas()->pluck('nombre')->all())->toBe(['Motor vivo']);
});

test('el nombre de la categoria y del motor son unicos', function () {
    FactCategoriaAeronave::create(['nombre' => 'Repetida', 'tarifa_pernocta' => 1, 'tarifa_transito_2h' => 1, 'tarifa_transito_12h' => 1]);

    expect(fn () => FactCategoriaAeronave::create(['nombre' => 'Repetida', 'tarifa_pernocta' => 2, 'tarifa_transito_2h' => 2, 'tarifa_transito_12h' => 2]))
        ->toThrow(Illuminate\Database\UniqueConstraintViolationException::class);
});
