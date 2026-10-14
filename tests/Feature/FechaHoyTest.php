<?php

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Inertia\Testing\AssertableInertia as Assert;

/*
|--------------------------------------------------------------------------
| «Hoy» en la zona de Mexico
|--------------------------------------------------------------------------
|
| Defecto de origen: en varios formularios la fecha se ponia sola y, pasadas las 18:00 de
| Mexico (es decir, desde las 00:00 UTC), se colocaba el dia siguiente, porque el calculo usaba
| UTC o la zona del equipo. La fuente de «hoy» es ahora UNA: el servidor la publica en la prop
| `hoy` y `resources/js/lib/fechaHoy.ts` la lee. Este archivo prueba las dos mitades que se
| pueden probar sin corredor de pruebas JS: el servidor publica el dia de MEXICO, y el codigo
| fuente no vuelve a calcular «hoy» por su cuenta.
*/

/** El dia que publica el servidor en la prop `hoy`, con el reloj fijado en `$instante`. */
function hoyPublicado(Illuminate\Foundation\Testing\TestCase $prueba, string $instante, string $zona): string
{
    Carbon::setTestNow(Carbon::parse($instante, $zona));

    $hoy = null;

    $prueba->get('/dashboard')->assertInertia(function (Assert $page) use (&$hoy) {
        $hoy = $page->toArray()['props']['hoy'] ?? null;
    });

    return (string) $hoy;
}

test('la zona del proyecto es la de Mexico: de ahi sale el dia que se publica', function () {
    expect(config('app.timezone'))->toBe('America/Mexico_City');
});

test('con las 19:00 en Mexico, y ya manana en UTC, `hoy` es el dia de MEXICO', function () {
    // Es literalmente la queja: a las 19:00 de Mexico el reloj UTC ya marca el dia 9, y el
    // formulario ofrecia esa fecha.
    $this->actingAs(User::factory()->create());

    $utc = Carbon::parse('2026-10-08 19:00:00', 'America/Mexico_City')->utc();
    expect($utc->toDateString())->toBe('2026-10-09');

    expect(hoyPublicado($this, '2026-10-08 19:00:00', 'America/Mexico_City'))->toBe('2026-10-08');
});

test('`hoy` es el dia de Mexico a cualquier hora, incluidos los bordes de UTC y de la medianoche', function (string $instante, string $esperado) {
    $this->actingAs(User::factory()->create());

    expect(hoyPublicado($this, $instante, 'America/Mexico_City'))->toBe($esperado);
})->with([
    'mediodia' => ['2026-10-08 12:00:00', '2026-10-08'],
    'un minuto antes de que UTC cambie de dia' => ['2026-10-08 17:59:00', '2026-10-08'],
    'justo cuando UTC cambia de dia' => ['2026-10-08 18:00:00', '2026-10-08'],
    'las 19:00 de la queja' => ['2026-10-08 19:00:00', '2026-10-08'],
    'ultimo minuto del dia' => ['2026-10-08 23:59:00', '2026-10-08'],
    'la medianoche, ya es otro dia' => ['2026-10-09 00:00:00', '2026-10-09'],
]);

test('el instante se da en UTC y el dia sigue siendo el de Mexico', function () {
    // El mismo instante escrito en UTC: 01:00 del dia 9 UTC son las 19:00 del dia 8 en Mexico.
    $this->actingAs(User::factory()->create());

    expect(hoyPublicado($this, '2026-10-09 01:00:00', 'UTC'))->toBe('2026-10-08');
});

test('`hoy` se publica tambien a quien no ha iniciado sesion', function () {
    // Las pantallas publicas (login, pantalla de televisión) tambien comparten props.
    Carbon::setTestNow(Carbon::parse('2026-10-08 19:00:00', 'America/Mexico_City'));

    $this->get('/login')->assertInertia(
        fn (Assert $page) => $page->where('hoy', '2026-10-08'),
    );
});

