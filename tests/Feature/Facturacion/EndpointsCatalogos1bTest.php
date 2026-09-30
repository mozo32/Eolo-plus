<?php
// tests/Feature/Facturacion/EndpointsCatalogos1bTest.php

use App\Models\Bitacora;
use App\Models\FactCategoriaServicio;
use App\Models\FactCliente;
use App\Models\FactFormaPago;
use App\Models\FactProveedor;
use App\Models\FactServicio;

function clienteValido(array $extra = []): array
{
    return array_merge([
        'nombre' => 'Aerolíneas de Prueba',
        'rfc' => 'AER970627QE9',
        'correo' => 'facturacion@ejemplo.com',
        'telefono' => '7221234567',
    ], $extra);
}

function servicioValido(array $extra = []): array
{
    return array_merge([
        'categoria_servicio_id' => FactCategoriaServicio::create(['nombre' => 'Cat '.uniqid()])->id,
        'nombre' => 'Servicio '.uniqid(),
        'precio_unitario' => 1500.50,
        'es_de_tercero' => false,
        'margen' => 0,
        'ajuste_precio' => 'ninguno',
    ], $extra);
}

test('sin sesion no se puede consultar ni escribir', function () {
    $this->getJson('/api/facturacion/clientes')->assertUnauthorized();
    $this->postJson('/api/facturacion/clientes', clienteValido())->assertUnauthorized();
});

test('consultar es abierto a autenticados pero escribir exige el subdepartamento', function () {
    $this->actingAs(usuarioSinAcceso());

    $this->getJson('/api/facturacion/clientes')->assertOk();
    $this->getJson('/api/facturacion/servicios')->assertOk();
    $this->getJson('/api/facturacion/categorias-servicio')->assertOk();
    $this->getJson('/api/facturacion/formas-pago')->assertOk();
    $this->getJson('/api/facturacion/proveedores')->assertOk();
    $this->postJson('/api/facturacion/clientes', clienteValido())->assertForbidden();
});

test('con el subdepartamento se da de alta un cliente y queda en bitacora', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));

    $this->postJson('/api/facturacion/clientes', clienteValido())
        ->assertCreated()
        ->assertJsonPath('cliente.nombre', 'Aerolíneas de Prueba');

    expect(FactCliente::count())->toBe(1)
        ->and(Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_CATALOGOS)->where('accion', Bitacora::ACCION_CREAR)->exists())->toBeTrue();
});

test('el RFC repetido SI se acepta', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));

    $this->postJson('/api/facturacion/clientes', clienteValido(['nombre' => 'Uno', 'rfc' => 'XAXX010101000']))->assertCreated();
    $this->postJson('/api/facturacion/clientes', clienteValido(['nombre' => 'Dos', 'rfc' => 'XAXX010101000']))->assertCreated();

    expect(FactCliente::where('rfc', 'XAXX010101000')->count())->toBe(2);
});

test('el nombre del cliente es obligatorio', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));

    $this->postJson('/api/facturacion/clientes', clienteValido(['nombre' => '']))
        ->assertStatus(422)
        ->assertJsonValidationErrors(['nombre']);
});

test('el nombre del cliente puede repetirse', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));

    $this->postJson('/api/facturacion/clientes', clienteValido())->assertCreated();
    $this->postJson('/api/facturacion/clientes', clienteValido(['rfc' => 'OTRO010101000']))->assertCreated();

    expect(FactCliente::where('nombre', 'Aerolíneas de Prueba')->count())->toBe(2);
});

test('un servicio con precio cero se acepta', function () {
    // Catorce de los 15 servicios de tercero del origen valen 0 (se teclea al
    // capturar); el decimoquinto, Slot MMTO (id 111), vale 19250.0000.
    $this->actingAs(usuarioConSubdepartamento('factServicios', 'Facturacion'));

    $this->postJson('/api/facturacion/servicios', servicioValido(['precio_unitario' => 0]))
        ->assertCreated();

    expect((float) FactServicio::first()->precio_unitario)->toBe(0.0);
});

