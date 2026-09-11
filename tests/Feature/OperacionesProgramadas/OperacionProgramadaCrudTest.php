<?php

use App\Models\OperacionDiaria;
use App\Models\OperacionProgramada;
use App\Models\User;

function payloadSalida(array $extra = []): array
{
    return array_merge([
        'fecha' => '2026-09-10',
        'tipo' => 'salida',
        'matricula' => 'XA-ABC',
        'equipo' => 'C172',
        'hora' => '10:30',
        'lugar' => 'MMTO',
        'pax' => 3,
        'fp' => 'PLAN 1204',
        'observaciones' => 'Sale con combustible completo',
    ], $extra);
}

test('despacho puede programar una salida para una fecha futura', function () {
    $this->actingAs(usuarioConSubdepartamento());

    $respuesta = $this->postJson('/api/OperacionesProgramadas', payloadSalida());

    $respuesta->assertCreated()
        ->assertJsonPath('operacion.tipo', 'salida')
        ->assertJsonPath('operacion.matricula', 'XA-ABC')
        ->assertJsonPath('operacion.fp', 'PLAN 1204')
        ->assertJsonPath('operacion.hora', '10:30');

    expect(OperacionProgramada::count())->toBe(1);
});

test('una llegada no guarda datos de plan de vuelo', function () {
    $this->actingAs(usuarioAdmin());

    $this->postJson('/api/OperacionesProgramadas', payloadSalida([
        'tipo' => 'llegada',
        'fp' => 'PLAN 999',
    ]))->assertCreated();

    expect(OperacionProgramada::first()->fp)->toBeNull();
});

test('el FP es texto libre y opcional', function () {
    $this->actingAs(usuarioAdmin());

    $this->postJson('/api/OperacionesProgramadas', payloadSalida([
        'fp' => 'Plan presentado por radio',
    ]))->assertCreated()
        ->assertJsonPath('operacion.fp', 'Plan presentado por radio');

    $this->postJson('/api/OperacionesProgramadas', payloadSalida([
        'matricula' => 'XB-ZZZ',
        'fp' => '',
    ]))->assertCreated()
        ->assertJsonPath('operacion.fp', null);

    expect(OperacionProgramada::where('matricula', 'XB-ZZZ')->first()->fp)->toBeNull();
});

