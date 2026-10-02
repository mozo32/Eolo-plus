<?php
// tests/Feature/Facturacion/CompararPagosTest.php

use App\Models\FactPrefacturaPago;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

/*
 * `TestCase` apunta la conexión `remota` a un destino inválido para que ninguna prueba toque la
 * base real; aquí se reemplaza por sqlite en memoria, y hace falta `DB::purge` porque si no
 * Laravel devuelve la conexión ya resuelta con la configuración inválida.
 *
 * Los ayudantes NO se llaman `legacyPref` ni `legacyVenta`: `CompararPrefacturasTest.php` ya
 * declara esos nombres, y una función declarada en un archivo de prueba es GLOBAL al cargarse.
 */
beforeEach(function () {
    config(['database.connections.remota' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
    DB::purge('remota');

    $esquema = DB::connection('remota')->getSchemaBuilder();

    $esquema->create('tb_hprefactura', function ($t) {
        $t->integer('id_prefactura', true);
        $t->integer('fol_prefactura');
        $t->decimal('subtotal', 18, 2);
        $t->float('iva');
        $t->decimal('Total', 18, 2);
        $t->decimal('Cambio', 18, 2)->default(0);
    });

    $esquema->create('tb_venta', function ($t) {
        $t->integer('id_venta', true);
        $t->integer('fol_prefactura');
        $t->integer('id_servicio');
        $t->float('precio_u');
        $t->decimal('importe', 18, 2);
        $t->integer('cantidad');
        $t->string('remision')->default('');
    });

    $esquema->create('tb_formas_pago', function ($t) {
        $t->integer('id_forma_pago', true);
        $t->integer('id_tipo_formas');
        $t->integer('fol_prefactura');
        $t->float('monto');
    });

    $esquema->create('tb_tip_fpago', function ($t) {
        $t->integer('id_tipo_formas', true);
        $t->string('tipo_forma');
    });

    // Las formas que el comando nombra en su salida. Los ids son los del origen.
    DB::connection('remota')->table('tb_tip_fpago')->insert([
        ['id_tipo_formas' => 1, 'tipo_forma' => 'Visa'],
        ['id_tipo_formas' => 3, 'tipo_forma' => 'Amex'],
        ['id_tipo_formas' => 4, 'tipo_forma' => 'Efectivo'],
    ]);
});

/** Un encabezado histórico. `$cambio` es el `Cambio` guardado, que se sabe poco fiable. */
function origenPrefactura(int $folio, float $subtotal, float $total, float $cambio = 0.0): void
{
    DB::connection('remota')->table('tb_hprefactura')->insert([
        'fol_prefactura' => $folio, 'subtotal' => $subtotal, 'iva' => $total - $subtotal,
        'Total' => $total, 'Cambio' => $cambio,
    ]);
}

function origenRenglon(int $folio, int $servicio, float $precio, float $importe, string $remision = '', int $cantidad = 1): void
{
    DB::connection('remota')->table('tb_venta')->insert([
        'fol_prefactura' => $folio, 'id_servicio' => $servicio, 'precio_u' => $precio,
        'importe' => $importe, 'cantidad' => $cantidad, 'remision' => $remision,
    ]);
}

function origenPago(int $folio, int $tipo, float $monto): void
{
    DB::connection('remota')->table('tb_formas_pago')->insert([
        'id_tipo_formas' => $tipo, 'fol_prefactura' => $folio, 'monto' => $monto,
    ]);
}

/** Un folio Amex con la comision que SI sigue la formula: 1000 bruto da 48.80. */
function origenAmexQueCuadra(int $folio): void
{
    origenPrefactura($folio, 1048.80, 1216.61);
    origenRenglon($folio, 50, 1000.00, 1000.00);
    origenRenglon($folio, 100, 48.80, 48.80);
    origenPago($folio, 3, 1000.00);
}

/**
 * Un folio Amex pagado COMPLETO y nominal: partida 813.27, comision 48.80, total 1000.00, que es lo
 * que el operador teclea. La formula sola cuadra el total.
 */
function origenAmexNominal(int $folio): void
{
    origenPrefactura($folio, 862.07, 1000.00);
    origenRenglon($folio, 50, 813.27, 813.27);
    origenRenglon($folio, 100, 48.80, 48.80);
    origenPago($folio, 3, 1000.00);
}

/**
 * El folio 294 del historico: la formula da 1525.11 y el sistema viejo guardo 1525.12, que es la
 * que `comisionQueCuadra()` encuentra. El monto trae cuatro decimales, como los de Amex.
 */
function origenAmexQueSeAjusta(int $folio, float $guardada = 1525.12): void
{
    origenPrefactura($folio, 26943.69, 31254.68);
    origenRenglon($folio, 24, 700.00, 700.00);
    origenRenglon($folio, 7, 20042.57, 20042.57);
    origenRenglon($folio, 4, 4676.00, 4676.00);
    origenRenglon($folio, 100, $guardada, $guardada);
    origenPago($folio, 3, 31254.6804);
}

/** La salida completa del comando, para las pruebas que miran QUE LISTA sale en cual seccion. */
function salidaDeCompararPagos(array $opciones = []): string
{
    expect(Artisan::call('facturacion:comparar-pagos', $opciones))->toBe(0);

    // En Windows la salida trae CRLF: se normaliza para poder cortar por renglones en blanco.
    return str_replace("\r\n", "\n", Artisan::output());
}

/** Las lineas desde `$titulo` hasta el siguiente renglon en blanco: el titulo y su tabla. */
function seccionDeCompararPagos(string $salida, string $titulo): string
{
    $inicio = strpos($salida, $titulo);
    expect($inicio)->not->toBeFalse("no salio la seccion '{$titulo}'");

    $fin = strpos($salida, "\n\n", $inicio);

    return substr($salida, $inicio, $fin === false ? null : $fin - $inicio);
}

test('toda sentencia que el comando emite, en cualquier conexion, es una lectura', function () {
    origenAmexQueCuadra(1);
    origenPrefactura(2, 100.00, 116.00, 50.00);
    origenPago(2, 4, 200.00);
    origenRenglon(2, 50, 100.00, 0.00, 'cortesia');

    $sentencias = [];
    DB::listen(function ($consulta) use (&$sentencias) {
        $sentencias[] = [$consulta->connectionName, $consulta->sql];
    });

    $this->artisan('facturacion:comparar-pagos')->assertExitCode(0);

    expect($sentencias)->not->toBeEmpty();
    foreach ($sentencias as [$conexion, $sql]) {
        expect($conexion)->toBe('remota')
            ->and(ltrim($sql))->toStartWith('select');
    }
});

test('el comando no borra ni cambia nada en la base legada', function () {
    origenAmexQueCuadra(1);
    origenPago(1, 1, 216.61);

    $this->artisan('facturacion:comparar-pagos')->assertExitCode(0);

    expect(DB::connection('remota')->table('tb_formas_pago')->count())->toBe(2)
        ->and(DB::connection('remota')->table('tb_venta')->count())->toBe(2)
        ->and(DB::connection('remota')->table('tb_hprefactura')->count())->toBe(1)
        ->and(FactPrefacturaPago::count())->toBe(0);
});

test('con alcance acotado tambien solo lee, y sigue sin tocar la base nueva', function () {
    origenAmexQueCuadra(1);
    origenAmexQueCuadra(2);

    $sentencias = [];
    DB::listen(function ($consulta) use (&$sentencias) {
        $sentencias[] = [$consulta->connectionName, $consulta->sql];
    });

    $this->artisan('facturacion:comparar-pagos', ['--folio' => 1])->assertExitCode(0);
    $this->artisan('facturacion:comparar-pagos', ['--limite' => 1])->assertExitCode(0);

    foreach ($sentencias as [$conexion, $sql]) {
        expect($conexion)->toBe('remota')->and(ltrim($sql))->toStartWith('select');
    }
});

// ---- Los pagos ------------------------------------------------------------------------

test('un monto con mas de dos decimales se reporta como redondeo al importar y suma su diferencia', function () {
    // 105.2816 es real: es el bruto que Amex cargo. Pasarlo a decimal(12,2) pierde centesimas.
    origenPrefactura(1, 105.28, 122.12);
    origenRenglon(1, 50, 100.00, 100.00);
    origenPago(1, 3, 105.2816);   // baja a 105.28: -0.0016
    origenPago(2, 3, 647.9992);   // SUBE a 648.00: +0.0008 (un truncamiento daria 647.99)

    $this->artisan('facturacion:comparar-pagos')
        ->expectsOutputToContain('Pagos que se redondean al importar: 2')
        ->expectsOutputToContain('con cuatro decimales: 2')
        ->expectsOutputToContain('Pagos que caben en decimal(12,2) sin perder centavos: 0')
        ->expectsOutputToContain('diferencia que suma el redondeo, importado menos origen: -0.0008 (en valor absoluto: 0.0024)')
        ->assertExitCode(0);
});

test('un monto de dos decimales cabe tal cual aunque el DOUBLE traiga ruido binario', function () {
    origenPrefactura(1, 100.00, 116.00);
    origenPago(1, 1, 0.1 + 0.2 + 115.7);   // 116.00000000000001 en binario

    $this->artisan('facturacion:comparar-pagos')
        ->expectsOutputToContain('Pagos que caben en decimal(12,2) sin perder centavos: 1')
        ->expectsOutputToContain('Pagos que se redondean al importar: 0')
        ->assertExitCode(0);
});

test('un pago en cero se cuenta aparte: cabe, pero no es un pago valido', function () {
    origenPrefactura(1, 100.00, 116.00);
    origenPago(1, 1, 0.0);
    origenPago(1, 4, 116.00);

    $this->artisan('facturacion:comparar-pagos')
        ->expectsOutputToContain('Pagos con monto en cero o negativo: 1')
        ->expectsOutputToContain('Pagos que caben en decimal(12,2) sin perder centavos: 2')
        ->assertExitCode(0);
});

test('un monto que rebasa decimal(12,2) se reporta como fuera de rango', function () {
    origenPrefactura(1, 100.00, 116.00);
    origenPago(1, 1, 99999999999.0);

    $this->artisan('facturacion:comparar-pagos')
        ->expectsOutputToContain('Pagos fuera del rango de decimal(12,2): 1')
        ->expectsOutputToContain('Pagos que caben en decimal(12,2) sin perder centavos: 0')
        ->assertExitCode(0);
});

test('la suma por folio se compara: dos pagos redondeados hacia abajo suman distinto que el origen', function () {
    // 10.0049 + 10.0049 = 20.0098, que el origen suma como 20.01; importados son 10.00 + 10.00.
    origenPrefactura(1, 20.00, 23.20);
    origenPago(1, 3, 10.0049);
    origenPago(1, 3, 10.0049);

    $salida = salidaDeCompararPagos();

    expect($salida)->toContain('Folios cuya suma de pagos importados no coincide con la del origen, al centavo: 1');
    expect(seccionDeCompararPagos($salida, 'Los folios cuya suma importada no coincide'))->toMatch('/\|\s*1\s*\|\s*20\.01\s*\|\s*20\.00\s*\|/');
});

test('los pagos de folios sin encabezado se cuentan aparte', function () {
    origenPrefactura(1, 100.00, 116.00);
    origenPago(1, 1, 116.00);
    origenPago(2061, 3, 500.00);   // sin encabezado en tb_hprefactura

    $this->artisan('facturacion:comparar-pagos')
        ->expectsOutputToContain('Pagos comparados: 2')
        ->expectsOutputToContain('Pagos de folios sin encabezado en tb_hprefactura: 1 (en 1 folios)')
        ->assertExitCode(0);
});

test('sin pagos en el origen el comando termina bien y lo dice', function () {
    origenPrefactura(1, 100.00, 116.00);
    origenRenglon(1, 50, 100.00, 100.00);

    $this->artisan('facturacion:comparar-pagos')
        ->expectsOutputToContain('Pagos comparados: 0')
        ->assertExitCode(0);
});

test('un folio repetido en el encabezado se compara por su ultima fila y se dice', function () {
    // El primer intento de imprimir dejo un encabezado con Total 100; el que si imprimio dice 116.
    // Con la primera fila el pago de 116 sobrepasaria; con la ultima, cuadra.
    origenPrefactura(5, 100.00, 100.00);
    origenPrefactura(5, 100.00, 116.00);
    origenPago(5, 1, 116.00);

    $this->artisan('facturacion:comparar-pagos')
        ->expectsOutputToContain('Folios con encabezado repetido: 1 (2 filas). De cada folio se toma la última fila')
        ->expectsOutputToContain('Sobrepagadas: 0')
        ->assertExitCode(0);
});

// ---- La comision Amex, en tres grupos ---------------------------------------------------

test('la comision se reporta en tres grupos con etiquetas distintas', function () {
    origenAmexQueCuadra(1);

    // Segunda rama de mpamex.php: comision = monto x 0.06, o sea 60.00 para 1000.
    origenPrefactura(2, 1060.00, 1229.60);
    origenRenglon(2, 50, 1000.00, 1000.00);
    origenRenglon(2, 100, 60.00, 60.00);
    origenPago(2, 3, 1000.00);

    // Irreconciliable: ninguna de las dos formulas da 7.77.
    origenPrefactura(3, 1007.77, 1169.01);
    origenRenglon(3, 50, 1000.00, 1000.00);
    origenRenglon(3, 100, 7.77, 7.77);
    origenPago(3, 3, 1000.00);

    $this->artisan('facturacion:comparar-pagos')
        ->expectsOutputToContain('Comisiones revisadas: 3')
        ->expectsOutputToContain('Comisión Amex, exactas al centavo: 1')
        ->expectsOutputToContain('Comisión Amex, segunda rama del sistema viejo (monto × 0.06): 1')
        ->expectsOutputToContain('Comisión Amex, no siguen ninguna fórmula: 1')
        ->expectsOutputToContain('Comisión Amex, no comparables: 0')
        ->assertExitCode(0);
});

test('los folios de los dos grupos que no cuadran se listan uno por uno, cada uno en el suyo', function () {
    origenPrefactura(77, 1060.00, 1229.60);
    origenRenglon(77, 50, 1000.00, 1000.00);
    origenRenglon(77, 100, 60.00, 60.00);
    origenPago(77, 3, 1000.00);

    origenPrefactura(88, 1007.77, 1169.01);
    origenRenglon(88, 50, 1000.00, 1000.00);
    origenRenglon(88, 100, 7.77, 7.77);
    origenPago(88, 3, 1000.00);

    // Uno que cuadra no se lista en ninguna.
    origenAmexQueCuadra(99);

    // El bloque 6 tiene que decidir que hace con ellos: un conteo no le sirve.
    $salida = salidaDeCompararPagos();

    $segundaRama = seccionDeCompararPagos($salida, 'Folios de la segunda rama del sistema viejo');
    expect($segundaRama)->toMatch('/\|\s*77\s*\|/')
        ->and($segundaRama)->not->toMatch('/\|\s*88\s*\|/')
        ->and($segundaRama)->not->toMatch('/\|\s*99\s*\|/');

    $ninguna = seccionDeCompararPagos($salida, 'Folios cuya comisión no sigue ninguna fórmula');
    expect($ninguna)->toMatch('/\|\s*88\s*\|\s*1000\.00\s*\|\s*7\.77\s*\|\s*48\.80\s*\|/')
        ->and($ninguna)->not->toMatch('/\|\s*77\s*\|/')
        ->and($ninguna)->not->toMatch('/\|\s*99\s*\|/');
});

test('una comision sin pago Amex, o con varios, no es comparable y se lista con su motivo', function () {
    // Comision sin ningun pago Amex.
    origenPrefactura(10, 1048.80, 1216.61);
    origenRenglon(10, 50, 1000.00, 1000.00);
    origenRenglon(10, 100, 48.80, 48.80);
    origenPago(10, 1, 1216.61);

    // Dos pagos Amex en el mismo folio.
    origenPrefactura(11, 1048.80, 1216.61);
    origenRenglon(11, 50, 1000.00, 1000.00);
    origenRenglon(11, 100, 48.80, 48.80);
    origenPago(11, 3, 600.00);
    origenPago(11, 3, 400.00);

    $salida = salidaDeCompararPagos();

    expect($salida)->toContain('Comisión Amex, no comparables: 2')
        ->and($salida)->toContain('Comisión Amex, comparables: 0')
        ->and($salida)->toContain('Comisión Amex, exactas al centavo: 0');

    $lista = seccionDeCompararPagos($salida, 'Comisiones que no se pueden comparar con un pago Amex');
    expect($lista)->toMatch('/\|\s*10\s*\|.*el folio no tiene pago Amex/')
        ->and($lista)->toMatch('/\|\s*11\s*\|.*el folio tiene más de un pago Amex/');
});

test('la comision se calcula con el monto importable, el que tendra el pago en decimal(12,2)', function () {
    // El folio 971 del historico: el pago de 23216.588 se importa como 23216.59. Con el monto
    // crudo la formula da 1132.88, que es lo guardado; con el importable da 1132.89. Lo que
    // cuenta es lo que el sistema nuevo va a tener en `fact_prefactura_pagos.monto`.
    origenPrefactura(971, 24000.00, 27840.00);
    origenRenglon(971, 24, 21500.00, 21500.00);
    origenRenglon(971, 100, 1132.88, 1132.88);
    origenPago(971, 3, 23216.588);

    $this->artisan('facturacion:comparar-pagos')
        ->expectsOutputToContain('Comisión Amex, exactas al centavo: 0')
        ->expectsOutputToContain('Comisión Amex, no siguen ninguna fórmula: 1')
        ->assertExitCode(0);
});

// ---- El ajuste de comisionQueCuadra() ---------------------------------------------------

test('el ajuste se cuenta aparte, con su desvio maximo, y se demuestra que coincide con la comision del sistema viejo', function () {
    origenAmexNominal(1);         // la formula sola cuadra el total
    origenAmexQueSeAjusta(294);   // formula 1525.11, ajustada y guardada 1525.12

    $salida = salidaDeCompararPagos();

    expect($salida)->toContain('Folios cuyo único pago es un Amex: 2')
        ->and($salida)->toContain('y partida mayor que cero (los que se comparan): 2')
        ->and($salida)->toContain('La fórmula sola cuadra el total, sin ajuste: 1')
        ->and($salida)->toContain('Comisiones que comisionQueCuadra() ajusta: 1')
        ->and($salida)->toContain('desvío máximo del ajuste respecto a la fórmula: 0.01')
        ->and($salida)->toContain('ajustadas que coinciden al centavo con la comisión guardada por el sistema viejo: 1')
        ->and($salida)->toContain('ajustadas que NO coinciden con la comisión guardada: 0')
        ->and($salida)->toContain('demostrar que el ajuste reproduce lo que cobró el sistema viejo, no para excusar una diferencia')
        // En el reporte de los tres grupos, el ajuste es una de las que no siguen la formula,
        // y dice que `comisionQueCuadra()` la reproduce.
        ->and($salida)->toContain('Comisión Amex, no siguen ninguna fórmula: 1')
        ->and($salida)->toContain('de ellas, las que comisionQueCuadra() reproduce al centavo: 1')
        ->and($salida)->toContain('de ellas, las que ningún ajuste reproduce: 0');

    expect(seccionDeCompararPagos($salida, 'Las comisiones ajustadas'))
        ->toMatch('/\|\s*294\s*\|\s*1525\.11\s*\|\s*1525\.12\s*\|\s*1525\.12\s*\|\s*0\.01\s*\|/');
});

test('un ajuste que NO coincide con la comision guardada sale en su propia linea y en su propia lista', function () {
    // El sistema viejo guardo 1525.13: la formula da 1525.11 y el ajuste, 1525.12.
    origenAmexQueSeAjusta(294, 1525.13);

    $salida = salidaDeCompararPagos();

    expect($salida)->toContain('Comisiones que comisionQueCuadra() ajusta: 1')
        ->and($salida)->toContain('ajustadas que coinciden al centavo con la comisión guardada por el sistema viejo: 0')
        ->and($salida)->toContain('ajustadas que NO coinciden con la comisión guardada: 1');

    expect(seccionDeCompararPagos($salida, 'Ajustes cuya comisión NO coincide'))
        ->toMatch('/\|\s*294\s*\|\s*1525\.11\s*\|\s*1525\.12\s*\|\s*1525\.13\s*\|\s*0\.01\s*\|/');
});

test('un folio sin candidato en la ventana se cuenta aparte, y el pago completo no se mezcla con los demas', function () {
    // El 200 del historico: pago COMPLETO (el total viejo cuadra con el monto) pero el operador
    // tecleo unos 34 pesos de menos. La formula da 752.06 y el viejo guardo 723.88.
    origenPrefactura(200, 13286.44, 15412.27);
    origenRenglon(200, 24, 12562.56, 12562.56);
    origenRenglon(200, 100, 723.88, 723.88);
    origenPago(200, 3, 15412.27);

    // El 587: un pago que NO es la prefactura completa. La comision guardada ES la de la formula.
    origenPrefactura(587, 33468.60, 38823.58);
    origenRenglon(587, 24, 31631.04, 31631.04);
    origenRenglon(587, 100, 1837.56, 1837.56);
    origenPago(587, 3, 37657.78);

    // El 2061: ni siquiera tiene encabezado, no hay total viejo contra el que comparar.
    origenRenglon(2061, 24, 1495.00, 1495.00);
    origenRenglon(2061, 100, 131.70, 131.70);
    origenPago(2061, 3, 2698.972);

    $salida = salidaDeCompararPagos();

    expect($salida)->toContain('Folios sin candidato en la ventana de ±5 centavos: 3')
        ->and($salida)->toContain('sin candidato, pago completo (el total viejo cuadra con el monto): 1')
        ->and($salida)->toContain('sin candidato, monto distinto del total viejo: 1')
        ->and($salida)->toContain('sin candidato, folio sin encabezado en tb_hprefactura: 1')
        ->and($salida)->toContain('sin candidato, con la comisión guardada distinta de la fórmula: 1');

    $lista = seccionDeCompararPagos($salida, 'Folios sin candidato: se quedan con la fórmula');
    // Con la formula, el 200 queda con 32.69 por cobrar.
    expect($lista)->toMatch('/\|\s*200\s*\|\s*15412\.27\s*\|\s*723\.88\s*\|\s*752\.06\s*\|\s*28\.18\s*\|\s*32\.69\s*\|\s*15412\.27\s*\|\s*pago completo\s*\|/')
        ->and($lista)->toMatch('/\|\s*587\s*\|.*\|\s*monto distinto del total viejo\s*\|/')
        ->and($lista)->toMatch('/\|\s*2061\s*\|.*\|\s*sin encabezado\s*\|\s*sin encabezado\s*\|/');
});

test('el funnel Amex cuenta folios, no filas: un encabezado repetido no multiplica la poblacion', function () {
    // Un folio con TRES encabezados: un join contra tb_hprefactura lo contaria tres veces.
    origenPrefactura(5, 862.07, 1000.00);
    origenPrefactura(5, 862.07, 1000.00);
    origenPrefactura(5, 862.07, 1000.00);
    origenRenglon(5, 50, 813.27, 813.27);
    origenRenglon(5, 100, 48.80, 48.80);
    origenPago(5, 3, 1000.00);

    // Un folio sin encabezado: cuenta para los 718 de la formula, no para los 719 con encabezado.
    origenRenglon(2061, 24, 1495.00, 1495.00);
    origenRenglon(2061, 100, 131.70, 131.70);
    origenPago(2061, 3, 2698.972);

    $this->artisan('facturacion:comparar-pagos')
        ->expectsOutputToContain('Folios cuyo único pago es un Amex: 2')
        ->expectsOutputToContain('de ellos, con encabezado de subtotal mayor que cero (el último de cada folio): 1')
        ->expectsOutputToContain('y partida mayor que cero (los que se comparan): 2')
        ->assertExitCode(0);
});

test('la poblacion del ajuste exige que el unico pago del folio sea Amex', function () {
    // Amex mas Visa: el monto Amex no es todo lo que se pago, asi que no se compara el total.
    origenPrefactura(1, 1048.80, 1216.61);
    origenRenglon(1, 50, 1000.00, 1000.00);
    origenRenglon(1, 100, 48.80, 48.80);
    origenPago(1, 3, 600.00);
    origenPago(1, 1, 616.61);

    $this->artisan('facturacion:comparar-pagos')
        ->expectsOutputToContain('Folios cuyo único pago es un Amex: 0')
        ->expectsOutputToContain('Comisión Amex, comparables: 1')
        ->assertExitCode(0);
});

test('sin una forma Amex en el catalogo el comando lo avisa y termina bien', function () {
    DB::connection('remota')->table('tb_tip_fpago')->where('id_tipo_formas', 3)->delete();
    origenAmexQueCuadra(1);

    $this->artisan('facturacion:comparar-pagos')
        ->expectsOutputToContain("tb_tip_fpago no tiene una forma llamada 'Amex'")
        ->expectsOutputToContain('Comisión Amex, no comparables: 1')
        ->assertExitCode(0);
});

// ---- El sobrepago -----------------------------------------------------------------------

test('el sobrepago se compara con el Cambio guardado en dos listas separadas', function () {
    // Sobrepagado con Cambio en cero: el pago posterior lo piso (mpago.php).
    origenPrefactura(1, 100.00, 116.00, 0.00);
    origenRenglon(1, 50, 100.00, 100.00);
    origenPago(1, 4, 200.00);

    // Cambio distinto de cero sin estar sobrepagado: quedo escrito y luego cambio el documento.
    origenPrefactura(2, 100.00, 116.00, 40.00);
    origenRenglon(2, 50, 100.00, 100.00);
    origenPago(2, 1, 116.00);

    $salida = salidaDeCompararPagos();

    expect($salida)->toContain('Sobrepagadas con Cambio en cero: 1')
        ->and($salida)->toContain('Cambio guardado sin sobrepago: 1');

    expect(seccionDeCompararPagos($salida, 'Sobrepagadas con Cambio en cero (un pago posterior'))
        ->toMatch('/\|\s*1\s*\|\s*116\.00\s*\|\s*200\.00\s*\|\s*84\.00\s*\|\s*0\.00\s*\|/')
        ->not->toMatch('/\|\s*2\s*\|/');
    expect(seccionDeCompararPagos($salida, 'Cambio guardado sin estar sobrepagadas'))
        ->toMatch('/\|\s*2\s*\|\s*116\.00\s*\|\s*116\.00\s*\|\s*0\.00\s*\|\s*40\.00\s*\|/');
});

test('un sobrepago con Cambio guardado no entra en ninguna de las dos listas de error', function () {
    origenPrefactura(1, 100.00, 116.00, 84.00);
    origenPago(1, 4, 200.00);

    $this->artisan('facturacion:comparar-pagos')
        ->expectsOutputToContain('Sobrepagadas: 1')
        ->expectsOutputToContain('Sobrepagadas con Cambio guardado: 1')
        ->expectsOutputToContain('Sobrepagadas con Cambio en cero: 0')
        ->expectsOutputToContain('Cambio guardado sin sobrepago: 0')
        ->assertExitCode(0);
});

test('el sobrepago no tiene tolerancia: un centavo de mas cuenta, y se dice aparte', function () {
    origenPrefactura(1, 100.00, 116.00);
    origenPago(1, 1, 116.01);                 // por un solo centavo

    origenPrefactura(2, 100.00, 116.00);
    origenPago(2, 1, 116.02);                 // por dos

    $salida = salidaDeCompararPagos();

    expect($salida)->toContain('Sobrepagadas: 2')
        ->and($salida)->toContain('de ellas, por un solo centavo: 1')
        ->and($salida)->toContain('Sobrepagadas con Cambio en cero: 2')
        // No hay una segunda cuenta «sin contar el centavo»: el comando no es mas laxo que el sistema.
        ->and($salida)->not->toContain('Sin contar');
});

test('un sobrepago de un centavo se nombra con su causa: el que crea el redondeo y el que ya estaba en el origen', function () {
    // 3261: dos pagos Amex de cuatro decimales. La suma del origen cuadra con el Total (66765.55),
    // pero cada pago se redondea hacia arriba y lo importado suma un centavo de mas.
    origenPrefactura(3261, 66765.55, 66765.55);
    origenPago(3261, 3, 59316.136);
    origenPago(3261, 3, 7449.4156);

    // 394: un efectivo de un centavo de mas que YA estaba en el origen, con su cambio guardado.
    origenPrefactura(394, 7606.42, 7606.42, 0.01);
    origenPago(394, 4, 7606.43);

    $salida = salidaDeCompararPagos();

    expect($salida)->toContain('Sobrepagadas: 2')
        ->and($salida)->toContain('de ellas, por un solo centavo: 2')
        ->and($salida)->toContain('de esas, creadas por el redondeo al importar (no existen en el origen): 1')
        ->and($salida)->toContain('de esas, que ya existen en el origen: 1');

    $lista = seccionDeCompararPagos($salida, 'Sobrepagadas por un solo centavo');
    expect($lista)->toMatch('/\|\s*3261\s*\|\s*66765\.55\s*\|\s*66765\.56\s*\|\s*66765\.55\s*\|.*lo crea el redondeo al importar/')
        ->and($lista)->toMatch('/\|\s*394\s*\|\s*7606\.42\s*\|\s*7606\.43\s*\|\s*7606\.43\s*\|\s*0\.01\s*\|.*ya está en el origen/');
});

test('los folios con encabezado y sin ningun pago se cuentan', function () {
    origenPrefactura(1, 100.00, 116.00);
    origenPrefactura(2, 100.00, 116.00);
    origenPago(2, 1, 116.00);

    $this->artisan('facturacion:comparar-pagos')
        ->expectsOutputToContain('Folios con encabezado: 2')
        ->expectsOutputToContain('Folios con encabezado y sin ningún pago: 1')
        ->assertExitCode(0);
});

// ---- Las cortesias ----------------------------------------------------------------------

test('las cortesias se identifican por importe 0 con precio mayor que 0', function () {
    origenPrefactura(1, 0.00, 0.00);
    origenRenglon(1, 50, 300.00, 0.00, 'cortesia');   // cortesia marcada
    origenRenglon(1, 51, 400.00, 0.00, '');           // importe 0 SIN marca: no cuadra
    origenRenglon(1, 52, 0.00, 0.00, '');             // precio 0: no es cortesia, se ignora

    $this->artisan('facturacion:comparar-pagos')
        ->expectsOutputToContain('Cortesías marcadas: 1')
        ->expectsOutputToContain('Cortesías marcadas con importe en cero: 1')
        ->expectsOutputToContain('Importe en cero con precio mayor que cero: 2')
        ->expectsOutputToContain('Importe en cero sin marca de cortesía: 1')
        ->expectsOutputToContain('Marcadas como cortesía sin importe en cero: 0')
        ->assertExitCode(0);
});

test('los descuentos marcados Cortesia, la errata y la condicion que no captura las marcadas se dicen aparte', function () {
    origenPrefactura(1, 0.00, 0.00);
    origenRenglon(1, 50, 300.00, 0.00, 'cortesia');            // cortesia de verdad
    origenRenglon(1, 2, -1615.00, -1615.00, 'cortesia');       // marcada, pero es un DESCUENTO
    origenRenglon(1, 24, 700.00, 700.00, 'cortesia');          // marcada, cobra: ni cortesia ni descuento
    origenRenglon(1, 2, 1615.00, 0.00, 'cortecia');            // importe 0 con una errata en la marca
    origenRenglon(1, 6, 867.87, 0.00, 'N/A');                  // importe 0 sin marca y sin errata

    $salida = salidaDeCompararPagos();

    expect($salida)->toContain('Cortesías marcadas: 3')
        ->and($salida)->toContain('Cortesías marcadas con importe en cero: 1')
        ->and($salida)->toContain('Marcadas como cortesía sin importe en cero: 2')
        ->and($salida)->toContain('de ellas, con precio e importe negativos (descuentos, del bloque 5): 1')
        ->and($salida)->toContain('de ellas, con importe distinto de cero y sin ser negativas: 1')
        ->and($salida)->toContain('Importe en cero sin marca de cortesía: 2')
        ->and($salida)->toContain('de ellas, con una remisión que parece una errata de «cortesia»: 1')
        ->and($salida)->toContain('NO captura las 3 marcadas: deja fuera 2 y agrega 2 sin marca.');

    expect(seccionDeCompararPagos($salida, 'Marcadas como cortesía con un importe que no es cero'))
        ->toMatch('/\|\s*-1615\.00\s*\|\s*-1615\.00\s*\|.*descuento \(renglón negativo, bloque 5\)/')
        ->toMatch('/\|\s*700\.00\s*\|\s*700\.00\s*\|.*con importe/');
    expect(seccionDeCompararPagos($salida, 'Importe en cero con precio mayor que cero, sin la marca'))
        ->toMatch('/cortecia\s*\|\s*errata de «cortesia»/');
});

test('una marca de cortesia en un renglon con importe se lista aparte, y la que no cuadra tambien', function () {
    origenPrefactura(1, 0.00, 0.00);
    origenRenglon(1, 24, 700.00, 700.00, 'cortesia');       // marcada, pero cobra
    origenRenglon(1, 51, 400.00, 0.00, '', 2);             // importe 0 sin marca

    $salida = salidaDeCompararPagos();

    expect($salida)->toContain('Marcadas como cortesía sin importe en cero: 1')
        ->and($salida)->toContain('Importe en cero sin marca de cortesía: 1');

    expect(seccionDeCompararPagos($salida, 'Marcadas como cortesía con un importe que no es cero'))
        ->toMatch('/\|\s*1\s*\|\s*\d+\s*\|\s*24\s*\|\s*700\.00\s*\|\s*700\.00\s*\|/');
    expect(seccionDeCompararPagos($salida, 'Importe en cero con precio mayor que cero, sin la marca'))
        ->toMatch('/\|\s*1\s*\|\s*\d+\s*\|\s*51\s*\|\s*400\.00\s*\|\s*0\.00\s*\|\s*2\s*\|/');
});

// ---- El alcance -------------------------------------------------------------------------

test('--folio acota todas las comparaciones a un solo folio', function () {
    origenAmexQueCuadra(1);
    origenAmexQueCuadra(2);
    origenAmexQueCuadra(3);

    $this->artisan('facturacion:comparar-pagos', ['--folio' => 2])
        ->expectsOutputToContain('Alcance: solo el folio 2.')
        ->expectsOutputToContain('Pagos comparados: 1')
        ->expectsOutputToContain('Comisiones revisadas: 1')
        ->assertExitCode(0);
});

test('--limite acota a los primeros N folios por numero, no por orden de insercion', function () {
    origenAmexQueCuadra(30);
    origenAmexQueCuadra(10);
    origenAmexQueCuadra(20);

    $this->artisan('facturacion:comparar-pagos', ['--limite' => 2])
        ->expectsOutputToContain('Alcance: los primeros 2 folios, por número (2 con datos).')
        ->expectsOutputToContain('Pagos comparados: 2')
        ->assertExitCode(0);
});

test('un --folio o un --limite que no es un numero se rechaza sin tocar el origen', function () {
    $this->artisan('facturacion:comparar-pagos', ['--folio' => 'abc'])
        ->expectsOutputToContain('--folio debe ser un número entero')
        ->assertExitCode(1);

    $this->artisan('facturacion:comparar-pagos', ['--limite' => '0'])
        ->expectsOutputToContain('--limite debe ser un entero mayor que cero')
        ->assertExitCode(1);
});
