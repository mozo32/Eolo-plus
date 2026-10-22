<?php

use App\Models\movimientoVehiculo;

/*
 * El endpoint que alimenta el Excel. Es el único que devuelve movimientos de VARIOS
 * vehículos a la vez, y el único que no toca el disco: `obtenerHistorial` llama a
 * Storage::exists por cada imagen para armar URLs que el libro no usa.
 */

/**
 * Un movimiento con lo mínimo obligatorio. `created_at` se pasa aparte porque no está
 * en $fillable y la asignación masiva lo ignoraría.
 */
function movimientoDe(string $vehiculoId, array $extra = []): movimientoVehiculo
{
    $creadoEn = $extra['created_at'] ?? null;
    unset($extra['created_at']);

    $movimiento = movimientoVehiculo::create(array_merge([
        'vehiculo_id' => $vehiculoId,
        'tipo' => 'Salida',
        'chofer' => 'Juan Pérez',
        'kilometraje' => 1000,
        'gasolina' => '1/2',
    ], $extra));

    if ($creadoEn !== null) {
        $movimiento->forceFill(['created_at' => $creadoEn])->save();
    }

    return $movimiento;
}

function consultarExcel(array $parametros): Illuminate\Testing\TestResponse
{
    return test()->getJson('/api/VehiculoEolo/Excel/?' . http_build_query($parametros));
}

beforeEach(function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
});

it('devuelve los movimientos de los vehículos pedidos y de ningún otro', function () {
    vehiculoDePrueba('01-KIA', 'KIA');
    vehiculoDePrueba('TC-84', 'SUBURBAN');
    vehiculoDePrueba('IKON', 'IKON');
    movimientoDe('01-KIA');
    movimientoDe('TC-84');
    movimientoDe('IKON');

    $filas = consultarExcel(['vehiculos' => ['01-KIA', 'TC-84']])->assertOk()->json();

    $economicos = collect($filas)->pluck('numeroEconomico')->sort()->values()->all();
    expect($economicos)->toBe(['01-KIA', 'TC-84']);
});

it('filtra por chofer con coincidencia parcial', function () {
    vehiculoDePrueba('01-KIA', 'KIA');
    movimientoDe('01-KIA', ['chofer' => 'Ana Robles']);
    movimientoDe('01-KIA', ['chofer' => 'Beto Sánchez']);

    $filas = consultarExcel([
        'vehiculos' => ['01-KIA'],
        'chofer' => 'Robl',
    ])->assertOk()->json();

    expect($filas)->toHaveCount(1)
        ->and($filas[0]['chofer'])->toBe('Ana Robles');
});

it('filtra por tipo de movimiento', function () {
    vehiculoDePrueba('01-KIA', 'KIA');
    movimientoDe('01-KIA', ['tipo' => 'Salida']);
    movimientoDe('01-KIA', ['tipo' => 'Entrada']);
    movimientoDe('01-KIA', ['tipo' => 'Entrada']);

    $filas = consultarExcel([
        'vehiculos' => ['01-KIA'],
        'tipo' => 'Entrada',
    ])->assertOk()->json();

    expect($filas)->toHaveCount(2)
        ->and(collect($filas)->pluck('tipo')->unique()->all())->toBe(['Entrada']);
});

it('la fecha de inicio incluye el propio día', function () {
    // El movimiento cae exactamente en el borde: si la comparación fuera estricta, se
    // perdería, y esta prueba es lo único que lo detectaría.
    vehiculoDePrueba('01-KIA', 'KIA');
    movimientoDe('01-KIA', ['created_at' => '2026-03-10 23:59:00', 'kilometraje' => 111]);
    movimientoDe('01-KIA', ['created_at' => '2026-03-09 23:59:00', 'kilometraje' => 222]);

    $filas = consultarExcel([
        'vehiculos' => ['01-KIA'],
        'fecha_inicio' => '2026-03-10',
    ])->assertOk()->json();

    expect(collect($filas)->pluck('kilometraje')->all())->toBe([111]);
});

it('la fecha de fin incluye el propio día', function () {
    vehiculoDePrueba('01-KIA', 'KIA');
    movimientoDe('01-KIA', ['created_at' => '2026-03-10 00:01:00', 'kilometraje' => 111]);
    movimientoDe('01-KIA', ['created_at' => '2026-03-11 00:01:00', 'kilometraje' => 222]);

    $filas = consultarExcel([
        'vehiculos' => ['01-KIA'],
        'fecha_fin' => '2026-03-10',
    ])->assertOk()->json();

    expect(collect($filas)->pluck('kilometraje')->all())->toBe([111]);
});

