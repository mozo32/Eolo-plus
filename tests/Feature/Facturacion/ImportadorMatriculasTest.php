<?php
// tests/Feature/Facturacion/ImportadorMatriculasTest.php

use App\Models\Aeronave;
use App\Models\FactAeronave;
use App\Models\FactCategoriaAeronave;
use App\Models\FactCategoriaServicio;
use App\Models\FactCliente;
use App\Models\FactFormaPago;
use App\Models\FactPrecioCombustible;
use App\Models\FactProveedor;
use App\Models\FactTipoMotor;
use App\Models\TipoAeronave;
use App\Models\User;
use App\Services\ImportadorMatriculas;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Crea en sqlite las tablas de fact-fbo que lee el importador.
 *
 * TestCase apunta `remota` a un destino que no existe para que nada escriba en
 * la base real por accidente. Aquí se sobrescribe con una sqlite en memoria y
 * se llama a DB::purge: sin el purge Laravel devolvería la conexión ya
 * resuelta (la bloqueada) y la prueba fallaría por una razón ajena al código.
 */
function prepararBaseLegacy(): void
{
    config(['database.connections.remota' => [
        'driver' => 'sqlite',
        'database' => ':memory:',
        'prefix' => '',
    ]]);
    DB::purge('remota');

    $esquema = Schema::connection('remota');

    $esquema->create('tb_tipo', function ($t) {
        $t->integer('id_tipo', true);
        $t->string('tipo');
    });
    $esquema->create('tb_categoria', function ($t) {
        $t->integer('id_categoria', true);
        $t->string('categoria');
    });
    $esquema->create('tb_motor', function ($t) {
        $t->integer('id_motor', true);
        $t->string('motor');
    });
    $esquema->create('tb_pernocta', function ($t) {
        $t->integer('id_pernocta', true);
        $t->decimal('pernocta', 10, 2);
    });
    $esquema->create('tb_transito2h', function ($t) {
        $t->integer('id_transito2h', true);
        $t->decimal('transito', 10, 2);
    });
    $esquema->create('tb_transito12h', function ($t) {
        $t->integer('id_transito12h', true);
        $t->decimal('transito12', 10, 2);
    });
    $esquema->create('tb_aterrisaje', function ($t) {
        $t->integer('id_aterrizaje', true);
        $t->decimal('aterrizaje', 10, 2);
    });
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

    // El importador también trae los catálogos de facturación (bloque 1b). Aquí
    // quedan vacíos: lo que cubren estas pruebas es lo de la matrícula, y los
    // catálogos tienen sus pruebas en ImportadorCatalogosTest.
    $esquema->create('tb_clientes', function ($t) {
        $t->integer('id_cliente', true);
        $t->string('nombre');
        $t->string('rfc')->nullable();
        $t->string('correo')->nullable();
        $t->string('telefono')->nullable();
    });
    $esquema->create('tb_categoria_serv', function ($t) {
        $t->integer('id_categorias', true);
        $t->string('categoras');
    });
    $esquema->create('tb_servicio', function ($t) {
        $t->integer('id_servicio', true);
        $t->string('servicio');
        $t->decimal('precio_u', 10, 4);
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
}

function sembrarLegacy(array $matriculas): void
{
    $remota = DB::connection('remota');
    $remota->table('tb_tipo')->insert(['id_tipo' => 1, 'tipo' => 'Learjet 45']);
    $remota->table('tb_categoria')->insert(['id_categoria' => 1, 'categoria' => 'Ejecutiva']);
    $remota->table('tb_motor')->insert(['id_motor' => 1, 'motor' => 'Jet']);
    $remota->table('tb_pernocta')->insert([
        ['id_pernocta' => 1, 'pernocta' => 1200],
        ['id_pernocta' => 2, 'pernocta' => 9999],
        ['id_pernocta' => 3, 'pernocta' => 0],
    ]);
    $remota->table('tb_transito2h')->insert(['id_transito2h' => 1, 'transito' => 300]);
    $remota->table('tb_transito12h')->insert(['id_transito12h' => 1, 'transito12' => 700]);
    $remota->table('tb_aterrisaje')->insert([
        ['id_aterrizaje' => 1, 'aterrizaje' => 900],
        ['id_aterrizaje' => 2, 'aterrizaje' => 1500],
    ]);
    $remota->table('tb_combustible')->insert(['id_combustible' => 1, 'p_combustible' => 26.45, 'f_ini' => '2026-09-01', 'f_fin' => '2026-09-30', 'pasa' => 22.50]);
    $remota->table('tb_matricula')->insert($matriculas);
}

function matriculaLegacy(
    string $matricula,
    int $idPernocta = 1,
    int $idCategoria = 1,
    int $idEstatus = 1,
    int $idAterrizaje = 1,
    int $dVuelos = 0,
): array {
    return [
        'matricula' => $matricula,
        'id_estatus' => $idEstatus,
        'id_tipo' => 1,
        'id_categoria' => $idCategoria,
        'id_motor' => 1,
        'id_aterrizaje' => $idAterrizaje,
        'id_transito2h' => 1,
        'id_transito12h' => 1,
        'id_pernocta' => $idPernocta,
        'd_vuelos' => $dVuelos,
    ];
}

/** Una matricula legacy con los ids de tarifa indicados, para armar casos finos. */
function matriculaConTarifas(string $matricula, int $categoria, int $motor, int $pernocta, int $t2h, int $t12h, int $aterrizaje): array
{
    return array_merge(matriculaLegacy($matricula), [
        'id_categoria' => $categoria,
        'id_motor' => $motor,
        'id_pernocta' => $pernocta,
        'id_transito2h' => $t2h,
        'id_transito12h' => $t12h,
        'id_aterrizaje' => $aterrizaje,
    ]);
}

/**
 * Un origen con varios valores por tarifa, para poder fabricar el caso
 * interesante: matriculas que coinciden con la moda en unos campos y se
 * apartan en otros, un empate de moda, una sin motor y una sin categoria.
 *
 * Ejecutiva: A1, A2 y A5 = moda; A3 se aparta solo en pernocta; A4 se aparta
 * en 2h, 12h y aterrizaje pero no en pernocta; A5 cobra 2h en cero (cortesia);
 * SM no tiene motor y su aterrizaje no es el de ningun motor.
 * Ligera: BB1 y BB2 empatan en pernocta (500 contra 1200).
 * SC: sin categoria ni ninguna tarifa (todos los ids en 0).
 */
function sembrarOrigenRico(): void
{
    $remota = DB::connection('remota');
    $remota->table('tb_tipo')->insert(['id_tipo' => 1, 'tipo' => 'Learjet 45']);
    $remota->table('tb_categoria')->insert([
        ['id_categoria' => 1, 'categoria' => 'Ejecutiva'],
        ['id_categoria' => 2, 'categoria' => 'Ligera'],
    ]);
    $remota->table('tb_motor')->insert([
        ['id_motor' => 1, 'motor' => 'Jet'],
        ['id_motor' => 2, 'motor' => 'Piston'],
    ]);
    $remota->table('tb_pernocta')->insert([
        ['id_pernocta' => 1, 'pernocta' => 1200],
        ['id_pernocta' => 2, 'pernocta' => 9999],
        ['id_pernocta' => 3, 'pernocta' => 500],
    ]);
    $remota->table('tb_transito2h')->insert([
        ['id_transito2h' => 1, 'transito' => 300],
        ['id_transito2h' => 2, 'transito' => 350],
        ['id_transito2h' => 3, 'transito' => 0],
    ]);
    $remota->table('tb_transito12h')->insert([
        ['id_transito12h' => 1, 'transito12' => 700],
        ['id_transito12h' => 2, 'transito12' => 750],
    ]);
    $remota->table('tb_aterrisaje')->insert([
        ['id_aterrizaje' => 1, 'aterrizaje' => 900],
        ['id_aterrizaje' => 2, 'aterrizaje' => 1500],
        ['id_aterrizaje' => 3, 'aterrizaje' => 400],
    ]);
    $remota->table('tb_combustible')->insert(['id_combustible' => 1, 'p_combustible' => 26.45, 'f_ini' => '2026-09-01', 'f_fin' => '2026-09-30', 'pasa' => 22.50]);

    $remota->table('tb_matricula')->insert([
        matriculaConTarifas('XA-A1', 1, 1, 1, 1, 1, 1),
        matriculaConTarifas('XA-A2', 1, 1, 1, 1, 1, 1),
        matriculaConTarifas('XA-A3', 1, 1, 2, 1, 1, 1),
        matriculaConTarifas('XA-A4', 1, 1, 1, 2, 2, 2),
        matriculaConTarifas('XA-A5', 1, 1, 1, 3, 1, 1),
        matriculaConTarifas('XA-SM', 1, 0, 1, 1, 1, 2),
        matriculaConTarifas('XA-BB1', 2, 2, 3, 1, 1, 3),
        matriculaConTarifas('XA-BB2', 2, 2, 1, 1, 1, 3),
        matriculaConTarifas('XA-SC', 0, 0, 0, 0, 0, 0),
    ]);
}

/** Las cuatro tarifas de cada matricula tal como las resuelve el origen, sin pasar por el importador. */
function tarifasDelOrigen(): array
{
    return DB::connection('remota')->table('tb_matricula as m')
        ->leftJoin('tb_pernocta as p', 'p.id_pernocta', '=', 'm.id_pernocta')
        ->leftJoin('tb_transito2h as t2', 't2.id_transito2h', '=', 'm.id_transito2h')
        ->leftJoin('tb_transito12h as t12', 't12.id_transito12h', '=', 'm.id_transito12h')
        ->leftJoin('tb_aterrisaje as a', 'a.id_aterrizaje', '=', 'm.id_aterrizaje')
        ->select('m.matricula', 'p.pernocta', 't2.transito as transito2h', 't12.transito12 as transito12h', 'a.aterrizaje')
        ->get()
        ->keyBy('matricula')
        ->map(fn ($f) => [
            'pernocta' => $f->pernocta === null ? null : (float) $f->pernocta,
            'transito2h' => $f->transito2h === null ? null : (float) $f->transito2h,
            'transito12h' => $f->transito12h === null ? null : (float) $f->transito12h,
            'aterrizaje' => $f->aterrizaje === null ? null : (float) $f->aterrizaje,
        ])
        ->all();
}

/** Filas de las tablas que toca el importador, sin marcas de tiempo, para comparar valores y no solo cuantas hay. */
function fotoLocal(): array
{
    $foto = fn (string $modelo) => $modelo::query()->orderBy('id')->get()
        ->map(fn ($m) => collect($m->getAttributes())->except(['created_at', 'updated_at'])->all())
        ->all();

    return [
        'tipos' => $foto(App\Models\TipoAeronave::class),
        'aeronaves' => $foto(Aeronave::class),
        'fact_aeronaves' => $foto(FactAeronave::class),
        'categorias' => $foto(FactCategoriaAeronave::class),
        'motores' => $foto(App\Models\FactTipoMotor::class),
        'precios' => $foto(FactPrecioCombustible::class),
    ];
}

beforeEach(fn () => prepararBaseLegacy());

/*
 * La invariante que justifica el diseno entero: para cada matricula y cada una
 * de las cuatro tarifas, lo que resuelve Eolo-plus es exactamente lo que cobra
 * el origen. Se compara contra el origen, no contra lo que el importador cree.
 */
test('el cobro efectivo de cada matricula y cada tarifa es igual al del origen', function () {
    sembrarOrigenRico();

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    $origen = tarifasDelOrigen();
    $comparadas = 0;

    foreach ($origen as $matricula => $esperado) {
        $fact = Aeronave::where('matricula', $matricula)->first()->facturacion;

        $efectivo = [
            'pernocta' => $fact->tarifaPernocta(),
            'transito2h' => $fact->tarifaTransito2h(),
            'transito12h' => $fact->tarifaTransito12h(),
            'aterrizaje' => $fact->tarifaAterrizaje(),
        ];

        foreach ($esperado as $campo => $valor) {
            expect($efectivo[$campo] === null ? null : (float) $efectivo[$campo])
                ->toBe($valor, "{$matricula} / {$campo}");
            $comparadas++;
        }
    }

    // Que la prueba no sea vacia: 9 matriculas por 4 tarifas.
    expect($comparadas)->toBe(36);
});

test('el origen rico ejercita coincidir en un campo, apartarse en otro, el empate y la falta de motor', function () {
    sembrarOrigenRico();

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    $fact = fn (string $m) => Aeronave::where('matricula', $m)->first()->facturacion;

    // A3 se aparta solo en pernocta.
    expect((float) $fact('XA-A3')->tarifa_pernocta)->toBe(9999.00)
        ->and($fact('XA-A3')->tarifa_transito_2h)->toBeNull()
        ->and($fact('XA-A3')->tarifa_transito_12h)->toBeNull()
        ->and($fact('XA-A3')->tarifa_aterrizaje)->toBeNull()
        // A4 coincide en pernocta y se aparta en el resto.
        ->and($fact('XA-A4')->tarifa_pernocta)->toBeNull()
        ->and((float) $fact('XA-A4')->tarifa_transito_2h)->toBe(350.00)
        ->and((float) $fact('XA-A4')->tarifa_transito_12h)->toBe(750.00)
        ->and((float) $fact('XA-A4')->tarifa_aterrizaje)->toBe(1500.00)
        // Un cero de cortesia es una tarifa propia.
        ->and((float) $fact('XA-A5')->tarifa_transito_2h)->toBe(0.00)
        // Empate en Ligera: gana el primero visto (500), el otro conserva 1200.
        ->and((float) FactCategoriaAeronave::where('nombre', 'Ligera')->first()->tarifa_pernocta)->toBe(500.00)
        ->and($fact('XA-BB1')->tarifa_pernocta)->toBeNull()
        ->and((float) $fact('XA-BB2')->tarifa_pernocta)->toBe(1200.00)
        // Sin motor: su aterrizaje es propio, y no cuenta como excepcion real del motor.
        ->and($fact('XA-SM')->tipo_motor_id)->toBeNull()
        ->and((float) $fact('XA-SM')->tarifa_aterrizaje)->toBe(1500.00);
});

/*
 * Los conteos distinguen excepciones reales (contra la moda de una categoria o
 * motor que existe) de las matriculas que no tienen categoria o motor contra
 * quien compararse: el numero se contrasta con el que se mide por SQL en el origen.
 */
test('los conteos de tarifa propia cuentan solo excepciones reales y separan sin categoria y sin motor', function () {
    sembrarOrigenRico();

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: false);

    // Estancia: A3 (pernocta), A4 (2h y 12h), A5 (2h en cero) y BB2 (pernocta).
    expect($resultado->conteos['matriculas_con_estancia_propia'])->toBe(4)
        // Aterrizaje: solo A4. XA-SM se aparta pero no tiene motor: se cuenta aparte.
        ->and($resultado->conteos['matriculas_con_aterrizaje_propio'])->toBe(1)
        ->and($resultado->conteos['matriculas_sin_motor'])->toBe(2)
        ->and($resultado->conteos['matriculas_sin_motor_con_aterrizaje_propio'])->toBe(1)
        ->and($resultado->conteos['matriculas_sin_categoria'])->toBe(1)
        ->and($resultado->conteos['matriculas_sin_categoria_con_tarifa_propia'])->toBe(0);
});

/*
 * En tb_matricula el d_vuelos = 0 es lo que dispara el cargo de $900 en el
 * sistema viejo, y d_vuelos = 1 lo exime.
 */
test('d_vuelos 0 cobra derecho de vuelos y d_vuelos 1 no', function () {
    sembrarLegacy([
        matriculaLegacy('XA-COBRA', dVuelos: 0),
        matriculaLegacy('XA-EXENTA', dVuelos: 1),
    ]);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(Aeronave::where('matricula', 'XA-COBRA')->first()->facturacion->cobra_derecho_vuelos)->toBeTrue()
        ->and(Aeronave::where('matricula', 'XA-EXENTA')->first()->facturacion->cobra_derecho_vuelos)->toBeFalse();
});

/*
 * El sistema viejo (insert22.php) resuelve las cuatro tarifas con un INNER JOIN
 * a las cuatro tablas: si falta CUALQUIERA, la consulta devuelve cero filas y
 * la matricula no factura ningun concepto de estancia. En Eolo-plus cada tarifa
 * se resuelve por su cuenta, asi que una matricula con alguna tarifa (o con
 * categoria o motor de donde heredarla) facturaria lo que el origen no. Ese
 * caso lleva renglon y conteo propios. Solo cuando en Eolo-plus tampoco resuelve
 * nada (las cuatro faltan y no hay categoria ni motor) ningun cobro cambia y
 * basta con contarlas.
 */
test('una tarifa colgante con categoria o motor donde caer lleva renglon propio y cuenta', function () {
    sembrarLegacy([
        matriculaLegacy('XA-AAA'),
        matriculaLegacy('XA-ROT', idPernocta: 99, idAterrizaje: 88),
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: false);

    $renglones = array_values(array_filter($resultado->hallazgos, fn ($h) => str_contains($h, 'XA-ROT')));

    expect($resultado->conteos['matriculas_con_tarifa_huerfana'])->toBe(1)
        ->and($renglones)->toHaveCount(1)
        ->and($renglones[0])->toContain('pernocta')->toContain('aterrizaje')
        ->and($renglones[0])->toContain('Ejecutiva')->toContain('Jet')
        ->and(implode(' ', $resultado->hallazgos))->not->toContain('XA-AAA');
});

test('una matricula sin categoria ni motor con tarifas en 0 no genera renglon individual, solo cuenta', function () {
    $sinNada = ['id_pernocta' => 0, 'id_transito2h' => 0, 'id_transito12h' => 0, 'id_aterrizaje' => 0, 'id_motor' => 0];

    sembrarLegacy([
        matriculaLegacy('XA-AAA'),
        array_merge(matriculaLegacy('XA-S1', idCategoria: 0), $sinNada),
        array_merge(matriculaLegacy('XA-S2', idCategoria: 0), $sinNada),
        matriculaLegacy('XA-ROT', idPernocta: 99),
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: false);

    $texto = implode("
", $resultado->hallazgos);

    // El unico numero que se lee es el de las que pueden cobrar distinto.
    expect($resultado->conteos['matriculas_con_tarifa_huerfana'])->toBe(1)
        ->and($resultado->conteos['matriculas_con_tarifa_huerfana_sin_destino'])->toBe(2)
        ->and($texto)->not->toContain('XA-S1')
        ->and($texto)->not->toContain('XA-S2')
        ->and($texto)->toContain('XA-ROT')
        // Una sola linea de resumen, y no promete herencia que no existe.
        ->and(array_values(array_filter($resultado->hallazgos, fn ($h) => str_contains($h, '2 matrículas'))))->toHaveCount(1);
});

test('con categoria, estancia resuelta y aterrizaje colgante sin motor, la matricula no era facturable en el origen y lleva renglon', function () {
    // El caso que la regla vieja dejaba pasar sin decir nada: las tres tarifas
    // de estancia resuelven, el aterrizaje cuelga y no hay motor donde caer. El
    // INNER JOIN del origen devuelve cero filas: no facturaba nada. Aqui
    // facturaria las tres de estancia.
    sembrarLegacy([
        matriculaLegacy('XA-AAA'),
        array_merge(matriculaLegacy('XA-SM'), ['id_motor' => 0, 'id_aterrizaje' => 77]),
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: false);

    $renglones = array_values(array_filter($resultado->hallazgos, fn ($h) => str_contains($h, 'XA-SM')));

    expect($resultado->conteos['matriculas_con_tarifa_huerfana'])->toBe(1)
        ->and($resultado->conteos['matriculas_con_tarifa_huerfana_sin_destino'])->toBe(0)
        ->and($renglones)->toHaveCount(1)
        ->and($renglones[0])->toContain('no era facturable en el origen')
        ->and($renglones[0])->toContain('INNER JOIN')
        // Lo que falta, y lo que Eolo-plus si cobraria.
        ->and($renglones[0])->toContain('le faltan aterrizaje')
        ->and($renglones[0])->toContain('pernocta, tránsito de 2h, tránsito de 12h con su tarifa del origen')
        ->and($renglones[0])->toContain('puede cobrar distinto')
        // Sin motor, no promete herencia del motor.
        ->and($renglones[0])->not->toContain('heredado del motor')
        // Y no se dice que ningun cobro cambia: no es verdad para esta.
        ->and(implode(' ', $resultado->hallazgos))->not->toContain('ningún cobro cambia');
});

test('sin categoria ni motor, con estancia resuelta y aterrizaje colgante, tambien lleva renglon', function () {
    sembrarLegacy([
        matriculaLegacy('XA-AAA'),
        array_merge(matriculaLegacy('XA-SC', idCategoria: 0), ['id_motor' => 0, 'id_aterrizaje' => 77]),
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: false);

    expect($resultado->conteos['matriculas_con_tarifa_huerfana'])->toBe(1)
        ->and($resultado->conteos['matriculas_con_tarifa_huerfana_sin_destino'])->toBe(0)
        ->and(implode(' ', $resultado->hallazgos))->toContain('XA-SC');
});

test('con las cuatro tarifas completas no lleva renglon de facturabilidad', function () {
    sembrarLegacy([matriculaLegacy('XA-AAA'), matriculaLegacy('XA-BBB')]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: false);

    expect($resultado->conteos['matriculas_con_tarifa_huerfana'])->toBe(0)
        ->and($resultado->conteos['matriculas_con_tarifa_huerfana_sin_destino'])->toBe(0)
        ->and(implode(' ', $resultado->hallazgos))->not->toContain('no era facturable');
});

test('la simulacion cuenta lo que traeria pero no escribe nada', function () {
    sembrarLegacy([matriculaLegacy('XA-AAA'), matriculaLegacy('XA-BBB')]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: false);

    expect($resultado->conteos['matriculas'])->toBe(2)
        ->and($resultado->aplicado)->toBeFalse()
        ->and(Aeronave::count())->toBe(0)
        ->and(FactAeronave::count())->toBe(0)
        ->and(FactCategoriaAeronave::count())->toBe(0);
});

test('aplicar trae matriculas, tipos, categorias y tarifas', function () {
    sembrarLegacy([matriculaLegacy('XA-AAA')]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    $aeronave = Aeronave::where('matricula', 'XA-AAA')->first();
    $categoria = FactCategoriaAeronave::first();

    expect($resultado->aplicado)->toBeTrue()
        ->and($aeronave)->not->toBeNull()
        ->and($aeronave->tipoAeronave->nombre)->toBe('Learjet 45')
        ->and($aeronave->facturacion->categoria->nombre)->toBe('Ejecutiva')
        ->and((float) $categoria->tarifa_pernocta)->toBe(1200.00)
        ->and((float) $categoria->tarifa_transito_12h)->toBe(700.00);
});

test('correrlo dos veces deja el mismo resultado, en valores y no solo en filas', function () {
    // Con usuario, para que se ejecute la rama del combustible; y con el origen
    // rico, para que haya tarifas propias que la segunda corrida podria alterar.
    User::factory()->create();
    sembrarOrigenRico();

    $primera = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);
    $despuesDeLaPrimera = fotoLocal();

    $segunda = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(fotoLocal())->toBe($despuesDeLaPrimera)
        ->and($despuesDeLaPrimera['precios'])->toHaveCount(1)
        ->and($despuesDeLaPrimera['fact_aeronaves'])->toHaveCount(9)
        // La segunda corrida recorre la rama "ya hay precio importado" y lo cuenta igual.
        ->and($segunda->conteos['precios_combustible'])->toBe(1)
        ->and($segunda->hallazgos)->toBe($primera->hallazgos);
});

test('reporta cuando dos matriculas de la misma categoria tienen tarifas distintas', function () {
    // El sistema viejo copia las tarifas con LIMIT 1: si divergen, el modelo
    // "tarifa por categoria" no se sostiene para todas.
    sembrarLegacy([
        matriculaLegacy('XA-AAA', idPernocta: 1),
        matriculaLegacy('XA-BBB', idPernocta: 2),
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: false);

    expect(implode(' ', $resultado->hallazgos))->toContain('Ejecutiva');
});

test('las matriculas sin categoria se importan sin clasificar y se cuentan', function () {
    sembrarLegacy([matriculaLegacy('XA-SIN', idCategoria: 0)]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(Aeronave::where('matricula', 'XA-SIN')->first()->facturacion->categoria_aeronave_id)->toBeNull()
        ->and($resultado->conteos['matriculas_sin_categoria'])->toBe(1)
        ->and(FactCategoriaAeronave::count())->toBe(0);
});

test('las matriculas repetidas se reportan y se importan una sola vez', function () {
    sembrarLegacy([matriculaLegacy('XA-DUP'), matriculaLegacy('XA-DUP')]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(Aeronave::where('matricula', 'XA-DUP')->count())->toBe(1)
        ->and(implode(' ', $resultado->hallazgos))->toContain('XA-DUP');
});

test('el precio de combustible llega con sus dos precios', function () {
    User::factory()->create();
    sembrarLegacy([matriculaLegacy('XA-AAA')]);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    $precio = FactPrecioCombustible::vigente();

    expect((float) $precio->precio_asa)->toBe(22.50)
        ->and((float) $precio->precio_eolo)->toBe(26.45);
});

test('el combustible no se importa si ya hay un precio local, para no pisar uno capturado despues', function () {
    $usuario = User::factory()->create();
    FactPrecioCombustible::registrar(30.00, 35.00, $usuario->id);
    sembrarLegacy([matriculaLegacy('XA-AAA')]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactPrecioCombustible::count())->toBe(1)
        ->and((float) FactPrecioCombustible::vigente()->precio_asa)->toBe(30.00)
        ->and(implode(' ', $resultado->hallazgos))->toContain('combustible');
});

/*
 * Estatus: en tb_estatus, id 1 = "Transito" (793 matriculas reales) e id 2 =
 * "Guarda" (30). El sistema viejo cobra estancia al transito, no a la guarda.
 * Invertirlo cobraria mal a las 823 matriculas.
 */
test('el estatus 1 del sistema viejo es transito y el 2 es guarda', function () {
    sembrarLegacy([
        matriculaLegacy('XA-TRA', idEstatus: 1),
        matriculaLegacy('XA-GUA', idEstatus: 2),
    ]);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    $transito = Aeronave::where('matricula', 'XA-TRA')->first()->facturacion;
    $guarda = Aeronave::where('matricula', 'XA-GUA')->first()->facturacion;

    expect($transito->estatus)->toBe(FactAeronave::ESTATUS_TRANSITO)
        ->and($transito->estatus)->toBe('transito')
        ->and($guarda->estatus)->toBe(FactAeronave::ESTATUS_GUARDA)
        ->and($guarda->estatus)->toBe('guarda');
});

test('un estatus desconocido se importa como guarda y se reporta', function () {
    sembrarLegacy([matriculaLegacy('XA-RAR', idEstatus: 7)]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(Aeronave::where('matricula', 'XA-RAR')->first()->facturacion->estatus)->toBe('guarda')
        ->and(implode(' ', $resultado->hallazgos))->toContain('XA-RAR');
});

/*
 * El 94.6% cobra la tarifa de su categoria; el resto tiene la suya. La columna
 * propia solo se llena cuando la matricula se aparta de la moda de su categoria
 * (o de su motor, en el aterrizaje); si no, queda en NULL.
 */
test('la matricula que sigue la moda queda con las tarifas propias en NULL', function () {
    sembrarLegacy([
        matriculaLegacy('XA-AAA'),
        matriculaLegacy('XA-BBB'),
        matriculaLegacy('XA-CCC', idPernocta: 2),
    ]);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    $sigueLaModa = Aeronave::where('matricula', 'XA-AAA')->first()->facturacion;

    expect($sigueLaModa->tarifa_pernocta)->toBeNull()
        ->and($sigueLaModa->tarifa_transito_2h)->toBeNull()
        ->and($sigueLaModa->tarifa_transito_12h)->toBeNull()
        ->and($sigueLaModa->tarifa_aterrizaje)->toBeNull()
        ->and((float) $sigueLaModa->tarifaPernocta())->toBe(1200.00);
});

test('la matricula que se aparta de la moda conserva su tarifa propia', function () {
    sembrarLegacy([
        matriculaLegacy('XA-AAA'),
        matriculaLegacy('XA-BBB'),
        matriculaLegacy('XA-CCC', idPernocta: 2, idAterrizaje: 2),
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    $propia = Aeronave::where('matricula', 'XA-CCC')->first()->facturacion;

    expect((float) FactCategoriaAeronave::first()->tarifa_pernocta)->toBe(1200.00)
        ->and((float) $propia->tarifa_pernocta)->toBe(9999.00)
        ->and((float) $propia->tarifa_aterrizaje)->toBe(1500.00)
        // Lo que no se aparta de la moda queda en NULL aunque otra tarifa si se aparte.
        ->and($propia->tarifa_transito_2h)->toBeNull()
        ->and($propia->tarifa_transito_12h)->toBeNull()
        ->and((float) $propia->tarifaPernocta())->toBe(9999.00)
        ->and((float) $propia->tarifaTransito2h())->toBe(300.00)
        ->and((float) $propia->tarifaAterrizaje())->toBe(1500.00)
        ->and($resultado->conteos['matriculas_con_estancia_propia'])->toBe(1)
        ->and($resultado->conteos['matriculas_con_aterrizaje_propio'])->toBe(1);
});

test('una tarifa propia en cero es una tarifa y se conserva', function () {
    sembrarLegacy([
        matriculaLegacy('XA-AAA'),
        matriculaLegacy('XA-BBB'),
        matriculaLegacy('XA-CER', idPernocta: 3),
    ]);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    $cortesia = Aeronave::where('matricula', 'XA-CER')->first()->facturacion;

    expect($cortesia->tarifa_pernocta)->not->toBeNull()
        ->and((float) $cortesia->tarifa_pernocta)->toBe(0.00)
        ->and((float) $cortesia->tarifaPernocta())->toBe(0.00);
});

test('una matricula con una tarifa que no existe en el origen no inventa una propia y se reporta', function () {
    sembrarLegacy([
        matriculaLegacy('XA-AAA'),
        matriculaLegacy('XA-BBB'),
        matriculaLegacy('XA-ROT', idPernocta: 99),
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(Aeronave::where('matricula', 'XA-ROT')->first()->facturacion->tarifa_pernocta)->toBeNull()
        ->and(implode(' ', $resultado->hallazgos))->toContain('XA-ROT');
});

test('una matricula sin categoria conserva sus tarifas de estancia como propias', function () {
    sembrarLegacy([matriculaLegacy('XA-SIN', idCategoria: 0, idPernocta: 2)]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    $fact = Aeronave::where('matricula', 'XA-SIN')->first()->facturacion;

    expect($fact->categoria_aeronave_id)->toBeNull()
        ->and((float) $fact->tarifa_pernocta)->toBe(9999.00)
        ->and((float) $fact->tarifa_transito_2h)->toBe(300.00)
        ->and($resultado->conteos['matriculas_sin_categoria'])->toBe(1)
        // No es una excepcion contra una categoria: se cuenta aparte.
        ->and($resultado->conteos['matriculas_sin_categoria_con_tarifa_propia'])->toBe(1)
        ->and($resultado->conteos['matriculas_con_estancia_propia'])->toBe(0);
});

/*
 * Una matricula dada de alta por captura antes de la migracion que cambio el
 * estatus por omision tiene el estatus viejo. updateOrCreate la corrige.
 */
test('una fila de facturacion que ya existia se corrige, incluidas las tarifas propias viejas', function () {
    $existente = Aeronave::create(['matricula' => 'XA-AAA']);
    FactAeronave::create([
        'aeronave_id' => $existente->id,
        'estatus' => 'guarda',
        'tarifa_pernocta' => 5.00,
    ]);
    sembrarLegacy([matriculaLegacy('XA-AAA', idEstatus: 1)]);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    $fact = FactAeronave::where('aeronave_id', $existente->id)->first();

    expect(FactAeronave::count())->toBe(1)
        ->and($fact->estatus)->toBe('transito')
        ->and($fact->tarifa_pernocta)->toBeNull()
        ->and($fact->categoria->nombre)->toBe('Ejecutiva');
});

test('una matricula dada de alta sin tipo recibe el del sistema viejo, pero no se le pisa uno que ya tenia', function () {
    Aeronave::create(['matricula' => 'XA-SIN-TIPO']);
    $otroTipo = TipoAeronave::create(['nombre' => 'King Air']);
    Aeronave::create(['matricula' => 'XA-CON-TIPO', 'aeronave_id' => $otroTipo->id]);
    sembrarLegacy([matriculaLegacy('XA-SIN-TIPO'), matriculaLegacy('XA-CON-TIPO')]);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(Aeronave::where('matricula', 'XA-SIN-TIPO')->first()->tipoAeronave->nombre)->toBe('Learjet 45')
        ->and(Aeronave::where('matricula', 'XA-CON-TIPO')->first()->tipoAeronave->nombre)->toBe('King Air');
});

test('las matriculas locales que el sistema viejo no conoce se reportan', function () {
    Aeronave::create(['matricula' => 'XA-LOC']);
    sembrarLegacy([matriculaLegacy('XA-AAA')]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: false);

    expect(implode(' ', $resultado->hallazgos))->toContain('XA-LOC');
});

test('el comando simula por omision y solo escribe con --aplicar', function () {
    sembrarLegacy([matriculaLegacy('XA-AAA')]);

    $this->artisan('facturacion:importar-matriculas')
        ->expectsOutputToContain('Simulación')
        ->assertSuccessful();

    expect(Aeronave::count())->toBe(0);

    $this->artisan('facturacion:importar-matriculas', ['--aplicar' => true])->assertSuccessful();

    expect(Aeronave::count())->toBe(1);
});

test('el comando avisa y falla limpio cuando no alcanza la base de origen', function () {
    config(['database.connections.remota.database' => base_path('tests/remota-bloqueada-en-pruebas/no-existe.sqlite')]);
    DB::purge('remota');

    $this->artisan('facturacion:importar-matriculas')
        ->expectsOutputToContain('No se pudo completar')
        ->assertFailed();
});

/*
 * Volver a aplicar sobreescribe estatus, categoria, motor, cobra_derecho_vuelos
 * y las tarifas propias de todas las matriculas. Si alguien edito algo desde la
 * aplicacion despues del arranque, se perderia sin aviso.
 */
test('--aplicar se niega cuando fact_aeronaves ya tiene filas y dice cuantas', function () {
    sembrarLegacy([matriculaLegacy('XA-AAA')]);
    $aeronave = Aeronave::create(['matricula' => 'XA-EXISTE']);
    FactAeronave::create(['aeronave_id' => $aeronave->id, 'estatus' => 'guarda']);

    $this->artisan('facturacion:importar-matriculas', ['--aplicar' => true])
        ->expectsOutputToContain('1 filas')
        ->assertFailed();

    // No escribio nada: ni la matricula nueva ni cambios a la existente.
    expect(Aeronave::where('matricula', 'XA-AAA')->exists())->toBeFalse()
        ->and(FactAeronave::first()->estatus)->toBe('guarda');
});

test('--aplicar --forzar corre aunque fact_aeronaves ya tenga filas', function () {
    sembrarLegacy([matriculaLegacy('XA-AAA')]);
    $aeronave = Aeronave::create(['matricula' => 'XA-EXISTE']);
    FactAeronave::create(['aeronave_id' => $aeronave->id, 'estatus' => 'guarda']);

    $this->artisan('facturacion:importar-matriculas', ['--aplicar' => true, '--forzar' => true])
        ->assertSuccessful();

    expect(Aeronave::where('matricula', 'XA-AAA')->exists())->toBeTrue();
});

test('la simulacion avisa cuantas filas existentes se verian afectadas pero no se niega', function () {
    sembrarLegacy([matriculaLegacy('XA-AAA')]);
    $aeronave = Aeronave::create(['matricula' => 'XA-EXISTE']);
    FactAeronave::create(['aeronave_id' => $aeronave->id, 'estatus' => 'guarda']);

    $this->artisan('facturacion:importar-matriculas')
        ->expectsOutputToContain('1 filas')
        ->assertSuccessful();
});

test('el comando falla limpio si fact_aeronaves no existe', function () {
    Schema::drop('fact_aeronaves');
    sembrarLegacy([matriculaLegacy('XA-AAA')]);

    $this->artisan('facturacion:importar-matriculas')
        ->expectsOutputToContain('No se pudo completar')
        ->assertFailed();
});

/*
 * updateOrCreate(['nombre' => ...]) sobre una columna unica con collation
 * utf8mb4_unicode_ci funde dos categorias (o motores) del origen que se llamen
 * igual o solo difieran en caja o acentos: la segunda pisaria las tarifas de la
 * primera y las matriculas de la primera heredarian las de la segunda. Cobro
 * distinto sin un solo hallazgo. Se reporta, igual que con los tipos.
 */
function sembrarOrigenBase(): void
{
    $remota = DB::connection('remota');
    $remota->table('tb_tipo')->insert(['id_tipo' => 1, 'tipo' => 'Learjet 45']);
    $remota->table('tb_pernocta')->insert([['id_pernocta' => 1, 'pernocta' => 100], ['id_pernocta' => 2, 'pernocta' => 200]]);
    $remota->table('tb_transito2h')->insert(['id_transito2h' => 1, 'transito' => 10]);
    $remota->table('tb_transito12h')->insert(['id_transito12h' => 1, 'transito12' => 20]);
    $remota->table('tb_aterrisaje')->insert([['id_aterrizaje' => 1, 'aterrizaje' => 30], ['id_aterrizaje' => 2, 'aterrizaje' => 40]]);
}

test('dos categorias del origen con el mismo nombre, o que solo difieren en caja o acentos, se reportan', function () {
    sembrarOrigenBase();
    $remota = DB::connection('remota');
    $remota->table('tb_categoria')->insert([
        ['id_categoria' => 1, 'categoria' => 'Ejecutiva'],
        ['id_categoria' => 2, 'categoria' => 'ejecutiva'],
        ['id_categoria' => 3, 'categoria' => 'Ligera'],
        ['id_categoria' => 4, 'categoria' => 'Ligéra'],
        ['id_categoria' => 5, 'categoria' => 'Pesada'],
        ['id_categoria' => 6, 'categoria' => 'Ejecutiva'],
    ]);
    $remota->table('tb_motor')->insert(['id_motor' => 1, 'motor' => 'Jet']);
    $remota->table('tb_matricula')->insert([
        matriculaConTarifas('XA-E1', 1, 1, 1, 1, 1, 1),
        matriculaConTarifas('XA-E2', 2, 1, 2, 1, 1, 1),
        matriculaConTarifas('XA-L1', 3, 1, 1, 1, 1, 1),
        matriculaConTarifas('XA-L2', 4, 1, 2, 1, 1, 1),
        matriculaConTarifas('XA-P1', 5, 1, 1, 1, 1, 1),
        matriculaConTarifas('XA-E3', 6, 1, 1, 1, 1, 1),
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: false);

    $texto = implode("\n", $resultado->hallazgos);

    expect($texto)->toContain("Categoría duplicada con distinta escritura: 'Ejecutiva' y 'ejecutiva'")
        // Con acentos: solo lo detecta la llave que ignora acentos.
        ->and($texto)->toContain("Categoría duplicada con distinta escritura: 'Ligera' y 'Ligéra'")
        // Una tercera con el mismo nombre exacto tambien se reporta.
        ->and($texto)->toContain("Categoría duplicada con distinta escritura: 'ejecutiva' y 'Ejecutiva'")
        ->and($texto)->not->toContain("'Pesada' y")
        ->and($texto)->not->toContain("y 'Pesada'");
});

test('una categoria duplicada sin matriculas no se importa y por tanto no se reporta como duplicada', function () {
    sembrarOrigenBase();
    $remota = DB::connection('remota');
    $remota->table('tb_categoria')->insert([
        ['id_categoria' => 1, 'categoria' => 'Ejecutiva'],
        ['id_categoria' => 2, 'categoria' => 'EJECUTIVA'],
    ]);
    $remota->table('tb_motor')->insert(['id_motor' => 1, 'motor' => 'Jet']);
    $remota->table('tb_matricula')->insert([matriculaConTarifas('XA-E1', 1, 1, 1, 1, 1, 1)]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: false);

    // La segunda ni se importa (no tiene matriculas), asi que no se funde con nada.
    expect(implode(' ', $resultado->hallazgos))->not->toContain('Categoría duplicada');
});

test('dos motores del origen con el mismo nombre, o que solo difieren en caja o acentos, se reportan', function () {
    sembrarOrigenBase();
    $remota = DB::connection('remota');
    $remota->table('tb_categoria')->insert(['id_categoria' => 1, 'categoria' => 'Ejecutiva']);
    $remota->table('tb_motor')->insert([
        ['id_motor' => 1, 'motor' => 'Jet'],
        ['id_motor' => 2, 'motor' => 'JET'],
        ['id_motor' => 3, 'motor' => 'Turbohélice'],
        ['id_motor' => 4, 'motor' => 'Turbohelice'],
        ['id_motor' => 5, 'motor' => 'Piston'],
    ]);
    $remota->table('tb_matricula')->insert([
        matriculaConTarifas('XA-M1', 1, 1, 1, 1, 1, 1),
        matriculaConTarifas('XA-M2', 1, 2, 1, 1, 1, 2),
        matriculaConTarifas('XA-M3', 1, 3, 1, 1, 1, 1),
        matriculaConTarifas('XA-M4', 1, 4, 1, 1, 1, 2),
        matriculaConTarifas('XA-M5', 1, 5, 1, 1, 1, 1),
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: false);

    $texto = implode("\n", $resultado->hallazgos);

    expect($texto)->toContain("Motor duplicado con distinta escritura: 'Jet' y 'JET'")
        ->and($texto)->toContain("Motor duplicado con distinta escritura: 'Turbohélice' y 'Turbohelice'")
        ->and($texto)->not->toContain("'Piston' y")
        ->and($texto)->not->toContain("y 'Piston'");
});

test('categorias y motores distintos no generan hallazgo de duplicado', function () {
    sembrarOrigenRico();

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: false);

    expect(implode(' ', $resultado->hallazgos))->not->toContain('duplicad');
});

/*
 * La guarda de --forzar cubre todas las tablas que el importador toca, no solo
 * fact_aeronaves. fact_categorias_aeronave y fact_tipos_motor guardan tarifas
 * que se cobran y tienen pantalla de edicion: re-aplicar las pisaria en silencio.
 */
test('--aplicar se niega si solo fact_categorias_aeronave tiene filas y nombra la tabla', function () {
    sembrarLegacy([matriculaLegacy('XA-AAA')]);
    FactCategoriaAeronave::create(['nombre' => 'Ligera', 'tarifa_pernocta' => 500, 'tarifa_transito_2h' => 0, 'tarifa_transito_12h' => 0]);

    $this->artisan('facturacion:importar-matriculas', ['--aplicar' => true])
        ->expectsOutputToContain('fact_categorias_aeronave: 1 filas')
        ->assertFailed();

    expect(Aeronave::count())->toBe(0)
        ->and((float) FactCategoriaAeronave::first()->tarifa_pernocta)->toBe(500.0);
});

test('--aplicar se niega si solo fact_tipos_motor tiene filas', function () {
    sembrarLegacy([matriculaLegacy('XA-AAA')]);
    FactTipoMotor::create(['nombre' => 'Jet', 'tarifa_aterrizaje' => 900]);

    $this->artisan('facturacion:importar-matriculas', ['--aplicar' => true])
        ->expectsOutputToContain('fact_tipos_motor: 1 filas')
        ->assertFailed();

    expect(Aeronave::count())->toBe(0);
});

test('--aplicar se niega si solo hay un precio de combustible', function () {
    sembrarLegacy([matriculaLegacy('XA-AAA')]);
    FactPrecioCombustible::create(['precio_asa' => 1, 'precio_eolo' => 2, 'vigencia_inicio' => '2026-01-01', 'vigencia_fin' => null, 'user_id' => User::factory()->create()->id]);

    $this->artisan('facturacion:importar-matriculas', ['--aplicar' => true])
        ->expectsOutputToContain('fact_precios_combustible: 1 filas')
        ->assertFailed();
});

test('--aplicar se niega si un catalogo de facturacion ya tiene filas y distingue sobreescribe de agrega', function () {
    sembrarLegacy([matriculaLegacy('XA-AAA')]);
    FactCliente::create(['nombre' => 'Existente']);
    FactProveedor::create(['nombre' => 'EOLO']);

    $this->artisan('facturacion:importar-matriculas', ['--aplicar' => true])
        ->expectsOutputToContain('fact_clientes: 1 filas')
        ->expectsOutputToContain('fact_proveedores: 1 filas')
        ->expectsOutputToContain('Se sobreescriben')
        ->expectsOutputToContain('Solo se agrega lo que falta')
        ->assertFailed();

    expect(Aeronave::count())->toBe(0);
});

test('el mensaje de la guarda no dice que se sobreescribe lo que solo se agrega', function () {
    sembrarLegacy([matriculaLegacy('XA-AAA')]);
    FactFormaPago::create(['nombre' => 'Efectivo']);

    $this->artisan('facturacion:importar-matriculas', ['--aplicar' => true])
        ->expectsOutputToContain('fact_formas_pago: 1 filas')
        ->expectsOutputToContain('Solo se agrega lo que falta')
        ->doesntExpectOutputToContain('Se sobreescriben')
        ->assertFailed();
});

test('--forzar deja pasar aunque solo un catalogo de facturacion tenga filas', function () {
    sembrarLegacy([matriculaLegacy('XA-AAA')]);
    FactCategoriaServicio::create(['nombre' => 'Handling']);

    $this->artisan('facturacion:importar-matriculas', ['--aplicar' => true, '--forzar' => true])
        ->assertSuccessful();

    expect(Aeronave::where('matricula', 'XA-AAA')->exists())->toBeTrue();
});

test('la simulacion avisa de los catalogos con filas y no se niega', function () {
    sembrarLegacy([matriculaLegacy('XA-AAA')]);
    FactCliente::create(['nombre' => 'Existente']);

    $this->artisan('facturacion:importar-matriculas')
        ->expectsOutputToContain('fact_clientes: 1 filas')
        ->assertSuccessful();
});

test('sin filas en ninguna tabla --aplicar corre sin --forzar', function () {
    sembrarLegacy([matriculaLegacy('XA-AAA')]);

    $this->artisan('facturacion:importar-matriculas', ['--aplicar' => true])->assertSuccessful();

    expect(Aeronave::where('matricula', 'XA-AAA')->exists())->toBeTrue();
});
