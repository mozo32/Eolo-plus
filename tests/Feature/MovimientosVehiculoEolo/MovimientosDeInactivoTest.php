<?php

use App\Models\movimientoVehiculo;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/*
 * La consecuencia de desactivar: la unidad deja de poder registrar entradas y
 * salidas. Lo que NO deja de poder hacerse es consultar su bitácora — eso lo
 * pidió el departamento de forma explícita.
 */

beforeEach(function () {
    Storage::fake('public');
    $this->actingAs(usuarioVehiculosConRol('fbo'), 'sanctum');
});

function registrarMovimientoDe(string $vehiculoId, string $tipo): Illuminate\Testing\TestResponse
{
    // post(), no postJson(): el endpoint recibe archivos y el cuerpo va multipart.
    return test()->post('/api/VehiculoEolo/movimientos', [
        'vehiculo_id' => $vehiculoId,
        'movimiento' => $tipo,
        'chofer' => 'Juan Pérez',
        'kilometraje' => 12345,
        'gasolina' => '1/2',
        'evidencias' => [UploadedFile::fake()->image('tablero.jpg')],
    ], ['Accept' => 'application/json']);
}

it('un vehículo inactivo no registra salida', function () {
    vehiculoDePrueba('EP-16', 'URVAN', 'En Planta', false);

    registrarMovimientoDe('EP-16', 'Salida')->assertStatus(409);

    expect(movimientoVehiculo::count())->toBe(0);
});

it('un vehículo inactivo tampoco registra entrada', function () {
    vehiculoDePrueba('EP-16', 'URVAN', 'En Planta', false);

    registrarMovimientoDe('EP-16', 'Entrada')->assertStatus(409);

    expect(movimientoVehiculo::count())->toBe(0);
});

it('el mensaje del rechazo nombra al vehículo', function () {
    vehiculoDePrueba('EP-16', 'URVAN', 'En Planta', false);

    expect(registrarMovimientoDe('EP-16', 'Salida')->json('message'))->toContain('EP-16');
});

it('no guarda ninguna evidencia de un movimiento rechazado', function () {
    // El candado va antes de la transacción: nada llega al disco.
    vehiculoDePrueba('EP-16', 'URVAN', 'En Planta', false);

    registrarMovimientoDe('EP-16', 'Salida')->assertStatus(409);

    expect(Storage::disk('public')->allFiles())->toBe([]);
});

it('la bitácora de un inactivo se consulta igual', function () {
    vehiculoDePrueba('EP-16', 'URVAN', 'En Planta', false);
    movimientosDePrueba('EP-16', 3);

    $respuesta = test()->getJson('/api/VehiculoEolo/vehiculos/EP-16/movimientos');

    $respuesta->assertOk();
    expect($respuesta->json())->toHaveCount(3);
});

it('un vehículo activo sigue registrando movimientos con normalidad', function () {
    vehiculoDePrueba('01-KIA', 'KIA');

    registrarMovimientoDe('01-KIA', 'Salida')->assertCreated();

    expect(movimientoVehiculo::count())->toBe(1);
});

it('reactivar devuelve el permiso de registrar', function () {
    vehiculoDePrueba('EP-16', 'URVAN', 'En Planta', false);

    registrarMovimientoDe('EP-16', 'Salida')->assertStatus(409);
    test()->patchJson('/api/VehiculoEolo/vehiculos/EP-16/activo', ['activo' => true])->assertOk();
    registrarMovimientoDe('EP-16', 'Salida')->assertCreated();

    expect(movimientoVehiculo::count())->toBe(1);
});
