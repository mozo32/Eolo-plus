<?php

use App\Models\EntregaTurnoSeguridad;
use App\Models\Firma;
use App\Models\PernoctaDia;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/*
 * El listado pagina RELEVOS: un renglón por registro. Antes paginaba días y
 * combinaba los dos puestos en una fila; la v3 quitó el puesto, así que ya no
 * hay nada que combinar.
 */

function relevoDeListado(string $dia, string $hora = '07:30', array $extra = []): EntregaTurnoSeguridad
{
    return EntregaTurnoSeguridad::create(array_merge([
        'user_id' => User::factory()->create()->id,
        'fecha_hora' => "{$dia} {$hora}:00",
    ], $extra));
}

/**
 * Firma un relevo con el rol que se le diga.
 *
 * El rol es un parámetro y no una constante escondida: con un ayudante que
 * solo supiera firmar como FBO, el distintivo de «falta jefe de área» no
 * tendría quien lo vigilara.
 */
function firmarRelevoDeListado(EntregaTurnoSeguridad $relevo, string $rol): void
{
    $firma = Firma::create([
        'disk' => 'public',
        'path' => 'firmas/prueba/'.$rol.'-'.$relevo->id.'.png',
        'original_name' => $rol.'.png',
        'mime' => 'image/png',
        'size' => 10,
        'sha1' => sha1($rol.$relevo->id),
    ]);

    $relevo->firmas()->attach($firma->id, [
        'rol' => $rol,
        'orden' => 0,
        'status' => 'A',
    ]);
}

function listado(array $parametros = []): \Illuminate\Testing\TestResponse
{
    return test()->actingAs(User::factory()->create())
        ->getJson('/api/EntregaTurnoSeguridad?'.http_build_query($parametros));
}

test('el renglon es un relevo y trae sus seis claves', function () {
    relevoDeListado('2026-11-09', '14:30');

    $fila = listado()->assertSuccessful()->json('data.0');

    expect($fila)->toHaveKeys(['id', 'fecha', 'hora', 'nombre', 'firmas_faltantes', 'pernocta'])
        ->and($fila)->not->toHaveKey('caseta')
        ->and($fila)->not->toHaveKey('plataforma')
        ->and($fila)->not->toHaveKey('extras')
        ->and($fila['fecha'])->toBe('2026-11-09')
        ->and($fila['hora'])->toBe('14:30');
});

test('el nombre es el de quien entrego', function () {
    $usuario = User::factory()->create(['name' => 'Juan Pérez']);
    relevoDeListado('2026-11-09', '07:30', ['user_id' => $usuario->id]);

    expect(listado()->json('data.0.nombre'))->toBe('Juan Pérez');
});

test('dos relevos del mismo dia son dos renglones', function () {
    // Es lo contrario de lo que pedía la v2, y es lo pedido: sin puesto, dos
    // registros del mismo día son dos documentos y el total cuenta relevos.
    relevoDeListado('2026-11-09', '07:30');
    relevoDeListado('2026-11-09', '19:00');

    $respuesta = listado()->assertSuccessful();

    expect($respuesta->json('data'))->toHaveCount(2)
        ->and($respuesta->json('meta.total'))->toBe(2);
});

test('los relevos salen del mas reciente al mas viejo, tambien dentro del dia', function () {
    relevoDeListado('2026-11-01', '07:30');
    relevoDeListado('2026-11-04', '07:30');
    relevoDeListado('2026-11-04', '19:00');
    relevoDeListado('2026-11-02', '07:30');

    $renglones = listado()->json('data');

    expect(array_column($renglones, 'fecha'))
        ->toBe(['2026-11-04', '2026-11-04', '2026-11-02', '2026-11-01'])
        ->and(array_column($renglones, 'hora'))
        ->toBe(['19:00', '07:30', '07:30', '07:30']);
});

test('la hora viene en 24 horas', function () {
    relevoDeListado('2026-11-09', '19:45');

    expect(listado()->json('data.0.hora'))->toBe('19:45');
});

test('un relevo retirado no aparece', function () {
    relevoDeListado('2026-11-04', '07:30', ['status' => 'N']);

    expect(listado()->json('data'))->toBe([])
        ->and(listado()->json('meta.total'))->toBe(0);
});

test('sin registros el listado viene vacio y no revienta', function () {
    $respuesta = listado()->assertSuccessful();

    expect($respuesta->json('data'))->toBe([])
        ->and($respuesta->json('meta.total'))->toBe(0);
});

test('la paginacion cuenta relevos', function () {
    foreach (range(1, 11) as $dia) {
        relevoDeListado(Carbon::parse('2026-11-01')->addDays($dia - 1)->toDateString());
    }

    $respuesta = listado(['per_page' => 10])->assertSuccessful();

    expect($respuesta->json('data'))->toHaveCount(10)
        ->and($respuesta->json('meta.total'))->toBe(11)
        ->and($respuesta->json('meta.last_page'))->toBe(2);
});

