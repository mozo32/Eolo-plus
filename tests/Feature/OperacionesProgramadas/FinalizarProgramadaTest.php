<?php

use App\Events\OperacionProgramadaCambio;
use App\Models\Bitacora;
use App\Models\OperacionDiaria;
use App\Models\OperacionProgramada;
use App\Models\User;
use App\Models\WalkAround;
use Illuminate\Support\Facades\Event;

/*
 * Finalización manual desde el tablero de Despacho: solo cambia el estado, no
 * crea registro diario, y de dos peticiones concurrentes solo una modifica.
 */

function programadaActiva(array $extra = []): OperacionProgramada
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

test('finalizar cambia el estado a realizada sin crear un registro diario', function () {
    $this->actingAs(usuarioConSubdepartamento());
    $programada = programadaActiva();

    $this->postJson("/api/OperacionesProgramadas/{$programada->id}/finalizar")
        ->assertOk()
        ->assertJsonPath('operacion.status', OperacionProgramada::STATUS_REALIZADA);

    expect($programada->fresh()->status)->toBe(OperacionProgramada::STATUS_REALIZADA)
        ->and(OperacionDiaria::count())->toBe(0)
        ->and(OperacionProgramada::find($programada->id))->not->toBeNull();
});

test('queda en la bitacora como finalizacion manual con el usuario que la hizo', function () {
    $usuario = usuarioConSubdepartamento();
    $this->actingAs($usuario);
    $programada = programadaActiva();

    $this->postJson("/api/OperacionesProgramadas/{$programada->id}/finalizar")->assertOk();

    $registro = Bitacora::where('modulo', Bitacora::MODULO_OPERACIONES_PROGRAMADAS)
        ->where('accion', Bitacora::ACCION_FINALIZAR)
        ->first();

    expect($registro)->not->toBeNull()
        ->and($registro->usuario_id)->toBe($usuario->id)
        ->and($registro->registro_id)->toBe($programada->id)
        ->and($registro->descripcion)->toContain('manualmente');
});

test('la segunda de dos finalizaciones recibe 409 y no emite evento', function () {
    $this->actingAs(usuarioConSubdepartamento());
    $programada = programadaActiva();

    Event::fake([OperacionProgramadaCambio::class]);

    $this->postJson("/api/OperacionesProgramadas/{$programada->id}/finalizar")->assertOk();

    Event::assertDispatchedTimes(OperacionProgramadaCambio::class, 1);

    $this->postJson("/api/OperacionesProgramadas/{$programada->id}/finalizar")
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_no_pendiente');

    // Sigue siendo una sola emisión: la segunda petición no tocó nada.
    Event::assertDispatchedTimes(OperacionProgramadaCambio::class, 1);
});

test('el evento emitido es finalizada y viaja tambien por el canal de la television', function () {
    $this->actingAs(usuarioConSubdepartamento());
    $programada = programadaActiva();

    Event::fake([OperacionProgramadaCambio::class]);

    $this->postJson("/api/OperacionesProgramadas/{$programada->id}/finalizar")->assertOk();

    Event::assertDispatched(
        OperacionProgramadaCambio::class,
        function (OperacionProgramadaCambio $evento) use ($programada) {
            $canales = array_map(fn ($c) => $c->name, $evento->broadcastOn());

            return $evento->id === $programada->id
                && $evento->accion === OperacionProgramadaCambio::ACCION_FINALIZADA
                && in_array('operaciones-programadas', $canales, true)
                && in_array('pantalla-programadas', $canales, true);
        }
    );
});

test('una cancelada no puede finalizarse', function () {
    $this->actingAs(usuarioConSubdepartamento());
    $programada = programadaActiva(['status' => OperacionProgramada::STATUS_CANCELADA]);

    $this->postJson("/api/OperacionesProgramadas/{$programada->id}/finalizar")
        ->assertStatus(409);

    expect($programada->fresh()->status)->toBe(OperacionProgramada::STATUS_CANCELADA);
});

