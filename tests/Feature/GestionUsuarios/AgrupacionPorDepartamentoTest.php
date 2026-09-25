<?php

use App\Models\Bitacora;
use App\Models\Departamento;
use App\Models\Role;
use App\Models\SubDepartamento;
use App\Models\User;

/*
 * Gestión de usuarios: el listado se puede agrupar por departamento para
 * asignar módulos en bloque. La asignación masiva suma permisos sin quitar los
 * que cada usuario ya tenía; la individual sigue reemplazando.
 */

function departamentoCon(string $nombre, array $subdepartamentos = []): Departamento
{
    $depto = Departamento::firstOrCreate(['nombre' => $nombre]);

    foreach ($subdepartamentos as $sub) {
        SubDepartamento::firstOrCreate([
            'departamento_id' => $depto->id,
            'nombre' => $sub,
        ]);
    }

    return $depto;
}

function usuarioDe(Departamento $depto, string $nombre, string $statusVinculo = 'A'): User
{
    $usuario = User::factory()->create(['name' => $nombre]);
    $usuario->departamentos()->attach($depto->id, ['status' => $statusVinculo]);

    return $usuario;
}

function sub(Departamento $depto, string $nombre): SubDepartamento
{
    return SubDepartamento::firstOrCreate([
        'departamento_id' => $depto->id,
        'nombre' => $nombre,
    ]);
}

function payloadAsignacion(array $userIds, array $subIds, string $modo, ?int $roleId = null): array
{
    $porDepartamento = SubDepartamento::whereIn('id', $subIds)
        ->get()
        ->groupBy('departamento_id')
        ->map(fn ($subs, $depId) => [
            'departamento_id' => (int) $depId,
            'subdepartamentos' => $subs->pluck('id')->all(),
        ])
        ->values()
        ->all();

    return array_filter([
        'modo' => $modo,
        'role_id' => $roleId,
        'user_ids' => $userIds,
        'asignaciones' => $porDepartamento ?: [['departamento_id' => 1, 'subdepartamentos' => []]],
    ], fn ($v) => $v !== null);
}

// ---------------------------------------------------------------------------
// Permisos
// ---------------------------------------------------------------------------

test('los endpoints de administración son solo para admin', function () {
    $otro = User::factory()->create();

    $rutas = [
        '/api/administracion/users',
        '/api/administracion/users/ids',
        '/api/administracion/departamentos',
        "/api/administracion/users/{$otro->id}/departamentos",
    ];

    // Sin sesión.
    foreach ($rutas as $ruta) {
        $this->getJson($ruta)->assertUnauthorized();
    }
    $this->postJson('/api/administracion/users/departamentos-masivo', [])->assertUnauthorized();

    // Con sesión, pero sin rol admin.
    $this->actingAs(usuarioSinAcceso());

    foreach ($rutas as $ruta) {
        $this->getJson($ruta)->assertForbidden();
    }

    $this->postJson('/api/administracion/users/departamentos-masivo', payloadAsignacion(
        [$otro->id],
        [],
        'agregar',
    ))->assertForbidden();
});

// ---------------------------------------------------------------------------
// Agrupar por departamento
// ---------------------------------------------------------------------------

test('el listado se filtra por departamento y excluye al propio administrador', function () {
    $trafico = departamentoCon('Trafico');
    $rampa = departamentoCon('Rampa');

    usuarioDe($trafico, 'ANA TRAFICO');
    usuarioDe($trafico, 'BETO TRAFICO');
    usuarioDe($rampa, 'CARLA RAMPA');
    usuarioDe($trafico, 'DIEGO INACTIVO', 'N');

    $admin = usuarioAdmin();
    $admin->departamentos()->attach($trafico->id, ['status' => 'A']);

    $this->actingAs($admin);

    $nombres = fn (string $q = '') => collect(
        $this->getJson("/api/administracion/users?{$q}")->assertOk()->json('data')
    )->pluck('name')->all();

    expect($nombres("departamento_id={$trafico->id}"))->toBe(['ANA TRAFICO', 'BETO TRAFICO'])
        ->and($nombres("departamento_id={$rampa->id}"))->toBe(['CARLA RAMPA'])
        ->and($nombres("departamento_id={$trafico->id}&search=beto"))->toBe(['BETO TRAFICO']);

    // Cada fila trae el nombre de sus areas para la columna Departamentos, sin
    // arrastrar los subdepartamentos que el listado no usa.
    $fila = $this->getJson("/api/administracion/users?departamento_id={$trafico->id}")->json('data.0');

    expect(collect($fila['departamentos'])->pluck('nombre')->all())->toBe(['Trafico'])
        ->and($fila['departamentos'][0])->not->toHaveKey('subdepartamentos');
});

