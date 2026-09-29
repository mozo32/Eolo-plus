<?php
// tests/Feature/Facturacion/AltaAutomaticaMatriculaTest.php

use App\Models\Aeronave;
use App\Models\FactAeronave;
use App\Models\OperacionDiaria;
use App\Models\PernoctaDia;
use App\Models\TipoAeronave;
use App\Models\User;
use App\Models\WalkAround;
use App\Services\CatalogoAeronaves;

/*
 * Cinco controladores daban de alta matrículas en la base de Prefacturas
 * cuando no existían. Ahora lo hacen en el catálogo local por un solo camino.
 */

function capturarOperacionDiaria(string $matricula, string $equipo, string $movimiento = 'Llegada')
{
    return test()->postJson('/api/OperacionesDiarias', [
        'fecha' => '2026-09-28',
        'movimiento' => $movimiento,
        'matricula' => $matricula,
        'equipo' => $equipo,
        'hora' => '10:00',
        'pax' => 3,
        'departamento' => 'Trafico',
        'procedencia' => 'Toluca',
    ]);
}

function capturarWalkAround(string $matricula, string $tipo)
{
    return test()->postJson('/api/walkarounds', [
        'metadata' => [
            'fecha' => '2026-09-28',
            'movimiento' => 'entrada',
            'matricula' => $matricula,
            'tipo' => $tipo,
            'aeronave' => 'avion',
            'hora' => '10:00',
            'destino' => 'Toluca',
            'procedencia' => 'Monterrey',
        ],
        'cierreYFirmas' => [
            'nombreResponsable' => 'Responsable',
            'nombreJefe' => 'Jefe',
            'nombreFbo' => 'Fbo',
        ],
        'inspeccionTecnica' => ['numeroEstaticas' => 0],
    ]);
}

function capturarPernocta(string $matricula)
{
    return test()->postJson('/api/PernoctaDia', [[
        'fecha' => '2026-09-28',
        'matricula' => $matricula,
        'nombre' => 'Cliente',
        'ubicacion' => 'H1',
    ]]);
}

/** Deja la aeronave dentro del hangar para poder registrarle una pernocta. */
function aeronaveEnHangar(string $matricula): void
{
    OperacionDiaria::create([
        'user_id' => User::factory()->create()->id,
        'fecha' => '2026-09-28',
        'tipo' => 'llegada',
        'matricula' => $matricula,
        'equipo' => 'C172',
        'hora' => '08:00',
        'lugar' => 'MMTO',
        'pax' => 1,
        'departamento' => 'Trafico',
    ]);
}

test('capturar con una matricula nueva la agrega al catalogo local desde los cinco controladores', function () {
    $this->actingAs(User::factory()->create());

    // Operaciones Diarias: crea el tipo, la aeronave y su satélite.
    capturarOperacionDiaria('xa-nueva', 'Learjet 45')->assertCreated();

    $aeronave = Aeronave::where('matricula', 'XA-NUEVA')->first();
    expect($aeronave)->not->toBeNull()
        ->and($aeronave->tipoAeronave->nombre)->toBe('Learjet 45')
        ->and($aeronave->facturacion)->not->toBeNull()
        ->and($aeronave->facturacion->estatus)->toBe(FactAeronave::ESTATUS_TRANSITO);

    // Movimientos CSAE.
    $this->postJson('/api/MovimientosCSAE', [
        'fecha_hora_entrada' => '2026-09-28 10:00:00',
        'matricula' => 'XA-CSAE',
        'tipo_aeronave' => 'Cessna 208',
        'como_llega' => 'Vuelo',
        'transportista' => 'Aerolineas',
    ])->assertCreated();

    expect(Aeronave::where('matricula', 'XA-CSAE')->first()->tipoAeronave->nombre)->toBe('Cessna 208');

    // Servicio de Comisariato: la matrícula es opcional; sin ella no se da de alta nada.
    $this->postJson('/api/ServicioComisariato', [
        'fechaEntrega' => '2026-09-28',
        'horaEntrega' => '10:00',
        'matricula' => 'XA-COMI',
        'subtotal' => 100,
        'total' => 116,
    ])->assertCreated();

    $this->postJson('/api/ServicioComisariato', [
        'fechaEntrega' => '2026-09-28',
        'horaEntrega' => '11:00',
        'subtotal' => 100,
        'total' => 116,
    ])->assertCreated();

    expect(Aeronave::where('matricula', 'XA-COMI')->first()->facturacion)->not->toBeNull()
        ->and(Aeronave::whereNull('matricula')->orWhere('matricula', '')->count())->toBe(0);

    // WalkAround: el tipo capturado queda ligado a la aeronave nueva.
    capturarWalkAround('XA-WALK', 'Bell 206')->assertCreated();

    $walkAeronave = Aeronave::where('matricula', 'XA-WALK')->first();
    expect($walkAeronave->tipoAeronave->nombre)->toBe('Bell 206')
        ->and(WalkAround::first()->tipo_aeronave_id)->toBe($walkAeronave->aeronave_id);

    // Pernocta de una matrícula que el catálogo no conocía: se da de alta y
    // conserva el comportamiento anterior (tipo, estatus y categoría vacíos).
    aeronaveEnHangar('XA-PERN');
    capturarPernocta('XA-PERN')->assertCreated();

    $pernocta = PernoctaDia::first();
    expect(Aeronave::where('matricula', 'XA-PERN')->first()->facturacion)->not->toBeNull()
        ->and($pernocta->aeronave)->toBe('')
        ->and($pernocta->tipo_cliente)->toBe('')
        ->and($pernocta->categoria)->toBe('');

    // Todas quedaron en el mismo catálogo, una fila por matrícula.
    expect(Aeronave::count())->toBe(5)
        ->and(FactAeronave::count())->toBe(5);
});

