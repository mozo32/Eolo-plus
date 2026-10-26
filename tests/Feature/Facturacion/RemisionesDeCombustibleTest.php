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

test('sin salida la ventana llega hasta ahora', function () {
    // Es el caso normal: 16 de 27 prefacturas no tienen salida cuando se capturan.
    $prefactura = prefacturaConMatricula(now()->subDay()->format('Y-m-d H:i:s'));
    $remision = remisionDe($prefactura, now()->format('Y-m-d'), now()->subHour()->format('H:i:s'));

    expect(RemisionesFacturables::candidatas($prefactura)->pluck('id')->all())->toBe([$remision->id]);
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
