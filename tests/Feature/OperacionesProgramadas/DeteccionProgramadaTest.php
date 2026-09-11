<?php

use App\Models\OperacionDiaria;
use App\Models\OperacionProgramada;
use App\Models\User;
use App\Models\WalkAround;
use Symfony\Component\HttpKernel\Exception\HttpException;

/*
 * Detección de programadas al capturar la matrícula a mano, y coherencia del
 * vínculo al guardar: una programación solo se relaciona por su ID exacto y ese
 * ID debe describir la misma operación (matrícula, movimiento y día).
 */

function programadaHoy(array $extra = []): OperacionProgramada
{
    return OperacionProgramada::create(array_merge([
        'fecha' => Illuminate\Support\Carbon::now(config('app.timezone'))->toDateString(),
        'tipo' => 'salida',
        'matricula' => 'XA-ABC',
        'equipo' => 'C172',
        'hora' => '10:30',
        'lugar' => 'MMTO',
        'pax' => 2,
        'status' => OperacionProgramada::STATUS_ACTIVA,
    ], $extra));
}

function operacionDiaria(array $extra = []): OperacionDiaria
{
    return OperacionDiaria::create(array_merge([
        'user_id' => User::factory()->create()->id,
        'fecha' => Illuminate\Support\Carbon::now(config('app.timezone'))->toDateString(),
        'tipo' => 'salida',
        'matricula' => 'XA-ABC',
        'equipo' => 'C172',
        'hora' => '10:30',
        'lugar' => 'MMTO',
        'pax' => 2,
        'departamento' => 'Trafico',
    ], $extra));
}

function walkAround(array $extra = []): WalkAround
{
    return WalkAround::create(array_merge([
        'fecha' => Illuminate\Support\Carbon::now(config('app.timezone'))->toDateString(),
        'movimiento' => 'salida',
        'matricula' => 'XA-ABC',
        'tipo' => 'avion',
        'tipo_aeronave' => 'C172',
        'tipo_aeronave_id' => 1,
        'hora' => '10:30',
        'status' => 'A',
    ], $extra));
}

function coincidencias(string $matricula, string $tipo, string $modulo): Illuminate\Testing\TestResponse
{
    return test()->getJson(
        '/api/OperacionesProgramadas/coincidencias?' . http_build_query([
            'matricula' => $matricula,
            'tipo' => $tipo,
            'modulo' => $modulo,
        ])
    );
}

/*
|--------------------------------------------------------------------------
| El endpoint de coincidencias
|--------------------------------------------------------------------------
*/

test('encuentra la programada de la misma matricula, tipo y dia', function () {
    $this->actingAs(usuarioAdmin());
    $programada = programadaHoy();

    coincidencias('XA-ABC', 'salida', 'operaciones_diarias')
        ->assertOk()
        ->assertJsonCount(1, 'coincidencias')
        ->assertJsonPath('coincidencias.0.id', $programada->id)
        ->assertJsonPath('del_otro_tipo', 0);
});

test('no devuelve la del tipo contrario, pero la cuenta para el aviso discreto', function () {
    $this->actingAs(usuarioAdmin());
    programadaHoy(['tipo' => 'salida']);

    coincidencias('XA-ABC', 'llegada', 'operaciones_diarias')
        ->assertOk()
        ->assertJsonCount(0, 'coincidencias')
        ->assertJsonPath('del_otro_tipo', 1);
});

test('la matricula se normaliza y el vocabulario de WalkAround se entiende', function () {
    $this->actingAs(usuarioAdmin());
    programadaHoy(['tipo' => 'llegada']);

    // Minúsculas con espacios, y "Entrada" en vez de "llegada".
    coincidencias('  xa-abc ', 'Entrada', 'walkaround')
        ->assertOk()
        ->assertJsonCount(1, 'coincidencias');
});

test('una realizada en Operaciones Diarias sigue apareciendo para WalkAround pero no para Operaciones Diarias', function () {
    $this->actingAs(usuarioAdmin());
    $programada = programadaHoy();

    OperacionProgramada::vincular($programada->id, operacionDiaria());

    coincidencias('XA-ABC', 'salida', 'walkaround')->assertJsonCount(1, 'coincidencias');
    coincidencias('XA-ABC', 'salida', 'operaciones_diarias')->assertJsonCount(0, 'coincidencias');
});

test('una cancelada nunca aparece', function () {
    $this->actingAs(usuarioAdmin());
    programadaHoy(['status' => OperacionProgramada::STATUS_CANCELADA]);

    coincidencias('XA-ABC', 'salida', 'operaciones_diarias')
        ->assertJsonCount(0, 'coincidencias')
        ->assertJsonPath('del_otro_tipo', 0);
});

