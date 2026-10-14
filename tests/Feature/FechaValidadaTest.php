<?php

use App\Models\InspeccionAutotanque;
use App\Models\RegistroVisitante;
use App\Models\TurnoAutotanque;
use App\Models\User;

/**
 * Dos endpoints escribían una fecha de la petición sin comprobar que fuera una fecha:
 * `RegistroVisitantesController` la validaba como `required|string` y
 * `InspeccioAutotanqueController` como `required` a secas. Con basura, `Carbon::parse` lanzaba
 * dentro del `try` y el usuario recibía un **500**, no un 422 que le dijera qué corregir.
 *
 * La regla es `date_format:Y-m-d` y no `date` a propósito: los tres formularios mandan el día
 * con `fechaHoy()`, y `date` aceptaría `"20261007"`, que el cast de Eloquent lee como un
 * timestamp Unix y guardaría como 1970. Con `date_format` la cadena que se valida ES el día
 * que se guarda. Es el mismo criterio de la §5 quater de la especificación de las ventanas.
 *
 * Estas pruebas NO exigen ninguna ventana de fechas: esos endpoints no tienen calendario y esa
 * decisión sigue siendo del departamento.
 */
/**
 * La inspección cuelga de un turno por clave ajena, y su tabla exige operador, kilometraje,
 * combustible y checklist, que el controlador NO valida: una petición incompleta da 500. Eso
 * queda como está; aquí solo se manda completa para poder medir la fecha.
 */
function turnoParaInspeccion(): TurnoAutotanque
{
    return TurnoAutotanque::create([
        'user_id' => User::factory()->create()->id,
        'nombre' => 'Turno Uno',
        'fecha' => now()->toDateString().' 08:00:00',
        'cmIni' => 10, 'litrosIni' => 100, 'totalizadorIni' => 5000,
        'nombreCierre' => '', 'fechaCierre' => now()->toDateString().' 20:00:00',
        'cmCierre' => 0, 'litrosCierre' => 0, 'totalizadorCierre' => 0,
        'totalVendidos' => 0, 'balanceAritmetico' => 0, 'balanceFisico' => 0, 'diferenciaFinal' => 0,
    ]);
}

function inspeccionValida(int $turnoId, mixed $fecha): array
{
    return [
        'turno_id' => $turnoId,
        'fecha' => $fecha,
        'operador' => 'Operador Uno',
        'km' => 1000,
        'combustible' => 80,
        'checklist' => ['luces' => 'ok'],
    ];
}

function visitanteValido(mixed $fecha): array
{
    return [
        'nombre' => 'Visita Uno',
        'procedencia' => 'Proveedor',
        'a_quien_visita' => 'Operaciones',
        'gafete' => 'G-01',
        'tipo_gafete' => 'Verde',
        'empresa' => 'ACME',
        'autoriza' => 'Jefe Uno',
        'fechaRegistro' => $fecha,
        'horaEntrada' => '10:30',
        'firma_entrada' => 'data:image/png;base64,AAAA',
    ];
}

function salidaValida(mixed $fecha): array
{
    return [
        'fechaSalida' => $fecha,
        'horaSalida' => '18:30',
        'firma_salida' => 'data:image/png;base64,BBBB',
    ];
}

/** Lo que un cliente puede mandar y antes acabava en 500 o en una fecha absurda. */
dataset('fechas que no son un dia', [
    'basura' => ['no es una fecha'],
    'vacia' => [''],
    'numerica compacta' => ['20261007'],
    'con hora' => ['2026-10-07 10:30:00'],
    'con desfase' => ['2026-10-07T00:00:00-06:00'],
    'dia imposible' => ['2026-02-31'],
    'un numero' => [20261007],
    'un arreglo' => [['2026-10-07']],
]);

test('VISITANTES ALTA: una fecha que no es un dia da 422 y no escribe', function (mixed $fecha) {
    $this->actingAs(User::factory()->create(), 'sanctum');
    $antes = RegistroVisitante::count();

    $this->postJson('/api/RegistroVisitantes', visitanteValido($fecha))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('fechaRegistro');

    expect(RegistroVisitante::count())->toBe($antes);
})->with('fechas que no son un dia');

test('VISITANTES ALTA: el dia que manda el formulario se guarda tal cual', function () {
    $this->actingAs(User::factory()->create(), 'sanctum');
    $dia = now()->toDateString();

    $this->postJson('/api/RegistroVisitantes', visitanteValido($dia))->assertSuccessful();

    // Se lee la columna, no la respuesta: es lo unico que prueba que no se guardo otro dia.
    expect(RegistroVisitante::latest('id')->first()->fecha_entrada->toDateString())->toBe($dia);
});

test('VISITANTES SALIDA: una fecha que no es un dia da 422 y no cambia lo guardado', function (mixed $fecha) {
    $this->actingAs(User::factory()->create(), 'sanctum');
    $this->postJson('/api/RegistroVisitantes', visitanteValido(now()->toDateString()))->assertSuccessful();
    $visitante = RegistroVisitante::latest('id')->first();

    $this->putJson("/api/RegistroVisitantes/{$visitante->id}", salidaValida($fecha))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('fechaSalida');

    expect($visitante->fresh()->fecha_salida)->toBeNull();
})->with('fechas que no son un dia');

test('VISITANTES SALIDA: el dia que manda el formulario se guarda tal cual', function () {
    $this->actingAs(User::factory()->create(), 'sanctum');
    $dia = now()->toDateString();
    $this->postJson('/api/RegistroVisitantes', visitanteValido($dia))->assertSuccessful();
    $visitante = RegistroVisitante::latest('id')->first();

    $this->putJson("/api/RegistroVisitantes/{$visitante->id}", salidaValida($dia))->assertSuccessful();

    expect($visitante->fresh()->fecha_salida->toDateString())->toBe($dia);
});

test('INSPECCION AUTOTANQUE: una fecha que no es un dia da 422 y no escribe', function (mixed $fecha) {
    $this->actingAs(User::factory()->create(), 'sanctum');
    $antes = InspeccionAutotanque::count();

    $turno = turnoParaInspeccion();

    $this->postJson('/api/InspeccionAutoTanque', inspeccionValida($turno->id, $fecha))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('fecha');

    expect(InspeccionAutotanque::count())->toBe($antes);
})->with('fechas que no son un dia');

test('INSPECCION AUTOTANQUE: el dia que manda el formulario se guarda tal cual', function () {
    $this->actingAs(User::factory()->create(), 'sanctum');
    $dia = now()->toDateString();

    $turno = turnoParaInspeccion();

    $this->postJson('/api/InspeccionAutoTanque', inspeccionValida($turno->id, $dia))->assertSuccessful();

    expect(InspeccionAutotanque::latest('id')->first()->fecha_inspeccion->toDateString())->toBe($dia);
});