test('`hoy` es el techo de las ventanas: el formulario no ofrece un dia que el servidor rechaza', function () {
    // El motivo de tomarlo del servidor: si el navegador y el servidor discreparan, el formulario
    // ofreceria una fecha que `DentroDeLaVentana` rechaza con 422.
    $this->actingAs(User::factory()->create());
    Carbon::setTestNow(Carbon::parse('2026-10-08 19:00:00', 'America/Mexico_City'));

    $this->get('/dashboard')->assertInertia(function (Assert $page) {
        $props = $page->toArray()['props'];

        expect($props['hoy'])->toBe('2026-10-08')
            ->and($props['ventanasDeFecha']['operaciones.llegada']['max'])->toBe($props['hoy'])
            ->and($props['ventanasDeFecha']['turno.checklist']['max'])->toBe($props['hoy']);
    });
});

/*
|--------------------------------------------------------------------------
| El escaner del codigo fuente
|--------------------------------------------------------------------------
*/

/**
 * Los usos peligrosos de «hoy» en un trozo de codigo: [numero de linea, texto de la linea].
 *
 * Solo cuenta lo que calcula HOY, es decir, lo que parte de un `new Date()` SIN argumentos:
 *   - `new Date().toISOString()` recortado a diez caracteres: es UTC;
 *   - `new Date().toLocaleDateString('en-CA' | 'sv-SE')`: es la zona del equipo;
 *   - `getTimezoneOffset()`: la zona del equipo por la via larga.
 *
 * NO cuenta `new Date(fechaGuardada)...`: una fecha ya guardada llega del API como medianoche
 * UTC y formatearla en zona local la retrasaria un dia (el defecto simetrico). Tampoco cuenta
 * `new Date().toISOString()` a secas: un instante completo esta bien en UTC.
 *
 * Es un escaner de TEXTO y no entiende el flujo: `const ahora = new Date(); ahora.toLocale...`
 * se le escapa. Cubre el idioma que de hecho se uso en el codigo, y lo demas se vigila en la
 * revision.
 *
 * @return list<array{0: int, 1: string}>
 */
function hallazgosDeFechaPeligrosa(string $codigo): array
{
    $patrones = [
        '/new\s+Date\(\s*\)\s*\.\s*toISOString\(\s*\)\s*\.\s*(?:slice|substring|substr)\(\s*0\s*,\s*10\s*\)/',
        '/new\s+Date\(\s*\)\s*\.\s*toISOString\(\s*\)\s*\.\s*split\(\s*[\'"]T[\'"]\s*\)\s*\[\s*0\s*\]/',
        '/new\s+Date\(\s*\)\s*\.\s*toLocaleDateString\(\s*[\'"](?:en-CA|sv-SE)[\'"]/',
        '/\bgetTimezoneOffset\b/',
    ];

    $lineas = [];

    foreach ($patrones as $patron) {
        if (preg_match_all($patron, $codigo, $coincidencias, PREG_OFFSET_CAPTURE)) {
            foreach ($coincidencias[0] as [, $posicion]) {
                $lineas[substr_count(substr($codigo, 0, $posicion), "\n") + 1] = true;
            }
        }
    }

    ksort($lineas);
    $filas = explode("\n", $codigo);

    return array_map(fn (int $n) => [$n, trim($filas[$n - 1])], array_keys($lineas));
}

/**
 * Lo que queda FUERA, a proposito, con la linea exacta (recortada) que se admite.
 *
 * Son los nombres de fichero de las descargas Excel (`Reporte_ASA_${...}.xlsx`): es cosmetico y
 * el usuario los dejo fuera del arreglo. Si una de estas lineas cambia o desaparece, la prueba
 * de abajo avisa para que se quite de la lista: una excepcion que sobrevive a su motivo es peor
 * que no tener prueba.
 *
 * @var array<string, list<string>>
 */