test('se pueden listar los usuarios que aún no tienen departamento', function () {
    $trafico = departamentoCon('Trafico');
    usuarioDe($trafico, 'ANA TRAFICO');
    User::factory()->create(['name' => 'NUEVO SIN AREA']);
    usuarioDe($trafico, 'VINCULO CAIDO', 'N');

    $this->actingAs(usuarioAdmin());

    $nombres = collect($this->getJson('/api/administracion/users?sin_departamento=1')->assertOk()->json('data'))
        ->pluck('name')->all();

    expect($nombres)->toBe(['NUEVO SIN AREA', 'VINCULO CAIDO']);
});

test('el catálogo de departamentos trae el conteo de usuarios y sus módulos', function () {
    $trafico = departamentoCon('Trafico', ['operacionesDiarias', 'prestamoChalecos']);
    departamentoCon('Rampa', ['relacionPlanta']);

    usuarioDe($trafico, 'ANA');
    usuarioDe($trafico, 'BETO');
    usuarioDe($trafico, 'INACTIVO', 'N');
    User::factory()->create(['name' => 'SIN AREA']);

    $this->actingAs(usuarioAdmin());

    $respuesta = $this->getJson('/api/administracion/departamentos')->assertOk()->json();
    $departamentos = collect($respuesta['departamentos'])->keyBy('nombre');

    expect($departamentos['Trafico']['usuarios'])->toBe(2)
        ->and($departamentos['Rampa']['usuarios'])->toBe(0)
        ->and(collect($departamentos['Trafico']['subdepartamentos'])->pluck('nombre')->all())
        ->toBe(['operacionesDiarias', 'prestamoChalecos']);

    // SIN AREA y el de vínculo inactivo; el propio admin no se cuenta.
    expect($respuesta['sin_departamento'])->toBe(2);
});

test('el endpoint de ids devuelve todo el grupo filtrado, no solo la página visible', function () {
    $trafico = departamentoCon('Trafico');
    $rampa = departamentoCon('Rampa');

    $deTrafico = collect(range(1, 12))->map(fn ($i) => usuarioDe($trafico, "TRAFICO {$i}")->id)->sort()->values();
    usuarioDe($rampa, 'DE RAMPA');

    $this->actingAs(usuarioAdmin());

    $ids = $this->getJson("/api/administracion/users/ids?departamento_id={$trafico->id}")
        ->assertOk()
        ->json('ids');

    expect(collect($ids)->sort()->values()->all())->toBe($deTrafico->all())
        ->and($this->getJson("/api/administracion/users/ids?departamento_id={$trafico->id}&search=trafico 1")->json('ids'))
        ->toHaveCount(4); // TRAFICO 1, 10, 11 y 12
});

// ---------------------------------------------------------------------------
// Asignación masiva: agregar sin quitar
// ---------------------------------------------------------------------------

test('el modo agregar suma los módulos nuevos sin borrar los que ya tenía cada usuario', function () {
    $trafico = departamentoCon('Trafico');
    $diarias = sub($trafico, 'operacionesDiarias');
    $medicamentos = sub($trafico, 'controlMedicamento');
    $chalecos = sub($trafico, 'prestamoChalecos');

    $ana = usuarioDe($trafico, 'ANA');
    $ana->subdepartamentos()->attach($diarias->id, ['status' => 'A']);

    $beto = usuarioDe($trafico, 'BETO');
    $beto->subdepartamentos()->attach($medicamentos->id, ['status' => 'A']);

    $this->actingAs(usuarioAdmin());

    $this->postJson('/api/administracion/users/departamentos-masivo', payloadAsignacion(
        [$ana->id, $beto->id],
        [$chalecos->id],
        'agregar',
    ))->assertOk()->assertJsonPath('message', 'Módulos agregados a 2 usuarios sin quitarles los que ya tenían');

    $modulosDe = fn (User $u) => $u->subdepartamentos()->pluck('subdepartamentos.nombre')->sort()->values()->all();

    expect($modulosDe($ana->fresh()))->toBe(['operacionesDiarias', 'prestamoChalecos'])
        ->and($modulosDe($beto->fresh()))->toBe(['controlMedicamento', 'prestamoChalecos']);
});

