<?php

use App\Models\EntregaTurnoSeguridad;
use App\Models\PernoctaDia;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

/*
 * El resumen se congela en el instante en que entra la TERCERA firma, y no
 * antes ni después.
 */

/** Un PNG de un pixel con el prefijo que el servidor espera. */
function firmaDeCongelado(): string
{
    return 'data:image/png;base64,'
        .'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
}

function usuarioDeCongelado(string $slug): User
{
    $usuario = User::factory()->create();
    $rol = Role::firstOrCreate(['slug' => $slug], ['nombre' => ucfirst($slug)]);
    $usuario->roles()->attach($rol->id);

    return $usuario;
}

/** Un relevo recién creado por la API: ya trae la firma de quien entrega. */
function relevoRecienCreado(): EntregaTurnoSeguridad
{
    test()->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', [
            'fecha_hora' => now()->format('Y-m-d H:i:s'),
            'seccion' => EntregaTurnoSeguridad::SECCION_CASETA,
            'firma_quien_entrega' => firmaDeCongelado(),
        ])->assertSuccessful();

    return EntregaTurnoSeguridad::sole();
}

beforeEach(function () {
    Storage::fake('public');
});

test('con dos firmas el resumen sigue sin congelar', function () {
    $relevo = relevoRecienCreado();

    $this->actingAs(usuarioDeCongelado('jefe_area'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
            'firma_jefe_area' => firmaDeCongelado(),
        ])->assertSuccessful();

    expect($relevo->fresh()->resumen)->toBeNull();
});

test('la tercera firma congela el resumen', function () {
    PernoctaDia::create(['fecha' => now()->toDateString(), 'matricula' => 'XA-UNO']);

    $relevo = relevoRecienCreado();

    $this->actingAs(usuarioDeCongelado('jefe_area'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
            'firma_jefe_area' => firmaDeCongelado(),
        ])->assertSuccessful();

    $this->actingAs(usuarioDeCongelado('fbo'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
            'firma_fbo' => firmaDeCongelado(),
        ])->assertSuccessful();

    $congelado = $relevo->fresh()->resumen;

    expect($congelado)->toBeArray()
        ->and(collect($congelado)->firstWhere('clave', 'pernocta')['total'])->toBe(1);
});

test('el orden de las dos firmas de cierre da igual', function () {
    $relevo = relevoRecienCreado();

    $this->actingAs(usuarioDeCongelado('fbo'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
            'firma_fbo' => firmaDeCongelado(),
        ])->assertSuccessful();

    expect($relevo->fresh()->resumen)->toBeNull();

    $this->actingAs(usuarioDeCongelado('jefe_area'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
            'firma_jefe_area' => firmaDeCongelado(),
        ])->assertSuccessful();

    expect($relevo->fresh()->resumen)->toBeArray();
});

test('un relevo congelado no cambia aunque despues se registre mas movimiento', function () {
    $relevo = relevoRecienCreado();

    foreach (['jefe_area', 'fbo'] as $rol) {
        $this->actingAs(usuarioDeCongelado($rol))
            ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
                'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
                'firma_'.$rol => firmaDeCongelado(),
            ])->assertSuccessful();
    }

    PernoctaDia::create(['fecha' => now()->toDateString(), 'matricula' => 'XA-DOS']);

    $respuesta = $this->actingAs(usuarioDeCongelado('fbo'))
        ->getJson("/api/EntregaTurnoSeguridad/{$relevo->id}");

    expect($respuesta->json('data.resumen.congelado'))->toBeTrue()
        ->and(collect($respuesta->json('data.resumen.renglones'))->firstWhere('clave', 'pernocta')['total'])
        ->toBe(0);
});

test('reponer una firma no recalcula un resumen ya congelado', function () {
    $relevo = relevoRecienCreado();

    foreach (['jefe_area', 'fbo'] as $rol) {
        $this->actingAs(usuarioDeCongelado($rol))
            ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
                'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
                'firma_'.$rol => firmaDeCongelado(),
            ])->assertSuccessful();
    }

    PernoctaDia::create(['fecha' => now()->toDateString(), 'matricula' => 'XA-TRES']);

    $this->actingAs(usuarioDeCongelado('fbo'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
            'firma_fbo' => firmaDeCongelado(),
        ])->assertSuccessful();

    expect(collect($relevo->fresh()->resumen)->firstWhere('clave', 'pernocta')['total'])->toBe(0);
});

test('el jefe de area no puede poner la firma del fbo', function () {
    $relevo = relevoRecienCreado();

    $this->actingAs(usuarioDeCongelado('jefe_area'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
            'firma_fbo' => firmaDeCongelado(),
        ])->assertForbidden();

    expect($relevo->fresh()->load('firmas')->tieneFirmaDe(EntregaTurnoSeguridad::ROL_FBO))->toBeFalse();
});

test('el fbo no puede poner la firma del jefe de area', function () {
    $relevo = relevoRecienCreado();

    $this->actingAs(usuarioDeCongelado('fbo'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
            'firma_jefe_area' => firmaDeCongelado(),
        ])->assertForbidden();

    expect($relevo->fresh()->load('firmas')->tieneFirmaDe(EntregaTurnoSeguridad::ROL_JEFE_AREA))->toBeFalse();
});

test('el administrador puede poner las dos firmas de cierre', function () {
    $relevo = relevoRecienCreado();

    $this->actingAs(usuarioDeCongelado('admin'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
            'firma_jefe_area' => firmaDeCongelado(),
            'firma_fbo' => firmaDeCongelado(),
        ])->assertSuccessful();

    expect($relevo->fresh()->resumen)->toBeArray();
});

test('la firma del jefe de area se guarda con su etiqueta', function () {
    $relevo = relevoRecienCreado();

    $this->actingAs(usuarioDeCongelado('jefe_area'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
            'firma_jefe_area' => firmaDeCongelado(),
        ])->assertSuccessful();

    $firma = $relevo->fresh()->load('firmas')->firmas
        ->first(fn ($firma) => $firma->pivot->rol === EntregaTurnoSeguridad::ROL_JEFE_AREA);

    expect($firma)->not->toBeNull()
        ->and($firma->pivot->tag)->toBe('Firma del jefe de área');
});
