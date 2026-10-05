<?php

use App\Models\FactAeronave;
use App\Models\FactCategoriaAeronave;
use App\Models\FactConfiguracion;
use App\Models\FactPrefactura;
use App\Models\FactPrefacturaRenglon;
use App\Models\FactServicio;
use App\Models\TipoAeronave;

/** Los importes de los renglones, como quien llama los arma: por id, sobre la coleccion cargada. */
function importesDe(FactPrefactura $p): array
{
    return $p->renglones
        ->mapWithKeys(fn (FactPrefacturaRenglon $renglon) => [$renglon->id => $renglon->importe()])
        ->all();
}

/** El HTML que la plantilla genera para una prefactura. */
function documentoDe(FactPrefactura $p, bool $esCotizacion, string $elaboradoPor = 'Ana Pérez'): string
{
    $p = $p->fresh(['renglones', 'pagos.formaPago', 'cliente', 'aeronave.tipoAeronave', 'satelite.categoria']);

    return view('pdf.prefactura', [
        'prefactura' => $p,
        'esCotizacion' => $esCotizacion,
        'subtotal' => $esCotizacion ? $p->subtotal() : (string) $p->subtotal_sellado,
        'iva' => $esCotizacion ? $p->iva() : (string) $p->iva_sellado,
        'ivaEtiqueta' => $p->ivaTasaEtiqueta(),
        'total' => $esCotizacion ? $p->total() : (string) $p->total_sellado,
        'cambio' => $p->cambio(),
        'importes' => importesDe($p),
        'elaboradoPor' => $elaboradoPor,
    ])->render();
}

/** Una categoria de aeronave: la tabla exige las tres tarifas, que aqui no importan. */
function categoriaDeAeronave(string $nombre): FactCategoriaAeronave
{
    return FactCategoriaAeronave::create([
        'nombre' => $nombre, 'tarifa_pernocta' => 1.0, 'tarifa_transito_2h' => 1.0, 'tarifa_transito_12h' => 1.0,
    ]);
}

/** La fila `<tr>` del documento que contiene el texto dado: ata una celda a SU renglon y no a la pagina entera. */
function filaDelDocumento(string $html, string $texto): string
{
    preg_match_all('#<tr[^>]*>.*?</tr>#s', $html, $filas);

    $coinciden = array_values(array_filter($filas[0], fn (string $fila) => str_contains($fila, $texto)));

    expect($coinciden)->toHaveCount(1);

    return $coinciden[0];
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
        'importes' => importesDe($cerrada),
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
    $cortesia = renglonDe($p, 300.0, 2);
    $cortesia->update(['es_cortesia' => true]);
    // Un segundo renglon COBRABLE: con la cortesia como unico renglon, subtotal, IVA y total valen
    // '0.00' y la plantilla los imprime en las tres filas de totales, asi que un `0.00` suelto lo
    // satisfaria el bloque de totales pase lo que pase en la celda del renglon. El importe y los
    // totales de este (123.45, 19.75, 143.20) no contienen `0.00`.
    $cobrable = renglonDe($p, 123.45, 1);

    $html = documentoDe($p->fresh(), esCotizacion: true);

    // Se afirma sobre la FILA de cada renglon y sobre la celda exacta: `0.00` suelto aparece tambien
    // dentro del precio `300.0000`, y `<td class="derecha">0.00</td>` solo lo produce un importe en cero.
    $filaCortesia = filaDelDocumento($html, '(Cortesía)');
    $filaCobrable = filaDelDocumento($html, $cobrable->nombre_servicio);

    // El documento tiene que mostrar QUE se dejo de cobrar, no esconderlo.
    expect($filaCortesia)->toContain('<td class="derecha">300.0000</td>')   // el precio unitario sigue visible
        ->and($filaCortesia)->toContain('<td class="derecha">0.00</td>')    // y el importe, en cero
        // 300 x 2: el importe que la cortesia suprime no puede salir en ningun sitio.
        ->and($html)->not->toContain('600.00')
        // El cobrable conserva su importe: una celda que imprimiera cero para todos no pasa.
        ->and($filaCobrable)->toContain('<td class="derecha">123.45</td>')
        ->and($filaCobrable)->not->toContain('<td class="derecha">0.00</td>')
        // Los totales no son cero: el `0.00` de la cortesia ya no puede venir de ellos.
        ->and($html)->toContain('143.20');
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

test('la vista imprime el importe que recibe del renglon y no lo recalcula', function () {
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 2);
    $p = $p->fresh(['renglones', 'pagos.formaPago', 'cliente', 'aeronave']);

    $html = view('pdf.prefactura', [
        'prefactura' => $p,
        'esCotizacion' => true,
        // Los totales no contienen 99.99: asi esa cifra solo puede venir de la fila del renglon.
        'subtotal' => '7.77',
        'iva' => '1.24',
        'ivaEtiqueta' => '16%',
        'total' => '9.01',
        'cambio' => '0.00',
        // Distinto de lo que el renglon derivaria (200.00): si la vista llamara a importe(), saldria 200.00.
        // (No 100.00 x 1: el precio unitario 100.0000 contiene esa cadena.)
        'importes' => [$renglon->id => '99.99'],
        'elaboradoPor' => 'Ana Pérez',
    ])->render();

    expect($html)->toContain('99.99')
        ->and($html)->not->toContain('200.00');
});

