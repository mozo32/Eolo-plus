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
        'sustituye' => null,
        'versionSustituida' => null,
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

/**
 * Lo que la vista recibe, TODO: sus once claves mas las seis cifras. No se reutiliza
 * `capturarLoQueRecibeLaVista()` de `ImpresionPrefacturaTest`: `php artisan test <un archivo>`
 * no carga los demas, y ademas ese ayudante recorta lo que ve.
 *
 * `$recibido` queda con el ULTIMO render; el cierre devuelto lo vuelve a pintar a HTML.
 */
function vistaDelPapel(?array &$recibido): Closure
{
    $claves = ['prefactura', 'esCotizacion', 'sustituye', 'versionSustituida', 'subtotal', 'iva', 'ivaEtiqueta', 'total', 'cambio', 'filas', 'elaboradoPor'];

    View::composer('pdf.prefactura', function ($vista) use (&$recibido, $claves) {
        $recibido = Illuminate\Support\Arr::only($vista->getData(), $claves);
    });

    // Solo el texto, en una linea: la plantilla parte los avisos en varias y pone cada dato dentro de su span.
    return function () use (&$recibido): string {
        return preg_replace('/\s+/', ' ', strip_tags(view('pdf.prefactura', $recibido)->render()));
    };
}

test('el documento corregido dice a que version sustituye, y el original no dice nada', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $this->actingAs($usuario);

    $recibido = [];
    $papel = vistaDelPapel($recibido);

    // Antes de corregir: sin marca.
    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertSuccessful();
    expect($recibido['sustituye'])->toBeNull()
        ->and($recibido['versionSustituida'])->toBeNull()
        ->and($papel())->not->toContain('Corregida')->not->toContain('NO VIGENTE');

    $fechaOriginal = $cerrada->cerrada_at;
    app(App\Services\ReaperturaPrefactura::class)->reabrir($cerrada, $usuario->id, 'Faltaba un servicio.');
    renglonDe($cerrada->fresh(), 250.0, 1);
    app(App\Services\CierrePrefactura::class)->cerrar($cerrada->fresh(), $usuario->id, confirmarSinCobro: true);

    // Despues: la marca con la fecha de la version anterior.
    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertSuccessful();
    expect($recibido['sustituye'])->toBe(['fecha' => $fechaOriginal->format('d/m/Y')])
        ->and($recibido['versionSustituida'])->toBeNull()
        ->and($papel())->toContain('Corregida — sustituye a la versión del '.$fechaOriginal->format('d/m/Y'))
        ->and($papel())->not->toContain('NO VIGENTE');
});

test('una version sustituida se reimprime marcada como NO vigente, y nunca como corregida', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $this->actingAs($usuario);

    app(App\Services\ReaperturaPrefactura::class)->reabrir($cerrada, $usuario->id, 'Faltaba un servicio.');

    $recibido = [];
    $papel = vistaDelPapel($recibido);

    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/versiones/1/pdf")->assertSuccessful();

    expect($recibido['versionSustituida']['version'])->toBe(1)
        ->and($recibido['sustituye'])->toBeNull()
        ->and($recibido['esCotizacion'])->toBeFalse()
        ->and($papel())->toContain('VERSIÓN 1 — REEMPLAZADA EL '.now()->format('d/m/Y').'. NO VIGENTE.')
        ->and($papel())->not->toContain('Corregida');
});

test('una version que no existe da 404', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/versiones/7/pdf")->assertNotFound();
});

test('la version de OTRA prefactura no se reimprime desde esta', function () {
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $this->actingAs($usuario);

    $conVersion = prefacturaCerradaParaDocumento();
    app(App\Services\ReaperturaPrefactura::class)->reabrir($conVersion, $usuario->id, 'Faltaba un servicio.');
    $sinVersion = app(App\Services\CierrePrefactura::class)->cerrar(completarParaCerrar(prefacturaBorrador()), $usuario->id, confirmarSinCobro: true);

    $this->get("/api/facturacion/prefacturas/{$sinVersion->id}/versiones/1/pdf")->assertNotFound();
    $this->get("/api/facturacion/prefacturas/{$conVersion->id}/versiones/1/pdf")->assertSuccessful();
});