test('una ya realizada por Operaciones Diarias tampoco puede finalizarse otra vez', function () {
    $this->actingAs(usuarioConSubdepartamento());
    $programada = programadaActiva();

    OperacionProgramada::vincular($programada->id, OperacionDiaria::create([
        'user_id' => User::factory()->create()->id,
        'fecha' => $programada->fecha,
        'tipo' => 'salida',
        'matricula' => 'XA-ABC',
        'equipo' => 'C172',
        'hora' => '10:30',
        'lugar' => 'MMTO',
        'pax' => 2,
        'departamento' => 'Trafico',
    ]));

    $this->postJson("/api/OperacionesProgramadas/{$programada->id}/finalizar")
        ->assertStatus(409)
        ->assertJsonPath('status', OperacionProgramada::STATUS_REALIZADA);
});

test('al finalizar sale del tablero y de los pendientes de Operaciones Diarias pero sigue para WalkAround', function () {
    $this->actingAs(usuarioAdmin());
    $programada = programadaActiva();
    $hoy = $programada->fecha->toDateString();

    $this->postJson("/api/OperacionesProgramadas/{$programada->id}/finalizar")->assertOk();

    $this->getJson("/api/OperacionesProgramadas?fecha={$hoy}")
        ->assertJsonCount(0, 'salidas');

    $this->getJson("/api/OperacionesProgramadas/pendientes?modulo=operaciones_diarias&fecha={$hoy}")
        ->assertJsonCount(0);

    $this->getJson("/api/OperacionesProgramadas/pendientes?modulo=walkaround&fecha={$hoy}")
        ->assertJsonCount(1)
        ->assertJsonPath('0.id', $programada->id);
});

test('WalkAround todavia puede usar una operacion finalizada a mano', function () {
    $programada = programadaActiva();

    OperacionProgramada::query()->whereKey($programada->id)->update(['status' => OperacionProgramada::STATUS_REALIZADA]);

    $uso = OperacionProgramada::vincular($programada->id, WalkAround::create([
        'fecha' => $programada->fecha->toDateString(),
        'movimiento' => 'salida',
        'matricula' => 'XA-ABC',
        'tipo' => 'avion',
        'tipo_aeronave' => 'C172',
        'tipo_aeronave_id' => 1,
        'hora' => '10:30',
        'status' => 'A',
    ]));

    expect($uso)->not->toBeNull();
});

test('Operaciones Diarias ya no puede vincular una operacion finalizada a mano', function () {
    $programada = programadaActiva();

    OperacionProgramada::query()->whereKey($programada->id)->update(['status' => OperacionProgramada::STATUS_REALIZADA]);

    expect(fn () => OperacionProgramada::vincular($programada->id, OperacionDiaria::create([
        'user_id' => User::factory()->create()->id,
        'fecha' => $programada->fecha->toDateString(),
        'tipo' => 'salida',
        'matricula' => 'XA-ABC',
        'equipo' => 'C172',
        'hora' => '10:30',
        'lugar' => 'MMTO',
        'pax' => 2,
        'departamento' => 'Trafico',
    ])))->toThrow(Symfony\Component\HttpKernel\Exception\HttpException::class);
});

test('la deteccion al capturar ya no ofrece una operacion finalizada a mano en Operaciones Diarias', function () {
    $this->actingAs(usuarioAdmin());
    $programada = programadaActiva();

    OperacionProgramada::query()->whereKey($programada->id)->update(['status' => OperacionProgramada::STATUS_REALIZADA]);

    $this->getJson('/api/OperacionesProgramadas/coincidencias?matricula=XA-ABC&tipo=salida&modulo=operaciones_diarias')
        ->assertJsonCount(0, 'coincidencias');

    $this->getJson('/api/OperacionesProgramadas/coincidencias?matricula=XA-ABC&tipo=salida&modulo=walkaround')
        ->assertJsonCount(1, 'coincidencias');
});

test('un usuario de otra area no puede finalizar y un invitado tampoco', function () {
    $programada = programadaActiva();

    $this->postJson("/api/OperacionesProgramadas/{$programada->id}/finalizar")->assertStatus(401);

    $this->actingAs(usuarioSinAcceso());
    $this->postJson("/api/OperacionesProgramadas/{$programada->id}/finalizar")->assertStatus(403);

    expect($programada->fresh()->status)->toBe(OperacionProgramada::STATUS_ACTIVA);
});
