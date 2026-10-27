<?php

use App\Models\FactCategoriaServicio;
use App\Models\FactServicio;
use App\Models\ServicioComisariato;
use App\Models\User;
use App\Services\RellenarProveedorDeComisariatos;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Log;

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

test('el relleno deja constancia en el log cuando no encuentra el servicio, y no rellena ni revienta', function () {
    Log::spy();

    $manny = servicioComisariato('Comisariato_Manny');
    $deComexa = comisariatoDe(['catering' => 'Comexa']);
    $deManny = comisariatoDe(['catering' => 'Mannys']);

    (new RellenarProveedorDeComisariatos)();

    // Lo que no se encuentra se dice: nombre buscado y consecuencia.
    Log::shouldHaveReceived('warning')->withArgs(fn ($mensaje) => str_contains($mensaje, 'Comisariato_Comexa')
        && str_contains($mensaje, 'no rellen'))->once();
    // Y el que sí existe no genera aviso.
    Log::shouldNotHaveReceived('warning', [Mockery::on(fn ($m) => str_contains($m, 'Comisariato_Manny')), Mockery::any()]);

    expect($deComexa->fresh()->fact_servicio_id)->toBeNull()
        ->and($deManny->fresh()->fact_servicio_id)->toBe($manny->id);
});

test('el relleno deja en nulo la fila cuyo texto casa con mas de un proveedor', function () {
    $comexa = servicioComisariato('Comisariato_Comexa');
    $manny = servicioComisariato('Comisariato_Manny');

    $ambigua = comisariatoDe(['catering' => 'Manny (sustituye a Comexa)']);
    $ambiguaAlReves = comisariatoDe(['catering' => 'COMEXA / mannys']);
    $deComexa = comisariatoDe(['catering' => 'Comexa']);
    $deMannysCatering = comisariatoDe(['catering' => 'Mannys Catering']);

    (new RellenarProveedorDeComisariatos)();

    expect($ambigua->fresh()->fact_servicio_id)->toBeNull()
        ->and($ambiguaAlReves->fresh()->fact_servicio_id)->toBeNull()
        ->and($deComexa->fresh()->fact_servicio_id)->toBe($comexa->id)
        ->and($deMannysCatering->fresh()->fact_servicio_id)->toBe($manny->id);
});

