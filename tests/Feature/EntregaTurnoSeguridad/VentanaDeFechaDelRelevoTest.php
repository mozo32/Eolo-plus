<?php

use App\Models\EntregaTurnoSeguridad;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/*
 * El relevo se llena en el momento, con un día de margen para quien
 * cierra a la mañana siguiente: hoy y ayer. Es la misma ventana que
 * `turno.checklist` y `turno.entrega_rampa`.
 */

beforeEach(function () {
    Storage::fake('public');
});

/*
 * Propia de este archivo: `firmaBase64Valida()` vive en otro y solo existe si
 * Pest lo cargó antes, así que correr este archivo suelto la perdería.
 */
function firmaPngMinima(): string
{
    return 'data:image/png;base64,'
        .'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
}

function intentarRelevoEl(string $dia): \Illuminate\Testing\TestResponse
{
    return test()->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', [
            'fecha_hora' => "{$dia} 07:30:00",
            'seccion' => EntregaTurnoSeguridad::SECCION_CASETA,
            'firma_quien_entrega' => firmaPngMinima(),
        ]);
}

test('acepta hoy y ayer', function (int $diasAtras) {
    $dia = Carbon::today(config('app.timezone'))->subDays($diasAtras)->toDateString();

    intentarRelevoEl($dia)->assertSuccessful();
})->with([0, 1]);

test('rechaza un relevo de hace una semana', function () {
    $dia = Carbon::today(config('app.timezone'))->subDays(7)->toDateString();

    intentarRelevoEl($dia)->assertJsonValidationErrorFor('fecha_hora');

    expect(EntregaTurnoSeguridad::count())->toBe(0);
});

test('rechaza un relevo de mañana', function () {
    $dia = Carbon::today(config('app.timezone'))->addDay()->toDateString();

    intentarRelevoEl($dia)->assertJsonValidationErrorFor('fecha_hora');

    expect(EntregaTurnoSeguridad::count())->toBe(0);
});

/*
 * Al editar: no puedes PONER una fecha fuera de ventana, pero puedes DEJAR
 * la que ya estaba. Sin esto, el FBO no podría firmar un relevo de hace tres
 * días, que es justo lo que la cola de pendientes saca a flote.
 */

function relevoViejo(): EntregaTurnoSeguridad
{
    $hace3 = Carbon::today(config('app.timezone'))->subDays(3);

    return EntregaTurnoSeguridad::create([
        'user_id' => User::factory()->create()->id,
        'fecha_hora' => $hace3->copy()->setTime(7, 30)->format('Y-m-d H:i:s'),
        'seccion' => EntregaTurnoSeguridad::SECCION_CASETA,
    ]);
}

function editarComoFbo(EntregaTurnoSeguridad $relevo, array $datos): \Illuminate\Testing\TestResponse
{
    $fbo = User::factory()->create();
    $rol = \App\Models\Role::firstOrCreate(['slug' => 'fbo'], ['nombre' => 'FBO']);
    $fbo->roles()->attach($rol->id);

    return test()->actingAs($fbo)->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", $datos);
}

test('el FBO puede firmar un relevo viejo dejando su fecha', function () {
    // Éste es el caso que la cola de pendientes necesita. Si falla, el botón
    // de pendientes enseña relevos que nadie puede firmar.
    $relevo = relevoViejo();
    $suFecha = $relevo->fecha_hora->format('Y-m-d H:i:s');

    editarComoFbo($relevo, ['fecha_hora' => $suFecha, 'firma_fbo' => firmaPngMinima()])
        ->assertSuccessful();

    $relevo->load('firmas');

    expect($relevo->tieneFirmaDe(EntregaTurnoSeguridad::ROL_FBO))->toBeTrue();
});

test('no se puede mover un relevo viejo a otra fecha vieja', function () {
    $relevo = relevoViejo();
    // El día de antes se guarda en una variable, igual que `$suFecha` en la
    // prueba de arriba: comparar `$relevo->fresh()` contra `$relevo` discrimina
    // hoy, pero el día que alguien cambie ese `fresh()` por un `refresh()` el
    // aserto se vuelve tautológico sin que nada falle.
    $suDia = $relevo->fecha_hora->toDateString();
    $otraVieja = Carbon::today(config('app.timezone'))->subDays(5)->format('Y-m-d H:i:s');

    editarComoFbo($relevo, ['fecha_hora' => $otraVieja])
        ->assertJsonValidationErrorFor('fecha_hora');

    expect($relevo->fresh()->fecha_hora->toDateString())->toBe($suDia);
});

test('sí se puede traer un relevo viejo a hoy', function () {
    $relevo = relevoViejo();
    $hoy = Carbon::today(config('app.timezone'))->setTime(8, 0)->format('Y-m-d H:i:s');

    editarComoFbo($relevo, ['fecha_hora' => $hoy])->assertSuccessful();

    expect($relevo->fresh()->fecha_hora->toDateString())
        ->toBe(Carbon::today(config('app.timezone'))->toDateString());
});

test('una fecha no se puede lavar pasando por una válida', function () {
    // Cada petición se juzga contra lo guardado EN ESE MOMENTO. Traer el
    // relevo a hoy y devolverlo a su fecha vieja debe fallar en el segundo
    // paso: si pasara, la ventana no serviría de nada.
    $relevo = relevoViejo();
    $vieja = $relevo->fecha_hora->format('Y-m-d H:i:s');
    $hoy = Carbon::today(config('app.timezone'))->setTime(8, 0)->format('Y-m-d H:i:s');

    editarComoFbo($relevo, ['fecha_hora' => $hoy])->assertSuccessful();

    editarComoFbo($relevo, ['fecha_hora' => $vieja])
        ->assertJsonValidationErrorFor('fecha_hora');

    expect($relevo->fresh()->fecha_hora->toDateString())
        ->toBe(Carbon::today(config('app.timezone'))->toDateString());
});

test('el mismo día con otra hora pasa en un relevo viejo', function () {
    // La comparación es por DÍA, no por instante: el FBO que firma un relevo
    // de hace tres días puede además corregirle la hora. Sin esta prueba,
    // nadie nota si alguien cambia `cambiaElDia()` para comparar el datetime
    // completo y deja ese caso en 422.
    $relevo = relevoViejo();
    $mismoDiaOtraHora = $relevo->fecha_hora->copy()->setTime(19, 45)->format('Y-m-d H:i:s');

    editarComoFbo($relevo, ['fecha_hora' => $mismoDiaOtraHora])->assertSuccessful();

    expect($relevo->fresh()->fecha_hora->format('H:i'))->toBe('19:45');
});

test('un PUT sin fecha_hora no se juzga', function () {
    // Es el caso de la cola de pendientes: el FBO manda solo su firma.
    // Un campo ausente no se juzga: ni `date` ni la regla de ventana son
    // implícitas, así que Laravel las salta cuando `fecha_hora` no llega.
    // Si no, firmar un relevo viejo daría 422 sin que nadie haya tocado una fecha.
    $relevo = relevoViejo();
    $suDia = $relevo->fecha_hora->toDateString();

    editarComoFbo($relevo, ['firma_fbo' => firmaPngMinima()])->assertSuccessful();

    $relevo->refresh()->load('firmas');

    expect($relevo->tieneFirmaDe(EntregaTurnoSeguridad::ROL_FBO))->toBeTrue()
        ->and($relevo->fecha_hora->toDateString())->toBe($suDia);
});
