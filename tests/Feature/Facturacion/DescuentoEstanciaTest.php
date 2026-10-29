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
        ->and($p->fresh()->subtotal())->toBe('0.00')
        ->and($p->fresh()->renglones()->pluck('concepto')->all())->toBe([
            FactServicio::CONCEPTO_ESTANCIA_PERNOCTA,
            FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA,
            FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H,
            FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_TRANSITO_2H,
            FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H,
            FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_TRANSITO_12H,
        ]);
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
    ])->assertUnprocessable()->assertJsonPath('codigo', 'sin_tarifa_de_estancia');

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

test('sin renglon de origen se rechaza con el mensaje propio', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertUnprocessable()
        ->assertJsonValidationErrors('renglon_id')
        ->assertJsonPath('errors.renglon_id.0', 'Indica desde qué renglón se aplica el descuento.');

    expect($p->fresh()->renglones()->whereIn('concepto', DescuentoDeEstancia::conceptos())->count())->toBe(0);
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
    $antes = ['subtotal' => $p->subtotal(), 'iva' => $p->iva(), 'total' => $p->total()];

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H],
    ])->assertOk();

    $despues = $p->fresh();

    // 8158.50 - 1144.50 = 7014.00. `total()` es subtotal + IVA por definicion, asi que no
    // se asierta contra esa suma (seria una identidad): se asierta el IVA medido antes y despues.
    expect($antes['subtotal'])->toBe('8158.50')
        ->and($antes['iva'])->toBe('1305.36')
        ->and($despues->subtotal())->toBe('7014.00')
        ->and($despues->iva())->toBe('1122.24')
        ->and(bccomp($despues->total(), $antes['total'], 2))->toBe(-1);
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

    // SIN `confirmar_sin_cobro`: pagado (0.00) supera al total negativo, asi que se toma la rama
    // del sobrepago y la del faltante no se ejecuta. No hay ninguna confirmacion de por medio.
    $respuesta = $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar");

    $respuesta->assertOk()->assertJsonPath('message', 'Prefactura cerrada con folio 10000.');

    $cerrada = $p->fresh();

    // 8158.50 - 4 * 8158.50; el IVA es el 16% exacto del subtotal, redondeado alejandose del cero.
    expect($cerrada->estado)->toBe(FactPrefactura::ESTADO_CERRADA)
        ->and($cerrada->folio)->toBe(10000)
        ->and($cerrada->subtotal_sellado)->toBe('-24475.50')
        ->and($cerrada->iva_sellado)->toBe('-3916.08')
        ->and($cerrada->total_sellado)->toBe('-28391.58')
        ->and($cerrada->selloDiscrepa())->toBeFalse();

    // El sobrepago fantasma: nadie pago nada (pagado 0.00) y el cierre lo registra como cobrado
    // de mas por el valor absoluto del total. Se fija tal cual esta; si se decide rechazar o
    // tratar distinto un total negativo, esta es la asercion que debe cambiar.
    $bitacora = Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)
        ->where('accion', Bitacora::ACCION_FINALIZAR)
        ->where('registro_id', $p->id)
        ->sole();

    expect($bitacora->descripcion)->toBe('Se cerró la prefactura con folio 10000 por un total de -28391.58. Se cerró con el cliente cobrado por encima del total: pagado 0.00, sobrepago 28391.58.')
        ->and($bitacora->datos_nuevos['pagado'])->toBe('0.00')
        ->and($bitacora->datos_nuevos['sobrepago'])->toBe('28391.58')
        ->and($bitacora->datos_nuevos)->not->toHaveKey('faltante');
});

test('las tarifas de estancia se sirven por concepto, listas para el modal', function () {
    $p = conEstanciaCobrada();

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/tarifas-estancia")
        ->assertOk()
        ->assertJsonPath('tarifas.estancia_pernocta', '4676.00')
        ->assertJsonPath('tarifas.estancia_transito_2h', '1144.50')
        ->assertJsonPath('tarifas.estancia_transito_12h', '2338.00');
});

test('una tarifa que no existe viaja como null y no como cero', function () {
    $p = conEstanciaCobrada();
    FactAeronave::query()->where('aeronave_id', $p->aeronave_id)->update(['tarifa_pernocta' => null]);

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/tarifas-estancia")
        ->assertOk()
        ->assertJsonPath('tarifas.estancia_pernocta', null)
        ->assertJsonPath('tarifas.estancia_transito_2h', '1144.50');
});

