<?php

use App\Models\Aeronave;
use App\Models\PernoctaDia;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * El Excel de Pernocta del Día pintaba «SIN DATO» en Categoría y Estatus. La consulta no
 * tenía ningún defecto: decía la verdad sobre `pernocta_dia`, donde 29 de 196 matrículas
 * no tienen categoría en ninguno de sus registros y 7 no tienen estatus. El dato que el
 * departamento veía estaba en el catálogo de facturación, y de ahí sale el respaldo.
 *
 * Las tablas `fact_aeronaves` y `fact_categorias_aeronave` NO tienen migración en esta
 * rama: sus 24 migraciones viven en la rama `facturacion`, sin fusionar. Existen en la
 * base de desarrollo porque se importó un volcado. Por eso el endpoint comprueba que
 * existan antes de unirlas, y por eso estas pruebas las crean a mano cuando las
 * necesitan: así la funcionalidad se prueba de verdad sin fingir un esquema que la rama
 * no tiene.
 */

function crearCatalogoFacturacion(): void
{
    Schema::create('fact_categorias_aeronave', function (Blueprint $tabla) {
        $tabla->id();
        $tabla->string('nombre', 50)->nullable();
    });

    Schema::create('fact_aeronaves', function (Blueprint $tabla) {
        $tabla->id();
        $tabla->unsignedBigInteger('aeronave_id');
        $tabla->unsignedBigInteger('categoria_aeronave_id')->nullable();
        $tabla->string('estatus', 50)->nullable();
    });
}

function pernoctaDePrueba(string $matricula, array $extra = []): PernoctaDia
{
    return PernoctaDia::create(array_merge([
        'fecha' => '2026-09-10',
        'matricula' => $matricula,
        'nombre' => 'RESPONSABLE DE PRUEBA',
        'ubicacion' => 'H1',
        'aeronave' => 'C550',
        'tipo_cliente' => 'Transito',
        'categoria' => 'III',
    ], $extra));
}

/**
 * Liga una matrícula con su ficha del catálogo de facturación.
 * El camino real es pernocta_dia.matricula → aeronaves.matricula → fact_aeronaves.aeronave_id.
 */
