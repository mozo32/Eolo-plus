<?php

use App\Models\Bitacora;
use App\Models\FactConfiguracion;
use App\Models\FactFormaPago;
use App\Models\FactPrefactura;
use App\Services\CierrePrefactura;
use App\Services\PrefacturaSinCobroException;
use App\Services\TotalesNoCalculablesException;
use Illuminate\Support\Facades\DB;

/**
 * Las consultas que tocaron el contador del folio mientras corre `$operacion`.
 *
 * El valor final del contador NO sirve para probar que el rechazo no lo gasta: el
 * cierre corre en una transaccion y, al lanzar, se revierte, de modo que el contador
 * queda intacto aunque la comprobacion estuviera DESPUES de `siguienteFolio()`. Lo que
 * el orden cambia es si el contador se LEE (y se bloquea) antes de rechazar, y eso solo
 * se ve en las consultas.
 */
function consultasAlContadorDelFolio(Closure $operacion): array
{
    $tocadas = [];

    DB::listen(function ($consulta) use (&$tocadas) {
        if (in_array(CierrePrefactura::CLAVE_FOLIO, $consulta->bindings, true)) {
            $tocadas[] = $consulta->sql;
        }
    });

    $operacion();

    return $tocadas;
}

test('cerrar sin cobro completo pide confirmacion y NO consume folio', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    formasDePago();
    $bitacoraAntes = Bitacora::count();

    $tocadas = consultasAlContadorDelFolio(fn () => $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar")
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'sin_cobro')
        ->assertJsonPath('faltante', '116.00'));

    // El rechazo ocurre ANTES de leer el contador: ni lo lee ni lo bloquea.
    expect($tocadas)->toBe([]);

    expect($p->fresh()->estado)->toBe(FactPrefactura::ESTADO_BORRADOR)
        ->and($p->fresh()->folio)->toBeNull()
        ->and(FactConfiguracion::valor(CierrePrefactura::CLAVE_FOLIO))->toBe((string) CierrePrefactura::FOLIO_INICIAL)
        ->and(Bitacora::count())->toBe($bitacoraAntes);
});

test('con la confirmacion, cierra aunque falte cobro', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar", ['confirmar_sin_cobro' => true])
        ->assertOk()
        ->assertJsonPath('prefactura.estado', 'cerrada');

    expect($p->fresh()->folio)->toBe(CierrePrefactura::FOLIO_INICIAL);
});

test('confirmar_sin_cobro en falso es lo mismo que no mandarlo', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar", ['confirmar_sin_cobro' => false])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'sin_cobro');

    expect($p->fresh()->folio)->toBeNull();
});

test('confirmar_sin_cobro tiene que ser booleano', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar", ['confirmar_sin_cobro' => 'quizas'])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['confirmar_sin_cobro']);

    expect($p->fresh()->folio)->toBeNull();
});

test('cubierta al centavo, cierra sin confirmacion', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    pagoDe($p, formasDePago()['Visa'], '116.00');

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar")->assertOk();

    expect($p->fresh()->estado)->toBe(FactPrefactura::ESTADO_CERRADA);
});

test('sobrepagada tambien cierra sin confirmacion', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    pagoDe($p, formasDePago()[FactFormaPago::CONCEPTO_EFECTIVO], '200.00');

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar")->assertOk();

    expect($p->fresh()->estado)->toBe(FactPrefactura::ESTADO_CERRADA);
});

test('un centavo de menos ya pide confirmacion', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    pagoDe($p, formasDePago()['Visa'], '115.99');

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar")
        ->assertStatus(422)
        ->assertJsonPath('faltante', '0.01');

    expect($p->fresh()->folio)->toBeNull();
});

test('el centavo cuenta aunque el total y lo pagado compartan decima', function () {
    // 50.04 + IVA 8.01 = 58.05; con 58.04 pagado las dos cifras son iguales a UN decimal
    // (58.0), asi que una comparacion a menos de dos decimales no vería la falta.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(50.04, 1);
    pagoDe($p, formasDePago()['Visa'], '58.04');

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar")
        ->assertStatus(422)
        ->assertJsonPath('faltante', '0.01');

    pagoDe($p, formasDePago()['Visa'], '0.01');

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar")->assertOk();
});

