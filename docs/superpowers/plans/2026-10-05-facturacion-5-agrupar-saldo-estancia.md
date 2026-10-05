# Bloque 5 — Agrupar, saldo a favor y ajuste de estancia: plan de implementación

> **Para trabajadores agénticos:** SUB-SKILL REQUERIDA: usa
> superpowers:subagent-driven-development (recomendada) o
> superpowers:executing-plans para implementar este plan task por task. Los pasos usan
> casillas (`- [ ]`) para seguimiento.

**Goal:** cerrar las tres funciones del sistema viejo que faltan antes de que el departamento
pruebe: agrupar servicios **al imprimir**, aplicar un **saldo a favor** como forma de pago, y
cobrar el **ajuste de estancia** entre dos tramos.

**Architecture:** agrupar no toca el dinero — es una etiqueta en el renglón que el documento
colapsa en una fila. El saldo a favor es una forma de pago más, así que la cuenta conserva su IVA.
El ajuste de estancia son dos cantidades más en `CargosEstancia::recalcular()`, con el precio como
diferencia entre dos tarifas de la matrícula.

**Tech Stack:** Laravel 12, PHP 8.2, Pest 3 sobre sqlite, DomPDF, React 19 + TypeScript, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-10-05-facturacion-5-agrupar-saldo-estancia-design.md`

## Global Constraints

- **Agrupar no cambia el dinero.** Es el invariante central del bloque. `subtotal()` sigue sumando
  el `importe()` de **cada** renglón, uno por uno; el grupo solo existe al imprimir.
- **Ningún cálculo de dinero nuevo.** Las fórmulas viven en `ImporteServicio::calcular()`,
  `FactPrefactura::calcularIva()`, `ComisionAmex::calcular()` y `PagosPrefactura::comisionQueCuadra()`.
  **Sin copias.** La única aritmética nueva permitida es la **resta de dos tarifas** con `bcsub`.
- **Ningún `float` en el camino del dinero.**
- **La vista no llama a ningún método del modelo que calcule dinero ni que pueda lanzar.** Lee el
  comentario que encabeza `resources/views/pdf/prefactura.blade.php` antes de tocarla. La vista se
  renderiza **después** del `try/catch` del controlador, así que una excepción nacida ahí sería un
  **500 en lugar de un 422**.
- **`/pdf` lee SOLO las cifras selladas.** `/cotizacion` lee las derivadas.
- **Toda escritura queda en `Bitacora`, DENTRO de la transacción.**
- **Todo lo visible va en español.**
- **Los escritores sobre una prefactura toman `lockForUpdate()` como primera sentencia de su
  transacción** y comprueban `estaCerrada()` contra lo leído de la base, no contra la instancia
  recibida. Son once y no hay ciclo de interbloqueo; no lo rompas.
- La suite se corre **en serie** con `php artisan test`. **No uses `--parallel`**: da 22 fallos
  falsos ajenos en esta máquina. Al empezar son **1034** en verde.
- `npx tsc --noEmit`: el **único** error aceptable es el preexistente
  `resources/js/actions/App/Http/Controllers/Api/WalkAroundController.ts(905,5)`.
- **Corre `vendor/bin/pint --dirty`** antes de cerrar cada task (lo pide el `CLAUDE.md` del
  proyecto). **No** corras `pint` sin `--dirty`: hay 129 archivos marcados de antes del bloque.
- **No uses `git stash` para nada.** Hay tres stashes y el `stash@{0}` es trabajo ajeno a esto.
- **Las migraciones se numeran entre `2026_09_29_093300` y `2026_09_29_099000`**, porque
  `tests/Feature/MatriculaUnicaTest.php:149` exige que `099000_add_unique_matricula_to_aeronaves`
  siga siendo la última.
- **Una migración NO usa constantes del modelo**, usa literales: una migración ya aplicada no puede
  depender de un modelo que cambia. Es el patrón de
  `2026_09_29_093000_add_concepto_to_fact_formas_pago_table.php`; respétalo.

---

## Estructura de archivos

**Se crean:**

| Archivo | Responsabilidad |
|---|---|
| `database/migrations/2026_09_29_094000_seed_conceptos_de_ajuste_de_estancia.php` | Asigna el concepto por nombre a los dos servicios de ajuste |
| `database/migrations/2026_09_29_094100_seed_forma_pago_saldo_a_favor.php` | Crea la forma de pago del saldo a favor con su concepto |
| `database/migrations/2026_09_29_094200_add_grupo_to_fact_prefactura_renglones_table.php` | La columna `grupo` |
| `tests/Feature/Facturacion/AjusteEstanciaTest.php` | El ajuste: precio, guardas, reemplazo y cortesía |
| `tests/Feature/Facturacion/SaldoAFavorTest.php` | Que no baja el IVA y que no genera cambio |
| `tests/Feature/Facturacion/AgruparRenglonesTest.php` | Que no cambia el dinero, los rechazos y el documento |

**Se modifican:**

| Archivo | Qué cambia |
|---|---|
| `app/Models/FactServicio.php` | Dos conceptos nuevos, y entran en `CONCEPTOS_ESTANCIA` |
| `app/Models/FactFormaPago.php` | El concepto del saldo a favor |
| `app/Models/FactPrefacturaRenglon.php` | `grupo` en `$fillable` |
| `app/Services/CargosEstancia.php` | Dos cantidades, `etiquetaDe()` y las dos guardas |
| `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php` | Validación de los dos campos y el endpoint del grupo |
| `app/Http/Controllers/Api/Facturacion/PrefacturaPdfController.php` | `filas` sustituye a `importes` |
| `resources/views/pdf/prefactura.blade.php` | Itera `filas` |
| `routes/api.php` | La ruta del grupo |
| `resources/js/stores/apiFacturacionCatalogos.ts` | Las llamadas y los tipos |
| `resources/js/pages/Facturacion/EditorPrefactura.tsx` | Agrupar y los dos campos de ajuste |
| `tests/Feature/Facturacion/DocumentoPrefacturaTest.php` | `importes` → `filas` |
| `tests/Feature/Facturacion/ImpresionPrefacturaTest.php` | `importes` → `filas` |

**Por qué el orden de las tasks.** El ajuste de estancia y el saldo a favor son independientes y
no tocan la impresión, así que van primero y entran enteros. El cambio de contrato de la vista
(`importes` → `filas`) va **solo**, sin agrupar, para que se pueda revisar como el refactor que es:
toca pruebas del bloque 4 y conviene que ese diff no venga mezclado con lógica nueva. Agrupar llega
después, en dos mitades: el modelo con su endpoint, y luego el documento.

---

## Task 1: El ajuste de estancia

**Files:**
- Create: `database/migrations/2026_09_29_094000_seed_conceptos_de_ajuste_de_estancia.php`
- Modify: `app/Models/FactServicio.php`
- Modify: `app/Services/CargosEstancia.php`
- Modify: `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php`
- Test: `tests/Feature/Facturacion/AjusteEstanciaTest.php`

**Interfaces:**
- Consumes: `FactAeronave::tarifaPernocta()`, `tarifaTransito2h()`, `tarifaTransito12h()`, los tres
  `?string`; `FactServicio::porConcepto()` y `activos()`.
- Produces: `FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H = 'estancia_ajuste_2h_12h'` y
  `CONCEPTO_ESTANCIA_AJUSTE_12H_PERNOCTA = 'estancia_ajuste_12h_pernocta'`, los dos dentro de
  `CONCEPTOS_ESTANCIA`; y la firma nueva
  `CargosEstancia::recalcular(FactPrefactura $prefactura, int $pernoctas, int $transitos2h, int $transitos12h, int $ajustes2a12 = 0, int $ajustes12aPernocta = 0): array`.
  Los dos últimos con **valor por omisión 0** para no romper a quien ya la llama.

**Contexto que el brief no puede saber:**

- **`CargosEstancia::etiquetaDe()` es un `match` SIN `default`** que cubre exactamente los tres
  conceptos de hoy, y el camino de las cortesías perdidas lo llama **iterando
  `CONCEPTOS_ESTANCIA`** (`CargosEstancia.php:183`). En cuanto los dos conceptos nuevos entren en
  esa lista, ese `match` **lanza `UnhandledMatchError`**. Hay que extenderlo con sus dos etiquetas
  en el mismo cambio, o la suite se cae por un camino que no es obvio.
- **Los dos servicios ya existen en el catálogo viejo**, con estos nombres **exactos** (medidos, sin
  espacios sobrantes): `Ajuste de Estancia_de 2 hrs a 12 hrs` (36 caracteres) y
  `Ajuste de Estancia_de 12 hrs a pernocta` (39). Su precio en el catálogo viejo es `0.0000`, que
  es relleno: el precio real sale de la resta de tarifas.
- **La columna `fact_servicios.concepto` es `string(32)` y `unique`.** Los dos conceptos nuevos
  miden 22 y 28 caracteres, así que entran.
- `mensajesDeEstancia()` (`PrefacturaRenglonController.php:315`) **itera un mapa**
  `campo => nombre`, así que añadir dos entradas a ese mapa cubre los cuatro mensajes de cada campo
  nuevo sin escribirlos a mano.
- El endpoint es `PATCH /api/facturacion/prefacturas/{id}/estancia` y su validación está en
  `PrefacturaRenglonController.php:200`.
- La base MySQL local **no está migrada** al estado del bloque 2 (`fact_servicios` está vacía y sin
  columna `concepto`). Las pruebas corren en **sqlite** con migraciones frescas, así que esto no te
  afecta; no intentes arreglar la base local.

- [ ] **Step 1: La migración que asigna los conceptos**

Mismo patrón que `2026_09_29_093000`: **literales**, no constantes del modelo, y asignar por nombre
a la fila ya importada, tomando la de `id` menor por si la collation plegara dos nombres.

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Identifica por concepto los dos servicios de ajuste de estancia, que el código tiene
 * que reconocer para cotizarlos como la DIFERENCIA entre dos tarifas de la matrícula.
 *
 * Su precio en el catálogo del origen es 0.0000, que es relleno: igual que los tres
 * tramos, el precio real sale de la tarifa y no del catálogo.
 */
return new class extends Migration
{
    // Literales y no `FactServicio::CONCEPTO_*`: una migración ya aplicada no puede
    // depender del modelo, que cambia.
    private const POR_NOMBRE = [
        'Ajuste de Estancia_de 2 hrs a 12 hrs' => 'estancia_ajuste_2h_12h',
        'Ajuste de Estancia_de 12 hrs a pernocta' => 'estancia_ajuste_12h_pernocta',
    ];

    public function up(): void
    {
        foreach (self::POR_NOMBRE as $nombre => $concepto) {
            $id = DB::table('fact_servicios')->where('nombre', $nombre)->orderBy('id')->value('id');

            if ($id !== null) {
                DB::table('fact_servicios')->where('id', $id)->update(['concepto' => $concepto]);
            }
        }
    }

    public function down(): void
    {
        DB::table('fact_servicios')
            ->whereIn('concepto', array_values(self::POR_NOMBRE))
            ->update(['concepto' => null]);
    }
};
```

