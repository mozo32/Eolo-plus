<?php

use App\Support\ComisionAmex;

test('reproduce las comisiones del historico al centavo', function (string $montoBruto, string $esperada) {
    expect(ComisionAmex::calcular($montoBruto, '0.1600'))->toBe($esperada);
})->with([
    // [monto cargado a la tarjeta, comision guardada en el sistema viejo]
    ['105.2816', '5.14'],
    ['307.4', '15.00'],
    ['647.9992', '31.62'],
    ['182440.6704', '8902.44'],
    ['256431.8388', '12512.94'],
]);

test('el monto redondeado a dos decimales cae en el mismo centavo', function () {
    // El operador solo puede teclear dos decimales; el historico trae cuatro.
    expect(ComisionAmex::calcular('105.28', '0.1600'))->toBe('5.14');
});

test('la comision es el 6% de la base que implica el monto bruto', function () {
    // 1000 / 1.2296 = 813.2726...  y el 6% de eso es 48.796...
    expect(ComisionAmex::calcular('1000.00', '0.1600'))->toBe('48.80');
});

test('la tasa de IVA se lee, no se fija: con otra tasa la comision cambia', function () {
    // Divisor 1.08 x 1.06 = 1.1448, no 1.2296. Si alguien dejara el literal, esto falla.
    expect(ComisionAmex::calcular('1000.00', '0.0800'))->toBe('52.41');
});

test('monto cero da comision cero', function () {
    expect(ComisionAmex::calcular('0.00', '0.1600'))->toBe('0.00');
});

test('un monto que no es decimal lanza en lugar de cobrar un numero inventado', function () {
    expect(fn () => ComisionAmex::calcular('x', '0.1600'))->toThrow(UnexpectedValueException::class);
    expect(fn () => ComisionAmex::calcular('100.00', 'x'))->toThrow(UnexpectedValueException::class);
});

test('una tasa que haria cero el divisor lanza en lugar de dividir entre cero', function () {
    // Imposible hoy (la tasa es >= 0 y el divisor es (1+tasa) x 1.06 >= 1.06), pero la
    // guarda documenta por que nadie tiene que volver a preguntarselo.
    expect(fn () => ComisionAmex::calcular('100.00', '-1.0000'))->toThrow(UnexpectedValueException::class);
});

test('el redondeo de medio centavo es exacto: 1.005 redondea a 1.01', function () {
    // Cociente exacto 1.005000: con 0.005 suma a 1.010 (trunca a 1.01).
    // Mata quitar el + 0.005 (no redondea, trunca a 1.00) y bajarlo a 0.004
    // (suma a 1.009, trunca a 1.00). No mata cambiar a 0.006 porque 1.005 + 0.006 = 1.011
    // también trunca a 1.01. La mutación de 0.006 se mata por separado con 20.5856.
    expect(ComisionAmex::calcular('20.5958', '0.1600'))->toBe('1.01');
});

test('el redondeo de medio centavo es exacto: 100.005 redondea a 100.01', function () {
    // Segundo caso de exactitud de medio centavo: 2049.4358 / 1.2296 × 0.06 = 100.005000
    expect(ComisionAmex::calcular('2049.4358', '0.1600'))->toBe('100.01');
});

test('la constante de redondeo es 0.005 y no 0.006', function () {
    // Cociente 1.004502: con 0.005 suma a 1.009502 (trunca a 1.00), con 0.006 suma a 1.010502
    // (trunca a 1.01). La franja [0.004, 0.005) es donde 0.005 y 0.006 dan centavos distintos.
    // El monto 20.5856 con tasa 0.1600 cae exactamente ahí. Mata la mutación 0.005 -> 0.006.
    expect(ComisionAmex::calcular('20.5856', '0.1600'))->toBe('1.00');
});

test('la tasa se respeta con sus cuatro decimales', function () {
    // Tasa 0.0855 da divisor 1.0855 × 1.06 = 1.150630, cociente 1000 / 1.150630 = 869.08...
    // Su 6% es 52.1453..., redondea a 52.15. Si se baja escala del bcadd('1', $tasaIva, 4)
    // a 2, la tasa se trunca a 0.08, divisor es 1.1448, cociente da 52.41 incorrecto.
    // Esta prueba mata esa mutación de escala a 2.
    expect(ComisionAmex::calcular('1000.00', '0.0855'))->toBe('52.15');
});

test('entrada con espacios es válida: se recorta al entrar', function () {
    // El trim en calcular() permite que la entrada web con espacios no lance ValueError
    // en bcmul, sino que se acepte normalmente y dé el resultado correcto.
    expect(ComisionAmex::calcular(' 105.28 ', '0.1600'))->toBe('5.14');
});
