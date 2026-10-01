<?php

// tests/Feature/Facturacion/PrefacturaTotalesTest.php
// (prefacturaBorrador y renglonDe viven en tests/Pest.php, no aquí)

use App\Models\FactConfiguracion;
use App\Models\FactPrefactura;

test('el importe de un renglon sale de sus propios valores congelados', function () {
    $p = prefacturaBorrador();
    $r = renglonDe($p, 1000.0, 3, 50.0);

    expect($r->importe())->toBe('4500.00');
});

test('el renglon no se mueve si el catalogo cambia', function () {
    $p = prefacturaBorrador();
    $r = renglonDe($p, 1000.0, 1);

    $r->servicio->update(['precio_unitario' => 9999.0, 'margen' => 80, 'es_de_tercero' => true]);

    expect($r->fresh()->importe())->toBe('1000.00');
});

test('el subtotal es la suma de los importes derivados', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 1000.0, 2);
    renglonDe($p, 26.0640, 1);

    expect($p->fresh()->subtotal())->toBe('2026.06');
});

test('el IVA es la tasa vigente sobre el subtotal y el total es la suma', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 1000.0, 1);

    $p = $p->fresh();

    expect($p->ivaTasa())->toBe('0.1600')
        ->and($p->iva())->toBe('160.00')
        ->and($p->total())->toBe('1160.00');
});

test('una tasa distinta en configuracion cambia el IVA de un borrador', function () {
    FactConfiguracion::create(['clave' => 'iva_tasa', 'valor' => '0.08', 'descripcion' => 'Tasa de IVA']);
    $p = prefacturaBorrador();
    renglonDe($p, 1000.0, 1);

    expect($p->fresh()->iva())->toBe('80.00');
});

test('una prefactura sin renglones tiene totales en cero, no null', function () {
    $p = prefacturaBorrador();

    expect($p->subtotal())->toBe('0.00')
        ->and($p->iva())->toBe('0.00')
        ->and($p->total())->toBe('0.00');
});

test('los scopes separan borradores de cerradas', function () {
    $p = prefacturaBorrador();
    $p->update(['estado' => FactPrefactura::ESTADO_CERRADA, 'folio' => 10000]);
    prefacturaBorrador();

    expect(FactPrefactura::cerradas()->count())->toBe(1)
        ->and(FactPrefactura::borradores()->count())->toBe(1);
});

test('el folio es unico pero muchos borradores pueden no tenerlo', function () {
    prefacturaBorrador();
    prefacturaBorrador();

    expect(FactPrefactura::whereNull('folio')->count())->toBe(2);
});

test('dos prefacturas no pueden compartir folio', function () {
    prefacturaBorrador()->update(['folio' => 10000]);
    prefacturaBorrador()->update(['folio' => 10000]);
})->throws(Illuminate\Database\UniqueConstraintViolationException::class);
