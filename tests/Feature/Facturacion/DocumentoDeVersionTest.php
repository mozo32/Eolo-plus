<?php

use App\Models\FactPrefactura;
use App\Services\DocumentoDePrefactura;

test('la instantanea trae todo lo que la plantilla lee de la prefactura', function () {
    $cerrada = prefacturaCerradaParaDocumento();

    $documento = app(DocumentoDePrefactura::class)->instantanea($cerrada);

    // Las claves son el contrato: si la plantilla empieza a leer algo que no esta aqui,
    // las versiones viejas se imprimirian incompletas.
    expect(array_keys($documento))->toEqualCanonicalizing([
        'folio', 'cerrada_at', 'llegada_at', 'salida_at', 'origen', 'destino',
        'nota_externa', 'cliente', 'aeronave', 'pagos',
        'subtotal', 'iva', 'ivaEtiqueta', 'total', 'cambio', 'filas', 'elaboradoPor',
    ]);

    expect($documento['folio'])->toBe($cerrada->folio)
        ->and($documento['subtotal'])->toBe((string) $cerrada->subtotal_sellado)
        ->and($documento['cliente']['nombre'])->toBe($cerrada->cliente->nombre)
        ->and($documento['aeronave']['matricula'])->toBe($cerrada->aeronave->matricula)
        ->and($documento['filas'])->toHaveCount(1);
});

test('hidratar devuelve un modelo que NO se guarda y que la plantilla puede leer', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $servicio = app(DocumentoDePrefactura::class);

    $documento = $servicio->instantanea($cerrada);
    $hidratada = $servicio->hidratar($documento);

    expect($hidratada->exists)->toBeFalse()
        ->and($hidratada->folio)->toBe($cerrada->folio)
        ->and($hidratada->cerrada_at->format('Y-m-d H:i'))->toBe($cerrada->cerrada_at->format('Y-m-d H:i'))
        ->and($hidratada->cliente?->nombre)->toBe($cerrada->cliente->nombre)
        ->and($hidratada->aeronave?->matricula)->toBe($cerrada->aeronave->matricula)
        ->and($hidratada->aeronave?->tipoAeronave?->nombre)->toBe($cerrada->aeronave->tipoAeronave->nombre)
        ->and($hidratada->pagos)->toHaveCount($cerrada->pagos->count());

    // Y de verdad no se guardo nada.
    expect(FactPrefactura::count())->toBe(1);
});

test('imprimir una cerrada sigue dando las mismas cifras que antes del refactor', function () {
    $cerrada = prefacturaCerradaParaDocumento();

    $cifras = app(DocumentoDePrefactura::class)->cifrasDeCerrada($cerrada);

    expect($cifras['subtotal'])->toBe((string) $cerrada->subtotal_sellado)
        ->and($cifras['iva'])->toBe((string) $cerrada->iva_sellado)
        ->and($cifras['total'])->toBe((string) $cerrada->total_sellado)
        ->and($cifras['ivaEtiqueta'])->toBe($cerrada->ivaTasaEtiqueta())
        ->and($cifras['filas'])->toBeArray();
});

test('la instantanea hidratada imprime exactamente el mismo papel que la prefactura viva', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $servicio = app(DocumentoDePrefactura::class);

    $documento = $servicio->instantanea($cerrada);

    // El tipo y la categoria salen de dos modelos distintos: si se confundieran, el papel
    // saldria con la categoria de otra matricula.
    expect($documento['aeronave']['tipo'])->toBe('Learjet 45')
        ->and($documento['aeronave']['categoria'])->toBe('Mediana');

    $comoSeImprime = fn (FactPrefactura $p, array $cifras): string => view('pdf.prefactura', [
        'prefactura' => $p,
        'esCotizacion' => false,
        'elaboradoPor' => $documento['elaboradoPor'],
    ] + $cifras)->render();

    $viva = $comoSeImprime($cerrada, $servicio->cifrasDeCerrada($cerrada));

    // Pasa por JSON, como lo hara al guardarse: lo que se reimprime es lo que se leyo de ahi.
    $guardado = json_decode(json_encode($documento), true);
    $hidratada = $comoSeImprime($servicio->hidratar($guardado), [
        'subtotal' => $guardado['subtotal'], 'iva' => $guardado['iva'],
        'ivaEtiqueta' => $guardado['ivaEtiqueta'], 'total' => $guardado['total'],
        'cambio' => $guardado['cambio'], 'filas' => $guardado['filas'],
    ]);

    expect($hidratada)->toBe($viva);
});
