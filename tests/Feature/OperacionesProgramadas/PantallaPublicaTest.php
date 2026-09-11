<?php

use App\Events\MatriculaRestringidaCambio;
use App\Events\OperacionProgramadaCambio;
use App\Models\OperacionProgramada;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * La televisión es pública: nada de aquí usa actingAs. Lo que se comprueba es
 * exactamente qué queda abierto y qué sigue cerrado.
 */

function programadaPublica(array $extra = []): OperacionProgramada
{
    return OperacionProgramada::create(array_merge([
        'fecha' => Illuminate\Support\Carbon::now(config('app.timezone'))->toDateString(),
        'tipo' => 'salida',
        'matricula' => 'XA-ABC',
        'equipo' => 'C172',
        'hora' => '10:30',
        'lugar' => 'MMTO',
        'pax' => 2,
        'fp' => 'PLAN 1',
        'observaciones' => 'Combustible completo',
        'status' => OperacionProgramada::STATUS_ACTIVA,
    ], $extra));
}

const CAMPOS_PUBLICOS = ['id', 'tipo', 'matricula', 'equipo', 'hora', 'lugar', 'pax', 'fp', 'observaciones'];

test('la pagina de la television abre sin sesion', function () {
    $this->get(route('pantallaProgramadas'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('despacho/PantallaOperacionesProgramadas'));
});

test('el endpoint publico responde sin sesion', function () {
    programadaPublica();

    $this->getJson('/api/pantalla/operaciones-programadas')
        ->assertOk()
        ->assertJsonCount(1, 'salidas')
        ->assertJsonCount(0, 'llegadas');
});

test('el endpoint publico expone exactamente los campos visibles y ninguno mas', function () {
    programadaPublica();

    $respuesta = $this->getJson('/api/pantalla/operaciones-programadas')->assertOk();

    $llaves = array_keys($respuesta->json('salidas.0'));
    sort($llaves);
    $esperadas = CAMPOS_PUBLICOS;
    sort($esperadas);

    expect($llaves)->toBe($esperadas);

    foreach (['status', 'modulos_usados', 'user_id', 'created_at', 'updated_at', 'fp_folio'] as $prohibido) {
        expect($respuesta->json('salidas.0'))->not->toHaveKey($prohibido);
    }
});

test('el endpoint publico solo devuelve las activas de hoy', function () {
    $hoy = Illuminate\Support\Carbon::now(config('app.timezone'))->toDateString();

    programadaPublica(['matricula' => 'XA-HOY', 'hora' => '23:59']);
    programadaPublica(['matricula' => 'XA-REALIZADA', 'status' => OperacionProgramada::STATUS_REALIZADA]);
    programadaPublica(['matricula' => 'XA-CANCELADA', 'status' => OperacionProgramada::STATUS_CANCELADA]);
    programadaPublica(['matricula' => 'XA-MANANA', 'fecha' => '2030-01-01']);

    $this->getJson('/api/pantalla/operaciones-programadas')
        ->assertOk()
        ->assertJsonPath('fecha', $hoy)
        ->assertJsonCount(1, 'salidas')
        ->assertJsonPath('salidas.0.matricula', 'XA-HOY');
});

test('el endpoint publico no acepta otra fecha: siempre es hoy', function () {
    programadaPublica(['matricula' => 'XA-MANANA', 'fecha' => '2030-01-01']);

    $this->getJson('/api/pantalla/operaciones-programadas?fecha=2030-01-01')
        ->assertOk()
        ->assertJsonCount(0, 'salidas');
});

test('ningun endpoint de escritura es publico', function () {
    $programada = programadaPublica();

    $this->postJson('/api/OperacionesProgramadas', [])->assertStatus(401);
    $this->putJson("/api/OperacionesProgramadas/{$programada->id}", [])->assertStatus(401);
    $this->postJson("/api/OperacionesProgramadas/{$programada->id}/finalizar")->assertStatus(401);
    $this->deleteJson("/api/OperacionesProgramadas/{$programada->id}")->assertStatus(401);

    $this->postJson('/api/MatriculasRestringidas', ['matricula' => 'XA-ABC'])->assertStatus(401);
    $this->putJson('/api/MatriculasRestringidas/XA-ABC', ['salida' => true])->assertStatus(401);
    $this->deleteJson('/api/MatriculasRestringidas/XA-ABC')->assertStatus(401);

    expect($programada->fresh()->status)->toBe(OperacionProgramada::STATUS_ACTIVA);
});

test('los datos internos siguen cerrados sin sesion', function () {
    programadaPublica();

    $this->getJson('/api/OperacionesProgramadas')->assertStatus(401);
    $this->getJson('/api/OperacionesProgramadas/pendientes?modulo=walkaround')->assertStatus(401);
    $this->getJson('/api/MatriculasRestringidas')->assertStatus(401);
});

test('el evento de operaciones viaja al canal de la television y el de restricciones no', function () {
    $operacion = new OperacionProgramadaCambio(id: 1, accion: 'creada', fecha: '2026-09-11', tipo: 'salida');
    $canalesOperacion = array_map(fn ($c) => $c->name, $operacion->broadcastOn());

    expect($canalesOperacion)->toContain('pantalla-programadas')
        ->and($canalesOperacion)->toContain('operaciones-programadas');

    $restriccion = new MatriculaRestringidaCambio('XA-ABC', 'actualizada', llegada: true);

    expect($restriccion->broadcastOn()->name)->toBe('operaciones-programadas')
        ->and($restriccion->broadcastOn()->name)->not->toBe('pantalla-programadas');
});

test('la carga del evento publico no lleva datos de usuarios ni restricciones', function () {
    $evento = new OperacionProgramadaCambio(id: 1, accion: 'finalizada', fecha: '2026-09-11', tipo: 'salida');
    $llaves = array_keys($evento->broadcastWith());
    sort($llaves);

    expect($llaves)->toBe(['accion', 'fecha', 'fecha_anterior', 'id', 'modulo', 'tipo']);
});
