<?php

use App\Events\MatriculaRestringidaCambio;
use App\Models\MatriculaRestringida;
use App\Models\OperacionDiaria;
use App\Models\OperacionProgramada;
use App\Models\User;
use App\Services\RestriccionMatriculaService;
use Illuminate\Support\Facades\Event;

function restringir(string $matricula, bool $llegada = false, bool $salida = false): MatriculaRestringida
{
    return MatriculaRestringida::create([
        'matricula' => $matricula,
        'llegada' => $llegada,
        'salida' => $salida,
    ]);
}

function payloadProgramar(array $extra = []): array
{
    return array_merge([
        'fecha' => '2026-09-15',
        'tipo' => 'salida',
        'matricula' => 'XA-ABC',
        'equipo' => 'C172',
        'hora' => '10:30',
        'lugar' => 'MMTO',
        'pax' => 2,
    ], $extra);
}

/*
|--------------------------------------------------------------------------
| La regla, en el servicio
|--------------------------------------------------------------------------
*/

test('una matricula sin registro permite cualquier movimiento', function () {
    expect(RestriccionMatriculaService::validar('XA-ABC', 'llegada')['permitido'])->toBeTrue()
        ->and(RestriccionMatriculaService::validar('XA-ABC', 'salida')['permitido'])->toBeTrue();
});

test('ambos switches apagados permiten cualquier movimiento', function () {
    restringir('XA-ABC');

    expect(RestriccionMatriculaService::validar('XA-ABC', 'llegada')['permitido'])->toBeTrue()
        ->and(RestriccionMatriculaService::validar('XA-ABC', 'salida')['permitido'])->toBeTrue();
});

test('solo llegada restringida bloquea la llegada y permite la salida', function () {
    restringir('XA-ABC', llegada: true);

    expect(RestriccionMatriculaService::validar('XA-ABC', 'llegada')['permitido'])->toBeFalse()
        ->and(RestriccionMatriculaService::validar('XA-ABC', 'salida')['permitido'])->toBeTrue();
});

test('solo salida restringida bloquea la salida y permite la llegada', function () {
    restringir('XA-ABC', salida: true);

    expect(RestriccionMatriculaService::validar('XA-ABC', 'salida')['permitido'])->toBeFalse()
        ->and(RestriccionMatriculaService::validar('XA-ABC', 'llegada')['permitido'])->toBeTrue();
});

test('ambos switches encendidos bloquean los dos movimientos', function () {
    restringir('XA-ABC', llegada: true, salida: true);

    expect(RestriccionMatriculaService::validar('XA-ABC', 'llegada')['permitido'])->toBeFalse()
        ->and(RestriccionMatriculaService::validar('XA-ABC', 'salida')['permitido'])->toBeFalse();
});

test('el mensaje nombra el movimiento y la matricula', function () {
    restringir('XA-ABC', salida: true);

    expect(RestriccionMatriculaService::validar('XA-ABC', 'salida')['message'])->toBe(
        'La salida de la matrícula XA-ABC está restringida. Favor de hablar con el personal correspondiente.'
    );
});

test('la matricula se normaliza al consultarla', function () {
    restringir('XA-ABC', llegada: true);

    expect(RestriccionMatriculaService::validar('  xa-abc  ', 'llegada')['permitido'])->toBeFalse();
});

test('el vocabulario de WalkAround tambien se entiende', function () {
    restringir('XA-ABC', llegada: true);

    // Entrada y llegada son el mismo movimiento en el sistema.
    expect(RestriccionMatriculaService::validar('XA-ABC', 'Entrada')['permitido'])->toBeFalse();
});

/*
|--------------------------------------------------------------------------
| El CRUD del modal
|--------------------------------------------------------------------------
*/

test('despacho agrega una matricula con ambos switches apagados', function () {
    $this->actingAs(usuarioConSubdepartamento());

    $this->postJson('/api/MatriculasRestringidas', ['matricula' => ' xa-abc '])
        ->assertCreated()
        ->assertJsonPath('restriccion.matricula', 'XA-ABC')
        ->assertJsonPath('restriccion.llegada', false)
        ->assertJsonPath('restriccion.salida', false);

    expect(MatriculaRestringida::count())->toBe(1);
});

test('no se puede agregar dos veces la misma matricula', function () {
    $this->actingAs(usuarioAdmin());

    $this->postJson('/api/MatriculasRestringidas', ['matricula' => 'XA-ABC'])->assertCreated();

    $this->postJson('/api/MatriculasRestringidas', ['matricula' => 'xa-abc'])
        ->assertStatus(422)
        ->assertJsonPath('message', 'La matrícula seleccionada ya se encuentra en la lista de restricciones.');

    expect(MatriculaRestringida::count())->toBe(1);
});