test('per_page tiene techo: no se puede pedir la tabla entera de un jalon', function () {
    relevoDeListado('2026-11-04');

    expect(listado(['per_page' => 100000])->json('meta.per_page'))->toBe(100);
});

test('per_page tiene piso: el cero y los negativos dan uno', function (int $pedido) {
    relevoDeListado('2026-11-04');

    expect(listado(['per_page' => $pedido])->json('meta.per_page'))->toBe(1);
})->with([0, -5]);

test('el buscador filtra por el nombre de quien entrego', function () {
    $ana = User::factory()->create(['name' => 'Ana López']);
    $beto = User::factory()->create(['name' => 'Beto Ruiz']);

    relevoDeListado('2026-11-09', '07:30', ['user_id' => $ana->id]);
    relevoDeListado('2026-11-08', '07:30', ['user_id' => $beto->id]);

    expect(array_column(listado(['search' => 'Ana'])->json('data'), 'nombre'))->toBe(['Ana López']);
});

test('el buscador encuentra en mayúsculas, que es lo que la pantalla manda', function () {
    // `FilaFiltros.tsx` manda `e.target.value.toUpperCase()`, así que el
    // servidor NUNCA recibe lo que el usuario escribió tal cual. La prueba
    // hermana busca «Ana» con su mayúscula inicial, que es lo que nadie manda.
    $ana = User::factory()->create(['name' => 'Ana López']);
    $beto = User::factory()->create(['name' => 'Beto Ruiz']);

    relevoDeListado('2026-11-09', '07:30', ['user_id' => $ana->id]);
    relevoDeListado('2026-11-08', '07:30', ['user_id' => $beto->id]);

    expect(array_column(listado(['search' => 'ANA'])->json('data'), 'nombre'))->toBe(['Ana López']);
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
    $sanchez = User::factory()->create(['name' => 'Beto Sánchez']);
    $robles = User::factory()->create(['name' => 'Ana Robles']);

    relevoDeListado('2026-11-04', '07:30', ['user_id' => $sanchez->id]);
    relevoDeListado('2026-11-03', '07:30', ['user_id' => $robles->id]);

    expect(array_column(listado(['search' => 'SÁNCHEZ'])->json('data'), 'fecha'))
        ->toBe(['2026-11-04']);
})->skip('El LIKE de sqlite no pliega la Á; en MySQL utf8mb4_unicode_ci sí. Defecto latente que comparten otros tres buscadores por nombre.');

test('el rango de fechas incluye sus dos bordes', function () {
    // Las horas de los bordes no son 07:30 a propósito. Comparar un datetime
    // contra `'2026-11-04'` como cadena excluye el día entero, y con todos
    // los registros a media mañana y ninguno en el borde ese fallo no se
    // vería: la prueba pasaría con `where` en vez de `whereDate`.
    relevoDeListado('2026-11-01', '00:00');
    relevoDeListado('2026-11-04', '23:59');
    relevoDeListado('2026-11-08');

    $fechas = array_column(
        listado(['fecha_inicio' => '2026-11-01', 'fecha_fin' => '2026-11-04'])->json('data'),
        'fecha'
    );

    expect($fechas)->toBe(['2026-11-04', '2026-11-01']);
});

test('el renglon dice que firmas le faltan, en orden', function () {
    relevoDeListado('2026-11-09');

    expect(listado()->json('data.0.firmas_faltantes'))->toBe(['jefe_area', 'fbo']);
});

test('con solo la firma del jefe queda faltando la del fbo', function () {
    firmarRelevoDeListado(relevoDeListado('2026-11-09'), EntregaTurnoSeguridad::ROL_JEFE_AREA);

    expect(listado()->json('data.0.firmas_faltantes'))->toBe(['fbo']);
});

test('con las dos firmas de cierre la lista de faltantes queda vacia', function () {
    $relevo = relevoDeListado('2026-11-09');
    firmarRelevoDeListado($relevo, EntregaTurnoSeguridad::ROL_JEFE_AREA);
    firmarRelevoDeListado($relevo, EntregaTurnoSeguridad::ROL_FBO);

    expect(listado()->json('data.0.firmas_faltantes'))->toBe([]);
});

test('el filtro de estado juzga cada relevo por su cuenta', function () {
    // Mismo día, dos relevos: uno firmado por los dos y otro sin nada. El
    // filtro por día daba el día entero por incompleto o por completo; ahora
    // cada renglón responde por sí mismo.
    $completo = relevoDeListado('2026-11-09', '07:30');
    firmarRelevoDeListado($completo, EntregaTurnoSeguridad::ROL_JEFE_AREA);
    firmarRelevoDeListado($completo, EntregaTurnoSeguridad::ROL_FBO);

    $pelado = relevoDeListado('2026-11-09', '19:00');

    expect(array_column(listado(['estado' => 'completas'])->json('data'), 'id'))->toBe([$completo->id])
        ->and(array_column(listado(['estado' => 'falta_jefe_area'])->json('data'), 'id'))->toBe([$pelado->id])
        ->and(array_column(listado(['estado' => 'falta_fbo'])->json('data'), 'id'))->toBe([$pelado->id]);
});

