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

test('comisariatoPara no crea un proveedor de mas cuando se le da el suyo', function () {
    $proveedor = proveedorComisariato('Comisariato_Otro');

    comisariatoPara('XA-UNO', '2026-10-20', '10:00', ['fact_servicio_id' => $proveedor->id]);

    expect(FactServicio::count())->toBe(1);
});

test('comisariatoPara no crea un usuario de mas cuando se le da el suyo', function () {
    $usuario = User::factory()->create();

    comisariatoPara('XA-UNO', '2026-10-20', '10:00', ['user_id' => $usuario->id]);

    expect(User::count())->toBe(1);
});

test('comisariatoPara respeta un fact_servicio_id nulo explicito y no inventa proveedor', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00', ['fact_servicio_id' => null]);

    expect(FactServicio::count())->toBe(0);
    expect($comisariato->fresh()->fact_servicio_id)->toBeNull();
});

test('trae los comisariatos de la matricula dentro de la ventana', function () {
    $dentro = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    comisariatoPara('XA-UNO', '2026-10-19', '10:00');        // antes de llegar
    comisariatoPara('XA-UNO', '2026-10-22', '10:00');        // despues de salir
    comisariatoPara('XA-OTRA', '2026-10-20', '10:00');       // otra matricula

    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    expect(App\Services\ComisariatosFacturables::candidatas($prefactura)->pluck('id')->all())
        ->toBe([$dentro->id]);
});

test('los bordes de la ventana entran, el minuto de fuera no', function () {
    $justoAlLlegar = comisariatoPara('XA-UNO', '2026-10-20', '08:00');
    $justoAlSalir = comisariatoPara('XA-UNO', '2026-10-21', '08:00');
    comisariatoPara('XA-UNO', '2026-10-21', '08:01');

    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    expect(App\Services\ComisariatosFacturables::candidatas($prefactura)->pluck('id')->all())
        ->toBe([$justoAlLlegar->id, $justoAlSalir->id]);
});

test('una estancia sin salida llega hasta ahora', function () {
    $ayer = comisariatoPara('XA-UNO', now()->subDay()->toDateString(), '10:00');
    comisariatoPara('XA-UNO', now()->addDay()->toDateString(), '10:00');

    $prefactura = prefacturaDe('XA-UNO', now()->subDays(2)->toDateTimeString());

    expect(App\Services\ComisariatosFacturables::candidatas($prefactura)->pluck('id')->all())
        ->toBe([$ayer->id]);
});

test('un comisariato sin proveedor no se puede cobrar y no es candidato', function () {
    comisariatoPara('XA-UNO', '2026-10-20', '10:00', ['fact_servicio_id' => null]);

    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    expect(App\Services\ComisariatosFacturables::candidatas($prefactura))->toBeEmpty();
});

test('un comisariato de importe cero SI es candidato: lo marca la pantalla, no se descarta', function () {
    $gratis = comisariatoPara('XA-UNO', '2026-10-20', '10:00', ['subtotal' => 0, 'total' => 0]);

    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    expect(App\Services\ComisariatosFacturables::candidatas($prefactura)->pluck('id')->all())
        ->toBe([$gratis->id]);
});

test('un comisariato ya cobrado en una prefactura activa deja de ser candidato', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $otra = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $otra->renglones()->create([
        'servicio_id' => $comisariato->fact_servicio_id,
        'servicio_comisariato_id' => $comisariato->id,
        'nombre_servicio' => 'Comisariato_Manny',
        'precio_unitario' => 1000,
        'cantidad' => 1,
        'orden' => 1,
    ]);

    $nueva = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    expect(App\Services\ComisariatosFacturables::candidatas($nueva))->toBeEmpty();
});

test('descartar la prefactura que lo tenia lo libera, sin tocar sus renglones', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $descartada = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $descartada->renglones()->create([
        'servicio_id' => $comisariato->fact_servicio_id,
        'servicio_comisariato_id' => $comisariato->id,
        'nombre_servicio' => 'Comisariato_Manny',
        'precio_unitario' => 1000,
        'cantidad' => 1,
        'orden' => 1,
    ]);
    $descartada->update(['status' => 'N']);

    $nueva = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    expect(App\Services\ComisariatosFacturables::candidatas($nueva)->pluck('id')->all())
        ->toBe([$comisariato->id]);
});

