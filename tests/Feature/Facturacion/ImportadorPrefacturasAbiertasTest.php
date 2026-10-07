<?php

// tests/Feature/Facturacion/ImportadorPrefacturasAbiertasTest.php

use App\Models\Aeronave;
use App\Models\FactAeronave;
use App\Models\FactCliente;
use App\Models\FactPrefactura;
use App\Models\FactProveedor;
use App\Models\FactServicio;
use App\Models\User;
use App\Services\ImportadorPrefacturasAbiertas;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Las prefacturas ABIERTAS del sistema viejo (`tb_prefcatura`), que el importador de
 * catálogos no trae. Igual que en `ImportadorCatalogosTest`, la conexión `remota` está
 * bloqueada por TestCase: hay que sobrescribirla y purgarla.
 */

function prepararOrigenAbiertas(): void
{
    config(['database.connections.remota' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
    DB::purge('remota');

    $esquema = Schema::connection('remota');

    $esquema->create('tb_prefcatura', function ($t) {
        $t->integer('id_prefactura', true);
        $t->string('fecha_pref')->nullable();
        $t->integer('fol_prefactura');
        $t->integer('id_matricula');
        $t->integer('id_cliente')->nullable();
        $t->string('Estatus')->nullable();
    });
    $esquema->create('tb_llegadas', function ($t) {
        $t->integer('id_llegada', true);
        $t->integer('fol_prefactura');
        $t->string('Fecha_lleg')->nullable();
        $t->string('Fecha_sal')->nullable();
        $t->integer('id_origen')->nullable();
        $t->integer('id_destino')->nullable();
        $t->string('origen')->nullable();
        $t->string('destino')->nullable();
    });
    $esquema->create('tb_venta', function ($t) {
        $t->integer('id_venta', true);
        $t->integer('fol_prefactura');
        $t->integer('id_servicio');
        // Texto y no decimal, por lo mismo que en las pruebas de catálogos: sqlite
        // guardaría un decimal como REAL y no se vería el valor tal como lo da MySQL.
        $t->string('precio_u');
        $t->string('importe');
        $t->integer('cantidad');
        $t->integer('Id_proveedor')->nullable();
        $t->string('remision')->nullable();
    });
    $esquema->create('tb_matricula', function ($t) {
        $t->integer('id_matricula', true);
        $t->string('matricula');
    });
    $esquema->create('tb_clientes', function ($t) {
        $t->integer('id_cliente', true);
        $t->string('nombre');
    });
    $esquema->create('tb_servicio', function ($t) {
        $t->integer('id_servicio', true);
        $t->string('servicio');
    });
    $esquema->create('tb_proveedor', function ($t) {
        $t->integer('id_proveedor', true);
        $t->string('proveedor');
    });
}

/** El catálogo de Eolo-plus al que la importación tiene que resolver, ya poblado. */
function catalogoDestinoParaAbiertas(): array
{
    $aeronave = Aeronave::create(['matricula' => 'XB-TEST']);
    FactAeronave::create(['aeronave_id' => $aeronave->id, 'estatus' => FactAeronave::ESTATUS_TRANSITO]);

    return [
        'aeronave' => $aeronave,
        'cliente' => FactCliente::create(['nombre' => 'Cliente del origen']),
        'servicio' => FactServicio::create(['nombre' => 'Despacho de Vuelos', 'precio_unitario' => '700.0000', 'margen' => '15.00']),
        'proveedor' => FactProveedor::create(['nombre' => 'Proveedor del origen']),
        'usuario' => User::factory()->create(),
    ];
}

/**
 * Una abierta en el origen, con su llegada y un renglón. Devuelve el folio.
 *
 * `$llegada` acepta `false` para el caso sin fila en tb_llegadas, que existe de verdad
 * en el origen: dos de las siete abiertas no la tienen.
 */
function abiertaEnElOrigen(array $datos = [], array|false $llegada = [], array $renglones = []): int
{
    $folio = $datos['fol_prefactura'] ?? 3401;

    DB::connection('remota')->table('tb_matricula')->insertOrIgnore(['id_matricula' => 7, 'matricula' => 'XB-TEST']);
    DB::connection('remota')->table('tb_clientes')->insertOrIgnore(['id_cliente' => 41, 'nombre' => 'Cliente del origen']);
    DB::connection('remota')->table('tb_servicio')->insertOrIgnore(['id_servicio' => 24, 'servicio' => 'Despacho de Vuelos']);
    DB::connection('remota')->table('tb_proveedor')->insertOrIgnore(['id_proveedor' => 5, 'proveedor' => 'Proveedor del origen']);

    DB::connection('remota')->table('tb_prefcatura')->insert($datos + [
        'fecha_pref' => '2026-10-07',
        'fol_prefactura' => $folio,
        'id_matricula' => 7,
        'id_cliente' => 41,
        'Estatus' => '1',
    ]);

    if ($llegada !== false) {
        DB::connection('remota')->table('tb_llegadas')->insert($llegada + [
            'fol_prefactura' => $folio,
            'Fecha_lleg' => '2026-10-05 09:49:00',
            'Fecha_sal' => '2026-10-06 11:00:00',
            'id_origen' => 1,
            'id_destino' => 1,
            'origen' => 'SLW',
            'destino' => 'TLC',
        ]);
    }

    foreach ($renglones === [] ? [['id_servicio' => 24, 'precio_u' => '900', 'importe' => '900.00', 'cantidad' => 1, 'Id_proveedor' => 5]] : $renglones as $r) {
        DB::connection('remota')->table('tb_venta')->insert($r + ['fol_prefactura' => $folio]);
    }

    return $folio;
}

beforeEach(function () {
    prepararOrigenAbiertas();
});

test('una abierta del origen entra como borrador CON su folio viejo', function () {
    $catalogo = catalogoDestinoParaAbiertas();
    abiertaEnElOrigen();

    app(ImportadorPrefacturasAbiertas::class)->ejecutar(true, $catalogo['usuario']->id);

    $p = FactPrefactura::sole();

    expect($p->folio)->toBe(3401)
        ->and($p->estado)->toBe(FactPrefactura::ESTADO_BORRADOR)
        ->and($p->aeronave_id)->toBe($catalogo['aeronave']->id)
        ->and($p->cliente_id)->toBe($catalogo['cliente']->id)
        ->and($p->origen)->toBe('SLW')
        ->and($p->destino)->toBe('TLC')
        ->and($p->tipo_destino)->toBe(FactPrefactura::DESTINO_NACIONAL)
        ->and($p->llegada_at->format('Y-m-d H:i'))->toBe('2026-10-05 09:49')
        ->and($p->salida_at->format('Y-m-d H:i'))->toBe('2026-10-06 11:00')
        ->and($p->renglones)->toHaveCount(1);
});

test('EL IMPORTE DEL RENGLON IMPORTADO ES EL DEL ORIGEN, no el que daria el margen del catalogo', function () {
    // El servicio del catálogo tiene margen 15: si el renglón lo heredara, 900 se
    // convertiría en 1035 y la prefactura cobraría MÁS de lo que cobró el sistema viejo.
    $catalogo = catalogoDestinoParaAbiertas();
    expect($catalogo['servicio']->margen)->toBe('15.00');

    abiertaEnElOrigen(renglones: [
        ['id_servicio' => 24, 'precio_u' => '900', 'importe' => '900.00', 'cantidad' => 1, 'Id_proveedor' => 5],
        ['id_servicio' => 24, 'precio_u' => '4676', 'importe' => '715428.00', 'cantidad' => 153, 'Id_proveedor' => 5],
    ]);

    app(ImportadorPrefacturasAbiertas::class)->ejecutar(true, $catalogo['usuario']->id);

    $renglones = FactPrefactura::sole()->renglones;

    expect($renglones->pluck('importe')->all())->toBe(['900.00', '715428.00'])
        ->and($renglones->pluck('margen')->all())->toBe(['0.00', '0.00'])
        ->and($renglones->pluck('ajuste_precio')->unique()->all())->toBe(['ninguno']);
});

test('el renglon congela el nombre y el precio del ORIGEN, y toma el concepto del catalogo', function () {
    $catalogo = catalogoDestinoParaAbiertas();
    $catalogo['servicio']->update(['concepto' => FactServicio::CONCEPTO_ESTANCIA_PERNOCTA]);
    abiertaEnElOrigen();

    app(ImportadorPrefacturasAbiertas::class)->ejecutar(true, $catalogo['usuario']->id);

    $renglon = FactPrefactura::sole()->renglones->sole();

    expect($renglon->nombre_servicio)->toBe('Despacho de Vuelos')
        ->and((string) $renglon->precio_unitario)->toBe('900.0000')
        ->and($renglon->concepto)->toBe(FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)
        ->and($renglon->servicio_id)->toBe($catalogo['servicio']->id)
        ->and($renglon->proveedor_id)->toBe($catalogo['proveedor']->id);
});

test('una abierta cuya matricula ya no existe en el catalogo NO se importa, y se dice por que', function () {
    $catalogo = catalogoDestinoParaAbiertas();
    abiertaEnElOrigen(['fol_prefactura' => 791, 'id_matricula' => 999]);

    $resultado = app(ImportadorPrefacturasAbiertas::class)->ejecutar(true, $catalogo['usuario']->id);

    expect(FactPrefactura::count())->toBe(0)
        ->and($resultado->conteos['prefacturas'])->toBe(0)
        ->and($resultado->conteos['prefacturas_sin_matricula'])->toBe(1)
        ->and(implode(' ', $resultado->hallazgos))->toContain('791');
});

test('las fechas y los textos basura del origen entran como nulo, no como basura', function () {
    $catalogo = catalogoDestinoParaAbiertas();
    abiertaEnElOrigen(llegada: ['Fecha_sal' => '0000-00-00 00:00:00', 'origen' => 'N/A', 'destino' => '0', 'id_destino' => 0]);

    app(ImportadorPrefacturasAbiertas::class)->ejecutar(true, $catalogo['usuario']->id);

    $p = FactPrefactura::sole();

    expect($p->salida_at)->toBeNull()
        ->and($p->origen)->toBeNull()
        ->and($p->destino)->toBeNull()
        // Sin destino en el origen, el sistema viejo cobró IVA: eso es nacional.
        ->and($p->tipo_destino)->toBe(FactPrefactura::DESTINO_NACIONAL);
});

test('un destino internacional en el origen llega como internacional', function () {
    $catalogo = catalogoDestinoParaAbiertas();
    abiertaEnElOrigen(llegada: ['id_destino' => 2]);

    app(ImportadorPrefacturasAbiertas::class)->ejecutar(true, $catalogo['usuario']->id);

    expect(FactPrefactura::sole()->tipo_destino)->toBe(FactPrefactura::DESTINO_INTERNACIONAL);
});

test('una abierta sin fila en tb_llegadas entra igual, sin fechas', function () {
    $catalogo = catalogoDestinoParaAbiertas();
    abiertaEnElOrigen(llegada: false);

    app(ImportadorPrefacturasAbiertas::class)->ejecutar(true, $catalogo['usuario']->id);

    $p = FactPrefactura::sole();

    expect($p->folio)->toBe(3401)
        ->and($p->llegada_at)->toBeNull()
        ->and($p->salida_at)->toBeNull()
        ->and($p->tipo_destino)->toBe(FactPrefactura::DESTINO_NACIONAL);
});

test('correrlo dos veces NO duplica: el folio es la llave', function () {
    $catalogo = catalogoDestinoParaAbiertas();
    abiertaEnElOrigen();
    $importador = app(ImportadorPrefacturasAbiertas::class);

    $importador->ejecutar(true, $catalogo['usuario']->id);
    $segunda = $importador->ejecutar(true, $catalogo['usuario']->id);

    expect(FactPrefactura::count())->toBe(1)
        ->and(FactPrefactura::sole()->renglones)->toHaveCount(1)
        ->and($segunda->conteos['prefacturas'])->toBe(0)
        ->and($segunda->conteos['prefacturas_ya_estaban'])->toBe(1);
});

test('la simulacion no escribe nada', function () {
    $catalogo = catalogoDestinoParaAbiertas();
    abiertaEnElOrigen();

    $resultado = app(ImportadorPrefacturasAbiertas::class)->ejecutar(false, $catalogo['usuario']->id);

    expect(FactPrefactura::count())->toBe(0)
        ->and($resultado->aplicado)->toBeFalse()
        // Pero sí cuenta lo que HARÍA: una simulación que no cuenta no sirve de nada.
        ->and($resultado->conteos['prefacturas'])->toBe(1)
        ->and($resultado->conteos['renglones'])->toBe(1);
});

test('un renglon cuyo servicio ya no existe no se importa, y la prefactura si, diciendolo', function () {
    $catalogo = catalogoDestinoParaAbiertas();
    abiertaEnElOrigen(renglones: [
        ['id_servicio' => 24, 'precio_u' => '900', 'importe' => '900.00', 'cantidad' => 1, 'Id_proveedor' => 5],
        ['id_servicio' => 777, 'precio_u' => '100', 'importe' => '100.00', 'cantidad' => 1, 'Id_proveedor' => 5],
    ]);

    $resultado = app(ImportadorPrefacturasAbiertas::class)->ejecutar(true, $catalogo['usuario']->id);

    expect(FactPrefactura::sole()->renglones)->toHaveCount(1)
        ->and($resultado->conteos['renglones_sin_servicio'])->toBe(1)
        ->and(implode(' ', $resultado->hallazgos))->toContain('3401');
});

test('la remision del origen viaja, porque es lo unico que explica un renglon de Otros', function () {
    $catalogo = catalogoDestinoParaAbiertas();
    abiertaEnElOrigen(renglones: [
        ['id_servicio' => 24, 'precio_u' => '2785.2', 'importe' => '2785.20', 'cantidad' => 1, 'Id_proveedor' => 5, 'remision' => 'Participación Aeroportuaria'],
    ]);

    app(ImportadorPrefacturasAbiertas::class)->ejecutar(true, $catalogo['usuario']->id);

    expect(FactPrefactura::sole()->renglones->sole()->remision)->toBe('Participación Aeroportuaria');
});
