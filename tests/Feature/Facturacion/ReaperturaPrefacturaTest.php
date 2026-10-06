<?php

use App\Models\FactPrefactura;
use App\Models\FactPrefacturaVersion;

/**
 * Los atributos mínimos de una versión de prueba; `$extra` pisa lo que haga falta.
 *
 * @param  array<string, mixed>  $extra
 * @return array<string, mixed>
 */
function filaDeVersion(FactPrefactura $prefactura, int $version, array $extra = []): array
{
    return array_merge([
        'prefactura_id' => $prefactura->id,
        'version' => $version,
        'folio' => $prefactura->folio,
        'subtotal_sellado' => '1.00',
        'iva_sellado' => '0.16',
        'total_sellado' => '1.16',
        'iva_tasa_sellada' => '0.1600',
        'reabierta_at' => now(),
        'reabierta_por' => null,
        'motivo' => 'x',
        'documento' => [],
    ], $extra);
}

test('una version guarda el documento como arreglo y se lee por su prefactura', function () {
    $prefactura = prefacturaBorrador();
    $prefactura->update(['estado' => FactPrefactura::ESTADO_CERRADA, 'folio' => 10001]);

    FactPrefacturaVersion::create([
        'prefactura_id' => $prefactura->id,
        'version' => 1,
        'folio' => 10001,
        'subtotal_sellado' => '100.00',
        'iva_sellado' => '16.00',
        'total_sellado' => '116.00',
        'iva_tasa_sellada' => '0.1600',
        'reabierta_at' => now(),
        'reabierta_por' => null,
        'motivo' => 'Faltaba el combustible.',
        'documento' => ['folio' => 10001, 'filas' => []],
    ]);

    $version = $prefactura->fresh()->versiones->sole();

    expect($version->documento)->toBe(['folio' => 10001, 'filas' => []])
        ->and($version->version)->toBe(1)
        ->and($version->motivo)->toBe('Faltaba el combustible.');
});

test('el estado reabierta cabe en la columna y no es cerrada', function () {
    $prefactura = prefacturaBorrador();
    $prefactura->update(['estado' => FactPrefactura::ESTADO_REABIERTA, 'folio' => 10002]);

    expect(FactPrefactura::ESTADO_REABIERTA)->toBe('reabierta')
        ->and($prefactura->fresh()->estado)->toBe('reabierta')
        ->and($prefactura->estaCerrada())->toBeFalse()
        ->and($prefactura->estaReabierta())->toBeTrue();
});

test('estaReabierta es falso para un borrador y para una cerrada', function () {
    // Las tareas siguientes abren los candados de una prefactura segun este predicado:
    // un `return true` no puede pasar.
    $borrador = prefacturaBorrador();
    $cerrada = prefacturaBorrador();
    $cerrada->update(['estado' => FactPrefactura::ESTADO_CERRADA, 'folio' => 10004]);

    expect($borrador->estaReabierta())->toBeFalse()
        ->and($cerrada->estaReabierta())->toBeFalse()
        ->and($cerrada->estaCerrada())->toBeTrue();
});

test('dos versiones no pueden llevar el mismo numero en la misma prefactura', function () {
    $prefactura = prefacturaBorrador();
    $prefactura->update(['estado' => FactPrefactura::ESTADO_CERRADA, 'folio' => 10003]);

    FactPrefacturaVersion::create(filaDeVersion($prefactura, 1));

    expect(fn () => FactPrefacturaVersion::create(filaDeVersion($prefactura, 1)))
        ->toThrow(Illuminate\Database\UniqueConstraintViolationException::class);
});

test('el unico es compuesto: otra prefactura puede tener su version 1 y la misma su version 2', function () {
    // Fija el indice (prefactura_id, version): un `unique('version')` rompe la segunda
    // creacion y un `unique('prefactura_id')` rompe la tercera.
    $a = prefacturaBorrador();
    $b = prefacturaBorrador();
    $a->update(['folio' => 10005]);
    $b->update(['folio' => 10006]);

    FactPrefacturaVersion::create(filaDeVersion($a, 1));
    FactPrefacturaVersion::create(filaDeVersion($b, 1));
    FactPrefacturaVersion::create(filaDeVersion($a, 2));

    expect(FactPrefacturaVersion::where('prefactura_id', $a->id)->count())->toBe(2)
        ->and(FactPrefacturaVersion::where('prefactura_id', $b->id)->count())->toBe(1);
});

test('versiones devuelve las versiones por numero, no por orden de creacion', function () {
    $prefactura = prefacturaBorrador();
    $prefactura->update(['estado' => FactPrefactura::ESTADO_CERRADA, 'folio' => 10007]);

    foreach ([3, 1, 2] as $numero) {
        FactPrefacturaVersion::create(filaDeVersion($prefactura, $numero));
    }

    // El motor recorre el indice unico (prefactura_id, version) y devuelve ya ordenado
    // aunque la relacion no ordene, asi que el resultado solo no prueba el orderBy: se
    // comprueba tambien que la relacion lo declara.
    expect($prefactura->fresh()->versiones->pluck('version')->all())->toBe([1, 2, 3])
        ->and(collect($prefactura->versiones()->getQuery()->getQuery()->orders)->pluck('column')->all())->toBe(['version']);
});

test('el sello de una version se lee con dos decimales, y la tasa con cuatro', function () {
    $prefactura = prefacturaBorrador();
    $prefactura->update(['estado' => FactPrefactura::ESTADO_CERRADA, 'folio' => 10008]);

    FactPrefacturaVersion::create(filaDeVersion($prefactura, 1, [
        'subtotal_sellado' => '100',
        'iva_sellado' => '16.5',
        'total_sellado' => '116.5',
        'iva_tasa_sellada' => '0.16',
    ]));

    $version = $prefactura->fresh()->versiones->sole();

    expect([$version->subtotal_sellado, $version->iva_sellado, $version->total_sellado, $version->iva_tasa_sellada])
        ->toBe(['100.00', '16.50', '116.50', '0.1600']);
});
