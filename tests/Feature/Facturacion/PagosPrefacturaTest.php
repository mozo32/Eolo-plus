<?php

use App\Models\Bitacora;
use App\Models\FactFormaPago;
use App\Models\FactPrefactura;
use App\Models\FactPrefacturaPago;
use App\Models\FactPrefacturaRenglon;
use App\Models\FactServicio;
use App\Services\PagoNoPermitidoException;
use App\Services\PagosPrefactura;
use App\Services\PrefacturaDescartadaException;
use App\Services\RenglonDePrefacturaCerradaException;
use Illuminate\Support\Facades\DB;

/** Un borrador con un renglón de 100 (total 116.00) y las siete formas de pago. */
function paraCobrar(): array
{
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);

    return [$p->fresh(), formasDePago()];
}

function conCombustible(App\Models\FactPrefactura $p): void
{
    $servicio = FactServicio::create([
        'nombre' => 'Combustible JET A-1', 'precio_unitario' => 500.0, 'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE,
    ]);
    $p->renglones()->create([
        'servicio_id' => $servicio->id, 'nombre_servicio' => $servicio->nombre, 'precio_unitario' => 500.0,
        'cantidad' => 1, 'es_de_tercero' => false, 'margen' => 0, 'ajuste_precio' => 'ninguno',
        'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE, 'orden' => 9,
    ]);
}

test('una tarjeta cobra lo que falta y deja la prefactura cubierta', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas['Visa']->id, 'monto' => '116.00'])
        ->assertCreated()
        ->assertJsonPath('prefactura.pagado', '116.00')
        ->assertJsonPath('prefactura.por_cobrar', '0.00');

    expect($p->fresh()->pagos()->count())->toBe(1);
});

test('una tarjeta NO puede superar lo que falta', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas['Visa']->id, 'monto' => '116.01'])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'supera_lo_que_falta');

    expect($p->fresh()->pagos()->count())->toBe(0);
});

test('el tope de la tarjeta mira lo que FALTA, no el total', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    pagoDe($p, $formas['Visa'], '100.00');

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas['Mastercard']->id, 'monto' => '16.01'])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'supera_lo_que_falta');

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas['Mastercard']->id, 'monto' => '16.00'])
        ->assertCreated();
});

test('el efectivo SI puede exceder, y el exceso es cambio', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas[FactFormaPago::CONCEPTO_EFECTIVO]->id, 'monto' => '200.00'])
        ->assertCreated()
        ->assertJsonPath('prefactura.sobrepago', '84.00')
        ->assertJsonPath('prefactura.cambio', '84.00')
        ->assertJsonPath('prefactura.cobrado_de_mas', '0.00');
});

test('AvCard se rechaza cuando la prefactura tiene combustible', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    conCombustible($p);

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas[FactFormaPago::CONCEPTO_AVCARD]->id, 'monto' => '100.00'])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'avcard_con_combustible');

    expect($p->fresh()->pagos()->count())->toBe(0);
});

test('AvCard se acepta sin combustible y sin tope', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();

    // Sin tope, como el viejo: puede dejarla sobrepagada, y entonces NO es cambio.
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas[FactFormaPago::CONCEPTO_AVCARD]->id, 'monto' => '500.00'])
        ->assertCreated()
        ->assertJsonPath('prefactura.sobrepago', '384.00')
        ->assertJsonPath('prefactura.cambio', '0.00')
        ->assertJsonPath('prefactura.cobrado_de_mas', '384.00');
});

test('el combustible se detecta por concepto, no por el nombre del servicio', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    conCombustible($p);
    // Renombrarlo en el catalogo NO debe abrir la puerta a AvCard.
    FactServicio::porConcepto(FactServicio::CONCEPTO_COMBUSTIBLE)->first()->update(['nombre' => 'Turbosina']);
    // El renglon congela el nombre del servicio: tambien ese puede no decir «combustible».
    $p->renglones()->where('concepto', FactServicio::CONCEPTO_COMBUSTIBLE)->first()->update(['nombre_servicio' => 'Turbosina']);

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas[FactFormaPago::CONCEPTO_AVCARD]->id, 'monto' => '100.00'])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'avcard_con_combustible');
});

test('Amex no entra por este endpoint: tiene el suyo porque agrega comision', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas[FactFormaPago::CONCEPTO_AMEX]->id, 'monto' => '100.00'])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'amex_por_su_endpoint');
});

