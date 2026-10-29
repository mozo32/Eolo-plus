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
