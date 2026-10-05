<?php

use App\Models\Bitacora;
use App\Models\FactConfiguracion;
use App\Models\FactPrefactura;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\View;

test('el documento de una cerrada se descarga como PDF', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    $respuesta = $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf");

    $respuesta->assertOk()->assertHeader('content-type', 'application/pdf');
    // DomPDF devuelve una respuesta normal, no en flujo: se lee con getContent().
    // Un PDF de verdad empieza por %PDF-. No comparamos bytes: cambian con la version
    // de la libreria y con la fecha.
    expect(substr($respuesta->getContent(), 0, 5))->toBe('%PDF-');
});

test('un borrador NO tiene documento: se cotiza', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/pdf")
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'sin_folio');
});

test('una cerrada con el sello roto NO se imprime, y el mensaje da las dos cifras', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    // El sello dice 999.00 y los renglones derivan 100.00: discrepa.
    $cerrada = cerrarConSello($p, '999.00', '159.84', '1158.84');

    $respuesta = $this->getJson("/api/facturacion/prefacturas/{$cerrada->id}/pdf")
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'sello_inconsistente');

    expect($respuesta->json('message'))->toContain('1158.84')
        ->and($respuesta->json('message'))->toContain('116.00');
});

test('una cerrada dada de baja (status inactivo) no se imprime', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');
    $cerrada->update(['status' => FactPrefactura::STATUS_INACTIVO]);

    $this->getJson("/api/facturacion/prefacturas/{$cerrada->id}/pdf")
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_descartada');
});

test('con un renglon ilegible responde 422 y no un 500', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');
    // Verificar el sello SI deriva de los renglones, y un ajuste que no se reconoce no se
    // interpreta: lanza. La tasa no sirve para provocarlo en una cerrada, porque `ivaTasa()`
    // devuelve la SELLADA y no lee la configuracion.
    // Va por el constructor de consultas, no por el modelo: el renglon de una cerrada esta
    // guardado contra escritura y `->update()` lanzaria en la preparacion de la prueba.
    DB::table('fact_prefactura_renglones')->where('prefactura_id', $cerrada->id)->update(['ajuste_precio' => 'raro']);

    $this->getJson("/api/facturacion/prefacturas/{$cerrada->id}/pdf")
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'totales_no_calculables');
});

test('un renglon que se corrige entre la carga y la verificacion sigue siendo un 422, no un 500', function () {
    // La carrera que obliga a calcular los importes DENTRO del try y sobre los renglones ya
    // cargados: `discrepanciasDelSello()` relee de la base, asi que si el ajuste ilegible se
    // corrige despues de la carga, la verificacion pasa y solo los objetos viejos lanzan.
    // Si los importes se calcularan fuera del try, esto seria un 500.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');
    DB::table('fact_prefactura_renglones')->where('prefactura_id', $cerrada->id)->update(['ajuste_precio' => 'raro']);

    $corregido = false;
    DB::listen(function ($consulta) use (&$corregido, $cerrada) {
        if ($corregido || ! str_starts_with(strtolower($consulta->sql), 'select')
            || ! str_contains($consulta->sql, 'fact_prefactura_renglones')) {
            return;
        }

        // La primera lectura de renglones es la carga del controlador: ya trajo 'raro'.
        $corregido = true;
        DB::table('fact_prefactura_renglones')->where('prefactura_id', $cerrada->id)->update(['ajuste_precio' => 'ninguno']);
    });

    $this->getJson("/api/facturacion/prefacturas/{$cerrada->id}/pdf")
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'totales_no_calculables');

    expect($corregido)->toBeTrue();
});

/**
 * Una tasa de IVA valida en la configuracion que se vuelve ilegible justo despues de la
 * lectura numero `$lecturas`. `FactConfiguracion::valor()` no cachea, y una cerrada SIN tasa
 * sellada (un legado) la lee cada vez que la necesita: asi la verificacion del sello pasa
 * con la primera lectura y es una lectura posterior, la de las cifras, la que lanza.
 *
 * @return object{lecturas: int}
 */
