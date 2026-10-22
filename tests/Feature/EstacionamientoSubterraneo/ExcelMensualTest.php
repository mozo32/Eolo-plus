<?php

use App\Models\EstacionamientoSubterraneo;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/*
 * La rejilla mensual del estacionamiento. El módulo NO modela estancias con entrada y
 * salida: `fecha_salida` está en NULL en los 2 961 registros y nadie la escribe. Lo que
 * guarda es una fila por vehículo por cada día que la ronda lo ve, así que un día se
 * marca si existe un registro de esa placa ese día. No hay nada que calcular entre dos
 * fechas.
 */

/**
 * Un registro de ronda. `user_id` es una clave ajena obligatoria, de ahí el usuario.
 */
function registroDeEstacionamiento(string $placas, string $fechaIngreso, array $extra = []): EstacionamientoSubterraneo
{
    return EstacionamientoSubterraneo::create(array_merge([
        'user_id' => User::factory()->create()->id,
        'vehiculo' => 'MAZDA',
        'color' => 'GRIS',
        'placas' => $placas,
        'matricula' => 'EOLO',
        'llaves' => 'NO',
        'responsable' => 'KAREN SUÁREZ',
        'fecha_ingreso' => $fechaIngreso,
        'oficial' => 'Oficial de Turno',
    ], $extra));
}

function consultarRejilla(string $mes): Illuminate\Testing\TestResponse
{
    return test()->getJson("/api/EstacionamientoSubTerraneo/Excel/{$mes}");
}

beforeEach(function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
});

it('rechaza a un invitado', function () {
    // El beforeEach autentica, así que esta prueba cierra la sesión para comprobar el
    // candado de verdad. La ruta vive dentro del grupo auth:sanctum; si alguien la
    // sacara de ahí, los datos de un mes entero quedarían públicos y nada fallaría.
    auth('sanctum')->forgetUser();
    app('auth')->forgetGuards();

    test()->getJson('/api/EstacionamientoSubTerraneo/Excel/2026-09')
        ->assertUnauthorized();
});

it('una placa con varios registros el mismo día cuenta un solo día', function () {
    // De los 2 491 pares (placa, día) del histórico, 469 tienen más de un registro. Si
    // la celda contara filas en vez de marcar presencia, los totales saldrían inflados.
    registroDeEstacionamiento('ABC-123', '2026-09-03 08:00:00');
    registroDeEstacionamiento('ABC-123', '2026-09-03 20:00:00');

    $filas = consultarRejilla('2026-09')->assertOk()->json('filas');

    expect($filas)->toHaveCount(1)
        ->and($filas[0]['dias'])->toBe([3])
        ->and($filas[0]['total'])->toBe(1);
});

it('una placa cuyo vehículo cambió entre días sale en UNA fila, no en dos', function () {
    // Es el defecto medido de show(), que agrupa por (placas, vehiculo, matricula) y en
    // marzo devuelve 202 filas donde hay 145 coches. Esta prueba falla si alguien
    // "simplifica" este agrupamiento al de allá.
    registroDeEstacionamiento('ABC-123', '2026-09-03 08:00:00', ['vehiculo' => 'MAZDA']);
    registroDeEstacionamiento('ABC-123', '2026-09-04 08:00:00', ['vehiculo' => 'MAZDA 3']);

    $filas = consultarRejilla('2026-09')->assertOk()->json('filas');

    expect($filas)->toHaveCount(1)
        ->and($filas[0]['dias'])->toBe([3, 4])
        ->and($filas[0]['total'])->toBe(2);
});

it('los cinco datos de identificación salen del registro más reciente del mes', function () {
    // El orden de inserción es deliberado: el registro más reciente (09-20) se crea
    // PRIMERO y por tanto tiene el id menor. Si el orden de creación coincidiera con el de
    // fecha, quitar `orderBy('fecha_ingreso')` y dejar solo `orderBy('id')` no cambiaría
    // el resultado y esta prueba no mordería.
    registroDeEstacionamiento('ABC-123', '2026-09-20 08:00:00', [
        'vehiculo' => 'NUEVO',
        'color' => 'NUEVO',
        'matricula' => 'NUEVO',
        'responsable' => 'NUEVO',
    ]);
    registroDeEstacionamiento('ABC-123', '2026-09-03 08:00:00', [
        'vehiculo' => 'VIEJO',
        'color' => 'VIEJO',
        'matricula' => 'VIEJO',
        'responsable' => 'VIEJO',
    ]);

    $fila = consultarRejilla('2026-09')->assertOk()->json('filas.0');

    expect($fila['vehiculo'])->toBe('NUEVO')
        ->and($fila['color'])->toBe('NUEVO')
        ->and($fila['matricula'])->toBe('NUEVO')
        ->and($fila['responsable'])->toBe('NUEVO');
});

it('la consulta pide explícitamente el orden por fecha y por id', function () {
    // Esta prueba mira el SQL y no el resultado, a propósito, y conviene saber por qué.
    //
    // La tabla tiene índice en `fecha_ingreso`, así que sqlite resuelve el
    // `whereBetween` recorriendo ese índice y devuelve las filas YA en orden de
    // (fecha_ingreso, rowid) — exactamente el orden que piden los dos `orderBy`. Quitar
    // las cláusulas no cambia la respuesta, y por eso NINGUNA prueba de comportamiento
    // puede verlas: se intentó con los registros insertados al revés y siguió en verde.
    //
    // Pero el orden decide de qué registro salen las cinco columnas de identificación, y
    // en MySQL depende del plan que elija el motor. Pinchar el SQL es lo único que se
    // pone en rojo si alguien borra las cláusulas por limpieza.
    registroDeEstacionamiento('ABC-123', '2026-09-10 08:00:00');

    $consultas = [];
    DB::listen(function ($consulta) use (&$consultas) {
        $consultas[] = $consulta->sql;
    });

    consultarRejilla('2026-09')->assertOk();

    $sqlDeLaTabla = collect($consultas)
        ->first(fn (string $sql) => str_contains($sql, 'estacionamiento_subterraneos'));

    // Sin comillas, para no depender de si el motor las pone dobles o invertidas.
    $normalizado = str_replace(['"', '`'], '', (string) $sqlDeLaTabla);

    expect($normalizado)->toContain('order by fecha_ingreso asc, id asc');
});

