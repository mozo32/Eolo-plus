<?php

use App\Models\EstacionamientoSubterraneo;
use App\Models\MovimientoCSAE;
use App\Models\movimientoVehiculo;
use App\Models\OperacionDiaria;
use App\Models\PernoctaDia;
use App\Models\RegistroVisitante;
use App\Models\User;
use App\Models\Vehiculo;
use App\Support\ResumenDelDiaSeguridad;
use Illuminate\Support\Carbon;

/*
 * El resumen de un día, leído de los seis módulos que registran cada cosa.
 *
 * Cada prueba siembra el día que mira Y los dos días vecinos: si una
 * consulta se dejara la fecha, el conteo saldría inflado y la prueba lo
 * vería. Sin los vecinos, quitar el filtro de fecha no rompería nada.
 */

const DIA_DEL_RESUMEN = '2026-11-09';
const DIA_ANTERIOR = '2026-11-08';
const DIA_SIGUIENTE = '2026-11-10';

/** El renglón de una clave dentro del resumen de `DIA_DEL_RESUMEN`. */
function renglonDelResumen(string $clave): array
{
    $renglones = ResumenDelDiaSeguridad::para(Carbon::parse(DIA_DEL_RESUMEN));

    $encontrado = collect($renglones)->firstWhere('clave', $clave);

    expect($encontrado)->not->toBeNull("el resumen no trae el renglón {$clave}");

    return $encontrado;
}

function avionCsaeDeResumen(?string $entrada, ?string $salida, string $status = 'A'): MovimientoCSAE
{
    return MovimientoCSAE::create([
        'user_entrada_id' => User::factory()->create()->id,
        'fecha_hora_entrada' => $entrada ?? DIA_ANTERIOR.' 06:00:00',
        'fecha_hora_salida' => $salida,
        'matricula' => 'XA-TST',
        'tipo_aeronave' => 'Lear 45',
        'como_llega' => 'Rodando',
        'transportista' => 'CSAE',
        'status' => $status,
    ]);
}

function resguardoDeResumen(string $ingreso, ?string $salida = null): EstacionamientoSubterraneo
{
    return EstacionamientoSubterraneo::create([
        'user_id' => User::factory()->create()->id,
        'vehiculo' => 'Tsuru',
        'placas' => 'ABC123',
        'llaves' => 'SI',
        'responsable' => 'Quien sea',
        'oficial' => 'Quien vigile',
        'fecha_ingreso' => $ingreso,
        'fecha_salida' => $salida,
    ]);
}

function vehiculoDeResumen(string $dia, string $tipo): movimientoVehiculo
{
    // `vehiculo_id` tiene llave foránea: el vehículo tiene que existir.
    Vehiculo::firstOrCreate(['id' => '1'], ['nombre' => 'Camioneta']);

    $movimiento = movimientoVehiculo::create([
        'vehiculo_id' => '1',
        'tipo' => $tipo,
        'chofer' => 'Quien maneje',
        'kilometraje' => 100,
        'gasolina' => '1/2',
    ]);

    // `movimientos_vehiculos` no tiene columna de fecha del hecho: el día
    // sale de `created_at`, que no es fillable y hay que poner a mano.
    $movimiento->created_at = $dia.' 10:00:00';
    $movimiento->save();

    return $movimiento;
}

function operacionDeResumen(string $dia, string $tipo, bool $status = true): OperacionDiaria
{
    return OperacionDiaria::create([
        'user_id' => User::factory()->create()->id,
        'fecha' => $dia,
        'tipo' => $tipo,
        'matricula' => 'XA-TST',
        'equipo' => 'Lear 45',
        'hora' => '10:00',
        'lugar' => 'Plataforma',
        'pax' => 3,
        'status' => $status,
        'departamento' => 'Trafico',
    ]);
}

function visitanteDeResumen(string $entrada, ?string $salida = null): RegistroVisitante
{
    return RegistroVisitante::create([
        'nombre' => 'Quien visite',
        'procedencia' => 'Fuera',
        'a_quien_visita' => 'Quien reciba',
        'gafete' => '12',
        'empresa' => 'Empresa',
        'autoriza' => 'Quien autorice',
        'fecha_entrada' => $entrada,
        'hora_entrada' => '09:00',
        'fecha_salida' => $salida,
        'hora_salida' => $salida ? '18:00' : null,
    ]);
}

function pernoctaDeResumen(string $dia): PernoctaDia
{
    return PernoctaDia::create([
        'fecha' => $dia,
        'matricula' => 'XA-'.substr(md5($dia.random_int(1, 9999)), 0, 3),
    ]);
}

test('el resumen trae los seis renglones, en orden, aunque no haya nada', function () {
    $claves = collect(ResumenDelDiaSeguridad::para(Carbon::parse(DIA_DEL_RESUMEN)))
        ->pluck('clave')
        ->all();

    expect($claves)->toBe([
        'aviones_csae',
        'resguardo_vehicular',
        'vehiculos',
        'operaciones',
        'visitantes',
        'pernocta',
    ]);
});

test('los aviones de csae cuentan entradas y salidas del dia', function () {
    avionCsaeDeResumen(DIA_DEL_RESUMEN.' 07:00:00', null);
    avionCsaeDeResumen(DIA_DEL_RESUMEN.' 08:00:00', DIA_DEL_RESUMEN.' 19:00:00');
    avionCsaeDeResumen(DIA_ANTERIOR.' 07:00:00', DIA_SIGUIENTE.' 07:00:00');

    expect(renglonDelResumen('aviones_csae'))
        ->entradas->toBe(2)
        ->salidas->toBe(1);
});

