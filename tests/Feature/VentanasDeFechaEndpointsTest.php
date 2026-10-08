<?php

use App\Http\Requests\OperacionProgramada\StoreOperacionProgramadaRequest;
use App\Http\Requests\OperacionProgramada\UpdateOperacionProgramadaRequest;
use App\Models\ChecklistTurno;
use App\Models\ControlMedicamento;
use App\Models\Departamento;
use App\Models\EntregaTurnoR;
use App\Models\EstacionamientoSubterraneo;
use App\Models\MovimientoCSAE;
use App\Models\OperacionDiaria;
use App\Models\OperacionProgramada;
use App\Models\PernoctaDia;
use App\Models\PrestamoChaleco;
use App\Models\RelacionPlanta;
use App\Models\Remision;
use App\Models\ServicioComisariato;
use App\Models\TurnoAutotanque;
use App\Models\User;
use App\Models\WalkAround;
use App\Rules\DentroDeLaVentana;
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
    // El alta de remisiones y la de turnos de autotanque leen el precio del combustible.
    Schema::connection('remota')->create('tb_combustible', function ($tabla) {
        $tabla->increments('id');
        $tabla->decimal('p_combustible', 10, 2);
        $tabla->decimal('pasa', 10, 2);
    });
    DB::connection('remota')->table('tb_combustible')->insert(['p_combustible' => 20, 'pasa' => 18]);
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

// ---------------------------------------------------------------------------
// RAMPA. Tres de sus cinco pantallas NO tienen cast de fecha: el valor va CRUDO a la base y por
// eso la regla lleva `date_format:...` (la cadena que se juzga ES la que se guarda). Las pruebas
// de invariante leen la columna guardada (o la clave dentro del JSON), no el codigo de respuesta.
// ---------------------------------------------------------------------------

/** Formatos que `date` leeria como hoy (o como un dia cercano) pero que no son `Y-m-d`. */
function formatosQueNoSonSoloElDia(): array
{
    return [
        'dia, mes y anio' => ['d/m/Y'],
        'con hora' => ['Y-m-d H:i:s'],
        'ISO con zona' => ['Y-m-d\TH:i:sP'],
        'sin ceros' => ['Y-n-j'],
    ];
}

/** El dia (diez primeros caracteres) de una columna sin cast. */
function diaDeColumna(mixed $valor): string
{
    return substr((string) $valor, 0, 10);
}

// --- Entrega de turno de rampa: POST/PUT /api/EntregaTurnoR (la fecha vive DENTRO de un JSON) ---

/** @return array<string, mixed> */
function cargaDeEntregaRampa(mixed $fecha, string $jefe = 'Jefe Uno', bool $enviarFecha = true): array
{
    $encabezado = ['fecha' => $fecha, 'jefeTurno' => $jefe];
    if (! $enviarFecha) {
        unset($encabezado['fecha']);
    }

    return [
        'formData' => ['encabezado' => $encabezado, 'comunicaciones' => ['observaciones' => '']],
        'vehiculos' => [],
        'barrasRemolque' => [],
        'gpus' => [],
        'carritoGolf' => [],
        'aeronaves' => [],
    ];
}

function entregaRampaParaEditar(string $fecha): EntregaTurnoR
{
    return EntregaTurnoR::create([
        'encabezado' => ['fecha' => $fecha, 'jefeTurno' => 'Original'],
        'comunicaciones' => [],
        'vehiculos' => [],
        'barras_remolque' => [],
        'gpus' => [],
        'carrito_golf' => [],
        'aeronaves' => [],
        'user_id' => User::factory()->create()->id,
    ]);
}

/** El mensaje del campo `formData.encabezado.fecha` (lleva puntos: no se lee con `json('errors.…')`). */
function mensajeDeEncabezado($respuesta): string
{
    return $respuesta->json('errors')['formData.encabezado.fecha'][0] ?? '';
}

it('RAMPA entrega alta: rechaza con 422 y no escribe una fecha fuera de ventana', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = EntregaTurnoR::count();

    $respuesta = $this->postJson('/api/EntregaTurnoR', cargaDeEntregaRampa(Carbon::today()->addDays($desplazamiento)->toDateString()));

    $respuesta->assertUnprocessable()->assertJsonValidationErrors('formData.encabezado.fecha');
    ['min' => $min, 'max' => $max] = fechasDelMensaje('turno.entrega_rampa');
    expect(mensajeDeEncabezado($respuesta))->toContain($min)->toContain($max);
    expect(EntregaTurnoR::count())->toBe($antes);
})->with([
    'en el futuro' => [1],
    'demasiado antigua' => [-2],
]);

it('RAMPA entrega alta: no deja pasar una fecha vacia, ausente o ilegible (el required es nuevo)', function (mixed $fecha, bool $enviarFecha) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = EntregaTurnoR::count();

    $this->postJson('/api/EntregaTurnoR', cargaDeEntregaRampa($fecha, 'Jefe Uno', $enviarFecha))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('formData.encabezado.fecha');

    expect(EntregaTurnoR::count())->toBe($antes);
})->with([
    'vacia' => ['', true],
    'ausente' => [null, false],
    'ilegible' => ['no-es-una-fecha', true],
    'un arreglo' => [['2026-10-07'], true],
]);

it('RAMPA entrega alta: exige date_format:Y-m-d, no date (la cadena se guarda LITERAL en el JSON)', function (string $formato) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = EntregaTurnoR::count();

    $this->postJson('/api/EntregaTurnoR', cargaDeEntregaRampa(Carbon::today()->format($formato)))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('formData.encabezado.fecha');

    expect(EntregaTurnoR::count())->toBe($antes);
})->with(formatosQueNoSonSoloElDia());

it('RAMPA entrega alta: una fecha dentro de ventana escribe (la regla no rechaza todo)', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $fecha = Carbon::today()->addDays($desplazamiento)->toDateString();
    $antes = EntregaTurnoR::count();

    $this->postJson('/api/EntregaTurnoR', cargaDeEntregaRampa($fecha))->assertCreated();

    expect(EntregaTurnoR::count())->toBe($antes + 1);
    expect(EntregaTurnoR::latest('id')->first()->encabezado['fecha'])->toBe($fecha);
})->with([
    'hoy' => [0],
    'el borde de atras (ayer)' => [-1],
]);

it('RAMPA entrega alta: no valida nada mas del cuerpo (sigue siendo de forma libre)', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $carga = cargaDeEntregaRampa(Carbon::today()->toDateString());
    $carga['formData']['encabezado']['cualquierCosa'] = ['x' => 1];

    $this->postJson('/api/EntregaTurnoR', $carga)->assertCreated();
});

it('RAMPA entrega edicion: rechaza con 422 y no modifica la fecha de una edicion fuera de ventana', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = Carbon::today()->toDateString();
    $entrega = entregaRampaParaEditar($original);

    $respuesta = $this->putJson("/api/EntregaTurnoR/{$entrega->id}", cargaDeEntregaRampa(Carbon::today()->addDays($desplazamiento)->toDateString(), 'Cambiado'));

    $respuesta->assertUnprocessable()->assertJsonValidationErrors('formData.encabezado.fecha');
    ['min' => $min, 'max' => $max] = fechasDelMensaje('turno.entrega_rampa');
    expect(mensajeDeEncabezado($respuesta))->toContain($min)->toContain($max);
    expect($entrega->fresh()->encabezado)->toBe(['fecha' => $original, 'jefeTurno' => 'Original']);
})->with([
    'futuro' => [1],
    'antigua' => [-2],
]);

it('RAMPA entrega edicion: deja corregir otros campos de un reporte antiguo si no se toca su fecha', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $entrega = entregaRampaParaEditar($antigua);

    $this->putJson("/api/EntregaTurnoR/{$entrega->id}", cargaDeEntregaRampa($antigua, 'Corregido'))->assertOk();

    expect($entrega->fresh()->encabezado)->toBe(['fecha' => $antigua, 'jefeTurno' => 'Corregido']);
});

it('RAMPA entrega edicion: no deja pasar de una fecha antigua a OTRA antigua distinta', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $entrega = entregaRampaParaEditar($antigua);

    $this->putJson("/api/EntregaTurnoR/{$entrega->id}", cargaDeEntregaRampa(Carbon::today()->subDays(20)->toDateString()))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('formData.encabezado.fecha');

    expect($entrega->fresh()->encabezado['fecha'])->toBe($antigua);
});

it('RAMPA entrega edicion: no deja que lleve una fecha ausente o ilegible', function (mixed $fecha, bool $enviarFecha) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = Carbon::today()->toDateString();
    $entrega = entregaRampaParaEditar($original);

    $this->putJson("/api/EntregaTurnoR/{$entrega->id}", cargaDeEntregaRampa($fecha, 'Cambiado', $enviarFecha))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('formData.encabezado.fecha');

    expect($entrega->fresh()->encabezado['fecha'])->toBe($original);
})->with([
    'ausente' => [null, false],
    'ilegible' => ['no-es-una-fecha', true],
    'con hora (no es Y-m-d)' => [Carbon::today()->format('Y-m-d').' 10:00:00', true],
]);

it('RAMPA entrega edicion: una fecha valida de hoy escribe la fecha (la edicion tiene camino feliz)', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $hoy = Carbon::today()->toDateString();
    $entrega = entregaRampaParaEditar(Carbon::today()->subDays(10)->toDateString());

    $this->putJson("/api/EntregaTurnoR/{$entrega->id}", cargaDeEntregaRampa($hoy))->assertOk();

    expect($entrega->fresh()->encabezado['fecha'])->toBe($hoy);
});

it('RAMPA ENTREGA ALTA: lo que la regla deja pasar queda guardado dentro de la ventana, se lea como se lea', function (mixed $valor) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = EntregaTurnoR::count();

    $this->postJson('/api/EntregaTurnoR', cargaDeEntregaRampa($valor));

    if (EntregaTurnoR::count() === $antes) {
        expect(EntregaTurnoR::count())->toBe($antes);

        return;
    }

    // La clave DENTRO del JSON: es una cadena literal, y tiene que ser un dia limpio.
    $guardado = EntregaTurnoR::latest('id')->first()->encabezado['fecha'];
    expect($guardado)->toMatch('/^\d{4}-\d{2}-\d{2}$/')
        ->and(enLaVentana($guardado, 'turno.entrega_rampa'))
        ->toBeTrue('se guardo '.json_encode($guardado).' con la entrada '.json_encode($valor));
})->with(fn () => fechasHostiles());

it('RAMPA ENTREGA EDICION: lo que la regla deja pasar deja la clave dentro de la ventana, o como estaba', function (mixed $valor, string $partida) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = fechaDePartida($partida);
    $entrega = entregaRampaParaEditar($original);

    $this->putJson("/api/EntregaTurnoR/{$entrega->id}", cargaDeEntregaRampa($valor));

    $guardado = $entrega->fresh()->encabezado['fecha'];
    expect($guardado === $original || (preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $guardado) && enLaVentana($guardado, 'turno.entrega_rampa')))
        ->toBeTrue('de '.$original.' paso a '.json_encode($guardado).' con la entrada '.json_encode($valor));
})->with(fn () => hostilesPorPartida());

// --- Turno de autotanque: POST /api/TurnoAutoTanque (fecha y fechaCierre; el mismo `store` edita por `id`) ---

/**
 * `fecha` y `fechaCierre` son `dateTime` SIN cast y el formulario manda HORA de verdad
 * (`YYYY-MM-DDTHH:MM`, o con segundos al reenviar lo que devolvio la base). Por eso no sirve
 * `date_format:Y-m-d`: se exige uno de esos dos formatos y el dia son sus diez primeros caracteres.
 *
 * @param  array<string, mixed>  $extra
 * @return array<string, mixed>
 */
function cargaDeTurno(mixed $fecha, array $extra = []): array
{
    return array_merge([
        'nombre' => 'Ana Prueba',
        'fecha' => $fecha,
        'cmIni' => 10,
        'litrosIni' => 100,
        'totalizadorIni' => 5000,
        'resumen' => ['totalVendidos' => 0, 'balanceAritmetico' => 0, 'balanceFisico' => 0, 'diferenciaFinal' => 0],
    ], $extra);
}

/** El texto con el que el formulario manda un dia a una hora cualquiera. */
function diaYHora(int $desplazamiento, string $hora = '08:30'): string
{
    return Carbon::today()->addDays($desplazamiento)->toDateString().'T'.$hora;
}

function turnoParaEditar(string $dia, ?string $diaCierre = null): TurnoAutotanque
{
    // Tal como lo guarda y lo devuelve MySQL: con espacio y segundos.
    return TurnoAutotanque::create([
        'user_id' => User::factory()->create()->id,
        'nombre' => 'Original',
        'fecha' => $dia.' 08:30:00',
        'cmIni' => 10,
        'litrosIni' => 100,
        'totalizadorIni' => 5000,
        'nombreCierre' => '',
        'fechaCierre' => ($diaCierre ?? $dia).' 08:30:00',
        'cmCierre' => 0,
        'litrosCierre' => 0,
        'totalizadorCierre' => 0,
        'totalVendidos' => 0,
        'balanceAritmetico' => 0,
        'balanceFisico' => 0,
        'diferenciaFinal' => 0,
    ]);
}