function corromperTasaTrasLecturas(int $lecturas): object
{
    FactConfiguracion::updateOrCreate(['clave' => 'iva_tasa'], ['valor' => '0.16', 'descripcion' => 'Tasa de IVA']);

    $estado = (object) ['lecturas' => 0];

    DB::listen(function ($consulta) use ($estado, $lecturas) {
        if (! str_starts_with(strtolower($consulta->sql), 'select') || ! str_contains($consulta->sql, 'fact_configuracion')) {
            return;
        }

        if (++$estado->lecturas === $lecturas) {
            DB::table('fact_configuracion')->where('clave', 'iva_tasa')->update(['valor' => 'raro']);
        }
    });

    return $estado;
}

test('una tasa que se vuelve ilegible al armar la etiqueta es 422, no un 500', function () {
    // Cubre que `ivaTasaEtiqueta()` esta dentro del try. Un legado (sin tasa sellada) lee la
    // tasa de la configuracion: la 1a lectura es la de `discrepanciasDelSello()` y es valida,
    // la 2a es la de la etiqueta y lanza.
    // Si alguien sacara las cifras del try, esta prueba fallaria por dos caminos segun donde
    // las pusiera: antes de la comprobacion de discrepancias seria un 500; DESPUES (en el
    // return) seria un 409 y no un 500, porque sin tasa sellada `discrepanciasDelSello()`
    // anade la discrepancia `iva_tasa`, el try termina sin lanzar y esa comprobacion responde
    // 409 antes de que nadie lea la tasa. Un lector esperaria el 500; el 409 tambien la mata.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');
    DB::table('fact_prefacturas')->where('id', $cerrada->id)->update(['iva_tasa_sellada' => null]);
    $lectura = corromperTasaTrasLecturas(1);

    $this->getJson("/api/facturacion/prefacturas/{$cerrada->id}/pdf")
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'totales_no_calculables');

    // La tasa se leyo al menos dos veces: la valida y la que lanza.
    expect($lectura->lecturas)->toBeGreaterThanOrEqual(2);
});

test('una tasa que se vuelve ilegible al calcular el cambio es 422, no un 500', function () {
    // Cubre que `cambio()` esta dentro del try. Sin total ni IVA sellados, `total()` deriva
    // y vuelve a leer la tasa: la 1a lectura es la de la verificacion, la 2a la de la
    // etiqueta, y la 3a —la de `cambio()`— lanza. Fuera del try mueren igual que arriba:
    // 500 si estan antes de la comprobacion de discrepancias, 409 si estan despues.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');
    DB::table('fact_prefacturas')->where('id', $cerrada->id)->update([
        'iva_tasa_sellada' => null, 'iva_sellado' => null, 'total_sellado' => null,
    ]);
    $lectura = corromperTasaTrasLecturas(2);

    $this->getJson("/api/facturacion/prefacturas/{$cerrada->id}/pdf")
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'totales_no_calculables');

    expect($lectura->lecturas)->toBeGreaterThanOrEqual(3);
});

test('imprimir queda en la bitacora como EXPORTAR, con la prefactura', function () {
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $this->actingAs($usuario);
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertOk();

    $registro = Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)
        ->where('accion', Bitacora::ACCION_EXPORTAR)->sole();

    expect($registro->registro_id)->toBe($cerrada->id)
        ->and($registro->descripcion)->toContain((string) $cerrada->folio);
});

