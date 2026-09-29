<?php
// tests/Feature/Facturacion/AeronaveControllerLocalTest.php

use App\Models\Aeronave;
use App\Models\FactAeronave;
use App\Models\FactCategoriaAeronave;
use App\Models\TipoAeronave;
use App\Models\User;
use App\Models\WalkAround;

test('buscar por matricula resuelve el tipo sin la base remota', function () {
    $tipo = TipoAeronave::create(['nombre' => 'Learjet 45']);
    $aeronave = Aeronave::create(['matricula' => 'XA-ABC', 'aeronave_id' => $tipo->id]);
    FactAeronave::create(['aeronave_id' => $aeronave->id]);

    $this->actingAs(User::factory()->create());

    $this->getJson('/api/aeronaves/buscar/XA-ABC')
        ->assertOk()
        ->assertJsonPath('matricula', 'XA-ABC')
        ->assertJsonPath('tipo', 'Learjet 45');

    // La ruta /aeronaves/tipo conserva su forma: {tipo: ...}, o un objeto vacio si no existe.
    $this->getJson('/api/aeronaves/tipo/XA-ABC')->assertOk()->assertExactJson(['tipo' => 'Learjet 45']);
    expect($this->getJson('/api/aeronaves/tipo/XA-NADA')->assertOk()->getContent())->toBe('{}');
});

test('buscar una matricula inexistente responde con el tipo nulo, sin romper', function () {
    $this->actingAs(User::factory()->create());

    $this->getJson('/api/aeronaves/buscar/XA-NADA')
        ->assertOk()
        ->assertJsonPath('matricula', 'XA-NADA')
        ->assertJsonPath('tipo', null);
});

test('el autocompletado lee del catalogo local', function () {
    foreach (['XA-AAA', 'XA-AAB', 'XB-CCC'] as $matricula) {
        Aeronave::create(['matricula' => $matricula]);
    }

    $this->actingAs(User::factory()->create());

    $respuesta = $this->getJson('/api/aeronaves/autocomplete?q=xa-aa')->assertOk()->json();

    expect(collect($respuesta)->pluck('matricula')->all())->toBe(['XA-AAA', 'XA-AAB']);
});

test('el autocompletado cruza con walk_arounds y trae el movimiento del ultimo activo', function () {
    foreach (['XA-AAA', 'XA-AAB'] as $matricula) {
        Aeronave::create(['matricula' => $matricula]);
    }

    $walk = fn (array $datos) => WalkAround::create($datos + [
        'matricula' => 'XA-AAA',
        'tipo' => 'avion',
        'tipo_aeronave' => 'C172',
        'tipo_aeronave_id' => 1,
        'status' => 'A',
    ]);

    // Mismo dia, hora anterior, con id menor: sin el desempate por hora, ganaria.
    $walk(['fecha' => '2026-05-10', 'hora' => '08:00', 'movimiento' => 'entrada']);
    // El ganador: ultima fecha y hora entre los activos.
    $walk(['fecha' => '2026-05-10', 'hora' => '09:00', 'movimiento' => 'salida']);
    // Fecha anterior.
    $walk(['fecha' => '2026-05-09', 'hora' => '23:00', 'movimiento' => 'entrada']);
    // El mas reciente de todos, pero inactivo: no debe contar.
    $walk(['fecha' => '2026-05-11', 'hora' => '12:00', 'movimiento' => 'entrada', 'status' => 'I']);

    $this->actingAs(User::factory()->create());

    $respuesta = $this->getJson('/api/aeronaves/autocomplete?q=xa-aa')->assertOk()->json();

    expect($respuesta)->toBe([
        ['matricula' => 'XA-AAA', 'movimiento' => 'salida'],
        // Sin walk-around no hay movimiento, pero la matricula sigue apareciendo.
        ['matricula' => 'XA-AAB', 'movimiento' => null],
    ]);
});

test('el autocompletado sin texto devuelve vacio', function () {
    Aeronave::create(['matricula' => 'XA-AAA']);
    $this->actingAs(User::factory()->create());

    $this->getJson('/api/aeronaves/autocomplete?q=')->assertOk()->assertJsonCount(0);
});

test('la categoria viaja en la respuesta cuando la matricula ya esta clasificada', function () {
    $aeronave = Aeronave::create(['matricula' => 'XA-DEF']);
    $categoria = FactCategoriaAeronave::create(['nombre' => 'Ejecutiva', 'tarifa_pernocta' => 1, 'tarifa_transito_2h' => 1, 'tarifa_transito_12h' => 1]);
    FactAeronave::create(['aeronave_id' => $aeronave->id, 'categoria_aeronave_id' => $categoria->id]);

    $this->actingAs(User::factory()->create());

    $this->getJson('/api/aeronaves/buscar/XA-DEF')->assertOk()->assertJsonPath('categoria', 'Ejecutiva');
});

test('el alta por POST /api/aeronaves pasa por el catalogo: matricula normalizada y con satelite', function () {
    $tipo = TipoAeronave::create(['nombre' => 'Learjet 45']);
    $this->actingAs(User::factory()->create());

    $respuesta = $this->postJson('/api/aeronaves', [
        'matricula' => ' xa-nue ',
        'tipo' => 'Learjet 45 XR',
        'tipoAeronave' => $tipo->id,
    ])->assertCreated()
        // Contrato: la fila de aeronaves tal cual, con la columna de texto libre
        // y sin relaciones colgadas.
        ->assertJsonPath('matricula', 'XA-NUE')
        ->assertJsonPath('aeronave_id', $tipo->id)
        ->assertJsonPath('tipo_aeronave', 'Learjet 45 XR')
        ->assertJsonStructure(['id', 'matricula', 'aeronave_id', 'tipo_aeronave', 'created_at', 'updated_at'])
        ->assertJsonMissingPath('facturacion')
        ->json();

    $aeronave = Aeronave::where('matricula', 'XA-NUE')->firstOrFail();
    expect($aeronave->id)->toBe($respuesta['id'])
        ->and(Aeronave::count())->toBe(1);

    // La fila satelite existe: sin ella no aparece en Aeronaves facturables.
    $satelite = FactAeronave::where('aeronave_id', $aeronave->id)->first();
    expect($satelite)->not->toBeNull()
        ->and($satelite->estatus)->toBe(FactAeronave::ESTATUS_TRANSITO);
});

test('el alta por POST /api/aeronaves con una matricula que ya existe no duplica ni rompe', function () {
    $tipo = TipoAeronave::create(['nombre' => 'Learjet 45']);
    $this->actingAs(User::factory()->create());

    // Una matricula existente se rechaza con 422, como antes.
    Aeronave::create(['matricula' => 'XA-YAA', 'aeronave_id' => $tipo->id]);
    $this->postJson('/api/aeronaves', ['matricula' => 'XA-YAA', 'tipo' => 'x', 'tipoAeronave' => $tipo->id])
        ->assertUnprocessable();

    // Distinta caja: el catalogo la reconoce (la validacion unique de SQLite
    // distingue caja, la de MySQL no) y no crea una segunda fila.
    $this->postJson('/api/aeronaves', ['matricula' => 'xa-yaa', 'tipo' => 'x', 'tipoAeronave' => $tipo->id]);
    expect(Aeronave::count())->toBe(1);
});
