<?php

use App\Models\OperacionDiaria;
use App\Models\User;
use App\Support\VentanasDeFecha;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * El navegador guía con `min`/`max`; el servidor decide. Cada prueba de este fichero es una
 * petición REAL con una fecha fuera de ventana: el estado es 422, el mensaje nombra las dos
 * fechas y no se escribió nada. Un test de la regla suelta no prueba que el endpoint la use.
 */

/**
 * El alta escribe tambien en la base remota (tablas de catalogo de aeronaves); en las pruebas
 * se sustituye por una sqlite en memoria para no tocar nunca la real.
 */
function remotaEnMemoria(): void
{
    config(['database.connections.remota' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
    DB::purge('remota');

    Schema::connection('remota')->create('tb_tipo', function ($tabla) {
        $tabla->increments('id_tipo');
        $tabla->string('tipo');
    });
    Schema::connection('remota')->create('tb_matricula', function ($tabla) {
        $tabla->string('matricula');
        $tabla->integer('id_estatus');
        $tabla->integer('id_tipo');
        $tabla->integer('id_categoria');
        $tabla->integer('id_motor');
        $tabla->integer('id_aterrizaje');
        $tabla->integer('id_transito2h');
        $tabla->integer('id_transito12h');
        $tabla->integer('id_pernocta');
        $tabla->integer('d_vuelos');
    });
}

// Ninguna prueba de este fichero toca la remota real: si una regla se rompiera, el alta seguiria
// y escribiria en `tb_tipo` y `tb_matricula`, que en este proyecto son de solo lectura.
beforeEach(fn () => remotaEnMemoria());

/**
 * Las dos fechas de una ventana, con el formato en que las nombra el mensaje.
 *
 * @return array{min: string, max: string}
 */
function fechasDelMensaje(string $clave): array
{
    $ventana = VentanasDeFecha::para($clave);

    return [
        'min' => Carbon::parse($ventana['min'])->format('d/m/Y'),
        'max' => Carbon::parse($ventana['max'])->format('d/m/Y'),
    ];
}

function mensajeDeFecha($respuesta): string
{
    return $respuesta->json('errors.fecha.0') ?? '';
}

// ---------------------------------------------------------------------------
// Operaciones diarias: POST /api/OperacionesDiarias (llegada y salida)
// ---------------------------------------------------------------------------

function cargaDeOperacion(string $movimiento, string $fecha): array
{
    return [
        'fecha' => $fecha,
        'movimiento' => $movimiento,
        'matricula' => 'XA-VEN',
        'equipo' => 'C172',
        'hora' => '10:30',
        'pax' => 2,
        'departamento' => 'Trafico',
        'procedencia' => $movimiento === 'Llegada' ? 'MMTO' : null,
        'destino' => $movimiento === 'Salida' ? 'MMTO' : null,
    ];
}

it('rechaza con 422 y no escribe una llegada o una salida con fecha fuera de ventana', function (string $clave, string $movimiento, int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $fecha = Carbon::today()->addDays($desplazamiento)->toDateString();
    $antes = OperacionDiaria::count();

    $respuesta = $this->postJson('/api/OperacionesDiarias', cargaDeOperacion($movimiento, $fecha));

    $respuesta->assertUnprocessable()->assertJsonValidationErrors('fecha');
    ['min' => $min, 'max' => $max] = fechasDelMensaje($clave);
    expect(mensajeDeFecha($respuesta))->toContain($min)->toContain($max);
    expect(OperacionDiaria::count())->toBe($antes);
})->with([
    'llegada en el futuro' => ['operaciones.llegada', 'Llegada', 1],
    'llegada demasiado antigua' => ['operaciones.llegada', 'Llegada', -4],
    'salida en el futuro' => ['operaciones.salida', 'Salida', 1],
    'salida demasiado antigua' => ['operaciones.salida', 'Salida', -4],
]);

it('no deja pasar una fecha vacia, ausente o ilegible en el alta', function (?string $fecha, bool $enviarFecha) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = OperacionDiaria::count();
    $carga = cargaDeOperacion('Llegada', (string) $fecha);
    if (! $enviarFecha) {
        unset($carga['fecha']);
    }

    $this->postJson('/api/OperacionesDiarias', $carga)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('fecha');

    expect(OperacionDiaria::count())->toBe($antes);
})->with([
    'vacia' => ['', true],
    'ausente' => [null, false],
    'ilegible' => ['no-es-una-fecha', true],
]);

it('una regla que rechazara todo no pasa: el alta dentro de ventana escribe', function (int $desplazamiento, string $movimiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $fecha = Carbon::today()->addDays($desplazamiento)->toDateString();
    $antes = OperacionDiaria::count();

    $this->postJson('/api/OperacionesDiarias', cargaDeOperacion($movimiento, $fecha))->assertSuccessful();

    expect(OperacionDiaria::count())->toBe($antes + 1);
    expect(OperacionDiaria::latest('id')->first()->fecha->toDateString())->toBe($fecha);
})->with([
    'llegada de hoy' => [0, 'Llegada'],
    'llegada en el borde de atras' => [-3, 'Llegada'],
    'salida de hoy' => [0, 'Salida'],
    'salida en el borde de atras' => [-3, 'Salida'],
]);

it('rechaza una fecha con zona que se guardaria como un dia fuera de ventana, y no escribe', function () {
    // Con zona +14, las 00:30 del dia de manana son todavia «hoy» en Mexico, pero el modelo
    // guarda el dia tal como viene escrito: manana. La regla juzga lo que se guarda.
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $manana = Carbon::today()->addDay()->toDateString();
    $antes = OperacionDiaria::count();

    $this->postJson('/api/OperacionesDiarias', cargaDeOperacion('Llegada', "{$manana}T00:30:00+14:00"))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('fecha');

    expect(OperacionDiaria::count())->toBe($antes);
});

// ---------------------------------------------------------------------------
// Operaciones diarias: PUT /api/OperacionesDiarias/{id} (editar)
// ---------------------------------------------------------------------------

function operacionParaEditar(string $tipo, string $fecha): OperacionDiaria
{
    return OperacionDiaria::create([
        'user_id' => User::factory()->create()->id,
        'fecha' => $fecha,
        'tipo' => $tipo,
        'matricula' => 'XA-EDI',
        'equipo' => 'C172',
        'hora' => '10:30',
        'lugar' => 'MMTO',
        'pax' => 2,
        'departamento' => 'Trafico',
    ]);
}

it('rechaza con 422 y no modifica la fecha de una edicion fuera de ventana', function (string $clave, string $tipo) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = Carbon::today()->toDateString();
    $operacion = operacionParaEditar($tipo, $original);

    $respuesta = $this->putJson("/api/OperacionesDiarias/{$operacion->id}", [
        'matricula' => 'XA-EDI',
        'equipo' => 'C172',
        'hora' => '10:30',
        'pax' => 2,
        'fecha' => Carbon::today()->addDay()->toDateString(),
    ]);

    $respuesta->assertUnprocessable()->assertJsonValidationErrors('fecha');
    ['min' => $min, 'max' => $max] = fechasDelMensaje($clave);
    expect(mensajeDeFecha($respuesta))->toContain($min)->toContain($max);
    expect($operacion->fresh()->fecha->toDateString())->toBe($original);
})->with([
    'llegada' => ['operaciones.llegada', 'llegada'],
    'salida' => ['operaciones.salida', 'salida'],
]);

