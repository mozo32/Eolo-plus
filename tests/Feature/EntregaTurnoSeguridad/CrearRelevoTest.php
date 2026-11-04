<?php

use App\Models\EntregaTurnoSeguridad;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/*
 * Crear un relevo. Está abierto a cualquiera con sesión: editar y
 * eliminar son los que piden rol.
 */

function usuarioConRolDeSeguridad(string $slug, string $nombre): User
{
    $usuario = User::factory()->create();
    $rol = Role::firstOrCreate(['slug' => $slug], ['nombre' => $nombre]);
    $usuario->roles()->attach($rol->id);

    return $usuario;
}

/** Un PNG de un pixel, en base64, con el prefijo que el servidor espera. */
function firmaBase64(): string
{
    return 'data:image/png;base64,'
        .'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
}

/** @param array<string, mixed> $extra */
function datosDeRelevo(array $extra = []): array
{
    return array_merge([
        'fecha_hora' => Carbon::now(config('app.timezone'))->format('Y-m-d H:i:s'),
        'seccion' => EntregaTurnoSeguridad::SECCION_FRENTE,
        'firma_quien_entrega' => firmaBase64(),
    ], $extra);
}

beforeEach(function () {
    Storage::fake('public');
});

test('el user_id es del autenticado, no del que manda el navegador', function () {
    $autenticado = User::factory()->create();
    $otro = User::factory()->create();

    $respuesta = $this->actingAs($autenticado)
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo(['user_id' => $otro->id]));

    $respuesta->assertSuccessful();

    expect(EntregaTurnoSeguridad::sole()->user_id)->toBe($autenticado->id);
});

test('sin sesión no se crea nada', function () {
    $this->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo())
        ->assertUnauthorized();

    expect(EntregaTurnoSeguridad::count())->toBe(0);
});

test('la pernocta mensual se queda en sin revisar cuando no se manda', function () {
    $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo())
        ->assertSuccessful();

    expect(EntregaTurnoSeguridad::sole()->pernocta_mensual)
        ->toBe(EntregaTurnoSeguridad::PERNOCTA_SIN_REVISAR);
});

test('la pernocta mensual acepta sus tres letras', function (string $letra) {
    $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo(['pernocta_mensual' => $letra]))
        ->assertSuccessful();

    expect(EntregaTurnoSeguridad::sole()->pernocta_mensual)->toBe($letra);
})->with(['S', 'N', 'R']);

test('la pernocta mensual rechaza cualquier otra letra', function () {
    $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo(['pernocta_mensual' => 'X']))
        ->assertJsonValidationErrorFor('pernocta_mensual');

    expect(EntregaTurnoSeguridad::count())->toBe(0);
});

test('la sección acepta frente y atras y rechaza lo demás', function () {
    $usuario = User::factory()->create();

    foreach (EntregaTurnoSeguridad::SECCIONES as $seccion) {
        $this->actingAs($usuario)
            ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo(['seccion' => $seccion]))
            ->assertSuccessful();
    }

    $this->actingAs($usuario)
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo(['seccion' => 'arriba']))
        ->assertJsonValidationErrorFor('seccion');

    expect(EntregaTurnoSeguridad::count())->toBe(2);
});

test('las casillas marcadas se guardan y las demás quedan apagadas', function () {
    $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo([
            'aviones_csae' => true,
            'visitantes' => true,
        ]))
        ->assertSuccessful();

    $relevo = EntregaTurnoSeguridad::sole();

    expect($relevo->aviones_csae)->toBeTrue()
        ->and($relevo->visitantes)->toBeTrue()
        ->and($relevo->combustible)->toBeFalse()
        ->and($relevo->posiciones)->toBeFalse();
});

test('se guarda con la firma de quien entrega y sin la del FBO', function () {
    $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo())
        ->assertSuccessful();

    $relevo = EntregaTurnoSeguridad::with('firmas')->sole();

    expect($relevo->tieneFirmaDe(EntregaTurnoSeguridad::ROL_QUIEN_ENTREGA))->toBeTrue()
        ->and($relevo->tieneFirmaDe(EntregaTurnoSeguridad::ROL_FBO))->toBeFalse();
});

test('sin la firma de quien entrega no se guarda', function () {
    $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo(['firma_quien_entrega' => '']))
        ->assertJsonValidationErrorFor('firma_quien_entrega');

    expect(EntregaTurnoSeguridad::count())->toBe(0);
});

test('las observaciones se guardan tal como se escribieron', function () {
    $texto = 'Se quedó una camioneta sin resguardo en la posición 4.';

    $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo(['observaciones' => $texto]))
        ->assertSuccessful();

    expect(EntregaTurnoSeguridad::sole()->observaciones)->toBe($texto);
});
