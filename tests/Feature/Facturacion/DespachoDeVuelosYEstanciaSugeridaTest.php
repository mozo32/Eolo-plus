<?php

use App\Models\Aeronave;
use App\Models\FactAeronave;
use App\Models\FactPrefactura;
use App\Models\FactServicio;

/**
 * Dos correcciones que pidió el departamento después de ver el módulo funcionando.
 *
 * 1. «Despacho de Vuelos» no es un servicio internacional, aunque estaba en la lista que se
 *    describió al principio. Tiene su propia regla: se cobra cuando la aeronave tiene marcada
 *    la casilla «Cobra derecho de vuelos» en su ficha, y entonces se cobra SIEMPRE, sea el
 *    vuelo nacional o internacional. Esto explica lo que ya se había medido y no se supo leer:
 *    el servicio aparece en el 53% de los folios puramente nacionales.
 *
 * 2. La estancia tenía que calcularse sola y no lo parecía, porque el cálculo se disparaba al
 *    guardar la cabecera y el operador usa el botón «Estancia y ajustes», que seguía pidiendo
 *    las cantidades a mano. Ahora hay un endpoint de solo lectura que las propone desde las
 *    fechas, para que el formulario se abra relleno.
 */
function aeronaveConDerechoDeVuelos(bool $cobra): Aeronave
{
    $aeronave = Aeronave::create(['matricula' => matriculaDePrueba()]);
    FactAeronave::create([
        'aeronave_id' => $aeronave->id,
        'estatus' => FactAeronave::ESTATUS_TRANSITO,
        'cobra_derecho_vuelos' => $cobra,
    ]);

    return $aeronave;
}

function servicioDespachoDeVuelos(): FactServicio
{
    return FactServicio::create(['nombre' => 'Despacho de Vuelos', 'precio_unitario' => 900]);
}

function crearBorradorDe(Aeronave $aeronave): array
{
    return test()->postJson('/api/facturacion/prefacturas', [
        'aeronave_id' => $aeronave->id,
        'tipo_destino' => FactPrefactura::DESTINO_NACIONAL,
    ])->assertCreated()->json();
}

test('una aeronave que cobra derecho de vuelos recibe Despacho de Vuelos al crear el borrador', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $servicio = servicioDespachoDeVuelos();
    $aeronave = aeronaveConDerechoDeVuelos(true);

    crearBorradorDe($aeronave);

    // Se lee la columna, no la respuesta: es lo unico que prueba que el renglon existe.
    $prefactura = FactPrefactura::latest('id')->first();
    expect($prefactura->renglones()->pluck('servicio_id')->all())->toBe([$servicio->id])
        ->and((float) $prefactura->renglones()->first()->precio_unitario)->toBe(900.0)
        ->and($prefactura->renglones()->first()->cantidad)->toBe(1);
});

test('una aeronave que NO cobra derecho de vuelos no recibe nada', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDespachoDeVuelos();
    $aeronave = aeronaveConDerechoDeVuelos(false);

    crearBorradorDe($aeronave);

    expect(FactPrefactura::latest('id')->first()->renglones()->count())->toBe(0);
});

test('el derecho de vuelos no depende de que el vuelo sea internacional', function () {
    // La regla es la casilla de la ficha, no el destino. Por eso el servicio aparecia en el
    // 53% de los folios puramente nacionales del historico.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $servicio = servicioDespachoDeVuelos();
    $aeronave = aeronaveConDerechoDeVuelos(true);

    crearBorradorDe($aeronave);

    expect(FactPrefactura::latest('id')->first()->tipo_destino)->toBe(FactPrefactura::DESTINO_NACIONAL)
        ->and(FactPrefactura::latest('id')->first()->renglones()->pluck('servicio_id')->all())->toBe([$servicio->id]);
});

test('si el servicio Despacho de Vuelos no esta en el catalogo, el borrador se crea igual', function () {
    // Un catalogo incompleto no puede impedir abrir un borrador: eso dejaria al operador sin
    // poder trabajar por una fila que falta en otra pantalla.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $aeronave = aeronaveConDerechoDeVuelos(true);

    crearBorradorDe($aeronave);

    expect(FactPrefactura::latest('id')->first())->not->toBeNull()
        ->and(FactPrefactura::latest('id')->first()->renglones()->count())->toBe(0);
});

test('un servicio Despacho de Vuelos dado de baja no se cobra', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDespachoDeVuelos()->update(['status' => FactServicio::STATUS_INACTIVO]);
    $aeronave = aeronaveConDerechoDeVuelos(true);

    crearBorradorDe($aeronave);

    expect(FactPrefactura::latest('id')->first()->renglones()->count())->toBe(0);
});

test('la estancia sugerida sale de las fechas de la prefactura', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $p->update(['llegada_at' => '2026-10-15 12:00:00', 'salida_at' => '2026-10-22 20:15:00']);

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/estancia-sugerida")
        ->assertOk()
        // 7 dias y 8:15 -> 7 pernoctas y 1 transito de 12 h, la misma regla de CalculadoraEstancia.
        ->assertJson(['pernoctas' => 7, 'transitos_2h' => 0, 'transitos_12h' => 1]);
});

test('sin las dos fechas la sugerencia es cero, y dice por que', function (?string $llegada, ?string $salida) {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $p->update(['llegada_at' => $llegada, 'salida_at' => $salida]);

    $respuesta = $this->getJson("/api/facturacion/prefacturas/{$p->id}/estancia-sugerida")->assertOk();

    expect($respuesta->json('pernoctas'))->toBe(0)
        ->and($respuesta->json('transitos_2h'))->toBe(0)
        ->and($respuesta->json('transitos_12h'))->toBe(0)
        ->and($respuesta->json('motivo'))->not->toBeNull();
})->with([
    'sin salida' => ['2026-10-15 12:00:00', null],
    'sin llegada' => [null, '2026-10-22 12:00:00'],
    'sin ninguna' => [null, null],
]);

test('con las dos fechas no hay motivo que explicar', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $p->update(['llegada_at' => '2026-10-15 12:00:00', 'salida_at' => '2026-10-16 12:00:00']);

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/estancia-sugerida")
        ->assertOk()
        ->assertJson(['pernoctas' => 1, 'motivo' => null]);
});

test('la estancia sugerida es de LECTURA: no escribe ningun renglon', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $p->update(['llegada_at' => '2026-10-15 12:00:00', 'salida_at' => '2026-10-22 12:00:00']);

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/estancia-sugerida")->assertOk();

    expect($p->fresh()->renglones()->count())->toBe(0);
});

test('la estancia sugerida exige sesion', function () {
    $p = prefacturaBorrador();

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/estancia-sugerida")->assertUnauthorized();
});
