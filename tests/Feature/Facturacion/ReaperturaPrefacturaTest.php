<?php

use App\Models\Bitacora;
use App\Models\FactPrefactura;
use App\Models\FactPrefacturaVersion;

/**
 * Los atributos mínimos de una versión de prueba; `$extra` pisa lo que haga falta.
 *
 * @param  array<string, mixed>  $extra
 * @return array<string, mixed>
 */
function filaDeVersion(FactPrefactura $prefactura, int $version, array $extra = []): array
{
    return array_merge([
        'prefactura_id' => $prefactura->id,
        'version' => $version,
        'folio' => $prefactura->folio,
        'subtotal_sellado' => '1.00',
        'iva_sellado' => '0.16',
        'total_sellado' => '1.16',
        'iva_tasa_sellada' => '0.1600',
        'reabierta_at' => now(),
        'reabierta_por' => null,
        'motivo' => 'x',
        'documento' => [],
    ], $extra);
}

test('una version guarda el documento como arreglo y se lee por su prefactura', function () {
    $prefactura = prefacturaBorrador();
    $prefactura->update(['estado' => FactPrefactura::ESTADO_CERRADA, 'folio' => 10001]);

    FactPrefacturaVersion::create([
        'prefactura_id' => $prefactura->id,
        'version' => 1,
        'folio' => 10001,
        'subtotal_sellado' => '100.00',
        'iva_sellado' => '16.00',
        'total_sellado' => '116.00',
        'iva_tasa_sellada' => '0.1600',
        'reabierta_at' => now(),
        'reabierta_por' => null,
        'motivo' => 'Faltaba el combustible.',
        'documento' => ['folio' => 10001, 'filas' => []],
    ]);

    $version = $prefactura->fresh()->versiones->sole();

    expect($version->documento)->toBe(['folio' => 10001, 'filas' => []])
        ->and($version->version)->toBe(1)
        ->and($version->motivo)->toBe('Faltaba el combustible.');
});

test('el estado reabierta cabe en la columna y no es cerrada', function () {
    $prefactura = prefacturaBorrador();
    $prefactura->update(['estado' => FactPrefactura::ESTADO_REABIERTA, 'folio' => 10002]);

    expect(FactPrefactura::ESTADO_REABIERTA)->toBe('reabierta')
        ->and($prefactura->fresh()->estado)->toBe('reabierta')
        ->and($prefactura->estaCerrada())->toBeFalse()
        ->and($prefactura->estaReabierta())->toBeTrue();
});

test('estaReabierta es falso para un borrador y para una cerrada', function () {
    // Las tareas siguientes abren los candados de una prefactura segun este predicado:
    // un `return true` no puede pasar.
    $borrador = prefacturaBorrador();
    $cerrada = prefacturaBorrador();
    $cerrada->update(['estado' => FactPrefactura::ESTADO_CERRADA, 'folio' => 10004]);

    expect($borrador->estaReabierta())->toBeFalse()
        ->and($cerrada->estaReabierta())->toBeFalse()
        ->and($cerrada->estaCerrada())->toBeTrue();
});

test('dos versiones no pueden llevar el mismo numero en la misma prefactura', function () {
    $prefactura = prefacturaBorrador();
    $prefactura->update(['estado' => FactPrefactura::ESTADO_CERRADA, 'folio' => 10003]);

    FactPrefacturaVersion::create(filaDeVersion($prefactura, 1));

    expect(fn () => FactPrefacturaVersion::create(filaDeVersion($prefactura, 1)))
        ->toThrow(Illuminate\Database\UniqueConstraintViolationException::class);
});

test('el unico es compuesto: otra prefactura puede tener su version 1 y la misma su version 2', function () {
    // Fija el indice (prefactura_id, version): un `unique('version')` rompe la segunda
    // creacion y un `unique('prefactura_id')` rompe la tercera.
    $a = prefacturaBorrador();
    $b = prefacturaBorrador();
    $a->update(['folio' => 10005]);
    $b->update(['folio' => 10006]);

    FactPrefacturaVersion::create(filaDeVersion($a, 1));
    FactPrefacturaVersion::create(filaDeVersion($b, 1));
    FactPrefacturaVersion::create(filaDeVersion($a, 2));

    expect(FactPrefacturaVersion::where('prefactura_id', $a->id)->count())->toBe(2)
        ->and(FactPrefacturaVersion::where('prefactura_id', $b->id)->count())->toBe(1);
});

