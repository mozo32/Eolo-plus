<?php

use App\Models\FactPrefactura;
use App\Models\FactServicio;

/**
 * Al guardar la salida, las cantidades de estancia salen del reloj. La regla se
 * midió contra 2803 folios históricos y acierta en el 86,1%; el 13,9% restante es
 * cortesía del operador o acuerdos a tanto alzado, y por eso las cantidades siguen
 * siendo EDITABLES después.
 */
function cabecera(FactPrefactura $p, array $extra = []): array
{
    return array_merge([
        'aeronave_id' => $p->aeronave_id,
        'cliente_id' => null,
        'llegada_at' => '2026-10-15 12:00:00',
        'salida_at' => null,
        'origen' => 'MMTO',
        'destino' => null,
        'tipo_destino' => FactPrefactura::DESTINO_NACIONAL,
    ], $extra);
}

function cantidadDe(FactPrefactura $p, string $concepto): int
{
    return (int) $p->renglones()
        ->whereHas('servicio', fn ($q) => $q->where('concepto', $concepto))
        ->sum('cantidad');
}

test('guardar la salida calcula las cantidades de estancia', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = conEstancia();

    $this->putJson("/api/facturacion/prefacturas/{$p->id}", cabecera($p, ['salida_at' => '2026-10-22 20:15:00']))
        ->assertOk();

    // 7 dias y 8:15 -> 7 pernoctas y 1 transito de 12 h.
    expect(cantidadDe($p->fresh(), FactServicio::CONCEPTO_ESTANCIA_PERNOCTA))->toBe(7)
        ->and(cantidadDe($p->fresh(), FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H))->toBe(1)
        ->and(cantidadDe($p->fresh(), FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H))->toBe(0);
});

test('guardar SIN salida no toca la estancia: la aeronave sigue en tierra', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = conEstancia();

    $this->putJson("/api/facturacion/prefacturas/{$p->id}", cabecera($p))->assertOk();

    expect($p->fresh()->renglones()->count())->toBe(0);
});

test('guardar por otro motivo NO vuelve a calcular, y conserva la correccion a mano', function () {
    // Es la razón de que el disparo mire si la salida CAMBIA. Sin esto, el operador
    // pierde su corrección al tocar cualquier otro campo, y sin avisarle.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = conEstancia();

    $this->putJson("/api/facturacion/prefacturas/{$p->id}", cabecera($p, ['salida_at' => '2026-10-22 20:15:00']))->assertOk();
    expect(cantidadDe($p->fresh(), FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H))->toBe(1);

    // El operador corrige: era cortesía, se quita el tránsito.
    $p->fresh()->renglones()
        ->whereHas('servicio', fn ($q) => $q->where('concepto', FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H))
        ->update(['cantidad' => 0]);

    // Y luego guarda por otra cosa, con la MISMA salida.
    $this->putJson("/api/facturacion/prefacturas/{$p->id}", cabecera($p, ['salida_at' => '2026-10-22 20:15:00', 'origen' => 'KMIA']))->assertOk();

    expect(cantidadDe($p->fresh(), FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H))->toBe(0)
        ->and($p->fresh()->origen)->toBe('KMIA');
});

test('cambiar la salida SI vuelve a calcular', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = conEstancia();

    $this->putJson("/api/facturacion/prefacturas/{$p->id}", cabecera($p, ['salida_at' => '2026-10-22 12:00:00']))->assertOk();
    expect(cantidadDe($p->fresh(), FactServicio::CONCEPTO_ESTANCIA_PERNOCTA))->toBe(7);

    $this->putJson("/api/facturacion/prefacturas/{$p->id}", cabecera($p, ['salida_at' => '2026-10-23 12:00:00']))->assertOk();
    expect(cantidadDe($p->fresh(), FactServicio::CONCEPTO_ESTANCIA_PERNOCTA))->toBe(8);
});

test('las cantidades calculadas siguen siendo editables por el camino de siempre', function () {
    // No hay endpoint para editar la cantidad de UN renglón: las de estancia se corrigen
    // reenviando las cantidades por `PATCH /estancia`, que es el botón «Recalcular estancia».
    // Esa es la salida del 13,9% de casos que la regla no reproduce.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = conEstancia();

    $this->putJson("/api/facturacion/prefacturas/{$p->id}", cabecera($p, ['salida_at' => '2026-10-22 12:00:00']))->assertOk();
    expect(cantidadDe($p->fresh(), FactServicio::CONCEPTO_ESTANCIA_PERNOCTA))->toBe(7);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/estancia", [
        'pernoctas' => 3,
        'transitos_2h' => 0,
        'transitos_12h' => 0,
    ])->assertOk();

    expect(cantidadDe($p->fresh(), FactServicio::CONCEPTO_ESTANCIA_PERNOCTA))->toBe(3);
});

test('si no hay servicio de estancia activo, la salida NO se guarda a medias', function () {
    // Mismo contrato que `PATCH /estancia`: 422 con su código, y la cabecera revertida
    // junto con el cobro. Guardar la salida sin poder cobrarla dejaría una prefactura
    // que parece completa y no lo es.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = conEstancia();
    FactServicio::porConcepto(FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->update(['status' => FactServicio::STATUS_INACTIVO]);

    $this->putJson("/api/facturacion/prefacturas/{$p->id}", cabecera($p, ['salida_at' => '2026-10-22 12:00:00']))
        ->assertUnprocessable()
        ->assertJsonPath('codigo', 'servicio_estancia_no_disponible');

    expect($p->fresh()->salida_at)->toBeNull()
        ->and($p->fresh()->renglones()->count())->toBe(0);
});
