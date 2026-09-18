<?php

use App\Models\ControlMedicamento;
use App\Models\Departamento;
use App\Models\EntregaMedicamento;
use App\Models\User;

/** Usuario vinculado (status del vínculo configurable) a un departamento. */
function usuarioDeArea(string $nombre, string $departamento = 'Trafico', string $statusVinculo = 'A'): User
{
    $usuario = User::factory()->create(['name' => $nombre]);
    $depto = Departamento::firstOrCreate(['nombre' => $departamento]);
    $usuario->departamentos()->attach($depto->id, ['status' => $statusVinculo]);

    return $usuario;
}

/*
 * Permiso de reabastecer, selector "Quién entrega", vínculo de entregas con el
 * cierre y listado de personal. Helpers en MovimientosMedicamentoTest.php.
 */

// ---------------------------------------------------------------------------
// Reabastecer: solo admin, jefe_area y fbo
// ---------------------------------------------------------------------------

test('un empleado no puede reabastecer y el stock no cambia', function () {
    $medicamento = medicamentoActivo(['cantidad' => 3]);
    $this->actingAs(usuarioMedicamentos('empleado', 'Empleado'));

    $this->putJson("/api/ControlMedicamento/medicamento/{$medicamento->id}", ['cantidad' => 7])
        ->assertForbidden()
        ->assertJsonPath('message', 'No tienes permiso para reabastecer stock.');

    expect($medicamento->fresh()->cantidad)->toBe(3);
});

test('admin, jefe de área y FBO sí pueden reabastecer', function (string $slug, string $nombre) {
    $medicamento = medicamentoActivo(['cantidad' => 3]);
    $this->actingAs(usuarioMedicamentos($slug, $nombre));

    $this->putJson("/api/ControlMedicamento/medicamento/{$medicamento->id}", ['cantidad' => 2])->assertOk();

    expect($medicamento->fresh()->cantidad)->toBe(5);
})->with([
    ['admin', 'Administrador'],
    ['jefe_area', 'Jefe de Área'],
    ['fbo', 'FBO'],
]);

// ---------------------------------------------------------------------------
// Quién entrega
// ---------------------------------------------------------------------------

test('la entrega guarda a quien entrega y conserva al usuario autenticado como quien capturó', function () {
    $capturista = usuarioMedicamentos();
    $entregador = usuarioDeArea('ENTREGADOR REAL');
    $medicamento = medicamentoActivo(['cantidad' => 10]);

    $this->actingAs($capturista);

    $this->postJson('/api/ControlMedicamento/entregaMedicamento', [
        'medicamentoId' => $medicamento->id,
        'recibe' => 'PASAJERO UNO',
        'cantidad' => 2,
        'entregaUserId' => $entregador->id,
    ])->assertCreated();

    $entrega = EntregaMedicamento::first();

    expect($entrega->entregado_por_user_id)->toBe($entregador->id)
        ->and($entrega->user_id)->toBe($capturista->id)
        ->and($medicamento->fresh()->cantidad)->toBe(8);
});

test('quien entrega es obligatorio y debe existir', function () {
    $medicamento = medicamentoActivo();
    $this->actingAs(usuarioMedicamentos());

    $base = ['medicamentoId' => $medicamento->id, 'recibe' => 'X', 'cantidad' => 1];

    $this->postJson('/api/ControlMedicamento/entregaMedicamento', $base)->assertStatus(422)->assertJsonValidationErrors(['entregaUserId']);
    $this->postJson('/api/ControlMedicamento/entregaMedicamento', $base + ['entregaUserId' => 999999])->assertStatus(422)->assertJsonValidationErrors(['entregaUserId']);
});

test('quien entrega debe pertenecer al área de Tráfico', function () {
    $medicamento = medicamentoActivo();
    $this->actingAs(usuarioMedicamentos());

    $deRampa = usuarioDeArea('DE RAMPA', 'Rampa');
    $sinArea = User::factory()->create(['name' => 'SIN AREA']);
    $traficoInactivo = usuarioDeArea('TRAFICO INACTIVO', 'Trafico', 'N');

    $base = ['medicamentoId' => $medicamento->id, 'recibe' => 'X', 'cantidad' => 1];

    foreach ([$deRampa, $sinArea, $traficoInactivo] as $rechazado) {
        $this->postJson('/api/ControlMedicamento/entregaMedicamento', $base + ['entregaUserId' => $rechazado->id])
            ->assertStatus(422)
            ->assertJsonPath('errors.entregaUserId.0', 'La persona seleccionada no pertenece al área de Tráfico.');
    }

    expect(EntregaMedicamento::count())->toBe(0);
});

