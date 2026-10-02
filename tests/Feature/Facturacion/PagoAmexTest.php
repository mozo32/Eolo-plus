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

test('la prefactura completa se paga de una sola pasada con Amex: el monto es el total y supera el subtotal', function () {
    // Un folio real del historico (el 75): subtotal guardado 1942.98 y UN solo pago Amex de
    // 2253.86. `Total / subtotal` es 1.16 exacto porque el subtotal guardado YA INCLUYE la
    // comision. El operador teclea el total que se carga a la tarjeta.
    //
    // La prefactura de PARTIDA no puede tener 1942.98: la comision todavia no esta. Se deriva:
    //   comision = ComisionAmex(2253.86, 16%) = 109.98
    //   subtotal de partida = 1942.98 - 109.98 = 1833.00
    // y al reves, 1833.00 + 109.98 = 1942.98, IVA 310.88, total 2253.86 = el monto tecleado.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex(1833.00);

    expect(ComisionAmex::calcular('2253.86', '0.1600'))->toBe('109.98');

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '2253.86'])
        ->assertCreated()
        ->assertJsonPath('comision', '109.98')
        ->assertJsonPath('prefactura.subtotal', '1942.98')
        ->assertJsonPath('prefactura.total', '2253.86')
        ->assertJsonPath('prefactura.pagado', '2253.86')
        ->assertJsonPath('prefactura.por_cobrar', '0.00')
        ->assertJsonPath('prefactura.sobrepago', '0.00');

    // El monto (2253.86) supera el subtotal de partida (1833.00) y tambien el final (1942.98).
    expect($p->fresh()->total())->toBe('2253.86');
});

test('el borde del pago completo: con subtotal 100,000.00 el total exacto es 122,960.00 y la comision absorbe unos centavos mas', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();

    // 1.2296 x 100,000.00: la comision de la formula es 6,000.00 y el total 122,960.00.
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '122960.00'])
        ->assertCreated()
        ->assertJsonPath('comision', '6000.00')
        ->assertJsonPath('prefactura.por_cobrar', '0.00');
});

test('la comision se ajusta dentro de su ventana y mas alla de ella el tope decide', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();

    // Hasta 6 centavos de total por encima de la formula se absorben (la comision sube 5).
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '122960.06'])
        ->assertCreated()
        ->assertJsonPath('comision', '6000.05')
        ->assertJsonPath('prefactura.por_cobrar', '0.00');

    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/pagos/{$p->fresh()->pagos()->sole()->id}")->assertOk();

    // Fuera de la ventana ningun candidato cuadra: se queda la formula (6,000.00, total 122,960.00)
    // y el tope rechaza lo que supera ese total.
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '122960.08'])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'amex_supera_lo_que_falta');

    expect($p->fresh()->pagos()->count())->toBe(0)
        ->and(comisionesDe($p)->count())->toBe(0);
});

test('un total que ningun centavo de comision alcanza deja la comision de la formula y el tope decide', function () {
    // Con subtotal 100,000.00 el total salta de 122,960.03 a 122,960.05 al subir la comision: el
    // 122,960.04 no existe. El 122,960.04 tecleado no se puede cuadrar; la formula da 6,000.00
    // (total 122,960.00, por debajo) y el tope lo rechaza. Es el caso que la ventana no resuelve.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '122960.04'])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'amex_supera_lo_que_falta');

    // Sus vecinos, que SI existen, se aceptan exactos.
    foreach (['122960.03', '122960.05'] as $monto) {
        $q = paraAmex();
        $this->postJson("/api/facturacion/prefacturas/{$q->id}/pagos/amex", ['monto' => $monto])
            ->assertCreated()
            ->assertJsonPath('prefactura.por_cobrar', '0.00');
    }
});

test('un pago parcial no mueve la comision: ningun candidato de la ventana cuadra', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '122900.00'])
        ->assertCreated()
        ->assertJsonPath('comision', ComisionAmex::calcular('122900.00', '0.1600'));

    expect($p->fresh()->porCobrar())->not->toBe('0.00');
});

/*
| Pagos Amex REALES del historico (tb_formas_pago / tb_venta de fact-fbo-prod). El subtotal de
| partida es la suma de los importes SIN la comision (id_servicio <> 100), que son decimales
| exactos: restarla del `subtotal` guardado, un float, mete ruido de varios centavos. Cada fila:
| folio, subtotal de partida, monto del pago, comision que la formula sola calcularia, y la
| comision que registro el sistema viejo.
*/
dataset('pagos amex reales que ya cuadraban', [
    'folio 26' => ['46427.00', '57086.64', '2785.62'],
    'folio 69' => ['16728.13', '20568.91', '1003.69'],
    'folio 75' => ['1833.00', '2253.86', '109.98'],
    'folio 94' => ['44974.85', '55301.07', '2698.49'],
]);