test('capturar dos operaciones de la misma matricula no la duplica', function () {
    $this->actingAs(User::factory()->create());

    capturarOperacionDiaria('XA-REPE', 'Cessna 208', 'Llegada')->assertCreated();
    capturarOperacionDiaria('XA-REPE', 'Cessna 208', 'Salida')->assertCreated();

    $catalogo = app(CatalogoAeronaves::class);
    $catalogo->buscarOCrear('XA-REPE', 'Cessna 208');
    $catalogo->buscarOCrear('XA-REPE', 'Cessna 208');

    expect(Aeronave::where('matricula', 'XA-REPE')->count())->toBe(1)
        ->and(TipoAeronave::where('nombre', 'Cessna 208')->count())->toBe(1)
        ->and(FactAeronave::count())->toBe(1);
});

test('una matricula que ya existia no cambia de tipo y su estatus llega a pernocta con mayuscula inicial', function () {
    $this->actingAs(User::factory()->create());

    $tipo = TipoAeronave::create(['nombre' => 'Original']);
    $guarda = Aeronave::create(['matricula' => 'XA-VIEJA', 'aeronave_id' => $tipo->id]);
    FactAeronave::create(['aeronave_id' => $guarda->id, 'estatus' => FactAeronave::ESTATUS_GUARDA]);

    $transito = Aeronave::create(['matricula' => 'XA-PASO', 'aeronave_id' => $tipo->id]);
    FactAeronave::create(['aeronave_id' => $transito->id, 'estatus' => FactAeronave::ESTATUS_TRANSITO]);

    // La captura trae otro equipo: el catálogo manda y no se crea el tipo nuevo.
    capturarOperacionDiaria('XA-VIEJA', 'Otro')->assertCreated();

    expect(Aeronave::count())->toBe(2)
        ->and(Aeronave::where('matricula', 'XA-VIEJA')->first()->aeronave_id)->toBe($tipo->id)
        ->and(TipoAeronave::where('nombre', 'Otro')->exists())->toBeFalse();

    // El sistema anterior guardaba 'Guarda' y 'Transito'; Operaciones Diarias
    // filtra tipo_cliente por igualdad exacta, así que deben seguir igual.
    aeronaveEnHangar('XA-VIEJA');
    aeronaveEnHangar('XA-PASO');
    capturarPernocta('XA-VIEJA')->assertCreated();
    capturarPernocta('XA-PASO')->assertCreated();

    expect(PernoctaDia::where('matricula', 'XA-VIEJA')->first()->tipo_cliente)->toBe('Guarda')
        ->and(PernoctaDia::where('matricula', 'XA-PASO')->first()->tipo_cliente)->toBe('Transito')
        ->and(PernoctaDia::where('matricula', 'XA-PASO')->first()->aeronave)->toBe('Original');

    // Contrato hacia el frontend: mismas formas que devolvía la base remota
    // (una matrícula inexistente responde con un objeto vacío).
    $this->getJson('/api/OperacionesDiarias/buscar/XA-VIEJA')->assertOk()->assertExactJson(['tipo' => 'Original']);
    expect($this->getJson('/api/OperacionesDiarias/buscar/XA-NADA')->assertOk()->getContent())->toBe('{}');

    $this->getJson('/api/OperacionesDiarias/autocomplete?q=xa-v')
        ->assertOk()
        ->assertExactJson([['matricula' => ['matricula' => 'XA-VIEJA']]]);

    $this->getJson('/api/PernoctaDia/matriculas/buscar?q=xa-p')
        ->assertOk()
        ->assertExactJson(['XA-PASO']);

    $this->getJson('/api/walkarounds/buscar/XA-VIEJA')->assertOk()->assertExactJson(['tipo' => 'Original']);
});

test('una matricula recien creada nace en transito, el estatus del sistema viejo', function () {
    $aeronave = app(CatalogoAeronaves::class)->buscarOCrear('XA-NUEVA', 'Learjet 45');

    // En tb_estatus, id 1 = Transito y el alta antigua siempre usaba id_estatus = 1.
    expect($aeronave->facturacion->estatus)->toBe('transito')
        ->and(app(CatalogoAeronaves::class)->buscar('XA-NUEVA')->estatus)->toBe('transito');

    // El estatus lo fija el servicio, no depende del default de la base.
    expect(FactAeronave::where('aeronave_id', $aeronave->id)->value('estatus'))->toBe('transito');
});

