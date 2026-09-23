<?php

use App\Models\Bitacora;
use App\Models\RelacionPlanta;

/*
 * Entrega de la GPU N.115: actualiza el mismo registro, calcula el tiempo
 * transcurrido desde que se registró el préstamo y no permite cerrar dos veces.
 * Los helpers prestamoAbierto(), prestamoFinalizado() y usuarioPlanta() viven
 * en PrestarPlantaTest.php.
 */

function finalizar(int $id, array $datos)
{
    return test()->patchJson("/api/RelacionPlanta/{$id}/finalizar", $datos);
}

test('finalizar calcula el tiempo transcurrido desde el préstamo cuando no se envía', function () {
    // El préstamo se registró hace una hora y media.
    $this->travel(-90)->minutes();
    $abierto = prestamoAbierto(['horometro_inicio' => 125.30]);
    $this->travelBack();

    $this->actingAs(usuarioPlanta());

    finalizar($abierto->id, ['horometro_fin' => '126.05'])
        ->assertOk()
        ->assertJsonPath('message', 'Entrega registrada correctamente.')
        ->assertJsonPath('prestamo.id', $abierto->id)
        ->assertJsonPath('prestamo.status', 'finalizado');

    $guardado = $abierto->fresh();

    expect($guardado->horometro_fin)->toBe('126.05')
        // Reloj, no horómetros: 90 minutos son 1.50 h.
        ->and($guardado->tiempo)->toBe('1.50')
        ->and(RelacionPlanta::count())->toBe(1);

    expect(Bitacora::query()
        ->where('modulo', 'RELACION_PLANTA')
        ->where('accion', Bitacora::ACCION_FINALIZAR)
        ->where('registro_id', $abierto->id)
        ->exists())->toBeTrue();
});

test('finalizar acepta un tiempo editado manualmente', function () {
    $this->travel(-30)->minutes();
    $abierto = prestamoAbierto(['horometro_inicio' => 100]);
    $this->travelBack();

    $this->actingAs(usuarioPlanta());

    finalizar($abierto->id, ['horometro_fin' => 101, 'tiempo' => '1.25'])->assertOk();

    expect($abierto->fresh()->tiempo)->toBe('1.25');
});

test('el horómetro final no puede ser menor que el inicial', function () {
    $abierto = prestamoAbierto(['horometro_inicio' => 125.30]);

    $this->actingAs(usuarioPlanta());

    finalizar($abierto->id, ['horometro_fin' => 125.29])
        ->assertStatus(422)
        ->assertJsonPath('errors.horometro_fin.0', 'El horómetro final no puede ser menor que el horómetro inicial.');

    expect($abierto->fresh()->status)->toBe('en_uso');
});

test('finalizar valida horómetro final obligatorio, no negativo y tiempo no negativo', function () {
    $abierto = prestamoAbierto();

    $this->actingAs(usuarioPlanta());

    finalizar($abierto->id, ['horometro_fin' => null])->assertStatus(422)->assertJsonValidationErrors(['horometro_fin']);
    finalizar($abierto->id, ['horometro_fin' => -3])->assertStatus(422)->assertJsonValidationErrors(['horometro_fin']);
    finalizar($abierto->id, ['horometro_fin' => 200, 'tiempo' => -1])->assertStatus(422)->assertJsonValidationErrors(['tiempo']);
});

test('no se puede finalizar dos veces: la segunda responde 409', function () {
    $abierto = prestamoAbierto(['horometro_inicio' => 10]);

    $this->actingAs(usuarioPlanta());

    finalizar($abierto->id, ['horometro_fin' => 11])->assertOk();

    finalizar($abierto->id, ['horometro_fin' => 12])
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_finalizado')
        ->assertJsonPath('message', 'Este préstamo ya fue finalizado por otro usuario.');

    expect($abierto->fresh()->horometro_fin)->toBe('11.00');
});

test('tras finalizar la GPU vuelve a estar disponible y se puede prestar de nuevo', function () {
    $abierto = prestamoAbierto(['horometro_inicio' => 10]);

    $this->actingAs(usuarioPlanta());

    finalizar($abierto->id, ['horometro_fin' => 11])->assertOk();

    $this->getJson('/api/RelacionPlanta/actual')->assertOk()->assertJsonPath('prestamo', null);

    $this->postJson('/api/RelacionPlanta/prestar', [
        'fecha' => '2026-09-14', 'empresa' => 'OTRA', 'matricula' => 'XA-DOS', 'horometro_inicio' => 11,
    ])->assertCreated();

    expect(RelacionPlanta::count())->toBe(2);
});

test('finalizar exige el subdepartamento y responde 404 si no existe', function () {
    $abierto = prestamoAbierto();

    $this->patchJson("/api/RelacionPlanta/{$abierto->id}/finalizar", ['horometro_fin' => 200])->assertUnauthorized();

    $this->actingAs(usuarioSinAcceso());
    finalizar($abierto->id, ['horometro_fin' => 200])->assertForbidden();

    $this->actingAs(usuarioPlanta());
    finalizar(999999, ['horometro_fin' => 200])->assertNotFound();
});
