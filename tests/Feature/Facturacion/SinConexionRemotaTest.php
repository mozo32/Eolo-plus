<?php
// tests/Feature/Facturacion/SinConexionRemotaTest.php

use App\Models\FactPrecioCombustible;
use App\Models\Remision;
use App\Models\SumaAutotanque;
use App\Models\User;

test('ningun controlador usa ya la conexion remota a Prefacturas', function () {
    $culpables = [];
    $revisados = 0;

    $archivos = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator(app_path('Http/Controllers'))
    );

    foreach ($archivos as $archivo) {
        if ($archivo->getExtension() !== 'php') {
            continue;
        }

        $revisados++;

        // Acepta comillas simples o dobles y espacios: connection( "remota" ).
        if (preg_match('/connection\(\s*[\'"]remota[\'"]\s*\)/', file_get_contents($archivo->getPathname()))) {
            $culpables[] = $archivo->getFilename();
        }
    }

    // Que la prueba de verdad recorrió el directorio, no pasó por estar vacío.
    expect($revisados)->toBeGreaterThan(10)
        ->and($culpables)->toBe([]);
});

test('el precio de combustible vigente sale del catalogo local', function () {
    $usuario = User::factory()->create();
    FactPrecioCombustible::registrar(20.00, null, $usuario->id);
    $vigente = FactPrecioCombustible::registrar(22.50, 26.45, $usuario->id);

    expect((float) FactPrecioCombustible::vigente()->precio_eolo)->toBe(26.45)
        ->and((float) FactPrecioCombustible::vigente()->precio_asa)->toBe(22.50)
        ->and(FactPrecioCombustible::vigente()->id)->toBe($vigente->id);
});

test('sin precio registrado los controladores usan cero, como hacian antes', function () {
    expect(FactPrecioCombustible::vigente()?->precio_eolo ?? 0)->toBe(0);
});

// Los dos precios no son intercambiables: la remision cobra el de Eolo y las
// sumas del autotanque registran el costo (ASA).

test('la remision se guarda con el precio de Eolo', function () {
    $usuario = User::factory()->create();
    FactPrecioCombustible::registrar(22.50, 26.45, $usuario->id);

    $this->actingAs($usuario)->postJson('/api/Remision/remisiones', [
        'fecha' => '2026-09-28',
        'operador' => 'Operador Uno',
        'cliente' => 'Cliente SA',
        'matricula' => 'XA-ABC',
        'aeronaveTipo' => 'Learjet 45',
        'destino' => 'MMMX',
        'horaLlegada' => '10:00',
        'horaInicial' => '10:10',
        'horaFinal' => '10:30',
        'lecturaInicial' => 100,
        'lecturaFinal' => 250,
    ])->assertCreated();

    expect((float) Remision::firstOrFail()->precio)->toBe(26.45);
});

test('la remision sin precio capturado se guarda con precio cero', function () {
    $this->actingAs(User::factory()->create())->postJson('/api/Remision/remisiones', [
        'fecha' => '2026-09-28',
        'operador' => 'Operador Uno',
        'cliente' => 'Cliente SA',
        'matricula' => 'XA-ABC',
        'aeronaveTipo' => 'Learjet 45',
        'destino' => 'MMMX',
        'horaLlegada' => '10:00',
        'horaInicial' => '10:10',
        'horaFinal' => '10:30',
        'lecturaInicial' => 100,
        'lecturaFinal' => 250,
    ])->assertCreated();

    expect((float) Remision::firstOrFail()->precio)->toBe(0.0);
});

test('la entrada ASA del turno de autotanque se guarda con el precio ASA', function () {
    $usuario = User::factory()->create();
    FactPrecioCombustible::registrar(22.50, 26.45, $usuario->id);

    $this->actingAs($usuario)->postJson('/api/TurnoAutoTanque', [
        'nombre' => 'Operador Uno',
        'fecha' => '2026-09-28',
        'cmIni' => 50,
        'litrosIni' => 1000,
        'totalizadorIni' => 5000,
        'resumen' => [
            'totalVendidos' => 0,
            'balanceAritmetico' => 0,
            'balanceFisico' => 0,
            'diferenciaFinal' => 0,
        ],
        'entradasASA' => [
            ['litros' => 800, 'remision' => 'ASA-001'],
        ],
    ])->assertSuccessful();

    expect((float) SumaAutotanque::firstOrFail()->getRawOriginal('costo'))->toBe(22.5);
});

test('la entrada ASA sin precio capturado se guarda con costo cero', function () {
    $usuario = User::factory()->create();

    $this->actingAs($usuario)->postJson('/api/TurnoAutoTanque', [
        'nombre' => 'Operador Uno',
        'fecha' => '2026-09-28',
        'cmIni' => 50,
        'litrosIni' => 1000,
        'totalizadorIni' => 5000,
        'resumen' => [
            'totalVendidos' => 0,
            'balanceAritmetico' => 0,
            'balanceFisico' => 0,
            'diferenciaFinal' => 0,
        ],
        'entradasASA' => [
            ['litros' => 800, 'remision' => 'ASA-001'],
        ],
    ])->assertSuccessful();

    expect((float) SumaAutotanque::firstOrFail()->getRawOriginal('costo'))->toBe(0.0);
});
