<?php

use App\Models\EntregaTurnoSeguridad;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

/*
 * Editar y eliminar son de `jefe_area`, `fbo` y `admin`. El front esconde los botones,
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
        'seccion' => EntregaTurnoSeguridad::SECCION_CASETA,
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
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", ['observaciones' => 'Nota nueva'])
        ->assertForbidden();

    expect($relevo->fresh()->observaciones)->toBeNull();
});

test('un empleado no puede eliminar', function () {
    $relevo = relevoGuardado();

    $this->actingAs(usuarioCon('empleado'))
        ->getJson("/api/EntregaTurnoSeguridad/eliminar/{$relevo->id}")
        ->assertForbidden();

    expect($relevo->fresh()->status)->toBe('A');
});

test('el fbo, el jefe de área y el admin sí pueden editar', function (string $slug) {
    $relevo = relevoGuardado();

    $this->actingAs(usuarioCon($slug))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", ['observaciones' => 'Nota nueva'])
        ->assertSuccessful();

    expect($relevo->fresh()->observaciones)->toBe('Nota nueva');
})->with(['fbo', 'jefe_area', 'admin']);

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

test('eliminar algo que no existe devuelve el 404 del controlador', function () {
    // El mensaje se asserta a propósito. Con solo `assertNotFound()`, la
    // prueba pasaría igual si alguien borrara la ruta: Laravel devuelve 404
    // cuando no hay ruta, y entonces la prueba daría por vigilado un guardia
    // que ya no se ejecuta. El mensaje solo lo escribe el controlador.
    $this->actingAs(usuarioCon('fbo'))
        ->getJson('/api/EntregaTurnoSeguridad/eliminar/999')
        ->assertNotFound()
        ->assertJson(['message' => 'El relevo no existe.']);
});

test('el detalle de algo que no existe devuelve el 404 del controlador', function () {
    $this->actingAs(usuarioCon('empleado'))
        ->getJson('/api/EntregaTurnoSeguridad/999')
        ->assertNotFound()
        ->assertJson(['message' => 'El relevo no existe.']);
});

test('editar algo que no existe devuelve el 404 del controlador', function () {
    $this->actingAs(usuarioCon('fbo'))
        ->putJson('/api/EntregaTurnoSeguridad/999', ['observaciones' => 'Nota nueva'])
        ->assertNotFound()
        ->assertJson(['message' => 'El relevo no existe.']);
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
    // Lo que hace que esto funcione NO es código de este módulo: Laravel
    // registra `ConvertEmptyStringsToNull` en su pila global, así que el `''`
    // llega al Form Request ya como `null` y `nullable` se salta la regex.
    //
    // La prueba se queda porque el comportamiento importa: un formulario que
    // arranque con `useState('')` no debe recibir 422 por no haber firmado.
    // Pero vigila el comportamiento de punta a punta, no un guardia propio;
    // si alguien desactivara ese middleware, esta prueba lo diría.
    $relevo = relevoGuardado();

    $this->actingAs(usuarioCon('fbo'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'firma_fbo' => '',
            'observaciones' => 'Nota nueva',
        ])
        ->assertSuccessful();

    expect($relevo->fresh()->observaciones)->toBe('Nota nueva');
});

test('un relevo eliminado deja de poder verse y de poder editarse', function () {
    // Sin estas dos, quitar el `activas()` de `show` o de `update` no rompería
    // ninguna prueba: la de «solo cambia el status» comprueba el scope del
    // modelo, no que los endpoints lo usen. Un relevo borrado que se pueda
    // seguir editando es un borrado que no borra.
    $relevo = relevoGuardado(['status' => 'N']);

    $this->actingAs(usuarioCon('empleado'))
        ->getJson("/api/EntregaTurnoSeguridad/{$relevo->id}")
        ->assertNotFound()
        ->assertJson(['message' => 'El relevo no existe.']);

    $this->actingAs(usuarioCon('fbo'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", ['observaciones' => 'Nota nueva'])
        ->assertNotFound()
        ->assertJson(['message' => 'El relevo no existe.']);

    expect($relevo->fresh()->observaciones)->toBeNull();
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

test('el detalle fija el contrato que lee la vista previa', function () {
    // La vista previa lee estas claves POR NOMBRE, y `tsc` no atrapa que
    // alguien las renombre en el servidor: no hay corredor de pruebas de
    // JavaScript. Esta prueba es la única red de ese contrato.
    //
    // Las DOS firmas van en el PUT porque las dos pantallas buscan la suya
    // por el `rol` del pivote: `VistaPreviaEntregaTurno` pinta las dos
    // columnas y `FormEntregaTurno` enseña la firma vigente de cada rol. Con
    // solo la del FBO vigilado, un renombre de `quien_entrega` pasaba.
    $relevo = relevoGuardado(['observaciones' => 'Quedó una camioneta sin resguardo.']);

    $this->actingAs(usuarioCon('fbo'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'firma_quien_entrega' => firmaBase64Valida(),
            'firma_fbo' => firmaBase64Valida(),
        ])
        ->assertSuccessful();

    $datos = $this->actingAs(usuarioCon('empleado'))
        ->getJson("/api/EntregaTurnoSeguridad/{$relevo->id}")
        ->assertSuccessful()
        ->json('data');

    foreach (['id', 'nombre', 'fecha', 'hora', 'fecha_hora', 'seccion', 'resumen', 'observaciones', 'firmas'] as $clave) {
        expect($datos)->toHaveKey($clave);
    }

    expect($datos['firmas'][0])->toHaveKeys(['id', 'rol', 'tag', 'url'])
        ->and($datos['firmas'][0]['url'])->toBeString()
        ->and(array_column($datos['firmas'], 'rol'))->toContain(
            EntregaTurnoSeguridad::ROL_QUIEN_ENTREGA,
            EntregaTurnoSeguridad::ROL_FBO,
        )
        ->and($datos['observaciones'])->toBe('Quedó una camioneta sin resguardo.')
        ->and($datos['hora'])->toMatch('/^\d{2}:\d{2}$/');
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

test('un id que no es un número no llega al controlador', function (string $metodo, string $ruta) {
    // Sin el `->whereNumber('id')` de las rutas, los métodos reciben
    // `int $id` y un `/abc` revienta con TypeError y 500 en vez de 404.
    // La restricción es del framework, pero sin esta prueba nadie nota si
    // alguien la quita.
    //
    // Las TRES rutas con `{id}` entran en el dataset: vigilar solo una
    // dejaría las otras dos sin guardia, que es la misma deuda una capa
    // más abajo.
    $this->actingAs(usuarioCon('fbo'))
        ->json($metodo, $ruta)
        ->assertNotFound();
})->with([
    'detalle' => ['GET', '/api/EntregaTurnoSeguridad/abc'],
    'editar' => ['PUT', '/api/EntregaTurnoSeguridad/abc'],
    'eliminar' => ['GET', '/api/EntregaTurnoSeguridad/eliminar/abc'],
]);
