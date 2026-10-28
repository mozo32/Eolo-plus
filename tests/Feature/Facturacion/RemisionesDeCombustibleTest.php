<?php

use App\Models\Aeronave;
use App\Models\FactAeronave;
use App\Models\FactPrefactura;
use App\Models\FactPrefacturaRenglon;
use App\Models\FactServicio;
use App\Models\Remision;
use App\Models\User;
use App\Services\RemisionesFacturables;

/*
 * El combustible se despacha en Rampa y se anota en una remision; la prefactura se captura en
 * Facturacion. Estas pruebas fijan QUE remisiones entran en una prefactura y cuales no.
 *
 * La regla de «tomada» tiene dos mitades: la marca manual que Rampa ya pone
 * (`status_prefactura`), y la existencia de un renglon que la referencia en una prefactura
 * ACTIVA. La segunda mitad es la que hace que no haya contabilidad manual: quitar el renglon o
 * descartar la prefactura liberan la remision solos.
 */

/** Una prefactura en borrador de una matricula nueva, con la llegada indicada y sin salida. */
function prefacturaConMatricula(string $llegada, ?string $salida = null): FactPrefactura
{
    $aeronave = Aeronave::create(['matricula' => matriculaDePrueba()]);
    FactAeronave::create(['aeronave_id' => $aeronave->id, 'estatus' => FactAeronave::ESTATUS_TRANSITO]);

    return FactPrefactura::create([
        'aeronave_id' => $aeronave->id,
        'estado' => FactPrefactura::ESTADO_BORRADOR,
        'tipo_destino' => FactPrefactura::DESTINO_NACIONAL,
        'llegada_at' => $llegada,
        'salida_at' => $salida,
        'user_id' => User::factory()->create()->id,
    ]);
}

/** Una remision de combustible de esa matricula, en esa fecha y hora. */
function remisionDe(FactPrefactura $prefactura, string $fecha, string $horaInicial, array $extra = []): Remision
{
    static $contador = 0;

    return Remision::create(array_merge([
        'folio' => 'EOLO-'.(9000 + ++$contador),
        'fecha' => $fecha,
        'hora_inicial' => $horaInicial,
        'hora_llegada' => $horaInicial,
        'matricula' => $prefactura->aeronave->matricula,
        // Columnas NOT NULL sin valor por omision en `remisiones`; Rampa siempre las llena.
        'destino' => 'MEX',
        'operador' => 'Operador de prueba',
        'cliente' => 'Cliente de prueba',
        'aeronave_tipo' => 'C-208',
        'lectura_inicial' => 1000,
        'lectura_final' => 3650,
        'total_litros' => 2650.00,
        'precio' => 25.9940,
        'status' => 'A',
        'status_prefactura' => false,
    ], $extra));
}

/** El servicio 7 del catalogo, que es el unico de combustible. */
function servicioDeCombustible(): FactServicio
{
    return FactServicio::firstOrCreate(
        ['concepto' => FactServicio::CONCEPTO_COMBUSTIBLE],
        ['nombre' => 'Combustible JET A-1', 'precio_unitario' => 25.9940],
    );
}

/** Mete la remision en la prefactura como lo hara el codigo de verdad. */
function renglonDeRemision(FactPrefactura $prefactura, Remision $remision): FactPrefacturaRenglon
{
    return $prefactura->renglones()->create([
        'servicio_id' => servicioDeCombustible()->id,
        'remision_combustible_id' => $remision->id,
        'nombre_servicio' => 'Combustible JET A-1 — '.$remision->folio,
        'precio_unitario' => $remision->precio,
        'cantidad' => (int) $remision->total_litros,
        'es_de_tercero' => false,
        'margen' => 0,
        'ajuste_precio' => FactServicio::AJUSTE_NINGUNO,
        'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE,
        'orden' => 1,
    ]);
}

// ---------------------------------------------------------------------------
// candidatas(): lo que entra solo
// ---------------------------------------------------------------------------

test('una remision de la matricula dentro de la ventana es candidata', function () {
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:30:00');

    expect(RemisionesFacturables::candidatas($prefactura)->pluck('id')->all())->toBe([$remision->id]);
});

test('sin salida la ventana NO tiene tope: entra tambien lo capturado con hora futura', function () {
    // Es el caso normal: 16 de 27 prefacturas no tienen salida cuando se capturan.
    // El reloj se fija para que «futuro» signifique algo: las 18:00 son futuro a las 12:00.
    $this->travelTo('2026-10-21 12:00:00');

    $prefactura = prefacturaConMatricula(now()->subDay()->format('Y-m-d H:i:s'));
    $pasada = remisionDe($prefactura, '2026-10-21', '11:00:00');
    $futura = remisionDe($prefactura, '2026-10-21', '18:00:00');
    $delMesSiguiente = remisionDe($prefactura, '2026-11-21', '09:00:00');

    // Las tres entran, incluida la del mes siguiente: mientras la estancia este abierta no hay
    // tope. Es el coste conocido de la regla, y se quita a mano si se tecleo por error.
    expect(RemisionesFacturables::candidatas($prefactura)->pluck('id')->all())
        ->toBe([$pasada->id, $futura->id, $delMesSiguiente->id]);
});

