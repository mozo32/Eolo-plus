<?php

use App\Models\ChecklistTurno;
use App\Models\ControlMedicamento;
use App\Models\Departamento;
use App\Models\OperacionDiaria;
use App\Models\PrestamoChaleco;
use App\Models\ServicioComisariato;
use App\Models\User;
use App\Support\VentanasDeFecha;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

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
    // El alta de Comisariato consulta estas dos tablas antes de dar de alta la matricula.
    Schema::connection('remota')->create('tb_estatus', function ($tabla) {
        $tabla->increments('id_estatus');
        $tabla->string('estatus');
    });
    Schema::connection('remota')->create('tb_categoria', function ($tabla) {
        $tabla->increments('id_categoria');
        $tabla->string('categoria');
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

function mensajeDeFecha($respuesta, string $campo = 'fecha'): string
{
    return $respuesta->json("errors.{$campo}.0") ?? '';
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

// ===========================================================================
// Trafico, el resto: checklist de turno, prestamo de chalecos, servicio de
// comisariato y control de medicamentos
// ===========================================================================

/**
 * Las cadenas hostiles de `fechasHostiles()`, repetidas para dos partidas de una edicion: un
 * registro cuya fecha esta HOY (dentro de la ventana) y otro con una fecha antigua (fuera).
 *
 * @return iterable<string, array{0: mixed, 1: string}>
 */
function hostilesPorPartida(): iterable
{
    foreach (['hoy', 'antigua'] as $partida) {
        foreach (fechasHostiles() as $nombre => [$valor]) {
            yield "{$partida}: {$nombre}" => [$valor, $partida];
        }
    }
}

/** La fecha con la que arranca un registro que se va a editar. */
function fechaDePartida(string $partida): string
{
    return $partida === 'hoy'
        ? Carbon::today()->toDateString()
        : Carbon::today()->subDays(10)->toDateString();
}

// ---------------------------------------------------------------------------
// Checklist de turno: POST /api/CheckListTurno, PUT /api/CheckListTurno/{id} y
// PUT /api/CheckListTurno/aprobar/{id} (tres puertas para una sola pantalla)
// ---------------------------------------------------------------------------

/** @return array<string, mixed> */
function cargaDeChecklist(mixed $fecha): array
{
    return ['nombreEmpleado' => 'Ana Prueba', 'fecha' => $fecha];
}

/**
 * Lo que mandan la edicion y la aprobacion: la aprobacion lee sin `??` tres de estos campos.
 *
 * @return array<string, mixed>
 */
function cargaDeEdicionDeChecklist(mixed $fecha, string $nombre = 'Ana Prueba'): array
{
    return [
        'nombreEmpleado' => $nombre,
        'fecha' => $fecha,
        'recibeTurnoCon' => [],
        'revisionSalas' => [],
        'entregaTurnoCon' => [],
    ];
}

function checklistParaEditar(string $fecha): ChecklistTurno
{
    return ChecklistTurno::create([
        'nombre_empleado' => 'Original',
        'fecha' => $fecha,
        'recibe_turno_con' => [],
        'revision_salas' => [],
        'entrega_turno_con' => [],
        'cantidad_pasajeros' => 0,
        'cantidad_operaciones' => 0,
    ]);
}

/** La edicion tiene dos puertas: `update` (PUT /{id}) y `aprobarTurno` (PUT /aprobar/{id}). */
function urlDeEdicionDeChecklist(string $puerta, int $id): string
{
    return $puerta === 'aprobar' ? "/api/CheckListTurno/aprobar/{$id}" : "/api/CheckListTurno/{$id}";
}

it('CHECKLIST alta: rechaza con 422 y no escribe una fecha fuera de ventana', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = ChecklistTurno::count();

    $respuesta = $this->postJson('/api/CheckListTurno', cargaDeChecklist(Carbon::today()->addDays($desplazamiento)->toDateString()));

    $respuesta->assertUnprocessable()->assertJsonValidationErrors('fecha');
    ['min' => $min, 'max' => $max] = fechasDelMensaje('turno.checklist');
    expect(mensajeDeFecha($respuesta))->toContain($min)->toContain($max);
    expect(ChecklistTurno::count())->toBe($antes);
})->with([
    'en el futuro' => [1],
    'demasiado antigua' => [-2],
]);

it('CHECKLIST alta: no deja pasar una fecha vacia, ausente o ilegible', function (?string $fecha, bool $enviarFecha) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = ChecklistTurno::count();
    $carga = cargaDeChecklist($fecha);
    if (! $enviarFecha) {
        unset($carga['fecha']);
    }

    $this->postJson('/api/CheckListTurno', $carga)->assertUnprocessable()->assertJsonValidationErrors('fecha');

    expect(ChecklistTurno::count())->toBe($antes);
})->with([
    'vacia' => ['', true],
    'ausente' => [null, false],
    'ilegible' => ['no-es-una-fecha', true],
]);

it('CHECKLIST alta: una fecha dentro de ventana escribe (la regla no rechaza todo)', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $fecha = Carbon::today()->addDays($desplazamiento)->toDateString();
    $antes = ChecklistTurno::count();

    $this->postJson('/api/CheckListTurno', cargaDeChecklist($fecha))->assertCreated();

    expect(ChecklistTurno::count())->toBe($antes + 1);
    expect(ChecklistTurno::latest('id')->first()->fecha->toDateString())->toBe($fecha);
})->with([
    'hoy' => [0],
    'el borde de atras (ayer)' => [-1],
]);