test('imprimir NO escribe nada mas que la bitacora', function () {
    // Es el invariante central del bloque: en el sistema viejo imprimir escribia, y la
    // reimpresion desde la lista de cerradas duplicaba el encabezado historico.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    // Sin esto `touch()` no escribiria nada: dentro del mismo segundo `updated_at` no
    // cambia y Eloquent se salta el UPDATE, y la prueba no veria una escritura real.
    $this->travel(5)->seconds();

    $sentencias = [];
    DB::listen(function ($consulta) use (&$sentencias) {
        $sentencias[] = ltrim(strtolower($consulta->sql));
    });

    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertOk();

    $escrituras = array_values(array_filter(
        $sentencias,
        fn (string $sql) => ! str_starts_with($sql, 'select') && ! str_contains($sql, 'bitacora'),
    ));

    expect($escrituras)->toBe([]);
});

test('reimprimir dos veces NO duplica nada, da el mismo documento y deja dos entradas', function () {
    // Reimprimir no tiene ruta propia: es volver a pedir la misma. En el viejo hacia falta
    // un archivo aparte precisamente porque imprimir escribia.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    // Lo que el documento MUESTRA, no sus bytes: el PDF cambia con la fecha y con la version
    // de la libreria, y el texto va comprimido y en glifos, asi que no se lee dentro de el.
    // Las cifras que la plantilla recibe son lo estable que se puede comparar.
    $mostrado = [];
    View::composer('pdf.prefactura', function ($vista) use (&$mostrado) {
        $mostrado[] = Arr::only($vista->getData(), ['esCotizacion', 'subtotal', 'iva', 'ivaEtiqueta', 'total', 'cambio', 'importes', 'elaboradoPor'])
            + ['folio' => $vista->getData()['prefactura']->folio];
    });

    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertOk();
    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertOk();

    expect($mostrado)->toHaveCount(2)
        ->and($mostrado[0])->toBe($mostrado[1])
        ->and($mostrado[0]['folio'])->toBe(10000)
        ->and($mostrado[0]['total'])->toBe('116.00')
        ->and(FactPrefactura::count())->toBe(1)
        ->and($cerrada->fresh()->folio)->toBe(10000)
        ->and($cerrada->fresh()->renglones()->count())->toBe(1);

    // Cada impresion deja su rastro: reimprimir no escribe en la prefactura, pero se registra.
    expect(Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)
        ->where('accion', Bitacora::ACCION_EXPORTAR)->where('registro_id', $cerrada->id)->count())->toBe(2);
});

/** Las nueve claves del contrato de la plantilla, tal como las recibe, mas `cargadas`: las relaciones que traia cargadas. */
function capturarLoQueRecibeLaVista(array &$recibido): void
{
    View::composer('pdf.prefactura', function ($vista) use (&$recibido) {
        $recibido = Arr::only($vista->getData(), ['prefactura', 'esCotizacion', 'subtotal', 'iva', 'ivaEtiqueta', 'total', 'cambio', 'importes', 'elaboradoPor']);

        // Que relaciones traia YA cargadas, medido ANTES de que la plantilla se evalue: una relacion
        // que la plantilla cargara de forma perezosa quedaria cargada despues y no se veria.
        $prefactura = $recibido['prefactura'];
        $recibido['cargadas'] = [
            'aeronave' => $prefactura->relationLoaded('aeronave'),
            'aeronave.tipoAeronave' => $prefactura->relationLoaded('aeronave') && $prefactura->aeronave->relationLoaded('tipoAeronave'),
            'satelite' => $prefactura->relationLoaded('satelite'),
            'satelite.categoria' => $prefactura->relationLoaded('satelite') && $prefactura->satelite->relationLoaded('categoria'),
        ];
    });
}

