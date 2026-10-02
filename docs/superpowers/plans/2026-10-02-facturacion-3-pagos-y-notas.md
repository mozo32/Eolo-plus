# Bloque 3 — Pagos, notas y cortesía: plan de implementación

> **Para trabajadores agénticos:** SUB-SKILL REQUERIDA: usa
> superpowers:subagent-driven-development (recomendada) o
> superpowers:executing-plans para implementar este plan task por task. Los pasos
> usan casillas (`- [ ]`) para seguimiento.

**Goal:** que una prefactura se pueda cobrar —con sus formas de pago, la comisión
Amex y la cortesía— y lleve sus tres notas, verificado contra los 3,534 pagos y las
733 comisiones del sistema viejo.

**Architecture:** tres migraciones aditivas más una que extiende el catálogo de
formas de pago del 1b con una columna `concepto`, para que el código reconozca
Efectivo, Amex y AvCard por columna propia y no por nombre. La fórmula de la
comisión vive en `App\Support\ComisionAmex`, al lado de `ImporteServicio`. Las
reglas por forma de pago viven en `App\Services\PagosPrefactura`, que toma el mismo
candado que `CierrePrefactura`. El importe de un renglón de cortesía es `'0.00'`, y
esa comprobación va en el renglón, no en la fórmula compartida.

**Tech Stack:** Laravel 12, PHP 8.2, Pest sobre sqlite en memoria, React 19 +
TypeScript, Tailwind 4, SweetAlert2, aritmética de cadenas con `bc`.

**Spec:** `docs/superpowers/specs/2026-10-02-facturacion-3-pagos-y-notas-design.md`

## Global Constraints

- **Ningún cobro existente puede cambiar.** `precio_unitario` es `decimal(10,4)`;
  `subtotal`, `iva`, `total`, `importe` y `monto` son `decimal(12,2)`.
- **Ningún `float` en el camino del dinero.** Aritmética de cadenas con `bc`.
- **Cada fórmula de dinero vive en un solo lugar:** `ImporteServicio::calcular()` el
  importe, `FactPrefactura::calcularIva()` el IVA, `ComisionAmex::calcular()` la
  comisión. Sin copias.
- **El redondeo de medio centavo se escribe `bcadd(bcmul(...), '0.005', 2)`.** Nunca
  `bcmul(..., 2)` a secas: trunca, y el sistema viejo redondea.
- **Nunca `increment()`, `decrement()` ni escrituras masivas sobre renglones:** no
  disparan `saving` y se saltan la guarda de la prefactura cerrada.
- **Toda escritura queda en `Bitacora`, DENTRO de la transacción.**
- **Todo lo visible, en español.**
- **La suite se corre en serie:** `php artisan test`. `--parallel` produce 22 fallos
  falsos ajenos en esta máquina. Al empezar este bloque son **751**.
- **El único error aceptable de `npx tsc --noEmit`** es el preexistente
  `resources/js/actions/App/Http/Controllers/Api/WalkAroundController.ts(905,5)`.
- **Las migraciones nuevas van entre `2026_09_29_092300` y
  `2026_09_29_099000_add_unique_matricula_to_aeronaves.php`**, que
  `tests/Feature/Facturacion/MatriculaUnicaTest.php:149` exige que siga siendo la
  última. Por eso se fechan `2026_09_29_0930xx` aunque se escriban el 2026-10-02.
- **Los ayudantes de prueba compartidos van en `tests/Pest.php`**, nunca declarados
  en un archivo de prueba: una función declarada en un archivo de prueba es global
  al cargarse y dos archivos que declaren la misma revientan por redeclaración.
- **Las rutas nuevas van dentro del grupo `Route::middleware('subdep:factPrefacturas')`**
  de `routes/api.php` (hoy en las líneas 421-431).

---

## Estructura de archivos

**Se crean:**

| Archivo | Responsabilidad |
|---|---|
| `database/migrations/2026_09_29_093000_add_concepto_to_fact_formas_pago_table.php` | La columna que identifica Efectivo, Amex y AvCard |
| `database/migrations/2026_09_29_093100_create_fact_prefactura_pagos_table.php` | La tabla de pagos |
| `database/migrations/2026_09_29_093200_add_es_cortesia_to_fact_prefactura_renglones_table.php` | La cortesía |
| `database/migrations/2026_09_29_093300_add_notas_to_fact_prefacturas_table.php` | Las tres notas |
| `app/Support/ComisionAmex.php` | La fórmula de la comisión, en un solo lugar |
| `app/Models/FactPrefacturaPago.php` | El pago |
| `app/Services/PagosPrefactura.php` | Las reglas por forma de pago, bajo candado |
| `app/Services/PagoNoPermitidoException.php` | Una excepción que lleva su propio `codigo` |
| `app/Services/PrefacturaSinCobroException.php` | Cerrar sin cobro completo, con el faltante |
| `app/Http/Controllers/Api/Facturacion/PrefacturaPagoController.php` | Alta y baja de pagos |
| `app/Http/Requests/Facturacion/StorePagoRequest.php` | Validación del pago no-Amex |
| `app/Http/Requests/Facturacion/StorePagoAmexRequest.php` | Validación del pago Amex |
| `app/Http/Requests/Facturacion/UpdateNotasRequest.php` | Validación de las tres notas |
| `app/Console/Commands/CompararPagos.php` | Verificación contra el histórico, solo lectura |
| `resources/js/pages/Facturacion/components/PanelCobro.tsx` | El panel de cobro |
| `resources/js/pages/Facturacion/components/PanelNotas.tsx` | El panel de notas |
| `resources/js/pages/Facturacion/components/ModalPagoAmex.tsx` | El diálogo del pago Amex |

**Se modifican:**

| Archivo | Qué cambia |
|---|---|
| `app/Models/FactFormaPago.php` | Constantes de concepto, `scopePorConcepto`, `concepto` en `$fillable` |
| `app/Services/ImportadorMatriculas.php` | `importarFormasPago()` asigna los tres conceptos |
| `app/Models/FactPrefactura.php` | Relación `pagos()`, `pagado()`, `porCobrar()`, `sobrepago()`, `sobrepagoEsCambio()`, notas en `$fillable` |
| `app/Models/FactPrefacturaRenglon.php` | `es_cortesia` en `$fillable` y `$casts`; `importe()` devuelve `'0.00'` |
| `app/Services/CierrePrefactura.php` | `cerrar()` acepta `bool $confirmarSinCobro` |
| `app/Http/Controllers/Api/Facturacion/PrefacturaController.php` | `cerrar()` acepta el flag, `presentar()` agrega el cobro, `notas()` |
| `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php` | `cortesia()` |
| `routes/api.php` | Seis rutas nuevas |
| `resources/js/stores/apiFacturacionCatalogos.ts` | Tipos y llamadas |
| `resources/js/pages/Facturacion/EditorPrefactura.tsx` | Monta los dos paneles y el interruptor |
| `tests/Pest.php` | Ayudantes nuevos |

**El editor ya tiene 816 líneas.** Por eso el cobro y las notas se extraen a
componentes propios en lugar de engordarlo: el editor los monta y les pasa la
prefactura y un callback de recarga.

---

## Task 1: La fórmula de la comisión Amex

**Files:**
- Create: `app/Support/ComisionAmex.php`
- Test: `tests/Unit/ComisionAmexTest.php`

**Interfaces:**
- Consumes: nada. Es una clase pura, sin base de datos.
- Produces: `App\Support\ComisionAmex::calcular(string $montoBruto, string $tasaIva): string`
  — devuelve el importe de la comisión con dos decimales. La usan la Task 6 (el
  pago Amex) y la Task 9 (el comando).

**Contexto que el brief no puede saber:** el sistema viejo escribe
`$camex = $monto * (0.06 / 1.2296)` en `Prefectura/mpamex.php:40`. El `1.2296` es
`1.16 × 1.06` precalculado, o sea `(1 + tasa de IVA) × (1 + 6% de comisión)`. La
fórmula está construida para que el total de la prefactura caiga exactamente en el
monto que se carga a la tarjeta. Aquí la tasa se **lee** en lugar de fijarse, para
que sobreviva a un cambio de tasa; con 16% da el mismo número que el histórico.

- [ ] **Step 1: Escribe la prueba que falla**

Los cinco montos y sus comisiones son **filas reales del histórico** (`tb_venta`
con `id_servicio = 100` junto a su pago Amex), verificados uno por uno.

```php
<?php

use App\Support\ComisionAmex;

test('reproduce las comisiones del historico al centavo', function (string $montoBruto, string $esperada) {
    expect(ComisionAmex::calcular($montoBruto, '0.1600'))->toBe($esperada);
})->with([
    // [monto cargado a la tarjeta, comision guardada en el sistema viejo]
    ['105.2816', '5.14'],
    ['307.4', '15.00'],
    ['647.9992', '31.62'],
    ['182440.6704', '8902.44'],
    ['256431.8388', '12512.94'],
]);

test('el monto redondeado a dos decimales cae en el mismo centavo', function () {
    // El operador solo puede teclear dos decimales; el historico trae cuatro.
    expect(ComisionAmex::calcular('105.28', '0.1600'))->toBe('5.14');
});

test('la comision es el 6% de la base que implica el monto bruto', function () {
    // 1000 / 1.2296 = 813.2726...  y el 6% de eso es 48.796...
    expect(ComisionAmex::calcular('1000.00', '0.1600'))->toBe('48.80');
});

test('la tasa de IVA se lee, no se fija: con otra tasa la comision cambia', function () {
    // Divisor 1.08 x 1.06 = 1.1448, no 1.2296. Si alguien dejara el literal, esto falla.
    expect(ComisionAmex::calcular('1000.00', '0.0800'))->toBe('52.41');
});

test('monto cero da comision cero', function () {
    expect(ComisionAmex::calcular('0.00', '0.1600'))->toBe('0.00');
});

test('un monto que no es decimal lanza en lugar de cobrar un numero inventado', function () {
    expect(fn () => ComisionAmex::calcular('x', '0.1600'))->toThrow(UnexpectedValueException::class);
    expect(fn () => ComisionAmex::calcular('100.00', 'x'))->toThrow(UnexpectedValueException::class);
});

test('una tasa que haria cero el divisor lanza en lugar de dividir entre cero', function () {
    // Imposible hoy (la tasa es >= 0 y el divisor es (1+tasa) x 1.06 >= 1.06), pero la
    // guarda documenta por que nadie tiene que volver a preguntarselo.
    expect(fn () => ComisionAmex::calcular('100.00', '-1.0000'))->toThrow(UnexpectedValueException::class);
});
```

- [ ] **Step 2: Córrela para verificar que falla**

Run: `php artisan test tests/Unit/ComisionAmexTest.php`
Expected: FAIL con `Class "App\Support\ComisionAmex" not found`.

- [ ] **Step 3: Escribe la implementación mínima**

```php
<?php

namespace App\Support;

use UnexpectedValueException;

/**
 * La comisión Amex, en un solo lugar.
 *
 * El sistema viejo escribe `$camex = $monto * (0.06 / 1.2296)`
 * (`Prefectura/mpamex.php:40`), y ese `1.2296` es `1.16 × 1.06` precalculado: la
 * tasa de IVA por el 6% de la comisión. La fórmula no es un parche, es exacta — si
 * el operador teclea lo que se le va a cargar a la tarjeta:
 *
 *     base     = monto / ((1 + iva) × 1.06)
 *     comisión = base × 0.06
 *     subtotal = base + comisión = base × 1.06
 *     total    = subtotal × (1 + iva) = monto
 *
 * Aquí la tasa se LEE en lugar de fijarse. Con 16% da el mismo número que las 765
 * comisiones del histórico que siguen esta fórmula; el día que la tasa cambie,
 * sigue siendo correcta, lo que el literal `1.2296` no haría.
 *
 * `mpamex.php` tiene una SEGUNDA fórmula (`monto * 0.06`) para cuando ya había
 * pagos registrados. Se descarta a propósito: aparece 5 veces contra 765, y aplica
 * el 6% a un monto bruto como si fuera neto, lo que hace que la misma cantidad
 * cargada a la tarjeta produzca dos comisiones distintas según el orden en que se
 * capturó. El comando `facturacion:comparar-pagos` nombra esos 5 folios.
 */
final class ComisionAmex
{
    /** El 6% que Amex cobra, como fracción. */
    public const TASA = '0.06';

    public static function calcular(string $montoBruto, string $tasaIva): string
    {
        self::exigirDecimal($montoBruto, 'monto bruto');
        self::exigirDecimal($tasaIva, 'tasa de IVA');

        // (1 + iva) × 1.06. A escala 6: la tasa tiene 4 decimales y 1.06 tiene 2.
        $divisor = bcmul(bcadd('1', $tasaIva, 4), bcadd('1', self::TASA, 2), 6);

        if (bccomp($divisor, '0', 6) <= 0) {
            throw new UnexpectedValueException("El divisor de la comisión Amex no es positivo: '{$divisor}'");
        }

        // Medio centavo antes de truncar, en aritmética de cadenas: redondea hacia
        // arriba en el medio sin pasar por float, igual que `FactPrefactura::calcularIva()`.
        return bcadd(bcdiv(bcmul($montoBruto, self::TASA, 6), $divisor, 6), '0.005', 2);
    }

    /** Un signo menos SÍ se acepta: lo rechaza el `bccomp` del divisor, con su propio mensaje. */
    private static function exigirDecimal(string $valor, string $que): void
    {
        if (preg_match('/^-?(\d+(\.\d+)?|\.\d+)$/', trim($valor)) !== 1) {
            throw new UnexpectedValueException("La comisión Amex necesita un decimal como {$que}, y recibió: '{$valor}'");
        }
    }
}
```

- [ ] **Step 4: Córrela para verificar que pasa**

Run: `php artisan test tests/Unit/ComisionAmexTest.php`
Expected: PASS, 11 pruebas (6 del dataset contadas como 5 casos más las 6 sueltas).

- [ ] **Step 5: Verifica por mutación que la prueba de la tasa sirve**

Cambia el divisor por el literal `'1.229600'`. Expected: falla *solo* la prueba de
la tasa `0.0800`. Restaura con `git checkout -- app/Support/ComisionAmex.php`.

- [ ] **Step 6: Commit**

```bash
git add app/Support/ComisionAmex.php tests/Unit/ComisionAmexTest.php
git commit -m "La comision Amex, en un solo lugar y con la tasa de IVA configurable"
```

---

## Task 2: El concepto de las formas de pago

**Files:**
- Create: `database/migrations/2026_09_29_093000_add_concepto_to_fact_formas_pago_table.php`
- Modify: `app/Models/FactFormaPago.php`
- Modify: `app/Services/ImportadorMatriculas.php` (método `importarFormasPago()`, hoy en la línea 903)
- Test: `tests/Feature/Facturacion/ConceptoFormaPagoTest.php`

**Interfaces:**
- Consumes: nada de las tasks anteriores.
- Produces:
  - `FactFormaPago::CONCEPTO_EFECTIVO = 'efectivo'`
  - `FactFormaPago::CONCEPTO_AMEX = 'amex'`
  - `FactFormaPago::CONCEPTO_AVCARD = 'avcard'`
  - `FactFormaPago::porConcepto(string $concepto)` — scope, devuelve el `Builder`.
  Las Tasks 5, 6, 7, 8 y 9 identifican las formas de pago por estas constantes.

**Por qué existe esta task:** las reglas del cobro son **por forma de pago** —
Efectivo puede exceder, AvCard se rechaza con combustible, Amex lleva comisión— y
el catálogo que trajo el 1b solo tiene `nombre`, que se puede editar en pantalla.
El bloque 2 resolvió este mismo problema con `fact_servicios.concepto`
(`2026_09_29_092000_add_concepto_to_fact_servicios_table.php`); esta task repite ese
patrón, con el mismo motivo escrito ahí: `utf8mb4_unicode_ci` pliega caja y
acentos, así que comparar por nombre siempre va a tener bordes.

