<?php

use App\Models\EntregaTurnoSeguridad;
use App\Models\Firma;
use App\Models\User;
use Illuminate\Support\Carbon;

/*
 * El listado combina las dos secciones de un día en UN renglón, y pagina
 * días y no registros: si paginara registros, una página podría partir un
 * día y dejar el frente en una hoja y el de atrás en la siguiente.
 */

function relevoDelDia(string $dia, string $seccion, string $hora = '07:30', array $extra = []): EntregaTurnoSeguridad
{
    return EntregaTurnoSeguridad::create(array_merge([
        'user_id' => User::factory()->create()->id,
        'fecha_hora' => "{$dia} {$hora}:00",
        'seccion' => $seccion,
    ], $extra));
}

function firmarComoFbo(EntregaTurnoSeguridad $relevo): void
{
    $firma = Firma::create([
        'disk' => 'public',
        'path' => 'firmas/prueba/fbo-'.$relevo->id.'.png',
        'original_name' => 'fbo.png',
        'mime' => 'image/png',
        'size' => 10,
        'sha1' => sha1('fbo'.$relevo->id),
    ]);

    $relevo->firmas()->attach($firma->id, [
        'rol' => EntregaTurnoSeguridad::ROL_FBO,
        'orden' => 0,
        'status' => 'A',
    ]);
}

function listado(array $parametros = []): \Illuminate\Testing\TestResponse
{
    return test()->actingAs(User::factory()->create())
        ->getJson('/api/EntregaTurnoSeguridad?'.http_build_query($parametros));
}

test('las dos secciones del mismo día salen en un solo renglón', function () {
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE, '07:30');
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_ATRAS, '19:00');

    $datos = listado()->assertSuccessful()->json('data');

    expect($datos)->toHaveCount(1)
        ->and($datos[0]['fecha'])->toBe('2026-11-04')
        ->and($datos[0]['frente']['hora'])->toBe('07:30')
        ->and($datos[0]['atras']['hora'])->toBe('19:00');
});

test('la hora viene en 24 horas', function () {
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_ATRAS, '19:45');

    $fila = listado()->json('data.0');

    expect($fila['atras']['hora'])->toBe('19:45');
});

test('un día con una sola sección deja la otra en null', function () {
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE);

    $fila = listado()->json('data.0');

    expect($fila['frente'])->not->toBeNull()
        ->and($fila['atras'])->toBeNull();
});

test('tres registros de la misma sección dan un renglón con dos extras', function () {
    // El de las 23:00 se crea PRIMERO a propósito. Creándolos en orden de
    // hora, el id mayor coincide con la hora mayor y la prueba no
    // distinguiría `sortByDesc('fecha_hora')` de «el último que se creó».
    $ultimo = relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE, '23:00');
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE, '07:00');
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE, '15:00');

    $datos = listado()->json('data');

    expect($datos)->toHaveCount(1)
        ->and($datos[0]['frente']['extras'])->toBe(2)
        ->and($datos[0]['frente']['id'])->toBe($ultimo->id)
        ->and($datos[0]['frente']['hora'])->toBe('23:00');
});

test('la paginación cuenta días y no parte ninguno', function () {
    // Once días con sus dos secciones: 22 registros. Si paginara registros,
    // diez por página cortarían el quinto día a la mitad.
    foreach (range(1, 11) as $dia) {
        $fecha = Carbon::parse('2026-11-01')->addDays($dia - 1)->toDateString();
        relevoDelDia($fecha, EntregaTurnoSeguridad::SECCION_FRENTE, '07:00');
        relevoDelDia($fecha, EntregaTurnoSeguridad::SECCION_ATRAS, '19:00');
    }

    $respuesta = listado(['per_page' => 10])->assertSuccessful();

    expect($respuesta->json('data'))->toHaveCount(10)
        ->and($respuesta->json('meta.total'))->toBe(11)
        ->and($respuesta->json('meta.last_page'))->toBe(2);

    foreach ($respuesta->json('data') as $fila) {
        expect($fila['frente'])->not->toBeNull()
            ->and($fila['atras'])->not->toBeNull();
    }
});

test('los días salen del más reciente al más viejo', function () {
    relevoDelDia('2026-11-01', EntregaTurnoSeguridad::SECCION_FRENTE);
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE);
    relevoDelDia('2026-11-02', EntregaTurnoSeguridad::SECCION_FRENTE);

    expect(array_column(listado()->json('data'), 'fecha'))
        ->toBe(['2026-11-04', '2026-11-02', '2026-11-01']);
});

test('un relevo retirado no aparece en el listado', function () {
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE, '07:30', ['status' => 'N']);

    expect(listado()->json('data'))->toBe([]);
});

test('firmado_fbo dice si el FBO ya firmó esa sección', function () {
    $frente = relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE);
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_ATRAS, '19:00');

    firmarComoFbo($frente);

    $fila = listado()->json('data.0');

    expect($fila['frente']['firmado_fbo'])->toBeTrue()
        ->and($fila['atras']['firmado_fbo'])->toBeFalse();
});

