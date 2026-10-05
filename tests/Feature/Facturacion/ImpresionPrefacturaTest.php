<?php

use App\Models\Bitacora;
use App\Models\FactPrefactura;
use Illuminate\Support\Facades\DB;

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

test('un borrador descartado no se imprime', function () {
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

test('reimprimir dos veces NO duplica nada y da el mismo documento', function () {
    // Reimprimir no tiene ruta propia: es volver a pedir la misma. En el viejo hacia falta
    // un archivo aparte precisamente porque imprimir escribia.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertOk();
    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertOk();

    expect(FactPrefactura::count())->toBe(1)
        ->and($cerrada->fresh()->folio)->toBe(10000)
        ->and($cerrada->fresh()->renglones()->count())->toBe(1);
});

test('sin el subdepartamento no se imprime', function () {
    $this->actingAs(usuarioSinAcceso());
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    $this->getJson("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertForbidden();
});

test('ninguna ruta de impresion queda sin su subdepartamento', function () {
    // La tabla de EndpointsPrefacturaTest no sirve para esto: excluye GET y HEAD, asi que
    // una ruta de impresion no aparece ahi nunca. Esta es su contraparte para las de lectura.
    $impresion = [];

    foreach (app('router')->getRoutes() as $ruta) {
        if (! preg_match('#^api/facturacion/prefacturas/\{id\}/(pdf|cotizacion)$#', $ruta->uri())) {
            continue;
        }

        $impresion[$ruta->uri()] = collect($ruta->gatherMiddleware())
            ->first(fn ($m) => is_string($m) && str_starts_with($m, 'subdep:'));
    }

    expect($impresion)->not->toBeEmpty()
        ->and(array_unique(array_values($impresion)))->toBe(['subdep:factPrefacturas']);
});