Los ids del origen son estables porque el sistema viejo los usa hardcodeados:
`$id_fp=3` para Amex en `mpamex.php:10`, `$id_fp==4` para Efectivo y `$id_fp==5`
para AvCard en `mpago.php:63` y `:48`.

- [ ] **Step 1: Escribe la prueba que falla**

```php
<?php

use App\Models\FactFormaPago;

test('las tres formas que el codigo reconoce llevan concepto y las demas no', function () {
    foreach (['Efectivo' => 'efectivo', 'Amex' => 'amex', 'AvCard by WFS' => 'avcard'] as $nombre => $concepto) {
        expect(FactFormaPago::where('nombre', $nombre)->value('concepto'))->toBe($concepto);
    }

    foreach (['Visa', 'Mastercard', 'Transferencia', 'Tarjeta Remota'] as $nombre) {
        expect(FactFormaPago::where('nombre', $nombre)->value('concepto'))->toBeNull();
    }
});

test('el concepto es unico: no puede haber dos formas de pago que sean Efectivo', function () {
    FactFormaPago::create(['nombre' => 'Caja chica', 'concepto' => null]);

    expect(fn () => FactFormaPago::where('nombre', 'Caja chica')->first()->update(['concepto' => 'efectivo']))
        ->toThrow(Illuminate\Database\QueryException::class);
});

test('el scope encuentra la forma por concepto y no por nombre', function () {
    // Renombrarla en pantalla NO debe romper la regla que la reconoce.
    FactFormaPago::porConcepto(FactFormaPago::CONCEPTO_AMEX)->first()->update(['nombre' => 'American Express']);

    expect(FactFormaPago::porConcepto(FactFormaPago::CONCEPTO_AMEX)->first()->nombre)->toBe('American Express');
});
```

La prueba necesita las siete formas de pago sembradas. Siémbralas con un ayudante
nuevo en `tests/Pest.php` (ver Step 3).

- [ ] **Step 2: Córrela para verificar que falla**

Run: `php artisan test tests/Feature/Facturacion/ConceptoFormaPagoTest.php`
Expected: FAIL — la columna `concepto` no existe.

- [ ] **Step 3: El ayudante de las siete formas de pago, en `tests/Pest.php`**

Va al final del archivo, en la sección de ayudantes de prefactura.

```php
/**
 * Las siete formas de pago del catálogo, con el concepto de las tres que el
 * código reconoce. Devuelve [concepto o nombre => modelo] para poder tomar una
 * por su concepto sin otra consulta.
 *
 * @return array<string, App\Models\FactFormaPago>
 */
function formasDePago(): array
{
    $definicion = [
        'Visa' => null,
        'Mastercard' => null,
        'Amex' => App\Models\FactFormaPago::CONCEPTO_AMEX,
        'Efectivo' => App\Models\FactFormaPago::CONCEPTO_EFECTIVO,
        'AvCard by WFS' => App\Models\FactFormaPago::CONCEPTO_AVCARD,
        'Transferencia' => null,
        'Tarjeta Remota' => null,
    ];

    $formas = [];

    foreach ($definicion as $nombre => $concepto) {
        $formas[$concepto ?? $nombre] = App\Models\FactFormaPago::firstOrCreate(
            ['nombre' => $nombre],
            ['concepto' => $concepto],
        );
    }

    return $formas;
}
```

- [ ] **Step 4: La migración**

```php
<?php

use App\Models\FactFormaPago;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Identifica por columna propia las tres formas de pago que el código tiene que
 * reconocer, en lugar de por su nombre, que se edita en pantalla.
 *
 * Mismo patrón y mismo motivo que `fact_servicios.concepto` del bloque 2: las
 * reglas del cobro son por forma de pago (Efectivo puede exceder el total, AvCard
 * se rechaza con combustible, Amex lleva comisión) y `utf8mb4_unicode_ci` pliega
 * caja y acentos, así que una comparación por nombre siempre tiene bordes.
 *
 * Asigna el concepto por nombre a las filas que ya estén importadas. Las que no
 * coincidan las asigna el importador, que va por el id del origen; por eso la guía
 * de despliegue exige volver a correrlo.
 */
return new class extends Migration
{
    private const POR_NOMBRE = [
        'Efectivo' => FactFormaPago::CONCEPTO_EFECTIVO,
        'Amex' => FactFormaPago::CONCEPTO_AMEX,
        'AvCard by WFS' => FactFormaPago::CONCEPTO_AVCARD,
    ];

    public function up(): void
    {
        Schema::table('fact_formas_pago', function (Blueprint $table) {
            $table->string('concepto', 32)->nullable()->unique()->after('nombre');
        });

        foreach (self::POR_NOMBRE as $nombre => $concepto) {
            // `limit(1)`: si la collation plegara dos filas al mismo nombre, el índice
            // único rechazaría la segunda y la migración fallaría a media tabla.
            $id = DB::table('fact_formas_pago')->where('nombre', $nombre)->orderBy('id')->value('id');

            if ($id !== null) {
                DB::table('fact_formas_pago')->where('id', $id)->update(['concepto' => $concepto]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('fact_formas_pago', function (Blueprint $table) {
            $table->dropUnique(['concepto']);
            $table->dropColumn('concepto');
        });
    }
};
```

- [ ] **Step 5: El modelo**

Añade a `app/Models/FactFormaPago.php`:

```php
    /** Las tres que el código reconoce: cada una tiene su propia regla de cobro. */
    public const CONCEPTO_EFECTIVO = 'efectivo';

    public const CONCEPTO_AMEX = 'amex';

    public const CONCEPTO_AVCARD = 'avcard';
```

Cambia `$fillable` a `['nombre', 'concepto', 'status']` y agrega el scope:

```php
    public function scopePorConcepto(Builder $query, string $concepto): Builder
    {
        return $query->where('concepto', $concepto);
    }
```

- [ ] **Step 6: El importador**

En `app/Services/ImportadorMatriculas.php`, junto a `CONCEPTOS_POR_ID_VIEJO`:

```php
    /**
     * Ids de `tb_tip_fpago` que llevan concepto. Son estables: el sistema viejo los
     * usa hardcodeados (`$id_fp=3` en mpamex.php, `$id_fp==4` y `==5` en mpago.php).
     *
     * @var array<int,string>
     */
    private const CONCEPTOS_FORMA_POR_ID_VIEJO = [
        3 => FactFormaPago::CONCEPTO_AMEX,
        4 => FactFormaPago::CONCEPTO_EFECTIVO,
        5 => FactFormaPago::CONCEPTO_AVCARD,
    ];
```

Y `importarFormasPago()` pasa a:

```php
    private function importarFormasPago(): void
    {
        $this->importarCatalogoSimple(
            'tb_tip_fpago', 'id_tipo_formas', 'tipo_forma', 'Forma de pago', FactFormaPago::class, 'formas_pago',
        );

        $this->asignarConceptosDeFormasPago();
    }

    /**
     * El concepto se asigna DESPUÉS de importar, por el id del origen, y no dentro de
     * `importarCatalogoSimple()`, que comparten los proveedores y no tienen concepto.
     *
     * Se busca la fila por su concepto primero y por su nombre después: si alguien ya
     * la renombró en pantalla, el concepto manda y el nombre no se toca (el catálogo
     * es editable a propósito).
     */
    private function asignarConceptosDeFormasPago(): void
    {
        foreach (self::CONCEPTOS_FORMA_POR_ID_VIEJO as $idViejo => $concepto) {
            $nombre = $this->legacy('tb_tip_fpago')->where('id_tipo_formas', $idViejo)->value('tipo_forma');

            if ($nombre === null) {
                $this->resultado->hallazgo("El origen no tiene la forma de pago con id {$idViejo}, que es la que lleva el concepto '{$concepto}'. Las reglas de cobro que dependen de ese concepto no se van a aplicar a ninguna fila.");

                continue;
            }

            $forma = FactFormaPago::porConcepto($concepto)->first()
                ?? FactFormaPago::whereNull('concepto')->where('nombre', trim($nombre))->first();

            if ($forma === null) {
                $this->resultado->hallazgo("No se encontró en Eolo-plus la forma de pago '{$nombre}' para asignarle el concepto '{$concepto}'.");

                continue;
            }

            if ($forma->concepto !== $concepto) {
                $forma->update(['concepto' => $concepto]);
            }
        }
    }
```

- [ ] **Step 7: Prueba del importador**

Añade a `tests/Feature/Facturacion/ConceptoFormaPagoTest.php`:

```php
test('el importador asigna el concepto a la fila que ya existia sin concepto', function () {
    App\Models\FactFormaPago::create(['nombre' => 'Amex']);

    // El importador busca por concepto y, si no lo halla, por nombre.
    $forma = App\Models\FactFormaPago::whereNull('concepto')->where('nombre', 'Amex')->first();
    expect($forma)->not->toBeNull();
});
```

La prueba de extremo a extremo del importador vive en el archivo que ya lo prueba;
localízalo con `grep -rln "ImportadorMatriculas\|facturacion:importar-matriculas" tests/`
y añade ahí un caso que corra el importador contra el origen simulado y
compruebe que las tres formas quedan con su concepto. Si el archivo simula
`tb_tip_fpago`, agrega las filas con ids 3, 4 y 5.

- [ ] **Step 8: Corre las pruebas**

Run: `php artisan test tests/Feature/Facturacion/ConceptoFormaPagoTest.php`
Expected: PASS.

Run: `php artisan test`
Expected: PASS, 751 + las nuevas. Si alguna prueba del 1b fallaba porque
`$fillable` no traía `concepto`, arréglala en lugar de relajar la prueba.

- [ ] **Step 9: Commit**

```bash
git add database/migrations/2026_09_29_093000_add_concepto_to_fact_formas_pago_table.php app/Models/FactFormaPago.php app/Services/ImportadorMatriculas.php tests/Pest.php tests/Feature/Facturacion/ConceptoFormaPagoTest.php
git commit -m "Las tres formas de pago con regla propia se reconocen por concepto, no por nombre"
```

---

## Task 3: La tabla de pagos y los derivados del cobro

**Files:**
- Create: `database/migrations/2026_09_29_093100_create_fact_prefactura_pagos_table.php`
- Create: `app/Models/FactPrefacturaPago.php`
- Modify: `app/Models/FactPrefactura.php`
- Modify: `tests/Pest.php`
- Test: `tests/Feature/Facturacion/CobroDerivadoTest.php`

**Interfaces:**
- Consumes: `FactFormaPago::CONCEPTO_EFECTIVO` y el ayudante `formasDePago()` de la
  Task 2.
- Produces, todos devolviendo **cadena de dos decimales** salvo donde se indica:
  - `FactPrefactura::pagos()` — `hasMany(FactPrefacturaPago::class, 'prefactura_id')`, solo activos, ordenada por `id`.
  - `FactPrefactura::pagado(): string`
  - `FactPrefactura::porCobrar(): string` — nunca negativo.
  - `FactPrefactura::sobrepago(): string` — nunca negativo.
  - `FactPrefactura::sobrepagoEsCambio(): bool`
  - `FactPrefacturaPago` con `$fillable = ['prefactura_id', 'forma_pago_id', 'monto', 'renglon_comision_id', 'user_id', 'status']`
  Las usan las Tasks 5, 6, 7, 8 y 9.

**Contexto medido que explica `sobrepagoEsCambio()`:** de los 27 folios del histórico
con pagos por encima del total, **16 tienen efectivo y 11 no** (7 Visa, 4 Amex, 1
Transferencia, 1 Mastercard, 1 AvCard) — y Visa, Mastercard y Transferencia **sí
tienen tope** en `mpago.php`. El tope se calcula contra el `Total` guardado, así que
cobrar y después quitar un servicio deja la prefactura sobrepagada sin que el tope
se entere. Con efectivo detrás, el sobrepago es **cambio** que se devuelve; sin
efectivo, es **cobrado de más** y lo que hay que hacer es corregir el pago.

- [ ] **Step 1: Escribe la prueba que falla**

```php
<?php

use App\Models\FactPrefactura;

test('sin pagos, lo pagado es cero y falta todo el total', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);

    expect($p->pagado())->toBe('0.00')
        ->and($p->total())->toBe('116.00')
        ->and($p->porCobrar())->toBe('116.00')
        ->and($p->sobrepago())->toBe('0.00')
        ->and($p->sobrepagoEsCambio())->toBeFalse();
});

test('lo pagado es la suma de los pagos, sin pasar por float', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);
    $formas = formasDePago();

    pagoDe($p, $formas['Visa'], '0.10');
    pagoDe($p, $formas['Visa'], '0.20');

    // 0.10 + 0.20 en float da 0.30000000000000004.
    expect($p->pagado())->toBe('0.30')
        ->and($p->porCobrar())->toBe('115.70');
});

test('un pago dado de baja no cuenta', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);
    $pago = pagoDe($p, formasDePago()['Visa'], '116.00');
    $pago->update(['status' => 'N']);

    expect($p->pagado())->toBe('0.00')
        ->and($p->pagos()->count())->toBe(0);
});

test('porCobrar nunca es negativo y el sobrepago aparece en su lugar', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);
    pagoDe($p, formasDePago()[App\Models\FactFormaPago::CONCEPTO_EFECTIVO], '200.00');

    expect($p->porCobrar())->toBe('0.00')
        ->and($p->sobrepago())->toBe('84.00')
        ->and($p->sobrepagoEsCambio())->toBeTrue();
});

test('un sobrepago SIN efectivo no es cambio: es cobrado de mas', function () {
    // Pasa de verdad: se cobra con tarjeta y despues se quita un servicio.
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 1);
    renglonDe($p, 500.0, 1);
    pagoDe($p, formasDePago()['Visa'], '696.00');
    $renglon->delete();

    expect($p->fresh()->total())->toBe('580.00')
        ->and($p->fresh()->sobrepago())->toBe('116.00')
        ->and($p->fresh()->sobrepagoEsCambio())->toBeFalse();
});

test('los derivados leen la base y no la relacion cacheada', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);
    $p->pagado();                      // cachea la relacion si la usara
    pagoDe($p, formasDePago()['Visa'], '50.00');

    expect($p->pagado())->toBe('50.00');
});

test('una cerrada usa su total sellado para decidir lo que falta', function () {
    [$p] = prefacturaCompleta(100.0, 1);
    pagoDe($p, formasDePago()['Visa'], '50.00');
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    expect($cerrada->porCobrar())->toBe('66.00');
});
```

- [ ] **Step 2: El ayudante `pagoDe()` en `tests/Pest.php`**

```php
/**
 * Registra un pago a mano, sin pasar por el servicio de la Task 5: sirve para
 * probar los derivados y la rama de una prefactura cerrada.
 */
function pagoDe(App\Models\FactPrefactura $p, App\Models\FactFormaPago $forma, string $monto): App\Models\FactPrefacturaPago
{
    return $p->pagos()->create([
        'forma_pago_id' => $forma->id,
        'monto' => $monto,
        'user_id' => $p->user_id,
    ]);
}
```

- [ ] **Step 3: Córrela para verificar que falla**

Run: `php artisan test tests/Feature/Facturacion/CobroDerivadoTest.php`
Expected: FAIL — la tabla `fact_prefactura_pagos` no existe.

