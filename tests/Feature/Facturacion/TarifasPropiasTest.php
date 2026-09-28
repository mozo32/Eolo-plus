<?php
// tests/Feature/Facturacion/TarifasPropiasTest.php

use App\Models\Aeronave;
use App\Models\FactAeronave;
use App\Models\FactCategoriaAeronave;
use App\Models\FactTipoMotor;

/*
 * El 94.6% de las matrículas cobra la tarifa de su categoría, pero 41 de 763
 * tienen la suya propia en el sistema viejo. La categoría es el valor por
 * omisión; la matrícula puede sobreescribirlo para que ningún cobro cambie.
 */

function aeronaveConTarifas(array $propias = []): FactAeronave
{
    $aeronave = Aeronave::create(['matricula' => 'XA-'.substr(md5(uniqid()), 0, 3)]);

    $categoria = FactCategoriaAeronave::create([
        'nombre' => 'III-'.uniqid(),
        'tarifa_pernocta' => 4676,
        'tarifa_transito_2h' => 1615,
        'tarifa_transito_12h' => 2338,
    ]);

    $motor = FactTipoMotor::create([
        'nombre' => 'Turboreactor-'.uniqid(),
        'tarifa_aterrizaje' => 900,
    ]);

    return FactAeronave::create(array_merge([
        'aeronave_id' => $aeronave->id,
        'categoria_aeronave_id' => $categoria->id,
        'tipo_motor_id' => $motor->id,
    ], $propias));
}

test('sin tarifas propias se cobran las de la categoria y el motor', function () {
    $facturacion = aeronaveConTarifas();

    expect((float) $facturacion->tarifaPernocta())->toBe(4676.00)
        ->and((float) $facturacion->tarifaTransito2h())->toBe(1615.00)
        ->and((float) $facturacion->tarifaTransito12h())->toBe(2338.00)
        ->and((float) $facturacion->tarifaAterrizaje())->toBe(900.00);
});

test('la tarifa propia gana sobre la de la categoria', function () {
    // Caso real: una de las cinco excepciones de la categoría III.
    $facturacion = aeronaveConTarifas([
        'tarifa_pernocta' => 3700,
        'tarifa_transito_2h' => 1233,
        'tarifa_transito_12h' => 1850,
    ]);

    expect((float) $facturacion->tarifaPernocta())->toBe(3700.00)
        ->and((float) $facturacion->tarifaTransito2h())->toBe(1233.00)
        ->and((float) $facturacion->tarifaTransito12h())->toBe(1850.00)
        // El aterrizaje no se sobreescribió: sigue el del motor.
        ->and((float) $facturacion->tarifaAterrizaje())->toBe(900.00);
});

test('se puede sobreescribir solo una tarifa y heredar las demas', function () {
    $facturacion = aeronaveConTarifas(['tarifa_transito_2h' => 1144.50]);

    expect((float) $facturacion->tarifaTransito2h())->toBe(1144.50)
        ->and((float) $facturacion->tarifaPernocta())->toBe(4676.00);
});

test('la tarifa propia de aterrizaje gana sobre la del motor', function () {
    $facturacion = aeronaveConTarifas(['tarifa_aterrizaje' => 1250.75]);

    expect((float) $facturacion->tarifaAterrizaje())->toBe(1250.75);
});

test('una tarifa propia en cero se respeta y no se confunde con ausente', function () {
    // Cortesía: cero es un precio válido, distinto de "hereda la categoría".
    $facturacion = aeronaveConTarifas(['tarifa_pernocta' => 0]);

    expect((float) $facturacion->tarifaPernocta())->toBe(0.00);
});

test('una matricula sin clasificar no tiene tarifa y no revienta', function () {
    // Las 56 matrículas con id_categoria = 0 del sistema viejo.
    $aeronave = Aeronave::create(['matricula' => 'XA-SIN']);
    $facturacion = FactAeronave::create(['aeronave_id' => $aeronave->id]);

    expect($facturacion->tarifaPernocta())->toBeNull()
        ->and($facturacion->tarifaAterrizaje())->toBeNull();
});
