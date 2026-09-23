<?php

use App\Models\Bitacora;
use App\Models\RelacionPlanta;

/*
 * Préstamo de la GPU N.115: solo puede existir uno abierto a la vez y al
 * prestar únicamente se guarda el horómetro inicial.
 */

function prestamoAbierto(array $extra = []): RelacionPlanta
{
    return RelacionPlanta::create(array_merge([
        'fecha' => '2026-09-14',
        'empresa' => 'AEROLÍNEA DEMO',
        'matricula' => 'XA-GPU',
        'horometro_inicio' => 125.30,
        'status' => RelacionPlanta::STATUS_EN_USO,
    ], $extra));
}

function prestamoFinalizado(array $extra = []): RelacionPlanta
{
    return prestamoAbierto(array_merge([
        'horometro_fin' => 126.05,
        'tiempo' => 0.75,
        'status' => RelacionPlanta::STATUS_FINALIZADO,
    ], $extra));
}

function usuarioPlanta()
{
    return usuarioConSubdepartamento('relacionPlanta', 'Rampa');
}

test('el modelo guarda horómetros como decimales y expone los scopes', function () {
    $abierto = prestamoAbierto();
    $cerrado = prestamoFinalizado(['matricula' => 'XA-FIN']);

    expect($abierto->fresh()->horometro_inicio)->toBe('125.30')
        ->and($abierto->fresh()->horometro_fin)->toBeNull()
        ->and($abierto->fresh()->tiempo)->toBeNull()
        ->and(RelacionPlanta::enUso()->pluck('id')->all())->toBe([$abierto->id])
        ->and(RelacionPlanta::finalizadas()->pluck('id')->all())->toBe([$cerrado->id])
        ->and(RelacionPlanta::EQUIPO)->toBe('GPU N.115')
        ->and(Bitacora::MODULO_RELACION_PLANTA)->toBe('RELACION_PLANTA');
});

test('actual devuelve null sin préstamo abierto y el préstamo cuando existe', function () {
    $this->actingAs(usuarioSinAcceso());

    $this->getJson('/api/RelacionPlanta/actual')->assertOk()->assertJsonPath('prestamo', null);

    $abierto = prestamoAbierto();

    $this->getJson('/api/RelacionPlanta/actual')
        ->assertOk()
        ->assertJsonPath('prestamo.id', $abierto->id)
        ->assertJsonPath('prestamo.equipo', 'GPU N.115')
        ->assertJsonPath('prestamo.status', 'en_uso');
});

test('actual devuelve el último horómetro final registrado, para precargar el préstamo', function () {
    $this->actingAs(usuarioSinAcceso());

    // Sin entregas previas no hay nada que sugerir.
    $this->getJson('/api/RelacionPlanta/actual')->assertOk()->assertJsonPath('ultimo_horometro_fin', null);

    prestamoFinalizado(['horometro_fin' => 120.10]);
    prestamoFinalizado(['horometro_fin' => 126.05]);
    // Un préstamo abierto todavía no tiene horómetro final: no debe estorbar.
    prestamoAbierto(['matricula' => 'XA-ABI']);

    $this->getJson('/api/RelacionPlanta/actual')
        ->assertOk()
        ->assertJsonPath('ultimo_horometro_fin', '126.05');
});

test('un invitado recibe 401 y un usuario sin subdepartamento 403 al prestar', function () {
    $datos = ['fecha' => '2026-09-14', 'empresa' => 'DEMO', 'matricula' => 'xa-gpu', 'horometro_inicio' => 10];

    $this->postJson('/api/RelacionPlanta/prestar', $datos)->assertUnauthorized();

    $this->actingAs(usuarioSinAcceso());
    $this->postJson('/api/RelacionPlanta/prestar', $datos)->assertForbidden();

    expect(RelacionPlanta::count())->toBe(0);
});

test('prestar guarda solo el horómetro inicial, normaliza y registra bitácora', function () {
    $this->actingAs(usuarioPlanta());

    $this->postJson('/api/RelacionPlanta/prestar', [
        'fecha' => '2026-09-14',
        'empresa' => '  Aerolínea Demo  ',
        'matricula' => 'xa-gpu',
        'horometro_inicio' => '125.30',
    ])
        ->assertCreated()
        ->assertJsonPath('message', 'Préstamo registrado correctamente.')
        ->assertJsonPath('prestamo.matricula', 'XA-GPU')
        ->assertJsonPath('prestamo.empresa', 'Aerolínea Demo')
        ->assertJsonPath('prestamo.status', 'en_uso');

    $guardado = RelacionPlanta::first();

    expect($guardado->horometro_inicio)->toBe('125.30')
        ->and($guardado->horometro_fin)->toBeNull()
        ->and($guardado->tiempo)->toBeNull();

    expect(Bitacora::query()
        ->where('modulo', 'RELACION_PLANTA')
        ->where('accion', Bitacora::ACCION_CREAR)
        ->where('registro_id', $guardado->id)
        ->exists())->toBeTrue();
});

test('el admin puede prestar aunque no tenga el subdepartamento', function () {
    $this->actingAs(usuarioAdmin());

    $this->postJson('/api/RelacionPlanta/prestar', [
        'fecha' => '2026-09-14', 'empresa' => 'DEMO', 'matricula' => 'XA-ADM', 'horometro_inicio' => 1,
    ])->assertCreated();
});

test('no se puede prestar mientras exista un préstamo abierto', function () {
    prestamoAbierto(['matricula' => 'XA-OCU']);

    $this->actingAs(usuarioPlanta());

    $this->postJson('/api/RelacionPlanta/prestar', [
        'fecha' => '2026-09-14', 'empresa' => 'OTRA', 'matricula' => 'XA-NUE', 'horometro_inicio' => 200,
    ])
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'gpu_en_uso')
        ->assertJsonPath('matricula', 'XA-OCU')
        ->assertJsonPath('message', 'La GPU N.115 se encuentra en uso por la matrícula XA-OCU. Debe registrarse su entrega antes de iniciar otro préstamo.');

    expect(RelacionPlanta::count())->toBe(1);
});

test('prestar valida empresa obligatoria, matrícula y horómetro no negativo', function () {
    $this->actingAs(usuarioPlanta());

    $this->postJson('/api/RelacionPlanta/prestar', [
        'fecha' => 'ayer', 'empresa' => '   ', 'matricula' => '', 'horometro_inicio' => -1,
    ])->assertStatus(422)->assertJsonValidationErrors(['fecha', 'empresa', 'matricula', 'horometro_inicio']);
});