test('registrar la salida SI pone tope: lo despachado despues deja de entrar', function () {
    $this->travelTo('2026-10-21 12:00:00');

    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-21 12:00:00');
    $dentro = remisionDe($prefactura, '2026-10-21', '11:00:00');
    remisionDe($prefactura, '2026-10-21', '18:00:00');

    expect(RemisionesFacturables::candidatas($prefactura)->pluck('id')->all())->toBe([$dentro->id]);
});

test('no son candidatas las de otra matricula, ni las de antes de la llegada, ni las de despues de la salida', function () {
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');

    $otra = remisionDe($prefactura, '2026-10-20', '10:00:00', ['matricula' => 'XB-OTRA']);
    $antes = remisionDe($prefactura, '2026-10-20', '07:59:00');
    $despues = remisionDe($prefactura, '2026-10-20', '18:01:00');
    $dentro = remisionDe($prefactura, '2026-10-20', '12:00:00');

    expect(RemisionesFacturables::candidatas($prefactura)->pluck('id')->all())->toBe([$dentro->id])
        ->and([$otra->id, $antes->id, $despues->id])->not->toContain($dentro->id);
});

test('los extremos de la ventana SI entran', function () {
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $alEmpezar = remisionDe($prefactura, '2026-10-20', '08:00:00');
    $alTerminar = remisionDe($prefactura, '2026-10-20', '18:00:00');

    expect(RemisionesFacturables::candidatas($prefactura)->pluck('id')->all())
        ->toBe([$alEmpezar->id, $alTerminar->id]);
});

test('no es candidata una remision dada de baja', function () {
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    remisionDe($prefactura, '2026-10-20', '10:00:00', ['status' => 'N']);

    expect(RemisionesFacturables::candidatas($prefactura))->toHaveCount(0);
});

test('no es candidata una remision sin precio', function () {
    // Las 88 sin precio son todas anteriores al 2026-05-13: cobrarlas al precio de hoy seria
    // inventar una cifra.
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    remisionDe($prefactura, '2026-10-20', '10:00:00', ['precio' => null]);

    expect(RemisionesFacturables::candidatas($prefactura))->toHaveCount(0);
});

test('no es candidata una remision ya marcada desde Rampa', function () {
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    remisionDe($prefactura, '2026-10-20', '10:00:00', ['status_prefactura' => true, 'folio_orden_venta' => 'OV-123']);

    expect(RemisionesFacturables::candidatas($prefactura))->toHaveCount(0);
});

test('una remision sin hora_inicial cuenta como las 00:00 de su fecha', function () {
    // La columna admite nulo aunque hoy las 330 la tengan.
    $prefactura = prefacturaConMatricula('2026-10-20 00:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00', ['hora_inicial' => null]);

    expect(RemisionesFacturables::candidatas($prefactura)->pluck('id')->all())->toBe([$remision->id]);
});

// ---------------------------------------------------------------------------
// Lo que libera una remision: es el nucleo del diseño
// ---------------------------------------------------------------------------

test('una remision usada por otra prefactura ACTIVA no es candidata', function () {
    $primera = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($primera, '2026-10-20', '10:00:00');
    renglonDeRemision($primera, $remision);

    $segunda = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $segunda->aeronave_id = $primera->aeronave_id;
    $segunda->save();

    expect(RemisionesFacturables::candidatas($segunda->fresh()))->toHaveCount(0);
});

test('DESCARTAR la prefactura que la usaba vuelve a liberar la remision', function () {
    // Descartar solo pone status = 'N' y DEJA los renglones en pie. Si la consulta mirara solo
    // la existencia del renglon, la remision quedaria bloqueada para siempre.
    $primera = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($primera, '2026-10-20', '10:00:00');
    renglonDeRemision($primera, $remision);

    $segunda = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $segunda->aeronave_id = $primera->aeronave_id;
    $segunda->save();

    expect(RemisionesFacturables::candidatas($segunda->fresh()))->toHaveCount(0);

    $primera->update(['status' => FactPrefactura::STATUS_INACTIVO]);

    expect(RemisionesFacturables::candidatas($segunda->fresh())->pluck('id')->all())->toBe([$remision->id]);
});

test('QUITAR el renglon vuelve a liberar la remision', function () {
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00');
    $renglon = renglonDeRemision($prefactura, $remision);

    expect(RemisionesFacturables::candidatas($prefactura->fresh()))->toHaveCount(0);

    $renglon->delete();

    expect(RemisionesFacturables::candidatas($prefactura->fresh())->pluck('id')->all())->toBe([$remision->id]);
});

// ---------------------------------------------------------------------------
// paraElegir(): lo que ve el buscador del modal
// ---------------------------------------------------------------------------

test('el buscador SI devuelve las tomadas y las sin precio, marcadas', function () {
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $libre = remisionDe($prefactura, '2026-10-20', '09:00:00');
    $sinPrecio = remisionDe($prefactura, '2026-10-20', '10:00:00', ['precio' => null]);
    $deRampa = remisionDe($prefactura, '2026-10-20', '11:00:00', ['status_prefactura' => true, 'folio_orden_venta' => 'OV-123']);

    $lista = RemisionesFacturables::paraElegir($prefactura->aeronave->matricula)->keyBy('id');

    expect($lista->get($libre->id)->tomada_por)->toBeNull()
        ->and($lista->get($libre->id)->sin_precio)->toBeFalse()
        ->and($lista->get($sinPrecio->id)->sin_precio)->toBeTrue()
        ->and($lista->get($deRampa->id)->tomada_por)->toBe('OV-123');
});

