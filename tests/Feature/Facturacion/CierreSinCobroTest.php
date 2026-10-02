<?php

use App\Models\Bitacora;
use App\Models\FactConfiguracion;
use App\Models\FactFormaPago;
use App\Models\FactPrefactura;
use App\Services\CierrePrefactura;
use App\Services\PrefacturaSinCobroException;
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