it('deja corregir otros campos de un registro antiguo si no se toca su fecha', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $operacion = operacionParaEditar('llegada', $antigua);

    $this->putJson("/api/OperacionesDiarias/{$operacion->id}", [
        'matricula' => 'XA-EDI',
        'equipo' => 'C172',
        'hora' => '10:30',
        'procedencia' => 'MMTO',
        'pax' => 5,
        'fecha' => $antigua,
    ])->assertOk();

    expect($operacion->fresh()->pax)->toBe(5);
});

it('no deja pasar de una fecha antigua a OTRA antigua distinta, y la guardada no cambia', function () {
    // La excepcion de `update` solo cubre la fecha SIN cambios; si dejara pasar cualquier
    // fecha vieja, esta edicion colaria una fecha fuera de ventana.
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $operacion = operacionParaEditar('llegada', $antigua);

    $this->putJson("/api/OperacionesDiarias/{$operacion->id}", [
        'matricula' => 'XA-EDI',
        'equipo' => 'C172',
        'hora' => '10:30',
        'procedencia' => 'MMTO',
        'pax' => 2,
        'fecha' => Carbon::today()->subDays(20)->toDateString(),
    ])->assertUnprocessable()->assertJsonValidationErrors('fecha');

    expect($operacion->fresh()->fecha->toDateString())->toBe($antigua);
});