- [ ] **Step 2: Escribe las pruebas que fallan**

```php
<?php

use App\Models\FactServicio;
use App\Services\CargosEstancia;

/** Una aeronave en tránsito con las tres tarifas puestas, para medir la resta. */
function aeronaveConTarifas(string $transito2h, string $transito12h, string $pernocta): App\Models\FactPrefactura
{
    $p = prefacturaBorrador();
    $p->satelite->update([
        'tarifa_transito_2h' => $transito2h,
        'tarifa_transito_12h' => $transito12h,
        'tarifa_pernocta' => $pernocta,
    ]);

    return $p->fresh();
}

/** Los dos servicios de ajuste, con su concepto, como los deja la migración. */
function serviciosDeAjuste(): void
{
    FactServicio::create(['nombre' => 'Ajuste de Estancia_de 2 hrs a 12 hrs', 'precio_unitario' => 0, 'concepto' => FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H]);
    FactServicio::create(['nombre' => 'Ajuste de Estancia_de 12 hrs a pernocta', 'precio_unitario' => 0, 'concepto' => FactServicio::CONCEPTO_ESTANCIA_AJUSTE_12H_PERNOCTA]);
}

test('el ajuste de 2h a 12h cobra la DIFERENCIA de las dos tarifas', function () {
    serviciosDeAjuste();
    $p = aeronaveConTarifas('1000.0000', '1500.0000', '2200.0000');

    $resultado = app(CargosEstancia::class)->recalcular($p, 0, 0, 0, ajustes2a12: 1);

    $renglon = $p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H)->sole();

    expect((string) $renglon->precio_unitario)->toBe('500.0000')
        ->and($renglon->importe())->toBe('500.00')
        ->and($resultado['renglones'])->toBe(1);
});

test('el ajuste de 12h a pernocta cobra su propia diferencia', function () {
    serviciosDeAjuste();
    $p = aeronaveConTarifas('1000.0000', '1500.0000', '2200.0000');

    app(CargosEstancia::class)->recalcular($p, 0, 0, 0, ajustes12aPernocta: 1);

    $renglon = $p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_AJUSTE_12H_PERNOCTA)->sole();

    expect((string) $renglon->precio_unitario)->toBe('700.0000');
});

test('la cantidad multiplica el ajuste, como cualquier renglon', function () {
    serviciosDeAjuste();
    $p = aeronaveConTarifas('1000.0000', '1500.0000', '2200.0000');

    app(CargosEstancia::class)->recalcular($p, 0, 0, 0, ajustes2a12: 3);

    expect($p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H)->sole()->importe())
        ->toBe('1500.00');
});

test('si la diferencia es CERO el ajuste no se cobra, y el motivo lo dice', function () {
    // Es la guarda que el sistema viejo no tenia: cobrar un ajuste de cero es un renglon
    // que no dice nada, y uno negativo es cobrar de menos sin que nada lo explique.
    serviciosDeAjuste();
    $p = aeronaveConTarifas('1500.0000', '1500.0000', '2200.0000');

    $resultado = app(CargosEstancia::class)->recalcular($p, 0, 0, 0, ajustes2a12: 1);

    expect($p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H)->count())->toBe(0)
        ->and($resultado['motivo'])->toContain('1500.0000')
        ->and($resultado['motivo'])->toContain('de 2 h a 12 h');
});

test('si la diferencia es NEGATIVA tampoco se cobra', function () {
    serviciosDeAjuste();
    // Tarifas invertidas: el tramo de 12 h cuesta menos que el de 2 h.
    $p = aeronaveConTarifas('1500.0000', '1000.0000', '2200.0000');

    $resultado = app(CargosEstancia::class)->recalcular($p, 0, 0, 0, ajustes2a12: 1);

    expect($p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H)->count())->toBe(0)
        ->and($resultado['motivo'])->toContain('de 2 h a 12 h');
});

test('si falta una de las dos tarifas que la resta necesita, el motivo nombra el ajuste', function () {
    serviciosDeAjuste();
    $p = prefacturaBorrador();
    // Sin ninguna tarifa en la matricula ni en su categoria.
    $p->satelite->update(['tarifa_transito_2h' => null, 'tarifa_transito_12h' => null, 'tarifa_pernocta' => null]);

    $resultado = app(CargosEstancia::class)->recalcular($p->fresh(), 0, 0, 0, ajustes2a12: 1);

    expect($p->fresh()->renglones()->count())->toBe(0)
        ->and($resultado['motivo'])->toContain('de 2 h a 12 h');
});

test('una tarifa que falta NO impide que se cobre el resto', function () {
    // El recalculo continua: media estancia cobrada es mejor que ninguna, y el motivo avisa.
    serviciosDeAjuste();
    $p = prefacturaBorrador();
    $p->satelite->update(['tarifa_pernocta' => '2200.0000', 'tarifa_transito_2h' => null, 'tarifa_transito_12h' => null]);

    $resultado = app(CargosEstancia::class)->recalcular($p->fresh(), 1, 0, 0, ajustes2a12: 1);

    expect($p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->count())->toBe(1)
        ->and($resultado['motivo'])->not->toBeNull();
});

test('recalcular REEMPLAZA el ajuste previo y no lo duplica', function () {
    serviciosDeAjuste();
    $p = aeronaveConTarifas('1000.0000', '1500.0000', '2200.0000');
    $cargos = app(CargosEstancia::class);

    $cargos->recalcular($p, 0, 0, 0, ajustes2a12: 1);
    $cargos->recalcular($p->fresh(), 0, 0, 0, ajustes2a12: 2);

    $renglones = $p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H)->get();

    expect($renglones)->toHaveCount(1)
        ->and($renglones->first()->cantidad)->toBe(2);
});

test('la cortesia de un ajuste se CONSERVA al recalcular', function () {
    serviciosDeAjuste();
    $p = aeronaveConTarifas('1000.0000', '1500.0000', '2200.0000');
    $cargos = app(CargosEstancia::class);

    $cargos->recalcular($p, 0, 0, 0, ajustes2a12: 1);
    $p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H)->sole()->update(['es_cortesia' => true]);

    $resultado = $cargos->recalcular($p->fresh(), 0, 0, 0, ajustes2a12: 2);

    $renglon = $p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H)->sole();

    expect($renglon->es_cortesia)->toBeTrue()
        ->and($renglon->importe())->toBe('0.00')
        ->and($resultado['motivo'])->toContain('de 2 h a 12 h');
});

test('una cortesia de ajuste que se PIERDE tambien se avisa', function () {
    // Es el camino que llama a etiquetaDe() iterando CONCEPTOS_ESTANCIA: con el match sin
    // default, este es el caso que reventaria si no se extendiera.
    serviciosDeAjuste();
    $p = aeronaveConTarifas('1000.0000', '1500.0000', '2200.0000');
    $cargos = app(CargosEstancia::class);

    $cargos->recalcular($p, 0, 0, 0, ajustes2a12: 1);
    $p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H)->sole()->update(['es_cortesia' => true]);

    // Cantidad 0: el renglon no se recrea, asi que la cortesia se pierde.
    $resultado = $cargos->recalcular($p->fresh(), 0, 0, 0, ajustes2a12: 0);

    expect($p->fresh()->renglones()->count())->toBe(0)
        ->and($resultado['motivo'])->toContain('de 2 h a 12 h');
});

test('los dos conceptos de ajuste NO se pueden agregar a mano', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    serviciosDeAjuste();
    $p = prefacturaBorrador();
    $servicio = FactServicio::porConcepto(FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H)->sole();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
    ])->assertStatus(422)->assertJsonValidationErrorFor('servicio_id');
});

test('el endpoint acepta las dos cantidades nuevas y son opcionales', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    serviciosDeAjuste();
    $p = aeronaveConTarifas('1000.0000', '1500.0000', '2200.0000');

    // Sin los campos nuevos: sigue funcionando como antes del bloque 5.
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/estancia", [
        'pernoctas' => 1, 'transitos_2h' => 0, 'transitos_12h' => 0,
    ])->assertOk();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/estancia", [
        'pernoctas' => 0, 'transitos_2h' => 0, 'transitos_12h' => 0,
        'ajustes_2h_12h' => 1, 'ajustes_12h_pernocta' => 1,
    ])->assertOk();

    expect($p->fresh()->renglones()->count())->toBe(2);
});

test('una cantidad de ajuste negativa se rechaza con su mensaje en espanol', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/estancia", [
        'pernoctas' => 0, 'transitos_2h' => 0, 'transitos_12h' => 0, 'ajustes_2h_12h' => -1,
    ])->assertStatus(422)->assertJsonValidationErrorFor('ajustes_2h_12h');
});
```