test('el buscador NO acota por ventana: devuelve todas las de la matricula', function () {
    // El buscador manual es para los casos que la automatica no cubre, asi que acotar por la
    // ventana lo dejaria sin su razon de ser.
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    remisionDe($prefactura, '2026-01-01', '10:00:00');
    remisionDe($prefactura, '2026-12-31', '10:00:00');

    expect(RemisionesFacturables::paraElegir($prefactura->aeronave->matricula))->toHaveCount(2);
});

test('el buscador dice quien la tiene: el folio, o borrador #id si aun no lo tiene', function () {
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $enBorrador = remisionDe($prefactura, '2026-10-20', '09:00:00');
    $conFolio = remisionDe($prefactura, '2026-10-20', '10:00:00');

    $dueña = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $dueñaConFolio = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    renglonDeRemision($dueña, $enBorrador);
    renglonDeRemision($dueñaConFolio, $conFolio);
    // El folio se asigna al cerrar, y una cerrada ya no admite renglones: se pone despues.
    $dueñaConFolio->update(['folio' => 'FAC-0042']);

    $lista = RemisionesFacturables::paraElegir($prefactura->aeronave->matricula)->keyBy('id');

    expect($lista->get($enBorrador->id)->tomada_por)->toBe("borrador #{$dueña->id}")
        ->and($lista->get($conFolio->id)->tomada_por)->toBe('FAC-0042');
});

test('el buscador NO marca como tomada la que usaba una prefactura DESCARTADA', function () {
    // Es la misma regla que fija «DESCARTAR la prefactura...» para candidatas(), pero por el
    // camino del buscador: si este camino mirara solo el renglon, el modal mostraria como
    // tomada una remision que la sincronizacion si agregaria.
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00');
    renglonDeRemision($prefactura, $remision);

    expect(RemisionesFacturables::paraElegir($prefactura->aeronave->matricula)->first()->tomada_por)
        ->toBe("borrador #{$prefactura->id}");

    $prefactura->update(['status' => FactPrefactura::STATUS_INACTIVO]);

    expect(RemisionesFacturables::paraElegir($prefactura->aeronave->matricula)->first()->tomada_por)
        ->toBeNull();
});

test('el buscador marca la que ya esta en ESTA prefactura como tal, no como libre', function () {
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00');
    renglonDeRemision($prefactura, $remision);
    $matricula = $prefactura->aeronave->matricula;

    $deOtro = RemisionesFacturables::paraElegir($matricula)->first();
    $enEste = RemisionesFacturables::paraElegir($matricula, $prefactura->id)->first();

    // Desde fuera de la prefactura la tiene OTRO documento; desde dentro, es esta: un booleano, no una frase.
    expect($deOtro->tomada_por)->toBe("borrador #{$prefactura->id}")
        ->and($deOtro->en_este_documento)->toBeFalse()
        ->and($enEste->en_este_documento)->toBeTrue()
        ->and($enEste->tomada_por)->toBeNull();
});

// ---------------------------------------------------------------------------
// El endpoint que sincroniza
// ---------------------------------------------------------------------------

test('sincronizar agrega las remisiones de la ventana con el precio de la remision', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00', ['precio' => 30.5, 'total_litros' => 1200]);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")
        ->assertOk()
        ->assertJsonPath('agregados', 1);

    $renglon = FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->sole();

    expect((float) $renglon->precio_unitario)->toBe(30.5)
        ->and($renglon->cantidad)->toBe(1200)
        ->and($renglon->remision_combustible_id)->toBe($remision->id)
        ->and($renglon->nombre_servicio)->toBe('Combustible JET A-1 — '.$remision->folio)
        ->and($renglon->concepto)->toBe(FactServicio::CONCEPTO_COMBUSTIBLE);
});

test('DEFECTO que este trabajo evita: sincronizar dos veces no duplica nada', function () {
    // Es la prueba que define el endpoint. Si `candidatas()` dejara de excluir lo ya cobrado,
    // cada carga de la pantalla anadiria el combustible otra vez.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    remisionDe($prefactura, '2026-10-20', '10:00:00');

    foreach ([1, 2, 3] as $vuelta) {
        $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")->assertOk();
    }

    expect(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->count())->toBe(1);
});

test('el renglon de combustible impide pagar con AVCARD', function () {
    // El concepto se conserva justamente para esto: `PagosPrefactura` lo consulta.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    remisionDe($prefactura, '2026-10-20', '10:00:00');

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")->assertOk();

    expect(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)
        ->where('concepto', FactServicio::CONCEPTO_COMBUSTIBLE)->exists())->toBeTrue();
});