test('cada switch se actualiza por separado y se conserva', function () {
    $this->actingAs(usuarioConSubdepartamento());
    restringir('XA-ABC');

    $this->putJson('/api/MatriculasRestringidas/XA-ABC', ['llegada' => true])
        ->assertOk()
        ->assertJsonPath('restriccion.llegada', true)
        ->assertJsonPath('restriccion.salida', false);

    $this->putJson('/api/MatriculasRestringidas/XA-ABC', ['salida' => true])
        ->assertOk()
        ->assertJsonPath('restriccion.llegada', true)
        ->assertJsonPath('restriccion.salida', true);

    $guardada = MatriculaRestringida::find('XA-ABC');

    expect($guardada->llegada)->toBeTrue()
        ->and($guardada->salida)->toBeTrue();
});

test('el listado devuelve las restricciones ordenadas', function () {
    $this->actingAs(usuarioAdmin());

    restringir('XB-ZZZ', salida: true);
    restringir('XA-ABC', llegada: true);

    $this->getJson('/api/MatriculasRestringidas')
        ->assertOk()
        ->assertJsonCount(2)
        ->assertJsonPath('0.matricula', 'XA-ABC')
        ->assertJsonPath('1.matricula', 'XB-ZZZ');
});

test('eliminar una restriccion no toca el catalogo ni las operaciones de esa matricula', function () {
    $this->actingAs(usuarioConSubdepartamento());

    $tipo = App\Models\TipoAeronave::create(['nombre' => 'CESSNA']);

    $aeronave = App\Models\Aeronave::create([
        'matricula' => 'XA-ABC',
        'aeronave_id' => $tipo->id,
        'tipo_aeronave' => 'C172',
    ]);

    $programada = OperacionProgramada::create([
        'fecha' => '2026-09-15',
        'tipo' => 'salida',
        'matricula' => 'XA-ABC',
        'equipo' => 'C172',
        'hora' => '10:30',
        'status' => OperacionProgramada::STATUS_ACTIVA,
    ]);

    restringir('XA-ABC', salida: true);

    $this->deleteJson('/api/MatriculasRestringidas/XA-ABC')->assertOk();

    expect(MatriculaRestringida::count())->toBe(0)
        ->and(App\Models\Aeronave::find($aeronave->id))->not->toBeNull()
        ->and(OperacionProgramada::find($programada->id))->not->toBeNull()
        ->and(OperacionProgramada::find($programada->id)->status)->toBe(OperacionProgramada::STATUS_ACTIVA);
});

test('un usuario de otra area puede consultar las restricciones pero no cambiarlas', function () {
    restringir('XA-ABC', salida: true);

    $this->actingAs(usuarioSinAcceso());

    // El icono de alerta lo ve cualquiera que abra la pantalla.
    $this->getJson('/api/MatriculasRestringidas')
        ->assertOk()
        ->assertJsonCount(1);

    $this->postJson('/api/MatriculasRestringidas', ['matricula' => 'XB-ZZZ'])->assertStatus(403);
    $this->putJson('/api/MatriculasRestringidas/XA-ABC', ['salida' => false])->assertStatus(403);
    $this->deleteJson('/api/MatriculasRestringidas/XA-ABC')->assertStatus(403);

    expect(MatriculaRestringida::count())->toBe(1)
        ->and(MatriculaRestringida::find('XA-ABC')->salida)->toBeTrue();
});

/*
|--------------------------------------------------------------------------
| El efecto al programar
|--------------------------------------------------------------------------
*/

test('no se puede programar un movimiento restringido', function () {
    $this->actingAs(usuarioAdmin());
    restringir('XA-ABC', salida: true);

    $this->postJson('/api/OperacionesProgramadas', payloadProgramar())
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'movimiento_restringido')
        ->assertJsonPath('message', 'La salida de la matrícula XA-ABC está restringida. Favor de hablar con el personal correspondiente.');

    expect(OperacionProgramada::count())->toBe(0);
});

test('el movimiento no restringido de la misma matricula si se puede programar', function () {
    $this->actingAs(usuarioAdmin());
    restringir('XA-ABC', salida: true);

    $this->postJson('/api/OperacionesProgramadas', payloadProgramar(['tipo' => 'llegada']))
        ->assertCreated();
});

