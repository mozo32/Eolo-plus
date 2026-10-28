<?php

use App\Models\FactPrefacturaRenglon;
use Illuminate\Support\Facades\Schema;

/*
 * `precio_capturado` marca el renglon cuyo precio alguien tecleo al agregarlo, en vez de
 * heredarlo del catalogo, de la remision, del comisariato o de la tarifa de la aeronave.
 *
 * Hasta este trabajo el navegador no mandaba ninguna cifra de dinero, asi que la columna nace
 * en falso y eso es la verdad de los 117 renglones que ya existen.
 */

test('un renglon nace con precio_capturado en falso', function () {
    $renglon = renglonDe(prefacturaBorrador(), 100.0, 1);

    expect($renglon->fresh()->precio_capturado)->toBeFalse();
});

test('precio_capturado es asignable y castea a booleano', function () {
    $renglon = renglonDe(prefacturaBorrador(), 100.0, 1);

    $renglon->update(['precio_capturado' => 1]);

    expect($renglon->fresh()->precio_capturado)->toBeTrue();
});

test('la ficha de la prefactura expone precio_capturado en cada renglon', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = prefacturaBorrador();
    $renglon = renglonDe($prefactura, 100.0, 1);
    $renglon->update(['precio_capturado' => true]);

    $this->getJson("/api/facturacion/prefacturas/{$prefactura->id}")
        ->assertOk()
        ->assertJsonPath('prefactura.renglones.0.precio_capturado', true);
});

test('ningun indice de la tabla de renglones pasa de 64 caracteres', function () {
    // MySQL rechaza un identificador de mas de 64; sqlite no tiene ese limite, asi que una
    // migracion puede pasar en verde aqui y fallar entera contra la base real. Ya paso con
    // `fact_prefactura_remisiones_excluidas`, cuyo indice automatico salia de 69.
    expect(Schema::getIndexes('fact_prefactura_renglones'))->not->toBeEmpty();

    foreach (Schema::getIndexes('fact_prefactura_renglones') as $indice) {
        expect(strlen((string) $indice['name']))->toBeLessThanOrEqual(64);
    }
});

// ---------------------------------------------------------------------------
// La validacion del precio que llega
// ---------------------------------------------------------------------------

/** Un servicio normal del catalogo, sin margen ni ajuste. */
function servicioSimple(float $precio = 500.0): App\Models\FactServicio
{
    return App\Models\FactServicio::create([
        'nombre' => 'Servicio '.uniqid(),
        'precio_unitario' => $precio,
        'status' => 'A',
    ]);
}

/** Agrega un renglon por el endpoint, con el precio indicado si se da. */
function altaDeRenglon(App\Models\FactPrefactura $p, App\Models\FactServicio $s, array $extra = []): Illuminate\Testing\TestResponse
{
    return test()->postJson("/api/facturacion/prefacturas/{$p->id}/renglones", array_merge([
        'servicio_id' => $s->id,
        'cantidad' => 1,
    ], $extra));
}

test('un precio negativo se rechaza', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    altaDeRenglon(prefacturaBorrador(), servicioSimple(), ['precio_unitario' => '-1'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('precio_unitario');
});

test('un precio por encima del maximo de la columna se rechaza', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    altaDeRenglon(prefacturaBorrador(), servicioSimple(), ['precio_unitario' => '1000000'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('precio_unitario');
});

test('un precio con cinco decimales se rechaza: el quinto se perderia al escribirlo', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    altaDeRenglon(prefacturaBorrador(), servicioSimple(), ['precio_unitario' => '25.99401'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('precio_unitario');
});

test('los ceros de relleno no cuentan como decimales', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    altaDeRenglon(prefacturaBorrador(), servicioSimple(), ['precio_unitario' => '25.99400000'])
        ->assertCreated();
});

test('un precio de cero se acepta: cero es una tarifa, no un campo vacio', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $prefactura = prefacturaBorrador();

    altaDeRenglon($prefactura, servicioSimple(500.0), ['precio_unitario' => '0'])
        ->assertCreated();

    // Un cero tecleado NO es «no se tecleo nada»: si se tomara por ausencia se cobraria el
    // catalogo, que es justo el error que esta regla existe para evitar.
    $renglon = $prefactura->renglones()->sole();

    expect((string) $renglon->precio_unitario)->toBe('0.0000')
        ->and($renglon->precio_capturado)->toBeTrue();
});

test('sin precio el alta sigue funcionando', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    altaDeRenglon(prefacturaBorrador(), servicioSimple())->assertCreated();
});

test('un precio en notacion cientifica se rechaza: se guardaria como cero', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    foreach (['1.0E-5', '1e-5', '5E2'] as $precio) {
        altaDeRenglon(prefacturaBorrador(), servicioSimple(), ['precio_unitario' => $precio])
            ->assertStatus(422)
            ->assertJsonValidationErrors('precio_unitario');
    }
});