it('los días salen ascendentes y sin repetir, y el total cuadra con su longitud', function () {
    // Se insertan desordenados a propósito: si el endpoint devolviera el orden de
    // inserción, esta prueba lo vería.
    registroDeEstacionamiento('ABC-123', '2026-09-20 08:00:00');
    registroDeEstacionamiento('ABC-123', '2026-09-03 08:00:00');
    registroDeEstacionamiento('ABC-123', '2026-09-11 08:00:00');
    registroDeEstacionamiento('ABC-123', '2026-09-03 19:00:00');

    $fila = consultarRejilla('2026-09')->assertOk()->json('filas.0');

    expect($fila['dias'])->toBe([3, 11, 20])
        ->and($fila['total'])->toBe(3);
});

it('solo entran los registros del mes pedido', function () {
    // Incluido el último día del mes anterior y el primero del siguiente, que es donde
    // un filtro mal puesto se cuela.
    registroDeEstacionamiento('ABC-123', '2026-08-31 23:59:00');
    registroDeEstacionamiento('ABC-123', '2026-09-15 08:00:00');
    registroDeEstacionamiento('ABC-123', '2026-10-01 00:00:00');

    $fila = consultarRejilla('2026-09')->assertOk()->json('filas.0');

    expect($fila['dias'])->toBe([15]);
});

it('toma los registros de los bordes del propio mes', function () {
    registroDeEstacionamiento('ABC-123', '2026-09-01 00:00:00');
    registroDeEstacionamiento('ABC-123', '2026-09-30 23:59:59');

    $fila = consultarRejilla('2026-09')->assertOk()->json('filas.0');

    expect($fila['dias'])->toBe([1, 30]);
});

it('el número de días es el del calendario, no uno fijo', function () {
    // Sin esto la rejilla podría quedarse corta de columnas en los meses de 31.
    registroDeEstacionamiento('ABC-123', '2026-02-10 08:00:00');
    registroDeEstacionamiento('XYZ-999', '2026-07-10 08:00:00');

    expect(consultarRejilla('2026-02')->assertOk()->json('dias'))->toBe(28);
    expect(consultarRejilla('2026-07')->assertOk()->json('dias'))->toBe(31);
});

it('devuelve el mes que se pidió', function () {
    registroDeEstacionamiento('ABC-123', '2026-09-10 08:00:00');

    expect(consultarRejilla('2026-09')->assertOk()->json('mes'))->toBe('2026-09');
});

it('un mes sin registros devuelve 200 con la lista vacía, no un 404', function () {
    registroDeEstacionamiento('ABC-123', '2026-09-10 08:00:00');

    $respuesta = consultarRejilla('2026-06')->assertOk();

    expect($respuesta->json('filas'))->toBe([])
        ->and($respuesta->json('dias'))->toBe(30);
});

it('las placas se agrupan normalizadas', function () {
    // Hoy no hay variantes de caja en los datos: 479 placas distintas tal cual, 479 en
    // UPPER y 479 en UPPER(TRIM). Esta prueba es el único sitio donde la regla queda
    // fijada, precisamente porque los datos no la ejercen.
    registroDeEstacionamiento('abc-123', '2026-09-03 08:00:00');
    registroDeEstacionamiento(' ABC-123 ', '2026-09-04 08:00:00');

    $filas = consultarRejilla('2026-09')->assertOk()->json('filas');

    expect($filas)->toHaveCount(1)
        ->and($filas[0]['placas'])->toBe('ABC-123')
        ->and($filas[0]['dias'])->toBe([3, 4]);
});

it('las filas salen ordenadas por placas', function () {
    registroDeEstacionamiento('ZZZ-999', '2026-09-03 08:00:00');
    registroDeEstacionamiento('AAA-111', '2026-09-03 08:00:00');
    registroDeEstacionamiento('MMM-555', '2026-09-03 08:00:00');

    $placas = collect(consultarRejilla('2026-09')->assertOk()->json('filas'))
        ->pluck('placas')
        ->all();

    expect($placas)->toBe(['AAA-111', 'MMM-555', 'ZZZ-999']);
});

it('cada fila trae las siete claves del contrato', function () {
    // El servicio de Excel del cliente lee estas claves por nombre; si cambian aquí,
    // las columnas salen vacías sin que nada falle.
    registroDeEstacionamiento('ABC-123', '2026-09-03 08:00:00');

    $fila = consultarRejilla('2026-09')->assertOk()->json('filas.0');

    expect(array_keys($fila))->toBe([
        'placas',
        'vehiculo',
        'color',
        'matricula',
        'responsable',
        'dias',
        'total',
    ]);
});

it('rechaza un mes mal formado', function () {
    consultarRejilla('2026-13')
        ->assertUnprocessable()
        ->assertJsonValidationErrors('mes');
});

it('rechaza un mes que no es un mes', function () {
    consultarRejilla('septiembre')
        ->assertUnprocessable()
        ->assertJsonValidationErrors('mes');
});
