<?php

/*
 * La tabla principal se ordena por uso. Lo que se quiere arriba es lo que se
 * puede usar HOY: un desactivado con 933 movimientos va debajo de un activo
 * con 9.
 */

function listarVehiculos(): Illuminate\Testing\TestResponse
{
    return test()->getJson('/api/VehiculoEolo');
}

beforeEach(function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
});

it('devuelve activo y la cuenta de movimientos de cada vehículo', function () {
    vehiculoDePrueba('01-KIA', 'KIA');
    movimientosDePrueba('01-KIA', 5);

    $fila = listarVehiculos()->assertOk()->json('0');

    expect($fila['id'])->toBe('01-KIA')
        ->and($fila['nombre'])->toBe('KIA')
        ->and($fila['estado'])->toBe('En Planta')
        ->and($fila['activo'])->toBeTrue()
        ->and($fila['movimientos'])->toBe(5);
});

it('ordena por número de movimientos, de más usado a menos', function () {
    vehiculoDePrueba('N-15', 'NISSAN');
    vehiculoDePrueba('01-KIA', 'KIA');
    vehiculoDePrueba('EP-16', 'URVAN');
    movimientosDePrueba('N-15', 4);
    movimientosDePrueba('01-KIA', 9);
    movimientosDePrueba('EP-16', 1);

    $ids = collect(listarVehiculos()->assertOk()->json())->pluck('id')->all();

    expect($ids)->toBe(['01-KIA', 'N-15', 'EP-16']);
});

it('deja los desactivados al fondo aunque sean los más usados', function () {
    // Esta prueba falla si se ordenara solo por movimientos sin mirar `activo`.
    vehiculoDePrueba('TC-84', 'SUBURBAN', 'En Planta', false);
    vehiculoDePrueba('IKON', 'IKON');
    movimientosDePrueba('TC-84', 900);
    movimientosDePrueba('IKON', 2);

    $ids = collect(listarVehiculos()->assertOk()->json())->pluck('id')->all();

    expect($ids)->toBe(['IKON', 'TC-84']);
});

it('desempata por id para que el orden no dependa de la base', function () {
    vehiculoDePrueba('N-15', 'NISSAN');
    vehiculoDePrueba('12', 'NISSAN');
    movimientosDePrueba('N-15', 3);
    movimientosDePrueba('12', 3);

    $ids = collect(listarVehiculos()->assertOk()->json())->pluck('id')->all();

    expect($ids)->toBe(['12', 'N-15']);
});

it('un vehículo sin movimientos sale con cero, no se pierde de la lista', function () {
    vehiculoDePrueba('IKON', 'IKON');

    $filas = listarVehiculos()->assertOk()->json();

    expect($filas)->toHaveCount(1)
        ->and($filas[0]['movimientos'])->toBe(0);
});
