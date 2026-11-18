<?php

use App\Models\Imagen;
use App\Models\ServicioComisariato;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/*
 * Las evidencias cuelgan del par polimórfico imagens/imageables, el mismo que
 * usa Walk Around. Borrar es poner el pivote en `N`: en un documento que sirve
 * de prueba, destruir no es una opción.
 */

/** Un JPEG de un pixel, con el prefijo que el servidor espera. */
function fotoBase64(): string
{
    return 'data:image/jpeg;base64,'
        .'/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a'
        .'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA'
        .'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
}

/** @param array<string, mixed> $extra */
function servicioDeEvidencias(array $extra = []): ServicioComisariato
{
    return ServicioComisariato::create(array_merge([
        'user_id' => User::factory()->create()->id,
        'catering' => 'CATERING UNO',
        'forma_pago' => 'EFECTIVO',
        'fecha_entrega' => '2026-11-18',
        'hora_entrega' => '14:30',
        'matricula' => 'XA-TSR',
        'subtotal' => 100,
        'total' => 116,
    ], $extra));
}

function subirEvidencia(ServicioComisariato $servicio, ?string $foto = null): \Illuminate\Testing\TestResponse
{
    return test()->postJson(
        "/api/ServicioComisariato/{$servicio->id}/evidencias",
        ['foto' => $foto ?? fotoBase64()]
    );
}

beforeEach(function () {
    Storage::fake('public');
    $this->actingAs(User::factory()->create());
});

test('subir una evidencia crea la imagen, el pivote y el archivo', function () {
    $servicio = servicioDeEvidencias();

    $respuesta = subirEvidencia($servicio)->assertCreated();

    $imagen = Imagen::sole();

    expect($respuesta->json('data.id'))->toBe($imagen->id)
        ->and($respuesta->json('data.orden'))->toBe(0)
        ->and($respuesta->json('data.url'))->toBeString()->not->toBeEmpty();

    Storage::disk('public')->assertExists($imagen->path);

    expect($imagen->mime)->toBe('image/jpeg')
        ->and($imagen->size)->toBeGreaterThan(0)
        ->and(DB::table('imageables')->where('imagen_id', $imagen->id)->count())->toBe(1);
});

test('el archivo aterriza en la carpeta del mes', function () {
    subirEvidencia(servicioDeEvidencias())->assertCreated();

    expect(Imagen::sole()->path)
        ->toStartWith('evidencias/ServicioComisariato/'.now()->format('Y/m').'/')
        ->toEndWith('.jpg');
});

test('dos subidas dan orden cero y uno', function () {
    $servicio = servicioDeEvidencias();

    expect(subirEvidencia($servicio)->json('data.orden'))->toBe(0)
        ->and(subirEvidencia($servicio)->json('data.orden'))->toBe(1);
});

test('el orden no reutiliza el numero de una evidencia borrada', function () {
    // La tercera es la 2 aunque la segunda ya no esté: dos evidencias
    // distintas no pueden haber ocupado nunca el mismo sitio.
    $servicio = servicioDeEvidencias();

    subirEvidencia($servicio);
    $segunda = subirEvidencia($servicio)->json('data.id');

    test()->deleteJson("/api/ServicioComisariato/{$servicio->id}/evidencias/{$segunda}")
        ->assertSuccessful();

    expect(subirEvidencia($servicio)->json('data.orden'))->toBe(2);
});

test('un base64 invalido se rechaza y no deja nada', function (string $foto) {
    $servicio = servicioDeEvidencias();

    subirEvidencia($servicio, $foto)
        ->assertStatus(422)
        ->assertJsonValidationErrors('foto');

    expect(Imagen::count())->toBe(0)
        ->and(DB::table('imageables')->count())->toBe(0);
})->with([
    'texto pelado' => ['abc'],
    'sin prefijo' => ['iVBORw0KGgoAAAANSUhEUg=='],
    'tipo que no es imagen' => ['data:application/pdf;base64,JVBERi0xLjQKJeLjz9MK'],
    // Dieciséis `=` de relleno: la regex vieja los dejaba pasar, base64_decode
    // devolvía cadena vacía y quedaba un archivo de cero bytes con su renglón.
    'relleno de iguales' => ['data:image/png;base64,================'],
]);

test('el show devuelve las evidencias ordenadas', function () {
    $servicio = servicioDeEvidencias();
    $primera = subirEvidencia($servicio)->json('data.id');
    $segunda = subirEvidencia($servicio)->json('data.id');

    $evidencias = test()->getJson("/api/ServicioComisariato/{$servicio->id}")
        ->assertSuccessful()
        ->json('evidencias');

    expect(array_column($evidencias, 'id'))->toBe([$primera, $segunda])
        ->and($evidencias[0])->toHaveKeys(['id', 'url', 'orden']);
});

test('un servicio sin fotos devuelve una lista vacia, no null', function () {
    expect(test()->getJson('/api/ServicioComisariato/'.servicioDeEvidencias()->id)->json('evidencias'))
        ->toBe([]);
});

test('borrar esconde la evidencia pero conserva la imagen', function () {
    $servicio = servicioDeEvidencias();
    $imagenId = subirEvidencia($servicio)->json('data.id');

    test()->deleteJson("/api/ServicioComisariato/{$servicio->id}/evidencias/{$imagenId}")
        ->assertSuccessful();

    expect(test()->getJson("/api/ServicioComisariato/{$servicio->id}")->json('evidencias'))->toBe([])
        ->and(Imagen::whereKey($imagenId)->exists())->toBeTrue()
        ->and(DB::table('imageables')->where('imagen_id', $imagenId)->value('status'))->toBe('N');
});

test('no se puede borrar la evidencia de otro servicio', function () {
    // `imageables` es polimórfica: sin el id del servicio por delante, un id
    // equivocado despegaría la foto de otro dueño sin que nadie se enterara.
    $mio = servicioDeEvidencias();
    $ajeno = servicioDeEvidencias();
    $imagenId = subirEvidencia($ajeno)->json('data.id');

    test()->deleteJson("/api/ServicioComisariato/{$mio->id}/evidencias/{$imagenId}")
        ->assertNotFound();

    expect(DB::table('imageables')->where('imagen_id', $imagenId)->value('status'))->toBe('A');
});

test('borrar dos veces la misma evidencia da 404 la segunda', function () {
    $servicio = servicioDeEvidencias();
    $imagenId = subirEvidencia($servicio)->json('data.id');
    $url = "/api/ServicioComisariato/{$servicio->id}/evidencias/{$imagenId}";

    test()->deleteJson($url)->assertSuccessful();
    test()->deleteJson($url)->assertNotFound();
});

test('subir a un servicio que no existe da 404', function () {
    test()->postJson('/api/ServicioComisariato/999999/evidencias', ['foto' => fotoBase64()])
        ->assertNotFound();
});

test('sin sesion no se sube ni se borra nada', function () {
    $servicio = servicioDeEvidencias();
    $imagenId = subirEvidencia($servicio)->json('data.id');

    // La guarda por defecto es `sanctum` (un RequestGuard, sin `logout()`):
    // olvidar las guardas instanciadas descarta el usuario de `actingAs`.
    app('auth')->forgetGuards();

    test()->postJson("/api/ServicioComisariato/{$servicio->id}/evidencias", ['foto' => fotoBase64()])
        ->assertUnauthorized();

    test()->deleteJson("/api/ServicioComisariato/{$servicio->id}/evidencias/{$imagenId}")
        ->assertUnauthorized();

    expect(Imagen::count())->toBe(1);
});