test('versiones devuelve las versiones por numero, no por orden de creacion', function () {
    $prefactura = prefacturaBorrador();
    $prefactura->update(['estado' => FactPrefactura::ESTADO_CERRADA, 'folio' => 10007]);

    foreach ([3, 1, 2] as $numero) {
        FactPrefacturaVersion::create(filaDeVersion($prefactura, $numero));
    }

    // El motor recorre el indice unico (prefactura_id, version) y devuelve ya ordenado
    // aunque la relacion no ordene, asi que el resultado solo no prueba el orderBy: se
    // comprueba tambien que la relacion lo declara.
    expect($prefactura->fresh()->versiones->pluck('version')->all())->toBe([1, 2, 3])
        ->and(collect($prefactura->versiones()->getQuery()->getQuery()->orders)->pluck('column')->all())->toBe(['version']);
});

test('el sello de una version se lee con dos decimales, y la tasa con cuatro', function () {
    $prefactura = prefacturaBorrador();
    $prefactura->update(['estado' => FactPrefactura::ESTADO_CERRADA, 'folio' => 10008]);

    FactPrefacturaVersion::create(filaDeVersion($prefactura, 1, [
        'subtotal_sellado' => '100',
        'iva_sellado' => '16.5',
        'total_sellado' => '116.5',
        'iva_tasa_sellada' => '0.16',
    ]));

    $version = $prefactura->fresh()->versiones->sole();

    expect([$version->subtotal_sellado, $version->iva_sellado, $version->total_sellado, $version->iva_tasa_sellada])
        ->toBe(['100.00', '16.50', '116.50', '0.1600']);
});

test('reabrir guarda la version, limpia el sello y deja la prefactura editable', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $folio = $cerrada->folio;
    $selloAnterior = (string) $cerrada->total_sellado;
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');

    $reabierta = app(App\Services\ReaperturaPrefactura::class)
        ->reabrir($cerrada, $usuario->id, 'Faltaba el combustible del dia 3.');

    expect($reabierta->estado)->toBe(FactPrefactura::ESTADO_REABIERTA)
        ->and($reabierta->folio)->toBe($folio)
        ->and($reabierta->subtotal_sellado)->toBeNull()
        ->and($reabierta->iva_sellado)->toBeNull()
        ->and($reabierta->total_sellado)->toBeNull()
        ->and($reabierta->iva_tasa_sellada)->toBeNull()
        ->and($reabierta->cerrada_at)->toBeNull()
        ->and($reabierta->cerrada_por)->toBeNull();

    // Lo mismo, pero leido de la base y no del objeto que devolvio el servicio.
    $enBase = DB::table('fact_prefacturas')->where('id', $cerrada->id)->first();

    expect($enBase->estado)->toBe(FactPrefactura::ESTADO_REABIERTA)
        ->and($enBase->folio)->toBe($folio)
        ->and([$enBase->subtotal_sellado, $enBase->iva_sellado, $enBase->total_sellado, $enBase->iva_tasa_sellada, $enBase->cerrada_at, $enBase->cerrada_por])
        ->each->toBeNull();

    $version = $reabierta->versiones()->sole();

    expect($version->version)->toBe(1)
        ->and($version->folio)->toBe($folio)
        ->and((string) $version->total_sellado)->toBe($selloAnterior)
        ->and($version->cerrada_at)->not->toBeNull()
        ->and($version->cerrada_por)->not->toBeNull()
        ->and($version->motivo)->toBe('Faltaba el combustible del dia 3.')
        ->and($version->reabierta_por)->toBe($usuario->id)
        ->and($version->documento['folio'])->toBe($folio)
        ->and($version->documento['total'])->toBe($selloAnterior);
});

