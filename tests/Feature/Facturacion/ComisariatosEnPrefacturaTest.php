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
    comisariatoPara('XA-UNO', '2026-10-21', '08:01');         // un minuto despues de salir
    comisariatoPara('XA-UNO', '2026-10-20', '07:59');         // un minuto antes de llegar, el MISMO dia

    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    expect(App\Services\ComisariatosFacturables::candidatas($prefactura)->pluck('id')->all())
        ->toBe([$justoAlLlegar->id, $justoAlSalir->id]);
});

test('una estancia sin salida NO tiene tope: entra tambien lo capturado con hora futura', function () {
    // Antes el tope era `now()`, y eso escondia un caso real: Trafico captura un servicio a las
    // 18:00 cuando el reloj aun va por la mañana, y no aparecia en la prefactura hasta que
    // pasaban las 18:00. Mientras la estancia siga abierta no hay tope; lo cierra la salida.
    $ayer = comisariatoPara('XA-UNO', now()->subDay()->toDateString(), '10:00');
    $manana = comisariatoPara('XA-UNO', now()->addDay()->toDateString(), '10:00');

    $prefactura = prefacturaDe('XA-UNO', now()->subDays(2)->toDateTimeString());

    expect(App\Services\ComisariatosFacturables::candidatas($prefactura)->pluck('id')->all())
        ->toBe([$ayer->id, $manana->id]);
});

test('registrar la salida SI pone tope: lo entregado despues deja de entrar', function () {
    $dentro = comisariatoPara('XA-UNO', now()->subDay()->toDateString(), '10:00');
    comisariatoPara('XA-UNO', now()->addDay()->toDateString(), '10:00');

    $prefactura = prefacturaDe('XA-UNO', now()->subDays(2)->toDateTimeString(), now()->toDateTimeString());

    expect(App\Services\ComisariatosFacturables::candidatas($prefactura)->pluck('id')->all())
        ->toBe([$dentro->id]);
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
        ->and($porId[$libre->id]->sin_proveedor)->toBeFalse()
        ->and($porId[$libre->id]->sin_importe)->toBeFalse()
        ->and($porId[$sinProveedor->id]->sin_proveedor)->toBeTrue()
        ->and($porId[$sinProveedor->id]->sin_importe)->toBeFalse()
        ->and($porId[$sinImporte->id]->sin_importe)->toBeTrue()
        ->and($porId[$sinImporte->id]->sin_proveedor)->toBeFalse()
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

test('la exclusion es de ESTA prefactura: otro documento de la misma matricula lo sigue trayendo', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $prefacturaA = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $prefacturaB = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $usuario = User::factory()->create();

    App\Services\ComisariatosFacturables::excluir($prefacturaA, $comisariato->id, $usuario->id);

    expect(App\Services\ComisariatosFacturables::candidatas($prefacturaA))->toBeEmpty()
        ->and(App\Services\ComisariatosFacturables::candidatas($prefacturaB)->pluck('id')->all())
        ->toBe([$comisariato->id]);
});

test('revocar la exclusion de una prefactura no toca la que otra prefactura tiene del mismo comisariato', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $prefacturaA = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $prefacturaB = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $usuario = User::factory()->create();

    App\Services\ComisariatosFacturables::excluir($prefacturaA, $comisariato->id, $usuario->id);
    App\Services\ComisariatosFacturables::excluir($prefacturaB, $comisariato->id, $usuario->id);

    App\Services\ComisariatosFacturables::revocarExclusion($prefacturaA, $comisariato->id);

    expect(App\Services\ComisariatosFacturables::candidatas($prefacturaA)->pluck('id')->all())->toBe([$comisariato->id])
        ->and(App\Services\ComisariatosFacturables::candidatas($prefacturaB))->toBeEmpty();
});