test('personal devuelve solo usuarios de Tráfico con vínculo activo, ordenados por nombre', function () {
    $this->actingAs(usuarioMedicamentos());

    usuarioDeArea('ZULEMA TRAFICO');
    usuarioDeArea('ANA TRAFICO');
    usuarioDeArea('DE RAMPA', 'Rampa');
    usuarioDeArea('TRAFICO INACTIVO', 'Trafico', 'N');
    User::factory()->create(['name' => 'SIN AREA']);

    $lista = $this->getJson('/api/ControlMedicamento/personal')->assertOk()->json();

    expect(collect($lista)->pluck('name')->all())->toBe(['ANA TRAFICO', 'ZULEMA TRAFICO'])
        ->and(array_keys($lista[0]))->toBe(['id', 'name']);
});

test('el historial conserva a quien entregó aunque ya no sea de Tráfico', function () {
    $usuario = usuarioMedicamentos();
    $this->actingAs($usuario);
    $medicamento = medicamentoActivo();
    $exTrafico = usuarioDeArea('EX TRAFICO');

    EntregaMedicamento::create(['medicamento_id' => $medicamento->id, 'receptor' => 'PAX', 'cantidad' => 1, 'user_id' => $usuario->id, 'entregado_por_user_id' => $exTrafico->id, 'status' => 'A']);

    // Sale del área: el registro histórico no cambia.
    $exTrafico->departamentos()->detach();

    expect(EntregaMedicamento::first()->entregadoPor->name)->toBe('EX TRAFICO')
        ->and(collect($this->getJson('/api/ControlMedicamento/personal')->json())->pluck('id'))->not->toContain($exTrafico->id);
});

test('personal exige sesión', function () {
    $this->getJson('/api/ControlMedicamento/personal')->assertUnauthorized();
});

// ---------------------------------------------------------------------------
// Cierre: vínculo de entregas
// ---------------------------------------------------------------------------

function cerrarTurno(): \Illuminate\Testing\TestResponse
{
    return test()->postJson('/api/ControlMedicamento', [
        'responsable' => 'RESPONSABLE',
        'fecha' => now()->toDateString(),
        'dia' => 'Lunes',
        'aparatos' => ['oximetro' => true],
        'firma' => 'data:image/png;base64,'.base64_encode('firma'),
        'medicamentos' => ['PARACETAMOL' => ['inicio' => 10, 'final' => 8]],
    ]);
}

test('el cierre vincula solo las entregas abiertas y las deja cerradas', function () {
    $usuario = usuarioMedicamentos();
    $this->actingAs($usuario);
    $medicamento = medicamentoActivo();

    $abierta = EntregaMedicamento::create(['medicamento_id' => $medicamento->id, 'receptor' => 'A', 'cantidad' => 1, 'user_id' => $usuario->id, 'status' => 'A']);
    $vieja = EntregaMedicamento::create(['medicamento_id' => $medicamento->id, 'receptor' => 'B', 'cantidad' => 1, 'user_id' => $usuario->id, 'status' => 'N', 'control_medicamento_id' => null]);

    cerrarTurno()->assertCreated();

    $cierre = ControlMedicamento::first();

    expect($abierta->fresh()->status)->toBe('N')
        ->and($abierta->fresh()->control_medicamento_id)->toBe($cierre->id)
        ->and($vieja->fresh()->control_medicamento_id)->toBeNull();
});

test('index devuelve las entregas de cada cierre con medicamento y quién entregó', function () {
    $usuario = usuarioMedicamentos();
    $entregador = usuarioDeArea('QUIEN ENTREGA');
    $this->actingAs($usuario);
    $medicamento = medicamentoActivo();

    EntregaMedicamento::create(['medicamento_id' => $medicamento->id, 'receptor' => 'PAX', 'cantidad' => 2, 'user_id' => $usuario->id, 'entregado_por_user_id' => $entregador->id, 'status' => 'A']);
    cerrarTurno()->assertCreated();

    $hoy = now()->toDateString();
    $cierres = $this->getJson("/api/ControlMedicamento/index?fecha_inicio={$hoy}&fecha_fin={$hoy}")->assertOk()->json();

    expect($cierres)->toHaveCount(1)
        ->and($cierres[0]['entregas'])->toHaveCount(1)
        ->and($cierres[0]['entregas'][0]['receptor'])->toBe('PAX')
        ->and($cierres[0]['entregas'][0]['cantidad'])->toBe(2)
        ->and($cierres[0]['entregas'][0]['medicamento']['nombre'])->toBe('PARACETAMOL')
        ->and($cierres[0]['entregas'][0]['entregado_por']['name'])->toBe('QUIEN ENTREGA');
});
