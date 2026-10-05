<?php
// tests/Feature/Facturacion/EndpointsPrefacturaTest.php

use App\Models\Bitacora;
use App\Models\FactAeronave;
use App\Models\FactPrefactura;
use App\Models\FactPrefacturaRenglon;
use App\Models\FactServicio;
use App\Services\CierrePrefactura;
use Illuminate\Support\Facades\DB;

function cuerpoPrefactura(array $extra = []): array
{
    $aeronave = App\Models\Aeronave::firstOrCreate(['matricula' => 'XA-TEST']);
    App\Models\FactAeronave::firstOrCreate(['aeronave_id' => $aeronave->id], ['estatus' => App\Models\FactAeronave::ESTATUS_TRANSITO]);

    return array_merge([
        'aeronave_id' => $aeronave->id,
        'cliente_id' => null,
        'llegada_at' => '2026-10-01 08:00:00',
        'salida_at' => null,
        'origen' => 'MMTO',
        'destino' => null,
        'tipo_destino' => 'nacional',
    ], $extra);
}

function cuerpoRenglon(array $extra = []): array
{
    $servicio = App\Models\FactServicio::firstOrCreate(['nombre' => 'Comisariato'], ['precio_unitario' => 500.0]);

    return array_merge(['servicio_id' => $servicio->id, 'cantidad' => 1], $extra);
}


test('sin sesion no se puede consultar ni escribir', function () {
    $this->getJson('/api/facturacion/prefacturas')->assertUnauthorized();
    $this->postJson('/api/facturacion/prefacturas', [])->assertUnauthorized();
});

test('sin el subdepartamento no se puede escribir', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));

    $this->postJson('/api/facturacion/prefacturas', cuerpoPrefactura())->assertForbidden();
});

test('consultar es abierto a cualquier autenticado', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));

    $this->getJson('/api/facturacion/prefacturas')->assertOk();
});

test('se crea un borrador sin folio', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson('/api/facturacion/prefacturas', cuerpoPrefactura())
        ->assertCreated()
        ->assertJsonPath('prefactura.estado', 'borrador')
        ->assertJsonPath('prefactura.folio', null);
});

test('el listado trae los totales derivados', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(precio: 1000.0, cantidad: 1);

    $this->getJson("/api/facturacion/prefacturas/{$p->id}")
        ->assertOk()
        ->assertJsonPath('prefactura.subtotal', '1000.00')
        ->assertJsonPath('prefactura.iva', '160.00')
        ->assertJsonPath('prefactura.total', '1160.00');
});

test('cerrar responde 409 la segunda vez', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar", ['confirmar_sin_cobro' => true])->assertOk();
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar")
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_cerrada');
});

test('cerrar sin cliente responde 422 con el motivo', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta();
    $p->update(['cliente_id' => null]);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar")
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'incompleta');
});

test('una prefactura cerrada no se puede editar: lo hace cumplir el endpoint', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta();
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar", ['confirmar_sin_cobro' => true])->assertOk();

    $this->putJson("/api/facturacion/prefacturas/{$p->id}", cuerpoPrefactura())
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_cerrada');
});

test('a una cerrada no se le pueden agregar ni quitar renglones', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta();
    $renglon = $p->renglones()->sole();
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar", ['confirmar_sin_cobro' => true])->assertOk();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/renglones", cuerpoRenglon())->assertStatus(409);
    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}")->assertStatus(409);
});

test('recalcular estancia en una aeronave en Guarda responde 200 y dice el motivo', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = conEstancia(App\Models\FactAeronave::ESTATUS_GUARDA);

    $respuesta = $this->patchJson("/api/facturacion/prefacturas/{$p->id}/estancia", [
        'pernoctas' => 2, 'transitos_2h' => 0, 'transitos_12h' => 0,
    ])
        ->assertOk()
        ->assertJsonPath('renglones', 0);

    // Se afirma que el motivo LLEGA y menciona Guarda, no su redacción exacta: de
    // la redacción es dueña la Task 5, y clavarla aquí haría que mejorar el texto
    // rompiera una prueba de endpoints.
    expect($respuesta->json('motivo'))->toContain('Guarda');
});

test('descartar un borrador lo saca de la lista y responde 409 la segunda vez', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/descartar")->assertOk();

    expect($p->fresh()->status)->toBe(FactPrefactura::STATUS_INACTIVO);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/descartar")
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_descartada');

    $this->getJson('/api/facturacion/prefacturas')->assertOk()->assertJsonCount(0, 'data');
});

test('una prefactura cerrada no se descarta: ya es un documento emitido', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta();
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar", ['confirmar_sin_cobro' => true])->assertOk();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/descartar")
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_cerrada');

    expect($p->fresh()->status)->toBe(FactPrefactura::STATUS_ACTIVO);
});

test('cada ruta de escritura de prefacturas lleva su subdepartamento', function () {
    $esperado = [
        'POST api/facturacion/prefacturas' => 'subdep:factPrefacturas',
        'PUT api/facturacion/prefacturas/{id}' => 'subdep:factPrefacturas',
        'PATCH api/facturacion/prefacturas/{id}/cerrar' => 'subdep:factPrefacturas',
        'PATCH api/facturacion/prefacturas/{id}/notas' => 'subdep:factPrefacturas',
        'POST api/facturacion/prefacturas/{id}/renglones' => 'subdep:factPrefacturas',
        'DELETE api/facturacion/prefacturas/{id}/renglones/{renglon}' => 'subdep:factPrefacturas',
        'PATCH api/facturacion/prefacturas/{id}/renglones/{renglon}/cortesia' => 'subdep:factPrefacturas',
        'PATCH api/facturacion/prefacturas/{id}/renglones/{renglon}/grupo' => 'subdep:factPrefacturas',
        'PATCH api/facturacion/prefacturas/{id}/estancia' => 'subdep:factPrefacturas',
        'PATCH api/facturacion/prefacturas/{id}/internacional' => 'subdep:factPrefacturas',
        'PATCH api/facturacion/prefacturas/{id}/descartar' => 'subdep:factPrefacturas',
        'POST api/facturacion/prefacturas/{id}/pagos' => 'subdep:factPrefacturas',
        'POST api/facturacion/prefacturas/{id}/pagos/amex' => 'subdep:factPrefacturas',
        'DELETE api/facturacion/prefacturas/{id}/pagos/{pago}' => 'subdep:factPrefacturas',
    ];

    $real = [];

    foreach (app('router')->getRoutes() as $ruta) {
        if (! esRutaPrefacturas($ruta->uri())) {
            continue;
        }

        foreach (array_diff($ruta->methods(), ['GET', 'HEAD']) as $metodo) {
            $real["{$metodo} {$ruta->uri()}"] = collect($ruta->gatherMiddleware())
                ->first(fn ($m) => is_string($m) && str_starts_with($m, 'subdep:'));
        }
    }

    expect($real)->toEqual($esperado);
});