test('un precio null explicito es lo mismo que omitirlo: cobra el del catalogo', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = prefacturaBorrador();

    // La pantalla manda null cuando el campo de precio no se toco: es el camino normal de produccion.
    altaDeRenglon($prefactura, servicioSimple(500.0), ['precio_unitario' => null])->assertCreated();

    $renglon = $prefactura->renglones()->sole();

    expect((string) $renglon->precio_unitario)->toBe('500.0000')
        ->and($renglon->precio_capturado)->toBeFalse();
});

test('un precio que llega como arreglo da 422 por campo, no un 500', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    altaDeRenglon(prefacturaBorrador(), servicioSimple(), ['precio_unitario' => [1]])
        ->assertStatus(422)
        ->assertJsonValidationErrors('precio_unitario');
});

test('un precio con exactamente cuatro decimales significativos se acepta', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    altaDeRenglon(prefacturaBorrador(), servicioSimple(), ['precio_unitario' => '25.9940'])
        ->assertCreated();
    altaDeRenglon(prefacturaBorrador(), servicioSimple(), ['precio_unitario' => '0.0001'])
        ->assertCreated();
});

test('el tope de la columna se acepta: 999999.9999 es el mayor precio valido', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    altaDeRenglon(prefacturaBorrador(), servicioSimple(), ['precio_unitario' => '999999.9999'])
        ->assertCreated();
});

// ---------------------------------------------------------------------------
// El precio que llega se aplica, y solo el precio
// ---------------------------------------------------------------------------

test('con precio tecleado el renglon lo guarda y el importe lo sigue', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = prefacturaBorrador();

    altaDeRenglon($prefactura, servicioSimple(500.0), ['precio_unitario' => '1050', 'cantidad' => 2])
        ->assertCreated();

    $renglon = $prefactura->renglones()->sole();

    expect((string) $renglon->precio_unitario)->toBe('1050.0000')
        ->and($renglon->precio_capturado)->toBeTrue()
        ->and($renglon->importe())->toBe('2100.00');
});

test('teclear el mismo precio del catalogo NO marca el renglon', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = prefacturaBorrador();

    altaDeRenglon($prefactura, servicioSimple(500.0), ['precio_unitario' => '500'])->assertCreated();

    expect($prefactura->renglones()->sole()->precio_capturado)->toBeFalse();
});

test('el precio tecleado NO mueve el margen, el ajuste, el tercero ni el concepto', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = prefacturaBorrador();
    $servicio = App\Models\FactServicio::create([
        'nombre' => 'Servicio '.uniqid(),
        'precio_unitario' => 500.0,
        'es_de_tercero' => true,
        'margen' => 50,
        'ajuste_precio' => App\Models\FactServicio::AJUSTE_MAS_5,
        'status' => 'A',
    ]);

    altaDeRenglon($prefactura, $servicio, ['precio_unitario' => '1000'])->assertCreated();

    $renglon = $prefactura->renglones()->sole();

    expect($renglon->es_de_tercero)->toBeTrue()
        ->and((string) $renglon->margen)->toBe('50.00')
        ->and($renglon->ajuste_precio)->toBe(App\Models\FactServicio::AJUSTE_MAS_5);
});

test('el alta sin precio produce exactamente el renglon de siempre', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = prefacturaBorrador();
    $servicio = servicioSimple(500.0);

    altaDeRenglon($prefactura, $servicio, ['cantidad' => 3])->assertCreated();

    $renglon = $prefactura->renglones()->sole();

    expect((string) $renglon->precio_unitario)->toBe('500.0000')
        ->and($renglon->precio_capturado)->toBeFalse()
        ->and($renglon->cantidad)->toBe(3)
        ->and($renglon->importe())->toBe('1500.00');
});

test('la bitacora dice con que precio se cobro y cual habria sido', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = prefacturaBorrador();

    // El del catalogo pasa de mil a proposito: el formato de la cifra que se cita NO debe meter
    // separadores de miles («1,500.0000»).
    altaDeRenglon($prefactura, servicioSimple(1500.0), ['precio_unitario' => '1050'])->assertCreated();

    // La frase entera: fija cual es el precio cobrado y cual el que habria sido.
    expect(App\Models\Bitacora::latest('id')->first()->descripcion)
        ->toContain('Precio capturado a mano: 1050.0000 en vez de 1500.0000.');
});

test('sin precio capturado la bitacora no habla de precios tecleados', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    altaDeRenglon(prefacturaBorrador(), servicioSimple(500.0))->assertCreated();

    expect(App\Models\Bitacora::latest('id')->first()->descripcion)
        ->not->toContain('capturado');
});

test('teclear un precio NO cambia el del catalogo', function () {
    // Decision 5 de la spec. El renglon congela su precio; el catalogo se edita en su pantalla.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $servicio = servicioSimple(500.0);

    altaDeRenglon(prefacturaBorrador(), $servicio, ['precio_unitario' => '1050'])->assertCreated();

    expect((string) $servicio->fresh()->precio_unitario)->toBe('500.0000');
});