it('AUTOTANQUE turno alta: rechaza con 422 y no escribe un inicio fuera de ventana', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = TurnoAutotanque::count();

    $respuesta = $this->postJson('/api/TurnoAutoTanque', cargaDeTurno(diaYHora($desplazamiento)));

    $respuesta->assertUnprocessable()->assertJsonValidationErrors('fecha');
    ['min' => $min, 'max' => $max] = fechasDelMensaje('autotanque.turno_inicio');
    expect(mensajeDeFecha($respuesta))->toContain($min)->toContain($max);
    expect(TurnoAutotanque::count())->toBe($antes);
})->with([
    'en el futuro (manana)' => [1],
    'demasiado antigua' => [-2],
]);

it('AUTOTANQUE turno alta: rechaza con 422 y no escribe un cierre fuera de ventana', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = TurnoAutotanque::count();

    $respuesta = $this->postJson('/api/TurnoAutoTanque', cargaDeTurno(diaYHora(0), ['fechaCierre' => diaYHora($desplazamiento)]));

    $respuesta->assertUnprocessable()->assertJsonValidationErrors('fechaCierre');
    ['min' => $min, 'max' => $max] = fechasDelMensaje('autotanque.turno_cierre');
    expect(mensajeDeFecha($respuesta, 'fechaCierre'))->toContain($min)->toContain($max);
    expect(TurnoAutotanque::count())->toBe($antes);
})->with([
    'en el futuro (manana)' => [1],
    'demasiado antigua' => [-2],
]);

it('AUTOTANQUE turno alta: la fecha de inicio no puede faltar ni ser ilegible', function (?string $fecha, bool $enviarFecha) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = TurnoAutotanque::count();
    $carga = cargaDeTurno($fecha);
    if (! $enviarFecha) {
        unset($carga['fecha']);
    }

    $this->postJson('/api/TurnoAutoTanque', $carga)->assertUnprocessable()->assertJsonValidationErrors('fecha');

    expect(TurnoAutotanque::count())->toBe($antes);
})->with([
    'vacia' => ['', true],
    'ausente' => [null, false],
    'ilegible' => ['no-es-una-fecha', true],
]);

it('AUTOTANQUE turno alta: la fecha de cierre sigue siendo opcional (un turno sin cerrar no tiene cierre)', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = TurnoAutotanque::count();

    $this->postJson('/api/TurnoAutoTanque', cargaDeTurno(diaYHora(0)))->assertCreated();
    $this->postJson('/api/TurnoAutoTanque', cargaDeTurno(diaYHora(0), ['fechaCierre' => null]))->assertCreated();

    expect(TurnoAutotanque::count())->toBe($antes + 2);
});

it('AUTOTANQUE turno alta: exige fecha y hora exactas, no cualquier cosa que date lea (se guarda LITERAL)', function (string $formato) {
    // Todas se leen como hoy con `date`, pero ninguna es `Y-m-d\TH:i` ni `Y-m-d\TH:i:s`.
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = TurnoAutotanque::count();

    $this->postJson('/api/TurnoAutoTanque', cargaDeTurno(Carbon::today()->setTime(8, 30)->format($formato)))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('fecha');

    $this->postJson('/api/TurnoAutoTanque', cargaDeTurno(diaYHora(0), ['fechaCierre' => Carbon::today()->setTime(8, 30)->format($formato)]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('fechaCierre');

    expect(TurnoAutotanque::count())->toBe($antes);
})->with([
    'solo el dia' => ['Y-m-d'],
    'con espacio en vez de T' => ['Y-m-d H:i:s'],
    'ISO con zona' => ['Y-m-d\TH:i:sP'],
    'ISO con Z' => ['Y-m-d\TH:i:s\Z'],
    'dia, mes y anio' => ['d/m/Y H:i'],
    'sin ceros' => ['Y-n-j\TH:i'],
]);

it('AUTOTANQUE turno alta: una fecha y hora dentro de ventana escriben, con y sin segundos (la regla no rechaza todo)', function (int $desplazamiento, string $hora) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = TurnoAutotanque::count();
    $dia = Carbon::today()->addDays($desplazamiento)->toDateString();

    $this->postJson('/api/TurnoAutoTanque', cargaDeTurno("{$dia}T{$hora}", ['fechaCierre' => "{$dia}T{$hora}"]))->assertCreated();

    expect(TurnoAutotanque::count())->toBe($antes + 1);
    $turno = TurnoAutotanque::latest('id')->first();
    expect(diaDeColumna($turno->fecha))->toBe($dia)->and(diaDeColumna($turno->fechaCierre))->toBe($dia);
})->with([
    'hoy' => [0, '08:30'],
    'hoy con segundos' => [0, '23:59:59'],
    'el borde de atras (ayer)' => [-1, '00:00'],
]);

it('AUTOTANQUE turno edicion: cerrar un turno de hace dias reenvia su inicio intacto y no se bloquea', function (string $reenvio) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $turno = turnoParaEditar($antigua);

    // Lo que devuelve la base lo reenvia el formulario con `T` y segundos; otra hora el mismo dia tambien.
    $this->postJson('/api/TurnoAutoTanque', cargaDeTurno(str_replace('{dia}', $antigua, $reenvio), [
        'id' => $turno->id,
        'nombre' => 'Corregido',
        'nombreCierre' => 'Quien recibe',
        'fechaCierre' => diaYHora(0),
    ]))->assertCreated();

    $turno = $turno->fresh();
    expect($turno->nombre)->toBe('Corregido');
    expect(diaDeColumna($turno->fecha))->toBe($antigua);
    expect(diaDeColumna($turno->fechaCierre))->toBe(Carbon::today()->toDateString());
})->with([
    'tal como lo reenvia el formulario' => ['{dia}T08:30:00'],
    'otra hora el mismo dia' => ['{dia}T09:15'],
]);

it('AUTOTANQUE turno edicion: un turno antiguo cuyo cierre tambien es antiguo conserva ambas fechas', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $turno = turnoParaEditar($antigua, $antigua);

    $this->postJson('/api/TurnoAutoTanque', cargaDeTurno($antigua.'T08:30:00', [
        'id' => $turno->id,
        'nombre' => 'Corregido',
        'fechaCierre' => $antigua.'T08:30:00',
    ]))->assertCreated();

    expect($turno->fresh()->nombre)->toBe('Corregido');
});

it('AUTOTANQUE turno edicion: no deja mover el inicio ni el cierre a un dia fuera de ventana, y no escribe nada', function (string $campo, int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = Carbon::today()->toDateString();
    $turno = turnoParaEditar($original);
    $carga = cargaDeTurno(diaYHora(0), ['id' => $turno->id, 'nombre' => 'Cambiado', 'fechaCierre' => diaYHora(0)]);
    $carga[$campo] = diaYHora($desplazamiento);

    $respuesta = $this->postJson('/api/TurnoAutoTanque', $carga);

    $respuesta->assertUnprocessable()->assertJsonValidationErrors($campo);
    expect(TurnoAutotanque::count())->toBe(1);
    $turno = $turno->fresh();
    expect($turno->nombre)->toBe('Original');
    expect(diaDeColumna($turno->fecha))->toBe($original)->and(diaDeColumna($turno->fechaCierre))->toBe($original);
})->with([
    'inicio al futuro' => ['fecha', 1],
    'inicio antiguo' => ['fecha', -2],
    'cierre al futuro' => ['fechaCierre', 1],
    'cierre antiguo' => ['fechaCierre', -2],
]);

it('AUTOTANQUE turno edicion: mover el inicio o el cierre a un dia DENTRO de ventana escribe (la edicion no rechaza todo cambio)', function (string $campo, int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $turno = turnoParaEditar($antigua);
    $carga = cargaDeTurno($antigua.'T08:30:00', ['id' => $turno->id, 'nombre' => 'Corregido', 'fechaCierre' => $antigua.'T08:30:00']);
    $carga[$campo] = diaYHora($desplazamiento);

    $this->postJson('/api/TurnoAutoTanque', $carga)->assertCreated();

    $turno = $turno->fresh();
    $nuevo = Carbon::today()->addDays($desplazamiento)->toDateString();
    $otro = $campo === 'fecha' ? 'fechaCierre' : 'fecha';
    expect($turno->nombre)->toBe('Corregido');
    expect(diaDeColumna($turno->{$campo}))->toBe($nuevo);
    expect(diaDeColumna($turno->{$otro}))->toBe($antigua);
})->with([
    'inicio a hoy' => ['fecha', 0],
    'inicio al borde de atras (ayer)' => ['fecha', -1],
    'cierre a hoy' => ['fechaCierre', 0],
    'cierre al borde de atras (ayer)' => ['fechaCierre', -1],
]);