test('la pernocta mensual de cada sección viaja por separado', function () {
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE, '07:30', [
        'pernocta_mensual' => EntregaTurnoSeguridad::PERNOCTA_HECHA,
    ]);
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_ATRAS, '19:00', [
        'pernocta_mensual' => EntregaTurnoSeguridad::PERNOCTA_SIN_REVISAR,
    ]);

    $fila = listado()->json('data.0');

    expect($fila['frente']['pernocta_mensual'])->toBe('S')
        ->and($fila['atras']['pernocta_mensual'])->toBe('R');
});

test('el buscador filtra por el nombre de quien entregó', function () {
    $ana = User::factory()->create(['name' => 'Ana Robles']);
    EntregaTurnoSeguridad::create([
        'user_id' => $ana->id,
        'fecha_hora' => '2026-11-04 07:30:00',
        'seccion' => EntregaTurnoSeguridad::SECCION_FRENTE,
    ]);

    // El nombre del otro va explícito: con el que invente la factory hay
    // una posibilidad remota de que contenga «Robles» y la prueba falle
    // sin que nada esté roto.
    $otro = User::factory()->create(['name' => 'Beto Sánchez']);
    EntregaTurnoSeguridad::create([
        'user_id' => $otro->id,
        'fecha_hora' => '2026-11-03 07:30:00',
        'seccion' => EntregaTurnoSeguridad::SECCION_FRENTE,
    ]);

    expect(array_column(listado(['search' => 'Robles'])->json('data'), 'fecha'))
        ->toBe(['2026-11-04']);
});

/**
 * Un relevo del día 4 a nombre de `$nombre` y otro del 3 a nombre de
 * `$otroNombre`.
 *
 * Los dos nombres van explícitos: con el que invente la factory hay una
 * posibilidad remota de que contenga lo que se busca y la prueba falle sin
 * que nada esté roto.
 */
function dosRelevosConNombres(string $nombre, string $otroNombre): void
{
    foreach ([['2026-11-04', $nombre], ['2026-11-03', $otroNombre]] as [$dia, $quien]) {
        EntregaTurnoSeguridad::create([
            'user_id' => User::factory()->create(['name' => $quien])->id,
            'fecha_hora' => "{$dia} 07:30:00",
            'seccion' => EntregaTurnoSeguridad::SECCION_FRENTE,
        ]);
    }
}

test('el buscador encuentra en mayúsculas, que es lo que la pantalla manda', function () {
    // `FilaFiltros.tsx:39` manda `e.target.value.toUpperCase()`, así que el
    // servidor NUNCA recibe lo que el usuario escribió tal cual. La prueba
    // hermana busca «Robles» con su mayúscula inicial, que es lo que nadie
    // manda.
    dosRelevosConNombres('Ana Robles', 'Beto Lopez');

    expect(array_column(listado(['search' => 'ROBLES'])->json('data'), 'fecha'))
        ->toBe(['2026-11-04']);
});

test('el buscador encuentra un nombre acentuado en mayúsculas', function () {
    // HALLAZGO, no un detalle de la prueba: en sqlite esto NO encuentra nada.
    // El `LIKE` de sqlite solo pliega mayúsculas del ASCII, así que la `Á`
    // que manda la pantalla no empareja con la `á` guardada y el nombre
    // entero deja de encontrarse. En producción sí funciona —la collation
    // configurada es `utf8mb4_unicode_ci`, que pliega caso Y acentos
    // (config/database.php:56)—, por eso está `skip` y no borrada: el defecto
    // es latente y depende de la collation, no del código.
    //
    // El `.toUpperCase()` es convención del proyecto: los filtros por nombre
    // de `despacho/EntregaTurno.tsx` y de `Rampa/.../TablaJefeArea.tsx` hacen
    // lo mismo y comparten la misma dependencia. Quitarlo solo aquí dejaría
    // este buscador distinto de los otros tres.
    dosRelevosConNombres('Beto Sánchez', 'Ana Robles');

    expect(array_column(listado(['search' => 'SÁNCHEZ'])->json('data'), 'fecha'))
        ->toBe(['2026-11-04']);
})->skip('El LIKE de sqlite no pliega la Á; en MySQL utf8mb4_unicode_ci sí. Defecto latente que comparten otros tres buscadores por nombre.');

test('un filtro en forma de arreglo se rechaza con 422, no con 500', function (string $campo) {
    // Sin el Form Request, `$request->string($campo)` recibía un arreglo y
    // lanzaba TypeError: un 500 al alcance de cualquiera con sesión.
    test()->actingAs(User::factory()->create())
        ->getJson("/api/EntregaTurnoSeguridad?{$campo}[]=x")
        ->assertStatus(422);
})->with(['search', 'seccion', 'estado', 'fecha_inicio', 'fecha_fin']);

test('el filtro de sección deja solo los días con esa sección', function () {
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE);
    relevoDelDia('2026-11-03', EntregaTurnoSeguridad::SECCION_ATRAS, '19:00');

    expect(array_column(listado(['seccion' => 'atras'])->json('data'), 'fecha'))
        ->toBe(['2026-11-03']);
});

