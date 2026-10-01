<?php
// tests/Feature/Facturacion/CierrePrefacturaTest.php

use App\Models\Bitacora;
use App\Models\FactConfiguracion;
use App\Models\FactPrefactura;
use App\Services\CierrePrefactura;
use App\Services\PrefacturaIncompletaException;
use App\Services\PrefacturaYaCerradaException;

test('la primera prefactura cerrada se lleva el folio 10000', function () {
    [$p, $usuario] = prefacturaCompleta();

    $cerrada = app(CierrePrefactura::class)->cerrar($p, $usuario->id);

    expect($cerrada->folio)->toBe(10000)
        ->and($cerrada->estado)->toBe(FactPrefactura::ESTADO_CERRADA);
});

test('el folio avanza de uno en uno', function () {
    [$p1, $usuario] = prefacturaCompleta();
    [$p2] = prefacturaCompleta();

    expect(app(CierrePrefactura::class)->cerrar($p1, $usuario->id)->folio)->toBe(10000)
        ->and(app(CierrePrefactura::class)->cerrar($p2, $usuario->id)->folio)->toBe(10001);
});

test('el folio nuevo nunca cae en el rango del sistema viejo', function () {
    [$p, $usuario] = prefacturaCompleta();

    // El mayor folio del origen es 4121 y sus borradores llegan a 4123.
    expect(app(CierrePrefactura::class)->cerrar($p, $usuario->id)->folio)->toBeGreaterThan(4123);
});

test('al cerrar se sella el subtotal, el IVA, el total y la tasa', function () {
    [$p, $usuario] = prefacturaCompleta(precio: 1000.0, cantidad: 2);

    $cerrada = app(CierrePrefactura::class)->cerrar($p, $usuario->id);

    expect((string) $cerrada->subtotal_sellado)->toBe('2000.00')
        ->and((string) $cerrada->iva_sellado)->toBe('320.00')
        ->and((string) $cerrada->total_sellado)->toBe('2320.00')
        ->and((string) $cerrada->iva_tasa_sellada)->toBe('0.1600');
});

test('el sello no se mueve si despues cambia la tasa de IVA', function () {
    [$p, $usuario] = prefacturaCompleta(precio: 1000.0, cantidad: 1);
    $cerrada = app(CierrePrefactura::class)->cerrar($p, $usuario->id);

    // `iva_tasa` no esta sembrada, asi que esto INSERTA y `descripcion` es NOT NULL.
    FactConfiguracion::updateOrCreate(['clave' => 'iva_tasa'], ['valor' => '0.08', 'descripcion' => 'Tasa de IVA']);

    expect($cerrada->fresh()->iva())->toBe('160.00');
});

test('cerrar dos veces la misma prefactura falla y no consume dos folios', function () {
    [$p, $usuario] = prefacturaCompleta();
    app(CierrePrefactura::class)->cerrar($p, $usuario->id);

    expect(fn () => app(CierrePrefactura::class)->cerrar($p->fresh(), $usuario->id))
        ->toThrow(PrefacturaYaCerradaException::class);

    expect(FactConfiguracion::valor('prefactura_folio_siguiente'))->toBe('10001');
});

test('no se puede cerrar sin cliente', function () {
    [$p, $usuario] = prefacturaCompleta();
    $p->update(['cliente_id' => null]);

    app(CierrePrefactura::class)->cerrar($p->fresh(), $usuario->id);
})->throws(PrefacturaIncompletaException::class);

test('no se puede cerrar sin renglones', function () {
    [$p, $usuario] = prefacturaCompleta();
    $p->renglones()->delete();

    app(CierrePrefactura::class)->cerrar($p->fresh(), $usuario->id);
})->throws(PrefacturaIncompletaException::class);

test('el cierre deja rastro en bitacora con el folio y el total', function () {
    [$p, $usuario] = prefacturaCompleta(precio: 1000.0, cantidad: 1);

    app(CierrePrefactura::class)->cerrar($p, $usuario->id);

    $entrada = Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)
        ->where('accion', Bitacora::ACCION_FINALIZAR)->sole();

    expect($entrada->descripcion)->toContain('10000')
        ->and($entrada->descripcion)->toContain('1160.00');
});

test('un cierre que falla no consume folio', function () {
    [$p, $usuario] = prefacturaCompleta();
    $p->update(['cliente_id' => null]);

    try {
        app(CierrePrefactura::class)->cerrar($p->fresh(), $usuario->id);
    } catch (PrefacturaIncompletaException) {
        // esperado
    }

    expect(FactConfiguracion::valor('prefactura_folio_siguiente', '10000'))->toBe('10000');
});

test('una instancia vieja de una prefactura ya cerrada por otra sesion no vuelve a cerrarla ni gasta folio', function () {
    [$p, $usuario] = prefacturaCompleta();
    $vieja = FactPrefactura::find($p->id);

    app(CierrePrefactura::class)->cerrar($p, $usuario->id);

    // `$vieja` todavia dice `borrador`: la guarda tiene que estar dentro, con candado.
    expect(fn () => app(CierrePrefactura::class)->cerrar($vieja, $usuario->id))
        ->toThrow(PrefacturaYaCerradaException::class)
        ->and(FactConfiguracion::valor('prefactura_folio_siguiente'))->toBe('10001');
});

test('una tasa de IVA ilegible aborta el cierre sin consumir folio ni dejar rastro', function () {
    [$p, $usuario] = prefacturaCompleta();
    FactConfiguracion::updateOrCreate(['clave' => 'iva_tasa'], ['valor' => 'abc', 'descripcion' => 'Tasa de IVA']);

    expect(fn () => app(CierrePrefactura::class)->cerrar($p, $usuario->id))->toThrow(UnexpectedValueException::class);

    expect(FactConfiguracion::valor('prefactura_folio_siguiente', '10000'))->toBe('10000')
        ->and($p->fresh()->estado)->toBe(FactPrefactura::ESTADO_BORRADOR)
        ->and(Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)->count())->toBe(0);
});
