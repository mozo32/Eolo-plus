<?php
// tests/Feature/Facturacion/EndpointsCatalogosTest.php

use App\Models\Aeronave;
use App\Models\Bitacora;
use App\Models\FactAeronave;
use App\Models\FactCategoriaAeronave;
use App\Models\FactPrecioCombustible;
use App\Models\FactTipoMotor;
use Database\Seeders\FacturacionSubdepartamentosSeeder;

function categoriaValida(array $extra = []): array
{
    return array_merge([
        'nombre' => 'Ejecutiva',
        'tarifa_pernocta' => 1200,
        'tarifa_transito_2h' => 300,
        'tarifa_transito_12h' => 700,
    ], $extra);
}

function motorValido(array $extra = []): array
{
    return array_merge(['nombre' => 'Turbina', 'tarifa_aterrizaje' => 450], $extra);
}

function satelite(string $matricula = 'XA-ABC'): FactAeronave
{
    $aeronave = Aeronave::create(['matricula' => $matricula]);

    return FactAeronave::create(['aeronave_id' => $aeronave->id]);
}

test('sin sesion no se puede consultar ni escribir', function () {
    $this->getJson('/api/facturacion/categorias-aeronave')->assertUnauthorized();
    $this->postJson('/api/facturacion/categorias-aeronave', categoriaValida())->assertUnauthorized();
});

test('consultar es abierto a autenticados pero escribir exige el subdepartamento', function () {
    $this->actingAs(usuarioSinAcceso());

    $this->getJson('/api/facturacion/categorias-aeronave')->assertOk();
    $this->getJson('/api/facturacion/tipos-motor')->assertOk();
    $this->getJson('/api/facturacion/precios-combustible')->assertOk();
    $this->getJson('/api/facturacion/precios-combustible/vigente')->assertOk();
    $this->getJson('/api/facturacion/aeronaves')->assertOk();

    $this->postJson('/api/facturacion/categorias-aeronave', categoriaValida())->assertForbidden();
    $this->postJson('/api/facturacion/tipos-motor', motorValido())->assertForbidden();
    $this->postJson('/api/facturacion/precios-combustible', ['precio_asa' => 22.5])->assertForbidden();
});

test('el rol admin escribe sin necesitar el subdepartamento', function () {
    $this->actingAs(usuarioAdmin());

    $this->postJson('/api/facturacion/categorias-aeronave', categoriaValida())->assertCreated();
});

test('con el subdepartamento se da de alta y queda en bitacora', function () {
    $this->actingAs(usuarioConSubdepartamento('factCategoriasAeronave', 'Facturacion'));

    $this->postJson('/api/facturacion/categorias-aeronave', categoriaValida())
        ->assertCreated()
        ->assertJsonPath('categoria.nombre', 'Ejecutiva');

    expect(FactCategoriaAeronave::count())->toBe(1)
        ->and(Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_CATALOGOS)->where('accion', Bitacora::ACCION_CREAR)->exists())->toBeTrue();
});

test('el subdepartamento de una pantalla no abre las demas', function () {
    $this->actingAs(usuarioConSubdepartamento('factTiposMotor', 'Facturacion'));

    $this->postJson('/api/facturacion/tipos-motor', motorValido())->assertCreated();
    $this->postJson('/api/facturacion/categorias-aeronave', categoriaValida())->assertForbidden();
    $this->postJson('/api/facturacion/precios-combustible', ['precio_asa' => 22.5])->assertForbidden();
});

test('el nombre repetido se rechaza con 422', function () {
    $this->actingAs(usuarioConSubdepartamento('factCategoriasAeronave', 'Facturacion'));
    FactCategoriaAeronave::create(categoriaValida());

    $this->postJson('/api/facturacion/categorias-aeronave', categoriaValida())
        ->assertStatus(422)
        ->assertJsonValidationErrors(['nombre']);
});

test('las tarifas negativas se rechazan', function () {
    $this->actingAs(usuarioConSubdepartamento('factCategoriasAeronave', 'Facturacion'));

    $this->postJson('/api/facturacion/categorias-aeronave', categoriaValida(['tarifa_pernocta' => -1]))
        ->assertStatus(422)
        ->assertJsonValidationErrors(['tarifa_pernocta']);
});