test('el rango de fechas acota los días', function () {
    relevoDelDia('2026-11-01', EntregaTurnoSeguridad::SECCION_FRENTE);
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE);
    relevoDelDia('2026-11-08', EntregaTurnoSeguridad::SECCION_FRENTE);

    $fechas = array_column(
        listado(['fecha_inicio' => '2026-11-02', 'fecha_fin' => '2026-11-05'])->json('data'),
        'fecha'
    );

    expect($fechas)->toBe(['2026-11-04']);
});

test('falta_fbo excluye los días ya firmados y el renglón sigue completo', function () {
    // Esta prueba NO distingue un filtro por día de uno por registro: para
    // «falta_fbo» los dos dan el mismo conjunto de días, así que no hay
    // nada que distinguir. La que vigila esa diferencia es la de
    // «completas». Lo que se comprueba aquí es otra cosa, y sí importa: que
    // el filtro decida qué DÍAS salen y no qué secciones se ven, y que un
    // día enteramente firmado no aparezca.
    $frente = relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE);
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_ATRAS, '19:00');
    firmarComoFbo($frente);

    firmarComoFbo(relevoDelDia('2026-11-03', EntregaTurnoSeguridad::SECCION_FRENTE));

    $datos = listado(['estado' => 'falta_fbo'])->json('data');

    expect(array_column($datos, 'fecha'))->toBe(['2026-11-04'])
        ->and($datos[0]['frente'])->not->toBeNull()
        ->and($datos[0]['atras'])->not->toBeNull();
});

test('completas excluye el día en que una sección no está firmada', function () {
    // El día 4 tiene el frente firmado y atrás sin firmar: NO está
    // completo. Filtrar registro por registro lo daría por completo a
    // través del frente, que es el error que esta prueba vigila.
    $frente4 = relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE);
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_ATRAS, '19:00');
    firmarComoFbo($frente4);

    $frente3 = relevoDelDia('2026-11-03', EntregaTurnoSeguridad::SECCION_FRENTE);
    firmarComoFbo($frente3);

    expect(array_column(listado(['estado' => 'completas'])->json('data'), 'fecha'))
        ->toBe(['2026-11-03']);
});

test('sin registros el listado viene vacío y no revienta', function () {
    $respuesta = listado()->assertSuccessful();

    expect($respuesta->json('data'))->toBe([])
        ->and($respuesta->json('meta.total'))->toBe(0);
});

test('per_page tiene techo: no se puede pedir la tabla entera de un jalón', function () {
    // Sin techo, un per_page=100000 pide cien mil días y arrastra toda la
    // tabla con sus firmas.
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE);

    expect(listado(['per_page' => 100000])->json('meta.per_page'))->toBe(100);
});

test('un retirado no cuenta como el más reciente ni infla los extras', function () {
    // Esta prueba existe porque la de arriba NO vigila el `activas()` del
    // listado: con un solo registro retirado, el día no entra en la página
    // y la prueba pasaría igual aunque se cayera el filtro.
    //
    // Aquí el día lleva un activo y un retirado MÁS RECIENTE. Sin el filtro,
    // el retirado saldría como «el más reciente», `extras` valdría 1 y el día
    // se marcaría como incompleto por una firma que nadie debe esperar.
    $activo = relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE, '07:30');
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE, '23:00', ['status' => 'N']);

    $fila = listado()->json('data.0');

    expect($fila['frente']['id'])->toBe($activo->id)
        ->and($fila['frente']['hora'])->toBe('07:30')
        ->and($fila['frente']['extras'])->toBe(0);
});

test('el rango de fechas incluye sus dos bordes', function () {
    // Las horas de los bordes no son 07:30 a propósito. Comparar un datetime
    // contra `'2026-11-05'` como cadena excluye el día entero, y con todos
    // los registros a media mañana y ninguno en el borde ese fallo no se
    // vería: la prueba pasaría con `where` en vez de `whereDate`.
    relevoDelDia('2026-11-02', EntregaTurnoSeguridad::SECCION_FRENTE, '00:00');
    relevoDelDia('2026-11-05', EntregaTurnoSeguridad::SECCION_ATRAS, '23:59');
    relevoDelDia('2026-11-06', EntregaTurnoSeguridad::SECCION_FRENTE, '07:30');

    $fechas = array_column(
        listado(['fecha_inicio' => '2026-11-02', 'fecha_fin' => '2026-11-05'])->json('data'),
        'fecha'
    );

    expect($fechas)->toBe(['2026-11-05', '2026-11-02']);
});

test('per_page tiene piso: el cero y los negativos dan uno', function (int $pedido) {
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE);
    relevoDelDia('2026-11-03', EntregaTurnoSeguridad::SECCION_FRENTE);

    expect(listado(['per_page' => $pedido])->json('meta.per_page'))->toBe(1);
})->with([0, -5]);