- [ ] **Step 3: Córrelas para verificar que fallan**

Run: `php artisan test tests/Feature/Facturacion/AjusteEstanciaTest.php`
Expected: FAIL — las constantes `CONCEPTO_ESTANCIA_AJUSTE_*` no existen.

- [ ] **Step 4: Los dos conceptos en el modelo**

En `app/Models/FactServicio.php`, junto a los otros tres, y **dentro de `CONCEPTOS_ESTANCIA`**:

```php
    /** El ajuste cobra la DIFERENCIA entre dos tramos, no el tramo entero. */
    public const CONCEPTO_ESTANCIA_AJUSTE_2H_12H = 'estancia_ajuste_2h_12h';

    public const CONCEPTO_ESTANCIA_AJUSTE_12H_PERNOCTA = 'estancia_ajuste_12h_pernocta';
```

Y la lista pasa a tener cinco:

```php
    public const CONCEPTOS_ESTANCIA = [
        self::CONCEPTO_ESTANCIA_PERNOCTA,
        self::CONCEPTO_ESTANCIA_TRANSITO_2H,
        self::CONCEPTO_ESTANCIA_TRANSITO_12H,
        self::CONCEPTO_ESTANCIA_AJUSTE_2H_12H,
        self::CONCEPTO_ESTANCIA_AJUSTE_12H_PERNOCTA,
    ];
```

- [ ] **Step 5: `etiquetaDe()`, antes de nada más**

Es lo primero que hay que tocar después de la lista, porque sin él la suite se cae por el camino de
las cortesías perdidas:

```php
    private function etiquetaDe(string $concepto): string
    {
        return match ($concepto) {
            FactServicio::CONCEPTO_ESTANCIA_PERNOCTA => 'pernocta',
            FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H => 'tránsito de 2 horas',
            FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H => 'tránsito de 12 horas',
            FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H => 'ajuste de estancia de 2 h a 12 h',
            FactServicio::CONCEPTO_ESTANCIA_AJUSTE_12H_PERNOCTA => 'ajuste de estancia de 12 h a pernocta',
        };
    }
```

- [ ] **Step 6: Las dos cantidades y la resta en `recalcular()`**

La firma gana dos parámetros **con valor por omisión 0**, para no romper a quien ya la llama:

```php
    public function recalcular(
        FactPrefactura $prefactura,
        int $pernoctas,
        int $transitos2h,
        int $transitos12h,
        int $ajustes2a12 = 0,
        int $ajustes12aPernocta = 0,
    ): array {
```

La comprobación de cantidades negativas incluye las dos nuevas. Y el arreglo `$conceptos` gana dos
entradas, cuya tarifa es la **resta**:

```php
            $conceptos = [
                [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA, $this->etiquetaDe(FactServicio::CONCEPTO_ESTANCIA_PERNOCTA), $pernoctas, $satelite->tarifaPernocta()],
                [FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H, $this->etiquetaDe(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H), $transitos2h, $satelite->tarifaTransito2h()],
                [FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H, $this->etiquetaDe(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H), $transitos12h, $satelite->tarifaTransito12h()],
                [FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H, $this->etiquetaDe(FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H), $ajustes2a12, $this->diferenciaDeTarifa($satelite->tarifaTransito12h(), $satelite->tarifaTransito2h())],
                [FactServicio::CONCEPTO_ESTANCIA_AJUSTE_12H_PERNOCTA, $this->etiquetaDe(FactServicio::CONCEPTO_ESTANCIA_AJUSTE_12H_PERNOCTA), $ajustes12aPernocta, $this->diferenciaDeTarifa($satelite->tarifaPernocta(), $satelite->tarifaTransito12h())],
            ];
```

Y el ayudante privado, que devuelve `null` cuando no hay nada que cobrar — con lo que reaprovecha
**tal cual** el camino de `$sinTarifa` que ya existe, sin tocarlo:

```php
    /**
     * El precio de un ajuste de estancia: lo que cuesta subir de un tramo al siguiente.
     *
     * Devuelve `null` —y entonces el ajuste no se cobra y el `motivo` lo dice— en los tres
     * casos en que no hay nada legítimo que cobrar: si falta cualquiera de las dos tarifas,
     * y si la diferencia sale cero o negativa.
     *
     * Esa última guarda es la que el sistema viejo no tenía. `aplicar_descuento.php` y la
     * captura a mano dejaron 10 renglones con precio negativo en el histórico, y dos de
     * ellos no corresponden a ningún cargo: un ajuste negativo es cobrar de menos sin que
     * nada lo explique.
     *
     * Escala 4 porque `precio_unitario` es `decimal(10,4)`, y `bcsub` porque las tarifas
     * llegan como cadenas decimales y aquí no entra ningún `float`.
     */
    private function diferenciaDeTarifa(?string $mayor, ?string $menor): ?string
    {
        if ($mayor === null || $menor === null) {
            return null;
        }

        $diferencia = bcsub($mayor, $menor, 4);

        return bccomp($diferencia, '0', 4) > 0 ? $diferencia : null;
    }
```

**Y el mensaje de `$sinTarifa` tiene que servir para los cinco.** Hoy dice «No hay tarifa de X ni en
la matrícula ni en su categoría», que para un ajuste es impreciso: puede faltar una de las dos, o
la diferencia puede ser cero. Redáctalo de modo que sea verdad para los cinco conceptos — por
ejemplo diciendo que no se pudo determinar el precio de X — y **para los dos ajustes añade las
tarifas que intervienen**, porque sin ellas el operador no sabe qué corregir. Las pruebas exigen que
el motivo contenga `'1500.0000'` en el caso de la diferencia cero y la etiqueta del ajuste en los
tres casos.

- [ ] **Step 7: La validación del endpoint**

En `PrefacturaRenglonController::estancia()`:

```php
            'ajustes_2h_12h' => ['sometimes', 'integer', 'min:0', 'max:999'],
            'ajustes_12h_pernocta' => ['sometimes', 'integer', 'min:0', 'max:999'],
```

`sometimes` y no `required`: las dos son opcionales, de modo que una petición del bloque 4 sigue
valiendo. Pásalas al servicio con `$datos['ajustes_2h_12h'] ?? 0` y `$datos['ajustes_12h_pernocta'] ?? 0`.

Y añade las dos al mapa de `mensajesDeEstancia()`, que itera y genera los cuatro mensajes de cada
campo:

```php
            'ajustes_2h_12h' => 'los ajustes de 2 h a 12 h',
            'ajustes_12h_pernocta' => 'los ajustes de 12 h a pernocta',
```

- [ ] **Step 8: Corre las pruebas**

Run: `php artisan test tests/Feature/Facturacion/AjusteEstanciaTest.php`
Expected: PASS, 13 pruebas.

Run: `php artisan test`
Expected: PASS, 1034 + 13 = **1047**.

- [ ] **Step 9: Verifica por mutación**

1. Quita las dos entradas nuevas de `CONCEPTOS_ESTANCIA` (dejando las constantes). Expected: falla
   «los dos conceptos de ajuste NO se pueden agregar a mano» y «recalcular REEMPLAZA el ajuste previo».
2. En `diferenciaDeTarifa()`, cambia `> 0` por `>= 0`. Expected: falla «si la diferencia es CERO».
3. Quita la guarda de `null` y deja solo el `bcsub`. Expected: falla «si falta una de las dos tarifas».
4. Devuelve la diferencia sin la guarda de signo. Expected: falla «si la diferencia es NEGATIVA».
5. Deja `etiquetaDe()` sin las dos ramas nuevas. Expected: falla «una cortesía de ajuste que se
   PIERDE también se avisa», con `UnhandledMatchError`.

Restaura con `git checkout --` después de cada una.

- [ ] **Step 10: Commit**

```bash
vendor/bin/pint --dirty
git add database/migrations/2026_09_29_094000_seed_conceptos_de_ajuste_de_estancia.php app/Models/FactServicio.php app/Services/CargosEstancia.php app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php tests/Feature/Facturacion/AjusteEstanciaTest.php
git commit -m "El ajuste de estancia cobra la diferencia de dos tarifas, y rechaza la diferencia negativa"
```