test('las candidatas salen ordenadas por momento, no por orden de captura', function () {
    // Los ids van a proposito DESORDENADOS respecto al momento: si no, un `orderBy` ausente
    // pasaria por casualidad porque la base devuelve por id.
    $tardeDelPrimerDia = comisariatoPara('XA-UNO', '2026-10-20', '15:00');
    $segundoDia = comisariatoPara('XA-UNO', '2026-10-21', '08:00');
    $tempranoDelPrimerDia = comisariatoPara('XA-UNO', '2026-10-20', '09:00');

    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    expect(App\Services\ComisariatosFacturables::candidatas($prefactura)->pluck('id')->all())
        ->toBe([$tempranoDelPrimerDia->id, $tardeDelPrimerDia->id, $segundoDia->id]);
});

test('el buscador saca primero el mas reciente', function () {
    $tardeDelPrimerDia = comisariatoPara('XA-UNO', '2026-10-20', '15:00');
    $segundoDia = comisariatoPara('XA-UNO', '2026-10-21', '08:00');
    $tempranoDelPrimerDia = comisariatoPara('XA-UNO', '2026-10-20', '09:00');

    expect(App\Services\ComisariatosFacturables::paraElegir('XA-UNO')->pluck('id')->all())
        ->toBe([$segundoDia->id, $tardeDelPrimerDia->id, $tempranoDelPrimerDia->id]);
});

test('una salida anterior a la llegada no trae nada: la ventana no se da la vuelta', function () {
    // `Carbon::betweenIncluded` intercambia los extremos si van al reves, asi que sin el guard
    // de `candidatas()` esta ventana invertida devolveria lo que cae ENTRE las 08:00 y las 10:00.
    comisariatoPara('XA-UNO', '2026-10-20', '09:00');

    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 10:00:00', '2026-10-20 08:00:00');

    expect(App\Services\ComisariatosFacturables::candidatas($prefactura))->toBeEmpty();
});

test('el renglon de un comisariato toma el margen y el ajuste DEL SERVICIO, no ceros', function () {
    // Un proveedor de relleno ANTES, para que el id del proveedor y el del comisariato difieran:
    // si valen los dos 1, confundir uno con otro no lo nota ninguna asercion.
    proveedorComisariato('Comisariato_Relleno');
    $proveedor = proveedorComisariato('Comisariato_Manny', 50, FactServicio::AJUSTE_MAS_5);
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00', [
        'fact_servicio_id' => $proveedor->id,
        'subtotal' => 1000,
    ]);
    expect($proveedor->id)->not->toBe($comisariato->id);
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/comisariatos/sincronizar")
        ->assertOk()
        ->assertJsonPath('agregados', 1);

    $renglon = $prefactura->renglones()->whereNotNull('servicio_comisariato_id')->sole();

    // Lo contrario que en combustible, y a proposito: aqui el margen ES el negocio.
    expect((float) $renglon->margen)->toBe(50.0)
        ->and($renglon->ajuste_precio)->toBe(FactServicio::AJUSTE_MAS_5)
        ->and($renglon->es_de_tercero)->toBeTrue()
        ->and((float) $renglon->precio_unitario)->toBe(1000.0)
        ->and($renglon->cantidad)->toBe(1)
        ->and($renglon->servicio_comisariato_id)->toBe($comisariato->id)
        ->and($renglon->servicio_id)->toBe($proveedor->id);
});

test('un proveedor al 0 por ciento (Comexa) no lleva margen ni es de tercero', function () {
    proveedorComisariato('Comisariato_Relleno');
    $comexa = proveedorComisariato('Comisariato_Comexa', 0);
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00', ['fact_servicio_id' => $comexa->id]);
    expect($comexa->id)->not->toBe($comisariato->id);
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/comisariatos/sincronizar")->assertOk();

    $renglon = $prefactura->renglones()->whereNotNull('servicio_comisariato_id')->sole();

    expect((float) $renglon->margen)->toBe(0.0)
        ->and($renglon->es_de_tercero)->toBeFalse()
        ->and($renglon->servicio_id)->toBe($comexa->id)
        ->and($renglon->nombre_servicio)->toBe('Comisariato_Comexa');
});

