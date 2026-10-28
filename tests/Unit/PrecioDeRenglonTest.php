<?php

use App\Support\PrecioDeRenglon;

/*
 * Que precio se guarda en un renglon y si cuenta como capturado a mano. EN UN SOLO SITIO: la
 * regla la necesitan el controlador (catalogo, remision y transito ajeno) y
 * `RenglonDeComisariato`, y dos copias de la misma comparacion divergen. Ya paso en el trabajo
 * de remisiones, donde las dos vias armaban el renglon por separado y se separaron en tres
 * campos sin que nadie lo viera hasta la revision final de rama.
 */

test('sin precio pedido se usa el del registro y no cuenta como capturado', function () {
    expect(PrecioDeRenglon::resolver(null, '500.00'))
        ->toBe(['precio' => '500.0000', 'capturado' => false]);
});

test('el mismo precio escrito distinto no cuenta como capturado', function () {
    // La comparacion es NUMERICA a 4 decimales, no de texto: comparando cadenas, teclear `500`
    // donde el catalogo dice `500.0000` marcaria el renglon y la marca dejaria de significar nada.
    expect(PrecioDeRenglon::resolver('500', '500.0000'))
        ->toBe(['precio' => '500.0000', 'capturado' => false]);
});

test('un precio distinto se guarda y cuenta como capturado', function () {
    expect(PrecioDeRenglon::resolver('1050', '500.0000'))
        ->toBe(['precio' => '1050.0000', 'capturado' => true]);
});

test('una diferencia en el cuarto decimal SI cuenta', function () {
    expect(PrecioDeRenglon::resolver('25.9941', '25.9940'))
        ->toBe(['precio' => '25.9941', 'capturado' => true]);
});

test('un cero pedido es un precio, no una ausencia', function () {
    expect(PrecioDeRenglon::resolver('0', '500.0000'))
        ->toBe(['precio' => '0.0000', 'capturado' => true]);
});

test('acepta flotantes en los dos lados', function () {
    expect(PrecioDeRenglon::resolver(1050.5, 500.0))
        ->toBe(['precio' => '1050.5000', 'capturado' => true]);
});
