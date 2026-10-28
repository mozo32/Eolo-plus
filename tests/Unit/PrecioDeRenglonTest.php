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

test('el precio del registro se normaliza antes de comparar, venga como venga', function () {
    // Sin normalizar los DOS lados, `500` contra `'500.00'` saldria capturado: justo lo que
    // esta clase existe para evitar. El subtotal de un comisariato llega asi.
    expect(PrecioDeRenglon::resolver('500', '500.00'))
        ->toBe(['precio' => '500.0000', 'capturado' => false])
        ->and(PrecioDeRenglon::resolver(500.0, '500.00'))
        ->toBe(['precio' => '500.0000', 'capturado' => false])
        ->and(PrecioDeRenglon::resolver('500.0000', 500.0))
        ->toBe(['precio' => '500.0000', 'capturado' => false]);
});

test('el quinto decimal se REDONDEA, no se trunca', function () {
    // Truncar daria 25.9940 en el primer caso y la diferencia pasaria inadvertida.
    expect(PrecioDeRenglon::resolver('25.99405', '25.9940'))
        ->toBe(['precio' => '25.9941', 'capturado' => true]);
});

test('dos cifras distintas que coinciden al redondear NO cuentan como capturado', function () {
    expect(PrecioDeRenglon::resolver('25.99404', '25.9940'))
        ->toBe(['precio' => '25.9940', 'capturado' => false]);
});

test('un cero que llega como NUMERO sigue siendo un precio, no una ausencia', function () {
    // `0.0 == null` es verdadero en PHP: con `==` en vez de `===` este cero se tomaria por
    // ausencia y se cobraria el precio del catalogo. La pantalla manda JSON, asi que el cero
    // llega como numero y este es el camino real.
    expect(PrecioDeRenglon::resolver(0.0, '500.0000'))
        ->toBe(['precio' => '0.0000', 'capturado' => true])
        ->and(PrecioDeRenglon::resolver(0, '500.0000'))
        ->toBe(['precio' => '0.0000', 'capturado' => true]);
});

test('un negativo no se corrige en silencio: la clase no valida, solo decide', function () {
    // Quien valida es `StoreRenglonRequest` (`min:0`). Si esta clase hiciera `abs()` o
    // `max(0, ...)`, un error de quien llama se convertiria en un cobro silencioso.
    expect(PrecioDeRenglon::resolver('-5', '500.0000'))
        ->toBe(['precio' => '-5.0000', 'capturado' => true]);
});