test('un cobro parcial dice cuanto falta, no el total', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    pagoDe($p, formasDePago()['Visa'], '50.00');

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar")
        ->assertStatus(422)
        ->assertJsonPath('faltante', '66.00');
});

test('el servicio lanza con el faltante, no solo el endpoint', function () {
    [$p, $usuario] = prefacturaCompleta(100.0, 1);

    $tocadas = consultasAlContadorDelFolio(function () use ($p, $usuario) {
        try {
            app(CierrePrefactura::class)->cerrar($p, $usuario->id);
            $this->fail('Se esperaba PrefacturaSinCobroException.');
        } catch (PrefacturaSinCobroException $e) {
            expect($e->faltante)->toBe('116.00');
        }
    });

    expect($tocadas)->toBe([]);

    expect($p->fresh()->folio)->toBeNull();
});

test('una tasa de IVA ilegible no se disfraza de falta de cobro', function () {
    // `total()` lanza ANTES de la comprobacion del cobro, asi que no hay faltante que
    // calcular: sale la excepcion del total, no `sin_cobro` ni un faltante inventado.
    [$p, $usuario] = prefacturaCompleta(100.0, 1);
    FactConfiguracion::updateOrCreate(['clave' => 'iva_tasa'], ['valor' => 'abc', 'descripcion' => 'Tasa de IVA']);

    expect(fn () => app(CierrePrefactura::class)->cerrar($p, $usuario->id))->toThrow(UnexpectedValueException::class);

    expect($p->fresh()->folio)->toBeNull()
        ->and(FactConfiguracion::valor(CierrePrefactura::CLAVE_FOLIO))->toBe((string) CierrePrefactura::FOLIO_INICIAL);
});

test('la confirmacion es el unico cambio de contrato del cierre: el sello sale igual', function () {
    [$p, $usuario] = prefacturaCompleta(100.0, 1);
    $cerrada = app(CierrePrefactura::class)->cerrar($p, $usuario->id, confirmarSinCobro: true);

    expect($cerrada->subtotal_sellado)->toBe('100.00')
        ->and($cerrada->iva_sellado)->toBe('16.00')
        ->and($cerrada->total_sellado)->toBe('116.00');
});

test('cerrar sin cobro completo deja en la bitacora lo pagado, el faltante y que se confirmo', function () {
    [$p, $usuario] = prefacturaCompleta(100.0, 1);
    pagoDe($p, formasDePago()['Visa'], '50.00');

    app(CierrePrefactura::class)->cerrar($p, $usuario->id, confirmarSinCobro: true);

    $entrada = Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)
        ->where('accion', Bitacora::ACCION_FINALIZAR)->sole();

    expect($entrada->descripcion)->toContain('sin cobro completo')
        ->and($entrada->descripcion)->toContain('pagado 50.00')
        ->and($entrada->descripcion)->toContain('faltan 66.00')
        ->and($entrada->datos_nuevos)->toMatchArray([
            'total' => '116.00',
            'pagado' => '50.00',
            'faltante' => '66.00',
            'confirmado_sin_cobro' => true,
        ]);
});

test('sin ningun pago, la bitacora dice pagado 0.00 y el faltante es el total', function () {
    [$p, $usuario] = prefacturaCompleta(100.0, 1);

    app(CierrePrefactura::class)->cerrar($p, $usuario->id, confirmarSinCobro: true);

    $entrada = Bitacora::where('accion', Bitacora::ACCION_FINALIZAR)->sole();

    expect($entrada->datos_nuevos)->toMatchArray(['pagado' => '0.00', 'faltante' => '116.00', 'confirmado_sin_cobro' => true]);
});

test('confirmar cuando ya esta cubierta no deja rastro de falta de cobro', function () {
    // Mandar el flag de mas no inventa un faltante: la bitacora solo habla de cobro cuando faltaba.
    foreach (['116.00', '200.00'] as $pagado) {
        [$p, $usuario] = prefacturaCompleta(100.0, 1);
        pagoDe($p, formasDePago()['Visa'], $pagado);

        app(CierrePrefactura::class)->cerrar($p, $usuario->id, confirmarSinCobro: true);
    }

    foreach (Bitacora::where('accion', Bitacora::ACCION_FINALIZAR)->get() as $entrada) {
        expect($entrada->datos_nuevos)->not->toHaveKeys(['pagado', 'faltante', 'confirmado_sin_cobro'])
            ->and($entrada->descripcion)->not->toContain('sin cobro');
    }
});

