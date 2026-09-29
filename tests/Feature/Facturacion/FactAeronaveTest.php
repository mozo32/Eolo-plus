<?php
// tests/Feature/Facturacion/FactAeronaveTest.php

use App\Models\Aeronave;
use App\Models\FactAeronave;
use App\Models\FactCategoriaAeronave;
use App\Models\FactTipoMotor;
use App\Models\TipoAeronave;

test('una aeronave puede existir sin tipo, como las altas automaticas', function () {
    $aeronave = Aeronave::create(['matricula' => 'XA-ABC']);

    expect($aeronave->fresh()->aeronave_id)->toBeNull();
});

test('la relacion tipoAeronave usa la columna aeronave_id', function () {
    $tipo = TipoAeronave::create(['nombre' => 'Learjet 45']);
    $aeronave = Aeronave::create(['matricula' => 'XA-DEF', 'aeronave_id' => $tipo->id]);

    expect($aeronave->fresh()->tipoAeronave->nombre)->toBe('Learjet 45')
        ->and($tipo->fresh()->aeronaves->pluck('matricula')->all())->toBe(['XA-DEF']);
});

test('la satelite cuelga de la aeronave y guarda sus atributos de cobro', function () {
    $aeronave = Aeronave::create(['matricula' => 'XA-GHI']);
    $categoria = FactCategoriaAeronave::create(['nombre' => 'Ejecutiva', 'tarifa_pernocta' => 100, 'tarifa_transito_2h' => 50, 'tarifa_transito_12h' => 80]);
    $motor = FactTipoMotor::create(['nombre' => 'Jet', 'tarifa_aterrizaje' => 900]);

    FactAeronave::create([
        'aeronave_id' => $aeronave->id,
        'categoria_aeronave_id' => $categoria->id,
        'tipo_motor_id' => $motor->id,
    ]);

    $facturacion = $aeronave->fresh()->facturacion;

    expect($facturacion->estatus)->toBe('transito')
        ->and($facturacion->cobra_derecho_vuelos)->toBeTrue()
        ->and($facturacion->categoria->nombre)->toBe('Ejecutiva')
        ->and($facturacion->tipoMotor->nombre)->toBe('Jet');
});

test('una matricula incompleta se guarda sin categoria ni motor', function () {
    $aeronave = Aeronave::create(['matricula' => 'XA-JKL']);

    $facturacion = FactAeronave::create(['aeronave_id' => $aeronave->id]);

    expect($facturacion->fresh()->categoria_aeronave_id)->toBeNull()
        ->and($facturacion->fresh()->tipo_motor_id)->toBeNull();
});

test('una aeronave no puede tener dos filas de facturacion', function () {
    $aeronave = Aeronave::create(['matricula' => 'XA-MNO']);
    FactAeronave::create(['aeronave_id' => $aeronave->id]);

    expect(fn () => FactAeronave::create(['aeronave_id' => $aeronave->id]))
        ->toThrow(Illuminate\Database\UniqueConstraintViolationException::class);
});

test('borrar la aeronave arrastra su fila de facturacion', function () {
    $aeronave = Aeronave::create(['matricula' => 'XA-PQR']);
    FactAeronave::create(['aeronave_id' => $aeronave->id]);

    $aeronave->delete();

    expect(FactAeronave::count())->toBe(0);
});