test('quitar un pago lo da de baja logica y lo deja de contar', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    $pago = pagoDe($p, $formas['Visa'], '116.00');

    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/pagos/{$pago->id}")
        ->assertOk()
        ->assertJsonPath('prefactura.pagado', '0.00');

    expect($pago->fresh()->status)->toBe(FactPrefacturaPago::STATUS_INACTIVO);
});

test('quitar dos veces el mismo pago responde 404 la segunda', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    $pago = pagoDe($p, $formas['Visa'], '116.00');

    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/pagos/{$pago->id}")->assertOk();
    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/pagos/{$pago->id}")->assertNotFound();
});

test('el pago de otra prefactura no se puede quitar desde esta', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    [$ajena] = paraCobrar();
    $pago = pagoDe($ajena, $formas['Visa'], '50.00');

    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/pagos/{$pago->id}")->assertNotFound();
});

test('una prefactura cerrada no admite pagos ni quitarlos', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    $formas = formasDePago();
    $pago = pagoDe($p, $formas['Visa'], '50.00');
    cerrarConSello($p, '100.00', '16.00', '116.00');

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas['Visa']->id, 'monto' => '10.00'])
        ->assertStatus(409)->assertJsonPath('codigo', 'ya_cerrada');

    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/pagos/{$pago->id}")
        ->assertStatus(409)->assertJsonPath('codigo', 'ya_cerrada');

    expect($p->fresh()->pagos()->count())->toBe(1);
});

test('un borrador descartado no admite pagos', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    $p->update(['status' => FactPrefactura::STATUS_INACTIVO]);

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas['Visa']->id, 'monto' => '10.00'])
        ->assertStatus(409)->assertJsonPath('codigo', 'ya_descartada');
});

test('el monto tiene que ser un decimal positivo de dos decimales', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    $ruta = "/api/facturacion/prefacturas/{$p->id}/pagos";

    foreach (['0', '-1.00', '1.234', 'x', ''] as $monto) {
        $this->postJson($ruta, ['forma_pago_id' => $formas['Visa']->id, 'monto' => $monto])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['monto']);
    }

    $this->postJson($ruta, ['monto' => '10.00'])->assertStatus(422)->assertJsonValidationErrors(['forma_pago_id']);
    $this->postJson($ruta, ['forma_pago_id' => 999999, 'monto' => '10.00'])->assertStatus(422)->assertJsonValidationErrors(['forma_pago_id']);
});

test('una forma de pago dada de baja no se puede usar', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    $formas['Visa']->update(['status' => FactFormaPago::STATUS_INACTIVO]);

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas['Visa']->id, 'monto' => '10.00'])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['forma_pago_id']);
});

test('cada pago y cada baja quedan en la bitacora, apuntando a su prefactura y con su contenido', function () {
    $this->actingAs($usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    [$otra] = paraCobrar();

    $pago = $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas['Visa']->id, 'monto' => '116.00'])
        ->assertCreated()->json('pago_id');
    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/pagos/{$pago}")->assertOk();

    $porModulo = fn (string $accion) => Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)->where('accion', $accion);
    $alta = $porModulo(Bitacora::ACCION_CREAR)->sole();
    $baja = $porModulo(Bitacora::ACCION_ELIMINAR)->sole();

    expect($alta->registro_id)->toBe($p->id)
        ->and($alta->usuario_id)->toBe($usuario->id)
        ->and($alta->datos_nuevos)->toBe(['pago_id' => $pago, 'forma_pago' => 'Visa', 'monto' => '116.00'])
        ->and($alta->descripcion)->toContain('116.00')->toContain('Visa')->toContain("prefactura {$p->id}")
        ->and($baja->registro_id)->toBe($p->id)
        ->and($baja->usuario_id)->toBe($usuario->id)
        ->and($baja->datos_anteriores)->toMatchArray(['pago_id' => $pago, 'forma_pago' => 'Visa', 'monto' => '116.00', 'comision_quitada' => false])
        ->and($porModulo(Bitacora::ACCION_CREAR)->where('registro_id', $otra->id)->count())->toBe(0);
});

test('registrar es atomico: si la bitacora falla, el pago no queda', function () {
    [$p, $formas] = paraCobrar();
    Bitacora::creating(fn () => throw new RuntimeException('la bitacora fallo'));

    expect(fn () => app(PagosPrefactura::class)->registrar($p, $formas['Visa']->id, '50.00', $p->user_id))
        ->toThrow(RuntimeException::class, 'la bitacora fallo');

    expect($p->fresh()->pagos()->count())->toBe(0);
});