function fichaDeFacturacion(string $matricula, ?string $categoria, ?string $estatus): void
{
    // `aeronaves.aeronave_id` es clave ajena a `tipo_aeronaves`, así que el tipo tiene
    // que existir antes.
    $tipoId = DB::table('tipo_aeronaves')->insertGetId([
        'nombre' => 'JET',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $aeronave = Aeronave::create([
        'matricula' => $matricula,
        'aeronave_id' => $tipoId,
        'tipo_aeronave' => 'JET',
    ]);

    $categoriaId = null;

    if ($categoria !== null) {
        $categoriaId = DB::table('fact_categorias_aeronave')->insertGetId([
            'nombre' => $categoria,
        ]);
    }

    DB::table('fact_aeronaves')->insert([
        'aeronave_id' => $aeronave->id,
        'categoria_aeronave_id' => $categoriaId,
        'estatus' => $estatus,
    ]);
}

function consultarPernoctaMes(): Illuminate\Testing\TestResponse
{
    return test()->getJson('/api/PernoctaMes?desde=2026-09-01&hasta=2026-09-30');
}

beforeEach(function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
});

it('toma la categoría del catálogo cuando la pernocta no la trae', function () {
    crearCatalogoFacturacion();
    pernoctaDePrueba('XA-VID', ['categoria' => null]);
    fichaDeFacturacion('XA-VID', 'IV', 'guarda');

    $fila = consultarPernoctaMes()->assertOk()->json('data.0');

    expect($fila['categoria'])->toBe('IV');
});

it('toma el estatus del catálogo cuando la pernocta no lo trae', function () {
    crearCatalogoFacturacion();
    pernoctaDePrueba('XA-DDD', ['tipo_cliente' => null]);
    fichaDeFacturacion('XA-DDD', null, 'transito');

    $fila = consultarPernoctaMes()->assertOk()->json('data.0');

    expect($fila['estatus'])->toBe('Transito');
});

it('normaliza la capitalización del catálogo a la de pernocta', function () {
    // El catálogo guarda `guarda` en minúsculas y pernocta `Guarda`. Sin normalizar, el
    // Excel agrupa por matrícula y une los valores distintos con « / », así que una
    // matrícula con un registro propio y otro heredado saldría como «Guarda / guarda».
    crearCatalogoFacturacion();
    pernoctaDePrueba('XA-UNO', ['tipo_cliente' => null]);
    fichaDeFacturacion('XA-UNO', null, 'guarda');

    $fila = consultarPernoctaMes()->assertOk()->json('data.0');

    expect($fila['estatus'])->toBe('Guarda');
});

it('el valor de la pernocta gana sobre el del catálogo', function () {
    // XA-VID es un caso real: su pernocta dice Transito y su ficha dice guarda. El dato
    // de la noche concreta manda sobre la propiedad general de la aeronave.
    crearCatalogoFacturacion();
    pernoctaDePrueba('XA-VID', ['categoria' => 'III', 'tipo_cliente' => 'Transito']);
    fichaDeFacturacion('XA-VID', 'IV', 'guarda');

    $fila = consultarPernoctaMes()->assertOk()->json('data.0');

    expect($fila['categoria'])->toBe('III')
        ->and($fila['estatus'])->toBe('Transito');
});

it('una cadena de espacios en la pernocta cuenta como vacía', function () {
    crearCatalogoFacturacion();
    pernoctaDePrueba('XA-DOS', ['categoria' => '   ']);
    fichaDeFacturacion('XA-DOS', 'VII', 'transito');

    $fila = consultarPernoctaMes()->assertOk()->json('data.0');

    expect($fila['categoria'])->toBe('VII');
});

it('una matrícula sin ficha en el catálogo sigue devolviendo nulo', function () {
    // Es el camino que deja el «SIN DATO» del Excel, y debe seguir existiendo: de las 29
    // matrículas sin categoría, 18 tampoco la tienen en el catálogo.
    crearCatalogoFacturacion();
    pernoctaDePrueba('XA-TRES', ['categoria' => null, 'tipo_cliente' => null]);

    $fila = consultarPernoctaMes()->assertOk()->json('data.0');

    expect($fila['categoria'])->toBeNull()
        ->and($fila['estatus'])->toBeNull();
});

it('el respaldo no multiplica ni pierde filas', function () {
    crearCatalogoFacturacion();
    pernoctaDePrueba('XA-VID', ['fecha' => '2026-09-10', 'categoria' => null]);
    pernoctaDePrueba('XA-VID', ['fecha' => '2026-09-11', 'categoria' => null]);
    fichaDeFacturacion('XA-VID', 'IV', 'guarda');

    $respuesta = consultarPernoctaMes()->assertOk();

    expect($respuesta->json('data'))->toHaveCount(2)
        ->and($respuesta->json('total'))->toBe(2);
});

it('el filtro de matrícula sigue funcionando con el catálogo unido', function () {
    // `aeronaves` también tiene una columna `matricula`, así que un filtro sin calificar
    // queda ambiguo en cuanto se une el catálogo y la consulta revienta entera.
    crearCatalogoFacturacion();
    pernoctaDePrueba('XA-VID');
    pernoctaDePrueba('XA-OTRA');
    fichaDeFacturacion('XA-VID', 'IV', 'guarda');

    $datos = test()->getJson('/api/PernoctaMes?matricula=XA-VID')
        ->assertOk()
        ->json('data');

    expect($datos)->toHaveCount(1)
        ->and($datos[0]['matricula'])->toBe('XA-VID');
});

it('el filtro de responsable sigue funcionando con el catálogo unido', function () {
    // `fact_categorias_aeronave` también tiene una columna `nombre`, con el mismo riesgo.
    crearCatalogoFacturacion();
    pernoctaDePrueba('XA-VID', ['nombre' => 'ANA ROBLES']);
    pernoctaDePrueba('XA-OTRA', ['nombre' => 'BETO SÁNCHEZ']);
    fichaDeFacturacion('XA-VID', 'IV', 'guarda');

    $datos = test()->getJson('/api/PernoctaMes?responsable=Robles')
        ->assertOk()
        ->json('data');

    expect($datos)->toHaveCount(1)
        ->and($datos[0]['nombre'])->toBe('ANA ROBLES');
});

it('sin las tablas del catálogo el endpoint sigue funcionando', function () {
    // En esta rama las tablas `fact_*` no existen: sus migraciones están en la rama
    // `facturacion`, sin fusionar. Si el endpoint las uniera a ciegas, el Excel de
    // Pernocta del Día dejaría de funcionar entero, que es mucho peor que un SIN DATO.
    expect(Schema::hasTable('fact_aeronaves'))->toBeFalse();

    pernoctaDePrueba('XA-VID', ['categoria' => null, 'tipo_cliente' => null]);

    $fila = consultarPernoctaMes()->assertOk()->json('data.0');

    expect($fila['matricula'])->toBe('XA-VID')
        ->and($fila['categoria'])->toBeNull()
        ->and($fila['estatus'])->toBeNull();
});

it('sin las tablas del catálogo los datos propios siguen saliendo', function () {
    pernoctaDePrueba('XA-CUATRO', ['categoria' => 'II', 'tipo_cliente' => 'Guarda']);

    $fila = consultarPernoctaMes()->assertOk()->json('data.0');

    expect($fila['categoria'])->toBe('II')
        ->and($fila['estatus'])->toBe('Guarda');
});
