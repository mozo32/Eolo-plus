<?php

// tests/Feature/Facturacion/DescuentoEstanciaTest.php

use App\Models\Bitacora;
use App\Models\FactAeronave;
use App\Models\FactPrefactura;
use App\Models\FactServicio;
use App\Services\CargosEstancia;
use App\Support\DescuentoDeEstancia;

/**
 * Un borrador con los tres cargos de estancia ya puestos y el usuario autenticado.
 * Devuelve la prefactura; el renglon de cada concepto se busca por `concepto`.
 */
function conEstanciaCobrada(): FactPrefactura
{
    test()->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = conEstancia();

    app(CargosEstancia::class)->recalcular($p, pernoctas: 1, transitos2h: 1, transitos12h: 1);

    return $p->fresh();
}

function renglonDeConcepto(FactPrefactura $p, string $concepto): App\Models\FactPrefacturaRenglon
{
    return $p->fresh()->renglones()->where('concepto', $concepto)->sole();
}

function urlDescuentos(FactPrefactura $p): string
{
    return "/api/facturacion/prefacturas/{$p->id}/descuentos-estancia";
}

test('el descuento de un tramo entra como renglon negativo de cantidad 1', function () {
    $p = conEstanciaCobrada();
    $pernocta = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => $pernocta->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    $descuento = renglonDeConcepto($p, FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA);

    expect($descuento->nombre_servicio)->toBe('Descuento pernocta')
        ->and((float) $descuento->precio_unitario)->toBe(-4676.00)
        ->and($descuento->cantidad)->toBe(1)
        ->and($descuento->importe())->toBe('-4676.00')
        ->and($descuento->es_cortesia)->toBeFalse()
        ->and((float) $descuento->margen)->toBe(0.0)
        ->and($descuento->ajuste_precio)->toBe(FactServicio::AJUSTE_NINGUNO)
        ->and($descuento->es_de_tercero)->toBeFalse()
        ->and($descuento->servicio_id)->toBe($pernocta->servicio_id);
});

test('el total baja exactamente la tarifa del tramo descontado', function () {
    $p = conEstanciaCobrada();
    $antes = $p->subtotal();
    expect($antes)->toBe('8158.50');

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H],
    ])->assertOk()->assertJsonPath('prefactura.subtotal', '5820.50');

    expect($p->fresh()->subtotal())->toBe('5820.50');
});

test('los tres tramos se descuentan en una sola llamada', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => DescuentoDeEstancia::conceptosDescontables(),
    ])->assertOk();

    expect($p->fresh()->renglones()->whereIn('concepto', DescuentoDeEstancia::conceptos())->count())->toBe(3)
        ->and($p->fresh()->subtotal())->toBe('0.00');
});

test('el descuento hereda el grupo del renglon desde el que se pidio', function () {
    $p = conEstanciaCobrada();
    $pernocta = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);
    $pernocta->update(['grupo' => 'Estancia']);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => $pernocta->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    expect(renglonDeConcepto($p, FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA)->grupo)->toBe('Estancia');
});

test('sin grupo en el renglon de origen el descuento sale suelto', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    expect(renglonDeConcepto($p, FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA)->grupo)->toBeNull();
});

test('el descuento sale justo despues del cargo que descuenta, y empuja a los de atras', function () {
    $p = conEstanciaCobrada();
    $transito2h = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => $transito2h->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H],
    ])->assertOk();

    // La posicion OBSERVABLE: los renglones salen por `orden` y luego por `id`, asi que
    // comprobar `orden == orden del cargo + 1` no garantiza donde cae la fila.
    expect($p->fresh()->renglones()->pluck('concepto')->all())->toBe([
        FactServicio::CONCEPTO_ESTANCIA_PERNOCTA,
        FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H,
        FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_TRANSITO_2H,
        FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H,
    ]);
});

