<?php

// tests/Feature/Facturacion/PrefacturaTotalesTest.php
// (prefacturaBorrador, renglonDe y los demás ayudantes viven en tests/Pest.php, no aquí)

use App\Models\FactAeronave;
use App\Models\FactCliente;
use App\Models\FactConfiguracion;
use App\Models\FactPrefactura;
use App\Services\RenglonDePrefacturaCerradaException;
use Illuminate\Support\Facades\DB;

test('el importe de un renglon sale de sus propios valores congelados', function () {
    $p = prefacturaBorrador();
    $r = renglonDe($p, 1000.0, 3, 50.0);

    expect($r->importe())->toBe('4500.00');
});

test('el importe respeta el ajuste congelado en el renglon', function () {
    $p = prefacturaBorrador();

    expect(renglonDe($p, 1000.0, 1, 0, 'mas_5')->importe())->toBe('1050.00')
        ->and(renglonDe($p, 1160.0, 1, 0, 'sin_iva')->importe())->toBe('1000.00');
});

test('el renglon no se mueve si el catalogo cambia', function () {
    $p = prefacturaBorrador();
    $r = renglonDe($p, 1000.0, 1, 0, 'mas_5');
    $nombre = $r->nombre_servicio;

    $r->servicio->update([
        'nombre' => 'Nombre nuevo',
        'precio_unitario' => 9999.0,
        'margen' => 80,
        'es_de_tercero' => true,
        'ajuste_precio' => 'sin_iva',
    ]);

    $r = $r->fresh();

    expect($r->importe())->toBe('1050.00')
        ->and($r->ajuste_precio)->toBe('mas_5')
        ->and($r->nombre_servicio)->toBe($nombre)
        ->and((string) $r->precio_unitario)->toBe('1000.0000')
        ->and((string) $r->margen)->toBe('0.00');
});

test('el subtotal es la suma de los importes derivados', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 1000.0, 2);
    renglonDe($p, 26.0640, 1);

    expect($p->fresh()->subtotal())->toBe('2026.06');
});

test('el subtotal se suma como cadena de dos decimales, no como float', function () {
    // Con `+` esto daria "0.3" (float 0.30000000000000004 convertido a cadena).
    $p = prefacturaBorrador();
    renglonDe($p, 0.10, 1);
    renglonDe($p, 0.20, 1);

    expect($p->subtotal())->toBe('0.30');
});

test('cada renglon aporta su importe ya redondeado al subtotal', function () {
    // 33.3350 redondea a 33.34 por renglon; tres renglones suman 100.02. Tres
    // unidades en un solo renglon serian 100.01: la suma es de importes redondeados.
    $p = prefacturaBorrador();
    renglonDe($p, 33.3350, 1);
    renglonDe($p, 33.3350, 1);
    renglonDe($p, 33.3350, 1);

    expect($p->subtotal())->toBe('100.02');
});

test('el subtotal ve un renglon recien agregado a la misma instancia', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);

    expect($p->subtotal())->toBe('100.00');

    renglonDe($p, 100.0, 1);

    expect($p->subtotal())->toBe('200.00')
        ->and($p->total())->toBe('232.00');
});

test('el IVA es la tasa vigente sobre el subtotal y el total es la suma', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 1000.0, 1);

    $p = $p->fresh();

    expect($p->ivaTasa())->toBe('0.1600')
        ->and($p->iva())->toBe('160.00')
        ->and($p->total())->toBe('1160.00');
});

/*
 * El IVA se REDONDEA al centavo, como el sistema viejo (Prefectura/prefactura.php:102,
 * `$iv = $caja * 0.16`, mostrado con `number_format` en la linea 556). Truncarlo
 * cobraria hasta un centavo menos. Los casos que discriminan son 26.06, 1234.56,
 * 0.05 y 999999.99: con `bcmul(..., 2)` dan 4.16, 197.52, 0.00 y 159999.99.
 */
test('el IVA se redondea al centavo como en el sistema viejo, no se trunca', function (float $precio, string $iva, string $total) {
    $p = prefacturaBorrador();
    renglonDe($p, $precio, 1);

    expect($p->iva())->toBe($iva)
        ->and($p->total())->toBe($total);
})->with([
    'truncado daria 4.16' => [26.06, '4.17', '30.23'],
    'truncado daria 197.52' => [1234.56, '197.53', '1432.09'],
    'truncado daria 0.00' => [0.05, '0.01', '0.06'],
    'cero' => [0.0, '0.00', '0.00'],
    'importe grande' => [999999.99, '160000.00', '1159999.99'],
]);

