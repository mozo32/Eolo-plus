<?php

use App\Models\FactServicio;

/**
 * El paquete internacional deja de ser un sí/no y pasa a decir de qué dirección es.
 * El origen internacional pide los de ENTRADA; el destino, los de SALIDA. Medido:
 * de 485 folios internacionales, 386 lo son en una sola dirección.
 */
test('un servicio puede pertenecer al paquete de entrada, al de salida, o a ninguno', function () {
    $entrada = FactServicio::create(['nombre' => 'DSMEE - entrada', 'precio_unitario' => 4060.50, 'paquete_internacional' => FactServicio::PAQUETE_ENTRADA]);
    $salida = FactServicio::create(['nombre' => 'DSMES - salida', 'precio_unitario' => 4060.50, 'paquete_internacional' => FactServicio::PAQUETE_SALIDA]);
    $suelto = FactServicio::create(['nombre' => 'Despacho de Vuelos', 'precio_unitario' => 900]);

    expect($entrada->fresh()->paquete_internacional)->toBe('entrada')
        ->and($salida->fresh()->paquete_internacional)->toBe('salida')
        ->and($suelto->fresh()->paquete_internacional)->toBeNull();
});

/**
 * El marcado se prueba invocándolo, no corriendo la migración: en sqlite la suite
 * migra desde cero y `fact_servicios` nace vacía, así que cuando la migración pasó
 * no había nada que marcar. Por eso el marcado vive en un método estático público
 * de la clase de la migración.
 */
function marcarPaquetesDePrueba(): array
{
    $migracion = require database_path('migrations/2026_10_15_100000_cambiar_paquete_internacional_en_fact_servicios.php');

    return $migracion::marcarPaquetes();
}

test('el marcado deja los cuatro de salida como salida', function () {
    // Se emparejan por NOMBRE: los ids locales no son los del origen.
    foreach (['DSM - salida', 'DSMES - salida', 'Mex-eAPI - salida', 'Servicios Internacionales - salida'] as $nombre) {
        FactServicio::create(['nombre' => $nombre, 'precio_unitario' => 100]);
    }

    marcarPaquetesDePrueba();

    expect(FactServicio::where('paquete_internacional', FactServicio::PAQUETE_SALIDA)->pluck('nombre')->sort()->values()->all())
        ->toBe(['DSM - salida', 'DSMES - salida', 'Mex-eAPI - salida', 'Servicios Internacionales - salida']);
});

test('el marcado deja los seis de entrada como entrada', function () {
    $entrada = [
        'Autorización de Internacion unica - AIU',
        'Basura Internacional by SENASICA',
        'DNR - entrada',
        'DSMEE - entrada',
        'Mex-eAPI - entrada',
        'Servicios Internacionales - entrada',
    ];

    foreach ($entrada as $nombre) {
        FactServicio::create(['nombre' => $nombre, 'precio_unitario' => 100]);
    }

    marcarPaquetesDePrueba();

    expect(FactServicio::where('paquete_internacional', FactServicio::PAQUETE_ENTRADA)->pluck('nombre')->sort()->values()->all())
        ->toBe($entrada);
});

test('Despacho de Vuelos NO entra en ningun paquete', function () {
    // Está en el 53% de los folios puramente nacionales: no es un servicio internacional.
    FactServicio::create(['nombre' => 'Despacho de Vuelos', 'precio_unitario' => 900]);

    marcarPaquetesDePrueba();

    expect(FactServicio::where('nombre', 'Despacho de Vuelos')->value('paquete_internacional'))->toBeNull();
});

test('un servicio del paquete que no esta en el catalogo se reporta, y el resto se marca igual', function () {
    // La spec lo exige: una migración que falle a medias deja el catálogo peor que un
    // paquete incompleto, que la pantalla ya sabe avisar.
    FactServicio::create(['nombre' => 'DSMES - salida', 'precio_unitario' => 100]);

    $resultado = marcarPaquetesDePrueba();

    expect($resultado['salida'])->toBe(1)
        ->and($resultado['no_encontrados'])->toContain('DSM - salida')
        ->and($resultado['no_encontrados'])->toContain('DSMEE - entrada');
});
