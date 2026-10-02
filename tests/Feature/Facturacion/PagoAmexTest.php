<?php

use App\Models\Bitacora;
use App\Models\FactConfiguracion;
use App\Models\FactFormaPago;
use App\Models\FactPrefactura;
use App\Models\FactPrefacturaRenglon;
use App\Models\FactServicio;
use App\Services\PagosPrefactura;
use App\Support\ComisionAmex;

/** Un borrador con subtotal 100,000.00 (o el indicado) y el servicio de comisión en el catálogo. */
function paraAmex(float $subtotal = 100000.0): FactPrefactura
{
    FactServicio::firstOrCreate(
        ['nombre' => 'Comisión AMEX'],
        ['precio_unitario' => 0.0, 'concepto' => FactServicio::CONCEPTO_COMISION_AMEX],
    );
    formasDePago();

    $p = prefacturaBorrador();
    renglonDe($p, $subtotal, 1);

    return $p->fresh();
}

function comisionesDe(FactPrefactura $p)
{
    return FactPrefacturaRenglon::where('prefactura_id', $p->id)->where('concepto', FactServicio::CONCEPTO_COMISION_AMEX);
}

test('el pago Amex agrega la comision como renglon y registra el monto tecleado', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();

    // 1000 / 1.2296 = 813.27...  y el 6% de eso es 48.80.
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.00'])
        ->assertCreated()
        ->assertJsonPath('comision', '48.80');

    $comision = comisionesDe($p)->sole();

    expect($comision->importe())->toBe('48.80')
        ->and((string) $comision->precio_unitario)->toBe('48.8000')
        ->and($comision->cantidad)->toBe(1)
        ->and($comision->margen)->toBe('0.00')
        ->and($comision->ajuste_precio)->toBe('ninguno')
        ->and($comision->es_de_tercero)->toBeFalse()
        ->and($p->fresh()->subtotal())->toBe('100048.80')
        ->and($p->fresh()->pagado())->toBe('1000.00');

    // El pago apunta a SU renglon de comision.
    $pago = $p->fresh()->pagos()->sole();
    expect($pago->renglon_comision_id)->toBe($comision->id)
        ->and($pago->formaPago->concepto)->toBe(FactFormaPago::CONCEPTO_AMEX);
});

test('la respuesta trae el pago, la comision y la ficha ya actualizada de la prefactura', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.00'])
        ->assertCreated()
        ->assertJsonPath('pago_id', $p->fresh()->pagos()->sole()->id)
        ->assertJsonPath('prefactura.subtotal', '100048.80')
        ->assertJsonPath('prefactura.pagado', '1000.00');
});

test('la comision usa la misma formula que ComisionAmex y no una copia', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();

    $respuesta = $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '105.28'])->assertCreated();

    expect($respuesta->json('comision'))->toBe(ComisionAmex::calcular('105.28', $p->fresh()->ivaTasa()));
});

test('la comision usa la tasa de IVA vigente, no un literal', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    FactConfiguracion::updateOrCreate(
        ['clave' => 'iva_tasa'],
        ['valor' => '0.08', 'descripcion' => 'Tasa de IVA de prueba'],
    );
    $p = paraAmex();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.00'])
        ->assertCreated()
        ->assertJsonPath('comision', '52.41');
});

test('el monto Amex no puede superar el subtotal', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '100000.01'])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'comision_supera_subtotal')
        ->assertJsonPath('message', fn ($m) => str_contains($m, 'subtotal'));

    expect($p->fresh()->pagos()->count())->toBe(0)
        ->and($p->fresh()->renglones()->count())->toBe(1);

    // El monto igual al subtotal SI pasa.
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '100000.00'])->assertCreated();
});

test('el monto Amex tampoco puede superar lo que falta por cobrar, con su propio codigo', function () {
    // El sistema viejo topaba a Amex por `Total - caja` (caia en la rama `else` de
    // mpago.php). `registrarAmex()` no pasa por `registrar()`, asi que la regla se
    // escribe aqui.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();
    pagoDe($p, formasDePago()['Visa'], '115000.00');   // total 116,000.00: faltan 1,000.00

    // 5,000 es MENOR que el subtotal (100,000): no es la comprobacion del subtotal.
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '5000.00'])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'amex_supera_lo_que_falta')
        ->assertJsonPath('message', fn ($m) => str_contains($m, 'falta por cobrar') && ! str_contains($m, 'subtotal'));

    expect($p->fresh()->pagos()->count())->toBe(1)
        ->and($p->fresh()->renglones()->count())->toBe(1)
        ->and(comisionesDe($p)->count())->toBe(0)
        ->and(Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)->count())->toBe(0);
});