test('reimprimir una version exige el subdepartamento, como imprimir el documento', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    app(App\Services\ReaperturaPrefactura::class)->reabrir($cerrada, $usuario->id, 'Faltaba un servicio.');

    $this->actingAs(usuarioSinAcceso());

    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/versiones/1/pdf")->assertForbidden();
});

test('una version reimpresa muestra las cifras que se sembraron y NO las de la prefactura ya corregida', function () {
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $this->actingAs($usuario);

    // Efectivo por encima del total: 200.00 sobre 116.00 deja CAMBIO de 84.00. Las cifras se
    // anclan aqui, a literales, y NO a lo que diga la instantanea: comparar la version contra
    // su propio documento pasaria aunque `cifrasDeCerrada()` diera cualquier cosa.
    $cerrada = prefacturaCerradaParaDocumento('200.00');

    expect((string) $cerrada->subtotal_sellado)->toBe('100.00')
        ->and((string) $cerrada->iva_sellado)->toBe('16.00')
        ->and((string) $cerrada->total_sellado)->toBe('116.00')
        ->and($cerrada->cambio())->toBe('84.00');

    app(App\Services\ReaperturaPrefactura::class)->reabrir($cerrada, $usuario->id, 'Faltaba un servicio.');

    // Se corrige TODO lo que el papel imprime: renglones (subtotal, iva, total, filas), pagos
    // (cambio), cliente y destino.
    $reabierta = $cerrada->fresh();
    renglonDe($reabierta, 250.0, 1);
    pagoDe($reabierta, formasDePago()[App\Models\FactFormaPago::CONCEPTO_EFECTIVO], '300.00');
    $reabierta->cliente->update(['nombre' => 'Cliente corregido']);
    $reabierta->update(['destino' => 'MMUN']);

    app(App\Services\CierrePrefactura::class)->cerrar($reabierta->fresh(), $usuario->id);

    $vigente = $cerrada->fresh();
    expect((string) $vigente->subtotal_sellado)->toBe('350.00')
        ->and((string) $vigente->iva_sellado)->toBe('56.00')
        ->and((string) $vigente->total_sellado)->toBe('406.00')
        ->and($vigente->cambio())->toBe('94.00');

    $recibido = [];
    $papel = vistaDelPapel($recibido);

    // La version 1: los literales viejos, en lo que recibe la vista y en lo que imprime.
    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/versiones/1/pdf")->assertSuccessful();
    $viejo = $recibido;
    $htmlViejo = $papel();

    expect($viejo['subtotal'])->toBe('100.00')
        ->and($viejo['iva'])->toBe('16.00')
        ->and($viejo['total'])->toBe('116.00')
        ->and($viejo['cambio'])->toBe('84.00')
        ->and($viejo['filas'])->toHaveCount(1)
        ->and($viejo['filas'][0]['importe'])->toBe('100.00')
        ->and($viejo['prefactura']->pagos)->toHaveCount(1)
        ->and($htmlViejo)->toContain('CAMBIO')
        ->and($htmlViejo)->toContain('84.00')
        ->and($htmlViejo)->toContain('116.00')
        ->and($htmlViejo)->toContain('Cliente del documento')
        ->and($htmlViejo)->toContain('Destino: MMTO')
        ->and($htmlViejo)->not->toContain('406.00')
        ->and($htmlViejo)->not->toContain('350.00')
        ->and($htmlViejo)->not->toContain('94.00')
        ->and($htmlViejo)->not->toContain('300.00')
        ->and($htmlViejo)->not->toContain('Cliente corregido')
        ->and($htmlViejo)->not->toContain('MMUN');

    // La vigente, en la misma prueba: otros literales. Si las dos mostraran lo mismo, la
    // comparacion de arriba no distinguiria nada.
    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertSuccessful();
    $nuevo = $recibido;
    $htmlNuevo = $papel();

    expect($nuevo['subtotal'])->toBe('350.00')
        ->and($nuevo['iva'])->toBe('56.00')
        ->and($nuevo['total'])->toBe('406.00')
        ->and($nuevo['cambio'])->toBe('94.00')
        ->and($nuevo['filas'])->toHaveCount(2)
        ->and($htmlNuevo)->toContain('406.00')
        ->and($htmlNuevo)->toContain('94.00')
        ->and($htmlNuevo)->toContain('Cliente corregido')
        ->and($htmlNuevo)->toContain('Destino: MMUN')
        ->and($htmlNuevo)->not->toContain('Cliente del documento');
});