dataset('pagos amex reales que se desviaban', [
    // [partida, monto, comision de la formula, comision que cuadra (= la del sistema viejo), desvio de la formula]
    'folio 126 (+0.01)' => ['35759.95', '43970.43', '2145.60', '2145.59'],
    'folio 294 (-0.01)' => ['25418.57', '31254.68', '1525.11', '1525.12'],
    'folio 681 (-0.02)' => ['23862.06', '29340.80', '1431.72', '1431.73'],
    'folio 2522 (+0.04)' => ['106181.46', '130560.69', '6370.89', '6370.86'],
]);

test('un pago real que ya cuadraba NO mueve la comision: queda la de la formula, que es la del sistema viejo', function (string $partida, string $monto, string $comision) {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex((float) $partida);

    expect(ComisionAmex::calcular($monto, '0.1600'))->toBe($comision);

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => $monto])
        ->assertCreated()
        ->assertJsonPath('comision', $comision)
        ->assertJsonPath('prefactura.total', $monto)
        ->assertJsonPath('prefactura.por_cobrar', '0.00')
        ->assertJsonPath('prefactura.sobrepago', '0.00');

    $alta = Bitacora::where('accion', Bitacora::ACCION_CREAR)->sole();
    expect($alta->datos_nuevos)->toMatchArray(['comision' => $comision, 'comision_formula' => $comision]);
})->with('pagos amex reales que ya cuadraban');

test('un pago real que se desviaba cae EXACTO: la comision absorbe el redondeo y coincide con la del sistema viejo', function (string $partida, string $monto, string $formula, string $cuadra) {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex((float) $partida);

    // La formula sola NO cuadraba: el total quedaba lejos del monto en 1 a 4 centavos.
    expect(ComisionAmex::calcular($monto, '0.1600'))->toBe($formula)->not->toBe($cuadra);

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => $monto])
        ->assertCreated()
        ->assertJsonPath('comision', $cuadra)
        ->assertJsonPath('prefactura.total', $monto)
        ->assertJsonPath('prefactura.pagado', $monto)
        ->assertJsonPath('prefactura.por_cobrar', '0.00')
        ->assertJsonPath('prefactura.sobrepago', '0.00');

    // La bitacora guarda las dos cifras, para que la Task 9 cuente el ajuste.
    $alta = Bitacora::where('accion', Bitacora::ACCION_CREAR)->sole();
    expect($alta->datos_nuevos)->toMatchArray(['comision' => $cuadra, 'comision_formula' => $formula])
        ->and($alta->descripcion)->toContain("la fórmula daba {$formula}");
})->with('pagos amex reales que se desviaban');

test('el monto Amex tampoco puede superar lo que falta por cobrar, con su propio codigo', function () {
    // El sistema viejo topaba a Amex por `Total - caja` (caia en la rama `else` de
    // mpago.php). `registrarAmex()` no pasa por `registrar()`, asi que la regla se
    // escribe aqui.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();
    pagoDe($p, formasDePago()['Visa'], '115000.00');   // total 116,000.00: faltan 1,000.00

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '5000.00'])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'amex_supera_lo_que_falta')
        ->assertJsonPath('message', fn ($m) => str_contains($m, 'falta por cobrar') && str_contains($m, 'comisi'));

    expect($p->fresh()->pagos()->count())->toBe(1)
        ->and($p->fresh()->renglones()->count())->toBe(1)
        ->and(comisionesDe($p)->count())->toBe(0)
        ->and(Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)->count())->toBe(0);
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

test('el borde del tope con pagos previos: lo que falta con la comision, mas lo que absorbe la ventana', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();
    pagoDe($p, formasDePago()['Visa'], '115000.00');

    // Con 1,060.00 la comision es 51.72 y el total 116,060.00: pagado y total empatan. Hasta
    // 1,060.06 la comision absorbe (sube 6 centavos) y empatan igual; 1,060.07 ya no se alcanza.
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1060.07'])
        ->assertStatus(422)->assertJsonPath('codigo', 'amex_supera_lo_que_falta');

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1060.06'])->assertCreated();

    expect($p->fresh()->pagado())->toBe('116060.06')
        ->and($p->fresh()->total())->toBe('116060.06')
        ->and($p->fresh()->sobrepago())->toBe('0.00');
});

test('el ajuste apunta a lo que SALDA la cuenta: pagado mas monto, no solo el monto', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex(9132.71);
    pagoDe($p, formasDePago()['Visa'], '1160.00');

    // La formula da 487.96 para 10,000.00; con eso el total seria 11,159.98, dos centavos menos
    // que 1,160.00 + 10,000.00. La comision sube a 487.98 y el total cae EXACTO en 11,160.00.
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '10000.00'])
        ->assertCreated()
        ->assertJsonPath('comision', '487.98')
        ->assertJsonPath('prefactura.total', '11160.00')
        ->assertJsonPath('prefactura.por_cobrar', '0.00');
});