test('se puede descontar un tramo que la prefactura no cobra, y el descuento va al final', function () {
    // Decision 2 de la spec: la cifra sale de la TARIFA, no de lo que se cobra. Sin cargo de
    // ese tramo no hay `orden` detras del que colocarse, asi que va al final.
    $p = conEstanciaCobrada();
    app(CargosEstancia::class)->recalcular($p->fresh(), pernoctas: 0, transitos2h: 1, transitos12h: 0);
    $transito2h = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => $transito2h->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    expect($p->fresh()->renglones()->pluck('concepto')->all())->toBe([
        FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H,
        FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA,
    ])->and($p->fresh()->subtotal())->toBe('-3531.50');
});

test('el mismo tramo se puede descontar dos veces y el total baja el doble', function () {
    // Es la decision 2 de la spec, tomada con su costo escrito: sin tope y repetible.
    // Esta prueba la fija para que nadie «la arregle» sin leer la spec.
    $p = conEstanciaCobrada();
    $pernocta = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);

    foreach ([1, 2] as $vez) {
        $this->postJson(urlDescuentos($p), [
            'renglon_id' => $pernocta->id,
            'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
        ])->assertOk();
    }

    expect($p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA)->count())->toBe(2)
        ->and($p->fresh()->subtotal())->toBe('-1193.50');
});

test('la bitacora dice que tramo se descuento y por cuanto', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    // La frase COMPLETA: una frase de dinero que se puede invertir sin romper su prueba
    // es una frase que miente en verde.
    expect(Bitacora::query()->latest('id')->first()->descripcion)
        ->toBe("Se aplicó un descuento de pernocta por 4,676.00 a la prefactura {$p->id}.");
});

test('se escribe una linea de bitacora por cada tramo descontado', function () {
    $p = conEstanciaCobrada();
    $antes = Bitacora::query()->count();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H],
    ])->assertOk();

    expect(Bitacora::query()->count() - $antes)->toBe(2);
});

test('quitar el renglon del descuento devuelve el total a su sitio', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    $descuento = renglonDeConcepto($p, FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA);

    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$descuento->id}")->assertOk();

    expect($p->fresh()->subtotal())->toBe('8158.50');
});

test('la ficha que responde el endpoint ya trae el renglon del descuento', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk()
        ->assertJsonPath('prefactura.renglones.1.concepto', FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA);
});

test('sin tarifa para ese tramo se rechaza nombrando el tramo, y no se escribe nada', function () {
    $p = conEstanciaCobrada();
    $pernocta = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);
    $renglonesAntes = $p->fresh()->renglones()->count();

    FactAeronave::query()->where('aeronave_id', $p->aeronave_id)->update(['tarifa_pernocta' => null]);

    $respuesta = $this->postJson(urlDescuentos($p), [
        'renglon_id' => $pernocta->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertUnprocessable()->assertJsonPath('codigo', 'sin_tarifa_de_estancia');

    expect($respuesta->json('message'))->toContain('pernocta')
        ->and($p->fresh()->renglones()->count())->toBe($renglonesAntes);
});

test('un tramo sin tarifa no deja pasar los otros de la misma llamada', function () {
    // La transaccion es una: o entran los dos descuentos o no entra ninguno. Si entrara
    // el primero, el operador veria un documento a medias y creeria que fallo todo.
    $p = conEstanciaCobrada();
    FactAeronave::query()->where('aeronave_id', $p->aeronave_id)->update(['tarifa_transito_2h' => null]);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H],
    ])->assertUnprocessable();

    expect($p->fresh()->renglones()->whereIn('concepto', DescuentoDeEstancia::conceptos())->count())->toBe(0);
});

test('sin ficha de facturacion no hay tarifa que descontar', function () {
    $p = conEstanciaCobrada();
    $pernocta = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);

    FactAeronave::query()->where('aeronave_id', $p->aeronave_id)->delete();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => $pernocta->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertUnprocessable()->assertJsonPath('codigo', 'sin_tarifa_de_estancia');
});

