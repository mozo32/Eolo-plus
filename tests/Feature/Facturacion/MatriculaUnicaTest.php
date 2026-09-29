<?php
// tests/Feature/Facturacion/MatriculaUnicaTest.php

use App\Models\Aeronave;
use App\Models\FactAeronave;
use App\Models\TipoAeronave;
use App\Services\CatalogoAeronaves;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

test('la matricula no se puede repetir en el catalogo', function () {
    Aeronave::create(['matricula' => 'XA-UNICA']);

    expect(fn () => Aeronave::create(['matricula' => 'XA-UNICA']))
        ->toThrow(UniqueConstraintViolationException::class);
});

/*
 * Con el índice único, perder la carrera al dar de alta una matrícula lanza
 * UniqueConstraintViolationException en lugar de duplicar la fila. Esa
 * excepción no puede llegar al usuario como un 500: quien pierde debe releer
 * la fila que insertó la otra petición y seguir.
 *
 * SQLite no permite reproducir dos peticiones simultáneas, así que la petición
 * ganadora se simula insertando la fila competidora justo antes de que
 * buscarOCrear haga su propio insert.
 */
test('perder la carrera al crear la matricula no lanza y deja una sola fila', function () {
    $competidora = null;

    Aeronave::creating(function () use (&$competidora) {
        if ($competidora === null) {
            $competidora = DB::table('aeronaves')->insertGetId([
                'matricula' => 'XA-CARRERA',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    });

    try {
        $aeronave = app(CatalogoAeronaves::class)->buscarOCrear('xa-carrera', 'Learjet 45');
    } finally {
        Aeronave::flushEventListeners();
    }

    expect($competidora)->not->toBeNull()
        ->and(Aeronave::where('matricula', 'XA-CARRERA')->count())->toBe(1)
        ->and($aeronave->id)->toBe($competidora)
        ->and(FactAeronave::where('aeronave_id', $competidora)->count())->toBe(1);
});

test('quien pierde la carrera completa el tipo que la ganadora dejo vacio', function () {
    Aeronave::creating(function () {
        static $insertada = false;

        if (! $insertada) {
            $insertada = true;
            DB::table('aeronaves')->insert([
                'matricula' => 'XA-HUECOS',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    });

    try {
        $aeronave = app(CatalogoAeronaves::class)->buscarOCrear('XA-HUECOS', 'Bell 206');
    } finally {
        Aeronave::flushEventListeners();
    }

    expect(Aeronave::where('matricula', 'XA-HUECOS')->count())->toBe(1)
        ->and($aeronave->tipoAeronave?->nombre)->toBe('Bell 206')
        ->and(TipoAeronave::where('nombre', 'Bell 206')->count())->toBe(1);
});

test('perder la carrera al crear el registro de facturacion tampoco lanza', function () {
    $aeronave = Aeronave::create(['matricula' => 'XA-FACT']);
    $competidora = false;

    FactAeronave::creating(function () use ($aeronave, &$competidora) {
        if (! $competidora) {
            $competidora = true;
            DB::table('fact_aeronaves')->insert([
                'aeronave_id' => $aeronave->id,
                'estatus' => FactAeronave::ESTATUS_GUARDA,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    });

    try {
        $resultado = app(CatalogoAeronaves::class)->buscarOCrear('XA-FACT');
    } finally {
        FactAeronave::flushEventListeners();
    }

    // Se respeta el registro de la petición ganadora.
    expect($competidora)->toBeTrue()
        ->and($resultado->id)->toBe($aeronave->id)
        ->and(FactAeronave::where('aeronave_id', $aeronave->id)->count())->toBe(1)
        ->and(FactAeronave::where('aeronave_id', $aeronave->id)->value('estatus'))->toBe(FactAeronave::ESTATUS_GUARDA);
});

test('dos altas seguidas de la misma matricula dejan una sola fila', function () {
    $catalogo = app(CatalogoAeronaves::class);

    $primera = $catalogo->buscarOCrear('XA-DOS', 'Cessna 208');
    $segunda = $catalogo->buscarOCrear('xa-dos', 'Cessna 208');

    expect($segunda->id)->toBe($primera->id)
        ->and(Aeronave::where('matricula', 'XA-DOS')->count())->toBe(1)
        ->and(FactAeronave::count())->toBe(1);
});

/*
 * La migración del índice único es la última del bloque. En un servidor con
 * matrículas repetidas debe fallar con un mensaje que las liste, no con el
 * error crudo del motor a media migración.
 */
function migracionIndiceUnico(): Illuminate\Database\Migrations\Migration
{
    return require database_path('migrations/2026_09_29_099000_add_unique_matricula_to_aeronaves.php');
}

test('la migracion del indice unico es la ultima', function () {
    $ultima = collect(glob(database_path('migrations/*.php')))
        ->map(fn ($ruta) => basename($ruta))
        ->sort()
        ->last();

    expect($ultima)->toBe('2026_09_29_099000_add_unique_matricula_to_aeronaves.php');
});

test('la migracion del indice unico falla listando las matriculas repetidas', function () {
    $migracion = migracionIndiceUnico();
    $migracion->down();

    foreach (['XA-DUP1', 'XA-DUP1', 'XA-DUP1', 'XA-DUP2', 'XA-DUP2', 'XA-SOLA'] as $matricula) {
        DB::table('aeronaves')->insert(['matricula' => $matricula, 'created_at' => now(), 'updated_at' => now()]);
    }

    try {
        $migracion->up();
        $this->fail('La migración debió fallar por las matrículas repetidas.');
    } catch (RuntimeException $e) {
        expect($e->getMessage())
            ->toContain('XA-DUP1')
            ->toContain('XA-DUP2')
            ->not->toContain('XA-SOLA');
    }

    // Depuradas, la misma migración se aplica.
    DB::table('aeronaves')->whereIn('matricula', ['XA-DUP1', 'XA-DUP2'])->delete();
    $migracion->up();

    expect(fn () => Aeronave::create(['matricula' => 'XA-SOLA']))
        ->toThrow(UniqueConstraintViolationException::class);
});

test('la migracion del indice unico se aplica sin ruido cuando no hay repetidas', function () {
    $migracion = migracionIndiceUnico();
    $migracion->down();

    DB::table('aeronaves')->insert(['matricula' => 'XA-OK', 'created_at' => now(), 'updated_at' => now()]);

    $migracion->up();

    expect(fn () => Aeronave::create(['matricula' => 'XA-OK']))
        ->toThrow(UniqueConstraintViolationException::class);
});

/*
 * Si la relectura tras la violación no encuentra la fila, la causa verdadera
 * es la violación; un 404 (ModelNotFoundException) la escondería.
 */
test('si la relectura no encuentra la fila se propaga la violacion original', function () {
    Aeronave::creating(function () {
        throw new UniqueConstraintViolationException('sqlite', 'insert into aeronaves', [], new Exception('duplicado simulado'));
    });

    try {
        expect(fn () => app(CatalogoAeronaves::class)->buscarOCrear('XA-FANTASMA'))
            ->toThrow(UniqueConstraintViolationException::class, 'duplicado simulado');
    } finally {
        Aeronave::flushEventListeners();
    }
});

test('una violacion de unicidad al resolver el tipo no se toma por la de la matricula', function () {
    TipoAeronave::creating(function () {
        throw new UniqueConstraintViolationException('sqlite', 'insert into tipo_aeronaves', [], new Exception('tipo duplicado'));
    });

    try {
        expect(fn () => app(CatalogoAeronaves::class)->buscarOCrear('XA-TIPO', 'Modelo Nuevo'))
            ->toThrow(UniqueConstraintViolationException::class, 'tipo duplicado');
    } finally {
        TipoAeronave::flushEventListeners();
    }

    expect(Aeronave::where('matricula', 'XA-TIPO')->exists())->toBeFalse();
});