test('sin ficha de facturacion las tres tarifas son null', function () {
    $p = conEstanciaCobrada();
    FactAeronave::query()->where('aeronave_id', $p->aeronave_id)->delete();

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/tarifas-estancia")
        ->assertOk()
        ->assertJsonPath('tarifas.estancia_pernocta', null)
        ->assertJsonPath('tarifas.estancia_transito_2h', null)
        ->assertJsonPath('tarifas.estancia_transito_12h', null);
});

test('la tarifa heredada de la categoria tambien se sirve', function () {
    $p = conEstanciaCobrada();
    $categoria = App\Models\FactCategoriaAeronave::create(['nombre' => 'Categoria '.uniqid(), 'tarifa_pernocta' => 7000.00, 'tarifa_transito_2h' => 1144.50, 'tarifa_transito_12h' => 2338.00]);
    FactAeronave::query()->where('aeronave_id', $p->aeronave_id)
        ->update(['tarifa_pernocta' => null, 'categoria_aeronave_id' => $categoria->id]);

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/tarifas-estancia")
        ->assertOk()
        ->assertJsonPath('tarifas.estancia_pernocta', '7000.00');
});

test('consultar las tarifas no escribe nada', function () {
    $p = conEstanciaCobrada();
    $renglones = $p->fresh()->renglones()->count();
    $bitacora = Bitacora::query()->count();

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/tarifas-estancia")->assertOk();

    expect($p->fresh()->renglones()->count())->toBe($renglones)
        ->and(Bitacora::query()->count())->toBe($bitacora);
});

test('las tarifas de una prefactura que no existe dan 404', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->getJson('/api/facturacion/prefacturas/999999/tarifas-estancia')->assertNotFound();
});

// Un cero es una tarifa válida y distinta de la ausencia: separa «se descuenta cero» de «no se puede descontar».
test('una tarifa de cero viaja como cero y no como null', function () {
    $p = conEstanciaCobrada();
    FactAeronave::query()->where('aeronave_id', $p->aeronave_id)->update(['tarifa_pernocta' => 0.00]);

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/tarifas-estancia")
        ->assertOk()
        ->assertJsonPath('tarifas.estancia_pernocta', '0.00');
});

test('el descuento sigue ahi despues de recalcular, si su tramo se sigue cobrando', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    $resultado = app(CargosEstancia::class)->recalcular($p->fresh(), pernoctas: 3, transitos2h: 1, transitos12h: 1);

    $descuento = renglonDeConcepto($p, FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA);

    expect((float) $descuento->precio_unitario)->toBe(-4676.00)
        ->and($descuento->cantidad)->toBe(1)
        // `motivo` es null cuando no hay nada que avisar, y `toContain` sobre null revienta:
        // la comprobacion es «no lo menciona», que es verdad tambien cuando no hay motivo.
        ->and($resultado['motivo'] === null || ! str_contains($resultado['motivo'], 'descuento'))->toBeTrue();
});

test('si el tramo descontado deja de cobrarse, el descuento se retira y el aviso lo nombra', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    $suelto = renglonDe($p, 500.0, 1);

    $resultado = app(CargosEstancia::class)->recalcular($p->fresh(), pernoctas: 0, transitos2h: 1, transitos12h: 1);

    expect($p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA)->count())->toBe(0)
        ->and($resultado['motivo'])->toBe('Se retiró 1 descuento de estancia cuyo concepto ya no se cobra: pernocta. Si vuelve a cobrarse, el descuento se aplica otra vez a mano.')
        ->and($p->fresh()->renglones()->whereKey($suelto->id)->exists())->toBeTrue()
        ->and($p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H)->count())->toBe(1)
        ->and($p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H)->count())->toBe(1);
});

test('dos descuentos retirados se cuentan y se nombran los dos', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H],
    ])->assertOk();

    $resultado = app(CargosEstancia::class)->recalcular($p->fresh(), pernoctas: 0, transitos2h: 1, transitos12h: 0);

    expect($p->fresh()->renglones()->whereIn('concepto', DescuentoDeEstancia::conceptos())->count())->toBe(0)
        ->and($resultado['motivo'])->toBe('Se retiraron 2 descuentos de estancia cuyos conceptos ya no se cobran: pernocta, tránsito de 12 horas. Si vuelven a cobrarse, los descuentos se aplican otra vez a mano.');
});