---

## Task 2: El saldo a favor

**Files:**
- Create: `database/migrations/2026_09_29_094100_seed_forma_pago_saldo_a_favor.php`
- Modify: `app/Models/FactFormaPago.php`
- Test: `tests/Feature/Facturacion/SaldoAFavorTest.php`

**Interfaces:**
- Consumes: `FactPrefacturaPago`, `PagosPrefactura::registrar()`, `FactPrefactura::cambio()`,
  `cobradoDeMas()`, `efectivoPagado()`, todos del bloque 3.
- Produces: `FactFormaPago::CONCEPTO_SALDO_A_FAVOR = 'saldo_a_favor'`, y una fila en
  `fact_formas_pago` con ese concepto y el nombre `Saldo a favor`.

**Contexto que el brief no puede saber:**

- **No hay seeder de formas de pago.** Las tres de hoy reciben su concepto en la migración
  `2026_09_29_093000`, que las busca **por nombre** entre las ya importadas. Esta forma de pago, en
  cambio, **no existe en el origen**: hay que **crearla**, no asignarle un concepto. Usa
  `updateOrInsert` por concepto, para que correr la migración dos veces no deje dos filas.
- **`fact_formas_pago` tiene una columna `status`** con `'A'` activo (es el patrón de todos los
  catálogos del bloque 1b). Créala activa. Mira el `$fillable` del modelo antes de escribir el
  `insert` para no inventar columnas.
- **El cambio ya está resuelto y no hay que tocar nada:** `FactPrefactura::cambio()`
  (`FactPrefactura.php:246`) acota el sobrepago al **efectivo**, y `efectivoPagado()` filtra por
  `CONCEPTO_EFECTIVO`. Así que un sobrepago con saldo a favor cae en `cobradoDeMas()` **por
  construcción**. La prueba lo fija; el código no cambia.
- `formasDePago()` en `tests/Pest.php:274` crea las siete del catálogo con sus conceptos. **Añade
  ahí la nueva**, indexada por su concepto, para que las pruebas de los demás bloques la tengan
  disponible sin duplicar el montaje.

- [ ] **Step 1: Escribe las pruebas que fallan**

```php
<?php

use App\Models\FactFormaPago;

test('la forma de pago del saldo a favor existe tras migrar, activa y con su concepto', function () {
    $forma = FactFormaPago::where('concepto', FactFormaPago::CONCEPTO_SALDO_A_FAVOR)->sole();

    expect($forma->nombre)->toBe('Saldo a favor')
        ->and($forma->status)->toBe('A');
});

test('un pago con saldo a favor NO baja el subtotal ni el IVA de la prefactura', function () {
    // Es la razon de disenarlo como forma de pago y no como renglon negativo: un saldo a
    // favor es dinero, no un precio menor, asi que no toca la base gravable. El sistema
    // viejo lo metia como renglon negativo y bajaba el IVA en los 4 casos del historico.
    [$p] = prefacturaCompleta(1000.0, 1);
    $formas = formasDePago();

    $subtotalAntes = $p->subtotal();
    $ivaAntes = $p->iva();

    pagoDe($p, $formas[FactFormaPago::CONCEPTO_SALDO_A_FAVOR], '300.00');

    expect($p->fresh()->subtotal())->toBe($subtotalAntes)
        ->and($p->fresh()->iva())->toBe($ivaAntes)
        ->and($p->fresh()->pagado())->toBe('300.00')
        ->and($p->fresh()->porCobrar())->toBe('860.00');
});

test('un sobrepago con saldo a favor cae en cobrado de mas, NO en cambio', function () {
    // No se devuelve efectivo por un saldo. Sale gratis porque cambio() acota al efectivo.
    [$p] = prefacturaCompleta(100.0, 1);
    $formas = formasDePago();

    pagoDe($p, $formas[FactFormaPago::CONCEPTO_SALDO_A_FAVOR], '200.00');

    expect($p->fresh()->cambio())->toBe('0.00')
        ->and($p->fresh()->cobradoDeMas())->toBe('84.00')
        ->and($p->fresh()->sobrepago())->toBe('84.00');
});

test('con efectivo Y saldo a favor, solo el efectivo puede volver como cambio', function () {
    [$p] = prefacturaCompleta(100.0, 1);
    $formas = formasDePago();

    pagoDe($p, $formas[FactFormaPago::CONCEPTO_SALDO_A_FAVOR], '100.00');
    pagoDe($p, $formas[FactFormaPago::CONCEPTO_EFECTIVO], '50.00');

    // Pagado 150.00 contra un total de 116.00: sobran 34.00, y hay 50.00 de efectivo.
    expect($p->fresh()->cambio())->toBe('34.00')
        ->and($p->fresh()->cobradoDeMas())->toBe('0.00');
});

test('el saldo a favor se registra por el endpoint de pagos como cualquier otra forma', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    $formas = formasDePago();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/pagos", [
        'forma_pago_id' => $formas[FactFormaPago::CONCEPTO_SALDO_A_FAVOR]->id,
        'monto' => '50.00',
    ])->assertOk();

    expect($p->fresh()->pagado())->toBe('50.00');
});
```

- [ ] **Step 2: Córrelas para verificar que fallan**

Run: `php artisan test tests/Feature/Facturacion/SaldoAFavorTest.php`
Expected: FAIL — la constante `CONCEPTO_SALDO_A_FAVOR` no existe.

- [ ] **Step 3: El concepto en el modelo**

En `app/Models/FactFormaPago.php`, junto a los otros tres:

```php
    /**
     * Dinero que el cliente ya tenía a su favor, aplicado contra la cuenta.
     *
     * Es una forma de pago y no un renglón negativo a propósito: un saldo a favor es
     * dinero, no un precio menor, así que la cuenta conserva su base gravable y su IVA.
     * El sistema viejo lo capturaba como renglón con precio negativo —4 casos en el
     * histórico, con la remisión «SaldoaFavor»— y eso bajaba el IVA.
     *
     * El sistema NO lleva la cuenta del saldo de cada cliente: el importe lo escribe el
     * operador, igual que el efectivo.
     */
    public const CONCEPTO_SALDO_A_FAVOR = 'saldo_a_favor';
```

- [ ] **Step 4: La migración que la crea**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Crea la forma de pago del saldo a favor, que NO existe en el origen: allí se capturaba
 * como un renglón con precio negativo, lo que bajaba el IVA de la cuenta.
 *
 * A diferencia de `2026_09_29_093000`, que asigna conceptos a filas ya importadas, esta
 * inserta una fila nueva. `updateOrInsert` por concepto para que correrla dos veces no
 * deje dos filas.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('fact_formas_pago')->updateOrInsert(
            // Literal y no `FactFormaPago::CONCEPTO_SALDO_A_FAVOR`: una migración aplicada
            // no puede depender del modelo, que cambia.
            ['concepto' => 'saldo_a_favor'],
            ['nombre' => 'Saldo a favor', 'status' => 'A', 'created_at' => now(), 'updated_at' => now()],
        );
    }

    public function down(): void
    {
        DB::table('fact_formas_pago')->where('concepto', 'saldo_a_favor')->delete();
    }
};
```

**Comprueba el `$fillable` y las columnas reales de `fact_formas_pago` antes de dar esto por bueno:**
si la tabla no tiene `timestamps`, quita `created_at`/`updated_at`; si tiene más columnas
obligatorias, añádelas. Una migración que falla a media tabla es peor que no tenerla.

- [ ] **Step 5: El ayudante de pruebas**

En `tests/Pest.php`, dentro de `formasDePago()`, añade la nueva al arreglo `$definicion`:

```php
        'Saldo a favor' => App\Models\FactFormaPago::CONCEPTO_SALDO_A_FAVOR,
