<?php

use App\Support\VentanasDeFecha;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Validator;
use Inertia\Testing\AssertableInertia as Assert;

test('una ventana de un dia atras da hoy y ayer', function () {
    Carbon::setTestNow('2026-10-07 15:00:00');

    expect(VentanasDeFecha::para('turno.checklist'))
        ->toBe(['min' => '2026-10-06', 'max' => '2026-10-07']);
});

test('una ventana de tres dias atras da cuatro dias, contando hoy', function () {
    Carbon::setTestNow('2026-10-07 15:00:00');

    expect(VentanasDeFecha::para('operaciones.llegada'))
        ->toBe(['min' => '2026-10-04', 'max' => '2026-10-07']);
});

test('la excepcion de Operaciones Programadas no pone techo ni suelo', function () {
    Carbon::setTestNow('2026-10-07 15:00:00');

    expect(VentanasDeFecha::para('programadas.operacion'))
        ->toBe(['min' => null, 'max' => null]);
});

test('UNA CLAVE DESCONOCIDA LANZA, no devuelve un valor por omision', function () {
    // Es la red de todo lo demas: con un valor por omision silencioso, un formulario
    // quedaria sin restriccion —o restringido de mas— y nadie se enteraria.
    expect(fn () => VentanasDeFecha::para('turno.checklis'))
        ->toThrow(InvalidArgumentException::class);
});

test('SOLO Operaciones Programadas admite futuro; se recorre la tabla entera', function () {
    // Asi, un formulario nuevo mal declarado sale en rojo en vez de colarse.
    Carbon::setTestNow('2026-10-07 15:00:00');

    foreach (array_keys(VentanasDeFecha::CLAVES) as $clave) {
        $max = VentanasDeFecha::para($clave)['max'];

        if ($clave === 'programadas.operacion') {
            expect($max)->toBeNull("la excepcion {$clave} deberia admitir futuro");

            continue;
        }

        expect($max)->toBe('2026-10-07', "la clave {$clave} NO deberia admitir futuro");
    }
});

test('todas() devuelve una entrada por clave', function () {
    expect(array_keys(VentanasDeFecha::todas()))
        ->toBe(array_keys(VentanasDeFecha::CLAVES));
});

test('todo formulario salvo la excepcion tiene suelo, y el suelo no pasa del techo', function () {
    // Una clave con `atras => null` por descuido dejaria el calendario abierto hacia el pasado.
    Carbon::setTestNow('2026-10-07 15:00:00');

    foreach (array_keys(VentanasDeFecha::CLAVES) as $clave) {
        if ($clave === 'programadas.operacion') {
            continue;
        }

        $ventana = VentanasDeFecha::para($clave);

        expect($ventana['min'])->not->toBeNull("la clave {$clave} no deberia quedar sin suelo");
        expect($ventana['min'] <= $ventana['max'])->toBeTrue("la clave {$clave} tiene el suelo por encima del techo");
    }
});

test('la regla acepta hoy y el borde, y rechaza un dia mas alla', function (string $fecha, bool $valida) {
    Carbon::setTestNow('2026-10-07 15:00:00');

    $validador = Validator::make(['fecha' => $fecha], [
        'fecha' => [new App\Rules\DentroDeLaVentana('operaciones.llegada')],
    ]);

    expect($validador->passes())->toBe($valida);
})->with([
    'hoy' => ['2026-10-07', true],
    'el borde de atras' => ['2026-10-04', true],
    'un dia ANTES del borde' => ['2026-10-03', false],
    'manana' => ['2026-10-08', false],
]);

test('el mensaje dice LAS DOS FECHAS, no «fecha invalida»', function () {
    Carbon::setTestNow('2026-10-07 15:00:00');

    $validador = Validator::make(['fecha' => '2026-10-01'], [
        'fecha' => [new App\Rules\DentroDeLaVentana('operaciones.llegada')],
    ]);

    expect($validador->errors()->first('fecha'))
        ->toContain('04/10/2026')
        ->toContain('07/10/2026');
});

test('la excepcion acepta una fecha futura', function () {
    Carbon::setTestNow('2026-10-07 15:00:00');

    $validador = Validator::make(['fecha' => '2026-12-25'], [
        'fecha' => [new App\Rules\DentroDeLaVentana('programadas.operacion')],
    ]);

    expect($validador->passes())->toBeTrue();
});