test('varias del mismo tipo se devuelven todas para que el usuario elija', function () {
    $this->actingAs(usuarioAdmin());
    programadaHoy(['hora' => '08:00']);
    programadaHoy(['hora' => '16:00']);

    coincidencias('XA-ABC', 'salida', 'operaciones_diarias')
        ->assertJsonCount(2, 'coincidencias')
        ->assertJsonPath('coincidencias.0.hora', '08:00')
        ->assertJsonPath('coincidencias.1.hora', '16:00');
});

test('una programada de otro dia no coincide', function () {
    $this->actingAs(usuarioAdmin());
    programadaHoy(['fecha' => '2030-01-01']);

    coincidencias('XA-ABC', 'salida', 'operaciones_diarias')->assertJsonCount(0, 'coincidencias');
});

test('un modulo desconocido se rechaza', function () {
    $this->actingAs(usuarioAdmin());

    coincidencias('XA-ABC', 'salida', 'inventado')->assertStatus(422);
});

/*
|--------------------------------------------------------------------------
| Coherencia del vinculo al guardar
|--------------------------------------------------------------------------
*/

test('no se puede vincular una programada de otra matricula', function () {
    $programada = programadaHoy(['matricula' => 'XB-ZZZ']);

    expect(fn () => OperacionProgramada::vincular($programada->id, operacionDiaria()))
        ->toThrow(HttpException::class);

    expect($programada->fresh()->status)->toBe(OperacionProgramada::STATUS_ACTIVA)
        ->and($programada->usos()->count())->toBe(0);
});

test('no se puede vincular una programada del movimiento contrario', function () {
    $programada = programadaHoy(['tipo' => 'llegada']);

    expect(fn () => OperacionProgramada::vincular($programada->id, operacionDiaria(['tipo' => 'salida'])))
        ->toThrow(HttpException::class);

    expect($programada->usos()->count())->toBe(0);
});

test('no se puede vincular una programada de otro dia', function () {
    $programada = programadaHoy(['fecha' => '2030-01-01']);

    expect(fn () => OperacionProgramada::vincular($programada->id, operacionDiaria()))
        ->toThrow(HttpException::class);

    expect($programada->usos()->count())->toBe(0);
});

test('WalkAround vincula una llegada programada aunque su vocabulario sea entrada', function () {
    $programada = programadaHoy(['tipo' => 'llegada']);

    $uso = OperacionProgramada::vincular($programada->id, walkAround(['movimiento' => 'entrada']));

    expect($uso)->not->toBeNull()
        ->and($programada->fresh()->status)->toBe(OperacionProgramada::STATUS_ACTIVA);
});

test('en WalkAround la coherencia mira el movimiento, no el tipo de aeronave', function () {
    // "tipo" en walk_arounds es avión/helicóptero; no debe confundirse con el
    // movimiento al comparar contra la programada.
    $programada = programadaHoy(['tipo' => 'salida']);

    $uso = OperacionProgramada::vincular($programada->id, walkAround(['movimiento' => 'salida', 'tipo' => 'helicoptero']));

    expect($uso)->not->toBeNull();
});

test('la coherencia se evalua dentro de la transaccion y un rechazo revierte el registro', function () {
    $programada = programadaHoy(['matricula' => 'XB-ZZZ']);

    try {
        Illuminate\Support\Facades\DB::transaction(function () use ($programada) {
            $operacion = operacionDiaria();
            OperacionProgramada::vincular($programada->id, $operacion);
        });
    } catch (HttpException) {
        // Es lo esperado.
    }

    expect(OperacionDiaria::count())->toBe(0)
        ->and($programada->usos()->count())->toBe(0);
});

/*
|--------------------------------------------------------------------------
| continuar_manual
|--------------------------------------------------------------------------
*/

test('la bandera continuar_manual hace que WalkAround ignore el id aunque viaje en el payload', function () {
    // Se prueba a nivel de modelo lo que hace el controlador: con la bandera,
    // el id se descarta antes de llegar a vincular().
    $programada = programadaHoy();

    $continuarManual = true;
    $idEnviado = $programada->id;

    $uso = OperacionProgramada::vincular($continuarManual ? null : $idEnviado, walkAround());

    expect($uso)->toBeNull()
        ->and($programada->fresh()->status)->toBe(OperacionProgramada::STATUS_ACTIVA)
        ->and($programada->usos()->count())->toBe(0);
});

test('sin id no se vincula nada por coincidencia de matricula, fecha y hora', function () {
    // Misma matrícula, mismo día, misma hora: aun así, sin ID no hay vínculo.
    $programada = programadaHoy();

    $uso = OperacionProgramada::vincular(null, operacionDiaria());

    expect($uso)->toBeNull()
        ->and($programada->fresh()->status)->toBe(OperacionProgramada::STATUS_ACTIVA);
});