test('completas pide las DOS firmas de cierre, no una', function () {
    firmarRelevoDeListado(relevoDeListado('2026-11-09'), EntregaTurnoSeguridad::ROL_JEFE_AREA);

    expect(listado(['estado' => 'completas'])->json('meta.total'))->toBe(0)
        ->and(listado(['estado' => 'falta_fbo'])->json('meta.total'))->toBe(1)
        ->and(listado(['estado' => 'falta_jefe_area'])->json('meta.total'))->toBe(0);
});

test('una firma retirada no cuenta como puesta', function () {
    // `firmas()` filtra el pivote por `A`. Sin eso, un relevo al que le
    // retiraron la firma del FBO saldría como completo.
    $relevo = relevoDeListado('2026-11-09');
    firmarRelevoDeListado($relevo, EntregaTurnoSeguridad::ROL_JEFE_AREA);
    firmarRelevoDeListado($relevo, EntregaTurnoSeguridad::ROL_FBO);

    DB::table('firmables')
        ->where('firmable_type', EntregaTurnoSeguridad::class)
        ->where('firmable_id', $relevo->id)
        ->where('rol', EntregaTurnoSeguridad::ROL_FBO)
        ->update(['status' => 'N']);

    expect(listado()->json('data.0.firmas_faltantes'))->toBe(['fbo'])
        ->and(listado(['estado' => 'completas'])->json('meta.total'))->toBe(0)
        ->and(listado(['estado' => 'falta_fbo'])->json('meta.total'))->toBe(1);
});

test('el estado solo admite sus tres valores', function () {
    listado(['estado' => 'cualquiera'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('estado');
});

test('un filtro en forma de arreglo se rechaza con 422, no con 500', function (string $campo) {
    test()->actingAs(User::factory()->create())
        ->getJson("/api/EntregaTurnoSeguridad?{$campo}[]=x")
        ->assertStatus(422);
})->with(['search', 'estado', 'fecha_inicio', 'fecha_fin']);

test('el relevo trae la pernocta del dia en vivo', function () {
    PernoctaDia::create(['fecha' => '2026-11-09', 'matricula' => 'XA-UNO']);
    PernoctaDia::create(['fecha' => '2026-11-09', 'matricula' => 'XA-DOS']);
    PernoctaDia::create(['fecha' => '2026-11-08', 'matricula' => 'XA-TRE']);

    relevoDeListado('2026-11-09');

    expect(listado()->json('data.0.pernocta'))->toBe(2);
});

test('el relevo congelado trae la pernocta que se guardo, no la de hoy', function () {
    $relevo = relevoDeListado('2026-11-09');
    $relevo->update(['resumen' => [
        ['clave' => 'pernocta', 'titulo' => 'Pernocta del día', 'texto' => '9 aeronaves', 'total' => 9],
    ]]);

    PernoctaDia::create(['fecha' => '2026-11-09', 'matricula' => 'XA-UNO']);

    expect(listado()->json('data.0.pernocta'))->toBe(9);
});

test('la pernocta de la pagina se pide en una sola consulta', function () {
    // Veinte relevos en diez días. Si el controlador llamara al servicio del
    // resumen por renglón serían nueve consultas por relevo, y nadie lo vería
    // hasta que la tabla creciera.
    for ($dia = 1; $dia <= 10; $dia++) {
        $fecha = sprintf('2026-11-%02d', $dia);
        relevoDeListado($fecha, '07:30');
        relevoDeListado($fecha, '19:00');
    }

    $usuario = User::factory()->create();

    DB::enableQueryLog();

    test()->actingAs($usuario)
        ->getJson('/api/EntregaTurnoSeguridad?per_page=10')
        ->assertSuccessful();

    $log = DB::getQueryLog();
    DB::disableQueryLog();

    $deLaPernocta = array_filter($log, fn (array $q) => str_contains($q['query'], 'pernocta_dia'));

    expect($deLaPernocta)->toHaveCount(1)
        ->and(count($log))->toBeLessThan(10);
});

test('una pagina vacia no consulta la pernocta', function () {
    $usuario = User::factory()->create();

    DB::enableQueryLog();

    test()->actingAs($usuario)
        ->getJson('/api/EntregaTurnoSeguridad')
        ->assertSuccessful()
        ->assertJsonPath('data', []);

    $log = DB::getQueryLog();
    DB::disableQueryLog();

    expect(array_filter($log, fn (array $q) => str_contains($q['query'], 'pernocta_dia')))->toBeEmpty();
});

test('un seccion en el query string ya no filtra nada ni revienta', function () {
    // La regla se fue con la columna. Un cliente viejo que siga mandando
    // `?seccion=caseta` debe recibir la lista completa, no un 422 ni media.
    relevoDeListado('2026-11-09');
    relevoDeListado('2026-11-08');

    expect(listado(['seccion' => 'caseta'])->json('meta.total'))->toBe(2)
        ->and(listado(['seccion' => 'frente'])->json('meta.total'))->toBe(2);
});
