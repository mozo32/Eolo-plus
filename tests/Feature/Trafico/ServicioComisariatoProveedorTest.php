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

test('el alta guarda el proveedor elegido y ya no escribe catering', function () {
    $servicio = servicioComisariato('Comisariato_Comexa');
    $this->actingAs(User::factory()->create());

    $this->postJson('/api/ServicioComisariato', [
        'proveedorId' => $servicio->id,
        'formaPago' => 'Cargo a la matrícula',
        'fechaEntrega' => now()->toDateString(),
        'horaEntrega' => '07:00',
        'matricula' => 'XA-ABC',
        'detalle' => 'Salmón y ensalada cesar',
        'solicitadoPor' => 'Capitán',
        'atendio' => 'Mostrador',
        'subtotal' => 520,
        'total' => 520,
    ])->assertCreated();

    $guardado = ServicioComisariato::latest('id')->first();

    expect($guardado->fact_servicio_id)->toBe($servicio->id)
        ->and($guardado->catering)->toBeNull();
});

test('el alta rechaza un servicio que no es de la categoria Comisariatos', function () {
    $otraCategoria = FactCategoriaServicio::create(['nombre' => 'Tránsitos', 'status' => 'A']);
    $ajeno = FactServicio::create([
        'categoria_servicio_id' => $otraCategoria->id,
        'nombre' => 'Transito 12 horas',
        'precio_unitario' => 99,
        'es_de_tercero' => false,
        'margen' => 0,
        'ajuste_precio' => FactServicio::AJUSTE_NINGUNO,
        'status' => 'A',
    ]);

    $this->actingAs(User::factory()->create());

    $this->postJson('/api/ServicioComisariato', [
        'proveedorId' => $ajeno->id,
        'fechaEntrega' => now()->toDateString(),
        'horaEntrega' => '07:00',
        'subtotal' => 520,
        'total' => 520,
    ])->assertStatus(422)->assertJsonValidationErrors('proveedorId');
});

test('el alta rechaza un proveedor dado de baja', function () {
    $baja = servicioComisariato('Comisariato_Avemex', 'N');
    $this->actingAs(User::factory()->create());

    $this->postJson('/api/ServicioComisariato', [
        'proveedorId' => $baja->id,
        'fechaEntrega' => now()->toDateString(),
        'horaEntrega' => '07:00',
        'subtotal' => 520,
        'total' => 520,
    ])->assertStatus(422)->assertJsonValidationErrors('proveedorId');
});

test('el alta exige elegir proveedor', function () {
    $this->actingAs(User::factory()->create());

    $this->postJson('/api/ServicioComisariato', [
        'fechaEntrega' => now()->toDateString(),
        'horaEntrega' => '07:00',
        'subtotal' => 520,
        'total' => 520,
    ])->assertStatus(422)->assertJsonValidationErrors('proveedorId');
});

test('la edicion cambia el proveedor', function () {
    $comexa = servicioComisariato('Comisariato_Comexa');
    $manny = servicioComisariato('Comisariato_Manny');
    $comisariato = comisariatoDe(['fact_servicio_id' => $comexa->id, 'fecha_entrega' => now()->toDateString()]);

    $this->actingAs(User::factory()->create());

    $this->putJson("/api/ServicioComisariato/{$comisariato->id}", [
        'proveedorId' => $manny->id,
        'fechaEntrega' => $comisariato->fecha_entrega->toDateString(),
        'horaEntrega' => '07:00',
        'subtotal' => 520,
        'total' => 520,
    ])->assertOk();

    expect($comisariato->fresh()->fact_servicio_id)->toBe($manny->id);
});

test('una ficha con la fecha ya fuera de ventana se sigue pudiendo corregir', function () {
    // Es la razón de ser de la condición: la ventana solo se exige cuando la fecha CAMBIA.
    $comexa = servicioComisariato('Comisariato_Comexa');
    $vieja = comisariatoDe(['fact_servicio_id' => $comexa->id, 'fecha_entrega' => '2020-01-01']);

    $this->actingAs(User::factory()->create());

    $this->putJson("/api/ServicioComisariato/{$vieja->id}", [
        'proveedorId' => $comexa->id,
        'fechaEntrega' => '2020-01-01',
        'horaEntrega' => '09:30',
        'subtotal' => 700,
        'total' => 700,
    ])->assertOk();

    expect($vieja->fresh()->hora_entrega->format('H:i'))->toBe('09:30');
});

