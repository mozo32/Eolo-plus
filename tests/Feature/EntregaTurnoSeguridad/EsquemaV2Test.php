<?php

use App\Models\EntregaTurnoSeguridad;
use App\Models\Firma;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * El esquema de la tabla tras la segunda y la tercera versión: sin casillas,
 * sin pernocta mensual, sin puesto, con el resumen congelado y con el índice
 * sobre la fecha sola.
 *
 * Lo que sqlite NO puede ver desde aquí: que el índice nuevo exista y
 * funcione igual en MySQL, ni que su nombre quepa en los 64 caracteres que
 * MySQL admite (eso lo vigila la prueba de nombres del modelo). La
 * comprobación contra MySQL se hace a mano al cerrar la tarea, que es la
 * misma clase de defecto que una vez dejó un índice de 69 caracteres pasar
 * toda la suite.
 */

function relevoDeEsquema(array $extra = []): EntregaTurnoSeguridad
{
    return EntregaTurnoSeguridad::create(array_merge([
        'user_id' => User::factory()->create()->id,
        'fecha_hora' => '2026-11-09 08:00:00',
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

test('la tabla ya no guarda el puesto', function () {
    expect(Schema::hasColumn('entregas_turno_seguridad', 'seccion'))->toBeFalse();
});

test('el indice queda sobre la fecha sola', function () {
    // Cambiar o borrar una columna indexada hace que sqlite recree la tabla.
    // Si el índice se perdiera por el camino, el listado seguiría funcionando
    // y nadie lo notaría hasta que la tabla creciera.
    $nombres = collect(Schema::getIndexes('entregas_turno_seguridad'))->pluck('name');

    expect($nombres)->not->toBeEmpty()
        ->and($nombres)->toContain('entregas_turno_seg_fecha_idx')
        ->and($nombres)->not->toContain('entregas_turno_seg_fecha_seccion_idx');
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

test('la migracion v3 reescribe el texto congelado en las dos direcciones y no toca las cifras', function () {
    // Se siembra en crudo y con los textos NUEVOS, que es como queda un relevo
    // tras la v3. El tercer renglón no tiene ninguna frase a cambiar y va con
    // espacios y llaves a propósito: debe salir byte a byte igual.
    $intacto = '{ "0": {"clave":"x", "texto":"Otra cosa", "total": 2} }';

    DB::table('entregas_turno_seguridad')->insert([
        [
            'user_id' => User::factory()->create()->id,
            'fecha_hora' => '2026-11-09 08:00:00',
            'resumen' => json_encode([
                ['clave' => 'vehiculos', 'texto' => 'No hay movimientos', 'entradas' => 0, 'salidas' => 0, 'total' => 0],
                ['clave' => 'pernocta', 'texto' => 'No hay pernoctas', 'total' => 0],
                ['clave' => 'aviones', 'texto' => '3 entradas y 2 salidas', 'entradas' => 3, 'salidas' => 2, 'total' => 5],
            ]),
        ],
        [
            'user_id' => User::factory()->create()->id,
            'fecha_hora' => '2026-11-09 09:00:00',
            'resumen' => $intacto,
        ],
    ]);

    $leer = fn (): array => DB::table('entregas_turno_seguridad')->orderBy('id')->pluck('resumen')->all();
    $cifras = fn (array $renglones): array => array_map(
        fn (array $r) => array_intersect_key($r, array_flip(['entradas', 'salidas', 'total'])),
        $renglones,
    );
    $antes = $cifras(json_decode($leer()[0], true));

    // down() devuelve la columna y las frases viejas.
    expect(Artisan::call('migrate:rollback', ['--step' => 1]))->toBe(0);

    $enRollback = json_decode($leer()[0], true);

    expect(Schema::hasColumn('entregas_turno_seguridad', 'seccion'))->toBeTrue()
        ->and($enRollback[0]['texto'])->toBe('Sin registros')
        ->and($enRollback[1]['texto'])->toBe('Sin pernoctas')
        ->and($enRollback[2]['texto'])->toBe('3 entradas y 2 salidas')
        ->and($cifras($enRollback))->toBe($antes)
        ->and($leer()[1])->toBe($intacto);

    // up() otra vez: vuelven las frases nuevas, la columna se va, el índice nuevo está.
    expect(Artisan::call('migrate'))->toBe(0);

    $despues = json_decode($leer()[0], true);
    $nombres = collect(Schema::getIndexes('entregas_turno_seguridad'))->pluck('name');

    expect(Schema::hasColumn('entregas_turno_seguridad', 'seccion'))->toBeFalse()
        ->and($nombres)->toContain('entregas_turno_seg_fecha_idx')
        ->and($nombres)->not->toContain('entregas_turno_seg_fecha_seccion_idx')
        ->and($despues[0]['texto'])->toBe('No hay movimientos')
        ->and($despues[1]['texto'])->toBe('No hay pernoctas')
        ->and($cifras($despues))->toBe($antes)
        ->and($despues[0]['entradas'])->toBe(0)
        ->and($despues[2]['entradas'])->toBe(3)
        ->and($despues[2]['salidas'])->toBe(2)
        ->and($despues[2]['total'])->toBe(5)
        ->and($leer()[1])->toBe($intacto);
});
