<?php

use App\Models\EntregaTurnoSeguridad;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

/*
 * Editar y eliminar son de `fbo` y `admin`. El front esconde los botones,
 * pero eso no es un permiso: el servidor es el que decide.
 *
 * La firma del FBO llega por este mismo PUT, en `firma_fbo`.
 */

function usuarioCon(string $slug): User
{
    $usuario = User::factory()->create();
    $rol = Role::firstOrCreate(['slug' => $slug], ['nombre' => ucfirst($slug)]);
    $usuario->roles()->attach($rol->id);

    return $usuario;
}

function relevoGuardado(array $extra = []): EntregaTurnoSeguridad
{
    return EntregaTurnoSeguridad::create(array_merge([
        'user_id' => User::factory()->create()->id,
        'fecha_hora' => '2026-11-04 07:30:00',
        'seccion' => EntregaTurnoSeguridad::SECCION_FRENTE,
    ], $extra));
}

function firmaBase64Valida(): string
{
    return 'data:image/png;base64,'
        .'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
}

beforeEach(function () {
    Storage::fake('public');
});

test('un empleado no puede editar', function () {
    $relevo = relevoGuardado();

    $this->actingAs(usuarioCon('empleado'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", ['combustible' => true])
        ->assertForbidden();

    expect($relevo->fresh()->combustible)->toBeFalse();
});

test('un empleado no puede eliminar', function () {
    $relevo = relevoGuardado();

    $this->actingAs(usuarioCon('empleado'))
        ->getJson("/api/EntregaTurnoSeguridad/eliminar/{$relevo->id}")
        ->assertForbidden();

    expect($relevo->fresh()->status)->toBe('A');
});

test('el fbo y el admin sí pueden editar', function (string $slug) {
    $relevo = relevoGuardado();

    $this->actingAs(usuarioCon($slug))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", ['combustible' => true])
        ->assertSuccessful();

    expect($relevo->fresh()->combustible)->toBeTrue();
})->with(['fbo', 'admin']);

test('el fbo y el admin sí pueden eliminar', function (string $slug) {
    $relevo = relevoGuardado();

    $this->actingAs(usuarioCon($slug))
        ->getJson("/api/EntregaTurnoSeguridad/eliminar/{$relevo->id}")
        ->assertSuccessful();

    expect($relevo->fresh()->status)->toBe('N');
})->with(['fbo', 'admin']);

test('eliminar solo cambia el status: el renglón sigue en la base', function () {
    $relevo = relevoGuardado();

    $this->actingAs(usuarioCon('fbo'))
        ->getJson("/api/EntregaTurnoSeguridad/eliminar/{$relevo->id}")
        ->assertSuccessful();

    // `find` sin el scope ve todo: el modelo no tiene scopes globales, el
    // filtro de activas es local. Si el registro se hubiera borrado de
    // verdad, este primer aserto fallaría.
    expect(EntregaTurnoSeguridad::find($relevo->id))->not->toBeNull()
        ->and(EntregaTurnoSeguridad::activas()->find($relevo->id))->toBeNull();
});

test('eliminar algo que no existe devuelve 404', function () {
    $this->actingAs(usuarioCon('fbo'))
        ->getJson('/api/EntregaTurnoSeguridad/eliminar/999')
        ->assertNotFound();
});

test('la firma del FBO llega por el PUT y deja de faltar', function () {
    $relevo = relevoGuardado();

    $this->actingAs(usuarioCon('fbo'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'firma_fbo' => firmaBase64Valida(),
        ])
        ->assertSuccessful();

    $relevo->load('firmas');

    expect($relevo->tieneFirmaDe(EntregaTurnoSeguridad::ROL_FBO))->toBeTrue();
});

test('volver a firmar deja la anterior retirada y una sola vigente', function () {
    $relevo = relevoGuardado();
    $fbo = usuarioCon('fbo');

    foreach ([1, 2] as $vez) {
        $this->actingAs($fbo)
            ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
                'firma_fbo' => firmaBase64Valida(),
            ])
            ->assertSuccessful();
    }

    expect($relevo->firmas()->wherePivot('rol', EntregaTurnoSeguridad::ROL_FBO)->count())->toBe(1)
        ->and($relevo->firmasAll()->wherePivot('rol', EntregaTurnoSeguridad::ROL_FBO)->count())->toBe(2)
        ->and($relevo->firmasAll()->wherePivot('status', 'N')->count())->toBe(1);
});

test('un texto que no es una firma se rechaza también al editar', function () {
    // El mismo hueco que al crear: sin la regla de forma, el guardia hacía
    // `return` en silencio y la respuesta decía que todo salió bien mientras
    // el relevo se quedaba sin la firma del FBO.
    $relevo = relevoGuardado();

    $this->actingAs(usuarioCon('fbo'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", ['firma_fbo' => 'abc'])
        ->assertJsonValidationErrorFor('firma_fbo');

    $relevo->load('firmas');

    expect($relevo->tieneFirmaDe(EntregaTurnoSeguridad::ROL_FBO))->toBeFalse();
});

test('una firma vacía al editar significa «no firmé», no un error', function () {
    // `nullable` no se salta la regex con `''`, solo con null, así que sin el
    // prepareForValidation un formulario que arranque con useState('')
    // recibiría 422 por no haber firmado.
    $relevo = relevoGuardado();

    $this->actingAs(usuarioCon('fbo'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'firma_fbo' => '',
            'combustible' => true,
        ])
        ->assertSuccessful();

    expect($relevo->fresh()->combustible)->toBeTrue();
});

test('el detalle trae el nombre, la hora en 24 horas y las firmas', function () {
    $usuario = User::factory()->create(['name' => 'Ana Robles']);
    $relevo = relevoGuardado(['user_id' => $usuario->id, 'fecha_hora' => '2026-11-04 19:45:00']);

    $this->actingAs(usuarioCon('fbo'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", ['firma_fbo' => firmaBase64Valida()])
        ->assertSuccessful();

    $datos = $this->actingAs(usuarioCon('empleado'))
        ->getJson("/api/EntregaTurnoSeguridad/{$relevo->id}")
        ->assertSuccessful()
        ->json('data');

    expect($datos['nombre'])->toBe('Ana Robles')
        ->and($datos['hora'])->toBe('19:45')
        ->and($datos['fecha'])->toBe('2026-11-04')
        ->and(array_column($datos['firmas'], 'rol'))->toContain(EntregaTurnoSeguridad::ROL_FBO);
});

test('el detalle lo puede ver cualquiera con sesión', function () {
    $relevo = relevoGuardado();

    $this->actingAs(usuarioCon('empleado'))
        ->getJson("/api/EntregaTurnoSeguridad/{$relevo->id}")
        ->assertSuccessful();
});

test('la edición no deja cambiar de dueño', function () {
    $otro = User::factory()->create();
    $relevo = relevoGuardado();
    $dueno = $relevo->user_id;

    $this->actingAs(usuarioCon('fbo'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", ['user_id' => $otro->id])
        ->assertSuccessful();

    expect($relevo->fresh()->user_id)->toBe($dueno);
});

test('la edición respeta las tres letras de la pernocta mensual', function () {
    $relevo = relevoGuardado();

    $this->actingAs(usuarioCon('fbo'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", ['pernocta_mensual' => 'X'])
        ->assertJsonValidationErrorFor('pernocta_mensual');

    expect($relevo->fresh()->pernocta_mensual)
        ->toBe(EntregaTurnoSeguridad::PERNOCTA_SIN_REVISAR);
});
