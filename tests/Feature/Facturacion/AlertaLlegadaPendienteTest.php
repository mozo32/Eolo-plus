<?php

use App\Events\PrefacturaPendienteCambio;
use App\Models\User;
use Illuminate\Support\Facades\Event;

/**
 * El aviso en tiempo real de la alerta de llegadas pendientes.
 *
 * Son cinco momentos los que mueven el contador, y los cinco tienen que avisar. Los dos
 * del lado de Facturación importan tanto como los tres de Tráfico: sin ellos, dos
 * capturistas trabajando a la vez ven números distintos y uno de los dos abre una
 * prefactura que el otro ya abrió.
 */
function registrarLlegada(array $extra = []): int
{
    return test()->postJson('/api/OperacionesDiarias', array_merge([
        'fecha' => now()->toDateString(),
        'movimiento' => 'Llegada',
        'matricula' => 'XA-AAA',
        'equipo' => 'C525',
        'hora' => '10:00',
        'pax' => 2,
        'departamento' => 'Trafico',
        'procedencia' => 'Toluca',
    ], $extra))->assertCreated()->json('operacion.id');
}

test('registrar una LLEGADA avisa a la pantalla de Prefacturas', function () {
    Event::fake([PrefacturaPendienteCambio::class]);
    $this->actingAs(User::factory()->create(), 'sanctum');

    $id = registrarLlegada();

    Event::assertDispatched(
        PrefacturaPendienteCambio::class,
        fn (PrefacturaPendienteCambio $evento) => $evento->operacionId === $id
            && $evento->accion === PrefacturaPendienteCambio::ACCION_CREADA
    );
});

test('registrar una SALIDA no avisa: una salida no abre prefactura', function () {
    Event::fake([PrefacturaPendienteCambio::class]);
    $this->actingAs(User::factory()->create(), 'sanctum');

    // Una salida necesita una llegada previa por la regla de secuencia.
    registrarLlegada(['matricula' => 'XA-SSS']);
    Event::fake([PrefacturaPendienteCambio::class]);

    $this->postJson('/api/OperacionesDiarias', [
        'fecha' => now()->toDateString(),
        'movimiento' => 'Salida',
        'matricula' => 'XA-SSS',
        'equipo' => 'C525',
        'hora' => '18:00',
        'pax' => 2,
        'departamento' => 'Trafico',
        'destino' => 'Toluca',
    ])->assertCreated();

    Event::assertNotDispatched(PrefacturaPendienteCambio::class);
});

test('cancelar una llegada avisa de que deja de estar pendiente', function () {
    // Cancelar es solo de FBO: el controlador responde 403 a cualquier otro.
    $this->actingAs(usuarioFboDePrefacturas(), 'sanctum');
    $id = registrarLlegada();

    Event::fake([PrefacturaPendienteCambio::class]);
    $this->patchJson("/api/OperacionesDiarias/{$id}/cancelar", ['motivo' => 'Captura equivocada'])->assertOk();

    Event::assertDispatched(
        PrefacturaPendienteCambio::class,
        fn (PrefacturaPendienteCambio $evento) => $evento->operacionId === $id
            && $evento->accion === PrefacturaPendienteCambio::ACCION_ELIMINADA
    );
});

test('editar una llegada avisa: puede entrar o salir de la ventana del corte', function () {
    $this->actingAs(User::factory()->create(), 'sanctum');
    $id = registrarLlegada();

    Event::fake([PrefacturaPendienteCambio::class]);
    $this->putJson("/api/OperacionesDiarias/{$id}", [
        'fecha' => now()->toDateString(),
        'movimiento' => 'Llegada',
        'matricula' => 'XA-AAA',
        'equipo' => 'C525',
        'hora' => '11:30',
        'pax' => 4,
        'departamento' => 'Trafico',
        'procedencia' => 'Toluca',
    ])->assertOk();

    Event::assertDispatched(
        PrefacturaPendienteCambio::class,
        fn (PrefacturaPendienteCambio $evento) => $evento->operacionId === $id
            && $evento->accion === PrefacturaPendienteCambio::ACCION_ACTUALIZADA
    );
});

