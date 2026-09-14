<?php

use App\Models\Bitacora;
use App\Models\OperacionDiaria;
use App\Models\Role;
use App\Models\User;
use App\Services\SecuenciaMovimientoService;
use Illuminate\Support\Carbon;

/*
 * Cancelar una operación diaria solo cambia su status a false. El registro se
 * conserva en el historial y deja de contar como movimiento operativo.
 */

function usuarioConRol(string $slug, string $nombre): User
{
    $usuario = User::factory()->create();
    $rol = Role::firstOrCreate(['slug' => $slug], ['nombre' => $nombre]);
    $usuario->roles()->attach($rol->id);

    return $usuario;
}

function usuarioFbo(): User
{
    return usuarioConRol('fbo', 'FBO');
}

function operacionDiariaActiva(array $extra = []): OperacionDiaria
{
    return OperacionDiaria::create(array_merge([
        'user_id' => User::factory()->create()->id,
        'fecha' => Carbon::now(config('app.timezone'))->toDateString(),
        'tipo' => 'salida',
        'matricula' => 'XA-CAN',
        'equipo' => 'C172',
        'hora' => '10:30',
        'lugar' => 'MMTO',
        'pax' => 2,
        'departamento' => 'Trafico',
    ], $extra));
}

function cancelar(OperacionDiaria|int $operacion)
{
    $id = $operacion instanceof OperacionDiaria ? $operacion->id : $operacion;

    return test()->patchJson("/api/OperacionesDiarias/{$id}/cancelar");
}

// ---------------------------------------------------------------------------
// Migración y modelo
// ---------------------------------------------------------------------------

test('una operación nueva nace activa por el valor predeterminado de la columna', function () {
    $operacion = operacionDiariaActiva();

    expect($operacion->fresh()->status)->toBeTrue();
});

// ---------------------------------------------------------------------------
// Permisos
// ---------------------------------------------------------------------------

test('un invitado no puede cancelar', function () {
    $operacion = operacionDiariaActiva();

    cancelar($operacion)->assertUnauthorized();

    expect($operacion->fresh()->status)->toBeTrue();
});

test('empleado, jefe de área y admin reciben 403 y la operación sigue activa', function (string $slug, string $nombre) {
    $operacion = operacionDiariaActiva();

    $this->actingAs(usuarioConRol($slug, $nombre));

    cancelar($operacion)
        ->assertForbidden()
        ->assertJsonPath('message', 'Solo el personal FBO puede cancelar operaciones.');

    expect($operacion->fresh()->status)->toBeTrue();
})->with([
    ['empleado', 'Empleado'],
    ['jefe_area', 'Jefe de Área'],
    ['admin', 'Administrador'],
]);

// ---------------------------------------------------------------------------
// Cancelación
// ---------------------------------------------------------------------------

test('un usuario FBO cancela: status false, registro conservado y bitácora', function () {
    $operacion = operacionDiariaActiva();

    $this->actingAs(usuarioFbo());

    cancelar($operacion)
        ->assertOk()
        ->assertJsonPath('message', 'La operación fue cancelada correctamente.')
        ->assertJsonPath('operacion.id', $operacion->id)
        ->assertJsonPath('operacion.status', false);

    $guardada = OperacionDiaria::find($operacion->id);

    expect($guardada)->not->toBeNull()
        ->and($guardada->status)->toBeFalse()
        ->and($guardada->matricula)->toBe('XA-CAN')
        ->and($guardada->tipo)->toBe('salida');

    expect(Bitacora::query()
        ->where('modulo', Bitacora::MODULO_OPERACIONES_DIARIAS)
        ->where('accion', Bitacora::ACCION_DESACTIVAR)
        ->where('registro_id', $operacion->id)
        ->exists())->toBeTrue();
});

test('cancelar solo cambia status: el resto de los campos queda igual', function () {
    $operacion = operacionDiariaActiva(['observaciones' => 'Sin novedad', 'pax' => 5]);
    $antes = $operacion->fresh()->only(['fecha', 'tipo', 'matricula', 'equipo', 'hora', 'lugar', 'pax', 'observaciones', 'departamento']);

    $this->actingAs(usuarioFbo());
    cancelar($operacion)->assertOk();

    $despues = $operacion->fresh()->only(array_keys($antes));

    expect($despues)->toEqual($antes);
});

test('no se puede cancelar dos veces: la segunda responde 409', function () {
    $operacion = operacionDiariaActiva();

    $this->actingAs(usuarioFbo());

    cancelar($operacion)->assertOk();

    cancelar($operacion)
        ->assertStatus(409)
        ->assertJsonPath('message', 'La operación ya se encuentra cancelada.')
        ->assertJsonPath('codigo', 'ya_cancelada');

    expect(Bitacora::query()->where('accion', Bitacora::ACCION_DESACTIVAR)->count())->toBe(1);
});