```

- [ ] **Step 6: Corre las pruebas**

Run: `php artisan test tests/Feature/Facturacion/SaldoAFavorTest.php`
Expected: PASS, 5 pruebas.

Run: `php artisan test`
Expected: PASS, **1052**.

- [ ] **Step 7: Verifica por mutación**

1. Haz que `efectivoPagado()` no filtre por concepto (que cuente todos los pagos). Expected: falla
   «un sobrepago con saldo a favor cae en cobrado de más, NO en cambio».
2. Cambia el `status` de la migración a `'I'`. Expected: falla la primera prueba.

- [ ] **Step 8: Commit**

```bash
vendor/bin/pint --dirty
git add database/migrations/2026_09_29_094100_seed_forma_pago_saldo_a_favor.php app/Models/FactFormaPago.php tests/Pest.php tests/Feature/Facturacion/SaldoAFavorTest.php
git commit -m "El saldo a favor es una forma de pago, asi que no baja la base gravable"
```

---

## Task 3: `filas` sustituye a `importes` en el contrato de la vista

**Files:**
- Modify: `app/Http/Controllers/Api/Facturacion/PrefacturaPdfController.php`
- Modify: `resources/views/pdf/prefactura.blade.php`
- Modify: `tests/Feature/Facturacion/DocumentoPrefacturaTest.php`
- Modify: `tests/Feature/Facturacion/ImpresionPrefacturaTest.php`

**Interfaces:**
- Consumes: el contrato de nueve claves del bloque 4.
- Produces: el contrato con la clave `importes` **sustituida** por `filas`, un
  `list<array{concepto: string, cortesia: bool, remision: ?string, precio: ?string, cantidad: ?int, importe: string}>`
  ya resuelto, en el orden en que se imprime. La Task 5 hace que esa lista colapse los grupos.

**Esta task NO agrupa nada.** Es el cambio de forma, solo. Después de ella el documento imprime
exactamente lo mismo que antes; lo que cambia es **quién** decide las filas.

**Contexto que el brief no puede saber:**

- **Hoy la vista hace dos cosas que con grupos dejan de valer:** itera `$prefactura->renglones` y
  busca `$importes[$renglon->id]`. Con grupos, una fila impresa **no corresponde a un renglón**, así
  que la vista no puede iterar renglones ni indexar por id. Por eso la clave pasa a ser la lista de
  filas ya resuelta, y la vista solo imprime.
- **Por qué sustituir y no añadir:** dejar `importes` **y** `filas` dejaría dos fuentes de verdad
  para el mismo importe, y la vista tendría que elegir. Una sola.
- **La prueba del bloque 4 «una clave que falte en importes revienta» cambia de forma pero no de
  propósito:** ahora lo que tiene que reventar es una fila **sin su clave `importe`**. Consérvala
  con ese sentido; el `Undefined array key` sigue siendo un `ErrorException` que Laravel lanza en
  todos los entornos (`HandleExceptions::handleError`), no solo en pruebas.
- **La prueba de la carrera** de `ImpresionPrefacturaTest` (un renglón que se corrige entre la carga
  y la verificación) **tiene que seguir muriendo** con las dos mutaciones que mata hoy: construir
  las filas fuera del `try`, y construirlas releyendo los renglones de la base. Por eso `filasDe()`
  sustituye a `importesDe()` **con las mismas dos propiedades**: dentro del `try`, y sobre la
  colección `$prefactura->renglones` **ya cargada**.
- `pint --dirty` tocará estos archivos; está bien.

- [ ] **Step 1: Adapta las pruebas que ya existen**

En `DocumentoPrefacturaTest.php`, el ayudante `importesDe($p)` pasa a ser `filasDe($p)` y devuelve
la lista de filas; `documentoDe()` pasa `filas` en lugar de `importes`. La prueba que hoy comprueba
que la vista imprime el importe **recibido** y no el derivado sigue valiendo: pásale una fila cuyo
`importe` sea `'99.99'` para un renglón de 100 × 2 y exige que no salga `200.00`.

La prueba de la clave ausente pasa a quitar la clave `importe` de una fila.

En `ImpresionPrefacturaTest.php` solo cambian los nombres: la prueba de la carrera y las de la tasa
siguen igual en su intención.

- [ ] **Step 2: Añade la prueba del contrato nuevo**

```php
test('la vista imprime las filas que recibe, en su orden, y no mira los renglones', function () {
    // El contrato: una fila impresa no corresponde necesariamente a un renglon. La Task 5
    // lo usa para colapsar grupos; aqui se fija la forma.
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    $html = view('pdf.prefactura', [
        'prefactura' => $cerrada->fresh(['renglones', 'pagos.formaPago', 'cliente', 'aeronave']),
        'esCotizacion' => false,
        'subtotal' => '7.77',
        'iva' => '1.24',
        'ivaEtiqueta' => '16%',
        'total' => '9.01',
        'cambio' => '0.00',
        'elaboradoPor' => 'Ana Pérez',
        'filas' => [
            ['concepto' => 'PRIMERA FILA INVENTADA', 'cortesia' => false, 'remision' => 'R-1', 'precio' => '11.1111', 'cantidad' => 2, 'importe' => '22.22'],
            ['concepto' => 'SEGUNDA FILA INVENTADA', 'cortesia' => true, 'remision' => null, 'precio' => null, 'cantidad' => null, 'importe' => '0.00'],
        ],
    ])->render();

    // Imprime lo que recibe...
    expect($html)->toContain('PRIMERA FILA INVENTADA')
        ->and($html)->toContain('SEGUNDA FILA INVENTADA')
        ->and($html)->toContain('22.22')
        ->and($html)->toContain('11.1111')
        // ...y NO el nombre del renglon real, que no viaja en las filas.
        ->and($html)->not->toContain($cerrada->renglones->first()->nombre_servicio);
});

test('una fila sin precio ni cantidad imprime un guion y no revienta', function () {
    // Es la forma de la fila de un grupo, que no tiene un precio unitario unico.
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    $html = view('pdf.prefactura', [
        'prefactura' => $cerrada->fresh(['renglones', 'pagos.formaPago', 'cliente', 'aeronave']),
        'esCotizacion' => false,
        'subtotal' => '100.00', 'iva' => '16.00', 'ivaEtiqueta' => '16%', 'total' => '116.00',
        'cambio' => '0.00', 'elaboradoPor' => 'Ana Pérez',
        'filas' => [
            ['concepto' => 'Servicios de rampa', 'cortesia' => false, 'remision' => null, 'precio' => null, 'cantidad' => null, 'importe' => '500.00'],
        ],
    ])->render();

    expect($html)->toContain('Servicios de rampa')
        ->and($html)->toContain('500.00');
});
```

- [ ] **Step 3: Córrelas para verificar que fallan**

Run: `php artisan test tests/Feature/Facturacion/DocumentoPrefacturaTest.php`
Expected: FAIL — la vista sigue esperando `importes`.

- [ ] **Step 4: El controlador**

Sustituye `importesDe()` por `filasDe()`, conservando **las dos propiedades que la hacen segura**:

```php
    /**
     * Las filas del documento, ya resueltas, en el orden en que se imprimen.
     *
     * Las dos cosas que la hacen segura, y que no se pueden cambiar sin romper un
     * invariante del bloque 4:
     *
     * - La calcula el CONTROLADOR, dentro de su `try/catch`, y no la vista: la vista se
     *   renderiza después de ese `try/catch`, así que una excepción de `importe()` ahí
     *   sería un 500 en lugar de un 422.
     * - Usa la colección `$prefactura->renglones` YA CARGADA y no otra lectura, porque
     *   `subtotalDerivado()` sí relee: si alguien corrigiera un `ajuste_precio` desconocido
     *   entre la carga y esa relectura, la verificación no lanzaría y esto sí, sobre el
     *   objeto viejo, y saldría un 500 en un documento cuyos datos vigentes están bien.
     *
     * @return list<array{concepto: string, cortesia: bool, remision: ?string, precio: ?string, cantidad: ?int, importe: string}>
     */
    private function filasDe(FactPrefactura $prefactura): array
    {
        return $prefactura->renglones
            ->map(fn (FactPrefacturaRenglon $renglon) => [
                'concepto' => $renglon->nombre_servicio,
                'cortesia' => (bool) $renglon->es_cortesia,
                'remision' => $renglon->remision,
                'precio' => (string) $renglon->precio_unitario,
                'cantidad' => $renglon->cantidad,
                'importe' => $renglon->importe(),
            ])
            ->values()
            ->all();
    }
```

Y las dos llamadas pasan `'filas' => $this->filasDe($prefactura)` en lugar de `'importes' => ...`,
**dentro del `try`** en los dos métodos.

- [ ] **Step 5: La vista**

El `@foreach` pasa a iterar `$filas`:

```blade
            @foreach($filas as $fila)
                <tr>
                    <td>
                        {{ $fila['concepto'] }}
                        @if($fila['cortesia'])
                            <span class="cortesia">(Cortesía)</span>
                        @endif
                    </td>
                    <td>{{ $fila['remision'] ?: '—' }}</td>
                    <td class="derecha">{{ $fila['precio'] ?? '—' }}</td>
                    <td class="centro">{{ $fila['cantidad'] ?? '—' }}</td>
                    <td class="derecha">{{ number_format($fila['importe'], 2) }}</td>
                </tr>
            @endforeach