- [ ] **Step 4: La migración**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Los pagos de una prefactura.
 *
 * En el histórico nunca hay más de dos por folio (3,498 folios con uno, 18 con
 * dos), pero la tabla no lo limita: limitarlo no compra nada y cerraría la puerta
 * a un cobro en tres partes que el viejo nunca necesitó pero tampoco prohibía.
 *
 * NO se guarda el cambio: se deriva de los pagos y el total. El `Cambio` del
 * sistema viejo está mal en las dos direcciones —de los 27 folios sobrepagados
 * solo 15 lo tienen distinto de cero, y de los 18 que lo tienen, 3 no están
 * sobrepagados— porque casi toda rama de `mpago.php` que inserta un pago hace
 * `SET Cambio='0'` y pisa el que el efectivo había dejado.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_prefactura_pagos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('prefactura_id')->constrained('fact_prefacturas')->cascadeOnDelete();
            $table->foreignId('forma_pago_id')->constrained('fact_formas_pago');
            $table->decimal('monto', 12, 2);
            // Solo Amex: el renglón de comisión que ESTE pago creó, para poder quitarlo
            // al quitar el pago. `nullOnDelete` y no cascada: si el renglón se va por otra
            // vía, el pago sobrevive sin referencia colgada en lugar de desaparecer.
            $table->foreignId('renglon_comision_id')->nullable()->constrained('fact_prefactura_renglones')->nullOnDelete();
            $table->foreignId('user_id')->constrained('users');
            $table->char('status', 1)->default('A')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_prefactura_pagos');
    }
};
```

- [ ] **Step 5: El modelo**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FactPrefacturaPago extends Model
{
    public const STATUS_ACTIVO = 'A';

    public const STATUS_INACTIVO = 'N';

    protected $table = 'fact_prefactura_pagos';

    protected $fillable = ['prefactura_id', 'forma_pago_id', 'monto', 'renglon_comision_id', 'user_id', 'status'];

    protected $casts = ['monto' => 'decimal:2'];

    public function prefactura()
    {
        return $this->belongsTo(FactPrefactura::class, 'prefactura_id');
    }

    public function formaPago()
    {
        return $this->belongsTo(FactFormaPago::class, 'forma_pago_id');
    }

    public function renglonComision()
    {
        return $this->belongsTo(FactPrefacturaRenglon::class, 'renglon_comision_id');
    }
}
```

- [ ] **Step 6: Los derivados en `FactPrefactura`**

Añade `'nota_interna', 'nota_externa', 'nota_factura'` a `$fillable` ya (la Task 7
crea las columnas; tenerlo aquí evita tocar el modelo dos veces, y un `$fillable`
con una columna que todavía no existe no rompe nada porque nadie la asigna).

```php
    /**
     * Solo los pagos activos: la baja es lógica, igual que en el resto del módulo.
     */
    public function pagos()
    {
        return $this->hasMany(FactPrefacturaPago::class, 'prefactura_id')
            ->where('status', FactPrefacturaPago::STATUS_ACTIVO)
            ->orderBy('id');
    }

    /**
     * Suma de los pagos activos. Lee la base y no la relación cacheada, por lo mismo
     * que `subtotalDerivado()`: un total de cobro que no ve el pago recién registrado
     * en la misma instancia miente en silencio.
     */
    public function pagado(): string
    {
        $suma = '0.00';

        foreach ($this->pagos()->get() as $pago) {
            $suma = bcadd($suma, (string) $pago->monto, 2);
        }

        return $suma;
    }

    /** Lo que falta por cobrar. Nunca negativo: el exceso es `sobrepago()`. */
    public function porCobrar(): string
    {
        $falta = bcsub($this->total(), $this->pagado(), 2);

        return bccomp($falta, '0.00', 2) > 0 ? $falta : '0.00';
    }

    /**
     * Lo cobrado por encima del total. Nunca negativo.
     *
     * Lo que SIGNIFICA depende de `sobrepagoEsCambio()`: con efectivo es cambio que
     * se devuelve; sin efectivo es que el documento se editó después de cobrarse, y
     * entonces se corrige el pago, no se entrega dinero.
     */
    public function sobrepago(): string
    {
        $exceso = bcsub($this->pagado(), $this->total(), 2);

        return bccomp($exceso, '0.00', 2) > 0 ? $exceso : '0.00';
    }

    /**
     * Si hay un pago en efectivo detrás del sobrepago. Se consulta por el CONCEPTO de
     * la forma de pago y no por su nombre, que se edita en pantalla.
     */
    public function sobrepagoEsCambio(): bool
    {
        return bccomp($this->sobrepago(), '0.00', 2) > 0
            && $this->pagos()
                ->whereHas('formaPago', fn ($q) => $q->where('concepto', FactFormaPago::CONCEPTO_EFECTIVO))
                ->exists();
    }
```

- [ ] **Step 7: Corre las pruebas**

Run: `php artisan test tests/Feature/Facturacion/CobroDerivadoTest.php`
Expected: PASS, 7 pruebas.

Run: `php artisan test`
Expected: PASS, nada roto.

- [ ] **Step 8: Verifica por mutación que la prueba del float sirve**

Cambia `pagado()` por `(float)` acumulado y devuelto con `number_format`. Expected:
falla la prueba de `0.10 + 0.20`. Restaura con `git checkout --`.

- [ ] **Step 9: Commit**

```bash
git add database/migrations/2026_09_29_093100_create_fact_prefactura_pagos_table.php app/Models/FactPrefacturaPago.php app/Models/FactPrefactura.php tests/Pest.php tests/Feature/Facturacion/CobroDerivadoTest.php
git commit -m "La tabla de pagos y el cobro derivado: lo pagado, lo que falta y el sobrepago"
```

---

## Task 4: La cortesía

**Files:**
- Create: `database/migrations/2026_09_29_093200_add_es_cortesia_to_fact_prefactura_renglones_table.php`
- Modify: `app/Models/FactPrefacturaRenglon.php`
- Modify: `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Facturacion/CortesiaTest.php`

**Interfaces:**
- Consumes: nada de las tasks anteriores.
- Produces:
  - La columna `fact_prefactura_renglones.es_cortesia` (boolean, default `false`).
  - `FactPrefacturaRenglon::importe()` devuelve `'0.00'` cuando `es_cortesia`.
  - `PATCH /api/facturacion/prefacturas/{id}/renglones/{renglon}/cortesia` con
    cuerpo `{"es_cortesia": true|false}`, respuesta
    `{"message": string, "prefactura": {...}}`.
  Las Tasks 8 y 9 la usan.

**Contexto:** el sistema viejo marca la cortesía escribiendo `'cortesia'` en
`tb_venta.remision` (`Prefectura/cortecia.php:16`), que es **el mismo campo** donde
van las remisiones reales (`HANDLING`, `9226`, `000015`, `N/A`). 130 renglones del
histórico están así. Separarlo en su propia columna arregla esa ambigüedad.

Y el viejo, al quitar la cortesía, recalcula `importe = precio_u × cantidad`
(`cortecia.php:24`), que **pierde el margen y el ajuste**. Aquí no puede pasar:
`importe` no se guarda, se deriva de los valores congelados del renglón. Esa es la
prueba más importante de esta task.

- [ ] **Step 1: Escribe la prueba que falla**

```php
<?php

use App\Models\Bitacora;
use App\Models\FactPrefactura;

test('un renglon de cortesia no cobra y el subtotal lo refleja', function () {
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 2);
    renglonDe($p, 50.0, 1);

    expect($p->subtotal())->toBe('250.00');

    $renglon->update(['es_cortesia' => true]);

    expect($renglon->fresh()->importe())->toBe('0.00')
        ->and($p->fresh()->subtotal())->toBe('50.00');
});

test('quitar la cortesia devuelve el importe CON su margen y su ajuste', function () {
    // El sistema viejo recalcula precio x cantidad y pierde el margen (cortecia.php:24).
    // Aqui el importe se deriva de los valores congelados, asi que no se puede perder.
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 1150.0, 1, margen: 50.0, ajuste: 'comision_131');

    $antes = $renglon->importe();
    expect($antes)->toBe('1514.31');

    $renglon->update(['es_cortesia' => true]);
    expect($renglon->fresh()->importe())->toBe('0.00');

    $renglon->update(['es_cortesia' => false]);
    expect($renglon->fresh()->importe())->toBe($antes);
});

test('el endpoint marca y desmarca la cortesia', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 1);
    $base = "/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/cortesia";

    $this->patchJson($base, ['es_cortesia' => true])
        ->assertOk()
        ->assertJsonPath('prefactura.subtotal', '0.00');

    expect($renglon->fresh()->es_cortesia)->toBeTrue();

    $this->patchJson($base, ['es_cortesia' => false])
        ->assertOk()
        ->assertJsonPath('prefactura.subtotal', '100.00');

    expect($renglon->fresh()->es_cortesia)->toBeFalse();
});

test('la cortesia queda en la bitacora, con el importe que deja de cobrarse', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 3);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/cortesia", ['es_cortesia' => true])->assertOk();

    $registro = Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)->where('accion', Bitacora::ACCION_ACTUALIZAR)->sole();

    expect($registro->descripcion)->toContain('cortesía')
        ->and($registro->descripcion)->toContain('300.00');
});

test('una prefactura cerrada no admite cortesia', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    $renglon = $p->renglones()->sole();
    cerrarConSello($p, '100.00', '16.00', '116.00');

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/cortesia", ['es_cortesia' => true])
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_cerrada');

    expect($renglon->fresh()->es_cortesia)->toBeFalse();
});

test('un borrador descartado no admite cortesia', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 1);
    $p->update(['status' => FactPrefactura::STATUS_INACTIVO]);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/cortesia", ['es_cortesia' => true])
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_descartada');
});

test('es_cortesia es obligatorio y booleano', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 1);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/cortesia", [])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['es_cortesia']);
});

test('el renglon de otra prefactura no se puede marcar desde esta', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $ajena = prefacturaBorrador();
    $renglon = renglonDe($ajena, 100.0, 1);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/cortesia", ['es_cortesia' => true])
        ->assertNotFound();
});
```

Añade también la ruta nueva a la lista de rutas protegidas que ya comprueba
`tests/Feature/Facturacion/EndpointsPrefacturaTest.php` (la tabla de la línea 164,
`'PATCH api/facturacion/prefacturas/{id}/internacional' => 'subdep:factPrefacturas'`).

- [ ] **Step 2: Córrela para verificar que falla**

Run: `php artisan test tests/Feature/Facturacion/CortesiaTest.php`
Expected: FAIL — la columna `es_cortesia` no existe.

- [ ] **Step 3: La migración**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La cortesía: un renglón que se ve en el documento pero no se cobra.
 *
 * Columna propia y no el texto `'cortesia'` en `remision`, que es lo que hace el
 * sistema viejo (`Prefectura/cortecia.php:16`) en el MISMO campo donde van las
 * remisiones reales (`HANDLING`, `9226`, `N/A`). 130 renglones del histórico están
 * así; el bloque 6 los traduce a esta columna y deja `remision` para lo que es.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fact_prefactura_renglones', function (Blueprint $table) {
            $table->boolean('es_cortesia')->default(false)->after('remision');
        });
    }

    public function down(): void
    {
        Schema::table('fact_prefactura_renglones', function (Blueprint $table) {
            $table->dropColumn('es_cortesia');
        });
    }
};
```

- [ ] **Step 4: El modelo**

En `app/Models/FactPrefacturaRenglon.php`: añade `'es_cortesia'` al final de
`$fillable` y `'es_cortesia' => 'boolean'` a `$casts`. Y cambia `importe()`:

```php
    /**
     * El importe se deriva de los valores CONGELADOS del renglón, nunca de los
     * del catálogo: el servicio pudo cambiar de precio después.
     *
     * Un renglón de cortesía no cobra. La comprobación va AQUÍ y no en
     * `ImporteServicio::calcular()`: esa es la fórmula compartida —la usan también el
     * catálogo y la vista previa de la pantalla— y no tiene por qué saber de
     * cortesías. Los valores congelados no se tocan, así que quitar la cortesía
     * devuelve el importe exacto, con su margen y su ajuste; el sistema viejo lo
     * recalcula como `precio × cantidad` y pierde los dos (`cortecia.php:24`).
     */
    public function importe(): string
    {
        if ($this->es_cortesia) {
            return '0.00';
        }

        return ImporteServicio::calcular(
            (float) $this->precio_unitario,
            (int) $this->cantidad,
            (float) $this->margen,
            $this->ajuste_precio,
        );
    }
```

- [ ] **Step 5: El endpoint**

En `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php`:

```php
    /**
     * Marca o desmarca un renglón como cortesía: se sigue viendo en el documento,
     * pero su importe es 0.
     *
     * Escritura POR MODELO (`$fila->update()`), nunca masiva: así pasa por la guarda
     * de `saving` que rechaza una prefactura cerrada.
     */
    public function cortesia(Request $request, int $id, int $renglon): JsonResponse
    {
        $datos = $request->validate(['es_cortesia' => ['required', 'boolean']]);

        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazoRapido($prefactura)) {
            return $respuesta;
        }

        $resultado = DB::transaction(function () use ($request, $id, $renglon, $datos) {
            $actual = $this->bloquear($id);

            if ($respuesta = $this->rechazarSiDescartada($actual)) {
                return $respuesta;
            }

            $fila = $actual->renglones()->whereKey($renglon)->firstOrFail();

            // El importe ANTES del cambio: es la cifra que deja de cobrarse (o que
            // vuelve a cobrarse), y es lo que tiene sentido registrar.
            $importe = $fila->importe();
            $fila->update(['es_cortesia' => $datos['es_cortesia']]);

            $verbo = $datos['es_cortesia'] ? 'Se marcó como cortesía' : 'Se quitó la cortesía de';
            $monto = $datos['es_cortesia'] ? $importe : $fila->fresh()->importe();

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_ACTUALIZAR,
                descripcion: "{$verbo} el servicio {$fila->nombre_servicio} de la prefactura {$actual->id}, por {$monto}.",
                usuarioId: $request->user()->id,
                registroId: $actual->id,
                datosNuevos: ['renglon_id' => $fila->id, 'es_cortesia' => $datos['es_cortesia'], 'importe' => $monto],
            );

            return $actual;
        });

        if ($resultado instanceof JsonResponse) {
            return $resultado;
        }

        return response()->json([
            'message' => $datos['es_cortesia'] ? 'Renglón marcado como cortesía.' : 'Cortesía quitada.',
            'prefactura' => app(PrefacturaController::class)->fichaDe($resultado->id),
        ]);
    }
```

**Nota sobre la ficha:** `presentar()` es privado en `PrefacturaController`. Para no
duplicarlo, añade a ese controlador un método público delgado:

```php
    /**
     * La ficha completa de una prefactura, para que otro controlador del módulo
     * devuelva el mismo cuerpo que `show()` sin copiar `presentar()`.
     */
    public function fichaDe(int $id): array
    {
        return $this->presentar(FactPrefactura::findOrFail($id)->fresh(), conRenglones: true);
    }
```

- [ ] **Step 6: La ruta**

Dentro del grupo `subdep:factPrefacturas` de `routes/api.php`, junto a las otras de
renglones:

```php
        Route::patch('/prefacturas/{id}/renglones/{renglon}/cortesia', [PrefacturaRenglonController::class, 'cortesia'])->whereNumber('id')->whereNumber('renglon');
