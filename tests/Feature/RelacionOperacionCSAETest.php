<?php

use App\Models\MovimientoCSAE;
use App\Models\OperacionDiaria;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/*
 * Como se relaciona una estancia de operaciones diarias con sus corridas de motor en CSAE.
 *
 * Reglas del negocio: la operacion diaria se registra ANTES que la entrada a CSAE; la salida de
 * operacion diaria puede registrarse sin que exista salida de CSAE (las entradas y salidas de CSAE
 * son para correr motores); y dentro de UNA llegada/salida puede haber MUCHOS pares de CSAE.
 *
 * Las pruebas de este bloque son peticiones REALES al Excel: una regla de emparejamiento que solo
 * se prueba suelta no demuestra que el endpoint la use. Los casos del primer bloque son datos reales
 * de la base de desarrollo que YA se emparejaban bien antes de cambiar la regla.
 */

beforeEach(function () {
    // Una corrida sin salida dura "hasta ahora": se congela el reloj para que sea determinista.
    Carbon::setTestNow('2026-10-08 12:00:00');
});

afterEach(fn () => Carbon::setTestNow());

/**
 * El Excel usa funciones de MySQL que sqlite no tiene. Nombre propio: este fichero tiene que poder
 * correr solo, y los helpers de otros ficheros de Pest son globales.
 */
function relacionFuncionesDeMysql(): void
{
    $pdo = DB::connection()->getPdo();

    $pdo->sqliteCreateFunction('DATE_FORMAT', function ($fecha, $formato) {
        $marca = strtotime((string) $fecha);

        return $marca === false ? null : strtr((string) $formato, [
            '%Y' => date('Y', $marca), '%m' => date('m', $marca), '%d' => date('d', $marca),
            '%H' => date('H', $marca), '%i' => date('i', $marca), '%s' => date('s', $marca),
        ]);
    }, 2);
    $pdo->sqliteCreateFunction('CONCAT', fn (...$partes) => implode('', $partes), -1);
    $pdo->sqliteCreateFunction('STR_TO_DATE', fn ($texto, $formato) => $texto, 2);
}

function relacionUsuarioId(): int
{
    return User::query()->value('id') ?? User::factory()->create()->id;
}

/** @param  array<string, mixed>  $extra */
function relacionOperacion(string $tipo, string $matricula, string $cuando, array $extra = []): OperacionDiaria
{
    $momento = Carbon::parse($cuando);

    return OperacionDiaria::create([
        'user_id' => relacionUsuarioId(),
        'fecha' => $momento->toDateString(),
        'tipo' => $tipo,
        'matricula' => $matricula,
        'equipo' => 'C172',
        'hora' => $momento->format('H:i:s'),
        'lugar' => 'MMTO',
        'pax' => 2,
        'departamento' => 'Trafico',
        ...$extra,
    ]);
}

/** @param  array<string, mixed>  $extra */
function relacionLlegada(string $matricula, string $cuando, array $extra = []): OperacionDiaria
{
    return relacionOperacion('llegada', $matricula, $cuando, $extra);
}

/** @param  array<string, mixed>  $extra */
function relacionSalida(string $matricula, string $cuando, array $extra = []): OperacionDiaria
{
    return relacionOperacion('salida', $matricula, $cuando, $extra);
}

function relacionMovimiento(string $matricula, string $entrada, ?string $salida = null): MovimientoCSAE
{
    return MovimientoCSAE::create([
        'user_entrada_id' => relacionUsuarioId(),
        'fecha_hora_entrada' => $entrada,
        'fecha_hora_salida' => $salida,
        'matricula' => $matricula,
        'tipo_aeronave' => 'C172',
        'como_llega' => 'Remolcada',
        'transportista' => 'Propio',
        'status' => 'A',
    ]);
}

/**
 * Pide el Excel y devuelve la respuesta ya decodificada: `operaciones` (lo que el navegador lee) y
 * `huerfanos`. La forma de la respuesta cambio de lista a objeto, pero este helper lee las dos.
 *
 * @param  array<string, mixed>  $parametros
 * @return array{operaciones: array<int, array<string, mixed>>, huerfanos: array<int, array<string, mixed>>, crudo: mixed}
 */
function relacionExcel(array $parametros = []): array
{
    relacionFuncionesDeMysql();
    test()->actingAs(usuarioAdmin(), 'sanctum');

    $respuesta = test()->getJson('/api/OperacionesDiarias/Excel?'.http_build_query($parametros));
    $respuesta->assertSuccessful();

    $crudo = $respuesta->json();

    return [
        'operaciones' => $crudo['data'] ?? $crudo,
        'huerfanos' => $crudo['huerfanos_csae'] ?? [],
        'crudo' => $crudo,
    ];
}