test('un servicio de estancia dado de baja se rechaza en lugar de reventar', function () {
    $p = conEstanciaCobrada();
    $pernocta = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);

    FactServicio::query()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->update(['status' => 'I']);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => $pernocta->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertUnprocessable()->assertJsonPath('codigo', 'servicio_de_estancia_no_disponible');

    expect($p->fresh()->renglones()->whereIn('concepto', DescuentoDeEstancia::conceptos())->count())->toBe(0);
});

test('el renglon de origen tiene que ser de esta prefactura', function () {
    $p = conEstanciaCobrada();
    $otra = conEstancia();
    app(CargosEstancia::class)->recalcular($otra, pernoctas: 1, transitos2h: 0, transitos12h: 0);
    $ajeno = renglonDeConcepto($otra, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => $ajeno->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertUnprocessable()->assertJsonValidationErrors('renglon_id');

    expect($p->fresh()->renglones()->whereIn('concepto', DescuentoDeEstancia::conceptos())->count())->toBe(0);
});

test('el renglon de origen no puede ser un servicio cualquiera', function () {
    $p = conEstanciaCobrada();
    $suelto = renglonDe($p, 500.0, 1);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => $suelto->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertUnprocessable()->assertJsonValidationErrors('renglon_id');
});

test('un renglon de origen que no existe se rechaza', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => 999999,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertUnprocessable()->assertJsonValidationErrors('renglon_id');
});

test('la lista de tramos no puede venir vacia ni con basura ni repetida', function (array $cuerpo, string $campo) {
    $p = conEstanciaCobrada();
    $pernocta = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);

    $this->postJson(urlDescuentos($p), ['renglon_id' => $pernocta->id] + $cuerpo)
        ->assertUnprocessable()
        ->assertJsonValidationErrors($campo);
})->with([
    'vacia' => [['conceptos' => []], 'conceptos'],
    'ausente' => [[], 'conceptos'],
    'no es lista' => [['conceptos' => 'estancia_pernocta'], 'conceptos'],
    'inventado' => [['conceptos' => ['estancia_lo_que_sea']], 'conceptos.0'],
    'un ajuste de estancia' => [['conceptos' => ['estancia_ajuste_2h_12h']], 'conceptos.0'],
    'repetido' => [['conceptos' => ['estancia_pernocta', 'estancia_pernocta']], 'conceptos.0'],
]);

test('una prefactura cerrada no acepta descuentos', function () {
    $p = conEstanciaCobrada();
    $pernocta = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);

    $p->update(['estado' => FactPrefactura::ESTADO_CERRADA]);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => $pernocta->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertConflict()->assertJsonPath('codigo', 'ya_cerrada');
});

test('un borrador descartado no acepta descuentos', function () {
    $p = conEstanciaCobrada();
    $pernocta = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);

    $p->update(['status' => FactPrefactura::STATUS_INACTIVO]);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => $pernocta->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertConflict()->assertJsonPath('codigo', 'ya_descartada');
});

test('una prefactura REABIERTA si acepta descuentos: se reabre justo para corregir', function () {
    // `rechazoRapido()` rechaza cerrada y descartada, no reabierta (ESTADO_REABIERTA es su
    // propio estado, no el status 'N'). Es el mismo trato que le dan las demas acciones de
    // renglon, y esta prueba lo fija para que nadie lo cierre por simetria.
    $p = conEstanciaCobrada();
    $pernocta = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);

    $p->update(['estado' => FactPrefactura::ESTADO_REABIERTA]);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => $pernocta->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    expect($p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA)->count())->toBe(1);
});