it('CHECKLIST edicion: rechaza con 422 y no modifica la fecha, por las dos puertas', function (string $puerta, int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = Carbon::today()->toDateString();
    $checklist = checklistParaEditar($original);

    $respuesta = $this->putJson(
        urlDeEdicionDeChecklist($puerta, $checklist->id),
        cargaDeEdicionDeChecklist(Carbon::today()->addDays($desplazamiento)->toDateString(), 'Cambiado'),
    );

    $respuesta->assertUnprocessable()->assertJsonValidationErrors('fecha');
    ['min' => $min, 'max' => $max] = fechasDelMensaje('turno.checklist');
    expect(mensajeDeFecha($respuesta))->toContain($min)->toContain($max);
    expect($checklist->fresh()->fecha->toDateString())->toBe($original);
    expect($checklist->fresh()->nombre_empleado)->toBe('Original');
})->with([
    'actualizar, futuro' => ['actualizar', 1],
    'actualizar, antigua' => ['actualizar', -2],
    'aprobar, futuro' => ['aprobar', 1],
    'aprobar, antigua' => ['aprobar', -2],
]);

it('CHECKLIST edicion: deja corregir otros campos de un registro antiguo si no se toca su fecha', function (string $puerta) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $checklist = checklistParaEditar($antigua);

    $this->putJson(urlDeEdicionDeChecklist($puerta, $checklist->id), cargaDeEdicionDeChecklist($antigua, 'Corregido'))->assertOk();

    expect($checklist->fresh()->nombre_empleado)->toBe('Corregido');
    expect($checklist->fresh()->fecha->toDateString())->toBe($antigua);
})->with(['actualizar', 'aprobar']);

it('CHECKLIST edicion: no deja pasar de una fecha antigua a OTRA antigua distinta', function (string $puerta) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $checklist = checklistParaEditar($antigua);

    $this->putJson(
        urlDeEdicionDeChecklist($puerta, $checklist->id),
        cargaDeEdicionDeChecklist(Carbon::today()->subDays(20)->toDateString()),
    )->assertUnprocessable()->assertJsonValidationErrors('fecha');

    expect($checklist->fresh()->fecha->toDateString())->toBe($antigua);
})->with(['actualizar', 'aprobar']);