test('un precio negativo o un ajuste desconocido se rechazan', function () {
    $this->actingAs(usuarioConSubdepartamento('factServicios', 'Facturacion'));

    $this->postJson('/api/facturacion/servicios', servicioValido(['precio_unitario' => -1]))
        ->assertStatus(422)->assertJsonValidationErrors(['precio_unitario']);

    $this->postJson('/api/facturacion/servicios', servicioValido(['ajuste_precio' => 'inventado']))
        ->assertStatus(422)->assertJsonValidationErrors(['ajuste_precio']);
});

test('el precio tope que cabe en la columna se acepta y uno por encima responde 422, no 500', function () {
    // La columna es decimal(10,4): seis enteros y cuatro decimales, tope 999999.9999.
    $this->actingAs(usuarioConSubdepartamento('factServicios', 'Facturacion'));

    $this->postJson('/api/facturacion/servicios', servicioValido(['precio_unitario' => 999999.9999]))
        ->assertCreated();

    $this->postJson('/api/facturacion/servicios', servicioValido(['precio_unitario' => 1000000]))
        ->assertStatus(422)->assertJsonValidationErrors(['precio_unitario']);

    $this->postJson('/api/facturacion/servicios', servicioValido(['precio_unitario' => 99999999]))
        ->assertStatus(422)->assertJsonValidationErrors(['precio_unitario']);

    expect(FactServicio::count())->toBe(1);
});

test('un precio con mas de cuatro decimales o un margen fuera de la columna se rechazan', function () {
    $this->actingAs(usuarioConSubdepartamento('factServicios', 'Facturacion'));

    $this->postJson('/api/facturacion/servicios', servicioValido(['precio_unitario' => 10.12345]))
        ->assertStatus(422)->assertJsonValidationErrors(['precio_unitario']);

    $this->postJson('/api/facturacion/servicios', servicioValido(['es_de_tercero' => true, 'margen' => 1000]))
        ->assertStatus(422)->assertJsonValidationErrors(['margen']);

    $this->postJson('/api/facturacion/servicios', servicioValido(['es_de_tercero' => true, 'margen' => 50.123]))
        ->assertStatus(422)->assertJsonValidationErrors(['margen']);
});

test('un servicio de tercero con margen mayor a cero se acepta', function () {
    $this->actingAs(usuarioConSubdepartamento('factServicios', 'Facturacion'));

    $this->postJson('/api/facturacion/servicios', servicioValido(['es_de_tercero' => true, 'margen' => 50]))
        ->assertCreated()
        ->assertJsonPath('servicio.es_de_tercero', true);
});

test('un servicio de tercero con margen cero se rechaza diciendo la combinacion', function () {
    $this->actingAs(usuarioConSubdepartamento('factServicios', 'Facturacion'));

    $r = $this->postJson('/api/facturacion/servicios', servicioValido(['es_de_tercero' => true, 'margen' => 0]))
        ->assertStatus(422)
        ->assertJsonValidationErrors(['margen']);

    expect($r->json('errors.margen.0'))->toContain('de tercero')->toContain('margen 0')->toContain('mayor a 0')
        ->and(FactServicio::count())->toBe(0);
});

test('un servicio que no es de tercero con margen mayor a cero se rechaza diciendo la combinacion', function () {
    $this->actingAs(usuarioConSubdepartamento('factServicios', 'Facturacion'));

    $r = $this->postJson('/api/facturacion/servicios', servicioValido(['es_de_tercero' => false, 'margen' => 30]))
        ->assertStatus(422)
        ->assertJsonValidationErrors(['margen']);

    expect($r->json('errors.margen.0'))->toContain('no es de tercero')->toContain('margen 30')->toContain('debe ser 0')
        ->and(FactServicio::count())->toBe(0);
});