test('el seeder crea el subdepartamento nuevo', function () {
    $this->seed(Database\Seeders\FacturacionSubdepartamentosSeeder::class);

    $departamento = App\Models\Departamento::where('nombre', 'Facturacion')->sole();

    expect(App\Models\SubDepartamento::where('departamento_id', $departamento->id)->pluck('nombre')->sort()->values()->all())
        ->toBe([
            'factAeronaves', 'factCategoriasAeronave', 'factClientes', 'factCombustible',
            'factFormasPago', 'factPrefacturas', 'factProveedores', 'factServicios', 'factTiposMotor',
        ]);
});

/*
|--------------------------------------------------------------------------
| Ayudantes de las pruebas de carrera, de bitacora y de sello
|--------------------------------------------------------------------------
*/

/** Le pone cliente y un renglon a un borrador cualquiera, para que se pueda cerrar. */
function completarParaCerrar(FactPrefactura $p): FactPrefactura
{
    $p->update(['cliente_id' => App\Models\FactCliente::create(['nombre' => 'Cliente '.uniqid()])->id]);

    if ($p->renglones()->count() === 0) {
        renglonDe($p, 100.0, 1);
    }

    return $p->fresh();
}

/**
 * Cierra la prefactura en la misma peticion, DESPUES de que el controlador la leyo
 * (y de que el trait la dio por borrador) y ANTES de que la operacion tome su
 * candado: es la carrera que, sin el `render()` de la excepcion, saldria como 500.
 */
function cierraTrasLaComprobacion(FactPrefactura $p, int $usuarioId): void
{
    $hecho = false;

    DB::listen(function ($consulta) use ($p, $usuarioId, &$hecho) {
        if (! $hecho && str_contains($consulta->sql, 'from "fact_prefacturas"')) {
            $hecho = true;
            app(CierrePrefactura::class)->cerrar($p->fresh(), $usuarioId, confirmarSinCobro: true);
        }
    });
}

function bitacoraDePrefacturas(string $accion): int
{
    return Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)->where('accion', $accion)->count();
}

test('si se cierra entre el chequeo y el candado, agregar un renglon responde 409 por la excepcion', function () {
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $this->actingAs($usuario);
    [$p] = prefacturaCompleta();
    $antes = $p->renglones()->count();
    cierraTrasLaComprobacion($p, $usuario->id);
    $bitacoraAntes = Bitacora::count();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/renglones", cuerpoRenglon())
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_cerrada');

    // La unica entrada nueva es la del cierre de la otra sesion: la de agregar se revirtio.
    expect($p->fresh()->estaCerrada())->toBeTrue()
        ->and($p->renglones()->count())->toBe($antes)
        ->and(bitacoraDePrefacturas(Bitacora::ACCION_CREAR))->toBe(0)
        ->and(Bitacora::count() - $bitacoraAntes)->toBe(1);
});

test('si se cierra entre el chequeo y el candado, quitar un renglon responde 409 por la excepcion', function () {
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $this->actingAs($usuario);
    [$p] = prefacturaCompleta();
    $renglon = $p->renglones()->sole();
    cierraTrasLaComprobacion($p, $usuario->id);

    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}")
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_cerrada');

    expect(FactPrefacturaRenglon::whereKey($renglon->id)->exists())->toBeTrue()
        ->and(bitacoraDePrefacturas(Bitacora::ACCION_ELIMINAR))->toBe(0);
});

test('si se cierra entre el chequeo y el candado, marcar una cortesia responde 409 por la excepcion y no escribe nada', function () {
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $this->actingAs($usuario);
    [$p] = prefacturaCompleta();
    $renglon = $p->renglones()->sole();
    cierraTrasLaComprobacion($p, $usuario->id);
    $bitacoraAntes = Bitacora::count();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/cortesia", ['es_cortesia' => true])
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_cerrada');

    // La unica entrada nueva es la del cierre de la otra sesion: la de la cortesia se revirtio.
    expect($p->fresh()->estaCerrada())->toBeTrue()
        ->and($renglon->fresh()->es_cortesia)->toBeFalse()
        ->and(Bitacora::count() - $bitacoraAntes)->toBe(1);
});

test('si se cierra entre el chequeo y el candado, recalcular estancia responde 409 por la excepcion', function () {
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $this->actingAs($usuario);
    $p = completarParaCerrar(conEstancia());
    cierraTrasLaComprobacion($p, $usuario->id);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/estancia", [
        'pernoctas' => 2, 'transitos_2h' => 0, 'transitos_12h' => 0,
    ])
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_cerrada');

    expect($p->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->exists())->toBeFalse()
        ->and(bitacoraDePrefacturas(Bitacora::ACCION_ACTUALIZAR))->toBe(0);
});

test('si se cierra entre el chequeo y el candado, el paquete internacional responde 409 y no cambia el destino', function () {
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $this->actingAs($usuario);
    FactServicio::create(['nombre' => 'Migracion', 'precio_unitario' => 300.0, 'en_paquete_internacional' => true]);
    $p = completarParaCerrar(prefacturaBorrador());
    $antes = $p->renglones()->count();
    cierraTrasLaComprobacion($p, $usuario->id);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/internacional")
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_cerrada');

    expect($p->fresh()->tipo_destino)->toBe(FactPrefactura::DESTINO_NACIONAL)
        ->and($p->renglones()->count())->toBe($antes)
        ->and(bitacoraDePrefacturas(Bitacora::ACCION_ACTUALIZAR))->toBe(0);
});

test('los cuatro endpoints de renglones responden 409 ya_cerrada cuando el trait ya la ve cerrada', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta();
    $renglon = $p->renglones()->sole();
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar", ['confirmar_sin_cobro' => true])->assertOk();

    $cuerpoEstancia = ['pernoctas' => 1, 'transitos_2h' => 0, 'transitos_12h' => 0];

    foreach ([
        $this->postJson("/api/facturacion/prefacturas/{$p->id}/renglones", cuerpoRenglon()),
        $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}"),
        $this->patchJson("/api/facturacion/prefacturas/{$p->id}/estancia", $cuerpoEstancia),
        $this->patchJson("/api/facturacion/prefacturas/{$p->id}/internacional"),
    ] as $respuesta) {
        $respuesta->assertStatus(409)->assertJsonPath('codigo', 'ya_cerrada');
    }
});

