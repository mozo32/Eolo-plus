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

    altaDeRenglon(prefacturaBorrador(), servicioSimple(), ['precio_unitario' => '0'])
        ->assertCreated();
});

test('sin precio el alta sigue funcionando', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    altaDeRenglon(prefacturaBorrador(), servicioSimple())->assertCreated();
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