```

**Y actualiza el comentario de cabecera de la vista**: la clave `importes` ya no existe, y la lista
de nueve claves tiene que nombrar `filas` con su forma. Lo demás de ese comentario —el porqué del
422 frente al 500, la razón y la cota de `number_format`— **se conserva tal cual**: sigue siendo
verdad. **No escribas en presente nada que no exista todavía**: los grupos llegan en la Task 5, así
que no los menciones como si ya estuvieran.

- [ ] **Step 6: Corre las pruebas**

Run: `php artisan test tests/Feature/Facturacion/DocumentoPrefacturaTest.php tests/Feature/Facturacion/ImpresionPrefacturaTest.php`
Expected: PASS.

Run: `php artisan test`
Expected: PASS, **1054**.

- [ ] **Step 7: Verifica por mutación**

1. Mueve la construcción de `filas` al `return`, fuera del `try`. Expected: falla la prueba de la
   carrera de `ImpresionPrefacturaTest`.
2. Haz que `filasDe()` relea con `$prefactura->renglones()->get()`. Expected: falla la misma.
3. Haz que la vista vuelva a iterar `$prefactura->renglones`. Expected: falla «la vista imprime las
   filas que recibe».

- [ ] **Step 8: Commit**

```bash
vendor/bin/pint --dirty
git add app/Http/Controllers/Api/Facturacion/PrefacturaPdfController.php resources/views/pdf/prefactura.blade.php tests/Feature/Facturacion/DocumentoPrefacturaTest.php tests/Feature/Facturacion/ImpresionPrefacturaTest.php
git commit -m "El documento imprime filas ya resueltas, no renglones: sin esto no se puede agrupar"
```

---

## Task 4: Agrupar — la columna y el endpoint

**Files:**
- Create: `database/migrations/2026_09_29_094200_add_grupo_to_fact_prefactura_renglones_table.php`
- Modify: `app/Models/FactPrefacturaRenglon.php`
- Modify: `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Facturacion/AgruparRenglonesTest.php`

**Interfaces:**
- Consumes: el trait `RechazaPrefacturaCerrada` con `rechazoRapido()` y `rechazarSiDescartada()`;
  `PrefacturaRenglonController::bloquear(int $id)`.
- Produces: la columna `fact_prefactura_renglones.grupo` (`string(60)` nullable, indexada), en el
  `$fillable`; y `PATCH /api/facturacion/prefacturas/{id}/renglones/{renglon}/grupo`, que recibe
  `{"grupo": "Servicios de rampa"}` o `{"grupo": null}` para desagrupar. La Task 5 lee la columna.

**Contexto que el brief no puede saber:**

- **El endpoint se escribe imitando `cortesia()`** (`PrefacturaRenglonController.php:137`), que ya
  resuelve todo lo difícil: `rechazoRapido()` antes de la transacción, `bloquear()` dentro,
  `rechazarSiDescartada()` sobre lo bloqueado, `firstOrFail()` del renglón sobre la relación de la
  prefactura —de modo que un renglón de otra prefactura da 404—, salida temprana si no hay cambio,
  y bitácora dentro de la transacción. **Léelo y síguelo.**
- **La guarda de prefactura cerrada ya existe en el modelo** (`FactPrefacturaRenglon::booted()`), así
  que no escribas una nueva: `$fila->update(...)` sobre una cerrada lanza
  `RenglonDePrefacturaCerradaException` y el manejador la traduce a 409. Eso es lo que hace que el
  grupo quede congelado al cerrar, sin código extra.
- **El grupo NO entra en ningún cálculo.** No toques `subtotal()`, `importe()` ni nada del dinero.
  Si te ves tocándolos, has entendido mal la task.
- La ruta va en el grupo `subdep:factPrefacturas` de escritura, junto a la de cortesía, y **sí**
  entra en la tabla de rutas protegidas de `EndpointsPrefacturaTest.php:157`, porque es un `PATCH`
  y esa tabla recoge todo lo que no es GET ni HEAD.

- [ ] **Step 1: Escribe las pruebas que fallan**

```php
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
        ->and($b->fresh()->importe())->toBe('50.00');
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
        ->and($registro->registro_id)->toBe($p->id);
});

test('poner la misma etiqueta dos veces no escribe de nuevo', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 1);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => 'Rampa'])->assertOk();
    $cuantas = Bitacora::where('accion', Bitacora::ACCION_ACTUALIZAR)->count();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => 'Rampa'])->assertOk();

    expect(Bitacora::where('accion', Bitacora::ACCION_ACTUALIZAR)->count())->toBe($cuantas);
});

test('una etiqueta vacia o de solo espacios se rechaza', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 1);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => ''])
        ->assertStatus(422)->assertJsonValidationErrorFor('grupo');

    // Un texto de solo espacios: `TrimStrings` lo deja vacio antes de validar.
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => '   '])
        ->assertStatus(422)->assertJsonValidationErrorFor('grupo');
});

test('una etiqueta de mas de 60 caracteres se rechaza', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 100.0, 1);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}/grupo", ['grupo' => str_repeat('a', 61)])
        ->assertStatus(422)->assertJsonValidationErrorFor('grupo');
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
```

Y añade la ruta nueva a la tabla de `tests/Feature/Facturacion/EndpointsPrefacturaTest.php:157`:

```php
        'PATCH api/facturacion/prefacturas/{id}/renglones/{renglon}/grupo' => 'subdep:factPrefacturas',
```

- [ ] **Step 2: Córrelas para verificar que fallan**

Run: `php artisan test tests/Feature/Facturacion/AgruparRenglonesTest.php`
Expected: FAIL con 404: la ruta no existe.

- [ ] **Step 3: La migración**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La etiqueta de agrupación de un renglón. Los renglones de una prefactura que comparten
 * etiqueta se imprimen como UNA fila, con la suma de sus importes.
 *
 * Es solo de presentación: no entra en ningún cálculo. En el sistema viejo agrupar ponía
 * los importes en cero y creaba un renglón «Otros» con la suma, y el folio 932 del
 * histórico perdió 14,344.00 porque los puso en cero y el «Otros» nunca llegó a crearse.
 * Aquí el dinero no se toca, así que esa pérdida no es posible.
 *
 * La etiqueta ES la identidad del grupo: dos renglones con la misma etiqueta son el mismo
 * grupo. No hay forma de tener dos grupos llamados igual, y es deliberado: a cambio,
 * desagrupar es poner la columna a `null` y la etiqueta impresa no necesita catálogo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fact_prefactura_renglones', function (Blueprint $table) {
            $table->string('grupo', 60)->nullable()->index()->after('remision');
        });
    }

    public function down(): void
    {
        Schema::table('fact_prefactura_renglones', function (Blueprint $table) {
            $table->dropIndex(['grupo']);
            $table->dropColumn('grupo');
        });
    }
};
```

- [ ] **Step 4: El modelo**

Añade `'grupo'` al `$fillable` de `FactPrefacturaRenglon`. **No** añadas cast: es una cadena.

- [ ] **Step 5: El endpoint**

En `PrefacturaRenglonController`, imitando `cortesia()`:

```php
    /**
     * Agrupa o desagrupa un renglón: `grupo` es la etiqueta, o `null` para desagrupar.
     *
     * NO toca el dinero, y eso es el invariante del bloque: `subtotal()` sigue sumando el
     * importe de cada renglón, uno por uno, y el grupo solo existe al imprimir. Por eso no
     * hace falta ninguna guarda contra perder dinero — no hay nada que poner en cero.
     *
     * Que el grupo quede congelado al cerrar sale gratis: la guarda de
     * `FactPrefacturaRenglon` rechaza cualquier escritura sobre una prefactura cerrada.
     */
    public function grupo(Request $request, int $id, int $renglon): JsonResponse
    {
        $datos = $request->validate(
            ['grupo' => ['present', 'nullable', 'string', 'min:1', 'max:60']],
            [
                'grupo.present' => 'Indica la etiqueta del grupo, o null para desagrupar.',
                'grupo.min' => 'La etiqueta del grupo no puede estar vacía. Para desagrupar, manda null.',
                'grupo.max' => 'La etiqueta del grupo no puede pasar de 60 caracteres.',
            ],
        );

        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazoRapido($prefactura)) {
            return $respuesta;
        }

        // ... la transacción, con `bloquear()`, `rechazarSiDescartada()`, el `firstOrFail()`
        // del renglón sobre la relación, la salida temprana si el grupo no cambia, el
        // `update(['grupo' => ...])` y la bitácora. Sigue `cortesia()` paso por paso.
    }
```

La descripción de la bitácora tiene que **decir la etiqueta** al agrupar y **decir que se
desagrupó** al quitarla, y nombrar el servicio, como hacen las demás.

- [ ] **Step 6: La ruta**

```php
        Route::patch('/prefacturas/{id}/renglones/{renglon}/grupo', [PrefacturaRenglonController::class, 'grupo'])->whereNumber('id')->whereNumber('renglon');
```

- [ ] **Step 7: Corre las pruebas**

Run: `php artisan test tests/Feature/Facturacion/AgruparRenglonesTest.php tests/Feature/Facturacion/EndpointsPrefacturaTest.php`
Expected: PASS, 10 nuevas.

Run: `php artisan test`
Expected: PASS, **1064**.

- [ ] **Step 8: Verifica por mutación**

1. Haz que el endpoint ponga además `importe` a cero en el renglón (simulando el sistema viejo).
   Expected: falla «agrupar NO cambia el dinero».
2. Quita el `min:1`. Expected: falla «una etiqueta vacía o de solo espacios se rechaza».
3. Busca el renglón con `FactPrefacturaRenglon::findOrFail($renglon)` en lugar de sobre la relación.
   Expected: falla «un renglón de OTRA prefactura da 404».
4. Quita la salida temprana cuando el grupo no cambia. Expected: falla «poner la misma etiqueta dos
   veces no escribe de nuevo».

- [ ] **Step 9: Commit**

```bash
vendor/bin/pint --dirty
git add database/migrations/2026_09_29_094200_add_grupo_to_fact_prefactura_renglones_table.php app/Models/FactPrefacturaRenglon.php app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php routes/api.php tests/Feature/Facturacion/AgruparRenglonesTest.php tests/Feature/Facturacion/EndpointsPrefacturaTest.php
git commit -m "Agrupar es una etiqueta en el renglon: no toca el dinero, asi que no puede perderlo"
```

---

## Task 5: Agrupar — el documento

**Files:**
- Modify: `app/Http/Controllers/Api/Facturacion/PrefacturaPdfController.php`
- Test: `tests/Feature/Facturacion/AgruparRenglonesTest.php`