test('sincronizar reporta los renglones que quedaron fuera de la ventana, sin quitarlos', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 23:00:00');
    $tarde = remisionDe($prefactura, '2026-10-20', '20:00:00');

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")
        ->assertOk()->assertJsonPath('agregados', 1);

    // La salida se corrige a una hora anterior: la remision de las 20:00 queda fuera.
    $prefactura->update(['salida_at' => '2026-10-20 18:00:00']);

    $respuesta = $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")->assertOk();

    expect($respuesta->json('agregados'))->toBe(0)
        ->and($respuesta->json('fuera_de_ventana.0.folio'))->toBe($tarde->folio)
        ->and(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->count())->toBe(1);
});

test('con la estancia abierta, una remision de hora futura se agrega y NO se avisa fuera de ventana', function () {
    // El aviso de «fuera de ventana» del controlador llevaba su propia copia de la regla. Con
    // el tope en `now()` avisaba de que un renglon se habia salido de una ventana que para
    // `RemisionesFacturables` seguia conteniendolo.
    $this->travelTo('2026-10-21 12:00:00');
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-21 08:00:00');
    remisionDe($prefactura, '2026-10-21', '18:00:00');

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")
        ->assertOk()
        ->assertJsonPath('agregados', 1)
        ->assertJsonPath('fuera_de_ventana', []);
});

test('una prefactura cerrada no recibe renglones de sincronizar', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    remisionDe($prefactura, '2026-10-20', '10:00:00');
    cerrarConSello($prefactura, '0.00', '0.00', '0.00');

    // 409 `ya_cerrada`: el mismo rechazo que `store()`, que viene del trait compartido.
    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")
        ->assertConflict()
        ->assertJsonPath('codigo', 'ya_cerrada');

    expect(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->count())->toBe(0);
});

test('una prefactura REABIERTA no recibe renglones de sincronizar', function () {
    // Una reabierta es un documento ya emitido que alguien abrio para corregir algo concreto: que
    // al abrirlo le aparezcan solos renglones de combustible le cambia el total a espaldas de quien
    // lo reabrio. Lo automatico no la toca; lo que se corrige a proposito se hace a mano.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    remisionDe($prefactura, '2026-10-20', '10:00:00');
    $prefactura->update(['estado' => FactPrefactura::ESTADO_REABIERTA, 'folio' => 10002]);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")
        ->assertConflict()
        ->assertJsonPath('codigo', 'reabierta');

    expect(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->count())->toBe(0);
});

test('en una REABIERTA se sigue pudiendo elegir una remision a mano', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $servicio = servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00');
    $prefactura->update(['estado' => FactPrefactura::ESTADO_REABIERTA, 'folio' => 10002]);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
        'remision_combustible_id' => $remision->id,
    ])->assertCreated();

    expect(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->sole()->remision_combustible_id)->toBe($remision->id);
});

test('sincronizar exige el subdepartamento', function () {
    $this->actingAs(usuarioSinAcceso());
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")
        ->assertForbidden();
});

// ---------------------------------------------------------------------------
// Elegir una remision a mano
// ---------------------------------------------------------------------------

test('el buscador del modal devuelve las remisiones de la matricula con sus marcas', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $libre = remisionDe($prefactura, '2026-10-20', '09:00:00');
    $deRampa = remisionDe($prefactura, '2026-10-20', '11:00:00', ['status_prefactura' => true, 'folio_orden_venta' => 'OV-123']);

    $respuesta = $this->getJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones?q=".$prefactura->aeronave->matricula)
        ->assertOk();

    $porId = collect($respuesta->json('remisiones'))->keyBy('id');

    expect($porId->get($libre->id)['tomada_por'])->toBeNull()
        ->and($porId->get($libre->id)['en_este_documento'])->toBeFalse()
        ->and($porId->get($deRampa->id)['tomada_por'])->toBe('OV-123')
        ->and($porId->get($deRampa->id)['en_este_documento'])->toBeFalse();
});

test('se puede agregar a mano una remision YA tomada, que es lo decidido', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $servicio = servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00', ['status_prefactura' => true, 'folio_orden_venta' => 'OV-123']);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
        'remision_combustible_id' => $remision->id,
    ])->assertCreated();

    $renglon = FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->sole();

    expect($renglon->remision_combustible_id)->toBe($remision->id)
        ->and((float) $renglon->precio_unitario)->toBe(25.994)
        ->and($renglon->cantidad)->toBe(2650);
});

test('la cantidad y el precio los pone la remision, no lo que mande el cliente', function () {
    // Si el cliente pudiera fijar la cantidad, un error de tecleo cobraria litros que no se
    // cargaron. Los litros son un hecho de la remision.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $servicio = servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00', ['total_litros' => 777, 'precio' => 31.25]);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
        'remision_combustible_id' => $remision->id,
    ])->assertCreated();

    $renglon = FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->sole();

    expect($renglon->cantidad)->toBe(777)
        ->and((float) $renglon->precio_unitario)->toBe(31.25);
});