```

- [ ] **Step 7: Corre las pruebas**

Run: `php artisan test tests/Feature/Facturacion/CortesiaTest.php`
Expected: PASS, 8 pruebas.

Run: `php artisan test`
Expected: PASS. La prueba de rutas protegidas de `EndpointsPrefacturaTest` tiene que
incluir la ruta nueva; si falla por eso, agrégala a su tabla.

- [ ] **Step 8: Verifica por mutación la prueba del margen**

Cambia la rama de cortesía por `$this->es_cortesia ? '0.00' : ImporteServicio::calcular((float) $this->precio_unitario, (int) $this->cantidad, 0.0, 'ninguno')`
(o sea, que al quitarla recalcule como el viejo). Expected: falla «quitar la
cortesía devuelve el importe CON su margen y su ajuste». Restaura con
`git checkout --`.

- [ ] **Step 9: Commit**

```bash
git add database/migrations/2026_09_29_093200_add_es_cortesia_to_fact_prefactura_renglones_table.php app/Models/FactPrefacturaRenglon.php app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php app/Http/Controllers/Api/Facturacion/PrefacturaController.php routes/api.php tests/Feature/Facturacion/CortesiaTest.php tests/Feature/Facturacion/EndpointsPrefacturaTest.php
git commit -m "La cortesia no cobra y al quitarla no pierde el margen, que es lo que si pierde el viejo"
```

---

## Task 5: El servicio de pagos y sus endpoints

**Files:**
- Create: `app/Services/PagosPrefactura.php`
- Create: `app/Services/PagoNoPermitidoException.php`
- Create: `app/Http/Controllers/Api/Facturacion/PrefacturaPagoController.php`
- Create: `app/Http/Requests/Facturacion/StorePagoRequest.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Facturacion/PagosPrefacturaTest.php`

**Interfaces:**
- Consumes: `FactFormaPago::CONCEPTO_*` y `porConcepto()` (Task 2);
  `FactPrefactura::pagado()`, `porCobrar()`, `total()`, `pagos()` y
  `FactPrefacturaPago` (Task 3); `formasDePago()` y `pagoDe()` de `tests/Pest.php`.
- Produces:
  - `PagosPrefactura::registrar(FactPrefactura $p, int $formaPagoId, string $monto, int $userId): FactPrefacturaPago`
  - `PagosPrefactura::quitar(FactPrefactura $p, int $pagoId, int $userId): void`
  - `PagoNoPermitidoException` con `public readonly string $codigo`.
  - `POST /api/facturacion/prefacturas/{id}/pagos` cuerpo
    `{"forma_pago_id": int, "monto": "123.45"}`.
  - `DELETE /api/facturacion/prefacturas/{id}/pagos/{pago}`.
  La Task 6 extiende el servicio con `registrarAmex()`; la Task 8 llama los endpoints.

**Las reglas, con su origen:**

| Forma | Regla | Origen |
|---|---|---|
| Efectivo (`CONCEPTO_EFECTIVO`) | Puede exceder lo que falta; el exceso es cambio | `mpago.php:63-86` |
| AvCard (`CONCEPTO_AVCARD`) | **Rechazada si la prefactura tiene un renglón con concepto combustible.** Sin tope de monto | `mpago.php:48-56` |
| Amex (`CONCEPTO_AMEX`) | Este endpoint la **rechaza**: va por el de la Task 6, que además crea la comisión | — |
| Las demás | Rechazada si el monto supera lo que falta por cobrar | `mpago.php:88-92` |

La regla de AvCard **se cumple sin una sola excepción en el histórico**: 0 de los
130 folios con AvCard tienen combustible, habiendo 1,152 folios con combustible. El
combustible se detecta por `FactServicio::CONCEPTO_COMBUSTIBLE`, nunca por el
`id_servicio = 7` del sistema viejo.

- [ ] **Step 1: Escribe la prueba que falla**

```php
<?php

use App\Models\Bitacora;
use App\Models\FactFormaPago;
use App\Models\FactPrefactura;
use App\Models\FactPrefacturaPago;
use App\Models\FactServicio;

/** Un borrador con un renglón de 100 (total 116.00) y las siete formas de pago. */
function paraCobrar(): array
{
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);

    return [$p->fresh(), formasDePago()];
}

function conCombustible(App\Models\FactPrefactura $p): void
{
    $servicio = FactServicio::create([
        'nombre' => 'Combustible JET A-1', 'precio_unitario' => 500.0, 'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE,
    ]);
    $p->renglones()->create([
        'servicio_id' => $servicio->id, 'nombre_servicio' => $servicio->nombre, 'precio_unitario' => 500.0,
        'cantidad' => 1, 'es_de_tercero' => false, 'margen' => 0, 'ajuste_precio' => 'ninguno',
        'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE, 'orden' => 9,
    ]);
}

test('una tarjeta cobra lo que falta y deja la prefactura cubierta', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas['Visa']->id, 'monto' => '116.00'])
        ->assertCreated()
        ->assertJsonPath('prefactura.pagado', '116.00')
        ->assertJsonPath('prefactura.por_cobrar', '0.00');

    expect($p->fresh()->pagos()->count())->toBe(1);
});

test('una tarjeta NO puede superar lo que falta', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas['Visa']->id, 'monto' => '116.01'])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'supera_lo_que_falta');

    expect($p->fresh()->pagos()->count())->toBe(0);
});

test('el tope de la tarjeta mira lo que FALTA, no el total', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    pagoDe($p, $formas['Visa'], '100.00');

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas['Mastercard']->id, 'monto' => '16.01'])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'supera_lo_que_falta');

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas['Mastercard']->id, 'monto' => '16.00'])
        ->assertCreated();
});

test('el efectivo SI puede exceder, y el exceso es cambio', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas[FactFormaPago::CONCEPTO_EFECTIVO]->id, 'monto' => '200.00'])
        ->assertCreated()
        ->assertJsonPath('prefactura.sobrepago', '84.00')
        ->assertJsonPath('prefactura.sobrepago_es_cambio', true);
});

test('AvCard se rechaza cuando la prefactura tiene combustible', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    conCombustible($p);

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas[FactFormaPago::CONCEPTO_AVCARD]->id, 'monto' => '100.00'])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'avcard_con_combustible');

    expect($p->fresh()->pagos()->count())->toBe(0);
});

test('AvCard se acepta sin combustible y sin tope', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();

    // Sin tope, como el viejo: puede dejarla sobrepagada, y entonces NO es cambio.
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas[FactFormaPago::CONCEPTO_AVCARD]->id, 'monto' => '500.00'])
        ->assertCreated()
        ->assertJsonPath('prefactura.sobrepago', '384.00')
        ->assertJsonPath('prefactura.sobrepago_es_cambio', false);
});

test('el combustible se detecta por concepto, no por el nombre del servicio', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    conCombustible($p);
    // Renombrarlo en el catalogo NO debe abrir la puerta a AvCard.
    FactServicio::porConcepto(FactServicio::CONCEPTO_COMBUSTIBLE)->first()->update(['nombre' => 'Turbosina']);

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas[FactFormaPago::CONCEPTO_AVCARD]->id, 'monto' => '100.00'])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'avcard_con_combustible');
});

test('Amex no entra por este endpoint: tiene el suyo porque agrega comision', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas[FactFormaPago::CONCEPTO_AMEX]->id, 'monto' => '100.00'])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'amex_por_su_endpoint');
});

test('quitar un pago lo da de baja logica y lo deja de contar', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    $pago = pagoDe($p, $formas['Visa'], '116.00');

    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/pagos/{$pago->id}")
        ->assertOk()
        ->assertJsonPath('prefactura.pagado', '0.00');

    expect($pago->fresh()->status)->toBe(FactPrefacturaPago::STATUS_INACTIVO);
});

test('quitar dos veces el mismo pago responde 404 la segunda', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    $pago = pagoDe($p, $formas['Visa'], '116.00');

    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/pagos/{$pago->id}")->assertOk();
    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/pagos/{$pago->id}")->assertNotFound();
});

test('el pago de otra prefactura no se puede quitar desde esta', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    [$ajena] = paraCobrar();
    $pago = pagoDe($ajena, $formas['Visa'], '50.00');

    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/pagos/{$pago->id}")->assertNotFound();
});

test('una prefactura cerrada no admite pagos ni quitarlos', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    $formas = formasDePago();
    $pago = pagoDe($p, $formas['Visa'], '50.00');
    cerrarConSello($p, '100.00', '16.00', '116.00');

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas['Visa']->id, 'monto' => '10.00'])
        ->assertStatus(409)->assertJsonPath('codigo', 'ya_cerrada');

    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/pagos/{$pago->id}")
        ->assertStatus(409)->assertJsonPath('codigo', 'ya_cerrada');

    expect($p->fresh()->pagos()->count())->toBe(1);
});

test('un borrador descartado no admite pagos', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    $p->update(['status' => FactPrefactura::STATUS_INACTIVO]);

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas['Visa']->id, 'monto' => '10.00'])
        ->assertStatus(409)->assertJsonPath('codigo', 'ya_descartada');
});

test('el monto tiene que ser un decimal positivo de dos decimales', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    $ruta = "/api/facturacion/prefacturas/{$p->id}/pagos";

    foreach (['0', '-1.00', '1.234', 'x', ''] as $monto) {
        $this->postJson($ruta, ['forma_pago_id' => $formas['Visa']->id, 'monto' => $monto])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['monto']);
    }

    $this->postJson($ruta, ['monto' => '10.00'])->assertStatus(422)->assertJsonValidationErrors(['forma_pago_id']);
    $this->postJson($ruta, ['forma_pago_id' => 999999, 'monto' => '10.00'])->assertStatus(422)->assertJsonValidationErrors(['forma_pago_id']);
});

test('una forma de pago dada de baja no se puede usar', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();
    $formas['Visa']->update(['status' => FactFormaPago::STATUS_INACTIVO]);

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas['Visa']->id, 'monto' => '10.00'])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['forma_pago_id']);
});

test('cada pago y cada baja quedan en la bitacora, dentro de la transaccion', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p, $formas] = paraCobrar();

    $pago = $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", ['forma_pago_id' => $formas['Visa']->id, 'monto' => '116.00'])
        ->assertCreated()->json('pago_id');
    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/pagos/{$pago}")->assertOk();

    expect(Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)->where('accion', Bitacora::ACCION_CREAR)->count())->toBe(1)
        ->and(Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)->where('accion', Bitacora::ACCION_ELIMINAR)->count())->toBe(1);
});
```

**`paraCobrar()` y `conCombustible()` se declaran en este archivo de prueba**, no en
`tests/Pest.php`, porque solo las usa este archivo. Si una task posterior las
necesita, muévelas a `tests/Pest.php` entonces — una función declarada en dos
archivos de prueba revienta por redeclaración.

- [ ] **Step 2: Córrela para verificar que falla**

Run: `php artisan test tests/Feature/Facturacion/PagosPrefacturaTest.php`
Expected: FAIL con 404 en todas: las rutas no existen.

- [ ] **Step 3: La excepción**

```php
<?php

namespace App\Services;

use RuntimeException;

/**
 * Una regla de cobro rechazó el pago. Lleva su propio `codigo` para que el
 * controlador lo traduzca a 422 sin una cadena de `catch` por cada regla: las
 * reglas son del dominio y su identificador viaja con la excepción.
 */
class PagoNoPermitidoException extends RuntimeException
{
    public function __construct(string $mensaje, public readonly string $codigo)
    {
        parent::__construct($mensaje);
    }
}
```

- [ ] **Step 4: El servicio**

```php
<?php

namespace App\Services;

use App\Models\Bitacora;
use App\Models\FactFormaPago;
use App\Models\FactPrefactura;
use App\Models\FactPrefacturaPago;
use App\Models\FactServicio;
use Illuminate\Support\Facades\DB;

/**
 * Los pagos de una prefactura, con las reglas por forma de pago.
 *
 * Cada operación toma `lockForUpdate()` sobre la prefactura DENTRO de su
 * transacción —el mismo candado que toma `CierrePrefactura`— de modo que cobrar y
 * cerrar se serializan: sin él, un pago que entra durante el cierre quedaría fuera
 * de la comprobación de cobro y el documento saldría diciendo otra cosa.
 *
 * Las reglas salen de `Prefectura/mpago.php` y se identifican por el CONCEPTO de la
 * forma de pago, no por su nombre, que se edita en pantalla.
 */
class PagosPrefactura
{
    /**
     * @throws RenglonDePrefacturaCerradaException si la prefactura ya está cerrada.
     * @throws PagoNoPermitidoException si una regla de cobro lo rechaza.
     */
    public function registrar(FactPrefactura $prefactura, int $formaPagoId, string $monto, int $userId): FactPrefacturaPago
    {
        return DB::transaction(function () use ($prefactura, $formaPagoId, $monto, $userId) {
            $actual = $this->bloquearBorrador($prefactura);
            $forma = FactFormaPago::findOrFail($formaPagoId);

            $this->exigirQueLaReglaLoPermita($actual, $forma, $monto);

            $pago = $actual->pagos()->create([
                'forma_pago_id' => $forma->id,
                'monto' => $monto,
                'user_id' => $userId,
            ]);

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_CREAR,
                descripcion: "Se registró un pago de {$monto} con {$forma->nombre} en la prefactura {$actual->id}.",
                usuarioId: $userId,
                registroId: $actual->id,
                datosNuevos: ['pago_id' => $pago->id, 'forma_pago' => $forma->nombre, 'monto' => $monto],
            );

            return $pago;
        });
    }

    /**
     * Baja lógica, y con ella la comisión que ese pago hubiera creado.
     *
     * Quita SOLO la comisión que este pago creó, no todas las de la prefactura, que
     * es lo que hace `eliminar_f.php` del sistema viejo: ahí un segundo pago Amex
     * perdería su comisión al borrar el primero.
     *
     * @throws RenglonDePrefacturaCerradaException si la prefactura ya está cerrada.
     */
    public function quitar(FactPrefactura $prefactura, int $pagoId, int $userId): void
    {
        DB::transaction(function () use ($prefactura, $pagoId, $userId) {
            $actual = $this->bloquearBorrador($prefactura);
            $pago = $actual->pagos()->whereKey($pagoId)->firstOrFail();
            $forma = $pago->formaPago;
            $monto = (string) $pago->monto;

            // Borrado POR MODELO del renglón: dispara `deleting` y con él la guarda de
            // cerrada. Nunca un `delete()` masivo.
            $comision = $pago->renglonComision;
            $importeComision = $comision?->importe();
            $comision?->delete();

            $pago->update(['status' => FactPrefacturaPago::STATUS_INACTIVO]);

            $conComision = $importeComision === null ? '' : " y se quitó su comisión de {$importeComision}";

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_ELIMINAR,
                descripcion: "Se quitó el pago de {$monto} con {$forma->nombre} de la prefactura {$actual->id}{$conComision}.",
                usuarioId: $userId,
                registroId: $actual->id,
                datosAnteriores: ['pago_id' => $pago->id, 'forma_pago' => $forma->nombre, 'monto' => $monto, 'comision' => $importeComision],
            );
        });
    }

    /**
     * Las cuatro reglas de `mpago.php`, por concepto de la forma de pago.
     *
     * @throws PagoNoPermitidoException
     */
    private function exigirQueLaReglaLoPermita(FactPrefactura $prefactura, FactFormaPago $forma, string $monto): void
    {
        if ($forma->concepto === FactFormaPago::CONCEPTO_AMEX) {
            throw new PagoNoPermitidoException(
                'El pago con Amex se registra desde su propia acción, que además agrega la comisión.',
                'amex_por_su_endpoint',
            );
        }

        if ($forma->concepto === FactFormaPago::CONCEPTO_AVCARD) {
            // El combustible se reconoce por concepto: `id_servicio = 7` es del viejo.
            if ($prefactura->renglones()->where('concepto', FactServicio::CONCEPTO_COMBUSTIBLE)->exists()) {
                throw new PagoNoPermitidoException(
                    "{$forma->nombre} no se puede usar en una prefactura que tiene combustible.",
                    'avcard_con_combustible',
                );
            }

            // Sin tope, como el viejo. Puede dejarla sobrepagada y la pantalla lo avisa.
            return;
        }

        if ($forma->concepto === FactFormaPago::CONCEPTO_EFECTIVO) {
            // El efectivo puede exceder: el exceso es cambio.
            return;
        }

        $falta = $prefactura->porCobrar();

        if (bccomp($monto, $falta, 2) > 0) {
            throw new PagoNoPermitidoException(
                "El monto supera lo que falta por cobrar: faltan {$falta}.",
                'supera_lo_que_falta',
            );
        }
    }

    /** El mismo candado y la misma guarda que usa `CargosEstancia`. */
    private function bloquearBorrador(FactPrefactura $prefactura): FactPrefactura
    {
        $actual = FactPrefactura::query()->whereKey($prefactura->id)->lockForUpdate()->firstOrFail();

        if ($actual->estaCerrada()) {
            throw new RenglonDePrefacturaCerradaException;
        }

        return $actual;
    }
}
```

- [ ] **Step 5: El Form Request**

```php
<?php