test('las dos comprobaciones de tope no son la misma: cada una rechaza lo que la otra deja pasar', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();

    // Sin pagos, solo el subtotal topa.
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '100000.01'])
        ->assertStatus(422)->assertJsonPath('codigo', 'comision_supera_subtotal');

    // Con la cuenta casi saldada, topa lo que falta aunque el subtotal sobre.
    pagoDe($p, formasDePago()['Visa'], '115900.00');
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.00'])
        ->assertStatus(422)->assertJsonPath('codigo', 'amex_supera_lo_que_falta');
});

test('el tope de lo que falta se comprueba DESPUES de agregar la comision', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();
    pagoDe($p, formasDePago()['Visa'], '115000.00');   // faltan 1,000.00 ANTES de la comision

    // Liquidar con Amex exige cargar mas de lo que falta: la comision (51.24) agranda la
    // deuda. 1,050.00 supera lo que falta antes (1,000.00) pero no lo que falta despues
    // (1,059.44), y es el pago que de verdad salda la cuenta.
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1050.00'])
        ->assertCreated()
        ->assertJsonPath('comision', '51.24');

    expect($p->fresh()->total())->toBe('116059.44')
        ->and($p->fresh()->pagado())->toBe('116050.00')
        ->and($p->fresh()->sobrepago())->toBe('0.00')
        ->and($p->fresh()->porCobrar())->toBe('9.44');
});

test('el borde exacto del tope: lo que falta con la comision se acepta y un centavo mas se rechaza', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();
    pagoDe($p, formasDePago()['Visa'], '115000.00');

    // Con 1,060.00 la comision es 51.72 y el total 116,060.00: pagado y total empatan.
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1060.01'])
        ->assertStatus(422)->assertJsonPath('codigo', 'amex_supera_lo_que_falta');

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1060.00'])->assertCreated();

    expect($p->fresh()->total())->toBe('116060.00')
        ->and($p->fresh()->pagado())->toBe('116060.00')
        ->and($p->fresh()->sobrepago())->toBe('0.00');
});

test('una prefactura ya sobrepagada no admite otro pago Amex', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();
    pagoDe($p, formasDePago()['efectivo'], '120000.00');   // sobre 116,000.00

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '100.00'])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'amex_supera_lo_que_falta');
});

test('el segundo pago Amex se compara contra un subtotal que YA incluye la comision del primero', function () {
    // Como el viejo: `mpamex.php` lee `tb_prefcatura.subtotal`, que `prefactura.php`
    // recalcula con todas las ventas, comisiones incluidas.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex(1000.0);

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '10.00'])
        ->assertCreated()->assertJsonPath('comision', '0.49');   // subtotal 1,000.49

    // 1,000.50 supera el subtotal actual (1,000.49)...
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.50'])
        ->assertStatus(422)->assertJsonPath('codigo', 'comision_supera_subtotal');

    // ...y 1,000.49 lo iguala. Contra el subtotal ORIGINAL (1,000.00) ya habria sobrado.
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.49'])->assertCreated();

    expect(comisionesDe($p)->count())->toBe(2);
});

test('si falta el servicio de comision responde 422 y NO escribe nada', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();
    FactServicio::porConcepto(FactServicio::CONCEPTO_COMISION_AMEX)->update(['status' => FactServicio::STATUS_INACTIVO]);

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.00'])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'servicio_comision_no_disponible')
        ->assertJsonPath('message', fn ($m) => str_contains($m, 'comision_amex'));

    expect($p->fresh()->pagos()->count())->toBe(0)
        ->and($p->fresh()->renglones()->count())->toBe(1);
});

test('si el servicio de comision no existe en el catalogo tambien responde 422', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();
    FactServicio::porConcepto(FactServicio::CONCEPTO_COMISION_AMEX)->delete();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.00'])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'servicio_comision_no_disponible');
});

test('si la forma de pago Amex esta de baja responde 422 y NO escribe nada', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();
    FactFormaPago::porConcepto(FactFormaPago::CONCEPTO_AMEX)->update(['status' => FactFormaPago::STATUS_INACTIVO]);

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.00'])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'forma_de_pago_no_disponible');

    expect($p->fresh()->pagos()->count())->toBe(0)
        ->and($p->fresh()->renglones()->count())->toBe(1);
});

