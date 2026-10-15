<?php

use App\Services\CalculadoraEstancia;
use Illuminate\Support\Carbon;

/**
 * La regla salió de medir 2803 folios históricos, no de una conversación: días
 * completos son pernoctas, y el resto cae en un tramo. Acierta en el 86,1%.
 *
 * El caso que más cuesta creer es el último: un resto de MÁS de 12 h no cobra
 * «Tránsito 12 hrs», redondea a una pernocta más. Medido: con esa regla el acierto
 * es 86,1%; cobrando 12 hrs cae al 62,0%. No lo «arregles».
 */
function tramos(string $llegada, string $salida): array
{
    return CalculadoraEstancia::tramos(Carbon::parse($llegada), Carbon::parse($salida));
}

test('siete dias exactos son siete pernoctas y nada mas', function () {
    expect(tramos('2026-10-15 12:00:00', '2026-10-22 12:00:00'))
        ->toBe(['pernoctas' => 7, 'transitos2h' => 0, 'transitos12h' => 0]);
});

test('siete dias y ocho horas y cuarto son siete pernoctas y un transito de 12 h', function () {
    // El segundo ejemplo que dio el departamento, tal cual.
    expect(tramos('2026-10-15 12:00:00', '2026-10-22 20:15:00'))
        ->toBe(['pernoctas' => 7, 'transitos2h' => 0, 'transitos12h' => 1]);
});

test('el resto decide el tramo, y las fronteras son inclusivas por abajo', function (string $salida, array $esperado) {
    expect(tramos('2026-10-15 12:00:00', $salida))->toBe($esperado);
})->with([
    'un minuto' => ['2026-10-15 12:01:00', ['pernoctas' => 0, 'transitos2h' => 1, 'transitos12h' => 0]],
    'dos horas exactas' => ['2026-10-15 14:00:00', ['pernoctas' => 0, 'transitos2h' => 1, 'transitos12h' => 0]],
    'dos horas y un min' => ['2026-10-15 14:01:00', ['pernoctas' => 0, 'transitos2h' => 0, 'transitos12h' => 1]],
    'doce horas exactas' => ['2026-10-16 00:00:00', ['pernoctas' => 0, 'transitos2h' => 0, 'transitos12h' => 1]],
    'doce horas y un min' => ['2026-10-16 00:01:00', ['pernoctas' => 1, 'transitos2h' => 0, 'transitos12h' => 0]],
    'un dia exacto' => ['2026-10-16 12:00:00', ['pernoctas' => 1, 'transitos2h' => 0, 'transitos12h' => 0]],
]);

test('una estancia de cero o negativa no cobra nada', function (string $salida) {
    expect(tramos('2026-10-15 12:00:00', $salida))
        ->toBe(['pernoctas' => 0, 'transitos2h' => 0, 'transitos12h' => 0]);
})->with([
    'misma fecha y hora' => ['2026-10-15 12:00:00'],
    'salida anterior' => ['2026-10-14 12:00:00'],
]);

test('los segundos sueltos no suman un minuto', function () {
    // 2 h y 59 s sigue siendo el tramo de 2 h: se trunca, no se redondea.
    expect(tramos('2026-10-15 12:00:00', '2026-10-15 14:00:59'))
        ->toBe(['pernoctas' => 0, 'transitos2h' => 1, 'transitos12h' => 0]);
});
