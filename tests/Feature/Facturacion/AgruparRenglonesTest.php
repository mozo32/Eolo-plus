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
        $respuesta = $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => 'Servicios de rampa']);
        $respuesta->assertOk();
    }

    $fresca = $p->fresh();

    expect([$fresca->subtotal(), $fresca->iva(), $fresca->total()])->toBe($antes)
        ->and($fresca->renglones()->count())->toBe(2)
        ->and($a->fresh()->importe())->toBe('200.00')
        ->and($b->fresh()->importe())->toBe('50.00')
        // Sin esto un endpoint que no hiciera nada también dejaría el dinero igual.
        ->and([$a->fresh()->grupo, $b->fresh()->grupo])->toBe(['Servicios de rampa', 'Servicios de rampa'])
        // La respuesta es la ficha ya con el cambio: trae la etiqueta y el mismo dinero.
        ->and(collect($respuesta->json('prefactura.renglones'))->pluck('grupo', 'id')->all())
        ->toBe([$a->id => 'Servicios de rampa', $b->id => 'Servicios de rampa'])
        ->and([$respuesta->json('prefactura.subtotal'), $respuesta->json('prefactura.iva'), $respuesta->json('prefactura.total')])
        ->toBe($antes);
});

test('desagrupar tampoco cambia el dinero, y NO pierde el margen', function () {
    // El desagrupar viejo restauraba `precio_u * cantidad`, que ignora el margen y el
    // ajuste. Aqui no hay nada que restaurar, asi que no hay nada que perder.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 1, margen: 20.0);
    $importeOriginal = $renglon->importe();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => 'Maniobras'])->assertOk();
    $respuesta = $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => null]);
    $respuesta->assertOk();

    expect($renglon->fresh()->importe())->toBe($importeOriginal)
        ->and($importeOriginal)->toBe('120.00')
        ->and($renglon->fresh()->grupo)->toBeNull()
        ->and($respuesta->json('prefactura.renglones.0.grupo'))->toBeNull()
        ->and($respuesta->json('prefactura.renglones.0.importe'))->toBe('120.00');
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

test('una etiqueta vacia o de solo espacios DESAGRUPA, no se rechaza', function () {
    // `ConvertEmptyStringsToNull` convierte la cadena vacia en `null` en TODA la aplicacion
    // (y `TrimStrings` deja '   ' vacia antes), asi que en blanco llega como `null`, que es
    // el contrato para desagrupar. La pantalla es la que debe exigir una etiqueta no vacia
    // al agrupar; hacer una excepcion global para que este endpoint distinga '' de `null`
    // no vale lo que cuesta.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 1);

    foreach (['', '   '] as $enBlanco) {
        $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => 'Rampa'])->assertOk();
        expect($renglon->fresh()->grupo)->toBe('Rampa');

        $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => $enBlanco])->assertOk();

        expect($renglon->fresh()->grupo)->toBeNull();
    }
});

test('la etiqueta se recorta: con y sin espacios es el MISMO grupo', function () {
    // La etiqueta ES la identidad del grupo. Si ' Rampa ' no se recortara, quedaria distinta
    // de 'Rampa' y el documento imprimiria dos filas donde el operador quiso una.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $a = renglonDe($p, 100.0, 1);
    $b = renglonDe($p, 50.0, 1);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$a->id}/grupo", ['grupo' => ' Rampa '])->assertOk();
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$b->id}/grupo", ['grupo' => 'Rampa'])->assertOk();

    expect([$a->fresh()->grupo, $b->fresh()->grupo])->toBe(['Rampa', 'Rampa']);
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

