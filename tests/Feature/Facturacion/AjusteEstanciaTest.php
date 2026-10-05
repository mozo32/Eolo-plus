<?php

use App\Models\FactServicio;
use App\Services\CargosEstancia;

/**
 * Una aeronave en tránsito con las tres tarifas puestas, para medir la resta.
 *
 * No se llama `aeronaveConTarifas`: ese nombre ya lo declara `TarifasPropiasTest.php` y
 * una función global repetida tumba toda la suite.
 */
function prefacturaConTarifasDeEstancia(string $transito2h, string $transito12h, string $pernocta): App\Models\FactPrefactura
{
    $p = prefacturaBorrador();
    $p->satelite->update([
        'tarifa_transito_2h' => $transito2h,
        'tarifa_transito_12h' => $transito12h,
        'tarifa_pernocta' => $pernocta,
    ]);

    return $p->fresh();
}

/** Los dos servicios de ajuste, con su concepto, como los deja la migración. */
function serviciosDeAjuste(): void
{
    FactServicio::create(['nombre' => 'Ajuste de Estancia_de 2 hrs a 12 hrs', 'precio_unitario' => 0, 'concepto' => FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H]);
    FactServicio::create(['nombre' => 'Ajuste de Estancia_de 12 hrs a pernocta', 'precio_unitario' => 0, 'concepto' => FactServicio::CONCEPTO_ESTANCIA_AJUSTE_12H_PERNOCTA]);
}

/** El servicio de pernocta: los dos tests que lo cobran junto a un ajuste lo necesitan. */
function servicioDePernocta(): void
{
    FactServicio::create(['nombre' => 'Pernocta', 'precio_unitario' => 0, 'concepto' => FactServicio::CONCEPTO_ESTANCIA_PERNOCTA]);
}

test('el ajuste de 2h a 12h cobra la DIFERENCIA de las dos tarifas', function () {
    serviciosDeAjuste();
    $p = prefacturaConTarifasDeEstancia('1000.0000', '1500.0000', '2200.0000');

    $resultado = app(CargosEstancia::class)->recalcular($p, 0, 0, 0, ajustes2a12: 1);

    $renglon = $p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H)->sole();

    expect((string) $renglon->precio_unitario)->toBe('500.0000')
        ->and($renglon->importe())->toBe('500.00')
        ->and($resultado['renglones'])->toBe(1);
});

test('el ajuste de 12h a pernocta cobra su propia diferencia', function () {
    serviciosDeAjuste();
    $p = prefacturaConTarifasDeEstancia('1000.0000', '1500.0000', '2200.0000');

    app(CargosEstancia::class)->recalcular($p, 0, 0, 0, ajustes12aPernocta: 1);

    $renglon = $p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_AJUSTE_12H_PERNOCTA)->sole();

    expect((string) $renglon->precio_unitario)->toBe('700.0000');
});

test('la cantidad multiplica el ajuste, como cualquier renglon', function () {
    serviciosDeAjuste();
    $p = prefacturaConTarifasDeEstancia('1000.0000', '1500.0000', '2200.0000');

    app(CargosEstancia::class)->recalcular($p, 0, 0, 0, ajustes2a12: 3);

    expect($p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H)->sole()->importe())
        ->toBe('1500.00');
});

test('si la diferencia es CERO el ajuste no se cobra, y el motivo lo dice', function () {
    // Es la guarda que el sistema viejo no tenia: cobrar un ajuste de cero es un renglon
    // que no dice nada, y uno negativo es cobrar de menos sin que nada lo explique.
    serviciosDeAjuste();
    $p = prefacturaConTarifasDeEstancia('1500.0000', '1500.0000', '2200.0000');

    $resultado = app(CargosEstancia::class)->recalcular($p, 0, 0, 0, ajustes2a12: 1);

    expect($p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H)->count())->toBe(0)
        ->and($resultado['motivo'])->toContain('de 2 h a 12 h')
        ->and($resultado['motivo'])->toContain('tránsito de 12 horas: 1500.00, tránsito de 2 horas: 1500.00');
});