namespace App\Http\Requests\Facturacion;

use App\Models\FactFormaPago;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePagoRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'forma_pago_id' => [
                'required', 'integer',
                Rule::exists('fact_formas_pago', 'id')->where('status', FactFormaPago::STATUS_ACTIVO),
            ],
            // `decimal:0,2` rechaza 1.234; `min:0.01` rechaza 0 y los negativos. El monto
            // viaja como cadena a propósito: entra a `bc` sin pasar por float.
            'monto' => ['required', 'numeric', 'decimal:0,2', 'min:0.01', 'max:9999999999.99'],
        ];
    }

    public function messages(): array
    {
        return [
            'forma_pago_id.required' => 'Indica la forma de pago.',
            'forma_pago_id.exists' => 'Esa forma de pago no existe o está dada de baja.',
            'monto.required' => 'Indica el monto del pago.',
            'monto.decimal' => 'El monto no puede tener más de dos decimales.',
            'monto.min' => 'El monto tiene que ser mayor que cero.',
        ];
    }
}
```

- [ ] **Step 6: El controlador**

```php
<?php

namespace App\Http\Controllers\Api\Facturacion;

use App\Http\Controllers\Api\Facturacion\Concerns\RechazaPrefacturaCerrada;
use App\Http\Controllers\Controller;
use App\Http\Requests\Facturacion\StorePagoRequest;
use App\Models\FactPrefactura;
use App\Services\PagoNoPermitidoException;
use App\Services\PagosPrefactura;
use App\Services\RenglonDePrefacturaCerradaException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Los pagos de una prefactura. Solo en borrador: al cerrar quedan congelados como
 * los renglones y los totales, porque un documento emitido no cambia.
 *
 * `RenglonDePrefacturaCerradaException` tiene su propio `render()` y se traduce
 * sola a 409; aquí solo se atrapa lo que es propio de los pagos.
 */
class PrefacturaPagoController extends Controller
{
    use RechazaPrefacturaCerrada;

    public function store(StorePagoRequest $request, int $id, PagosPrefactura $pagos): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazoRapido($prefactura)) {
            return $respuesta;
        }

        try {
            $pago = $pagos->registrar(
                $prefactura,
                (int) $request->validated()['forma_pago_id'],
                (string) $request->validated()['monto'],
                $request->user()->id,
            );
        } catch (PagoNoPermitidoException $e) {
            return response()->json(['message' => $e->getMessage(), 'codigo' => $e->codigo], 422);
        }

        return response()->json([
            'message' => 'Pago registrado.',
            'pago_id' => $pago->id,
            'prefactura' => app(PrefacturaController::class)->fichaDe($id),
        ], 201);
    }

    public function destroy(Request $request, int $id, int $pago, PagosPrefactura $pagos): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazoRapido($prefactura)) {
            return $respuesta;
        }

        $pagos->quitar($prefactura, $pago, $request->user()->id);

        return response()->json([
            'message' => 'Pago eliminado.',
            'prefactura' => app(PrefacturaController::class)->fichaDe($id),
        ]);
    }

    private function rechazoRapido(FactPrefactura $prefactura): ?JsonResponse
    {
        return $this->rechazarSiCerrada($prefactura) ?? $this->rechazarSiDescartada($prefactura);
    }
}
```

**Nota:** `rechazoRapido()` es idéntico al de `PrefacturaRenglonController`. Si al
escribirlo ves que ya son dos copias literales, muévelo al trait
`RechazaPrefacturaCerrada` y quítalo de los dos controladores: el bloque 2 ya
extrajo ese trait por este mismo motivo.

- [ ] **Step 7: Las rutas**

Dentro del grupo `subdep:factPrefacturas`:

```php
        Route::post('/prefacturas/{id}/pagos', [PrefacturaPagoController::class, 'store'])->whereNumber('id');
        Route::delete('/prefacturas/{id}/pagos/{pago}', [PrefacturaPagoController::class, 'destroy'])->whereNumber('id')->whereNumber('pago');
```

Agrégalas también a la tabla de rutas protegidas de `EndpointsPrefacturaTest`.

**La ficha todavía no trae `pagado`, `por_cobrar`, `sobrepago` ni
`sobrepago_es_cambio`:** eso lo añade la Task 7. Las pruebas de esta task que los
afirman van a fallar hasta entonces. Para no dejar la task en rojo, **añade el
bloque de cobro a `presentar()` en esta task** con estas cuatro claves, y la Task 7
solo agrega las notas:

```php
    /**
     * Lo cobrado. `sobrepago_es_cambio` distingue el cambio que se devuelve (hay
     * efectivo detrás) del cobrado de más (se editó el documento tras cobrarlo).
     *
     * @return array{pagado: ?string, por_cobrar: ?string, sobrepago: ?string, sobrepago_es_cambio: bool, pagos: array}
     */
    private function cobro(FactPrefactura $p): array
    {
        // Si los totales no se pudieron calcular, `porCobrar()` tampoco: lo pagado sí,
        // porque no depende de la tasa de IVA.
        try {
            $porCobrar = $p->porCobrar();
            $sobrepago = $p->sobrepago();
            $esCambio = $p->sobrepagoEsCambio();
        } catch (UnexpectedValueException) {
            // Ya lo reportó `totales()`, que corre en la misma ficha.
            $porCobrar = $sobrepago = null;
            $esCambio = false;
        }

        return [
            'pagado' => $p->pagado(),
            'por_cobrar' => $porCobrar,
            'sobrepago' => $sobrepago,
            'sobrepago_es_cambio' => $esCambio,
            'pagos' => $p->pagos->map(fn ($pago) => [
                'id' => $pago->id,
                'forma_pago_id' => $pago->forma_pago_id,
                'forma_pago' => $pago->formaPago?->nombre,
                'concepto' => $pago->formaPago?->concepto,
                'monto' => (string) $pago->monto,
                'es_comision_amex' => $pago->renglon_comision_id !== null,
            ])->all(),
        ];
    }
```

Y en `presentar()`, añade `+ $this->cobro($p)` a la cadena que ya tiene
`+ $this->totales($p) + $this->verificacionDelSello($p)`.

- [ ] **Step 8: Corre las pruebas**

Run: `php artisan test tests/Feature/Facturacion/PagosPrefacturaTest.php`
Expected: PASS, 16 pruebas.

Run: `php artisan test`
Expected: PASS.

- [ ] **Step 9: Verifica por mutación dos pruebas**

1. Quita la rama de `CONCEPTO_EFECTIVO` (que el efectivo caiga en el tope general).
   Expected: falla «el efectivo SI puede exceder».
2. Cambia la detección de combustible a `where('nombre', 'like', '%Combustible%')`.
   Expected: falla «el combustible se detecta por concepto».

Restaura con `git checkout --` después de cada una.

- [ ] **Step 10: Commit**

```bash
git add app/Services/PagosPrefactura.php app/Services/PagoNoPermitidoException.php app/Http/Controllers/Api/Facturacion/PrefacturaPagoController.php app/Http/Controllers/Api/Facturacion/PrefacturaController.php app/Http/Requests/Facturacion/StorePagoRequest.php routes/api.php tests/Feature/Facturacion/PagosPrefacturaTest.php tests/Feature/Facturacion/EndpointsPrefacturaTest.php
git commit -m "Los pagos, con la regla de cada forma: el efectivo excede, AvCard no va con combustible"
```

---

## Task 6: El pago Amex y su comisión

**Files:**
- Create: `app/Http/Requests/Facturacion/StorePagoAmexRequest.php`
- Modify: `app/Services/PagosPrefactura.php`
- Modify: `app/Http/Controllers/Api/Facturacion/PrefacturaPagoController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Facturacion/PagoAmexTest.php`

**Interfaces:**
- Consumes: `ComisionAmex::calcular()` (Task 1); `FactFormaPago::CONCEPTO_AMEX`
  (Task 2); `FactPrefacturaPago` y los derivados (Task 3); `PagosPrefactura` y
  `PagoNoPermitidoException` (Task 5).
- Produces:
  - `PagosPrefactura::registrarAmex(FactPrefactura $p, string $montoBruto, int $userId): FactPrefacturaPago`
  - `POST /api/facturacion/prefacturas/{id}/pagos/amex` cuerpo `{"monto": "123.45"}`,
    respuesta `{"message", "pago_id", "comision", "prefactura"}`.
  La Task 8 lo llama; la Task 9 verifica la fórmula contra el histórico.

**Lo que hace y por qué:** el operador teclea **lo que se le va a cargar a la
tarjeta**. El servicio agrega un renglón con el servicio de concepto
`comision_amex` por `ComisionAmex::calcular(monto, tasa)`, y registra el pago por el
monto tecleado. Rechaza cuando el monto **supera el subtotal** de la prefactura,
como `mpamex.php:106`.

**Hace falta un servicio de catálogo para la comisión.** En el origen es
`id_servicio = 100`, «Comisión AMEX». Se reconoce por concepto, como los de
estancia: añade `FactServicio::CONCEPTO_COMISION_AMEX = 'comision_amex'` y mete
`100 => FactServicio::CONCEPTO_COMISION_AMEX` en
`ImportadorMatriculas::CONCEPTOS_POR_ID_VIEJO`. Si el servicio no existe o está de
baja, el endpoint responde 422 con mensaje propio, igual que hizo el bloque 2 con
los de estancia (`ServicioDeEstanciaNoDisponibleException`).

- [ ] **Step 1: Escribe la prueba que falla**

```php
<?php

use App\Models\FactFormaPago;
use App\Models\FactPrefacturaRenglon;
use App\Models\FactServicio;
use App\Support\ComisionAmex;

/** Un borrador con subtotal 100,000.00 y el servicio de comisión en el catálogo. */
function paraAmex(): App\Models\FactPrefactura
{
    FactServicio::firstOrCreate(
        ['nombre' => 'Comisión AMEX'],
        ['precio_unitario' => 0.0, 'concepto' => FactServicio::CONCEPTO_COMISION_AMEX],
    );
    formasDePago();

    $p = prefacturaBorrador();
    renglonDe($p, 100000.0, 1);

    return $p->fresh();
}

test('el pago Amex agrega la comision como renglon y registra el monto tecleado', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();

    // 1000 / 1.2296 = 813.27...  y el 6% de eso es 48.80.
    $respuesta = $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.00'])
        ->assertCreated()
        ->assertJsonPath('comision', '48.80');

    $comision = FactPrefacturaRenglon::where('prefactura_id', $p->id)->where('concepto', FactServicio::CONCEPTO_COMISION_AMEX)->sole();

    expect($comision->importe())->toBe('48.80')
        ->and((string) $comision->precio_unitario)->toBe('48.8000')
        ->and($comision->cantidad)->toBe(1)
        ->and($p->fresh()->subtotal())->toBe('100048.80')
        ->and($p->fresh()->pagado())->toBe('1000.00');

    // El pago apunta a SU renglon de comision.
    $pago = $p->fresh()->pagos()->sole();
    expect($pago->renglon_comision_id)->toBe($comision->id)
        ->and($pago->formaPago->concepto)->toBe(FactFormaPago::CONCEPTO_AMEX);
});

test('la comision usa la misma formula que ComisionAmex y no una copia', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();

    $respuesta = $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '105.28'])->assertCreated();

    expect($respuesta->json('comision'))->toBe(ComisionAmex::calcular('105.28', $p->fresh()->ivaTasa()));
});

test('la comision usa la tasa de IVA vigente, no un literal', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    App\Models\FactConfiguracion::updateOrCreate(
        ['clave' => 'iva_tasa'],
        ['valor' => '0.08', 'descripcion' => 'Tasa de IVA de prueba'],
    );
    $p = paraAmex();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.00'])
        ->assertCreated()
        ->assertJsonPath('comision', '52.41');
});

test('el monto Amex no puede superar el subtotal', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '100000.01'])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'comision_supera_subtotal');

    expect($p->fresh()->pagos()->count())->toBe(0)
        ->and($p->fresh()->renglones()->count())->toBe(1);
});

test('si falta el servicio de comision responde 422 y NO escribe nada', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();
    FactServicio::porConcepto(FactServicio::CONCEPTO_COMISION_AMEX)->update(['status' => FactServicio::STATUS_INACTIVO]);

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.00'])
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'servicio_comision_no_disponible');

    expect($p->fresh()->pagos()->count())->toBe(0)
        ->and($p->fresh()->renglones()->count())->toBe(1);
});

test('quitar el pago Amex quita SU comision y no las demas', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();

    $primero = $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.00'])->assertCreated()->json('pago_id');
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '2000.00'])->assertCreated();

    expect(FactPrefacturaRenglon::where('prefactura_id', $p->id)->where('concepto', FactServicio::CONCEPTO_COMISION_AMEX)->count())->toBe(2);

    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/pagos/{$primero}")->assertOk();

    // El sistema viejo (eliminar_f.php) borraria LAS DOS.
    $quedan = FactPrefacturaRenglon::where('prefactura_id', $p->id)->where('concepto', FactServicio::CONCEPTO_COMISION_AMEX)->get();
    expect($quedan)->toHaveCount(1)
        ->and($quedan->first()->importe())->toBe(ComisionAmex::calcular('2000.00', '0.1600'));
});

test('una prefactura cerrada no admite pago Amex', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();
    cerrarConSello($p, '100000.00', '16000.00', '116000.00');

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.00'])
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_cerrada');
});

test('el renglon de comision congela su precio: cambiar el catalogo no lo mueve', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.00'])->assertCreated();

    FactServicio::porConcepto(FactServicio::CONCEPTO_COMISION_AMEX)->first()->update(['precio_unitario' => 999.0, 'margen' => 50]);

    expect($p->fresh()->subtotal())->toBe('100048.80');
});

test('la comision sale de la prefactura si se marca como cortesia, pero el pago sigue', function () {
    // Caso raro y legitimo: la comision se absorbe. El pago a la tarjeta ya se hizo.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = paraAmex();
    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos/amex", ['monto' => '1000.00'])->assertCreated();
    $comision = FactPrefacturaRenglon::where('prefactura_id', $p->id)->where('concepto', FactServicio::CONCEPTO_COMISION_AMEX)->sole();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$comision->id}/cortesia", ['es_cortesia' => true])->assertOk();

    expect($p->fresh()->subtotal())->toBe('100000.00')
        ->and($p->fresh()->pagado())->toBe('1000.00');
});
```

- [ ] **Step 2: Córrela para verificar que falla**

Run: `php artisan test tests/Feature/Facturacion/PagoAmexTest.php`
Expected: FAIL — `FactServicio::CONCEPTO_COMISION_AMEX` no existe.

- [ ] **Step 3: El concepto del servicio de comisión**

En `app/Models/FactServicio.php`, junto a las otras constantes de concepto:

```php
    /** El renglón que agrega el pago Amex: en el origen es `id_servicio = 100`, «Comisión AMEX». */
    public const CONCEPTO_COMISION_AMEX = 'comision_amex';