test('sincronizar dos veces no duplica nada', function () {
    comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $ruta = "/api/facturacion/prefacturas/{$prefactura->id}/comisariatos/sincronizar";
    $this->postJson($ruta)->assertOk()->assertJsonPath('agregados', 1);
    $this->postJson($ruta)->assertOk()->assertJsonPath('agregados', 0);

    expect($prefactura->renglones()->whereNotNull('servicio_comisariato_id')->count())->toBe(1);
});

test('los renglones nuevos siguen el orden de los que ya habia y entre ellos', function () {
    $primero = comisariatoPara('XA-UNO', '2026-10-20', '09:00');
    $segundo = comisariatoPara('XA-UNO', '2026-10-20', '15:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $prefactura->renglones()->create([
        'servicio_id' => $primero->fact_servicio_id,
        'nombre_servicio' => 'Previo',
        'precio_unitario' => 1,
        'cantidad' => 1,
        'orden' => 7,
    ]);

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/comisariatos/sincronizar")
        ->assertOk()
        ->assertJsonPath('agregados', 2);

    $renglones = $prefactura->renglones()->whereNotNull('servicio_comisariato_id')->reorder('orden')->get();

    expect($renglones->pluck('servicio_comisariato_id')->all())->toBe([$primero->id, $segundo->id])
        ->and($renglones->pluck('orden')->all())->toBe([8, 9]);
});

test('sincronizar deja una linea en la bitacora solo cuando agrego algo', function () {
    comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $ruta = "/api/facturacion/prefacturas/{$prefactura->id}/comisariatos/sincronizar";
    $this->postJson($ruta)->assertOk();
    $this->postJson($ruta)->assertOk();

    $entradas = App\Models\Bitacora::query()
        ->where('modulo', App\Models\Bitacora::MODULO_FACTURACION_PREFACTURAS)
        ->where('registro_id', $prefactura->id)
        ->where('descripcion', 'like', '%comisariatos%')
        ->count();

    expect($entradas)->toBe(1);
});

test('una prefactura cerrada, descartada o reabierta no sincroniza', function (string $campo, string $valor, string $codigo) {
    comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $prefactura->update([$campo => $valor]);

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/comisariatos/sincronizar")
        ->assertStatus(409)
        ->assertJsonPath('codigo', $codigo);

    expect($prefactura->renglones()->count())->toBe(0);
})->with([
    'cerrada' => ['estado', FactPrefactura::ESTADO_CERRADA, 'ya_cerrada'],
    'reabierta' => ['estado', FactPrefactura::ESTADO_REABIERTA, 'reabierta'],
    'descartada' => ['status', 'N', 'ya_descartada'],
]);

test('sin el permiso de prefacturas no se sincroniza', function () {
    comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factCatalogo', 'Facturacion'));

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/comisariatos/sincronizar")->assertForbidden();

    expect($prefactura->renglones()->count())->toBe(0);
});

test('una prefactura sin llegada sincroniza con normalidad y no trae nada', function () {
    // `llegada_at` es nullable y la pantalla sincroniza en cada carga: un 500 aqui se veria cada
    // vez que alguien abriera el documento. `candidatas()` devuelve una coleccion pelada en esta
    // salida temprana, asi que lo que se haga con ella no puede suponer un Eloquent\Collection.
    comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $prefactura->update(['llegada_at' => null]);

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/comisariatos/sincronizar")
        ->assertOk()
        ->assertJsonPath('agregados', 0);

    expect($prefactura->renglones()->count())->toBe(0);
});

