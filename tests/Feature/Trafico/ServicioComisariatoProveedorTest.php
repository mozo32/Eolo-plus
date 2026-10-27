<?php

use App\Models\FactCategoriaServicio;
use App\Models\FactServicio;
use App\Models\ServicioComisariato;
use App\Models\User;
use App\Services\RellenarProveedorDeComisariatos;
use Illuminate\Database\QueryException;

/** La categoría a la que pertenecen los cinco proveedores de comisariato. */
function categoriaComisariatos(): FactCategoriaServicio
{
    return FactCategoriaServicio::firstOrCreate(['nombre' => 'Comisariatos'], ['status' => 'A']);
}

/** Un servicio de comisariato del catálogo. El precio es 0 a propósito: el importe viene de fuera. */
function servicioComisariato(string $nombre, string $status = 'A'): FactServicio
{
    return FactServicio::create([
        'categoria_servicio_id' => categoriaComisariatos()->id,
        'nombre' => $nombre,
        'precio_unitario' => 0,
        'es_de_tercero' => false,
        'margen' => 0,
        'ajuste_precio' => FactServicio::AJUSTE_NINGUNO,
        'status' => $status,
    ]);
}

/** Un comisariato ya guardado. Solo `user_id`, `fecha_entrega` y `hora_entrega` son obligatorios. */
function comisariatoDe(array $atributos = []): ServicioComisariato
{
    return ServicioComisariato::create(array_merge([
        'user_id' => User::factory()->create()->id,
        'fecha_entrega' => '2026-03-26',
        'hora_entrega' => '07:00',
        'matricula' => 'XA-ABC',
        'subtotal' => 520,
        'total' => 520,
        'status' => 'A',
    ], $atributos));
}

test('un comisariato puede apuntar a su servicio del catalogo', function () {
    $servicio = servicioComisariato('Comisariato_Comexa');

    $comisariato = comisariatoDe(['fact_servicio_id' => $servicio->id]);

    expect($comisariato->fresh()->fact_servicio_id)->toBe($servicio->id)
        ->and($comisariato->fresh()->factServicio->nombre)->toBe('Comisariato_Comexa');
});

test('un comisariato sin proveedor elegido es valido: las filas viejas no tienen', function () {
    expect(comisariatoDe()->fresh()->fact_servicio_id)->toBeNull();
});

test('el relleno empareja los comisariatos viejos por el nombre del proveedor y deja el resto sin tocar', function () {
    $comexa = servicioComisariato('Comisariato_Comexa');
    $manny = servicioComisariato('Comisariato_Manny');

    $deComexa = comisariatoDe(['catering' => 'Comexa']);
    $deComexaEnMayusculas = comisariatoDe(['catering' => 'COMEXA']);
    $deMannys = comisariatoDe(['catering' => 'Mannys']);
    $deManny = comisariatoDe(['catering' => 'Manny']);
    $deMannysCatering = comisariatoDe(['catering' => 'Mannys Catering']);
    $deMannysEnMinusculas = comisariatoDe(['catering' => 'mannys catering']);
    $deOtro = comisariatoDe(['catering' => 'fd']);
    $sinTexto = comisariatoDe(['catering' => null]);
    $comparteLetras = comisariatoDe(['catering' => 'Avemex']);
    $contieneXa = comisariatoDe(['catering' => 'Taxa Aérea']);

    (new RellenarProveedorDeComisariatos)();

    expect($deComexa->fresh()->fact_servicio_id)->toBe($comexa->id)
        ->and($deComexaEnMayusculas->fresh()->fact_servicio_id)->toBe($comexa->id)
        ->and($deMannys->fresh()->fact_servicio_id)->toBe($manny->id)
        ->and($deManny->fresh()->fact_servicio_id)->toBe($manny->id)
        ->and($deMannysCatering->fresh()->fact_servicio_id)->toBe($manny->id)
        ->and($deMannysEnMinusculas->fresh()->fact_servicio_id)->toBe($manny->id)
        ->and($deOtro->fresh()->fact_servicio_id)->toBeNull()
        ->and($sinTexto->fresh()->fact_servicio_id)->toBeNull()
        ->and($comparteLetras->fresh()->fact_servicio_id)->toBeNull()
        ->and($contieneXa->fresh()->fact_servicio_id)->toBeNull();
});

test('el relleno no pisa un proveedor ya elegido a mano', function () {
    servicioComisariato('Comisariato_Comexa');
    $manny = servicioComisariato('Comisariato_Manny');

    $elegidoAMano = comisariatoDe(['catering' => 'Comexa', 'fact_servicio_id' => $manny->id]);

    (new RellenarProveedorDeComisariatos)();

    expect($elegidoAMano->fresh()->fact_servicio_id)->toBe($manny->id);
});

test('un servicio que ya identifico un comisariato no se puede borrar', function () {
    $servicio = servicioComisariato('Comisariato_Comexa');
    comisariatoDe(['fact_servicio_id' => $servicio->id]);

    expect(fn () => $servicio->delete())->toThrow(QueryException::class);

    expect(FactServicio::find($servicio->id))->not->toBeNull()
        ->and(ServicioComisariato::where('fact_servicio_id', $servicio->id)->count())->toBe(1);
});

test('la lista de proveedores trae solo los servicios activos de la categoria Comisariatos', function () {
    $comexa = servicioComisariato('Comisariato_Comexa');
    servicioComisariato('Comisariato_Avemex', 'N');

    $otraCategoria = FactCategoriaServicio::create(['nombre' => 'Combustible & Servicios', 'status' => 'A']);
    FactServicio::create([
        'categoria_servicio_id' => $otraCategoria->id,
        'nombre' => 'Combustible JET A-1',
        'precio_unitario' => 25.99,
        'es_de_tercero' => false,
        'margen' => 0,
        'ajuste_precio' => FactServicio::AJUSTE_NINGUNO,
        'status' => 'A',
    ]);

    $this->actingAs(User::factory()->create());

    $respuesta = $this->getJson('/api/ServicioComisariato/proveedores');

    $respuesta->assertOk();
    expect($respuesta->json())->toHaveCount(1)
        ->and($respuesta->json('0.id'))->toBe($comexa->id)
        ->and($respuesta->json('0.nombre'))->toBe('Comisariato_Comexa');
});

test('la lista NO filtra el margen ni el precio a Trafico', function () {
    servicioComisariato('Comisariato_Manny');

    $this->actingAs(User::factory()->create());

    $respuesta = $this->getJson('/api/ServicioComisariato/proveedores');
    $respuesta->assertOk();

    $claves = array_keys($respuesta->json('0'));

    // Parece de más hasta que alguien añade un campo al recurso y filtra el margen sin querer.
    expect($claves)->toBe(['id', 'nombre']);
});

test('la lista de proveedores exige haber iniciado sesion', function () {
    $this->getJson('/api/ServicioComisariato/proveedores')->assertUnauthorized();
});
