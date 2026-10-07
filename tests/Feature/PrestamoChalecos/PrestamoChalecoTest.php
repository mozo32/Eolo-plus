<?php

use App\Models\Bitacora;
use App\Models\Departamento;
use App\Models\Imagen;
use App\Models\PrestamoChaleco;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/*
 * Préstamo de chalecos: la foto de la INE vive en disco privado y solo se ve
 * con sesión; quien entrega debe ser del área de Tráfico; la devolución es
 * atómica.
 */

function usuarioTrafico(string $nombre = 'ENTREGA TRAFICO', string $statusVinculo = 'A'): User
{
    $usuario = User::factory()->create(['name' => $nombre]);
    $depto = Departamento::firstOrCreate(['nombre' => 'Trafico']);
    $usuario->departamentos()->attach($depto->id, ['status' => $statusVinculo]);

    return $usuario;
}

function usuarioChalecos(): User
{
    return usuarioConSubdepartamento('prestamoChalecos', 'Trafico');
}

function prestamoChaleco(array $extra = []): PrestamoChaleco
{
    return PrestamoChaleco::create(array_merge([
        'fecha' => '2026-09-22',
        'nombre_recibe' => 'VISITANTE UNO',
        'usuario_entrega_id' => usuarioTrafico('ENTREGA '.uniqid())->id,
        'estado' => PrestamoChaleco::ESTADO_PRESTADO,
        'user_id' => User::factory()->create()->id,
    ], $extra));
}

function datosPrestamo(User $entrega, array $extra = []): array
{
    return array_merge([
        'fecha' => now()->toDateString(),
        'nombre_recibe' => '  Visitante de prueba  ',
        'usuario_entrega_id' => $entrega->id,
        'foto_ine' => UploadedFile::fake()->image('ine.jpg'),
    ], $extra);
}

// ---------------------------------------------------------------------------
// Permisos
// ---------------------------------------------------------------------------

test('un invitado no puede consultar ni registrar', function () {
    $this->getJson('/api/PrestamoChalecos')->assertUnauthorized();
    $this->postJson('/api/PrestamoChalecos', [])->assertUnauthorized();
    $this->getJson('/api/PrestamoChalecos/personal')->assertUnauthorized();

    // La foto tampoco se entrega sin sesión (redirige al login).
    $prestamo = prestamoChaleco();
    $this->get("/api/PrestamoChalecos/{$prestamo->id}/ine")->assertRedirect();
});

test('sin el subdepartamento se puede consultar pero no registrar ni devolver', function () {
    Storage::fake('local');
    $prestamo = prestamoChaleco();

    $this->actingAs(usuarioSinAcceso());

    $this->getJson('/api/PrestamoChalecos')->assertOk();
    $this->post('/api/PrestamoChalecos', datosPrestamo(usuarioTrafico()), ['Accept' => 'application/json'])->assertForbidden();
    $this->patchJson("/api/PrestamoChalecos/{$prestamo->id}/devolver")->assertForbidden();

    expect($prestamo->fresh()->estado)->toBe('prestado');
});

// ---------------------------------------------------------------------------
// Registrar préstamo
// ---------------------------------------------------------------------------

test('registrar guarda la fila, la foto en disco privado y la bitácora', function () {
    Storage::fake('local');
    $entrega = usuarioTrafico();
    $capturista = usuarioChalecos();

    $this->actingAs($capturista);

    $this->post('/api/PrestamoChalecos', datosPrestamo($entrega), ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('message', 'Préstamo registrado correctamente.')
        ->assertJsonPath('prestamo.nombre_recibe', 'Visitante de prueba')
        ->assertJsonPath('prestamo.estado', 'prestado')
        ->assertJsonPath('prestamo.fecha_devolucion', null);

    $prestamo = PrestamoChaleco::first();
    $imagen = Imagen::first();

    expect($prestamo->usuario_entrega_id)->toBe($entrega->id)
        ->and($prestamo->user_id)->toBe($capturista->id)
        ->and($prestamo->foto_ine_imagen_id)->toBe($imagen->id)
        ->and($imagen->disk)->toBe('local')
        ->and($imagen->path)->toStartWith('prestamos-chalecos/');

    Storage::disk('local')->assertExists($imagen->path);

    expect(Bitacora::query()
        ->where('modulo', Bitacora::MODULO_PRESTAMO_CHALECOS)
        ->where('accion', Bitacora::ACCION_CREAR)
        ->where('registro_id', $prestamo->id)
        ->exists())->toBeTrue();
});

test('la foto es obligatoria y solo se aceptan imágenes permitidas', function () {
    Storage::fake('local');
    $entrega = usuarioTrafico();
    $this->actingAs(usuarioChalecos());

    $sinFoto = datosPrestamo($entrega);
    unset($sinFoto['foto_ine']);

    $this->post('/api/PrestamoChalecos', $sinFoto, ['Accept' => 'application/json'])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['foto_ine']);

    $this->post('/api/PrestamoChalecos', datosPrestamo($entrega, ['foto_ine' => UploadedFile::fake()->create('doc.pdf', 20, 'application/pdf')]), ['Accept' => 'application/json'])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['foto_ine']);

    expect(PrestamoChaleco::count())->toBe(0)
        ->and(Imagen::count())->toBe(0);
});