it('CHECKLIST edicion: no deja que lleve una fecha ausente o ilegible', function (string $puerta, ?string $fecha, bool $enviarFecha) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = Carbon::today()->toDateString();
    $checklist = checklistParaEditar($original);
    $carga = cargaDeEdicionDeChecklist($fecha);
    if (! $enviarFecha) {
        unset($carga['fecha']);
    }

    $this->putJson(urlDeEdicionDeChecklist($puerta, $checklist->id), $carga)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('fecha');

    expect($checklist->fresh()->fecha->toDateString())->toBe($original);
})->with(function () {
    foreach (['actualizar', 'aprobar'] as $puerta) {
        yield "{$puerta}, ausente" => [$puerta, null, false];
        yield "{$puerta}, ilegible" => [$puerta, 'no-es-una-fecha', true];
    }
});

it('CHECKLIST edicion: una fecha valida de hoy escribe la fecha (la edicion tiene camino feliz)', function (string $puerta) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $hoy = Carbon::today()->toDateString();
    $checklist = checklistParaEditar(Carbon::today()->subDays(10)->toDateString());

    $this->putJson(urlDeEdicionDeChecklist($puerta, $checklist->id), cargaDeEdicionDeChecklist($hoy))->assertOk();

    expect($checklist->fresh()->fecha->toDateString())->toBe($hoy);
})->with(['actualizar', 'aprobar']);

it('CHECKLIST edicion: reenviar la misma fecha en otro formato cuenta como sin cambios', function (string $puerta, string $formato) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $checklist = checklistParaEditar($antigua);

    $this->putJson(
        urlDeEdicionDeChecklist($puerta, $checklist->id),
        cargaDeEdicionDeChecklist(str_replace('{dia}', $antigua, $formato), 'Corregido'),
    )->assertOk();

    expect($checklist->fresh()->nombre_empleado)->toBe('Corregido');
    expect($checklist->fresh()->fecha->toDateString())->toBe($antigua);
})->with(function () {
    foreach (['actualizar', 'aprobar'] as $puerta) {
        yield "{$puerta}, con hora" => [$puerta, '{dia} 00:00:00'];
        yield "{$puerta}, ISO con Z" => [$puerta, '{dia}T00:00:00Z'];
    }
});

it('CHECKLIST ALTA: lo que la regla deja pasar queda guardado dentro de la ventana, se lea como se lea', function (mixed $valor) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = ChecklistTurno::count();

    $this->postJson('/api/CheckListTurno', cargaDeChecklist($valor));

    if (ChecklistTurno::count() === $antes) {
        expect(ChecklistTurno::count())->toBe($antes);

        return;
    }

    $guardado = ChecklistTurno::latest('id')->first()->fecha->toDateString();
    expect(enLaVentana($guardado, 'turno.checklist'))
        ->toBeTrue('se guardo '.$guardado.' con la entrada '.json_encode($valor));
})->with(fn () => fechasHostiles());

it('CHECKLIST EDICION: lo que la regla deja pasar deja la columna dentro de la ventana, o como estaba, por las dos puertas', function (string $puerta, mixed $valor, string $partida) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = fechaDePartida($partida);
    $checklist = checklistParaEditar($original);

    $this->putJson(urlDeEdicionDeChecklist($puerta, $checklist->id), cargaDeEdicionDeChecklist($valor));

    $guardado = $checklist->fresh()->fecha->toDateString();
    expect($guardado === $original || enLaVentana($guardado, 'turno.checklist'))
        ->toBeTrue('de '.$original.' paso a '.$guardado.' con la entrada '.json_encode($valor));
})->with(function () {
    foreach (['actualizar', 'aprobar'] as $puerta) {
        foreach (hostilesPorPartida() as $nombre => [$valor, $partida]) {
            yield "{$puerta}, {$nombre}" => [$puerta, $valor, $partida];
        }
    }
});

// ---------------------------------------------------------------------------
// Prestamo de chalecos: POST /api/PrestamoChalecos (solo alta; `fecha` va con date_format)
// ---------------------------------------------------------------------------

function entregaDeTraficoParaChalecos(): User
{
    $usuario = User::factory()->create();
    $usuario->departamentos()->attach(Departamento::firstOrCreate(['nombre' => 'Trafico'])->id, ['status' => 'A']);

    return $usuario;
}