test('si la diferencia es NEGATIVA tampoco se cobra', function () {
    serviciosDeAjuste();
    // Tarifas invertidas: el tramo de 12 h cuesta menos que el de 2 h.
    $p = prefacturaConTarifasDeEstancia('1500.0000', '1000.0000', '2200.0000');

    $resultado = app(CargosEstancia::class)->recalcular($p, 0, 0, 0, ajustes2a12: 1);

    // Cada nombre junto a SU cifra: las dos tarifas son distintas, así que cruzarlas falla.
    expect($p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H)->count())->toBe(0)
        ->and($resultado['motivo'])->toContain('ajuste de estancia de 2 h a 12 h (cobra la diferencia de dos tarifas y debe salir mayor que cero; tránsito de 12 horas: 1000.00, tránsito de 2 horas: 1500.00)');
});

test('si falta una de las dos tarifas que la resta necesita, el motivo nombra el ajuste', function () {
    serviciosDeAjuste();
    $p = prefacturaBorrador();
    // Sin ninguna tarifa en la matricula ni en su categoria.
    $p->satelite->update(['tarifa_transito_2h' => null, 'tarifa_transito_12h' => null, 'tarifa_pernocta' => null]);

    $resultado = app(CargosEstancia::class)->recalcular($p->fresh(), 0, 0, 0, ajustes2a12: 1);

    expect($p->fresh()->renglones()->count())->toBe(0)
        ->and($resultado['motivo'])->toContain('de 2 h a 12 h')
        ->and($resultado['motivo'])->toContain('tránsito de 12 horas: sin tarifa, tránsito de 2 horas: sin tarifa');
});

test('si falta SOLO una de las dos tarifas, el ajuste no se cobra', function (string $ajuste, array $tarifas) {
    // Sin la guarda de null, una tarifa ausente se resta como cero. Si falta la menor, el ajuste
    // cobraría la otra tarifa completa (el error caro, que «faltan las dos» no distingue); si falta
    // la mayor, sale negativo y solo lo ataja la guarda de signo, así que va con su propia aserción.
    serviciosDeAjuste();
    $p = prefacturaBorrador();
    $p->satelite->update($tarifas);

    $resultado = app(CargosEstancia::class)->recalcular($p->fresh(), 0, 0, 0, ...[$ajuste => 1]);

    expect($p->fresh()->renglones()->count())->toBe(0)
        ->and($resultado['motivo'])->toContain('sin tarifa');
})->with([
    'de 2 h a 12 h sin tarifa de 2 h' => ['ajustes2a12', ['tarifa_transito_2h' => null, 'tarifa_transito_12h' => '1500.0000', 'tarifa_pernocta' => '2200.0000']],
    'de 12 h a pernocta sin tarifa de 12 h' => ['ajustes12aPernocta', ['tarifa_transito_2h' => '1000.0000', 'tarifa_transito_12h' => null, 'tarifa_pernocta' => '2200.0000']],
    'de 2 h a 12 h sin tarifa de 12 h' => ['ajustes2a12', ['tarifa_transito_2h' => '1000.0000', 'tarifa_transito_12h' => null, 'tarifa_pernocta' => '2200.0000']],
    'de 12 h a pernocta sin tarifa de pernocta' => ['ajustes12aPernocta', ['tarifa_transito_2h' => '1000.0000', 'tarifa_transito_12h' => '1500.0000', 'tarifa_pernocta' => null]],
]);

test('el motivo del ajuste de 12h a pernocta nombra SUS dos tarifas', function () {
    serviciosDeAjuste();
    // Pernocta más barata que el tramo de 12 h: diferencia negativa y cifras distintas.
    $p = prefacturaConTarifasDeEstancia('900.0000', '1500.0000', '1000.0000');

    $resultado = app(CargosEstancia::class)->recalcular($p, 0, 0, 0, ajustes12aPernocta: 1);

    expect($resultado['motivo'])->toContain('ajuste de estancia de 12 h a pernocta (cobra la diferencia de dos tarifas y debe salir mayor que cero; pernocta: 1000.00, tránsito de 12 horas: 1500.00)');
});

test('una cantidad de ajuste negativa en el servicio se rechaza', function () {
    $p = prefacturaBorrador();

    expect(fn () => app(CargosEstancia::class)->recalcular($p, 0, 0, 0, ajustes12aPernocta: -1))
        ->toThrow(InvalidArgumentException::class);
});

test('una tarifa que falta NO impide que se cobre el resto', function () {
    // El recalculo continua: media estancia cobrada es mejor que ninguna, y el motivo avisa.
    serviciosDeAjuste();
    servicioDePernocta();
    $p = prefacturaBorrador();
    $p->satelite->update(['tarifa_pernocta' => '2200.0000', 'tarifa_transito_2h' => null, 'tarifa_transito_12h' => null]);

    $resultado = app(CargosEstancia::class)->recalcular($p->fresh(), 1, 0, 0, ajustes2a12: 1);

    expect($p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->count())->toBe(1)
        ->and($resultado['motivo'])->toContain('ajuste de estancia de 2 h a 12 h');
});