test('si otra sesion cambia la prefactura entre el chequeo rapido y el candado, el candado rechaza', function (array $cambio, int $estatus, string $codigo) {
    comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    // La PRIMERA lectura (la del `findOrFail`, que pasa el chequeo rapido) ve el borrador tal cual;
    // justo despues otra sesion lo cambia por debajo, y la SEGUNDA lectura (la de `bloquear()`,
    // ya dentro de la transaccion) ve el estado nuevo. Es la carrera que el candado existe para cerrar.
    $lecturas = 0;
    Illuminate\Support\Facades\Event::listen(
        'eloquent.retrieved: '.FactPrefactura::class,
        function () use (&$lecturas, $prefactura, $cambio) {
            if (++$lecturas === 1) {
                Illuminate\Support\Facades\DB::table('fact_prefacturas')->where('id', $prefactura->id)->update($cambio);
            }
        },
    );

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/comisariatos/sincronizar")
        ->assertStatus($estatus)
        ->assertJsonPath('codigo', $codigo);

    expect($lecturas)->toBeGreaterThanOrEqual(2)
        ->and($prefactura->renglones()->count())->toBe(0);
})->with([
    'descartada' => [['status' => 'N'], 409, 'ya_descartada'],
    'reabierta' => [['estado' => FactPrefactura::ESTADO_REABIERTA], 409, 'reabierta'],
    'cerrada' => [['estado' => FactPrefactura::ESTADO_CERRADA], 409, 'ya_cerrada'],
]);

test('el alta a mano guarda el comisariato elegido con el margen de su servicio', function () {
    $proveedor = proveedorComisariato('Comisariato_Manny', 50, FactServicio::AJUSTE_MAS_5);
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00', ['fact_servicio_id' => $proveedor->id]);
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $proveedor->id,
        'cantidad' => 1,
        'servicio_comisariato_id' => $comisariato->id,
    ])->assertCreated();

    $renglon = $prefactura->renglones()->sole();

    // Identico a lo que habria puesto la via automatica: un solo sitio lo decide.
    expect($renglon->servicio_comisariato_id)->toBe($comisariato->id)
        ->and((float) $renglon->margen)->toBe(50.0)
        ->and($renglon->ajuste_precio)->toBe(FactServicio::AJUSTE_MAS_5);
});

test('el alta a mano rechaza un comisariato de OTRA matricula', function () {
    $ajeno = comisariatoPara('XA-OTRA', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $ajeno->fact_servicio_id,
        'cantidad' => 1,
        'servicio_comisariato_id' => $ajeno->id,
    ])->assertStatus(422)->assertJsonValidationErrors('servicio_comisariato_id');
});

test('el alta a mano rechaza un comisariato sin proveedor', function () {
    $sinProveedor = comisariatoPara('XA-UNO', '2026-10-20', '10:00', ['fact_servicio_id' => null]);
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $otroServicio = proveedorComisariato('Comisariato_Comexa', 0);

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $otroServicio->id,
        'cantidad' => 1,
        'servicio_comisariato_id' => $sinProveedor->id,
    ])->assertStatus(422)->assertJsonValidationErrors('servicio_comisariato_id');
});

test('el mismo comisariato no se cobra dos veces en el mismo documento', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $carga = [
        'servicio_id' => $comisariato->fact_servicio_id,
        'cantidad' => 1,
        'servicio_comisariato_id' => $comisariato->id,
    ];

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", $carga)->assertCreated();
    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", $carga)->assertStatus(422);

    expect($prefactura->renglones()->count())->toBe(1);
});

test('quitar un renglon de comisariato lo excluye, y volver a ponerlo a mano revoca la exclusion', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $sincronizar = "/api/facturacion/prefacturas/{$prefactura->id}/comisariatos/sincronizar";
    $this->postJson($sincronizar)->assertOk()->assertJsonPath('agregados', 1);

    $renglon = $prefactura->renglones()->sole();
    $this->deleteJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones/{$renglon->id}")->assertOk();

    // No vuelve solo.
    $this->postJson($sincronizar)->assertOk()->assertJsonPath('agregados', 0);

    // Pero a mano si, y eso revoca la exclusion.
    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $comisariato->fact_servicio_id,
        'cantidad' => 1,
        'servicio_comisariato_id' => $comisariato->id,
    ])->assertCreated();

    expect(App\Models\FactPrefacturaComisariatoExcluido::count())->toBe(0);
});

