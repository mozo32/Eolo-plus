<?php

use App\Support\VentanasDeFecha;
use Illuminate\Support\Carbon;

test('una ventana de un dia atras da hoy y ayer', function () {
    Carbon::setTestNow('2026-10-07 15:00:00');

    expect(VentanasDeFecha::para('turno.checklist'))
        ->toBe(['min' => '2026-10-06', 'max' => '2026-10-07']);
});

test('una ventana de tres dias atras da cuatro dias, contando hoy', function () {
    Carbon::setTestNow('2026-10-07 15:00:00');

    expect(VentanasDeFecha::para('operaciones.llegada'))
        ->toBe(['min' => '2026-10-04', 'max' => '2026-10-07']);
});

test('la excepcion de Operaciones Programadas no pone techo ni suelo', function () {
    Carbon::setTestNow('2026-10-07 15:00:00');

    expect(VentanasDeFecha::para('programadas.operacion'))
        ->toBe(['min' => null, 'max' => null]);
});

test('UNA CLAVE DESCONOCIDA LANZA, no devuelve un valor por omision', function () {
    // Es la red de todo lo demas: con un valor por omision silencioso, un formulario
    // quedaria sin restriccion —o restringido de mas— y nadie se enteraria.
    expect(fn () => VentanasDeFecha::para('turno.checklis'))
        ->toThrow(InvalidArgumentException::class);
});

test('SOLO Operaciones Programadas admite futuro; se recorre la tabla entera', function () {
    // Asi, un formulario nuevo mal declarado sale en rojo en vez de colarse.
    Carbon::setTestNow('2026-10-07 15:00:00');

    foreach (array_keys(VentanasDeFecha::CLAVES) as $clave) {
        $max = VentanasDeFecha::para($clave)['max'];

        if ($clave === 'programadas.operacion') {
            expect($max)->toBeNull("la excepcion {$clave} deberia admitir futuro");

            continue;
        }

        expect($max)->toBe('2026-10-07', "la clave {$clave} NO deberia admitir futuro");
    }
});

test('todas() devuelve una entrada por clave', function () {
    expect(array_keys(VentanasDeFecha::todas()))
        ->toBe(array_keys(VentanasDeFecha::CLAVES));
});

test('todo formulario salvo la excepcion tiene suelo, y el suelo no pasa del techo', function () {
    // Una clave con `atras => null` por descuido dejaria el calendario abierto hacia el pasado.
    Carbon::setTestNow('2026-10-07 15:00:00');

    foreach (array_keys(VentanasDeFecha::CLAVES) as $clave) {
        if ($clave === 'programadas.operacion') {
            continue;
        }

        $ventana = VentanasDeFecha::para($clave);

        expect($ventana['min'])->not->toBeNull("la clave {$clave} no deberia quedar sin suelo");
        expect($ventana['min'] <= $ventana['max'])->toBeTrue("la clave {$clave} tiene el suelo por encima del techo");
    }
});
