<?php
// tests/Feature/Facturacion/ConceptoServicioTest.php

use App\Models\FactPrecioCombustible;
use App\Models\FactServicio;
use App\Models\User;

test('el concepto es unico: dos servicios no pueden ser el combustible', function () {
    FactServicio::create(['nombre' => 'Combustible JET A-1', 'precio_unitario' => 26.064, 'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE]);

    FactServicio::create(['nombre' => 'Otro combustible', 'precio_unitario' => 1, 'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE]);
})->throws(Illuminate\Database\UniqueConstraintViolationException::class);

test('varios servicios pueden no tener concepto', function () {
    FactServicio::create(['nombre' => 'Comisariato', 'precio_unitario' => 100]);
    FactServicio::create(['nombre' => 'Transportacion', 'precio_unitario' => 200]);

    expect(FactServicio::whereNull('concepto')->count())->toBe(2);
});

test('el scope porConcepto encuentra el servicio', function () {
    $combustible = FactServicio::create(['nombre' => 'Combustible JET A-1', 'precio_unitario' => 26.064, 'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE]);
    FactServicio::create(['nombre' => 'Comisariato', 'precio_unitario' => 100]);

    expect(FactServicio::porConcepto(FactServicio::CONCEPTO_COMBUSTIBLE)->sole()->id)->toBe($combustible->id);
});

/*
 * El vinculo del precio de combustible deja de ser el nombre. Esta prueba es la
 * que sustituye a las 16 de NombreServicioCombustibleTest.php: el servicio se
 * puede renombrar y la sincronia lo sigue encontrando (el importador, eso si,
 * le devuelve el nombre del origen en cada corrida).
 */
test('renombrar el servicio de combustible ya no rompe la sincronia', function () {
    $usuario = User::factory()->create();
    $servicio = FactServicio::create([
        'nombre' => 'Combustible JET A-1',
        'precio_unitario' => 21.6122,
        'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE,
    ]);

    $servicio->update(['nombre' => 'Turbosina JET A-1']);

    FactPrecioCombustible::registrar(22.1643, null, $usuario->id);

    expect((float) $servicio->fresh()->precio_unitario)->toBe(26.0639);
});

test('un servicio sin el concepto no lo toca la sincronia aunque se llame igual', function () {
    $usuario = User::factory()->create();
    $impostor = FactServicio::create(['nombre' => 'Combustible JET A-1', 'precio_unitario' => 19250.0]);

    FactPrecioCombustible::registrar(22.1643, null, $usuario->id);

    expect((float) $impostor->fresh()->precio_unitario)->toBe(19250.0);
});

test('el paquete internacional son las cuatro marcadas', function () {
    FactServicio::create(['nombre' => 'DSMES - salida', 'precio_unitario' => 4060.5, 'en_paquete_internacional' => true]);
    FactServicio::create(['nombre' => 'Comisariato', 'precio_unitario' => 100]);

    expect(FactServicio::where('en_paquete_internacional', true)->count())->toBe(1);
});