test('si el sello no coincide al cerrar, el endpoint responde 409 sello_inconsistente y no consume folio', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta();
    $servicioId = $p->renglones()->first()->servicio_id;
    $metido = false;

    DB::listen(function ($consulta) use ($p, $servicioId, &$metido) {
        if (! $metido && str_starts_with($consulta->sql, 'update "fact_prefacturas"')) {
            $metido = true;
            DB::table('fact_prefactura_renglones')->insert([
                'prefactura_id' => $p->id, 'servicio_id' => $servicioId, 'nombre_servicio' => 'Colado',
                'precio_unitario' => 50, 'cantidad' => 1, 'es_de_tercero' => false, 'margen' => 0,
                'ajuste_precio' => 'ninguno', 'orden' => 2, 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
    });

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar", ['confirmar_sin_cobro' => true])
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'sello_inconsistente');

    expect($metido)->toBeTrue()
        ->and($p->fresh()->estado)->toBe(FactPrefactura::ESTADO_BORRADOR)
        ->and($p->fresh()->folio)->toBeNull()
        ->and(App\Models\FactConfiguracion::valor('prefactura_folio_siguiente'))->toBe('10000');
});

test('una cerrada responde con folio y el sello sin discrepancias', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(precio: 1000.0, cantidad: 1);
    // El cierre normal: cobrada por completo, sin confirmar nada.
    pagoDe($p, formasDePago()['Visa'], '1160.00');

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar")
        ->assertOk()
        ->assertJsonPath('prefactura.estado', 'cerrada')
        ->assertJsonPath('prefactura.folio', 10000)
        ->assertJsonPath('prefactura.total', '1160.00')
        ->assertJsonPath('prefactura.sello_discrepa', false)
        ->assertJsonPath('prefactura.sello_error', null);
});

test('si el sello de una cerrada ya no coincide con sus renglones, la ficha y el listado lo dicen', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $usuario] = prefacturaCompleta(precio: 1000.0, cantidad: 1);
    app(CierrePrefactura::class)->cerrar($p, $usuario->id, confirmarSinCobro: true);

    // Un renglon que cambia por debajo del sello (escritura cruda: la guarda del modelo no la ve).
    DB::table('fact_prefactura_renglones')->where('prefactura_id', $p->id)->update(['precio_unitario' => 5000]);

    $ficha = $this->getJson("/api/facturacion/prefacturas/{$p->id}")->assertOk();

    // El total que se cobra sigue siendo el sellado; lo que se ve es la discrepancia.
    expect($ficha->json('prefactura.total'))->toBe('1160.00')
        ->and($ficha->json('prefactura.sello_discrepa'))->toBeTrue()
        ->and($ficha->json('prefactura.sello_discrepancias.total'))->toBe(['sellado' => '1160.00', 'derivado' => '5800.00']);

    $fila = collect($this->getJson('/api/facturacion/prefacturas')->assertOk()->json('data'))->firstWhere('id', $p->id);
    expect($fila['sello_discrepa'])->toBeTrue();
});

test('un renglon con ajuste desconocido no tumba la ficha ni el listado', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$sana] = prefacturaCompleta(precio: 100.0, cantidad: 1);
    [$rota] = prefacturaCompleta(precio: 100.0, cantidad: 1);
    DB::table('fact_prefactura_renglones')->where('prefactura_id', $rota->id)->update(['ajuste_precio' => 'raro']);

    $ficha = $this->getJson("/api/facturacion/prefacturas/{$rota->id}")->assertOk();

    expect($ficha->json('prefactura.total'))->toBeNull()
        ->and($ficha->json('prefactura.totales_error'))->toBeString()
        ->and($ficha->json('prefactura.renglones.0.importe'))->toBeNull()
        ->and($ficha->json('prefactura.renglones.0.importe_error'))->toBeString();

    $filas = collect($this->getJson('/api/facturacion/prefacturas')->assertOk()->json('data'));

    expect($filas->firstWhere('id', $rota->id)['totales_error'])->toBeString()
        ->and($filas->firstWhere('id', $sana->id)['total'])->toBe('116.00')
        ->and($filas->firstWhere('id', $sana->id)['totales_error'])->toBeNull();
});

test('una cerrada sin tasa sellada y con tasa ilegible en configuracion no revienta la ficha ni el listado', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$sana] = prefacturaCompleta(precio: 100.0, cantidad: 1);
    [$rota] = prefacturaCompleta(precio: 100.0, cantidad: 1);
    cerrarConSello($rota, '100.00', '16.00', '116.00');
    $rota->update(['iva_tasa_sellada' => null]);
    App\Models\FactConfiguracion::updateOrCreate(['clave' => 'iva_tasa'], ['valor' => 'abc', 'descripcion' => 'Tasa de IVA']);

    $ficha = $this->getJson("/api/facturacion/prefacturas/{$rota->id}")->assertOk();

    expect($ficha->json('prefactura.sello_discrepa'))->toBeNull()
        ->and($ficha->json('prefactura.sello_error'))->toBeString();

    $filas = collect($this->getJson('/api/facturacion/prefacturas')->assertOk()->json('data'));

    // La sana (borrador) tampoco puede calcular con la tasa ilegible, pero se avisa en su fila.
    expect($filas)->toHaveCount(2)
        ->and($filas->firstWhere('id', $rota->id)['sello_error'])->toBeString()
        ->and($filas->firstWhere('id', $sana->id)['totales_error'])->toBeString();
});

