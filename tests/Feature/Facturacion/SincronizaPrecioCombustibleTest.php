<?php
// tests/Feature/Facturacion/SincronizaPrecioCombustibleTest.php

use App\Models\FactPrecioCombustible;
use App\Models\FactServicio;
use App\Models\User;

/*
 * `actualizar_combustible.php` del sistema viejo no solo actualiza el precio:
 * también sincroniza el precio del servicio de combustible con el precio Eolo
 * recién calculado. Sin esto, el combustible se seguiría cobrando al precio
 * viejo aunque la pantalla mostrara el nuevo.
 */

test('registrar un precio nuevo actualiza el servicio de combustible', function () {
    $usuario = User::factory()->create();
    $servicio = FactServicio::create([
        'nombre' => 'Combustible JET A-1',
        'precio_unitario' => 21.6122,
    ]);

    FactPrecioCombustible::registrar(22.1643, null, $usuario->id);

    // (22.1643 + 0.50) * 1.15 = 26.0639
    expect((float) $servicio->fresh()->precio_unitario)->toBe(26.0639);
});

test('el servicio sigue el precio Eolo sobrescrito, no el calculado', function () {
    $usuario = User::factory()->create();
    $servicio = FactServicio::create(['nombre' => 'Combustible JET A-1', 'precio_unitario' => 0]);

    FactPrecioCombustible::registrar(22.1643, 30.0000, $usuario->id);

    expect((float) $servicio->fresh()->precio_unitario)->toBe(30.0000);
});

test('sin el servicio de combustible, registrar un precio no revienta', function () {
    $usuario = User::factory()->create();

    $precio = FactPrecioCombustible::registrar(22.1643, null, $usuario->id);

    expect($precio->id)->toBeInt()
        ->and(FactServicio::count())->toBe(0);
});

test('un servicio de combustible dado de baja no se toca', function () {
    $usuario = User::factory()->create();
    $servicio = FactServicio::create([
        'nombre' => 'Combustible JET A-1',
        'precio_unitario' => 21.6122,
        'status' => 'N',
    ]);

    FactPrecioCombustible::registrar(22.1643, null, $usuario->id);

    expect((float) $servicio->fresh()->precio_unitario)->toBe(21.6122);
});