test('el buscador devuelve los comisariatos de la matricula con sus marcas', function () {
    comisariatoPara('XA-UNO', '2026-10-20', '10:00', ['forma_pago' => 'Efectivo']);
    comisariatoPara('XA-OTRA', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $datos = $this->getJson("/api/facturacion/prefacturas/{$prefactura->id}/comisariatos")
        ->assertOk()
        ->json();

    expect($datos)->toHaveCount(1)
        ->and(array_keys($datos[0]))->toBe([
            'id', 'fecha_entrega', 'hora_entrega', 'subtotal', 'forma_pago',
            'proveedor', 'tomado_por', 'en_este_documento', 'sin_proveedor', 'sin_importe',
        ])
        ->and($datos[0]['forma_pago'])->toBe('Efectivo');
});

test('el alta a mano compara la matricula igual que la via automatica: sin mayusculas ni espacios de sobra', function () {
    $comisariato = comisariatoPara(' xa-uno ', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $comisariato->fact_servicio_id,
        'cantidad' => 1,
        'servicio_comisariato_id' => $comisariato->id,
    ])->assertCreated();
});

test('el alta a mano rechaza un comisariato dado de baja', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00', ['status' => 'I']);
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $comisariato->fact_servicio_id,
        'cantidad' => 1,
        'servicio_comisariato_id' => $comisariato->id,
    ])->assertStatus(422)->assertJsonValidationErrors('servicio_comisariato_id');

    expect($prefactura->renglones()->count())->toBe(0);
});

/*
 * AQUI DIFIERE DEL HERMANO, y a proposito. En remisiones «tomada» tiene DOS fuentes y una de ellas
 * (`status_prefactura = 1`, puesta a mano desde Rampa) puede no tener renglon detras: elegirla es
 * el rescate de un error. En comisariatos «tomado» es UNA sola cosa: existe un renglon vivo en una
 * prefactura activa. Asi que `tomado_por` distinto de null es siempre dinero ya cobrandose, y
 * elegirlo seria cobrar dos veces la misma entrega. Para moverlo se quita primero del otro
 * documento, y entonces queda libre.
 */
test('un comisariato tomado por OTRO documento NO se puede elegir a mano: aqui tomado es siempre dinero cobrandose', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $otra = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $carga = [
        'servicio_id' => $comisariato->fact_servicio_id,
        'cantidad' => 1,
        'servicio_comisariato_id' => $comisariato->id,
    ];

    $this->postJson("/api/facturacion/prefacturas/{$otra->id}/renglones", $carga)->assertCreated();
    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", $carga)
        ->assertStatus(422)
        ->assertJsonValidationErrors('servicio_comisariato_id');

    expect($prefactura->renglones()->count())->toBe(0)
        ->and(App\Models\FactPrefacturaRenglon::where('servicio_comisariato_id', $comisariato->id)->count())->toBe(1);

    // El camino honesto: quitarlo del otro documento lo libera, y entonces si se puede.
    $this->deleteJson("/api/facturacion/prefacturas/{$otra->id}/renglones/{$otra->renglones()->sole()->id}")->assertOk();
    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", $carga)->assertCreated();

    expect($prefactura->renglones()->count())->toBe(1);
});

test('un comisariato de una prefactura descartada si se puede elegir a mano: ya no se esta cobrando', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $descartada = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $carga = [
        'servicio_id' => $comisariato->fact_servicio_id,
        'cantidad' => 1,
        'servicio_comisariato_id' => $comisariato->id,
    ];

    $this->postJson("/api/facturacion/prefacturas/{$descartada->id}/renglones", $carga)->assertCreated();
    $descartada->update(['status' => 'N']);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", $carga)->assertCreated();
});

test('el alta a mano pone el importe del comisariato y lo ordena al final', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00', ['subtotal' => 1234.5]);
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $prefactura->renglones()->create([
        'servicio_id' => $comisariato->fact_servicio_id,
        'nombre_servicio' => 'Previo',
        'precio_unitario' => 1,
        'cantidad' => 1,
        'orden' => 7,
    ]);

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $comisariato->fact_servicio_id,
        'cantidad' => 5,
        'servicio_comisariato_id' => $comisariato->id,
    ])->assertCreated();

    $renglon = $prefactura->renglones()->where('servicio_comisariato_id', $comisariato->id)->sole();

    // La cantidad que mande la peticion no cuenta: un comisariato es una entrega.
    expect((float) $renglon->precio_unitario)->toBe(1234.5)
        ->and($renglon->cantidad)->toBe(1)
        ->and($renglon->orden)->toBe(8);
});