test('una aeronave sin tipo aprende el primero que llega', function () {
    $catalogo = app(CatalogoAeronaves::class);

    $catalogo->buscarOCrear('XA-HUECO');
    expect(Aeronave::where('matricula', 'XA-HUECO')->first()->aeronave_id)->toBeNull();

    // Una captura sin tipo no lo inventa ni crea un tipo vacio.
    $catalogo->buscarOCrear('XA-HUECO', '  ');
    expect(Aeronave::where('matricula', 'XA-HUECO')->first()->aeronave_id)->toBeNull()
        ->and(TipoAeronave::count())->toBe(0);

    $aeronave = $catalogo->buscarOCrear('XA-HUECO', 'Bell 206');

    expect($aeronave->tipoAeronave->nombre)->toBe('Bell 206')
        ->and(Aeronave::where('matricula', 'XA-HUECO')->first()->aeronave_id)->toBe($aeronave->aeronave_id)
        ->and(Aeronave::count())->toBe(1)
        ->and(FactAeronave::count())->toBe(1);
});

test('una aeronave que ya tiene tipo lo conserva aunque llegue otro', function () {
    $catalogo = app(CatalogoAeronaves::class);

    $primera = $catalogo->buscarOCrear('XA-FIJA', 'Cessna 208');
    $segunda = $catalogo->buscarOCrear('XA-FIJA', 'Bell 206');

    expect($segunda->aeronave_id)->toBe($primera->aeronave_id)
        ->and($segunda->tipoAeronave->nombre)->toBe('Cessna 208')
        ->and(TipoAeronave::where('nombre', 'Bell 206')->exists())->toBeFalse();
});

test('un walkaround de una aeronave sin tipo le completa el tipo y guarda su id real', function () {
    $this->actingAs(User::factory()->create());

    // Alta previa por Comisariato, que no conoce el tipo.
    $this->postJson('/api/ServicioComisariato', [
        'fechaEntrega' => '2026-09-28',
        'horaEntrega' => '10:00',
        'matricula' => 'XA-SINTIPO',
        'subtotal' => 100,
        'total' => 116,
    ])->assertCreated();

    expect(Aeronave::where('matricula', 'XA-SINTIPO')->first()->aeronave_id)->toBeNull();

    capturarWalkAround('XA-SINTIPO', 'Bell 206')->assertCreated();

    $aeronave = Aeronave::where('matricula', 'XA-SINTIPO')->first();

    expect($aeronave->tipoAeronave->nombre)->toBe('Bell 206')
        ->and(WalkAround::first()->tipo_aeronave_id)->toBe($aeronave->aeronave_id)
        ->and(WalkAround::first()->tipo_aeronave_id)->not->toBe(0);
});

test('el lote de pernoctas da de alta las matriculas nuevas en orden alfabetico, sin alterar el orden ni el contenido de las pernoctas', function () {
    $this->actingAs(User::factory()->create());

    foreach (['XA-ZZZ', 'XA-MMM', 'XA-AAA'] as $matricula) {
        aeronaveEnHangar($matricula);
    }

    $pernocta = fn (string $matricula, string $fecha) => [
        'fecha' => $fecha,
        'matricula' => $matricula,
        'nombre' => 'Cliente',
        'ubicacion' => 'H1',
    ];

    // Orden del lote: Z, M, A y Z otra vez.
    $this->postJson('/api/PernoctaDia', [
        $pernocta('XA-ZZZ', '2026-09-28'),
        $pernocta('XA-MMM', '2026-09-28'),
        $pernocta('XA-AAA', '2026-09-28'),
        $pernocta('xa-zzz', '2026-09-29'),
    ])->assertCreated();

    // Las altas se hicieron en orden alfabetico (el orden de los ids lo
    // delata): asi todos los lotes toman los bloqueos del indice unico igual.
    $ids = Aeronave::whereIn('matricula', ['XA-AAA', 'XA-MMM', 'XA-ZZZ'])->pluck('id', 'matricula');
    expect($ids['XA-AAA'])->toBeLessThan($ids['XA-MMM'])
        ->and($ids['XA-MMM'])->toBeLessThan($ids['XA-ZZZ'])
        ->and(Aeronave::count())->toBe(3)
        ->and(FactAeronave::count())->toBe(3);

    // Las pernoctas se guardaron en el orden del lote y con el contenido de
    // siempre: la primera de cada matricula nueva sin estatus; la segunda de XA-ZZZ ya ve el catalogo.
    $pernoctas = PernoctaDia::orderBy('id')->get();
    expect($pernoctas->pluck('matricula')->all())->toBe(['XA-ZZZ', 'XA-MMM', 'XA-AAA', 'XA-ZZZ'])
        ->and($pernoctas->pluck('tipo_cliente')->all())->toBe(['', '', '', 'Transito']);
});
