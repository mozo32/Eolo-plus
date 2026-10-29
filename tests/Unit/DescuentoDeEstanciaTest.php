<?php

use App\Models\FactAeronave;
use App\Models\FactServicio;
use App\Support\DescuentoDeEstancia;

test('el precio del descuento es la tarifa en negativo, con cuatro decimales', function () {
    expect(DescuentoDeEstancia::precioDe('4676.00'))->toBe('-4676.0000');
});

test('una tarifa capturada en negativo no se convierte en un cobro', function () {
    // El sistema viejo escribe -abs($importe) (aplicar_descuento.php:38). Sin el valor
    // absoluto, una tarifa en negativo daria un descuento POSITIVO, o sea un cargo.
    expect(DescuentoDeEstancia::precioDe('-1144.50'))->toBe('-1144.5000');
});

test('una tarifa en cero no cambia de signo ni se vuelve un menos cero', function () {
    expect(DescuentoDeEstancia::precioDe('0.00'))->toBe('0.0000');
});

test('el nombre del renglon es el que lee el cliente en el documento', function () {
    expect(DescuentoDeEstancia::nombreDe(FactServicio::CONCEPTO_ESTANCIA_PERNOCTA))->toBe('Descuento pernocta')
        ->and(DescuentoDeEstancia::nombreDe(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H))->toBe('Descuento tránsito de 2 horas')
        ->and(DescuentoDeEstancia::nombreDe(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H))->toBe('Descuento tránsito de 12 horas');
});

test('la etiqueta de la bitacora nombra el tramo, sin la palabra descuento', function () {
    expect(DescuentoDeEstancia::etiquetaDe(FactServicio::CONCEPTO_ESTANCIA_PERNOCTA))->toBe('pernocta')
        ->and(DescuentoDeEstancia::etiquetaDe(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H))->toBe('tránsito de 2 horas')
        ->and(DescuentoDeEstancia::etiquetaDe(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H))->toBe('tránsito de 12 horas');
});

test('cada tramo tiene su propio concepto de descuento', function () {
    expect(DescuentoDeEstancia::conceptoDe(FactServicio::CONCEPTO_ESTANCIA_PERNOCTA))->toBe('descuento_estancia_pernocta')
        ->and(DescuentoDeEstancia::conceptoDe(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H))->toBe('descuento_estancia_transito_2h')
        ->and(DescuentoDeEstancia::conceptoDe(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H))->toBe('descuento_estancia_transito_12h');
});

test('los tres tramos descontables son los del sistema viejo, y los dos ajustes no', function () {
    expect(DescuentoDeEstancia::conceptosDescontables())->toBe([
        FactServicio::CONCEPTO_ESTANCIA_PERNOCTA,
        FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H,
        FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H,
    ]);
});

test('el concepto del descuento NO es un concepto de estancia', function () {
    // Si lo fuera, `CargosEstancia::quitarEstancia()` lo borraria en cada recalculo:
    // borra `whereIn('concepto', CONCEPTOS_ESTANCIA)`.
    foreach (DescuentoDeEstancia::conceptos() as $concepto) {
        expect(FactServicio::CONCEPTOS_ESTANCIA)->not->toContain($concepto);
    }
});

test('el concepto del descuento no empieza por estancia_', function () {
    // `esConceptoDeEstancia()` del front (formato.ts:290) marca como «cargo de estancia»
    // todo lo que empiece por `estancia_`. Un descuento no lo es.
    foreach (DescuentoDeEstancia::conceptos() as $concepto) {
        expect(str_starts_with($concepto, 'estancia_'))->toBeFalse();
    }
});

test('los conceptos del descuento caben en la columna, que es varchar(32)', function () {
    foreach (DescuentoDeEstancia::conceptos() as $concepto) {
        expect(strlen($concepto))->toBeLessThanOrEqual(32);
    }
});

test('la tarifa sale de la matricula, tramo por tramo', function () {
    $satelite = new FactAeronave([
        'tarifa_pernocta' => 4676.00,
        'tarifa_transito_2h' => 1144.50,
        'tarifa_transito_12h' => 2338.00,
    ]);

    expect((float) DescuentoDeEstancia::tarifaDe($satelite, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA))->toBe(4676.00)
        ->and((float) DescuentoDeEstancia::tarifaDe($satelite, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H))->toBe(1144.50)
        ->and((float) DescuentoDeEstancia::tarifaDe($satelite, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H))->toBe(2338.00);
});

test('sin tarifa devuelve null y no inventa un cero', function () {
    // `tarifaPernocta()` consulta `categoria` cuando la matricula no tiene tarifa. Sin base de
    // datos esa relacion revienta aunque la clave sea nula, asi que se fija ya cargada en null.
    $satelite = new FactAeronave();
    $satelite->setRelation('categoria', null);

    expect(DescuentoDeEstancia::tarifaDe($satelite, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA))->toBeNull();
});

test('un concepto que no admite descuento lanza en lugar de devolver algo', function (string $metodo, string $concepto) {
    DescuentoDeEstancia::$metodo($concepto);
})->with([
    ['conceptoDe', FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H],
    ['conceptoDe', FactServicio::CONCEPTO_COMBUSTIBLE],
    ['nombreDe', FactServicio::CONCEPTO_ESTANCIA_AJUSTE_12H_PERNOCTA],
    ['etiquetaDe', FactServicio::CONCEPTO_COMISION_AMEX],
])->throws(InvalidArgumentException::class);

test('la tarifa de un concepto que no admite descuento lanza', function () {
    DescuentoDeEstancia::tarifaDe(new FactAeronave(), FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H);
})->throws(InvalidArgumentException::class);
