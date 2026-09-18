<?php

use App\Models\EntregaMedicamento;
use App\Models\medicamento;
use App\Models\MovimientoMedicamento;
use App\Models\Role;
use App\Models\User;

/*
 * Últimos Movimientos debe incluir, además de entregas y cierres, el alta de
 * medicamentos y los reabastecimientos, y todos persistidos.
 */

function usuarioMedicamentos(string $slug = 'empleado', string $nombre = 'Empleado'): User
{
    $usuario = User::factory()->create();
    $rol = Role::firstOrCreate(['slug' => $slug], ['nombre' => $nombre]);
    $usuario->roles()->attach($rol->id);

    return $usuario;
}

function medicamentoActivo(array $extra = []): medicamento
{
    return medicamento::create(array_merge(['nombre' => 'PARACETAMOL', 'cantidad' => 10, 'status' => 'A'], $extra));
}

test('agregar un medicamento deja un movimiento NUEVO con la cantidad inicial y el usuario', function () {
    $usuario = usuarioMedicamentos();
    $this->actingAs($usuario);

    $this->postJson('/api/ControlMedicamento/medicamento/agregar', ['nombre' => 'Ibuprofeno', 'stockInicial' => 25])
        ->assertCreated();

    $movimiento = MovimientoMedicamento::first();

    expect($movimiento)->not->toBeNull()
        ->and($movimiento->tipo)->toBe(MovimientoMedicamento::TIPO_NUEVO)
        ->and($movimiento->cantidad)->toBe(25)
        ->and($movimiento->user_id)->toBe($usuario->id)
        ->and($movimiento->medicamento->nombre)->toBe('Ibuprofeno');
});

test('reabastecer deja un movimiento REABASTECIMIENTO y actualiza el stock', function () {
    $medicamento = medicamentoActivo(['cantidad' => 3]);
    $usuario = usuarioMedicamentos('fbo', 'FBO');
    $this->actingAs($usuario);

    $this->putJson("/api/ControlMedicamento/medicamento/{$medicamento->id}", ['cantidad' => 7])
        ->assertOk()
        ->assertJsonPath('nuevo_stock', 10);

    $movimiento = MovimientoMedicamento::first();

    expect($movimiento->tipo)->toBe(MovimientoMedicamento::TIPO_REABASTECIMIENTO)
        ->and($movimiento->cantidad)->toBe(7)
        ->and($movimiento->medicamento_id)->toBe($medicamento->id)
        ->and($movimiento->user_id)->toBe($usuario->id);
});

test('últimos movimientos lista los cuatro tipos del más reciente al más antiguo con su usuario', function () {
    $usuario = usuarioMedicamentos('fbo', 'FBO');
    $this->actingAs($usuario);

    $medicamento = medicamentoActivo();
    $this->travel(-3)->minutes();
    MovimientoMedicamento::create(['medicamento_id' => $medicamento->id, 'tipo' => 'NUEVO', 'cantidad' => 10, 'user_id' => $usuario->id]);
    $this->travelBack();

    $this->travel(-2)->minutes();
    EntregaMedicamento::create(['medicamento_id' => $medicamento->id, 'receptor' => 'JUAN', 'cantidad' => 2, 'user_id' => $usuario->id, 'entregado_por_user_id' => $usuario->id, 'status' => 'A']);
    $this->travelBack();

    $this->travel(-1)->minutes();
    MovimientoMedicamento::create(['medicamento_id' => $medicamento->id, 'tipo' => 'REABASTECIMIENTO', 'cantidad' => 5, 'user_id' => $usuario->id]);
    $this->travelBack();

    $respuesta = $this->getJson('/api/ControlMedicamento/ultimosMovimientos?per_page=10')->assertOk()->json();

    $tipos = collect($respuesta['data'])->pluck('tipo')->all();

    expect($tipos)->toBe(['REABASTECIMIENTO', 'ENTREGA', 'NUEVO'])
        ->and($respuesta['data'][0]['usuario'])->toBe($usuario->name)
        ->and($respuesta['data'][0]['cantidad'])->toBe('+5')
        ->and($respuesta['data'][0]['titulo'])->toBe('PARACETAMOL')
        ->and($respuesta['data'][1]['cantidad'])->toBe('-2')
        ->and($respuesta['data'][2]['cantidad'])->toBe('+10')
        ->and($respuesta['data'][0]['id'])->toStartWith('mov-');
});

test('el filtro por tipo acepta NUEVO y REABASTECIMIENTO', function () {
    $usuario = usuarioMedicamentos();
    $this->actingAs($usuario);
    $medicamento = medicamentoActivo();

    MovimientoMedicamento::create(['medicamento_id' => $medicamento->id, 'tipo' => 'NUEVO', 'cantidad' => 10, 'user_id' => $usuario->id]);
    MovimientoMedicamento::create(['medicamento_id' => $medicamento->id, 'tipo' => 'REABASTECIMIENTO', 'cantidad' => 5, 'user_id' => $usuario->id]);
    EntregaMedicamento::create(['medicamento_id' => $medicamento->id, 'receptor' => 'JUAN', 'cantidad' => 2, 'user_id' => $usuario->id, 'status' => 'A']);

    expect(collect($this->getJson('/api/ControlMedicamento/ultimosMovimientos?tipo=NUEVO')->assertOk()->json('data'))->pluck('tipo')->all())->toBe(['NUEVO'])
        ->and(collect($this->getJson('/api/ControlMedicamento/ultimosMovimientos?tipo=REABASTECIMIENTO')->assertOk()->json('data'))->pluck('tipo')->all())->toBe(['REABASTECIMIENTO'])
        ->and(collect($this->getJson('/api/ControlMedicamento/ultimosMovimientos?tipo=ENTREGA')->assertOk()->json('data'))->pluck('tipo')->all())->toBe(['ENTREGA'])
        ->and(count($this->getJson('/api/ControlMedicamento/ultimosMovimientos')->assertOk()->json('data')))->toBe(3);
});