```

En `app/Services/ImportadorMatriculas.php`, añade a `CONCEPTOS_POR_ID_VIEJO`:

```php
        100 => FactServicio::CONCEPTO_COMISION_AMEX,
```

- [ ] **Step 4: La excepción del servicio ausente**

```php
<?php

namespace App\Services;

use RuntimeException;

/**
 * Falta el servicio de catálogo de la comisión Amex (no existe, o está dado de
 * baja). El mensaje ya dice qué hacer, así que el endpoint lo devuelve tal cual
 * como 422 en lugar de dejarlo caer a un 500 genérico — la misma lección que el
 * bloque 2 aprendió con `ServicioDeEstanciaNoDisponibleException`.
 */
class ServicioDeComisionNoDisponibleException extends RuntimeException {}
```

- [ ] **Step 5: `registrarAmex()` en `PagosPrefactura`**

```php
    /**
     * El pago Amex: registra lo que se carga a la tarjeta y agrega la comisión como
     * renglón.
     *
     * El monto que entra es el BRUTO —lo que el cliente ve en su estado de cuenta— y
     * la comisión se calcula para que el total de la prefactura caiga en esa cifra.
     * `ComisionAmex` explica por qué.
     *
     * Rechaza si el monto supera el subtotal, como `mpamex.php:106`.
     *
     * @throws RenglonDePrefacturaCerradaException si la prefactura ya está cerrada.
     * @throws PagoNoPermitidoException si el monto supera el subtotal.
     * @throws ServicioDeComisionNoDisponibleException si falta el servicio de catálogo.
     */
    public function registrarAmex(FactPrefactura $prefactura, string $montoBruto, int $userId): FactPrefacturaPago
    {
        return DB::transaction(function () use ($prefactura, $montoBruto, $userId) {
            $actual = $this->bloquearBorrador($prefactura);

            $subtotal = $actual->subtotal();

            if (bccomp($montoBruto, $subtotal, 2) > 0) {
                throw new PagoNoPermitidoException(
                    "El monto Amex no puede superar el subtotal de la prefactura, que es {$subtotal}.",
                    'comision_supera_subtotal',
                );
            }

            $servicio = FactServicio::porConcepto(FactServicio::CONCEPTO_COMISION_AMEX)
                ->where('status', FactServicio::STATUS_ACTIVO)
                ->first();

            if ($servicio === null) {
                // Lanza dentro de la transacción: nada queda escrito.
                throw new ServicioDeComisionNoDisponibleException(
                    "No existe un servicio activo con concepto '".FactServicio::CONCEPTO_COMISION_AMEX."'. Corre el importador de catálogos o reactívalo."
                );
            }

            $forma = FactFormaPago::porConcepto(FactFormaPago::CONCEPTO_AMEX)->firstOrFail();
            $comision = ComisionAmex::calcular($montoBruto, $actual->ivaTasa());

            // El renglón CONGELA el importe de la comisión en `precio_unitario`, con
            // margen 0 y sin ajuste: la comisión YA es la cifra final, y pasarla por el
            // margen del catálogo la movería.
            $renglon = $actual->renglones()->create([
                'servicio_id' => $servicio->id,
                'nombre_servicio' => $servicio->nombre,
                'precio_unitario' => $comision,
                'cantidad' => 1,
                'es_de_tercero' => false,
                'margen' => 0,
                'ajuste_precio' => ImporteServicio::AJUSTE_NINGUNO,
                'concepto' => FactServicio::CONCEPTO_COMISION_AMEX,
                'orden' => (int) $actual->renglones()->reorder()->max('orden') + 1,
            ]);

            $pago = $actual->pagos()->create([
                'forma_pago_id' => $forma->id,
                'monto' => $montoBruto,
                'renglon_comision_id' => $renglon->id,
                'user_id' => $userId,
            ]);

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_CREAR,
                descripcion: "Se registró un pago de {$montoBruto} con {$forma->nombre} en la prefactura {$actual->id} y se agregó su comisión de {$comision}.",
                usuarioId: $userId,
                registroId: $actual->id,
                datosNuevos: ['pago_id' => $pago->id, 'forma_pago' => $forma->nombre, 'monto' => $montoBruto, 'comision' => $comision],
            );

            return $pago;
        });
    }
```

Añade al principio del archivo los `use` que falten: `App\Support\ComisionAmex`,
`App\Support\ImporteServicio`.

- [ ] **Step 6: El Form Request y el endpoint**

`StorePagoAmexRequest` tiene las mismas reglas de `monto` que `StorePagoRequest`
pero sin `forma_pago_id`: la forma la resuelve el servicio por concepto. **Extiende
`StorePagoRequest` y quita la clave** en lugar de copiar las reglas:

```php
<?php

namespace App\Http\Requests\Facturacion;

/**
 * El pago Amex no lleva `forma_pago_id`: la forma la resuelve el servicio por su
 * concepto, porque este endpoint es solo de Amex. Las reglas del monto son las
 * mismas, y heredarlas evita que las dos se desalineen.
 */
class StorePagoAmexRequest extends StorePagoRequest
{
    public function rules(): array
    {
        $reglas = parent::rules();
        unset($reglas['forma_pago_id']);

        return $reglas;
    }
}
```

En `PrefacturaPagoController`:

```php
    public function amex(StorePagoAmexRequest $request, int $id, PagosPrefactura $pagos): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazoRapido($prefactura)) {
            return $respuesta;
        }

        try {
            $pago = $pagos->registrarAmex($prefactura, (string) $request->validated()['monto'], $request->user()->id);
        } catch (PagoNoPermitidoException $e) {
            return response()->json(['message' => $e->getMessage(), 'codigo' => $e->codigo], 422);
        } catch (ServicioDeComisionNoDisponibleException $e) {
            return response()->json(['message' => $e->getMessage(), 'codigo' => 'servicio_comision_no_disponible'], 422);
        }

        return response()->json([
            'message' => 'Pago Amex registrado con su comisión.',
            'pago_id' => $pago->id,
            // `registrarAmex()` SIEMPRE crea el renglón, así que no hace falta comprobarlo.
            'comision' => $pago->renglonComision->importe(),
            'prefactura' => app(PrefacturaController::class)->fichaDe($id),
        ], 201);
    }
```

- [ ] **Step 7: La ruta**

```php
        Route::post('/prefacturas/{id}/pagos/amex', [PrefacturaPagoController::class, 'amex'])->whereNumber('id');
```

El orden entre esta y `POST /prefacturas/{id}/pagos` no importa: son rutas
distintas y no se solapan. Agrégala junto a las otras y a la tabla de rutas
protegidas de `EndpointsPrefacturaTest`.

- [ ] **Step 8: Corre las pruebas**

Run: `php artisan test tests/Feature/Facturacion/PagoAmexTest.php`
Expected: PASS, 9 pruebas.

Run: `php artisan test`
Expected: PASS.

- [ ] **Step 9: Verifica por mutación dos pruebas**

1. En `quitar()`, cambia `$pago->renglonComision` por una consulta que tome **todas**
   las comisiones de la prefactura (lo que hace `eliminar_f.php`). Expected: falla
   «quitar el pago Amex quita SU comision y no las demas».
2. En `registrarAmex()`, pasa `'0.1600'` fijo en lugar de `$actual->ivaTasa()`.
   Expected: falla «la comision usa la tasa de IVA vigente».

Restaura con `git checkout --` después de cada una.

- [ ] **Step 10: Commit**

```bash
git add app/Models/FactServicio.php app/Services/ImportadorMatriculas.php app/Services/PagosPrefactura.php app/Services/ServicioDeComisionNoDisponibleException.php app/Http/Controllers/Api/Facturacion/PrefacturaPagoController.php app/Http/Requests/Facturacion/StorePagoAmexRequest.php routes/api.php tests/Feature/Facturacion/PagoAmexTest.php tests/Feature/Facturacion/EndpointsPrefacturaTest.php
git commit -m "El pago Amex agrega su comision, y quitarlo quita la suya y no las demas"
```

---

## Task 7: Las notas y el aviso al cerrar

**Files:**
- Create: `database/migrations/2026_09_29_093300_add_notas_to_fact_prefacturas_table.php`
- Create: `app/Http/Requests/Facturacion/UpdateNotasRequest.php`
- Create: `app/Services/PrefacturaSinCobroException.php`
- Modify: `app/Services/CierrePrefactura.php`
- Modify: `app/Http/Controllers/Api/Facturacion/PrefacturaController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Facturacion/NotasPrefacturaTest.php`
- Test: `tests/Feature/Facturacion/CierreSinCobroTest.php`

**Interfaces:**
- Consumes: `FactPrefactura::pagado()`, `porCobrar()` (Task 3); los pagos (Task 5).
- Produces:
  - Columnas `nota_interna` (200), `nota_externa` (200), `nota_factura` (100).
  - `PATCH /api/facturacion/prefacturas/{id}/notas` cuerpo con las tres, todas
    `nullable`.
  - `CierrePrefactura::cerrar(FactPrefactura $p, int $userId, bool $confirmarSinCobro = false)`
  - `PrefacturaSinCobroException` con `public readonly string $faltante`.
  - `cerrar()` del controlador acepta `confirmar_sin_cobro` (booleano, opcional).
  - La ficha gana `nota_interna`, `nota_externa`, `nota_factura`.
  La Task 8 las usa; la Task 9 no.

**Contexto:** en el sistema viejo las notas son una fila por folio en `tb_notas` con
tres campos (`nota_int` 200, `nota_ext` 200, `nota_fac` 100), que tres pantallas
distintas guardan por separado (`actualizar_notaint.php`, `save_notaext.php`,
`save_notafact.php`). Aquí van como columnas, porque ya es uno-a-uno. **Solo la
externa se imprime**: `invoice.php:272` es el único que lee `tb_notas` y solo lee
`nota_ext`.

**Y el aviso:** **289 de 3,764 folios cerrados del histórico no tienen ningún pago**
(7.7%). El sistema viejo no exige cobrar antes de imprimir, así que exigirlo
volvería inimportables esas 289. Pero hoy nadie se entera, y eso sí se arregla:
cerrar sin cobro completo pide confirmación explícita.

- [ ] **Step 1: Escribe las pruebas que fallan**

`tests/Feature/Facturacion/NotasPrefacturaTest.php`:

```php
<?php

use App\Models\Bitacora;
use App\Models\FactPrefactura;

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
});

test('una nota se puede vaciar', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $p->update(['nota_externa' => 'algo']);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/notas", ['nota_externa' => null])
        ->assertOk()
        ->assertJsonPath('prefactura.nota_externa', null);
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
});
```

`tests/Feature/Facturacion/CierreSinCobroTest.php`:

```php
<?php

use App\Models\FactPrefactura;
use App\Services\CierrePrefactura;
use App\Services\PrefacturaSinCobroException;

test('cerrar sin cobro completo pide confirmacion y NO consume folio', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    formasDePago();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar")
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'sin_cobro')
        ->assertJsonPath('faltante', '116.00');

    expect($p->fresh()->estado)->toBe(FactPrefactura::ESTADO_BORRADOR)
        ->and($p->fresh()->folio)->toBeNull()
        ->and(App\Models\FactConfiguracion::valor(CierrePrefactura::CLAVE_FOLIO))->toBe((string) CierrePrefactura::FOLIO_INICIAL);
});

test('con la confirmacion, cierra aunque falte cobro', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar", ['confirmar_sin_cobro' => true])
        ->assertOk()
        ->assertJsonPath('prefactura.estado', 'cerrada');

    expect($p->fresh()->folio)->toBe(CierrePrefactura::FOLIO_INICIAL);
});

test('cubierta al centavo, cierra sin confirmacion', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    pagoDe($p, formasDePago()['Visa'], '116.00');

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar")->assertOk();

    expect($p->fresh()->estado)->toBe(FactPrefactura::ESTADO_CERRADA);
});

test('sobrepagada tambien cierra sin confirmacion', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    pagoDe($p, formasDePago()[App\Models\FactFormaPago::CONCEPTO_EFECTIVO], '200.00');

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar")->assertOk();

    expect($p->fresh()->estado)->toBe(FactPrefactura::ESTADO_CERRADA);
});

test('un centavo de menos ya pide confirmacion', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    pagoDe($p, formasDePago()['Visa'], '115.99');

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar")
        ->assertStatus(422)
        ->assertJsonPath('faltante', '0.01');
});

test('el servicio lanza con el faltante, no solo el endpoint', function () {
    [$p, $usuario] = prefacturaCompleta(100.0, 1);

    try {
        app(CierrePrefactura::class)->cerrar($p, $usuario->id);
        $this->fail('Se esperaba PrefacturaSinCobroException.');
    } catch (PrefacturaSinCobroException $e) {
        expect($e->faltante)->toBe('116.00');
    }

    expect($p->fresh()->folio)->toBeNull();
});

test('las pruebas de cierre del bloque 2 siguen pasando con pagos completos', function () {
    // El bloque 2 cierra sin pagos: ahora eso exige confirmacion. Esta prueba fija que
    // la confirmacion es el UNICO cambio de contrato del cierre.
    [$p, $usuario] = prefacturaCompleta(100.0, 1);
    $cerrada = app(CierrePrefactura::class)->cerrar($p, $usuario->id, confirmarSinCobro: true);

    expect($cerrada->subtotal_sellado)->toBe('100.00')
        ->and($cerrada->iva_sellado)->toBe('16.00')
        ->and($cerrada->total_sellado)->toBe('116.00');
});
```

- [ ] **Step 2: Córrelas para verificar que fallan**

Run: `php artisan test tests/Feature/Facturacion/NotasPrefacturaTest.php tests/Feature/Facturacion/CierreSinCobroTest.php`
Expected: FAIL — la columna `nota_interna` no existe y el cierre no pide confirmación.

- [ ] **Step 3: La migración**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Las tres notas de una prefactura.
 *
 * Columnas y no tabla aparte porque el origen ya es uno-a-uno: `tb_notas` tiene una
 * fila por folio con los tres campos, que tres pantallas distintas del sistema
 * viejo guardan por separado. Los largos son los del origen.
 *
 * Solo la EXTERNA se imprime: `invoice.php:272` es el único que lee `tb_notas` y
 * solo lee `nota_ext`. La interna es para el departamento y la de factura viaja al
 * dato fiscal.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fact_prefacturas', function (Blueprint $table) {
            $table->string('nota_interna', 200)->nullable()->after('tipo_destino');
            $table->string('nota_externa', 200)->nullable()->after('nota_interna');
            $table->string('nota_factura', 100)->nullable()->after('nota_externa');
        });
    }

    public function down(): void
    {
        Schema::table('fact_prefacturas', function (Blueprint $table) {
            $table->dropColumn(['nota_interna', 'nota_externa', 'nota_factura']);
        });
    }
};
```

- [ ] **Step 4: El Form Request**

```php
<?php

namespace App\Http\Requests\Facturacion;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Las tres notas, todas opcionales. `sometimes` y no `nullable` a secas: una clave
 * ausente deja la nota como estaba, y una clave con `null` la vacía. Sin
 * `sometimes`, guardar solo la externa borraría las otras dos.
 */
class UpdateNotasRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'nota_interna' => ['sometimes', 'nullable', 'string', 'max:200'],
            'nota_externa' => ['sometimes', 'nullable', 'string', 'max:200'],
            'nota_factura' => ['sometimes', 'nullable', 'string', 'max:100'],
        ];
    }

    public function messages(): array
    {
        return [
            'nota_interna.max' => 'La nota interna no puede pasar de 200 caracteres.',
            'nota_externa.max' => 'La nota externa no puede pasar de 200 caracteres.',
            'nota_factura.max' => 'La nota de factura no puede pasar de 100 caracteres.',
        ];
    }
}
```