test('el margen, el ajuste y el de-tercero del catalogo no tocan el renglon que viene de la remision', function () {
    // El precio de este renglon es el de la remision. Si el alta a mano heredara el margen del
    // catalogo, la misma remision costaria distinto segun entrara sola (margen 0) o a mano; y
    // heredar «de tercero» con margen 0 grabaria la combinacion que el catalogo rechaza.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $servicio = servicioDeCombustible();
    // De tercero con margen > 0 es la unica combinacion que el catalogo permite para un servicio de tercero.
    $servicio->update(['es_de_tercero' => true, 'margen' => 10, 'ajuste_precio' => FactServicio::AJUSTE_MAS_5]);
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00', ['total_litros' => 1000, 'precio' => 20]);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
        'remision_combustible_id' => $remision->id,
    ])->assertCreated();

    $renglon = FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->sole();

    expect($renglon->es_de_tercero)->toBeFalse()
        ->and((float) $renglon->margen)->toBe(0.0)
        ->and($renglon->ajuste_precio)->toBe(FactServicio::AJUSTE_NINGUNO)
        ->and($renglon->importe())->toBe('20000.00');
});

test('no se puede agregar una remision sin precio', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $servicio = servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00', ['precio' => null]);

    $respuesta = $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
        'remision_combustible_id' => $remision->id,
    ])->assertStatus(422);

    expect($respuesta->json('errors.remision_combustible_id.0'))->toContain('precio')
        ->and(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->count())->toBe(0);
});

test('remision_combustible_id en un servicio que no es combustible se rechaza', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00');
    $normal = FactServicio::create(['nombre' => 'Remolque', 'precio_unitario' => 867.87]);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $normal->id,
        'cantidad' => 1,
        'remision_combustible_id' => $remision->id,
    ])->assertStatus(422)->assertJsonValidationErrors(['remision_combustible_id']);
});

test('el servicio de combustible SIN remision se sigue agregando como siempre', function () {
    // No regresion: el combustible tambien se puede cobrar a mano sin remision, al precio del
    // catalogo, como antes de este trabajo.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $servicio = servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 500,
    ])->assertCreated();

    $renglon = FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->sole();

    expect($renglon->remision_combustible_id)->toBeNull()
        ->and($renglon->cantidad)->toBe(500)
        ->and((float) $renglon->precio_unitario)->toBe(25.994);
});

test('el buscador no presenta como libre la remision que ya esta en este documento', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00');
    renglonDeRemision($prefactura, $remision);

    $respuesta = $this->getJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones")->assertOk();

    $fila = collect($respuesta->json('remisiones'))->firstWhere('id', $remision->id);

    // Un booleano, no una frase que la pantalla tenga que comparar: `tomada_por` es solo de quien la tiene OTRO documento.
    expect($fila['en_este_documento'])->toBeTrue()
        ->and($fila['tomada_por'])->toBeNull();
});

test('la misma remision no se cobra dos veces en el mismo documento', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $servicio = servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00');
    renglonDeRemision($prefactura, $remision);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
        'remision_combustible_id' => $remision->id,
    ])->assertStatus(422)->assertJsonValidationErrors(['remision_combustible_id']);

    expect(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->count())->toBe(1);
});

test('una remision dada de baja no se puede agregar a mano', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $servicio = servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00', ['status' => 'N']);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
        'remision_combustible_id' => $remision->id,
    ])->assertStatus(422)->assertJsonValidationErrors(['remision_combustible_id']);

    expect(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->count())->toBe(0);
});

test('un q[] malformado en el buscador no tumba nada', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');

    $this->getJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones?q[]=x")
        ->assertOk()
        ->assertJsonStructure(['remisiones']);
});

test('aeronave_id y remision_combustible_id juntos nunca dan un renglon', function () {
    // Cada campo exige un servicio distinto y un servicio no puede ser las dos cosas.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $combustible = servicioDeCombustible();
    $transito = FactServicio::create([
        'nombre' => 'Transito 2h',
        'precio_unitario' => 99,
        'concepto' => FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H,
    ]);
    $normal = FactServicio::create(['nombre' => 'Remolque', 'precio_unitario' => 867.87]);
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00');
    $otra = Aeronave::create(['matricula' => matriculaDePrueba()]);

    foreach ([$combustible, $transito, $normal] as $servicio) {
        $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
            'servicio_id' => $servicio->id,
            'cantidad' => 1,
            'aeronave_id' => $otra->id,
            'remision_combustible_id' => $remision->id,
        ])->assertStatus(422);
    }

    expect(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->count())->toBe(0);
});

// ---------------------------------------------------------------------------
// C-1: el combustible que entra solo y un pago AvCard ya registrado
// ---------------------------------------------------------------------------

test('CRITICO C-1: cobrar con AvCard y que el combustible entre solo despues NO deja cerrar el documento', function () {
    // La secuencia entera, sin que nadie haga nada deliberado: se cobra con AvCard mientras la
    // prefactura todavia no tiene combustible (la regla lo permite), Rampa captura la remision,
    // el operador recarga la pantalla y el renglon entra solo. Antes de este arreglo el
    // documento se cerraba y consumia folio en el estado que el sistema prohibe.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $prefactura->update(['cliente_id' => App\Models\FactCliente::create(['nombre' => 'Cliente '.uniqid()])->id]);
    renglonDe($prefactura, 500.0, 1);
    $formas = formasDePago();

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/pagos", [
        'forma_pago_id' => $formas[App\Models\FactFormaPago::CONCEPTO_AVCARD]->id,
        'monto' => '100.00',
    ])->assertCreated();

    remisionDe($prefactura, '2026-10-20', '10:00:00');

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")
        ->assertOk()
        ->assertJsonPath('agregados', 1);

    $respuesta = $this->patchJson("/api/facturacion/prefacturas/{$prefactura->id}/cerrar", ['confirmar_sin_cobro' => true])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'avcard_con_combustible');

    // El mensaje dice QUE pasa y QUE puede hacer el operador, no solo que no se puede.
    expect($respuesta->json('message'))->toContain('AvCard')
        ->and($respuesta->json('message'))->toContain('combustible');

    $prefactura = $prefactura->fresh();
    expect($prefactura->folio)->toBeNull()
        ->and($prefactura->estado)->toBe(FactPrefactura::ESTADO_BORRADOR);
});

