<?php
// tests/Feature/Facturacion/AeronaveControllerLocalTest.php

use App\Models\Aeronave;
use App\Models\FactAeronave;
use App\Models\FactCategoriaAeronave;
use App\Models\TipoAeronave;
use App\Models\User;

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
