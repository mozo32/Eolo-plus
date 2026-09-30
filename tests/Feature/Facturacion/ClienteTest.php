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
        ->and($guardado->rfc)->toBe('AER970627QE9')
        ->and($guardado->correo)->toBe('facturacion@ejemplo.com')
        ->and($guardado->telefono)->toBe('7221234567');
});

test('el RFC puede repetirse entre clientes distintos', function () {
    // Caso real: el RFC genérico de público en general.
    FactCliente::create(['nombre' => 'HIPOTECARIA ARBI', 'rfc' => 'XAXX010101000']);
    FactCliente::create(['nombre' => 'OLI STONE', 'rfc' => 'XAXX010101000']);
    FactCliente::create(['nombre' => 'Publico en General', 'rfc' => 'XAXX010101000']);

    expect(FactCliente::where('rfc', 'XAXX010101000')->count())->toBe(3);
});

test('el nombre puede repetirse entre clientes distintos', function () {
    // Hoy no hay nombres repetidos en los datos reales, pero la tabla no debe
    // impedirlos: un duplicado no puede tumbar el importador en produccion.
    FactCliente::create(['nombre' => 'Cliente Repetido', 'rfc' => 'AAA010101AAA']);
    FactCliente::create(['nombre' => 'Cliente Repetido', 'rfc' => 'BBB020202BBB']);

    expect(FactCliente::where('nombre', 'Cliente Repetido')->count())->toBe(2);
});

test('un cliente puede no tener RFC ni contacto', function () {
    $cliente = FactCliente::create(['nombre' => 'Cliente sin datos']);

    expect($cliente->fresh()->rfc)->toBeNull()
        ->and($cliente->fresh()->correo)->toBeNull()
        ->and($cliente->fresh()->telefono)->toBeNull();
});

/*
 * LIMITACION: las pruebas corren en sqlite en memoria, que no aplica la longitud
 * de varchar(N) ni la conserva en el esquema (Schema::getColumns y sqlite_master
 * solo ven "varchar"). Por eso esta prueba NO garantiza que la columna `rfc`
 * mida 20: solo fija que el modelo no trunca ni transforma un RFC de 15
 * caracteres. La garantia de la longitud es `string('rfc', 20)` en la migracion
 * (MySQL, que si la aplica); si se toca, verificarlo a mano contra MySQL.
 */
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
