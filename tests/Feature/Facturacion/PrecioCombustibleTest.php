<?php
// tests/Feature/Facturacion/PrecioCombustibleTest.php

use App\Models\FactConfiguracion;
use App\Models\FactPrecioCombustible;
use App\Models\User;

test('el primer precio queda vigente y sin fecha de cierre', function () {
    $usuario = User::factory()->create();

    $precio = FactPrecioCombustible::registrar(22.50, null, $usuario->id);

    expect($precio->vigencia_fin)->toBeNull()
        ->and((float) $precio->precio_asa)->toBe(22.50)
        ->and(FactPrecioCombustible::vigente()->id)->toBe($precio->id);
});

test('el precio Eolo se sugiere con la formula del sistema viejo', function () {
    // actualizar_combustible.php: $peolo = ($pasa + 0.50) * 1.15
    expect(FactConfiguracion::precioEoloSugerido(22.50))->toBe(26.45);
});

test('se puede sobrescribir el precio Eolo sugerido', function () {
    $usuario = User::factory()->create();

    $precio = FactPrecioCombustible::registrar(22.50, 30.00, $usuario->id);

    expect((float) $precio->precio_eolo)->toBe(30.00);
});

test('registrar un precio nuevo cierra la vigencia del anterior', function () {
    $usuario = User::factory()->create();

    $viejo = FactPrecioCombustible::registrar(20.00, null, $usuario->id);
    $nuevo = FactPrecioCombustible::registrar(23.00, null, $usuario->id);

    expect($viejo->fresh()->vigencia_fin)->not->toBeNull()
        ->and(FactPrecioCombustible::vigente()->id)->toBe($nuevo->id)
        ->and(FactPrecioCombustible::whereNull('vigencia_fin')->count())->toBe(1);
});

test('sin precios registrados, vigente devuelve null', function () {
    expect(FactPrecioCombustible::vigente())->toBeNull();
});

test('la configuracion devuelve el valor por omision si la clave no existe', function () {
    expect(FactConfiguracion::valor('inexistente', 'respaldo'))->toBe('respaldo');
});

test('el precio Eolo sugerido lee el margen de la tabla de configuracion', function () {
    // Los defaults del codigo coinciden con la siembra; sin cambiar la fila
    // no se distingue leer la tabla de caer al default.
    FactConfiguracion::where('clave', 'combustible_margen')->update(['valor' => '1.20']);

    expect(FactConfiguracion::precioEoloSugerido(22.50))->toBe(27.60);
});

test('la migracion siembra las claves de la formula del combustible', function () {
    expect(FactConfiguracion::where('clave', 'combustible_ajuste')->value('valor'))->toBe('0.50')
        ->and(FactConfiguracion::where('clave', 'combustible_margen')->value('valor'))->toBe('1.15');
});