test('una tarifa en cero es valida en una categoria', function () {
    $this->actingAs(usuarioConSubdepartamento('factCategoriasAeronave', 'Facturacion'));

    $this->postJson('/api/facturacion/categorias-aeronave', categoriaValida(['tarifa_pernocta' => 0]))
        ->assertCreated();
});

test('editar una categoria valida el nombre contra las demas pero no contra si misma', function () {
    $this->actingAs(usuarioConSubdepartamento('factCategoriasAeronave', 'Facturacion'));
    $a = FactCategoriaAeronave::create(categoriaValida());
    FactCategoriaAeronave::create(categoriaValida(['nombre' => 'Ligera']));

    $this->putJson("/api/facturacion/categorias-aeronave/{$a->id}", categoriaValida(['tarifa_pernocta' => 1500]))
        ->assertOk();
    expect((float) $a->fresh()->tarifa_pernocta)->toBe(1500.0)
        ->and(Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_CATALOGOS)->where('accion', Bitacora::ACCION_ACTUALIZAR)->exists())->toBeTrue();

    $this->putJson("/api/facturacion/categorias-aeronave/{$a->id}", categoriaValida(['nombre' => 'Ligera']))
        ->assertStatus(422)
        ->assertJsonValidationErrors(['nombre']);
});

test('editar una categoria inexistente responde 404', function () {
    $this->actingAs(usuarioConSubdepartamento('factCategoriasAeronave', 'Facturacion'));

    $this->putJson('/api/facturacion/categorias-aeronave/999', categoriaValida())->assertNotFound();
});

test('desactivar es atomico: la segunda vez responde 409', function () {
    $this->actingAs(usuarioConSubdepartamento('factCategoriasAeronave', 'Facturacion'));
    $categoria = FactCategoriaAeronave::create(categoriaValida());

    $this->patchJson("/api/facturacion/categorias-aeronave/{$categoria->id}/desactivar")->assertOk();

    $this->patchJson("/api/facturacion/categorias-aeronave/{$categoria->id}/desactivar")
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_desactivada');

    expect($categoria->fresh()->status)->toBe('N')
        ->and(Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_CATALOGOS)->where('accion', Bitacora::ACCION_DESACTIVAR)->count())->toBe(1);
});

test('desactivar una categoria inexistente responde 404', function () {
    $this->actingAs(usuarioConSubdepartamento('factCategoriasAeronave', 'Facturacion'));

    $this->patchJson('/api/facturacion/categorias-aeronave/999/desactivar')->assertNotFound();
});

test('los tipos de motor se dan de alta, se editan y se desactivan con 409 la segunda vez', function () {
    $this->actingAs(usuarioConSubdepartamento('factTiposMotor', 'Facturacion'));

    $id = $this->postJson('/api/facturacion/tipos-motor', motorValido())
        ->assertCreated()
        ->assertJsonPath('tipo_motor.nombre', 'Turbina')
        ->json('tipo_motor.id');

    $this->postJson('/api/facturacion/tipos-motor', motorValido())->assertStatus(422)->assertJsonValidationErrors(['nombre']);
    $this->postJson('/api/facturacion/tipos-motor', motorValido(['nombre' => 'Piston', 'tarifa_aterrizaje' => -5]))
        ->assertStatus(422)->assertJsonValidationErrors(['tarifa_aterrizaje']);

    $this->putJson("/api/facturacion/tipos-motor/{$id}", motorValido(['tarifa_aterrizaje' => 0]))->assertOk();
    expect((float) FactTipoMotor::find($id)->tarifa_aterrizaje)->toBe(0.0);

    $this->patchJson("/api/facturacion/tipos-motor/{$id}/desactivar")->assertOk();
    $this->patchJson("/api/facturacion/tipos-motor/{$id}/desactivar")->assertStatus(409)->assertJsonPath('codigo', 'ya_desactivado');
    $this->patchJson('/api/facturacion/tipos-motor/999/desactivar')->assertNotFound();
});

test('el listado permite pedir solo las activas', function () {
    $this->actingAs(usuarioSinAcceso());
    FactCategoriaAeronave::create(categoriaValida());
    FactCategoriaAeronave::create(categoriaValida(['nombre' => 'Vieja', 'status' => 'N']));

    $this->getJson('/api/facturacion/categorias-aeronave')->assertJsonCount(2, 'categorias');
    $this->getJson('/api/facturacion/categorias-aeronave?activas=1')->assertJsonCount(1, 'categorias');
});