test('la marca de sustituye es la fecha de CIERRE de la ultima version, no la de reapertura ni la de hoy', function () {
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $this->actingAs($usuario);
    $reabrir = fn (App\Models\FactPrefactura $p) => app(App\Services\ReaperturaPrefactura::class)->reabrir($p, $usuario->id, 'Correccion.');
    $cerrar = fn (App\Models\FactPrefactura $p) => app(App\Services\CierrePrefactura::class)->cerrar($p, $usuario->id, confirmarSinCobro: true);

    // Fechas distintas en cada paso: ninguna se confunde con otra.
    $this->travelTo(Illuminate\Support\Carbon::parse('2026-03-14 10:00:00'));
    $cerrada = prefacturaCerradaParaDocumento();

    $this->travelTo(Illuminate\Support\Carbon::parse('2026-03-20 10:00:00'));
    $reabrir($cerrada);
    $this->travelTo(Illuminate\Support\Carbon::parse('2026-04-02 10:00:00'));
    $cerrar($cerrada->fresh());

    $this->travelTo(Illuminate\Support\Carbon::parse('2026-05-01 10:00:00'));
    $reabrir($cerrada->fresh());
    $this->travelTo(Illuminate\Support\Carbon::parse('2026-05-10 10:00:00'));
    $cerrar($cerrada->fresh());

    $this->travelTo(Illuminate\Support\Carbon::parse('2026-06-30 10:00:00'));

    $recibido = [];
    $papel = vistaDelPapel($recibido);

    // La vigente sustituye a la version 2, cerrada el 02/04: no a la 1 (14/03), ni a la fecha en
    // que se reabrio (01/05), ni a la de hoy.
    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertSuccessful();
    expect($recibido['sustituye'])->toBe(['fecha' => '02/04/2026'])
        ->and($papel())->toContain('sustituye a la versión del 02/04/2026');

    // La version 1 se reemplazo el 20/03 y la 2 el 01/05.
    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/versiones/1/pdf")->assertSuccessful();
    expect($recibido['versionSustituida'])->toBe(['version' => 1, 'reemplazada' => '20/03/2026'])
        ->and($papel())->toContain('VERSIÓN 1 — REEMPLAZADA EL 20/03/2026. NO VIGENTE.')
        ->and($papel())->toContain('Fecha: 14/03/2026');

    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/versiones/2/pdf")->assertSuccessful();
    expect($recibido['versionSustituida'])->toBe(['version' => 2, 'reemplazada' => '01/05/2026'])
        ->and($papel())->toContain('Fecha: 02/04/2026');
});

test('el fichero de una version no se llama como el del documento vigente', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $this->actingAs($usuario);

    app(App\Services\ReaperturaPrefactura::class)->reabrir($cerrada, $usuario->id, 'Faltaba un servicio.');
    app(App\Services\CierrePrefactura::class)->cerrar($cerrada->fresh(), $usuario->id, confirmarSinCobro: true);

    $folio = $cerrada->folio;

    $vigente = $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertSuccessful();
    $version = $this->get("/api/facturacion/prefacturas/{$cerrada->id}/versiones/1/pdf")->assertSuccessful();

    expect($vigente->headers->get('content-disposition'))->toContain("filename=prefactura-{$folio}.pdf")
        ->and($version->headers->get('content-disposition'))->toContain("filename=prefactura-{$folio}-version-1.pdf")
        ->and($version->headers->get('content-disposition'))->not->toBe($vigente->headers->get('content-disposition'));
});