test('una operación inexistente responde 404', function () {
    $this->actingAs(usuarioFbo());

    cancelar(999999)->assertNotFound();
});

test('cancelar una operación no toca la programada que la originó', function () {
    $programada = App\Models\OperacionProgramada::create([
        'user_id' => User::factory()->create()->id,
        'fecha' => Carbon::now(config('app.timezone'))->toDateString(),
        'tipo' => 'salida',
        'matricula' => 'XA-CAN',
        'equipo' => 'C172',
        'hora' => '10:30',
        'lugar' => 'MMTO',
        'pax' => 2,
        'status' => App\Models\OperacionProgramada::STATUS_REALIZADA,
    ]);
    $operacion = operacionDiariaActiva();

    $this->actingAs(usuarioFbo());
    cancelar($operacion)->assertOk();

    expect($programada->fresh()->status)->toBe(App\Models\OperacionProgramada::STATUS_REALIZADA);
});

// ---------------------------------------------------------------------------
// Consultas operativas
// ---------------------------------------------------------------------------

test('una salida cancelada deja de bloquear la siguiente salida de la matrícula', function () {
    $operacion = operacionDiariaActiva(['tipo' => 'salida', 'matricula' => 'XA-SEC']);

    $bloqueada = SecuenciaMovimientoService::validarFinal('XA-SEC', 'Salida', SecuenciaMovimientoService::FUENTE_OPERACIONES_DIARIAS);
    expect($bloqueada['valido'])->toBeFalse();

    $this->actingAs(usuarioFbo());
    cancelar($operacion)->assertOk();

    $libre = SecuenciaMovimientoService::validarFinal('XA-SEC', 'Salida', SecuenciaMovimientoService::FUENTE_OPERACIONES_DIARIAS);
    expect($libre['valido'])->toBeTrue()
        ->and(SecuenciaMovimientoService::ultimoMovimientoOperacionDiaria('XA-SEC'))->toBeNull();
});

test('los pendientes de validación ignoran operaciones canceladas', function () {
    $activa = operacionDiariaActiva(['matricula' => 'XA-ACT']);
    $cancelada = operacionDiariaActiva(['matricula' => 'XA-OFF', 'status' => false]);

    $this->actingAs(usuarioFbo());

    $ids = $this->getJson('/api/OperacionesDiarias/pendientes?modulo=Seguridad')
        ->assertOk()
        ->json();

    expect(collect($ids)->pluck('id')->all())->toBe([$activa->id])
        ->and(collect($ids)->pluck('id'))->not->toContain($cancelada->id);
});

test('verificarExistente no considera una operación cancelada como existente', function () {
    $hoy = Carbon::now(config('app.timezone'))->toDateString();
    operacionDiariaActiva(['matricula' => 'XA-VER', 'status' => false, 'fecha' => $hoy]);

    $this->actingAs(usuarioFbo());

    $this->getJson('/api/OperacionesDiarias/verificar?matricula=XA-VER&fecha='.$hoy.'&tipo=salida&modulo=Seguridad')
        ->assertOk()
        ->assertJsonPath('existe', false);
});

test('los conteos del turno solo cuentan operaciones activas', function () {
    operacionDiariaActiva(['tipo' => 'salida']);
    operacionDiariaActiva(['tipo' => 'salida', 'status' => false]);
    operacionDiariaActiva(['tipo' => 'llegada']);

    $this->actingAs(usuarioFbo());

    $this->getJson('/api/EntregarTurno/OperacionDiaria')
        ->assertOk()
        ->assertJsonPath('salidas', 1)
        ->assertJsonPath('llegadas', 1);
});

// ---------------------------------------------------------------------------
// Historial
// ---------------------------------------------------------------------------

test('el listado deja de mostrar la operación cancelada, pero el registro sigue en la base de datos', function () {
    $activa = operacionDiariaActiva(['matricula' => 'XA-VIS']);
    $operacion = operacionDiariaActiva();

    $this->actingAs(usuarioFbo());
    cancelar($operacion)->assertOk();

    $ids = collect($this->getJson('/api/OperacionesDiarias')->assertOk()->json('data'))->pluck('id');

    expect($ids)->toContain($activa->id)
        ->and($ids)->not->toContain($operacion->id)
        ->and(OperacionDiaria::find($operacion->id))->not->toBeNull()
        ->and(OperacionDiaria::find($operacion->id)->status)->toBeFalse();
});
