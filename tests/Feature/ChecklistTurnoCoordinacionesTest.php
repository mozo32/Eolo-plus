<?php

use App\Models\ChecklistTurno;
use App\Models\User;

/**
 * La casilla «Revisión de Base de Operaciones» se retira del formulario, pero su dato histórico
 * se conserva: el detalle y el PDF de los turnos ya firmados lo siguen mostrando.
 *
 * Eso abre una trampa. El `update` guardaba ese campo con `?? false`, así que una edición que no
 * lo enviara —justo lo que pasa al quitarlo del formulario— pondría en falso un valor que estaba
 * en verdadero. Se perdería el histórico en el escenario que se quería conservar.
 *
 * Estas pruebas fijan que una edición que NO menciona el campo lo deja como estaba, y que una
 * que sí lo menciona lo cambia.
 */
function checklistConRevisionBase(bool $revisado): ChecklistTurno
{
    return ChecklistTurno::create([
        'nombre_empleado' => 'Empleado Uno',
        'fecha' => now()->toDateString(),
        'recibe_turno_con' => [],
        'revision_salas' => [],
        'entrega_turno_con' => [],
        'cantidad_pasajeros' => 0,
        'cantidad_operaciones' => 0,
        'revision_base_operaciones' => $revisado,
        'envia_informe_diario' => false,
        'envia_resumen_semanal' => false,
    ]);
}

/** Lo mínimo que el formulario manda al editar, ya sin la casilla retirada. */
function edicionSinLaCasillaRetirada(array $extra = []): array
{
    return array_merge([
        'nombreEmpleado' => 'Empleado Dos',
        'fecha' => now()->toDateString(),
    ], $extra);
}

test('editar sin mandar la casilla retirada CONSERVA su valor guardado', function () {
    $this->actingAs(User::factory()->create(), 'sanctum');
    $checklist = checklistConRevisionBase(true);

    $this->putJson("/api/CheckListTurno/{$checklist->id}", edicionSinLaCasillaRetirada())
        ->assertSuccessful();

    // Se lee la columna: es lo unico que prueba que el historico sigue ahi.
    expect($checklist->fresh()->revision_base_operaciones)->toBeTrue();
});

test('editar sin mandarla tampoco la enciende si estaba apagada', function () {
    $this->actingAs(User::factory()->create(), 'sanctum');
    $checklist = checklistConRevisionBase(false);

    $this->putJson("/api/CheckListTurno/{$checklist->id}", edicionSinLaCasillaRetirada())
        ->assertSuccessful();

    expect($checklist->fresh()->revision_base_operaciones)->toBeFalse();
});

test('si la edicion SI manda la casilla, se respeta lo que manda', function (bool $guardado, bool $enviado) {
    $this->actingAs(User::factory()->create(), 'sanctum');
    $checklist = checklistConRevisionBase($guardado);

    $this->putJson(
        "/api/CheckListTurno/{$checklist->id}",
        edicionSinLaCasillaRetirada(['revision_base_operaciones' => $enviado])
    )->assertSuccessful();

    expect($checklist->fresh()->revision_base_operaciones)->toBe($enviado);
})->with([
    'de verdadero a falso' => [true, false],
    'de falso a verdadero' => [false, true],
    'de verdadero a verdadero' => [true, true],
]);

test('las otras dos casillas siguen comportandose igual: ausente las apaga', function () {
    // No se tocan. Si alguna vez tambien se retiran del formulario, esta prueba avisa de que
    // hay que darles el mismo trato que a la de arriba.
    $this->actingAs(User::factory()->create(), 'sanctum');
    $checklist = checklistConRevisionBase(false);
    $checklist->update(['envia_informe_diario' => true, 'envia_resumen_semanal' => true]);

    $this->putJson("/api/CheckListTurno/{$checklist->id}", edicionSinLaCasillaRetirada())
        ->assertSuccessful();

    expect($checklist->fresh()->envia_informe_diario)->toBeFalse();
    expect($checklist->fresh()->envia_resumen_semanal)->toBeFalse();
});

test('un checklist NUEVO nace con la casilla retirada en falso', function () {
    // El alta sigue con `?? false` a proposito: en un registro nuevo no hay nada que conservar,
    // y como la casilla ya no se dibuja, el formulario nunca la manda.
    $this->actingAs(User::factory()->create(), 'sanctum');

    $id = $this->postJson('/api/CheckListTurno', [
        'nombreEmpleado' => 'Empleado Nuevo',
        'fecha' => now()->toDateString(),
    ])->assertSuccessful()->json('data.id');

    $creado = $id ? ChecklistTurno::find($id) : ChecklistTurno::latest('id')->first();

    expect($creado->revision_base_operaciones)->toBeFalse();
});