/** @return array<string, mixed> */
function cargaDePrestamoChaleco(mixed $fecha): array
{
    return [
        'fecha' => $fecha,
        'nombre_recibe' => 'Visitante de prueba',
        'usuario_entrega_id' => entregaDeTraficoParaChalecos()->id,
        'foto_ine' => UploadedFile::fake()->image('ine.jpg'),
    ];
}

it('CHALECOS alta: rechaza con 422 y no escribe una fecha fuera de ventana', function (int $desplazamiento) {
    Storage::fake('local');
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = PrestamoChaleco::count();

    $respuesta = $this->post(
        '/api/PrestamoChalecos',
        cargaDePrestamoChaleco(Carbon::today()->addDays($desplazamiento)->toDateString()),
        ['Accept' => 'application/json'],
    );

    $respuesta->assertUnprocessable()->assertJsonValidationErrors('fecha');
    ['min' => $min, 'max' => $max] = fechasDelMensaje('chalecos.prestamo');
    expect(mensajeDeFecha($respuesta))->toContain($min)->toContain($max);
    expect(PrestamoChaleco::count())->toBe($antes);
    expect(Storage::disk('local')->allFiles())->toBeEmpty();
})->with([
    'en el futuro' => [1],
    'demasiado antigua' => [-2],
]);

it('CHALECOS alta: no deja pasar una fecha vacia, ausente o ilegible', function (?string $fecha, bool $enviarFecha) {
    Storage::fake('local');
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = PrestamoChaleco::count();
    $carga = cargaDePrestamoChaleco($fecha);
    if (! $enviarFecha) {
        unset($carga['fecha']);
    }

    $this->post('/api/PrestamoChalecos', $carga, ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('fecha');

    expect(PrestamoChaleco::count())->toBe($antes);
})->with([
    'vacia' => ['', true],
    'ausente' => [null, false],
    'ilegible' => ['no-es-una-fecha', true],
]);

it('CHALECOS alta: sigue exigiendo date_format:Y-m-d, no se sustituyo por date', function (string $formato) {
    // Cualquiera de estas se lee como el dia de hoy con `date`, pero no es `Y-m-d`.
    Storage::fake('local');
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = PrestamoChaleco::count();

    $this->post(
        '/api/PrestamoChalecos',
        cargaDePrestamoChaleco(Carbon::today()->format($formato)),
        ['Accept' => 'application/json'],
    )->assertUnprocessable()->assertJsonValidationErrors('fecha');

    expect(PrestamoChaleco::count())->toBe($antes);
})->with([
    'dia, mes y anio' => ['d/m/Y'],
    'con hora' => ['Y-m-d H:i:s'],
    'ISO con zona' => ['Y-m-d\TH:i:sP'],
    'sin ceros' => ['Y-n-j'],
]);

it('CHALECOS alta: una fecha dentro de ventana escribe (la regla no rechaza todo)', function (int $desplazamiento) {
    Storage::fake('local');
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $fecha = Carbon::today()->addDays($desplazamiento)->toDateString();
    $antes = PrestamoChaleco::count();

    $this->post('/api/PrestamoChalecos', cargaDePrestamoChaleco($fecha), ['Accept' => 'application/json'])->assertCreated();

    expect(PrestamoChaleco::count())->toBe($antes + 1);
    expect(PrestamoChaleco::latest('id')->first()->fecha->toDateString())->toBe($fecha);
})->with([
    'hoy' => [0],
    'el borde de atras (ayer)' => [-1],
]);

it('CHALECOS ALTA: lo que la regla deja pasar queda guardado dentro de la ventana, se lea como se lea', function (mixed $valor) {
    Storage::fake('local');
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = PrestamoChaleco::count();

    $this->post('/api/PrestamoChalecos', cargaDePrestamoChaleco($valor), ['Accept' => 'application/json']);

    if (PrestamoChaleco::count() === $antes) {
        expect(PrestamoChaleco::count())->toBe($antes);

        return;
    }

    $guardado = PrestamoChaleco::latest('id')->first()->fecha->toDateString();
    expect(enLaVentana($guardado, 'chalecos.prestamo'))
        ->toBeTrue('se guardo '.$guardado.' con la entrada '.json_encode($valor));
})->with(fn () => fechasHostiles());

// ---------------------------------------------------------------------------
// Servicio de comisariato: POST /api/ServicioComisariato y PUT /api/ServicioComisariato/{id}
// (el campo se llama `fechaEntrega`, no `fecha`)
// ---------------------------------------------------------------------------

/** @return array<string, mixed> */
function cargaDeComisariato(mixed $fechaEntrega, string $catering = 'Catering Uno'): array
{
    return [
        'catering' => $catering,
        'fechaEntrega' => $fechaEntrega,
        'horaEntrega' => '10:30',
        'matricula' => 'XA-COM',
        'subtotal' => 100,
        'total' => 116,
    ];
}

function comisariatoParaEditar(string $fecha): ServicioComisariato
{
    return ServicioComisariato::create([
        'user_id' => User::factory()->create()->id,
        'catering' => 'Original',
        'fecha_entrega' => $fecha,
        'hora_entrega' => '10:30',
        'matricula' => 'XA-COM',
        'subtotal' => 100,
        'total' => 116,
    ]);
}

it('COMISARIATO alta: rechaza con 422 y no escribe una fecha de entrega fuera de ventana', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = ServicioComisariato::count();

    $respuesta = $this->postJson('/api/ServicioComisariato', cargaDeComisariato(Carbon::today()->addDays($desplazamiento)->toDateString()));

    $respuesta->assertUnprocessable()->assertJsonValidationErrors('fechaEntrega');
    ['min' => $min, 'max' => $max] = fechasDelMensaje('comisariato.entrega');
    expect(mensajeDeFecha($respuesta, 'fechaEntrega'))->toContain($min)->toContain($max);
    expect(ServicioComisariato::count())->toBe($antes);
    // Tampoco se dio de alta la matricula en la base remota: la validacion corta antes.
    expect(DB::connection('remota')->table('tb_matricula')->count())->toBe(0);
})->with([
    'en el futuro' => [1],
    'demasiado antigua' => [-4],
]);

