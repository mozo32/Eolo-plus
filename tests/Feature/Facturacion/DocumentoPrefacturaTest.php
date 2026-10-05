<?php

use App\Models\FactConfiguracion;
use App\Models\FactPrefactura;
use App\Models\FactServicio;

/** El HTML que la plantilla genera para una prefactura. */
function documentoDe(FactPrefactura $p, bool $esCotizacion, string $elaboradoPor = 'Ana Pérez'): string
{
    $p = $p->fresh(['renglones', 'pagos.formaPago', 'cliente', 'aeronave']);

    return view('pdf.prefactura', [
        'prefactura' => $p,
        'esCotizacion' => $esCotizacion,
        'subtotal' => $esCotizacion ? $p->subtotal() : (string) $p->subtotal_sellado,
        'iva' => $esCotizacion ? $p->iva() : (string) $p->iva_sellado,
        'ivaEtiqueta' => $p->ivaTasaEtiqueta(),
        'total' => $esCotizacion ? $p->total() : (string) $p->total_sellado,
        'cambio' => $p->cambio(),
        'elaboradoPor' => $elaboradoPor,
    ])->render();
}

test('el documento emitido trae el folio, el total SELLADO y cada renglon', function () {
    [$p] = prefacturaCompleta(1000.0, 2);
    renglonDe($p, 250.0, 1);
    // El sello dice 2250.00 y los renglones derivan 2250.00; aqui coinciden a proposito.
    $cerrada = cerrarConSello($p, '2250.00', '360.00', '2610.00');

    $html = documentoDe($cerrada, esCotizacion: false);

    expect($html)->toContain('PREFACTURA DE SERVICIOS')
        ->and($html)->toContain('10000')          // el folio que cerrarConSello pone
        ->and($html)->toContain('2,610.00')       // el total sellado, formateado
        ->and($html)->toContain('IVA (16%)')
        ->and($html)->not->toContain('COTIZACIÓN');

    foreach ($cerrada->renglones as $renglon) {
        expect($html)->toContain($renglon->nombre_servicio);
    }
});

test('el documento usa el sello y NO lo que derivan los renglones', function () {
    // Esta es la prueba que protege el invariante del documento: el cliente vio el sello.
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '999.00', '159.84', '1158.84');

    $html = documentoDe($cerrada, esCotizacion: false);

    expect($html)->toContain('1,158.84')   // el sello
        ->and($html)->not->toContain('116.00');  // lo que derivarian los renglones
});

test('la vista imprime las cifras que recibe y no las pide al modelo', function () {
    // `total()` de una prefactura cerrada devuelve el sello, asi que la prueba anterior no
    // distingue una plantilla que lo llame de una que use el array. Con cifras que el
    // modelo no puede dar, si.
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '999.00', '159.84', '1158.84')
        ->fresh(['renglones', 'pagos.formaPago', 'cliente', 'aeronave']);

    $html = view('pdf.prefactura', [
        'prefactura' => $cerrada,
        'esCotizacion' => false,
        'subtotal' => '1111.11',
        'iva' => '2222.22',
        'ivaEtiqueta' => '33.33%',
        'total' => '3333.33',
        'cambio' => '4444.44',
        'elaboradoPor' => 'Ana Pérez',
    ])->render();

    expect($html)->toContain('1,111.11')
        ->and($html)->toContain('2,222.22')
        ->and($html)->toContain('IVA (33.33%)')
        ->and($html)->toContain('4,444.44')
        ->and($html)->toContain('3,333.33')
        ->and($html)->not->toContain('1,158.84');
});

test('la cotizacion dice COTIZACION, no trae folio y avisa de que no esta emitida', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 500.0, 1);

    $html = documentoDe($p->fresh(), esCotizacion: true);

    expect($html)->toContain('COTIZACIÓN')
        ->and($html)->toContain('no es un documento emitido')
        ->and($html)->not->toContain('PREFACTURA DE SERVICIOS')
        ->and($html)->toContain('580.00');   // el total derivado
});

test('un renglon de cortesia sale con su precio y el importe en cero, marcado', function () {
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 300.0, 2);
    $renglon->update(['es_cortesia' => true]);

    $html = documentoDe($p->fresh(), esCotizacion: true);

    // El documento tiene que mostrar QUE se dejo de cobrar, no esconderlo.
    expect($html)->toContain('300.0000')     // el precio unitario sigue visible
        ->and($html)->toContain('Cortesía')
        ->and($html)->toContain('0.00')
        // 300 x 2: el importe que la cortesía suprime no puede salir en ningun sitio.
        ->and($html)->not->toContain('600.00');
});