it('no deja que una edicion lleve una fecha ausente o ilegible', function (?string $fecha, bool $enviarFecha) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = Carbon::today()->toDateString();
    $operacion = operacionParaEditar('llegada', $original);
    $carga = [
        'matricula' => 'XA-EDI',
        'equipo' => 'C172',
        'hora' => '10:30',
        'procedencia' => 'MMTO',
        'pax' => 2,
    ];
    if ($enviarFecha) {
        $carga['fecha'] = $fecha;
    }

    $this->putJson("/api/OperacionesDiarias/{$operacion->id}", $carga)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('fecha');

    expect($operacion->fresh()->fecha->toDateString())->toBe($original);
})->with([
    'ausente' => [null, false],
    'ilegible' => ['no-es-una-fecha', true],
]);

it('la edicion tampoco acepta una fecha con zona que se guardaria como manana', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = Carbon::today()->toDateString();
    $operacion = operacionParaEditar('llegada', $original);
    $manana = Carbon::today()->addDay()->toDateString();

    $this->putJson("/api/OperacionesDiarias/{$operacion->id}", [
        'matricula' => 'XA-EDI',
        'equipo' => 'C172',
        'hora' => '10:30',
        'procedencia' => 'MMTO',
        'pax' => 2,
        'fecha' => "{$manana}T00:30:00+14:00",
    ])->assertUnprocessable()->assertJsonValidationErrors('fecha');

    expect($operacion->fresh()->fecha->toDateString())->toBe($original);
});

it('una edicion con una fecha valida de hoy escribe la fecha (la edicion tiene camino feliz)', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $hoy = Carbon::today()->toDateString();
    $operacion = operacionParaEditar('llegada', Carbon::today()->subDays(10)->toDateString());

    $this->putJson("/api/OperacionesDiarias/{$operacion->id}", [
        'matricula' => 'XA-EDI',
        'equipo' => 'C172',
        'hora' => '10:30',
        'procedencia' => 'MMTO',
        'pax' => 2,
        'fecha' => $hoy,
    ])->assertOk();

    expect($operacion->fresh()->fecha->toDateString())->toBe($hoy);
});

it('reenviar la misma fecha en otro formato cuenta como sin cambios', function (string $formato) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $operacion = operacionParaEditar('llegada', $antigua);

    $this->putJson("/api/OperacionesDiarias/{$operacion->id}", [
        'matricula' => 'XA-EDI',
        'equipo' => 'C172',
        'hora' => '10:30',
        'procedencia' => 'MMTO',
        'pax' => 7,
        'fecha' => str_replace('{dia}', $antigua, $formato),
    ])->assertOk();

    expect($operacion->fresh()->pax)->toBe(7);
    expect($operacion->fresh()->fecha->toDateString())->toBe($antigua);
})->with([
    'ISO con Z' => ['{dia}T00:00:00Z'],
    'con hora' => ['{dia} 00:00:00'],
    'ISO con desfase' => ['{dia}T00:00:00-06:00'],
]);

// ---------------------------------------------------------------------------
// El invariante: si la regla acepta un valor, el dia que QUEDA en la columna esta en la ventana
// ---------------------------------------------------------------------------

/**
 * Cadenas hostiles para una fecha: lo que el cast `date` de Eloquent lee distinto de lo que lee
 * `Carbon::parse`. Se construyen con la fecha de hoy para que la prueba no caduque.
 *
 * @return array<string, array{0: mixed}>
 */
