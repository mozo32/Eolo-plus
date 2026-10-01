<?php

// tests/Feature/Facturacion/CargosEstanciaTest.php

use App\Models\FactAeronave;
use App\Models\FactCategoriaAeronave;
use App\Models\FactPrefactura;
use App\Models\FactPrefacturaRenglon;
use App\Models\FactServicio;
use App\Services\CargosEstancia;
use App\Services\RenglonDePrefacturaCerradaException;
use Illuminate\Support\Facades\DB;

/*
 * `conEstancia()` NO SE DECLARA EN ESTE ARCHIVO. Ya existe en `tests/Pest.php`,
 * creada por la Task 3, porque la Task 6 tambien la usa; declararla otra vez
 * revienta con un error fatal de redeclaracion. Su firma:
 *
 *   conEstancia(string $estatus = FactAeronave::ESTATUS_TRANSITO): FactPrefactura
 *
 * Crea los tres servicios de estancia con su `concepto`, una matricula con estatus
 * `$estatus` y las tres tarifas (pernocta 4676.00, transito 2 h 1144.50, transito
 * 12 h 2338.00), y devuelve un borrador nacional sobre esa matricula. Si necesitas
 * leer su cuerpo, esta en `tests/Pest.php`.
 */

test('la estancia usa la tarifa de la matricula, no el precio del catalogo', function () {
    $p = conEstancia();

    app(CargosEstancia::class)->recalcular($p, pernoctas: 2, transitos2h: 0, transitos12h: 0);

    $renglon = $p->fresh()->renglones()->sole();

    expect((float) $renglon->precio_unitario)->toBe(4676.00)
        ->and($renglon->importe())->toBe('9352.00')
        ->and($renglon->concepto)->toBe(FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);
});

test('los tres conceptos se cobran por separado', function () {
    $p = conEstancia();

    app(CargosEstancia::class)->recalcular($p, pernoctas: 1, transitos2h: 1, transitos12h: 1);

    expect($p->fresh()->renglones()->count())->toBe(3)
        ->and($p->fresh()->subtotal())->toBe('8158.50');
});

test('una cantidad en cero no genera renglon', function () {
    $p = conEstancia();

    app(CargosEstancia::class)->recalcular($p, pernoctas: 0, transitos2h: 3, transitos12h: 0);

    expect($p->fresh()->renglones()->count())->toBe(1);
});

test('una aeronave en Guarda no paga estancia y se dice por que', function () {
    $p = conEstancia(FactAeronave::ESTATUS_GUARDA);

    $resultado = app(CargosEstancia::class)->recalcular($p, pernoctas: 5, transitos2h: 5, transitos12h: 5);

    expect($p->fresh()->renglones()->count())->toBe(0)
        ->and($resultado['renglones'])->toBe(0)
        ->and($resultado['motivo'])->toContain('Guarda');
});

test('recalcular reemplaza los renglones de estancia y no toca los capturados a mano', function () {
    $p = conEstancia();
    $otro = FactServicio::create(['nombre' => 'Comisariato', 'precio_unitario' => 500.0]);
    $p->renglones()->create([
        'servicio_id' => $otro->id, 'nombre_servicio' => 'Comisariato', 'precio_unitario' => 500.0,
        'cantidad' => 1, 'es_de_tercero' => false, 'margen' => 0, 'ajuste_precio' => 'ninguno', 'orden' => 9,
    ]);

    app(CargosEstancia::class)->recalcular($p, pernoctas: 1, transitos2h: 0, transitos12h: 0);
    app(CargosEstancia::class)->recalcular($p->fresh(), pernoctas: 3, transitos2h: 0, transitos12h: 0);

    $p = $p->fresh();

    expect($p->renglones()->count())->toBe(2)
        ->and($p->renglones()->whereNull('concepto')->sole()->nombre_servicio)->toBe('Comisariato')
        ->and($p->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->sole()->cantidad)->toBe(3);
});

test('el renglon de estancia congela la tarifa aunque la matricula cambie despues', function () {
    $p = conEstancia();
    app(CargosEstancia::class)->recalcular($p, pernoctas: 1, transitos2h: 0, transitos12h: 0);

    $p->satelite->update(['tarifa_pernocta' => 9999.00]);

    expect((float) $p->fresh()->renglones()->sole()->precio_unitario)->toBe(4676.00);
});