test('reabierta, los renglones vuelven a aceptar cambios', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $antes = $cerrada->renglones()->count();

    // Cerrada, esto lanza RenglonDePrefacturaCerradaException: los candados del modelo
    // preguntan por estaCerrada(), y una reabierta no esta cerrada.
    expect(fn () => renglonDe($cerrada->fresh(), 50.0, 1))
        ->toThrow(App\Services\RenglonDePrefacturaCerradaException::class);

    app(App\Services\ReaperturaPrefactura::class)->reabrir($cerrada, $usuario->id, 'Motivo suficiente.');

    renglonDe($cerrada->fresh(), 50.0, 1);

    expect($cerrada->renglones()->count())->toBe($antes + 1);
});

test('un borrador no se reabre', function () {
    $borrador = prefacturaBorrador();

    expect(fn () => app(App\Services\ReaperturaPrefactura::class)->reabrir($borrador, 1, 'x'))
        ->toThrow(App\Services\PrefacturaNoReabribleException::class);

    expect(FactPrefacturaVersion::count())->toBe(0);
});

test('una reabierta no se reabre otra vez', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $reabierta = app(App\Services\ReaperturaPrefactura::class)->reabrir($cerrada, $usuario->id, 'Motivo suficiente.');

    expect(fn () => app(App\Services\ReaperturaPrefactura::class)->reabrir($reabierta, $usuario->id, 'Otra vez.'))
        ->toThrow(App\Services\PrefacturaNoReabribleException::class);

    expect(FactPrefacturaVersion::count())->toBe(1);
});

test('una cerrada con el sello roto NO se reabre: primero se aclara la diferencia', function () {
    $cerrada = prefacturaCerradaParaDocumento();

    // Se rompe el sello por abajo, sin pasar por el modelo del renglon.
    DB::table('fact_prefacturas')->where('id', $cerrada->id)->update(['total_sellado' => '99999.00']);
    $bitacoraAntes = Bitacora::count();

    expect(fn () => app(App\Services\ReaperturaPrefactura::class)
        ->reabrir($cerrada->fresh(), 1, 'Motivo suficiente.'))
        ->toThrow(App\Services\PrefacturaNoReabribleException::class);

    // No se guardo nada, ni se toco el sello roto: sigue ahi, a la vista de quien lo aclare.
    expect(FactPrefacturaVersion::count())->toBe(0)
        ->and($cerrada->fresh()->estado)->toBe(FactPrefactura::ESTADO_CERRADA)
        ->and((string) $cerrada->fresh()->total_sellado)->toBe('99999.00')
        ->and(Bitacora::count())->toBe($bitacoraAntes);
});

test('un renglon que no se reconoce deja pasar la UnexpectedValueException y no escribe nada', function () {
    $cerrada = prefacturaCerradaParaDocumento();

    // El sello roto no es lo que falla aqui: el renglon no se puede ni valorar.
    DB::table('fact_prefactura_renglones')->where('prefactura_id', $cerrada->id)->update(['ajuste_precio' => 'inventado']);

    expect(fn () => app(App\Services\ReaperturaPrefactura::class)
        ->reabrir($cerrada->fresh(), 1, 'Motivo suficiente.'))
        ->toThrow(UnexpectedValueException::class);

    expect(FactPrefacturaVersion::count())->toBe(0)
        ->and($cerrada->fresh()->estado)->toBe(FactPrefactura::ESTADO_CERRADA);
});

test('si otra sesion reabre con la instancia ya leida, la segunda se rechaza y hay UNA version', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $usuario = usuarioConSubdepartamento('factReabrirPrefactura', 'Facturacion');
    $reapertura = app(App\Services\ReaperturaPrefactura::class);

    // Las dos sesiones leyeron la prefactura cuando estaba cerrada, de modo que la
    // comprobacion rapida de la segunda la deja pasar: solo lo que el servicio lee despues
    // de tomar el candado la puede parar.
    $laSegunda = $cerrada->fresh();

    $reapertura->reabrir($cerrada, $usuario->id, 'La otra sesion llego primero.');

    expect($laSegunda->estaCerrada())->toBeTrue()
        ->and(fn () => $reapertura->reabrir($laSegunda, $usuario->id, 'Y esta llego despues.'))
        ->toThrow(App\Services\PrefacturaNoReabribleException::class);

    // Una sola version, con el motivo de quien llego primero, y el folio intacto.
    expect($cerrada->fresh()->versiones()->count())->toBe(1)
        ->and($cerrada->fresh()->versiones()->sole()->motivo)->toBe('La otra sesion llego primero.')
        ->and($cerrada->fresh()->folio)->not->toBeNull();
});

