<?php

use App\Models\OperacionDiaria;
use App\Models\OperacionProgramada;
use App\Models\User;
use App\Models\WalkAround;

function programacion(array $extra = []): OperacionProgramada
{
    return OperacionProgramada::create(array_merge([
        'fecha' => '2026-09-10',
        'tipo' => 'salida',
        'matricula' => 'XA-ABC',
        'equipo' => 'C172',
        'hora' => '10:30',
        'lugar' => 'MMTO',
        'pax' => 3,
        'status' => OperacionProgramada::STATUS_ACTIVA,
    ], $extra));
}

function registroOperacionDiaria(): OperacionDiaria
{
    return OperacionDiaria::create([
        'user_id' => User::factory()->create()->id,
        'fecha' => '2026-09-10',
        'tipo' => 'salida',
        'matricula' => 'XA-ABC',
        'equipo' => 'C172',
        'hora' => '10:30',
        'lugar' => 'MMTO',
        'pax' => 3,
        'departamento' => 'Trafico',
    ]);
}

function registroWalkAround(): WalkAround
{
    return WalkAround::create([
        'fecha' => '2026-09-10',
        'movimiento' => 'salida',
        'matricula' => 'XA-ABC',
        'tipo' => 'avion',
        'tipo_aeronave' => 'C172',
        'tipo_aeronave_id' => 1,
        'hora' => '10:30',
        'status' => 'A',
    ]);
}

test('una misma programacion puede usarse en Operaciones Diarias y en WalkAround', function () {
    $programada = programacion();

    OperacionProgramada::vincular($programada->id, registroOperacionDiaria());
    OperacionProgramada::vincular($programada->id, registroWalkAround());

    expect($programada->usos()->count())->toBe(2)
        ->and($programada->usadaEn(OperacionProgramada::MODULO_OPERACIONES_DIARIAS))->toBeTrue()
        ->and($programada->usadaEn(OperacionProgramada::MODULO_WALKAROUND))->toBeTrue();
});

test('no se puede usar dos veces la misma programacion en el mismo modulo', function () {
    $programada = programacion();

    OperacionProgramada::vincular($programada->id, registroOperacionDiaria());

    expect(fn () => OperacionProgramada::vincular($programada->id, registroOperacionDiaria()))
        ->toThrow(Symfony\Component\HttpKernel\Exception\HttpException::class);

    expect($programada->usos()->count())->toBe(1);
});

test('completar un modulo no oculta la programacion del otro', function () {
    $this->actingAs(usuarioAdmin());

    $programada = programacion();
    OperacionProgramada::vincular($programada->id, registroOperacionDiaria());

    $this->getJson('/api/OperacionesProgramadas/pendientes?modulo=operaciones_diarias&fecha=2026-09-10')
        ->assertOk()
        ->assertJsonCount(0);

    $this->getJson('/api/OperacionesProgramadas/pendientes?modulo=walkaround&fecha=2026-09-10')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.matricula', 'XA-ABC');
});

test('los pendientes se pueden filtrar por tipo de movimiento', function () {
    $this->actingAs(usuarioAdmin());

    programacion();
    programacion(['matricula' => 'XB-ZZZ', 'tipo' => 'llegada', 'hora' => '12:00']);

    $this->getJson('/api/OperacionesProgramadas/pendientes?modulo=operaciones_diarias&fecha=2026-09-10&tipo=llegada')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.matricula', 'XB-ZZZ');
});

test('una programacion cancelada deja de aparecer como pendiente', function () {
    $this->actingAs(usuarioAdmin());

    $programada = programacion();
    $programada->update(['status' => OperacionProgramada::STATUS_CANCELADA]);

    $this->getJson('/api/OperacionesProgramadas/pendientes?modulo=walkaround&fecha=2026-09-10')
        ->assertOk()
        ->assertJsonCount(0);
});

test('un modulo desconocido no devuelve pendientes', function () {
    $this->actingAs(usuarioAdmin());

    programacion();

    $this->getJson('/api/OperacionesProgramadas/pendientes?modulo=inventado')
        ->assertStatus(422);
});

test('vincular sin id no hace nada y no rompe el guardado manual', function () {
    expect(OperacionProgramada::vincular(null, registroOperacionDiaria()))->toBeNull();
});

test('no se puede vincular una programacion cancelada', function () {
    $programada = programacion(['status' => OperacionProgramada::STATUS_CANCELADA]);

    expect(fn () => OperacionProgramada::vincular($programada->id, registroOperacionDiaria()))
        ->toThrow(Symfony\Component\HttpKernel\Exception\HttpException::class);
});

test('el listado informa en que modulos ya se uso la programacion', function () {
    $this->actingAs(usuarioAdmin());

    $programada = programacion();
    OperacionProgramada::vincular($programada->id, registroWalkAround());

    $this->getJson('/api/OperacionesProgramadas?fecha=2026-09-10')
        ->assertOk()
        ->assertJsonPath('salidas.0.modulos_usados', ['walkaround']);
});

test('los pendientes incluyen las operaciones de horas futuras del mismo dia', function () {
    $this->actingAs(usuarioAdmin());

    $hoy = Illuminate\Support\Carbon::now(config('app.timezone'))->toDateString();

    programacion(['fecha' => $hoy, 'hora' => '00:01', 'matricula' => 'XA-TEMPRANO']);
    programacion(['fecha' => $hoy, 'hora' => '23:59', 'matricula' => 'XB-TARDE', 'tipo' => 'llegada']);

    // La hora nunca filtra: se ofrecen todas las operaciones del día.
    $this->getJson("/api/OperacionesProgramadas/pendientes?modulo=operaciones_diarias&fecha={$hoy}")
        ->assertOk()
        ->assertJsonCount(2);

    $this->getJson("/api/OperacionesProgramadas/pendientes?modulo=walkaround&fecha={$hoy}")
        ->assertOk()
        ->assertJsonCount(2);
});
