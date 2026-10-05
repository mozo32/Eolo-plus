<?php

use App\Models\Bitacora;
use App\Models\FactAeronave;
use App\Models\FactPrefactura;
use App\Models\FactServicio;
use App\Services\CargosEstancia;

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

test('es_cortesia no booleano se rechaza: el texto "false" no marca la cortesia', function (mixed $valor) {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 1);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/cortesia", ['es_cortesia' => $valor])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['es_cortesia']);

    expect($renglon->fresh()->es_cortesia)->toBeFalse()
        ->and(Bitacora::count())->toBe(0);
})->with(['false', 'si', 'cortesia', 2]);

test('la bitacora guarda el estado de antes y el de despues, sin invertirlos', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 3);
    $base = "/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/cortesia";

    $this->patchJson($base, ['es_cortesia' => true])->assertOk();
    $this->patchJson($base, ['es_cortesia' => false])->assertOk();

    [$marca, $quita] = Bitacora::where('accion', Bitacora::ACCION_ACTUALIZAR)->orderBy('id')->get()->all();

    expect($marca->datos_anteriores)->toBe(['renglon_id' => $renglon->id, 'es_cortesia' => false])
        ->and($marca->datos_nuevos)->toBe(['renglon_id' => $renglon->id, 'es_cortesia' => true, 'importe' => '300.00'])
        ->and($quita->datos_anteriores)->toBe(['renglon_id' => $renglon->id, 'es_cortesia' => true])
        ->and($quita->datos_nuevos)->toBe(['renglon_id' => $renglon->id, 'es_cortesia' => false, 'importe' => '300.00']);
});

test('recalcular la estancia conserva la cortesia de un renglon aunque cambie la cantidad, y lo dice', function () {
    $p = conEstancia();
    $cargos = app(CargosEstancia::class);

    $cargos->recalcular($p, pernoctas: 1, transitos2h: 0, transitos12h: 0);
    $p->fresh()->renglones()->sole()->update(['es_cortesia' => true]);
    expect($p->fresh()->subtotal())->toBe('0.00');

    // Otra cantidad: no es cambiar de opinion sobre la cortesia.
    $resultado = $cargos->recalcular($p->fresh(), pernoctas: 5, transitos2h: 0, transitos12h: 0);

    $renglon = $p->fresh()->renglones()->sole();

    expect($renglon->cantidad)->toBe(5)
        ->and($renglon->es_cortesia)->toBeTrue()
        ->and($renglon->importe())->toBe('0.00')
        ->and($p->fresh()->subtotal())->toBe('0.00')
        // La cifra que se deja de cobrar crecio (5 x 4676.00): el aviso la dice.
        ->and($resultado['motivo'])->toBe('Se conservó la cortesía de 1 renglón de estancia: pernocta (no se cobran 23380.00).');
});

test('un renglon de estancia sin cortesia sigue sin ella, y solo se avisa de los que la conservan', function () {
    $p = conEstancia();
    $cargos = app(CargosEstancia::class);

    $cargos->recalcular($p, pernoctas: 1, transitos2h: 1, transitos12h: 1);
    $p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->sole()->update(['es_cortesia' => true]);

    $resultado = $cargos->recalcular($p->fresh(), pernoctas: 2, transitos2h: 3, transitos12h: 1);

    $porConcepto = $p->fresh()->renglones->keyBy('concepto');

    expect($porConcepto[FactServicio::CONCEPTO_ESTANCIA_PERNOCTA]->es_cortesia)->toBeTrue()
        ->and($porConcepto[FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H]->es_cortesia)->toBeFalse()
        ->and($porConcepto[FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H]->es_cortesia)->toBeFalse()
        ->and($resultado['motivo'])->toContain('1 renglón')->toContain('pernocta')
        ->and($resultado['motivo'])->not->toContain('tránsito');
});

test('si se conserva la cortesia de varios renglones, el aviso los cuenta y los nombra', function () {
    $p = conEstancia();
    $cargos = app(CargosEstancia::class);

    $cargos->recalcular($p, pernoctas: 1, transitos2h: 1, transitos12h: 0);
    $p->fresh()->renglones->each(fn ($r) => $r->update(['es_cortesia' => true]));

    $resultado = $cargos->recalcular($p->fresh(), pernoctas: 1, transitos2h: 2, transitos12h: 0);

    expect($resultado['motivo'])->toContain('2 renglones')
        ->toContain('pernocta (no se cobran 4676.00)')
        ->toContain('tránsito de 2 horas (no se cobran 2289.00)');
});

