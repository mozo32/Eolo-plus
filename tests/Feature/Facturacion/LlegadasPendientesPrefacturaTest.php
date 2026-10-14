<?php

use App\Http\Controllers\Api\Facturacion\PrefacturaController;
use App\Models\FactConfiguracion;

/**
 * Una prefactura nace cuando una aeronave registra su llegada en Operaciones Diarias.
 * La pantalla de Prefacturas avisa de las llegadas a las que todavía nadie les abrió
 * una: un botón con el número y un panel con la lista.
 *
 * Lo que decide qué cuenta es la FECHA DE CORTE. Sin ella el listado contaría las 1520
 * llegadas que hay desde mayo de 2025 —el rezago histórico, que es otra decisión— y el
 * contador no bajaría a cero nunca. Por eso el corte es obligatorio y, si falta, el
 * listado sale vacío en lugar de salir entero.
 */
function corteDeLlegadas(string $dia): void
{
    FactConfiguracion::updateOrCreate(
        ['clave' => 'prefactura_llegadas_desde'],
        ['valor' => $dia, 'descripcion' => 'Corte de prueba.'],
    );
}

test('una llegada del dia del corte, sin prefactura, sale en los pendientes', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));
    corteDeLlegadas('2026-10-01');
    $llegada = operacionDeLlegada('XA-AAA'); // el ayudante la fecha el 2026-10-01

    $respuesta = $this->getJson('/api/facturacion/prefacturas/llegadas-pendientes')->assertOk();

    expect($respuesta->json('total'))->toBe(1)
        ->and(collect($respuesta->json('data'))->pluck('id')->all())->toBe([$llegada->id]);
});

test('una llegada anterior al corte NO sale: el rezago historico se queda fuera', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));
    corteDeLlegadas('2026-10-01');
    $dentro = operacionDeLlegada('XA-AAA', ['fecha' => '2026-10-01']);
    operacionDeLlegada('XA-BBB', ['fecha' => '2026-09-30']);

    $respuesta = $this->getJson('/api/facturacion/prefacturas/llegadas-pendientes')->assertOk();

    // El dia del corte entra; el anterior, no. El limite es inclusivo a proposito.
    expect($respuesta->json('total'))->toBe(1)
        ->and(collect($respuesta->json('data'))->pluck('id')->all())->toBe([$dentro->id]);
});

test('SIN fecha de corte configurada el listado sale VACIO, no entero', function () {
    // Es la decision de fondo: si alguien borra la clave, la alerta calla. Contar las 1520
    // llegadas historicas seria peor que no avisar, porque el contador no bajaria nunca.
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));
    FactConfiguracion::query()->where('clave', 'prefactura_llegadas_desde')->delete();
    operacionDeLlegada('XA-AAA');

    $respuesta = $this->getJson('/api/facturacion/prefacturas/llegadas-pendientes')->assertOk();

    expect($respuesta->json('total'))->toBe(0)
        ->and($respuesta->json('data'))->toBe([]);
});

test('una llegada que una prefactura ACTIVA ya tomo no sale; si la prefactura se descarta, vuelve', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));
    corteDeLlegadas('2026-10-01');
    $libre = operacionDeLlegada('XA-AAA');
    $enBorrador = operacionDeLlegada('XA-BBB');
    $enCerrada = operacionDeLlegada('XA-CCC');
    $enDescartada = operacionDeLlegada('XA-DDD');

    foreach ([[$enBorrador, 'borrador', 'A'], [$enCerrada, 'cerrada', 'A'], [$enDescartada, 'borrador', 'N']] as [$operacion, $estado, $status]) {
        prefacturaBorrador()->update(['operacion_llegada_id' => $operacion->id, 'estado' => $estado, 'status' => $status]);
    }

    $respuesta = $this->getJson('/api/facturacion/prefacturas/llegadas-pendientes')->assertOk();

    expect(collect($respuesta->json('data'))->pluck('id')->sort()->values()->all())
        ->toBe([$libre->id, $enDescartada->id])
        ->and($respuesta->json('total'))->toBe(2);
});

test('una salida no es una llegada, y una llegada cancelada ya no cuenta', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));
    corteDeLlegadas('2026-10-01');
    $buena = operacionDeLlegada('XA-AAA');
    operacionDeLlegada('XA-BBB', ['tipo' => 'salida']);
    operacionDeLlegada('XA-CCC', ['status' => false]);

    $respuesta = $this->getJson('/api/facturacion/prefacturas/llegadas-pendientes')->assertOk();

    expect(collect($respuesta->json('data'))->pluck('id')->all())->toBe([$buena->id])
        ->and($respuesta->json('total'))->toBe(1);
});

test('el TOTAL cuenta todas aunque la lista venga recortada', function () {
    // El panel solo dibuja un puñado de tarjetas, pero el numero del boton tiene que ser
    // el de verdad: si alguien mueve el corte hacia atras, el usuario debe ver cuanto falta.
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));
    corteDeLlegadas('2026-10-01');

    foreach (range(1, 55) as $i) {
        operacionDeLlegada('XA-'.str_pad((string) $i, 3, '0', STR_PAD_LEFT));
    }

    $respuesta = $this->getJson('/api/facturacion/prefacturas/llegadas-pendientes')->assertOk();

    expect($respuesta->json('total'))->toBe(55)
        ->and($respuesta->json('data'))->toHaveCount(50);
});

test('las mas recientes primero, con la forma exacta que dibuja la tarjeta', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));
    corteDeLlegadas('2026-10-01');
    $vieja = operacionDeLlegada('XA-AAA', ['fecha' => '2026-10-01', 'hora' => '08:00:00']);
    $nueva = operacionDeLlegada('XA-BBB', ['fecha' => '2026-10-03', 'hora' => '07:00:00', 'lugar' => 'KMIA']);
    $media = operacionDeLlegada('XA-CCC', ['fecha' => '2026-10-01', 'hora' => '19:00:00']);

    $respuesta = $this->getJson('/api/facturacion/prefacturas/llegadas-pendientes')->assertOk();

    expect(collect($respuesta->json('data'))->pluck('id')->all())->toBe([$nueva->id, $media->id, $vieja->id])
        ->and(array_keys($respuesta->json('data.0')))->toEqualCanonicalizing(['id', 'matricula', 'fecha', 'hora', 'lugar']);

    expect($respuesta->json('data.0.matricula'))->toBe('XA-BBB')
        ->and($respuesta->json('data.0.hora'))->toBe('07:00:00')
        ->and($respuesta->json('data.0.lugar'))->toBe('KMIA');
});

test('los pendientes son de lectura: sin sesion 401, y cualquier autenticado los ve', function () {
    $this->getJson('/api/facturacion/prefacturas/llegadas-pendientes')->assertUnauthorized();

    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));
    $this->getJson('/api/facturacion/prefacturas/llegadas-pendientes')->assertOk();
});

test('la migracion deja el corte sembrado: la alerta nace hablando, no muda', function () {
    // Sin este sembrado la clave no existiria en produccion y el panel saldria vacio para
    // siempre sin que nadie se diera cuenta: el fallo mas silencioso posible.
    $corte = FactConfiguracion::valor(PrefacturaController::CLAVE_CORTE_LLEGADAS);

    expect($corte)->not->toBeNull()
        ->and($corte)->toMatch('/^\d{4}-\d{2}-\d{2}$/');
});