test('quitar es atomico: si la bitacora falla, el pago sigue activo y su comision sigue en su sitio', function () {
    [$p, $formas] = paraCobrar();
    $comision = renglonDe($p, 10.0, 1);
    $pago = pagoDe($p, $formas[FactFormaPago::CONCEPTO_AMEX], '116.00');
    $pago->update(['renglon_comision_id' => $comision->id]);
    Bitacora::creating(fn () => throw new RuntimeException('la bitacora fallo'));

    expect(fn () => app(PagosPrefactura::class)->quitar($p, $pago->id, $p->user_id))
        ->toThrow(RuntimeException::class, 'la bitacora fallo');

    expect($pago->fresh()->status)->toBe(FactPrefacturaPago::STATUS_ACTIVO)
        ->and(FactPrefacturaRenglon::find($comision->id))->not->toBeNull();
});

test('quitar un pago con comision borra su renglon en la misma operacion', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    $comision = renglonDe($p, 10.0, 1);
    $pago = pagoDe($p, $formas[FactFormaPago::CONCEPTO_AMEX], '116.00');
    $pago->update(['renglon_comision_id' => $comision->id]);

    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/pagos/{$pago->id}")->assertOk();

    expect($pago->fresh()->status)->toBe(FactPrefacturaPago::STATUS_INACTIVO)
        ->and(FactPrefacturaRenglon::find($comision->id))->toBeNull();
});

test('quitar un pago cuyo renglon de comision se borro por otra via no falla', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    $comision = renglonDe($p, 10.0, 1);
    $pago = pagoDe($p, $formas[FactFormaPago::CONCEPTO_AMEX], '116.00');
    $pago->update(['renglon_comision_id' => $comision->id]);

    // Por el endpoint de renglones, que es la otra via: la FK deja el pago en NULL.
    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$comision->id}")->assertOk();
    expect($pago->fresh()->renglon_comision_id)->toBeNull();

    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/pagos/{$pago->id}")->assertOk();

    expect($pago->fresh()->status)->toBe(FactPrefacturaPago::STATUS_INACTIVO);
});

test('quitar un pago cuyo renglon de comision ya no existe, aunque siga apuntando a el, tampoco falla', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    $pago = pagoDe($p, $formas[FactFormaPago::CONCEPTO_AMEX], '116.00');

    // Un puntero colgante: la FK lo impide en una base real, asi que se difiere su
    // comprobacion (la transaccion de la prueba nunca llega a confirmarse).
    DB::statement('PRAGMA defer_foreign_keys = ON');
    DB::table('fact_prefactura_pagos')->where('id', $pago->id)->update(['renglon_comision_id' => 987654]);
    expect(DB::table('fact_prefactura_pagos')->where('id', $pago->id)->value('renglon_comision_id'))->toBe(987654);

    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/pagos/{$pago->id}")->assertOk();

    expect($pago->fresh()->status)->toBe(FactPrefacturaPago::STATUS_INACTIVO);
});

test('la guarda de cerrada sigue disparandose si se cierra entre el chequeo rapido y el candado', function () {
    [$p] = prefacturaCompleta(100.0, 1);
    $formas = formasDePago();
    $pago = pagoDe($p, $formas['Visa'], '50.00');
    $obsoleta = $p->fresh();                         // lo que el controlador leyo en su chequeo rapido
    cerrarConSello($p, '100.00', '16.00', '116.00'); // otra sesion cierra despues

    $servicio = app(PagosPrefactura::class);

    expect(fn () => $servicio->registrar($obsoleta, $formas['Visa']->id, '10.00', $p->user_id))
        ->toThrow(RenglonDePrefacturaCerradaException::class)
        ->and(fn () => $servicio->quitar($obsoleta, $pago->id, $p->user_id))
        ->toThrow(RenglonDePrefacturaCerradaException::class);

    expect($p->fresh()->pagos()->count())->toBe(1)
        ->and(Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)->count())->toBe(0);
});

test('lo mismo con el descarte: se descarta entre el chequeo rapido y el candado', function () {
    [$p, $formas] = paraCobrar();
    $pago = pagoDe($p, $formas['Visa'], '50.00');
    $obsoleta = $p->fresh();
    $p->update(['status' => FactPrefactura::STATUS_INACTIVO]);

    $servicio = app(PagosPrefactura::class);

    expect(fn () => $servicio->registrar($obsoleta, $formas['Visa']->id, '10.00', $p->user_id))
        ->toThrow(PrefacturaDescartadaException::class)
        ->and(fn () => $servicio->quitar($obsoleta, $pago->id, $p->user_id))
        ->toThrow(PrefacturaDescartadaException::class);
});