test('sin cortesias previas el recalculo no dice nada de cortesia', function () {
    $p = conEstancia();

    $resultado = app(CargosEstancia::class)->recalcular($p, pernoctas: 2, transitos2h: 0, transitos12h: 0);

    expect($resultado['motivo'])->toBeNull()
        ->and($p->fresh()->renglones()->sole()->es_cortesia)->toBeFalse();
});

test('por el endpoint, recalcular la estancia conserva la cortesia y el mensaje lo dice', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = conEstancia();
    app(CargosEstancia::class)->recalcular($p, pernoctas: 1, transitos2h: 0, transitos12h: 0);
    $p->fresh()->renglones()->sole()->update(['es_cortesia' => true]);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/estancia", ['pernoctas' => 3, 'transitos_2h' => 0, 'transitos_12h' => 0])
        ->assertOk()
        ->assertJsonPath('motivo', 'Se conservó la cortesía de 1 renglón de estancia: pernocta (no se cobran 14028.00).');

    expect($p->fresh()->renglones()->sole()->es_cortesia)->toBeTrue();
});

/** Marca como cortesia los renglones de estancia de los conceptos dados. */
function marcarCortesiaDeEstancia(FactPrefactura $p, string ...$conceptos): void
{
    foreach ($conceptos as $concepto) {
        $p->fresh()->renglones()->where('concepto', $concepto)->sole()->update(['es_cortesia' => true]);
    }
}

test('una cortesia que pasa a cantidad 0 se avisa como perdida aunque otro concepto se recree, y al volver nace cobrada', function () {
    $p = conEstancia();
    $cargos = app(CargosEstancia::class);

    $cargos->recalcular($p, pernoctas: 1, transitos2h: 1, transitos12h: 0);
    marcarCortesiaDeEstancia($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);

    $resultado = $cargos->recalcular($p->fresh(), pernoctas: 0, transitos2h: 2, transitos12h: 0);

    // El motivo ya no es null: un renglon se recreo, pero otro perdio su cortesia.
    expect($resultado['renglones'])->toBe(1)
        ->and($resultado['motivo'])->toBe('Se perdió la cortesía de 1 renglón de estancia que dejó de existir: pernocta. Si ese concepto vuelve a tener cantidad, se cobrará completo.');

    // Y el aviso no mintio: al volver la cantidad, nace cobrado completo.
    $cargos->recalcular($p->fresh(), pernoctas: 3, transitos2h: 2, transitos12h: 0);
    $pernocta = $p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->sole();

    expect($pernocta->es_cortesia)->toBeFalse()
        ->and($pernocta->importe())->toBe('14028.00');
});

test('una aeronave en Guarda con una cortesia previa dice que se perdio, junto a lo que ya decia', function () {
    $p = conEstancia();
    $cargos = app(CargosEstancia::class);

    $cargos->recalcular($p, pernoctas: 1, transitos2h: 1, transitos12h: 0);
    marcarCortesiaDeEstancia($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);
    FactAeronave::where('aeronave_id', $p->aeronave_id)->update(['estatus' => FactAeronave::ESTATUS_GUARDA]);

    $resultado = $cargos->recalcular($p->fresh(), pernoctas: 1, transitos2h: 1, transitos12h: 0);

    expect($resultado['renglones'])->toBe(0)
        ->and($resultado['motivo'])->toStartWith('La aeronave está en Guarda')
        ->toContain(' Se quitaron 2 renglones de estancia que ya tenía la prefactura. Se perdió la cortesía de 1 renglón de estancia que dejó de existir: pernocta.');
});

test('una aeronave sin ficha con una cortesia previa tambien dice que se perdio', function () {
    $p = conEstancia();
    $cargos = app(CargosEstancia::class);

    $cargos->recalcular($p, pernoctas: 1, transitos2h: 1, transitos12h: 1);
    marcarCortesiaDeEstancia($p, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H);
    FactAeronave::where('aeronave_id', $p->aeronave_id)->delete();

    $resultado = $cargos->recalcular($p->fresh(), pernoctas: 1, transitos2h: 1, transitos12h: 1);

    expect($resultado['motivo'])->toStartWith('La matrícula no tiene ficha')
        ->toContain('Se quitaron 3 renglones')
        ->toEndWith('Se perdió la cortesía de 2 renglones de estancia que dejaron de existir: tránsito de 2 horas, tránsito de 12 horas. Si esos conceptos vuelven a tener cantidad, se cobrarán completos.');
});