test('el aviso del descuento retirado convive con el de la cortesia perdida', function () {
    $p = conEstanciaCobrada();
    renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H)->update(['es_cortesia' => true]);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    $resultado = app(CargosEstancia::class)->recalcular($p->fresh(), pernoctas: 0, transitos2h: 0, transitos12h: 1);

    expect($resultado['motivo'])->toContain('Se perdió la cortesía')
        ->and($resultado['motivo'])->toContain('Se retiró 1 descuento de estancia');
});

test('una aeronave en Guarda pierde sus descuentos y el aviso lo dice', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H],
    ])->assertOk();

    FactAeronave::query()->where('aeronave_id', $p->aeronave_id)->update(['estatus' => FactAeronave::ESTATUS_GUARDA]);

    $resultado = app(CargosEstancia::class)->recalcular($p->fresh(), pernoctas: 1, transitos2h: 1, transitos12h: 1);

    expect($p->fresh()->renglones()->whereIn('concepto', DescuentoDeEstancia::conceptos())->count())->toBe(0)
        ->and($resultado['motivo'])->toContain('Guarda')
        ->and($resultado['motivo'])->toContain('Se retiraron 2 descuentos de estancia cuyos conceptos ya no se cobran: pernocta, tránsito de 12 horas. Si vuelven a cobrarse, los descuentos se aplican otra vez a mano.');
});

test('sin ficha de facturacion los descuentos tambien se retiran nombrados', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H],
    ])->assertOk();

    FactAeronave::query()->where('aeronave_id', $p->aeronave_id)->delete();

    $resultado = app(CargosEstancia::class)->recalcular($p->fresh(), pernoctas: 1, transitos2h: 1, transitos12h: 1);

    expect($p->fresh()->renglones()->whereIn('concepto', DescuentoDeEstancia::conceptos())->count())->toBe(0)
        ->and($resultado['motivo'])->toContain('Se retiraron 2 descuentos de estancia cuyos conceptos ya no se cobran: pernocta, tránsito de 12 horas. Si vuelven a cobrarse, los descuentos se aplican otra vez a mano.');
});

test('el recalculo no toca un renglon que no es descuento ni cargo de estancia', function () {
    $p = conEstanciaCobrada();
    $suelto = renglonDe($p, 500.0, 1);

    app(CargosEstancia::class)->recalcular($p->fresh(), pernoctas: 1, transitos2h: 0, transitos12h: 0);

    expect($p->fresh()->renglones()->whereKey($suelto->id)->exists())->toBeTrue();
});

test('el descuento de un tramo en cortesia que se sigue cobrando se conserva y el aviso no lo nombra', function () {
    $p = conEstanciaCobrada();
    renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->update(['es_cortesia' => true]);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    $resultado = app(CargosEstancia::class)->recalcular($p->fresh(), pernoctas: 3, transitos2h: 1, transitos12h: 1);

    // Un tramo en cortesia conserva su renglon en el documento aunque no se cobre, asi que
    // su descuento no es un negativo huerfano y no se retira.
    expect($p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA)->count())->toBe(1)
        ->and($resultado['motivo'])->toContain('Se conservó la cortesía')
        ->and($resultado['motivo'])->not->toContain('descuento');
});

test('un tramo con cantidad pero sin tarifa no se cobra, y su descuento se retira nombrado', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    FactAeronave::query()->where('aeronave_id', $p->aeronave_id)->update(['tarifa_pernocta' => null]);

    $resultado = app(CargosEstancia::class)->recalcular($p->fresh(), pernoctas: 2, transitos2h: 1, transitos12h: 1);

    expect($p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->count())->toBe(0)
        ->and($p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA)->count())->toBe(0)
        ->and($resultado['motivo'])->toBe('No se pudo determinar el precio de pernocta (sin tarifa en la matrícula ni en su categoría), así que no se cobró. Se retiró 1 descuento de estancia cuyo concepto ya no se cobra: pernocta. Si vuelve a cobrarse, el descuento se aplica otra vez a mano.');
});

test('el aviso del descuento retirado queda en la bitacora de Estancia y ajustes', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/estancia", [
        'pernoctas' => 0,
        'transitos_2h' => 1,
        'transitos_12h' => 1,
    ])->assertOk();

    $bitacora = Bitacora::query()
        ->where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)
        ->where('accion', Bitacora::ACCION_ACTUALIZAR)
        ->where('registro_id', $p->id)
        ->latest('id')
        ->first();

    expect($bitacora->datos_nuevos['motivo'])->toBe('Se retiró 1 descuento de estancia cuyo concepto ya no se cobra: pernocta. Si vuelve a cobrarse, el descuento se aplica otra vez a mano.');
});