test('el papel trae el nombre de QUIEN CERRO y la fecha de CIERRE, no los de quien imprime ni los de hoy', function () {
    // Dos usuarios distintos y dos fechas distintas: con un solo usuario, o con el reloj sin
    // mover, `$request->user()->name` y `now()` darian lo mismo que el dato correcto y esta
    // prueba no distinguiria el papel nuevo del literal «AJE» del viejo.
    $cierra = User::factory()->create(['name' => 'Rosa Cerradora']);
    $imprime = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $imprime->update(['name' => 'Ivan Impresor']);
    $this->actingAs($imprime);

    [$p] = prefacturaCompleta(100.0, 1);
    $this->travelTo(Carbon::parse('2026-03-14 10:30:00'));
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00', cierra: $cierra);
    $this->travelTo(Carbon::parse('2026-03-20 18:00:00'));

    $recibido = [];
    capturarLoQueRecibeLaVista($recibido);

    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertOk();

    // La clave que el controlador arma, y lo que la plantilla hace con ella y con la prefactura.
    $papel = view('pdf.prefactura', $recibido)->render();

    expect($recibido['elaboradoPor'])->toBe('Rosa Cerradora')
        ->and($papel)->toContain('Elaborado por: Rosa Cerradora')
        ->and($papel)->not->toContain('Ivan Impresor')
        ->and($papel)->toContain('Fecha:</span> 14/03/2026')      // la del cierre
        ->and($papel)->not->toContain('20/03/2026')               // no la de hoy
        ->and($papel)->not->toContain($cerrada->created_at->format('d/m/Y'));  // ni la de creacion
});

test('una cerrada sin quien la cerro (un legado) dice Sin registrar y no el nombre de quien imprime', function () {
    $imprime = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $imprime->update(['name' => 'Ivan Impresor']);
    $this->actingAs($imprime);
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');
    DB::table('fact_prefacturas')->where('id', $cerrada->id)->update(['cerrada_por' => null]);

    $recibido = [];
    capturarLoQueRecibeLaVista($recibido);

    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertOk();

    expect($recibido['elaboradoPor'])->toBe('Sin registrar');
});

test('las dos acciones cargan la aeronave con su tipo y su categoria: la vista no consulta', function (string $ruta) {
    // `cerrada` y `borrador` solo se distinguen por la ruta: cada una arma su propio `with()`.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    if ($ruta === 'pdf') {
        [$p] = prefacturaCompleta(100.0, 1);
        $p = cerrarConSello($p, '100.00', '16.00', '116.00');
    } else {
        $p = prefacturaBorrador();
        renglonDe($p, 100.0, 1);
    }

    $recibido = [];
    capturarLoQueRecibeLaVista($recibido);

    $this->get("/api/facturacion/prefacturas/{$p->id}/{$ruta}")->assertOk();

    expect($recibido['cargadas'])->toBe([
        'aeronave' => true,
        'aeronave.tipoAeronave' => true,
        'satelite' => true,
        'satelite.categoria' => true,
    ]);
})->with(['pdf', 'cotizacion']);

test('si el PDF no se puede armar, no queda en la bitacora un documento que no salio', function () {
    // Renderizar va ANTES de registrar: si DomPDF falla, no debe quedar un «se imprimio»
    // confirmado de un documento que nadie recibio.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    Pdf::shouldReceive('loadView')->once()->andThrow(new RuntimeException('DomPDF no pudo armar el documento'));

    $this->getJson("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertStatus(500);

    expect(Bitacora::where('accion', Bitacora::ACCION_EXPORTAR)->count())->toBe(0);
});

test('la cotizacion de un borrador se descarga como PDF', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    renglonDe($p, 500.0, 1);

    $respuesta = $this->get("/api/facturacion/prefacturas/{$p->id}/cotizacion");

    $respuesta->assertOk()->assertHeader('content-type', 'application/pdf');
    // getContent() y no streamedContent(): DomPDF devuelve una Response normal, no una
    // StreamedResponse, asi que streamedContent() no sirve aqui.
    expect(substr($respuesta->getContent(), 0, 5))->toBe('%PDF-');
});

