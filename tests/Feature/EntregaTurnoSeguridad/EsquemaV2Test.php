<?php

use App\Models\EntregaTurnoSeguridad;
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
