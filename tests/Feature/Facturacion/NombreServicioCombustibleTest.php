<?php

use App\Models\FactPrecioCombustible;
use App\Models\FactServicio;

/*
 * El precio del servicio de combustible se sincroniza con el precio Eolo
 * buscándolo POR SU NOMBRE, porque al importar no queda un id estable que apuntar
 * (el sistema viejo usa un id fijo, `WHERE id_servicio='7'`). Ese vínculo es
 * invisible desde la pantalla de servicios, donde el nombre es un campo editable
 * como cualquier otro, así que aquí se prueba la guarda que impide romperlo.
 *
 * Lo que hace grave el fallo es que es SILENCIOSO: renombrar el servicio no
 * produce ningún error, la sincronía simplemente no encuentra la fila y no
 * actualiza nada. El combustible se seguiría cobrando al precio anterior mientras
 * la pantalla de precios muestra el nuevo.
 */

/** El cuerpo mínimo que aceptan el alta y la edición de un servicio. */
function cuerpoServicioCombustible(array $extra = []): array
{
    return array_merge([
        'categoria_servicio_id' => null,
        'nombre' => FactPrecioCombustible::SERVICIO_COMBUSTIBLE,
        'precio_unitario' => 26.064,
        'es_de_tercero' => false,
        'margen' => 0,
        'ajuste_precio' => FactServicio::AJUSTE_NINGUNO,
    ], $extra);
}

function servicioDeCombustible(array $extra = []): FactServicio
{
    return FactServicio::create(array_merge([
        'nombre' => FactPrecioCombustible::SERVICIO_COMBUSTIBLE,
        'precio_unitario' => 26.064,
    ], $extra));
}

test('el servicio de combustible no se puede renombrar', function () {
    $this->actingAs(usuarioConSubdepartamento('factServicios', 'Facturacion'));
    $servicio = servicioDeCombustible();

    $this->putJson("/api/facturacion/servicios/{$servicio->id}", cuerpoServicioCombustible([
        'nombre' => 'Combustible Jet',
    ]))
        ->assertStatus(422)
        ->assertJsonValidationErrors(['nombre']);

    expect($servicio->fresh()->nombre)->toBe(FactPrecioCombustible::SERVICIO_COMBUSTIBLE);
});

test('el mensaje explica por que no se puede renombrar, no solo que no se puede', function () {
    $this->actingAs(usuarioConSubdepartamento('factServicios', 'Facturacion'));
    $servicio = servicioDeCombustible();

    $mensaje = $this->putJson("/api/facturacion/servicios/{$servicio->id}", cuerpoServicioCombustible([
        'nombre' => 'Otro nombre',
    ]))->assertStatus(422)->json('errors.nombre.0');

    expect($mensaje)->toContain('precio del combustible');
});

test('los demas campos del servicio de combustible si se pueden editar', function () {
    $this->actingAs(usuarioConSubdepartamento('factServicios', 'Facturacion'));
    $servicio = servicioDeCombustible();

    $this->putJson("/api/facturacion/servicios/{$servicio->id}", cuerpoServicioCombustible([
        'precio_unitario' => 30.5,
        'ajuste_precio' => FactServicio::AJUSTE_MAS_5,
    ]))->assertOk();

    $recargado = $servicio->fresh();

    expect((float) $recargado->precio_unitario)->toBe(30.5)
        ->and($recargado->ajuste_precio)->toBe(FactServicio::AJUSTE_MAS_5)
        ->and($recargado->nombre)->toBe(FactPrecioCombustible::SERVICIO_COMBUSTIBLE);
});

test('la guarda no estorba al renombrar cualquier otro servicio', function () {
    $this->actingAs(usuarioConSubdepartamento('factServicios', 'Facturacion'));
    $otro = FactServicio::create(['nombre' => 'Pernocta', 'precio_unitario' => 100]);

    $this->putJson("/api/facturacion/servicios/{$otro->id}", cuerpoServicioCombustible([
        'nombre' => 'Pernocta nocturna',
        'precio_unitario' => 100,
    ]))->assertOk();

    expect($otro->fresh()->nombre)->toBe('Pernocta nocturna');
});

/*
 * La guarda compara sin caja, como lo hace MySQL con la collation de la columna
 * (`utf8mb4_unicode_ci`). Sin esa comparación, una fila guardada como
 * 'combustible jet a-1' quedaría fuera de la guarda pero DENTRO de lo que la
 * sincronía actualiza en MySQL: protegida de menos, que es el lado equivocado.
 *
 * LIMITACION: en sqlite la sincronía compara binario, así que esta prueba
 * demuestra la guarda, no la equivalencia con MySQL. Lo que fija es que la guarda
 * nunca proteja menos filas que la collation del servidor.
 */
test('la guarda no se burla cambiando la caja del nombre', function () {
    $this->actingAs(usuarioConSubdepartamento('factServicios', 'Facturacion'));
    $servicio = servicioDeCombustible(['nombre' => 'combustible jet a-1']);

    $this->putJson("/api/facturacion/servicios/{$servicio->id}", cuerpoServicioCombustible([
        'nombre' => 'Combustible',
    ]))->assertStatus(422)->assertJsonValidationErrors(['nombre']);
});

test('cambiarle solo la caja al nombre no cuenta como renombrarlo', function () {
    $this->actingAs(usuarioConSubdepartamento('factServicios', 'Facturacion'));
    $servicio = servicioDeCombustible();

    $this->putJson("/api/facturacion/servicios/{$servicio->id}", cuerpoServicioCombustible([
        'nombre' => 'COMBUSTIBLE JET A-1',
    ]))->assertOk();
});

/*
 * Reenviar el MISMO nombre con espacios de sobra no es renombrar, y rechazarlo
 * seria bloquear una edicion legitima.
 *
 * LIMITACION, comprobada por mutacion: esta prueba NO demuestra el `trim` de la
 * guarda, porque el middleware `TrimStrings` de Laravel ya recorto la entrada
 * antes de que la guarda la vea; quitando el trim, la prueba sigue pasando. Lo
 * que fija es esa interaccion con el middleware, que es lo que de verdad hace que
 * el caso funcione. El trim de la guarda cubre el otro lado, el nombre GUARDADO,
 * y ahi la garantia real es la normalizacion del importador.
 */
test('reenviar el mismo nombre con espacios de sobra no cuenta como renombrarlo', function () {
    $this->actingAs(usuarioConSubdepartamento('factServicios', 'Facturacion'));
    $servicio = servicioDeCombustible();

    $this->putJson("/api/facturacion/servicios/{$servicio->id}", cuerpoServicioCombustible([
        'nombre' => '  '.FactPrecioCombustible::SERVICIO_COMBUSTIBLE.'  ',
    ]))->assertOk();
});

test('editar un servicio que no existe sigue dando 404, no 422 por la guarda', function () {
    $this->actingAs(usuarioConSubdepartamento('factServicios', 'Facturacion'));

    $this->putJson('/api/facturacion/servicios/999999', cuerpoServicioCombustible())
        ->assertNotFound();
});