test('el renglon de comision Amex se identifica en el documento', function () {
    $p = prefacturaBorrador();
    $servicio = FactServicio::create([
        'nombre' => 'Comisión AMEX', 'precio_unitario' => 48.80,
        'concepto' => FactServicio::CONCEPTO_COMISION_AMEX,
    ]);
    $p->renglones()->create([
        'servicio_id' => $servicio->id, 'nombre_servicio' => $servicio->nombre,
        'precio_unitario' => 48.80, 'cantidad' => 1, 'es_de_tercero' => false,
        'margen' => 0, 'ajuste_precio' => 'ninguno',
        'concepto' => FactServicio::CONCEPTO_COMISION_AMEX, 'orden' => 2,
    ]);

    expect(documentoDe($p->fresh(), esCotizacion: true))->toContain('Comisión AMEX');
});

test('las formas de pago salen con su monto, y el cambio cuando lo hay', function () {
    [$p] = prefacturaCompleta(100.0, 1);
    $formas = formasDePago();
    pagoDe($p, $formas[App\Models\FactFormaPago::CONCEPTO_EFECTIVO], '200.00');
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    $html = documentoDe($cerrada, esCotizacion: false);

    expect($html)->toContain('Efectivo')
        ->and($html)->toContain('200.00')
        ->and($html)->toContain('84.00');   // el cambio derivado
});

test('la nota externa se imprime y las otras dos NO', function () {
    // De las tres notas, solo la externa sale en papel: lo confirman los cuatro PDF
    // vivos del sistema viejo, que leen unicamente nota_ext.
    [$p] = prefacturaCompleta(100.0, 1);
    $p->update([
        'nota_interna' => 'OJO ESTA ES INTERNA',
        'nota_externa' => 'Servicio nocturno',
        'nota_factura' => 'OJO ESTA ES DE FACTURA',
    ]);
    $cerrada = cerrarConSello($p->fresh(), '100.00', '16.00', '116.00');

    $html = documentoDe($cerrada, esCotizacion: false);

    expect($html)->toContain('Servicio nocturno')
        ->and($html)->not->toContain('OJO ESTA ES INTERNA')
        ->and($html)->not->toContain('OJO ESTA ES DE FACTURA');
});

test('Elaborado por trae el nombre que se le pasa, no un literal', function () {
    // El PDF viejo imprime "Elaborado por: AJE" escrito a mano, mientras el dato guarda
    // un id_elaborador que ningun PDF lee.
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    expect(documentoDe($cerrada, esCotizacion: false, elaboradoPor: 'Luis Ramírez'))
        ->toContain('Luis Ramírez')
        ->and(documentoDe($cerrada, esCotizacion: false, elaboradoPor: 'Luis Ramírez'))
        ->not->toContain('AJE');
});

test('el pie trae el aviso de las 72 horas y el de privacidad, literales', function () {
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    $html = documentoDe($cerrada, esCotizacion: false);

    expect($html)->toContain('72 horas naturales')
        ->and($html)->toContain('MXN $250.00 + IVA')
        ->and($html)->toContain('eolo.com.mx/#/privacidad')
        ->and($html)->toContain('solicitar su factura fiscal')
        ->and($html)->toContain('Contacto: facturacion@eolo.com.mx');

    // El texto ENTERO, sin que los saltos de linea del fuente cuenten.
    $plano = preg_replace('/\s+/', ' ', strip_tags(str_replace('<br>', ' ', $html)));

    expect($plano)->toContain(
        'Estimado cliente, usted cuenta con un máximo de 72 horas naturales posteriores a la fecha '
        .'de emisión de esta prefactura para solicitar su factura fiscal. Tarifa de refacturación: '
        .'MXN $250.00 + IVA. Contacto: facturacion@eolo.com.mx '
        .'Revisa Nuestro Aviso de Privacidad https://www.eolo.com.mx/#/privacidad'
    );
});

test('la relacion cerradaPor da el usuario que cerro', function () {
    [$p, $usuario] = prefacturaCompleta(100.0, 1);
    $p->update(['cerrada_por' => $usuario->id]);

    expect($p->fresh()->cerradaPor->name)->toBe($usuario->name);
});

test('la etiqueta de la tasa es un porcentaje sin ceros de sobra', function (string $tasa, string $etiqueta) {
    [$p] = prefacturaCompleta(100.0, 1);

    expect(cerrarConSello($p, '100.00', '1.00', '101.00', $tasa)->ivaTasaEtiqueta())->toBe($etiqueta);
})->with([
    'dieciseis' => ['0.1600', '16%'],
    'ocho' => ['0.0800', '8%'],
    'dieciseis y medio' => ['0.1650', '16.5%'],
    'cero' => ['0.0000', '0%'],
]);

test('la etiqueta de la tasa de un borrador sigue la tasa vigente de fact_configuracion', function () {
    // Sin sello la etiqueta sale de la configuracion, no de una columna sellada.
    FactConfiguracion::updateOrCreate(['clave' => 'iva_tasa'], ['valor' => '0.08', 'descripcion' => 'Tasa de IVA']);

    expect(prefacturaBorrador()->ivaTasaEtiqueta())->toBe('8%');
});
