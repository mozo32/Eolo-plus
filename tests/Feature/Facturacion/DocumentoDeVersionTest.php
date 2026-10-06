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

/**
 * El HTML de `pdf.prefactura` para la prefactura viva y para su instantanea hidratada.
 *
 * La instantanea pasa por JSON, como lo hara al guardarse: lo que se reimprime es lo que se
 * leyo de ahi. Devuelve [viva, hidratada, documento].
 *
 * @return array{0: string, 1: string, 2: array}
 */
function papelVivoEHidratado(FactPrefactura $cerrada): array
{
    $servicio = app(DocumentoDePrefactura::class);
    $documento = $servicio->instantanea($cerrada);

    $comoSeImprime = fn (FactPrefactura $p, array $cifras, string $elaboradoPor): string => view('pdf.prefactura', [
        'prefactura' => $p,
        'esCotizacion' => false,
        'elaboradoPor' => $elaboradoPor,
    ] + $cifras)->render();

    $viva = $comoSeImprime($cerrada, $servicio->cifrasDeCerrada($cerrada), $servicio->elaboradoPorDe($cerrada));

    $guardado = json_decode(json_encode($documento), true);
    $hidratada = $comoSeImprime($servicio->hidratar($guardado), [
        'subtotal' => $guardado['subtotal'], 'iva' => $guardado['iva'],
        'ivaEtiqueta' => $guardado['ivaEtiqueta'], 'total' => $guardado['total'],
        'cambio' => $guardado['cambio'], 'filas' => $guardado['filas'],
    ], $guardado['elaboradoPor']);

    return [$viva, $hidratada, $documento];
}

test('la instantanea hidratada imprime exactamente el mismo papel que la prefactura viva', function () {
    $cerrada = prefacturaCerradaParaDocumento();

    [$viva, $hidratada, $documento] = papelVivoEHidratado($cerrada);

    // El tipo y la categoria salen de dos modelos distintos: si se confundieran, el papel
    // saldria con la categoria de otra matricula.
    expect($documento['aeronave']['tipo'])->toBe('Learjet 45')
        ->and($documento['aeronave']['categoria'])->toBe('Mediana');

    expect($hidratada)->toBe($viva);
});

test('la instantanea firma con el nombre de quien cerro, no con un valor por omision', function () {
    $cerrada = prefacturaCerradaParaDocumento();

    // Anclado a la base y no al propio documento: comparar `elaboradoPor` contra si mismo
    // dejaria pasar una firma fija o la de otro usuario.
    $quienCerro = App\Models\User::findOrFail($cerrada->cerrada_por);
    $documento = app(DocumentoDePrefactura::class)->instantanea($cerrada);

    expect($documento['elaboradoPor'])->toBe($quienCerro->name)
        ->and($documento['elaboradoPor'])->not->toBe('Sin registrar')
        ->and($documento['elaboradoPor'])->not->toBe(App\Models\User::findOrFail($cerrada->user_id)->name);

    [, $hidratada] = papelVivoEHidratado($cerrada);

    expect($hidratada)->toContain('Elaborado por: '.e($quienCerro->name));
});

test('sin cerrada_por la firma es Sin registrar, en el documento y en la instantanea', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $cerrada->update(['cerrada_por' => null]);
    $cerrada->load('cerradaPor');

    expect(app(DocumentoDePrefactura::class)->instantanea($cerrada)['elaboradoPor'])->toBe('Sin registrar');
});

test('una cerrada con cambio imprime la linea CAMBIO, y la version guardada tambien', function () {
    // Efectivo por ENCIMA del total: 200.00 sobre 116.00, y todo el sobrepago es efectivo.
    $cerrada = prefacturaCerradaParaDocumento('200.00');

    [$viva, $hidratada, $documento] = papelVivoEHidratado($cerrada);

    expect(bccomp($documento['cambio'], '0', 2))->toBe(1)
        ->and($documento['cambio'])->toBe('84.00')
        ->and($viva)->toContain('CAMBIO')
        ->and($hidratada)->toContain('CAMBIO')
        ->and($hidratada)->toBe($viva);
});

test('una cerrada que paga exacto no imprime la linea CAMBIO', function () {
    $cerrada = prefacturaCerradaParaDocumento();

    [$viva, $hidratada, $documento] = papelVivoEHidratado($cerrada);

    expect($documento['cambio'])->toBe('0.00')
        ->and($viva)->not->toContain('CAMBIO')
        ->and($hidratada)->not->toContain('CAMBIO');
});
