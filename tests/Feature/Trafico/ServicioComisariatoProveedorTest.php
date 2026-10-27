<?php

use App\Models\FactCategoriaServicio;
use App\Models\FactServicio;
use App\Models\ServicioComisariato;
use App\Models\User;
use App\Services\RellenarProveedorDeComisariatos;

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
    $deMannys = comisariatoDe(['catering' => 'Mannys']);
    $deManny = comisariatoDe(['catering' => 'Manny']);
    $deMannysCatering = comisariatoDe(['catering' => 'Mannys Catering']);
    $deOtro = comisariatoDe(['catering' => 'fd']);
    $sinTexto = comisariatoDe(['catering' => null]);

    (new RellenarProveedorDeComisariatos)();

    expect($deComexa->fresh()->fact_servicio_id)->toBe($comexa->id)
        ->and($deMannys->fresh()->fact_servicio_id)->toBe($manny->id)
        ->and($deManny->fresh()->fact_servicio_id)->toBe($manny->id)
        ->and($deMannysCatering->fresh()->fact_servicio_id)->toBe($manny->id)
        ->and($deOtro->fresh()->fact_servicio_id)->toBeNull()
        ->and($sinTexto->fresh()->fact_servicio_id)->toBeNull();
});

test('el relleno no pisa un proveedor ya elegido a mano', function () {
    servicioComisariato('Comisariato_Comexa');
    $manny = servicioComisariato('Comisariato_Manny');

    $elegidoAMano = comisariatoDe(['catering' => 'Comexa', 'fact_servicio_id' => $manny->id]);

    (new RellenarProveedorDeComisariatos)();

    expect($elegidoAMano->fresh()->fact_servicio_id)->toBe($manny->id);
});

test('el relleno no revienta ni cambia nada cuando los servicios no existen en la base', function () {
    $deComexa = comisariatoDe(['catering' => 'Comexa']);
    $deManny = comisariatoDe(['catering' => 'Manny']);

    (new RellenarProveedorDeComisariatos)();

    expect($deComexa->fresh()->fact_servicio_id)->toBeNull()
        ->and($deManny->fresh()->fact_servicio_id)->toBeNull();
});