const EXCEPCIONES_FECHA_HOY = [
    // Nombre del archivo Excel de remisiones de autotanque.
    'resources/js/pages/Rampa/Autotanque/ExcelRemisiones.ts' => [
        '`Reporte_ASA_${new Date().toISOString().split(\'T\')[0]}.xlsx`',
    ],
    // Nombre del archivo Excel del reporte de autotanque.
    'resources/js/pages/Rampa/Autotanque/excelService.ts' => [
        'const fechaHoy = new Date().toISOString().split(\'T\')[0];',
    ],
    // Nombre del archivo Excel de inspecciones de combustible.
    'resources/js/pages/Rampa/Combustible/components/excelService.ts' => [
        '`Inspecciones_${new Date().toISOString().split(\'T\')[0]}.xlsx`',
    ],
];

/**
 * @return array{archivos: int, hallazgos: list<array{0: string, 1: int, 2: string}>}
 */
function escanearFechasEnElCodigo(): array
{
    $archivos = 0;
    $hallazgos = [];

    foreach (File::allFiles(base_path('resources/js')) as $archivo) {
        if (! in_array($archivo->getExtension(), ['ts', 'tsx'], true)) {
            continue;
        }

        $archivos++;
        $ruta = str_replace('\\', '/', substr($archivo->getPathname(), strlen(base_path()) + 1));

        foreach (hallazgosDeFechaPeligrosa(str_replace("\r\n", "\n", file_get_contents($archivo->getPathname()))) as [$linea, $texto]) {
            $hallazgos[] = [$ruta, $linea, $texto];
        }
    }

    return ['archivos' => $archivos, 'hallazgos' => $hallazgos];
}

test('el escaner CAE con los idiomas que calculan hoy en UTC o en la zona del equipo', function (string $codigo) {
    expect(hallazgosDeFechaPeligrosa($codigo))->not->toBeEmpty();
})->with([
    'toISOString recortado con slice' => ['const hoy = new Date().toISOString().slice(0, 10);'],
    'con slice sin espacios' => ['const hoy = new Date().toISOString().slice(0,10);'],
    'con substring' => ['const hoy = new Date().toISOString().substring(0, 10);'],
    'con split y comillas simples' => ["const hoy = new Date().toISOString().split('T')[0];"],
    'con split y comillas dobles' => ['const hoy = new Date().toISOString().split("T")[0];'],
    'repartido en varias lineas' => ["const hoy = new Date()\n    .toISOString()\n    .split('T')[0];"],
    'con espacios dentro del new Date( )' => ['const hoy = new Date( ).toISOString().slice(0, 10);'],
    'en-CA con comillas simples' => ["fechaInicio: new Date().toLocaleDateString('en-CA'),"],
    'en-CA con comillas dobles' => ['return new Date().toLocaleDateString("en-CA");'],
    'en-CA con opciones' => ["new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })"],
    'sv-SE, que tambien da AAAA-MM-DD' => ["const f = () => new Date().toLocaleDateString('sv-SE');"],
    'getTimezoneOffset' => ['new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60000)'],
]);

test('el escaner PASA con lo que es correcto o con lo que no es «hoy»', function (string $codigo) {
    expect(hallazgosDeFechaPeligrosa($codigo))->toBeEmpty();
})->with([
    // Una fecha ya guardada llega como medianoche UTC: tocarla en zona local la retrasaria un dia.
    'una fecha guardada con toISOString' => ["const f = new Date(datosEdicion.fecha).toISOString().split('T')[0];"],
    'una fecha guardada con en-CA' => ["const f = new Date(detalle.fecha).toLocaleDateString('en-CA');"],
    'una fecha guardada con slice' => ['const f = new Date(op.fecha).toISOString().slice(0, 10);'],
    'new Date con numeros' => ['const f = new Date(aMs(dia) + 1).toISOString().slice(0, 10);'],
    'un parametro que ya es Date' => ['params.fecha.toISOString().split("T")[0]'],
    'un instante completo, sin recortar' => ['fechaFinalizacion: new Date().toISOString(),'],
    'el ayudante' => ['fecha: fechaHoy(),'],
    'otro idioma de fecha' => ["new Date().toLocaleDateString('es-MX')"],
    'el anio' => ['useState(new Date().getFullYear())'],
]);

