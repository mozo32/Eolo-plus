<?php
// tests/Feature/Facturacion/ImportadorCatalogosTest.php

use App\Models\Bitacora;
use App\Models\FactCliente;
use App\Models\FactCategoriaServicio;
use App\Models\FactFormaPago;
use App\Models\FactPrecioCombustible;
use App\Models\FactProveedor;
use App\Models\FactServicio;
use App\Models\User;
use App\Services\ImportadorMatriculas;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Los catálogos del bloque 1b. La conexión `remota` está bloqueada por TestCase,
 * así que hay que sobrescribirla y purgarla.
 */

function prepararOrigenCatalogos(): void
{
    config(['database.connections.remota' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
    DB::purge('remota');

    $esquema = Schema::connection('remota');

    $esquema->create('tb_clientes', function ($t) {
        $t->integer('id_cliente', true);
        $t->string('nombre');
        $t->string('rfc')->nullable();
        $t->string('correo')->nullable();
        $t->string('telefono')->nullable();
        $t->integer('fol_prefactura')->nullable();
    });
    $esquema->create('tb_categoria_serv', function ($t) {
        $t->integer('id_categorias', true);
        $t->string('categoras');
    });
    $esquema->create('tb_servicio', function ($t) {
        $t->integer('id_servicio', true);
        $t->string('servicio');
        // Texto y no decimal: sqlite guardaría un decimal como REAL y la prueba del precio
        // exacto no vería el valor tal como lo entrega MySQL ('26.0640').
        $t->string('precio_u');
        $t->integer('id_categorias');
    });
    $esquema->create('tb_tip_fpago', function ($t) {
        $t->integer('id_tipo_formas', true);
        $t->string('tipo_forma');
    });
    $esquema->create('tb_proveedor', function ($t) {
        $t->integer('id_proveedor', true);
        $t->string('proveedor');
    });

    // El importador de matrículas necesita sus tablas aunque estén vacías.
    foreach ([
        'tb_tipo' => ['id_tipo', 'tipo'],
        'tb_categoria' => ['id_categoria', 'categoria'],
        'tb_motor' => ['id_motor', 'motor'],
    ] as $tabla => $cols) {
        $esquema->create($tabla, function ($t) use ($cols) {
            $t->integer($cols[0], true);
            $t->string($cols[1]);
        });
    }
    // Nombres reales de columna en fact-fbo (ojo: 'aterrisaje' la tabla, 'aterrizaje' la columna).
    foreach ([
        'tb_pernocta' => ['id_pernocta', 'pernocta'],
        'tb_transito2h' => ['id_transito2h', 'transito'],
        'tb_transito12h' => ['id_transito12h', 'transito12'],
        'tb_aterrisaje' => ['id_aterrizaje', 'aterrizaje'],
    ] as $tabla => $cols) {
        $esquema->create($tabla, function ($t) use ($cols) {
            $t->integer($cols[0], true);
            $t->decimal($cols[1], 10, 2);
        });
    }
    $esquema->create('tb_matricula', function ($t) {
        $t->integer('id_matricula', true);
        $t->string('matricula');
        $t->integer('id_estatus');
        $t->integer('id_tipo');
        $t->integer('id_categoria');
        $t->integer('id_motor');
        $t->integer('id_aterrizaje');
        $t->integer('id_transito2h');
        $t->integer('id_transito12h');
        $t->integer('id_pernocta');
        $t->integer('d_vuelos');
    });
    $esquema->create('tb_combustible', function ($t) {
        $t->integer('id_combustible', true);
        $t->decimal('p_combustible', 10, 4);
        $t->date('f_ini');
        $t->date('f_fin');
        $t->decimal('pasa', 10, 4);
    });
}

beforeEach(fn () => prepararOrigenCatalogos());

test('los clientes se importan uno a uno, sin deduplicar por RFC', function () {
    DB::connection('remota')->table('tb_clientes')->insert([
        ['nombre' => 'HIPOTECARIA ARBI', 'rfc' => 'XAXX010101000', 'correo' => 'a@x.com', 'telefono' => '111'],
        ['nombre' => 'OLI STONE', 'rfc' => 'XAXX010101000', 'correo' => null, 'telefono' => null],
        ['nombre' => 'AEROSAN', 'rfc' => 'AER970627QE9', 'correo' => 'b@x.com', 'telefono' => '222'],
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactCliente::count())->toBe(3)
        ->and(FactCliente::where('rfc', 'XAXX010101000')->count())->toBe(2)
        ->and($resultado->conteos['clientes'])->toBe(3);
});

test('un cliente sin RFC ni contacto se importa igual', function () {
    DB::connection('remota')->table('tb_clientes')->insert([
        ['nombre' => 'Sin datos', 'rfc' => '', 'correo' => '', 'telefono' => ''],
    ]);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    $cliente = FactCliente::first();

    expect($cliente->nombre)->toBe('Sin datos')
        ->and($cliente->rfc)->toBeNull()
        ->and($cliente->correo)->toBeNull()
        ->and($cliente->telefono)->toBeNull();
});

test('los servicios traen su categoria, su precio de cuatro decimales y su clasificacion', function () {
    DB::connection('remota')->table('tb_categoria_serv')->insert(['id_categorias' => 3, 'categoras' => 'Combustible & Servicios']);
    DB::connection('remota')->table('tb_servicio')->insert([
        ['id_servicio' => 7, 'servicio' => 'Combustible JET A-1', 'precio_u' => 26.0640, 'id_categorias' => 3],
        ['id_servicio' => 94, 'servicio' => 'Comisariato, Tercero', 'precio_u' => 0, 'id_categorias' => 3],
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    $propio = FactServicio::where('nombre', 'Combustible JET A-1')->first();
    $tercero = FactServicio::where('nombre', 'Comisariato, Tercero')->first();

    expect((float) $propio->precio_unitario)->toBe(26.0640)
        ->and($propio->es_de_tercero)->toBeFalse()
        ->and((float) $propio->margen)->toBe(0.0)
        ->and($propio->categoria->nombre)->toBe('Combustible & Servicios')
        ->and($tercero->es_de_tercero)->toBeTrue()
        ->and((float) $tercero->margen)->toBe(50.0)
        ->and($resultado->conteos['servicios_de_tercero'])->toBe(1);
});

test('los tres servicios con formula propia traen su ajuste', function () {
    DB::connection('remota')->table('tb_servicio')->insert([
        ['id_servicio' => 106, 'servicio' => 'Comisariato_Manny', 'precio_u' => 0, 'id_categorias' => 0],
        ['id_servicio' => 107, 'servicio' => 'Comisariato_Avemex', 'precio_u' => 0, 'id_categorias' => 0],
        ['id_servicio' => 113, 'servicio' => 'Comisariato_Fly Across', 'precio_u' => 0, 'id_categorias' => 0],
        ['id_servicio' => 95, 'servicio' => 'Otro de tercero', 'precio_u' => 0, 'id_categorias' => 0],
    ]);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactServicio::where('nombre', 'Comisariato_Manny')->value('ajuste_precio'))->toBe('mas_5')
        ->and(FactServicio::where('nombre', 'Comisariato_Avemex')->value('ajuste_precio'))->toBe('sin_iva')
        ->and(FactServicio::where('nombre', 'Comisariato_Fly Across')->value('ajuste_precio'))->toBe('comision_131')
        ->and(FactServicio::where('nombre', 'Otro de tercero')->value('ajuste_precio'))->toBe('ninguno');
});

test('un servicio con categoria cero queda sin clasificar y se cuenta', function () {
    DB::connection('remota')->table('tb_servicio')->insert([
        ['id_servicio' => 1, 'servicio' => 'Handling', 'precio_u' => 1, 'id_categorias' => 0],
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactServicio::first()->categoria_servicio_id)->toBeNull()
        ->and($resultado->conteos['servicios_sin_categoria'])->toBe(1);
});

test('formas de pago y proveedores se importan por nombre', function () {
    DB::connection('remota')->table('tb_tip_fpago')->insert([
        ['tipo_forma' => 'Efectivo'], ['tipo_forma' => 'AvCard by WFS'],
    ]);
    DB::connection('remota')->table('tb_proveedor')->insert([
        ['proveedor' => 'EOLO'], ['proveedor' => 'MANNY CATERING'],
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactFormaPago::pluck('nombre')->sort()->values()->all())->toBe(['AvCard by WFS', 'Efectivo'])
        ->and(FactProveedor::count())->toBe(2)
        ->and($resultado->conteos['formas_pago'])->toBe(2)
        ->and($resultado->conteos['proveedores'])->toBe(2);
});

test('correrlo dos veces no duplica los catalogos', function () {
    DB::connection('remota')->table('tb_clientes')->insert([['nombre' => 'Uno', 'rfc' => 'ABC010101AAA']]);
    DB::connection('remota')->table('tb_servicio')->insert([['id_servicio' => 5, 'servicio' => 'Aterrizaje', 'precio_u' => 100, 'id_categorias' => 0]]);
    DB::connection('remota')->table('tb_tip_fpago')->insert([['tipo_forma' => 'Efectivo']]);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);
    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactCliente::count())->toBe(1)
        ->and(FactServicio::count())->toBe(1)
        ->and(FactFormaPago::count())->toBe(1);
});

test('la simulacion no escribe ningun catalogo', function () {
    DB::connection('remota')->table('tb_clientes')->insert([['nombre' => 'Uno', 'rfc' => 'ABC010101AAA']]);
    DB::connection('remota')->table('tb_tip_fpago')->insert([['tipo_forma' => 'Efectivo']]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: false);

    expect($resultado->conteos['clientes'])->toBe(1)
        ->and(FactCliente::count())->toBe(0)
        ->and(FactFormaPago::count())->toBe(0);
});

test('un nombre de cliente repetido en el origen da un hallazgo y se importa una sola vez', function () {
    DB::connection('remota')->table('tb_clientes')->insert([
        ['nombre' => 'Aeroservicios', 'rfc' => 'AAA010101AAA', 'correo' => 'primero@x.com', 'telefono' => null],
        ['nombre' => 'AEROSERVICIOS', 'rfc' => 'BBB020202BBB', 'correo' => 'segundo@x.com', 'telefono' => null],
        ['nombre' => 'Aeroservícios', 'rfc' => 'CCC030303CCC', 'correo' => 'tercero@x.com', 'telefono' => null],
        ['nombre' => 'Otro', 'rfc' => null, 'correo' => null, 'telefono' => null],
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactCliente::count())->toBe(2)
        ->and(FactCliente::where('nombre', 'Aeroservicios')->value('rfc'))->toBe('AAA010101AAA')
        ->and($resultado->conteos['clientes'])->toBe(2)
        ->and(hallazgosDelCatalogo($resultado))->toHaveCount(2)
        ->and(hallazgosDelCatalogo($resultado)[0])->toContain('AEROSERVICIOS')
        ->and(hallazgosDelCatalogo($resultado)[1])->toContain('Aeroservícios');
});

test('un nombre de servicio repetido en el origen da un hallazgo y no se cuenta dos veces', function () {
    DB::connection('remota')->table('tb_servicio')->insert([
        ['id_servicio' => 10, 'servicio' => 'Handling', 'precio_u' => 100, 'id_categorias' => 0],
        ['id_servicio' => 11, 'servicio' => 'Handlíng', 'precio_u' => 999, 'id_categorias' => 0],
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactServicio::count())->toBe(1)
        ->and(FactServicio::first()->nombre)->toBe('Handling')
        ->and((float) FactServicio::first()->precio_unitario)->toBe(100.0)
        ->and($resultado->conteos['servicios'])->toBe(1)
        ->and($resultado->conteos['servicios_sin_categoria'])->toBe(1)
        ->and(hallazgosDelCatalogo($resultado))->toHaveCount(1);
});

test('un cliente sin nombre no se importa y se reporta', function () {
    DB::connection('remota')->table('tb_clientes')->insert([
        ['nombre' => '  ', 'rfc' => 'ABC010101AAA'],
        ['nombre' => 'Con nombre', 'rfc' => null],
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactCliente::count())->toBe(1)
        ->and(hallazgosDelCatalogo($resultado))->toHaveCount(1);
});

test('las categorias de servicio se importan por nombre, sin la categoria cero', function () {
    DB::connection('remota')->table('tb_categoria_serv')->insert([
        ['id_categorias' => 0, 'categoras' => 'Sin categoria'],
        ['id_categorias' => 1, 'categoras' => 'Handling'],
        ['id_categorias' => 2, 'categoras' => 'Hangar'],
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactCategoriaServicio::pluck('nombre')->sort()->values()->all())->toBe(['Handling', 'Hangar'])
        ->and($resultado->conteos['categorias_servicio'])->toBe(2);
});

test('un servicio que apunta a una categoria inexistente queda sin clasificar y se reporta', function () {
    DB::connection('remota')->table('tb_servicio')->insert([
        ['id_servicio' => 1, 'servicio' => 'Huerfano', 'precio_u' => 1, 'id_categorias' => 42],
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactServicio::first()->categoria_servicio_id)->toBeNull()
        ->and($resultado->conteos['servicios_sin_categoria'])->toBe(1)
        ->and(hallazgosDelCatalogo($resultado))->toHaveCount(1)
        ->and(hallazgosDelCatalogo($resultado)[0])->toContain('42');
});

/*
 * Protege el invariante "el precio viaja sin tocarse". Para un decimal(10,4) un
 * float es exacto, asi que esto no cubre un cobro que hoy pueda salir mal: cubre
 * que nadie meta un (float) o un round() en el camino. El valor releido del
 * modelo no sirve para esto (el cast `decimal:4` lo formatea al leer y sqlite
 * guarda REAL), asi que se captura lo que el importador manda a la base.
 */
test('el precio de un servicio viaja al insert como texto exacto, sin pasar por float', function () {
    DB::connection('remota')->table('tb_servicio')->insert([
        ['id_servicio' => 1, 'servicio' => 'Minimo', 'precio_u' => '0.0001', 'id_categorias' => 0],
        ['id_servicio' => 2, 'servicio' => 'Cuatro', 'precio_u' => '26.0640', 'id_categorias' => 0],
    ]);

    $bindings = [];
    DB::listen(function ($consulta) use (&$bindings) {
        if (str_starts_with($consulta->sql, 'insert into "fact_servicios"')) {
            $bindings = array_merge($bindings, $consulta->bindings);
        }
    });

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect($bindings)->toContain('0.0001')
        ->and($bindings)->toContain('26.0640');
});

test('la frontera de tercero es el id 94: el 93 es propio y el 94 es de tercero', function () {
    DB::connection('remota')->table('tb_servicio')->insert([
        ['id_servicio' => 93, 'servicio' => 'Ultimo propio', 'precio_u' => 1, 'id_categorias' => 0],
        ['id_servicio' => 94, 'servicio' => 'Primer tercero', 'precio_u' => 1, 'id_categorias' => 0],
    ]);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactServicio::where('nombre', 'Ultimo propio')->first()->es_de_tercero)->toBeFalse()
        ->and(FactServicio::where('nombre', 'Primer tercero')->first()->es_de_tercero)->toBeTrue();
});

test('los conteos de catalogos existen en cero aunque el origen este vacio', function () {
    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: false);

    foreach (['clientes', 'categorias_servicio', 'servicios', 'servicios_de_tercero', 'servicios_sin_categoria', 'formas_pago', 'proveedores'] as $clave) {
        expect($resultado->conteos)->toHaveKey($clave, 0);
    }
});

test('la simulacion de servicios y categorias tampoco escribe', function () {
    DB::connection('remota')->table('tb_categoria_serv')->insert([['id_categorias' => 1, 'categoras' => 'Handling']]);
    DB::connection('remota')->table('tb_servicio')->insert([['id_servicio' => 1, 'servicio' => 'X', 'precio_u' => 1, 'id_categorias' => 1]]);
    DB::connection('remota')->table('tb_proveedor')->insert([['proveedor' => 'EOLO']]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: false);

    expect($resultado->conteos['servicios'])->toBe(1)
        ->and(FactServicio::count())->toBe(0)
        ->and(FactCategoriaServicio::count())->toBe(0)
        ->and(FactProveedor::count())->toBe(0);
});

/*
 * Normalizacion de nombres. CINCO filas reales del origen vienen sucias, no dos:
 * tb_categoria_serv id 3 y tb_servicio ids 15 y 37 con espacio final, tb_proveedor
 * id 4 con U+00A0 (espacio duro) en medio, y tb_clientes id 28 con nombre, RFC,
 * correo y telefono todos vacios (esa se omite, no se normaliza).
 *
 * El "dos" venia de medirlas con `servicio <> TRIM(servicio)`: la collation de
 * MySQL es PAD SPACE, asi que 'X ' y 'X' son iguales y esa consulta devuelve
 * siempre 0. Hay que comparar CHAR_LENGTH, no usar TRIM.
 */
test('un espacio final en el nombre se recorta y se reporta con su id y los dos valores', function () {
    DB::connection('remota')->table('tb_categoria_serv')->insert([['id_categorias' => 3, 'categoras' => 'Combustible & Servicios ']]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactCategoriaServicio::pluck('nombre')->all())->toBe(['Combustible & Servicios'])
        ->and(hallazgosDelCatalogo($resultado))->toHaveCount(1)
        ->and(hallazgosDelCatalogo($resultado)[0])->toContain('tb_categoria_serv')
        ->and(hallazgosDelCatalogo($resultado)[0])->toContain('id 3')
        ->and(hallazgosDelCatalogo($resultado)[0])->toContain("'Combustible & Servicios '")
        ->and(hallazgosDelCatalogo($resultado)[0])->toContain("'Combustible & Servicios'");
});

test('un espacio duro U+00A0 en el nombre se vuelve espacio normal y se reporta', function () {
    DB::connection('remota')->table('tb_proveedor')->insert([
        ['id_proveedor' => 4, 'proveedor' => "ARTURO\u{00A0}GARDUÑO"],
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactProveedor::pluck('nombre')->all())->toBe(['ARTURO GARDUÑO'])
        ->and(hallazgosDelCatalogo($resultado))->toHaveCount(1)
        ->and(hallazgosDelCatalogo($resultado)[0])->toContain('tb_proveedor')
        ->and(hallazgosDelCatalogo($resultado)[0])->toContain('id 4')
        ->and(hallazgosDelCatalogo($resultado)[0])->toContain('ARTURO GARDUÑO');
});

test('la normalizacion colapsa corridas de espacios y aplica a clientes, servicios y formas de pago', function () {
    DB::connection('remota')->table('tb_clientes')->insert([['id_cliente' => 1, 'nombre' => "  Hipotecaria \t  Arbi\u{00A0}\u{00A0}"]]);
    DB::connection('remota')->table('tb_servicio')->insert([['id_servicio' => 1, 'servicio' => 'Uso  de   hangar ', 'precio_u' => '1.0000', 'id_categorias' => 0]]);
    DB::connection('remota')->table('tb_tip_fpago')->insert([['tipo_forma' => ' Efectivo  ']]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactCliente::pluck('nombre')->all())->toBe(['Hipotecaria Arbi'])
        ->and(FactServicio::pluck('nombre')->all())->toBe(['Uso de hangar'])
        ->and(FactFormaPago::pluck('nombre')->all())->toBe(['Efectivo'])
        ->and(hallazgosDelCatalogo($resultado))->toHaveCount(3);
});

test('un nombre ya limpio no genera hallazgo de normalizacion', function () {
    DB::connection('remota')->table('tb_proveedor')->insert([['proveedor' => 'EOLO']]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(hallazgosDelCatalogo($resultado))->toBe([]);
});

/*
 * Las columnas `nombre` de estos tres catalogos son unicas con collation
 * utf8mb4_unicode_ci: en MySQL 'EOLO' y 'Eolo' son la misma fila. En sqlite el
 * indice unico es binario y insertaria dos, asi que aqui se verifica lo que si
 * es verificable: el conteo reportado y el hallazgo, no cuantas filas quedaron.
 */
test('formas de pago y proveedores con nombre repetido no se cuentan dos veces y se reportan', function () {
    DB::connection('remota')->table('tb_tip_fpago')->insert([
        ['tipo_forma' => 'Efectivo'], ['tipo_forma' => 'EFECTIVO'], ['tipo_forma' => 'Tarjeta'],
    ]);
    DB::connection('remota')->table('tb_proveedor')->insert([
        ['proveedor' => 'EOLO'], ['proveedor' => 'Eolo'],
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect($resultado->conteos['formas_pago'])->toBe(2)
        ->and($resultado->conteos['proveedores'])->toBe(1)
        ->and(hallazgosDelCatalogo($resultado))->toHaveCount(2)
        ->and(implode(' ', hallazgosDelCatalogo($resultado)))->toContain('EFECTIVO')
        ->and(implode(' ', hallazgosDelCatalogo($resultado)))->toContain('Eolo');
});

test('dos categorias de servicio con el mismo nombre: un solo conteo, hallazgo, y los servicios de la segunda no quedan huerfanos', function () {
    DB::connection('remota')->table('tb_categoria_serv')->insert([
        ['id_categorias' => 1, 'categoras' => 'Handling'],
        ['id_categorias' => 2, 'categoras' => 'HÁNDLING'],
    ]);
    DB::connection('remota')->table('tb_servicio')->insert([
        ['id_servicio' => 1, 'servicio' => 'Uno', 'precio_u' => '1', 'id_categorias' => 1],
        ['id_servicio' => 2, 'servicio' => 'Dos', 'precio_u' => '1', 'id_categorias' => 2],
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect($resultado->conteos['categorias_servicio'])->toBe(1)
        ->and($resultado->conteos['servicios_sin_categoria'])->toBe(0)
        ->and(FactServicio::where('nombre', 'Dos')->value('categoria_servicio_id'))
        ->toBe(FactServicio::where('nombre', 'Uno')->value('categoria_servicio_id'))
        ->and(hallazgosDelCatalogo($resultado))->toHaveCount(1)
        ->and(hallazgosDelCatalogo($resultado)[0])->toContain('HÁNDLING');
});

/*
 * Str::ascii('日本') devuelve ''. Sin una salida para eso, todos los nombres no
 * latinos compartirian la llave '' y el segundo se omitiria como falso duplicado.
 */
test('dos nombres enteramente no latinos y distintos se importan los dos', function () {
    DB::connection('remota')->table('tb_clientes')->insert([
        ['nombre' => '日本'], ['nombre' => '中国'],
    ]);
    DB::connection('remota')->table('tb_proveedor')->insert([
        ['proveedor' => '日本'], ['proveedor' => '中国'],
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect($resultado->conteos['clientes'])->toBe(2)
        ->and($resultado->conteos['proveedores'])->toBe(2)
        ->and(FactCliente::count())->toBe(2)
        ->and(hallazgosDelCatalogo($resultado))->toBe([]);
});

test('correrlo dos veces no cambia categoria de los servicios ni toca las filas de firstOrCreate', function () {
    DB::connection('remota')->table('tb_categoria_serv')->insert([['id_categorias' => 4, 'categoras' => 'Handling']]);
    DB::connection('remota')->table('tb_servicio')->insert([['id_servicio' => 5, 'servicio' => 'Aterrizaje', 'precio_u' => '100', 'id_categorias' => 4]]);
    DB::connection('remota')->table('tb_tip_fpago')->insert([['tipo_forma' => 'Efectivo']]);
    DB::connection('remota')->table('tb_proveedor')->insert([['proveedor' => 'EOLO']]);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    $categoriaId = FactServicio::first()->categoria_servicio_id;
    $marcas = [
        FactCategoriaServicio::first()->updated_at->toIso8601String(),
        FactFormaPago::first()->updated_at->toIso8601String(),
        FactProveedor::first()->updated_at->toIso8601String(),
    ];

    $this->travel(2)->hours();

    $segunda = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactServicio::first()->categoria_servicio_id)->toBe($categoriaId)
        ->and(FactCategoriaServicio::count())->toBe(1)
        ->and(FactProveedor::count())->toBe(1)
        ->and([
            FactCategoriaServicio::first()->updated_at->toIso8601String(),
            FactFormaPago::first()->updated_at->toIso8601String(),
            FactProveedor::first()->updated_at->toIso8601String(),
        ])->toBe($marcas)
        // Los conteos son filas del origen procesadas, no filas escritas.
        ->and($segunda->conteos['proveedores'])->toBe(1);
});

test('categorias, formas de pago y proveedores con nombre vacio se omiten y se reportan', function () {
    DB::connection('remota')->table('tb_categoria_serv')->insert([
        ['id_categorias' => 1, 'categoras' => ' '], ['id_categorias' => 2, 'categoras' => 'Hangar'],
    ]);
    DB::connection('remota')->table('tb_tip_fpago')->insert([['tipo_forma' => ''], ['tipo_forma' => 'Efectivo']]);
    DB::connection('remota')->table('tb_proveedor')->insert([['proveedor' => "\u{00A0}"], ['proveedor' => 'EOLO']]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect($resultado->conteos['categorias_servicio'])->toBe(1)
        ->and($resultado->conteos['formas_pago'])->toBe(1)
        ->and($resultado->conteos['proveedores'])->toBe(1)
        ->and(hallazgosDelCatalogo($resultado))->toHaveCount(3)
        ->and(implode(' ', hallazgosDelCatalogo($resultado)))->toContain('tb_categoria_serv')
        ->and(implode(' ', hallazgosDelCatalogo($resultado)))->toContain('tb_tip_fpago')
        ->and(implode(' ', hallazgosDelCatalogo($resultado)))->toContain('tb_proveedor');
});

test('un servicio cuya categoria existe pero no tiene nombre lo dice asi, no "no existe"', function () {
    DB::connection('remota')->table('tb_categoria_serv')->insert([['id_categorias' => 9, 'categoras' => '']]);
    DB::connection('remota')->table('tb_servicio')->insert([['id_servicio' => 1, 'servicio' => 'Suelto', 'precio_u' => '1', 'id_categorias' => 9]]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    $servicio = collect(hallazgosDelCatalogo($resultado))->first(fn ($h) => str_contains($h, "'Suelto'"));

    expect($servicio)->toContain('sin nombre')
        ->and($servicio)->not->toContain('no existe')
        ->and(FactServicio::first()->categoria_servicio_id)->toBeNull();
});

/*
 * Cruce del importador con la sincronía del precio del combustible.
 *
 * `importarServicios()` reescribe el precio de TODOS los servicios con el valor
 * del origen, y `Combustible JET A-1` es uno de ellos. `importarCombustible()`
 * protege el precio Eolo vigente, pero corre ANTES y no protege el precio del
 * servicio: sin la sincronía final, una corrida con `--forzar` dejaba el vigente
 * en el precio capturado en pantalla y el catálogo cobrando el del origen. Es un
 * cobro, y era silencioso.
 */

/** La foto de `tb_combustible` de producción: ASA 22.1643, precio Eolo 26.0640. */
function origenCombustible(): void
{
    DB::connection('remota')->table('tb_combustible')->insert([
        ['id_combustible' => 1, 'p_combustible' => '26.0640', 'f_ini' => '2022-09-26', 'f_fin' => '2028-09-26', 'pasa' => '22.1643'],
    ]);
    DB::connection('remota')->table('tb_servicio')->insert([
        ['id_servicio' => 7, 'servicio' => 'Combustible JET A-1', 'precio_u' => '26.0640', 'id_categorias' => 0],
    ]);
}

function servicioCombustibleImportado(): FactServicio
{
    return FactServicio::where('nombre', 'Combustible JET A-1')->firstOrFail();
}

test('una segunda importacion conserva el precio de combustible capturado despues, no el del origen', function () {
    $usuario = User::factory()->create();
    origenCombustible();

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);
    $servicio = servicioCombustibleImportado();

    expect((float) $servicio->precio_unitario)->toBe(26.0640);

    // Alguien captura ASA 24.0000 en la pantalla de Combustible: (24 + 0.50) × 1.15 = 28.1750.
    FactPrecioCombustible::registrar(24.0000, null, $usuario->id);

    expect((float) $servicio->fresh()->precio_unitario)->toBe(28.1750);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    // Sin la sincronía final el servicio volvía a 26.0640 y cobraba ~$10,555 de
    // menos sobre 5,000 L mientras la pantalla seguía mostrando 28.1750.
    expect((float) $servicio->fresh()->precio_unitario)->toBe(28.1750);
});

test('corregir el precio del servicio de combustible sale como hallazgo con los dos valores', function () {
    $usuario = User::factory()->create();
    origenCombustible();

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);
    FactPrecioCombustible::registrar(24.0000, null, $usuario->id);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    $hallazgo = collect(hallazgosDelCatalogo($resultado))->first(fn ($h) => str_contains($h, 'Combustible JET A-1'));

    expect($hallazgo)->not->toBeNull()
        ->and($hallazgo)->toContain('26.0640')
        ->and($hallazgo)->toContain('28.1750')
        ->and($hallazgo)->toContain('origen');
});

test('la correccion del precio del servicio de combustible queda en la bitacora', function () {
    $usuario = User::factory()->create();
    origenCombustible();

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);
    FactPrecioCombustible::registrar(24.0000, null, $usuario->id);
    $servicio = servicioCombustibleImportado();
    Bitacora::query()->delete();

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    $entrada = Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_CATALOGOS)
        ->where('accion', Bitacora::ACCION_ACTUALIZAR)
        ->where('registro_id', $servicio->id)
        ->first();

    expect($entrada)->not->toBeNull()
        ->and((float) $entrada->datos_anteriores['precio_unitario'])->toBe(26.0640)
        ->and((float) $entrada->datos_nuevos['precio_unitario'])->toBe(28.1750);
});

test('en la primera importacion el precio ya coincide: ni hallazgo ni bitacora', function () {
    User::factory()->create();
    origenCombustible();

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect((float) servicioCombustibleImportado()->precio_unitario)->toBe(26.0640)
        ->and(hallazgosDelCatalogo($resultado))->toBe([])
        ->and(Bitacora::where('accion', Bitacora::ACCION_ACTUALIZAR)->count())->toBe(0);
});

test('la simulacion de la correccion del precio de combustible no escribe nada', function () {
    $usuario = User::factory()->create();
    origenCombustible();

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);
    FactPrecioCombustible::registrar(24.0000, null, $usuario->id);
    $servicio = servicioCombustibleImportado();
    Bitacora::query()->delete();

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: false);

    expect(collect(hallazgosDelCatalogo($resultado))->contains(fn ($h) => str_contains($h, '28.1750')))->toBeTrue()
        ->and((float) $servicio->fresh()->precio_unitario)->toBe(28.1750)
        ->and(Bitacora::count())->toBe(0);
});

test('el importador asigna el concepto por el id viejo', function () {
    DB::connection('remota')->table('tb_servicio')->insert([
        ['id_servicio' => 2, 'servicio' => 'Transito 02 hrs', 'precio_u' => '99.0000', 'id_categorias' => 1],
        ['id_servicio' => 7, 'servicio' => 'Combustible JET A-1', 'precio_u' => '26.0640', 'id_categorias' => 1],
        ['id_servicio' => 9, 'servicio' => 'DSMES - salida', 'precio_u' => '4060.5000', 'id_categorias' => 1],
        ['id_servicio' => 50, 'servicio' => 'Comisariato', 'precio_u' => '100.0000', 'id_categorias' => 1],
    ]);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactServicio::porConcepto(FactServicio::CONCEPTO_COMBUSTIBLE)->sole()->nombre)->toBe('Combustible JET A-1')
        ->and(FactServicio::porConcepto(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H)->sole()->nombre)->toBe('Transito 02 hrs')
        ->and(FactServicio::where('nombre', 'DSMES - salida')->sole()->en_paquete_internacional)->toBeTrue()
        ->and(FactServicio::where('nombre', 'Comisariato')->sole()->concepto)->toBeNull()
        ->and(FactServicio::where('nombre', 'Comisariato')->sole()->en_paquete_internacional)->toBeFalse();
});

test('el importador asigna los siete conceptos y una segunda corrida no los duplica', function () {
    DB::connection('remota')->table('tb_servicio')->insert([
        ['id_servicio' => 2, 'servicio' => 'Transito 02 hrs', 'precio_u' => '1', 'id_categorias' => 1],
        ['id_servicio' => 3, 'servicio' => 'Transito 12 hrs', 'precio_u' => '1', 'id_categorias' => 1],
        ['id_servicio' => 4, 'servicio' => 'Transito 24 hrs - pernocta', 'precio_u' => '1', 'id_categorias' => 1],
        ['id_servicio' => 7, 'servicio' => 'Combustible JET A-1', 'precio_u' => '1', 'id_categorias' => 1],
        ['id_servicio' => 9, 'servicio' => 'DSMES - salida', 'precio_u' => '1', 'id_categorias' => 1],
        ['id_servicio' => 10, 'servicio' => 'DSM - salida', 'precio_u' => '1', 'id_categorias' => 1],
        ['id_servicio' => 14, 'servicio' => 'Mex-eAPI - salida', 'precio_u' => '1', 'id_categorias' => 1],
        ['id_servicio' => 93, 'servicio' => 'Servicios Internacionales - salida', 'precio_u' => '1', 'id_categorias' => 1],
        ['id_servicio' => 50, 'servicio' => 'Comisariato', 'precio_u' => '1', 'id_categorias' => 1],
    ]);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);
    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactServicio::whereNotNull('concepto')->pluck('nombre', 'concepto')->all())->toBe([
        FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H => 'Transito 02 hrs',
        FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H => 'Transito 12 hrs',
        FactServicio::CONCEPTO_ESTANCIA_PERNOCTA => 'Transito 24 hrs - pernocta',
        FactServicio::CONCEPTO_COMBUSTIBLE => 'Combustible JET A-1',
    ])
        ->and(FactServicio::where('en_paquete_internacional', true)->count())->toBe(4)
        ->and(FactServicio::count())->toBe(9);
});

test('renombrar un servicio con concepto y volver a importar actualiza esa fila, sin crear otra ni lanzar', function () {
    DB::connection('remota')->table('tb_servicio')->insert([
        ['id_servicio' => 7, 'servicio' => 'Combustible JET A-1', 'precio_u' => '26.0640', 'id_categorias' => 0],
    ]);
    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    $servicio = FactServicio::porConcepto(FactServicio::CONCEPTO_COMBUSTIBLE)->sole();
    $servicio->update(['nombre' => 'Turbosina JET A-1']);

    // El nombre del origen cambia y el precio del origen también: el importador
    // sigue a la fila por su concepto, y la fila toma el nombre del origen.
    DB::connection('remota')->table('tb_servicio')->where('id_servicio', 7)->update(['servicio' => 'Combustible JET A-1 (revisado)']);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactServicio::count())->toBe(1)
        ->and(FactServicio::porConcepto(FactServicio::CONCEPTO_COMBUSTIBLE)->sole()->id)->toBe($servicio->id)
        ->and($servicio->fresh()->nombre)->toBe('Combustible JET A-1 (revisado)');
});

test('un servicio renombrado en pantalla y reimportado con su nombre original conserva su fila', function () {
    DB::connection('remota')->table('tb_servicio')->insert([
        ['id_servicio' => 7, 'servicio' => 'Combustible JET A-1', 'precio_u' => '26.0640', 'id_categorias' => 0],
    ]);
    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);
    $servicio = FactServicio::porConcepto(FactServicio::CONCEPTO_COMBUSTIBLE)->sole();
    $servicio->update(['nombre' => 'Turbosina JET A-1']);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactServicio::count())->toBe(1)
        ->and($servicio->fresh()->nombre)->toBe('Combustible JET A-1');
});

test('las filas ya importadas sin concepto lo reciben al reimportar, sin duplicarse', function () {
    // El estado de produccion al migrar: el servicio existe, sin concepto.
    $existente = FactServicio::create(['nombre' => 'Combustible JET A-1', 'precio_unitario' => 26.064]);
    DB::connection('remota')->table('tb_servicio')->insert([
        ['id_servicio' => 7, 'servicio' => 'Combustible JET A-1', 'precio_u' => '26.0640', 'id_categorias' => 0],
    ]);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactServicio::count())->toBe(1)
        ->and($existente->fresh()->concepto)->toBe(FactServicio::CONCEPTO_COMBUSTIBLE);
});

test('un servicio sin concepto sigue casando por nombre', function () {
    DB::connection('remota')->table('tb_servicio')->insert([
        ['id_servicio' => 50, 'servicio' => 'Comisariato', 'precio_u' => '100.0000', 'id_categorias' => 0],
    ]);
    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);
    DB::connection('remota')->table('tb_servicio')->where('id_servicio', 50)->update(['precio_u' => '120.0000']);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactServicio::count())->toBe(1)
        ->and((float) FactServicio::first()->precio_unitario)->toBe(120.0);
});

test('el nombre repetido sigue dando hallazgo en los servicios sin concepto, y el concepto no se pierde', function () {
    DB::connection('remota')->table('tb_servicio')->insert([
        ['id_servicio' => 10, 'servicio' => 'Handling', 'precio_u' => 100, 'id_categorias' => 0],
        ['id_servicio' => 11, 'servicio' => 'Handlíng', 'precio_u' => 999, 'id_categorias' => 0],
        ['id_servicio' => 7, 'servicio' => 'Combustible JET A-1', 'precio_u' => '26.0640', 'id_categorias' => 0],
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactServicio::whereNull('concepto')->count())->toBe(1)
        ->and(FactServicio::porConcepto(FactServicio::CONCEPTO_COMBUSTIBLE)->count())->toBe(1)
        ->and(collect(hallazgosDelCatalogo($resultado))->filter(fn ($h) => str_contains($h, 'Handl'))->count())->toBe(1);
});

test('un servicio sin concepto no pisa a uno con concepto que se renombro a su mismo nombre', function () {
    // El combustible ya existe y alguien lo renombro a un nombre que el origen
    // tambien usa para otro servicio (id 5, que se importa antes que el 7).
    $combustible = FactServicio::create(['nombre' => 'Hangaraje', 'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE, 'precio_unitario' => 26.064]);
    DB::connection('remota')->table('tb_servicio')->insert([
        ['id_servicio' => 5, 'servicio' => 'Hangaraje', 'precio_u' => '1500.0000', 'id_categorias' => 0],
        ['id_servicio' => 7, 'servicio' => 'Combustible JET A-1', 'precio_u' => '26.0640', 'id_categorias' => 0],
    ]);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    $hangaraje = FactServicio::whereNull('concepto')->where('nombre', 'Hangaraje')->sole();

    expect($hangaraje->id)->not->toBe($combustible->id)
        ->and((float) $hangaraje->precio_unitario)->toBe(1500.0)
        ->and(FactServicio::count())->toBe(2);
});

test('una reimportacion restablece la marca del paquete internacional', function () {
    DB::connection('remota')->table('tb_servicio')->insert([
        ['id_servicio' => 9, 'servicio' => 'DSMES - salida', 'precio_u' => '4060.5000', 'id_categorias' => 0],
        ['id_servicio' => 50, 'servicio' => 'Comisariato', 'precio_u' => '100.0000', 'id_categorias' => 0],
    ]);
    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    // Alguien desmarca el de paquete y marca el que no lo es.
    FactServicio::where('nombre', 'DSMES - salida')->update(['en_paquete_internacional' => false]);
    FactServicio::where('nombre', 'Comisariato')->update(['en_paquete_internacional' => true]);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactServicio::where('nombre', 'DSMES - salida')->sole()->en_paquete_internacional)->toBeTrue()
        ->and(FactServicio::where('nombre', 'Comisariato')->sole()->en_paquete_internacional)->toBeFalse();
});

test('si la fila con concepto renombrada y otra sin concepto comparten el nombre del origen, sale un hallazgo con las dos', function () {
    $conConcepto = FactServicio::create(['nombre' => 'Turbosina JET A-1', 'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE, 'precio_unitario' => 26.064]);
    $sinConcepto = FactServicio::create(['nombre' => 'Combustible JET A-1', 'precio_unitario' => 5]);
    DB::connection('remota')->table('tb_servicio')->insert([
        ['id_servicio' => 7, 'servicio' => 'Combustible JET A-1', 'precio_u' => '26.0640', 'id_categorias' => 0],
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    $hallazgo = collect(hallazgosDelCatalogo($resultado))->first(fn ($h) => str_contains($h, "id {$conConcepto->id}") && str_contains($h, "id {$sinConcepto->id}"));

    expect($hallazgo)->not->toBeNull()
        ->and($hallazgo)->toContain('concepto')
        ->and($hallazgo)->toContain('Combustible JET A-1')
        ->and(FactServicio::count())->toBe(2);
});

test('sin una segunda fila con el mismo nombre no hay hallazgo de duplicado al reimportar', function () {
    DB::connection('remota')->table('tb_servicio')->insert([
        ['id_servicio' => 7, 'servicio' => 'Combustible JET A-1', 'precio_u' => '26.0640', 'id_categorias' => 0],
    ]);
    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);
    FactServicio::porConcepto(FactServicio::CONCEPTO_COMBUSTIBLE)->sole()->update(['nombre' => 'Turbosina JET A-1']);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(hallazgosDelCatalogo($resultado))->toBe([]);
});

test('el hallazgo de la fila gemela lista todas las filas sin concepto que comparten el nombre', function () {
    $conConcepto = FactServicio::create(['nombre' => 'Turbosina JET A-1', 'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE, 'precio_unitario' => 26.064]);
    $uno = FactServicio::create(['nombre' => 'Combustible JET A-1', 'precio_unitario' => 5]);
    $dos = FactServicio::create(['nombre' => 'Combustible JET A-1', 'precio_unitario' => 6]);
    DB::connection('remota')->table('tb_servicio')->insert([
        ['id_servicio' => 7, 'servicio' => 'Combustible JET A-1', 'precio_u' => '26.0640', 'id_categorias' => 0],
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(hallazgosDelCatalogo($resultado))->toHaveCount(1)
        ->and(hallazgosDelCatalogo($resultado)[0])->toContain("id {$conConcepto->id}")
        ->and(hallazgosDelCatalogo($resultado)[0])->toContain("ids {$uno->id}, {$dos->id}");
});

/**
 * Los hallazgos del importador sin los que avisan de que el origen simulado no trae
 * las formas de pago 3, 4 y 5 (las del concepto, Task 2 del bloque 3). Estas pruebas
 * son de otros catálogos y no siembran esas filas: sin el filtro cada una contaría
 * tres hallazgos que no son suyos. Las pruebas del concepto sí los miran, al final.
 *
 * @return list<string>
 */
function hallazgosDelCatalogo(App\Services\ResultadoImportacion $resultado): array
{
    return array_values(array_filter(
        $resultado->hallazgos,
        fn (string $h) => ! str_starts_with($h, 'El origen no tiene la forma de pago con id'),
    ));
}

/*
 * El concepto de las formas de pago (bloque 3, Task 2). Los ids 3, 4 y 5 de
 * `tb_tip_fpago` son los que el sistema viejo usa hardcodeados (Amex, Efectivo,
 * AvCard by WFS); aquí se siembran con esos ids a propósito.
 */
function sembrarFormasDePagoLegacy(): void
{
    DB::connection('remota')->table('tb_tip_fpago')->insert([
        ['id_tipo_formas' => 1, 'tipo_forma' => 'Visa'],
        ['id_tipo_formas' => 3, 'tipo_forma' => 'Amex'],
        ['id_tipo_formas' => 4, 'tipo_forma' => 'Efectivo'],
        ['id_tipo_formas' => 5, 'tipo_forma' => 'AvCard by WFS'],
    ]);
}

test('el importador asigna a las formas de pago 3, 4 y 5 su concepto', function () {
    sembrarFormasDePagoLegacy();

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactFormaPago::whereNotNull('concepto')->pluck('nombre', 'concepto')->all())->toBe([
        FactFormaPago::CONCEPTO_AMEX => 'Amex',
        FactFormaPago::CONCEPTO_EFECTIVO => 'Efectivo',
        FactFormaPago::CONCEPTO_AVCARD => 'AvCard by WFS',
    ])
        ->and(FactFormaPago::where('nombre', 'Visa')->sole()->concepto)->toBeNull();
});

test('las formas de pago ya importadas sin concepto lo reciben al reimportar, sin duplicarse', function () {
    // El estado de produccion al migrar: las filas existen, sin concepto.
    $efectivo = FactFormaPago::create(['nombre' => 'Efectivo']);
    sembrarFormasDePagoLegacy();

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactFormaPago::count())->toBe(4)
        ->and($efectivo->fresh()->concepto)->toBe(FactFormaPago::CONCEPTO_EFECTIVO);
});

test('correr el importador dos veces con conceptos no choca con el indice unico ni duplica', function () {
    sembrarFormasDePagoLegacy();

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);
    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactFormaPago::count())->toBe(4)
        ->and(FactFormaPago::whereNotNull('concepto')->count())->toBe(3)
        ->and($resultado->hallazgos)->toBe([]);
});

test('una forma de pago renombrada en pantalla sigue siendo la misma tras reimportar, sin crear otra', function () {
    sembrarFormasDePagoLegacy();
    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);
    $amex = FactFormaPago::porConcepto(FactFormaPago::CONCEPTO_AMEX)->sole();
    $amex->update(['nombre' => 'American Express']);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactFormaPago::count())->toBe(4)
        ->and(FactFormaPago::porConcepto(FactFormaPago::CONCEPTO_AMEX)->sole()->id)->toBe($amex->id)
        ->and($amex->fresh()->nombre)->toBe('American Express')
        ->and(FactFormaPago::where('nombre', 'Amex')->exists())->toBeFalse();
});

test('si el origen no trae las formas 3, 4 y 5 el importador lo reporta en espanol', function () {
    DB::connection('remota')->table('tb_tip_fpago')->insert([['id_tipo_formas' => 1, 'tipo_forma' => 'Visa']]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect($resultado->hallazgos)->toHaveCount(3)
        ->and($resultado->hallazgos[0])->toContain("concepto 'amex'")
        ->and(FactFormaPago::whereNotNull('concepto')->count())->toBe(0);
});

test('una simulacion no deja el concepto asignado', function () {
    sembrarFormasDePagoLegacy();

    app(ImportadorMatriculas::class)->ejecutar(aplicar: false);

    expect(FactFormaPago::count())->toBe(0);
});
