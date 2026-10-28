<?php

use App\Support\VentanaDeEstancia;
use Illuminate\Support\Carbon;

/*
 * La ventana de una estancia, que decide qué servicios de la aeronave entran en su prefactura.
 *
 * La regla que fija esta prueba es la que estaba mal: mientras no haya salida registrada la
 * estancia sigue ABIERTA y la ventana no tiene tope. Antes el tope era `now()`, y un servicio
 * anotado a las 18:00 cuando el reloj iba por la mañana no aparecía hasta que pasaban las 18:00.
 */

test('con llegada y salida la ventana va de una a la otra, extremos incluidos', function () {
    $ventana = VentanaDeEstancia::de('2026-10-20 08:00:00', '2026-10-20 18:00:00');

    expect($ventana->contiene(Carbon::parse('2026-10-20 08:00:00')))->toBeTrue()
        ->and($ventana->contiene(Carbon::parse('2026-10-20 18:00:00')))->toBeTrue()
        ->and($ventana->contiene(Carbon::parse('2026-10-20 07:59:59')))->toBeFalse()
        ->and($ventana->contiene(Carbon::parse('2026-10-20 18:00:01')))->toBeFalse();
});

test('sin salida la ventana no tiene tope, ni siquiera el reloj de ahora', function () {
    Carbon::setTestNow('2026-10-20 12:00:00');

    $ventana = VentanaDeEstancia::de('2026-10-20 08:00:00', null);

    expect($ventana->contiene(Carbon::parse('2026-10-20 18:00:00')))->toBeTrue()
        ->and($ventana->contiene(Carbon::parse('2027-01-01 00:00:00')))->toBeTrue()
        ->and($ventana->contiene(Carbon::parse('2026-10-20 07:59:59')))->toBeFalse();

    Carbon::setTestNow();
});

test('sin llegada no hay ventana', function () {
    expect(VentanaDeEstancia::de(null, '2026-10-20 18:00:00'))->toBeNull();
});

test('una salida anterior a la llegada no es ventana', function () {
    expect(VentanaDeEstancia::de('2026-10-20 18:00:00', '2026-10-20 08:00:00'))->toBeNull();
});

test('los dias que la consulta necesita salen de la propia ventana', function () {
    $conSalida = VentanaDeEstancia::de('2026-10-20 08:00:00', '2026-10-22 18:00:00');

    expect($conSalida->diaInicial())->toBe('2026-10-20')
        ->and($conSalida->diaFinal())->toBe('2026-10-22')
        ->and($conSalida->diaSiguienteAlFinal())->toBe('2026-10-23');

    $abierta = VentanaDeEstancia::de('2026-10-20 08:00:00', null);

    expect($abierta->diaInicial())->toBe('2026-10-20')
        ->and($abierta->diaFinal())->toBeNull()
        ->and($abierta->diaSiguienteAlFinal())->toBeNull();
});
