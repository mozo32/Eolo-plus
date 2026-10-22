<?php

use App\Models\Vehiculo;

/*
 * `activo` es «de alta en la flota», distinto de `estado`, que es dónde está el
 * vehículo. Y la relación movimientos() apuntaba a una clase inexistente: contar
 * movimientos por vehículo es lo que necesita el orden nuevo de la tabla.
 */

it('nace activo: un vehículo nuevo no cambia de comportamiento', function () {
    $vehiculo = vehiculoDePrueba('01-KIA', 'KIA');

    expect($vehiculo->fresh()->activo)->toBeTrue();
});

it('guarda la baja y la vuelve a leer como booleano, no como 0', function () {
    $vehiculo = vehiculoDePrueba('EP-16', 'URVAN');

    $vehiculo->update(['activo' => false]);

    expect($vehiculo->fresh()->activo)->toBeFalse();
});

it('cuenta los movimientos de cada vehículo con withCount', function () {
    vehiculoDePrueba('01-KIA', 'KIA');
    vehiculoDePrueba('IKON', 'IKON');
    movimientosDePrueba('01-KIA', 7);
    movimientosDePrueba('IKON', 2);

    $cuentas = Vehiculo::withCount('movimientos')
        ->pluck('movimientos_count', 'id')
        ->all();

    expect($cuentas)->toBe(['01-KIA' => 7, 'IKON' => 2]);
});

it('devuelve los movimientos del más nuevo al más viejo', function () {
    vehiculoDePrueba('TC-84', 'SUBURBAN');
    movimientosDePrueba('TC-84', 3);

    // Se asegura sobre el kilometraje (1000 + i), que es distinto en cada fila.
    // Sobre `tipo` no serviría: la secuencia Salida/Entrada/Salida es un
    // palíndromo y se lee igual del derecho que del revés, así que la prueba
    // pasaría también sin el orden, o con el orden al revés.
    $kilometrajes = Vehiculo::find('TC-84')->movimientos->pluck('kilometraje')->all();

    expect($kilometrajes)->toBe([1003, 1002, 1001]);
});
