<?php

use App\Models\Bitacora;
use App\Models\FactPrefactura;

test('un renglon de cortesia no cobra y el subtotal lo refleja', function () {
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 2);
    renglonDe($p, 50.0, 1);

    expect($p->subtotal())->toBe('250.00');

    $renglon->update(['es_cortesia' => true]);

    expect($renglon->fresh()->importe())->toBe('0.00')
        ->and($p->fresh()->subtotal())->toBe('50.00');
});

test('el subtotal de la MISMA instancia refleja la cortesia al instante, aunque los renglones ya estuvieran cargados', function () {
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 2);
    renglonDe($p, 50.0, 1);

    // Se cachea la relacion y el subtotal ANTES del cambio.
    $p->load('renglones');
    expect($p->subtotal())->toBe('250.00');

    $renglon->update(['es_cortesia' => true]);

    expect($p->subtotal())->toBe('50.00');

    $renglon->update(['es_cortesia' => false]);

    expect($p->subtotal())->toBe('250.00');
});

test('quitar la cortesia devuelve el importe CON su margen y su ajuste', function () {
    // El sistema viejo recalcula precio x cantidad y pierde el margen (cortecia.php:24).
    // Aqui el importe se deriva de los valores congelados, asi que no se puede perder.
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 1150.0, 1, margen: 50.0, ajuste: 'comision_131');

    $antes = $renglon->importe();
    expect($antes)->toBe('1514.31');

    $renglon->update(['es_cortesia' => true]);
    expect($renglon->fresh()->importe())->toBe('0.00');

    $renglon->update(['es_cortesia' => false]);
    expect($renglon->fresh()->importe())->toBe($antes);
});

test('el endpoint marca y desmarca la cortesia', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 1);
    $base = "/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/cortesia";

    $this->patchJson($base, ['es_cortesia' => true])
        ->assertOk()
        ->assertJsonPath('prefactura.subtotal', '0.00');

    expect($renglon->fresh()->es_cortesia)->toBeTrue();

    $this->patchJson($base, ['es_cortesia' => false])
        ->assertOk()
        ->assertJsonPath('prefactura.subtotal', '100.00');

    expect($renglon->fresh()->es_cortesia)->toBeFalse();
});

test('la ficha dice cuales renglones son cortesia: con importe 0.00 solo no se distingue de un servicio gratis', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 1);
    renglonDe($p, 50.0, 1);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/cortesia", ['es_cortesia' => true])
        ->assertOk()
        ->assertJsonPath('prefactura.renglones.0.es_cortesia', true)
        ->assertJsonPath('prefactura.renglones.0.importe', '0.00')
        ->assertJsonPath('prefactura.renglones.1.es_cortesia', false);

    $this->getJson("/api/facturacion/prefacturas/{$p->id}")
        ->assertJsonPath('prefactura.renglones.0.es_cortesia', true);
});

test('la cortesia queda en la bitacora, con el importe que deja de cobrarse', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 3);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/cortesia", ['es_cortesia' => true])->assertOk();

    $registro = Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)->where('accion', Bitacora::ACCION_ACTUALIZAR)->sole();

    expect($registro->descripcion)->toContain('cortesía')
        ->and($registro->descripcion)->toContain('300.00');
});

test('al quitar la cortesia la bitacora registra el importe que vuelve a cobrarse, con su margen y su ajuste', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 1150.0, 1, margen: 50.0, ajuste: 'comision_131');
    $base = "/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/cortesia";

    $this->patchJson($base, ['es_cortesia' => true])->assertOk();
    $this->patchJson($base, ['es_cortesia' => false])->assertOk();

    $registros = Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)
        ->where('accion', Bitacora::ACCION_ACTUALIZAR)->orderBy('id')->get();

    // Las dos entradas dicen la MISMA cifra: la que se deja de cobrar / se vuelve a cobrar.
    expect($registros)->toHaveCount(2)
        ->and($registros[0]->descripcion)->toContain('1514.31')
        ->and($registros[1]->descripcion)->toContain('1514.31')
        ->and($registros[1]->descripcion)->toContain('Se quitó la cortesía');
});

test('repetir el mismo valor no escribe ni registra nada: no hubo cambio', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 3);
    $base = "/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/cortesia";

    // Ya esta sin cortesia: pedir «false» no cambia nada.
    $this->patchJson($base, ['es_cortesia' => false])->assertOk()->assertJsonPath('prefactura.subtotal', '300.00');
    expect(Bitacora::count())->toBe(0);

    $this->patchJson($base, ['es_cortesia' => true])->assertOk();
    $this->patchJson($base, ['es_cortesia' => true])->assertOk()->assertJsonPath('prefactura.subtotal', '0.00');

    // Una sola entrada, la del cambio real; la repeticion no dijo «por 0.00».
    expect(Bitacora::count())->toBe(1)
        ->and(Bitacora::sole()->descripcion)->toContain('300.00');
});

test('una prefactura cerrada no admite cortesia', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    $renglon = $p->renglones()->sole();
    cerrarConSello($p, '100.00', '16.00', '116.00');

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/cortesia", ['es_cortesia' => true])
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_cerrada');

    expect($renglon->fresh()->es_cortesia)->toBeFalse();
});

test('un borrador descartado no admite cortesia', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 1);
    $p->update(['status' => FactPrefactura::STATUS_INACTIVO]);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/cortesia", ['es_cortesia' => true])
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_descartada');

    expect($renglon->fresh()->es_cortesia)->toBeFalse();
});

test('es_cortesia es obligatorio y booleano', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 1);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/cortesia", [])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['es_cortesia']);
});

test('el renglon de otra prefactura no se puede marcar desde esta', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $ajena = prefacturaBorrador();
    $renglon = renglonDe($ajena, 100.0, 1);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/cortesia", ['es_cortesia' => true])
        ->assertNotFound();

    expect($renglon->fresh()->es_cortesia)->toBeFalse();
});
