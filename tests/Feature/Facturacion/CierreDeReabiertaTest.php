<?php

use App\Models\FactConfiguracion;
use App\Models\FactPrefactura;
use App\Services\CierrePrefactura;
use App\Services\ReaperturaPrefactura;

test('volver a cerrar una reabierta conserva el folio y NO avanza el contador', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $folio = $cerrada->folio;
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');

    app(ReaperturaPrefactura::class)->reabrir($cerrada, $usuario->id, 'Motivo suficiente.');

    $contadorAntes = FactConfiguracion::where('clave', CierrePrefactura::CLAVE_FOLIO)->value('valor');

    $recerrada = app(CierrePrefactura::class)->cerrar($cerrada->fresh(), $usuario->id);

    $contadorDespues = FactConfiguracion::where('clave', CierrePrefactura::CLAVE_FOLIO)->value('valor');

    expect($recerrada->folio)->toBe($folio)
        ->and($recerrada->estado)->toBe(FactPrefactura::ESTADO_CERRADA)
        ->and($contadorDespues)->toBe($contadorAntes)
        ->and($recerrada->total_sellado)->not->toBeNull();
});

test('el cierre de una reabierta sella las cifras NUEVAS, no las de la version', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $totalViejo = (string) $cerrada->total_sellado;

    app(ReaperturaPrefactura::class)->reabrir($cerrada, $usuario->id, 'Faltaba un servicio.');
    renglonDe($cerrada->fresh(), 250.0, 1);

    // El nuevo total (406.00) supera lo pagado (116.00): cierra sin cobro completo, confirmado.
    $recerrada = app(CierrePrefactura::class)->cerrar($cerrada->fresh(), $usuario->id, confirmarSinCobro: true);

    expect((string) $recerrada->total_sellado)->not->toBe($totalViejo)
        ->and((string) $recerrada->total_sellado)->toBe('406.00')
        ->and($recerrada->selloDiscrepa())->toBeFalse()
        ->and((string) $recerrada->versiones->sole()->total_sellado)->toBe($totalViejo);
});

test('un borrador normal sigue consumiendo un folio nuevo', function () {
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $contadorAntes = (int) FactConfiguracion::where('clave', CierrePrefactura::CLAVE_FOLIO)->value('valor');

    $borrador = prefacturaBorrador();
    renglonDe($borrador, 10.0, 1);
    completarParaCerrar($borrador);

    // Sin pagos, cierra sin cobro: confirmado, que es lo que no se ejercita aqui.
    $cerrada = app(CierrePrefactura::class)->cerrar($borrador->fresh(), $usuario->id, confirmarSinCobro: true);

    expect($cerrada->folio)->toBe($contadorAntes)
        ->and((int) FactConfiguracion::where('clave', CierrePrefactura::CLAVE_FOLIO)->value('valor'))
        ->toBe($contadorAntes + 1);
});

test('tres reaperturas dan tres versiones numeradas 1, 2 y 3, con el mismo folio y el contador quieto', function () {
    $prefactura = prefacturaCerradaParaDocumento();
    $folio = $prefactura->folio;
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $cierre = app(CierrePrefactura::class);
    $reapertura = app(ReaperturaPrefactura::class);

    $contadorAntes = FactConfiguracion::where('clave', CierrePrefactura::CLAVE_FOLIO)->value('valor');

    foreach (range(1, 3) as $vuelta) {
        $reapertura->reabrir($prefactura->fresh(), $usuario->id, "Correccion {$vuelta}.");
        $cierre->cerrar($prefactura->fresh(), $usuario->id);
    }

    expect($prefactura->fresh()->versiones->pluck('version')->all())->toBe([1, 2, 3])
        ->and($prefactura->fresh()->folio)->toBe($folio)
        ->and(FactConfiguracion::where('clave', CierrePrefactura::CLAVE_FOLIO)->value('valor'))->toBe($contadorAntes);
});

test('si la correccion BAJA el total y el cliente ya pago, queda sobrepago y no se inventa nada', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');

    app(ReaperturaPrefactura::class)->reabrir($cerrada, $usuario->id, 'Se cobro un servicio que no fue.');

    // Se quita el renglon caro (100.00) y queda uno barato: el total baja por debajo de lo ya
    // pagado (116.00).
    $viva = $cerrada->fresh();
    renglonDe($viva, 10.0, 1);
    $viva->renglones()->orderByDesc('precio_unitario')->first()->delete();

    // Un sobrepago NO pide confirmacion: solo la falta de cobro la pide. Se cierra sin ella.
    $recerrada = app(CierrePrefactura::class)->cerrar($viva->fresh(), $usuario->id);

    expect((string) $recerrada->total_sellado)->toBe('11.60')
        ->and($recerrada->sobrepago())->toBe('104.40')
        ->and($recerrada->selloDiscrepa())->toBeFalse();
});