test('cada escritura queda en bitacora con su registro', function () {
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $this->actingAs($usuario);
    FactServicio::create(['nombre' => 'Migracion', 'precio_unitario' => 300.0, 'en_paquete_internacional' => true]);

    $id = $this->postJson('/api/facturacion/prefacturas', cuerpoPrefactura())->assertCreated()->json('prefactura.id');
    $this->putJson("/api/facturacion/prefacturas/{$id}", cuerpoPrefactura(['origen' => 'MMMX']))->assertOk();
    $renglon = $this->postJson("/api/facturacion/prefacturas/{$id}/renglones", cuerpoRenglon())->assertCreated()->json('renglon_id');
    $this->patchJson("/api/facturacion/prefacturas/{$id}/internacional")->assertOk();
    $this->deleteJson("/api/facturacion/prefacturas/{$id}/renglones/{$renglon}")->assertOk();
    $this->patchJson("/api/facturacion/prefacturas/{$id}/descartar")->assertOk();

    expect(bitacoraDePrefacturas(Bitacora::ACCION_CREAR))->toBe(2)
        ->and(bitacoraDePrefacturas(Bitacora::ACCION_ACTUALIZAR))->toBe(2)
        ->and(bitacoraDePrefacturas(Bitacora::ACCION_ELIMINAR))->toBe(1)
        ->and(bitacoraDePrefacturas(Bitacora::ACCION_DESACTIVAR))->toBe(1)
        ->and(Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)->pluck('registro_id')->unique()->all())->toBe([$id])
        ->and(Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)->pluck('usuario_id')->unique()->all())->toBe([$usuario->id]);

    $edicion = Bitacora::where('accion', Bitacora::ACCION_ACTUALIZAR)->where('descripcion', 'like', '%editó%')->sole();
    expect($edicion->datos_anteriores['origen'])->toBe('MMTO')
        ->and($edicion->datos_nuevos['origen'])->toBe('MMMX');
});

test('cerrar deja una sola entrada en bitacora, la del servicio de cierre', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar", ['confirmar_sin_cobro' => true])->assertOk();

    expect(bitacoraDePrefacturas(Bitacora::ACCION_FINALIZAR))->toBe(1)
        ->and(Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)->count())->toBe(1);
});

test('la bitacora va en la misma transaccion: si falla, la escritura se revierte', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta();
    $antes = FactPrefactura::count();
    $renglones = $p->renglones()->count();

    Bitacora::creating(fn () => throw new RuntimeException('bitacora caida'));

    $this->postJson('/api/facturacion/prefacturas', cuerpoPrefactura())->assertStatus(500);
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/renglones", cuerpoRenglon())->assertStatus(500);
    $this->putJson("/api/facturacion/prefacturas/{$p->id}", cuerpoPrefactura(['origen' => 'MMMX']))->assertStatus(500);
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/descartar")->assertStatus(500);

    expect(FactPrefactura::count())->toBe($antes)
        ->and($p->renglones()->count())->toBe($renglones)
        ->and($p->fresh()->origen)->toBeNull()
        ->and($p->fresh()->status)->toBe(FactPrefactura::STATUS_ACTIVO);
});

test('un borrador descartado no se cierra, no se edita y no recibe renglones', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta();
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/descartar")->assertOk();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar")->assertStatus(409)->assertJsonPath('codigo', 'ya_descartada');
    $this->putJson("/api/facturacion/prefacturas/{$p->id}", cuerpoPrefactura())->assertStatus(409)->assertJsonPath('codigo', 'ya_descartada');
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/renglones", cuerpoRenglon())->assertStatus(409)->assertJsonPath('codigo', 'ya_descartada');

    // Cerrar uno descartado no puede consumir folio.
    expect($p->fresh()->folio)->toBeNull()
        ->and(App\Models\FactConfiguracion::valor('prefactura_folio_siguiente'))->toBe('10000');
});

test('descartar, editar o consultar una prefactura que no existe responde 404', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->patchJson('/api/facturacion/prefacturas/999/descartar')->assertNotFound();
    $this->putJson('/api/facturacion/prefacturas/999', cuerpoPrefactura())->assertNotFound();
    $this->getJson('/api/facturacion/prefacturas/999')->assertNotFound();
});

test('cada ruta de escritura responde 403 a quien no tiene factPrefacturas', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));
    [$p] = prefacturaCompleta();
    $renglon = $p->renglones()->sole();
    $base = "/api/facturacion/prefacturas/{$p->id}";

    $this->postJson('/api/facturacion/prefacturas', cuerpoPrefactura())->assertForbidden();
    $this->putJson($base, cuerpoPrefactura())->assertForbidden();
    $this->patchJson("{$base}/cerrar")->assertForbidden();
    $this->postJson("{$base}/renglones", cuerpoRenglon())->assertForbidden();
    $this->deleteJson("{$base}/renglones/{$renglon->id}")->assertForbidden();
    $this->patchJson("{$base}/estancia", ['pernoctas' => 0, 'transitos_2h' => 0, 'transitos_12h' => 0])->assertForbidden();
    $this->patchJson("{$base}/internacional")->assertForbidden();
    $this->patchJson("{$base}/descartar")->assertForbidden();

    expect($p->fresh()->estado)->toBe(FactPrefactura::ESTADO_BORRADOR)
        ->and($p->fresh()->status)->toBe(FactPrefactura::STATUS_ACTIVO)
        ->and($p->renglones()->count())->toBe(1);
});

test('el rol admin escribe prefacturas sin el subdepartamento', function () {
    $this->actingAs(usuarioAdmin());

    $this->postJson('/api/facturacion/prefacturas', cuerpoPrefactura())->assertCreated();
});

test('agregar un renglon congela los valores del catalogo y quitarlo lo borra', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $id = $this->postJson('/api/facturacion/prefacturas', cuerpoPrefactura())->json('prefactura.id');

    $renglon = $this->postJson("/api/facturacion/prefacturas/{$id}/renglones", cuerpoRenglon(['cantidad' => 3]))
        ->assertCreated()->json('renglon_id');

    // El catalogo cambia despues: el renglon no se mueve.
    FactServicio::where('nombre', 'Comisariato')->update(['precio_unitario' => 9999]);

    $ficha = $this->getJson("/api/facturacion/prefacturas/{$id}")->assertOk();

    expect($ficha->json('prefactura.renglones.0.precio_unitario'))->toBe('500.0000')
        ->and($ficha->json('prefactura.renglones.0.importe'))->toBe('1500.00')
        ->and($ficha->json('prefactura.subtotal'))->toBe('1500.00')
        ->and($ficha->json('prefactura.total'))->toBe('1740.00');

    $this->deleteJson("/api/facturacion/prefacturas/{$id}/renglones/{$renglon}")->assertOk();
    expect(FactPrefacturaRenglon::count())->toBe(0);
});