test('la edicion de un servicio hace cumplir la misma regla de tercero y margen en las dos direcciones', function () {
    $this->actingAs(usuarioConSubdepartamento('factServicios', 'Facturacion'));
    $propio = FactServicio::create(servicioValido());
    $tercero = FactServicio::create(servicioValido(['es_de_tercero' => true, 'margen' => 50]));

    $this->putJson("/api/facturacion/servicios/{$propio->id}", servicioValido(['es_de_tercero' => true, 'margen' => 0]))
        ->assertStatus(422)->assertJsonValidationErrors(['margen']);

    $this->putJson("/api/facturacion/servicios/{$tercero->id}", servicioValido(['es_de_tercero' => false, 'margen' => 30]))
        ->assertStatus(422)->assertJsonValidationErrors(['margen']);

    // Nada cambio: se rechaza, no se arregla por detras.
    expect($propio->fresh()->es_de_tercero)->toBeFalse()
        ->and((float) $propio->fresh()->margen)->toBe(0.0)
        ->and($tercero->fresh()->es_de_tercero)->toBeTrue()
        ->and((float) $tercero->fresh()->margen)->toBe(50.0);

    $this->putJson("/api/facturacion/servicios/{$propio->id}", servicioValido(['es_de_tercero' => true, 'margen' => 40, 'precio_unitario' => 0]))
        ->assertOk();

    expect($propio->fresh()->es_de_tercero)->toBeTrue()
        ->and((float) $propio->fresh()->margen)->toBe(40.0)
        ->and(Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_CATALOGOS)->where('accion', Bitacora::ACCION_ACTUALIZAR)->count())->toBe(1);
});

test('la regla de tercero y margen no se contesta dos veces cuando el campo ya trae otro error', function () {
    $this->actingAs(usuarioConSubdepartamento('factServicios', 'Facturacion'));

    $r = $this->postJson('/api/facturacion/servicios', servicioValido(['es_de_tercero' => 'quizas', 'margen' => 30]))
        ->assertStatus(422)
        ->assertJsonValidationErrors(['es_de_tercero']);

    expect($r->json('errors'))->not->toHaveKey('margen');
});

test('desactivar y reactivar un cliente son atomicos', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));
    $cliente = FactCliente::create(clienteValido());

    $this->patchJson("/api/facturacion/clientes/{$cliente->id}/desactivar")->assertOk();
    $this->patchJson("/api/facturacion/clientes/{$cliente->id}/desactivar")
        ->assertStatus(409)->assertJsonPath('codigo', 'ya_desactivado');

    $this->patchJson("/api/facturacion/clientes/{$cliente->id}/reactivar")->assertOk();
    $this->patchJson("/api/facturacion/clientes/{$cliente->id}/reactivar")
        ->assertStatus(409)->assertJsonPath('codigo', 'ya_activo');

    expect($cliente->fresh()->status)->toBe('A');
});

test('los codigos 409 de baja y alta respetan el genero de cada catalogo', function () {
    $this->actingAs(usuarioAdmin());

    $casos = [
        ['servicios', FactServicio::create(servicioValido()), 'ya_desactivado', 'ya_activo'],
        ['proveedores', FactProveedor::create(['nombre' => 'EOLO']), 'ya_desactivado', 'ya_activo'],
        ['categorias-servicio', FactCategoriaServicio::create(['nombre' => 'Transitos']), 'ya_desactivada', 'ya_activa'],
        ['formas-pago', FactFormaPago::create(['nombre' => 'Efectivo']), 'ya_desactivada', 'ya_activa'],
    ];

    foreach ($casos as [$ruta, $fila, $yaBaja, $yaAlta]) {
        $this->patchJson("/api/facturacion/{$ruta}/{$fila->id}/desactivar")->assertOk();
        $this->patchJson("/api/facturacion/{$ruta}/{$fila->id}/desactivar")
            ->assertStatus(409)->assertJsonPath('codigo', $yaBaja);

        $this->patchJson("/api/facturacion/{$ruta}/{$fila->id}/reactivar")->assertOk();
        $this->patchJson("/api/facturacion/{$ruta}/{$fila->id}/reactivar")
            ->assertStatus(409)->assertJsonPath('codigo', $yaAlta);
    }

    expect(Bitacora::where('accion', Bitacora::ACCION_DESACTIVAR)->count())->toBe(4)
        ->and(Bitacora::where('accion', Bitacora::ACCION_ACTIVAR)->count())->toBe(4);
});