test('el endpoint traduce el descarte bajo candado a 409 ya_descartada', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    $pago = pagoDe($p, $formas['Visa'], '50.00');

    // El servicio lanza lo que lanzaria si el descarte llegara despues del chequeo rapido.
    $this->mock(PagosPrefactura::class)
        ->shouldReceive('registrar', 'quitar')
        ->andThrow(new PrefacturaDescartadaException('Este borrador está descartado.'));

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas['Visa']->id, 'monto' => '10.00'])
        ->assertStatus(409)->assertJsonPath('codigo', 'ya_descartada');
    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/pagos/{$pago->id}")
        ->assertStatus(409)->assertJsonPath('codigo', 'ya_descartada');
});

test('un rechazo de regla no deja pago ni bitacora', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas[FactFormaPago::CONCEPTO_AMEX]->id, 'monto' => '10.00'])
        ->assertStatus(422);

    expect($p->fresh()->pagos()->count())->toBe(0)
        ->and(Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)->count())->toBe(0);
});

test('el servicio normaliza el monto a dos decimales, y la bitacora lo dice asi', function () {
    [$p, $formas] = paraCobrar();
    $servicio = app(PagosPrefactura::class);

    $casos = ['50.5' => '50.50', '50' => '50.00', '.50' => '0.50', '5.' => '5.00', '+5.00' => '5.00', '+.5' => '0.50', '007.10' => '7.10'];

    // Efectivo: no topa contra lo que falta, y los siete casos suman mas que el total.
    foreach ($casos as $entrada => $esperado) {
        $pago = $servicio->registrar($p, $formas[FactFormaPago::CONCEPTO_EFECTIVO]->id, (string) $entrada, $p->user_id);
        $asiento = Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)
            ->where('accion', Bitacora::ACCION_CREAR)->orderByDesc('id')->first();

        expect($asiento->datos_nuevos['monto'])->toBe($esperado)
            ->and($asiento->datos_nuevos['pago_id'])->toBe($pago->id)
            ->and($asiento->descripcion)->toContain("pago de {$esperado} con");
    }
});

test('el servicio rechaza lo que no es un decimal positivo', function () {
    [$p, $formas] = paraCobrar();
    $servicio = app(PagosPrefactura::class);

    foreach (['0', '0.00', '.00', '-1', '-0.50', '1.234', 'x', '', '.', '+', '1e3', ' 5', '5 ', '1,5'] as $malo) {
        expect(fn () => $servicio->registrar($p, $formas['Visa']->id, $malo, $p->user_id))
            ->toThrow(InvalidArgumentException::class);
    }

    expect($p->fresh()->pagos()->count())->toBe(0);
});

test('el monto acepta lo mismo que el Form Request: .50, +5.00 y 5. no dan error de servidor', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();

    foreach (['.50' => '0.50', '+5.00' => '5.00', '5.' => '5.00'] as $entrada => $esperado) {
        $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas['Visa']->id, 'monto' => (string) $entrada])
            ->assertCreated();

        expect((string) $p->fresh()->pagos()->get()->last()->monto)->toBe($esperado);
    }
});

test('el tope del monto es el de la columna: pasarse es un rechazo de dominio, no un error de base', function () {
    [$p, $formas] = paraCobrar();
    $servicio = app(PagosPrefactura::class);
    $efectivo = $formas[FactFormaPago::CONCEPTO_EFECTIVO];

    // Los dos lados del tope. El efectivo no tiene tope de cobro, asi que solo el de la columna.
    $pago = $servicio->registrar($p, $efectivo->id, '9999999999.99', $p->user_id);
    expect((string) $pago->fresh()->monto)->toBe('9999999999.99');

    foreach (['10000000000.00', '10000000000', '10000000000.', '99999999999999.99'] as $demasiado) {
        try {
            $servicio->registrar($p, $efectivo->id, $demasiado, $p->user_id);
            $this->fail("El monto {$demasiado} debio rechazarse.");
        } catch (PagoNoPermitidoException $e) {
            expect($e->codigo)->toBe('monto_fuera_de_rango');
        }
    }

    expect($p->fresh()->pagos()->count())->toBe(1);
});

