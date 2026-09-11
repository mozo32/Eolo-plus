<?php

use App\Models\OperacionDiaria;
use App\Models\User;
use App\Models\WalkAround;
use App\Services\SecuenciaMovimientoService;

/*
 * La regla de secuencia ya no se aplica al programar: Operaciones Programadas
 * solo valida matrículas restringidas. Lo que aquí se prueba es la validación
 * definitiva, la que siguen ejecutando Operaciones Diarias y WalkAround.
 */

function operacionReal(string $matricula, string $tipo, string $fecha, string $hora): OperacionDiaria
{
    return OperacionDiaria::create([
        'user_id' => User::factory()->create()->id,
        'fecha' => $fecha,
        'tipo' => $tipo,
        'matricula' => $matricula,
        'equipo' => 'C172',
        'hora' => $hora,
        'lugar' => 'MMTO',
        'pax' => 2,
        'departamento' => 'Trafico',
    ]);
}

test('normaliza entrada y llegada al mismo movimiento', function () {
    expect(SecuenciaMovimientoService::normalizar('Entrada'))->toBe('llegada')
        ->and(SecuenciaMovimientoService::normalizar('Llegada'))->toBe('llegada')
        ->and(SecuenciaMovimientoService::normalizar('SALIDA'))->toBe('salida');
});

test('conserva el mensaje que Operaciones Diarias ya devolvia', function () {
    operacionReal('XA-ABC', 'llegada', '2026-09-09', '08:00');

    $resultado = SecuenciaMovimientoService::validarFinal(
        'XA-ABC',
        'Llegada',
        SecuenciaMovimientoService::FUENTE_OPERACIONES_DIARIAS
    );

    expect($resultado['valido'])->toBeFalse()
        ->and($resultado['message'])->toBe(
            'La matrícula ya cuenta con un registro de Llegada. Debe registrar una Salida primero.'
        )
        ->and($resultado['data'])->toBeNull();
});

test('conserva el mensaje que WalkAround ya devolvia', function () {
    WalkAround::create([
        'fecha' => '2026-09-09',
        'movimiento' => 'entrada',
        'matricula' => 'XA-ABC',
        'tipo' => 'avion',
        'tipo_aeronave' => 'C172',
        'tipo_aeronave_id' => 1,
        'hora' => '08:00',
        'status' => 'A',
    ]);

    $resultado = SecuenciaMovimientoService::validarFinal(
        'XA-ABC',
        'Entrada',
        SecuenciaMovimientoService::FUENTE_WALKAROUND
    );

    expect($resultado['valido'])->toBeFalse()
        ->and($resultado['message'])->toBe(
            'La matrícula XA-ABC ya cuenta con un registro de Entrada. Debe registrar una Salida primero.'
        )
        ->and($resultado['data']['ultimo_movimiento'])->toBe('entrada');
});

test('los historiales de Operaciones Diarias y WalkAround siguen siendo independientes', function () {
    operacionReal('XA-ABC', 'llegada', '2026-09-09', '08:00');

    $resultado = SecuenciaMovimientoService::validarFinal(
        'XA-ABC',
        'Entrada',
        SecuenciaMovimientoService::FUENTE_WALKAROUND
    );

    expect($resultado['valido'])->toBeTrue();
});