test('registrar un precio de combustible cierra el anterior', function () {
    $this->actingAs(usuarioConSubdepartamento('factCombustible', 'Facturacion'));

    $this->postJson('/api/facturacion/precios-combustible', ['precio_asa' => 22.50])->assertCreated();
    $this->postJson('/api/facturacion/precios-combustible', ['precio_asa' => 23.00])->assertCreated();

    $this->getJson('/api/facturacion/precios-combustible/vigente')
        ->assertOk()
        ->assertJsonPath('precio.precio_asa', '23.0000');

    expect(FactPrecioCombustible::whereNull('vigencia_fin')->count())->toBe(1)
        ->and(Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_CATALOGOS)->where('accion', Bitacora::ACCION_CREAR)->count())->toBe(2);
});

test('el precio Eolo se propone con la formula si no se manda', function () {
    $this->actingAs(usuarioConSubdepartamento('factCombustible', 'Facturacion'));

    $this->postJson('/api/facturacion/precios-combustible', ['precio_asa' => 22.50])
        ->assertCreated()
        ->assertJsonPath('precio.precio_eolo', '26.4500');
});

test('el precio Eolo mandado se respeta', function () {
    $this->actingAs(usuarioConSubdepartamento('factCombustible', 'Facturacion'));

    $this->postJson('/api/facturacion/precios-combustible', ['precio_asa' => 22.50, 'precio_eolo' => 30])
        ->assertCreated()
        ->assertJsonPath('precio.precio_eolo', '30.0000');
});

test('el precio de combustible debe ser un numero positivo', function () {
    $this->actingAs(usuarioConSubdepartamento('factCombustible', 'Facturacion'));

    $this->postJson('/api/facturacion/precios-combustible', [])->assertStatus(422)->assertJsonValidationErrors(['precio_asa']);
    $this->postJson('/api/facturacion/precios-combustible', ['precio_asa' => 0])->assertStatus(422)->assertJsonValidationErrors(['precio_asa']);
    $this->postJson('/api/facturacion/precios-combustible', ['precio_asa' => 'abc'])->assertStatus(422)->assertJsonValidationErrors(['precio_asa']);
    $this->postJson('/api/facturacion/precios-combustible', ['precio_asa' => 20, 'precio_eolo' => -1])->assertStatus(422)->assertJsonValidationErrors(['precio_eolo']);
});

test('sin precio registrado el vigente es null', function () {
    $this->actingAs(usuarioSinAcceso());

    $this->getJson('/api/facturacion/precios-combustible/vigente')->assertOk()->assertJsonPath('precio', null);
});

test('asignar categoria y motor a una matricula exige su propio subdepartamento', function () {
    $satelite = satelite();
    $categoria = FactCategoriaAeronave::create(categoriaValida());

    $this->actingAs(usuarioConSubdepartamento('factCategoriasAeronave', 'Facturacion'));
    $this->putJson("/api/facturacion/aeronaves/{$satelite->id}", ['categoria_aeronave_id' => $categoria->id, 'estatus' => 'guarda', 'cobra_derecho_vuelos' => true])
        ->assertForbidden();

    $this->actingAs(usuarioConSubdepartamento('factAeronaves', 'Facturacion'));
    $this->putJson("/api/facturacion/aeronaves/{$satelite->id}", ['categoria_aeronave_id' => $categoria->id, 'estatus' => 'transito', 'cobra_derecho_vuelos' => false])
        ->assertOk();

    expect($satelite->fresh()->estatus)->toBe('transito')
        ->and($satelite->fresh()->cobra_derecho_vuelos)->toBeFalse()
        ->and($satelite->fresh()->categoria_aeronave_id)->toBe($categoria->id);
});

test('una matricula nueva queda en transito y el endpoint lo publica', function () {
    $satelite = satelite();
    $this->actingAs(usuarioSinAcceso());

    expect($satelite->fresh()->estatus)->toBe('transito');

    $this->getJson('/api/facturacion/aeronaves')
        ->assertOk()
        ->assertJsonPath('data.0.matricula', 'XA-ABC')
        ->assertJsonPath('data.0.estatus', 'transito');
});