it('COMISARIATO alta: no deja pasar una fecha vacia, ausente o ilegible', function (?string $fecha, bool $enviarFecha) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = ServicioComisariato::count();
    $carga = cargaDeComisariato($fecha);
    if (! $enviarFecha) {
        unset($carga['fechaEntrega']);
    }

    $this->postJson('/api/ServicioComisariato', $carga)->assertUnprocessable()->assertJsonValidationErrors('fechaEntrega');

    expect(ServicioComisariato::count())->toBe($antes);
})->with([
    'vacia' => ['', true],
    'ausente' => [null, false],
    'ilegible' => ['no-es-una-fecha', true],
]);

it('COMISARIATO alta: una fecha dentro de ventana escribe (la regla no rechaza todo)', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $fecha = Carbon::today()->addDays($desplazamiento)->toDateString();
    $antes = ServicioComisariato::count();

    $this->postJson('/api/ServicioComisariato', cargaDeComisariato($fecha))->assertCreated();

    expect(ServicioComisariato::count())->toBe($antes + 1);
    expect(ServicioComisariato::latest('id')->first()->fecha_entrega->toDateString())->toBe($fecha);
})->with([
    'hoy' => [0],
    'el borde de atras' => [-3],
]);

it('COMISARIATO edicion: rechaza con 422 y no modifica la fecha de una edicion fuera de ventana', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = Carbon::today()->toDateString();
    $servicio = comisariatoParaEditar($original);

    $respuesta = $this->putJson(
        "/api/ServicioComisariato/{$servicio->id}",
        cargaDeComisariato(Carbon::today()->addDays($desplazamiento)->toDateString(), 'Cambiado'),
    );

    $respuesta->assertUnprocessable()->assertJsonValidationErrors('fechaEntrega');
    ['min' => $min, 'max' => $max] = fechasDelMensaje('comisariato.entrega');
    expect(mensajeDeFecha($respuesta, 'fechaEntrega'))->toContain($min)->toContain($max);
    expect($servicio->fresh()->fecha_entrega->toDateString())->toBe($original);
    expect($servicio->fresh()->catering)->toBe('Original');
})->with([
    'futuro' => [1],
    'antigua' => [-4],
]);