// ---------------------------------------------------------------------------
// I-2: el servicio de combustible dado de baja
// ---------------------------------------------------------------------------

test('IMPORTANTE I-2: sincronizar NO cobra con un servicio de combustible dado de baja', function () {
    // Dar de baja el servicio es la unica palanca del usuario para decir «deja de cobrar
    // combustible desde aqui». La via manual ya lo respetaba (422); la automatica lo ignoraba
    // y creaba el renglon igual. La sincronizacion no se inventa un renglon: se niega y lo dice.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDeCombustible()->update(['status' => FactServicio::STATUS_INACTIVO]);
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    remisionDe($prefactura, '2026-10-20', '10:00:00');

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'sin_servicio_de_combustible');

    expect(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->count())->toBe(0);
});

test('el catalogo no puede tener dos servicios de combustible, asi que no hay cual elegir', function () {
    // La revision apuntaba que `first()` sin orden elegiria uno al azar si hubiera dos. No
    // puede haberlos: `fact_servicios.concepto` es UNIQUE desde su migracion. Esta prueba fija
    // ese invariante, que es lo que permite seguir usando `first()` y no un `orderBy`.
    servicioDeCombustible();

    expect(fn () => FactServicio::create([
        'nombre' => 'Combustible JET A-1 (otro)',
        'precio_unitario' => 25.9940,
        'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE,
    ]))->toThrow(Illuminate\Database\UniqueConstraintViolationException::class);
});

// ---------------------------------------------------------------------------
// I-3: el alta a mano queda atada a la matricula de la prefactura
// ---------------------------------------------------------------------------

test('IMPORTANTE I-3: el alta a mano rechaza una remision de OTRA matricula', function () {
    // El buscador del modal arranca con la matricula de la prefactura, pero es un input
    // editable: tecleando otra salen sus remisiones y el alta las aceptaba. Se le cobraria al
    // cliente de este documento el combustible de otra aeronave, con su folio ajeno impreso.
    // La via automatica ya esta atada a la matricula; la manual debe estarlo igual.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $servicio = servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $ajena = remisionDe($prefactura, '2026-10-20', '10:00:00', ['matricula' => 'XB-OTRA']);

    $respuesta = $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
        'remision_combustible_id' => $ajena->id,
    ])->assertStatus(422)->assertJsonValidationErrors(['remision_combustible_id']);

    expect($respuesta->json('errors.remision_combustible_id.0'))->toContain('XB-OTRA')
        ->and($respuesta->json('errors.remision_combustible_id.0'))->toContain($prefactura->aeronave->matricula)
        ->and(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->count())->toBe(0);
});

test('la matricula de la remision se compara normalizada, como en la via automatica', function () {
    // Rampa teclea la matricula a mano: minusculas y espacios de sobra no son otra aeronave.
    // `deLaMatricula()` ya compara con `upper(trim(...))`; el alta a mano usa lo mismo.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $servicio = servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00', [
        'matricula' => '  '.mb_strtolower($prefactura->aeronave->matricula).'  ',
    ]);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
        'remision_combustible_id' => $remision->id,
    ])->assertCreated();

    expect(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->sole()->remision_combustible_id)->toBe($remision->id);
});

test('el buscador SIGUE ofreciendo las remisiones de otra matricula: atar el alta no es capar el buscador', function () {
    // El buscador es texto libre a proposito. Lo que cambia es que el alta ya no las acepta.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $ajena = remisionDe($prefactura, '2026-10-20', '10:00:00', ['matricula' => 'XB-OTRA']);

    $respuesta = $this->getJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones?q=XB-OTRA")->assertOk();

    expect(collect($respuesta->json('remisiones'))->pluck('id')->all())->toContain($ajena->id);
});

// ---------------------------------------------------------------------------
// I-1: lo que el operador quita a proposito no vuelve a entrar solo
// ---------------------------------------------------------------------------

test('IMPORTANTE I-1: un renglon de combustible que el operador quita NO vuelve a entrar solo', function () {
    // El operador ve que ese combustible no va en este documento (lo paga el operador
    // directamente, o Rampa lo capturo en la matricula equivocada) y quita el renglon. Antes
    // de este arreglo bastaba con recargar la pantalla para que volviera a entrar, con su
    // importe, y el unico recurso era marcarlo cortesia: seguia saliendo impreso a $0.00.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    remisionDe($prefactura, '2026-10-20', '10:00:00');

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")
        ->assertOk()->assertJsonPath('agregados', 1);

    $renglon = FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->sole();
    $this->deleteJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones/{$renglon->id}")->assertOk();

    // Recargar la pantalla sincroniza otra vez. La decision del operador se respeta.
    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")
        ->assertOk()->assertJsonPath('agregados', 0);

    expect(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->count())->toBe(0);
});

