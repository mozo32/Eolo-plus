<?php
// tests/Feature/Facturacion/CierrePrefacturaTest.php

use App\Models\Bitacora;
use App\Models\FactConfiguracion;
use App\Models\FactPrefactura;
use App\Services\CierrePrefactura;
use App\Services\PrefacturaDescartadaException;
use App\Services\PrefacturaIncompletaException;
use App\Services\PrefacturaYaCerradaException;
use App\Services\SelloInconsistenteException;
use Illuminate\Support\Facades\DB;

test('la primera prefactura cerrada se lleva el folio 10000', function () {
    [$p, $usuario] = prefacturaCompleta();

    $cerrada = app(CierrePrefactura::class)->cerrar($p, $usuario->id, confirmarSinCobro: true);

    expect($cerrada->folio)->toBe(10000)
        ->and($cerrada->estado)->toBe(FactPrefactura::ESTADO_CERRADA);
});

test('el folio avanza de uno en uno', function () {
    [$p1, $usuario] = prefacturaCompleta();
    [$p2] = prefacturaCompleta();

    expect(app(CierrePrefactura::class)->cerrar($p1, $usuario->id, confirmarSinCobro: true)->folio)->toBe(10000)
        ->and(app(CierrePrefactura::class)->cerrar($p2, $usuario->id, confirmarSinCobro: true)->folio)->toBe(10001);
});

test('el folio nuevo nunca cae en el rango del sistema viejo', function () {
    [$p, $usuario] = prefacturaCompleta();

    // El mayor folio del origen es 4121 y sus borradores llegan a 4123.
    expect(app(CierrePrefactura::class)->cerrar($p, $usuario->id, confirmarSinCobro: true)->folio)->toBeGreaterThan(4123);
});

test('al cerrar se sella el subtotal, el IVA, el total y la tasa', function () {
    [$p, $usuario] = prefacturaCompleta(precio: 1000.0, cantidad: 2);

    $cerrada = app(CierrePrefactura::class)->cerrar($p, $usuario->id, confirmarSinCobro: true);

    expect((string) $cerrada->subtotal_sellado)->toBe('2000.00')
        ->and((string) $cerrada->iva_sellado)->toBe('320.00')
        ->and((string) $cerrada->total_sellado)->toBe('2320.00')
        ->and((string) $cerrada->iva_tasa_sellada)->toBe('0.1600');
});

test('el sello no se mueve si despues cambia la tasa de IVA', function () {
    [$p, $usuario] = prefacturaCompleta(precio: 1000.0, cantidad: 1);
    $cerrada = app(CierrePrefactura::class)->cerrar($p, $usuario->id, confirmarSinCobro: true);

    // `iva_tasa` no esta sembrada, asi que esto INSERTA y `descripcion` es NOT NULL.
    FactConfiguracion::updateOrCreate(['clave' => 'iva_tasa'], ['valor' => '0.08', 'descripcion' => 'Tasa de IVA']);

    expect($cerrada->fresh()->iva())->toBe('160.00');
});