test('un renglon de otra prefactura no se puede quitar por esta', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$a] = prefacturaCompleta();
    [$b] = prefacturaCompleta();

    $this->deleteJson("/api/facturacion/prefacturas/{$a->id}/renglones/{$b->renglones()->sole()->id}")->assertNotFound();

    expect($b->renglones()->count())->toBe(1);
});

test('el paquete internacional marca el destino y agrega los servicios del paquete', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    FactServicio::create(['nombre' => 'Migracion', 'precio_unitario' => 300.0, 'en_paquete_internacional' => true]);
    $p = prefacturaBorrador();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/internacional")
        ->assertOk()
        ->assertJsonPath('renglones', 1);

    expect($p->fresh()->tipo_destino)->toBe(FactPrefactura::DESTINO_INTERNACIONAL)
        ->and($p->renglones()->count())->toBe(1);
});

test('el listado filtra por estado y por matricula sin que el OR de la busqueda se coma el estado', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$abierta] = prefacturaCompleta();
    [$cerrada, $usuario] = prefacturaCompleta();
    app(CierrePrefactura::class)->cerrar($cerrada, $usuario->id, confirmarSinCobro: true);

    $this->getJson('/api/facturacion/prefacturas?estado=cerrada')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $cerrada->id);
    $this->getJson('/api/facturacion/prefacturas?estado=borrador')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $abierta->id);
    $this->getJson('/api/facturacion/prefacturas?estado=borrador&q='.$abierta->aeronave->matricula)->assertOk()->assertJsonCount(1, 'data');
    $this->getJson('/api/facturacion/prefacturas?estado=borrador&q='.$cerrada->aeronave->matricula)->assertOk()->assertJsonCount(0, 'data');
});

test('un cliente dado de baja no se acepta en una prefactura', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $cliente = App\Models\FactCliente::create(['nombre' => 'Baja', 'status' => 'N']);

    $this->postJson('/api/facturacion/prefacturas', cuerpoPrefactura(['cliente_id' => $cliente->id]))
        ->assertStatus(422)
        ->assertJsonValidationErrors(['cliente_id']);
});

/*
|--------------------------------------------------------------------------
| Ronda de arreglos 1
|--------------------------------------------------------------------------
*/

test('los servicios de estancia no se agregan a mano: dan 422 y no crean renglon', function (string $concepto) {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $id = $this->postJson('/api/facturacion/prefacturas', cuerpoPrefactura())->json('prefactura.id');
    $servicio = FactServicio::create(['nombre' => 'Estancia '.$concepto, 'precio_unitario' => 99.0, 'concepto' => $concepto]);

    $respuesta = $this->postJson("/api/facturacion/prefacturas/{$id}/renglones", ['servicio_id' => $servicio->id, 'cantidad' => 1])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['servicio_id']);

    expect($respuesta->json('errors.servicio_id.0'))->toContain('Recalcular estancia')
        ->and(FactPrefacturaRenglon::count())->toBe(0);
})->with([
    'pernocta' => FactServicio::CONCEPTO_ESTANCIA_PERNOCTA,
    'transito 2 h' => FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H,
    'transito 12 h' => FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H,
]);

test('un servicio normal sigue agregandose a mano', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $id = $this->postJson('/api/facturacion/prefacturas', cuerpoPrefactura())->json('prefactura.id');

    $this->postJson("/api/facturacion/prefacturas/{$id}/renglones", cuerpoRenglon())->assertCreated();
});

test('los mensajes de validacion estan en espanol y no son claves crudas', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $id = $this->postJson('/api/facturacion/prefacturas', cuerpoPrefactura())->json('prefactura.id');

    $renglon = $this->postJson("/api/facturacion/prefacturas/{$id}/renglones", ['servicio_id' => cuerpoRenglon()['servicio_id'], 'cantidad' => 'x'])
        ->assertStatus(422);
    expect($renglon->json('errors.cantidad'))->toContain('La cantidad debe ser un número entero.');

    $this->postJson("/api/facturacion/prefacturas/{$id}/renglones", [])
        ->assertJsonPath('errors.servicio_id.0', 'Elige el servicio que se va a agregar.')
        ->assertJsonPath('errors.cantidad.0', 'La cantidad es obligatoria.');

    $this->postJson('/api/facturacion/prefacturas', [])
        ->assertJsonPath('errors.aeronave_id.0', 'La matrícula es obligatoria.')
        ->assertJsonPath('errors.tipo_destino.0', 'Indica si el destino es nacional o internacional.');

    $this->postJson('/api/facturacion/prefacturas', cuerpoPrefactura(['tipo_destino' => 'luna', 'llegada_at' => 'ayer-ish']))
        ->assertJsonPath('errors.tipo_destino.0', 'El tipo de destino debe ser nacional o internacional.')
        ->assertJsonPath('errors.llegada_at.0', 'La fecha de llegada no es una fecha válida.');

    $this->patchJson("/api/facturacion/prefacturas/{$id}/estancia", ['pernoctas' => -1, 'transitos_12h' => 'x'])
        ->assertJsonPath('errors.pernoctas.0', 'La cantidad de las pernoctas no puede ser negativa.')
        ->assertJsonPath('errors.transitos_2h.0', 'Indica la cantidad de los tránsitos de 2 horas (puede ser 0).')
        ->assertJsonPath('errors.transitos_12h.0', 'La cantidad de los tránsitos de 12 horas debe ser un número entero.');
});

test('el listado valida desde y hasta como fechas', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->getJson('/api/facturacion/prefacturas?desde=nunca')
        ->assertStatus(422)
        ->assertJsonPath('errors.desde.0', 'La fecha «desde» no es una fecha válida.');
    $this->getJson('/api/facturacion/prefacturas?hasta=nunca')->assertStatus(422)->assertJsonValidationErrors(['hasta']);
    $this->getJson('/api/facturacion/prefacturas?desde=2026-01-01&hasta=2026-12-31')->assertOk();
});

/** Llama al endpoint de escritura de renglones indicado, sobre la prefactura dada. */
function llamarEscrituraDeRenglones(Tests\TestCase $prueba, string $endpoint, int $id, int $renglonId = 0): Illuminate\Testing\TestResponse
{
    $base = "/api/facturacion/prefacturas/{$id}";

    return match ($endpoint) {
        'store' => $prueba->postJson("{$base}/renglones", cuerpoRenglon()),
        'destroy' => $prueba->deleteJson("{$base}/renglones/{$renglonId}"),
        'estancia' => $prueba->patchJson("{$base}/estancia", ['pernoctas' => 1, 'transitos_2h' => 0, 'transitos_12h' => 0]),
        'internacional' => $prueba->patchJson("{$base}/internacional"),
        'cortesia' => $prueba->patchJson("{$base}/renglones/{$renglonId}/cortesia", ['es_cortesia' => true]),
    };
}