test('el Form Request y el servicio coinciden en el tope del monto', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    $ruta = "/api/facturacion/prefacturas/{$p->id}/pagos";
    $efectivo = $formas[FactFormaPago::CONCEPTO_EFECTIVO];

    $this->postJson($ruta, ['forma_pago_id' => $efectivo->id, 'monto' => '9999999999.99'])->assertCreated();
    $this->postJson($ruta, ['forma_pago_id' => $efectivo->id, 'monto' => '10000000000.00'])
        ->assertStatus(422)->assertJsonValidationErrors(['monto']);
});

test('una forma de pago dada de baja se rechaza tambien desde el servicio', function () {
    [$p, $formas] = paraCobrar();
    $formas['Visa']->update(['status' => FactFormaPago::STATUS_INACTIVO]);

    expect(fn () => app(PagosPrefactura::class)->registrar($p, $formas['Visa']->id, '10.00', $p->user_id))
        ->toThrow(PagoNoPermitidoException::class);
});

test('la ficha trae el bloque de cobro con sus cinco claves y la lista de pagos', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    pagoDe($p, $formas['Visa'], '100.00');

    $this->getJson("/api/facturacion/prefacturas/{$p->id}")
        ->assertOk()
        ->assertJsonPath('prefactura.pagado', '100.00')
        ->assertJsonPath('prefactura.por_cobrar', '16.00')
        ->assertJsonPath('prefactura.sobrepago', '0.00')
        ->assertJsonPath('prefactura.cambio', '0.00')
        ->assertJsonPath('prefactura.cobrado_de_mas', '0.00')
        ->assertJsonPath('prefactura.pagos.0.forma_pago', 'Visa')
        ->assertJsonPath('prefactura.pagos.0.monto', '100.00')
        ->assertJsonPath('prefactura.pagos.0.es_comision_amex', false);
});

test('quitar un pago cuya comision tiene un importe ilegible lo da de baja igual', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    $comision = renglonDe($p, 10.0, 1);
    $pago = pagoDe($p, $formas[FactFormaPago::CONCEPTO_AMEX], '116.00');
    $pago->update(['renglon_comision_id' => $comision->id]);
    DB::table('fact_prefactura_renglones')->where('id', $comision->id)->update(['ajuste_precio' => 'raro']);

    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/pagos/{$pago->id}")
        ->assertOk()
        ->assertJsonPath('prefactura.pagado', '0.00');

    expect($pago->fresh()->status)->toBe(FactPrefacturaPago::STATUS_INACTIVO)
        ->and(FactPrefacturaRenglon::find($comision->id))->toBeNull();

    $baja = Bitacora::where('accion', Bitacora::ACCION_ELIMINAR)->sole();
    expect($baja->descripcion)->toContain('su importe no se pudo calcular')
        ->and($baja->datos_anteriores)->toMatchArray(['comision' => null, 'comision_quitada' => true]);
});

test('un total que no se puede calcular rechaza la tarjeta con su propio codigo, no con un 500', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    DB::table('fact_prefactura_renglones')->where('prefactura_id', $p->id)->update(['ajuste_precio' => 'raro']);

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas['Visa']->id, 'monto' => '10.00'])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'totales_no_calculables');

    // El efectivo no topa contra el total: entra, y la ficha lo dice sin reventar.
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas[FactFormaPago::CONCEPTO_EFECTIVO]->id, 'monto' => '10.00'])
        ->assertCreated()
        ->assertJsonPath('prefactura.pagado', '10.00');
});

test('la ficha con un total ilegible trae el cobro en null y su propio cobro_error', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    pagoDe($p, $formas['Visa'], '30.00');
    DB::table('fact_prefactura_renglones')->where('prefactura_id', $p->id)->update(['ajuste_precio' => 'raro']);

    $ficha = $this->getJson("/api/facturacion/prefacturas/{$p->id}")->assertOk()->json('prefactura');

    expect($ficha['pagado'])->toBe('30.00')
        ->and($ficha['por_cobrar'])->toBeNull()
        ->and($ficha['sobrepago'])->toBeNull()
        ->and($ficha['cambio'])->toBeNull()
        ->and($ficha['cobrado_de_mas'])->toBeNull()
        ->and($ficha['cobro_error'])->toContain('No se puede calcular lo que falta por cobrar')
        ->and($ficha['pagos'])->toHaveCount(1);
});

test('la ficha sana trae cobro_error en null', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = paraCobrar();

    $this->getJson("/api/facturacion/prefacturas/{$p->id}")
        ->assertOk()
        ->assertJsonPath('prefactura.cobro_error', null);
});