it('AUTOTANQUE turno edicion: no deja pasar de un inicio antiguo a OTRO antiguo distinto', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $turno = turnoParaEditar($antigua);

    $this->postJson('/api/TurnoAutoTanque', cargaDeTurno(Carbon::today()->subDays(20)->toDateString().'T08:30', ['id' => $turno->id]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('fecha');

    expect(diaDeColumna($turno->fresh()->fecha))->toBe($antigua);
});

it('AUTOTANQUE turno edicion: un id que no existe es un alta, y un alta no hereda fechas antiguas', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = TurnoAutotanque::count();

    $this->postJson('/api/TurnoAutoTanque', cargaDeTurno(Carbon::today()->subDays(10)->toDateString().'T08:30', ['id' => 99999]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('fecha');

    expect(TurnoAutotanque::count())->toBe($antes);
});

it('AUTOTANQUE turno edicion: un desfase en una fecha antigua no se cuela como "sin cambios"', function () {
    // El dia (diez primeros caracteres) es el mismo, pero MySQL convertiria de zona esa cadena.
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $turno = turnoParaEditar($antigua);

    $this->postJson('/api/TurnoAutoTanque', cargaDeTurno($antigua.'T00:30:00+14:00', ['id' => $turno->id]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('fecha');

    expect($turno->fresh()->fecha)->toBe($antigua.' 08:30:00');
});

it('AUTOTANQUE turno edicion: el mismo dia con un sufijo relativo no se cuela como "sin cambios"', function (string $partida, string $reenvio) {
    // `cambiaElDia` compara los diez primeros caracteres como texto. Eso solo es seguro porque
    // `date_format` va SIEMPRE en el mismo arreglo: con `date`, "2026-10-07 +1 day" empieza por el
    // dia guardado, contaria como "sin cambios", se saltaria la ventana y MySQL guardaria otro dia.
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = fechaDePartida($partida);
    $turno = turnoParaEditar($original);

    $this->postJson('/api/TurnoAutoTanque', cargaDeTurno(str_replace('{dia}', $original, $reenvio), ['id' => $turno->id, 'nombre' => 'Cambiado']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('fecha');

    $turno = $turno->fresh();
    expect($turno->nombre)->toBe('Original');
    expect($turno->fecha)->toBe($original.' 08:30:00');
})->with(function () {
    foreach (['hoy', 'antigua'] as $partida) {
        yield "{$partida}: dia y hora + un dia" => [$partida, '{dia}T08:30 +1 day'];
        yield "{$partida}: dia y segundos + un dia" => [$partida, '{dia}T08:30:00 +1 day'];
        yield "{$partida}: dia + un dia, sin hora" => [$partida, '{dia} +1 day'];
    }
});

it('AUTOTANQUE turno: a las 19:00 de Mexico (ya es manana en UTC) hoy sigue siendo hoy y manana se rechaza', function () {
    // Cubre el servidor. El calculo del dia por omision en el navegador (`toLocaleDateString` en
    // lugar de `toISOString`) NO tiene prueba: no hay corredor de pruebas JS en este proyecto.
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $this->travelTo(Carbon::parse('2026-10-07 19:00:00', 'America/Mexico_City'));
    $antes = TurnoAutotanque::count();

    $this->postJson('/api/TurnoAutoTanque', cargaDeTurno('2026-10-08T01:00', ['fechaCierre' => '2026-10-07T19:00']))
        ->assertUnprocessable()->assertJsonValidationErrors('fecha');
    $this->postJson('/api/TurnoAutoTanque', cargaDeTurno('2026-10-07T19:00', ['fechaCierre' => '2026-10-08T01:00']))
        ->assertUnprocessable()->assertJsonValidationErrors('fechaCierre');
    expect(TurnoAutotanque::count())->toBe($antes);

    $this->postJson('/api/TurnoAutoTanque', cargaDeTurno('2026-10-07T19:00', ['fechaCierre' => '2026-10-07T19:00']))->assertCreated();
    expect(TurnoAutotanque::count())->toBe($antes + 1);
});

it('AUTOTANQUE TURNO ALTA: lo que la regla deja pasar queda guardado dentro de la ventana, se lea como se lea', function (string $campo, mixed $valor) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = TurnoAutotanque::count();
    $carga = cargaDeTurno(diaYHora(0), ['fechaCierre' => diaYHora(0)]);
    $carga[$campo] = $valor;

    $this->postJson('/api/TurnoAutoTanque', $carga);

    if (TurnoAutotanque::count() === $antes) {
        expect(TurnoAutotanque::count())->toBe($antes);

        return;
    }

    $turno = TurnoAutotanque::latest('id')->first();
    $clave = $campo === 'fecha' ? 'autotanque.turno_inicio' : 'autotanque.turno_cierre';
    $guardado = diaDeColumna($turno->{$campo});
    expect($guardado)->toMatch('/^\d{4}-\d{2}-\d{2}$/')
        ->and(enLaVentana($guardado, $clave))
        ->toBeTrue('se guardo '.json_encode($turno->{$campo}).' con la entrada '.json_encode($valor));
})->with(function () {
    foreach (['fecha', 'fechaCierre'] as $campo) {
        foreach (fechasHostiles() as $nombre => [$valor]) {
            yield "{$campo}: {$nombre}" => [$campo, $valor];
        }
        // Las dos formas validas con hora, en el limite de la ventana.
        yield "{$campo}: hoy a medianoche" => [$campo, diaYHora(0, '00:00')];
        yield "{$campo}: ayer a las 23:59:59" => [$campo, diaYHora(-1, '23:59:59')];
        yield "{$campo}: manana a las 00:00" => [$campo, diaYHora(1, '00:00')];
    }
});

it('AUTOTANQUE TURNO EDICION: lo que la regla deja pasar deja las columnas dentro de la ventana, o como estaban', function (string $campo, mixed $valor, string $partida) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = fechaDePartida($partida);
    $turno = turnoParaEditar($original);
    $carga = cargaDeTurno($original.'T08:30:00', ['id' => $turno->id, 'fechaCierre' => $original.'T08:30:00']);
    $carga[$campo] = $valor;

    $this->postJson('/api/TurnoAutoTanque', $carga);

    $turno = $turno->fresh();
    $clave = $campo === 'fecha' ? 'autotanque.turno_inicio' : 'autotanque.turno_cierre';
    $guardado = diaDeColumna($turno->{$campo});
    expect($guardado === $original || (preg_match('/^\d{4}-\d{2}-\d{2}$/', $guardado) && enLaVentana($guardado, $clave)))
        ->toBeTrue('de '.$original.' paso a '.json_encode($turno->{$campo}).' con la entrada '.json_encode($valor));
})->with(function () {
    foreach (['fecha', 'fechaCierre'] as $campo) {
        foreach (hostilesPorPartida() as $nombre => [$valor, $partida]) {
            yield "{$campo}, {$nombre}" => [$campo, $valor, $partida];
        }
    }
});

// --- Servicio de autotanque (remision): POST /api/Remision/remisiones y PUT /api/Remision/{id} ---

/** @return array<string, mixed> */
function cargaDeRemision(mixed $fecha, string $cliente = 'Cliente Uno'): array
{
    return [
        'fecha' => $fecha,
        'operador' => 'Operador Uno',
        'cliente' => $cliente,
        'formaPago' => 'Efectivo',
        'aeronaveTipo' => 'C172',
        'matricula' => 'XA-REM',
        'destino' => 'MMTO',
        'horaLlegada' => '10:30',
        'lecturaInicial' => 100,
        'lecturaFinal' => 150,
    ];
}

function remisionParaEditar(string $fecha): Remision
{
    return Remision::create([
        'folio' => 'EOLO-'.str_pad((string) (Remision::max('id') + 1), 4, '0', STR_PAD_LEFT),
        'fecha' => $fecha,
        'operador' => 'Operador Uno',
        'cliente' => 'Original',
        'aeronave_tipo' => 'C172',
        'matricula' => 'XA-REM',
        'destino' => 'MMTO',
        'hora_llegada' => '10:30',
        'lectura_inicial' => 100,
        'lectura_final' => 150,
        'total_litros' => 50,
        'precio' => 20,
    ]);
}

it('AUTOTANQUE servicio alta: rechaza con 422 y no escribe una fecha fuera de ventana', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = Remision::count();

    $respuesta = $this->postJson('/api/Remision/remisiones', cargaDeRemision(Carbon::today()->addDays($desplazamiento)->toDateString()));

    $respuesta->assertUnprocessable()->assertJsonValidationErrors('fecha');
    ['min' => $min, 'max' => $max] = fechasDelMensaje('autotanque.servicio');
    expect(mensajeDeFecha($respuesta))->toContain($min)->toContain($max);
    expect(Remision::count())->toBe($antes);
})->with([
    'en el futuro' => [1],
    'demasiado antigua' => [-4],
]);

it('AUTOTANQUE servicio alta: no deja pasar una fecha vacia, ausente o ilegible', function (?string $fecha, bool $enviarFecha) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = Remision::count();
    $carga = cargaDeRemision($fecha);
    if (! $enviarFecha) {
        unset($carga['fecha']);
    }

    $this->postJson('/api/Remision/remisiones', $carga)->assertUnprocessable()->assertJsonValidationErrors('fecha');

    expect(Remision::count())->toBe($antes);
})->with([
    'vacia' => ['', true],
    'ausente' => [null, false],
    'ilegible' => ['no-es-una-fecha', true],
]);

it('AUTOTANQUE servicio alta: exige date_format:Y-m-d, no date (la columna no tiene cast)', function (string $formato) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = Remision::count();

    $this->postJson('/api/Remision/remisiones', cargaDeRemision(Carbon::today()->format($formato)))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('fecha');

    expect(Remision::count())->toBe($antes);
})->with(formatosQueNoSonSoloElDia());

it('AUTOTANQUE servicio alta: una fecha dentro de ventana escribe (la regla no rechaza todo)', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $fecha = Carbon::today()->addDays($desplazamiento)->toDateString();
    $antes = Remision::count();

    $this->postJson('/api/Remision/remisiones', cargaDeRemision($fecha))->assertCreated();

    expect(Remision::count())->toBe($antes + 1);
    expect(diaDeColumna(Remision::latest('id')->first()->fecha))->toBe($fecha);
})->with([
    'hoy' => [0],
    'el borde de atras' => [-3],
]);

it('AUTOTANQUE servicio edicion: rechaza con 422 y no modifica nada con una fecha fuera de ventana', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = Carbon::today()->toDateString();
    $remision = remisionParaEditar($original);

    $respuesta = $this->putJson("/api/Remision/{$remision->id}", cargaDeRemision(Carbon::today()->addDays($desplazamiento)->toDateString(), 'Cambiado'));

    $respuesta->assertUnprocessable()->assertJsonValidationErrors('fecha');
    ['min' => $min, 'max' => $max] = fechasDelMensaje('autotanque.servicio');
    expect(mensajeDeFecha($respuesta))->toContain($min)->toContain($max);
    expect(diaDeColumna($remision->fresh()->fecha))->toBe($original);
    expect($remision->fresh()->cliente)->toBe('Original');
})->with([
    'futuro' => [1],
    'antigua' => [-4],
]);

it('AUTOTANQUE servicio edicion: deja corregir otros campos de una remision antigua si no se toca su fecha', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $remision = remisionParaEditar($antigua);

    $this->putJson("/api/Remision/{$remision->id}", cargaDeRemision($antigua, 'Corregido'))->assertOk();

    expect($remision->fresh()->cliente)->toBe('Corregido');
    expect(diaDeColumna($remision->fresh()->fecha))->toBe($antigua);
});

it('AUTOTANQUE servicio edicion: no deja pasar de una fecha antigua a OTRA antigua distinta', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $remision = remisionParaEditar($antigua);

    $this->putJson("/api/Remision/{$remision->id}", cargaDeRemision(Carbon::today()->subDays(20)->toDateString()))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('fecha');

    expect(diaDeColumna($remision->fresh()->fecha))->toBe($antigua);
});

it('AUTOTANQUE servicio edicion: no deja que lleve una fecha ausente o ilegible', function (?string $fecha, bool $enviarFecha) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = Carbon::today()->toDateString();
    $remision = remisionParaEditar($original);
    $carga = cargaDeRemision($fecha);
    if (! $enviarFecha) {
        unset($carga['fecha']);
    }

    $this->putJson("/api/Remision/{$remision->id}", $carga)->assertUnprocessable()->assertJsonValidationErrors('fecha');

    expect(diaDeColumna($remision->fresh()->fecha))->toBe($original);
})->with([
    'ausente' => [null, false],
    'ilegible' => ['no-es-una-fecha', true],
]);

it('AUTOTANQUE servicio edicion: una fecha valida de hoy escribe la fecha (la edicion tiene camino feliz)', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $hoy = Carbon::today()->toDateString();
    $remision = remisionParaEditar(Carbon::today()->subDays(10)->toDateString());

    $this->putJson("/api/Remision/{$remision->id}", cargaDeRemision($hoy))->assertOk();

    expect(diaDeColumna($remision->fresh()->fecha))->toBe($hoy);
});

it('AUTOTANQUE SERVICIO ALTA: lo que la regla deja pasar queda guardado dentro de la ventana, se lea como se lea', function (mixed $valor) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = Remision::count();

    $this->postJson('/api/Remision/remisiones', cargaDeRemision($valor));

    if (Remision::count() === $antes) {
        expect(Remision::count())->toBe($antes);

        return;
    }

    $guardado = (string) Remision::latest('id')->first()->fecha;
    expect($guardado)->toMatch('/^\d{4}-\d{2}-\d{2}$/')
        ->and(enLaVentana($guardado, 'autotanque.servicio'))
        ->toBeTrue('se guardo '.json_encode($guardado).' con la entrada '.json_encode($valor));
})->with(fn () => fechasHostiles());

it('AUTOTANQUE SERVICIO EDICION: lo que la regla deja pasar deja la columna dentro de la ventana, o como estaba', function (mixed $valor, string $partida) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = fechaDePartida($partida);
    $remision = remisionParaEditar($original);

    $this->putJson("/api/Remision/{$remision->id}", cargaDeRemision($valor));

    $guardado = (string) $remision->fresh()->fecha;
    expect($guardado === $original || (preg_match('/^\d{4}-\d{2}-\d{2}$/', $guardado) && enLaVentana($guardado, 'autotanque.servicio')))
        ->toBeTrue('de '.$original.' paso a '.json_encode($guardado).' con la entrada '.json_encode($valor));
})->with(fn () => hostilesPorPartida());

// --- Prestamo de la planta GPU: POST /api/RelacionPlanta/prestar (Form Request; solo alta) ---

/** @return array<string, mixed> */
function cargaDePrestamoPlanta(mixed $fecha): array
{
    return ['fecha' => $fecha, 'empresa' => 'DEMO', 'matricula' => 'XA-GPU', 'horometro_inicio' => 10];
}

it('PLANTA prestamo: rechaza con 422 y no escribe una fecha fuera de ventana', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = RelacionPlanta::count();

    $respuesta = $this->postJson('/api/RelacionPlanta/prestar', cargaDePrestamoPlanta(Carbon::today()->addDays($desplazamiento)->toDateString()));

    $respuesta->assertUnprocessable()->assertJsonValidationErrors('fecha');
    ['min' => $min, 'max' => $max] = fechasDelMensaje('planta.prestamo');
    expect(mensajeDeFecha($respuesta))->toContain($min)->toContain($max);
    expect(RelacionPlanta::count())->toBe($antes);
})->with([
    'en el futuro' => [1],
    'demasiado antigua' => [-2],
]);

it('PLANTA prestamo: no deja pasar una fecha vacia, ausente o ilegible', function (?string $fecha, bool $enviarFecha) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = RelacionPlanta::count();
    $carga = cargaDePrestamoPlanta($fecha);
    if (! $enviarFecha) {
        unset($carga['fecha']);
    }

    $this->postJson('/api/RelacionPlanta/prestar', $carga)->assertUnprocessable()->assertJsonValidationErrors('fecha');

    expect(RelacionPlanta::count())->toBe($antes);
})->with([
    'vacia' => ['', true],
    'ausente' => [null, false],
    'ilegible' => ['no-es-una-fecha', true],
]);

it('PLANTA prestamo: sigue exigiendo date_format:Y-m-d, no se sustituyo por date', function (string $formato) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = RelacionPlanta::count();

    $this->postJson('/api/RelacionPlanta/prestar', cargaDePrestamoPlanta(Carbon::today()->format($formato)))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('fecha');

    expect(RelacionPlanta::count())->toBe($antes);
})->with(formatosQueNoSonSoloElDia());

it('PLANTA prestamo: una fecha dentro de ventana escribe (la regla no rechaza todo)', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $fecha = Carbon::today()->addDays($desplazamiento)->toDateString();
    $antes = RelacionPlanta::count();

    $this->postJson('/api/RelacionPlanta/prestar', cargaDePrestamoPlanta($fecha))->assertCreated();

    expect(RelacionPlanta::count())->toBe($antes + 1);
    expect(RelacionPlanta::latest('id')->first()->fecha->toDateString())->toBe($fecha);
})->with([
    'hoy' => [0],
    'el borde de atras (ayer)' => [-1],
]);

it('PLANTA PRESTAMO: lo que la regla deja pasar queda guardado dentro de la ventana, se lea como se lea', function (mixed $valor) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = RelacionPlanta::count();

    $this->postJson('/api/RelacionPlanta/prestar', cargaDePrestamoPlanta($valor));

    if (RelacionPlanta::count() === $antes) {
        expect(RelacionPlanta::count())->toBe($antes);

        return;
    }

    $guardado = RelacionPlanta::latest('id')->first()->fecha->toDateString();
    expect(enLaVentana($guardado, 'planta.prestamo'))
        ->toBeTrue('se guardo '.$guardado.' con la entrada '.json_encode($valor));
})->with(fn () => fechasHostiles());