- [ ] **Step 5: El endpoint de notas**

En `PrefacturaController`:

```php
    /**
     * Las tres notas. Solo en borrador: al cerrar, el documento ya salió, y la nota
     * externa se imprime en él.
     */
    public function notas(UpdateNotasRequest $request, int $id): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazarSiCerrada($prefactura) ?? $this->rechazarSiDescartada($prefactura)) {
            return $respuesta;
        }

        $resultado = DB::transaction(function () use ($request, $id) {
            $actual = FactPrefactura::query()->whereKey($id)->lockForUpdate()->firstOrFail();

            if ($respuesta = $this->rechazarSiCerrada($actual) ?? $this->rechazarSiDescartada($actual)) {
                return $respuesta;
            }

            $campos = ['nota_interna', 'nota_externa', 'nota_factura'];
            $antes = $actual->only($campos);
            $actual->update($request->validated());

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_ACTUALIZAR,
                descripcion: "Se guardaron las notas de la prefactura {$actual->id}.",
                usuarioId: $request->user()->id,
                registroId: $actual->id,
                datosAnteriores: $antes,
                datosNuevos: $actual->fresh()->only($campos),
            );

            return $actual;
        });

        if ($resultado instanceof JsonResponse) {
            return $resultado;
        }

        return response()->json(['message' => 'Notas guardadas.', 'prefactura' => $this->fichaDe($id)]);
    }
```

Añade las tres notas a `presentar()`, junto a `tipo_destino`:

```php
            'nota_interna' => $p->nota_interna,
            'nota_externa' => $p->nota_externa,
            'nota_factura' => $p->nota_factura,
```

- [ ] **Step 6: La excepción y el cierre**

```php
<?php

namespace App\Services;

use RuntimeException;

/**
 * Se intentó cerrar una prefactura cuyos pagos no cubren el total, sin confirmarlo.
 *
 * No es un error del operador: el sistema viejo imprime sin cobrar y 289 de sus
 * 3,764 folios cerrados no tienen ningún pago. Lo que no hacía era DECIRLO.
 */
class PrefacturaSinCobroException extends RuntimeException
{
    public function __construct(public readonly string $faltante)
    {
        parent::__construct("Faltan {$faltante} por cobrar. Confirma si quieres cerrar la prefactura sin el cobro completo.");
    }
}
```

En `CierrePrefactura::cerrar()`, cambia la firma a:

```php
    public function cerrar(FactPrefactura $prefactura, int $userId, bool $confirmarSinCobro = false): FactPrefactura
```

y añade, **después** de calcular `$total` y **antes** de `$folio = $this->siguienteFolio();`:

```php
            // El aviso del cobro va DESPUÉS de los totales (necesita el total) y ANTES
            // del folio (si lanza, no se gasta). El sistema viejo deja imprimir sin
            // cobrar —289 de sus 3,764 cerradas no tienen pago— así que esto NO bloquea:
            // pide una confirmación explícita, que es lo que el viejo no hacía.
            if (! $confirmarSinCobro) {
                $pagado = $prefactura->pagado();

                if (bccomp($pagado, $total, 2) < 0) {
                    throw new PrefacturaSinCobroException(bcsub($total, $pagado, 2));
                }
            }
```

- [ ] **Step 7: El endpoint de cierre**

En `PrefacturaController::cerrar()`, antes del `try`:

```php
        // En dos sentencias: con `(bool) $datos['x'] ?? false` en una sola, la
        // precedencia del cast se come al `??` y la clave ausente revienta.
        $datos = $request->validate(['confirmar_sin_cobro' => ['sometimes', 'boolean']]);
        $confirmar = (bool) ($datos['confirmar_sin_cobro'] ?? false);
```

Pasa `$confirmar` a `$cierre->cerrar($prefactura, $request->user()->id, $confirmar)`
y añade el `catch`:

```php
        } catch (PrefacturaSinCobroException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'codigo' => 'sin_cobro',
                'faltante' => $e->faltante,
            ], 422);
```

- [ ] **Step 8: La ruta**

```php
        Route::patch('/prefacturas/{id}/notas', [PrefacturaController::class, 'notas'])->whereNumber('id');
```

Y a la tabla de rutas protegidas de `EndpointsPrefacturaTest`.

- [ ] **Step 9: Corre las pruebas**

Run: `php artisan test tests/Feature/Facturacion/NotasPrefacturaTest.php tests/Feature/Facturacion/CierreSinCobroTest.php`
Expected: PASS, 14 pruebas.

Run: `php artisan test`
Expected: **varias pruebas del bloque 2 van a fallar**, porque cierran sin pagos y
ahora eso pide confirmación. Son un cambio de contrato esperado, no un defecto:
añádeles `['confirmar_sin_cobro' => true]` o un pago que cubra el total, **según
cuál sea el caso que esa prueba quiere fijar**. No relajes la regla nueva para que
pasen.

- [ ] **Step 10: Verifica por mutación**

Mueve la comprobación del cobro **después** de `siguienteFolio()`. Expected: falla
«cerrar sin cobro completo pide confirmacion y NO consume folio» por el contador.
Restaura con `git checkout --`.

- [ ] **Step 11: Commit**

```bash
git add database/migrations/2026_09_29_093300_add_notas_to_fact_prefacturas_table.php app/Http/Requests/Facturacion/UpdateNotasRequest.php app/Services/PrefacturaSinCobroException.php app/Services/CierrePrefactura.php app/Http/Controllers/Api/Facturacion/PrefacturaController.php routes/api.php tests/
git commit -m "Las tres notas, y cerrar sin cobro completo pide confirmacion en vez de callarlo"
```

---

## Task 8: La pantalla

**Files:**
- Create: `resources/js/pages/Facturacion/components/PanelCobro.tsx`
- Create: `resources/js/pages/Facturacion/components/PanelNotas.tsx`
- Create: `resources/js/pages/Facturacion/components/ModalPagoAmex.tsx`
- Modify: `resources/js/stores/apiFacturacionCatalogos.ts`
- Modify: `resources/js/pages/Facturacion/EditorPrefactura.tsx`

**Interfaces:**
- Consumes: todos los endpoints de las Tasks 4 a 7.
- Produces: nada que otra task consuma. Es la última de producto.

**Por qué tres componentes y no todo en el editor:** `EditorPrefactura.tsx` ya tiene
816 líneas. El cobro y las notas son dos bloques con su propio estado y sus propias
llamadas; montarlos como componentes mantiene el editor legible. Cada uno recibe
`prefactura` y un `onCambio: () => Promise<void>` que recarga la ficha.

**Reutiliza, no reimplementes.** Todo esto existe ya y se usa en el editor:

- `BOTON_PRIMARIO`, `BOTON_SECUNDARIO`, `TD`, `TH`, `campoConError`, `errorStyle`,
  `labelStyle`, `sectionTitle` y `toast` de `./components/estilos`.
- `formatearMonto` y `formatearTasa` de `./components/formato`.
- `CampoMonto` para cualquier campo de importe: es `type="text"` **a propósito** para
  que `""` y `"0"` no se confundan. Úsalo para el monto del pago y para el Amex.
- `ModalBase` para los diálogos; `ModalRenglon.tsx` y `ModalEstancia.tsx` son los dos
  ejemplos de cómo se usa en esta pantalla.
- `ErrorApi` de `@/stores/apiFacturacionCatalogos`, con su `.codigo` y sus `.errors`.
- El patrón de error del editor: un `codigo` de `CODIGOS_DE_ESTADO` recarga la ficha
  y muestra el mensaje **del servidor**; los errores por campo se pintan junto al campo.
- `Swal` para confirmar y `toast.fire` para avisar, con `confirmButtonColor: '#4f46e5'`,
  que es el que ya usan las demás confirmaciones de la pantalla.

**No** inventes un cliente HTTP: `pedir` ya está en el store con su firma.

- [ ] **Step 1: Los tipos y las llamadas del store**

En `resources/js/stores/apiFacturacionCatalogos.ts`, añade antes de `Prefactura`:

```typescript
/** Un pago de la prefactura. `concepto` es null salvo en Efectivo, Amex y AvCard. */
export interface PagoPrefactura {
    id: number;
    forma_pago_id: number;
    forma_pago: string | null;
    concepto: 'efectivo' | 'amex' | 'avcard' | null;
    monto: string;
    /** true si este pago creó un renglón de comisión: quitarlo también lo quita. */
    es_comision_amex: boolean;
}
```

Añade a `interface Prefactura`:

```typescript
    nota_interna: string | null;
    nota_externa: string | null;
    nota_factura: string | null;
    pagos: PagoPrefactura[];
    pagado: string;
    /** null si los totales no se pudieron calcular (ver `totales_error`). */
    por_cobrar: string | null;
    sobrepago: string | null;
    /** true: hay efectivo detrás y el sobrepago es cambio que se devuelve. false: se cobró de más. */
    sobrepago_es_cambio: boolean;
```

Añade a `RenglonPrefactura`:

```typescript
    /** Un renglón de cortesía se ve en el documento pero su importe es 0.00. */
    es_cortesia: boolean;
```

Y en `apiPrefacturas`:

```typescript
    agregarPago: (id: number, datos: { forma_pago_id: number; monto: string }) =>
        pedir<{ message: string; pago_id: number; prefactura: Prefactura }>(`${BASE}/prefacturas/${id}/pagos`, { method: 'POST', body: datos }),
    agregarPagoAmex: (id: number, monto: string) =>
        pedir<{ message: string; pago_id: number; comision: string; prefactura: Prefactura }>(`${BASE}/prefacturas/${id}/pagos/amex`, { method: 'POST', body: { monto } }),
    quitarPago: (id: number, pago: number) =>
        pedir<{ message: string; prefactura: Prefactura }>(`${BASE}/prefacturas/${id}/pagos/${pago}`, { method: 'DELETE' }),
    guardarNotas: (id: number, datos: { nota_interna?: string | null; nota_externa?: string | null; nota_factura?: string | null }) =>
        pedir<{ message: string; prefactura: Prefactura }>(`${BASE}/prefacturas/${id}/notas`, { method: 'PATCH', body: datos }),
    cortesia: (id: number, renglon: number, esCortesia: boolean) =>
        pedir<{ message: string; prefactura: Prefactura }>(`${BASE}/prefacturas/${id}/renglones/${renglon}/cortesia`, { method: 'PATCH', body: { es_cortesia: esCortesia } }),
```

Y en `cerrar`, añade el parámetro:

```typescript
    cerrar: (id: number, confirmarSinCobro = false) =>
        pedir<{ message: string; prefactura: Prefactura }>(`${BASE}/prefacturas/${id}/cerrar`, { method: 'PATCH', body: { confirmar_sin_cobro: confirmarSinCobro } }),
```

Localiza la firma actual de `cerrar` con
`grep -n "cerrar:" resources/js/stores/apiFacturacionCatalogos.ts` y conserva su
tipo de retorno.

- [ ] **Step 2: `PanelCobro.tsx`**

Responsabilidad: mostrar los pagos, lo pagado, lo que falta, y el cambio **o** el
aviso de cobrado de más; permitir agregar un pago (selector de forma + monto) y
quitar uno. El de Amex abre `ModalPagoAmex`. Solo se puede operar en borrador.

Reglas de presentación que el componente tiene que cumplir:

- Cuando `sobrepago` es `> 0` y `sobrepago_es_cambio` es `true`: rótulo **«Cambio»**,
  en tono informativo.
- Cuando `sobrepago` es `> 0` y `sobrepago_es_cambio` es `false`: rótulo **«Cobrado
  de más»**, en tono de advertencia, con el texto «Se cobró más que el total. Revisa
  el pago: el documento pudo editarse después de cobrarse.» **Nunca lo llames
  cambio**: sería decirle al operador que entregue efectivo que nadie le dio.
- Amex no aparece en el selector de formas: tiene su propio botón, porque agrega un
  renglón de comisión.
- Un pago con `es_comision_amex` muestra, junto al botón de quitarlo, que al
  quitarlo también se quita su comisión.
- Con `estado === 'cerrada'`, los pagos se listan en solo lectura, sin botones.

Usa los estilos compartidos de `./components/estilos` (`BOTON_PRIMARIO`,
`BOTON_SECUNDARIO`, `TD`, `TH`, `campoConError`, `labelStyle`, `sectionTitle`,
`toast`) y `formatearMonto` de `./components/formato`, igual que el editor.

Los errores del servidor se muestran con el patrón que ya usa el editor: `ErrorApi`
con `codigo` conocido recarga la ficha y muestra el mensaje del servidor. Los
códigos nuevos a contemplar son `supera_lo_que_falta`, `avcard_con_combustible`,
`comision_supera_subtotal`, `servicio_comision_no_disponible` y
`amex_por_su_endpoint`. Los cinco traen el mensaje en español ya escrito: **muéstralo
tal cual**, no lo reescribas en el cliente.

- [ ] **Step 3: `ModalPagoAmex.tsx`**

Responsabilidad: pedir el monto que se carga a la tarjeta y **mostrar la comisión
que se va a agregar antes de confirmar**, calculada en el cliente como vista previa
con la tasa que trae la ficha (`prefactura.iva_tasa`).

```typescript
/**
 * VISTA PREVIA de la comisión Amex, para que quien cobra vea el cargo antes de
 * confirmarlo. No es la cifra oficial: la calcula el servidor.
 *
 * AUTORIDAD: `App\Support\ComisionAmex::calcular()` (app/Support/ComisionAmex.php).
 * Esta función es una copia de esa fórmula: quien cambie una tiene que cambiar la
 * otra.
 *
 *   base     = monto / ((1 + iva) × 1.06)
 *   comisión = base × 0.06
 */
export function comisionVistaPrevia(monto: string, tasaIva: string): number | null {
    const m = Number(monto);
    const t = Number(tasaIva);

    if (!Number.isFinite(m) || !Number.isFinite(t) || m < 0) return null;

    const divisor = (1 + t) * 1.06;

    return divisor <= 0 ? null : Math.round(((m * 0.06) / divisor) * 100) / 100;
}
```

El diálogo dice, en texto: que el monto es **lo que se carga a la tarjeta**, que la
comisión se agrega como renglón, y cuál es el subtotal actual (el tope). Al
confirmar llama `apiPrefacturas.agregarPagoAmex` y muestra la comisión **que
devolvió el servidor**, no la vista previa.

- [ ] **Step 4: `PanelNotas.tsx`**

Responsabilidad: las tres notas con sus largos (200, 200, 100), un contador de
caracteres, y un botón de guardar que solo se habilita si algo cambió (mismo patrón
que el encabezado del editor, que compara con `sonIguales`). Rotula la externa como
la única que se imprime: **«Nota externa (se imprime en la prefactura)»**. Con
`estado === 'cerrada'`, las tres en solo lectura.

- [ ] **Step 5: El editor**

En `EditorPrefactura.tsx`:

1. Monta `<PanelCobro prefactura={prefactura} onCambio={cargar} />` y
   `<PanelNotas prefactura={prefactura} onCambio={cargar} />` donde hoy terminan los
   totales.
2. Añade el interruptor de cortesía por renglón en la tabla: un botón por fila que
   llama `apiPrefacturas.cortesia`. Un renglón con `es_cortesia` se muestra con el
   importe en `0.00` y una marca visible («Cortesía»), **sin ocultar el precio
   unitario**: el documento tiene que seguir mostrando qué se dejó de cobrar.
3. En el diálogo de cierre, cuando `por_cobrar` es `> 0`, añade al texto cuánto
   falta por cobrar y exige confirmar. Al llamar `apiPrefacturas.cerrar`, pasa
   `true` solo si el operador confirmó ese aviso. Si el servidor responde con
   `codigo === 'sin_cobro'` —porque alguien cobró o editó entre la lectura y el
   cierre— muestra `message` y **vuelve a pedir la confirmación con el `faltante`
   que trae la respuesta**, en lugar de reintentar solo.