test('una prefactura ya sobrepagada no admite otro pago Amex', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();
    pagoDe($p, formasDePago()['efectivo'], '120000.00');   // sobre 116,000.00

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '100.00'])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'amex_supera_lo_que_falta');
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
| Se mide por el servicio, que es el camino real. Con subtotal de partida
| monto / 1.2296 el total tras la comision cae en el monto (la formula es exacta
| salvo por el redondeo a centavos), y el tope de `amex_supera_lo_que_falta`
| decide con ese mismo total.
*/

test('con un subtotal de monto / 1.2296 el total tras la comision cae en el monto tecleado', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex(813.27);

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.00'])
        ->assertCreated()
        ->assertJsonPath('comision', '48.80');

    expect($p->fresh()->subtotal())->toBe('862.07')
        ->and($p->fresh()->iva())->toBe('137.93')
        ->and($p->fresh()->total())->toBe('1000.00')
        ->and($p->fresh()->porCobrar())->toBe('0.00');
});

test('por el servicio, la comision absorbe el redondeo: todo lo alcanzable cae exacto y solo lo inalcanzable se rechaza', function () {
    $p = paraAmex(1.0);
    $renglon = $p->renglones()->sole();
    $servicio = app(PagosPrefactura::class);
    $tasa = $p->ivaTasa();
    $aceptados = 0;
    $rechazados = 0;
    $ajustados = 0;

    for ($centavos = 100_000; $centavos <= 2_000_000; $centavos += 5_003) {
        $monto = bcdiv((string) $centavos, '100', 2);
        $partida = bcadd(bcdiv($monto, '1.2296', 6), '0.005', 2);
        $renglon->update(['precio_unitario' => $partida]);
        $formula = ComisionAmex::calcular($monto, $tasa);

        // Fuerza bruta INDEPENDIENTE del servicio: ¿alguna comision a +-5 centavos da el monto?
        $alcanzable = false;

        for ($k = -PagosPrefactura::VENTANA_AJUSTE_COMISION; $k <= PagosPrefactura::VENTANA_AJUSTE_COMISION; $k++) {
            $c = bcadd($formula, bcdiv((string) $k, '100', 2), 2);
            $conComision = bcadd($partida, $c, 2);
            $alcanzable = $alcanzable || bcadd($conComision, FactPrefactura::calcularIva($conComision, $tasa), 2) === $monto;
        }

        try {
            $pago = $servicio->registrarAmex($p, $monto, $p->user_id);
            $desvio = bcsub($p->fresh()->total(), $monto, 2);

            // Aceptado: o cayo exacto, o la formula ya dejaba el total por encima (por cobrar 0.01).
            expect($desvio === '0.00' || ($desvio === '0.01' && ! $alcanzable))->toBeTrue("monto {$monto}: desvio {$desvio}");
            $ajustados += $pago->renglonComision->importe() !== $formula ? 1 : 0;
            $aceptados++;
            $servicio->quitar($p, $pago->id, $p->user_id);
        } catch (App\Services\PagoNoPermitidoException $e) {
            // Rechazado: solo por el tope, y solo si NINGUN candidato cuadraba.
            expect($e->codigo)->toBe('amex_supera_lo_que_falta')
                ->and($alcanzable)->toBeFalse("monto {$monto} era alcanzable y se rechazo");
            $rechazados++;
        }
    }

    expect($aceptados)->toBeGreaterThan(0)
        ->and($ajustados)->toBeGreaterThan(0)
        ->and($rechazados)->toBeGreaterThan(0);
});

test('la comision ajustada nunca queda negativa ni sale de su ventana', function () {
    // Total buscado 0.00 con subtotal 0.00: solo la comision 0.00 lo da. Desde 0.01 se alcanza bajando uno.
    expect(PagosPrefactura::comisionQueCuadra('0.01', '0.00', '0.1600', '0.00'))->toBe('0.00');
    // Un total negativo exigiria una comision negativa: no se busca.
    expect(PagosPrefactura::comisionQueCuadra('0.00', '0.00', '0.1600', '-0.02'))->toBeNull();
    // Fuera de la ventana (6 centavos de comision) no se llega, aunque el total exista.
    expect(PagosPrefactura::comisionQueCuadra('10.00', '100.00', '0.1600', bcadd('116.00', bcmul('1.16', '0.30', 2), 2)))->toBeNull();
    // Dentro, si.
    expect(PagosPrefactura::comisionQueCuadra('10.00', '100.00', '0.1600', '127.60'))->toBe('10.00');
    expect(PagosPrefactura::comisionQueCuadra('10.00', '100.00', '0.1600', '127.61'))->not->toBeNull();
});
