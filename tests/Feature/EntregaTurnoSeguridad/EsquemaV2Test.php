<?php

use App\Models\EntregaTurnoSeguridad;
use App\Models\Firma;
use App\Models\User;
use Illuminate\Support\Facades\Schema;

/*
 * El esquema después de la segunda versión.
 *
 * Lo que sqlite NO puede ver desde aquí: que la columna `seccion` se
 * ensanchó a 16. sqlite no aplica longitudes de varchar, así que un
 * `string('seccion', 10)` pasaría estas pruebas igual. Esa comprobación se
 * hace a mano contra MySQL al cerrar la tarea, que es la misma clase de
 * defecto que una vez dejó un índice de 69 caracteres pasar toda la suite.
 */

function relevoDeEsquema(array $extra = []): EntregaTurnoSeguridad
{
    return EntregaTurnoSeguridad::create(array_merge([
        'user_id' => User::factory()->create()->id,
        'fecha_hora' => '2026-11-09 08:00:00',
        'seccion' => EntregaTurnoSeguridad::SECCION_CASETA,
    ], $extra));
}

/** Adjunta una firma vigente con el rol dado. Quien la use debe volver a hacer `load('firmas')`. */
function firmaDeEsquema(EntregaTurnoSeguridad $relevo, string $rol): void
{
    $firma = Firma::create([
        'disk' => 'public',
        'path' => 'firmas/prueba/'.$rol.'-'.$relevo->id.'.png',
        'original_name' => $rol.'.png',
        'mime' => 'image/png',
        'size' => 10,
        'sha1' => sha1($rol.$relevo->id),
    ]);

    $relevo->firmas()->attach($firma->id, ['rol' => $rol, 'orden' => 0, 'status' => 'A']);
}

test('la tabla ya no guarda casillas ni pernocta mensual', function (string $columna) {
    expect(Schema::hasColumn('entregas_turno_seguridad', $columna))->toBeFalse();
})->with([
    'aviones_csae',
    'combustible',
    'resguardo_vehicular',
    'estacionamiento',
    'posiciones',
    'vehiculos',
    'operaciones',
    'visitantes',
    'pernocta_mensual',
]);

test('la tabla guarda el resumen congelado', function () {
    expect(Schema::hasColumn('entregas_turno_seguridad', 'resumen'))->toBeTrue();
});

test('el indice de fecha y seccion sobrevive al cambio de la columna', function () {
    // Cambiar una columna indexada hace que sqlite recree la tabla. Si el
    // índice se perdiera por el camino, el listado seguiría funcionando y
    // nadie lo notaría hasta que la tabla creciera.
    $nombres = collect(Schema::getIndexes('entregas_turno_seguridad'))->pluck('name');

    expect($nombres)->not->toBeEmpty()
        ->and($nombres)->toContain('entregas_turno_seg_fecha_seccion_idx');
});

test('las secciones son caseta y plataforma', function () {
    expect(EntregaTurnoSeguridad::SECCIONES)
        ->toBe([EntregaTurnoSeguridad::SECCION_CASETA, EntregaTurnoSeguridad::SECCION_PLATAFORMA])
        ->and(EntregaTurnoSeguridad::SECCION_CASETA)->toBe('caseta')
        ->and(EntregaTurnoSeguridad::SECCION_PLATAFORMA)->toBe('plataforma');
});

test('los roles de cierre son el jefe de area y el fbo, en ese orden', function () {
    expect(EntregaTurnoSeguridad::ROL_JEFE_AREA)->toBe('jefe_area')
        ->and(EntregaTurnoSeguridad::ROLES_DE_CIERRE)->toBe(['jefe_area', 'fbo']);
});

test('el resumen se lee como arreglo y no como cadena', function () {
    $relevo = relevoDeEsquema(['resumen' => [['clave' => 'pernocta', 'total' => 3]]]);

    expect($relevo->fresh()->resumen)->toBeArray()
        ->and($relevo->fresh()->resumen[0]['total'])->toBe(3);
});

test('un relevo recien creado no tiene resumen congelado', function () {
    expect(relevoDeEsquema()->fresh()->resumen)->toBeNull();
});

test('firmasFaltantes nombra los dos roles de cierre cuando nadie firmo', function () {
    $relevo = relevoDeEsquema()->load('firmas');

    expect($relevo->firmasFaltantes())->toBe(['jefe_area', 'fbo'])
        ->and($relevo->estaCerrado())->toBeFalse();
});

test('firmasFaltantes solo nombra al fbo cuando firmo el jefe de area', function () {
    $relevo = relevoDeEsquema();
    firmaDeEsquema($relevo, EntregaTurnoSeguridad::ROL_JEFE_AREA);

    expect($relevo->load('firmas')->firmasFaltantes())->toBe(['fbo']);
});

test('firmasFaltantes solo nombra al jefe de area cuando firmo el fbo', function () {
    $relevo = relevoDeEsquema();
    firmaDeEsquema($relevo, EntregaTurnoSeguridad::ROL_FBO);

    expect($relevo->load('firmas')->firmasFaltantes())->toBe(['jefe_area']);
});

test('el relevo esta cerrado con las tres firmas', function () {
    $relevo = relevoDeEsquema();
    firmaDeEsquema($relevo, EntregaTurnoSeguridad::ROL_QUIEN_ENTREGA);
    firmaDeEsquema($relevo, EntregaTurnoSeguridad::ROL_JEFE_AREA);
    firmaDeEsquema($relevo, EntregaTurnoSeguridad::ROL_FBO);

    $relevo->load('firmas');

    expect($relevo->firmasFaltantes())->toBe([])
        ->and($relevo->estaCerrado())->toBeTrue();
});

test('sin la firma de quien entrega el relevo no esta cerrado aunque firmen los dos de cierre', function () {
    $relevo = relevoDeEsquema();
    firmaDeEsquema($relevo, EntregaTurnoSeguridad::ROL_JEFE_AREA);
    firmaDeEsquema($relevo, EntregaTurnoSeguridad::ROL_FBO);

    $relevo->load('firmas');

    expect($relevo->firmasFaltantes())->toBe([])
        ->and($relevo->estaCerrado())->toBeFalse();
});