test('la reapertura queda en la bitacora con el motivo y el sello anterior', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $usuario = usuarioConSubdepartamento('factReabrirPrefactura', 'Facturacion');
    $totalAnterior = (string) $cerrada->total_sellado;

    app(App\Services\ReaperturaPrefactura::class)
        ->reabrir($cerrada, $usuario->id, 'Faltaba el combustible del dia 3.');

    $registro = Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)
        ->where('registro_id', $cerrada->id)
        ->where('accion', Bitacora::ACCION_ACTUALIZAR)
        ->latest('id')
        ->first();

    expect($registro)->not->toBeNull()
        ->and($registro->usuario_id)->toBe($usuario->id)
        ->and($registro->descripcion)->toContain('Faltaba el combustible del dia 3.')
        ->and($registro->descripcion)->toContain((string) $cerrada->folio);

    // El sello anterior tiene que quedar registrado: es lo que convierte la reapertura en
    // auditable en vez de en un cambio sin rastro, que es el defecto del sistema viejo.
    expect($registro->datos_anteriores['total'])->toBe($totalAnterior)
        ->and($registro->datos_anteriores['estado'])->toBe(FactPrefactura::ESTADO_CERRADA)
        ->and($registro->datos_nuevos['estado'])->toBe(FactPrefactura::ESTADO_REABIERTA)
        ->and($registro->datos_nuevos['version_guardada'])->toBe(1);
});

test('la excepcion de no reabrible se traduce a 409 con su codigo', function () {
    $respuesta = (new App\Services\PrefacturaNoReabribleException('No.'))->render();

    expect($respuesta->getStatusCode())->toBe(409)
        ->and($respuesta->getData(true))->toBe(['message' => 'No.', 'codigo' => 'no_reabrible']);
});

test('una segunda reapertura guarda la version 2 con el documento corregido, sin pisar la 1', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $reapertura = app(App\Services\ReaperturaPrefactura::class);

    $reapertura->reabrir($cerrada, $usuario->id, 'Primera correccion.');

    // El nuevo cierre es el REAL: un estado sellado a mano es un estado que nadie garantiza
    // que el sistema produzca. El total sube a 174.00 y lo pagado es 116.00, asi que cierra
    // sin cobro completo, confirmado.
    renglonDe($cerrada->fresh(), 50.0, 1);
    app(App\Services\CierrePrefactura::class)->cerrar($cerrada->fresh(), $usuario->id, confirmarSinCobro: true);

    $reapertura->reabrir($cerrada->fresh(), $usuario->id, 'Segunda correccion.');

    $versiones = $cerrada->fresh()->versiones;

    expect($versiones->pluck('version')->all())->toBe([1, 2])
        ->and($versiones->pluck('motivo')->all())->toBe(['Primera correccion.', 'Segunda correccion.'])
        ->and($versiones->map(fn ($v) => $v->documento['total'])->all())->toBe(['116.00', '174.00'])
        ->and($versiones->pluck('folio')->unique()->all())->toBe([$cerrada->folio]);
});

test('reabrir por API exige el subdepartamento propio: con el de capturar no basta', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->patchJson("/api/facturacion/prefacturas/{$cerrada->id}/reabrir", ['motivo' => 'Motivo suficiente.'])
        ->assertForbidden();

    expect($cerrada->fresh()->estado)->toBe(FactPrefactura::ESTADO_CERRADA);
});

test('con el subdepartamento de reabrir, se reabre y se responde con la prefactura reabierta', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $folio = $cerrada->folio;
    $this->actingAs(usuarioConSubdepartamento('factReabrirPrefactura', 'Facturacion'));

    $this->patchJson("/api/facturacion/prefacturas/{$cerrada->id}/reabrir", ['motivo' => 'Faltaba el combustible.'])
        ->assertSuccessful()
        ->assertJsonPath('prefactura.estado', FactPrefactura::ESTADO_REABIERTA)
        ->assertJsonPath('prefactura.folio', $folio);

    expect($cerrada->fresh()->versiones()->count())->toBe(1)
        ->and($cerrada->fresh()->versiones()->first()->motivo)->toBe('Faltaba el combustible.');
});

