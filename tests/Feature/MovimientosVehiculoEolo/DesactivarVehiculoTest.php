<?php

use App\Models\Bitacora;
use App\Models\Vehiculo;

/*
 * Desactivar deja un vehículo sin poder trabajar. Por eso vive detrás de tres
 * roles y de un candado que impide dar de baja algo que está fuera de la planta:
 * si no, no podría registrar nunca su entrada.
 */

function cambiarActivo(string $id, bool $activo): Illuminate\Testing\TestResponse
{
    return test()->patchJson("/api/VehiculoEolo/vehiculos/{$id}/activo", ['activo' => $activo]);
}

it('los tres roles permitidos pueden desactivar', function (string $rol) {
    $this->actingAs(usuarioVehiculosConRol($rol), 'sanctum');
    vehiculoDePrueba('01-KIA', 'KIA');

    cambiarActivo('01-KIA', false)->assertOk();

    // Se comprueba la columna, no la respuesta: lo que importa es lo que quedó escrito.
    expect(Vehiculo::find('01-KIA')->activo)->toBeFalse();
})->with([
    'fbo' => ['fbo'],
    'administrativo' => ['admin2'],
    'administrador' => ['admin'],
]);

it('un rol sin permiso recibe 403 y el vehículo no cambia', function () {
    $this->actingAs(usuarioVehiculosConRol('empleado'), 'sanctum');
    vehiculoDePrueba('01-KIA', 'KIA');

    cambiarActivo('01-KIA', false)->assertForbidden();

    expect(Vehiculo::find('01-KIA')->activo)->toBeTrue();
});

it('esconder el botón no basta: el 403 llega aunque el id no exista', function () {
    // El candado de rol va ANTES de buscar el vehículo, para no filtrar qué ids hay.
    $this->actingAs(usuarioVehiculosConRol('empleado'), 'sanctum');

    cambiarActivo('NO-EXISTE', false)->assertForbidden();
});

it('no se puede desactivar un vehículo que está En Ruta', function () {
    $this->actingAs(usuarioVehiculosConRol('fbo'), 'sanctum');
    vehiculoDePrueba('IKON', 'IKON', 'En Ruta');

    cambiarActivo('IKON', false)->assertStatus(409);

    expect(Vehiculo::find('IKON')->activo)->toBeTrue();
});

it('el mensaje del 409 dice qué hay que hacer antes', function () {
    $this->actingAs(usuarioVehiculosConRol('fbo'), 'sanctum');
    vehiculoDePrueba('IKON', 'IKON', 'En Ruta');

    $respuesta = cambiarActivo('IKON', false);

    expect($respuesta->json('message'))->toContain('entrada');
});

it('una vez registrada su entrada, el mismo vehículo sí se desactiva', function () {
    $this->actingAs(usuarioVehiculosConRol('fbo'), 'sanctum');
    $vehiculo = vehiculoDePrueba('IKON', 'IKON', 'En Ruta');

    cambiarActivo('IKON', false)->assertStatus(409);
    $vehiculo->update(['estado' => 'En Planta']);
    cambiarActivo('IKON', false)->assertOk();

    expect(Vehiculo::find('IKON')->activo)->toBeFalse();
});

it('reactivar no lleva el candado de En Ruta: un inactivo no pudo salir', function () {
    $this->actingAs(usuarioVehiculosConRol('admin'), 'sanctum');
    vehiculoDePrueba('EP-16', 'URVAN', 'En Planta', false);

    cambiarActivo('EP-16', true)->assertOk();

    expect(Vehiculo::find('EP-16')->activo)->toBeTrue();
});

it('es idempotente: desactivar algo ya inactivo responde 200 y no rompe nada', function () {
    $this->actingAs(usuarioVehiculosConRol('admin'), 'sanctum');
    vehiculoDePrueba('EP-16', 'URVAN', 'En Planta', false);

    cambiarActivo('EP-16', false)->assertOk();

    expect(Vehiculo::find('EP-16')->activo)->toBeFalse();
});

it('un id que no existe da 404 para quien sí tiene permiso', function () {
    $this->actingAs(usuarioVehiculosConRol('fbo'), 'sanctum');

    cambiarActivo('NO-EXISTE', false)->assertNotFound();
});

it('exige el campo activo y que sea booleano', function () {
    $this->actingAs(usuarioVehiculosConRol('fbo'), 'sanctum');
    vehiculoDePrueba('01-KIA', 'KIA');

    test()->patchJson('/api/VehiculoEolo/vehiculos/01-KIA/activo', [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('activo');
});

it('deja rastro de quién desactivó y a qué vehículo', function () {
    // La pregunta que llega cuando una unidad deja de poder trabajar es «¿quién
    // fue?». Sin este registro la respuesta es que no se sabe.
    $usuario = usuarioVehiculosConRol('fbo');
    $this->actingAs($usuario, 'sanctum');
    vehiculoDePrueba('01-KIA', 'KIA');

    cambiarActivo('01-KIA', false)->assertOk();

    $registro = Bitacora::where('modulo', Bitacora::MODULO_MOVIMIENTOS_VEHICULOS)->sole();

    expect($registro->accion)->toBe(Bitacora::ACCION_DESACTIVAR)
        ->and($registro->usuario_id)->toBe($usuario->id)
        ->and($registro->descripcion)->toContain('01-KIA')
        ->and($registro->datos_nuevos)->toBe(['vehiculo_id' => '01-KIA', 'activo' => false]);
});

it('reactivar deja su propio rastro, con la acción contraria', function () {
    $this->actingAs(usuarioVehiculosConRol('admin'), 'sanctum');
    vehiculoDePrueba('EP-16', 'URVAN', 'En Planta', false);

    cambiarActivo('EP-16', true)->assertOk();

    expect(Bitacora::where('modulo', Bitacora::MODULO_MOVIMIENTOS_VEHICULOS)->sole()->accion)
        ->toBe(Bitacora::ACCION_ACTIVAR);
});

it('un intento rechazado por rol no deja rastro en bitácora', function () {
    $this->actingAs(usuarioVehiculosConRol('empleado'), 'sanctum');
    vehiculoDePrueba('01-KIA', 'KIA');

    cambiarActivo('01-KIA', false)->assertForbidden();

    expect(Bitacora::where('modulo', Bitacora::MODULO_MOVIMIENTOS_VEHICULOS)->count())->toBe(0);
});
