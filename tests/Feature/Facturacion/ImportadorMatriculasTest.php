<?php
// tests/Feature/Facturacion/ImportadorMatriculasTest.php

use App\Models\Aeronave;
use App\Models\FactAeronave;
use App\Models\FactCategoriaAeronave;
use App\Models\FactPrecioCombustible;
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
        'd_vuelos' => 0,
    ];
}

beforeEach(fn () => prepararBaseLegacy());

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

test('correrlo dos veces deja el mismo resultado', function () {
    sembrarLegacy([matriculaLegacy('XA-AAA')]);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);
    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(Aeronave::count())->toBe(1)
        ->and(FactAeronave::count())->toBe(1)
        ->and(FactCategoriaAeronave::count())->toBe(1);
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
        ->and($resultado->conteos['matriculas_sin_categoria'])->toBe(1);
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