test('desactivar o reactivar algo que no existe responde 404, no 409', function () {
    $this->actingAs(usuarioAdmin());

    $this->patchJson('/api/facturacion/clientes/999/desactivar')->assertNotFound();
    $this->patchJson('/api/facturacion/clientes/999/reactivar')->assertNotFound();
    $this->putJson('/api/facturacion/clientes/999', clienteValido())->assertNotFound();
});

test('consultar permite filtrar solo las activas', function () {
    $this->actingAs(usuarioSinAcceso());
    FactCliente::create(clienteValido(['nombre' => 'Activo']));
    FactCliente::create(clienteValido(['nombre' => 'Baja', 'status' => 'N']));

    $this->getJson('/api/facturacion/clientes')->assertOk()->assertJsonCount(2, 'clientes');
    $this->getJson('/api/facturacion/clientes?activas=1')->assertOk()->assertJsonCount(1, 'clientes')
        ->assertJsonPath('clientes.0.nombre', 'Activo');
});

test('categorias, formas de pago y proveedores rechazan el nombre repetido con 422, no con un error de base', function () {
    $this->actingAs(usuarioAdmin());
    FactCategoriaServicio::create(['nombre' => 'Transitos']);
    FactFormaPago::create(['nombre' => 'Efectivo']);
    FactProveedor::create(['nombre' => 'EOLO']);

    $this->postJson('/api/facturacion/categorias-servicio', ['nombre' => 'Transitos'])
        ->assertStatus(422)->assertJsonValidationErrors(['nombre']);
    $this->postJson('/api/facturacion/formas-pago', ['nombre' => 'Efectivo'])
        ->assertStatus(422)->assertJsonValidationErrors(['nombre']);
    $this->postJson('/api/facturacion/proveedores', ['nombre' => 'EOLO'])
        ->assertStatus(422)->assertJsonValidationErrors(['nombre']);
});

test('editar una forma de pago valida el nombre contra las demas pero no contra si misma', function () {
    $this->actingAs(usuarioConSubdepartamento('factFormasPago', 'Facturacion'));
    $efectivo = FactFormaPago::create(['nombre' => 'Efectivo']);
    FactFormaPago::create(['nombre' => 'Transferencia']);

    $this->putJson("/api/facturacion/formas-pago/{$efectivo->id}", ['nombre' => 'Efectivo'])->assertOk();
    $this->putJson("/api/facturacion/formas-pago/{$efectivo->id}", ['nombre' => 'Transferencia'])
        ->assertStatus(422)->assertJsonValidationErrors(['nombre']);
});

test('los topes de longitud del nombre siguen a cada columna', function () {
    $this->actingAs(usuarioAdmin());

    $this->postJson('/api/facturacion/formas-pago', ['nombre' => str_repeat('a', 61)])
        ->assertStatus(422)->assertJsonValidationErrors(['nombre']);
    $this->postJson('/api/facturacion/proveedores', ['nombre' => str_repeat('a', 121)])
        ->assertStatus(422)->assertJsonValidationErrors(['nombre']);
    $this->postJson('/api/facturacion/categorias-servicio', ['nombre' => str_repeat('a', 81)])
        ->assertStatus(422)->assertJsonValidationErrors(['nombre']);

    $this->postJson('/api/facturacion/formas-pago', ['nombre' => str_repeat('a', 60)])->assertCreated();
    $this->postJson('/api/facturacion/proveedores', ['nombre' => str_repeat('a', 120)])->assertCreated();
    $this->postJson('/api/facturacion/categorias-servicio', ['nombre' => str_repeat('a', 80)])->assertCreated();
});

test('las altas de los demas catalogos quedan en bitacora', function () {
    $this->actingAs(usuarioAdmin());

    $this->postJson('/api/facturacion/categorias-servicio', ['nombre' => 'Transitos'])->assertCreated();
    $this->postJson('/api/facturacion/formas-pago', ['nombre' => 'Efectivo'])->assertCreated();
    $this->postJson('/api/facturacion/proveedores', ['nombre' => 'EOLO'])->assertCreated();
    $this->postJson('/api/facturacion/servicios', servicioValido())->assertCreated();

    expect(Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_CATALOGOS)->where('accion', Bitacora::ACCION_CREAR)->count())->toBe(4);
});