test('la cotizacion muestra las cifras DERIVADAS, sin folio y marcada como cotizacion', function () {
    // Un borrador no tiene sello: si `cotizacion()` leyera las cifras selladas, la hoja
    // saldria con cadenas vacias. Se comparan las cifras que la plantilla recibe, que son lo
    // estable; el PDF va comprimido y no se lee dentro de el.
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $this->actingAs($usuario);
    $p = prefacturaBorrador();
    renglonDe($p, 500.0, 1);

    $mostrado = null;
    View::composer('pdf.prefactura', function ($vista) use (&$mostrado) {
        $mostrado = Arr::only($vista->getData(), ['esCotizacion', 'subtotal', 'iva', 'ivaEtiqueta', 'total', 'cambio', 'elaboradoPor'])
            + ['folio' => $vista->getData()['prefactura']->folio];
    });

    $this->get("/api/facturacion/prefacturas/{$p->id}/cotizacion")->assertOk();

    expect($mostrado)->toBe([
        'esCotizacion' => true,
        'elaboradoPor' => $usuario->name,
        'subtotal' => '500.00',
        'iva' => '80.00',
        'ivaEtiqueta' => '16%',
        'total' => '580.00',
        'cambio' => '0.00',
        'folio' => null,
    ]);
});

test('una cerrada NO se cotiza: ya esta emitida', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    $this->getJson("/api/facturacion/prefacturas/{$cerrada->id}/cotizacion")
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'ya_cerrada');
});

test('un borrador descartado no se cotiza', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);
    $p->update(['status' => FactPrefactura::STATUS_INACTIVO]);

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/cotizacion")
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_descartada');
});

test('cotizar con un ajuste de renglon ilegible responde 422', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1)->update(['ajuste_precio' => 'raro']);

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/cotizacion")
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'totales_no_calculables');
});

test('cotizar con un renglon que se corrige entre la carga y las cifras sigue siendo un 422, no un 500', function () {
    // La misma carrera que en /pdf: `subtotal()` de un borrador RELEE los renglones, asi que
    // si el ajuste ilegible se corrige despues de la carga esa lectura no lanza y solo los
    // objetos ya cargados lo hacen, los que recorre `importesDe()`. Si los importes se
    // calcularan fuera del try, esto seria un 500: la vista se renderiza despues de el.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1)->update(['ajuste_precio' => 'raro']);

    $corregido = false;
    DB::listen(function ($consulta) use (&$corregido, $p) {
        if ($corregido || ! str_starts_with(strtolower($consulta->sql), 'select')
            || ! str_contains($consulta->sql, 'fact_prefactura_renglones')) {
            return;
        }

        // La primera lectura de renglones es la carga del controlador: ya trajo 'raro'.
        $corregido = true;
        DB::table('fact_prefactura_renglones')->where('prefactura_id', $p->id)->update(['ajuste_precio' => 'ninguno']);
    });

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/cotizacion")
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'totales_no_calculables');

    expect($corregido)->toBeTrue();
});

test('cotizar con una tasa que se vuelve ilegible al calcular el cambio es 422, no un 500', function () {
    // Un borrador lee la tasa de la configuracion cada vez que la necesita: `iva()` (1a),
    // la etiqueta (2a), `total()` (3a, valida) y `cambio()`, que pasa por `sobrepago()` y
    // `total()`, la lee una 4a vez y lanza. Lo que lee la tasa en ULTIMO lugar es lo que esta
    // prueba protege: si `cambio()` saliera del try, o si la etiqueta se moviera detras de el
    // y pasara a ser la 4a lectura, seria un 500 y no un 422, porque la vista se renderiza
    // despues.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);
    $lectura = corromperTasaTrasLecturas(3);

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/cotizacion")
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'totales_no_calculables');

    expect($lectura->lecturas)->toBeGreaterThanOrEqual(4);
});

test('cotizar con la tasa de IVA ilegible desde el principio es 422, no un 500', function () {
    // El otro extremo de la prueba del cambio: aquella detecta que la lectura de la tasa
    // quede DETRAS del try, esta que quede ANTES. Con la tasa mala desde la primera lectura,
    // la que sea que se saque del try lanza fuera de el y seria un 500.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);
    FactConfiguracion::updateOrCreate(['clave' => 'iva_tasa'], ['valor' => 'raro', 'descripcion' => 'Tasa de IVA']);

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/cotizacion")
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'totales_no_calculables');
});

