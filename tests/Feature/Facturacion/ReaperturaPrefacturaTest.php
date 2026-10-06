<?php

use App\Models\FactPrefactura;
use App\Models\FactPrefacturaVersion;

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
        ->and(strlen(FactPrefactura::ESTADO_REABIERTA))->toBeLessThanOrEqual(10)
        ->and($prefactura->fresh()->estado)->toBe('reabierta')
        ->and($prefactura->estaCerrada())->toBeFalse()
        ->and($prefactura->estaReabierta())->toBeTrue();
});

test('dos versiones no pueden llevar el mismo numero en la misma prefactura', function () {
    $prefactura = prefacturaBorrador();
    $prefactura->update(['estado' => FactPrefactura::ESTADO_CERRADA, 'folio' => 10003]);

    $fila = [
        'prefactura_id' => $prefactura->id,
        'version' => 1,
        'folio' => 10003,
        'subtotal_sellado' => '1.00',
        'iva_sellado' => '0.16',
        'total_sellado' => '1.16',
        'iva_tasa_sellada' => '0.1600',
        'reabierta_at' => now(),
        'reabierta_por' => null,
        'motivo' => 'x',
        'documento' => [],
    ];

    FactPrefacturaVersion::create($fila);

    expect(fn () => FactPrefacturaVersion::create($fila))
        ->toThrow(Illuminate\Database\UniqueConstraintViolationException::class);
});
