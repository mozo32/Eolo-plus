<?php
// tests/Feature/Facturacion/ServicioTest.php

use App\Models\FactCategoriaServicio;
use App\Models\FactServicio;

/*
 * Las fórmulas salen de `altaserv.php` del sistema viejo y deben reproducirse
 * exactas: el ajuste se aplica al precio unitario ANTES del margen y de la
 * cantidad.
 */

function servicio(array $extra = []): FactServicio
{
    return FactServicio::create(array_merge([
        'categoria_servicio_id' => FactCategoriaServicio::create(['nombre' => 'Cat '.uniqid()])->id,
        'nombre' => 'Servicio '.uniqid(),
        'precio_unitario' => 1000,
    ], $extra));
}

test('un servicio propio cobra su precio por la cantidad', function () {
    $s = servicio(['precio_unitario' => 1500.50]);

    expect($s->importe(1500.50, 2))->toBe('3001.00');
});

test('un servicio de tercero suma su margen', function () {
    // altaserv.php: $sub = ($Precio * 50) / 100; $Total = ($sub + $Precio) * $Cantidad
    $s = servicio(['es_de_tercero' => true, 'margen' => 50]);

    expect($s->importe(1000, 1))->toBe('1500.00')
        ->and($s->importe(1000, 3))->toBe('4500.00');
});

test('el ajuste mas_5 multiplica por 1.05 antes del margen', function () {
    // altaserv.php servicio 106: $Precio = ($Precio * 1.05)
    $s = servicio(['es_de_tercero' => true, 'margen' => 50, 'ajuste_precio' => 'mas_5']);

    // 1000 * 1.05 = 1050 ; 1050 + 50% = 1575
    expect($s->importe(1000, 1))->toBe('1575.00');
});

test('el ajuste sin_iva divide entre 1.16 antes del margen', function () {
    // altaserv.php servicio 107: $Precio = ($Precio / 1.16)
    $s = servicio(['es_de_tercero' => true, 'margen' => 50, 'ajuste_precio' => 'sin_iva']);

    // 1160 / 1.16 = 1000 ; 1000 + 50% = 1500
    expect($s->importe(1160, 1))->toBe('1500.00');
});

test('el ajuste comision_131 aplica la formula del servicio 113', function () {
    // altaserv.php servicio 113:
    //   $Precio1 = $Precio / 1.31; $Precio = ($Precio1 * .15) + $Precio1
    $s = servicio(['ajuste_precio' => 'comision_131']);

    // 1310 / 1.31 = 1000 ; 1000 * 0.15 + 1000 = 1150
    expect($s->importe(1310, 1))->toBe('1150.00');
});

test('el 113 real es de tercero con margen 50: el ajuste va antes del margen', function () {
    // Comisariato_Fly Across: id > 93 (recargo de tercero, 50%) y ajuste del 113.
    $s = servicio(['es_de_tercero' => true, 'margen' => 50, 'ajuste_precio' => 'comision_131']);

    // 1310 / 1.31 = 1000 ; 1000 * .15 + 1000 = 1150 ; 1150 + 50% = 1725
    expect($s->importe(1310, 1))->toBe('1725.00');
});

test('un ajuste desconocido lanza en vez de cobrar sin ajuste', function () {
    // Un typo ('mas5' por 'mas_5') no debe cobrar el servicio 106 sin su 5%.
    $s = servicio(['ajuste_precio' => 'mas5']);

    expect(fn () => $s->importe(1000, 1))
        ->toThrow(UnexpectedValueException::class, 'mas5');
});

test('un modelo recien creado, con ajuste_precio null en memoria, cobra sin ajuste', function () {
    // El default de la base ('ninguno') no se carga en el modelo sin fresh().
    $s = servicio();

    expect($s->ajuste_precio)->toBeNull()
        ->and($s->importe(1000, 1))->toBe('1000.00')
        ->and($s->fresh()->importe(1000, 1))->toBe('1000.00');
});

test('un precio en cero es valido y da importe cero', function () {
    // Los 15 servicios de tercero del origen tienen precio_u = 0: se teclea al capturar.
    $s = servicio(['precio_unitario' => 0, 'es_de_tercero' => true, 'margen' => 50]);

    expect($s->importe(0, 3))->toBe('0.00');
});

/*
 * LIMITACION: las pruebas corren en sqlite en memoria, que guarda 26.064 como
 * REAL sin importar si la columna es decimal(10,4) o decimal(10,2). Por eso esta
 * prueba NO garantiza la escala de `precio_unitario` en la base: solo fija el
 * cast `decimal:4` del modelo (con `decimal:2` fallaria). La garantia de los
 * cuatro decimales es `decimal('precio_unitario', 10, 4)` en la migracion
 * (MySQL, que si la aplica); si se toca, verificarlo a mano contra MySQL.
 */
test('el cast del modelo conserva cuatro decimales en el precio', function () {
    // Combustible JET A-1 vale 26.0640 y Limpieza exterior 2105.8601.
    $jet = servicio(['precio_unitario' => 26.0640]);
    $limpieza = servicio(['precio_unitario' => 2105.8601]);

    expect((float) $jet->fresh()->precio_unitario)->toBe(26.0640)
        ->and($jet->fresh()->precio_unitario)->toBe('26.0640')
        ->and((float) $limpieza->fresh()->precio_unitario)->toBe(2105.8601)
        ->and($limpieza->fresh()->precio_unitario)->toBe('2105.8601');
});

test('un servicio puede no tener categoria', function () {
    // Los 5 con id_categorias = 0 del origen: Handling, Slot MMTO, los dos de
    // ajuste de estancia y Participación Aeroportuaria.
    $s = FactServicio::create(['nombre' => 'Handling', 'precio_unitario' => 1]);

    expect($s->fresh()->categoria_servicio_id)->toBeNull()
        ->and($s->fresh()->categoria)->toBeNull();
});

test('el scope activos excluye los dados de baja', function () {
    servicio(['nombre' => 'Vivo']);
    servicio(['nombre' => 'De baja', 'status' => 'N']);

    expect(FactServicio::activos()->pluck('nombre')->all())->toBe(['Vivo']);
});