it('COMISARIATO edicion: deja corregir otros campos de un registro antiguo si no se toca su fecha', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $servicio = comisariatoParaEditar($antigua);

    $this->putJson("/api/ServicioComisariato/{$servicio->id}", cargaDeComisariato($antigua, 'Corregido'))->assertOk();

    expect($servicio->fresh()->catering)->toBe('Corregido');
    expect($servicio->fresh()->fecha_entrega->toDateString())->toBe($antigua);
});

it('COMISARIATO edicion: no deja pasar de una fecha antigua a OTRA antigua distinta', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $servicio = comisariatoParaEditar($antigua);

    $this->putJson("/api/ServicioComisariato/{$servicio->id}", cargaDeComisariato(Carbon::today()->subDays(20)->toDateString()))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('fechaEntrega');

    expect($servicio->fresh()->fecha_entrega->toDateString())->toBe($antigua);
});

it('COMISARIATO edicion: no deja que lleve una fecha ausente o ilegible', function (?string $fecha, bool $enviarFecha) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = Carbon::today()->toDateString();
    $servicio = comisariatoParaEditar($original);
    $carga = cargaDeComisariato($fecha);
    if (! $enviarFecha) {
        unset($carga['fechaEntrega']);
    }

    $this->putJson("/api/ServicioComisariato/{$servicio->id}", $carga)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('fechaEntrega');

    expect($servicio->fresh()->fecha_entrega->toDateString())->toBe($original);
})->with([
    'ausente' => [null, false],
    'ilegible' => ['no-es-una-fecha', true],
]);

it('COMISARIATO edicion: una fecha valida de hoy escribe la fecha (la edicion tiene camino feliz)', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $hoy = Carbon::today()->toDateString();
    $servicio = comisariatoParaEditar(Carbon::today()->subDays(10)->toDateString());

    $this->putJson("/api/ServicioComisariato/{$servicio->id}", cargaDeComisariato($hoy))->assertOk();

    expect($servicio->fresh()->fecha_entrega->toDateString())->toBe($hoy);
});

it('COMISARIATO edicion: reenviar la misma fecha en otro formato cuenta como sin cambios', function (string $formato) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $servicio = comisariatoParaEditar($antigua);

    $this->putJson("/api/ServicioComisariato/{$servicio->id}", cargaDeComisariato(str_replace('{dia}', $antigua, $formato), 'Corregido'))->assertOk();

    expect($servicio->fresh()->catering)->toBe('Corregido');
    expect($servicio->fresh()->fecha_entrega->toDateString())->toBe($antigua);
})->with([
    'con hora' => ['{dia} 00:00:00'],
    'ISO con Z' => ['{dia}T00:00:00Z'],
]);

it('COMISARIATO ALTA: lo que la regla deja pasar queda guardado dentro de la ventana, se lea como se lea', function (mixed $valor) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = ServicioComisariato::count();

    $this->postJson('/api/ServicioComisariato', cargaDeComisariato($valor));

    if (ServicioComisariato::count() === $antes) {
        expect(ServicioComisariato::count())->toBe($antes);

        return;
    }

    $guardado = ServicioComisariato::latest('id')->first()->fecha_entrega->toDateString();
    expect(enLaVentana($guardado, 'comisariato.entrega'))
        ->toBeTrue('se guardo '.$guardado.' con la entrada '.json_encode($valor));
})->with(fn () => fechasHostiles());

it('COMISARIATO EDICION: lo que la regla deja pasar deja la columna dentro de la ventana, o como estaba', function (mixed $valor, string $partida) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = fechaDePartida($partida);
    $servicio = comisariatoParaEditar($original);

    $this->putJson("/api/ServicioComisariato/{$servicio->id}", cargaDeComisariato($valor));

    $guardado = $servicio->fresh()->fecha_entrega->toDateString();
    expect($guardado === $original || enLaVentana($guardado, 'comisariato.entrega'))
        ->toBeTrue('de '.$original.' paso a '.$guardado.' con la entrada '.json_encode($valor));
})->with(fn () => hostilesPorPartida());