test('el estatus solo admite guarda o transito', function () {
    $satelite = satelite();
    $this->actingAs(usuarioConSubdepartamento('factAeronaves', 'Facturacion'));

    $this->putJson("/api/facturacion/aeronaves/{$satelite->id}", ['estatus' => 'otro', 'cobra_derecho_vuelos' => true])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['estatus']);
});

test('las tarifas propias de la matricula se guardan y el cero es valido', function () {
    $satelite = satelite();
    $this->actingAs(usuarioConSubdepartamento('factAeronaves', 'Facturacion'));

    $this->putJson("/api/facturacion/aeronaves/{$satelite->id}", [
        'estatus' => 'guarda',
        'cobra_derecho_vuelos' => true,
        'tarifa_pernocta' => 0,
        'tarifa_transito_2h' => 250.5,
        'tarifa_transito_12h' => 600,
        'tarifa_aterrizaje' => 0,
    ])->assertOk();

    $fresco = $satelite->fresh();
    expect($fresco->tarifa_pernocta)->toBe('0.00')
        ->and($fresco->tarifa_transito_2h)->toBe('250.50')
        ->and($fresco->tarifa_transito_12h)->toBe('600.00')
        ->and($fresco->tarifa_aterrizaje)->toBe('0.00')
        ->and($fresco->tarifaPernocta())->toBe('0.00');
});

test('las tarifas propias negativas se rechazan', function () {
    $satelite = satelite();
    $this->actingAs(usuarioConSubdepartamento('factAeronaves', 'Facturacion'));

    foreach (['tarifa_pernocta', 'tarifa_transito_2h', 'tarifa_transito_12h', 'tarifa_aterrizaje'] as $campo) {
        $this->putJson("/api/facturacion/aeronaves/{$satelite->id}", ['estatus' => 'guarda', 'cobra_derecho_vuelos' => true, $campo => -1])
            ->assertStatus(422)
            ->assertJsonValidationErrors([$campo]);
    }
});

test('mandar la tarifa propia como null la quita y vuelve a heredar', function () {
    $categoria = FactCategoriaAeronave::create(categoriaValida());
    $satelite = satelite();
    $satelite->update(['categoria_aeronave_id' => $categoria->id, 'tarifa_pernocta' => 999]);
    $this->actingAs(usuarioConSubdepartamento('factAeronaves', 'Facturacion'));

    $this->putJson("/api/facturacion/aeronaves/{$satelite->id}", [
        'categoria_aeronave_id' => $categoria->id,
        'estatus' => 'guarda',
        'cobra_derecho_vuelos' => true,
        'tarifa_pernocta' => null,
    ])->assertOk();

    expect($satelite->fresh()->tarifa_pernocta)->toBeNull()
        ->and($satelite->fresh()->tarifaPernocta())->toBe('1200.00');
});

test('no mandar una tarifa propia la deja como estaba', function () {
    $satelite = satelite();
    $satelite->update(['tarifa_pernocta' => 999]);
    $this->actingAs(usuarioConSubdepartamento('factAeronaves', 'Facturacion'));

    $this->putJson("/api/facturacion/aeronaves/{$satelite->id}", ['estatus' => 'guarda', 'cobra_derecho_vuelos' => true])
        ->assertOk();

    expect($satelite->fresh()->tarifa_pernocta)->toBe('999.00');
});

test('no se puede asignar una categoria o un motor dados de baja ni inexistentes', function () {
    $satelite = satelite();
    $baja = FactCategoriaAeronave::create(categoriaValida(['status' => 'N']));
    $motorBaja = FactTipoMotor::create(motorValido(['status' => 'N']));
    $this->actingAs(usuarioConSubdepartamento('factAeronaves', 'Facturacion'));

    $base = ['estatus' => 'guarda', 'cobra_derecho_vuelos' => true];

    $this->putJson("/api/facturacion/aeronaves/{$satelite->id}", $base + ['categoria_aeronave_id' => $baja->id])
        ->assertStatus(422)->assertJsonValidationErrors(['categoria_aeronave_id']);
    $this->putJson("/api/facturacion/aeronaves/{$satelite->id}", $base + ['categoria_aeronave_id' => 9999])
        ->assertStatus(422)->assertJsonValidationErrors(['categoria_aeronave_id']);
    $this->putJson("/api/facturacion/aeronaves/{$satelite->id}", $base + ['tipo_motor_id' => $motorBaja->id])
        ->assertStatus(422)->assertJsonValidationErrors(['tipo_motor_id']);
});