test('el buscador marca lo tomado, lo propio, lo que no tiene proveedor y lo que no tiene importe', function () {
    $proveedor = proveedorComisariato('Comisariato_Manny');
    $libre = comisariatoPara('XA-UNO', '2026-10-20', '10:00', ['fact_servicio_id' => $proveedor->id]);
    $sinProveedor = comisariatoPara('XA-UNO', '2026-10-20', '11:00', ['fact_servicio_id' => null]);
    $sinImporte = comisariatoPara('XA-UNO', '2026-10-20', '12:00', ['fact_servicio_id' => $proveedor->id, 'subtotal' => 0]);
    $propio = comisariatoPara('XA-UNO', '2026-10-20', '13:00', ['fact_servicio_id' => $proveedor->id]);
    $deOtro = comisariatoPara('XA-UNO', '2026-10-20', '14:00', ['fact_servicio_id' => $proveedor->id]);
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $otra = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", ['servicio_id' => $proveedor->id, 'cantidad' => 1, 'servicio_comisariato_id' => $propio->id])->assertCreated();
    $this->postJson("/api/facturacion/prefacturas/{$otra->id}/renglones", ['servicio_id' => $proveedor->id, 'cantidad' => 1, 'servicio_comisariato_id' => $deOtro->id])->assertCreated();

    $porId = collect($this->getJson("/api/facturacion/prefacturas/{$prefactura->id}/comisariatos")->assertOk()->json())->keyBy('id');

    expect($porId[$libre->id])->toMatchArray(['proveedor' => 'Comisariato_Manny', 'tomado_por' => null, 'en_este_documento' => false, 'sin_proveedor' => false, 'sin_importe' => false])
        ->and($porId[$sinProveedor->id])->toMatchArray(['proveedor' => null, 'sin_proveedor' => true])
        ->and($porId[$sinImporte->id]['sin_importe'])->toBeTrue()
        ->and($porId[$propio->id])->toMatchArray(['en_este_documento' => true, 'tomado_por' => null])
        ->and($porId[$deOtro->id]['en_este_documento'])->toBeFalse()
        ->and($porId[$deOtro->id]['tomado_por'])->toBe("borrador #{$otra->id}");
});

test('dos altas simultaneas del mismo comisariato no lo cobran dos veces: el chequeo va bajo el candado', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    // Se simula al rival que llega JUSTO cuando la peticion toma el candado: su renglon se inserta
    // en la lectura de `bloquear()`, que es la unica hecha dentro de la transaccion de la peticion
    // (nivel mayor que el inicial). Insertarlo antes lo veria tambien un chequeo situado fuera de
    // la transaccion, y la prueba no distinguiria las dos posiciones. Se identifica por el nivel y
    // no contando lecturas, porque cuantas haga el FormRequest no es cosa de esta prueba.
    $nivelInicial = Illuminate\Support\Facades\DB::transactionLevel();
    $rivalInsertado = false;

    Illuminate\Support\Facades\Event::listen(
        'eloquent.retrieved: '.FactPrefactura::class,
        function () use (&$rivalInsertado, $nivelInicial, $prefactura, $comisariato) {
            if ($rivalInsertado || Illuminate\Support\Facades\DB::transactionLevel() <= $nivelInicial) {
                return;
            }

            $rivalInsertado = true;

            $prefactura->renglones()->create(
                App\Services\RenglonDeComisariato::atributos($comisariato->load('factServicio'), 1),
            );
        },
    );

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $comisariato->fact_servicio_id,
        'cantidad' => 1,
        'servicio_comisariato_id' => $comisariato->id,
    ])->assertStatus(422)->assertJsonValidationErrors('servicio_comisariato_id');

    expect($rivalInsertado)->toBeTrue()
        ->and($prefactura->renglones()->count())->toBe(1);
});