test('reimprimir una version queda en la bitacora como NO vigente, y no escribe en la prefactura', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $this->actingAs($usuario);

    app(App\Services\ReaperturaPrefactura::class)->reabrir($cerrada, $usuario->id, 'Faltaba un servicio.');
    $antes = $cerrada->fresh()->only(['estado', 'folio', 'total_sellado']);

    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/versiones/1/pdf")->assertSuccessful();

    $registro = App\Models\Bitacora::where('modulo', App\Models\Bitacora::MODULO_FACTURACION_PREFACTURAS)
        ->where('accion', App\Models\Bitacora::ACCION_EXPORTAR)->where('registro_id', $cerrada->id)->get();

    expect($registro)->toHaveCount(1)
        ->and($registro[0]->descripcion)->toContain('versión 1')
        ->and($registro[0]->datos_nuevos)->toMatchArray(['folio' => $cerrada->folio, 'version' => 1, 'vigente' => false])
        ->and($cerrada->fresh()->only(['estado', 'folio', 'total_sellado']))->toBe($antes)
        ->and(App\Models\FactPrefacturaVersion::count())->toBe(1);
});

test('la plantilla nunca pone Corregida a una version no vigente, ni con las dos marcas a la vez', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $servicio = app(DocumentoDePrefactura::class);

    $pintar = fn (?array $sustituye, ?array $versionSustituida): string => preg_replace('/\s+/', ' ', strip_tags(view('pdf.prefactura', [
        'prefactura' => $cerrada,
        'esCotizacion' => false,
        'elaboradoPor' => 'Ana',
        'sustituye' => $sustituye,
        'versionSustituida' => $versionSustituida,
    ] + $servicio->cifrasDeCerrada($cerrada))->render()));

    $ambas = $pintar(['fecha' => '14/03/2026'], ['version' => 3, 'reemplazada' => '20/03/2026']);

    expect($ambas)->toContain('VERSIÓN 3 — REEMPLAZADA EL 20/03/2026. NO VIGENTE.')
        ->and($ambas)->not->toContain('Corregida')
        ->and($pintar(['fecha' => '14/03/2026'], null))->toContain('Corregida — sustituye a la versión del 14/03/2026.')
        ->and($pintar(['fecha' => null], null))->toContain('Corregida — sustituye a la versión anterior.')
        ->and($pintar(null, null))->not->toContain('Corregida')->not->toContain('NO VIGENTE');
});

test('la version reimpresa conserva la TASA con que se emitio, aunque la vigente ya se selle con otra', function () {
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $this->actingAs($usuario);

    // Cerrada al 16 %: IVA de 16.00 sobre 100.00.
    $cerrada = prefacturaCerradaParaDocumento();
    expect((string) $cerrada->iva_sellado)->toBe('16.00')
        ->and($cerrada->ivaTasaEtiqueta())->toBe('16%');

    app(App\Services\ReaperturaPrefactura::class)->reabrir($cerrada, $usuario->id, 'Cambio de tasa.');

    // Entre reabrir y volver a cerrar alguien cambia la tasa: el cierre re-sella al 8 %.
    App\Models\FactConfiguracion::updateOrCreate(['clave' => 'iva_tasa'], ['valor' => '0.08', 'descripcion' => 'Tasa de IVA']);
    app(App\Services\CierrePrefactura::class)->cerrar($cerrada->fresh(), $usuario->id);

    $vigente = $cerrada->fresh();
    expect((string) $vigente->iva_sellado)->toBe('8.00')
        ->and($vigente->ivaTasaEtiqueta())->toBe('8%');

    $recibido = [];
    $papel = vistaDelPapel($recibido);

    // Una tasa recalculada sobre la viva daria «IVA (8%)» sobre un IVA de 16.00 calculado
    // sobre 100.00: aritmetica imposible en un papel que el cliente tiene y que dice 16 %.
    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/versiones/1/pdf")->assertSuccessful();
    expect($recibido['ivaEtiqueta'])->toBe('16%')
        ->and($recibido['iva'])->toBe('16.00')
        ->and($papel())->toContain('IVA (16%) 16.00')
        ->and($papel())->not->toContain('IVA (8%)');

    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertSuccessful();
    expect($recibido['ivaEtiqueta'])->toBe('8%')
        ->and($papel())->toContain('IVA (8%) 8.00');
});