test('el escaner cuenta una linea una sola vez y da su numero', function () {
    $codigo = "const a = 1;\nconst b = new Date().toISOString().slice(0, 10) + new Date().toISOString().slice(0, 10);\n";

    expect(hallazgosDeFechaPeligrosa($codigo))->toBe([
        [2, 'const b = new Date().toISOString().slice(0, 10) + new Date().toISOString().slice(0, 10);'],
    ]);
});

test('NINGUN archivo de resources/js calcula hoy en UTC o en la zona del equipo', function () {
    $resultado = escanearFechasEnElCodigo();

    // Si el escaner no leyera nada, pasaria en vacio.
    expect($resultado['archivos'])->toBeGreaterThan(100);

    $prohibidos = array_filter(
        $resultado['hallazgos'],
        fn (array $h) => ! in_array($h[2], EXCEPCIONES_FECHA_HOY[$h[0]] ?? [], true),
    );

    $detalle = implode("\n", array_map(fn (array $h) => "  {$h[0]}:{$h[1]}  {$h[2]}", $prohibidos));

    expect($prohibidos)->toBeEmpty("Se calcula «hoy» sin pasar por fechaHoy() de resources/js/lib/fechaHoy.ts:\n{$detalle}");
});

test('cada excepcion sigue existiendo: una que ya no se necesita hay que quitarla', function () {
    $encontradas = [];

    foreach (escanearFechasEnElCodigo()['hallazgos'] as [$ruta, , $texto]) {
        $encontradas[$ruta][] = $texto;
    }

    foreach (EXCEPCIONES_FECHA_HOY as $ruta => $textos) {
        foreach ($textos as $texto) {
            expect(in_array($texto, $encontradas[$ruta] ?? [], true))
                ->toBeTrue("La excepcion de {$ruta} ya no existe en el codigo: quitala de EXCEPCIONES_FECHA_HOY ({$texto})");
        }
    }
});

test('hay UNA sola fechaHoy exportada y vive en lib, no en una pantalla', function () {
    // Antes vivia en `despacho/operacionesProgramadas/types.ts` y la importaban pantallas de
    // Rampa, Seguridad y Trafico: una dependencia al reves, y facil de copiar de nuevo.
    $definiciones = [];

    foreach (File::allFiles(base_path('resources/js')) as $archivo) {
        if (! in_array($archivo->getExtension(), ['ts', 'tsx'], true)) {
            continue;
        }

        $codigo = file_get_contents($archivo->getPathname());
        $ruta = str_replace('\\', '/', substr($archivo->getPathname(), strlen(base_path()) + 1));

        if (preg_match('/\bexport\s+(?:const|function|let)\s+fechaHoy\b|\bexport\s*\{[^}]*\bfechaHoy\b[^}]*\}/', $codigo)) {
            $definiciones[] = $ruta;
        }
    }

    expect($definiciones)->toBe(['resources/js/lib/fechaHoy.ts']);
});

test('la app siembra el ancla del servidor antes de montar', function () {
    // Prueba de CABLEADO, no de comportamiento: no hay corredor de pruebas JS. Sin esta llamada
    // `fechaHoy()` seguiria funcionando (cae en Intl con la zona de Mexico), pero sin la prop del
    // servidor, y nadie lo notaria.
    $app = file_get_contents(base_path('resources/js/app.tsx'));
    $ayudante = file_get_contents(base_path('resources/js/lib/fechaHoy.ts'));

    expect($app)->toContain("import { iniciarFechaHoy } from './lib/fechaHoy'")
        ->and($app)->toMatch('/^iniciarFechaHoy\(\);$/m')
        ->and($ayudante)->toContain("'inertia:navigate'")
        ->and($ayudante)->toContain('props?.hoy')
        ->and($ayudante)->toContain("const ZONA = 'America/Mexico_City'");
});
