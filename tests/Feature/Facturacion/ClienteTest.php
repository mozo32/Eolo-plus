<?php

use App\Models\FactCliente;

/*
 * Los clientes NO se deduplican por RFC: XAXX010101000 (público en general) lo
 * comparten 22 clientes sin relación entre sí en los datos reales.
 */

test('un cliente guarda sus datos de contacto', function () {
    $cliente = FactCliente::create([
        'nombre' => 'Aerolíneas de Prueba',
        'rfc' => 'AER970627QE9',
        'correo' => 'facturacion@ejemplo.com',
        'telefono' => '7221234567',
    ]);

    $guardado = $cliente->fresh();

    expect($guardado->status)->toBe('A')
        ->and($guardado->nombre)->toBe('Aerolíneas de Prueba')
        ->and($guardado->rfc)->toBe('AER970627QE9');
});

test('el RFC puede repetirse entre clientes distintos', function () {
    // Caso real: el RFC genérico de público en general.
    FactCliente::create(['nombre' => 'HIPOTECARIA ARBI', 'rfc' => 'XAXX010101000']);
    FactCliente::create(['nombre' => 'OLI STONE', 'rfc' => 'XAXX010101000']);
    FactCliente::create(['nombre' => 'Publico en General', 'rfc' => 'XAXX010101000']);

    expect(FactCliente::where('rfc', 'XAXX010101000')->count())->toBe(3);
});

test('un cliente puede no tener RFC ni contacto', function () {
    $cliente = FactCliente::create(['nombre' => 'Cliente sin datos']);

    expect($cliente->fresh()->rfc)->toBeNull()
        ->and($cliente->fresh()->correo)->toBeNull()
        ->and($cliente->fresh()->telefono)->toBeNull();
});

test('el RFC admite los 15 caracteres que se usan en los datos reales', function () {
    $cliente = FactCliente::create(['nombre' => 'RFC largo', 'rfc' => 'ABCD123456EFGHI']);

    expect($cliente->fresh()->rfc)->toBe('ABCD123456EFGHI')
        ->and(strlen($cliente->fresh()->rfc))->toBe(15);
});

test('el scope activos excluye los dados de baja', function () {
    FactCliente::create(['nombre' => 'Vivo']);
    FactCliente::create(['nombre' => 'De baja', 'status' => 'N']);

    expect(FactCliente::activos()->pluck('nombre')->all())->toBe(['Vivo']);
});