function fechasHostiles(): array
{
    $hoy = Carbon::today();
    $ayer = $hoy->copy()->subDay();
    $manana = $hoy->copy()->addDay();
    $antigua = $hoy->copy()->subDays(10);

    return [
        'compacta de hoy (la base la leia como timestamp)' => [$hoy->format('Ymd')],
        'compacta de hoy como numero JSON' => [(int) $hoy->format('Ymd')],
        'solo el anio' => ['2026'],
        'solo el anio, como numero' => [2026],
        'cuatro ceros' => ['0000'],
        'hhmm' => ['1200'],
        'timestamp de ahora' => [(string) $hoy->copy()->setTime(12, 0)->timestamp],
        'timestamp de manana' => [(string) $manana->copy()->setTime(12, 0)->timestamp],
        'timestamp de hace diez dias' => [(string) $antigua->copy()->setTime(12, 0)->timestamp],
        // A las 02:00 UTC el dia de UTC y el de Mexico NO coinciden (en Mexico son las 20:00 del
        // dia anterior). Los timestamps a las 12:00 de Mexico no lo distinguen: sirven igual en
        // las dos zonas, y una rama numerica sin zona pasaria inadvertida.
        'timestamp del borde de atras a las 02:00 UTC' => [(string) Carbon::parse($hoy->copy()->subDays(3)->toDateString().' 02:00:00', 'UTC')->timestamp],
        'timestamp de hace diez dias a las 02:00 UTC' => [(string) Carbon::parse($antigua->toDateString().' 02:00:00', 'UTC')->timestamp],
        'timestamp de manana a las 05:00 UTC' => [(string) Carbon::parse($manana->toDateString().' 05:00:00', 'UTC')->timestamp],
        'timestamp con decimales' => [$hoy->copy()->setTime(12, 0)->timestamp.'.5'],
        'notacion cientifica' => ['1e3'],
        'negativo' => ['-1'],
        'cero' => ['0'],
        'hoy con desfase +14' => [$hoy->toDateString().'T00:30:00+14:00'],
        'manana con desfase +14' => [$manana->toDateString().'T00:30:00+14:00'],
        'hoy con desfase -12' => [$hoy->toDateString().'T23:59:59-12:00'],
        'hoy en UTC' => [$hoy->toDateString().'T12:00:00Z'],
        'manana en UTC' => [$manana->toDateString().'T02:00:00Z'],
        'ayer con hora' => [$ayer->toDateString().' 10:00:00'],
        'hoy con espacios alrededor' => ['  '.$hoy->toDateString().'  '],
        'hoy con mes y dia sin cero' => [$hoy->format('Y-n-j')],
        'dia, mes y anio' => [$hoy->format('d-m-Y')],
        'mes, dia y anio con barras' => [$hoy->format('m/d/Y')],
        'tomorrow' => ['tomorrow'],
        'yesterday' => ['yesterday'],
        'today' => ['today'],
        'now' => ['now'],
        'next monday' => ['next monday'],
        '+1 day' => ['+1 day'],
        '-5 days' => ['-5 days'],
        'last day of next month' => ['last day of next month'],
        'noon tomorrow' => ['noon tomorrow'],
        'basura' => ['no-es-una-fecha'],
        'vacia' => [''],
        'espacio' => [' '],
        'un arreglo' => [['2026-10-07']],
        'un booleano' => [true],
    ];
}

/** Verdadero si el dia esta dentro de la ventana de la clave. */
function enLaVentana(string $dia, string $clave): bool
{
    ['min' => $min, 'max' => $max] = VentanasDeFecha::para($clave);

    return $dia >= $min && $dia <= $max;
}

it('ALTA: lo que la regla deja pasar queda guardado dentro de la ventana, se lea como se lea', function (mixed $valor) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = OperacionDiaria::count();
    $carga = cargaDeOperacion('Llegada', '');
    $carga['fecha'] = $valor;

    $this->postJson('/api/OperacionesDiarias', $carga);

    if (OperacionDiaria::count() === $antes) {
        expect(OperacionDiaria::count())->toBe($antes);

        return;
    }

    $guardado = OperacionDiaria::latest('id')->first()->fecha->toDateString();
    expect(enLaVentana($guardado, 'operaciones.llegada'))
        ->toBeTrue('se guardo '.$guardado.' con la entrada '.json_encode($valor));
})->with(fn () => fechasHostiles());

it('EDICION: lo que la regla deja pasar deja la columna dentro de la ventana, o como estaba', function (mixed $valor, string $partida) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = $partida === 'hoy'
        ? Carbon::today()->toDateString()
        : Carbon::today()->subDays(10)->toDateString();
    $operacion = operacionParaEditar('llegada', $original);

    $this->putJson("/api/OperacionesDiarias/{$operacion->id}", [
        'matricula' => 'XA-EDI',
        'equipo' => 'C172',
        'hora' => '10:30',
        'procedencia' => 'MMTO',
        'pax' => 2,
        'fecha' => $valor,
    ]);

    $guardado = $operacion->fresh()->fecha->toDateString();
    expect($guardado === $original || enLaVentana($guardado, 'operaciones.llegada'))
        ->toBeTrue('de '.$original.' paso a '.$guardado.' con la entrada '.json_encode($valor));
})->with(function () {
    foreach (['hoy', 'antigua'] as $partida) {
        foreach (fechasHostiles() as $nombre => [$valor]) {
            yield "{$partida}: {$nombre}" => [$valor, $partida];
        }
    }
});