test('el alta A MANO de la misma remision revoca la exclusion', function () {
    // Volver a ponerla a proposito es deshacer la decision anterior. Si la marca sobreviviera,
    // la remision quedaria apuntada como «esta no entra» con su renglon puesto.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $servicio = servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00');

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")->assertOk();
    $renglon = FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->sole();
    $this->deleteJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones/{$renglon->id}")->assertOk();

    expect(App\Models\FactPrefacturaRemisionExcluida::where('prefactura_id', $prefactura->id)
        ->where('remision_id', $remision->id)->exists())->toBeTrue();

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
        'remision_combustible_id' => $remision->id,
    ])->assertCreated();

    expect(App\Models\FactPrefacturaRemisionExcluida::where('prefactura_id', $prefactura->id)
        ->where('remision_id', $remision->id)->exists())->toBeFalse();
});

test('excluir dos veces seguidas la misma remision deja UNA fila: es la misma decision', function () {
    // La version anterior de esta prueba daba de alta y quitaba dos veces por HTTP, y era
    // vacua: el alta REVOCA, asi que la segunda exclusion caia sobre tabla vacia y el unico de
    // la tabla no se tocaba nunca (sobrevivia a cambiar `firstOrCreate()` por `create()`).
    //
    // Se llama al servicio dos veces SEGUIDAS, sin revocacion en medio, que es lo unico que
    // ejerce de verdad el `firstOrCreate()`. Por HTTP ese camino no se alcanza —haria falta
    // que la prefactura tuviera dos renglones con la misma remision, y `store()` y
    // `candidatas()` lo impiden bajo el candado—, pero la defensa esta puesta y esto la fija.
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00');
    $usuario = App\Models\User::factory()->create();

    RemisionesFacturables::excluir($prefactura, $remision->id, $usuario->id);
    RemisionesFacturables::excluir($prefactura, $remision->id, $usuario->id);

    expect(App\Models\FactPrefacturaRemisionExcluida::where('prefactura_id', $prefactura->id)
        ->where('remision_id', $remision->id)->count())->toBe(1);
});

test('la exclusion es de ESTA prefactura: otro documento de la misma matricula la sigue trayendo', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00');

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")->assertOk();
    $renglon = FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->sole();
    $this->deleteJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones/{$renglon->id}")->assertOk();

    // Otro borrador de LA MISMA matricula y la misma ventana.
    $otra = FactPrefactura::create([
        'aeronave_id' => $prefactura->aeronave_id,
        'estado' => FactPrefactura::ESTADO_BORRADOR,
        'tipo_destino' => FactPrefactura::DESTINO_NACIONAL,
        'llegada_at' => '2026-10-20 08:00:00',
        'salida_at' => '2026-10-20 18:00:00',
        'user_id' => $prefactura->user_id,
    ]);

    $this->postJson("/api/facturacion/prefacturas/{$otra->id}/remisiones/sincronizar")
        ->assertOk()->assertJsonPath('agregados', 1);

    expect(RemisionesFacturables::candidatas($prefactura->fresh())->pluck('id')->all())->toBe([]);
});

test('el buscador manual SIGUE ofreciendo una remision excluida: excluirla del automatico no es prohibirla', function () {
    // El operador puede haberse equivocado al quitarla, y volver a ponerla es su derecho.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00');

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")->assertOk();
    $renglon = FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->sole();
    $this->deleteJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones/{$renglon->id}")->assertOk();

    $respuesta = $this->getJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones")->assertOk();
    $fila = collect($respuesta->json('remisiones'))->firstWhere('id', $remision->id);

    expect($fila)->not->toBeNull()
        ->and($fila['en_este_documento'])->toBeFalse()
        ->and($fila['tomada_por'])->toBeNull();
});

test('quitar un renglon SIN remision no apunta ninguna exclusion', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $renglon = renglonDe($prefactura, 500.0, 1);

    $this->deleteJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones/{$renglon->id}")->assertOk();

    expect(App\Models\FactPrefacturaRemisionExcluida::count())->toBe(0);
});

test('sin candidatas, un servicio de combustible dado de baja no interrumpe nada', function () {
    // El 422 es para cuando SE PIERDE algo: habia litros que cobrar y no hay con que. Si esta
    // prefactura no tiene ninguna remision que traer, la falta del servicio no la afecta, y un
    // aviso que salta cuando no se ha perdido nada es el que la gente aprende a cerrar sin
    // leer. Responde con normalidad.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDeCombustible()->update(['status' => FactServicio::STATUS_INACTIVO]);
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")
        ->assertOk()
        ->assertJsonPath('agregados', 0)
        ->assertJsonPath('fuera_de_ventana', []);

    expect(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->count())->toBe(0);
});

