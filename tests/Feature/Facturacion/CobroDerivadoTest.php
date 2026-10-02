<?php

use App\Models\FactFormaPago;
use App\Models\FactPrefactura;
use App\Models\FactPrefacturaPago;

test('sin pagos, lo pagado es cero y falta todo el total', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);

    expect($p->pagado())->toBe('0.00')
        ->and($p->total())->toBe('116.00')
        ->and($p->porCobrar())->toBe('116.00')
        ->and($p->sobrepago())->toBe('0.00')
        ->and($p->efectivoPagado())->toBe('0.00')
        ->and($p->cambio())->toBe('0.00')
        ->and($p->cobradoDeMas())->toBe('0.00');
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

test('porCobrar nunca es negativo y el sobrepago en efectivo es todo cambio', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);
    pagoDe($p, formasDePago()[FactFormaPago::CONCEPTO_EFECTIVO], '200.00');

    expect($p->porCobrar())->toBe('0.00')
        ->and($p->sobrepago())->toBe('84.00')
        ->and($p->cambio())->toBe('84.00')
        ->and($p->cobradoDeMas())->toBe('0.00');
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
        ->and($p->fresh()->cambio())->toBe('0.00')
        ->and($p->fresh()->cobradoDeMas())->toBe('116.00');
});

test('el caso mixto: el cambio no pasa del efectivo que entro y el resto es cobrado de mas', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);
    $formas = formasDePago();
    pagoDe($p, $formas['Visa'], '200.00');
    pagoDe($p, $formas[FactFormaPago::CONCEPTO_EFECTIVO], '10.00');

    expect($p->sobrepago())->toBe('94.00')
        ->and($p->efectivoPagado())->toBe('10.00')
        ->and($p->cambio())->toBe('10.00')
        ->and($p->cobradoDeMas())->toBe('84.00');
});

test('efectivo exacto: no hay sobrepago ni cambio', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);
    pagoDe($p, formasDePago()[FactFormaPago::CONCEPTO_EFECTIVO], '116.00');

    expect($p->sobrepago())->toBe('0.00')
        ->and($p->efectivoPagado())->toBe('116.00')
        ->and($p->cambio())->toBe('0.00')
        ->and($p->cobradoDeMas())->toBe('0.00');
});

test('los derivados leen la base y no la relacion cacheada', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);
    $p->pagado();                      // cachea la relacion si la usara
    pagoDe($p, formasDePago()['Visa'], '50.00');

    expect($p->pagado())->toBe('50.00');
});

test('una cerrada usa su total sellado, no lo que derivan sus renglones, para decidir lo que falta', function () {
    [$p] = prefacturaCompleta(100.0, 1);
    pagoDe($p, formasDePago()['Visa'], '50.00');
    // El sello (232.00) difiere a proposito de lo derivado (116.00): si porCobrar
    // calculara desde los renglones daria 66.00 y no 182.00.
    $cerrada = cerrarConSello($p, '200.00', '32.00', '232.00');

    expect($cerrada->total())->toBe('232.00')
        ->and($cerrada->porCobrar())->toBe('182.00');
});

test('un pago nace activo aunque la relacion filtre por status', function () {
    $p = prefacturaBorrador();
    $pago = pagoDe($p, formasDePago()['Visa'], '10.00');

    expect($pago->fresh()->status)->toBe(FactPrefacturaPago::STATUS_ACTIVO);
});

test('el efectivo se reconoce por concepto, no por el nombre que se le haya puesto', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);
    $efectivo = formasDePago()[FactFormaPago::CONCEPTO_EFECTIVO];
    $efectivo->update(['nombre' => 'Cash en caja']);
    pagoDe($p, $efectivo, '200.00');

    expect($p->efectivoPagado())->toBe('200.00')
        ->and($p->cambio())->toBe('84.00');
});

test('los pagos salen en el orden en que se registraron', function () {
    $p = prefacturaBorrador();
    $formas = formasDePago();
    $primero = pagoDe($p, $formas['Visa'], '10.00');
    $segundo = pagoDe($p, $formas['Mastercard'], '20.00');
    $tercero = pagoDe($p, $formas['Visa'], '30.00');

    expect($p->pagos()->pluck('id')->all())->toBe([$primero->id, $segundo->id, $tercero->id])
        // En sqlite el orden natural ya es por id, asi que la consulta misma se
        // inspecciona: sin orderBy('id') la pantalla de pagos quedaria a merced del motor.
        ->and(collect($p->pagos()->getQuery()->getQuery()->orders)->pluck('column')->all())->toContain('id');
});