test('el documento imprime UNA fila por grupo, con la etiqueta y la suma', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(1000.0, 1);
    $suelto = $p->renglones()->firstOrFail();   // el unico renglon que trae prefacturaCompleta
    $a = renglonDe($p, 100.0, 2);   // 200.00
    $b = renglonDe($p, 50.0, 1);    // 50.00
    $a->update(['grupo' => 'Servicios de rampa']);
    $b->update(['grupo' => 'Servicios de rampa']);
    $cerrada = cerrarConSello($p->fresh(), '1250.00', '200.00', '1450.00');

    $filas = null;
    View::composer('pdf.prefactura', function ($vista) use (&$filas) {
        $filas = $vista->getData()['filas'];
    });

    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertOk();

    $grupo = collect($filas)->firstWhere('concepto', 'Servicios de rampa');

    expect($grupo)->not->toBeNull()
        ->and($grupo['importe'])->toBe('250.00')
        ->and($grupo['precio'])->toBeNull()
        ->and($grupo['cantidad'])->toBeNull()
        ->and($grupo['remision'])->toBeNull()
        // Los dos renglones agrupados NO salen por su nombre.
        ->and(collect($filas)->pluck('concepto'))->not->toContain($a->nombre_servicio)
        ->and(collect($filas)->pluck('concepto'))->not->toContain($b->nombre_servicio)
        // Y el renglon sin agrupar si.
        ->and(collect($filas)->pluck('concepto'))->toContain($suelto->nombre_servicio)
        // Dos renglones agrupados y uno suelto: tres renglones, DOS filas.
        ->and($filas)->toHaveCount(2);
});

test('el grupo ocupa el lugar del orden MENOR de sus renglones', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $primero = renglonDe($p, 10.0, 1);
    $segundo = renglonDe($p, 20.0, 1);
    $tercero = renglonDe($p, 30.0, 1);
    $primero->update(['orden' => 1, 'nombre_servicio' => 'PRIMERO SUELTO']);
    $segundo->update(['orden' => 2, 'grupo' => 'EL GRUPO']);
    $tercero->update(['orden' => 3, 'nombre_servicio' => 'TERCERO SUELTO']);

    $filas = null;
    View::composer('pdf.prefactura', function ($vista) use (&$filas) {
        $filas = $vista->getData()['filas'];
    });

    $this->get("/api/facturacion/prefacturas/{$p->id}/cotizacion")->assertOk();

    expect(collect($filas)->pluck('concepto')->all())->toBe(['PRIMERO SUELTO', 'EL GRUPO', 'TERCERO SUELTO']);
});

test('el grupo con renglones antes y despues de uno suelto sale en el lugar del PRIMERO, y suma los dos', function () {
    // Con un solo renglon por grupo, «el lugar del primero» y «el lugar del ultimo» son el
    // mismo, y la prueba de arriba no los distingue. Aqui el grupo rodea a un renglon suelto.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $alInicio = renglonDe($p, 10.0, 1);
    $suelto = renglonDe($p, 20.0, 1);
    $alFinal = renglonDe($p, 30.0, 1);
    $ultimoSuelto = renglonDe($p, 40.0, 1);
    $alInicio->update(['orden' => 1, 'grupo' => 'EL GRUPO']);
    $suelto->update(['orden' => 2, 'nombre_servicio' => 'SUELTO UNO']);
    $alFinal->update(['orden' => 3, 'grupo' => 'EL GRUPO']);
    $ultimoSuelto->update(['orden' => 4, 'nombre_servicio' => 'SUELTO DOS']);

    $filas = null;
    View::composer('pdf.prefactura', function ($vista) use (&$filas) {
        $filas = $vista->getData()['filas'];
    });

    $this->get("/api/facturacion/prefacturas/{$p->id}/cotizacion")->assertOk();

    expect(collect($filas)->pluck('concepto')->all())->toBe(['EL GRUPO', 'SUELTO UNO', 'SUELTO DOS'])
        // El renglon que va DESPUES del suelto tambien cuenta para la suma.
        ->and($filas[0]['importe'])->toBe('40.00');
});

test('una cortesia dentro de un grupo contribuye cero a la suma', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $cobrado = renglonDe($p, 100.0, 1);
    $gratis = renglonDe($p, 300.0, 1);
    $cobrado->update(['grupo' => 'Rampa']);
    $gratis->update(['grupo' => 'Rampa', 'es_cortesia' => true]);

    $filas = null;
    View::composer('pdf.prefactura', function ($vista) use (&$filas) {
        $filas = $vista->getData()['filas'];
    });

    $this->get("/api/facturacion/prefacturas/{$p->id}/cotizacion")->assertOk();

    $grupo = collect($filas)->firstWhere('concepto', 'Rampa');

    expect($grupo['importe'])->toBe('100.00')
        // La marca describe un renglon, no una suma.
        ->and($grupo['cortesia'])->toBeFalse();
});

