<?php

/*
 * El conector de broadcasting sale de `BROADCAST_CONNECTION`, con `reverb` por omisión.
 *
 * Antes estaba escrito a mano en el config y la variable no servía de nada, con dos
 * consecuencias: un servidor sin Reverb levantado intentaba igualmente hablar con el host de
 * desarrollo al emitir `RemisionCreada` —el único evento que este sistema emite de verdad,
 * en `RemisionController::store()`—, y el `BROADCAST_CONNECTION=null` que `phpunit.xml` pide
 * para las pruebas tampoco se respetaba.
 *
 * El fichero de configuración se lee a mano, con `require`, porque `config()` ya está resuelto
 * cuando la prueba corre: leerlo de ahí no distinguiría un valor fijo de uno leído del entorno.
 * La variable se toca en los TRES sitios que `env()` consulta —`$_ENV`, `$_SERVER` y `putenv`—
 * porque `phpunit.xml` la define en los tres: quitarla de uno solo no la quita.
 */

function broadcastingCon(?string $conexion): array
{
    $previoEnv = $_ENV['BROADCAST_CONNECTION'] ?? null;
    $previoServer = $_SERVER['BROADCAST_CONNECTION'] ?? null;
    $previoPutenv = getenv('BROADCAST_CONNECTION');

    if ($conexion === null) {
        unset($_ENV['BROADCAST_CONNECTION'], $_SERVER['BROADCAST_CONNECTION']);
        putenv('BROADCAST_CONNECTION');
    } else {
        $_ENV['BROADCAST_CONNECTION'] = $conexion;
        $_SERVER['BROADCAST_CONNECTION'] = $conexion;
        putenv("BROADCAST_CONNECTION={$conexion}");
    }

    try {
        return require config_path('broadcasting.php');
    } finally {
        foreach ([['_ENV', $previoEnv], ['_SERVER', $previoServer]] as [$donde, $previo]) {
            if ($previo === null) {
                unset($GLOBALS[$donde]['BROADCAST_CONNECTION']);
            } else {
                $GLOBALS[$donde]['BROADCAST_CONNECTION'] = $previo;
            }
        }

        if ($previoPutenv === false) {
            putenv('BROADCAST_CONNECTION');
        } else {
            putenv("BROADCAST_CONNECTION={$previoPutenv}");
        }
    }
}

test('sin la variable, el conector sigue siendo reverb', function () {
    expect(broadcastingCon(null)['default'])->toBe('reverb');
});

test('con la variable, el conector es el que dice el entorno', function (string $conexion) {
    expect(broadcastingCon($conexion)['default'])->toBe($conexion);
})->with(['log', 'pusher', 'ably']);

test('el null de phpunit.xml llega como null de PHP, que es el emisor que no emite', function () {
    // `env()` traduce la cadena «null» a null, y `BroadcastManager::getConfig(null)` devuelve
    // el emisor `null`. Por eso las pruebas ya no intentan hablar con Reverb.
    expect(broadcastingCon('null')['default'])->toBeNull();
});

test('las conexiones que se van a nombrar de verdad existen en el config', function () {
    // Un nombre que no esté aquí rompe el broadcasting al resolverlo, no al emitir.
    expect(broadcastingCon(null)['connections'])->toHaveKeys(['reverb', 'log', 'null']);
});
