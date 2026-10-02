<?php

use App\Models\Bitacora;
use App\Models\FactPrefactura;
use App\Services\CierrePrefactura;
use Illuminate\Support\Facades\DB;

test('las tres notas se guardan y vuelven en la ficha', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/notas", [
        'nota_interna' => 'Cliente pidió factura a otro RFC',
        'nota_externa' => 'Servicio nocturno',
        'nota_factura' => 'Orden de compra 4471',
    ])->assertOk()
        ->assertJsonPath('prefactura.nota_interna', 'Cliente pidió factura a otro RFC')
        ->assertJsonPath('prefactura.nota_externa', 'Servicio nocturno')
        ->assertJsonPath('prefactura.nota_factura', 'Orden de compra 4471');

    // Y la ficha por GET trae las mismas, que es de donde las lee la pantalla.
    $this->getJson("/api/facturacion/prefacturas/{$p->id}")
        ->assertJsonPath('prefactura.nota_externa', 'Servicio nocturno');
});

test('una nota se puede vaciar', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $p->update(['nota_externa' => 'algo']);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/notas", ['nota_externa' => null])
        ->assertOk()
        ->assertJsonPath('prefactura.nota_externa', null);
});

test('guardar una sola nota no toca las otras dos: clave ausente no es clave vacia', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $p->update(['nota_interna' => 'interna', 'nota_externa' => 'externa', 'nota_factura' => 'factura']);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/notas", ['nota_externa' => 'cambiada'])->assertOk();

    expect($p->fresh()->only(['nota_interna', 'nota_externa', 'nota_factura']))
        ->toBe(['nota_interna' => 'interna', 'nota_externa' => 'cambiada', 'nota_factura' => 'factura']);
});

test('los largos son los del origen: 200, 200 y 100', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $ruta = "/api/facturacion/prefacturas/{$p->id}/notas";

    $this->patchJson($ruta, ['nota_interna' => str_repeat('a', 201)])->assertStatus(422)->assertJsonValidationErrors(['nota_interna']);
    $this->patchJson($ruta, ['nota_externa' => str_repeat('a', 201)])->assertStatus(422)->assertJsonValidationErrors(['nota_externa']);
    $this->patchJson($ruta, ['nota_factura' => str_repeat('a', 101)])->assertStatus(422)->assertJsonValidationErrors(['nota_factura']);

    $this->patchJson($ruta, ['nota_interna' => str_repeat('a', 200), 'nota_factura' => str_repeat('a', 100)])->assertOk();
});

test('las notas quedan en la bitacora con lo anterior y lo nuevo', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $p->update(['nota_externa' => 'antes']);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/notas", ['nota_externa' => 'despues'])->assertOk();

    $registro = Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)->where('accion', Bitacora::ACCION_ACTUALIZAR)->sole();

    expect($registro->datos_anteriores)->toContain('antes')
        ->and($registro->datos_nuevos)->toContain('despues');
});

test('si la bitacora falla, la nota no se guarda', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    Bitacora::creating(fn () => throw new RuntimeException('bitacora caida'));

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/notas", ['nota_externa' => 'no debe quedar'])->assertStatus(500);

    expect($p->fresh()->nota_externa)->toBeNull();
});

test('una prefactura cerrada no admite cambiar las notas', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    cerrarConSello($p, '100.00', '16.00', '116.00');

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/notas", ['nota_externa' => 'tarde'])
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_cerrada');

    expect($p->fresh()->nota_externa)->toBeNull();
});

test('un borrador descartado no admite cambiar las notas', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $p->update(['status' => FactPrefactura::STATUS_INACTIVO]);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/notas", ['nota_externa' => 'tarde'])
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_descartada');

    expect($p->fresh()->nota_externa)->toBeNull();
});

test('si se cierra entre el chequeo rapido y el candado, las notas no se cambian', function () {
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $this->actingAs($usuario);
    [$p] = prefacturaCompleta(100.0, 1);

    // Otra sesion cierra DESPUES de que el controlador leyo la prefactura (aun borrador).
    $hecho = false;
    DB::listen(function ($consulta) use ($p, $usuario, &$hecho) {
        if (! $hecho && str_contains($consulta->sql, 'from "fact_prefacturas"')) {
            $hecho = true;
            app(CierrePrefactura::class)->cerrar($p->fresh(), $usuario->id, confirmarSinCobro: true);
        }
    });
    $bitacoraAntes = Bitacora::count();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/notas", ['nota_externa' => 'tarde'])
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_cerrada');

    // La unica entrada nueva es la del cierre de la otra sesion: la de las notas no existe.
    expect($p->fresh()->estaCerrada())->toBeTrue()
        ->and($p->fresh()->nota_externa)->toBeNull()
        ->and(Bitacora::count() - $bitacoraAntes)->toBe(1);
});

test('si se descarta entre el chequeo rapido y el candado, las notas no se cambian', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();

    $hecho = false;
    DB::listen(function ($consulta) use ($p, &$hecho) {
        if (! $hecho && str_contains($consulta->sql, 'from "fact_prefacturas"')) {
            $hecho = true;
            DB::table('fact_prefacturas')->where('id', $p->id)->update(['status' => FactPrefactura::STATUS_INACTIVO]);
        }
    });

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/notas", ['nota_externa' => 'tarde'])
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_descartada');

    expect($p->fresh()->nota_externa)->toBeNull()
        ->and(Bitacora::count())->toBe(0);
});

test('sin el subdepartamento no se pueden cambiar las notas', function () {
    $this->actingAs(usuarioSinAcceso());
    $p = prefacturaBorrador();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/notas", ['nota_externa' => 'x'])->assertForbidden();

    expect($p->fresh()->nota_externa)->toBeNull();
});
