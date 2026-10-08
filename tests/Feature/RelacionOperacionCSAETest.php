<?php

use App\Models\MovimientoCSAE;
use App\Models\OperacionDiaria;
use App\Models\User;
use App\Support\RelacionOperacionCSAE;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
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

// ===========================================================================
// LOS DEFECTOS. Estas pruebas FALLAN con la regla de contencion y pasan con la de solape.
// ===========================================================================

it('DEFECTO N727KB: una corrida registrada un minuto ANTES de la llegada empareja', function () {
    $movimiento = relacionMovimiento('N727KB', '2026-05-20 14:34', '2026-07-07 19:56');
    $llegada = relacionLlegada('N727KB', '2026-05-20 14:35');

    $excel = relacionExcel();
    $fila = relacionFila($excel, $llegada);

    expect(relacionIdsDe($fila))->toBe([$movimiento->id])
        ->and($fila['minutos_estancia_csae_total'])->toBe(69442)
        ->and($excel['huerfanos'])->toBe([]);
});

it('DEFECTO: una corrida cuya salida de CSAE llega DESPUES de la salida de operacion diaria se cuenta', function () {
    $llegada = relacionLlegada('XA-TAR', '2026-06-01 10:00');
    relacionSalida('XA-TAR', '2026-06-05 10:00');
    $movimiento = relacionMovimiento('XA-TAR', '2026-06-04 09:00', '2026-06-06 09:00');

    $excel = relacionExcel();
    $fila = relacionFila($excel, $llegada);

    expect(relacionIdsDe($fila))->toBe([$movimiento->id])
        ->and($fila['minutos_estancia_csae_total'])->toBe(2880)
        ->and($fila['salidas_csae_pendientes'])->toBe(0)
        ->and($excel['huerfanos'])->toBe([]);
});

it('DEFECTO doble conteo: con dos llegadas abiertas la corrida posterior a la segunda sale SOLO bajo la segunda', function () {
    $primera = relacionLlegada('XA-DOB', '2026-03-01 08:00');
    $segunda = relacionLlegada('XA-DOB', '2026-04-01 08:00');
    $movimiento = relacionMovimiento('XA-DOB', '2026-04-02 09:00', '2026-04-03 09:00');

    $excel = relacionExcel();

    expect(relacionIdsDe(relacionFila($excel, $segunda)))->toBe([$movimiento->id]);
    relacionEsperaSinCorridas(relacionFila($excel, $primera));
    expect($excel['huerfanos'])->toBe([]);
});

it('DEFECTO doble conteo: la suma de visitas de todas las estancias es el numero de corridas, ni una de mas', function () {
    relacionLlegada('XA-SUM', '2026-03-01 08:00');
    relacionLlegada('XA-SUM', '2026-04-01 08:00');
    relacionLlegada('XA-SUM', '2026-05-01 08:00');
    relacionMovimiento('XA-SUM', '2026-03-02 09:00', '2026-03-03 09:00');
    relacionMovimiento('XA-SUM', '2026-04-02 09:00', '2026-04-03 09:00');
    relacionMovimiento('XA-SUM', '2026-05-02 09:00');

    $filas = collect(relacionExcel()['operaciones']);

    expect($filas->sum('cantidad_visitas_csae'))->toBe(3)
        ->and($filas->sum('salidas_csae_pendientes'))->toBe(1)
        ->and($filas->sum('minutos_estancia_csae_total'))->toBe(2880);
});

it('DEFECTO doble conteo: una corrida que cruza dos estancias se queda con la de llegada mas reciente', function () {
    $primera = relacionLlegada('XA-CRU', '2026-03-01 08:00');
    relacionSalida('XA-CRU', '2026-03-20 08:00');
    $segunda = relacionLlegada('XA-CRU', '2026-03-10 08:00');
    relacionSalida('XA-CRU', '2026-03-25 08:00');
    $movimiento = relacionMovimiento('XA-CRU', '2026-03-12 08:00', '2026-03-15 08:00');

    $excel = relacionExcel();

    expect(relacionIdsDe(relacionFila($excel, $segunda)))->toBe([$movimiento->id]);
    relacionEsperaSinCorridas(relacionFila($excel, $primera));
});