test('una tasa distinta en configuracion cambia el IVA de un borrador', function () {
    FactConfiguracion::create(['clave' => 'iva_tasa', 'valor' => '0.08', 'descripcion' => 'Tasa de IVA']);
    $p = prefacturaBorrador();
    renglonDe($p, 1000.0, 1);

    expect($p->fresh()->iva())->toBe('80.00');
});

test('la tasa de configuracion se normaliza a cuatro decimales sin float', function (string $valor, string $esperada) {
    FactConfiguracion::create(['clave' => 'iva_tasa', 'valor' => $valor, 'descripcion' => 'Tasa de IVA']);

    expect(prefacturaBorrador()->ivaTasa())->toBe($esperada);
})->with([
    ['0.16', '0.1600'],
    ['0.1600', '0.1600'],
    ['.08', '0.0800'],
    [' 0.16 ', '0.1600'],
    ['0', '0.0000'],
]);

test('una tasa ilegible en configuracion lanza en lugar de cobrar con otra', function () {
    FactConfiguracion::create(['clave' => 'iva_tasa', 'valor' => 'dieciseis', 'descripcion' => 'Tasa de IVA']);

    prefacturaBorrador()->ivaTasa();
})->throws(UnexpectedValueException::class);

test('una prefactura sin renglones tiene totales en cero, no null', function () {
    $p = prefacturaBorrador();

    expect($p->subtotal())->toBe('0.00')
        ->and($p->iva())->toBe('0.00')
        ->and($p->total())->toBe('0.00');
});

test('las relaciones de la prefactura resuelven aeronave, satelite y cliente', function () {
    $p = prefacturaBorrador();
    $cliente = FactCliente::create(['nombre' => 'Cliente de prueba']);
    $p->update(['cliente_id' => $cliente->id]);
    $p = $p->fresh();

    expect($p->aeronave->matricula)->toStartWith('XA-')
        ->and($p->satelite)->toBeInstanceOf(FactAeronave::class)
        ->and($p->satelite->aeronave_id)->toBe($p->aeronave_id)
        ->and($p->satelite->estatus)->toBe(FactAeronave::ESTATUS_TRANSITO)
        ->and($p->cliente->nombre)->toBe('Cliente de prueba');
});

test('los renglones salen por orden y despues por id', function () {
    $p = prefacturaBorrador();
    $segundo = renglonDe($p, 10.0, 1);
    $segundo->update(['orden' => 2]);
    $primero = renglonDe($p, 20.0, 1);

    expect($p->renglones()->get()->pluck('id')->all())->toBe([$primero->id, $segundo->id]);
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

// --- La rama sellada --------------------------------------------------------

test('una prefactura cerrada devuelve su sello y no lo que derivan los renglones', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 1000.0, 1);
    $p = cerrarConSello($p, '1000.00', '160.00', '1160.00');

    // Un sello que a proposito no coincide con la derivacion.
    $p->update(['total_sellado' => '777.00']);
    $p = $p->fresh();

    expect($p->subtotal())->toBe('1000.00')
        ->and($p->iva())->toBe('160.00')
        ->and($p->total())->toBe('777.00')
        ->and($p->ivaTasa())->toBe('0.1600');
});

test('el sello de una cerrada no se mueve si cambia la tasa de configuracion', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 1000.0, 1);
    $p = cerrarConSello($p, '1000.00', '160.00', '1160.00');

    FactConfiguracion::create(['clave' => 'iva_tasa', 'valor' => '0.08', 'descripcion' => 'Tasa de IVA']);

    expect($p->fresh()->iva())->toBe('160.00')
        ->and($p->fresh()->ivaTasa())->toBe('0.1600')
        ->and($p->fresh()->total())->toBe('1160.00');
});

test('un sello parcial en un borrador no manda sobre la derivacion', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 1000.0, 1);
    $p->update(['total_sellado' => '1.00', 'subtotal_sellado' => '2.00', 'iva_tasa_sellada' => '0.5000']);
    $p = $p->fresh();

    expect($p->estaCerrada())->toBeFalse()
        ->and($p->subtotal())->toBe('1000.00')
        ->and($p->ivaTasa())->toBe('0.1600')
        ->and($p->iva())->toBe('160.00')
        ->and($p->total())->toBe('1160.00');
});

test('una cerrada con el sello a medias deriva lo que le falta y lo reporta', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 1000.0, 1);
    $p->update(['estado' => FactPrefactura::ESTADO_CERRADA, 'folio' => 10000, 'total_sellado' => '1160.00']);
    $p = $p->fresh();

    expect($p->total())->toBe('1160.00')
        ->and($p->subtotal())->toBe('1000.00')
        ->and($p->selloDiscrepa())->toBeTrue()
        ->and(array_keys($p->discrepanciasDelSello()))->toBe(['subtotal', 'iva', 'iva_tasa']);
});