test('una prefactura dada de baja no reimprime sus versiones, igual que no imprime su documento', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $this->actingAs($usuario);

    app(App\Services\ReaperturaPrefactura::class)->reabrir($cerrada, $usuario->id, 'Faltaba un servicio.');
    app(App\Services\CierrePrefactura::class)->cerrar($cerrada->fresh(), $usuario->id, confirmarSinCobro: true);

    // Hoy ningun camino de la aplicacion pone este estado en una cerrada; si algun dia existe,
    // las dos rutas tienen que coincidir.
    App\Models\FactPrefactura::query()->whereKey($cerrada->id)->update(['status' => App\Models\FactPrefactura::STATUS_INACTIVO]);

    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertStatus(409)->assertJsonPath('codigo', 'ya_descartada');
    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/versiones/1/pdf")->assertStatus(409)->assertJsonPath('codigo', 'ya_descartada');

    expect(App\Models\Bitacora::where('accion', App\Models\Bitacora::ACCION_EXPORTAR)->count())->toBe(0);
});

test('un documento corregido SIEMPRE dice que lo es, tambien si la version anterior no tiene fecha de cierre', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $this->actingAs($usuario);

    app(App\Services\ReaperturaPrefactura::class)->reabrir($cerrada, $usuario->id, 'Faltaba un servicio.');
    app(App\Services\CierrePrefactura::class)->cerrar($cerrada->fresh(), $usuario->id, confirmarSinCobro: true);

    // Una importada del sistema viejo no trae momento de cierre: la version guardada queda sin fecha.
    App\Models\FactPrefacturaVersion::query()->update(['cerrada_at' => null]);

    $recibido = [];
    $papel = vistaDelPapel($recibido);

    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertSuccessful();

    // Sin fecha, pero con la marca: no se inventa una, y tampoco se calla.
    expect($recibido['sustituye'])->toBe(['fecha' => null])
        ->and($recibido['versionSustituida'])->toBeNull()
        ->and($papel())->toContain('Corregida — sustituye a la versión anterior.')
        ->and($papel())->not->toContain('sustituye a la versión del');

    // Y la version sigue reimprimiendose como no vigente.
    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/versiones/1/pdf")->assertSuccessful();
    expect($recibido['sustituye'])->toBeNull()
        ->and($papel())->toContain('NO VIGENTE')->not->toContain('Corregida');
});