test('la hora exige el formato de 24 horas HH:mm', function () {
    $this->actingAs(usuarioAdmin());

    foreach (['8:30', '25:00', '12:70', '0830', '08:30 PM', ''] as $horaInvalida) {
        $this->postJson('/api/OperacionesProgramadas', payloadSalida(['hora' => $horaInvalida]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('hora');
    }

    expect(OperacionProgramada::count())->toBe(0);

    foreach (['08:30', '16:45', '23:10', '00:00'] as $indice => $horaValida) {
        $this->postJson('/api/OperacionesProgramadas', payloadSalida([
            'matricula' => 'XA-H' . $indice,
            'hora' => $horaValida,
        ]))->assertCreated()->assertJsonPath('operacion.hora', $horaValida);
    }
});

test('el folio del plan de vuelo no viaja al frontend', function () {
    $this->actingAs(usuarioAdmin());

    $respuesta = $this->postJson('/api/OperacionesProgramadas', payloadSalida())->assertCreated();

    expect($respuesta->json('operacion'))->not->toHaveKey('fp_folio');

    $this->getJson('/api/OperacionesProgramadas?fecha=2026-09-10')
        ->assertOk()
        ->assertJsonMissingPath('salidas.0.fp_folio');
});

test('actualizar una operacion conserva el folio historico oculto', function () {
    $this->actingAs(usuarioConSubdepartamento());

    $id = $this->postJson('/api/OperacionesProgramadas', payloadSalida())->json('operacion.id');

    // Folio capturado antes de que el campo se ocultara.
    OperacionProgramada::whereKey($id)->update(['fp_folio' => 'FP-HISTORICO']);

    $this->putJson("/api/OperacionesProgramadas/{$id}", payloadSalida([
        'hora' => '18:15',
        'fp' => 'Otro plan',
    ]))->assertOk();

    $operacion = OperacionProgramada::find($id);

    expect($operacion->fp_folio)->toBe('FP-HISTORICO')
        ->and($operacion->fp)->toBe('Otro plan')
        ->and($operacion->hora)->toStartWith('18:15');
});

test('ya no se valida la secuencia al programar: dos llegadas seguidas se permiten', function () {
    $this->actingAs(usuarioAdmin());

    OperacionDiaria::create([
        'user_id' => User::factory()->create()->id,
        'fecha' => '2026-09-09',
        'tipo' => 'llegada',
        'matricula' => 'XA-ABC',
        'equipo' => 'C172',
        'hora' => '08:00',
        'lugar' => 'MMTO',
        'pax' => 1,
        'departamento' => 'Trafico',
    ]);

    // Programar ya no revisa el último movimiento: la única regla que queda es
    // la de matrículas restringidas.
    $this->postJson('/api/OperacionesProgramadas', payloadSalida(['tipo' => 'llegada']))
        ->assertCreated();

    expect(OperacionProgramada::count())->toBe(1);
});

test('programar una matricula nueva no la registra en el catalogo de aeronaves', function () {
    $this->actingAs(usuarioAdmin());

    $this->postJson('/api/OperacionesProgramadas', payloadSalida(['matricula' => 'XA-NUEVA']))
        ->assertCreated();

    expect(App\Models\Aeronave::where('matricula', 'XA-NUEVA')->exists())->toBeFalse();
});

test('el listado separa salidas y llegadas de la fecha consultada', function () {
    $this->actingAs(usuarioAdmin());

    $this->postJson('/api/OperacionesProgramadas', payloadSalida())->assertCreated();
    $this->postJson('/api/OperacionesProgramadas', payloadSalida([
        'matricula' => 'XB-ZZZ',
        'tipo' => 'llegada',
        'hora' => '12:00',
    ]))->assertCreated();
    $this->postJson('/api/OperacionesProgramadas', payloadSalida([
        'matricula' => 'XC-YYY',
        'fecha' => '2026-09-11',
    ]))->assertCreated();

    $this->getJson('/api/OperacionesProgramadas?fecha=2026-09-10')
        ->assertOk()
        ->assertJsonCount(1, 'salidas')
        ->assertJsonCount(1, 'llegadas')
        ->assertJsonPath('salidas.0.matricula', 'XA-ABC')
        ->assertJsonPath('llegadas.0.matricula', 'XB-ZZZ');
});

test('el listado usa la fecha de hoy cuando no se envia ninguna', function () {
    $this->actingAs(usuarioAdmin());

    $hoy = Illuminate\Support\Carbon::now(config('app.timezone'))->toDateString();

    $this->getJson('/api/OperacionesProgramadas')
        ->assertOk()
        ->assertJsonPath('fecha', $hoy);
});

test('se puede actualizar una operacion programada', function () {
    $this->actingAs(usuarioConSubdepartamento());

    $id = $this->postJson('/api/OperacionesProgramadas', payloadSalida())
        ->json('operacion.id');

    $this->putJson("/api/OperacionesProgramadas/{$id}", payloadSalida([
        'hora' => '15:45',
        'lugar' => 'MMMX',
    ]))->assertOk()
        ->assertJsonPath('operacion.hora', '15:45')
        ->assertJsonPath('operacion.lugar', 'MMMX');
});

test('eliminar es un borrado logico y conserva el registro', function () {
    $this->actingAs(usuarioConSubdepartamento());

    $id = $this->postJson('/api/OperacionesProgramadas', payloadSalida())
        ->json('operacion.id');

    $this->deleteJson("/api/OperacionesProgramadas/{$id}")->assertOk();

    $operacion = OperacionProgramada::find($id);

    expect($operacion)->not->toBeNull()
        ->and($operacion->status)->toBe(OperacionProgramada::STATUS_CANCELADA);

    $this->getJson('/api/OperacionesProgramadas?fecha=2026-09-10')
        ->assertJsonCount(0, 'salidas');
});

test('una operacion cancelada ya no puede editarse', function () {
    $this->actingAs(usuarioConSubdepartamento());

    $id = $this->postJson('/api/OperacionesProgramadas', payloadSalida())->json('operacion.id');
    $this->deleteJson("/api/OperacionesProgramadas/{$id}")->assertOk();

    $this->putJson("/api/OperacionesProgramadas/{$id}", payloadSalida(['hora' => '18:00']))
        ->assertStatus(422);
});

test('un usuario de otra area no puede programar operaciones', function () {
    $this->actingAs(usuarioSinAcceso());

    $this->postJson('/api/OperacionesProgramadas', payloadSalida())->assertStatus(403);

    expect(OperacionProgramada::count())->toBe(0);
});

test('un usuario de otra area si puede consultar las programadas', function () {
    $this->actingAs(usuarioAdmin());
    $this->postJson('/api/OperacionesProgramadas', payloadSalida())->assertCreated();

    $this->actingAs(usuarioSinAcceso());

    $this->getJson('/api/OperacionesProgramadas?fecha=2026-09-10')
        ->assertOk()
        ->assertJsonCount(1, 'salidas');
});

test('un invitado no puede consultar las programadas', function () {
    $this->getJson('/api/OperacionesProgramadas')->assertStatus(401);
});

test('la vista previa del movimiento responde sin crear nada', function () {
    $this->actingAs(usuarioAdmin());

    $this->postJson('/api/OperacionesProgramadas/validar-movimiento', [
        'matricula' => 'XA-ABC',
        'tipo' => 'llegada',
        'fecha' => '2026-09-10',
        'hora' => '10:00',
    ])->assertOk()->assertJsonPath('restriccion.restringido', false);

    expect(OperacionProgramada::count())->toBe(0);
});