it('HUERFANOS: las corridas de N113SR y N811GR no tienen operacion diaria y salen aparte', function () {
    $conOperacion = relacionLlegada('XA-ALG', '2026-05-20 10:00');
    $unaMas = relacionMovimiento('XA-ALG', '2026-05-20 11:00', '2026-05-20 12:00');
    $n113 = relacionMovimiento('N113SR', '2026-02-25 06:15', '2026-07-22 10:30');
    $n811 = relacionMovimiento('N811GR', '2026-07-29 20:00', '2026-08-20 21:34');

    $excel = relacionExcel();

    expect(collect($excel['huerfanos'])->pluck('id')->all())->toBe([$n113->id, $n811->id])
        ->and(collect($excel['huerfanos'])->pluck('matricula')->all())->toBe(['N113SR', 'N811GR'])
        ->and(relacionIdsDe(relacionFila($excel, $conOperacion)))->toBe([$unaMas->id]);

    expect($excel['huerfanos'][0])->toBe([
        'id' => $n113->id,
        'matricula' => 'N113SR',
        'fecha_hora_entrada' => '25/02/2026 06:15:00',
        'fecha_hora_salida' => '22/07/2026 10:30:00',
        // Calculado con el reloj de la aplicacion: entre febrero y julio puede haber cambio de horario segun la tzdata.
        'minutos_estancia' => (int) floor(Carbon::parse('2026-02-25 06:15')->diffInSeconds('2026-07-22 10:30') / 60),
        'pendiente' => false,
    ]);
    // No son filas de la tabla principal: sus totales no cambian.
    expect(collect($excel['operaciones'])->pluck('matricula')->all())->not->toContain('N113SR', 'N811GR');
});

it('HUERFANOS: una corrida fuera de toda estancia de una matricula que SI tiene operaciones tampoco casa con nadie', function () {
    $llegada = relacionLlegada('XA-ANT', '2026-05-20 10:00');
    relacionSalida('XA-ANT', '2026-05-22 10:00');
    $vieja = relacionMovimiento('XA-ANT', '2026-01-10 09:00', '2026-01-11 09:00');
    $despues = relacionMovimiento('XA-ANT', '2026-07-10 09:00', '2026-07-11 09:00');

    $excel = relacionExcel();

    relacionEsperaSinCorridas(relacionFila($excel, $llegada));
    expect(collect($excel['huerfanos'])->pluck('id')->all())->toBe([$vieja->id, $despues->id]);
});

it('HUERFANOS: una corrida sin salida de una matricula sin operaciones sale como pendiente', function () {
    $movimiento = relacionMovimiento('N000XX', '2026-09-01 08:00');

    $huerfano = relacionExcel()['huerfanos'][0];

    expect($huerfano['id'])->toBe($movimiento->id)
        ->and($huerfano['pendiente'])->toBeTrue()
        ->and($huerfano['fecha_hora_salida'])->toBeNull()
        ->and($huerfano['minutos_estancia'])->toBeNull();
});

it('HUERFANOS: una corrida dada de baja no sale ni como huerfana', function () {
    relacionMovimiento('N000XX', '2026-09-01 08:00', '2026-09-02 08:00')->update(['status' => 'N']);

    expect(relacionExcel()['huerfanos'])->toBe([]);
});

it('CONTRATO: la respuesta lleva las operaciones en `data` y los huerfanos en `huerfanos_csae`', function () {
    relacionLlegada('XA-CTR', '2026-05-20 10:00');

    $crudo = relacionExcel()['crudo'];

    expect(array_keys($crudo))->toBe(['data', 'huerfanos_csae'])
        ->and($crudo['data'])->toHaveCount(1)
        ->and($crudo['huerfanos_csae'])->toBe([]);
});

// ===========================================================================
// LA FILTRACION: el Excel respeta los filtros de la peticion, pero la estancia mas reciente y el
// cierre de cada estancia se deciden con TODAS las operaciones de la matricula.
// ===========================================================================

