<?php

use App\Events\OperacionProgramadaCambio;
use App\Models\OperacionDiaria;
use App\Models\OperacionProgramada;
use App\Models\User;
use App\Models\WalkAround;
use Illuminate\Support\Facades\Event;

function payloadProgramada(array $extra = []): array
{
    return array_merge([
        'fecha' => '2026-09-10',
        'tipo' => 'salida',
        'matricula' => 'XA-ABC',
        'equipo' => 'C172',
        'hora' => '10:30',
        'lugar' => 'MMTO',
        'pax' => 3,
    ], $extra);
}

function programadaEnBd(array $extra = []): OperacionProgramada
{
    return OperacionProgramada::create(array_merge([
        'fecha' => '2026-09-10',
        'tipo' => 'salida',
        'matricula' => 'XA-ABC',
        'equipo' => 'C172',
        'hora' => '10:30',
        'lugar' => 'MMTO',
        'status' => OperacionProgramada::STATUS_ACTIVA,
    ], $extra));
}

test('programar una operacion emite el evento de creada', function () {
    Event::fake([OperacionProgramadaCambio::class]);
    $this->actingAs(usuarioAdmin());

    $id = $this->postJson('/api/OperacionesProgramadas', payloadProgramada())
        ->assertCreated()
        ->json('operacion.id');

    Event::assertDispatched(
        OperacionProgramadaCambio::class,
        fn (OperacionProgramadaCambio $evento) => $evento->id === $id
            && $evento->accion === OperacionProgramadaCambio::ACCION_CREADA
            && $evento->fecha === '2026-09-10'
            && $evento->tipo === 'salida'
            && $evento->modulo === null
    );
});

test('el evento viaja por el canal publico de operaciones programadas', function () {
    $evento = new OperacionProgramadaCambio(
        id: 7,
        accion: OperacionProgramadaCambio::ACCION_CREADA,
        fecha: '2026-09-10',
        tipo: 'salida',
    );

    $canales = array_map(fn ($c) => $c->name, $evento->broadcastOn());

    // Viaja al canal interno y al público de la televisión, con la misma carga.
    expect($canales)->toBe(['operaciones-programadas', 'pantalla-programadas'])
        ->and($evento->broadcastWith())->toBe([
            'id' => 7,
            'accion' => 'creada',
            'fecha' => '2026-09-10',
            'tipo' => 'salida',
            'fecha_anterior' => null,
            'modulo' => null,
        ]);
});

test('actualizar informa la fecha anterior para que los clientes sepan si salio de su dia', function () {
    Event::fake([OperacionProgramadaCambio::class]);
    $this->actingAs(usuarioConSubdepartamento());

    $id = $this->postJson('/api/OperacionesProgramadas', payloadProgramada())->json('operacion.id');

    $this->putJson("/api/OperacionesProgramadas/{$id}", payloadProgramada([
        'fecha' => '2026-09-12',
        'tipo' => 'llegada',
    ]))->assertOk();

    Event::assertDispatched(
        OperacionProgramadaCambio::class,
        fn (OperacionProgramadaCambio $evento) => $evento->accion === OperacionProgramadaCambio::ACCION_ACTUALIZADA
            && $evento->fecha === '2026-09-12'
            && $evento->fechaAnterior === '2026-09-10'
            && $evento->tipo === 'llegada'
    );
});

test('eliminar emite el evento con la fecha de la operacion', function () {
    Event::fake([OperacionProgramadaCambio::class]);
    $this->actingAs(usuarioConSubdepartamento());

    $id = $this->postJson('/api/OperacionesProgramadas', payloadProgramada())->json('operacion.id');

    $this->deleteJson("/api/OperacionesProgramadas/{$id}")->assertOk();

    Event::assertDispatched(
        OperacionProgramadaCambio::class,
        fn (OperacionProgramadaCambio $evento) => $evento->id === $id
            && $evento->accion === OperacionProgramadaCambio::ACCION_ELIMINADA
            && $evento->fecha === '2026-09-10'
    );
});

test('una programacion rechazada por una matricula restringida no emite nada', function () {
    $this->actingAs(usuarioAdmin());

    App\Models\MatriculaRestringida::create([
        'matricula' => 'XA-ABC',
        'llegada' => true,
        'salida' => false,
    ]);

    Event::fake([OperacionProgramadaCambio::class]);

    $this->postJson('/api/OperacionesProgramadas', payloadProgramada(['tipo' => 'llegada']))
        ->assertStatus(422);

    Event::assertNotDispatched(OperacionProgramadaCambio::class);
});

test('actualizar una operacion cancelada no emite nada', function () {
    $this->actingAs(usuarioConSubdepartamento());

    $id = $this->postJson('/api/OperacionesProgramadas', payloadProgramada())->json('operacion.id');
    $this->deleteJson("/api/OperacionesProgramadas/{$id}")->assertOk();

    Event::fake([OperacionProgramadaCambio::class]);

    $this->putJson("/api/OperacionesProgramadas/{$id}", payloadProgramada(['hora' => '18:00']))
        ->assertStatus(422);

    Event::assertNotDispatched(OperacionProgramadaCambio::class);
});

test('usar una programacion en WalkAround emite utilizada solo para ese modulo', function () {
    Event::fake([OperacionProgramadaCambio::class]);

    $programada = programadaEnBd();

    $walkAround = WalkAround::create([
        'fecha' => '2026-09-10',
        'movimiento' => 'salida',
        'matricula' => 'XA-ABC',
        'tipo' => 'avion',
        'tipo_aeronave' => 'C172',
        'tipo_aeronave_id' => 1,
        'hora' => '10:30',
        'status' => 'A',
    ]);

    OperacionProgramada::vincular($programada->id, $walkAround);

    OperacionProgramadaCambio::emitir(
        $programada,
        OperacionProgramadaCambio::ACCION_UTILIZADA,
        modulo: OperacionProgramada::MODULO_WALKAROUND,
    );

    Event::assertDispatched(
        OperacionProgramadaCambio::class,
        fn (OperacionProgramadaCambio $evento) => $evento->id === $programada->id
            && $evento->accion === OperacionProgramadaCambio::ACCION_UTILIZADA
            && $evento->modulo === 'walkaround'
            && $evento->fecha === '2026-09-10'
    );
});

test('el evento no se emite cuando no hubo programacion vinculada', function () {
    Event::fake([OperacionProgramadaCambio::class]);

    expect(OperacionProgramada::vincular(null, programadaEnBd()))->toBeNull();

    Event::assertNotDispatched(OperacionProgramadaCambio::class);
});

test('un fallo al emitir no interrumpe el guardado', function () {
    // El evento se emite sobre una operación que ya está confirmada en base de
    // datos; si el servidor de websockets falla, solo queda registrado en el log.
    Event::listen(OperacionProgramadaCambio::class, function () {
        throw new RuntimeException('Reverb caído');
    });

    $programada = programadaEnBd();

    OperacionProgramadaCambio::emitir($programada, OperacionProgramadaCambio::ACCION_CREADA);

    expect(OperacionProgramada::find($programada->id))->not->toBeNull();
});