test('el alta a mano de un comisariato toma el servicio del comisariato aunque llegue otro servicio_id', function () {
    $proveedor = proveedorComisariato('Comisariato_Manny', 50, FactServicio::AJUSTE_MAS_5);
    $otro = proveedorComisariato('Comisariato_Comexa', 0);
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00', ['fact_servicio_id' => $proveedor->id]);
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    // Deliberado: el renglon sale entero de datos del servidor, asi que un `servicio_id` distinto
    // no mueve dinero. Rechazarlo solo cazaria errores del front a cambio de un 422 irrelevante.
    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $otro->id,
        'cantidad' => 1,
        'servicio_comisariato_id' => $comisariato->id,
    ])->assertCreated();

    $renglon = $prefactura->renglones()->sole();

    expect($renglon->servicio_id)->toBe($proveedor->id)
        ->and($renglon->nombre_servicio)->toBe('Comisariato_Manny')
        ->and((float) $renglon->margen)->toBe(50.0);
});

test('el buscador devuelve los valores del comisariato: el subtotal, no el total, y fecha y hora en su formato', function () {
    $proveedor = proveedorComisariato('Comisariato_Manny');
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:30', [
        'fact_servicio_id' => $proveedor->id,
        'subtotal' => 1000,
        'total' => 1160,
    ]);
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $fila = $this->getJson("/api/facturacion/prefacturas/{$prefactura->id}/comisariatos")->assertOk()->json(0);

    expect($fila['id'])->toBe($comisariato->id)
        ->and($fila['subtotal'])->toBe('1000.00')
        ->and($fila['fecha_entrega'])->toBe('2026-10-20')
        ->and($fila['hora_entrega'])->toBe('10:30')
        ->and($fila['proveedor'])->toBe('Comisariato_Manny');
});

test('la ficha enseña la forma de pago del comisariato tal como esta escrita, y null en los demas renglones', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00', ['forma_pago' => 'G']);
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $prefactura->renglones()->create([
        'servicio_id' => $comisariato->fact_servicio_id,
        'servicio_comisariato_id' => $comisariato->id,
        'nombre_servicio' => 'Comisariato_Manny',
        'precio_unitario' => 1000,
        'cantidad' => 1,
        'orden' => 1,
    ]);
    $prefactura->renglones()->create([
        'servicio_id' => $comisariato->fact_servicio_id,
        'nombre_servicio' => 'Suelto',
        'precio_unitario' => 10,
        'cantidad' => 1,
        'orden' => 2,
    ]);

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $renglones = $this->getJson("/api/facturacion/prefacturas/{$prefactura->id}")->assertOk()->json('prefactura.renglones');

    // Sin interpretar: «G» llega como «G», no como «cargo a la matrícula» ni como nada.
    expect($renglones[0]['servicio_comisariato_id'])->toBe($comisariato->id)
        ->and($renglones[0]['forma_pago_comisariato'])->toBe('G')
        ->and($renglones[1]['servicio_comisariato_id'])->toBeNull()
        ->and($renglones[1]['forma_pago_comisariato'])->toBeNull();
});

test('un comisariato de XA AMI (con espacio) se puede agregar a mano a una prefactura de XA-AMI', function () {
    $comisariato = comisariatoPara('XA AMI', '2026-10-20', '10:00', ['subtotal' => 25]);
    $prefactura = prefacturaDe('XA-AMI', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $comisariato->fact_servicio_id,
        'cantidad' => 1,
        'servicio_comisariato_id' => $comisariato->id,
    ])->assertCreated();

    expect((float) $prefactura->renglones()->sole()->precio_unitario)->toBe(25.0);
});