// ---------------------------------------------------------------------------
// Seguridad. Cuatro pantallas, cuatro formas distintas:
//   - Movimientos CSAE: `fecha_hora_*` con la hora dentro y CON cast (`datetime`).
//   - Pernocta: el cuerpo es un ARREGLO de filas, la columna NO tiene cast y el 422 es propio.
//   - Estacionamiento: no validaba la fecha en absoluto y una peticion escribe VARIAS filas.
// ---------------------------------------------------------------------------

/** Un dia y una hora como los manda el formulario de CSAE (`Y-m-d H:i:s`). */
function fechaHoraCsae(int $desplazamiento, string $hora = '18:30:00'): string
{
    return Carbon::today()->addDays($desplazamiento)->toDateString().' '.$hora;
}

/** @return array<string, mixed> */
function cargaDeEntradaCsae(mixed $fechaHora, string $matricula = 'XA-CSA'): array
{
    return [
        'fecha_hora_entrada' => $fechaHora,
        'matricula' => $matricula,
        'tipo_aeronave' => 'C172',
        'como_llega' => 'Vuelo',
        'transportista' => 'Aerolinea Uno',
    ];
}

/** Un movimiento ya guardado, con o sin salida (el dia, sin hora; la salida se guarda a las 09:30). */
function movimientoCsaeParaEditar(?string $diaSalida): MovimientoCSAE
{
    return MovimientoCSAE::create([
        'user_entrada_id' => User::factory()->create()->id,
        'fecha_hora_entrada' => Carbon::today()->subDays(20)->toDateString().' 08:00:00',
        'matricula' => 'XA-CSB',
        'tipo_aeronave' => 'C172',
        'como_llega' => 'Vuelo',
        'transportista' => 'Aerolinea Uno',
        'fecha_hora_salida' => $diaSalida === null ? null : $diaSalida.' 09:30:00',
        'observaciones_salida' => 'Original',
    ]);
}

/**
 * Las cadenas hostiles de siempre mas las formas con hora que solo existen en los campos
 * `fecha_hora_*`, en los bordes de la ventana de tres dias.
 *
 * @return iterable<string, array{0: mixed}>
 */
function hostilesConHoraCsae(): iterable
{
    foreach (fechasHostiles() as $nombre => [$valor]) {
        yield $nombre => [$valor];
    }

    yield 'hoy a medianoche' => [fechaHoraCsae(0, '00:00:00')];
    yield 'hoy a las 23:59:59' => [fechaHoraCsae(0, '23:59:59')];
    yield 'hace tres dias a las 00:00' => [fechaHoraCsae(-3, '00:00:00')];
    yield 'hace cuatro dias a las 23:59:59' => [fechaHoraCsae(-4, '23:59:59')];
    yield 'manana a las 00:00' => [fechaHoraCsae(1, '00:00:00')];
    yield 'hoy con T y sin segundos' => [Carbon::today()->toDateString().'T18:30'];
    yield 'hoy con hora imposible' => [Carbon::today()->toDateString().' 25:61:61'];
}

// --- CSAE entrada: POST /api/MovimientosCSAE ---

it('CSAE entrada: rechaza con 422 y no escribe una fecha fuera de ventana', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = MovimientoCSAE::count();

    $respuesta = $this->postJson('/api/MovimientosCSAE', cargaDeEntradaCsae(fechaHoraCsae($desplazamiento)));

    $respuesta->assertUnprocessable()->assertJsonValidationErrors('fecha_hora_entrada');
    ['min' => $min, 'max' => $max] = fechasDelMensaje('csae.entrada');
    expect(mensajeDeFecha($respuesta, 'fecha_hora_entrada'))->toContain($min)->toContain($max);
    expect(MovimientoCSAE::count())->toBe($antes);
})->with([
    'en el futuro' => [1],
    'un dia antes del borde' => [-4],
    'muy antigua' => [-30],
]);

it('CSAE entrada: no deja pasar una fecha vacia, ausente o ilegible (y es un 422, no un 500)', function (?string $fecha, bool $enviarFecha) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = MovimientoCSAE::count();
    $carga = cargaDeEntradaCsae($fecha);
    if (! $enviarFecha) {
        unset($carga['fecha_hora_entrada']);
    }

    $this->postJson('/api/MovimientosCSAE', $carga)->assertUnprocessable()->assertJsonValidationErrors('fecha_hora_entrada');

    expect(MovimientoCSAE::count())->toBe($antes);
})->with([
    'vacia' => ['', true],
    'ausente' => [null, false],
    'ilegible' => ['no-es-una-fecha', true],
]);

it('CSAE entrada: una fecha y hora dentro de ventana escriben, y la hora se conserva (la regla no rechaza todo)', function (int $desplazamiento, string $hora) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = MovimientoCSAE::count();
    $enviada = fechaHoraCsae($desplazamiento, $hora);

    $this->postJson('/api/MovimientosCSAE', cargaDeEntradaCsae($enviada))->assertCreated();

    expect(MovimientoCSAE::count())->toBe($antes + 1);
    expect(MovimientoCSAE::latest('id')->first()->fecha_hora_entrada->format('Y-m-d H:i:s'))->toBe($enviada);
})->with([
    'hoy a medianoche' => [0, '00:00:00'],
    'hoy a las 23:59:59' => [0, '23:59:59'],
    'el borde de atras (hace tres dias)' => [-3, '00:00:00'],
    'ayer por la tarde' => [-1, '18:30:00'],
]);

it('CSAE ENTRADA ALTA: lo que la regla deja pasar queda guardado dentro de la ventana, se lea como se lea', function (mixed $valor) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = MovimientoCSAE::count();

    $this->postJson('/api/MovimientosCSAE', cargaDeEntradaCsae($valor));

    if (MovimientoCSAE::count() === $antes) {
        expect(MovimientoCSAE::count())->toBe($antes);

        return;
    }

    $guardado = MovimientoCSAE::latest('id')->first()->fecha_hora_entrada->toDateString();
    expect(enLaVentana($guardado, 'csae.entrada'))
        ->toBeTrue('se guardo '.$guardado.' con la entrada '.json_encode($valor));
})->with(fn () => hostilesConHoraCsae());

// --- CSAE salida: PUT /api/MovimientosCSAE/{id} ---

it('CSAE salida: rechaza con 422 y no escribe una salida fuera de ventana', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $movimiento = movimientoCsaeParaEditar(null);

    $respuesta = $this->putJson("/api/MovimientosCSAE/{$movimiento->id}", [
        'fecha_hora_salida' => fechaHoraCsae($desplazamiento),
        'observaciones_salida' => 'Nueva',
    ]);

    $respuesta->assertUnprocessable()->assertJsonValidationErrors('fecha_hora_salida');
    ['min' => $min, 'max' => $max] = fechasDelMensaje('csae.salida');
    expect(mensajeDeFecha($respuesta, 'fecha_hora_salida'))->toContain($min)->toContain($max);
    $movimiento = $movimiento->fresh();
    expect($movimiento->fecha_hora_salida)->toBeNull()
        ->and($movimiento->observaciones_salida)->toBe('Original');
})->with([
    'en el futuro' => [1],
    'un dia antes del borde' => [-4],
    'muy antigua' => [-30],
]);

it('CSAE salida: una fecha ilegible es un 422 y no escribe', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $movimiento = movimientoCsaeParaEditar(null);

    $this->putJson("/api/MovimientosCSAE/{$movimiento->id}", ['fecha_hora_salida' => 'no-es-una-fecha', 'observaciones_salida' => 'Nueva'])
        ->assertUnprocessable()->assertJsonValidationErrors('fecha_hora_salida');

    expect($movimiento->fresh()->observaciones_salida)->toBe('Original');
});

it('CSAE salida: la fecha sigue siendo opcional (nullable): sin ella el movimiento queda sin salida', function (bool $enviarFecha) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $movimiento = movimientoCsaeParaEditar(null);
    $carga = ['fecha_hora_salida' => null, 'observaciones_salida' => 'Nueva'];
    if (! $enviarFecha) {
        unset($carga['fecha_hora_salida']);
    }

    $this->putJson("/api/MovimientosCSAE/{$movimiento->id}", $carga)->assertOk();

    $movimiento = $movimiento->fresh();
    expect($movimiento->fecha_hora_salida)->toBeNull()
        ->and($movimiento->observaciones_salida)->toBe('Nueva');
})->with([
    'null' => [true],
    'ausente' => [false],
]);

it('CSAE salida: una fecha y hora dentro de ventana escriben, y la hora se conserva (la regla no rechaza todo)', function (int $desplazamiento, string $hora) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $movimiento = movimientoCsaeParaEditar(null);
    $enviada = fechaHoraCsae($desplazamiento, $hora);

    $this->putJson("/api/MovimientosCSAE/{$movimiento->id}", ['fecha_hora_salida' => $enviada])->assertOk();

    expect($movimiento->fresh()->fecha_hora_salida->format('Y-m-d H:i:s'))->toBe($enviada);
})->with([
    'hoy a medianoche' => [0, '00:00:00'],
    'hoy a las 23:59:59' => [0, '23:59:59'],
    'el borde de atras (hace tres dias)' => [-3, '00:00:00'],
    'ayer por la tarde' => [-1, '18:30:00'],
]);

it('CSAE salida edicion: corregir otro campo de un movimiento antiguo reenviando su salida no se bloquea', function (string $reenvio) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $movimiento = movimientoCsaeParaEditar($antigua);
    $fecha = str_replace('{dia}', $antigua, $reenvio);

    $this->putJson("/api/MovimientosCSAE/{$movimiento->id}", ['fecha_hora_salida' => $fecha, 'observaciones_salida' => 'Corregida'])->assertOk();

    $movimiento = $movimiento->fresh();
    expect($movimiento->observaciones_salida)->toBe('Corregida')
        ->and($movimiento->fecha_hora_salida->toDateString())->toBe($antigua);
})->with([
    'tal como la devuelve la base' => ['{dia} 09:30:00'],
    'con otra hora' => ['{dia} 21:15:00'],
    'con T y sin segundos' => ['{dia}T09:30'],
    'solo el dia' => ['{dia}'],
]);

it('CSAE salida edicion: no deja mover una salida guardada a un dia fuera de ventana, y no escribe', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $movimiento = movimientoCsaeParaEditar($antigua);

    $this->putJson("/api/MovimientosCSAE/{$movimiento->id}", ['fecha_hora_salida' => fechaHoraCsae($desplazamiento), 'observaciones_salida' => 'Corregida'])
        ->assertUnprocessable()->assertJsonValidationErrors('fecha_hora_salida');

    $movimiento = $movimiento->fresh();
    expect($movimiento->fecha_hora_salida->format('Y-m-d H:i:s'))->toBe($antigua.' 09:30:00')
        ->and($movimiento->observaciones_salida)->toBe('Original');
})->with([
    'manana' => [1],
    'un dia antes del borde' => [-4],
    'otra antigua distinta' => [-11],
]);

it('CSAE salida edicion: mover una salida antigua a un dia DENTRO de ventana escribe (la edicion no rechaza todo cambio)', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $movimiento = movimientoCsaeParaEditar(Carbon::today()->subDays(10)->toDateString());
    $enviada = fechaHoraCsae($desplazamiento, '20:00:00');

    $this->putJson("/api/MovimientosCSAE/{$movimiento->id}", ['fecha_hora_salida' => $enviada])->assertOk();

    expect($movimiento->fresh()->fecha_hora_salida->format('Y-m-d H:i:s'))->toBe($enviada);
})->with([
    'hoy' => [0],
    'el borde de atras' => [-3],
]);

it('CSAE salida edicion: el mismo dia con un sufijo relativo no cuenta como «sin cambios» (la columna tiene cast)', function (string $partida, string $sufijo) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $dia = fechaDePartida($partida);
    $movimiento = movimientoCsaeParaEditar($dia);

    $this->putJson("/api/MovimientosCSAE/{$movimiento->id}", ['fecha_hora_salida' => "{$dia} 09:30:00 {$sufijo}", 'observaciones_salida' => 'Corregida'])
        ->assertUnprocessable()->assertJsonValidationErrors('fecha_hora_salida');

    $movimiento = $movimiento->fresh();
    expect($movimiento->fecha_hora_salida->toDateString())->toBe($dia)
        ->and($movimiento->observaciones_salida)->toBe('Original');
})->with([
    'hoy +1 day' => ['hoy', '+1 day'],
    'hoy +2 days' => ['hoy', '+2 days'],
    'antigua +1 day' => ['antigua', '+1 day'],
    'antigua +14 days' => ['antigua', '+14 days'],
]);

it('CSAE salida edicion: una fecha ilegible no se toma por «sin cambios»', function (string $partida) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $dia = fechaDePartida($partida);
    $movimiento = movimientoCsaeParaEditar($dia);

    $this->putJson("/api/MovimientosCSAE/{$movimiento->id}", ['fecha_hora_salida' => 'no-es-una-fecha', 'observaciones_salida' => 'Corregida'])
        ->assertUnprocessable()->assertJsonValidationErrors('fecha_hora_salida');

    expect($movimiento->fresh()->observaciones_salida)->toBe('Original');
})->with(['hoy', 'antigua']);

