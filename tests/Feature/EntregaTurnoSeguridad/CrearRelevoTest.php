<?php

use App\Models\EntregaTurnoSeguridad;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/*
 * Crear un relevo. Está abierto a cualquiera con sesión: editar y
 * eliminar son los que piden rol.
 */

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
        ->assertCreated();

    $relevo = EntregaTurnoSeguridad::with('firmas')->sole();

    expect($relevo->tieneFirmaDe(EntregaTurnoSeguridad::ROL_QUIEN_ENTREGA))->toBeTrue()
        ->and($relevo->tieneFirmaDe(EntregaTurnoSeguridad::ROL_FBO))->toBeFalse();

    // El renglón del pivote no prueba que el archivo exista. Sin esto, un
    // fallo al escribir en el disco dejaría la firma «guardada» apuntando a
    // una ruta vacía, y la vista previa pintaría una imagen rota.
    $firma = $relevo->firmas->first();

    Storage::disk('public')->assertExists($firma->path);

    expect($firma->path)->toStartWith('firmas/EntregaTurnoSeguridad/')
        ->and($firma->path)->toEndWith('.png')
        ->and(Storage::disk('public')->size($firma->path))->toBeGreaterThan(0);
});

test('al crear, una firma del FBO se ignora y el relevo queda pendiente', function () {
    // La spec §4 dice que el relevo se guarda con la firma de quien entrega
    // nada más. El formulario ya no ofrece el pad del FBO al crear, pero el
    // endpoint tiene que ser explícito: si llega, se ignora, y el relevo
    // sigue apareciendo en la cola de pendientes.
    $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo(['firma_fbo' => firmaBase64()]))
        ->assertCreated();

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

test('un texto que no es una firma se rechaza y no crea nada', function () {
    // Sin la regla de forma, `required|string` dejaba pasar cualquier texto,
    // el guardia de guardarFirmaBase64 hacía `return` en silencio y el
    // relevo se guardaba SIN firma de quien entrega, que es obligatoria.
    // El fallo era silencioso: 201 y un relevo sin firmar.
    $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo(['firma_quien_entrega' => 'abc']))
        ->assertJsonValidationErrorFor('firma_quien_entrega');

    expect(EntregaTurnoSeguridad::count())->toBe(0);
});

test('un SVG se rechaza aunque sea una imagen', function (string $firma) {
    // El archivo se guarda en el disco `public`. Un SVG servido por su URL
    // directa corre su propio script en el origen de la aplicación, y crear
    // un relevo está abierto a cualquiera con sesión: sería XSS almacenado.
    // Un `text/html` se rechaza por lo mismo.
    //
    // El caso «solo relleno» cierra otra cosa: dieciséis `=` son base64
    // sintácticamente válido para la regla vieja y decodifican a cadena
    // vacía, así que se escribía un archivo de cero bytes y el relevo quedaba
    // «firmado» con una imagen rota. Se comprobó por mutación: antes del
    // apriete este caso creaba el relevo con 201.
    $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo(['firma_quien_entrega' => $firma]))
        ->assertJsonValidationErrorFor('firma_quien_entrega');

    expect(EntregaTurnoSeguridad::count())->toBe(0);
})->with([
    'svg' => 'data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+',
    'html' => 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'solo relleno' => 'data:image/png;base64,================',
]);

test('una cabecera de imagen sin cuerpo se rechaza', function () {
    // `data:image/png;base64,` a secas pasaba la regla anterior y escribía un
    // archivo de cero bytes: una firma que existe en la base y no se ve.
    $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo([
            'firma_quien_entrega' => 'data:image/png;base64,',
        ]))
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