test('sin motivo no se reabre', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $this->actingAs(usuarioConSubdepartamento('factReabrirPrefactura', 'Facturacion'));

    $this->patchJson("/api/facturacion/prefacturas/{$cerrada->id}/reabrir", [])
        ->assertStatus(422)
        ->assertJsonValidationErrors('motivo');

    // Un motivo de puros espacios tampoco: ConvertEmptyStringsToNull lo deja en null
    // DESPUES de TrimStrings, asi que `required` lo atrapa.
    $this->patchJson("/api/facturacion/prefacturas/{$cerrada->id}/reabrir", ['motivo' => '   '])
        ->assertStatus(422)
        ->assertJsonValidationErrors('motivo');

    // Y uno demasiado corto, o demasiado largo.
    $this->patchJson("/api/facturacion/prefacturas/{$cerrada->id}/reabrir", ['motivo' => 'error'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('motivo');
    $this->patchJson("/api/facturacion/prefacturas/{$cerrada->id}/reabrir", ['motivo' => str_repeat('a', 501)])
        ->assertStatus(422)
        ->assertJsonValidationErrors('motivo');

    expect($cerrada->fresh()->estado)->toBe(FactPrefactura::ESTADO_CERRADA)
        ->and($cerrada->fresh()->versiones()->count())->toBe(0);
});

test('reabrir un borrador o una ya reabierta es 409 con su codigo, no 500', function () {
    $this->actingAs(usuarioConSubdepartamento('factReabrirPrefactura', 'Facturacion'));

    $borrador = prefacturaBorrador();
    $this->patchJson("/api/facturacion/prefacturas/{$borrador->id}/reabrir", ['motivo' => 'Motivo suficiente.'])
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'no_reabrible');

    $cerrada = prefacturaCerradaParaDocumento();
    $this->patchJson("/api/facturacion/prefacturas/{$cerrada->id}/reabrir", ['motivo' => 'Motivo suficiente.'])
        ->assertSuccessful();
    $this->patchJson("/api/facturacion/prefacturas/{$cerrada->id}/reabrir", ['motivo' => 'Otra vez, mismo motivo.'])
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'no_reabrible');

    expect($cerrada->fresh()->versiones()->count())->toBe(1);
});

test('una prefactura inexistente o descartada no se reabre', function () {
    $this->actingAs(usuarioConSubdepartamento('factReabrirPrefactura', 'Facturacion'));

    $this->patchJson('/api/facturacion/prefacturas/999999/reabrir', ['motivo' => 'Motivo suficiente.'])
        ->assertNotFound();

    $descartada = prefacturaBorrador();
    $descartada->update(['status' => FactPrefactura::STATUS_INACTIVO]);

    $this->patchJson("/api/facturacion/prefacturas/{$descartada->id}/reabrir", ['motivo' => 'Motivo suficiente.'])
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_descartada');
});

test('una reabierta no se descarta', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    app(App\Services\ReaperturaPrefactura::class)->reabrir($cerrada, 1, 'Motivo suficiente.');
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->patchJson("/api/facturacion/prefacturas/{$cerrada->id}/descartar")
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'reabierta');

    expect($cerrada->fresh()->status)->toBe(FactPrefactura::STATUS_ACTIVO)
        ->and($cerrada->fresh()->folio)->not->toBeNull();
});

test('una reabierta NO se imprime como cotizacion: tiene folio gastado', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    app(App\Services\ReaperturaPrefactura::class)->reabrir($cerrada, 1, 'Motivo suficiente.');
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/cotizacion")
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'reabierta');

    // Ni como documento: no tiene sello. Y el texto no miente: no es un borrador, tiene folio,
    // y no manda a imprimir una cotizacion (que acaba de dar 422).
    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'reabierta')
        ->assertJsonPath('message', fn ($m) => str_contains($m, 'reabierta')
            && str_contains($m, (string) $cerrada->folio)
            && ! str_contains($m, 'borrador')
            && ! str_contains($m, 'cotizaci'));
});

