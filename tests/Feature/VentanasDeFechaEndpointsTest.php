<?php

use App\Models\OperacionDiaria;
use App\Models\User;
use App\Support\VentanasDeFecha;
use Illuminate\Support\Carbon;

/*
 * El navegador guía con `min`/`max`; el servidor decide. Cada prueba de este fichero es una
 * petición REAL con una fecha fuera de ventana: el estado es 422, el mensaje nombra las dos
 * fechas y no se escribió nada. Un test de la regla suelta no prueba que el endpoint la use.
 */

/**
 * Las dos fechas de una ventana, con el formato en que las nombra el mensaje.
 *
 * @return array{min: string, max: string}
 */
function fechasDelMensaje(string $clave): array
{
    $ventana = VentanasDeFecha::para($clave);

    return [
        'min' => Carbon::parse($ventana['min'])->format('d/m/Y'),
        'max' => Carbon::parse($ventana['max'])->format('d/m/Y'),
    ];
}

function mensajeDeFecha($respuesta): string
{
    return $respuesta->json('errors.fecha.0') ?? '';
}

// ---------------------------------------------------------------------------
// Operaciones diarias: POST /api/OperacionesDiarias (llegada y salida)
// ---------------------------------------------------------------------------

function cargaDeOperacion(string $movimiento, string $fecha): array
{
    return [
        'fecha' => $fecha,
        'movimiento' => $movimiento,
        'matricula' => 'XA-VEN',
        'equipo' => 'C172',
        'hora' => '10:30',
        'pax' => 2,
        'departamento' => 'Trafico',
        'procedencia' => $movimiento === 'Llegada' ? 'MMTO' : null,
        'destino' => $movimiento === 'Salida' ? 'MMTO' : null,
    ];
}

it('rechaza con 422 y no escribe una llegada con fecha fuera de ventana', function (string $clave, string $movimiento, int $desplazamiento) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $fecha = Carbon::today()->addDays($desplazamiento)->toDateString();
    $antes = OperacionDiaria::count();

    $respuesta = $this->postJson('/api/OperacionesDiarias', cargaDeOperacion($movimiento, $fecha));

    $respuesta->assertUnprocessable()->assertJsonValidationErrors('fecha');
    ['min' => $min, 'max' => $max] = fechasDelMensaje($clave);
    expect(mensajeDeFecha($respuesta))->toContain($min)->toContain($max);
    expect(OperacionDiaria::count())->toBe($antes);
})->with([
    'llegada en el futuro' => ['operaciones.llegada', 'Llegada', 1],
    'llegada demasiado antigua' => ['operaciones.llegada', 'Llegada', -4],
    'salida en el futuro' => ['operaciones.salida', 'Salida', 1],
    'salida demasiado antigua' => ['operaciones.salida', 'Salida', -4],
]);

it('no deja pasar una fecha vacia, ausente o ilegible: la regla sola no lo impediria', function (?string $fecha, bool $enviarFecha) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antes = OperacionDiaria::count();
    $carga = cargaDeOperacion('Llegada', (string) $fecha);
    if (! $enviarFecha) {
        unset($carga['fecha']);
    }

    $this->postJson('/api/OperacionesDiarias', $carga)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('fecha');

    expect(OperacionDiaria::count())->toBe($antes);
})->with([
    'vacia' => ['', true],
    'ausente' => [null, false],
    'ilegible' => ['no-es-una-fecha', true],
]);

// ---------------------------------------------------------------------------
// Operaciones diarias: PUT /api/OperacionesDiarias/{id} (editar)
// ---------------------------------------------------------------------------

function operacionParaEditar(string $tipo, string $fecha): OperacionDiaria
{
    return OperacionDiaria::create([
        'user_id' => User::factory()->create()->id,
        'fecha' => $fecha,
        'tipo' => $tipo,
        'matricula' => 'XA-EDI',
        'equipo' => 'C172',
        'hora' => '10:30',
        'lugar' => 'MMTO',
        'pax' => 2,
        'departamento' => 'Trafico',
    ]);
}

it('rechaza con 422 y no modifica la fecha de una edicion fuera de ventana', function (string $clave, string $tipo) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = Carbon::today()->toDateString();
    $operacion = operacionParaEditar($tipo, $original);

    $respuesta = $this->putJson("/api/OperacionesDiarias/{$operacion->id}", [
        'matricula' => 'XA-EDI',
        'equipo' => 'C172',
        'hora' => '10:30',
        'pax' => 2,
        'fecha' => Carbon::today()->addDay()->toDateString(),
    ]);

    $respuesta->assertUnprocessable()->assertJsonValidationErrors('fecha');
    ['min' => $min, 'max' => $max] = fechasDelMensaje($clave);
    expect(mensajeDeFecha($respuesta))->toContain($min)->toContain($max);
    expect($operacion->fresh()->fecha->toDateString())->toBe($original);
})->with([
    'llegada' => ['operaciones.llegada', 'llegada'],
    'salida' => ['operaciones.salida', 'salida'],
]);

it('deja corregir otros campos de un registro antiguo si no se toca su fecha', function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $antigua = Carbon::today()->subDays(10)->toDateString();
    $operacion = operacionParaEditar('llegada', $antigua);

    $this->putJson("/api/OperacionesDiarias/{$operacion->id}", [
        'matricula' => 'XA-EDI',
        'equipo' => 'C172',
        'hora' => '10:30',
        'procedencia' => 'MMTO',
        'pax' => 5,
        'fecha' => $antigua,
    ])->assertOk();

    expect($operacion->fresh()->pax)->toBe(5);
});

it('no deja que una edicion lleve una fecha ausente o ilegible', function (?string $fecha, bool $enviarFecha) {
    $this->actingAs(usuarioAdmin(), 'sanctum');
    $original = Carbon::today()->toDateString();
    $operacion = operacionParaEditar('llegada', $original);
    $carga = [
        'matricula' => 'XA-EDI',
        'equipo' => 'C172',
        'hora' => '10:30',
        'procedencia' => 'MMTO',
        'pax' => 2,
    ];
    if ($enviarFecha) {
        $carga['fecha'] = $fecha;
    }

    $this->putJson("/api/OperacionesDiarias/{$operacion->id}", $carga)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('fecha');

    expect($operacion->fresh()->fecha->toDateString())->toBe($original);
})->with([
    'ausente' => [null, false],
    'ilegible' => ['no-es-una-fecha', true],
]);