test('LA PRUEBA MAESTRA: el ciclo entero por la API, y la version 1 reimpresa es el papel que salio, no el corregido', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $quienCerroElOriginal = App\Models\User::findOrFail($cerrada->cerrada_por);
    $jefe = usuarioConSubdepartamento('factReabrirPrefactura', 'Facturacion');
    $captura = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $efectivo = formasDePago()[App\Models\FactFormaPago::CONCEPTO_EFECTIVO];

    // Las cifras que ESTA prueba sembro: 100.00 + 16.00 = 116.00, pagados exactos. Son el ancla:
    // no salen de `cifrasDeCerrada()` ni de la instantanea, que descienden de la misma funcion.
    expect((string) $cerrada->subtotal_sellado)->toBe('100.00')
        ->and((string) $cerrada->iva_sellado)->toBe('16.00')
        ->and((string) $cerrada->total_sellado)->toBe('116.00')
        ->and($cerrada->cambio())->toBe('0.00');

    // Lo que la plantilla lee de $prefactura: si manana lee un campo mas y el JSON no lo guarda,
    // la comparacion contra el original lo delata.
    $delModelo = fn (FactPrefactura $p) => [
        'folio' => $p->folio,
        'cerrada_at' => $p->cerrada_at?->format('d/m/Y'),
        'llegada_at' => $p->llegada_at?->format('d/m/Y H:i'),
        'salida_at' => $p->salida_at?->format('d/m/Y H:i'),
        'origen' => $p->origen,
        'destino' => $p->destino,
        'nota_externa' => $p->nota_externa,
        'cliente' => [$p->cliente?->nombre, $p->cliente?->telefono, $p->cliente?->correo],
        'matricula' => $p->aeronave?->matricula,
        'tipo' => $p->aeronave?->tipoAeronave?->nombre,
        'categoria' => $p->satelite?->categoria?->nombre,
        'pagos' => $p->pagos->map(fn ($g) => [$g->formaPago?->nombre, (string) $g->monto])->all(),
    ];

    $recibido = [];
    $papel = vistaDelPapel($recibido);

    // 1. Se imprime el documento. Lo que reciba la vista es lo que el cliente se lleva.
    $this->actingAs($captura);
    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertSuccessful();
    $original = $recibido;
    $modeloOriginal = $delModelo($recibido['prefactura']);
    $htmlOriginal = $papel();

    // 2. Se reabre POR LA API, con el permiso propio: quien solo captura no puede.
    $this->patchJson("/api/facturacion/prefacturas/{$cerrada->id}/reabrir", ['motivo' => 'Correccion completa de prueba.'])->assertForbidden();
    $this->actingAs($jefe);
    $this->patchJson("/api/facturacion/prefacturas/{$cerrada->id}/reabrir", ['motivo' => 'Correccion completa de prueba.'])->assertSuccessful();

    // 3. Se corrige algo de CADA clase que el departamento nombro, con los permisos normales.
    $this->actingAs($captura);
    $viva = $cerrada->fresh();

    // (a) el importe de un renglon: el original, de 100.00, pasa a cortesia y deja de cobrarse.
    $this->patchJson("/api/facturacion/prefacturas/{$viva->id}/renglones/{$viva->renglones()->first()->id}/cortesia", ['es_cortesia' => true])->assertSuccessful();
    // (b) falta un servicio: 2 x 250.00.
    $servicioNuevo = App\Models\FactServicio::create(['nombre' => 'Servicio que faltaba', 'precio_unitario' => 250]);
    $this->postJson("/api/facturacion/prefacturas/{$viva->id}/renglones", ['servicio_id' => $servicioNuevo->id, 'cantidad' => 2])->assertSuccessful();
    // (c) el cobro: se quita el pago exacto y se registra uno mayor, con cambio.
    $this->deleteJson("/api/facturacion/prefacturas/{$viva->id}/pagos/{$viva->pagos()->first()->id}")->assertSuccessful();
    $this->postJson("/api/facturacion/prefacturas/{$viva->id}/pagos", ['forma_pago_id' => $efectivo->id, 'monto' => '600.00'])->assertSuccessful();
    // (d) la cabecera: destino, nota externa y cliente.
    $this->putJson("/api/facturacion/prefacturas/{$viva->id}", [
        'aeronave_id' => $viva->aeronave_id,
        'tipo_destino' => $viva->tipo_destino,
        'destino' => 'MMUN',
    ])->assertSuccessful();
    $this->patchJson("/api/facturacion/prefacturas/{$viva->id}/notas", ['nota_externa' => 'Nota corregida.'])->assertSuccessful();
    $clienteNuevo = completarParaCerrar($viva->fresh())->cliente;

    // 4. Se vuelve a cerrar. Paga 600.00 sobre 580.00: sin confirmaciones.
    $this->patchJson("/api/facturacion/prefacturas/{$viva->id}/cerrar")->assertSuccessful();

    $vigente = $cerrada->fresh();
    expect($vigente->folio)->toBe($cerrada->folio)
        ->and((string) $vigente->subtotal_sellado)->toBe('500.00')
        ->and((string) $vigente->iva_sellado)->toBe('80.00')
        ->and((string) $vigente->total_sellado)->toBe('580.00')
        ->and($vigente->cambio())->toBe('20.00')
        ->and(App\Models\FactPrefacturaVersion::count())->toBe(1);

    // 5. Se reimprime la version 1 POR SU ENDPOINT.
    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/versiones/1/pdf")->assertSuccessful();
    $reimpresa = $recibido;
    $htmlReimpreso = $papel();

    // Ancla: la version 1 trae los literales SEMBRADOS. Un `total` falso en `cifrasDeCerrada()`
    // movia a la vez la impresion original y la reimpresion; contra un literal ya no pasa.
    expect($reimpresa['subtotal'])->toBe('100.00')
        ->and($reimpresa['iva'])->toBe('16.00')
        ->and($reimpresa['ivaEtiqueta'])->toBe('16%')
        ->and($reimpresa['total'])->toBe('116.00')
        ->and($reimpresa['cambio'])->toBe('0.00')
        ->and($reimpresa['filas'])->toHaveCount(1)
        ->and($reimpresa['filas'][0]['importe'])->toBe('100.00')
        ->and($reimpresa['elaboradoPor'])->toBe($quienCerroElOriginal->name)
        ->and($reimpresa['prefactura']->folio)->toBe($cerrada->folio)
        ->and($reimpresa['prefactura']->destino)->toBe('MMTO')
        ->and($reimpresa['prefactura']->nota_externa)->toBe('Gracias por su visita.')
        ->and($reimpresa['prefactura']->cliente->nombre)->toBe('Cliente del documento')
        ->and($reimpresa['prefactura']->pagos)->toHaveCount(1)
        ->and((string) $reimpresa['prefactura']->pagos[0]->monto)->toBe('116.00')
        ->and($htmlReimpreso)->toContain('116.00')->toContain('Destino: MMTO')->toContain('Cliente del documento')->toContain('Gracias por su visita.')
        ->and($htmlReimpreso)->not->toContain('CAMBIO')
        ->and($htmlReimpreso)->not->toContain('580.00')->not->toContain('500.00')->not->toContain('600.00')
        ->and($htmlReimpreso)->not->toContain('MMUN')->not->toContain('Nota corregida.')->not->toContain($clienteNuevo->nombre);

    // Y reimprimir es el papel que salio: cifras, filas, firma y todo lo que la plantilla lee del modelo.
    foreach (['subtotal', 'iva', 'ivaEtiqueta', 'total', 'cambio', 'filas', 'elaboradoPor', 'esCotizacion'] as $clave) {
        expect($reimpresa[$clave])->toEqual($original[$clave], "cambio la clave {$clave}");
    }
    expect($delModelo($reimpresa['prefactura']))->toEqual($modeloOriginal);

    // La unica diferencia con lo que salio: la marca.
    $marca = 'VERSIÓN 1 — REEMPLAZADA EL '.now()->format('d/m/Y').'. NO VIGENTE.';
    expect($original['versionSustituida'])->toBeNull()
        ->and($original['sustituye'])->toBeNull()
        ->and($reimpresa['sustituye'])->toBeNull()
        ->and($reimpresa['versionSustituida']['version'])->toBe(1)
        ->and($htmlOriginal)->not->toContain('NO VIGENTE')
        ->and($htmlReimpreso)->toContain($marca)
        ->and(trim(preg_replace('/\s+/', ' ', str_replace($marca, '', $htmlReimpreso))))->toBe(trim($htmlOriginal));

    // 6. La vigente, en la misma prueba: otros literales en las cuatro clases. Si la vigente y la
    // version mostraran lo mismo, nada de lo de arriba distinguiria el antes del despues.
    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertSuccessful();
    $nueva = $recibido;
    $htmlNuevo = $papel();

    expect($nueva['subtotal'])->toBe('500.00')
        ->and($nueva['iva'])->toBe('80.00')
        ->and($nueva['total'])->toBe('580.00')
        ->and($nueva['total'])->not->toBe($reimpresa['total'])
        ->and($nueva['cambio'])->toBe('20.00')
        ->and($nueva['filas'])->toHaveCount(2)
        ->and($nueva['prefactura']->folio)->toBe($reimpresa['prefactura']->folio)
        ->and($nueva['prefactura']->destino)->toBe('MMUN')
        ->and($nueva['prefactura']->nota_externa)->toBe('Nota corregida.')
        ->and($nueva['prefactura']->cliente->nombre)->toBe($clienteNuevo->nombre)
        ->and((string) $nueva['prefactura']->pagos[0]->monto)->toBe('600.00')
        ->and($nueva['elaboradoPor'])->toBe($captura->name)
        ->and($nueva['elaboradoPor'])->not->toBe($reimpresa['elaboradoPor'])
        ->and($nueva['versionSustituida'])->toBeNull()
        ->and($nueva['sustituye'])->toBe(['fecha' => $cerrada->cerrada_at->format('d/m/Y')])
        ->and($htmlNuevo)->toContain('580.00')->toContain('CAMBIO')->toContain('Destino: MMUN')->toContain('Nota corregida.')->toContain($clienteNuevo->nombre)
        ->and($htmlNuevo)->not->toContain('116.00')->not->toContain('Cliente del documento')->not->toContain('MMTO')->not->toContain('NO VIGENTE');
});