test('abrir una prefactura sobre una llegada avisa de que esa llegada ya esta tomada', function () {
    $this->actingAs(User::factory()->create(), 'sanctum');
    $id = registrarLlegada();

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    Event::fake([PrefacturaPendienteCambio::class]);

    $this->postJson('/api/facturacion/prefacturas', [
        'aeronave_id' => aeronaveFacturable()->id,
        'tipo_destino' => 'nacional',
        'operacion_llegada_id' => $id,
    ])->assertCreated();

    Event::assertDispatched(
        PrefacturaPendienteCambio::class,
        fn (PrefacturaPendienteCambio $evento) => $evento->operacionId === $id
            && $evento->accion === PrefacturaPendienteCambio::ACCION_TOMADA
    );
});

test('abrir una prefactura SIN llegada ligada no avisa: no cambia ningun pendiente', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    Event::fake([PrefacturaPendienteCambio::class]);

    $this->postJson('/api/facturacion/prefacturas', [
        'aeronave_id' => aeronaveFacturable()->id,
        'tipo_destino' => 'nacional',
    ])->assertCreated();

    Event::assertNotDispatched(PrefacturaPendienteCambio::class);
});

test('descartar la prefactura avisa de que la llegada volvio a quedar pendiente', function () {
    $this->actingAs(User::factory()->create(), 'sanctum');
    $idLlegada = registrarLlegada();

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $idPrefactura = $this->postJson('/api/facturacion/prefacturas', [
        'aeronave_id' => aeronaveFacturable()->id,
        'tipo_destino' => 'nacional',
        'operacion_llegada_id' => $idLlegada,
    ])->assertCreated()->json('prefactura.id');

    Event::fake([PrefacturaPendienteCambio::class]);
    $this->patchJson("/api/facturacion/prefacturas/{$idPrefactura}/descartar")->assertOk();

    Event::assertDispatched(
        PrefacturaPendienteCambio::class,
        fn (PrefacturaPendienteCambio $evento) => $evento->operacionId === $idLlegada
            && $evento->accion === PrefacturaPendienteCambio::ACCION_LIBERADA
    );
});

test('el aviso viaja por el canal publico de pendientes, con la carga que la pantalla espera', function () {
    $evento = new PrefacturaPendienteCambio(PrefacturaPendienteCambio::ACCION_CREADA, 7, 'XA-AAA');

    expect(collect($evento->broadcastOn())->map(fn ($canal) => $canal->name)->all())
        ->toBe([PrefacturaPendienteCambio::CANAL])
        ->and($evento->broadcastWith())
        ->toBe(['accion' => 'creada', 'operacion_id' => 7, 'matricula' => 'XA-AAA']);
});

test('con el servidor de websockets caido, registrar la llegada SIGUE funcionando', function () {
    // Es la razon por la que `emitir` traga la excepcion. Reverb ya se cayo una vez en este
    // servidor; que eso impida capturar una operacion seria mucho peor que no avisar.
    $this->actingAs(User::factory()->create(), 'sanctum');
    Event::listen(PrefacturaPendienteCambio::class, function () {
        throw new RuntimeException('el websocket no responde');
    });

    $id = registrarLlegada();

    // Se lee la base, no la respuesta: lo que importa es que la llegada quedo guardada.
    expect(App\Models\OperacionDiaria::find($id))->not->toBeNull();
});

/** Un usuario FBO: lo unico que el controlador acepta para cancelar una operacion. */
function usuarioFboDePrefacturas(): User
{
    $usuario = User::factory()->create();
    $usuario->roles()->attach(App\Models\Role::firstOrCreate(['slug' => 'fbo'], ['nombre' => 'FBO'])->id);

    return $usuario;
}

/** Una matricula dada de alta en el catalogo de facturacion, lista para abrirle prefactura. */
function aeronaveFacturable(): App\Models\Aeronave
{
    $aeronave = App\Models\Aeronave::firstOrCreate(['matricula' => 'XA-AAA']);
    App\Models\FactAeronave::firstOrCreate(
        ['aeronave_id' => $aeronave->id],
        ['estatus' => App\Models\FactAeronave::ESTATUS_TRANSITO],
    );

    return $aeronave;
}