test('lo excluido a mano no vuelve, y el alta a mano revoca la exclusion', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $usuario = User::factory()->create();

    App\Services\ComisariatosFacturables::excluir($prefactura, $comisariato->id, $usuario->id);
    expect(App\Services\ComisariatosFacturables::candidatas($prefactura))->toBeEmpty();

    App\Services\ComisariatosFacturables::revocarExclusion($prefactura, $comisariato->id);
    expect(App\Services\ComisariatosFacturables::candidatas($prefactura)->pluck('id')->all())
        ->toBe([$comisariato->id]);
});

test('excluir dos veces seguidas el mismo comisariato deja UNA fila: es la misma decision', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $usuario = User::factory()->create();

    App\Services\ComisariatosFacturables::excluir($prefactura, $comisariato->id, $usuario->id);
    App\Services\ComisariatosFacturables::excluir($prefactura, $comisariato->id, $usuario->id);

    expect(App\Models\FactPrefacturaComisariatoExcluido::count())->toBe(1);
});

test('el buscador trae todos los de la matricula, marcados', function () {
    $libre = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $sinProveedor = comisariatoPara('XA-UNO', '2026-10-20', '11:00', ['fact_servicio_id' => null]);
    $sinImporte = comisariatoPara('XA-UNO', '2026-10-20', '12:00', ['subtotal' => 0]);

    $enEste = comisariatoPara('XA-UNO', '2026-10-20', '13:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $prefactura->renglones()->create([
        'servicio_id' => $enEste->fact_servicio_id,
        'servicio_comisariato_id' => $enEste->id,
        'nombre_servicio' => 'Comisariato_Manny',
        'precio_unitario' => 1000,
        'cantidad' => 1,
        'orden' => 1,
    ]);

    $porId = App\Services\ComisariatosFacturables::paraElegir('XA-UNO', $prefactura->id)->keyBy('id');

    expect($porId)->toHaveCount(4)
        ->and($porId[$libre->id]->tomado_por)->toBeNull()
        ->and($porId[$libre->id]->en_este_documento)->toBeFalse()
        ->and($porId[$sinProveedor->id]->sin_proveedor)->toBeTrue()
        ->and($porId[$sinImporte->id]->sin_importe)->toBeTrue()
        ->and($porId[$enEste->id]->en_este_documento)->toBeTrue()
        ->and($porId[$enEste->id]->tomado_por)->toBeNull();
});

test('el buscador dice quien lo tiene cuando es OTRO documento', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $otra = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $otra->renglones()->create([
        'servicio_id' => $comisariato->fact_servicio_id,
        'servicio_comisariato_id' => $comisariato->id,
        'nombre_servicio' => 'Comisariato_Manny',
        'precio_unitario' => 1000,
        'cantidad' => 1,
        'orden' => 1,
    ]);

    $otraPrefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $elegibles = App\Services\ComisariatosFacturables::paraElegir('XA-UNO', $otraPrefactura->id)->keyBy('id');

    expect($elegibles[$comisariato->id]->tomado_por)->not->toBeNull()
        ->and($elegibles[$comisariato->id]->en_este_documento)->toBeFalse();
});

test('la matricula se compara sin distinguir mayusculas ni espacios de sobra', function () {
    $comisariato = comisariatoPara('  xa-uno  ', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    expect(App\Services\ComisariatosFacturables::candidatas($prefactura)->pluck('id')->all())
        ->toBe([$comisariato->id]);
});

test('un comisariato cancelado no es candidato ni sale en el buscador', function () {
    $vigente = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    comisariatoPara('XA-UNO', '2026-10-20', '11:00', ['status' => 'N']);

    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    expect(App\Services\ComisariatosFacturables::candidatas($prefactura)->pluck('id')->all())->toBe([$vigente->id])
        ->and(App\Services\ComisariatosFacturables::paraElegir('XA-UNO', $prefactura->id)->pluck('id')->all())->toBe([$vigente->id]);
});