test('la fila ambigua tambien se queda en nulo si uno de los dos servicios no existe', function () {
    $manny = servicioComisariato('Comisariato_Manny');

    $ambigua = comisariatoDe(['catering' => 'Manny (sustituye a Comexa)']);
    $deManny = comisariatoDe(['catering' => 'Manny']);

    (new RellenarProveedorDeComisariatos)();

    expect($ambigua->fresh()->fact_servicio_id)->toBeNull()
        ->and($deManny->fresh()->fact_servicio_id)->toBe($manny->id);
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

test('la lista dice que no hay ningun proveedor configurado, distinto de que esten de baja', function () {
    $this->actingAs(User::factory()->create());

    $respuesta = $this->getJson('/api/ServicioComisariato/proveedores');

    $respuesta->assertOk();
    expect($respuesta->json())->toBe([])
        ->and($respuesta->headers->get('X-Proveedores-Catalogo'))->toBe('sin-configurar');
});

test('la lista dice que los proveedores existen pero estan todos de baja', function () {
    servicioComisariato('Comisariato_Comexa', 'N');
    servicioComisariato('Comisariato_Manny', 'N');

    $this->actingAs(User::factory()->create());

    $respuesta = $this->getJson('/api/ServicioComisariato/proveedores');

    $respuesta->assertOk();
    expect($respuesta->json())->toBe([])
        ->and($respuesta->headers->get('X-Proveedores-Catalogo'))->toBe('todos-de-baja');
});

test('la lista con proveedores activos los declara disponibles', function () {
    servicioComisariato('Comisariato_Comexa');
    servicioComisariato('Comisariato_Manny', 'N');

    $this->actingAs(User::factory()->create());

    $respuesta = $this->getJson('/api/ServicioComisariato/proveedores');

    expect($respuesta->json())->toHaveCount(1)
        ->and($respuesta->headers->get('X-Proveedores-Catalogo'))->toBe('disponibles');
});

test('un servicio de otra categoria no cuenta como proveedor configurado', function () {
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

    expect($respuesta->headers->get('X-Proveedores-Catalogo'))->toBe('sin-configurar');
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

test('la edicion no relaja la categoria ni para el proveedor que la ficha ya tenia', function (string $status) {
    // Un servicio que estaba en Comisariatos y se movio de categoria despues de usarse en fichas.
    $servicio = servicioComisariato('Comisariato_Comexa', $status);
    $comisariato = comisariatoDe(['fact_servicio_id' => $servicio->id, 'fecha_entrega' => now()->toDateString()]);
    $servicio->update(['categoria_servicio_id' => FactCategoriaServicio::create(['nombre' => 'Tránsitos', 'status' => 'A'])->id]);

    $this->actingAs(User::factory()->create());

    $this->putJson("/api/ServicioComisariato/{$comisariato->id}", [
        'proveedorId' => $servicio->id,
        'fechaEntrega' => $comisariato->fecha_entrega->toDateString(),
        'horaEntrega' => '09:30',
        'subtotal' => 700,
        'total' => 700,
    ])->assertStatus(422)->assertJsonValidationErrors('proveedorId');

    expect($comisariato->fresh()->hora_entrega->format('H:i'))->toBe('07:00');
})->with([
    'activo' => ['A'],
    'de baja' => ['N'],
]);

test('una ficha vieja sin proveedor no puede estrenar uno dado de baja', function () {
    $baja = servicioComisariato('Comisariato_Avemex', 'N');
    $vieja = comisariatoDe(['fecha_entrega' => now()->toDateString()]);

    $this->actingAs(User::factory()->create());

    $this->putJson("/api/ServicioComisariato/{$vieja->id}", [
        'proveedorId' => $baja->id,
        'fechaEntrega' => $vieja->fecha_entrega->toDateString(),
        'horaEntrega' => '07:00',
        'subtotal' => 520,
        'total' => 520,
    ])->assertStatus(422)->assertJsonValidationErrors('proveedorId');

    expect($vieja->fresh()->fact_servicio_id)->toBeNull();
});

test('el nombre de la categoria se compara sin distinguir mayusculas, como en la lista de proveedores', function () {
    $categoria = FactCategoriaServicio::create(['nombre' => 'COMISARIATOS', 'status' => 'A']);
    $servicio = FactServicio::create([
        'categoria_servicio_id' => $categoria->id,
        'nombre' => 'Comisariato_Comexa',
        'precio_unitario' => 0,
        'es_de_tercero' => false,
        'margen' => 0,
        'ajuste_precio' => FactServicio::AJUSTE_NINGUNO,
        'status' => 'A',
    ]);

    $this->actingAs(User::factory()->create());

    $this->postJson('/api/ServicioComisariato', [
        'proveedorId' => $servicio->id,
        'fechaEntrega' => now()->toDateString(),
        'horaEntrega' => '07:00',
        'subtotal' => 520,
        'total' => 520,
    ])->assertCreated();
});

test('la tabla se filtra por proveedor', function () {
    $comexa = servicioComisariato('Comisariato_Comexa');
    $manny = servicioComisariato('Comisariato_Manny');
    comisariatoDe(['fact_servicio_id' => $comexa->id, 'matricula' => 'XA-UNO']);
    comisariatoDe(['fact_servicio_id' => $manny->id, 'matricula' => 'XA-DOS']);

    $this->actingAs(User::factory()->create());

    $datos = $this->getJson("/api/ServicioComisariato?proveedorId={$comexa->id}")->assertOk()->json('data');

    expect($datos)->toHaveCount(1)->and($datos[0]['matricula'])->toBe('XA-UNO');
});

test('la tabla encuentra las que se quedaron sin proveedor', function () {
    $comexa = servicioComisariato('Comisariato_Comexa');
    comisariatoDe(['fact_servicio_id' => $comexa->id, 'matricula' => 'XA-UNO']);
    comisariatoDe(['matricula' => 'XA-VIEJA', 'catering' => 'fd']);

    $this->actingAs(User::factory()->create());

    $datos = $this->getJson('/api/ServicioComisariato?proveedorId=sin')->assertOk()->json('data');

    expect($datos)->toHaveCount(1)->and($datos[0]['matricula'])->toBe('XA-VIEJA');
});

test('el buscador general sigue encontrando el texto viejo de catering', function () {
    comisariatoDe(['matricula' => 'XA-VIEJA', 'catering' => 'Mannys Catering']);

    $this->actingAs(User::factory()->create());

    $datos = $this->getJson('/api/ServicioComisariato?search=Mannys')->assertOk()->json('data');

    expect($datos)->toHaveCount(1)->and($datos[0]['matricula'])->toBe('XA-VIEJA');
});

test('la tabla trata SIN igual que sin, sin distinguir mayusculas', function () {
    $comexa = servicioComisariato('Comisariato_Comexa');
    comisariatoDe(['fact_servicio_id' => $comexa->id, 'matricula' => 'XA-UNO']);
    comisariatoDe(['matricula' => 'XA-VIEJA', 'catering' => 'fd']);

    $this->actingAs(User::factory()->create());

    $datos = $this->getJson('/api/ServicioComisariato?proveedorId=SIN')->assertOk()->json('data');

    expect($datos)->toHaveCount(1)->and($datos[0]['matricula'])->toBe('XA-VIEJA');
});

test('un proveedor que no es sin ni un numero no trae ninguna fila', function (string $valor) {
    $comexa = servicioComisariato('Comisariato_Comexa');
    comisariatoDe(['fact_servicio_id' => $comexa->id, 'matricula' => 'XA-UNO']);
    comisariatoDe(['matricula' => 'XA-VIEJA', 'catering' => 'fd']);

    $this->actingAs(User::factory()->create());

    $datos = $this->getJson('/api/ServicioComisariato?proveedorId=' . rawurlencode($valor))->assertOk()->json('data');

    expect($datos)->toHaveCount(0);
})->with([
    '1abc' => ['1abc'],
    // MySQL leeria esto como 1 si se pasara tal cual a la comparacion; esta prueba no corre en MySQL.
    'un id que no es un numero' => ['1 OR 1=1'],
]);

test('el filtro de catering ya no acota la tabla', function () {
    $comexa = servicioComisariato('Comisariato_Comexa');
    comisariatoDe(['fact_servicio_id' => $comexa->id, 'matricula' => 'XA-UNO', 'catering' => 'Comexa']);
    comisariatoDe(['matricula' => 'XA-VIEJA', 'catering' => 'fd']);

    $this->actingAs(User::factory()->create());

    $datos = $this->getJson('/api/ServicioComisariato?catering=Comexa')->assertOk()->json('data');

    expect($datos)->toHaveCount(2);
});

test('la tabla trae el nombre del proveedor para pintarlo', function () {
    $comexa = servicioComisariato('Comisariato_Comexa');
    comisariatoDe(['fact_servicio_id' => $comexa->id]);

    $this->actingAs(User::factory()->create());

    $proveedor = $this->getJson('/api/ServicioComisariato')->assertOk()->json('data.0.fact_servicio');

    // Solo id y nombre: el precio, el margen y el ajuste del servicio son asunto de facturacion.
    expect($proveedor['nombre'])->toBe('Comisariato_Comexa')
        ->and(array_keys($proveedor))->toBe(['id', 'nombre']);
});

test('el detalle trae el nombre del proveedor para el PDF', function () {
    $comexa = servicioComisariato('Comisariato_Comexa');
    $comisariato = comisariatoDe(['fact_servicio_id' => $comexa->id]);

    $this->actingAs(User::factory()->create());

    $proveedor = $this->getJson("/api/ServicioComisariato/{$comisariato->id}")->assertOk()->json('fact_servicio');

    // Solo id y nombre: el precio, el margen y el ajuste del servicio son asunto de facturacion.
    expect($proveedor['nombre'])->toBe('Comisariato_Comexa')
        ->and(array_keys($proveedor))->toBe(['id', 'nombre']);
});