test('un borrador descartado no recibe ninguna escritura de renglones', function (string $endpoint) {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = conEstancia();
    $renglon = renglonDe($p, 100.0, 1);
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/descartar")->assertOk();
    $bitacora = Bitacora::count();

    llamarEscrituraDeRenglones($this, $endpoint, $p->id, $renglon->id)
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_descartada');

    expect($p->renglones()->count())->toBe(1)
        ->and($p->fresh()->tipo_destino)->toBe(FactPrefactura::DESTINO_NACIONAL)
        ->and(Bitacora::count())->toBe($bitacora);
})->with(['store', 'destroy', 'estancia', 'internacional', 'cortesia']);

test('si se descarta entre el chequeo y el candado, la escritura de renglones responde 409 ya_descartada', function (string $endpoint) {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    FactServicio::create(['nombre' => 'Migracion', 'precio_unitario' => 300.0, 'en_paquete_internacional' => true]);
    $p = conEstancia();
    $renglon = renglonDe($p, 100.0, 1);

    // Otra sesion descarta DESPUES de que el controlador leyo la prefactura (aun activa).
    $hecho = false;
    DB::listen(function ($consulta) use ($p, &$hecho) {
        if (! $hecho && str_contains($consulta->sql, 'from "fact_prefacturas"')) {
            $hecho = true;
            DB::table('fact_prefacturas')->where('id', $p->id)->update(['status' => FactPrefactura::STATUS_INACTIVO]);
        }
    });

    llamarEscrituraDeRenglones($this, $endpoint, $p->id, $renglon->id)
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_descartada');

    expect($p->renglones()->count())->toBe(1)
        ->and($p->fresh()->tipo_destino)->toBe(FactPrefactura::DESTINO_NACIONAL)
        ->and(Bitacora::count())->toBe(0);
})->with(['store', 'destroy', 'estancia', 'internacional', 'cortesia']);

test('la bitacora va en la misma transaccion tambien al quitar un renglon, recalcular estancia y marcar internacional', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    FactServicio::create(['nombre' => 'Migracion', 'precio_unitario' => 300.0, 'en_paquete_internacional' => true]);
    $p = conEstancia();
    $renglon = renglonDe($p, 100.0, 1);

    Bitacora::creating(fn () => throw new RuntimeException('bitacora caida'));

    llamarEscrituraDeRenglones($this, 'destroy', $p->id, $renglon->id)->assertStatus(500);
    llamarEscrituraDeRenglones($this, 'estancia', $p->id)->assertStatus(500);
    llamarEscrituraDeRenglones($this, 'internacional', $p->id)->assertStatus(500);
    llamarEscrituraDeRenglones($this, 'cortesia', $p->id, $renglon->id)->assertStatus(500);

    expect(FactPrefacturaRenglon::whereKey($renglon->id)->exists())->toBeTrue()
        ->and($renglon->fresh()->es_cortesia)->toBeFalse()
        ->and($p->renglones()->count())->toBe(1)
        ->and($p->fresh()->tipo_destino)->toBe(FactPrefactura::DESTINO_NACIONAL);
});

test('un renglon con ajuste desconocido dentro de una cerrada no tumba la ficha: se ve el sello y el aviso', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $usuario] = prefacturaCompleta(precio: 1000.0, cantidad: 1);
    app(CierrePrefactura::class)->cerrar($p, $usuario->id, confirmarSinCobro: true);
    DB::table('fact_prefactura_renglones')->where('prefactura_id', $p->id)->update(['ajuste_precio' => 'raro']);

    $ficha = $this->getJson("/api/facturacion/prefacturas/{$p->id}")->assertOk();

    // Lo que se cobra es el sello; lo que no se puede verificar se dice, sin inventar un "todo bien".
    expect($ficha->json('prefactura.total'))->toBe('1160.00')
        ->and($ficha->json('prefactura.totales_error'))->toBeNull()
        ->and($ficha->json('prefactura.sello_discrepa'))->toBeNull()
        ->and($ficha->json('prefactura.sello_error'))->toBeString()
        ->and($ficha->json('prefactura.renglones.0.importe'))->toBeNull()
        ->and($ficha->json('prefactura.renglones.0.importe_error'))->toBeString();

    $lista = $this->getJson('/api/facturacion/prefacturas')->assertOk()->json('data');
    expect($lista[0]['sello_error'])->toBeString();
});

/*
|--------------------------------------------------------------------------
| Ronda de arreglos 2: filtro por llegada y llegadas sin facturar
|--------------------------------------------------------------------------
*/

test('desde y hasta filtran por la fecha de llegada, no por la de captura', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $enero = prefacturaBorrador();
    $enero->update(['llegada_at' => '2026-01-15 10:00:00']);
    $marzo = prefacturaBorrador();
    $marzo->update(['llegada_at' => '2026-03-15 10:00:00']);

    // Las dos se CAPTURARON hoy: si el filtro mirara `created_at`, entrarian ambas.
    $ids = fn (string $consulta) => collect($this->getJson("/api/facturacion/prefacturas?{$consulta}")->assertOk()->json('data'))->pluck('id')->sort()->values()->all();

    expect($ids('desde=2026-02-01'))->toBe([$marzo->id])
        ->and($ids('hasta=2026-02-01'))->toBe([$enero->id])
        ->and($ids('desde=2026-01-15&hasta=2026-01-15'))->toBe([$enero->id])
        ->and($ids('desde=2026-01-01&hasta=2026-12-31'))->toBe([$enero->id, $marzo->id]);
});

test('con un filtro de fechas activo, un borrador sin llegada capturada queda fuera; sin filtro, sale', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $sinLlegada = prefacturaBorrador();
    $conLlegada = prefacturaBorrador();
    $conLlegada->update(['llegada_at' => '2026-03-15 10:00:00']);

    $ids = fn (string $consulta) => collect($this->getJson("/api/facturacion/prefacturas{$consulta}")->assertOk()->json('data'))->pluck('id')->sort()->values()->all();

    // Deliberado: sin fecha de llegada no hay nada que comparar contra el rango.
    expect($ids(''))->toBe([$sinLlegada->id, $conLlegada->id])
        ->and($ids('?desde=2000-01-01'))->toBe([$conLlegada->id])
        ->and($ids('?hasta=2100-01-01'))->toBe([$conLlegada->id]);
});