test('la tolerancia del guion es solo del alta a mano: la sincronizacion sigue emparejando por texto exacto', function () {
    comisariatoPara('XA AMI', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-AMI', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/comisariatos/sincronizar")
        ->assertOk()
        ->assertJsonPath('agregados', 0);
});

test('el alta a mano sigue rechazando una matricula de verdad distinta aunque se parezca', function (string $deComisariato) {
    $comisariato = comisariatoPara($deComisariato, '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-AMI', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $comisariato->fact_servicio_id,
        'cantidad' => 1,
        'servicio_comisariato_id' => $comisariato->id,
    ])->assertStatus(422)->assertJsonValidationErrors('servicio_comisariato_id');

    expect($prefactura->renglones()->count())->toBe(0);
})->with([
    'otra letra' => ['XA AMJ'],
    'otra aeronave' => ['XB-SYJ'],
    'un caracter de mas' => ['XA-AMII'],
]);

test('las dos vias producen renglones identicos campo por campo', function () {
    $proveedor = proveedorComisariato('Comisariato_Manny', 50, FactServicio::AJUSTE_MAS_5);
    $porSincronizar = comisariatoPara('XA-UNO', '2026-10-20', '10:00', ['fact_servicio_id' => $proveedor->id, 'subtotal' => 1234.5]);
    $aMano = comisariatoPara('XA-DOS', '2026-10-20', '10:00', ['fact_servicio_id' => $proveedor->id, 'subtotal' => 1234.5]);
    $deSincronizar = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $deMano = prefacturaDe('XA-DOS', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson("/api/facturacion/prefacturas/{$deSincronizar->id}/comisariatos/sincronizar")->assertOk()->assertJsonPath('agregados', 1);
    // Con una cantidad distinta de 1 a proposito: la peticion no la decide.
    $this->postJson("/api/facturacion/prefacturas/{$deMano->id}/renglones", [
        'servicio_id' => $proveedor->id,
        'cantidad' => 5,
        'servicio_comisariato_id' => $aMano->id,
    ])->assertCreated();

    // Todo el renglon, menos lo que por naturaleza es distinto en dos filas: su identidad, su
    // documento, el comisariato al que apunta y las marcas de tiempo. Si una via pusiera una
    // columna que la otra no, o a la inversa, la comparacion lo haria ruido.
    $sinIdentidad = fn (App\Models\FactPrefacturaRenglon $r) => collect($r->fresh()->getAttributes())
        ->except(['id', 'prefactura_id', 'servicio_comisariato_id', 'created_at', 'updated_at'])
        ->all();

    $a = $sinIdentidad($deSincronizar->renglones()->sole());
    $b = $sinIdentidad($deMano->renglones()->sole());

    expect($porSincronizar->id)->not->toBe($aMano->id)
        ->and($a)->toBe($b)
        ->and($a)->toHaveKeys(['servicio_id', 'nombre_servicio', 'precio_unitario', 'cantidad', 'es_de_tercero', 'margen', 'ajuste_precio', 'orden'])
        ->and((float) $a['margen'])->toBe(50.0)
        ->and((bool) $a['es_de_tercero'])->toBeTrue()
        ->and($a['ajuste_precio'])->toBe(FactServicio::AJUSTE_MAS_5)
        ->and($a['nombre_servicio'])->toBe('Comisariato_Manny');
});

test('el 409 de la sincronizacion de comisariatos habla de comisariatos, no de remisiones', function () {
    comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $prefactura->update(['estado' => FactPrefactura::ESTADO_REABIERTA]);

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $mensaje = $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/comisariatos/sincronizar")
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'reabierta')
        ->json('message');

    expect($mensaje)->toContain('comisariatos')->not->toContain('remisiones');
});

test('paraElegir trae el proveedor de cada comisariato ya cargado, venga la lista llena o vacia', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00');

    $llena = App\Services\ComisariatosFacturables::paraElegir('XA-UNO');
    $vacia = App\Services\ComisariatosFacturables::paraElegir('XA-NADA');

    expect($llena)->toHaveCount(1)
        ->and($llena->first()->id)->toBe($comisariato->id)
        ->and($llena->first()->relationLoaded('factServicio'))->toBeTrue()
        ->and($vacia)->toBeInstanceOf(Illuminate\Database\Eloquent\Collection::class)
        ->and($vacia)->toBeEmpty();
});