test('quien entrega debe pertenecer al área de Tráfico', function () {
    Storage::fake('local');
    $this->actingAs(usuarioChalecos());

    $deRampa = User::factory()->create(['name' => 'DE RAMPA']);
    $deRampa->departamentos()->attach(Departamento::firstOrCreate(['nombre' => 'Rampa'])->id, ['status' => 'A']);
    $inactivo = usuarioTrafico('TRAFICO INACTIVO', 'N');

    foreach ([$deRampa, $inactivo] as $rechazado) {
        $this->post('/api/PrestamoChalecos', datosPrestamo($rechazado), ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonPath('errors.usuario_entrega_id.0', 'La persona seleccionada no pertenece al área de Tráfico.');
    }

    expect(PrestamoChaleco::count())->toBe(0);
});

// ---------------------------------------------------------------------------
// Devolución
// ---------------------------------------------------------------------------

test('devolver marca el chaleco, guarda la hora y quién lo recibió', function () {
    $prestamo = prestamoChaleco();
    $usuario = usuarioChalecos();

    $this->actingAs($usuario);

    $this->patchJson("/api/PrestamoChalecos/{$prestamo->id}/devolver")
        ->assertOk()
        ->assertJsonPath('message', 'El chaleco fue marcado como devuelto.')
        ->assertJsonPath('prestamo.estado', 'devuelto');

    $guardado = $prestamo->fresh();

    expect($guardado->estado)->toBe('devuelto')
        ->and($guardado->fecha_devolucion)->not->toBeNull()
        ->and($guardado->devuelto_por_user_id)->toBe($usuario->id);

    expect(Bitacora::query()
        ->where('modulo', Bitacora::MODULO_PRESTAMO_CHALECOS)
        ->where('accion', Bitacora::ACCION_FINALIZAR)
        ->exists())->toBeTrue();
});

test('no se puede devolver dos veces: la segunda responde 409', function () {
    $prestamo = prestamoChaleco();
    $this->actingAs(usuarioChalecos());

    $this->patchJson("/api/PrestamoChalecos/{$prestamo->id}/devolver")->assertOk();

    $this->patchJson("/api/PrestamoChalecos/{$prestamo->id}/devolver")
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_devuelto')
        ->assertJsonPath('message', 'Este chaleco ya fue marcado como devuelto.');

    $this->patchJson('/api/PrestamoChalecos/999999/devolver')->assertNotFound();
});

// ---------------------------------------------------------------------------
// Foto protegida
// ---------------------------------------------------------------------------

test('la foto de la INE solo se entrega con sesión y no es pública', function () {
    Storage::fake('local');
    $this->actingAs(usuarioChalecos());

    $this->post('/api/PrestamoChalecos', datosPrestamo(usuarioTrafico()), ['Accept' => 'application/json'])->assertCreated();

    $prestamo = PrestamoChaleco::first();

    $this->get("/api/PrestamoChalecos/{$prestamo->id}/ine")->assertOk();

    // Sin foto → 404; el archivo nunca vive en el disco público.
    $sinFoto = prestamoChaleco(['nombre_recibe' => 'SIN FOTO']);
    $this->get("/api/PrestamoChalecos/{$sinFoto->id}/ine")->assertNotFound();

    expect(Imagen::first()->disk)->toBe('local');
});

// ---------------------------------------------------------------------------
// Histórico y personal
// ---------------------------------------------------------------------------

test('el histórico ordena prestados primero y filtra por rango de fechas y estado', function () {
    $viejo = prestamoChaleco(['fecha' => '2026-09-01', 'nombre_recibe' => 'VIEJO', 'estado' => 'devuelto']);
    $reciente = prestamoChaleco(['fecha' => '2026-09-20', 'nombre_recibe' => 'RECIENTE', 'estado' => 'devuelto']);
    $abierto = prestamoChaleco(['fecha' => '2026-09-10', 'nombre_recibe' => 'ABIERTO']);

    $this->actingAs(usuarioSinAcceso());

    $nombres = fn (string $q = '') => collect($this->getJson("/api/PrestamoChalecos?{$q}")->assertOk()->json('data'))->pluck('nombre_recibe')->all();

    expect($nombres())->toBe(['ABIERTO', 'RECIENTE', 'VIEJO'])
        ->and($nombres('fecha_inicio=2026-09-05&fecha_fin=2026-09-15'))->toBe(['ABIERTO'])
        ->and($nombres('estado=devuelto'))->toBe(['RECIENTE', 'VIEJO'])
        ->and($nombres('nombre=recie'))->toBe(['RECIENTE']);

    expect($viejo->id)->toBeInt()->and($reciente->id)->toBeInt()->and($abierto->id)->toBeInt();
});

test('el histórico pagina y acota per_page', function () {
    foreach (range(1, 12) as $i) {
        prestamoChaleco(['nombre_recibe' => "VISITANTE {$i}"]);
    }

    $this->actingAs(usuarioSinAcceso());

    $this->getJson('/api/PrestamoChalecos?per_page=10&page=2')
        ->assertOk()
        ->assertJsonPath('per_page', 10)
        ->assertJsonPath('total', 12)
        ->assertJsonCount(2, 'data');

    $this->getJson('/api/PrestamoChalecos?per_page=7')->assertOk()->assertJsonPath('per_page', 10);
});

test('personal devuelve solo usuarios de Tráfico con vínculo activo', function () {
    $this->actingAs(usuarioSinAcceso());

    usuarioTrafico('ZULEMA');
    usuarioTrafico('ANA');
    usuarioTrafico('INACTIVO', 'N');
    User::factory()->create(['name' => 'SIN AREA']);

    $lista = $this->getJson('/api/PrestamoChalecos/personal')->assertOk()->json();

    expect(collect($lista)->pluck('name')->all())->toBe(['ANA', 'ZULEMA'])
        ->and(array_keys($lista[0]))->toBe(['id', 'name']);
});
