<?php

use App\Models\EntregaTurnoSeguridad;
use App\Models\Firma;
use App\Models\Role;
use App\Models\User;

/*
 * El botón de pendientes del FBO: qué relevos le faltan por firmar.
 *
 * Son por SECCIÓN, no por día: si el frente entregó y el de atrás no,
 * pendientes enseña solo el del frente.
 */

/**
 * El nombre lleva sufijo a propósito.
 *
 * En Pest las funciones declaradas en un archivo de pruebas son GLOBALES de
 * toda la suite, y `usuarioConRol` ya existe en
 * `tests/Feature/OperacionesDiarias/CancelarOperacionTest.php`. Declararla
 * otra vez da un fatal por redeclaración que no se ve corriendo solo esta
 * carpeta y revienta `php artisan test` completo.
 */
function usuarioFboDePendientes(string $slug): User
{
    $usuario = User::factory()->create();
    $rol = Role::firstOrCreate(['slug' => $slug], ['nombre' => ucfirst($slug)]);
    $usuario->roles()->attach($rol->id);

    return $usuario;
}

function relevoEn(string $fechaHora, string $seccion, array $extra = []): EntregaTurnoSeguridad
{
    return EntregaTurnoSeguridad::create(array_merge([
        'user_id' => User::factory()->create()->id,
        'fecha_hora' => $fechaHora,
        'seccion' => $seccion,
    ], $extra));
}

/**
 * Firma un relevo con el rol que se le diga.
 *
 * El rol es un parámetro y no una constante escondida a propósito: con un
 * ayudante que solo supiera firmar como FBO, el filtro `firmables.rol` de
 * `pendientes()` no tendría quien lo vigilara, y quitarlo no rompería
 * ninguna prueba. Eso importa porque `store` adjunta la firma de quien
 * entrega a TODOS los relevos: sin el filtro, cada relevo contaría como
 * firmado y la cola del FBO quedaría siempre vacía.
 */
function firmarConRol(EntregaTurnoSeguridad $relevo, string $rol): void
{
    $firma = Firma::create([
        'disk' => 'public',
        'path' => 'firmas/prueba/'.$rol.'-'.$relevo->id.'.png',
        'original_name' => $rol.'.png',
        'mime' => 'image/png',
        'size' => 10,
        'sha1' => sha1($rol.$relevo->id),
    ]);

    $relevo->firmas()->attach($firma->id, [
        'rol' => $rol,
        'orden' => 0,
        'status' => 'A',
    ]);
}

function pendientes(): \Illuminate\Testing\TestResponse
{
    return test()->actingAs(usuarioFboDePendientes('fbo'))
        ->getJson('/api/EntregaTurnoSeguridad/pendientes');
}

test('lista solo lo que le falta firmar al FBO', function () {
    $firmado = relevoEn('2026-11-04 07:30:00', EntregaTurnoSeguridad::SECCION_FRENTE);
    $sinFirmar = relevoEn('2026-11-04 19:00:00', EntregaTurnoSeguridad::SECCION_ATRAS);

    firmarConRol($firmado, EntregaTurnoSeguridad::ROL_FBO);

    expect(array_column(pendientes()->assertSuccessful()->json('data'), 'id'))
        ->toBe([$sinFirmar->id]);
});

test('deja de listar un relevo en cuanto se firma', function () {
    $relevo = relevoEn('2026-11-04 07:30:00', EntregaTurnoSeguridad::SECCION_FRENTE);

    expect(array_column(pendientes()->json('data'), 'id'))->toBe([$relevo->id]);

    firmarConRol($relevo, EntregaTurnoSeguridad::ROL_FBO);

    expect(pendientes()->json('data'))->toBe([]);
});

test('una firma retirada vuelve a dejarlo pendiente', function () {
    // Retirar es poner el pivote en 'N'. Si `pendientes` mirara el
    // historial en vez de las vigentes, este relevo seguiría dado por
    // firmado y nadie lo firmaría de nuevo.
    $relevo = relevoEn('2026-11-04 07:30:00', EntregaTurnoSeguridad::SECCION_FRENTE);
    firmarConRol($relevo, EntregaTurnoSeguridad::ROL_FBO);

    $relevo->firmasAll()->newPivotStatement()
        ->where('firmable_id', $relevo->id)
        ->update(['status' => 'N']);

    expect(array_column(pendientes()->json('data'), 'id'))->toBe([$relevo->id]);
});

test('un relevo retirado no sale como pendiente', function () {
    relevoEn('2026-11-04 07:30:00', EntregaTurnoSeguridad::SECCION_FRENTE, ['status' => 'N']);

    expect(pendientes()->json('data'))->toBe([]);
});

test('lo más viejo va primero: es la cola de trabajo del FBO', function () {
    $nuevo = relevoEn('2026-11-04 07:30:00', EntregaTurnoSeguridad::SECCION_FRENTE);
    $viejo = relevoEn('2026-11-01 19:00:00', EntregaTurnoSeguridad::SECCION_ATRAS);

    expect(array_column(pendientes()->json('data'), 'id'))->toBe([$viejo->id, $nuevo->id]);
});

test('la firma de quien entrega no cuenta como la del FBO', function () {
    // El relevo lleva SOLO la firma de quien entrega, que es lo que `store`
    // adjunta a todos. Sin el filtro `firmables.rol` de `pendientes()`, esa
    // firma lo daría por firmado y la cola quedaría siempre vacía: la función
    // entera muerta sin una sola prueba roja.
    $relevo = relevoEn('2026-11-04 07:30:00', EntregaTurnoSeguridad::SECCION_FRENTE);
    firmarConRol($relevo, EntregaTurnoSeguridad::ROL_QUIEN_ENTREGA);

    expect(array_column(pendientes()->json('data'), 'id'))->toBe([$relevo->id]);
});

test('con la misma fecha y hora el orden lo rompe el id', function () {
    // El frente y atrás del mismo relevo pueden compartir `fecha_hora`. Sin
    // un desempate, el orden lo decide la base y cambia entre corridas.
    $primero = relevoEn('2026-11-04 07:30:00', EntregaTurnoSeguridad::SECCION_FRENTE);
    $segundo = relevoEn('2026-11-04 07:30:00', EntregaTurnoSeguridad::SECCION_ATRAS);

    expect(array_column(pendientes()->json('data'), 'id'))
        ->toBe([$primero->id, $segundo->id]);
});

test('cada pendiente dice de quién, de cuándo y de qué sección es', function () {
    $usuario = User::factory()->create(['name' => 'Luis Gómez']);
    relevoEn('2026-11-04 19:45:00', EntregaTurnoSeguridad::SECCION_ATRAS, ['user_id' => $usuario->id]);

    $pendiente = pendientes()->json('data.0');

    expect($pendiente['nombre'])->toBe('Luis Gómez')
        ->and($pendiente['fecha'])->toBe('2026-11-04')
        ->and($pendiente['hora'])->toBe('19:45')
        ->and($pendiente['seccion'])->toBe(EntregaTurnoSeguridad::SECCION_ATRAS);
});
