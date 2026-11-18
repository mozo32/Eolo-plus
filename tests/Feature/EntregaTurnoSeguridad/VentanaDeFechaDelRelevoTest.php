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
 *
 * Desde que `fbo` y `admin` quedaron exentos de la ventana, esa regla solo se
 * le aplica al jefe de área, que es el tercer editor que admite `update()` y el
 * único de los tres que sigue sujeto. Las pruebas de ventana de abajo editan
 * como él a propósito; las dos que mandan `firma_fbo` siguen con el FBO porque
 * solo él puede guardar su firma.
 */

function relevoViejo(): EntregaTurnoSeguridad
{
    $hace3 = Carbon::today(config('app.timezone'))->subDays(3);

    return EntregaTurnoSeguridad::create([
        'user_id' => User::factory()->create()->id,
        'fecha_hora' => $hace3->copy()->setTime(7, 30)->format('Y-m-d H:i:s'),
    ]);
}

function editarComoFbo(EntregaTurnoSeguridad $relevo, array $datos): \Illuminate\Testing\TestResponse
{
    $fbo = User::factory()->create();
    $rol = \App\Models\Role::firstOrCreate(['slug' => 'fbo'], ['nombre' => 'FBO']);
    $fbo->roles()->attach($rol->id);

    return test()->actingAs($fbo)->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", $datos);
}

/*
 * El OTRO editor de un relevo. `update()` admite `fbo`, `jefe_area` y `admin`
 * (EntregaTurnoSeguridadController:352), y de los tres el jefe de área es el
 * único que NO está exento de la ventana de fecha. Por eso las pruebas de
 * ventana de aquí abajo editan como él: con un FBO pasarían por estar exento y
 * dejarían de demostrar nada.
 */
function editarComoJefeDeArea(EntregaTurnoSeguridad $relevo, array $datos): \Illuminate\Testing\TestResponse
{
    $jefe = User::factory()->create();
    $rol = \App\Models\Role::firstOrCreate(['slug' => 'jefe_area'], ['nombre' => 'Jefe de Área']);
    $jefe->roles()->attach($rol->id);

    return test()->actingAs($jefe)->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", $datos);
}

test('el FBO puede firmar un relevo viejo dejando su fecha', function () {
    // Éste es el caso que la cola de pendientes necesita. Si falla, el botón
    // de pendientes enseña relevos que nadie puede firmar.
    // Ya no es la ventana lo que la deja pasar —el FBO está exento—, sino que
    // la firma llegue a guardarse, que es lo que el aserto mira.
    $relevo = relevoViejo();
    $suFecha = $relevo->fecha_hora->format('Y-m-d H:i:s');

    editarComoFbo($relevo, ['fecha_hora' => $suFecha, 'firma_fbo' => firmaPngMinima()])
        ->assertSuccessful();

    $relevo->load('firmas');

    expect($relevo->tieneFirmaDe(EntregaTurnoSeguridad::ROL_FBO))->toBeTrue();
});

test('el jefe de area no puede mover un relevo viejo a otra fecha vieja', function () {
    $relevo = relevoViejo();
    // El día de antes se guarda en una variable, igual que `$suFecha` en la
    // prueba de arriba: comparar `$relevo->fresh()` contra `$relevo` discrimina
    // hoy, pero el día que alguien cambie ese `fresh()` por un `refresh()` el
    // aserto se vuelve tautológico sin que nada falle.
    $suDia = $relevo->fecha_hora->toDateString();
    $otraVieja = Carbon::today(config('app.timezone'))->subDays(5)->format('Y-m-d H:i:s');

    editarComoJefeDeArea($relevo, ['fecha_hora' => $otraVieja])
        ->assertJsonValidationErrorFor('fecha_hora');

    expect($relevo->fresh()->fecha_hora->toDateString())->toBe($suDia);
});

test('el jefe de area si puede traer un relevo viejo a hoy', function () {
    $relevo = relevoViejo();
    $hoy = Carbon::today(config('app.timezone'))->setTime(8, 0)->format('Y-m-d H:i:s');

    editarComoJefeDeArea($relevo, ['fecha_hora' => $hoy])->assertSuccessful();

    expect($relevo->fresh()->fecha_hora->toDateString())
        ->toBe(Carbon::today(config('app.timezone'))->toDateString());
});

test('el jefe de area no puede lavar una fecha pasando por una valida', function () {
    // Cada petición se juzga contra lo guardado EN ESE MOMENTO. Traer el
    // relevo a hoy y devolverlo a su fecha vieja debe fallar en el segundo
    // paso: si pasara, la ventana no serviría de nada.
    $relevo = relevoViejo();
    $vieja = $relevo->fecha_hora->format('Y-m-d H:i:s');
    $hoy = Carbon::today(config('app.timezone'))->setTime(8, 0)->format('Y-m-d H:i:s');

    editarComoJefeDeArea($relevo, ['fecha_hora' => $hoy])->assertSuccessful();

    editarComoJefeDeArea($relevo, ['fecha_hora' => $vieja])
        ->assertJsonValidationErrorFor('fecha_hora');

    expect($relevo->fresh()->fecha_hora->toDateString())
        ->toBe(Carbon::today(config('app.timezone'))->toDateString());
});

test('el mismo día con otra hora pasa en un relevo viejo', function () {
    // La comparación es por DÍA, no por instante: quien firma un relevo
    // de hace tres días puede además corregirle la hora. Sin esta prueba,
    // nadie nota si alguien cambia `cambiaElDia()` para comparar el datetime
    // completo y deja ese caso en 422.
    $relevo = relevoViejo();
    $mismoDiaOtraHora = $relevo->fecha_hora->copy()->setTime(19, 45)->format('Y-m-d H:i:s');

    editarComoJefeDeArea($relevo, ['fecha_hora' => $mismoDiaOtraHora])->assertSuccessful();

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

test('el jefe de area puede dejar la fecha vieja tal como estaba', function () {
    /*
     * Ésta es la prueba de `cambiaElDia()` que antes cargaba la del FBO. Desde
     * que `fbo` está exento, su verde ya no demuestra que la ventana se
     * ensanche con la fecha guardada: pasaría igual sin ensanchar nada. El jefe
     * de área sí está sujeto, así que aquí el ensanchamiento es lo único que
     * puede hacer pasar la petición.
     */
    $relevo = relevoViejo();
    $suFecha = $relevo->fecha_hora->format('Y-m-d H:i:s');

    editarComoJefeDeArea($relevo, ['fecha_hora' => $suFecha, 'observaciones' => 'Revisado'])
        ->assertSuccessful();

    expect($relevo->fresh()->observaciones)->toBe('Revisado');
});

test('el FBO si puede mover un relevo viejo a otra fecha vieja', function () {
    /*
     * El par de `el jefe de area no puede mover un relevo viejo a otra fecha
     * vieja`, y lo que este cambio vino a hacer: el FBO está exento, así que
     * puede corregir la fecha de un registro viejo. MISMA fecha y MISMO
     * endpoint que el 422 del jefe de área: sin ese par, un 200 aquí podría
     * venir de que la fecha estaba dentro de la ventana y nadie se enteraría.
     */
    $relevo = relevoViejo();
    $otraVieja = Carbon::today(config('app.timezone'))->subDays(5);

    editarComoFbo($relevo, ['fecha_hora' => $otraVieja->format('Y-m-d H:i:s')])
        ->assertSuccessful();

    expect($relevo->fresh()->fecha_hora->toDateString())->toBe($otraVieja->toDateString());
});