test('dos grupos distintos salen como dos filas', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1)->update(['grupo' => 'Rampa']);
    renglonDe($p, 200.0, 1)->update(['grupo' => 'Maniobras']);

    $filas = null;
    View::composer('pdf.prefactura', function ($vista) use (&$filas) {
        $filas = $vista->getData()['filas'];
    });

    $this->get("/api/facturacion/prefacturas/{$p->id}/cotizacion")->assertOk();

    expect(collect($filas)->pluck('concepto')->sort()->values()->all())->toBe(['Maniobras', 'Rampa'])
        ->and(collect($filas)->firstWhere('concepto', 'Rampa')['importe'])->toBe('100.00')
        ->and(collect($filas)->firstWhere('concepto', 'Maniobras')['importe'])->toBe('200.00');
});

test('la suma de las filas sigue cuadrando con el subtotal', function () {
    // La prueba que amarra el invariante al documento: agrupar no puede desviar el papel.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 2)->update(['grupo' => 'Rampa']);
    renglonDe($p, 50.0, 1)->update(['grupo' => 'Rampa']);
    renglonDe($p, 33.33, 3);

    $filas = null;
    View::composer('pdf.prefactura', function ($vista) use (&$filas) {
        $filas = $vista->getData()['filas'];
    });

    $this->get("/api/facturacion/prefacturas/{$p->id}/cotizacion")->assertOk();

    $suma = collect($filas)->reduce(fn ($acc, $f) => bcadd($acc, $f['importe'], 2), '0.00');

    expect($suma)->toBe($p->fresh()->subtotal());
});

test('dos grupos entrelazados salen en el orden de su primer renglon, cada uno con su suma', function () {
    // A, B, A, B: sin `sort()`, porque lo que se comprueba es justo el orden ENTRE grupos, y
    // con varios renglones por grupo, para que cada uno tenga su propia suma y su propio lugar.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    renglonDe($p, 10.0, 1)->update(['orden' => 1, 'grupo' => 'A']);
    renglonDe($p, 100.0, 1)->update(['orden' => 2, 'grupo' => 'B']);
    renglonDe($p, 20.0, 1)->update(['orden' => 3, 'grupo' => 'A']);
    renglonDe($p, 200.0, 1)->update(['orden' => 4, 'grupo' => 'B']);

    $filas = null;
    View::composer('pdf.prefactura', function ($vista) use (&$filas) {
        $filas = $vista->getData()['filas'];
    });

    $this->get("/api/facturacion/prefacturas/{$p->id}/cotizacion")->assertOk();

    expect(collect($filas)->pluck('concepto')->all())->toBe(['A', 'B'])
        ->and($filas[0]['importe'])->toBe('30.00')
        ->and($filas[1]['importe'])->toBe('300.00');
});

test('un grupo de puras cortesias sale en 0.00 y sin marca: es deliberado, no un defecto', function () {
    // DECIDIDO, no un error que arreglar: la marca «Cortesia» describe UN renglon y no una
    // suma, asi que la fila del grupo nunca la lleva; el total sigue correcto porque cada
    // cortesia ya valia 0.00 en el subtotal; y quien agrupa una cortesia es avisado en la
    // pantalla (Task 6). El cliente deja de ver que ese servicio fue gratis: es el precio
    // aceptado de agrupar.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1)->update(['grupo' => 'Regalos', 'es_cortesia' => true]);
    renglonDe($p, 300.0, 1)->update(['grupo' => 'Regalos', 'es_cortesia' => true]);

    $filas = null;
    View::composer('pdf.prefactura', function ($vista) use (&$filas) {
        $filas = $vista->getData()['filas'];
    });

    $this->get("/api/facturacion/prefacturas/{$p->id}/cotizacion")->assertOk();

    expect($filas)->toHaveCount(1)
        ->and($filas[0]['concepto'])->toBe('Regalos')
        ->and($filas[0]['importe'])->toBe('0.00')
        ->and($filas[0]['cortesia'])->toBeFalse()
        ->and($p->fresh()->subtotal())->toBe('0.00');
});