it('FILTROS: con un rango de fechas, una estancia sin salida A LA VISTA no se queda las corridas de la siguiente', function () {
    $primera = relacionLlegada('XA-RAN', '2026-05-05 10:00');
    relacionSalida('XA-RAN', '2026-06-03 10:00');
    $segunda = relacionLlegada('XA-RAN', '2026-06-08 10:00');
    $propia = relacionMovimiento('XA-RAN', '2026-05-06 09:00', '2026-05-07 09:00');
    $deLaSiguiente = relacionMovimiento('XA-RAN', '2026-06-10 09:00', '2026-06-11 09:00');

    $excel = relacionExcel(['fechaInicio' => '2026-05-01', 'fechaFin' => '2026-05-31']);

    expect(collect($excel['operaciones'])->pluck('id')->all())->toBe([$primera->id])
        ->and(relacionIdsDe(relacionFila($excel, $primera)))->toBe([$propia->id])
        ->and($excel['huerfanos'])->toBe([]);

    $completo = relacionExcel();
    expect(relacionIdsDe(relacionFila($completo, $segunda)))->toBe([$deLaSiguiente->id]);
});

it('FILTROS: filtrar por tipo llegada no cambia a quien pertenece cada corrida', function () {
    $primera = relacionLlegada('XA-TIP', '2026-05-05 10:00');
    relacionSalida('XA-TIP', '2026-05-10 10:00');
    $segunda = relacionLlegada('XA-TIP', '2026-06-01 10:00');
    $propia = relacionMovimiento('XA-TIP', '2026-05-06 09:00', '2026-05-07 09:00');
    $deLaSegunda = relacionMovimiento('XA-TIP', '2026-06-02 09:00', '2026-06-03 09:00');

    $excel = relacionExcel(['tipo' => 'llegada']);

    expect(relacionIdsDe(relacionFila($excel, $primera)))->toBe([$propia->id])
        ->and(relacionIdsDe(relacionFila($excel, $segunda)))->toBe([$deLaSegunda->id]);
});

it('FILTROS: la busqueda por matricula tambien acota los huerfanos', function () {
    relacionMovimiento('N113SR', '2026-02-25 06:15', '2026-07-22 10:30');
    $n811 = relacionMovimiento('N811GR', '2026-07-29 20:00', '2026-08-20 21:34');

    $excel = relacionExcel(['buscar' => 'N811']);

    expect(collect($excel['huerfanos'])->pluck('id')->all())->toBe([$n811->id]);
});

it('FILTROS: el rango de fechas acota los huerfanos por solape, no por contencion', function () {
    $n113 = relacionMovimiento('N113SR', '2026-02-25 06:15', '2026-07-22 10:30');
    $n811 = relacionMovimiento('N811GR', '2026-07-29 20:00', '2026-08-20 21:34');
    $pendiente = relacionMovimiento('N000XX', '2026-09-01 08:00');

    $enMarzo = relacionExcel(['fechaInicio' => '2026-03-01', 'fechaFin' => '2026-03-31']);
    $enAgosto = relacionExcel(['fechaInicio' => '2026-08-01', 'fechaFin' => '2026-08-31']);
    $unSoloDia = relacionExcel(['fechaInicio' => '2026-09-15']);
    $antes = relacionExcel(['fechaInicio' => '2026-01-01', 'fechaFin' => '2026-02-01']);

    expect(collect($enMarzo['huerfanos'])->pluck('id')->all())->toBe([$n113->id])
        ->and(collect($enAgosto['huerfanos'])->pluck('id')->all())->toBe([$n811->id])
        ->and(collect($unSoloDia['huerfanos'])->pluck('id')->all())->toBe([$pendiente->id])
        ->and($antes['huerfanos'])->toBe([]);
});

it('FILTROS: un filtro que solo tiene una operacion (cliente, tipo, lugar...) no pide ningun huerfano', function (array $filtro) {
    relacionLlegada('XA-FIL', '2026-05-20 10:00', ['tipo_cliente' => 'GENERAL']);
    relacionMovimiento('N113SR', '2026-02-25 06:15', '2026-07-22 10:30');

    expect(relacionExcel($filtro)['huerfanos'])->toBe([]);
})->with([
    'cliente' => [['cliente' => 'GENERAL']],
    'tipo' => [['tipo' => 'llegada']],
    'lugar' => [['lugar' => 'MMTO']],
    'tipo de operacion' => [['tipo_operacion' => 'COMERCIAL']],
    'pax' => [['pax' => 2]],
    'equipaje' => [['eqp' => 0]],
]);

it('FILTROS: una fecha que no se puede leer no revienta el Excel ni inventa huerfanos', function () {
    relacionMovimiento('N113SR', '2026-02-25 06:15', '2026-07-22 10:30');

    expect(relacionExcel(['fechaInicio' => 'no-es-fecha'])['huerfanos'])->toBe([]);
});

