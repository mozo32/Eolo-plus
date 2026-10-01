<?php
// tests/Unit/ImporteServicioTest.php

use App\Models\FactServicio;
use App\Support\ImporteServicio;

/*
 * La fórmula no cambia. Estos son los mismos números que `FactServicio::importe()`
 * ya producía y que `importeVistaPrevia` reproduce en TypeScript.
 */
test('sin ajuste ni margen el importe es precio por cantidad', function () {
    expect(ImporteServicio::calcular(1000.0, 1, 0.0, ImporteServicio::AJUSTE_NINGUNO))->toBe('1000.00')
        ->and(ImporteServicio::calcular(1000.0, 3, 0.0, ImporteServicio::AJUSTE_NINGUNO))->toBe('3000.00');
});

test('el margen se aplica como porcentaje sobre el precio ajustado', function () {
    expect(ImporteServicio::calcular(1000.0, 1, 50.0, ImporteServicio::AJUSTE_NINGUNO))->toBe('1500.00');
});

test('cada ajuste da su numero', function (string $ajuste, string $esperado) {
    expect(ImporteServicio::calcular(1000.0, 1, 0.0, $ajuste))->toBe($esperado);
})->with([
    'ninguno' => [ImporteServicio::AJUSTE_NINGUNO, '1000.00'],
    'mas 5 por ciento' => [ImporteServicio::AJUSTE_MAS_5, '1050.00'],
    'sin IVA' => [ImporteServicio::AJUSTE_SIN_IVA, '862.07'],
    'comision 131' => [ImporteServicio::AJUSTE_COMISION_131, '877.86'],
]);

test('null se trata como ninguno', function () {
    expect(ImporteServicio::calcular(1000.0, 1, 0.0, null))->toBe('1000.00');
});

test('un ajuste desconocido lanza en lugar de cobrar de mas o de menos', function () {
    ImporteServicio::calcular(1000.0, 1, 0.0, 'mas10');
})->throws(UnexpectedValueException::class);

test('la cadena vacia tambien lanza: no es ninguno', function () {
    ImporteServicio::calcular(1000.0, 1, 0.0, '');
})->throws(UnexpectedValueException::class);

/*
 * La prueba que importa de verdad: `FactServicio::importe()` sigue dando
 * exactamente lo que daba antes de la extracción. Si delega mal, esto cae.
 */
test('FactServicio::importe delega y no cambia ningun numero', function () {
    $servicio = new FactServicio([
        'nombre' => 'Comisariato',
        'margen' => 50,
        'ajuste_precio' => FactServicio::AJUSTE_COMISION_131,
    ]);

    expect($servicio->importe(1310.0, 1))->toBe(ImporteServicio::calcular(1310.0, 1, 50.0, ImporteServicio::AJUSTE_COMISION_131))
        ->and($servicio->importe(1310.0, 1))->toBe('1725.00');
});

test('el precio cero es valido y da importe cero', function () {
    expect(ImporteServicio::calcular(0.0, 5, 50.0, ImporteServicio::AJUSTE_NINGUNO))->toBe('0.00');
});

/*
 * LIMITACIÓN: esta prueba clava el lado de PHP, no la equivalencia con
 * TypeScript. Los literales salieron de un barrido de 512 combinaciones contra
 * `importeVistaPrevia` (formato.ts) en el que las dos implementaciones dieron lo
 * mismo, pero si alguien cambia el TypeScript esta prueba sigue verde. La
 * equivalencia solo la demuestra volver a correr el barrido, y por eso el paso
 * queda documentado en la guía de despliegue.
 */
test('los importes clavados por el barrido contra TypeScript no cambian', function (float $precio, int $cantidad, float $margen, string $ajuste, string $esperado) {
    expect(ImporteServicio::calcular($precio, $cantidad, $margen, $ajuste))->toBe($esperado);
})->with([
    [1000.0, 1, 0.0, 'ninguno', '1000.00'],
    [1000.0, 1, 50.0, 'ninguno', '1500.00'],
    [1150.0, 1, 50.0, 'comision_131', '1514.31'],
    [2105.8601, 1, 0.0, 'ninguno', '2105.86'],
    [100.20, 1, 0.0, 'mas_5', '105.21'],
    [1000.0, 3, 15.0, 'sin_iva', '2974.14'],
    [19250.0, 1, 50.0, 'ninguno', '28875.00'],
    [0.0, 7, 999.99, 'comision_131', '0.00'],
    // Los extremos del barrido: el precio y el margen máximos, y el mínimo que aún redondea a un centavo.
    [999999.9999, 7, 999.99, 'comision_131', '67594805.34'],
    [0.0001, 7, 999.99, 'sin_iva', '0.01'],
    [2105.8601, 3, 15.0, 'comision_131', '6377.86'],
    [1150.0, 2, 50.0, 'mas_5', '3622.50'],
]);