test('quien tiene un subdepartamento de facturacion no puede escribir en los otros catalogos', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));

    $this->postJson('/api/facturacion/servicios', servicioValido())->assertForbidden();
    $this->postJson('/api/facturacion/formas-pago', ['nombre' => 'Efectivo'])->assertForbidden();
    $this->postJson('/api/facturacion/proveedores', ['nombre' => 'EOLO'])->assertForbidden();
});

test('cada ruta de escritura de 1b lleva su subdepartamento', function () {
    $esperado = [
        'POST api/facturacion/clientes' => 'subdep:factClientes',
        'PUT api/facturacion/clientes/{id}' => 'subdep:factClientes',
        'PATCH api/facturacion/clientes/{id}/desactivar' => 'subdep:factClientes',
        'PATCH api/facturacion/clientes/{id}/reactivar' => 'subdep:factClientes',
        'POST api/facturacion/servicios' => 'subdep:factServicios',
        'PUT api/facturacion/servicios/{id}' => 'subdep:factServicios',
        'PATCH api/facturacion/servicios/{id}/desactivar' => 'subdep:factServicios',
        'PATCH api/facturacion/servicios/{id}/reactivar' => 'subdep:factServicios',
        'POST api/facturacion/categorias-servicio' => 'subdep:factServicios',
        'PUT api/facturacion/categorias-servicio/{id}' => 'subdep:factServicios',
        'PATCH api/facturacion/categorias-servicio/{id}/desactivar' => 'subdep:factServicios',
        'PATCH api/facturacion/categorias-servicio/{id}/reactivar' => 'subdep:factServicios',
        'POST api/facturacion/formas-pago' => 'subdep:factFormasPago',
        'PUT api/facturacion/formas-pago/{id}' => 'subdep:factFormasPago',
        'PATCH api/facturacion/formas-pago/{id}/desactivar' => 'subdep:factFormasPago',
        'PATCH api/facturacion/formas-pago/{id}/reactivar' => 'subdep:factFormasPago',
        'POST api/facturacion/proveedores' => 'subdep:factProveedores',
        'PUT api/facturacion/proveedores/{id}' => 'subdep:factProveedores',
        'PATCH api/facturacion/proveedores/{id}/desactivar' => 'subdep:factProveedores',
        'PATCH api/facturacion/proveedores/{id}/reactivar' => 'subdep:factProveedores',
    ];

    $real = [];

    foreach (app('router')->getRoutes() as $ruta) {
        // El mismo predicado que EndpointsCatalogosTest.php excluye de SU prueba, visto
        // del otro lado: entre las dos cubren toda `api/facturacion` sin dejar hueco.
        // Por eso NO se puede saltar una ruta solo porque no esté en $esperado: una
        // ruta nueva de estos cinco prefijos tiene que romper esta prueba, que es todo
        // el punto de compararla con toEqual en ambos sentidos.
        if (preg_match('#^api/facturacion/(clientes|servicios|categorias-servicio|formas-pago|proveedores)(/|$)#', $ruta->uri()) !== 1) {
            continue;
        }

        foreach (array_diff($ruta->methods(), ['GET', 'HEAD']) as $metodo) {
            $subdep = collect($ruta->gatherMiddleware())->first(fn ($m) => is_string($m) && str_starts_with($m, 'subdep:'));
            $real["{$metodo} {$ruta->uri()}"] = $subdep;
        }
    }

    expect($real)->toEqual($esperado);
});

test('el seeder crea los cuatro subdepartamentos nuevos', function () {
    $this->seed(Database\Seeders\FacturacionSubdepartamentosSeeder::class);

    $nombres = App\Models\Departamento::where('nombre', 'Facturacion')
        ->first()->subdepartamentos->pluck('nombre')->sort()->values()->all();

    expect($nombres)->toContain('factClientes', 'factServicios', 'factFormasPago', 'factProveedores');
});