it('CSAE SALIDA ALTA: lo que la regla deja pasar queda guardado dentro de la ventana, se lea como se lea', function (mixed $valor) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $movimiento = movimientoCsaeParaEditar(null);

    $this->putJson("/api/MovimientosCSAE/{$movimiento->id}", ['fecha_hora_salida' => $valor]);

    $guardado = $movimiento->fresh()->fecha_hora_salida?->toDateString();
    expect($guardado === null || enLaVentana($guardado, 'csae.salida'))
        ->toBeTrue('se guardo '.$guardado.' con la entrada '.json_encode($valor));
})->with(fn () => hostilesConHoraCsae());

it('CSAE SALIDA EDICION: lo que la regla deja pasar deja la columna dentro de la ventana, o como estaba', function (mixed $valor, string $partida) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = fechaDePartida($partida);
    $movimiento = movimientoCsaeParaEditar($original);

    $this->putJson("/api/MovimientosCSAE/{$movimiento->id}", ['fecha_hora_salida' => $valor]);

    $guardado = $movimiento->fresh()->fecha_hora_salida?->toDateString();
    expect($guardado === null || $guardado === $original || enLaVentana($guardado, 'csae.salida'))
        ->toBeTrue('de '.$original.' paso a '.$guardado.' con la entrada '.json_encode($valor));
})->with(function () {
    foreach (['hoy', 'antigua'] as $partida) {
        foreach (hostilesConHoraCsae() as $nombre => [$valor]) {
            yield "{$partida}: {$nombre}" => [$valor, $partida];
        }
        // El dia de la propia partida con un sufijo: es lo que una comparacion de texto daba por «igual».
        yield "{$partida}: la propia partida +1 day" => [fechaDePartida($partida).' 09:30:00 +1 day', $partida];
        yield "{$partida}: la propia partida +3 days" => [fechaDePartida($partida).' +3 days', $partida];
    }
});

// --- Pernocta: POST /api/PernoctaDia (el cuerpo es un ARREGLO de filas; el 422 es propio) ---

/** Una aeronave que esta dentro del hangar, para que las pernoctas no se rechacen por otra causa. */
function aeronaveDentroDelHangar(string $matricula = 'XA-PER'): void
{
    OperacionDiaria::create([
        'user_id' => User::factory()->create()->id,
        'fecha' => Carbon::today()->subDays(30)->toDateString(),
        'tipo' => 'llegada',
        'matricula' => $matricula,
        'equipo' => 'C172',
        'hora' => '10:30',
        'lugar' => 'MMTO',
        'pax' => 2,
        'departamento' => 'Trafico',
    ]);
}

/** @return array<string, mixed> */
function filaDePernocta(mixed $fecha, string $matricula = 'XA-PER'): array
{
    return [
        'fecha' => $fecha,
        'hora' => '10:00',
        'matricula' => $matricula,
        'nombre' => 'Vigilante Uno',
        'observaciones' => null,
        'ubicacion' => 'Hangar 1',
    ];
}

/** El error de la fila `$fila`: las claves del 422 propio de pernocta son `0.fecha`, `1.fecha`... */
function errorDeFilaPernocta($respuesta, int $fila): ?string
{
    return ($respuesta->json('errors') ?? [])["{$fila}.fecha"][0] ?? null;
}

it('PERNOCTA: rechaza con el 422 propio y no escribe ninguna fila si UNA fecha esta fuera de ventana', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    aeronaveDentroDelHangar();
    $antes = PernoctaDia::count();
    $hoy = Carbon::today()->toDateString();

    $respuesta = $this->postJson('/api/PernoctaDia', [
        filaDePernocta($hoy),
        filaDePernocta(Carbon::today()->addDays($desplazamiento)->toDateString()),
        filaDePernocta($hoy),
    ]);

    $respuesta->assertUnprocessable()->assertJsonPath('message', 'La información enviada no es válida.');
    ['min' => $min, 'max' => $max] = fechasDelMensaje('pernocta.dia');
    expect(errorDeFilaPernocta($respuesta, 1))->toContain($min)->toContain($max)
        ->and(errorDeFilaPernocta($respuesta, 0))->toBeNull()
        ->and(errorDeFilaPernocta($respuesta, 2))->toBeNull();
    expect(PernoctaDia::count())->toBe($antes);
})->with([
    'en el futuro' => [1],
    'un dia antes del borde' => [-4],
    'muy antigua' => [-30],
]);

it('PERNOCTA: no deja pasar una fecha vacia, ausente o ilegible en ninguna fila', function (mixed $fecha, bool $enviarFecha) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    aeronaveDentroDelHangar();
    $antes = PernoctaDia::count();
    $fila = filaDePernocta($fecha);
    if (! $enviarFecha) {
        unset($fila['fecha']);
    }

    $respuesta = $this->postJson('/api/PernoctaDia', [filaDePernocta(Carbon::today()->toDateString()), $fila]);

    $respuesta->assertUnprocessable()->assertJsonPath('message', 'La información enviada no es válida.');
    expect(errorDeFilaPernocta($respuesta, 1))->not->toBeNull();
    expect(PernoctaDia::count())->toBe($antes);
})->with([
    'vacia' => ['', true],
    'ausente' => [null, false],
    'ilegible' => ['no-es-una-fecha', true],
    'un arreglo' => [['2026-10-07'], true],
]);

it('PERNOCTA: exige date_format:Y-m-d, no date (la columna no tiene cast y la cadena se guarda LITERAL)', function (string $formato) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    // Un dia de un solo digito en mes y dia: `Y-n-j` solo se distingue de `Y-m-d` en esas fechas.
    $this->travelTo(Carbon::parse('2026-03-05 12:00:00', 'America/Mexico_City'));
    aeronaveDentroDelHangar();
    $antes = PernoctaDia::count();

    $respuesta = $this->postJson('/api/PernoctaDia', [filaDePernocta(Carbon::today()->format($formato))]);

    $respuesta->assertUnprocessable()->assertJsonPath('message', 'La información enviada no es válida.');
    expect(errorDeFilaPernocta($respuesta, 0))->not->toBeNull();
    expect(PernoctaDia::count())->toBe($antes);
})->with(formatosQueNoSonSoloElDia());

it('PERNOCTA: varias filas dentro de ventana escriben todas, con su dia exacto (la regla no rechaza todo)', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    aeronaveDentroDelHangar();
    aeronaveDentroDelHangar('XA-PE2');
    $antes = PernoctaDia::count();
    $dia = Carbon::today()->addDays($desplazamiento)->toDateString();

    $this->postJson('/api/PernoctaDia', [filaDePernocta($dia), filaDePernocta($dia, 'XA-PE2')])->assertCreated();

    expect(PernoctaDia::count())->toBe($antes + 2);
    expect(PernoctaDia::latest('id')->take(2)->pluck('fecha')->map(fn ($f) => substr((string) $f, 0, 10))->all())->toBe([$dia, $dia]);
})->with([
    'hoy' => [0],
    'el borde de atras (hace tres dias)' => [-3],
    'ayer' => [-1],
]);

it('PERNOCTA: a las 19:00 de Mexico (ya es manana en UTC) hoy sigue siendo hoy y manana se rechaza', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $this->travelTo(Carbon::parse('2026-10-07 19:00:00', 'America/Mexico_City'));
    aeronaveDentroDelHangar();
    $antes = PernoctaDia::count();

    $this->postJson('/api/PernoctaDia', [filaDePernocta('2026-10-08')])->assertUnprocessable();
    expect(PernoctaDia::count())->toBe($antes);

    $this->postJson('/api/PernoctaDia', [filaDePernocta('2026-10-07')])->assertCreated();
    expect(PernoctaDia::count())->toBe($antes + 1);
});

it('PERNOCTA: lo que la regla deja pasar queda guardado dentro de la ventana, fila por fila, se lea como se lea', function (mixed $valor) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    aeronaveDentroDelHangar();
    aeronaveDentroDelHangar('XA-PE2');
    $antes = PernoctaDia::count();
    $hoy = Carbon::today()->toDateString();

    $this->postJson('/api/PernoctaDia', [filaDePernocta($hoy), filaDePernocta($valor, 'XA-PE2'), filaDePernocta($hoy)]);

    $escritas = PernoctaDia::count() - $antes;
    // Todo o nada: una fila rechazada no deja pasar a las demas.
    expect($escritas)->toBeIn([0, 3]);
    foreach (PernoctaDia::latest('id')->take($escritas)->get() as $fila) {
        $guardado = diaDeColumna($fila->fecha);
        expect($guardado)->toMatch('/^\d{4}-\d{2}-\d{2}$/')
            ->and(enLaVentana($guardado, 'pernocta.dia'))
            ->toBeTrue('se guardo '.json_encode($fila->fecha).' con la entrada '.json_encode($valor));
    }
})->with(function () {
    foreach (fechasHostiles() as $nombre => [$valor]) {
        yield $nombre => [$valor];
    }
    yield 'hoy con hora (un campo de solo dia)' => [Carbon::today()->toDateString().' 10:00:00'];
    yield 'ayer con T y zona' => [Carbon::today()->subDay()->toDateString().'T10:00:00-06:00'];
    yield 'el borde de atras' => [Carbon::today()->subDays(3)->toDateString()];
    yield 'un dia antes del borde' => [Carbon::today()->subDays(4)->toDateString()];
});

// --- Estacionamiento subterraneo: POST /api/EstacionamientoSubTerraneo (una peticion, VARIAS filas) ---

/** @return array<string, mixed> */
function cargaDeRonda(mixed $fecha, int $vehiculos = 3): array
{
    $lista = [];
    foreach (['AAA-111', 'BBB-222', 'CCC-333', 'DDD-444'] as $i => $placas) {
        if ($i >= $vehiculos) {
            break;
        }
        $lista[] = ['placas' => $placas, 'vehiculo' => 'Auto', 'color' => 'Rojo', 'responsable' => 'Resp', 'matricula' => 'N/A', 'llaves' => 'SI'];
    }

    return ['oficial' => 'Oficial Uno', 'fecha_ingreso' => $fecha, 'vehiculos' => $lista];
}

it('ESTACIONAMIENTO ronda: rechaza con 422 y no escribe NINGUNA de las filas con una fecha fuera de ventana', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = EstacionamientoSubterraneo::count();

    $respuesta = $this->postJson('/api/EstacionamientoSubTerraneo', cargaDeRonda(Carbon::today()->addDays($desplazamiento)->toDateString()));

    $respuesta->assertUnprocessable()->assertJsonValidationErrors('fecha_ingreso');
    ['min' => $min, 'max' => $max] = fechasDelMensaje('estacionamiento.ronda');
    expect(mensajeDeFecha($respuesta, 'fecha_ingreso'))->toContain($min)->toContain($max);
    expect(EstacionamientoSubterraneo::count())->toBe($antes);
})->with([
    'en el futuro' => [1],
    'un dia antes del borde' => [-2],
    'muy antigua' => [-30],
]);

it('ESTACIONAMIENTO ronda: la fecha ahora es obligatoria (antes no se validaba): vacia, ausente o ilegible dan 422', function (?string $fecha, bool $enviarFecha) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = EstacionamientoSubterraneo::count();
    $carga = cargaDeRonda($fecha);
    if (! $enviarFecha) {
        unset($carga['fecha_ingreso']);
    }

    $this->postJson('/api/EstacionamientoSubTerraneo', $carga)->assertUnprocessable()->assertJsonValidationErrors('fecha_ingreso');

    expect(EstacionamientoSubterraneo::count())->toBe($antes);
})->with([
    'vacia' => ['', true],
    'ausente' => [null, false],
    'ilegible' => ['no-es-una-fecha', true],
]);

it('ESTACIONAMIENTO ronda: una fecha dentro de ventana escribe TODAS las filas, todas con ese dia (la regla no rechaza todo)', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = EstacionamientoSubterraneo::count();
    $dia = Carbon::today()->addDays($desplazamiento)->toDateString();

    $this->postJson('/api/EstacionamientoSubTerraneo', cargaDeRonda($dia))->assertOk();

    expect(EstacionamientoSubterraneo::count())->toBe($antes + 3);
    expect(EstacionamientoSubterraneo::latest('id')->take(3)->get()->map(fn ($f) => $f->fecha_ingreso->toDateString())->all())->toBe([$dia, $dia, $dia]);
})->with([
    'hoy' => [0],
    'el borde de atras (ayer)' => [-1],
]);

it('ESTACIONAMIENTO ronda: a las 19:00 de Mexico (ya es manana en UTC) hoy sigue siendo hoy y manana se rechaza', function () {
    // Cubre el servidor. El calculo del dia por omision en el navegador (`fechaHoy()` en lugar
    // de `toISOString`) NO tiene prueba: no hay corredor de pruebas JS en este proyecto.
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $this->travelTo(Carbon::parse('2026-10-07 19:00:00', 'America/Mexico_City'));
    $antes = EstacionamientoSubterraneo::count();

    $this->postJson('/api/EstacionamientoSubTerraneo', cargaDeRonda('2026-10-08'))
        ->assertUnprocessable()->assertJsonValidationErrors('fecha_ingreso');
    expect(EstacionamientoSubterraneo::count())->toBe($antes);

    $this->postJson('/api/EstacionamientoSubTerraneo', cargaDeRonda('2026-10-07'))->assertOk();
    expect(EstacionamientoSubterraneo::count())->toBe($antes + 3);
});