// ===========================================================================
// LA CLASE SOLA, sin HTTP. Es la razon de haberla sacado del controlador.
// ===========================================================================

/** Una operacion sin guardar; basta para la clase, que no toca la base de datos. */
function relacionOperacionSuelta(int $id, string $tipo, string $matricula, string $cuando): OperacionDiaria
{
    $momento = Carbon::parse($cuando);

    return (new OperacionDiaria)->forceFill([
        'id' => $id,
        'tipo' => $tipo,
        'matricula' => $matricula,
        'fecha' => $momento->toDateString(),
        'hora' => $momento->format('H:i:s'),
    ]);
}

function relacionMovimientoSuelto(int $id, string $matricula, ?string $entrada, ?string $salida = null): MovimientoCSAE
{
    return (new MovimientoCSAE)->forceFill([
        'id' => $id,
        'matricula' => $matricula,
        'fecha_hora_entrada' => $entrada,
        'fecha_hora_salida' => $salida,
    ]);
}

/**
 * @param  array<int, OperacionDiaria>  $operaciones
 * @param  array<int, MovimientoCSAE>  $movimientos
 * @return array{operaciones: Collection, huerfanos: Collection}
 */
function relacionSuelta(array $operaciones, array $movimientos, ?array $historial = null, ?string $ahora = null): array
{
    return RelacionOperacionCSAE::relacionar(
        collect($operaciones),
        collect($movimientos),
        $historial === null ? null : collect($historial),
        $ahora === null ? null : Carbon::parse($ahora),
    );
}

/**
 * @param  array{operaciones: Collection}  $resultado
 * @return array<int, int>
 */
function relacionIdsEn(array $resultado, int $idOperacion): array
{
    return array_map(
        fn ($visita) => $visita['id'],
        $resultado['operaciones']->firstWhere('id', $idOperacion)->movimientos_csae
    );
}

it('CLASE: una estancia sin salida no tiene techo, aunque la corrida llegue dos anios despues', function () {
    $resultado = relacionSuelta(
        [relacionOperacionSuelta(1, 'llegada', 'XA-SIN', '2026-01-01 10:00')],
        [relacionMovimientoSuelto(10, 'XA-SIN', '2028-01-01 10:00', '2028-01-02 10:00')],
    );

    expect(relacionIdsEn($resultado, 1))->toBe([10])
        ->and($resultado['huerfanos'])->toHaveCount(0);
});

it('CLASE: una estancia CON salida si tiene techo: la corrida que empieza despues de la salida es huerfana', function () {
    $resultado = relacionSuelta(
        [
            relacionOperacionSuelta(1, 'llegada', 'XA-TEC', '2026-01-01 10:00'),
            relacionOperacionSuelta(2, 'salida', 'XA-TEC', '2026-01-02 10:00'),
        ],
        [relacionMovimientoSuelto(10, 'XA-TEC', '2026-01-02 10:01', '2026-01-03 10:00')],
    );

    expect(relacionIdsEn($resultado, 1))->toBe([])
        ->and($resultado['huerfanos']->pluck('id')->all())->toBe([10]);
});

it('CLASE: los extremos cuentan: entrar justo a la hora de la salida, o salir justo a la de la llegada, es solape', function () {
    // Operaciones nuevas en cada llamada: la clase decora los objetos que recibe.
    $operaciones = fn () => [
        relacionOperacionSuelta(1, 'llegada', 'XA-EXT', '2026-01-10 10:00'),
        relacionOperacionSuelta(2, 'salida', 'XA-EXT', '2026-01-20 10:00'),
    ];

    $tocaLaSalida = relacionSuelta($operaciones(), [relacionMovimientoSuelto(10, 'XA-EXT', '2026-01-20 10:00', '2026-01-21 10:00')]);
    $tocaLaLlegada = relacionSuelta($operaciones(), [relacionMovimientoSuelto(11, 'XA-EXT', '2026-01-09 10:00', '2026-01-10 10:00')]);
    $unSegundoDespues = relacionSuelta($operaciones(), [relacionMovimientoSuelto(12, 'XA-EXT', '2026-01-20 10:00:01', '2026-01-21 10:00')]);
    $unSegundoAntes = relacionSuelta($operaciones(), [relacionMovimientoSuelto(13, 'XA-EXT', '2026-01-09 10:00', '2026-01-10 09:59:59')]);

    expect(relacionIdsEn($tocaLaSalida, 1))->toBe([10])
        ->and(relacionIdsEn($tocaLaLlegada, 1))->toBe([11])
        ->and(relacionIdsEn($unSegundoDespues, 1))->toBe([])
        ->and($unSegundoDespues['huerfanos']->pluck('id')->all())->toBe([12])
        ->and(relacionIdsEn($unSegundoAntes, 1))->toBe([])
        ->and($unSegundoAntes['huerfanos']->pluck('id')->all())->toBe([13]);
});