test('el modo agregar no toca el rol de cada usuario si no se elige uno', function () {
    $trafico = departamentoCon('Trafico');
    $chalecos = sub($trafico, 'prestamoChalecos');

    $jefe = Role::firstOrCreate(['slug' => 'jefe_area'], ['nombre' => 'Jefe de Área']);
    $empleado = Role::firstOrCreate(['slug' => 'empleado'], ['nombre' => 'Empleado']);

    $ana = usuarioDe($trafico, 'ANA');
    $ana->roles()->attach($jefe->id);

    $beto = usuarioDe($trafico, 'BETO');
    $beto->roles()->attach($empleado->id);

    $this->actingAs(usuarioAdmin());

    $this->postJson('/api/administracion/users/departamentos-masivo', payloadAsignacion(
        [$ana->id, $beto->id],
        [$chalecos->id],
        'agregar',
    ))->assertOk();

    expect($ana->fresh()->roles()->pluck('slug')->all())->toBe(['jefe_area'])
        ->and($beto->fresh()->roles()->pluck('slug')->all())->toBe(['empleado']);
});

test('el modo agregar sin módulos ni rol se rechaza con 422', function () {
    $trafico = departamentoCon('Trafico');
    $ana = usuarioDe($trafico, 'ANA');

    $this->actingAs(usuarioAdmin());

    $this->postJson('/api/administracion/users/departamentos-masivo', payloadAsignacion(
        [$ana->id],
        [],
        'agregar',
    ))
        ->assertStatus(422)
        ->assertJsonPath('errors.asignaciones.0', 'Selecciona al menos un módulo o un rol para aplicar.');
});

test('el modo reemplazar sigue dejando al usuario solo con lo marcado', function () {
    $trafico = departamentoCon('Trafico');
    $diarias = sub($trafico, 'operacionesDiarias');
    $chalecos = sub($trafico, 'prestamoChalecos');
    $empleado = Role::firstOrCreate(['slug' => 'empleado'], ['nombre' => 'Empleado']);

    $ana = usuarioDe($trafico, 'ANA');
    $ana->subdepartamentos()->attach($diarias->id, ['status' => 'A']);

    $this->actingAs(usuarioAdmin());

    $this->postJson('/api/administracion/users/departamentos-masivo', payloadAsignacion(
        [$ana->id],
        [$chalecos->id],
        'reemplazar',
        $empleado->id,
    ))->assertOk()->assertJsonPath('message', 'Asignaciones aplicadas correctamente a 1 usuarios');

    expect($ana->fresh()->subdepartamentos()->pluck('subdepartamentos.nombre')->all())->toBe(['prestamoChalecos'])
        ->and($ana->fresh()->roles()->pluck('slug')->all())->toBe(['empleado']);
});

test('el modo es obligatorio y el rol solo lo es al reemplazar', function () {
    $trafico = departamentoCon('Trafico');
    $chalecos = sub($trafico, 'prestamoChalecos');
    $ana = usuarioDe($trafico, 'ANA');

    $this->actingAs(usuarioAdmin());

    $sinModo = payloadAsignacion([$ana->id], [$chalecos->id], 'agregar');
    unset($sinModo['modo']);

    $this->postJson('/api/administracion/users/departamentos-masivo', $sinModo)
        ->assertStatus(422)
        ->assertJsonValidationErrors(['modo']);

    $this->postJson('/api/administracion/users/departamentos-masivo', payloadAsignacion(
        [$ana->id],
        [$chalecos->id],
        'reemplazar',
    ))
        ->assertStatus(422)
        ->assertJsonValidationErrors(['role_id']);
});

test('la asignación queda registrada en la bitácora', function () {
    $trafico = departamentoCon('Trafico');
    $chalecos = sub($trafico, 'prestamoChalecos');
    $ana = usuarioDe($trafico, 'ANA');
    $admin = usuarioAdmin();

    $this->actingAs($admin);

    $this->postJson('/api/administracion/users/departamentos-masivo', payloadAsignacion(
        [$ana->id],
        [$chalecos->id],
        'agregar',
    ))->assertOk();

    $registro = Bitacora::query()
        ->where('modulo', Bitacora::MODULO_GESTION_USUARIOS)
        ->where('accion', Bitacora::ACCION_ACTUALIZAR)
        ->firstOrFail();

    expect($registro->usuario_id)->toBe($admin->id)
        ->and($registro->datos_nuevos['modo'])->toBe('agregar')
        ->and($registro->datos_nuevos['usuarios'])->toBe([$ana->id])
        ->and($registro->datos_nuevos['modulos'])->toBe(['prestamoChalecos']);
});