it('ESTACIONAMIENTO RONDA: lo que la regla deja pasar queda guardado dentro de la ventana en CADA fila, se lea como se lea', function (mixed $valor) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = EstacionamientoSubterraneo::count();

    $this->postJson('/api/EstacionamientoSubTerraneo', cargaDeRonda($valor, 4));

    $escritas = EstacionamientoSubterraneo::count() - $antes;
    // Todo o nada, y las cuatro filas de la peticion: contar de verdad, no suponer una.
    expect($escritas)->toBeIn([0, 4]);
    foreach (EstacionamientoSubterraneo::latest('id')->take($escritas)->get() as $fila) {
        $guardado = $fila->fecha_ingreso->toDateString();
        expect(enLaVentana($guardado, 'estacionamiento.ronda'))
            ->toBeTrue('se guardo '.$guardado.' con la entrada '.json_encode($valor));
    }
})->with(fn () => hostilesConHoraCsae());

it('ESTACIONAMIENTO alerta: el campo `fecha` es una fecha de CORTE de informe y NO lleva ventana', function (int $dias) {
    // El campo se llama `fecha` como el de los formularios, pero consultar un corte antiguo es
    // legitimo. La consulta usa DATEDIFF (MySQL) y no corre en sqlite, asi que aqui solo se
    // exige lo que importa: que la validacion no lo rechace con un 422.
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $corte = Carbon::today()->addDays($dias)->toDateString();

    expect($this->getJson('/api/EstacionamientoSubTerraneo/alerta?fecha='.$corte)->status())->not->toBe(422);
})->with([
    'un corte de hace un anio' => [-365],
    'un corte de hace diez dias' => [-10],
    'un corte futuro' => [10],
]);

// ===========================================================================
// DESPACHO. Dos pantallas, y una es LA EXCEPCION:
//   - despacho.informacion_general: la fecha viaja DENTRO de `metadata` y el endpoint no la
//     validaba en absoluto. `walk_arounds.fecha` tiene cast `date`, asi que la edicion compara
//     con `diaQueGuardaElModelo()`.
//   - programadas.operacion: sin suelo y sin techo (se programa lo que aun no ha pasado).
//     Su regla va NOMBRADA aunque hoy no rechace nada, y no lleva semantica de edicion.
// ===========================================================================

/** El mensaje del campo `metadata.fecha` (lleva un punto: no se lee con `json('errors.…')`). */
function mensajeDeMetadata($respuesta): string
{
    return $respuesta->json('errors')['metadata.fecha'][0] ?? '';
}

/**
 * Lo que un alta de walk around puede escribir: sus filas y las dos tablas de catalogo de la
 * remota que el alta rellena antes de guardar.
 *
 * @return array{walkArounds: int, tipos: int, matriculas: int}
 */
function escrituraDeWalkAround(): array
{
    return [
        'walkArounds' => WalkAround::count(),
        'tipos' => DB::connection('remota')->table('tb_tipo')->count(),
        'matriculas' => DB::connection('remota')->table('tb_matricula')->count(),
    ];
}

/** @return array<string, mixed> */
function cargaDeWalkAround(mixed $fecha, bool $enviarFecha = true, string $destino = 'MMTO'): array
{
    // En minusculas y sin acento: las columnas `movimiento` y `tipo` son enum, y MySQL los compara
    // sin distinguir mayusculas ni acentos (el formulario manda `Salida` y `Avión`), pero la sqlite
    // de las pruebas si.
    $metadata = [
        'movimiento' => 'salida',
        'matricula' => 'XA-WLK',
        'aeronave' => 'avion',
        'tipo' => 'C172',
        'hora' => '10:30',
        'destino' => $destino,
        'procedencia' => null,
    ];
    if ($enviarFecha) {
        $metadata['fecha'] = $fecha;
    }

    return [
        'metadata' => $metadata,
        'inspeccionTecnica' => ['numeroEstaticas' => 0, 'checklist' => []],
        'cierreYFirmas' => ['observaciones' => null, 'nombreResponsable' => 'Resp Uno', 'nombreJefe' => 'Jefe Uno', 'nombreFbo' => 'Fbo Uno'],
    ];
}

function walkAroundParaEditar(string $fecha): WalkAround
{
    return WalkAround::create([
        'fecha' => $fecha,
        'movimiento' => 'salida',
        'matricula' => 'XA-WLK',
        'tipo' => 'avion',
        'tipo_aeronave' => 'C172',
        'tipo_aeronave_id' => 1,
        'hora' => '10:30',
        'destino' => 'MMTO',
        'status' => 'A',
    ]);
}

// --- Walk around: POST /api/walkarounds ---

it('WALKAROUND alta: rechaza con 422 y no escribe nada con una fecha fuera de ventana', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = escrituraDeWalkAround();

    $respuesta = $this->postJson('/api/walkarounds', cargaDeWalkAround(Carbon::today()->addDays($desplazamiento)->toDateString()));

    $respuesta->assertUnprocessable()->assertJsonValidationErrors('metadata.fecha');
    ['min' => $min, 'max' => $max] = fechasDelMensaje('despacho.informacion_general');
    expect(mensajeDeMetadata($respuesta))->toContain($min)->toContain($max);
    expect(escrituraDeWalkAround())->toBe($antes);
})->with([
    'en el futuro' => [1],
    'demasiado antigua' => [-4],
]);

it('WALKAROUND alta: no deja pasar una fecha vacia, ausente o ilegible (el required es nuevo)', function (mixed $fecha, bool $enviarFecha) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = escrituraDeWalkAround();

    $this->postJson('/api/walkarounds', cargaDeWalkAround($fecha, $enviarFecha))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('metadata.fecha');

    expect(escrituraDeWalkAround())->toBe($antes);
})->with([
    'vacia' => ['', true],
    'ausente' => [null, false],
    'ilegible' => ['no-es-una-fecha', true],
    'un arreglo' => [['2026-10-07'], true],
    'un booleano' => [true, true],
]);

it('WALKAROUND alta: una fecha dentro de ventana escribe, con su dia exacto (la regla no rechaza todo)', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $dia = Carbon::today()->addDays($desplazamiento)->toDateString();
    $antes = WalkAround::count();

    $this->postJson('/api/walkarounds', cargaDeWalkAround($dia))->assertCreated();

    expect(WalkAround::count())->toBe($antes + 1);
    expect(WalkAround::latest('id')->first()->fecha->toDateString())->toBe($dia);
})->with([
    'hoy' => [0],
    'ayer' => [-1],
    'el borde de atras (hace tres dias)' => [-3],
]);

it('WALKAROUND alta: la ventana se juzga ANTES que la secuencia y que cualquier escritura', function () {
    // Con una fecha fuera de ventana y el cuerpo casi vacio, lo primero que ocurre es el 422 de
    // la fecha: ni la secuencia de movimientos ni el alta de catalogo llegan a ejecutarse.
    $this->actingAs(usuarioAdmin(), 'sanctum');

    $this->postJson('/api/walkarounds', ['metadata' => ['fecha' => Carbon::today()->addDay()->toDateString()]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('metadata.fecha');
});

it('WALKAROUND alta: a las 19:00 de Mexico (ya es manana en UTC) hoy sigue siendo hoy y manana se rechaza', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $this->travelTo(Carbon::parse('2026-10-07 19:00:00', 'America/Mexico_City'));
    $antes = escrituraDeWalkAround();

    $this->postJson('/api/walkarounds', cargaDeWalkAround('2026-10-08'))
        ->assertUnprocessable()->assertJsonValidationErrors('metadata.fecha');
    expect(escrituraDeWalkAround())->toBe($antes);

    $this->postJson('/api/walkarounds', cargaDeWalkAround('2026-10-07'))->assertCreated();
    expect(WalkAround::latest('id')->first()->fecha->toDateString())->toBe('2026-10-07');
});

// --- Walk around: PUT y PATCH /api/walkarounds/{id} (las dos rutas son el MISMO metodo) ---

it('WALKAROUND edicion: rechaza con 422 y no modifica la fecha, por PUT y por PATCH', function (string $verbo, int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = Carbon::today()->toDateString();
    $walkAround = walkAroundParaEditar($original);

    $respuesta = $this->json($verbo, "/api/walkarounds/{$walkAround->id}", cargaDeWalkAround(Carbon::today()->addDays($desplazamiento)->toDateString()));

    $respuesta->assertUnprocessable()->assertJsonValidationErrors('metadata.fecha');
    ['min' => $min, 'max' => $max] = fechasDelMensaje('despacho.informacion_general');
    expect(mensajeDeMetadata($respuesta))->toContain($min)->toContain($max);
    expect($walkAround->fresh()->fecha->toDateString())->toBe($original);
})->with([
    'PUT al futuro' => ['PUT', 1],
    'PUT a una fecha antigua' => ['PUT', -4],
    'PATCH al futuro' => ['PATCH', 1],
    'PATCH a una fecha antigua' => ['PATCH', -4],
]);

it('WALKAROUND edicion: deja corregir otros campos de un registro antiguo si no se toca su fecha', function (string $verbo) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $walkAround = walkAroundParaEditar($antigua);

    $this->json($verbo, "/api/walkarounds/{$walkAround->id}", cargaDeWalkAround($antigua, true, 'MMMX'))->assertOk();

    expect($walkAround->fresh()->destino)->toBe('MMMX');
    expect($walkAround->fresh()->fecha->toDateString())->toBe($antigua);
})->with(['PUT', 'PATCH']);

it('WALKAROUND edicion: no deja pasar de una fecha antigua a OTRA antigua distinta, y la guardada no cambia', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $walkAround = walkAroundParaEditar($antigua);

    $this->putJson("/api/walkarounds/{$walkAround->id}", cargaDeWalkAround(Carbon::today()->subDays(20)->toDateString(), true, 'MMMX'))
        ->assertUnprocessable()->assertJsonValidationErrors('metadata.fecha');

    expect($walkAround->fresh()->fecha->toDateString())->toBe($antigua);
    expect($walkAround->fresh()->destino)->toBe('MMTO');
});

it('WALKAROUND edicion: no deja que lleve una fecha ausente o ilegible', function (mixed $fecha, bool $enviarFecha) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = Carbon::today()->toDateString();
    $walkAround = walkAroundParaEditar($original);

    $this->putJson("/api/walkarounds/{$walkAround->id}", cargaDeWalkAround($fecha, $enviarFecha, 'MMMX'))
        ->assertUnprocessable()->assertJsonValidationErrors('metadata.fecha');

    expect($walkAround->fresh()->fecha->toDateString())->toBe($original);
    expect($walkAround->fresh()->destino)->toBe('MMTO');
})->with([
    'ausente' => [null, false],
    'vacia' => ['', true],
    'ilegible' => ['no-es-una-fecha', true],
]);

it('WALKAROUND edicion: una fecha valida de hoy escribe la fecha (la edicion tiene camino feliz)', function (string $verbo) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $hoy = Carbon::today()->toDateString();
    $walkAround = walkAroundParaEditar(Carbon::today()->subDays(10)->toDateString());

    $this->json($verbo, "/api/walkarounds/{$walkAround->id}", cargaDeWalkAround($hoy))->assertOk();

    expect($walkAround->fresh()->fecha->toDateString())->toBe($hoy);
})->with(['PUT', 'PATCH']);

it('WALKAROUND edicion: mover la fecha a un dia DENTRO de ventana escribe (la edicion no rechaza todo cambio)', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $nueva = Carbon::today()->addDays($desplazamiento)->toDateString();
    $walkAround = walkAroundParaEditar(Carbon::today()->toDateString());

    $this->putJson("/api/walkarounds/{$walkAround->id}", cargaDeWalkAround($nueva))->assertOk();

    expect($walkAround->fresh()->fecha->toDateString())->toBe($nueva);
})->with([
    'ayer' => [-1],
    'el borde de atras (hace tres dias)' => [-3],
]);

it('WALKAROUND edicion: reenviar la misma fecha en otro formato cuenta como sin cambios', function (string $formato) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $walkAround = walkAroundParaEditar($antigua);

    $this->putJson("/api/walkarounds/{$walkAround->id}", cargaDeWalkAround(str_replace('{dia}', $antigua, $formato), true, 'MMMX'))->assertOk();

    expect($walkAround->fresh()->destino)->toBe('MMMX');
    expect($walkAround->fresh()->fecha->toDateString())->toBe($antigua);
})->with([
    'ISO con Z' => ['{dia}T00:00:00Z'],
    'con hora' => ['{dia} 00:00:00'],
    'ISO con desfase' => ['{dia}T00:00:00-06:00'],
]);