test('cotizar queda en la bitacora y dice que NO se emitio nada', function () {
    // Es lo que sustituye al codigo '1234' del sistema viejo, que esta en el JavaScript del
    // cliente y no deja rastro de quien cotizo ni cuando.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);

    $this->get("/api/facturacion/prefacturas/{$p->id}/cotizacion")->assertOk();

    $registro = Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)
        ->where('accion', Bitacora::ACCION_EXPORTAR)->sole();

    expect($registro->registro_id)->toBe($p->id)
        ->and($registro->descripcion)->toContain('cotización')
        ->and($registro->descripcion)->toContain('no se emitió');
});

test('cotizar NO escribe nada mas que la bitacora, ni consume folio', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);

    // Sin esto `touch()` no escribiria nada: dentro del mismo segundo `updated_at` no
    // cambia y Eloquent se salta el UPDATE, y la prueba no veria una escritura real.
    $this->travel(5)->seconds();

    $sentencias = [];
    DB::listen(function ($consulta) use (&$sentencias) {
        $sentencias[] = ltrim(strtolower($consulta->sql));
    });

    $this->get("/api/facturacion/prefacturas/{$p->id}/cotizacion")->assertOk();

    $escrituras = array_values(array_filter(
        $sentencias,
        fn (string $sql) => ! str_starts_with($sql, 'select') && ! str_contains($sql, 'bitacora'),
    ));

    expect($escrituras)->toBe([])
        ->and($p->fresh()->folio)->toBeNull()
        ->and($p->fresh()->estado)->toBe(FactPrefactura::ESTADO_BORRADOR);
});

test('si la cotizacion no se puede armar, no queda en la bitacora una cotizacion que no salio', function () {
    // El render es el mismo que el de /pdf, pero el orden renderizar-antes-de-registrar es
    // de CADA metodo: esta prueba fija el de `cotizacion()`, y la de arriba el de `pdf()`.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);

    Pdf::shouldReceive('loadView')->once()->andThrow(new RuntimeException('DomPDF no pudo armar el documento'));

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/cotizacion")->assertStatus(500);

    expect(Bitacora::where('accion', Bitacora::ACCION_EXPORTAR)->count())->toBe(0);
});

test('sin el subdepartamento no se cotiza', function () {
    $this->actingAs(usuarioSinAcceso());
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/cotizacion")->assertForbidden();
});

test('sin el subdepartamento no se imprime', function () {
    $this->actingAs(usuarioSinAcceso());
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    $this->getJson("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertForbidden();
});

test('las dos rutas de impresion existen, y ninguna queda sin su subdepartamento', function () {
    // La tabla de EndpointsPrefacturaTest no sirve para esto: excluye GET y HEAD, asi que
    // una ruta de impresion no aparece ahi nunca. Esta es su contraparte para las de lectura.
    // Afirma sobre el conjunto de URIs ademas del de middlewares: retirar o renombrar una
    // de las dos rutas hace fallar la prueba, no solo quitarle el middleware.
    $impresion = [];

    foreach (app('router')->getRoutes() as $ruta) {
        if (! preg_match('#^api/facturacion/prefacturas/\{id\}/(pdf|cotizacion)$#', $ruta->uri())) {
            continue;
        }

        $impresion[$ruta->uri()] = collect($ruta->gatherMiddleware())
            ->first(fn ($m) => is_string($m) && str_starts_with($m, 'subdep:'));
    }

    expect($impresion)->toBe([
        'api/facturacion/prefacturas/{id}/pdf' => 'subdep:factPrefacturas',
        'api/facturacion/prefacturas/{id}/cotizacion' => 'subdep:factPrefacturas',
    ]);
});