test('una fecha ilegible no es asunto de la regla: solo `date` da el mensaje', function () {
    // Si la regla tambien validara el formato, un mismo error saldria con dos mensajes.
    Carbon::setTestNow('2026-10-07 15:00:00');

    $validador = Validator::make(['fecha' => 'no-es-una-fecha'], [
        'fecha' => ['date', new App\Rules\DentroDeLaVentana('operaciones.llegada')],
    ]);

    expect($validador->passes())->toBeFalse()
        ->and($validador->errors()->get('fecha'))->toHaveCount(1);

    $sola = Validator::make(['fecha' => 'no-es-una-fecha'], [
        'fecha' => [new App\Rules\DentroDeLaVentana('operaciones.llegada')],
    ]);

    expect($sola->passes())->toBeTrue();
});

// DEUDA: esta prueba usa Reflection porque hoy NINGUNA clave produce una ventana de un solo
// lado. Cuando aparezca la primera, hay que sustituirla por una prueba con esa clave real y
// borrar la Reflection.
test('una ventana sin suelo solo avisa del techo, y una sin techo solo del suelo', function () {
    // Las claves reales no producen estas formas (la excepcion no tiene ni suelo ni techo),
    // asi que se ejercita el mensaje directamente.
    Carbon::setTestNow('2026-10-07 15:00:00');

    $mensaje = new ReflectionMethod(App\Rules\DentroDeLaVentana::class, 'mensaje');
    $regla = new App\Rules\DentroDeLaVentana('operaciones.llegada');

    expect($mensaje->invoke($regla, null, '2026-10-07'))->toBe('La fecha no puede ser posterior al 07/10/2026.')
        ->and($mensaje->invoke($regla, '2026-10-04', null))->toBe('La fecha no puede ser anterior al 04/10/2026.');
});

test('una clave desconocida lanza tambien desde la regla', function () {
    $validador = Validator::make(['fecha' => '2026-10-07'], [
        'fecha' => [new App\Rules\DentroDeLaVentana('operaciones.llegda')],
    ]);

    expect(fn () => $validador->passes())->toThrow(InvalidArgumentException::class);
});

test('la regla compara solo el dia: la hora de una fecha con hora no la saca de la ventana', function () {
    Carbon::setTestNow('2026-10-07 15:00:00');

    $validador = Validator::make(['fecha' => '2026-10-07 23:59:59'], [
        'fecha' => [new App\Rules\DentroDeLaVentana('operaciones.llegada')],
    ]);

    expect($validador->passes())->toBeTrue();
});

test('una fecha con zona se compara en el dia de la zona de la aplicacion', function () {
    // 02:00 UTC del dia 8 son las 20:00 del dia 7 en Mexico: es hoy, no manana.
    Carbon::setTestNow('2026-10-07 15:00:00');

    $validador = Validator::make(['fecha' => '2026-10-08T02:00:00Z'], [
        'fecha' => [new App\Rules\DentroDeLaVentana('operaciones.llegada')],
    ]);

    expect($validador->passes())->toBeTrue();
});

test('las ventanas viajan en las props de Inertia', function () {
    // Las claves de la tabla llevan punto ('operaciones.llegada') y viajan como claves
    // literales, así que `where('ventanasDeFecha.operaciones.llegada.min')` las
    // interpretaría como anidadas y no las encontraría: se lee el arreglo de props.
    Carbon::setTestNow('2026-10-07 15:00:00');
    $this->actingAs(App\Models\User::factory()->create());

    $this->get('/dashboard')->assertInertia(function (Assert $page) {
        $ventanas = $page->toArray()['props']['ventanasDeFecha'];

        expect($ventanas['operaciones.llegada'])
            ->toBe(['min' => '2026-10-04', 'max' => '2026-10-07'])
            ->and($ventanas['turno.checklist'])
            ->toBe(['min' => '2026-10-06', 'max' => '2026-10-07'])
            ->and($ventanas['programadas.operacion'])
            ->toBe(['min' => null, 'max' => null]);
    });
});

