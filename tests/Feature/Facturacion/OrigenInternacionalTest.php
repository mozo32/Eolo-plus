<?php

use App\Models\FactPrefactura;
use App\Models\FactServicio;

/**
 * El origen y el destino son independientes. Medido sobre el histórico: 220 folios
 * llegan del extranjero y salen a destino nacional, y 166 al revés; solo 99 de 485
 * son internacionales en las dos direcciones.
 */
beforeEach(function () {
    FactServicio::create(['nombre' => 'DSMEE - entrada', 'precio_unitario' => 4060.50, 'paquete_internacional' => FactServicio::PAQUETE_ENTRADA]);
    FactServicio::create(['nombre' => 'DSMES - salida', 'precio_unitario' => 4060.50, 'paquete_internacional' => FactServicio::PAQUETE_SALIDA]);
});

test('una prefactura nace con el origen nacional', function () {
    // `fresh()`: el modelo recién creado no trae el valor por omisión de la base.
    expect(prefacturaBorrador()->fresh()->tipo_origen)->toBe(FactPrefactura::DESTINO_NACIONAL);
});

test('marcar el origen internacional agrega el paquete de ENTRADA y marca el campo', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/origen-internacional")->assertOk();

    expect($p->fresh()->tipo_origen)->toBe(FactPrefactura::DESTINO_INTERNACIONAL)
        ->and($p->fresh()->renglones()->pluck('nombre_servicio')->all())->toBe(['DSMEE - entrada']);
});

test('marcar el origen NO toca el destino', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/origen-internacional")->assertOk();

    expect($p->fresh()->tipo_destino)->toBe(FactPrefactura::DESTINO_NACIONAL);
});

test('marcar el destino NO toca el origen', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/internacional")->assertOk();

    expect($p->fresh()->tipo_origen)->toBe(FactPrefactura::DESTINO_NACIONAL)
        ->and($p->fresh()->tipo_destino)->toBe(FactPrefactura::DESTINO_INTERNACIONAL)
        ->and($p->fresh()->renglones()->pluck('nombre_servicio')->all())->toBe(['DSMES - salida']);
});

test('marcar las dos direcciones, una tras otra, carga cada paquete una sola vez', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/origen-internacional")->assertOk();
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/internacional")->assertOk();

    expect($p->fresh()->tipo_origen)->toBe(FactPrefactura::DESTINO_INTERNACIONAL)
        ->and($p->fresh()->tipo_destino)->toBe(FactPrefactura::DESTINO_INTERNACIONAL)
        ->and($p->fresh()->renglones()->pluck('nombre_servicio')->sort()->values()->all())->toBe(['DSMEE - entrada', 'DSMES - salida']);
});

test('sin paquete de entrada en el catálogo el origen sigue nacional', function () {
    FactServicio::query()->where('paquete_internacional', FactServicio::PAQUETE_ENTRADA)->delete();
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/origen-internacional")->assertOk();

    expect($p->fresh()->tipo_origen)->toBe(FactPrefactura::DESTINO_NACIONAL)
        ->and($p->fresh()->renglones()->count())->toBe(0);
});

test('la respuesta de la prefactura trae el origen junto al destino', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/origen-internacional")->assertOk();

    $this->getJson("/api/facturacion/prefacturas/{$p->id}")
        ->assertOk()
        ->assertJsonPath('prefactura.tipo_origen', FactPrefactura::DESTINO_INTERNACIONAL)
        ->assertJsonPath('prefactura.tipo_destino', FactPrefactura::DESTINO_NACIONAL);
});

test('marcar el origen exige el subdepartamento, como el destino', function () {
    $p = prefacturaBorrador();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/origen-internacional")->assertUnauthorized();

    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/origen-internacional")->assertForbidden();
});

test('una prefactura cerrada no acepta el paquete de entrada', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $p->update(['estado' => FactPrefactura::ESTADO_CERRADA]);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/origen-internacional")->assertStatus(409);

    expect($p->fresh()->renglones()->count())->toBe(0);
});
