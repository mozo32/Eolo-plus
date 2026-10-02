<?php

use App\Models\FactFormaPago;
use App\Models\FactPrefactura;

test('sin pagos, lo pagado es cero y falta todo el total', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);

    expect($p->pagado())->toBe('0.00')
        ->and($p->total())->toBe('116.00')
        ->and($p->porCobrar())->toBe('116.00')
        ->and($p->sobrepago())->toBe('0.00')
        ->and($p->sobrepagoEsCambio())->toBeFalse();
});

test('lo pagado es la suma de los pagos, sin pasar por float', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);
    $formas = formasDePago();

    pagoDe($p, $formas['Visa'], '0.10');
    pagoDe($p, $formas['Visa'], '0.20');

    // 0.10 + 0.20 en float da 0.30000000000000004.
    expect($p->pagado())->toBe('0.30')
        ->and($p->porCobrar())->toBe('115.70');
});

test('un pago dado de baja no cuenta', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);
    $pago = pagoDe($p, formasDePago()['Visa'], '116.00');
    $pago->update(['status' => 'N']);

    expect($p->pagado())->toBe('0.00')
        ->and($p->pagos()->count())->toBe(0);
});

test('porCobrar nunca es negativo y el sobrepago aparece en su lugar', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);
    pagoDe($p, formasDePago()[FactFormaPago::CONCEPTO_EFECTIVO], '200.00');

    expect($p->porCobrar())->toBe('0.00')
        ->and($p->sobrepago())->toBe('84.00')
        ->and($p->sobrepagoEsCambio())->toBeTrue();
});

test('un sobrepago SIN efectivo no es cambio: es cobrado de mas', function () {
    // Pasa de verdad: se cobra con tarjeta y despues se quita un servicio.
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 1);
    renglonDe($p, 500.0, 1);
    pagoDe($p, formasDePago()['Visa'], '696.00');
    $renglon->delete();

    expect($p->fresh()->total())->toBe('580.00')
        ->and($p->fresh()->sobrepago())->toBe('116.00')
        ->and($p->fresh()->sobrepagoEsCambio())->toBeFalse();
});

test('los derivados leen la base y no la relacion cacheada', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);
    $p->pagado();                      // cachea la relacion si la usara
    pagoDe($p, formasDePago()['Visa'], '50.00');

    expect($p->pagado())->toBe('50.00');
});

test('una cerrada usa su total sellado para decidir lo que falta', function () {
    [$p] = prefacturaCompleta(100.0, 1);
    pagoDe($p, formasDePago()['Visa'], '50.00');
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    expect($cerrada->porCobrar())->toBe('66.00');
});

test('un pago nace activo aunque la relacion filtre por status', function () {
    $p = prefacturaBorrador();
    $pago = pagoDe($p, formasDePago()['Visa'], '10.00');

    expect($pago->fresh()->status)->toBe(App\Models\FactPrefacturaPago::STATUS_ACTIVO);
});

test('el efectivo se reconoce por concepto, no por el nombre que se le haya puesto', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);
    $efectivo = formasDePago()[FactFormaPago::CONCEPTO_EFECTIVO];
    $efectivo->update(['nombre' => 'Cash en caja']);
    pagoDe($p, $efectivo, '200.00');

    expect($p->sobrepagoEsCambio())->toBeTrue();
});