it('WALKAROUND edicion: el mismo dia con un sufijo relativo no cuenta como «sin cambios» (la columna tiene cast)', function (string $partida, string $sufijo) {
    // Comparar TEXTO aqui seria el agujero: `{hoy} +1 day` es distinto del guardado pero, si se
    // tomara por el mismo dia, se saltaria la ventana y la base guardaria manana.
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = fechaDePartida($partida);
    $walkAround = walkAroundParaEditar($original);

    $this->putJson("/api/walkarounds/{$walkAround->id}", cargaDeWalkAround($original.$sufijo))
        ->assertUnprocessable()->assertJsonValidationErrors('metadata.fecha');

    expect($walkAround->fresh()->fecha->toDateString())->toBe($original);
})->with([
    'hoy +1 day' => ['hoy', ' +1 day'],
    'hoy con hora y +1 day' => ['hoy', 'T08:30 +1 day'],
    'antigua +1 day' => ['antigua', ' +1 day'],
]);

// --- Walk around: el invariante, leyendo la columna ---

it('WALKAROUND ALTA: lo que la regla deja pasar queda guardado dentro de la ventana, se lea como se lea', function (mixed $valor) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = WalkAround::count();

    $this->postJson('/api/walkarounds', cargaDeWalkAround($valor));

    if (WalkAround::count() === $antes) {
        expect(WalkAround::count())->toBe($antes);

        return;
    }

    $guardado = WalkAround::latest('id')->first()->fecha->toDateString();
    expect(enLaVentana($guardado, 'despacho.informacion_general'))
        ->toBeTrue('se guardo '.$guardado.' con la entrada '.json_encode($valor));
})->with(fn () => fechasHostiles());

it('WALKAROUND EDICION: lo que la regla deja pasar deja la columna dentro de la ventana, o como estaba, por PUT y por PATCH', function (string $verbo, mixed $valor, string $partida) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = fechaDePartida($partida);
    $walkAround = walkAroundParaEditar($original);

    $this->json($verbo, "/api/walkarounds/{$walkAround->id}", cargaDeWalkAround($valor));

    $guardado = $walkAround->fresh()->fecha->toDateString();
    expect($guardado === $original || enLaVentana($guardado, 'despacho.informacion_general'))
        ->toBeTrue('de '.$original.' paso a '.$guardado.' con la entrada '.json_encode($valor));
})->with(function () {
    foreach (['PUT', 'PATCH'] as $verbo) {
        foreach (hostilesPorPartida() as $nombre => [$valor, $partida]) {
            yield "{$verbo} {$nombre}" => [$verbo, $valor, $partida];
        }
    }
});

// --- Operaciones programadas: LA EXCEPCION. POST y PUT /api/OperacionesProgramadas ---

/** @return array<string, mixed> */
function cargaDeProgramada(mixed $fecha, bool $enviarFecha = true, string $lugar = 'MMTO'): array
{
    $carga = ['tipo' => 'llegada', 'matricula' => 'XA-PRG', 'equipo' => 'C172', 'hora' => '10:30', 'lugar' => $lugar, 'pax' => 2];
    if ($enviarFecha) {
        $carga['fecha'] = $fecha;
    }

    return $carga;
}

function programadaParaEditar(string $fecha): OperacionProgramada
{
    return OperacionProgramada::create([
        'fecha' => $fecha,
        'tipo' => 'llegada',
        'matricula' => 'XA-PRG',
        'equipo' => 'C172',
        'hora' => '10:30',
        'lugar' => 'MMTO',
        'pax' => 2,
        'status' => OperacionProgramada::STATUS_ACTIVA,
    ]);
}

it('PROGRAMADAS alta: acepta cualquier dia, futuro o pasado (la excepcion: sin suelo y sin techo)', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $dia = Carbon::today()->addDays($desplazamiento)->toDateString();
    $antes = OperacionProgramada::count();

    $this->postJson('/api/OperacionesProgramadas', cargaDeProgramada($dia))->assertCreated();

    expect(OperacionProgramada::count())->toBe($antes + 1);
    expect(OperacionProgramada::latest('id')->first()->fecha->toDateString())->toBe($dia);
})->with([
    'hoy' => [0],
    'manana' => [1],
    'dentro de un mes' => [30],
    'dentro de un anio' => [365],
    'hace diez dias' => [-10],
    'hace un anio' => [-365],
]);

it('PROGRAMADAS edicion: tambien acepta cualquier dia, futuro o pasado (el Form Request de edicion extiende al de alta)', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $dia = Carbon::today()->addDays($desplazamiento)->toDateString();
    $programada = programadaParaEditar(Carbon::today()->toDateString());

    $this->putJson("/api/OperacionesProgramadas/{$programada->id}", cargaDeProgramada($dia, true, 'MMMX'))->assertOk();

    expect($programada->fresh()->fecha->toDateString())->toBe($dia);
    expect($programada->fresh()->lugar)->toBe('MMMX');
})->with([
    'manana' => [1],
    'dentro de un anio' => [365],
    'hace un anio' => [-365],
]);

it('PROGRAMADAS: sigue exigiendo una fecha legible, la excepcion no la deja opcional', function (mixed $fecha, bool $enviarFecha) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = OperacionProgramada::count();

    $this->postJson('/api/OperacionesProgramadas', cargaDeProgramada($fecha, $enviarFecha))
        ->assertUnprocessable()->assertJsonValidationErrors('fecha');

    expect(OperacionProgramada::count())->toBe($antes);
})->with([
    'vacia' => ['', true],
    'ausente' => [null, false],
    'ilegible' => ['no-es-una-fecha', true],
    'un arreglo' => [['2026-10-07'], true],
]);

it('LA EXCEPCION es una excepcion y no un agujero: la MISMA fecha futura se acepta en programadas y se rechaza en las demas', function (int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $futura = Carbon::today()->addDays($desplazamiento)->toDateString();
    $programadas = OperacionProgramada::count();
    $walkArounds = WalkAround::count();
    $operaciones = OperacionDiaria::count();

    // Aceptada donde la ventana tiene `futuro => true`…
    $this->postJson('/api/OperacionesProgramadas', cargaDeProgramada($futura))->assertCreated();
    expect(OperacionProgramada::count())->toBe($programadas + 1);

    // …y rechazada, con la misma fecha, en cada formulario que registra un hecho.
    $this->postJson('/api/walkarounds', cargaDeWalkAround($futura))
        ->assertUnprocessable()->assertJsonValidationErrors('metadata.fecha');
    $this->postJson('/api/OperacionesDiarias', cargaDeOperacion('Llegada', $futura))
        ->assertUnprocessable()->assertJsonValidationErrors('fecha');
    expect(WalkAround::count())->toBe($walkArounds);
    expect(OperacionDiaria::count())->toBe($operaciones);
})->with([
    'manana' => [1],
    'dentro de un mes' => [30],
]);

it('PROGRAMADAS: solo ella tiene `futuro` y solo ella carece de suelo (si otra lo tuviera, la excepcion se habria ensanchado)', function () {
    $conFuturo = array_keys(array_filter(VentanasDeFecha::CLAVES, fn ($v) => $v['futuro']));
    $sinSuelo = array_keys(array_filter(VentanasDeFecha::CLAVES, fn ($v) => $v['atras'] === null));

    expect($conFuturo)->toBe(['programadas.operacion'])
        ->and($sinSuelo)->toBe(['programadas.operacion']);
});

it('PROGRAMADAS: la regla de la excepcion esta NOMBRADA en el alta y en la edicion, aunque hoy no rechace nada', function (string $request) {
    // Es un no-op por diseno (sin suelo y sin techo), asi que ninguna peticion puede probar que
    // sigue ahi: se lee el arreglo de reglas. Si alguien la borra por «inutil», cae esta prueba y
    // la excepcion deja de estar escrita donde se ve.
    $reglas = (new $request)->rules()['fecha'];
    $claves = collect($reglas)
        ->filter(fn ($regla) => $regla instanceof DentroDeLaVentana)
        ->map(fn ($regla) => (new ReflectionProperty($regla, 'clave'))->getValue($regla))
        ->values()
        ->all();

    expect($claves)->toBe(['programadas.operacion'])
        ->and($reglas)->toContain('required')->toContain('date');
})->with([
    'alta' => [StoreOperacionProgramadaRequest::class],
    'edicion' => [UpdateOperacionProgramadaRequest::class],
]);

// ===========================================================================
// LOS FILTROS NO SE TOCAN. Es la red de lo unico que esta funcion podria romper sin ruido:
// que alguien ponga la regla en una BUSQUEDA o un INFORME y ya no se pueda consultar el mes
// pasado. De los 81 calendarios, 12 son filtros (ver §6 de la especificacion) y NO llevan
// ventana; sus endpoints de consulta tienen que aceptar cualquier rango, incluidos los de
// hace un anio. Cada prueba SIEMBRA un registro en ese dia antiguo y exige encontrarlo: un 200
// vacio no demuestra que el filtro funcione, y un 422 si demuestra que se rompio.
// ===========================================================================

/**
 * Los endpoints de consulta usan funciones de MySQL que sqlite no tiene. Se registran aqui, solo
 * para estas pruebas, para que la consulta CORRA de verdad y se pueda leer su resultado.
 */
function funcionesDeMysqlEnSqlite(): void
{
    $pdo = DB::connection()->getPdo();

    $pdo->sqliteCreateFunction('DATEDIFF', fn ($a, $b) => (int) round((strtotime((string) $a) - strtotime((string) $b)) / 86400), 2);
    $pdo->sqliteCreateFunction('DATE_FORMAT', function ($fecha, $formato) {
        $marca = strtotime((string) $fecha);

        return $marca === false ? null : strtr((string) $formato, [
            '%Y' => date('Y', $marca), '%m' => date('m', $marca), '%d' => date('d', $marca),
            '%H' => date('H', $marca), '%i' => date('i', $marca), '%s' => date('s', $marca),
        ]);
    }, 2);
    // El Excel de operaciones arma `fecha_hora` con CONCAT y STR_TO_DATE.
    $pdo->sqliteCreateFunction('CONCAT', fn (...$partes) => implode('', $partes), -1);
    $pdo->sqliteCreateFunction('STR_TO_DATE', fn ($texto, $formato) => $texto, 2);
}

/**
 * Rangos muy fuera de cualquier ventana de registro: el mes pasado, hace un anio, otro anio y
 * uno futuro. Cada uno es `[inicio, fin]` en `Y-m-d`, y el registro sembrado cae en el INICIO.
 *
 * @return array<string, array{0: string, 1: string}>
 */
function rangosDeConsulta(): array
{
    $hoy = Carbon::today();
    $mesPasado = $hoy->copy()->subMonthNoOverflow();

    return [
        'el mes pasado' => [$mesPasado->copy()->startOfMonth()->toDateString(), $mesPasado->copy()->endOfMonth()->toDateString()],
        'hace un anio' => [$hoy->copy()->subDays(365)->toDateString(), $hoy->copy()->subDays(358)->toDateString()],
        'todo el ultimo anio' => [$hoy->copy()->subDays(365)->toDateString(), $hoy->toDateString()],
        'un rango de dos anios atras' => [$hoy->copy()->subYears(2)->startOfMonth()->toDateString(), $hoy->copy()->subYears(2)->endOfMonth()->toDateString()],
        'un rango futuro' => [$hoy->copy()->addDays(30)->toDateString(), $hoy->copy()->addDays(60)->toDateString()],
    ];
}

function operacionDiariaEnElDia(string $dia, string $matricula = 'XA-FIL'): OperacionDiaria
{
    return OperacionDiaria::create([
        'user_id' => User::factory()->create()->id,
        'fecha' => $dia,
        'tipo' => 'llegada',
        'matricula' => $matricula,
        'equipo' => 'C172',
        'hora' => '10:30',
        'lugar' => 'MMTO',
        'pax' => 2,
        'departamento' => 'Trafico',
    ]);
}

function chalecoEnElDia(string $dia): PrestamoChaleco
{
    return PrestamoChaleco::create([
        'fecha' => $dia,
        'nombre_recibe' => 'Chaleco Fil',
        'usuario_entrega_id' => ($usuario = User::factory()->create())->id,
        'user_id' => $usuario->id,
    ]);
}

function plantaEnElDia(string $dia): RelacionPlanta
{
    return RelacionPlanta::create(['fecha' => $dia, 'empresa' => 'Empresa Fil', 'matricula' => 'XA-PLA', 'horometro_inicio' => 10]);
}

/** @param  array<string, mixed>  $parametros */
function consulta(string $ruta, array $parametros = []): Illuminate\Testing\TestResponse
{
    return test()->getJson($ruta.'?'.http_build_query($parametros));
}

/** Que la respuesta sea un exito Y mencione la marca sembrada: ni 422, ni un 200 vacio. */
function exitoQueIncluye(Illuminate\Testing\TestResponse $respuesta, string $marca): void
{
    $respuesta->assertSuccessful();
    expect($respuesta->getContent())->toContain($marca);
}

// --- Operaciones diarias: el listado, el Excel, el PDF y la verificacion de duplicados ---

it('FILTRO operaciones diarias: el listado acepta cualquier rango y encuentra lo sembrado ese dia', function (string $inicio, string $fin) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    operacionDiariaEnElDia($inicio);

    exitoQueIncluye(consulta('/api/OperacionesDiarias', ['fechaInicio' => $inicio, 'fechaFin' => $fin]), 'XA-FIL');
})->with(rangosDeConsulta());

