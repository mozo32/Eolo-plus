<?php

use App\Models\MovimientoCSAE;
use App\Models\User;
use Illuminate\Support\Carbon;

/*
 * El PUT del módulo lo usan DOS pantallas: registrar la salida de un avión que
 * sigue dentro, y la edición completa, que corrige los datos de entrada.
 *
 * Antes solo escribía los tres campos de salida: la edición completa mandaba la
 * matrícula y el transportista y el servidor los tiraba en silencio. El
 * formulario lo tapaba exigiendo fecha y hora de salida, así que un movimiento
 * sin salida ni siquiera se podía guardar.
 */

/** @param array<string, mixed> $extra */
function movimientoCsae(array $extra = []): MovimientoCSAE
{
    return MovimientoCSAE::create(array_merge([
        'user_entrada_id' => User::factory()->create()->id,
        'fecha_hora_entrada' => Carbon::now()->format('Y-m-d H:i:s'),
        'fecha_hora_salida' => null,
        'matricula' => 'XA-UNO',
        'tipo_aeronave' => 'C172',
        'como_llega' => 'Remolcada',
        'transportista' => 'Propio',
        'observaciones_entrada' => 'Llegó completa',
        'status' => 'A',
    ], $extra));
}

/** @param array<string, mixed> $payload */
function actualizarCsae(MovimientoCSAE $movimiento, array $payload): \Illuminate\Testing\TestResponse
{
    return test()->putJson("/api/MovimientosCSAE/{$movimiento->id}", $payload);
}

beforeEach(function () {
    $this->actingAs(User::factory()->create());
});

test('editar un movimiento sin salida guarda la entrada y no inventa una salida', function () {
    $movimiento = movimientoCsae();

    actualizarCsae($movimiento, [
        'matricula' => 'XA-DOS',
        'tipo_aeronave' => 'B737',
        'como_llega' => 'Rodando',
        'transportista' => 'Ajeno',
        'observaciones_entrada' => 'Corregido',
        'fecha_hora_salida' => null,
    ])->assertSuccessful();

    $movimiento->refresh();

    expect($movimiento->matricula)->toBe('XA-DOS')
        ->and($movimiento->tipo_aeronave)->toBe('B737')
        ->and($movimiento->como_llega)->toBe('Rodando')
        ->and($movimiento->transportista)->toBe('Ajeno')
        ->and($movimiento->observaciones_entrada)->toBe('Corregido')
        ->and($movimiento->fecha_hora_salida)->toBeNull();
});

test('editar un movimiento que sigue dentro no le sella quien registro la salida', function () {
    // `user_salida_id` responde a «quién lo despachó». Sellarlo al corregir la
    // matrícula de un avión que no ha salido es afirmar algo que no ocurrió.
    $movimiento = movimientoCsae();

    actualizarCsae($movimiento, ['matricula' => 'XA-TRES', 'fecha_hora_salida' => null])
        ->assertSuccessful();

    expect($movimiento->refresh()->user_salida_id)->toBeNull();
});

test('registrar la salida sigue funcionando y si sella quien la registro', function () {
    $movimiento = movimientoCsae();
    $salida = Carbon::now()->format('Y-m-d H:i:s');

    actualizarCsae($movimiento, [
        'fecha_hora_salida' => $salida,
        'observaciones_salida' => 'Despegó sin novedad',
    ])->assertSuccessful();

    $movimiento->refresh();

    expect($movimiento->fecha_hora_salida)->not->toBeNull()
        ->and($movimiento->observaciones_salida)->toBe('Despegó sin novedad')
        ->and($movimiento->user_salida_id)->not->toBeNull();
});

test('corregir la entrada de un movimiento ya salido no le borra la salida', function () {
    // El riesgo es escribir `null` sobre lo que no venga en la petición: una
    // salida registrada se perdería por omitir un campo.
    $movimiento = movimientoCsae([
        'fecha_hora_salida' => Carbon::now()->format('Y-m-d H:i:s'),
    ]);

    actualizarCsae($movimiento, ['matricula' => 'XA-CUATRO'])->assertSuccessful();

    $movimiento->refresh();

    expect($movimiento->matricula)->toBe('XA-CUATRO')
        ->and($movimiento->fecha_hora_salida)->not->toBeNull();
});

test('la ventana de la entrada solo juzga cuando el dia cambia', function () {
    /*
     * `csae.entrada` son tres días hacia atrás. Sin esta excepción, un
     * movimiento de hace diez días no se podría ni corregir: el formulario
     * reenvía su propia fecha y la regla la rechazaría por vieja.
     */
    $hace10 = Carbon::now()->subDays(10);
    $movimiento = movimientoCsae(['fecha_hora_entrada' => $hace10->format('Y-m-d H:i:s')]);

    actualizarCsae($movimiento, [
        'fecha_hora_entrada' => $hace10->format('Y-m-d H:i:s'),
        'matricula' => 'XA-CINCO',
    ])->assertSuccessful();

    expect($movimiento->refresh()->matricula)->toBe('XA-CINCO');
});

test('mover la entrada a otro dia fuera de la ventana se rechaza', function () {
    $movimiento = movimientoCsae([
        'fecha_hora_entrada' => Carbon::now()->subDays(10)->format('Y-m-d H:i:s'),
    ]);

    actualizarCsae($movimiento, [
        'fecha_hora_entrada' => Carbon::now()->subDays(9)->format('Y-m-d H:i:s'),
    ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('fecha_hora_entrada');
});

test('mover la entrada a un dia dentro de la ventana se acepta', function () {
    $movimiento = movimientoCsae([
        'fecha_hora_entrada' => Carbon::now()->subDays(10)->format('Y-m-d H:i:s'),
    ]);

    $ayer = Carbon::now()->subDay()->format('Y-m-d H:i:s');

    actualizarCsae($movimiento, ['fecha_hora_entrada' => $ayer])->assertSuccessful();

    expect($movimiento->refresh()->fecha_hora_entrada->toDateString())
        ->toBe(Carbon::now()->subDay()->toDateString());
});

test('una matricula vacia se rechaza', function () {
    $movimiento = movimientoCsae();

    actualizarCsae($movimiento, ['matricula' => ''])
        ->assertStatus(422)
        ->assertJsonValidationErrors('matricula');

    expect($movimiento->refresh()->matricula)->toBe('XA-UNO');
});

test('no mandar un campo de entrada lo deja como estaba', function () {
    $movimiento = movimientoCsae();

    actualizarCsae($movimiento, ['observaciones_salida' => 'Solo la nota'])
        ->assertSuccessful();

    $movimiento->refresh();

    expect($movimiento->matricula)->toBe('XA-UNO')
        ->and($movimiento->transportista)->toBe('Propio')
        ->and($movimiento->observaciones_salida)->toBe('Solo la nota');
});

test('sin sesion no se actualiza nada', function () {
    $movimiento = movimientoCsae();

    app('auth')->forgetGuards();

    actualizarCsae($movimiento, ['matricula' => 'XA-SEIS'])->assertUnauthorized();

    expect($movimiento->refresh()->matricula)->toBe('XA-UNO');
});
