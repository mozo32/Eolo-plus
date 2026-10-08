<?php

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;

/**
 * El alta de walk around consulta `tb_tipo` en la conexión `remota`, que en este proyecto es de
 * SOLO LECTURA por contrato. Se sustituye por una sqlite en memoria para que ninguna prueba la
 * toque. Lleva nombre propio y no reusa el `remotaEnMemoria()` de `VentanasDeFechaEndpointsTest`
 * porque Pest carga los ficheros en el mismo proceso y dos funciones iguales chocarían.
 */
function remotaMinimaParaWalkAround(): void
{
    config(['database.connections.remota' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
    DB::purge('remota');

    Schema::connection('remota')->create('tb_tipo', function ($tabla) {
        $tabla->increments('id_tipo');
        $tabla->string('tipo');
    });

    Schema::connection('remota')->create('tb_matricula', function ($tabla) {
        $tabla->string('matricula');
        $tabla->integer('id_estatus');
        $tabla->integer('id_tipo');
        $tabla->integer('id_categoria');
        $tabla->integer('id_motor');
        $tabla->integer('id_aterrizaje');
        $tabla->integer('id_transito2h');
        $tabla->integer('id_transito12h');
        $tabla->integer('id_pernocta');
        $tabla->integer('d_vuelos');
    });

    DB::connection('remota')->table('tb_tipo')->insert(['tipo' => 'A109']);

    // La matrícula se siembra para que el alta la ENCUENTRE y no intente insertarla: la
    // conexión `remota` no se escribe ni en pruebas.
    DB::connection('remota')->table('tb_matricula')->insert([
        'matricula' => 'XA-CHK', 'id_estatus' => 1, 'id_tipo' => 1, 'id_categoria' => 1,
        'id_motor' => 1, 'id_aterrizaje' => 1, 'id_transito2h' => 1, 'id_transito12h' => 1,
        'id_pernocta' => 1, 'd_vuelos' => 0,
    ]);
}

beforeEach(fn () => remotaMinimaParaWalkAround());

/**
 * El checklist de inspección del walk around se guarda con la clave `damages` y las pantallas
 * lo consumen con la clave `danios`. Cuatro lectores leían `danios` del JSON guardado, donde
 * esa clave no existe, así que toda zona salía como «sin daño» aunque tuviera daños. Se notaba
 * en la pantalla de firma de los helicópteros porque ahí la rama de avión acertaba y la de
 * helicóptero no, pero el error estaba en cuatro sitios más.
 *
 * Estas pruebas fijan las dos mitades: que el contrato del servidor usa `damages`, y que
 * `damages` solo se lee en un sitio del navegador.
 */
/**
 * `aeronave` se escribe en minúsculas y sin acento porque la columna `tipo` es un enum
 * `('avion','helicoptero')`: MySQL acepta `Avión` por colación, pero el CHECK de la sqlite de
 * las pruebas distingue acentos. Que esto funcione depende de que `esAvion()` normalice, que
 * es justo lo que se corrigió.
 */
function altaDeWalkAround(string $aeronave, array $checklist): array
{
    return [
        'metadata' => [
            'movimiento' => 'salida',
            'matricula' => 'XA-CHK',
            'aeronave' => $aeronave,
            'tipo' => 'A109',
            'hora' => '10:30',
            'destino' => 'MMTO',
            'procedencia' => null,
            'fecha' => now()->toDateString(),
        ],
        'inspeccionTecnica' => ['numeroEstaticas' => 0, 'checklist' => $checklist],
        'cierreYFirmas' => ['observaciones' => null, 'nombreResponsable' => 'Resp', 'nombreJefe' => 'Jefe', 'nombreFbo' => 'Fbo'],
    ];
}

/** Un checklist con la forma exacta que hay en la base: una zona con daño y otra sin él. */
function checklistConUnDanio(): array
{
    return [
        'Fuselaje' => ['izq' => true, 'der' => true, 'damages' => ['pintura_cuarteada']],
        'Palas' => ['izq' => false, 'der' => false, 'damages' => ['sin_danio']],
    ];
}

test('el detalle de un HELICOPTERO devuelve sus danios, con la clave damages', function () {
    $this->actingAs(User::factory()->create(), 'sanctum');

    $id = $this->postJson('/api/walkarounds', altaDeWalkAround('helicoptero', checklistConUnDanio()))
        ->assertCreated()
        ->json('id');

    $detalle = $this->getJson("/api/walkarounds/{$id}")->assertOk()->json();

    // La columna de helicóptero es la que lleva el dato, y la de avión queda vacía.
    expect($detalle['checklists']['checklist_avion'])->toBeNull();

    $checklist = $detalle['checklists']['checklist_helicoptero'];

    // Lo que importa: la zona con daño llega CON su daño, no vacía.
    expect($checklist['Fuselaje']['damages'])->toBe(['pintura_cuarteada']);
    expect($checklist['Palas']['damages'])->toBe(['sin_danio']);
    expect($checklist['Fuselaje']['izq'])->toBeTrue();

    // Y la clave `danios` NO existe en lo guardado: leerla es el defecto que esto previene.
    expect($checklist['Fuselaje'])->not->toHaveKey('danios');
});

test('el detalle de un AVION devuelve sus danios en su propia columna', function () {
    $this->actingAs(User::factory()->create(), 'sanctum');

    $id = $this->postJson('/api/walkarounds', altaDeWalkAround('avion', checklistConUnDanio()))
        ->assertCreated()
        ->json('id');

    $detalle = $this->getJson("/api/walkarounds/{$id}")->assertOk()->json();

    expect($detalle['checklists']['checklist_helicoptero'])->toBeNull();
    expect($detalle['checklists']['checklist_avion']['Fuselaje']['damages'])->toBe(['pintura_cuarteada']);
});

/**
 * Hay DOS mundos y confundirlos era el defecto:
 *
 *   - el FORMULARIO lee y vuelve a guardar la forma de la base, con la clave `damages`. Hace
 *     ida y vuelta, así que normalizarlo rompería lo guardado;
 *   - las vistas de SOLO LECTURA (firma, detalle, los dos PDF) normalizan esa forma a `danios`,
 *     que es el nombre de `EstadoPregunta*` en `types/typesChecklist.ts`.
 *
 * Cuatro vistas leían `danios` del JSON guardado, donde no existe, y pintaban todo como «sin
 * daño». Estas dos pruebas fijan que la forma guardada entre por una sola puerta.
 */

/** Quién puede nombrar la clave guardada `damages`, y por qué. */
const PUEDEN_USAR_DAMAGES = [
    'resources/js/lib/checklistWalkAround.ts' => 'es la única puerta de lectura: traduce `damages` a `danios`',
    'resources/js/pages/despacho/componentes2/steps/DamageChecklist.tsx' => 'el formulario: captura los daños y los guarda con esa clave',
    'resources/js/pages/despacho/componentes2/formValidators.ts' => 'valida lo que el formulario va a guardar, en su misma forma',
];

/** Quién puede nombrar las columnas guardadas SIN normalizarlas, y por qué. */
const PUEDEN_LEER_LAS_COLUMNAS_SIN_NORMALIZAR = [
    'resources/js/stores/apiWalkaround.ts' => 'solo declara el tipo de la respuesta',
    'resources/js/pages/BitacoraModal.tsx' => 'solo las etiqueta; el servidor le manda el texto ya hecho',
    'resources/js/pages/despacho/componentes2/steps/WalkAroundFormV2.tsx' => 'es el formulario: hace ida y vuelta con la forma guardada',
];

/**
 * Quita los comentarios antes de escanear: la regla es sobre el CODIGO, no sobre la prosa. Sin
 * esto, un comentario que explique por que no se usa `damages` contaria como usarla. Es un
 * recorte de texto, asi que `/*` dentro de una cadena lo despistaria; no ocurre en este codigo.
 */
function sinComentarios(string $codigo): string
{
    $codigo = preg_replace('#/\*.*?\*/#s', '', $codigo);

    return preg_replace('#//[^
]*#', '', $codigo);
}

/** Los ficheros .ts y .tsx de resources/js, con su ruta relativa. */
function codigoDelNavegador(): array
{
    $archivos = [];

    foreach (File::allFiles(base_path('resources/js')) as $archivo) {
        if (! in_array($archivo->getExtension(), ['ts', 'tsx'], true)) {
            continue;
        }

        $ruta = str_replace(DIRECTORY_SEPARATOR, '/', substr($archivo->getPathname(), strlen(base_path()) + 1));
        $archivos[$ruta] = sinComentarios(str_replace(chr(13).chr(10), chr(10), file_get_contents($archivo->getPathname())));
    }

    return $archivos;
}

test('la clave guardada damages solo se nombra donde debe', function () {
    $codigo = codigoDelNavegador();

    // Si no leyera nada, la prueba pasaria en vacio.
    expect(count($codigo))->toBeGreaterThan(100);

    $intrusos = array_keys(array_filter(
        $codigo,
        fn (string $texto, string $ruta) => str_contains($texto, 'damages')
            && ! array_key_exists($ruta, PUEDEN_USAR_DAMAGES),
        ARRAY_FILTER_USE_BOTH
    ));

    expect($intrusos)->toBeEmpty(
        'Estos ficheros nombran la clave guardada `damages`. Para LEER el checklist usa'
        ." normalizarChecklistGuardado() de resources/js/lib/checklistWalkAround.ts:\n  "
        .implode("\n  ", $intrusos)
    );
});

test('quien lee el checklist guardado para mostrarlo lo normaliza', function () {
    $sinNormalizar = [];

    foreach (codigoDelNavegador() as $ruta => $texto) {
        $nombraLasColumnas = str_contains($texto, 'checklist_avion') || str_contains($texto, 'checklist_helicoptero');

        if (! $nombraLasColumnas || array_key_exists($ruta, PUEDEN_LEER_LAS_COLUMNAS_SIN_NORMALIZAR)) {
            continue;
        }

        foreach (['checklist_avion', 'checklist_helicoptero'] as $columna) {
            $desde = 0;

            while (($posicion = strpos($texto, $columna, $desde)) !== false) {
                $desde = $posicion + 1;

                // Se mira hacia atras hasta el ultimo `;`: dentro de esa sentencia tiene que
                // estar la llamada al normalizador. Asi se caza que UNA de las dos ramas deje
                // de normalizar, que es lo que una regla por fichero no ve.
                $antes = substr($texto, 0, $posicion);
                $corte = strrpos($antes, ';');
                $inicio = $corte === false ? 0 : $corte;
                $fin = strpos($texto, ';', $posicion);
                $sentencia = substr($texto, $inicio, ($fin === false ? strlen($texto) : $fin) - $inicio);

                if (! str_contains($sentencia, 'normalizarChecklistGuardado(')) {
                    $sinNormalizar[] = "{$ruta} (".$columna.')';
                    break;
                }
            }
        }
    }

    expect($sinNormalizar)->toBeEmpty(
        'Estos ficheros leen `checklist_avion` o `checklist_helicoptero` sin normalizarlos, asi que'
        ." veran `damages` donde esperan `danios` y pintaran todo como «sin daño»:\n  "
        .implode("\n  ", $sinNormalizar)
    );
});

test('cada excepcion sigue haciendo falta: una que ya no, hay que quitarla', function () {
    $codigo = codigoDelNavegador();

    foreach (PUEDEN_USAR_DAMAGES as $ruta => $motivo) {
        expect(str_contains($codigo[$ruta] ?? '', 'damages'))
            ->toBeTrue("{$ruta} ya no nombra `damages`: quitalo de PUEDEN_USAR_DAMAGES ({$motivo})");
    }

    foreach (PUEDEN_LEER_LAS_COLUMNAS_SIN_NORMALIZAR as $ruta => $motivo) {
        $texto = $codigo[$ruta] ?? '';
        expect(str_contains($texto, 'checklist_avion') || str_contains($texto, 'checklist_helicoptero'))
            ->toBeTrue("{$ruta} ya no nombra las columnas guardadas: quitalo de la lista ({$motivo})");
    }
});