test('una tasa de IVA ilegible responde 422 totales_no_calculables, con y sin confirmar', function (array $cuerpo) {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    FactConfiguracion::updateOrCreate(['clave' => 'iva_tasa'], ['valor' => 'abc', 'descripcion' => 'Tasa de IVA']);
    $bitacoraAntes = Bitacora::count();

    $respuesta = $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar", $cuerpo)
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'totales_no_calculables');

    // El mensaje esta en espanol y dice que corregir.
    expect($respuesta->json('message'))->toContain('tasa de IVA')->toContain('Corrígelo')
        ->and($p->fresh()->estado)->toBe(FactPrefactura::ESTADO_BORRADOR)
        ->and($p->fresh()->folio)->toBeNull()
        ->and(FactConfiguracion::valor(CierrePrefactura::CLAVE_FOLIO))->toBe((string) CierrePrefactura::FOLIO_INICIAL)
        ->and(Bitacora::count())->toBe($bitacoraAntes);
})->with([
    'sin confirmar' => [[]],
    'confirmando' => [['confirmar_sin_cobro' => true]],
]);

test('un ajuste de renglon ilegible tambien responde 422 totales_no_calculables', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    DB::table('fact_prefactura_renglones')->where('prefactura_id', $p->id)->update(['ajuste_precio' => 'raro']);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar", ['confirmar_sin_cobro' => true])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'totales_no_calculables');

    expect($p->fresh()->folio)->toBeNull();
});

test('el servicio lanza la excepcion propia por la tasa ilegible, con la original de causa', function () {
    [$p, $usuario] = prefacturaCompleta(100.0, 1);
    FactConfiguracion::updateOrCreate(['clave' => 'iva_tasa'], ['valor' => 'abc', 'descripcion' => 'Tasa de IVA']);

    try {
        app(CierrePrefactura::class)->cerrar($p, $usuario->id);
        $this->fail('Se esperaba TotalesNoCalculablesException.');
    } catch (TotalesNoCalculablesException $e) {
        // Sigue siendo una `UnexpectedValueException`: quien ya la esperaba no se rompe.
        expect($e)->toBeInstanceOf(UnexpectedValueException::class)
            ->and($e->getPrevious())->toBeInstanceOf(UnexpectedValueException::class);
    }
});

test('un contador corrupto NO se confunde con totales no calculables', function () {
    [$p, $usuario] = prefacturaCompleta(100.0, 1);
    FactConfiguracion::where('clave', CierrePrefactura::CLAVE_FOLIO)->update(['valor' => 'abc']);

    // Con la confirmacion, para que llegue al folio; los totales son legibles.
    try {
        app(CierrePrefactura::class)->cerrar($p, $usuario->id, confirmarSinCobro: true);
        $this->fail('Se esperaba UnexpectedValueException por el contador.');
    } catch (UnexpectedValueException $e) {
        expect($e)->not->toBeInstanceOf(TotalesNoCalculablesException::class)
            ->and($e->getMessage())->toContain(CierrePrefactura::CLAVE_FOLIO);
    }

    expect($p->fresh()->estado)->toBe(FactPrefactura::ESTADO_BORRADOR);
});

test('un contador corrupto, por el endpoint, no responde totales_no_calculables', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    FactConfiguracion::where('clave', CierrePrefactura::CLAVE_FOLIO)->update(['valor' => 'abc']);

    $respuesta = $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar", ['confirmar_sin_cobro' => true]);

    // Es un 500 de datos corruptos, no el 422 de los totales: son causas distintas.
    $respuesta->assertStatus(500);
    expect($respuesta->json('codigo'))->not->toBe('totales_no_calculables');
});

test('un confirmar_sin_cobro que no es booleano responde en espanol', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);

    $respuesta = $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar", ['confirmar_sin_cobro' => 'quizas'])
        ->assertStatus(422);

    expect($respuesta->json('errors.confirmar_sin_cobro.0'))->toBe('La confirmación de cerrar sin cobro debe ser verdadera o falsa.');
});
