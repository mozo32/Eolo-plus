<?php

use App\Models\EntregaTurnoSeguridad;
use App\Models\Firma;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;

/*
 * El registro de un relevo de Seguridad: una fila por sección, con sus
 * valores por omisión y sus firmas polimórficas.
 *
 * Las letras de estado son 'A' activo y 'N' retirado, igual que en el
 * resto del servidor.
 */

function relevoDeSeguridad(array $extra = []): EntregaTurnoSeguridad
{
    return EntregaTurnoSeguridad::create(array_merge([
        'user_id' => User::factory()->create()->id,
        'fecha_hora' => Carbon::now(config('app.timezone'))->format('Y-m-d H:i:s'),
    ], $extra));
}

function firmaDePrueba(string $nombre): Firma
{
    return Firma::create([
        'disk' => 'public',
        'path' => "firmas/prueba/{$nombre}.png",
        'original_name' => "{$nombre}.png",
        'mime' => 'image/png',
        'size' => 10,
        'sha1' => sha1($nombre),
    ]);
}

test('un relevo nuevo nace activo', function () {
    $relevo = relevoDeSeguridad()->fresh();

    expect($relevo->status)->toBe('A');
});

test('el scope de activas esconde lo retirado', function () {
    $activo = relevoDeSeguridad();
    $retirado = relevoDeSeguridad(['status' => 'N']);

    $ids = EntregaTurnoSeguridad::activas()->pluck('id')->all();

    expect($ids)->toContain($activo->id)
        ->and($ids)->not->toContain($retirado->id);
});

test('firmas solo devuelve las activas del pivote', function () {
    $relevo = relevoDeSeguridad();

    $vigente = firmaDePrueba('vigente');
    $retirada = firmaDePrueba('retirada');

    // Se engancha por firmasAll, que no filtra, para poder meter una
    // retirada a propósito.
    $relevo->firmasAll()->attach($retirada->id, [
        'rol' => EntregaTurnoSeguridad::ROL_QUIEN_ENTREGA,
        'orden' => 0,
        'status' => 'N',
    ]);
    $relevo->firmasAll()->attach($vigente->id, [
        'rol' => EntregaTurnoSeguridad::ROL_QUIEN_ENTREGA,
        'orden' => 0,
        'status' => 'A',
    ]);

    expect($relevo->firmas()->pluck('firmas.id')->all())->toBe([$vigente->id])
        ->and($relevo->firmasAll()->pluck('firmas.id')->all())->toHaveCount(2);
});

test('tieneFirmaDe distingue el rol que falta del que está', function () {
    $relevo = relevoDeSeguridad();

    $relevo->firmasAll()->attach(firmaDePrueba('entrega')->id, [
        'rol' => EntregaTurnoSeguridad::ROL_QUIEN_ENTREGA,
        'orden' => 0,
        'status' => 'A',
    ]);

    $relevo->load('firmas');

    expect($relevo->tieneFirmaDe(EntregaTurnoSeguridad::ROL_QUIEN_ENTREGA))->toBeTrue()
        ->and($relevo->tieneFirmaDe(EntregaTurnoSeguridad::ROL_FBO))->toBeFalse();
});

test('los nombres de índice que crea la migración caben en MySQL', function () {
    // MySQL rechaza identificadores de más de 64 caracteres y sqlite no, así
    // que sin esta prueba la migración pasaría aquí y reventaría en el
    // servidor. Ya pasó una vez en este proyecto.
    //
    // Lee el ESQUEMA y no una lista escrita a mano: una lista de literales
    // mediría su propia longitud y no detectaría un renombre en la migración.
    $nombres = array_column(Schema::getIndexes('entregas_turno_seguridad'), 'name');

    expect($nombres)->not->toBeEmpty()
        ->and($nombres)->toContain('entregas_turno_seg_fecha_idx');

    foreach ($nombres as $nombre) {
        expect(strlen($nombre))->toBeLessThanOrEqual(64);
    }
});