it('FILTRO operaciones diarias: el selector de UN dia (solo fechaInicio) acepta cualquier dia', function (string $inicio, string $fin) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    operacionDiariaEnElDia($inicio);

    exitoQueIncluye(consulta('/api/OperacionesDiarias', ['fechaInicio' => $inicio]), 'XA-FIL');
})->with(rangosDeConsulta());

it('FILTRO operaciones diarias: el Excel y el PDF aceptan cualquier rango', function (string $ruta, string $inicio, string $fin) {
    funcionesDeMysqlEnSqlite();
    $this->actingAs(usuarioAdmin(), 'sanctum');
    operacionDiariaEnElDia($inicio);

    consulta($ruta, ['fechaInicio' => $inicio, 'fechaFin' => $fin])->assertSuccessful();
})->with(function () {
    foreach (rangosDeConsulta() as $nombre => [$inicio, $fin]) {
        yield "Excel, {$nombre}" => ['/api/OperacionesDiarias/Excel/', $inicio, $fin];
        yield "PDF, {$nombre}" => ['/api/OperacionesDiarias/Pdf/', $inicio, $fin];
    }
});

it('FILTRO operaciones diarias: verificar duplicados con `fecha` antigua no es un 422 y encuentra la operacion', function (string $inicio, string $fin) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $operacion = operacionDiariaEnElDia($inicio);
    // Sin la hora que sqlite le pega al guardar un `date`: la comparacion es por texto exacto.
    DB::table('operaciones_diarias')->where('id', $operacion->id)->update(['fecha' => $inicio]);

    $respuesta = consulta('/api/OperacionesDiarias/verificar', ['matricula' => 'XA-FIL', 'fecha' => $inicio, 'tipo' => 'llegada', 'modulo' => 'trafico']);

    $respuesta->assertSuccessful()->assertJsonPath('existe', true);
})->with(rangosDeConsulta());

// --- Operaciones programadas: el selector del dia y las pendientes ---

it('FILTRO programadas: el listado de un dia acepta cualquier dia, pasado o futuro', function (string $inicio, string $fin) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    programadaParaEditar($inicio);

    $respuesta = consulta('/api/OperacionesProgramadas', ['fecha' => $inicio]);

    exitoQueIncluye($respuesta, 'XA-PRG');
    expect($respuesta->json('fecha'))->toBe($inicio);
})->with(rangosDeConsulta());

it('FILTRO programadas: las pendientes filtradas por un dia antiguo siguen respondiendo', function (string $inicio, string $fin) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    programadaParaEditar($inicio);

    exitoQueIncluye(consulta('/api/OperacionesProgramadas/pendientes', ['modulo' => OperacionProgramada::MODULO_OPERACIONES_DIARIAS, 'fecha' => $inicio]), 'XA-PRG');
})->with(rangosDeConsulta());

// --- Control de medicamentos: buscar cierres, filtrar movimientos, exportar ---

it('FILTRO medicamentos: buscar cierres por un dia, o por un rango, acepta cualquier fecha', function (array $parametros, string $inicio) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    controlMedicamentoParaEditar($inicio);

    exitoQueIncluye(consulta('/api/ControlMedicamento/index', $parametros), 'Original');
})->with(function () {
    foreach (rangosDeConsulta() as $nombre => [$inicio, $fin]) {
        yield "un dia, {$nombre}" => [['fecha' => $inicio], $inicio];
        yield "un rango, {$nombre}" => [['fecha_inicio' => $inicio, 'fecha_fin' => $fin], $inicio];
    }
});

it('FILTRO medicamentos: los filtros de movimientos (dia y rango) aceptan cualquier fecha', function (string $ruta, array $parametros) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    controlMedicamentoParaEditar($parametros['fecha'] ?? $parametros['fecha_inicio']);

    consulta($ruta, $parametros)->assertSuccessful();
})->with(function () {
    foreach (rangosDeConsulta() as $nombre => [$inicio, $fin]) {
        yield "movimientos de un dia, {$nombre}" => ['/api/ControlMedicamento/ultimosMovimientos', ['periodo' => 'dia', 'fecha' => $inicio]];
        yield "movimientos de un rango, {$nombre}" => ['/api/ControlMedicamento/ultimosMovimientos', ['periodo' => 'rango', 'fecha_inicio' => $inicio, 'fecha_fin' => $fin]];
    }
});

it('FILTRO medicamentos: el PDF de cierres acepta un rango de hace un anio', function () {
    // UNA sola peticion a proposito: la vista `pdf.control-medicamento-cierres` declara una funcion
    // global dentro del Blade, y renderizarla dos veces en el mismo proceso muere con «Cannot
    // redeclare formatoFechaPdf()». En produccion cada peticion es un proceso, pero en la suite no.
    $this->actingAs(usuarioAdmin(), 'sanctum');
    [$inicio, $fin] = rangosDeConsulta()['hace un anio'];
    controlMedicamentoParaEditar($inicio);

    consulta('/api/ControlMedicamento/exportar-pdf', ['fecha_inicio' => $inicio, 'fecha_fin' => $fin])->assertSuccessful();
});

// --- Pernocta: el periodo de edicion, por dia o por rango ---

it('FILTRO pernocta: el listado por dia o por rango acepta cualquier fecha y encuentra lo sembrado', function (string $periodo, string $inicio, string $fin) {
    funcionesDeMysqlEnSqlite();
    $this->actingAs(usuarioAdmin(), 'sanctum');
    PernoctaDia::create(['fecha' => $inicio, 'matricula' => 'XA-FIL', 'nombre' => 'Vigilante Uno', 'ubicacion' => 'Hangar 1']);

    $parametros = $periodo === 'dia'
        ? ['periodo' => 'dia', 'fechaInicio' => $inicio, 'fechaFin' => $inicio]
        : ['periodo' => 'rango', 'fechaInicio' => $inicio, 'fechaFin' => $fin];

    exitoQueIncluye(consulta('/api/PernoctaDia', $parametros), 'XA-FIL');
})->with(function () {
    foreach (rangosDeConsulta() as $nombre => [$inicio, $fin]) {
        yield "un dia, {$nombre}" => ['dia', $inicio, $fin];
        yield "un rango, {$nombre}" => ['rango', $inicio, $fin];
    }
});

// --- CSAE: el periodo y el rango de entrada y de salida ---

it('FILTRO CSAE: el rango de SALIDA acepta cualquier fecha y encuentra lo sembrado ese dia', function (string $inicio, string $fin) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    movimientoCsaeParaEditar($inicio);

    exitoQueIncluye(consulta('/api/MovimientosCSAE', ['salida_inicio' => $inicio, 'salida_fin' => $fin]), 'XA-CSB');
})->with(rangosDeConsulta());

it('FILTRO CSAE: el rango de ENTRADA acepta cualquier fecha y encuentra lo sembrado ese dia', function (string $inicio, string $fin) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    MovimientoCSAE::create([
        'user_entrada_id' => User::factory()->create()->id,
        'fecha_hora_entrada' => $inicio.' 08:00:00',
        'matricula' => 'XA-CSB',
        'tipo_aeronave' => 'C172',
        'como_llega' => 'Vuelo',
        'transportista' => 'Aerolinea Uno',
    ]);

    exitoQueIncluye(consulta('/api/MovimientosCSAE', ['entrada_inicio' => $inicio, 'entrada_fin' => $fin]), 'XA-CSB');
})->with(rangosDeConsulta());

// --- Estacionamiento: `fecha` es una fecha de CORTE de informe, no de registro ---

it('FILTRO estacionamiento: la `fecha` de vehiculosMasDeCincoDias es un CORTE de informe y NO lleva ventana (encuentra la racha de ese corte)', function (int $diasAtras) {
    funcionesDeMysqlEnSqlite();
    $this->actingAs($usuario = usuarioAdmin(), 'sanctum');
    $corte = Carbon::today()->subDays($diasAtras);
    // Seis dias seguidos que TERMINAN en el corte: mas de cinco, asi que el informe lo lista.
    foreach (range(5, 0) as $atras) {
        EstacionamientoSubterraneo::create([
            'user_id' => $usuario->id, 'vehiculo' => 'Auto', 'color' => 'Rojo', 'placas' => 'RACHA-1', 'matricula' => 'N/A',
            'llaves' => 'SI', 'responsable' => 'Resp', 'oficial' => 'Oficial Uno',
            'fecha_ingreso' => $corte->copy()->subDays($atras)->toDateString(),
        ]);
    }

    $respuesta = consulta('/api/EstacionamientoSubTerraneo/alerta', ['fecha' => $corte->toDateString()]);

    $respuesta->assertSuccessful()
        ->assertJsonPath('fecha_corte', $corte->toDateString())
        ->assertJsonPath('total', 1)
        ->assertJsonPath('vehiculos.0.placas', 'RACHA-1');
})->with([
    'un corte de hace un anio' => [365],
    'un corte de hace un mes' => [30],
    'un corte de hace diez dias' => [10],
    'un corte de hace dos anios' => [730],
]);

it('FILTRO estacionamiento: un corte FUTURO tampoco se rechaza', function (int $dias) {
    funcionesDeMysqlEnSqlite();
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $corte = Carbon::today()->addDays($dias)->toDateString();

    consulta('/api/EstacionamientoSubTerraneo/alerta', ['fecha' => $corte])->assertSuccessful()->assertJsonPath('fecha_corte', $corte);
})->with(['manana' => [1], 'dentro de un mes' => [30]]);

it('FILTRO estacionamiento: una `fecha` que no es fecha SI es un 422 (la validacion de siempre, no la ventana)', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');

    consulta('/api/EstacionamientoSubTerraneo/alerta', ['fecha' => 'no-es-una-fecha'])->assertUnprocessable()->assertJsonValidationErrors('fecha');
});

// --- El resto de los modulos tocados: al menos UNA consulta de cada uno ---

it('FILTRO del resto de modulos: sus listados e informes aceptan cualquier rango y encuentran lo sembrado', function (string $ruta, array $parametros, string $marca, string $sembrar, string $inicio) {
    funcionesDeMysqlEnSqlite();
    $this->actingAs(usuarioAdmin(), 'sanctum');

    match ($sembrar) {
        'checklist' => checklistParaEditar($inicio),
        'comisariato' => comisariatoParaEditar($inicio),
        'rampa' => entregaRampaParaEditar($inicio),
        'turno' => turnoParaEditar($inicio),
        'remision' => remisionParaEditar($inicio),
        'walkaround' => walkAroundParaEditar($inicio),
        'chaleco' => chalecoEnElDia($inicio),
        'planta' => plantaEnElDia($inicio),
    };

    exitoQueIncluye(consulta($ruta, $parametros), $marca);
})->with(function () {
    foreach (rangosDeConsulta() as $nombre => [$inicio, $fin]) {
        yield "checklist de turno, {$nombre}" => ['/api/CheckListTurno', ['fechaInicio' => $inicio, 'fechaFin' => $fin], 'Original', 'checklist', $inicio];
        yield "comisariato, {$nombre}" => ['/api/ServicioComisariato', ['fechaInicio' => $inicio, 'fechaFin' => $fin], 'Original', 'comisariato', $inicio];
        yield "entrega de turno de rampa, {$nombre}" => ['/api/EntregaTurnoR/entrega-turno-rampa', ['periodo' => 'rango', 'fechaInicio' => $inicio, 'fechaFin' => $fin], 'Original', 'rampa', $inicio];
        yield "turno de autotanque, {$nombre}" => ['/api/TurnoAutoTanque', ['start' => $inicio, 'end' => $fin], 'Original', 'turno', $inicio];
        yield "servicio de autotanque, {$nombre}" => ['/api/Remision', ['type' => 'range', 'start' => $inicio, 'end' => $fin, 'vinculado' => 1], 'XA-REM', 'remision', $inicio];
        yield "walk around, {$nombre}" => ['/api/walkarounds', ['fecha_inicio' => $inicio, 'fecha_fin' => $fin], 'XA-WLK', 'walkaround', $inicio];
        yield "prestamo de chalecos, {$nombre}" => ['/api/PrestamoChalecos', ['fecha_inicio' => $inicio, 'fecha_fin' => $fin], 'Chaleco Fil', 'chaleco', $inicio];
        yield "planta GPU, {$nombre}" => ['/api/RelacionPlanta/historico', ['fecha_inicio' => $inicio, 'fecha_fin' => $fin], 'XA-PLA', 'planta', $inicio];
    }
});

it('FILTRO de las bitacoras: desde/hasta acepta cualquier rango (no son fechas de registro)', function (string $ruta, string $inicio, string $fin) {
    $this->actingAs(usuarioAdmin(), 'sanctum');

    consulta($ruta, ['desde' => $inicio, 'hasta' => $fin])->assertSuccessful();
})->with(function () {
    foreach (rangosDeConsulta() as $nombre => [$inicio, $fin]) {
        yield "bitacoras, {$nombre}" => ['/api/bitacoras', $inicio, $fin];
        yield "bitacora de walk around, {$nombre}" => ['/api/walkarounds/bitacora', $inicio, $fin];
    }
});