function operacionDeLlegada(string $matricula, array $extra = []): App\Models\OperacionDiaria
{
    return App\Models\OperacionDiaria::create(array_merge([
        'user_id' => App\Models\User::factory()->create()->id,
        'fecha' => '2026-10-01',
        'tipo' => 'llegada',
        'matricula' => $matricula,
        'equipo' => 'C525',
        'hora' => '10:00:00',
        'lugar' => 'MMTO',
        'pax' => 2,
        'departamento' => 'Despacho',
    ], $extra));
}

test('las llegadas sin facturar son de lectura: sin sesion 401, y cualquier autenticado las ve', function () {
    $this->getJson('/api/facturacion/prefacturas/llegadas-sin-facturar?matricula=XA-AAA')->assertUnauthorized();

    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));
    $this->getJson('/api/facturacion/prefacturas/llegadas-sin-facturar?matricula=XA-AAA')->assertOk()->assertJsonPath('data', []);
});

test('las llegadas sin facturar exigen la matricula', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));

    $this->getJson('/api/facturacion/prefacturas/llegadas-sin-facturar')
        ->assertStatus(422)
        ->assertJsonPath('errors.matricula.0', 'Indica la matrícula.');
});

test('las llegadas sin facturar excluyen las que una prefactura activa ya tomo, y devuelven la forma que la pantalla espera', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));
    $libre = operacionDeLlegada('XA-AAA', ['hora' => '09:30:00', 'lugar' => 'KMIA']);
    $enBorrador = operacionDeLlegada('XA-AAA');
    $enCerrada = operacionDeLlegada('XA-AAA');
    $enDescartada = operacionDeLlegada('XA-AAA');

    foreach ([[$enBorrador, 'borrador', 'A'], [$enCerrada, 'cerrada', 'A'], [$enDescartada, 'borrador', 'N']] as [$operacion, $estado, $status]) {
        prefacturaBorrador()->update(['operacion_llegada_id' => $operacion->id, 'estado' => $estado, 'status' => $status]);
    }

    $respuesta = $this->getJson('/api/facturacion/prefacturas/llegadas-sin-facturar?matricula=XA-AAA')->assertOk();

    // La descartada ya no reserva su operacion: vuelve a ofrecerse. Las activas (borrador o cerrada), no.
    expect(collect($respuesta->json('data'))->pluck('id')->sort()->values()->all())->toBe([$libre->id, $enDescartada->id])
        ->and(array_keys($respuesta->json('data.0')))->toEqualCanonicalizing(['id', 'matricula', 'fecha', 'hora', 'lugar']);

    $fila = collect($respuesta->json('data'))->firstWhere('id', $libre->id);
    expect($fila['matricula'])->toBe('XA-AAA')
        ->and($fila['hora'])->toBe('09:30:00')
        ->and($fila['lugar'])->toBe('KMIA')
        ->and($fila['fecha'])->toStartWith('2026-10-01');
});

test('las llegadas sin facturar son de la matricula exacta, solo llegadas y solo activas', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));
    $buena = operacionDeLlegada('XA-AB');
    operacionDeLlegada('XA-ABC');
    operacionDeLlegada('XA-AB', ['tipo' => 'salida']);
    operacionDeLlegada('XA-AB', ['status' => false]);

    $ids = collect($this->getJson('/api/facturacion/prefacturas/llegadas-sin-facturar?matricula=xa-ab')->assertOk()->json('data'))->pluck('id')->all();

    expect($ids)->toBe([$buena->id]);
});

test('las llegadas sin facturar salen de la mas reciente a la mas antigua y respetan el maximo', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));
    $vieja = operacionDeLlegada('XA-AAA', ['fecha' => '2026-09-01']);
    $media = operacionDeLlegada('XA-AAA', ['fecha' => '2026-09-15']);
    $nueva = operacionDeLlegada('XA-AAA', ['fecha' => '2026-09-30']);

    $todas = collect($this->getJson('/api/facturacion/prefacturas/llegadas-sin-facturar?matricula=XA-AAA')->assertOk()->json('data'))->pluck('id')->all();
    $dos = collect($this->getJson('/api/facturacion/prefacturas/llegadas-sin-facturar?matricula=XA-AAA&max=2')->assertOk()->json('data'))->pluck('id')->all();

    expect($todas)->toBe([$nueva->id, $media->id, $vieja->id])
        ->and($dos)->toBe([$nueva->id, $media->id]);

    $this->getJson('/api/facturacion/prefacturas/llegadas-sin-facturar?matricula=XA-AAA&max=0')->assertStatus(422);
});

test('una prefactura con la operacion de llegada nula no esconde ninguna llegada (el NOT IN no se envenena con NULL)', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));
    $libre = operacionDeLlegada('XA-AAA');
    prefacturaBorrador(); // operacion_llegada_id = NULL, activa

    $ids = collect($this->getJson('/api/facturacion/prefacturas/llegadas-sin-facturar?matricula=XA-AAA')->assertOk()->json('data'))->pluck('id')->all();

    expect($ids)->toBe([$libre->id]);
});

/*
|--------------------------------------------------------------------------
| Revision final: el paquete internacional y la estancia no fallan en silencio
|--------------------------------------------------------------------------
*/

function paqueteInternacionalCompleto(): void
{
    foreach (['DSMES - salida' => 4060.50, 'DSM - salida' => 348.0, 'Mex-eAPI - salida' => 900.0, 'Servicios Internacionales - salida' => 750.0] as $nombre => $precio) {
        FactServicio::create(['nombre' => $nombre, 'precio_unitario' => $precio, 'en_paquete_internacional' => true]);
    }
}

test('el paquete internacional completo marca el destino y no trae motivo', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    paqueteInternacionalCompleto();
    $p = prefacturaBorrador();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/internacional")
        ->assertOk()
        ->assertJsonPath('renglones', 4)
        ->assertJsonPath('motivo', null)
        ->assertJsonPath('message', 'Paquete internacional agregado.');

    expect($p->fresh()->tipo_destino)->toBe(FactPrefactura::DESTINO_INTERNACIONAL)
        ->and($p->fresh()->subtotal())->toBe('6058.50');
});

