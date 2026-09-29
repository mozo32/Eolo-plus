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
        ->and($aeronave->facturacion)->not->toBeNull();

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
    FactAeronave::create(['aeronave_id' => $guarda->id]);

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