test('la tabla de ventanas esta fijada a mano: cambiar una exige reconocerlo aqui', function () {
    // Duplica la tabla A PROPOSITO. Las demas pruebas leen `CLAVES` por ambos lados y se
    // mueven con ella; esta no, y por eso cambiar una ventana (o quitar, renombrar o
    // anadir una clave) obliga a tocar dos sitios. Es una regla de integridad de datos.
    expect(VentanasDeFecha::CLAVES)->toBe([
        'turno.checklist' => ['atras' => 1, 'futuro' => false],
        'turno.entrega_rampa' => ['atras' => 1, 'futuro' => false],
        'autotanque.turno_inicio' => ['atras' => 1, 'futuro' => false],
        'autotanque.turno_cierre' => ['atras' => 1, 'futuro' => false],
        'chalecos.prestamo' => ['atras' => 1, 'futuro' => false],
        'planta.prestamo' => ['atras' => 1, 'futuro' => false],
        'estacionamiento.ronda' => ['atras' => 1, 'futuro' => false],
        'operaciones.llegada' => ['atras' => 3, 'futuro' => false],
        'operaciones.salida' => ['atras' => 3, 'futuro' => false],
        'operaciones.registro' => ['atras' => 3, 'futuro' => false],
        'despacho.walk_around' => ['atras' => 3, 'futuro' => false],
        'despacho.informacion_general' => ['atras' => 3, 'futuro' => false],
        'autotanque.servicio' => ['atras' => 3, 'futuro' => false],
        'comisariato.entrega' => ['atras' => 3, 'futuro' => false],
        'csae.entrada' => ['atras' => 3, 'futuro' => false],
        'csae.salida' => ['atras' => 3, 'futuro' => false],
        'pernocta.dia' => ['atras' => 3, 'futuro' => false],
        'medicamento.movimiento' => ['atras' => 3, 'futuro' => false],
        'programadas.operacion' => ['atras' => null, 'futuro' => true],
    ]);
});

/**
 * Los usos de una clave en el codigo fuente: [archivo, literal] por cada llamada.
 *
 * @param  list<string>  $carpetas
 * @param  list<string>  $extensiones
 * @return array{literales: list<array{0: string, 1: string}>, llamadas: int}
 */
function usosDeVentana(array $carpetas, array $extensiones, string $patronLlamada, string $patronLiteral, array $excluir = []): array
{
    $literales = [];
    $llamadas = 0;

    foreach ($carpetas as $carpeta) {
        foreach (File::allFiles(base_path($carpeta)) as $archivo) {
            $ruta = str_replace('\\', '/', $archivo->getPathname());

            if (! in_array($archivo->getExtension(), $extensiones, true) || in_array(basename($ruta), $excluir, true)) {
                continue;
            }

            $codigo = file_get_contents($ruta);
            $llamadas += preg_match_all($patronLlamada, $codigo);

            if (preg_match_all($patronLiteral, $codigo, $coincidencias)) {
                foreach ($coincidencias[1] as $literal) {
                    $literales[] = [$ruta, $literal];
                }
            }
        }
    }

    return ['literales' => $literales, 'llamadas' => $llamadas];
}

test('cada clave escrita en el codigo existe en la tabla de ventanas', function () {
    // `useVentanaDeFecha('csae.entrda')` compila y deja el calendario SIN limites en
    // silencio, mientras que `para()` si lanza. Esta prueba cierra esa asimetria: lee el
    // codigo fuente y exige que cada literal exista en `CLAVES`.
    $js = usosDeVentana(
        ['resources/js'],
        ['ts', 'tsx'],
        '/\buseVentanaDeFecha\(/',
        '/\buseVentanaDeFecha\(\s*[\'"]([^\'"]*)[\'"]\s*\)/',
        ['ventanasDeFecha.ts'],
    );
    $php = usosDeVentana(
        ['app'],
        ['php'],
        '/\bnew\s+[\w\\\\]*DentroDeLaVentana\(/',
        '/\bnew\s+[\w\\\\]*DentroDeLaVentana\(\s*[\'"]([^\'"]*)[\'"]\s*\)/',
    );

    foreach (array_merge($js['literales'], $php['literales']) as [$ruta, $literal]) {
        $this->assertArrayHasKey($literal, VentanasDeFecha::CLAVES, "Clave de ventana desconocida '{$literal}' en {$ruta}");
    }

    // Una llamada con una variable o una expresion escapa a la lectura de literales: se
    // exige que todas las llamadas sean con un literal, para que nada quede sin comprobar.
    expect($js['llamadas'])->toBe(count($js['literales']), 'useVentanaDeFecha se llama con algo que no es un literal');
    expect($php['llamadas'])->toBe(count($php['literales']), 'DentroDeLaVentana se instancia con algo que no es un literal');
});
