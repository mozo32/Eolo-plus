<?php
// tests/Feature/Facturacion/ConceptoFormaPagoTest.php

use App\Models\FactFormaPago;

beforeEach(fn () => formasDePago());

test('el concepto es unico: no puede haber dos formas de pago que sean Efectivo', function () {
    FactFormaPago::create(['nombre' => 'Caja chica', 'concepto' => null]);

    expect(fn () => FactFormaPago::where('nombre', 'Caja chica')->first()->update(['concepto' => 'efectivo']))
        ->toThrow(Illuminate\Database\QueryException::class);
});

test('el scope encuentra la forma por concepto y no por nombre', function () {
    // Renombrarla en pantalla NO debe romper la regla que la reconoce.
    FactFormaPago::porConcepto(FactFormaPago::CONCEPTO_AMEX)->first()->update(['nombre' => 'American Express']);

    expect(FactFormaPago::porConcepto(FactFormaPago::CONCEPTO_AMEX)->first()->nombre)->toBe('American Express');
});