test('Guarda sin ninguna cortesia previa no menciona cortesias', function () {
    $p = conEstancia();
    $cargos = app(CargosEstancia::class);

    $cargos->recalcular($p, pernoctas: 1, transitos2h: 0, transitos12h: 0);
    FactAeronave::where('aeronave_id', $p->aeronave_id)->update(['estatus' => FactAeronave::ESTATUS_GUARDA]);

    $resultado = $cargos->recalcular($p->fresh(), pernoctas: 1, transitos2h: 0, transitos12h: 0);

    expect($resultado['motivo'])->not->toContain('cortesía');
});

test('caso mixto: una cortesia se conserva, otra se pierde, y un concepto nuevo nace sin cortesia sin nombrarse', function () {
    $p = conEstancia();
    $cargos = app(CargosEstancia::class);

    $cargos->recalcular($p, pernoctas: 1, transitos2h: 1, transitos12h: 0);
    marcarCortesiaDeEstancia($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H);

    // Pernocta se recrea (conserva); transito 2 h pasa a 0 (pierde); transito 12 h NO existia antes.
    $resultado = $cargos->recalcular($p->fresh(), pernoctas: 1, transitos2h: 0, transitos12h: 2);

    $porConcepto = $p->fresh()->renglones->keyBy('concepto');

    expect($porConcepto[FactServicio::CONCEPTO_ESTANCIA_PERNOCTA]->es_cortesia)->toBeTrue()
        ->and($porConcepto->has(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H))->toBeFalse()
        ->and($porConcepto[FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H]->es_cortesia)->toBeFalse()
        ->and($p->fresh()->subtotal())->toBe('4676.00')
        ->and($resultado['motivo'])->toBe(
            'Se conservó la cortesía de 1 renglón de estancia: pernocta (no se cobran 4676.00). '
            .'Se perdió la cortesía de 1 renglón de estancia que dejó de existir: tránsito de 2 horas. Si ese concepto vuelve a tener cantidad, se cobrará completo.'
        );
});

test('los avisos se concatenan al motivo previo, en orden: motivo, conservadas, perdidas', function () {
    $p = conEstancia();
    $cargos = app(CargosEstancia::class);

    $cargos->recalcular($p, pernoctas: 1, transitos2h: 1, transitos12h: 0);
    marcarCortesiaDeEstancia($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H);

    // Ya no hay tarifa de pernocta: su renglon no se recrea y pierde la cortesia.
    FactAeronave::where('aeronave_id', $p->aeronave_id)->update(['tarifa_pernocta' => null]);

    $resultado = $cargos->recalcular($p->fresh(), pernoctas: 1, transitos2h: 1, transitos12h: 0);

    expect($resultado['motivo'])->toBe(
        'No se pudo determinar el precio de pernocta (sin tarifa en la matrícula ni en su categoría), así que no se cobró. '
        .'Se conservó la cortesía de 1 renglón de estancia: tránsito de 2 horas (no se cobran 1144.50). '
        .'Se perdió la cortesía de 1 renglón de estancia que dejó de existir: pernocta. Si ese concepto vuelve a tener cantidad, se cobrará completo.'
    );
});

test('sin tarifa y sin conservar nada, la cortesia perdida se avisa pegada al motivo de la tarifa', function () {
    $p = conEstancia();
    $cargos = app(CargosEstancia::class);

    $cargos->recalcular($p, pernoctas: 1, transitos2h: 0, transitos12h: 0);
    marcarCortesiaDeEstancia($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);
    FactAeronave::where('aeronave_id', $p->aeronave_id)->update(['tarifa_pernocta' => null]);

    $resultado = $cargos->recalcular($p->fresh(), pernoctas: 1, transitos2h: 0, transitos12h: 0);

    expect($resultado['motivo'])->toBe(
        'No se pudo determinar el precio de pernocta (sin tarifa en la matrícula ni en su categoría), así que no se cobró. '
        .'Se perdió la cortesía de 1 renglón de estancia que dejó de existir: pernocta. Si ese concepto vuelve a tener cantidad, se cobrará completo.'
    );
});