test('la restriccion no se puede evitar mandando la matricula en minusculas', function () {
    $this->actingAs(usuarioAdmin());
    restringir('XA-ABC', salida: true);

    $this->postJson('/api/OperacionesProgramadas', payloadProgramar(['matricula' => 'xa-abc']))
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'movimiento_restringido');

    expect(OperacionProgramada::count())->toBe(0);
});

test('actualizar solo la hora de una operacion ya restringida se permite', function () {
    $this->actingAs(usuarioConSubdepartamento());

    $id = $this->postJson('/api/OperacionesProgramadas', payloadProgramar())
        ->assertCreated()
        ->json('operacion.id');

    // La salida se restringe después de haberla programado.
    restringir('XA-ABC', salida: true);

    $this->putJson("/api/OperacionesProgramadas/{$id}", payloadProgramar(['hora' => '15:45']))
        ->assertOk()
        ->assertJsonPath('operacion.hora', '15:45');
});

test('cambiar el tipo hacia un movimiento restringido se rechaza', function () {
    $this->actingAs(usuarioConSubdepartamento());

    $id = $this->postJson('/api/OperacionesProgramadas', payloadProgramar())
        ->assertCreated()
        ->json('operacion.id');

    restringir('XA-ABC', llegada: true);

    $this->putJson("/api/OperacionesProgramadas/{$id}", payloadProgramar(['tipo' => 'llegada']))
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'movimiento_restringido');

    expect(OperacionProgramada::find($id)->tipo)->toBe('salida');
});

test('la vista previa informa la restriccion sin crear nada', function () {
    $this->actingAs(usuarioAdmin());
    restringir('XA-ABC', salida: true);

    $this->postJson('/api/OperacionesProgramadas/validar-movimiento', [
        'matricula' => 'XA-ABC',
        'tipo' => 'salida',
        'fecha' => '2026-09-15',
        'hora' => '10:30',
    ])->assertOk()->assertJsonPath('restriccion.restringido', true);

    expect(OperacionProgramada::count())->toBe(0);
});

test('agregar una restriccion no modifica las operaciones ya programadas', function () {
    $this->actingAs(usuarioAdmin());

    $this->postJson('/api/OperacionesProgramadas', payloadProgramar())->assertCreated();
    $antes = OperacionProgramada::first()->toArray();

    $this->postJson('/api/MatriculasRestringidas', ['matricula' => 'XA-ABC'])->assertCreated();
    $this->putJson('/api/MatriculasRestringidas/XA-ABC', ['salida' => true])->assertOk();

    expect(OperacionProgramada::count())->toBe(1)
        ->and(OperacionProgramada::first()->toArray())->toBe($antes);
});

/*
|--------------------------------------------------------------------------
| Tiempo real
|--------------------------------------------------------------------------
*/

test('las tres acciones emiten el evento por el canal de operaciones programadas', function () {
    Event::fake([MatriculaRestringidaCambio::class]);
    $this->actingAs(usuarioConSubdepartamento());

    $this->postJson('/api/MatriculasRestringidas', ['matricula' => 'XA-ABC'])->assertCreated();
    Event::assertDispatched(
        MatriculaRestringidaCambio::class,
        fn ($e) => $e->matricula === 'XA-ABC' && $e->accion === 'agregada'
    );

    $this->putJson('/api/MatriculasRestringidas/XA-ABC', ['llegada' => true])->assertOk();
    Event::assertDispatched(
        MatriculaRestringidaCambio::class,
        fn ($e) => $e->accion === 'actualizada' && $e->llegada === true
    );

    $this->deleteJson('/api/MatriculasRestringidas/XA-ABC')->assertOk();
    Event::assertDispatched(
        MatriculaRestringidaCambio::class,
        fn ($e) => $e->accion === 'eliminada'
    );
});

test('el evento viaja por el mismo canal publico y con carga minima', function () {
    $evento = new MatriculaRestringidaCambio('XA-ABC', 'actualizada', llegada: true, salida: false);

    expect($evento->broadcastOn()->name)->toBe('operaciones-programadas')
        ->and($evento->broadcastWith())->toBe([
            'matricula' => 'XA-ABC',
            'accion' => 'actualizada',
            'llegada' => true,
            'salida' => false,
        ]);
});

test('un alta duplicada no emite ningun evento', function () {
    $this->actingAs(usuarioAdmin());
    restringir('XA-ABC');

    Event::fake([MatriculaRestringidaCambio::class]);

    $this->postJson('/api/MatriculasRestringidas', ['matricula' => 'XA-ABC'])->assertStatus(422);

    Event::assertNotDispatched(MatriculaRestringidaCambio::class);
});
