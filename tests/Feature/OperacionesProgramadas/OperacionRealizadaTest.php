<?php

use App\Models\OperacionDiaria;
use App\Models\OperacionProgramada;
use App\Models\User;
use App\Models\WalkAround;

/*
 * El registro en Operaciones Diarias da por realizada la programación: sale del
 * tablero de Despacho pero WalkAround la sigue viendo pendiente hasta que
 * también la use.
 */

function programadaDelDia(array $extra = []): OperacionProgramada
{
    return OperacionProgramada::create(array_merge([
        'fecha' => '2026-09-15',
        'tipo' => 'salida',
        'matricula' => 'XA-ABC',
        'equipo' => 'C172',
        'hora' => '10:30',
        'lugar' => 'MMTO',
        'status' => OperacionProgramada::STATUS_ACTIVA,
    ], $extra));
}

function registroDiario(): OperacionDiaria
{
    return OperacionDiaria::create([
        'user_id' => User::factory()->create()->id,
        'fecha' => '2026-09-15',
        'tipo' => 'salida',
        'matricula' => 'XA-ABC',
        'equipo' => 'C172',
        'hora' => '10:30',
        'lugar' => 'MMTO',
        'pax' => 2,
        'departamento' => 'Trafico',
    ]);
}

function registroWalk(): WalkAround
{
    return WalkAround::create([
        'fecha' => '2026-09-15',
        'movimiento' => 'salida',
        'matricula' => 'XA-ABC',
        'tipo' => 'avion',
        'tipo_aeronave' => 'C172',
        'tipo_aeronave_id' => 1,
        'hora' => '10:30',
        'status' => 'A',
    ]);
}

test('usarla en Operaciones Diarias la deja como realizada', function () {
    $programada = programadaDelDia();

    OperacionProgramada::vincular($programada->id, registroDiario());

    expect($programada->fresh()->status)->toBe(OperacionProgramada::STATUS_REALIZADA);
});

test('usarla en WalkAround no cambia su estado', function () {
    $programada = programadaDelDia();

    OperacionProgramada::vincular($programada->id, registroWalk());

    expect($programada->fresh()->status)->toBe(OperacionProgramada::STATUS_ACTIVA);
});

test('una operacion realizada desaparece del tablero de Despacho', function () {
    $this->actingAs(usuarioAdmin());

    $programada = programadaDelDia();

    $this->getJson('/api/OperacionesProgramadas?fecha=2026-09-15')
        ->assertOk()
        ->assertJsonCount(1, 'salidas');

    OperacionProgramada::vincular($programada->id, registroDiario());

    $this->getJson('/api/OperacionesProgramadas?fecha=2026-09-15')
        ->assertOk()
        ->assertJsonCount(0, 'salidas')
        ->assertJsonCount(0, 'llegadas');
});

test('una operacion realizada sigue pendiente para WalkAround', function () {
    $this->actingAs(usuarioAdmin());

    $programada = programadaDelDia();
    OperacionProgramada::vincular($programada->id, registroDiario());

    $this->getJson('/api/OperacionesProgramadas/pendientes?modulo=walkaround&fecha=2026-09-15')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.matricula', 'XA-ABC');

    $this->getJson('/api/OperacionesProgramadas/pendientes?modulo=operaciones_diarias&fecha=2026-09-15')
        ->assertOk()
        ->assertJsonCount(0);
});

test('WalkAround todavia puede usar una operacion ya realizada', function () {
    $programada = programadaDelDia();

    OperacionProgramada::vincular($programada->id, registroDiario());
    OperacionProgramada::vincular($programada->id, registroWalk());

    expect($programada->fresh()->status)->toBe(OperacionProgramada::STATUS_REALIZADA)
        ->and($programada->usos()->count())->toBe(2);
});

test('cuando ambos modulos la usaron deja de aparecer en los dos', function () {
    $this->actingAs(usuarioAdmin());

    $programada = programadaDelDia();
    OperacionProgramada::vincular($programada->id, registroDiario());
    OperacionProgramada::vincular($programada->id, registroWalk());

    $this->getJson('/api/OperacionesProgramadas/pendientes?modulo=walkaround&fecha=2026-09-15')
        ->assertOk()
        ->assertJsonCount(0);
});

test('una programacion cancelada sigue sin poder vincularse', function () {
    $programada = programadaDelDia(['status' => OperacionProgramada::STATUS_CANCELADA]);

    expect(fn () => OperacionProgramada::vincular($programada->id, registroDiario()))
        ->toThrow(Symfony\Component\HttpKernel\Exception\HttpException::class);
});

test('una cancelada tampoco aparece como pendiente para WalkAround', function () {
    $this->actingAs(usuarioAdmin());

    programadaDelDia(['status' => OperacionProgramada::STATUS_CANCELADA]);

    $this->getJson('/api/OperacionesProgramadas/pendientes?modulo=walkaround&fecha=2026-09-15')
        ->assertOk()
        ->assertJsonCount(0);
});

test('una operacion realizada ya no puede editarse', function () {
    $this->actingAs(usuarioConSubdepartamento());

    $programada = programadaDelDia();
    OperacionProgramada::vincular($programada->id, registroDiario());

    $this->putJson("/api/OperacionesProgramadas/{$programada->id}", [
        'fecha' => '2026-09-15',
        'tipo' => 'salida',
        'matricula' => 'XA-ABC',
        'equipo' => 'C172',
        'hora' => '18:00',
    ])->assertStatus(422)
        ->assertJsonPath('message', 'La operación programada ya fue realizada y ya no puede editarse.');

    expect($programada->fresh()->hora)->toStartWith('10:30');
});

test('una operacion realizada ya no puede eliminarse', function () {
    $this->actingAs(usuarioConSubdepartamento());

    $programada = programadaDelDia();
    OperacionProgramada::vincular($programada->id, registroDiario());

    $this->deleteJson("/api/OperacionesProgramadas/{$programada->id}")
        ->assertStatus(422)
        ->assertJsonPath('message', 'La operación programada ya fue realizada y no puede eliminarse.');

    expect($programada->fresh()->status)->toBe(OperacionProgramada::STATUS_REALIZADA);
});

test('el registro real de Operaciones Diarias se conserva intacto', function () {
    $programada = programadaDelDia();
    $operacion = registroDiario();

    OperacionProgramada::vincular($programada->id, $operacion);

    expect(OperacionDiaria::find($operacion->id))->not->toBeNull()
        ->and(OperacionDiaria::find($operacion->id)->matricula)->toBe('XA-ABC');
});