test('el paquete internacional agrega las cuatro con el precio del catalogo', function () {
    $p = conEstancia();
    foreach ([['DSMES - salida', 4060.50], ['DSM - salida', 348.0], ['Mex-eAPI - salida', 900.0], ['Servicios Internacionales - salida', 750.0]] as [$nombre, $precio]) {
        FactServicio::create(['nombre' => $nombre, 'precio_unitario' => $precio, 'en_paquete_internacional' => true]);
    }

    $agregados = app(CargosEstancia::class)->agregarPaqueteInternacional($p);

    expect($agregados)->toBe(4)
        ->and($p->fresh()->subtotal())->toBe('6058.50');
});

test('el paquete internacional no se duplica si ya esta', function () {
    $p = conEstancia();
    FactServicio::create(['nombre' => 'DSMES - salida', 'precio_unitario' => 4060.50, 'en_paquete_internacional' => true]);

    app(CargosEstancia::class)->agregarPaqueteInternacional($p);
    app(CargosEstancia::class)->agregarPaqueteInternacional($p->fresh());

    expect($p->fresh()->renglones()->count())->toBe(1);
});

/*
 * La guarda del servicio. El borrado masivo de `recalcular()` no dispara los
 * eventos del modelo del renglon, asi que la guarda de `FactPrefacturaRenglon` no
 * lo ve: lo protege el propio servicio, con candado y estado leido de la base.
 */

test('recalcular no toca una prefactura cerrada y sus renglones de estancia sobreviven', function () {
    $p = conEstancia();
    app(CargosEstancia::class)->recalcular($p, pernoctas: 2, transitos2h: 0, transitos12h: 0);
    cerrarConSello($p->fresh(), '9352.00', '1496.32', '10848.32');

    expect(fn () => app(CargosEstancia::class)->recalcular($p->fresh(), pernoctas: 7, transitos2h: 1, transitos12h: 1))
        ->toThrow(RenglonDePrefacturaCerradaException::class);

    $renglon = $p->fresh()->renglones()->sole();

    expect($renglon->cantidad)->toBe(2)
        ->and($p->fresh()->selloDiscrepa())->toBeFalse();
});

test('recalcular rechaza una prefactura cerrada aunque la instancia en memoria diga borrador', function () {
    $p = conEstancia();
    app(CargosEstancia::class)->recalcular($p, pernoctas: 2, transitos2h: 0, transitos12h: 0);

    // La instancia `$p` sigue creyendo que es borrador; la base ya la tiene cerrada.
    expect($p->estaCerrada())->toBeFalse();
    cerrarConSello(FactPrefactura::find($p->id), '9352.00', '1496.32', '10848.32');
    expect($p->estaCerrada())->toBeFalse();

    expect(fn () => app(CargosEstancia::class)->recalcular($p, pernoctas: 0, transitos2h: 0, transitos12h: 0))
        ->toThrow(RenglonDePrefacturaCerradaException::class)
        ->and(FactPrefacturaRenglon::count())->toBe(1);
});

test('una cerrada en Guarda tambien se rechaza antes de decidir nada', function () {
    $p = conEstancia(FactAeronave::ESTATUS_GUARDA);
    cerrarConSello($p->fresh(), '0.00', '0.00', '0.00');

    expect(fn () => app(CargosEstancia::class)->recalcular($p, pernoctas: 1, transitos2h: 0, transitos12h: 0))
        ->toThrow(RenglonDePrefacturaCerradaException::class);
});

test('el paquete internacional no agrega nada a una prefactura cerrada', function () {
    $p = conEstancia();
    FactServicio::create(['nombre' => 'DSMES - salida', 'precio_unitario' => 4060.50, 'en_paquete_internacional' => true]);
    cerrarConSello(FactPrefactura::find($p->id), '0.00', '0.00', '0.00');

    expect(fn () => app(CargosEstancia::class)->agregarPaqueteInternacional($p))
        ->toThrow(RenglonDePrefacturaCerradaException::class)
        ->and(FactPrefacturaRenglon::count())->toBe(0);
});

test('la comprobacion de cerrada va despues de leer la prefactura con candado, dentro de la transaccion', function () {
    $p = conEstancia();
    DB::enableQueryLog();
    DB::flushQueryLog();

    app(CargosEstancia::class)->recalcular($p, pernoctas: 1, transitos2h: 0, transitos12h: 0);

    $consultas = array_column(DB::getQueryLog(), 'query');
    $lecturaDePrefactura = collect($consultas)->search(fn ($q) => str_starts_with($q, 'select') && str_contains($q, 'from "fact_prefacturas"'));
    $borrado = collect($consultas)->search(fn ($q) => str_starts_with($q, 'delete from "fact_prefactura_renglones"'));

    expect($lecturaDePrefactura)->not->toBeFalse()
        ->and($borrado)->not->toBeFalse()
        ->and($lecturaDePrefactura)->toBeLessThan($borrado);
});