test('la edicion rechaza un servicio que no es de la categoria Comisariatos', function () {
    $comexa = servicioComisariato('Comisariato_Comexa');
    $comisariato = comisariatoDe(['fact_servicio_id' => $comexa->id, 'fecha_entrega' => now()->toDateString()]);

    $otraCategoria = FactCategoriaServicio::create(['nombre' => 'Combustible & Servicios', 'status' => 'A']);
    $ajeno = FactServicio::create([
        'categoria_servicio_id' => $otraCategoria->id,
        'nombre' => 'Combustible JET A-1',
        'precio_unitario' => 25.99,
        'es_de_tercero' => false,
        'margen' => 0,
        'ajuste_precio' => FactServicio::AJUSTE_NINGUNO,
        'status' => 'A',
    ]);

    $this->actingAs(User::factory()->create());

    $this->putJson("/api/ServicioComisariato/{$comisariato->id}", [
        'proveedorId' => $ajeno->id,
        'fechaEntrega' => $comisariato->fecha_entrega->toDateString(),
        'horaEntrega' => '07:00',
        'subtotal' => 520,
        'total' => 520,
    ])->assertStatus(422)->assertJsonValidationErrors('proveedorId');

    expect($comisariato->fresh()->fact_servicio_id)->toBe($comexa->id);
});

test('la edicion exige elegir proveedor', function () {
    $comexa = servicioComisariato('Comisariato_Comexa');
    $comisariato = comisariatoDe(['fact_servicio_id' => $comexa->id, 'fecha_entrega' => now()->toDateString()]);

    $this->actingAs(User::factory()->create());

    $this->putJson("/api/ServicioComisariato/{$comisariato->id}", [
        'fechaEntrega' => $comisariato->fecha_entrega->toDateString(),
        'horaEntrega' => '07:00',
        'subtotal' => 520,
        'total' => 520,
    ])->assertStatus(422)->assertJsonValidationErrors('proveedorId');
});

test('la edicion no deja cambiar a un proveedor dado de baja', function () {
    $comexa = servicioComisariato('Comisariato_Comexa');
    $baja = servicioComisariato('Comisariato_Avemex', 'N');
    $comisariato = comisariatoDe(['fact_servicio_id' => $comexa->id, 'fecha_entrega' => now()->toDateString()]);

    $this->actingAs(User::factory()->create());

    $this->putJson("/api/ServicioComisariato/{$comisariato->id}", [
        'proveedorId' => $baja->id,
        'fechaEntrega' => $comisariato->fecha_entrega->toDateString(),
        'horaEntrega' => '07:00',
        'subtotal' => 520,
        'total' => 520,
    ])->assertStatus(422)->assertJsonValidationErrors('proveedorId');

    expect($comisariato->fresh()->fact_servicio_id)->toBe($comexa->id);
});

test('una ficha cuyo proveedor se dio de baja se sigue pudiendo corregir reenviando el mismo', function () {
    // Igual que la fecha: lo que se impide es PONER un proveedor de baja, no conservar el que ya tenia.
    $baja = servicioComisariato('Comisariato_Avemex', 'N');
    $comisariato = comisariatoDe(['fact_servicio_id' => $baja->id, 'fecha_entrega' => now()->toDateString()]);

    $this->actingAs(User::factory()->create());

    $this->putJson("/api/ServicioComisariato/{$comisariato->id}", [
        'proveedorId' => $baja->id,
        'fechaEntrega' => $comisariato->fecha_entrega->toDateString(),
        'horaEntrega' => '09:30',
        'subtotal' => 700,
        'total' => 700,
    ])->assertOk();

    expect($comisariato->fresh()->hora_entrega->format('H:i'))->toBe('09:30')
        ->and($comisariato->fresh()->fact_servicio_id)->toBe($baja->id);
});