/**
 * La fila de la operacion indicada dentro del Excel.
 *
 * @param  array{operaciones: array<int, array<string, mixed>>}  $excel
 * @return array<string, mixed>
 */
function relacionFila(array $excel, OperacionDiaria $operacion): array
{
    $fila = collect($excel['operaciones'])->firstWhere('id', $operacion->id);
    expect($fila)->not->toBeNull("La operacion #{$operacion->id} no salio en el Excel");

    return $fila;
}

/**
 * Los ids de los movimientos de CSAE que quedaron en la fila, en el orden en que salen.
 *
 * @param  array<string, mixed>  $fila
 * @return array<int, int>
 */
function relacionIdsDe(array $fila): array
{
    return array_map(fn ($movimiento) => $movimiento['id'], $fila['movimientos_csae']);
}

/**
 * Que la estancia no tenga NINGUNA corrida colgada: los siete campos del contrato en su valor vacio.
 *
 * @param  array<string, mixed>  $fila
 */
function relacionEsperaSinCorridas(array $fila): void
{
    expect($fila['mantenimiento_csae'])->toBeFalse()
        ->and($fila['fecha_hora_csae'])->toBeNull()
        ->and($fila['fecha_hora_salida_csae'])->toBeNull()
        ->and($fila['movimientos_csae'])->toBe([])
        ->and($fila['cantidad_visitas_csae'])->toBe(0)
        ->and($fila['minutos_estancia_csae_total'])->toBe(0)
        ->and($fila['salidas_csae_pendientes'])->toBe(0);
}

// ===========================================================================
// LO QUE YA FUNCIONABA. Estas pruebas se escribieron y se corrieron contra la regla ANTERIOR
// (contencion) y pasaban; tienen que seguir pasando con la regla nueva (solape).
// ===========================================================================

/**
 * Las tres estancias reales de XA-AAL, con sus cinco corridas, para que ninguna se cuele en otra.
 *
 * @return array<string, OperacionDiaria|MovimientoCSAE>
 */
function relacionSembrarXaAal(): array
{
    $e1 = relacionLlegada('XA-AAL', '2026-04-16 21:34');
    relacionSalida('XA-AAL', '2026-05-04 23:45');
    $e2 = relacionLlegada('XA-AAL', '2026-05-05 21:34');
    relacionSalida('XA-AAL', '2026-08-22 12:34');
    $e3 = relacionLlegada('XA-AAL', '2026-08-22 23:45');
    relacionSalida('XA-AAL', '2026-09-08 15:59');

    $m1 = relacionMovimiento('XA-AAL', '2026-04-17 06:18', '2026-05-03 21:36');
    $m2 = relacionMovimiento('XA-AAL', '2026-05-08 06:29', '2026-05-11 20:00');
    $m3 = relacionMovimiento('XA-AAL', '2026-05-12 08:37', '2026-05-28 21:23');
    $m4 = relacionMovimiento('XA-AAL', '2026-05-28 21:52', '2026-08-19 12:55');
    $m5 = relacionMovimiento('XA-AAL', '2026-08-28 12:34');

    return compact('e1', 'e2', 'e3', 'm1', 'm2', 'm3', 'm4', 'm5');
}

it('YA FUNCIONABA XA-AAL: una estancia con una sola corrida empareja esa corrida y ninguna otra', function () {
    $s = relacionSembrarXaAal();

    $fila = relacionFila(relacionExcel(), $s['e1']);

    expect(relacionIdsDe($fila))->toBe([$s['m1']->id])
        ->and($fila['mantenimiento_csae'])->toBeTrue()
        ->and($fila['cantidad_visitas_csae'])->toBe(1)
        ->and($fila['minutos_estancia_csae_total'])->toBe(23958)
        ->and($fila['salidas_csae_pendientes'])->toBe(0)
        ->and($fila['fecha_hora_csae'])->toBe('17/04/2026 06:18:00')
        ->and($fila['fecha_hora_salida_csae'])->toBe('03/05/2026 21:36:00');
});

it('YA FUNCIONABA XA-AAL: UNA llegada con TRES pares de CSAE los cuenta los tres (uno a muchos)', function () {
    $s = relacionSembrarXaAal();

    $fila = relacionFila(relacionExcel(), $s['e2']);

    expect(relacionIdsDe($fila))->toBe([$s['m2']->id, $s['m3']->id, $s['m4']->id])
        ->and($fila['cantidad_visitas_csae'])->toBe(3)
        ->and($fila['minutos_estancia_csae_total'])->toBe(147920)
        ->and($fila['salidas_csae_pendientes'])->toBe(0)
        ->and($fila['fecha_hora_csae'])->toBe('08/05/2026 06:29:00')
        ->and($fila['fecha_hora_salida_csae'])->toBe('11/05/2026 20:00:00');
});