it('CLASE: una corrida sin salida dura hasta `ahora`, y `ahora` se inyecta', function () {
    $operaciones = fn () => [
        relacionOperacionSuelta(1, 'llegada', 'XA-AHO', '2026-03-01 10:00'),
        relacionOperacionSuelta(2, 'salida', 'XA-AHO', '2026-03-05 10:00'),
        relacionOperacionSuelta(3, 'llegada', 'XA-AHO', '2026-06-01 10:00'),
    ];
    $pendiente = [relacionMovimientoSuelto(10, 'XA-AHO', '2026-03-02 10:00')];

    $antesDeLaSegunda = relacionSuelta($operaciones(), $pendiente, ahora: '2026-04-01 10:00');
    $despuesDeLaSegunda = relacionSuelta($operaciones(), $pendiente, ahora: '2026-07-01 10:00');

    expect(relacionIdsEn($antesDeLaSegunda, 1))->toBe([10])
        ->and(relacionIdsEn($antesDeLaSegunda, 3))->toBe([])
        // Todavia corriendo cuando llego la segunda: se la queda la mas reciente.
        ->and(relacionIdsEn($despuesDeLaSegunda, 1))->toBe([])
        ->and(relacionIdsEn($despuesDeLaSegunda, 3))->toBe([10]);
});

it('CLASE: si el historial trae una llegada mas reciente que las filas a decorar, se queda la corrida', function () {
    $visible = fn () => relacionOperacionSuelta(1, 'llegada', 'XA-HIS', '2026-05-05 10:00');
    $fueraDelFiltro = relacionOperacionSuelta(2, 'llegada', 'XA-HIS', '2026-06-08 10:00');
    $corrida = relacionMovimientoSuelto(10, 'XA-HIS', '2026-06-10 09:00', '2026-06-11 09:00');

    $sinHistorial = relacionSuelta([$visible()], [$corrida]);
    $conHistorial = relacionSuelta([$visible()], [$corrida], [$visible(), $fueraDelFiltro]);

    expect(relacionIdsEn($sinHistorial, 1))->toBe([10])
        ->and(relacionIdsEn($conHistorial, 1))->toBe([])
        ->and($conHistorial['huerfanos'])->toHaveCount(0)
        ->and($conHistorial['operaciones'])->toHaveCount(1);
});

it('CLASE: el historial y las filas a decorar se reconocen por id aunque sean instancias distintas', function () {
    $fila = relacionOperacionSuelta(1, 'llegada', 'XA-INS', '2026-05-05 10:00');
    $copia = relacionOperacionSuelta(1, 'llegada', 'XA-INS', '2026-05-05 10:00');
    $corrida = relacionMovimientoSuelto(10, 'XA-INS', '2026-05-06 09:00', '2026-05-07 09:00');

    expect(relacionIdsEn(relacionSuelta([$fila], [$corrida], [$copia]), 1))->toBe([10]);
});

it('CLASE: mayusculas y espacios en la matricula no impiden el emparejamiento', function () {
    $resultado = relacionSuelta(
        [relacionOperacionSuelta(1, 'llegada', ' xa-nor ', '2026-05-05 10:00')],
        [relacionMovimientoSuelto(10, 'XA-NOR', '2026-05-06 09:00', '2026-05-07 09:00')],
    );

    expect(relacionIdsEn($resultado, 1))->toBe([10]);
});