test('recalcular REEMPLAZA el ajuste previo y no lo duplica', function () {
    serviciosDeAjuste();
    $p = prefacturaConTarifasDeEstancia('1000.0000', '1500.0000', '2200.0000');
    $cargos = app(CargosEstancia::class);

    $cargos->recalcular($p, 0, 0, 0, ajustes2a12: 1);
    $cargos->recalcular($p->fresh(), 0, 0, 0, ajustes2a12: 2);

    $renglones = $p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H)->get();

    expect($renglones)->toHaveCount(1)
        ->and($renglones->first()->cantidad)->toBe(2);
});

test('la cortesia de un ajuste se CONSERVA al recalcular', function () {
    serviciosDeAjuste();
    $p = prefacturaConTarifasDeEstancia('1000.0000', '1500.0000', '2200.0000');
    $cargos = app(CargosEstancia::class);

    $cargos->recalcular($p, 0, 0, 0, ajustes2a12: 1);
    $p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H)->sole()->update(['es_cortesia' => true]);

    $resultado = $cargos->recalcular($p->fresh(), 0, 0, 0, ajustes2a12: 2);

    $renglon = $p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H)->sole();

    expect($renglon->es_cortesia)->toBeTrue()
        ->and($renglon->importe())->toBe('0.00')
        ->and($resultado['motivo'])->toContain('de 2 h a 12 h');
});

test('una cortesia de ajuste que se PIERDE tambien se avisa', function () {
    // Es el camino que llama a etiquetaDe() iterando CONCEPTOS_ESTANCIA: con el match sin
    // default, este es el caso que reventaria si no se extendiera.
    serviciosDeAjuste();
    $p = prefacturaConTarifasDeEstancia('1000.0000', '1500.0000', '2200.0000');
    $cargos = app(CargosEstancia::class);

    $cargos->recalcular($p, 0, 0, 0, ajustes2a12: 1);
    $p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H)->sole()->update(['es_cortesia' => true]);

    // Cantidad 0: el renglon no se recrea, asi que la cortesia se pierde.
    $resultado = $cargos->recalcular($p->fresh(), 0, 0, 0, ajustes2a12: 0);

    expect($p->fresh()->renglones()->count())->toBe(0)
        ->and($resultado['motivo'])->toContain('de 2 h a 12 h');
});

test('los dos conceptos de ajuste NO se pueden agregar a mano', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    serviciosDeAjuste();
    $p = prefacturaBorrador();
    $servicio = FactServicio::porConcepto(FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H)->sole();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
    ])->assertStatus(422)->assertJsonValidationErrorFor('servicio_id');
});

test('el endpoint acepta las dos cantidades nuevas y son opcionales', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    serviciosDeAjuste();
    servicioDePernocta();
    $p = prefacturaConTarifasDeEstancia('1000.0000', '1500.0000', '2200.0000');

    // Sin los campos nuevos: sigue funcionando como antes del bloque 5.
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/estancia", [
        'pernoctas' => 1, 'transitos_2h' => 0, 'transitos_12h' => 0,
    ])->assertOk();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/estancia", [
        'pernoctas' => 0, 'transitos_2h' => 0, 'transitos_12h' => 0,
        'ajustes_2h_12h' => 1, 'ajustes_12h_pernocta' => 1,
    ])->assertOk();

    $renglones = $p->fresh()->renglones;

    // Diferencias distintas (500 y 700): confundir un ajuste con el otro cambiaría estos precios.
    expect($renglones)->toHaveCount(2)
        ->and((string) $renglones->firstWhere('concepto', FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H)->precio_unitario)->toBe('500.0000')
        ->and((string) $renglones->firstWhere('concepto', FactServicio::CONCEPTO_ESTANCIA_AJUSTE_12H_PERNOCTA)->precio_unitario)->toBe('700.0000');
});

test('una cantidad de ajuste negativa se rechaza con su mensaje en espanol', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/estancia", [
        'pernoctas' => 0, 'transitos_2h' => 0, 'transitos_12h' => 0, 'ajustes_2h_12h' => -1,
    ])->assertStatus(422)->assertJsonValidationErrors(['ajustes_2h_12h' => 'La cantidad de los ajustes de 2 h a 12 h no puede ser negativa.']);
});
