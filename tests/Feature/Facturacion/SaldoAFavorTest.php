<?php

use App\Models\FactFormaPago;
use Database\Seeders\FacturacionFormasPagoSeeder;

test('el seeder crea la forma de pago del saldo a favor, activa y con su concepto', function () {
    $this->seed(FacturacionFormasPagoSeeder::class);

    $forma = FactFormaPago::where('concepto', FactFormaPago::CONCEPTO_SALDO_A_FAVOR)->sole();

    expect($forma->nombre)->toBe('Saldo a favor')
        ->and($forma->status)->toBe('A');
});

test('la migracion no siembra la forma de pago: fact_formas_pago sigue siendo un espejo del origen', function () {
    expect(FactFormaPago::count())->toBe(0);
});

test('correr el seeder otra vez no deja dos filas ni pisa lo que el operador edito', function () {
    $this->seed(FacturacionFormasPagoSeeder::class);
    FactFormaPago::where('concepto', FactFormaPago::CONCEPTO_SALDO_A_FAVOR)
        ->update(['nombre' => 'Saldo del cliente', 'status' => FactFormaPago::STATUS_INACTIVO]);

    $this->seed(FacturacionFormasPagoSeeder::class);

    $formas = FactFormaPago::all();

    expect($formas)->toHaveCount(1)
        ->and($formas->first()->concepto)->toBe(FactFormaPago::CONCEPTO_SALDO_A_FAVOR)
        ->and($formas->first()->nombre)->toBe('Saldo del cliente')
        ->and($formas->first()->status)->toBe(FactFormaPago::STATUS_INACTIVO);
});

test('si ya hay una forma llamada Saldo a favor sin concepto, el seeder la adopta en vez de chocar con el nombre unico', function () {
    $previa = FactFormaPago::create(['nombre' => 'Saldo a favor']);

    $this->seed(FacturacionFormasPagoSeeder::class);

    expect(FactFormaPago::count())->toBe(1)
        ->and($previa->fresh()->concepto)->toBe(FactFormaPago::CONCEPTO_SALDO_A_FAVOR);
});

test('el seeder no borra ni toca las formas que trae el origen', function () {
    $efectivo = FactFormaPago::create(['nombre' => 'Efectivo', 'concepto' => FactFormaPago::CONCEPTO_EFECTIVO]);

    $this->seed(FacturacionFormasPagoSeeder::class);

    expect(FactFormaPago::count())->toBe(2)
        ->and($efectivo->fresh()->concepto)->toBe(FactFormaPago::CONCEPTO_EFECTIVO);
});

test('un pago con saldo a favor NO baja el subtotal ni el IVA de la prefactura', function () {
    // Es la razon de disenarlo como forma de pago y no como renglon negativo: un saldo a
    // favor es dinero, no un precio menor, asi que no toca la base gravable. El sistema
    // viejo lo metia como renglon negativo y bajaba el IVA en los 4 casos del historico.
    [$p] = prefacturaCompleta(1000.0, 1);
    $formas = formasDePago();

    $subtotalAntes = $p->subtotal();
    $ivaAntes = $p->iva();

    pagoDe($p, $formas[FactFormaPago::CONCEPTO_SALDO_A_FAVOR], '300.00');

    expect($subtotalAntes)->toBe('1000.00')
        ->and($ivaAntes)->toBe('160.00')
        ->and($p->fresh()->subtotal())->toBe($subtotalAntes)
        ->and($p->fresh()->iva())->toBe($ivaAntes)
        ->and($p->fresh()->pagado())->toBe('300.00')
        ->and($p->fresh()->porCobrar())->toBe('860.00');
});

test('un sobrepago con saldo a favor cae en cobrado de mas, NO en cambio', function () {
    // No se devuelve efectivo por un saldo. Sale gratis porque cambio() acota al efectivo.
    // Aqui no entra efectivo alguno, asi que el cambio es cero y TODO el sobrepago queda
    // como cobrado de mas: si efectivoPagado() dejara de filtrar por concepto, el cambio
    // valdria 84.00 y el cobrado de mas 0.00.
    [$p] = prefacturaCompleta(100.0, 1);
    $formas = formasDePago();

    pagoDe($p, $formas[FactFormaPago::CONCEPTO_SALDO_A_FAVOR], '200.00');

    expect($p->fresh()->cambio())->toBe('0.00')
        ->and($p->fresh()->cobradoDeMas())->toBe('84.00')
        ->and($p->fresh()->sobrepago())->toBe('84.00');
});

test('con efectivo Y saldo a favor, solo el efectivo puede volver como cambio', function () {
    // Total 116.00, saldo a favor 200.00 y efectivo 10.00: pagado 210.00, sobrepago 94.00.
    // El efectivo es 10.00, asi que solo esos 10.00 vuelven como cambio y los otros 84.00
    // son del saldo a favor: cobrado de mas. El efectivo es MENOR que el sobrepago a
    // proposito; con un efectivo mayor (p. ej. 50.00 sobre un sobrepago de 34.00) el
    // cambio saldria igual aunque el saldo a favor contara como efectivo.
    [$p] = prefacturaCompleta(100.0, 1);
    $formas = formasDePago();

    pagoDe($p, $formas[FactFormaPago::CONCEPTO_SALDO_A_FAVOR], '200.00');
    pagoDe($p, $formas[FactFormaPago::CONCEPTO_EFECTIVO], '10.00');

    expect($p->fresh()->sobrepago())->toBe('94.00')
        ->and($p->fresh()->cambio())->toBe('10.00')
        ->and($p->fresh()->cobradoDeMas())->toBe('84.00');
});

test('el saldo a favor se registra por el endpoint de pagos como cualquier otra forma', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    $formas = formasDePago();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", [
        'forma_pago_id' => $formas[FactFormaPago::CONCEPTO_SALDO_A_FAVOR]->id,
        'monto' => '50.00',
    ])->assertCreated();

    expect($p->fresh()->pagado())->toBe('50.00');
});
