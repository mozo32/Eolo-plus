<?php
// tests/Feature/Facturacion/SincronizaPrecioCombustibleTest.php

use App\Models\Bitacora;
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
        'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE,
        'precio_unitario' => 21.6122,
    ]);

    FactPrecioCombustible::registrar(22.1643, null, $usuario->id);

    // (22.1643 + 0.50) * 1.15 = 26.0639
    expect((float) $servicio->fresh()->precio_unitario)->toBe(26.0639);
});

test('el servicio sigue el precio Eolo sobrescrito, no el calculado', function () {
    $usuario = User::factory()->create();
    $servicio = FactServicio::create(['nombre' => 'Combustible JET A-1', 'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE, 'precio_unitario' => 0]);

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
        'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE,
        'precio_unitario' => 21.6122,
        'status' => 'N',
    ]);

    FactPrecioCombustible::registrar(22.1643, null, $usuario->id);

    expect((float) $servicio->fresh()->precio_unitario)->toBe(21.6122);
});

test('solo cambia el servicio de combustible: los demás servicios activos conservan su precio', function () {
    $usuario = User::factory()->create();
    FactServicio::create(['nombre' => 'Combustible JET A-1', 'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE, 'precio_unitario' => 21.6122]);
    $otro = FactServicio::create(['nombre' => 'Hangaraje', 'precio_unitario' => 1500.0000]);
    $parecido = FactServicio::create(['nombre' => 'Combustible JET A-1 Plus', 'precio_unitario' => 99.0000]);

    FactPrecioCombustible::registrar(22.1643, null, $usuario->id);

    // Un update sin el `where` por concepto cambiaría el cobro de todo el catálogo.
    expect((float) $otro->fresh()->precio_unitario)->toBe(1500.0000)
        ->and((float) $parecido->fresh()->precio_unitario)->toBe(99.0000);
});

test('la sincronía deja rastro en la bitácora con el precio anterior y el nuevo', function () {
    $usuario = User::factory()->create();
    $servicio = FactServicio::create(['nombre' => 'Combustible JET A-1', 'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE, 'precio_unitario' => 21.6122]);

    FactPrecioCombustible::registrar(22.1643, null, $usuario->id);

    $entrada = Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_CATALOGOS)
        ->where('accion', Bitacora::ACCION_ACTUALIZAR)
        ->where('registro_id', $servicio->id)
        ->first();

    expect($entrada)->not->toBeNull()
        ->and($entrada->usuario_id)->toBe($usuario->id)
        ->and($entrada->descripcion)->toContain('Combustible JET A-1')
        ->and((float) $entrada->datos_anteriores['precio_unitario'])->toBe(21.6122)
        ->and((float) $entrada->datos_nuevos['precio_unitario'])->toBe(26.0639);
});

test('sin cambio real de precio, o sin servicio, la sincronía no escribe en la bitácora', function () {
    $usuario = User::factory()->create();

    // Sin servicio de combustible.
    FactPrecioCombustible::registrar(22.1643, null, $usuario->id);

    // Con el servicio ya en el precio que saldrá.
    FactServicio::create(['nombre' => 'Combustible JET A-1', 'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE, 'precio_unitario' => 26.0639]);
    FactPrecioCombustible::registrar(22.1643, null, $usuario->id);

    expect(Bitacora::where('accion', Bitacora::ACCION_ACTUALIZAR)->count())->toBe(0);
});

/*
 * Atomicidad: el precio nuevo, la sincronía y su rastro en la bitácora son una
 * sola unidad. Lo protege el closure de `DB::transaction` en
 * `FactPrecioCombustible::registrar()`, donde la sincronía va después del
 * `create` y antes del `return`.
 *
 * Esta prueba cubre lo que SÍ se puede demostrar en sqlite: que un fallo al
 * escribir la bitácora, que ocurre después del update, deshace también el
 * precio nuevo y el cierre del anterior. Si la sincronía se sacara de la
 * transacción, el precio quedaría registrado con la sincronía a medias y esta
 * prueba fallaría (comprobado por mutación).
 *
 * NO cubre la variante de mover SOLO el `update` fuera del closure dejando la
 * bitácora dentro: sqlite no ofrece un fallo que caiga entre el create y el
 * update sin tocar el código de producción, así que esa mutación no se puede
 * atrapar con una prueba honesta aquí.
 */
test('si falla el rastro en la bitácora, se deshace todo: el precio nuevo y la sincronía', function () {
    $usuario = User::factory()->create();
    $servicio = FactServicio::create(['nombre' => 'Combustible JET A-1', 'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE, 'precio_unitario' => 21.6122]);
    $anterior = FactPrecioCombustible::registrar(20.0000, null, $usuario->id);
    $precioServicio = (float) $servicio->fresh()->precio_unitario;

    Bitacora::creating(fn () => throw new RuntimeException('falla simulada de bitácora'));

    try {
        expect(fn () => FactPrecioCombustible::registrar(22.1643, null, $usuario->id))
            ->toThrow(RuntimeException::class);
    } finally {
        Bitacora::flushEventListeners();
    }

    expect(FactPrecioCombustible::count())->toBe(1)
        ->and(FactPrecioCombustible::vigente()->id)->toBe($anterior->id)
        ->and((float) $servicio->fresh()->precio_unitario)->toBe($precioServicio);
});