test('el indice puede filtrar por reabierta', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    app(App\Services\ReaperturaPrefactura::class)->reabrir($cerrada, 1, 'Motivo suficiente.');
    $borrador = prefacturaBorrador();
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $respuesta = $this->getJson('/api/facturacion/prefacturas?estado=reabierta')->assertSuccessful();

    expect($respuesta->json('data'))->toHaveCount(1)
        ->and($respuesta->json('data.0.id'))->toBe($cerrada->id)
        ->and($borrador->fresh()->estado)->toBe(FactPrefactura::ESTADO_BORRADOR);
});

test('la ficha de una reabierta trae sus versiones con lo minimo para listarlas, y sin el documento', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $cerradaAt = $cerrada->cerrada_at->toDateTimeString();
    $usuario = usuarioConSubdepartamento('factReabrirPrefactura', 'Facturacion');
    $reapertura = app(App\Services\ReaperturaPrefactura::class);

    $reapertura->reabrir($cerrada, $usuario->id, 'Primera correccion.');
    renglonDe($cerrada->fresh(), 50.0, 1);
    app(App\Services\CierrePrefactura::class)->cerrar($cerrada->fresh(), $usuario->id, confirmarSinCobro: true);
    $reapertura->reabrir($cerrada->fresh(), $usuario->id, 'Segunda correccion.');

    $this->actingAs($usuario);
    $ficha = $this->getJson("/api/facturacion/prefacturas/{$cerrada->id}")->assertSuccessful();

    expect($ficha->json('prefactura.estado'))->toBe(FactPrefactura::ESTADO_REABIERTA)
        ->and($ficha->json('prefactura.versiones'))->toHaveCount(2)
        ->and(array_column($ficha->json('prefactura.versiones'), 'version'))->toBe([1, 2])
        ->and(array_column($ficha->json('prefactura.versiones'), 'motivo'))->toBe(['Primera correccion.', 'Segunda correccion.'])
        ->and(array_column($ficha->json('prefactura.versiones'), 'total_sellado'))->toBe(['116.00', '174.00'])
        ->and($ficha->json('prefactura.versiones.0.cerrada_at'))->toBe($cerradaAt)
        ->and($ficha->json('prefactura.versiones.0.reabierta_at'))->not->toBeNull();

    // Solo lo que la pantalla usa: ni el documento entero, ni los usuarios, ni el folio de la version.
    expect(array_keys($ficha->json('prefactura.versiones.0')))->toEqualCanonicalizing(['version', 'cerrada_at', 'total_sellado', 'motivo', 'reabierta_at']);
});

test('la respuesta de reabrir ya trae la version que acaba de guardar', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $this->actingAs(usuarioConSubdepartamento('factReabrirPrefactura', 'Facturacion'));

    $respuesta = $this->patchJson("/api/facturacion/prefacturas/{$cerrada->id}/reabrir", ['motivo' => 'Faltaba el combustible.'])
        ->assertSuccessful();

    expect($respuesta->json('prefactura.versiones'))->toHaveCount(1)
        ->and($respuesta->json('prefactura.versiones.0.version'))->toBe(1)
        ->and($respuesta->json('prefactura.versiones.0.motivo'))->toBe('Faltaba el combustible.');
});

test('una prefactura sin versiones las trae como lista vacia, y el indice no las trae', function () {
    $borrador = prefacturaBorrador();
    $cerrada = prefacturaCerradaParaDocumento();
    app(App\Services\ReaperturaPrefactura::class)->reabrir($cerrada, 1, 'Motivo suficiente.');
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->getJson("/api/facturacion/prefacturas/{$borrador->id}")
        ->assertSuccessful()
        ->assertJsonPath('prefactura.versiones', []);

    // El indice no lleva renglones ni cobro, y cada fila costaria una consulta mas por unas versiones que la lista no muestra.
    $fila = collect($this->getJson('/api/facturacion/prefacturas?estado=reabierta')->assertSuccessful()->json('data'))->firstWhere('id', $cerrada->id);

    expect($fila)->not->toBeNull()
        ->and($fila)->not->toHaveKey('versiones');
});