test('el paquete internacional incompleto marca el destino, agrega lo que hay y dice que servicio falto', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    paqueteInternacionalCompleto();
    FactServicio::where('nombre', 'DSMES - salida')->update(['status' => FactServicio::STATUS_INACTIVO]);
    $p = prefacturaBorrador();

    $respuesta = $this->patchJson("/api/facturacion/prefacturas/{$p->id}/internacional")
        ->assertOk()
        ->assertJsonPath('renglones', 3);

    expect($respuesta->json('motivo'))->toContain('DSMES - salida')
        ->and($respuesta->json('message'))->toBe($respuesta->json('motivo'))
        ->and($p->fresh()->tipo_destino)->toBe(FactPrefactura::DESTINO_INTERNACIONAL)
        ->and($p->renglones()->count())->toBe(3);
});

test('un paquete internacional con cero servicios marcados responde 200 con el motivo y NO marca el destino', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    FactServicio::create(['nombre' => 'Comisariato', 'precio_unitario' => 500.0]);
    $p = prefacturaBorrador();

    $respuesta = $this->patchJson("/api/facturacion/prefacturas/{$p->id}/internacional")
        ->assertOk()
        ->assertJsonPath('renglones', 0);

    // Sigue nacional: el editor solo ofrece «Marcar internacional» con destino nacional,
    // asi que marcarla vacia la dejaria sin forma de corregirse.
    expect($respuesta->json('motivo'))->toBeString()->not->toBe('')
        ->and($p->fresh()->tipo_destino)->toBe(FactPrefactura::DESTINO_NACIONAL)
        ->and($p->renglones()->count())->toBe(0);
});

test('un paquete internacional con todos de baja tampoco marca el destino', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    FactServicio::create(['nombre' => 'DSMES - salida', 'precio_unitario' => 4060.50, 'en_paquete_internacional' => true, 'status' => FactServicio::STATUS_INACTIVO]);
    $p = prefacturaBorrador();

    $respuesta = $this->patchJson("/api/facturacion/prefacturas/{$p->id}/internacional")->assertOk()->assertJsonPath('renglones', 0);

    expect($respuesta->json('motivo'))->toContain('DSMES - salida')
        ->and($p->fresh()->tipo_destino)->toBe(FactPrefactura::DESTINO_NACIONAL);
});

test('si el paquete ya estaba en los renglones, se marca internacional aunque no se agregue nada', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $servicio = FactServicio::create(['nombre' => 'Migracion', 'precio_unitario' => 300.0, 'en_paquete_internacional' => true]);
    $p = prefacturaBorrador();
    $p->renglones()->create([
        'servicio_id' => $servicio->id, 'nombre_servicio' => 'Migracion', 'precio_unitario' => 300.0,
        'cantidad' => 1, 'es_de_tercero' => false, 'margen' => 0, 'ajuste_precio' => 'ninguno', 'orden' => 1,
    ]);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/internacional")
        ->assertOk()
        ->assertJsonPath('renglones', 0)
        ->assertJsonPath('motivo', null);

    expect($p->fresh()->tipo_destino)->toBe(FactPrefactura::DESTINO_INTERNACIONAL);
});

test('el intento de marcar internacional sin paquete queda en la bitacora como intento, no como marca', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/internacional")->assertOk();

    $registro = Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)->where('accion', Bitacora::ACCION_ACTUALIZAR)->sole();

    expect($registro->descripcion)->toContain('Se intentó marcar internacional')
        ->and($registro->descripcion)->not->toContain('Se marcó');
});

test('una prefactura no se puede abrir internacional por API: el destino lo pone la accion del paquete', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson('/api/facturacion/prefacturas', cuerpoPrefactura(['tipo_destino' => 'internacional']))
        ->assertStatus(422)
        ->assertJsonValidationErrors(['tipo_destino']);

    expect(FactPrefactura::count())->toBe(0);
});

test('si falta el servicio de estancia responde 422 con el mensaje en espanol y un codigo, no un 500', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = conEstancia();
    FactServicio::porConcepto(FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->update(['status' => FactServicio::STATUS_INACTIVO]);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/estancia", ['pernoctas' => 1, 'transitos_2h' => 0, 'transitos_12h' => 0])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'servicio_estancia_no_disponible')
        ->assertJsonPath('message', "No existe un servicio activo con concepto '".FactServicio::CONCEPTO_ESTANCIA_PERNOCTA."'. Corre el importador de catálogos o reactívalo.");

    expect($p->renglones()->count())->toBe(0)
        ->and(bitacoraDePrefacturas(Bitacora::ACCION_ACTUALIZAR))->toBe(0);
});

test('el 422 de estancia revierte lo ya borrado: los renglones previos siguen', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = conEstancia();
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/estancia", ['pernoctas' => 1, 'transitos_2h' => 0, 'transitos_12h' => 0])->assertOk();
    FactServicio::porConcepto(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H)->update(['status' => FactServicio::STATUS_INACTIVO]);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/estancia", ['pernoctas' => 4, 'transitos_2h' => 1, 'transitos_12h' => 0])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'servicio_estancia_no_disponible');

    expect($p->renglones()->sole()->cantidad)->toBe(1);
});

test('una prefactura ya internacional sigue guardando su encabezado al reenviar su destino', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    paqueteInternacionalCompleto();
    $id = $this->postJson('/api/facturacion/prefacturas', cuerpoPrefactura())->assertCreated()->json('prefactura.id');
    $this->patchJson("/api/facturacion/prefacturas/{$id}/internacional")->assertOk();

    // El editor reenvia el destino que la prefactura ya tiene: si esto se rechaza, el
    // encabezado deja de guardarse y, sin cliente, la prefactura nunca se puede cerrar.
    $this->putJson("/api/facturacion/prefacturas/{$id}", cuerpoPrefactura(['tipo_destino' => 'internacional', 'origen' => 'MMMX']))
        ->assertOk()
        ->assertJsonPath('prefactura.origen', 'MMMX')
        ->assertJsonPath('prefactura.tipo_destino', 'internacional');
});

test('editar el encabezado no cambia el destino a internacional: eso lo hace su propia accion', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();

    $this->putJson("/api/facturacion/prefacturas/{$p->id}", cuerpoPrefactura(['tipo_destino' => 'internacional']))
        ->assertStatus(422)
        ->assertJsonValidationErrors(['tipo_destino']);

    expect($p->fresh()->tipo_destino)->toBe(FactPrefactura::DESTINO_NACIONAL);
});
