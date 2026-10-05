<?php

use App\Models\Bitacora;
use App\Models\FactPrefactura;

test('agrupar NO cambia el dinero de la prefactura', function () {
    // El invariante central del bloque. En el sistema viejo agrupar ponia los importes en
    // cero y creaba un renglon «Otros» con la suma; el folio 932 del historico perdio
    // 14,344.00 porque los puso en cero y el «Otros» nunca se creo.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $a = renglonDe($p, 100.0, 2);
    $b = renglonDe($p, 50.0, 1);

    $antes = [$p->subtotal(), $p->iva(), $p->total()];

    foreach ([$a, $b] as $renglon) {
        $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => 'Servicios de rampa'])
            ->assertOk();
    }

    $fresca = $p->fresh();

    expect([$fresca->subtotal(), $fresca->iva(), $fresca->total()])->toBe($antes)
        ->and($fresca->renglones()->count())->toBe(2)
        ->and($a->fresh()->importe())->toBe('200.00')
        ->and($b->fresh()->importe())->toBe('50.00')
        // Sin esto un endpoint que no hiciera nada también dejaría el dinero igual.
        ->and([$a->fresh()->grupo, $b->fresh()->grupo])->toBe(['Servicios de rampa', 'Servicios de rampa']);
});

test('desagrupar tampoco cambia el dinero, y NO pierde el margen', function () {
    // El desagrupar viejo restauraba `precio_u * cantidad`, que ignora el margen y el
    // ajuste. Aqui no hay nada que restaurar, asi que no hay nada que perder.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 1, margen: 20.0);
    $importeOriginal = $renglon->importe();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => 'Maniobras'])->assertOk();
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => null])->assertOk();

    expect($renglon->fresh()->importe())->toBe($importeOriginal)
        ->and($importeOriginal)->toBe('120.00')
        ->and($renglon->fresh()->grupo)->toBeNull();
});

test('agrupar queda en la bitacora, con la etiqueta', function () {
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $this->actingAs($usuario);
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 1);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => 'Servicios de rampa'])->assertOk();

    $registro = Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)
        ->where('accion', Bitacora::ACCION_ACTUALIZAR)
        ->latest('id')->first();

    expect($registro->descripcion)->toContain('Servicios de rampa')
        ->and($registro->descripcion)->toContain($renglon->nombre_servicio)
        ->and($registro->registro_id)->toBe($p->id);
});

test('desagrupar queda en la bitacora y dice que se desagrupo y de que grupo salia', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 1);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => 'Servicios de rampa'])->assertOk();
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => null])->assertOk();

    $registro = Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)
        ->where('accion', Bitacora::ACCION_ACTUALIZAR)
        ->latest('id')->first();

    expect($registro->descripcion)->toContain('desagrupó')
        ->and($registro->descripcion)->toContain('Servicios de rampa')
        ->and($registro->descripcion)->toContain($renglon->nombre_servicio)
        ->and($renglon->fresh()->grupo)->toBeNull();
});

test('poner la misma etiqueta dos veces no escribe de nuevo', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 1);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => 'Rampa'])->assertOk();
    $cuantas = Bitacora::where('accion', Bitacora::ACCION_ACTUALIZAR)->count();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => 'Rampa'])->assertOk();

    expect(Bitacora::where('accion', Bitacora::ACCION_ACTUALIZAR)->count())->toBe($cuantas)
        ->and($renglon->fresh()->grupo)->toBe('Rampa');
});

test('desagrupar un renglon que no estaba agrupado no escribe nada', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 1);
    $antes = Bitacora::where('accion', Bitacora::ACCION_ACTUALIZAR)->count();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => null])->assertOk();

    expect(Bitacora::where('accion', Bitacora::ACCION_ACTUALIZAR)->count())->toBe($antes);
});

test('una etiqueta vacia o de solo espacios se rechaza, y NO desagrupa en silencio', function () {
    // Sin la excepcion de `ConvertEmptyStringsToNull` en bootstrap/app.php, '' llegaria como
    // `null` y desagruparia con un 200: por eso se parte de un renglon YA agrupado y se
    // comprueba que sigue en su grupo.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 1);
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => 'Rampa'])->assertOk();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => ''])
        ->assertStatus(422)->assertJsonValidationErrorFor('grupo');

    // Un texto de solo espacios: `TrimStrings` lo deja vacio antes de validar.
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => '   '])
        ->assertStatus(422)->assertJsonValidationErrorFor('grupo');

    expect($renglon->fresh()->grupo)->toBe('Rampa');
});

test('sin el campo grupo se rechaza: omitirlo no es lo mismo que desagrupar', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 1);
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => 'Rampa'])->assertOk();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", [])
        ->assertStatus(422)->assertJsonValidationErrorFor('grupo');

    expect($renglon->fresh()->grupo)->toBe('Rampa');
});

test('una etiqueta de mas de 60 caracteres se rechaza', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 1);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => str_repeat('a', 61)])
        ->assertStatus(422)->assertJsonValidationErrorFor('grupo');

    // El limite: 60 si, 61 no.
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => str_repeat('a', 60)])
        ->assertOk();
});

test('no se agrupa en una prefactura cerrada: el documento tiene que poder reimprimirse igual', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    $renglon = $p->renglones()->sole();
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    $this->patchJson("/api/facturacion/prefacturas/{$cerrada->id}/renglones/{$renglon->id}/grupo", ['grupo' => 'Rampa'])
        ->assertStatus(409)->assertJsonPath('codigo', 'ya_cerrada');

    expect($renglon->fresh()->grupo)->toBeNull();
});

test('no se agrupa en una descartada', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 1);
    $p->update(['status' => FactPrefactura::STATUS_INACTIVO]);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => 'Rampa'])
        ->assertStatus(409)->assertJsonPath('codigo', 'ya_descartada');

    expect($renglon->fresh()->grupo)->toBeNull();
});

test('un renglon de OTRA prefactura da 404', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $propia = prefacturaBorrador();
    $ajena = prefacturaBorrador();
    $renglonAjeno = renglonDe($ajena, 100.0, 1);

    $this->patchJson("/api/facturacion/prefacturas/{$propia->id}/renglones/{$renglonAjeno->id}/grupo", ['grupo' => 'Rampa'])
        ->assertNotFound();

    expect($renglonAjeno->fresh()->grupo)->toBeNull();
});

test('sin el subdepartamento no se agrupa', function () {
    $this->actingAs(usuarioSinAcceso());
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 1);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => 'Rampa'])
        ->assertForbidden();
});