test('una clave que falte en importes revienta y no imprime un cero', function () {
    // El framework convierte el aviso en ErrorException en todos los entornos
    // (HandleExceptions::handleError), asi que esto vale tambien en produccion.
    // `php artisan tinker` NO lo lanza: instala su propio manejador de errores.
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);
    $p = $p->fresh(['renglones', 'pagos.formaPago', 'cliente', 'aeronave']);

    expect(fn () => view('pdf.prefactura', [
        'prefactura' => $p,
        'esCotizacion' => true,
        'subtotal' => '100.00',
        'iva' => '16.00',
        'ivaEtiqueta' => '16%',
        'total' => '116.00',
        'cambio' => '0.00',
        'importes' => [],
        'elaboradoPor' => 'Ana Pérez',
    ])->render())->toThrow(ErrorException::class, 'Undefined array key');
});

test('DATOS DE OPERACION y DETALLES DEL CLIENTE imprimen cada dato en SU etiqueta', function () {
    // Ninguna prueba afirmaba sobre estos dos bloques, y por eso la aeronave faltó cinco
    // revisiones. Cada valor es distintivo (no sale en los totales, en el folio ni en otro
    // campo) y se afirma junto a su etiqueta, para que dos campos cambiados de sitio fallen.
    [$p] = prefacturaCompleta(100.0, 1);
    $tipo = TipoAeronave::create(['nombre' => 'Gulfstream G550 Ultra']);
    $categoria = categoriaDeAeronave('Jet Ejecutivo Pesado');
    $p->aeronave->update(['aeronave_id' => $tipo->id]);
    FactAeronave::where('aeronave_id', $p->aeronave_id)->update(['categoria_aeronave_id' => $categoria->id]);
    $p->cliente->update(['nombre' => 'Aerolineas Zafiro SA', 'telefono' => '722-555-0147', 'correo' => 'cuentas@zafiro-aero.example']);
    $p->update([
        'llegada_at' => '2026-04-17 08:15:00',
        'salida_at' => '2026-04-18 16:40:00',
        'origen' => 'MMTO Toluca',
        'destino' => 'KTEB Teterboro',
    ]);
    $cerrada = cerrarConSello($p->fresh(), '100.00', '16.00', '116.00');

    $html = documentoDe($cerrada, esCotizacion: false);

    expect($html)->toContain('Matrícula:</span> '.$cerrada->aeronave->matricula)
        ->and($html)->toContain('Aeronave:</span> Gulfstream G550 Ultra (Jet Ejecutivo Pesado)')
        ->and($html)->toContain('Llegada:</span> 17/04/2026 08:15')
        ->and($html)->toContain('Salida:</span> 18/04/2026 16:40')
        ->and($html)->toContain('Origen:</span> MMTO Toluca')
        ->and($html)->toContain('Destino:</span> KTEB Teterboro')
        ->and($html)->toContain('Nombre:</span> Aerolineas Zafiro SA')
        ->and($html)->toContain('Teléfono:</span> 722-555-0147')
        ->and($html)->toContain('Correo:</span> cuentas@zafiro-aero.example');
});

test('lo que falte en esos dos bloques sale como un guion, sin reventar', function () {
    // Un borrador recien creado no trae cliente, fechas, origen ni destino, y su aeronave no
    // tiene tipo ni categoria.
    $html = documentoDe(prefacturaBorrador(), esCotizacion: true);

    foreach (['Aeronave', 'Llegada', 'Salida', 'Origen', 'Destino', 'Nombre', 'Teléfono', 'Correo'] as $etiqueta) {
        expect($html)->toContain($etiqueta.':</span> —</td>');
    }
});

test('la aeronave tolera que falte el tipo o la categoria', function (bool $conTipo, bool $conCategoria, string $esperado) {
    $p = prefacturaBorrador();

    if ($conTipo) {
        $p->aeronave->update(['aeronave_id' => TipoAeronave::create(['nombre' => 'Cessna Citation'])->id]);
    }

    if ($conCategoria) {
        FactAeronave::where('aeronave_id', $p->aeronave_id)
            ->update(['categoria_aeronave_id' => categoriaDeAeronave('Jet Ligero')->id]);
    }

    expect(documentoDe($p, esCotizacion: true))->toContain('Aeronave:</span> '.$esperado.'</td>');
})->with([
    'los dos' => [true, true, 'Cessna Citation (Jet Ligero)'],
    'solo el tipo' => [true, false, 'Cessna Citation'],
    'solo la categoria' => [false, true, '— (Jet Ligero)'],
    'ninguno' => [false, false, '—'],
]);