// ---------------------------------------------------------------------------
// Control de medicamentos: POST /api/ControlMedicamento y PUT /api/ControlMedicamento/{id}
// ---------------------------------------------------------------------------

/** @return array<string, mixed> */
function cargaDeControlMedicamento(mixed $fecha, string $responsable = 'Responsable Uno'): array
{
    return [
        'responsable' => $responsable,
        'fecha' => $fecha,
        'dia' => 'Lunes',
        'aparatos' => ['Baumanometro'],
        'firma' => 'sin-firma',
        'medicamentos' => ['Paracetamol' => ['inicio' => 5, 'final' => 3]],
    ];
}

function controlMedicamentoParaEditar(string $fecha): ControlMedicamento
{
    return ControlMedicamento::create([
        'responsable' => 'Original',
        'fecha' => $fecha,
        'dia' => 'Lunes',
        'aparatos' => ['Baumanometro'],
        'medicamentos' => ['Paracetamol' => ['inicio' => 5, 'final' => 3]],
        'user_id' => User::factory()->create()->id,
    ]);
}

it('MEDICAMENTO alta: rechaza con 422 y no escribe una fecha fuera de ventana', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = ControlMedicamento::count();

    $respuesta = $this->postJson('/api/ControlMedicamento', cargaDeControlMedicamento(Carbon::today()->addDays($desplazamiento)->toDateString()));

    $respuesta->assertUnprocessable()->assertJsonValidationErrors('fecha');
    ['min' => $min, 'max' => $max] = fechasDelMensaje('medicamento.movimiento');
    expect(mensajeDeFecha($respuesta))->toContain($min)->toContain($max);
    expect(ControlMedicamento::count())->toBe($antes);
})->with([
    'en el futuro' => [1],
    'demasiado antigua' => [-4],
]);

it('MEDICAMENTO alta: no deja pasar una fecha vacia, ausente o ilegible', function (?string $fecha, bool $enviarFecha) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = ControlMedicamento::count();
    $carga = cargaDeControlMedicamento($fecha);
    if (! $enviarFecha) {
        unset($carga['fecha']);
    }

    $this->postJson('/api/ControlMedicamento', $carga)->assertUnprocessable()->assertJsonValidationErrors('fecha');

    expect(ControlMedicamento::count())->toBe($antes);
})->with([
    'vacia' => ['', true],
    'ausente' => [null, false],
    'ilegible' => ['no-es-una-fecha', true],
]);

it('MEDICAMENTO alta: una fecha dentro de ventana escribe (la regla no rechaza todo)', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $fecha = Carbon::today()->addDays($desplazamiento)->toDateString();
    $antes = ControlMedicamento::count();

    $this->postJson('/api/ControlMedicamento', cargaDeControlMedicamento($fecha))->assertCreated();

    expect(ControlMedicamento::count())->toBe($antes + 1);
    expect(ControlMedicamento::latest('id')->first()->fecha->toDateString())->toBe($fecha);
})->with([
    'hoy' => [0],
    'el borde de atras' => [-3],
]);

it('MEDICAMENTO edicion: rechaza con 422 y no modifica la fecha de una edicion fuera de ventana', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = Carbon::today()->toDateString();
    $control = controlMedicamentoParaEditar($original);

    $respuesta = $this->putJson(
        "/api/ControlMedicamento/{$control->id}",
        cargaDeControlMedicamento(Carbon::today()->addDays($desplazamiento)->toDateString(), 'Cambiado'),
    );

    $respuesta->assertUnprocessable()->assertJsonValidationErrors('fecha');
    ['min' => $min, 'max' => $max] = fechasDelMensaje('medicamento.movimiento');
    expect(mensajeDeFecha($respuesta))->toContain($min)->toContain($max);
    expect($control->fresh()->fecha->toDateString())->toBe($original);
    expect($control->fresh()->responsable)->toBe('Original');
})->with([
    'futuro' => [1],
    'antigua' => [-4],
]);