it('CLASE: matriculas distintas no se mezclan', function () {
    $resultado = relacionSuelta(
        [
            relacionOperacionSuelta(1, 'llegada', 'XA-UNO', '2026-05-05 10:00'),
            relacionOperacionSuelta(2, 'llegada', 'XA-DOS', '2026-05-05 10:00'),
        ],
        [relacionMovimientoSuelto(10, 'XA-DOS', '2026-05-06 09:00', '2026-05-07 09:00')],
    );

    expect(relacionIdsEn($resultado, 1))->toBe([])
        ->and(relacionIdsEn($resultado, 2))->toBe([10]);
});

it('CLASE: las corridas de una estancia salen de la mas antigua a la mas reciente, vengan como vengan', function () {
    $resultado = relacionSuelta(
        [relacionOperacionSuelta(1, 'llegada', 'XA-ORD', '2026-05-05 10:00')],
        [
            relacionMovimientoSuelto(12, 'XA-ORD', '2026-05-09 09:00', '2026-05-09 10:00'),
            relacionMovimientoSuelto(10, 'XA-ORD', '2026-05-06 09:00', '2026-05-06 10:00'),
            relacionMovimientoSuelto(11, 'XA-ORD', '2026-05-07 09:00'),
        ],
    );

    $fila = $resultado['operaciones'][0];

    expect(relacionIdsEn($resultado, 1))->toBe([10, 11, 12])
        ->and($fila->fecha_hora_csae)->toBe('06/05/2026 09:00:00')
        ->and($fila->fecha_hora_salida_csae)->toBe('06/05/2026 10:00:00')
        ->and($fila->cantidad_visitas_csae)->toBe(3)
        ->and($fila->minutos_estancia_csae_total)->toBe(120)
        ->and($fila->salidas_csae_pendientes)->toBe(1);
});

it('CLASE: una salida de operacion diaria que llega antes que cualquier llegada no abre estancia', function () {
    $resultado = relacionSuelta(
        [
            relacionOperacionSuelta(1, 'salida', 'XA-SAL', '2026-05-01 10:00'),
            relacionOperacionSuelta(2, 'llegada', 'XA-SAL', '2026-05-10 10:00'),
        ],
        [relacionMovimientoSuelto(10, 'XA-SAL', '2026-05-02 09:00', '2026-05-03 09:00')],
    );

    expect($resultado['huerfanos']->pluck('id')->all())->toBe([10])
        ->and($resultado['operaciones']->firstWhere('id', 1)->mantenimiento_csae)->toBeFalse();
});

it('CLASE: una corrida con la salida ANTES que la entrada es un dato malo pero no rompe nada', function () {
    $resultado = relacionSuelta(
        [relacionOperacionSuelta(1, 'llegada', 'XA-INV', '2026-05-05 10:00')],
        [relacionMovimientoSuelto(10, 'XA-INV', '2026-05-06 09:00', '2026-05-06 08:00')],
    );

    $visita = $resultado['operaciones'][0]->movimientos_csae[0];

    expect($visita['id'])->toBe(10)
        ->and($visita['minutos_estancia'])->toBeNull()
        ->and($visita['pendiente'])->toBeFalse();
});

it('CLASE: una corrida sin fecha de entrada se ignora, ni se asigna ni es huerfana', function () {
    $resultado = relacionSuelta(
        [relacionOperacionSuelta(1, 'llegada', 'XA-NUL', '2026-05-05 10:00')],
        [relacionMovimientoSuelto(10, 'XA-NUL', null)],
    );

    expect($resultado['huerfanos'])->toHaveCount(0)
        ->and($resultado['operaciones'][0]->mantenimiento_csae)->toBeFalse();
});

it('CLASE: sin nada que relacionar devuelve colecciones vacias', function () {
    $resultado = relacionSuelta([], []);

    expect($resultado['operaciones'])->toHaveCount(0)
        ->and($resultado['huerfanos'])->toHaveCount(0);
});

it('CLASE: una salida de operacion diaria con la misma hora que la llegada no la cierra', function () {
    $resultado = relacionSuelta(
        [
            relacionOperacionSuelta(1, 'llegada', 'XA-IGU', '2026-05-05 10:00'),
            relacionOperacionSuelta(2, 'salida', 'XA-IGU', '2026-05-05 10:00'),
        ],
        [relacionMovimientoSuelto(10, 'XA-IGU', '2026-09-01 09:00', '2026-09-02 09:00')],
    );

    expect(relacionIdsEn($resultado, 1))->toBe([10]);
});