test('los aviones de csae dados de baja no cuentan', function () {
    avionCsaeDeResumen(DIA_DEL_RESUMEN.' 07:00:00', DIA_DEL_RESUMEN.' 19:00:00', 'N');

    expect(renglonDelResumen('aviones_csae'))
        ->entradas->toBe(0)
        ->salidas->toBe(0);
});

test('el resguardo vehicular cuenta ingresos y salidas del dia', function () {
    resguardoDeResumen(DIA_DEL_RESUMEN.' 07:00:00');
    resguardoDeResumen(DIA_ANTERIOR.' 07:00:00', DIA_DEL_RESUMEN.' 08:00:00');
    resguardoDeResumen(DIA_SIGUIENTE.' 07:00:00');

    expect(renglonDelResumen('resguardo_vehicular'))
        ->entradas->toBe(1)
        ->salidas->toBe(1);
});

test('los vehiculos cuentan por su tipo y por el dia en que se capturaron', function () {
    vehiculoDeResumen(DIA_DEL_RESUMEN, 'Entrada');
    vehiculoDeResumen(DIA_DEL_RESUMEN, 'Entrada');
    vehiculoDeResumen(DIA_DEL_RESUMEN, 'Salida');
    vehiculoDeResumen(DIA_ANTERIOR, 'Entrada');
    vehiculoDeResumen(DIA_SIGUIENTE, 'Salida');

    expect(renglonDelResumen('vehiculos'))
        ->entradas->toBe(2)
        ->salidas->toBe(1);
});

test('las operaciones cuentan llegadas y salidas del dia', function () {
    operacionDeResumen(DIA_DEL_RESUMEN, 'llegada');
    operacionDeResumen(DIA_DEL_RESUMEN, 'salida');
    operacionDeResumen(DIA_DEL_RESUMEN, 'salida');
    operacionDeResumen(DIA_ANTERIOR, 'llegada');

    expect(renglonDelResumen('operaciones'))
        ->entradas->toBe(1)
        ->salidas->toBe(2);
});

test('las operaciones canceladas no cuentan', function () {
    operacionDeResumen(DIA_DEL_RESUMEN, 'llegada', false);

    expect(renglonDelResumen('operaciones'))
        ->entradas->toBe(0)
        ->salidas->toBe(0);
});

test('los visitantes cuentan entradas y salidas del dia', function () {
    visitanteDeResumen(DIA_DEL_RESUMEN);
    visitanteDeResumen(DIA_DEL_RESUMEN, DIA_DEL_RESUMEN);
    visitanteDeResumen(DIA_ANTERIOR, DIA_SIGUIENTE);

    expect(renglonDelResumen('visitantes'))
        ->entradas->toBe(2)
        ->salidas->toBe(1);
});

test('la pernocta del dia cuenta sus aeronaves', function () {
    pernoctaDeResumen(DIA_DEL_RESUMEN);
    pernoctaDeResumen(DIA_DEL_RESUMEN);
    pernoctaDeResumen(DIA_ANTERIOR);

    expect(renglonDelResumen('pernocta'))
        ->total->toBe(2)
        ->texto->toBe('2 aeronaves');
});

test('el texto de un renglon de dos lados', function (int $entradas, int $salidas, string $esperado) {
    // `for` y no `range()`: `range(1, 0)` devuelve `[1, 0]`, así que el caso
    // de cero sembraría una fila y la prueba del «No hay movimientos» nunca se
    // cumpliría.
    for ($i = 0; $i < $entradas; $i++) {
        visitanteDeResumen(DIA_DEL_RESUMEN);
    }

    for ($i = 0; $i < $salidas; $i++) {
        visitanteDeResumen(DIA_ANTERIOR, DIA_DEL_RESUMEN);
    }

    expect(renglonDelResumen('visitantes')['texto'])->toBe($esperado);
})->with([
    'ninguno' => [0, 0, 'No hay movimientos'],
    'uno de cada' => [1, 1, '1 entrada y 1 salida'],
    'varios' => [3, 2, '3 entradas y 2 salidas'],
    'solo entradas' => [2, 0, '2 entradas y 0 salidas'],
]);

test('cada modulo usa su propia palabra para la entrada', function () {
    resguardoDeResumen(DIA_DEL_RESUMEN.' 07:00:00');
    operacionDeResumen(DIA_DEL_RESUMEN, 'llegada');

    expect(renglonDelResumen('resguardo_vehicular')['texto'])->toBe('1 ingreso y 0 salidas')
        ->and(renglonDelResumen('operaciones')['texto'])->toBe('1 llegada y 0 salidas');
});

test('el texto de la pernocta distingue ninguna, una y varias', function (int $cuantas, string $esperado) {
    for ($i = 0; $i < $cuantas; $i++) {
        pernoctaDeResumen(DIA_DEL_RESUMEN);
    }

    expect(renglonDelResumen('pernocta')['texto'])->toBe($esperado);
})->with([
    'ninguna' => [0, 'No hay pernoctas'],
    'una' => [1, '1 aeronave'],
    'varias' => [4, '4 aeronaves'],
]);

test('cada renglon lleva su titulo para la pantalla', function () {
    $titulos = collect(ResumenDelDiaSeguridad::para(Carbon::parse(DIA_DEL_RESUMEN)))
        ->pluck('titulo', 'clave')
        ->all();

    expect($titulos)->toBe([
        'aviones_csae' => 'Aviones de CSAE',
        'resguardo_vehicular' => 'Resguardo vehicular',
        'vehiculos' => 'Vehículos',
        'operaciones' => 'Operaciones',
        'visitantes' => 'Visitantes',
        'pernocta' => 'Pernocta del día',
    ]);
});