**Interfaces:**
- Consumes: la columna `grupo` (Task 4) y el contrato `filas` (Task 3).
- Produces: `filasDe()` colapsando grupos. Nada posterior lo consume: la vista ya está hecha.

**La vista NO se toca en esta task.** Ya itera filas y ya imprime `—` cuando el precio o la cantidad
son `null`. Todo el cambio está en cómo el controlador arma la lista.

**Contexto:**

- **El orden:** un grupo ocupa el lugar del **`orden` menor** de sus renglones, de modo que no salta
  al final. Los renglones ya vienen ordenados por `orden` y luego `id`, así que recorrerlos en ese
  orden y emitir el grupo **la primera vez que aparece** lo consigue sin ordenar nada aparte.
- **La suma** se hace con `bcadd` sobre los importes, a dos decimales. **No uses `array_sum`**, que
  pasa por `float`.
- **La cortesía dentro de un grupo:** su `importe()` es `'0.00'`, así que contribuye cero. La fila
  del grupo **no** lleva la marca «(Cortesía)», porque la marca describe un renglón y no una suma.
  Eso significa que el cliente deja de ver que ese servicio fue gratis, y es una consecuencia
  aceptada de agrupar; la pantalla avisará (Task 6).

- [ ] **Step 1: Escribe las pruebas que fallan**

```php
test('el documento imprime UNA fila por grupo, con la etiqueta y la suma', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(1000.0, 1);
    $a = renglonDe($p, 100.0, 2);   // 200.00
    $b = renglonDe($p, 50.0, 1);    // 50.00
    $a->update(['grupo' => 'Servicios de rampa']);
    $b->update(['grupo' => 'Servicios de rampa']);
    $cerrada = cerrarConSello($p->fresh(), '1250.00', '200.00', '1450.00');

    $filas = null;
    View::composer('pdf.prefactura', function ($vista) use (&$filas) { $filas = $vista->getData()['filas']; });

    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertOk();

    $grupo = collect($filas)->firstWhere('concepto', 'Servicios de rampa');

    expect($grupo)->not->toBeNull()
        ->and($grupo['importe'])->toBe('250.00')
        ->and($grupo['precio'])->toBeNull()
        ->and($grupo['cantidad'])->toBeNull()
        // Los dos renglones agrupados NO salen por su nombre.
        ->and(collect($filas)->pluck('concepto'))->not->toContain($a->nombre_servicio)
        ->and(collect($filas)->pluck('concepto'))->not->toContain($b->nombre_servicio)
        // Y el renglon sin agrupar si.
        ->and(collect($filas)->pluck('concepto'))->toContain($p->renglones()->whereNull('grupo')->first()->nombre_servicio);
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
    View::composer('pdf.prefactura', function ($vista) use (&$filas) { $filas = $vista->getData()['filas']; });

    $this->get("/api/facturacion/prefacturas/{$p->id}/cotizacion")->assertOk();

    expect(collect($filas)->pluck('concepto')->all())->toBe(['PRIMERO SUELTO', 'EL GRUPO', 'TERCERO SUELTO']);
});

test('una cortesia dentro de un grupo contribuye cero a la suma', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $cobrado = renglonDe($p, 100.0, 1);
    $gratis = renglonDe($p, 300.0, 1);
    $cobrado->update(['grupo' => 'Rampa']);
    $gratis->update(['grupo' => 'Rampa', 'es_cortesia' => true]);

    $filas = null;
    View::composer('pdf.prefactura', function ($vista) use (&$filas) { $filas = $vista->getData()['filas']; });

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
    View::composer('pdf.prefactura', function ($vista) use (&$filas) { $filas = $vista->getData()['filas']; });

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
    View::composer('pdf.prefactura', function ($vista) use (&$filas) { $filas = $vista->getData()['filas']; });

    $this->get("/api/facturacion/prefacturas/{$p->id}/cotizacion")->assertOk();

    $suma = collect($filas)->reduce(fn ($acc, $f) => bcadd($acc, $f['importe'], 2), '0.00');

    expect($suma)->toBe($p->fresh()->subtotal());
});
```

Recuerda el `use Illuminate\Support\Facades\View;` arriba del archivo.

- [ ] **Step 2: Córrelas para verificar que fallan**

Run: `php artisan test tests/Feature/Facturacion/AgruparRenglonesTest.php`
Expected: FAIL — `filasDe()` emite una fila por renglón, así que los agrupados salen por su nombre.

- [ ] **Step 3: `filasDe()` colapsa los grupos**

Recorre los renglones **en su orden** y emite:

- una fila propia por cada renglón **sin** grupo;
- una fila por cada grupo, **la primera vez** que aparece, con la etiqueta como concepto,
  `precio` y `cantidad` en `null`, `cortesia` en `false`, `remision` en `null`, y el importe
  acumulado con `bcadd` sobre **todos** los renglones de ese grupo.

Actualiza el docblock para que diga **también** que colapsa los grupos y por qué el orden es el del
`orden` menor. Y conserva las dos razones que ya están escritas —dentro del `try`, sobre la
colección cargada—, que siguen siendo igual de ciertas.

- [ ] **Step 4: Corre las pruebas**

Run: `php artisan test tests/Feature/Facturacion/AgruparRenglonesTest.php`
Expected: PASS, 15 (las 10 de la Task 4 y 5 de esta).

Run: `php artisan test`
Expected: PASS, **1069**.

- [ ] **Step 5: Verifica por mutación**

1. Emite la fila del grupo **al final** en lugar de en su primera aparición. Expected: falla «el
   grupo ocupa el lugar del orden MENOR».
2. Suma con `array_sum` sobre los importes. Expected: con `33.33 × 3` la prueba del subtotal puede
   seguir pasando; si pasa, **dilo en el reporte** y busca un caso que la mate, o deja escrito que
   esa mutación sobrevive.
3. Usa `importeSinCortesia()` en la suma del grupo. Expected: falla «una cortesía dentro de un grupo
   contribuye cero».
4. Pon la etiqueta del grupo en `remision` en lugar de en `concepto`. Expected: falla la primera.

- [ ] **Step 6: Commit**

```bash
vendor/bin/pint --dirty
git add app/Http/Controllers/Api/Facturacion/PrefacturaPdfController.php tests/Feature/Facturacion/AgruparRenglonesTest.php
git commit -m "El documento colapsa los grupos en una fila, en el lugar de su primer renglon"
```

---

## Task 6: La pantalla

**Files:**
- Modify: `resources/js/stores/apiFacturacionCatalogos.ts`
- Modify: `resources/js/pages/Facturacion/EditorPrefactura.tsx`

**Interfaces:**
- Consumes: `PATCH .../renglones/{renglon}/grupo` (Task 4) y los dos campos nuevos de
  `PATCH .../estancia` (Task 1).
- Produces: nada que otra task consuma. Es la última de producto.

**Contexto que el brief no puede saber:**

- **El tipo del renglón** en `apiFacturacionCatalogos.ts` gana `grupo: string | null`. Busca el
  tipo que ya tiene `es_cortesia` y añádelo ahí.
- **El patrón a imitar es el de la cortesía:** `cortesia()` en `EditorPrefactura.tsx:532` usa
  `ejecutar(clave, mensaje, async () => ...)`, y la insignia `CORTESÍA` de la línea 948 muestra
  cómo se marca un renglón en la tabla. Haz lo mismo con el grupo: una insignia con la etiqueta.
- **El saldo a favor no necesita nada**, si el panel de cobro lista las formas de pago del catálogo
  sin filtrar por concepto. **Compruébalo** en `resources/js/pages/Facturacion/components/PanelCobro.tsx`:
  si filtra, añade la nueva; si no, no toques nada y **dilo en el reporte**.
- **No reformatees** `EditorPrefactura.tsx`: `prettier` ya lo marcaba antes del bloque.

- [ ] **Step 1: Las llamadas en el store**

Añade `grupo(prefacturaId, renglonId, grupo: string | null)` junto a `cortesia`, y los dos campos
opcionales en la llamada de estancia.

- [ ] **Step 2: Agrupar en la tabla de renglones**

- Una insignia con la etiqueta en los renglones agrupados, junto a la de `CORTESÍA`.
- Una acción para **agrupar**: pide la etiqueta con `Swal` (`input: 'text'`), y **ofrece las
  etiquetas que ya existen en la prefactura** para que reutilizar una sea deliberado y no un
  accidente — es lo que la especificación pide, porque la etiqueta **es** la identidad del grupo.
- Una acción para **desagrupar**, que manda `null`.
- **Si el renglón que se va a agrupar es una cortesía, avisa antes de agruparlo:** dentro de un
  grupo su importe cuenta como cero y el cliente **deja de ver** que ese servicio fue gratis. Sigue
  el patrón de `confirmarSobreComisionAmex` (línea 419).
- Deshabilitado con `soloLectura` y con `ocupado`, como el resto.

- [ ] **Step 3: Los dos campos del ajuste de estancia**

Donde hoy se piden pernoctas y tránsitos, dos campos más: «Ajustes de 2 h a 12 h» y «Ajustes de
12 h a pernocta», con un texto que explique que **cobran la diferencia** entre los dos tramos y no
el tramo entero. Mínimo 0, enteros.

- [ ] **Step 4: Verifica**

