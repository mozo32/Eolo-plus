<?php

use App\Models\Aeronave;
use App\Models\FactCategoriaServicio;
use App\Models\FactPrefactura;
use App\Models\FactPrefacturaComisariatoExcluido;
use App\Models\FactServicio;
use App\Models\ServicioComisariato;
use App\Models\User;

/** Un proveedor de comisariato del catalogo, con el margen que de verdad llevan. */
function proveedorComisariato(string $nombre = 'Comisariato_Manny', float $margen = 50, string $ajuste = FactServicio::AJUSTE_NINGUNO): FactServicio
{
    $categoria = FactCategoriaServicio::firstOrCreate(['nombre' => 'Comisariatos'], ['status' => 'A']);

    return FactServicio::create([
        'categoria_servicio_id' => $categoria->id,
        'nombre' => $nombre,
        'precio_unitario' => 0,
        'es_de_tercero' => $margen > 0,
        'margen' => $margen,
        'ajuste_precio' => $ajuste,
        'status' => 'A',
    ]);
}

/**
 * Un comisariato entregado. Solo `user_id`, `fecha_entrega` y `hora_entrega` son obligatorios.
 *
 * El proveedor y el usuario por omisión se crean SOLO si `$cambios` no trae los suyos: si no,
 * cada llamada dejaria filas que nadie pidio y las pruebas que cuentan servicios fallarian.
 */
function comisariatoPara(string $matricula, string $fecha, string $hora, array $cambios = []): ServicioComisariato
{
    return ServicioComisariato::create(array_merge([
        'user_id' => array_key_exists('user_id', $cambios) ? null : User::factory()->create()->id,
        'matricula' => $matricula,
        'fecha_entrega' => $fecha,
        'hora_entrega' => $hora,
        'fact_servicio_id' => array_key_exists('fact_servicio_id', $cambios) ? null : proveedorComisariato()->id,
        'forma_pago' => 'Cargo a la matrícula',
        'subtotal' => 1000,
        'total' => 1160,
        'status' => 'A',
    ], $cambios));
}

/** Una prefactura en borrador de esa matricula, con su ventana de estancia. */
function prefacturaDe(string $matricula, string $llegada, ?string $salida = null): FactPrefactura
{
    $aeronave = Aeronave::firstOrCreate(['matricula' => $matricula]);

    return FactPrefactura::create([
        'aeronave_id' => $aeronave->id,
        'llegada_at' => $llegada,
        'salida_at' => $salida,
        'estado' => FactPrefactura::ESTADO_BORRADOR,
        'user_id' => User::factory()->create()->id,
        'status' => 'A',
    ]);
}

test('un renglon puede apuntar al comisariato que lo origino', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00');

    $renglon = $prefactura->renglones()->create([
        'servicio_id' => $comisariato->fact_servicio_id,
        'servicio_comisariato_id' => $comisariato->id,
        'nombre_servicio' => 'Comisariato_Manny',
        'precio_unitario' => 1000,
        'cantidad' => 1,
        'orden' => 1,
    ]);

    expect($renglon->fresh()->servicio_comisariato_id)->toBe($comisariato->id)
        ->and($renglon->fresh()->servicioComisariato->matricula)->toBe('XA-UNO');
});

test('la exclusion es unica por la pareja de prefactura y comisariato', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00');
    $usuario = User::factory()->create();

    FactPrefacturaComisariatoExcluido::create([
        'prefactura_id' => $prefactura->id,
        'servicio_comisariato_id' => $comisariato->id,
        'user_id' => $usuario->id,
    ]);

    expect(fn () => FactPrefacturaComisariatoExcluido::create([
        'prefactura_id' => $prefactura->id,
        'servicio_comisariato_id' => $comisariato->id,
        'user_id' => $usuario->id,
    ]))->toThrow(Illuminate\Database\QueryException::class);
});

test('comisariatoPara no crea proveedor ni usuario de mas cuando se los das', function () {
    $proveedor = proveedorComisariato('Comisariato_Otro');
    $usuario = User::factory()->create();

    comisariatoPara('XA-UNO', '2026-10-20', '10:00', [
        'fact_servicio_id' => $proveedor->id,
        'user_id' => $usuario->id,
    ]);

    expect(FactServicio::count())->toBe(1)
        ->and(User::count())->toBe(1);
});