test('con una tasa de IVA ilegible no hay total contra el que topar y no se escribe nada', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    FactConfiguracion::updateOrCreate(['clave' => 'iva_tasa'], ['valor' => 'abc', 'descripcion' => 'Tasa de IVA rota']);
    $p = paraAmex();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.00'])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'totales_no_calculables');

    expect($p->fresh()->pagos()->count())->toBe(0)
        ->and($p->fresh()->renglones()->count())->toBe(1);
});

test('quitar el pago Amex quita SU comision y no las demas', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();

    $primero = $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.00'])->assertCreated()->json('pago_id');
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '2000.00'])->assertCreated();

    expect(comisionesDe($p)->count())->toBe(2);

    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/pagos/{$primero}")->assertOk();

    // El sistema viejo (eliminar_f.php) borraria LAS DOS.
    $quedan = comisionesDe($p)->get();
    expect($quedan)->toHaveCount(1)
        ->and($quedan->first()->importe())->toBe(ComisionAmex::calcular('2000.00', '0.1600'))
        ->and($p->fresh()->pagos()->count())->toBe(1);
});

test('dos pagos Amex seguidos crean dos comisiones, cada una vinculada a su pago', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();

    $a = $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.00'])->assertCreated()->json('pago_id');
    $b = $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '2000.00'])->assertCreated()->json('pago_id');

    $pagos = $p->fresh()->pagos()->get()->keyBy('id');

    expect($pagos[$a]->renglon_comision_id)->not->toBe($pagos[$b]->renglon_comision_id)
        ->and($pagos[$a]->renglonComision->importe())->toBe('48.80')
        ->and($pagos[$b]->renglonComision->importe())->toBe(ComisionAmex::calcular('2000.00', '0.1600'))
        ->and(comisionesDe($p)->count())->toBe(2);
});

test('una prefactura cerrada no admite pago Amex', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();
    cerrarConSello($p, '100000.00', '16000.00', '116000.00');

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.00'])
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_cerrada');
});

test('un borrador descartado no admite pago Amex', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();
    $p->update(['status' => FactPrefactura::STATUS_INACTIVO]);

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.00'])
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_descartada');

    expect($p->fresh()->pagos()->count())->toBe(0);
});

test('el renglon de comision congela su precio: cambiar el catalogo no lo mueve', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.00'])->assertCreated();

    FactServicio::porConcepto(FactServicio::CONCEPTO_COMISION_AMEX)->first()->update(['precio_unitario' => 999.0, 'margen' => 50]);

    expect($p->fresh()->subtotal())->toBe('100048.80');
});

test('el catalogo con margen y ajuste NO mueve la comision: se crea con margen 0 y sin ajuste', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();
    FactServicio::porConcepto(FactServicio::CONCEPTO_COMISION_AMEX)->update(['margen' => 50, 'ajuste_precio' => FactServicio::AJUSTE_MAS_5]);

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.00'])
        ->assertCreated()
        ->assertJsonPath('comision', '48.80');

    expect(comisionesDe($p)->sole()->importe())->toBe('48.80');
});

test('la comision sale de la prefactura si se marca como cortesia, pero el pago sigue', function () {
    // Caso raro y legitimo: la comision se absorbe. El pago a la tarjeta ya se hizo.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.00'])->assertCreated();
    $comision = comisionesDe($p)->sole();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$comision->id}/cortesia", ['es_cortesia' => true])->assertOk();

    expect($p->fresh()->subtotal())->toBe('100000.00')
        ->and($p->fresh()->pagado())->toBe('1000.00');
});

test('el monto se normaliza como en los demas pagos y se valida con las mismas reglas', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.5'])->assertCreated();
    expect((string) $p->fresh()->pagos()->sole()->monto)->toBe('1000.50');

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '10.123'])->assertStatus(422)->assertJsonValidationErrors(['monto']);
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '0'])->assertStatus(422)->assertJsonValidationErrors(['monto']);
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", [])->assertStatus(422)->assertJsonValidationErrors(['monto']);
    // No pide `forma_pago_id`: la forma la resuelve el servicio.
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '5.00'])->assertCreated();
});

test('el servicio normaliza el monto por si lo llama quien no pasa por el Form Request', function () {
    $p = paraAmex();

    $pago = app(PagosPrefactura::class)->registrarAmex($p, '.50', $p->user_id);

    expect((string) $pago->monto)->toBe('0.50');

    expect(fn () => app(PagosPrefactura::class)->registrarAmex($p, '1e3', $p->user_id))
        ->toThrow(InvalidArgumentException::class);
});

