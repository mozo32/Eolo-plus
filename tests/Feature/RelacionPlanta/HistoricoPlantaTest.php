<?php

/*
 * Histórico de préstamos de la GPU N.115: orden, filtros, paginación y
 * sugerencias de empresas. Helpers en PrestarPlantaTest.php.
 */

test('el histórico ordena en_uso primero y luego por fecha descendente', function () {
    $viejo = prestamoFinalizado(['fecha' => '2026-09-01', 'matricula' => 'XA-V']);
    $nuevo = prestamoFinalizado(['fecha' => '2026-09-13', 'matricula' => 'XA-N']);
    $abierto = prestamoAbierto(['fecha' => '2026-09-05', 'matricula' => 'XA-A']);

    $this->actingAs(usuarioSinAcceso());

    $ids = collect($this->getJson('/api/RelacionPlanta/historico')->assertOk()->json('data'))->pluck('id')->all();

    expect($ids)->toBe([$abierto->id, $nuevo->id, $viejo->id]);
});

test('el histórico filtra por rango de fechas, empresa, matrícula y estado', function () {
    prestamoFinalizado(['fecha' => '2026-09-01', 'empresa' => 'ALFA', 'matricula' => 'XA-UNO']);
    prestamoFinalizado(['fecha' => '2026-09-10', 'empresa' => 'BETA', 'matricula' => 'XA-DOS']);
    prestamoAbierto(['fecha' => '2026-09-12', 'empresa' => 'ALFA', 'matricula' => 'N123']);

    $this->actingAs(usuarioSinAcceso());

    $consulta = fn (string $q) => collect($this->getJson("/api/RelacionPlanta/historico?{$q}")->assertOk()->json('data'))->pluck('matricula')->all();

    expect($consulta('fecha_inicio=2026-09-05&fecha_fin=2026-09-11'))->toBe(['XA-DOS'])
        ->and($consulta('empresa=alf'))->toBe(['N123', 'XA-UNO'])
        ->and($consulta('matricula=xa-'))->toBe(['XA-DOS', 'XA-UNO'])
        ->and($consulta('status=en_uso'))->toBe(['N123'])
        ->and($consulta('status=finalizado'))->toBe(['XA-DOS', 'XA-UNO']);
});

test('el histórico pagina y acota per_page a los valores permitidos', function () {
    foreach (range(1, 25) as $i) {
        prestamoFinalizado(['fecha' => '2026-09-01', 'matricula' => "XA-{$i}"]);
    }

    $this->actingAs(usuarioSinAcceso());

    $this->getJson('/api/RelacionPlanta/historico?per_page=10&page=2')
        ->assertOk()
        ->assertJsonPath('per_page', 10)
        ->assertJsonPath('current_page', 2)
        ->assertJsonPath('total', 25)
        ->assertJsonCount(10, 'data');

    // Un valor no permitido cae al default de 20.
    $this->getJson('/api/RelacionPlanta/historico?per_page=7')->assertOk()->assertJsonPath('per_page', 20);
});

test('empresas devuelve las distintas ya usadas, filtradas por texto', function () {
    prestamoFinalizado(['empresa' => 'BETA AIR']);
    prestamoFinalizado(['empresa' => 'ALFA JET']);
    prestamoFinalizado(['empresa' => 'ALFA JET']);

    $this->actingAs(usuarioSinAcceso());

    $this->getJson('/api/RelacionPlanta/empresas')->assertOk()->assertExactJson(['ALFA JET', 'BETA AIR']);
    $this->getJson('/api/RelacionPlanta/empresas?q=bet')->assertOk()->assertExactJson(['BETA AIR']);
});