test('una prefactura que no existe da 404', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson('/api/facturacion/prefacturas/999999/descuentos-estancia', [
        'renglon_id' => 1,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertNotFound();
});

test('el documento saca el descuento como una linea propia con su nombre', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H],
    ])->assertOk();

    $filas = app(App\Services\DocumentoDePrefactura::class)->filas($p->fresh()->load('renglones'));
    $linea = collect($filas)->firstWhere('concepto', 'Descuento tránsito de 12 horas');

    expect($linea)->not->toBeNull()
        ->and($linea['importe'])->toBe('-2338.00')
        ->and($linea['cortesia'])->toBeFalse()
        ->and($linea['cantidad'])->toBe(1);
});

test('dentro de un grupo el descuento se suma al importe del grupo y no sale como linea', function () {
    // Es el riesgo aceptado de la spec: el cliente deja de ver que se le perdono algo.
    // Se fija con una prueba para que el dia que moleste se sepa donde cambiarlo.
    $p = conEstanciaCobrada();
    $pernocta = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);
    $pernocta->update(['grupo' => 'Estancia']);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => $pernocta->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    $filas = app(App\Services\DocumentoDePrefactura::class)->filas($p->fresh()->load('renglones'));

    expect(collect($filas)->firstWhere('concepto', 'Descuento pernocta'))->toBeNull()
        ->and(collect($filas)->firstWhere('concepto', 'Estancia')['importe'])->toBe('0.00');
});

test('el iva y el total bajan con el descuento, derivados', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H],
    ])->assertOk();

    $p = $p->fresh();

    // 8158.50 - 1144.50 = 7014.00; el IVA sale de la tasa configurada y no se teclea aqui.
    expect($p->subtotal())->toBe('7014.00')
        ->and(bcadd($p->subtotal(), $p->iva(), 2))->toBe($p->total());
});

test('una prefactura cuyo total queda negativo se cierra y sella el total en negativo', function () {
    // Sin precedente en el sistema viejo (ninguna de sus 10 lineas negativas dejo un documento
    // negativo): esta prueba fija lo que el cierre hace, para que no se descubra en produccion.
    $p = conEstanciaCobrada();
    $p->update(['cliente_id' => App\Models\FactCliente::create(['nombre' => 'Cliente '.uniqid()])->id]);
    $pernocta = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);

    foreach ([1, 2, 3, 4] as $vez) {
        $this->postJson(urlDescuentos($p), [
            'renglon_id' => $pernocta->id,
            'conceptos' => DescuentoDeEstancia::conceptosDescontables(),
        ])->assertOk();
    }

    expect(bccomp($p->fresh()->subtotal(), '0.00', 2))->toBe(-1);

    $respuesta = $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar", ['confirmar_sin_cobro' => true]);

    $respuesta->assertOk()->assertJsonPath('message', 'Prefactura cerrada con folio 10000.');

    $cerrada = $p->fresh();

    // 8158.50 - 4 * 8158.50; el IVA es el 16% exacto del subtotal, redondeado alejandose del cero.
    expect($cerrada->estado)->toBe(FactPrefactura::ESTADO_CERRADA)
        ->and($cerrada->folio)->toBe(10000)
        ->and($cerrada->subtotal_sellado)->toBe('-24475.50')
        ->and($cerrada->iva_sellado)->toBe('-3916.08')
        ->and($cerrada->total_sellado)->toBe('-28391.58')
        ->and($cerrada->selloDiscrepa())->toBeFalse();
});

test('el iva de un subtotal negativo es simetrico al del positivo', function (string $subtotal, string $tasa, string $iva) {
    expect(FactPrefactura::calcularIva($subtotal, $tasa))->toBe($iva);
})->with([
    'exacto negativo' => ['-24475.50', '0.1600', '-3916.08'],
    'exacto positivo' => ['24475.50', '0.1600', '3916.08'],
    'medio centavo negativo, lejos del cero' => ['-1.00', '0.1650', '-0.17'],
    'medio centavo positivo' => ['1.00', '0.1650', '0.17'],
    'redondea hacia arriba un negativo' => ['-26.06', '0.1600', '-4.17'],
    'cero' => ['0.00', '0.1600', '0.00'],
]);