test('una matricula que ya tiene una categoria dada de baja puede conservarla', function () {
    $baja = FactCategoriaAeronave::create(categoriaValida(['status' => 'N']));
    $satelite = satelite();
    $satelite->update(['categoria_aeronave_id' => $baja->id]);
    $this->actingAs(usuarioConSubdepartamento('factAeronaves', 'Facturacion'));

    $this->putJson("/api/facturacion/aeronaves/{$satelite->id}", [
        'categoria_aeronave_id' => $baja->id,
        'estatus' => 'guarda',
        'cobra_derecho_vuelos' => true,
    ])->assertOk();
});

test('editar una matricula queda en bitacora y una inexistente responde 404', function () {
    $satelite = satelite();
    $this->actingAs(usuarioConSubdepartamento('factAeronaves', 'Facturacion'));

    $this->putJson("/api/facturacion/aeronaves/{$satelite->id}", ['estatus' => 'guarda', 'cobra_derecho_vuelos' => true])->assertOk();
    $this->putJson('/api/facturacion/aeronaves/999', ['estatus' => 'guarda', 'cobra_derecho_vuelos' => true])->assertNotFound();

    expect(Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_CATALOGOS)->where('accion', Bitacora::ACCION_ACTUALIZAR)->where('registro_id', $satelite->id)->exists())->toBeTrue();
});

test('el listado de aeronaves busca por matricula y publica las tarifas efectivas', function () {
    $categoria = FactCategoriaAeronave::create(categoriaValida());
    $a = satelite('XA-AAA');
    $a->update(['categoria_aeronave_id' => $categoria->id]);
    satelite('XB-BBB');
    $this->actingAs(usuarioSinAcceso());

    $this->getJson('/api/facturacion/aeronaves?q=XA')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.matricula', 'XA-AAA')
        ->assertJsonPath('data.0.tarifa_pernocta_efectiva', '1200.00')
        ->assertJsonPath('data.0.categoria.nombre', 'Ejecutiva');
});

test('el seeder crea el departamento Facturacion con sus cuatro subdepartamentos y es idempotente', function () {
    $this->seed(FacturacionSubdepartamentosSeeder::class);
    $this->seed(FacturacionSubdepartamentosSeeder::class);

    $departamento = App\Models\Departamento::where('nombre', 'Facturacion')->sole();

    expect(App\Models\SubDepartamento::where('departamento_id', $departamento->id)->pluck('nombre')->sort()->values()->all())
        ->toBe(['factAeronaves', 'factCategoriasAeronave', 'factCombustible', 'factTiposMotor']);
});

test('las rutas usan kebab-case sin el prefijo fact_', function () {
    $rutas = collect(app('router')->getRoutes()->getRoutes())->map(fn ($r) => $r->uri())->filter(fn ($u) => str_starts_with($u, 'api/facturacion'));

    expect($rutas)->not->toBeEmpty()
        ->and($rutas->filter(fn ($u) => preg_match('#/fact[_-]|_#', $u) === 1))->toBeEmpty();
});

test('conservar la categoria dada de baja no abre la puerta a otra categoria dada de baja', function () {
    $bajaActual = FactCategoriaAeronave::create(categoriaValida(['status' => 'N']));
    $bajaOtra = FactCategoriaAeronave::create(categoriaValida(['nombre' => 'Otra', 'status' => 'N']));
    $satelite = satelite();
    $satelite->update(['categoria_aeronave_id' => $bajaActual->id]);
    $this->actingAs(usuarioConSubdepartamento('factAeronaves', 'Facturacion'));

    $this->putJson("/api/facturacion/aeronaves/{$satelite->id}", [
        'categoria_aeronave_id' => $bajaOtra->id,
        'estatus' => 'guarda',
        'cobra_derecho_vuelos' => true,
    ])->assertStatus(422)->assertJsonValidationErrors(['categoria_aeronave_id']);

    $this->putJson("/api/facturacion/aeronaves/{$satelite->id}", [
        'categoria_aeronave_id' => 999999,
        'estatus' => 'guarda',
        'cobra_derecho_vuelos' => true,
    ])->assertStatus(422)->assertJsonValidationErrors(['categoria_aeronave_id']);
});