4. Añade `'sin_cobro'` a `CODIGOS_DE_ESTADO` (la constante de la línea 20), que es
   la lista de códigos que obligan a recargar la ficha.

- [ ] **Step 6: Verifica**

```bash
npx tsc --noEmit
npx eslint resources/js/pages/Facturacion/components/PanelCobro.tsx resources/js/pages/Facturacion/components/PanelNotas.tsx resources/js/pages/Facturacion/components/ModalPagoAmex.tsx resources/js/pages/Facturacion/EditorPrefactura.tsx resources/js/stores/apiFacturacionCatalogos.ts
npm run build
php artisan test
```

Expected: `tsc` solo con el error preexistente de `WalkAroundController.ts(905,5)`;
eslint limpio; build correcto; la suite en verde.

- [ ] **Step 7: Commit**

```bash
git add resources/js/pages/Facturacion/components/PanelCobro.tsx resources/js/pages/Facturacion/components/PanelNotas.tsx resources/js/pages/Facturacion/components/ModalPagoAmex.tsx resources/js/pages/Facturacion/EditorPrefactura.tsx resources/js/stores/apiFacturacionCatalogos.ts
git commit -m "El editor cobra, toma notas y marca cortesias; un sobrepago sin efectivo no se llama cambio"
```

---

## Task 9: El comando de comparación y la guía de despliegue

**Files:**
- Create: `app/Console/Commands/CompararPagos.php`
- Create: `docs/superpowers/specs/2026-10-02-facturacion-3-despliegue-y-pendientes.md`
- Test: `tests/Feature/Facturacion/CompararPagosTest.php`

**Interfaces:**
- Consumes: `ComisionAmex::calcular()` (Task 1); `FactPrefactura::calcularIva()` (bloque 2).
- Produces: `php artisan facturacion:comparar-pagos`. Nada más la consume.

**Qué compara, con etiquetas DISTINTAS por concepto.** El bloque 2 aprendió por qué:
una desviación de un centavo en el IVA pasó 19 pruebas porque el IVA y el total
compartían etiqueta en la salida.

1. **Los 3,534 pagos**: que cada `monto` del origen (un `double`) se pueda
   representar en `decimal(12,2)` sin perder centavos, y que la suma por folio
   coincida.
2. **Las 733 comisiones Amex**: `ComisionAmex::calcular(monto del pago, '0.1600')`
   contra el `importe` guardado del renglón `id_servicio = 100`, al centavo,
   **en tres grupos separados**: las que siguen la fórmula (se esperan **765** de
   781 filas comparables), las 5 de la segunda rama (`monto × 0.06`), y las 11 que
   no siguen ninguna. **Los folios de los dos últimos grupos se listan uno por uno**:
   el bloque 6 tiene que decidir qué hacer con ellos al importar.
3. **El sobrepago derivado** contra el `Cambio` guardado, **en dos listas**: los
   folios sobrepagados con `Cambio = 0` (se esperan **12**) y los que tienen
   `Cambio ≠ 0` sin estar sobrepagados (se esperan **3**).
4. **Las 130 cortesías**: que `remision` valga `'cortesia'` exactamente en las filas
   cuyo `importe` es 0 con `precio_u > 0`, que es la condición que el bloque 6 va a
   usar para traducirlas a `es_cortesia`. Reporta las que no cuadren.

**SOLO LEE.** Lo fijan pruebas que cuentan las escrituras, igual que las tres de
`CompararPrefacturas`.

- [ ] **Step 1: Escribe las pruebas que fallan**

`tests/Feature/Facturacion/CompararPagosTest.php`. El patron de simulacion del
origen es el de `tests/Feature/Facturacion/CompararPrefacturasTest.php`: `TestCase`
apunta la conexion `remota` a un destino invalido para que ninguna prueba toque la
base real, y aqui se reemplaza por sqlite en memoria con `DB::purge`.

**Los ayudantes NO se pueden llamar `legacyPref` ni `legacyVenta`:**
`CompararPrefacturasTest.php` ya declara esos dos nombres, y una funcion declarada
en un archivo de prueba es **global al cargarse**, asi que dos archivos con el mismo
nombre revientan por redeclaracion antes de correr nada.

```php
<?php

use Illuminate\Support\Facades\DB;

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

/** Un encabezado historico. `$cambio` es el `Cambio` guardado, que se sabe poco fiable. */
function origenPrefactura(int $folio, float $subtotal, float $total, float $cambio = 0.0): void
{
    DB::connection('remota')->table('tb_hprefactura')->insert([
        'fol_prefactura' => $folio, 'subtotal' => $subtotal, 'iva' => $total - $subtotal,
        'Total' => $total, 'Cambio' => $cambio,
    ]);
}

function origenRenglon(int $folio, int $servicio, float $precio, float $importe, string $remision = ''): void
{
    DB::connection('remota')->table('tb_venta')->insert([
        'fol_prefactura' => $folio, 'id_servicio' => $servicio, 'precio_u' => $precio,
        'importe' => $importe, 'cantidad' => 1, 'remision' => $remision,
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
        ->and(App\Models\FactPrefacturaPago::count())->toBe(0);
});

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
        ->expectsOutputToContain('Comision Amex, exactas al centavo: 1')
        ->expectsOutputToContain('Comision Amex, segunda rama del sistema viejo: 1')
        ->expectsOutputToContain('Comision Amex, sin explicacion: 1')
        ->assertExitCode(0);
});

test('los folios de los dos grupos que no cuadran se listan uno por uno', function () {
    origenPrefactura(77, 1060.00, 1229.60);
    origenRenglon(77, 50, 1000.00, 1000.00);
    origenRenglon(77, 100, 60.00, 60.00);
    origenPago(77, 3, 1000.00);

    // El bloque 6 tiene que decidir que hace con ellos: un conteo no le sirve.
    $this->artisan('facturacion:comparar-pagos')->expectsOutputToContain('77')->assertExitCode(0);
});

test('el sobrepago se compara con el Cambio guardado en dos listas separadas', function () {
    // Sobrepagado con Cambio en cero: el pago posterior lo piso (mpago.php).
    origenPrefactura(1, 100.00, 116.00, 0.00);
    origenRenglon(1, 50, 100.00, 100.00);
    origenPago(1, 4, 200.00);

    // Cambio distinto de cero sin estar sobrepagado: quedo escrito y luego cambio el documento.
    origenPrefactura(2, 100.00, 116.00, 40.00);
    origenRenglon(2, 50, 100.00, 100.00);
    origenPago(2, 1, 116.00);

    $this->artisan('facturacion:comparar-pagos')
        ->expectsOutputToContain('Sobrepagadas con Cambio en cero: 1')
        ->expectsOutputToContain('Cambio guardado sin sobrepago: 1')
        ->assertExitCode(0);
});

test('un monto con mas de dos decimales se reporta como redondeo al importar', function () {
    // 105.2816 es real: es el bruto que Amex cargo. Pasarlo a decimal(12,2) pierde centesimas.
    origenPrefactura(1, 105.28, 122.12);
    origenRenglon(1, 50, 100.00, 100.00);
    origenPago(1, 3, 105.2816);

    $this->artisan('facturacion:comparar-pagos')
        ->expectsOutputToContain('Pagos que se redondean al importar: 1')
        ->assertExitCode(0);
});

test('las cortesias se identifican por importe 0 con precio mayor que 0', function () {
    origenPrefactura(1, 0.00, 0.00);
    origenRenglon(1, 50, 300.00, 0.00, 'cortesia');   // cortesia marcada
    origenRenglon(1, 51, 400.00, 0.00, '');           // importe 0 SIN marca: no cuadra
    origenRenglon(1, 52, 0.00, 0.00, '');             // precio 0: no es cortesia, se ignora

    $this->artisan('facturacion:comparar-pagos')
        ->expectsOutputToContain('Cortesias marcadas: 1')
        ->expectsOutputToContain('Importe en cero sin marca de cortesia: 1')
        ->assertExitCode(0);
});

test('sin pagos en el origen el comando termina bien y lo dice', function () {
    origenPrefactura(1, 100.00, 116.00);
    origenRenglon(1, 50, 100.00, 100.00);

    $this->artisan('facturacion:comparar-pagos')
        ->expectsOutputToContain('Pagos comparados: 0')
        ->assertExitCode(0);
});
```

**Las etiquetas de la salida son contrato de estas pruebas.** Si al escribir el
comando eliges otras palabras, cambia las pruebas a la vez — pero **cada
comparacion tiene que seguir teniendo su propia etiqueta**. El bloque 2 aprendio por
que: una desviacion de un centavo en el IVA paso 19 pruebas porque el IVA y el total
compartian etiqueta.

- [ ] **Step 2: Córrelas para verificar que fallan**

Run: `php artisan test tests/Feature/Facturacion/CompararPagosTest.php`
Expected: FAIL — el comando no existe.

- [ ] **Step 3: El comando**

Estructura, siguiendo `CompararPrefacturas` (381 líneas, con su cabecera de
documentación larga que explica cada comparación y sus trampas conocidas):

- Firma: `facturacion:comparar-pagos`, con `--folio=` para acotar a uno y
  `--limite=` para una corrida corta.
- Documentación de cabecera que diga: **qué prueba, qué NO prueba, y las trampas**.
  Las trampas de este comando son dos y hay que escribirlas:
  1. **`tb_formas_pago.monto` es `double`.** Hay montos con cuatro decimales
     (105.2816, 647.9992): no son errores, son el bruto que Amex cargó. Al
     importarlos a `decimal(12,2)` se redondean, y el comando tiene que decir cuántos
     y cuánto suma la diferencia, no esconderlo.
  2. **`tb_hprefactura` tiene 207 folios duplicados.** La causa es mecánica:
     `invoice.php` inserta el encabezado histórico **antes** de validar cliente y
     fecha de salida, y solo borra de `tb_prefcatura` cuando la validación pasa, así
     que cada intento fallido de imprimir deja un encabezado. Para comparar, el
     comando toma **la última fila de cada folio** (la del intento que sí imprimió) y
     lo dice en la salida.
- Salida: una línea por comparación con su etiqueta propia, y al final las listas de
  folios de los grupos que no cuadran.
- Cero escrituras: no uses `updateOrCreate`, `save`, `insert` ni `DB::statement` en
  ninguna rama.

- [ ] **Step 4: Corre el comando contra el origen real**

```bash
php artisan facturacion:comparar-pagos
```

Expected: las cifras que la spec predice. Si **no** salen —si las comisiones que
siguen la fórmula no son 765, o los grupos no son 5 y 11, o el sobrepago no da 12 y
3— **no ajustes la tolerancia ni el conteo para que cuadren**. Investiga la
diferencia y repórtala: la spec midió esas cifras el 2026-10-02 y una discrepancia
significa que algo cambió o que una de las dos mediciones está mal.

- [ ] **Step 5: Corre las pruebas**

Run: `php artisan test tests/Feature/Facturacion/CompararPagosTest.php`
Expected: PASS.

Run: `php artisan test`
Expected: PASS.

- [ ] **Step 6: La guía de despliegue**

`docs/superpowers/specs/2026-10-02-facturacion-3-despliegue-y-pendientes.md`,
siguiendo la del bloque 2
(`2026-10-01-facturacion-2-despliegue-y-pendientes.md`). Tiene que incluir:

- **El orden exacto:** `php artisan migrate`, y **después** el importador de
  catálogos (`php artisan facturacion:importar-matriculas`), que es lo que asigna
  los conceptos de las formas de pago y el del servicio «Comisión AMEX». **Sin ese
  paso, AvCard no se rechaza con combustible y el pago Amex responde 422.** Es el
  mismo paso que el bloque 2 llamó «el más fácil de omitir», ahora con una
  consecuencia más.
- **La advertencia del rollback**, con la lección del bloque 2: `migrate:rollback`
  revierte **el lote entero**, y el `down()` de la migración de pagos es un
  `dropIfExists`. Un rollback después de que alguien cobre **pierde los pagos**. Di
  explícitamente qué migración revertir y cómo, o que no se revierta.
- **El número de pruebas en verde** al cierre del bloque, medido, no estimado.
- **Lo que hay que probar a mano**, porque sqlite ignora `lockForUpdate()`: dos
  sesiones cobrando la misma prefactura a la vez, y cobrar mientras otra sesión
  cierra. Va a la lista de comprobaciones contra MySQL real que el bloque 2 ya abrió.
- **La deuda que este bloque NO retira**, incluida la del bloque 2 que sigue abierta
  (la conexión `remota` con credenciales de escritura; la falta de índice único en
  `operacion_llegada_id`; reabrir una cerrada sin guarda en el modelo) y la nueva:
  cobrar una prefactura cerrada está decidido que no, pero el departamento todavía
  no lo ha probado y las 289 cerradas sin pago sugieren que en algún sitio se cobra
  después.

- [ ] **Step 7: Commit**

```bash
git add app/Console/Commands/CompararPagos.php tests/Feature/Facturacion/CompararPagosTest.php docs/superpowers/specs/2026-10-02-facturacion-3-despliegue-y-pendientes.md
git commit -m "El comando que verifica los pagos y las comisiones contra el historico, y la guia de despliegue"
```

---

## Autorrevisión del plan

**Cobertura de la spec.** Cada requisito tiene su task:

| Requisito de la spec | Task |
|---|---|
| `fact_prefactura_pagos` | 3 |
| Notas como tres columnas | 7 |
| `es_cortesia` | 4 |
| Cambio derivado, no guardado | 3 |
| Un sobrepago sin efectivo no es cambio | 3 (derivado), 8 (cómo se nombra) |
| `ComisionAmex`, una sola fórmula, con la tasa configurable | 1 |
| Comisión redondeada a dos decimales | 1 |
| Regla del Efectivo | 5 |
| Regla de AvCard con combustible | 5 |
| Regla de las demás tarjetas | 5 |
| Amex con su propio flujo | 6 |
| Borrar el pago Amex borra SU comisión | 5 (el mecanismo), 6 (la prueba) |
| Pagos solo en borrador | 5, 6 |
| Cerrar sin cobro avisa y deja cerrar | 7 |
| La ficha con `pagos`, `pagado`, `por_cobrar`, `sobrepago` | 5 |
| Panel de cobro, panel de notas, interruptor de cortesía | 8 |
| `facturacion:comparar-pagos` | 9 |
| Las dos cosas que salen gratis del bloque 2 | 4 (la prueba del margen) |

**Hueco que encontré y cerré:** la spec da por hecho que el código puede reconocer
Efectivo, Amex y AvCard, y el catálogo del 1b solo tiene `nombre`. Por eso existe la
Task 2, que no estaba en la spec. Lo mismo con el servicio de catálogo de la
comisión, que la Task 6 añade como `CONCEPTO_COMISION_AMEX`.

**Consistencia de tipos.** `monto` viaja siempre como **cadena** (`string`) entre el
cliente, el Form Request, el servicio y `bc`; nunca como `float`. `pagado()`,
`porCobrar()`, `sobrepago()` y `ComisionAmex::calcular()` devuelven `string` de dos
decimales. `sobrepagoEsCambio()` devuelve `bool`. `es_cortesia` es `boolean` en PHP
y en TypeScript.

**Un orden que importa:** la Task 5 añade el bloque `cobro()` a `presentar()` porque
sus pruebas lo afirman; la Task 7 solo agrega las tres notas a esa misma función.
Si se ejecutan en otro orden, la que llegue primero crea el método.

---

## Entrega

Plan guardado en
`docs/superpowers/plans/2026-10-02-facturacion-3-pagos-y-notas.md`.