test('cerrar dos veces la misma prefactura falla y no consume dos folios', function () {
    [$p, $usuario] = prefacturaCompleta();
    app(CierrePrefactura::class)->cerrar($p, $usuario->id, confirmarSinCobro: true);

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

    app(CierrePrefactura::class)->cerrar($p, $usuario->id, confirmarSinCobro: true);

    $entrada = Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)
        ->where('accion', Bitacora::ACCION_FINALIZAR)->sole();

    expect($entrada->descripcion)->toContain('10000')
        ->and($entrada->descripcion)->toContain('1160.00')
        ->and($entrada->registro_id)->toBe($p->id)
        ->and($entrada->usuario_id)->toBe($usuario->id)
        ->and($entrada->datos_nuevos)->toBe([
            'folio' => 10000,
            'subtotal' => '1000.00',
            'iva_tasa' => '0.1600',
            'iva' => '160.00',
            'total' => '1160.00',
        ]);
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

    app(CierrePrefactura::class)->cerrar($p, $usuario->id, confirmarSinCobro: true);

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

test('el contador del folio queda sembrado por la migracion, listo para leerse con candado', function () {
    expect(FactConfiguracion::valor('prefactura_folio_siguiente'))->toBe('10000');
});

test('el IVA se redondea al sellar, no se trunca', function () {
    // 26.06 * 0.16 = 4.1696: redondeado 4.17, truncado 4.16.
    [$p, $usuario] = prefacturaCompleta(precio: 26.06, cantidad: 1);

    $cerrada = app(CierrePrefactura::class)->cerrar($p, $usuario->id, confirmarSinCobro: true);

    expect((string) $cerrada->iva_sellado)->toBe('4.17')
        ->and((string) $cerrada->total_sellado)->toBe('30.23');
});

test('el folio sale del contador y no del maximo de los folios', function () {
    FactConfiguracion::where('clave', 'prefactura_folio_siguiente')->update(['valor' => '20000']);
    [$p, $usuario] = prefacturaCompleta();

    $cerrada = app(CierrePrefactura::class)->cerrar($p, $usuario->id, confirmarSinCobro: true);

    expect($cerrada->folio)->toBe(20000)
        ->and(FactConfiguracion::valor('prefactura_folio_siguiente'))->toBe('20001');
});

test('un contador corrupto no entrega folio 0: el cierre se aborta', function () {
    FactConfiguracion::where('clave', 'prefactura_folio_siguiente')->update(['valor' => 'abc']);
    [$p, $usuario] = prefacturaCompleta();

    expect(fn () => app(CierrePrefactura::class)->cerrar($p, $usuario->id, confirmarSinCobro: true))
        ->toThrow(UnexpectedValueException::class);

    expect($p->fresh()->estado)->toBe(FactPrefactura::ESTADO_BORRADOR)
        ->and(FactConfiguracion::valor('prefactura_folio_siguiente'))->toBe('abc');
});

test('si la bitacora falla al final, el cierre entero se revierte', function () {
    [$p, $usuario] = prefacturaCompleta();
    Bitacora::creating(fn () => throw new RuntimeException('bitacora caida'));

    expect(fn () => app(CierrePrefactura::class)->cerrar($p, $usuario->id, confirmarSinCobro: true))->toThrow(RuntimeException::class, 'bitacora caida');

    $p = $p->fresh();
    expect($p->estado)->toBe(FactPrefactura::ESTADO_BORRADOR)
        ->and($p->folio)->toBeNull()
        ->and($p->subtotal_sellado)->toBeNull()
        ->and($p->cerrada_at)->toBeNull()
        ->and(FactConfiguracion::valor('prefactura_folio_siguiente'))->toBe('10000');
});

test('si el sello no coincide con los renglones tras escribirlo, el cierre se revierte sin consumir folio', function () {
    [$p, $usuario] = prefacturaCompleta(precio: 100.0, cantidad: 1);

    // Simula la deriva bajo un aislamiento menor a REPEATABLE READ: justo despues del
    // UPDATE del sello aparece un renglon que el sello no vio (insercion cruda, que
    // la guarda del modelo no cubre).
    $servicioId = $p->renglones()->first()->servicio_id;
    $metido = false;
    DB::listen(function ($consulta) use ($p, $servicioId, &$metido) {
        if (! $metido && str_starts_with($consulta->sql, 'update "fact_prefacturas"')) {
            $metido = true;
            DB::table('fact_prefactura_renglones')->insert([
                'prefactura_id' => $p->id, 'servicio_id' => $servicioId, 'nombre_servicio' => 'Colado',
                'precio_unitario' => 50, 'cantidad' => 1, 'es_de_tercero' => false, 'margen' => 0,
                'ajuste_precio' => 'ninguno', 'orden' => 2, 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
    });

    expect(fn () => app(CierrePrefactura::class)->cerrar($p, $usuario->id, confirmarSinCobro: true))
        ->toThrow(SelloInconsistenteException::class);

    $p = $p->fresh();
    expect($metido)->toBeTrue()
        ->and($p->estado)->toBe(FactPrefactura::ESTADO_BORRADOR)
        ->and($p->folio)->toBeNull()
        ->and(FactConfiguracion::valor('prefactura_folio_siguiente'))->toBe('10000')
        ->and(Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)->count())->toBe(0);
});

test('un borrador descartado no se cierra y no consume folio', function () {
    [$p, $usuario] = prefacturaCompleta();
    $p->update(['status' => FactPrefactura::STATUS_INACTIVO]);

    expect(fn () => app(CierrePrefactura::class)->cerrar($p->fresh(), $usuario->id))
        ->toThrow(PrefacturaDescartadaException::class);

    $p = $p->fresh();
    expect($p->estado)->toBe(FactPrefactura::ESTADO_BORRADOR)
        ->and($p->folio)->toBeNull()
        ->and($p->subtotal_sellado)->toBeNull()
        ->and(FactConfiguracion::valor('prefactura_folio_siguiente'))->toBe('10000');
});

test('una instancia vieja de un borrador descartado por otra sesion tampoco gasta folio', function () {
    [$p, $usuario] = prefacturaCompleta();
    $vieja = FactPrefactura::find($p->id);
    FactPrefactura::whereKey($p->id)->update(['status' => FactPrefactura::STATUS_INACTIVO]);

    expect(fn () => app(CierrePrefactura::class)->cerrar($vieja, $usuario->id))
        ->toThrow(PrefacturaDescartadaException::class)
        ->and(FactConfiguracion::valor('prefactura_folio_siguiente'))->toBe('10000');
});