it('MEDICAMENTO edicion: deja corregir otros campos de un registro antiguo si no se toca su fecha', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $control = controlMedicamentoParaEditar($antigua);

    $this->putJson("/api/ControlMedicamento/{$control->id}", cargaDeControlMedicamento($antigua, 'Corregido'))->assertOk();

    expect($control->fresh()->responsable)->toBe('Corregido');
    expect($control->fresh()->fecha->toDateString())->toBe($antigua);
});

it('MEDICAMENTO edicion: no deja pasar de una fecha antigua a OTRA antigua distinta', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $control = controlMedicamentoParaEditar($antigua);

    $this->putJson("/api/ControlMedicamento/{$control->id}", cargaDeControlMedicamento(Carbon::today()->subDays(20)->toDateString()))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('fecha');

    expect($control->fresh()->fecha->toDateString())->toBe($antigua);
});

it('MEDICAMENTO edicion: no deja que lleve una fecha ausente o ilegible', function (?string $fecha, bool $enviarFecha) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = Carbon::today()->toDateString();
    $control = controlMedicamentoParaEditar($original);
    $carga = cargaDeControlMedicamento($fecha);
    if (! $enviarFecha) {
        unset($carga['fecha']);
    }

    $this->putJson("/api/ControlMedicamento/{$control->id}", $carga)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('fecha');

    expect($control->fresh()->fecha->toDateString())->toBe($original);
})->with([
    'ausente' => [null, false],
    'ilegible' => ['no-es-una-fecha', true],
]);

it('MEDICAMENTO edicion: una fecha valida de hoy escribe la fecha (la edicion tiene camino feliz)', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $hoy = Carbon::today()->toDateString();
    $control = controlMedicamentoParaEditar(Carbon::today()->subDays(10)->toDateString());

    $this->putJson("/api/ControlMedicamento/{$control->id}", cargaDeControlMedicamento($hoy))->assertOk();

    expect($control->fresh()->fecha->toDateString())->toBe($hoy);
});

it('MEDICAMENTO edicion: reenviar la misma fecha en otro formato cuenta como sin cambios', function (string $formato) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $control = controlMedicamentoParaEditar($antigua);

    $this->putJson("/api/ControlMedicamento/{$control->id}", cargaDeControlMedicamento(str_replace('{dia}', $antigua, $formato), 'Corregido'))->assertOk();

    expect($control->fresh()->responsable)->toBe('Corregido');
    expect($control->fresh()->fecha->toDateString())->toBe($antigua);
})->with([
    'con hora' => ['{dia} 00:00:00'],
    'ISO con Z' => ['{dia}T00:00:00Z'],
]);

it('MEDICAMENTO ALTA: lo que la regla deja pasar queda guardado dentro de la ventana, se lea como se lea', function (mixed $valor) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = ControlMedicamento::count();

    $this->postJson('/api/ControlMedicamento', cargaDeControlMedicamento($valor));

    if (ControlMedicamento::count() === $antes) {
        expect(ControlMedicamento::count())->toBe($antes);

        return;
    }

    $guardado = ControlMedicamento::latest('id')->first()->fecha->toDateString();
    expect(enLaVentana($guardado, 'medicamento.movimiento'))
        ->toBeTrue('se guardo '.$guardado.' con la entrada '.json_encode($valor));
})->with(fn () => fechasHostiles());

it('MEDICAMENTO EDICION: lo que la regla deja pasar deja la columna dentro de la ventana, o como estaba', function (mixed $valor, string $partida) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = fechaDePartida($partida);
    $control = controlMedicamentoParaEditar($original);

    $this->putJson("/api/ControlMedicamento/{$control->id}", cargaDeControlMedicamento($valor));

    $guardado = $control->fresh()->fecha->toDateString();
    expect($guardado === $original || enLaVentana($guardado, 'medicamento.movimiento'))
        ->toBeTrue('de '.$original.' paso a '.$guardado.' con la entrada '.json_encode($valor));
})->with(fn () => hostilesPorPartida());