```bash
npx tsc --noEmit
npx eslint resources/js/pages/Facturacion/EditorPrefactura.tsx resources/js/stores/apiFacturacionCatalogos.ts
npm run build
php artisan test
```

Expected: `tsc` solo con el error preexistente de `WalkAroundController.ts(905,5)`; eslint limpio;
build correcto; la suite en **1069**.

- [ ] **Step 5: Recorre a mano los casos y repórtalos**

El proyecto **no tiene pruebas de frontend** (ni vitest, ni jsdom, ni testing-library) y **no es de
esta task añadirlas**. Tu lectura es la red. Recorre sobre tu propio código y di en el reporte qué
pasa en cada caso, **con el número de línea** donde se decide:

1. Un borrador con dos renglones: ¿cómo se agrupan, y qué ve el operador después?
2. Un renglón ya agrupado: ¿sale la insignia con su etiqueta, y la acción de desagrupar?
3. Una prefactura **cerrada**: ¿se puede agrupar? (No debería: `soloLectura`.)
4. Un renglón marcado como **cortesía**: ¿avisa antes de agruparlo?
5. Una prefactura **descartada**: ¿queda alguna acción de agrupar?

- [ ] **Step 6: Commit**

```bash
git add resources/js/pages/Facturacion/EditorPrefactura.tsx resources/js/stores/apiFacturacionCatalogos.ts
git commit -m "El editor agrupa, desagrupa y pide los dos ajustes de estancia"
```

---

## Task 7: La guía de despliegue

**Files:**
- Create: `docs/superpowers/specs/2026-10-05-facturacion-5-despliegue-y-pendientes.md`

**Interfaces:** ninguna.

**Contexto:** sigue la forma de `2026-10-05-facturacion-4-despliegue-y-pendientes.md`, y **léela
primero**: varias de sus advertencias siguen vigentes y hay que remitir a ellas en lugar de
repetirlas.

- [ ] **Step 1: Escribe la guía**

Tiene que incluir, y esto no es negociable:

- **Tres migraciones nuevas**, y qué hace cada una. La de los conceptos de ajuste **asigna por
  nombre**, así que **si el importador de catálogos no ha traído los servicios 109 y 110, no
  asignará nada y el ajuste de estancia no funcionará**. Di cómo comprobarlo:
  `fact_servicios` tiene que tener dos filas con esos conceptos.
- **El número de pruebas en verde al cierre, medido**, y que se corre **en serie**.
- **Lo que hay que probar a mano:**
  - **Imprimir una prefactura con un grupo y mirar la hoja.** `pdftoppm` no está instalado, así que
    nadie ha visto cómo queda la fila del grupo con tres huecos (remisión, precio y cantidad en
    blanco). Es lo más importante de esta guía.
  - Que la suma de la hoja cuadra con el total, con un grupo puesto.
  - Un ajuste de estancia con tarifas reales, comprobando que cobra la **diferencia**.
  - Un pago con saldo a favor, comprobando que el IVA **no** baja.
- **Las limitaciones, dichas y no escondidas:**
  - **El sistema no lleva la cuenta del saldo de cada cliente**: el importe lo escribe el operador,
    igual que el efectivo. Si facturación espera que el sistema le impida aplicar más saldo del que
    el cliente tiene, eso es otro bloque.
  - **La etiqueta del grupo no tiene catálogo**: «Rampa» y «rampa» son grupos distintos. La pantalla
    ofrece las que ya existen en la prefactura, pero no lo impide.
  - **Una cortesía dentro de un grupo deja de verse** en el papel. El total sigue correcto.
- **La deuda que el bloque NO retira**, remitiendo a la guía del bloque 4 para lo que sigue igual, y
  añadiendo lo que este bloque descubrió:
  - **Hay dos bases de datos del sistema viejo.** `conexion.php` lee `fact-fbo`, que llega al
    2026-08-21; las mediciones de este bloque son de `fact-fbo-prod`, que llega al 2026-09-28. **La
    importación del bloque 6 necesita una copia fresca**, y conviene repetir las mediciones sobre ella.
  - **El mensaje de `ServicioDeEstanciaNoDisponibleException` dice «Corre el importador de
    catálogos», y no existe tal comando** en `app/Console/Commands/` (solo hay `CompararPagos`,
    `CompararPrefacturas` e `ImportarMatriculasPrefactura`). O el mensaje nombra algo que se perdió,
    o hay que escribirlo. Alguien tiene que decidirlo, porque la guía de este bloque depende de que
    los servicios 109 y 110 estén importados.
  - **La base MySQL local de desarrollo no está migrada** al estado del bloque 2: `fact_servicios`
    está vacía y sin columna `concepto`. Las pruebas corren en sqlite, así que no se nota, pero
    quien quiera probar a mano en local tiene que migrar primero.
  - **Los 10 renglones negativos del histórico** se importan así: los **6** de «Cortesía» como
    `es_cortesia` sobre el cargo que cancelan, y los **4** de «Saldo a favor» como pagos con la
    forma nueva. **Dos de los 6 no cancelan ningún cargo** (el 3090 y el 3507), así que esos dos
    necesitan decisión humana. Es trabajo del bloque 6.
  - **`CLAUDE.md` está sin seguimiento en git**, así que las guías del proyecto no llegan a nadie
    más ni sobreviven a un clon limpio.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-10-05-facturacion-5-despliegue-y-pendientes.md
git commit -m "Guia de despliegue del bloque 5: tres migraciones, y que alguien mire la fila del grupo"
```

---

## Autorrevisión del plan

**Cobertura de la especificación.** Cada requisito tiene su task:

| Requisito de la especificación | Task |
|---|---|
| La columna `grupo`, `string(60)` nullable indexada | 4 |
| Agrupar no cambia el dinero (invariante central) | 4 (su primera prueba) |
| El documento colapsa una fila por grupo, con la suma | 5 |
| Remisión, precio y cantidad en blanco en la fila del grupo | 3 (la forma) y 5 (los nulos) |
| El grupo ocupa el lugar del `orden` menor | 5 |
| Una cortesía dentro de un grupo contribuye cero | 5 |
| Congelado al cerrar | 4 (su prueba de 409) |
| Los cinco rechazos de agrupar | 4 |
| Un grupo de un solo renglón se permite | 4 (no hay nada que lo prohíba) y 5 (dos grupos) |
| La pantalla ofrece las etiquetas existentes | 6 |
| Forma de pago del saldo a favor, con su concepto | 2 |
| No baja el subtotal ni el IVA | 2 |
| No genera cambio | 2 |
| Los dos servicios de ajuste, con concepto, en `CONCEPTOS_ESTANCIA` | 1 |
| El precio como diferencia de tarifas, con `bcsub` | 1 |
| Guarda de tarifa ausente, nombrando cuál | 1 |
| Guarda de diferencia cero o negativa | 1 |
| El recálculo continúa si falta una tarifa | 1 |
| `etiquetaDe()` extendido | 1 (Step 5, antes que nada más) |
| Los dos conceptos no se agregan a mano | 1 |
| La limitación del saldo y la de la etiqueta, en la guía | 7 |
| Que alguien mire la hoja con un grupo | 7 |

**Huecos que encontré y cerré al revisar:**

1. **La especificación no decía cómo la vista deja de iterar renglones.** Hoy itera
   `$prefactura->renglones` y busca `$importes[$renglon->id]`, y con grupos una fila no corresponde
   a un renglón. De ahí sale la Task 3, que no estaba en el diseño: el cambio de contrato va solo,
   antes de agrupar, para que su diff sea revisable y no arrastre lógica nueva.
2. **La especificación no decía que `filas` sustituye a `importes`.** Dejar las dos daría dos
   fuentes de verdad para el mismo importe. Y eso obliga a tocar pruebas del bloque 4, lo que la
   Task 3 dice explícitamente para que su implementador no crea que está rompiendo algo.
3. **La guarda de la diferencia cero o negativa y la de la tarifa ausente son la misma puerta.**
   `diferenciaDeTarifa()` devuelve `null` en los tres casos, con lo que reaprovecha el camino de
   `$sinTarifa` que ya existe en lugar de añadir una rama nueva — pero eso obliga a **redactar de
   nuevo el mensaje de `$sinTarifa`**, que hoy dice «No hay tarifa de X» y para un ajuste sería
   falso. Está en el Step 6 de la Task 1.

**Consistencia de tipos.** `CONCEPTO_ESTANCIA_AJUSTE_2H_12H` y
`CONCEPTO_ESTANCIA_AJUSTE_12H_PERNOCTA` se usan con el mismo nombre en las Tasks 1 y en las pruebas.
`recalcular()` gana `int $ajustes2a12 = 0, int $ajustes12aPernocta = 0` y los campos del endpoint se
llaman `ajustes_2h_12h` y `ajustes_12h_pernocta` en las tres apariciones (validación, mensajes y
pantalla). `filasDe()` devuelve la misma forma de seis claves en las Tasks 3 y 5, y la vista lee esas
seis. `grupo` es `string(60)` nullable en la migración, `string | null` en TypeScript y
`['present','nullable','string','min:1','max:60']` en la validación.

---

## Entrega

Plan guardado en `docs/superpowers/plans/2026-10-05-facturacion-5-agrupar-saldo-estancia.md`.