it('combina el filtro de vehículo con el de fecha', function () {
    // Que cada filtro funcione por separado no garantiza que funcionen juntos.
    vehiculoDePrueba('01-KIA', 'KIA');
    vehiculoDePrueba('TC-84', 'SUBURBAN');
    movimientoDe('01-KIA', ['created_at' => '2026-03-10 10:00:00', 'kilometraje' => 111]);
    movimientoDe('01-KIA', ['created_at' => '2026-05-10 10:00:00', 'kilometraje' => 222]);
    movimientoDe('TC-84', ['created_at' => '2026-03-10 10:00:00', 'kilometraje' => 333]);

    $filas = consultarExcel([
        'vehiculos' => ['01-KIA'],
        'fecha_inicio' => '2026-03-01',
        'fecha_fin' => '2026-03-31',
    ])->assertOk()->json();

    expect(collect($filas)->pluck('kilometraje')->all())->toBe([111]);
});

it('ordena del movimiento más nuevo al más viejo', function () {
    // Se asegura sobre el kilometraje, distinto en cada fila: sobre `tipo` o `chofer`
    // una secuencia simétrica se leería igual del derecho que del revés y la prueba
    // pasaría también con el orden quitado o invertido.
    vehiculoDePrueba('01-KIA', 'KIA');
    movimientoDe('01-KIA', ['created_at' => '2026-03-01 08:00:00', 'kilometraje' => 111]);
    movimientoDe('01-KIA', ['created_at' => '2026-03-03 08:00:00', 'kilometraje' => 333]);
    movimientoDe('01-KIA', ['created_at' => '2026-03-02 08:00:00', 'kilometraje' => 222]);

    $filas = consultarExcel(['vehiculos' => ['01-KIA']])->assertOk()->json();

    expect(collect($filas)->pluck('kilometraje')->all())->toBe([333, 222, 111]);
});

it('un vehículo desactivado se exporta igual', function () {
    // Su bitácora es consultable por diseño; exportar es leer. Es justo lo que alguien
    // "arreglaría" por error más adelante.
    vehiculoDePrueba('EP-16', 'URVAN', 'En Planta', false);
    movimientoDe('EP-16', ['kilometraje' => 777]);

    $filas = consultarExcel(['vehiculos' => ['EP-16']])->assertOk()->json();

    expect(collect($filas)->pluck('kilometraje')->all())->toBe([777]);
});

it('no devuelve imágenes: es el motivo de que este endpoint exista', function () {
    vehiculoDePrueba('01-KIA', 'KIA');
    movimientoDe('01-KIA');

    $fila = consultarExcel(['vehiculos' => ['01-KIA']])->assertOk()->json('0');

    $clavesDeImagen = array_filter(
        array_keys($fila),
        fn (string $clave) => str_contains(strtolower($clave), 'imagen')
            || str_contains(strtolower($clave), 'evidencia')
    );

    expect($clavesDeImagen)->toBe([]);
});

it('cada fila trae las doce columnas del reporte, en orden', function () {
    // El servicio de Excel del cliente lee estas claves por nombre; si cambian aquí,
    // las columnas salen vacías sin que nada falle.
    vehiculoDePrueba('01-KIA', 'KIA');
    movimientoDe('01-KIA');

    $fila = consultarExcel(['vehiculos' => ['01-KIA']])->assertOk()->json('0');

    expect(array_keys($fila))->toBe([
        'vehiculo',
        'numeroEconomico',
        'fechaHora',
        'tipo',
        'chofer',
        'kilometraje',
        'gasolina',
        'destino',
        'autoriza',
        'matricula',
        'motivo',
        'observaciones',
    ]);
});

it('trae el nombre del vehículo, no solo su número económico', function () {
    vehiculoDePrueba('01-KIA', 'KIA');
    movimientoDe('01-KIA');

    $fila = consultarExcel(['vehiculos' => ['01-KIA']])->assertOk()->json('0');

    expect($fila['vehiculo'])->toBe('KIA')
        ->and($fila['numeroEconomico'])->toBe('01-KIA');
});

it('rechaza la petición sin vehículos', function () {
    // Sin esto, un descuido en la pantalla exportaría la flota entera en silencio.
    //
    // Hay UNA sola prueba y no dos porque, sobre una cadena de consulta, «lista vacía»
    // y «parámetro ausente» son indistinguibles: `http_build_query(['vehiculos' => []])`
    // devuelve la cadena vacía. La regla que se dispara en ambos casos es `required`.
    // El `min:1` de la validación es defensa en profundidad para un llamador que no use
    // GET; una cadena de consulta no puede ejercerlo, y una prueba que dijera lo
    // contrario estaría mintiendo.
    consultarExcel([])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('vehiculos');
});

it('rechaza un vehículo que no existe', function () {
    vehiculoDePrueba('01-KIA', 'KIA');

    consultarExcel(['vehiculos' => ['01-KIA', 'NO-EXISTE']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('vehiculos.1');
});

it('una consulta sin resultados devuelve una lista vacía, no un error', function () {
    vehiculoDePrueba('01-KIA', 'KIA');
    movimientoDe('01-KIA', ['chofer' => 'Ana Robles']);

    $filas = consultarExcel([
        'vehiculos' => ['01-KIA'],
        'chofer' => 'Nadie',
    ])->assertOk()->json();

    expect($filas)->toBe([]);
});