test('la bitacora recibe el pago y su comision, dentro de la transaccion', function () {
    $this->actingAs($usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();

    $pago = $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.00'])->assertCreated()->json('pago_id');

    $alta = Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)->where('accion', Bitacora::ACCION_CREAR)->sole();

    expect($alta->registro_id)->toBe($p->id)
        ->and($alta->usuario_id)->toBe($usuario->id)
        ->and($alta->datos_nuevos)->toMatchArray(['pago_id' => $pago, 'forma_pago' => 'Amex', 'monto' => '1000.00', 'comision' => '48.80'])
        ->and($alta->descripcion)->toContain('1000.00')->toContain('48.80')->toContain("prefactura {$p->id}");
});

test('si la bitacora falla no queda ni el pago ni la comision', function () {
    $p = paraAmex();
    Bitacora::creating(fn () => throw new RuntimeException('la bitacora fallo'));

    expect(fn () => app(PagosPrefactura::class)->registrarAmex($p, '1000.00', $p->user_id))
        ->toThrow(RuntimeException::class, 'la bitacora fallo');

    expect($p->fresh()->pagos()->count())->toBe(0)
        ->and($p->fresh()->renglones()->count())->toBe(1);
});

test('registrarAmex toma el candado de la prefactura dentro de la transaccion', function () {
    $p = paraAmex();
    $consultas = [];

    DB::listen(function ($q) use (&$consultas) {
        $consultas[] = $q->sql;
    });

    app(PagosPrefactura::class)->registrarAmex($p, '1000.00', $p->user_id);

    // SQLite no escribe `for update`; la prueba comprueba que la prefactura se LEE antes
    // de la primera escritura, dentro de la misma transaccion que las inserciones.
    $iLectura = array_search(true, array_map(fn ($s) => str_contains($s, 'from "fact_prefacturas"'), $consultas), true);
    $iRenglon = array_search(true, array_map(fn ($s) => str_contains($s, 'insert into "fact_prefactura_renglones"'), $consultas), true);

    expect($iLectura)->not->toBeFalse()
        ->and($iRenglon)->not->toBeFalse()
        ->and($iLectura)->toBeLessThan($iRenglon);
});

test('el pago Amex por el endpoint generico sigue rechazado', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => formasDePago()['amex']->id, 'monto' => '100.00'])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'amex_por_su_endpoint');
});

/*
|--------------------------------------------------------------------------
| El total cae donde debe
|--------------------------------------------------------------------------
| El servicio rechaza un monto mayor que el subtotal, y el caso exacto de la
| formula (subtotal = monto / 1.2296, o sea monto > subtotal) queda fuera de lo
| que el servicio acepta. Se mide entonces con el modelo: el renglon de comision
| que el servicio crearia, sumado a un subtotal exacto.
*/

test('con un subtotal de monto / 1.2296 el total tras la comision cae en el monto tecleado', function () {
    $p = paraAmex(813.27);

    $comision = ComisionAmex::calcular('1000.00', $p->ivaTasa());
    $servicio = FactServicio::porConcepto(FactServicio::CONCEPTO_COMISION_AMEX)->sole();
    $p->renglones()->create([
        'servicio_id' => $servicio->id, 'nombre_servicio' => $servicio->nombre, 'precio_unitario' => $comision,
        'cantidad' => 1, 'es_de_tercero' => false, 'margen' => 0, 'ajuste_precio' => 'ninguno',
        'concepto' => FactServicio::CONCEPTO_COMISION_AMEX, 'orden' => 2,
    ]);

    expect($comision)->toBe('48.80')
        ->and($p->fresh()->subtotal())->toBe('862.07')
        ->and($p->fresh()->iva())->toBe('137.93')
        ->and($p->fresh()->total())->toBe('1000.00');
});

test('el redondeo de la comision desvia el total, como maximo, un centavo', function () {
    $p = paraAmex(813.27);
    $tasa = $p->ivaTasa();
    $desvios = [];

    for ($centavos = 100; $centavos <= 2_000_000; $centavos += 37) {
        $monto = bcdiv((string) $centavos, '100', 2);
        $subtotal = bcadd(bcdiv($monto, '1.2296', 6), '0.005', 2);
        $conComision = bcadd($subtotal, ComisionAmex::calcular($monto, $tasa), 2);
        $total = bcadd($conComision, FactPrefactura::calcularIva($conComision, $tasa), 2);

        $desvios[bcsub($total, $monto, 2)] = true;
    }

    // Solo hay tres desvios posibles: -0.01, 0.00 y 0.01. Nunca mas.
    expect(array_keys($desvios))->each->toBeIn(['-0.01', '0.00', '0.01']);
});