test('las guardas van ANTES que la del servicio: una cerrada sin servicio activo sigue dando 409 ya_cerrada', function () {
    // Mover la comprobacion del servicio detras de las candidatas no puede colarla por delante
    // de cerrada, descartada ni reabierta: esas rechazan antes que nada.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDeCombustible()->update(['status' => FactServicio::STATUS_INACTIVO]);
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    remisionDe($prefactura, '2026-10-20', '10:00:00');
    cerrarConSello($prefactura, '0.00', '0.00', '0.00');

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")
        ->assertConflict()
        ->assertJsonPath('codigo', 'ya_cerrada');
});

test('una REABIERTA sin servicio activo sigue dando 409 reabierta, no el 422 del servicio', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDeCombustible()->update(['status' => FactServicio::STATUS_INACTIVO]);
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    remisionDe($prefactura, '2026-10-20', '10:00:00');
    $prefactura->update(['estado' => FactPrefactura::ESTADO_REABIERTA, 'folio' => 10002]);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")
        ->assertConflict()
        ->assertJsonPath('codigo', 'reabierta');
});

test('un borrador DESCARTADO sin servicio activo sigue dando 409 ya_descartada', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDeCombustible()->update(['status' => FactServicio::STATUS_INACTIVO]);
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    remisionDe($prefactura, '2026-10-20', '10:00:00');
    $prefactura->update(['status' => FactPrefactura::STATUS_INACTIVO]);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")
        ->assertConflict()
        ->assertJsonPath('codigo', 'ya_descartada');
});

// ---------------------------------------------------------------------------
// N-1: el guion. La misma aeronave escrita con un guion de mas o de menos
// ---------------------------------------------------------------------------

/** Una prefactura cuya aeronave lleva EXACTAMENTE esta matricula. */
function prefacturaDeMatriculaExacta(string $matricula): FactPrefactura
{
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $prefactura->aeronave->update(['matricula' => $matricula]);

    return $prefactura->fresh();
}

test('N-1: el alta a mano acepta una remision cuya matricula solo difiere en el guion', function () {
    // En `eolo_plus` hay seis parejas de la MISMA aeronave escrita con otro guion, con filas
    // distintas en `aeronaves`; la peor es XA-VIZ / XAVIZ, con 38 remisiones y 28 con precio.
    // La via automatica nunca las trajo, asi que el alta a mano era el unico rescate de esa
    // carga con SU precio. Atarla a la matricula lo cerro: esto lo vuelve a abrir.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $servicio = servicioDeCombustible();
    $prefactura = prefacturaDeMatriculaExacta('XAVIZ');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00', ['matricula' => 'XA-VIZ']);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
        'remision_combustible_id' => $remision->id,
    ])->assertCreated();

    $renglon = FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->sole();

    // Con SU precio y SUS litros, que es justo lo que se perdia por el rodeo del renglon suelto.
    expect($renglon->remision_combustible_id)->toBe($remision->id)
        ->and((float) $renglon->precio_unitario)->toBe(25.994)
        ->and($renglon->cantidad)->toBe(2650);
});

test('N-1 al reves: una remision SIN guion en una prefactura CON guion tambien se acepta', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $servicio = servicioDeCombustible();
    $prefactura = prefacturaDeMatriculaExacta('XA-VIZ');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00', ['matricula' => 'XAVIZ']);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
        'remision_combustible_id' => $remision->id,
    ])->assertCreated();

    expect(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->sole()->remision_combustible_id)
        ->toBe($remision->id);
});

test('N-1: el doble guion de la base tambien cuenta como la misma aeronave', function () {
    // Las parejas reales son de ese tipo: `XA--JMB` / `XA-JMB`, `XA--DJT` / `XA-DJT`...
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $servicio = servicioDeCombustible();
    $prefactura = prefacturaDeMatriculaExacta('XA--JMB');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00', ['matricula' => 'XA-JMB']);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
        'remision_combustible_id' => $remision->id,
    ])->assertCreated();
});

test('N-1 no abre la puerta: una matricula de VERDAD distinta sigue dando 422', function () {
    // El guion es la unica tolerancia que se anade. Dos aeronaves distintas siguen siendo dos.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $servicio = servicioDeCombustible();
    $prefactura = prefacturaDeMatriculaExacta('XA-ABC');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00', ['matricula' => 'XA-XYZ']);

    $respuesta = $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
        'remision_combustible_id' => $remision->id,
    ])->assertStatus(422)->assertJsonValidationErrors(['remision_combustible_id']);

    expect($respuesta->json('errors.remision_combustible_id.0'))->toContain('XA-XYZ')
        ->and(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->count())->toBe(0);
});

test('N-1: la via AUTOMATICA no se mueve, el guion sigue separando', function () {
    // La tolerancia es SOLO del alta a mano. `candidatas()` no puede empezar a traer sola el
    // combustible de XA-VIZ a las prefacturas de XAVIZ: son dos filas distintas en `aeronaves`
    // y eso es un cambio con dinero detras, no un retoque de validacion.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDeCombustible();
    $prefactura = prefacturaDeMatriculaExacta('XAVIZ');
    remisionDe($prefactura, '2026-10-20', '10:00:00', ['matricula' => 'XA-VIZ']);

    expect(RemisionesFacturables::candidatas($prefactura)->all())->toBe([]);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")
        ->assertOk()
        ->assertJsonPath('agregados', 0);
});