// --- El sello contra la derivacion -----------------------------------------

test('el sello que coincide con sus renglones no reporta discrepancia', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 1000.0, 1);
    $p = cerrarConSello($p, '1000.00', '160.00', '1160.00');

    expect($p->selloDiscrepa())->toBeFalse()
        ->and($p->discrepanciasDelSello())->toBe([]);
});

test('un borrador nunca reporta discrepancia', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 1000.0, 1);

    expect($p->selloDiscrepa())->toBeFalse();
});

test('un renglon cambiado por fuera del modelo hace que el sello lo diga', function () {
    $p = prefacturaBorrador();
    $r = renglonDe($p, 100.0, 1);
    $p = cerrarConSello($p, '100.00', '16.00', '116.00');

    // Una escritura directa se salta la guarda del modelo; el sello debe delatarla.
    DB::table('fact_prefactura_renglones')->where('id', $r->id)->update(['precio_unitario' => 5000]);

    expect($p->fresh()->selloDiscrepa())->toBeTrue()
        ->and($p->fresh()->discrepanciasDelSello())->toBe([
            'subtotal' => ['sellado' => '100.00', 'derivado' => '5000.00'],
            'iva' => ['sellado' => '16.00', 'derivado' => '800.00'],
            'total' => ['sellado' => '116.00', 'derivado' => '5800.00'],
        ])
        // y total() sigue diciendo la foto, que es lo que salio al cliente
        ->and($p->fresh()->total())->toBe('116.00');
});

test('el sello se compara con la tasa sellada, no con la vigente', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 1000.0, 1);
    $p = cerrarConSello($p, '1000.00', '80.00', '1080.00', '0.0800');

    expect($p->selloDiscrepa())->toBeFalse();
});

// --- Los renglones de una cerrada no se tocan ------------------------------

test('un renglon de una prefactura cerrada no se puede editar', function () {
    $p = prefacturaBorrador();
    $r = renglonDe($p, 100.0, 1);
    cerrarConSello($p, '100.00', '16.00', '116.00');

    expect(fn () => $r->update(['precio_unitario' => 5000]))
        ->toThrow(RenglonDePrefacturaCerradaException::class);

    expect((string) $r->fresh()->precio_unitario)->toBe('100.0000');
});

test('un renglon de una prefactura cerrada no se puede borrar', function () {
    $p = prefacturaBorrador();
    $r = renglonDe($p, 100.0, 1);
    cerrarConSello($p, '100.00', '16.00', '116.00');

    expect(fn () => $r->delete())->toThrow(RenglonDePrefacturaCerradaException::class);

    expect($p->renglones()->count())->toBe(1);
});

test('no se puede agregar un renglon a una prefactura cerrada', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);
    $p = cerrarConSello($p, '100.00', '16.00', '116.00');

    expect(fn () => renglonDe($p, 99999.0, 1))->toThrow(RenglonDePrefacturaCerradaException::class);

    expect($p->renglones()->count())->toBe(1);
});

test('la guarda consulta la base, no una instancia de prefactura obsoleta en memoria', function () {
    $p = prefacturaBorrador();
    $r = renglonDe($p, 100.0, 1);

    // Otra sesion cierra la prefactura; `$p` y `$r->prefactura` siguen diciendo borrador.
    FactPrefactura::whereKey($p->id)->update(['estado' => FactPrefactura::ESTADO_CERRADA]);

    expect(fn () => $r->update(['cantidad' => 50]))->toThrow(RenglonDePrefacturaCerradaException::class);
});

test('un renglon no se puede mover desde ni hacia una prefactura cerrada', function () {
    $cerrada = prefacturaBorrador();
    $enCerrada = renglonDe($cerrada, 100.0, 1);
    cerrarConSello($cerrada, '100.00', '16.00', '116.00');

    $borrador = prefacturaBorrador();
    $enBorrador = renglonDe($borrador, 50.0, 1);

    expect(fn () => $enCerrada->update(['prefactura_id' => $borrador->id]))
        ->toThrow(RenglonDePrefacturaCerradaException::class);

    expect(fn () => $enBorrador->update(['prefactura_id' => $cerrada->id]))
        ->toThrow(RenglonDePrefacturaCerradaException::class);
});

test('los renglones de un borrador se editan y se borran con normalidad', function () {
    $p = prefacturaBorrador();
    $r = renglonDe($p, 100.0, 1);

    $r->update(['cantidad' => 2]);

    expect($r->fresh()->importe())->toBe('200.00');

    $r->delete();

    expect($p->renglones()->count())->toBe(0);
});