it('YA FUNCIONABA XA-AAL: una corrida sin salida se cuenta y queda como salida pendiente', function () {
    $s = relacionSembrarXaAal();

    $fila = relacionFila(relacionExcel(), $s['e3']);

    expect(relacionIdsDe($fila))->toBe([$s['m5']->id])
        ->and($fila['cantidad_visitas_csae'])->toBe(1)
        ->and($fila['salidas_csae_pendientes'])->toBe(1)
        ->and($fila['minutos_estancia_csae_total'])->toBe(0)
        ->and($fila['fecha_hora_salida_csae'])->toBeNull()
        ->and($fila['movimientos_csae'][0]['pendiente'])->toBeTrue()
        ->and($fila['movimientos_csae'][0]['minutos_estancia'])->toBeNull();
});

it('YA FUNCIONABA XA-AKC: una corrida de 23 dias dentro de una estancia de cuatro meses', function () {
    $llegada = relacionLlegada('XA-AKC', '2026-05-04 12:00');
    relacionSalida('XA-AKC', '2026-09-07 23:24');
    $movimiento = relacionMovimiento('XA-AKC', '2026-07-29 21:00', '2026-08-21 12:34');

    $fila = relacionFila(relacionExcel(), $llegada);

    expect(relacionIdsDe($fila))->toBe([$movimiento->id])
        ->and($fila['minutos_estancia_csae_total'])->toBe(32614)
        ->and($fila['salidas_csae_pendientes'])->toBe(0);
});

it('YA FUNCIONABA XA-ARC: una llegada sin salida empareja la corrida posterior', function () {
    $llegada = relacionLlegada('XA-ARC', '2026-05-20 12:30');
    $movimiento = relacionMovimiento('XA-ARC', '2026-05-21 00:00', '2026-07-21 02:10');

    $fila = relacionFila(relacionExcel(), $llegada);

    expect(relacionIdsDe($fila))->toBe([$movimiento->id])
        ->and($fila['mantenimiento_csae'])->toBeTrue();
});

it('YA FUNCIONABA N702FL: una corrida registrada un minuto DESPUES de la llegada empareja', function () {
    $llegada = relacionLlegada('N702FL', '2026-05-20 13:00');
    $movimiento = relacionMovimiento('N702FL', '2026-05-20 13:01', '2026-07-15 06:31');

    $fila = relacionFila(relacionExcel(), $llegada);

    expect(relacionIdsDe($fila))->toBe([$movimiento->id]);
});

it('YA FUNCIONABA: una matricula sin corridas no inventa ninguna, y las salidas no llevan corridas propias', function () {
    $llegada = relacionLlegada('XA-SOL', '2026-05-20 10:00');
    $salida = relacionSalida('XA-SOL', '2026-05-21 10:00');

    $excel = relacionExcel();

    relacionEsperaSinCorridas(relacionFila($excel, $llegada));
    relacionEsperaSinCorridas(relacionFila($excel, $salida));
});

it('YA FUNCIONABA: una corrida dada de baja (status N) no cuenta', function () {
    $llegada = relacionLlegada('XA-BAJ', '2026-05-20 10:00');
    relacionMovimiento('XA-BAJ', '2026-05-20 11:00', '2026-05-20 12:00')->update(['status' => 'N']);

    relacionEsperaSinCorridas(relacionFila(relacionExcel(), $llegada));
});

it('YA FUNCIONABA: los siete campos del contrato con el navegador existen en cada fila', function () {
    $llegada = relacionLlegada('XA-CTR', '2026-05-20 10:00');
    relacionMovimiento('XA-CTR', '2026-05-20 11:00', '2026-05-20 12:00');

    $fila = relacionFila(relacionExcel(), $llegada);

    expect(array_keys($fila))->toContain(
        'mantenimiento_csae',
        'fecha_hora_csae',
        'fecha_hora_salida_csae',
        'movimientos_csae',
        'cantidad_visitas_csae',
        'minutos_estancia_csae_total',
        'salidas_csae_pendientes',
    );
    expect(array_keys($fila['movimientos_csae'][0]))->toBe(['id', 'fecha_hora_entrada', 'fecha_hora_salida', 'minutos_estancia', 'pendiente']);
});