test('si falta el servicio de estancia, nada queda a medias', function () {
    $p = conEstancia();
    app(CargosEstancia::class)->recalcular($p, pernoctas: 1, transitos2h: 0, transitos12h: 0);

    FactServicio::porConcepto(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H)->update(['concepto' => null]);

    expect(fn () => app(CargosEstancia::class)->recalcular($p->fresh(), pernoctas: 4, transitos2h: 1, transitos12h: 0))
        ->toThrow(RuntimeException::class);

    // El borrado de los de estancia se revirtio: sigue el renglon de antes.
    expect($p->fresh()->renglones()->sole()->cantidad)->toBe(1);
});

test('el estatus se lee fresco: una instancia con la ficha en Transito no cobra si la base ya dice Guarda', function () {
    $p = conEstancia();
    $p->satelite; // se cachea la relacion con estatus Transito
    FactAeronave::where('aeronave_id', $p->aeronave_id)->update(['estatus' => FactAeronave::ESTATUS_GUARDA]);

    $resultado = app(CargosEstancia::class)->recalcular($p, pernoctas: 1, transitos2h: 0, transitos12h: 0);

    expect($resultado['renglones'])->toBe(0)
        ->and($resultado['motivo'])->toContain('Guarda');
});

test('la tarifa se hereda de la categoria si la matricula no tiene propia', function () {
    $p = conEstancia();
    $categoria = FactCategoriaAeronave::create([
        'nombre' => 'Categoria de prueba', 'tarifa_pernocta' => 1500.25, 'tarifa_transito_2h' => 300.10, 'tarifa_transito_12h' => 800.00,
    ]);
    FactAeronave::where('aeronave_id', $p->aeronave_id)->update([
        'categoria_aeronave_id' => $categoria->id, 'tarifa_pernocta' => null,
    ]);

    app(CargosEstancia::class)->recalcular($p, pernoctas: 1, transitos2h: 0, transitos12h: 0);

    expect($p->fresh()->renglones()->sole()->precio_unitario)->toBe('1500.2500');
});

test('sin tarifa en la matricula ni en la categoria no se cobra y se dice por que', function () {
    $p = conEstancia();
    FactAeronave::where('aeronave_id', $p->aeronave_id)->update(['tarifa_pernocta' => null]);

    $resultado = app(CargosEstancia::class)->recalcular($p, pernoctas: 1, transitos2h: 1, transitos12h: 0);

    expect($resultado['renglones'])->toBe(1)
        ->and($resultado['motivo'])->toContain('pernocta')
        ->and($p->fresh()->renglones()->sole()->concepto)->toBe(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H);
});

test('todas las cantidades en cero tambien explican por que no hay renglones', function () {
    $p = conEstancia();

    $resultado = app(CargosEstancia::class)->recalcular($p, pernoctas: 0, transitos2h: 0, transitos12h: 0);

    expect($resultado['renglones'])->toBe(0)
        ->and($resultado['motivo'])->not->toBeNull();
});

test('una cantidad negativa se rechaza', function () {
    $p = conEstancia();

    expect(fn () => app(CargosEstancia::class)->recalcular($p, pernoctas: -1, transitos2h: 0, transitos12h: 0))
        ->toThrow(InvalidArgumentException::class);
});

test('un renglon de estancia recalculado conserva su posicion', function () {
    $p = conEstancia();
    app(CargosEstancia::class)->recalcular($p, pernoctas: 1, transitos2h: 1, transitos12h: 0);
    $ordenes = $p->fresh()->renglones()->pluck('orden', 'concepto')->all();

    app(CargosEstancia::class)->recalcular($p->fresh(), pernoctas: 2, transitos2h: 2, transitos12h: 0);

    expect($p->fresh()->renglones()->pluck('orden', 'concepto')->all())->toBe($ordenes);
});

test('el precio de la estancia se congela con sus cuatro decimales, sin pasar por float', function () {
    $p = conEstancia();
    FactAeronave::where('aeronave_id', $p->aeronave_id)->update(['tarifa_pernocta' => 4676.10]);

    app(CargosEstancia::class)->recalcular($p, pernoctas: 1, transitos2h: 0, transitos12h: 0);

    expect($p->fresh()->renglones()->sole()->precio_unitario)->toBe('4676.1000');
});
