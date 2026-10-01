# Bloque 2: la prefactura — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la prefactura —encabezado, renglones, cargos de estancia, paquete internacional y totales sellados al cerrar— sobre los catálogos de los bloques 1a y 1b, con un comando que verifica la aritmética contra las 4,053 prefacturas históricas.

**Architecture:** Dos tablas nuevas (`fact_prefacturas`, `fact_prefactura_renglones`) con ciclo borrador → cerrada. Los totales se derivan de los renglones mientras es borrador y se sellan al cerrar, dentro de la misma transacción que asigna el folio desde un contador con bloqueo de fila. El renglón congela precio, margen y ajuste, así que un cambio de catálogo no mueve ningún documento. Los servicios especiales (combustible, los tres de estancia, los cuatro del paquete internacional) se identifican por una columna `concepto` nueva en lugar de por su nombre.

**Tech Stack:** Laravel 12.41, PHP 8.2, Inertia 2, React 19, TypeScript 5.7, Tailwind 4, Pest 4.1 sobre sqlite `:memory:`. Producción en MySQL 8 / MariaDB.

**Spec:** `docs/superpowers/specs/2026-10-01-facturacion-2-prefactura-design.md`

## Global Constraints

- **NINGÚN COBRO PUEDE CAMBIAR**, salvo el único deliberado que ya existe: registrar un precio de combustible actualiza el precio del servicio con `concepto = 'combustible'`.
- `precio_unitario` es `decimal(10,4)`; `subtotal`, `iva`, `total` e `importe` son `decimal(12,2)`. **Cualquier cast a float, redondeo o formateo en el camino del dinero es un defecto grave.**
- La fórmula del importe existe en **un solo lugar** en PHP. Hoy está en `FactServicio::importe()` y hay un duplicado verificado en TypeScript (`importeVistaPrevia` en `formato.ts`). **Nunca una tercera implementación.**
- Toda ruta de escritura de facturación lleva el middleware `subdep:<nombre>` de su pantalla y responde **403** a quien no lo tenga. Ocultar el botón en el frontend no protege nada.
- Toda escritura se registra en `Bitacora`, **dentro de la transacción** de la escritura (el patrón de `FactPrecioCombustible::registrar()`, no el de los controladores del 1b).
- Las operaciones que consumen o cambian estado son **atómicas**: `UPDATE ... WHERE id = ? AND <estado esperado>`, con **409** si no afectó ninguna fila.
- La serie de folio arranca en **10000**. El contador vive en `fact_configuracion` bajo la clave `prefactura_folio_siguiente` y se lee con `lockForUpdate()`. **Nunca `MAX(folio) + 1`.**
- Todo lo visible va en **español**.
- La tasa de IVA es **0.16**, uniforme, sin exenciones.
- Las cantidades de estancia **las teclea la persona**. No se derivan de las fechas.
- Una aeronave en **Guarda no paga estancia** (`FactAeronave::ESTATUS_GUARDA`).
- La suite se corre **en serie** (`php artisan test`). `--parallel` produce 22 fallos falsos ajenos en este entorno.
- El único error aceptable de `npx tsc --noEmit` es el preexistente `resources/js/actions/App/Http/Controllers/Api/WalkAroundController.ts(905,5)`.

---

## Estructura de archivos

**Crear:**

| Archivo | Responsabilidad |
|---|---|
| `app/Support/ImporteServicio.php` | La fórmula del importe, única en PHP |
| `database/migrations/..._add_concepto_to_fact_servicios_table.php` | `concepto` y `en_paquete_internacional` |
| `database/migrations/..._create_fact_prefacturas_table.php` | El encabezado |
| `database/migrations/..._create_fact_prefactura_renglones_table.php` | Los renglones |
| `app/Models/FactPrefactura.php` | Encabezado, derivación de totales, scopes |
| `app/Models/FactPrefacturaRenglon.php` | Renglón, su importe derivado |
| `app/Services/CierrePrefactura.php` | Folio con bloqueo, sello, 409 |
| `app/Services/CargosEstancia.php` | Estancia desde las tarifas y paquete internacional |
| `app/Http/Controllers/Api/Facturacion/PrefacturaController.php` | Lista, alta, edición, cierre |
| `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php` | Alta y baja de renglones, recálculos |
| `app/Http/Requests/Facturacion/StorePrefacturaRequest.php` | Validación del encabezado |
| `app/Http/Requests/Facturacion/UpdatePrefacturaRequest.php` | Hereda del Store |
| `app/Http/Requests/Facturacion/StoreRenglonRequest.php` | Validación del renglón |
| `app/Console/Commands/CompararPrefacturas.php` | Verificación de solo lectura |
| `resources/js/pages/Facturacion/Prefacturas.tsx` | La lista |
| `resources/js/pages/Facturacion/EditorPrefactura.tsx` | El editor |
| `resources/js/pages/Facturacion/components/ModalRenglon.tsx` | Alta de un renglón |
| `resources/js/pages/Facturacion/components/useSugerenciaOperacion.ts` | La sugerencia desde `operaciones_diarias` |

**Modificar:** `app/Models/FactServicio.php` (delega la fórmula, constantes de concepto), `app/Models/FactPrecioCombustible.php` (busca por `concepto`), `app/Http/Requests/Facturacion/StoreServicioRequest.php` (se retira la guarda del nombre), `app/Services/ImportadorMatriculas.php` (asigna `concepto`), `app/Models/Bitacora.php` (constante nueva), `database/seeders/FacturacionSubdepartamentosSeeder.php`, `routes/api.php`, `routes/web.php`, `resources/js/components/navigation.ts`, `resources/js/stores/apiFacturacionCatalogos.ts`.

**Borrar:** `tests/Feature/Facturacion/NombreServicioCombustibleTest.php` (sus 16 pruebas existen para sostener el acoplamiento por nombre, que desaparece en la Task 2).

---

## Task 1: La fórmula del importe, en un solo lugar

**Files:**
- Create: `app/Support/ImporteServicio.php`
- Modify: `app/Models/FactServicio.php`
- Test: `tests/Unit/ImporteServicioTest.php`

**Interfaces:**
- Produces: `ImporteServicio::calcular(float $precio, int $cantidad, float $margen, ?string $ajuste): string` — devuelve el importe a dos decimales como string. Y las constantes `ImporteServicio::AJUSTE_NINGUNO`, `AJUSTE_MAS_5`, `AJUSTE_SIN_IVA`, `AJUSTE_COMISION_131`.
- Consumes: nada.

**Por qué va primero:** todo lo demás calcula dinero con esto. La fórmula ya existe en `FactServicio::importe()` y tiene un gemelo verificado en TypeScript; extraerla es lo que evita una tercera copia cuando el renglón la necesite.

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Unit/ImporteServicioTest.php

use App\Models\FactServicio;
use App\Support\ImporteServicio;

/*
 * La fórmula no cambia. Estos son los mismos números que `FactServicio::importe()`
 * ya producía y que `importeVistaPrevia` reproduce en TypeScript.
 */
test('sin ajuste ni margen el importe es precio por cantidad', function () {
    expect(ImporteServicio::calcular(1000.0, 1, 0.0, ImporteServicio::AJUSTE_NINGUNO))->toBe('1000.00')
        ->and(ImporteServicio::calcular(1000.0, 3, 0.0, ImporteServicio::AJUSTE_NINGUNO))->toBe('3000.00');
});

test('el margen se aplica como porcentaje sobre el precio ajustado', function () {
    expect(ImporteServicio::calcular(1000.0, 1, 50.0, ImporteServicio::AJUSTE_NINGUNO))->toBe('1500.00');
});

test('cada ajuste da su numero', function (string $ajuste, string $esperado) {
    expect(ImporteServicio::calcular(1000.0, 1, 0.0, $ajuste))->toBe($esperado);
})->with([
    'ninguno' => [ImporteServicio::AJUSTE_NINGUNO, '1000.00'],
    'mas 5 por ciento' => [ImporteServicio::AJUSTE_MAS_5, '1050.00'],
    'sin IVA' => [ImporteServicio::AJUSTE_SIN_IVA, '862.07'],
    'comision 131' => [ImporteServicio::AJUSTE_COMISION_131, '877.86'],
]);

test('null se trata como ninguno', function () {
    expect(ImporteServicio::calcular(1000.0, 1, 0.0, null))->toBe('1000.00');
});

test('un ajuste desconocido lanza en lugar de cobrar de mas o de menos', function () {
    ImporteServicio::calcular(1000.0, 1, 0.0, 'mas10');
})->throws(UnexpectedValueException::class);

test('la cadena vacia tambien lanza: no es ninguno', function () {
    ImporteServicio::calcular(1000.0, 1, 0.0, '');
})->throws(UnexpectedValueException::class);

/*
 * La prueba que importa de verdad: `FactServicio::importe()` sigue dando
 * exactamente lo que daba antes de la extracción. Si delega mal, esto cae.
 */
test('FactServicio::importe delega y no cambia ningun numero', function () {
    $servicio = new FactServicio([
        'nombre' => 'Comisariato',
        'margen' => 50,
        'ajuste_precio' => FactServicio::AJUSTE_COMISION_131,
    ]);

    expect($servicio->importe(1150.0, 1))->toBe(ImporteServicio::calcular(1150.0, 1, 50.0, ImporteServicio::AJUSTE_COMISION_131))
        ->and($servicio->importe(1150.0, 1))->toBe('1725.00');
});

test('el precio cero es valido y da importe cero', function () {
    expect(ImporteServicio::calcular(0.0, 5, 50.0, ImporteServicio::AJUSTE_NINGUNO))->toBe('0.00');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Unit/ImporteServicioTest.php`
Expected: FAIL — `Class "App\Support\ImporteServicio" not found`.

- [ ] **Step 3: Create the single implementation**

```php
<?php

namespace App\Support;

use UnexpectedValueException;

/**
 * La fórmula del importe de un servicio, en un solo lugar.
 *
 * Existe porque tres cosas la necesitan: el catálogo (`FactServicio::importe()`),
 * el renglón de una prefactura —que usa sus propios valores congelados y no los
 * del catálogo— y la pantalla, que la reproduce en TypeScript
 * (`importeVistaPrevia` en `resources/js/pages/Facturacion/components/formato.ts`).
 * Esa copia de TypeScript es una vista previa y su autoridad es este archivo.
 *
 * La fórmula es la del sistema viejo (`Prefectura/altaserv.php`), reproducida
 * literalmente, incluido el orden y el redondeo final a dos decimales.
 */
final class ImporteServicio
{
    public const AJUSTE_NINGUNO = 'ninguno';

    public const AJUSTE_MAS_5 = 'mas_5';

    public const AJUSTE_SIN_IVA = 'sin_iva';

    public const AJUSTE_COMISION_131 = 'comision_131';

    public static function calcular(float $precio, int $cantidad, float $margen, ?string $ajuste): string
    {
        $ajustado = self::aplicarAjuste($precio, $ajuste);
        $conMargen = $ajustado + ($ajustado * $margen / 100);

        return number_format($conMargen * $cantidad, 2, '.', '');
    }

    /**
     * `match` estricto a propósito: con `switch`, un `case null` aceptaría
     * también la cadena vacía por comparación laxa, y un ajuste que no se
     * reconoce tiene que lanzar en lugar de cobrar de más o de menos.
     */
    private static function aplicarAjuste(float $precio, ?string $ajuste): float
    {
        return match ($ajuste) {
            null, self::AJUSTE_NINGUNO => $precio,
            self::AJUSTE_MAS_5 => $precio * 1.05,
            self::AJUSTE_SIN_IVA => $precio / 1.16,
            self::AJUSTE_COMISION_131 => self::comision131($precio),
            default => throw new UnexpectedValueException("ajuste_precio desconocido: '{$ajuste}'"),
        };
    }

    /**
     * Escrita igual que el original, no en su forma reducida (× 1.15): el
     * sistema viejo calcula así y reescribirla invita a que alguien "la
     * simplifique" y cambie el último centavo.
     */
    private static function comision131(float $precio): float
    {
        $precio1 = $precio / 1.31;

        return $precio1 * .15 + $precio1;
    }
}
```

- [ ] **Step 4: Make `FactServicio` delegate**

En `app/Models/FactServicio.php`: las cuatro constantes `AJUSTE_*` pasan a apuntar a las de `ImporteServicio`, para que nada de lo que ya las usa se rompa, y `importe()` delega. Borrar los métodos privados `aplicarAjuste()` y `comision131()` del modelo.

```php
use App\Support\ImporteServicio;

    public const AJUSTE_NINGUNO = ImporteServicio::AJUSTE_NINGUNO;

    public const AJUSTE_MAS_5 = ImporteServicio::AJUSTE_MAS_5;

    public const AJUSTE_SIN_IVA = ImporteServicio::AJUSTE_SIN_IVA;

    public const AJUSTE_COMISION_131 = ImporteServicio::AJUSTE_COMISION_131;

    /** El importe de `$cantidad` unidades a `$precio`, con el margen y el ajuste de este servicio. */
    public function importe(float $precio, int $cantidad): string
    {
        return ImporteServicio::calcular($precio, $cantidad, (float) $this->margen, $this->ajuste_precio);
    }
```

- [ ] **Step 5: Run the tests**

Run: `php artisan test tests/Unit/ImporteServicioTest.php tests/Feature/Facturacion/ServicioTest.php`
Expected: PASS. Las pruebas de `ServicioTest.php` que ya existían para `importe()` deben seguir pasando **sin cambiarles una línea**: son la prueba de que la extracción no movió ningún número.

- [ ] **Step 6: Verify the TypeScript twin still agrees, over a sweep**

La especificación singulariza esta comprobación y es la única que cubre la
tercera implementación: `importeVistaPrevia` en
`resources/js/pages/Facturacion/components/formato.ts`. Las pruebas de PHP no la
pueden alcanzar, así que se comprueba una vez aquí y se deja constancia.

Transpila el helper y compáralo contra el PHP sobre un barrido. En el directorio
temporal de la sesión, **no en el repositorio**:

```bash
npx esbuild resources/js/pages/Facturacion/components/formato.ts --format=cjs --outfile="$TMP/formato.cjs"
```

Genera los casos y compara: el producto de precios `[0, 0.0001, 100.20, 1000,
1150, 2105.8601, 19250, 999999.9999]`, cantidades `[1, 2, 3, 7]`, márgenes
`[0, 15, 50, 999.99]` y los cuatro ajustes — 512 combinaciones. Para cada una,
`ImporteServicio::calcular()` en PHP contra `importeVistaPrevia(precio, margen,
ajuste, cantidad)` en node, comparando el PHP como string contra el número de
TypeScript formateado a dos decimales.

**Qué hacer con el resultado:**
- Si coinciden las 512, dilo en el reporte con el número. Es la constancia de que
  las tres implementaciones están de acuerdo hoy.
- Si alguna difiere, **no toques el TypeScript para que cuadre**: es un hallazgo y
  hay que reportarlo con el caso exacto. El PHP es la autoridad, pero una
  divergencia significa que la pantalla le está mostrando al usuario un número
  distinto del que se va a cobrar, y eso se decide, no se parcha.

**Y pin los números en una prueba permanente.** Agrega a
`tests/Unit/ImporteServicioTest.php` una prueba por dataset con **al menos ocho
casos del barrido escritos como literales** —los valores que el barrido confirmó
que las dos implementaciones producen—, de modo que el lado de PHP quede clavado
a esos números aunque nadie vuelva a correr el barrido:

```php
test('los importes clavados por el barrido contra TypeScript no cambian', function (float $precio, int $cantidad, float $margen, string $ajuste, string $esperado) {
    expect(ImporteServicio::calcular($precio, $cantidad, $margen, $ajuste))->toBe($esperado);
})->with([
    // Rellena estos con los valores que el barrido confirmó. Son los que
    // TypeScript también produce, así que si PHP se mueve, se rompe el acuerdo.
    [1000.0, 1, 0.0, 'ninguno', '1000.00'],
    [1000.0, 1, 50.0, 'ninguno', '1500.00'],
    [1150.0, 1, 50.0, 'comision_131', '1725.00'],
    [2105.8601, 1, 0.0, 'ninguno', '2105.86'],
    [100.20, 1, 0.0, 'mas_5', '105.21'],
    [1000.0, 3, 15.0, 'sin_iva', '2974.14'],
    [19250.0, 1, 50.0, 'ninguno', '28875.00'],
    [0.0, 7, 999.99, 'comision_131', '0.00'],
]);
```

**LIMITACIÓN, que va escrita en un comentario sobre esa prueba:** clava el lado de
PHP, no la equivalencia. Si alguien cambia el TypeScript, esta prueba sigue verde.
La equivalencia solo la demuestra volver a correr el barrido, y por eso el paso
queda documentado en la guía de despliegue de la Task 9.

- [ ] **Step 7: Run the full suite**

Run: `php artisan test`
Expected: PASS. El total es el de la rama más las pruebas nuevas de este archivo.

- [ ] **Step 8: Commit**

```bash
git add app/Support/ImporteServicio.php app/Models/FactServicio.php tests/Unit/ImporteServicioTest.php
git commit -m "La formula del importe vive en un solo lugar"
```

---

## Task 2: `concepto` en los servicios, y el importador lo asigna

> **La fecha de las migraciones de este plan es `2026_09_29_0920xx` a propósito, y
> no la de hoy.** `tests/Feature/Facturacion/MatriculaUnicaTest.php:149` tiene una
> prueba que exige que `2026_09_29_099000_add_unique_matricula_to_aeronaves.php` sea
> **la última** migración por orden de nombre: su índice único lleva guardia y debe
> correr después de todo lo que pueda crear matrículas. Una migración fechada hoy
> ordenaría después y rompería esa prueba. `0920xx` está libre y ordena entre las del
> bloque 1b (`091400`) y el índice único. **No las renombres a la fecha de hoy.**

**Files:**
- Create: `database/migrations/2026_09_29_092000_add_concepto_to_fact_servicios_table.php`
- Modify: `app/Models/FactServicio.php`, `app/Services/ImportadorMatriculas.php`, `app/Models/FactPrecioCombustible.php`, `app/Http/Requests/Facturacion/StoreServicioRequest.php`
- Delete: `tests/Feature/Facturacion/NombreServicioCombustibleTest.php`
- Test: `tests/Feature/Facturacion/ConceptoServicioTest.php`

**Interfaces:**
- Produces: `FactServicio::CONCEPTO_COMBUSTIBLE = 'combustible'`, `CONCEPTO_ESTANCIA_PERNOCTA = 'estancia_pernocta'`, `CONCEPTO_ESTANCIA_TRANSITO_2H = 'estancia_transito_2h'`, `CONCEPTO_ESTANCIA_TRANSITO_12H = 'estancia_transito_12h'`; el scope `FactServicio::porConcepto(string $concepto)`; y la columna `en_paquete_internacional`.
- Consumes: nada de las tasks anteriores.

**Por qué:** las Tasks 4 y 5 necesitan identificar siete filas del catálogo. Hoy el combustible se identifica **por su nombre**, sostenido por una guarda en `UpdateServicioRequest`. Siete acoplamientos por nombre con siete guardas no es sostenible, y seguiría dependiendo de que nadie escriba un acento distinto (`utf8mb4_unicode_ci` los pliega).

**Ids del sistema viejo, verificados contra `fact-fbo-prod`** — son la llave de asignación porque son estables:

| `concepto` | id viejo | nombre en el catálogo |
|---|---|---|
| `combustible` | 7 | Combustible JET A-1 |
| `estancia_transito_2h` | 2 | Tránsito 02 hrs |
| `estancia_transito_12h` | 3 | Tránsito 12 hrs |
| `estancia_pernocta` | 4 | Tránsito 24 hrs - pernocta |
| `en_paquete_internacional` | 9, 10, 14, 93 | DSMES / DSM / Mex-eAPI / Servicios Internacionales, todos "- salida" |

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Facturacion/ConceptoServicioTest.php

use App\Models\FactPrecioCombustible;
use App\Models\FactServicio;
use App\Models\User;

test('el concepto es unico: dos servicios no pueden ser el combustible', function () {
    FactServicio::create(['nombre' => 'Combustible JET A-1', 'precio_unitario' => 26.064, 'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE]);

    FactServicio::create(['nombre' => 'Otro combustible', 'precio_unitario' => 1, 'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE]);
})->throws(Illuminate\Database\UniqueConstraintViolationException::class);

test('varios servicios pueden no tener concepto', function () {
    FactServicio::create(['nombre' => 'Comisariato', 'precio_unitario' => 100]);
    FactServicio::create(['nombre' => 'Transportacion', 'precio_unitario' => 200]);

    expect(FactServicio::whereNull('concepto')->count())->toBe(2);
});

test('el scope porConcepto encuentra el servicio', function () {
    $combustible = FactServicio::create(['nombre' => 'Combustible JET A-1', 'precio_unitario' => 26.064, 'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE]);
    FactServicio::create(['nombre' => 'Comisariato', 'precio_unitario' => 100]);

    expect(FactServicio::porConcepto(FactServicio::CONCEPTO_COMBUSTIBLE)->sole()->id)->toBe($combustible->id);
});

/*
 * El vinculo del precio de combustible deja de ser el nombre. Esta prueba es la
 * que sustituye a las 16 de NombreServicioCombustibleTest.php: el servicio se
 * puede renombrar libremente y la sincronia lo sigue encontrando.
 */
test('renombrar el servicio de combustible ya no rompe la sincronia', function () {
    $usuario = User::factory()->create();
    $servicio = FactServicio::create([
        'nombre' => 'Combustible JET A-1',
        'precio_unitario' => 21.6122,
        'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE,
    ]);

    $servicio->update(['nombre' => 'Turbosina JET A-1']);

    FactPrecioCombustible::registrar(22.1643, null, $usuario->id);

    expect((float) $servicio->fresh()->precio_unitario)->toBe(26.0639);
});

test('un servicio sin el concepto no lo toca la sincronia aunque se llame igual', function () {
    $usuario = User::factory()->create();
    $impostor = FactServicio::create(['nombre' => 'Combustible JET A-1', 'precio_unitario' => 19250.0]);

    FactPrecioCombustible::registrar(22.1643, null, $usuario->id);

    expect((float) $impostor->fresh()->precio_unitario)->toBe(19250.0);
});

test('el paquete internacional son las cuatro marcadas', function () {
    FactServicio::create(['nombre' => 'DSMES - salida', 'precio_unitario' => 4060.5, 'en_paquete_internacional' => true]);
    FactServicio::create(['nombre' => 'Comisariato', 'precio_unitario' => 100]);

    expect(FactServicio::where('en_paquete_internacional', true)->count())->toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Facturacion/ConceptoServicioTest.php`
Expected: FAIL — la columna `concepto` no existe.

- [ ] **Step 3: Write the migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Identifica por una columna propia los servicios que el código tiene que
 * reconocer, en lugar de por su nombre.
 *
 * El bloque 1b sostenía el vínculo del combustible con una guarda que impedía
 * renombrarlo. El bloque 2 necesita reconocer siete filas más —tres de estancia,
 * cuatro del paquete internacional— y siete guardas por nombre no es sostenible:
 * `utf8mb4_unicode_ci` pliega acentos, así que la comparación por nombre siempre
 * va a tener bordes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fact_servicios', function (Blueprint $table) {
            $table->string('concepto', 32)->nullable()->unique()->after('nombre');
            $table->boolean('en_paquete_internacional')->default(false)->after('concepto');
        });
    }

    public function down(): void
    {
        Schema::table('fact_servicios', function (Blueprint $table) {
            $table->dropUnique(['concepto']);
            $table->dropColumn(['concepto', 'en_paquete_internacional']);
        });
    }
};
```

- [ ] **Step 4: Add the constants, the cast, the fillable and the scope**

En `app/Models/FactServicio.php`:

```php
    /** El servicio cuyo precio sigue al precio Eolo del combustible. */
    public const CONCEPTO_COMBUSTIBLE = 'combustible';

    /** Los tres de estancia: su precio NO sale del catálogo, sale de la tarifa de la matrícula. */
    public const CONCEPTO_ESTANCIA_PERNOCTA = 'estancia_pernocta';

    public const CONCEPTO_ESTANCIA_TRANSITO_2H = 'estancia_transito_2h';

    public const CONCEPTO_ESTANCIA_TRANSITO_12H = 'estancia_transito_12h';

    /** @var list<string> */
    public const CONCEPTOS_ESTANCIA = [
        self::CONCEPTO_ESTANCIA_PERNOCTA,
        self::CONCEPTO_ESTANCIA_TRANSITO_2H,
        self::CONCEPTO_ESTANCIA_TRANSITO_12H,
    ];

    public function scopePorConcepto($query, string $concepto)
    {
        return $query->where('concepto', $concepto);
    }
```

Agregar `'concepto'` y `'en_paquete_internacional'` a `$fillable`, y `'en_paquete_internacional' => 'boolean'` a `$casts`.

- [ ] **Step 5: Point the fuel sync at the concepto**

En `app/Models/FactPrecioCombustible.php`, `sincronizarServicio()` cambia su `where`:

```php
        $servicios = FactServicio::query()
            ->porConcepto(FactServicio::CONCEPTO_COMBUSTIBLE)
            ->where('status', FactServicio::STATUS_ACTIVO)
            ->get();
```

Borrar la constante `SERVICIO_COMBUSTIBLE` y su docblock, que describían el acoplamiento por nombre.

- [ ] **Step 6: Retire the name guard**

En `app/Http/Requests/Facturacion/StoreServicioRequest.php`, borrar `reglaDelNombreReservado()`, `esNombreDeCombustible()`, `llaveComparable()` y su referencia en `after()`. En `UpdateServicioRequest.php`, borrar su `after()` completo, de modo que vuelva a heredar el del Store.

Borrar `tests/Feature/Facturacion/NombreServicioCombustibleTest.php`: sus 16 pruebas existen para sostener un acoplamiento que ya no existe.

- [ ] **Step 7: Make the importer assign them**

En `app/Services/ImportadorMatriculas.php`, junto a las constantes `SERVICIO_MAS_5` / `SERVICIO_SIN_IVA` / `SERVICIO_COMISION_131` que ya están ahí:

```php
    /**
     * Ids del origen que llevan concepto. Son estables: el sistema viejo los usa
     * hardcodeados (`$id_servicio=7`, `$Permocta=4`, `$trans2h=2`, `$trans12h=3`).
     *
     * @var array<int,string>
     */
    private const CONCEPTOS_POR_ID_VIEJO = [
        7 => FactServicio::CONCEPTO_COMBUSTIBLE,
        2 => FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H,
        3 => FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H,
        4 => FactServicio::CONCEPTO_ESTANCIA_PERNOCTA,
    ];

    /** Los cuatro que `insert22.php` agrega juntos cuando el destino es internacional. */
    private const SERVICIOS_PAQUETE_INTERNACIONAL = [9, 10, 14, 93];
```

Y en el `updateOrCreate` de `importarServicios()`, agregar al arreglo de valores:

```php
                    'concepto' => self::CONCEPTOS_POR_ID_VIEJO[$idViejo] ?? null,
                    'en_paquete_internacional' => in_array($idViejo, self::SERVICIOS_PAQUETE_INTERNACIONAL, true),
```

- [ ] **Step 8: Add the importer test**

En `tests/Feature/Facturacion/ImportadorCatalogosTest.php`, agregar al final:

```php
test('el importador asigna el concepto por el id viejo', function () {
    prepararBaseLegacy();
    legacy('tb_servicio')->insert([
        ['id_servicio' => 2, 'servicio' => 'Transito 02 hrs', 'precio_u' => '99.0000', 'id_categorias' => 1],
        ['id_servicio' => 7, 'servicio' => 'Combustible JET A-1', 'precio_u' => '26.0640', 'id_categorias' => 1],
        ['id_servicio' => 9, 'servicio' => 'DSMES - salida', 'precio_u' => '4060.5000', 'id_categorias' => 1],
        ['id_servicio' => 50, 'servicio' => 'Comisariato', 'precio_u' => '100.0000', 'id_categorias' => 1],
    ]);

    app(App\Services\ImportadorMatriculas::class)->ejecutar(true);

    expect(FactServicio::porConcepto(FactServicio::CONCEPTO_COMBUSTIBLE)->sole()->nombre)->toBe('Combustible JET A-1')
        ->and(FactServicio::porConcepto(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H)->sole()->nombre)->toBe('Transito 02 hrs')
        ->and(FactServicio::where('nombre', 'DSMES - salida')->sole()->en_paquete_internacional)->toBeTrue()
        ->and(FactServicio::where('nombre', 'Comisariato')->sole()->concepto)->toBeNull()
        ->and(FactServicio::where('nombre', 'Comisariato')->sole()->en_paquete_internacional)->toBeFalse();
});
```

- [ ] **Step 9: Run the tests**

Run: `php artisan test --filter="Concepto|ImportadorCatalogos|Combustible"`
Expected: PASS.

- [ ] **Step 10: Run the full suite**

Run: `php artisan test`
Expected: PASS. El total **baja en 16** respecto a la Task 1, porque se borró `NombreServicioCombustibleTest.php`, y sube por las nuevas. Es la única task del plan donde el total puede bajar: dilo en el reporte para que nadie lo lea como una regresión.

- [ ] **Step 11: Commit**

```bash
git add database/migrations app/Models/FactServicio.php app/Models/FactPrecioCombustible.php app/Services/ImportadorMatriculas.php app/Http/Requests/Facturacion tests/Feature/Facturacion
git commit -m "Los servicios especiales se identifican por concepto, no por su nombre"
```

---

## Task 3: Las dos tablas y la derivación de totales

**Files:**
- Create: `database/migrations/2026_09_29_092100_create_fact_prefacturas_table.php`, `database/migrations/2026_09_29_092200_create_fact_prefactura_renglones_table.php`, `app/Models/FactPrefactura.php`, `app/Models/FactPrefacturaRenglon.php`
- Modify: `tests/Pest.php` (los cuatro ayudantes que comparten las Tasks 3 a 6)
- Test: `tests/Feature/Facturacion/PrefacturaTotalesTest.php`

**IMPORTANTE — los ayudantes van en `tests/Pest.php`, no en el archivo de prueba.**
En Pest una función declarada dentro de un archivo de prueba es global al cargarse,
así que dos archivos que declaren la misma revientan con un error fatal de
redeclaración, y depender del orden de carga es frágil. Las Tasks 4, 5 y 6
necesitan estos mismos ayudantes, así que los cuatro van en `tests/Pest.php`,
junto a `usuarioConSubdepartamento`, que ya está ahí por la misma razón.

**Interfaces:**
- Consumes: `ImporteServicio::calcular()` de la Task 1.
- Produces: `FactPrefactura` con `ESTADO_BORRADOR = 'borrador'`, `ESTADO_CERRADA = 'cerrada'`, los scopes `borradores()` y `cerradas()`, y los métodos `subtotal(): string`, `iva(): string`, `total(): string`, `ivaTasa(): string`. `FactPrefacturaRenglon` con `importe(): string`.

- [ ] **Step 1: Write the failing test**

**Los dos ayudantes de abajo NO se declaran en este archivo.** Van en
`tests/Pest.php` (Step 6), porque las Tasks 4, 5 y 6 también los usan y dos archivos
que declaren la misma función revientan por redeclaración. Aquí se muestran sus
cuerpos porque es donde se leen junto a las pruebas que los usan.

```php
<?php
// tests/Feature/Facturacion/PrefacturaTotalesTest.php
// (prefacturaBorrador y renglonDe viven en tests/Pest.php, no aquí)

use App\Models\FactConfiguracion;
use App\Models\FactPrefactura;
use App\Models\FactPrefacturaRenglon;
use App\Models\FactServicio;

function prefacturaBorrador(): FactPrefactura
{
    $aeronave = App\Models\Aeronave::create(['matricula' => 'XA-ABC']);
    App\Models\FactAeronave::create(['aeronave_id' => $aeronave->id, 'estatus' => App\Models\FactAeronave::ESTATUS_TRANSITO]);

    return FactPrefactura::create([
        'aeronave_id' => $aeronave->id,
        'estado' => FactPrefactura::ESTADO_BORRADOR,
        'tipo_destino' => FactPrefactura::DESTINO_NACIONAL,
        'user_id' => App\Models\User::factory()->create()->id,
    ]);
}

function renglonDe(FactPrefactura $p, float $precio, int $cantidad, float $margen = 0, string $ajuste = 'ninguno'): FactPrefacturaRenglon
{
    $servicio = FactServicio::create(['nombre' => 'Servicio '.uniqid(), 'precio_unitario' => $precio]);

    return $p->renglones()->create([
        'servicio_id' => $servicio->id,
        'nombre_servicio' => $servicio->nombre,
        'precio_unitario' => $precio,
        'cantidad' => $cantidad,
        'es_de_tercero' => $margen > 0,
        'margen' => $margen,
        'ajuste_precio' => $ajuste,
        'orden' => 1,
    ]);
}

test('el importe de un renglon sale de sus propios valores congelados', function () {
    $p = prefacturaBorrador();
    $r = renglonDe($p, 1000.0, 3, 50.0);

    expect($r->importe())->toBe('4500.00');
});

test('el renglon no se mueve si el catalogo cambia', function () {
    $p = prefacturaBorrador();
    $r = renglonDe($p, 1000.0, 1);

    $r->servicio->update(['precio_unitario' => 9999.0, 'margen' => 80, 'es_de_tercero' => true]);

    expect($r->fresh()->importe())->toBe('1000.00');
});

test('el subtotal es la suma de los importes derivados', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 1000.0, 2);
    renglonDe($p, 26.0640, 1);

    expect($p->fresh()->subtotal())->toBe('2026.06');
});

test('el IVA es la tasa vigente sobre el subtotal y el total es la suma', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 1000.0, 1);

    $p = $p->fresh();

    expect($p->ivaTasa())->toBe('0.1600')
        ->and($p->iva())->toBe('160.00')
        ->and($p->total())->toBe('1160.00');
});

test('una tasa distinta en configuracion cambia el IVA de un borrador', function () {
    FactConfiguracion::create(['clave' => 'iva_tasa', 'valor' => '0.08']);
    $p = prefacturaBorrador();
    renglonDe($p, 1000.0, 1);

    expect($p->fresh()->iva())->toBe('80.00');
});

test('una prefactura sin renglones tiene totales en cero, no null', function () {
    $p = prefacturaBorrador();

    expect($p->subtotal())->toBe('0.00')
        ->and($p->iva())->toBe('0.00')
        ->and($p->total())->toBe('0.00');
});

test('los scopes separan borradores de cerradas', function () {
    $p = prefacturaBorrador();
    $p->update(['estado' => FactPrefactura::ESTADO_CERRADA, 'folio' => 10000]);
    prefacturaBorrador();

    expect(FactPrefactura::cerradas()->count())->toBe(1)
        ->and(FactPrefactura::borradores()->count())->toBe(1);
});

test('el folio es unico pero muchos borradores pueden no tenerlo', function () {
    prefacturaBorrador();
    prefacturaBorrador();

    expect(FactPrefactura::whereNull('folio')->count())->toBe(2);
});

test('dos prefacturas no pueden compartir folio', function () {
    prefacturaBorrador()->update(['folio' => 10000]);
    prefacturaBorrador()->update(['folio' => 10000]);
})->throws(Illuminate\Database\UniqueConstraintViolationException::class);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Facturacion/PrefacturaTotalesTest.php`
Expected: FAIL — las tablas no existen.

- [ ] **Step 3: Write the header migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * El encabezado de una prefactura.
 *
 * `folio` es nulo mientras es borrador y único cuando no lo es: en MySQL y en
 * sqlite un índice único admite varios NULL, así que esto permite muchos
 * borradores sin folio y a la vez impide dos folios iguales, sin índice filtrado.
 *
 * Los totales se derivan de los renglones mientras es borrador. Las columnas
 * `*_sellado` se llenan al cerrar y son lo único redundante del modelo, a
 * propósito: una prefactura cerrada es un documento que ya salió al cliente y no
 * debe moverse si mañana alguien corrige un catálogo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_prefacturas', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('folio')->nullable()->unique();
            $table->string('estado', 10)->default('borrador')->index();
            $table->foreignId('aeronave_id')->constrained('aeronaves');
            $table->foreignId('cliente_id')->nullable()->constrained('fact_clientes')->nullOnDelete();
            $table->dateTime('llegada_at')->nullable();
            $table->dateTime('salida_at')->nullable();
            $table->string('origen', 120)->nullable();
            $table->string('destino', 120)->nullable();
            $table->foreignId('operacion_llegada_id')->nullable()->constrained('operaciones_diarias')->nullOnDelete();
            $table->foreignId('operacion_salida_id')->nullable()->constrained('operaciones_diarias')->nullOnDelete();
            $table->string('tipo_destino', 15)->default('nacional');
            $table->decimal('subtotal_sellado', 12, 2)->nullable();
            $table->decimal('iva_sellado', 12, 2)->nullable();
            $table->decimal('total_sellado', 12, 2)->nullable();
            $table->decimal('iva_tasa_sellada', 5, 4)->nullable();
            $table->dateTime('cerrada_at')->nullable();
            $table->foreignId('cerrada_por')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('user_id')->constrained('users');
            $table->char('status', 1)->default('A')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_prefacturas');
    }
};
```

- [ ] **Step 4: Write the line-items migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Los renglones de una prefactura.
 *
 * El renglón CONGELA todo lo que determina su importe: nombre, precio, margen y
 * ajuste tal como estaban al capturarlo. Si mañana alguien edita el catálogo,
 * ningún documento se mueve. El sistema viejo ya lo hace con `precio_u`.
 *
 * `importe` NO se guarda: se deriva. Guardarlo es exactamente la redundancia que
 * produjo los 37 encabezados del sistema viejo cuyo total no corresponde a sus
 * renglones, el peor por 29,000 pesos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_prefactura_renglones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('prefactura_id')->constrained('fact_prefacturas')->cascadeOnDelete();
            $table->foreignId('servicio_id')->constrained('fact_servicios');
            $table->string('nombre_servicio', 120);
            $table->decimal('precio_unitario', 10, 4);
            $table->unsignedInteger('cantidad');
            $table->boolean('es_de_tercero')->default(false);
            $table->decimal('margen', 5, 2)->default(0);
            $table->string('ajuste_precio', 16)->default('ninguno');
            $table->string('concepto', 32)->nullable()->index();
            $table->foreignId('proveedor_id')->nullable()->constrained('fact_proveedores')->nullOnDelete();
            $table->string('remision', 255)->nullable();
            $table->unsignedSmallInteger('orden')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_prefactura_renglones');
    }
};
```

- [ ] **Step 5: Write the models**

`app/Models/FactPrefacturaRenglon.php`:

```php
<?php

namespace App\Models;

use App\Support\ImporteServicio;
use Illuminate\Database\Eloquent\Model;

class FactPrefacturaRenglon extends Model
{
    protected $table = 'fact_prefactura_renglones';

    protected $fillable = [
        'prefactura_id', 'servicio_id', 'nombre_servicio', 'precio_unitario', 'cantidad',
        'es_de_tercero', 'margen', 'ajuste_precio', 'concepto', 'proveedor_id', 'remision', 'orden',
    ];

    protected $casts = [
        'precio_unitario' => 'decimal:4',
        'margen' => 'decimal:2',
        'es_de_tercero' => 'boolean',
        'cantidad' => 'integer',
    ];

    protected $appends = ['importe'];

    public function prefactura()
    {
        return $this->belongsTo(FactPrefactura::class, 'prefactura_id');
    }

    public function servicio()
    {
        return $this->belongsTo(FactServicio::class, 'servicio_id');
    }

    /**
     * El importe se deriva de los valores CONGELADOS del renglón, nunca de los
     * del catálogo: el servicio pudo cambiar de precio después.
     */
    public function importe(): string
    {
        return ImporteServicio::calcular(
            (float) $this->precio_unitario,
            (int) $this->cantidad,
            (float) $this->margen,
            $this->ajuste_precio,
        );
    }

    public function getImporteAttribute(): string
    {
        return $this->importe();
    }
}
```

`app/Models/FactPrefactura.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FactPrefactura extends Model
{
    public const ESTADO_BORRADOR = 'borrador';

    public const ESTADO_CERRADA = 'cerrada';

    public const DESTINO_NACIONAL = 'nacional';

    public const DESTINO_INTERNACIONAL = 'internacional';

    public const STATUS_ACTIVO = 'A';

    public const STATUS_INACTIVO = 'N';

    /** Tasa por omisión si `fact_configuracion` no trae `iva_tasa`. */
    public const IVA_TASA_POR_OMISION = '0.16';

    protected $table = 'fact_prefacturas';

    protected $fillable = [
        'folio', 'estado', 'aeronave_id', 'cliente_id', 'llegada_at', 'salida_at',
        'origen', 'destino', 'operacion_llegada_id', 'operacion_salida_id', 'tipo_destino',
        'subtotal_sellado', 'iva_sellado', 'total_sellado', 'iva_tasa_sellada',
        'cerrada_at', 'cerrada_por', 'user_id', 'status',
    ];

    protected $casts = [
        'llegada_at' => 'datetime',
        'salida_at' => 'datetime',
        'cerrada_at' => 'datetime',
        'subtotal_sellado' => 'decimal:2',
        'iva_sellado' => 'decimal:2',
        'total_sellado' => 'decimal:2',
        'iva_tasa_sellada' => 'decimal:4',
    ];

    public function renglones()
    {
        return $this->hasMany(FactPrefacturaRenglon::class, 'prefactura_id')->orderBy('orden')->orderBy('id');
    }

    public function aeronave()
    {
        return $this->belongsTo(Aeronave::class);
    }

    public function satelite()
    {
        return $this->hasOne(FactAeronave::class, 'aeronave_id', 'aeronave_id');
    }

    public function cliente()
    {
        return $this->belongsTo(FactCliente::class, 'cliente_id');
    }

    public function scopeBorradores($query)
    {
        return $query->where('estado', self::ESTADO_BORRADOR);
    }

    public function scopeCerradas($query)
    {
        return $query->where('estado', self::ESTADO_CERRADA);
    }

    public function estaCerrada(): bool
    {
        return $this->estado === self::ESTADO_CERRADA;
    }

    /** La tasa vigente, o la sellada si la prefactura ya se cerró. */
    public function ivaTasa(): string
    {
        if ($this->iva_tasa_sellada !== null) {
            return (string) $this->iva_tasa_sellada;
        }

        return number_format((float) FactConfiguracion::valor('iva_tasa', self::IVA_TASA_POR_OMISION), 4, '.', '');
    }

    /**
     * Suma de los importes derivados. Se suma con bcadd para no pasar por float:
     * cada importe ya viene como cadena de dos decimales.
     */
    public function subtotal(): string
    {
        if ($this->subtotal_sellado !== null) {
            return (string) $this->subtotal_sellado;
        }

        $suma = '0.00';

        foreach ($this->renglones as $renglon) {
            $suma = bcadd($suma, $renglon->importe(), 2);
        }

        return $suma;
    }

    public function iva(): string
    {
        if ($this->iva_sellado !== null) {
            return (string) $this->iva_sellado;
        }

        return bcmul($this->subtotal(), $this->ivaTasa(), 2);
    }

    public function total(): string
    {
        if ($this->total_sellado !== null) {
            return (string) $this->total_sellado;
        }

        return bcadd($this->subtotal(), $this->iva(), 2);
    }
}
```

- [ ] **Step 6: Move the four shared helpers into `tests/Pest.php`**

Las Tasks 4, 5 y 6 usan estos mismos ayudantes. Van en `tests/Pest.php`, junto a
`usuarioConSubdepartamento`, **no** en los archivos de prueba: en Pest una función
declarada en un archivo de prueba es global al cargarse, así que dos archivos que
declaren la misma revientan por redeclaración.

Los cuatro, con estas firmas exactas, que las tasks siguientes citan:

- `prefacturaBorrador(): FactPrefactura` — una prefactura en borrador con su matrícula en Tránsito.
- `renglonDe(FactPrefactura $p, float $precio, int $cantidad, float $margen = 0, string $ajuste = 'ninguno'): FactPrefacturaRenglon`
- `prefacturaCompleta(float $precio = 100.0, int $cantidad = 1): array` — devuelve `[$prefactura, $usuario]`, con cliente y un renglón, lista para cerrar.
- `conEstancia(string $estatus = FactAeronave::ESTATUS_TRANSITO): FactPrefactura` — crea los tres servicios de estancia con su `concepto` y una matrícula con las tres tarifas (pernocta 4676.00, tránsito 2 h 1144.50, tránsito 12 h 2338.00).

Los cuerpos de `prefacturaBorrador` y `renglonDe` son los del Step 1 de esta task;
los de `prefacturaCompleta` y `conEstancia` están escritos en las Tasks 4 y 5
respectivamente, para que se lean junto a las pruebas que los usan. Escribe los
cuatro ahora, aunque dos de ellos todavía no tengan quien los llame: así ninguna
task posterior tiene que tocar `tests/Pest.php` y arriesgar un conflicto.

- [ ] **Step 7: Run the tests**

Run: `php artisan test tests/Feature/Facturacion/PrefacturaTotalesTest.php`
Expected: PASS, 9 pruebas.

- [ ] **Step 8: Run the full suite**

Run: `php artisan test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add database/migrations app/Models/FactPrefactura.php app/Models/FactPrefacturaRenglon.php tests/Pest.php tests/Feature/Facturacion/PrefacturaTotalesTest.php
git commit -m "Las dos tablas de prefactura y la derivacion de totales"
```

---

## Task 4: El folio con bloqueo y el cierre atómico

**Files:**
- Create: `app/Services/CierrePrefactura.php`
- Modify: `app/Models/Bitacora.php`
- Test: `tests/Feature/Facturacion/CierrePrefacturaTest.php`

**Interfaces:**
- Consumes: `FactPrefactura` de la Task 3.
- Produces: `CierrePrefactura::cerrar(FactPrefactura $prefactura, int $userId): FactPrefactura` — lanza `PrefacturaYaCerradaException` si ya estaba cerrada, y `PrefacturaIncompletaException` si falta cliente o renglones. Y `Bitacora::MODULO_FACTURACION_PREFACTURAS = 'FACTURACION_PREFACTURAS'`.

**El punto crítico de toda la task:** el folio **no** se asigna con `MAX(folio) + 1`. Eso es lo que hace el sistema viejo (`$folp = $hpref3+1`) y es lo que produjo sus 207 folios duplicados: entre leer el máximo y escribir, otra sesión lee el mismo máximo. El contador va en `fact_configuracion` y se lee con `lockForUpdate()`.

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Facturacion/CierrePrefacturaTest.php

use App\Models\Bitacora;
use App\Models\FactConfiguracion;
use App\Models\FactPrefactura;
use App\Services\CierrePrefactura;
use App\Services\PrefacturaIncompletaException;
use App\Services\PrefacturaYaCerradaException;

test('la primera prefactura cerrada se lleva el folio 10000', function () {
    [$p, $usuario] = prefacturaCompleta();

    $cerrada = app(CierrePrefactura::class)->cerrar($p, $usuario->id);

    expect($cerrada->folio)->toBe(10000)
        ->and($cerrada->estado)->toBe(FactPrefactura::ESTADO_CERRADA);
});

test('el folio avanza de uno en uno', function () {
    [$p1, $usuario] = prefacturaCompleta();
    [$p2] = prefacturaCompleta();

    expect(app(CierrePrefactura::class)->cerrar($p1, $usuario->id)->folio)->toBe(10000)
        ->and(app(CierrePrefactura::class)->cerrar($p2, $usuario->id)->folio)->toBe(10001);
});

test('el folio nuevo nunca cae en el rango del sistema viejo', function () {
    [$p, $usuario] = prefacturaCompleta();

    // El mayor folio del origen es 4121 y sus borradores llegan a 4123.
    expect(app(CierrePrefactura::class)->cerrar($p, $usuario->id)->folio)->toBeGreaterThan(4123);
});

test('al cerrar se sella el subtotal, el IVA, el total y la tasa', function () {
    [$p, $usuario] = prefacturaCompleta(precio: 1000.0, cantidad: 2);

    $cerrada = app(CierrePrefactura::class)->cerrar($p, $usuario->id);

    expect((string) $cerrada->subtotal_sellado)->toBe('2000.00')
        ->and((string) $cerrada->iva_sellado)->toBe('320.00')
        ->and((string) $cerrada->total_sellado)->toBe('2320.00')
        ->and((string) $cerrada->iva_tasa_sellada)->toBe('0.1600');
});

test('el sello no se mueve si despues cambia la tasa de IVA', function () {
    [$p, $usuario] = prefacturaCompleta(precio: 1000.0, cantidad: 1);
    $cerrada = app(CierrePrefactura::class)->cerrar($p, $usuario->id);

    FactConfiguracion::updateOrCreate(['clave' => 'iva_tasa'], ['valor' => '0.08']);

    expect($cerrada->fresh()->iva())->toBe('160.00');
});

test('cerrar dos veces la misma prefactura falla y no consume dos folios', function () {
    [$p, $usuario] = prefacturaCompleta();
    app(CierrePrefactura::class)->cerrar($p, $usuario->id);

    expect(fn () => app(CierrePrefactura::class)->cerrar($p->fresh(), $usuario->id))
        ->toThrow(PrefacturaYaCerradaException::class);

    expect(FactConfiguracion::valor('prefactura_folio_siguiente'))->toBe('10001');
});

test('no se puede cerrar sin cliente', function () {
    [$p, $usuario] = prefacturaCompleta();
    $p->update(['cliente_id' => null]);

    app(CierrePrefactura::class)->cerrar($p->fresh(), $usuario->id);
})->throws(PrefacturaIncompletaException::class);

test('no se puede cerrar sin renglones', function () {
    [$p, $usuario] = prefacturaCompleta();
    $p->renglones()->delete();

    app(CierrePrefactura::class)->cerrar($p->fresh(), $usuario->id);
})->throws(PrefacturaIncompletaException::class);

test('el cierre deja rastro en bitacora con el folio y el total', function () {
    [$p, $usuario] = prefacturaCompleta(precio: 1000.0, cantidad: 1);

    app(CierrePrefactura::class)->cerrar($p, $usuario->id);

    $entrada = Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)
        ->where('accion', Bitacora::ACCION_FINALIZAR)->sole();

    expect($entrada->descripcion)->toContain('10000')
        ->and($entrada->descripcion)->toContain('1160.00');
});

test('un cierre que falla no consume folio', function () {
    [$p, $usuario] = prefacturaCompleta();
    $p->update(['cliente_id' => null]);

    try {
        app(CierrePrefactura::class)->cerrar($p->fresh(), $usuario->id);
    } catch (PrefacturaIncompletaException) {
        // esperado
    }

    expect(FactConfiguracion::valor('prefactura_folio_siguiente', '10000'))->toBe('10000');
});
```

**El ayudante `prefacturaCompleta()` NO va en este archivo**: lo creó la Task 3 en
`tests/Pest.php`, porque las Tasks 4, 5 y 6 lo comparten y dos archivos que lo
declaren revientan por redeclaración. Es este, para que puedas comprobar que está
y con esta firma:

```php
function prefacturaCompleta(float $precio = 100.0, int $cantidad = 1): array
{
    $usuario = App\Models\User::factory()->create();
    $aeronave = App\Models\Aeronave::create(['matricula' => 'XA-'.substr(uniqid(), -4)]);
    App\Models\FactAeronave::create(['aeronave_id' => $aeronave->id, 'estatus' => App\Models\FactAeronave::ESTATUS_TRANSITO]);
    $cliente = App\Models\FactCliente::create(['nombre' => 'Cliente '.uniqid()]);
    $servicio = App\Models\FactServicio::create(['nombre' => 'Servicio '.uniqid(), 'precio_unitario' => $precio]);

    $p = FactPrefactura::create([
        'aeronave_id' => $aeronave->id,
        'cliente_id' => $cliente->id,
        'estado' => FactPrefactura::ESTADO_BORRADOR,
        'tipo_destino' => FactPrefactura::DESTINO_NACIONAL,
        'user_id' => $usuario->id,
    ]);

    $p->renglones()->create([
        'servicio_id' => $servicio->id,
        'nombre_servicio' => $servicio->nombre,
        'precio_unitario' => $precio,
        'cantidad' => $cantidad,
        'es_de_tercero' => false,
        'margen' => 0,
        'ajuste_precio' => 'ninguno',
        'orden' => 1,
    ]);

    return [$p->fresh(), $usuario];
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Facturacion/CierrePrefacturaTest.php`
Expected: FAIL — `Class "App\Services\CierrePrefactura" not found`.

- [ ] **Step 3: Add the Bitacora constant**

En `app/Models/Bitacora.php`, junto a `MODULO_FACTURACION_CATALOGOS`:

```php
    public const MODULO_FACTURACION_PREFACTURAS = 'FACTURACION_PREFACTURAS';
```

- [ ] **Step 4: Write the service**

```php
<?php

namespace App\Services;

use App\Models\Bitacora;
use App\Models\FactConfiguracion;
use App\Models\FactPrefactura;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class PrefacturaYaCerradaException extends RuntimeException {}

class PrefacturaIncompletaException extends RuntimeException {}

/**
 * Cierra una prefactura: le asigna folio, le sella los totales y lo registra.
 *
 * Todo en una transacción, y el folio sale de un contador leído con
 * `lockForUpdate()`. NO se usa `MAX(folio) + 1`: eso es lo que hace el sistema
 * viejo (`$folp = $hpref3+1` en `a_pref.php`) y es lo que produjo sus 207 folios
 * duplicados, porque entre leer el máximo y escribir otra sesión lee el mismo
 * máximo. El índice único de `folio` queda como última red, no como mecanismo.
 */
class CierrePrefactura
{
    public const CLAVE_FOLIO = 'prefactura_folio_siguiente';

    /** La serie propia arranca aquí: el mayor folio del sistema viejo es 4121. */
    public const FOLIO_INICIAL = 10000;

    public function cerrar(FactPrefactura $prefactura, int $userId): FactPrefactura
    {
        if ($prefactura->estaCerrada()) {
            throw new PrefacturaYaCerradaException('Esta prefactura ya está cerrada.');
        }

        if ($prefactura->cliente_id === null) {
            throw new PrefacturaIncompletaException('Falta el cliente: sin cliente no se puede facturar.');
        }

        if ($prefactura->renglones()->count() === 0) {
            throw new PrefacturaIncompletaException('La prefactura no tiene ningún renglón.');
        }

        return DB::transaction(function () use ($prefactura, $userId) {
            $folio = $this->siguienteFolio();

            $subtotal = $prefactura->subtotal();
            $tasa = $prefactura->ivaTasa();
            $iva = bcmul($subtotal, $tasa, 2);
            $total = bcadd($subtotal, $iva, 2);

            // Atómico: si otra sesión la cerró entre la comprobación y aquí,
            // esto afecta cero filas y nadie consume un folio de más.
            $filas = FactPrefactura::query()
                ->where('id', $prefactura->id)
                ->where('estado', FactPrefactura::ESTADO_BORRADOR)
                ->update([
                    'folio' => $folio,
                    'estado' => FactPrefactura::ESTADO_CERRADA,
                    'subtotal_sellado' => $subtotal,
                    'iva_sellado' => $iva,
                    'total_sellado' => $total,
                    'iva_tasa_sellada' => $tasa,
                    'cerrada_at' => now(),
                    'cerrada_por' => $userId,
                    'updated_at' => now(),
                ]);

            if ($filas === 0) {
                throw new PrefacturaYaCerradaException('Esta prefactura ya está cerrada.');
            }

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_FINALIZAR,
                descripcion: "Se cerró la prefactura con folio {$folio} por un total de {$total}.",
                usuarioId: $userId,
                registroId: $prefactura->id,
                datosNuevos: ['folio' => $folio, 'subtotal' => $subtotal, 'iva' => $iva, 'total' => $total],
            );

            return $prefactura->fresh();
        });
    }

    /**
     * El contador, con bloqueo de fila. La fila se crea en el primer cierre.
     */
    private function siguienteFolio(): int
    {
        $fila = FactConfiguracion::query()
            ->where('clave', self::CLAVE_FOLIO)
            ->lockForUpdate()
            ->first();

        if ($fila === null) {
            $fila = FactConfiguracion::create([
                'clave' => self::CLAVE_FOLIO,
                'valor' => (string) self::FOLIO_INICIAL,
            ]);
        }

        $folio = (int) $fila->valor;
        $fila->update(['valor' => (string) ($folio + 1)]);

        return $folio;
    }
}
```

- [ ] **Step 5: Run the tests**

Run: `php artisan test tests/Feature/Facturacion/CierrePrefacturaTest.php`
Expected: PASS, 10 pruebas.

- [ ] **Step 6: Run the full suite**

Run: `php artisan test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/Services/CierrePrefactura.php app/Models/Bitacora.php tests/Feature/Facturacion/CierrePrefacturaTest.php
git commit -m "El cierre de una prefactura: folio con bloqueo de fila y sello de totales"
```

---

## Task 5: Cargos de estancia y paquete internacional

**Files:**
- Create: `app/Services/CargosEstancia.php`
- Test: `tests/Feature/Facturacion/CargosEstanciaTest.php`

**Interfaces:**
- Consumes: `FactPrefactura` y `FactPrefacturaRenglon` (Task 3), las constantes `CONCEPTO_*` y `CONCEPTOS_ESTANCIA` de `FactServicio` (Task 2).
- Produces: `CargosEstancia::recalcular(FactPrefactura $p, int $pernoctas, int $transitos2h, int $transitos12h): array` — devuelve `['renglones' => int, 'motivo' => ?string]`. Y `CargosEstancia::agregarPaqueteInternacional(FactPrefactura $p): int`.

**Las dos reglas que esto hace cumplir:**
1. El precio de los tres servicios de estancia **no sale del catálogo** (ahí vale 99.00, que es relleno) sino de la tarifa de la matrícula: `FactAeronave::tarifaPernocta()`, `tarifaTransito2h()`, `tarifaTransito12h()`, que ya resuelven la herencia desde la categoría.
2. **Solo se cobran si la aeronave está en Tránsito.** Es la regla que el bloque 1a dejó deliberadamente sin aplicar, y este es su lugar.

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Facturacion/CargosEstanciaTest.php

use App\Models\Aeronave;
use App\Models\FactAeronave;
use App\Models\FactPrefactura;
use App\Models\FactServicio;
use App\Services\CargosEstancia;

/*
 * `conEstancia()` NO se declara aqui: lo creo la Task 3 en `tests/Pest.php`,
 * porque la Task 6 tambien lo usa. Es este, para que puedas comprobar su firma:
 */
function conEstancia(string $estatus = FactAeronave::ESTATUS_TRANSITO): FactPrefactura
{
    foreach ([
        FactServicio::CONCEPTO_ESTANCIA_PERNOCTA => 'Transito 24 hrs - pernocta',
        FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H => 'Transito 02 hrs',
        FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H => 'Transito 12 hrs',
    ] as $concepto => $nombre) {
        FactServicio::firstOrCreate(['nombre' => $nombre], ['precio_unitario' => 99.0, 'concepto' => $concepto]);
    }

    $aeronave = Aeronave::create(['matricula' => 'XA-'.substr(uniqid(), -4)]);
    FactAeronave::create([
        'aeronave_id' => $aeronave->id,
        'estatus' => $estatus,
        'tarifa_pernocta' => 4676.00,
        'tarifa_transito_2h' => 1144.50,
        'tarifa_transito_12h' => 2338.00,
    ]);

    return FactPrefactura::create([
        'aeronave_id' => $aeronave->id,
        'estado' => FactPrefactura::ESTADO_BORRADOR,
        'tipo_destino' => FactPrefactura::DESTINO_NACIONAL,
        'user_id' => App\Models\User::factory()->create()->id,
    ]);
}

test('la estancia usa la tarifa de la matricula, no el precio del catalogo', function () {
    $p = conEstancia();

    app(CargosEstancia::class)->recalcular($p, pernoctas: 2, transitos2h: 0, transitos12h: 0);

    $renglon = $p->fresh()->renglones()->sole();

    expect((float) $renglon->precio_unitario)->toBe(4676.00)
        ->and($renglon->importe())->toBe('9352.00')
        ->and($renglon->concepto)->toBe(FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);
});

test('los tres conceptos se cobran por separado', function () {
    $p = conEstancia();

    app(CargosEstancia::class)->recalcular($p, pernoctas: 1, transitos2h: 1, transitos12h: 1);

    expect($p->fresh()->renglones()->count())->toBe(3)
        ->and($p->fresh()->subtotal())->toBe('8158.50');
});

test('una cantidad en cero no genera renglon', function () {
    $p = conEstancia();

    app(CargosEstancia::class)->recalcular($p, pernoctas: 0, transitos2h: 3, transitos12h: 0);

    expect($p->fresh()->renglones()->count())->toBe(1);
});

test('una aeronave en Guarda no paga estancia y se dice por que', function () {
    $p = conEstancia(FactAeronave::ESTATUS_GUARDA);

    $resultado = app(CargosEstancia::class)->recalcular($p, pernoctas: 5, transitos2h: 5, transitos12h: 5);

    expect($p->fresh()->renglones()->count())->toBe(0)
        ->and($resultado['renglones'])->toBe(0)
        ->and($resultado['motivo'])->toContain('Guarda');
});

test('recalcular reemplaza los renglones de estancia y no toca los capturados a mano', function () {
    $p = conEstancia();
    $otro = FactServicio::create(['nombre' => 'Comisariato', 'precio_unitario' => 500.0]);
    $p->renglones()->create([
        'servicio_id' => $otro->id, 'nombre_servicio' => 'Comisariato', 'precio_unitario' => 500.0,
        'cantidad' => 1, 'es_de_tercero' => false, 'margen' => 0, 'ajuste_precio' => 'ninguno', 'orden' => 9,
    ]);

    app(CargosEstancia::class)->recalcular($p, pernoctas: 1, transitos2h: 0, transitos12h: 0);
    app(CargosEstancia::class)->recalcular($p->fresh(), pernoctas: 3, transitos2h: 0, transitos12h: 0);

    $p = $p->fresh();

    expect($p->renglones()->count())->toBe(2)
        ->and($p->renglones()->whereNull('concepto')->sole()->nombre_servicio)->toBe('Comisariato')
        ->and($p->renglones()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->sole()->cantidad)->toBe(3);
});

test('el renglon de estancia congela la tarifa aunque la matricula cambie despues', function () {
    $p = conEstancia();
    app(CargosEstancia::class)->recalcular($p, pernoctas: 1, transitos2h: 0, transitos12h: 0);

    $p->satelite->update(['tarifa_pernocta' => 9999.00]);

    expect((float) $p->fresh()->renglones()->sole()->precio_unitario)->toBe(4676.00);
});

test('el paquete internacional agrega las cuatro con el precio del catalogo', function () {
    $p = conEstancia();
    foreach ([['DSMES - salida', 4060.50], ['DSM - salida', 348.0], ['Mex-eAPI - salida', 900.0], ['Servicios Internacionales - salida', 750.0]] as [$nombre, $precio]) {
        FactServicio::create(['nombre' => $nombre, 'precio_unitario' => $precio, 'en_paquete_internacional' => true]);
    }

    $agregados = app(CargosEstancia::class)->agregarPaqueteInternacional($p);

    expect($agregados)->toBe(4)
        ->and($p->fresh()->subtotal())->toBe('6059.00');
});

test('el paquete internacional no se duplica si ya esta', function () {
    $p = conEstancia();
    FactServicio::create(['nombre' => 'DSMES - salida', 'precio_unitario' => 4060.50, 'en_paquete_internacional' => true]);

    app(CargosEstancia::class)->agregarPaqueteInternacional($p);
    app(CargosEstancia::class)->agregarPaqueteInternacional($p->fresh());

    expect($p->fresh()->renglones()->count())->toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Facturacion/CargosEstanciaTest.php`
Expected: FAIL — `Class "App\Services\CargosEstancia" not found`.

- [ ] **Step 3: Write the service**

```php
<?php

namespace App\Services;

use App\Models\FactAeronave;
use App\Models\FactPrefactura;
use App\Models\FactServicio;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Los cargos que no se capturan uno por uno: la estancia y el paquete
 * internacional.
 *
 * Dos reglas del sistema viejo que aquí se hacen cumplir:
 *
 * 1. El precio de los tres servicios de estancia NO sale del catálogo —ahí vale
 *    99.00, que es relleno— sino de la tarifa de la matrícula. `insert22.php`
 *    hace lo mismo pasando `$Costp`, `$costt2` y `$costt12` explícitamente.
 * 2. Solo se cobran si la aeronave está en Tránsito (`if($estatus == 1)` en el
 *    original). Es la regla que el bloque 1a dejó sin aplicar a propósito.
 *
 * Las cantidades las teclea la persona. NO se derivan de las fechas: eso
 * cambiaría cobros y necesitaría su propia verificación contra el histórico.
 */
class CargosEstancia
{
    /**
     * @return array{renglones: int, motivo: ?string}
     */
    public function recalcular(FactPrefactura $prefactura, int $pernoctas, int $transitos2h, int $transitos12h): array
    {
        $satelite = $prefactura->satelite;

        if ($satelite === null) {
            return ['renglones' => 0, 'motivo' => 'La matrícula no tiene ficha de facturación, así que no hay tarifas de estancia que aplicar.'];
        }

        if ($satelite->estatus === FactAeronave::ESTATUS_GUARDA) {
            return [
                'renglones' => 0,
                'motivo' => 'La aeronave está en Guarda y una aeronave en Guarda no paga estancia. Si hay que cobrarla, agrega el servicio a mano.',
            ];
        }

        $conceptos = [
            [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA, $pernoctas, $satelite->tarifaPernocta()],
            [FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H, $transitos2h, $satelite->tarifaTransito2h()],
            [FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H, $transitos12h, $satelite->tarifaTransito12h()],
        ];

        return DB::transaction(function () use ($prefactura, $conceptos) {
            // Se reemplazan solo los de estancia: lo capturado a mano no se toca.
            $ordenes = $prefactura->renglones()
                ->whereIn('concepto', FactServicio::CONCEPTOS_ESTANCIA)
                ->pluck('orden', 'concepto');

            $prefactura->renglones()->whereIn('concepto', FactServicio::CONCEPTOS_ESTANCIA)->delete();

            $creados = 0;

            foreach ($conceptos as [$concepto, $cantidad, $tarifa]) {
                if ($cantidad <= 0) {
                    continue;
                }

                $servicio = FactServicio::porConcepto($concepto)->first();

                if ($servicio === null) {
                    throw new RuntimeException("No existe el servicio con concepto '{$concepto}'. Corre el importador de catálogos.");
                }

                if ($tarifa === null) {
                    continue;
                }

                $prefactura->renglones()->create([
                    'servicio_id' => $servicio->id,
                    'nombre_servicio' => $servicio->nombre,
                    'precio_unitario' => $tarifa,
                    'cantidad' => $cantidad,
                    'es_de_tercero' => false,
                    'margen' => 0,
                    'ajuste_precio' => FactServicio::AJUSTE_NINGUNO,
                    'concepto' => $concepto,
                    'orden' => $ordenes[$concepto] ?? ($prefactura->renglones()->max('orden') + 1),
                ]);

                $creados++;
            }

            return ['renglones' => $creados, 'motivo' => null];
        });
    }

    /** Agrega los servicios del paquete internacional que falten, con el precio del catálogo. */
    public function agregarPaqueteInternacional(FactPrefactura $prefactura): int
    {
        $yaPuestos = $prefactura->renglones()->pluck('servicio_id')->all();

        $servicios = FactServicio::query()
            ->where('en_paquete_internacional', true)
            ->where('status', FactServicio::STATUS_ACTIVO)
            ->whereNotIn('id', $yaPuestos)
            ->orderBy('id')
            ->get();

        $orden = (int) $prefactura->renglones()->max('orden');
        $creados = 0;

        foreach ($servicios as $servicio) {
            $prefactura->renglones()->create([
                'servicio_id' => $servicio->id,
                'nombre_servicio' => $servicio->nombre,
                'precio_unitario' => $servicio->precio_unitario,
                'cantidad' => 1,
                'es_de_tercero' => $servicio->es_de_tercero,
                'margen' => $servicio->margen,
                'ajuste_precio' => $servicio->ajuste_precio,
                'concepto' => null,
                'orden' => ++$orden,
            ]);

            $creados++;
        }

        return $creados;
    }
}
```

- [ ] **Step 4: Run the tests**

Run: `php artisan test tests/Feature/Facturacion/CargosEstanciaTest.php`
Expected: PASS, 8 pruebas.

- [ ] **Step 5: Run the full suite**

Run: `php artisan test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/Services/CargosEstancia.php tests/Feature/Facturacion/CargosEstanciaTest.php
git commit -m "Cargos de estancia desde las tarifas de la matricula y paquete internacional"
```

---

## Task 6: Endpoints, permisos, bitácora y seeder

**Files:**
- Create: `app/Http/Controllers/Api/Facturacion/PrefacturaController.php`, `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php`, `app/Http/Requests/Facturacion/StorePrefacturaRequest.php`, `app/Http/Requests/Facturacion/UpdatePrefacturaRequest.php`, `app/Http/Requests/Facturacion/StoreRenglonRequest.php`
- Modify: `database/seeders/FacturacionSubdepartamentosSeeder.php`, `routes/api.php`, `routes/web.php`
- Test: `tests/Feature/Facturacion/EndpointsPrefacturaTest.php`

**Interfaces:**
- Consumes: `CierrePrefactura` (Task 4), `CargosEstancia` (Task 5), los modelos (Task 3).
- Produces: las rutas de `api/facturacion/prefacturas`, el subdepartamento `factPrefacturas`, y la ruta web `facturacion/prefacturas` con nombre `facturacionPrefacturas`.

**Las rutas, exactamente estas nueve:**

```
GET    api/facturacion/prefacturas                        (abierto a autenticados)
GET    api/facturacion/prefacturas/{id}                    (abierto a autenticados)
POST   api/facturacion/prefacturas                         subdep:factPrefacturas
PUT    api/facturacion/prefacturas/{id}                     subdep:factPrefacturas
PATCH  api/facturacion/prefacturas/{id}/cerrar              subdep:factPrefacturas
POST   api/facturacion/prefacturas/{id}/renglones           subdep:factPrefacturas
DELETE api/facturacion/prefacturas/{id}/renglones/{renglon} subdep:factPrefacturas
PATCH  api/facturacion/prefacturas/{id}/estancia            subdep:factPrefacturas
PATCH  api/facturacion/prefacturas/{id}/internacional       subdep:factPrefacturas
PATCH  api/facturacion/prefacturas/{id}/descartar           subdep:factPrefacturas
```

**Por qué existe `descartar`:** `fact_prefacturas` lleva columna `status` por la
convención del proyecto, y sin un endpoint que la escriba sería una columna
muerta — y, peor, un borrador abierto por error no se podría quitar de la lista.
El sistema viejo arrastra uno abierto desde 2025-06-25 justo por eso. Descartar
es la baja lógica de siempre, **y solo aplica a borradores**: una prefactura
cerrada es un documento emitido y no se descarta (eso es del bloque 3).

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Facturacion/EndpointsPrefacturaTest.php

use App\Models\FactPrefactura;

test('sin sesion no se puede consultar ni escribir', function () {
    $this->getJson('/api/facturacion/prefacturas')->assertUnauthorized();
    $this->postJson('/api/facturacion/prefacturas', [])->assertUnauthorized();
});

test('sin el subdepartamento no se puede escribir', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));

    $this->postJson('/api/facturacion/prefacturas', cuerpoPrefactura())->assertForbidden();
});

test('consultar es abierto a cualquier autenticado', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));

    $this->getJson('/api/facturacion/prefacturas')->assertOk();
});

test('se crea un borrador sin folio', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson('/api/facturacion/prefacturas', cuerpoPrefactura())
        ->assertCreated()
        ->assertJsonPath('prefactura.estado', 'borrador')
        ->assertJsonPath('prefactura.folio', null);
});

test('el listado trae los totales derivados', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(precio: 1000.0, cantidad: 1);

    $this->getJson("/api/facturacion/prefacturas/{$p->id}")
        ->assertOk()
        ->assertJsonPath('prefactura.subtotal', '1000.00')
        ->assertJsonPath('prefactura.iva', '160.00')
        ->assertJsonPath('prefactura.total', '1160.00');
});

test('cerrar responde 409 la segunda vez', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar")->assertOk();
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar")
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_cerrada');
});

test('cerrar sin cliente responde 422 con el motivo', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta();
    $p->update(['cliente_id' => null]);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar")
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'incompleta');
});

test('una prefactura cerrada no se puede editar: lo hace cumplir el endpoint', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta();
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar")->assertOk();

    $this->putJson("/api/facturacion/prefacturas/{$p->id}", cuerpoPrefactura())
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_cerrada');
});

test('a una cerrada no se le pueden agregar ni quitar renglones', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta();
    $renglon = $p->renglones()->sole();
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar")->assertOk();

    $this->postJson("/api/facturacion/prefacturas/{$p->id}/renglones", cuerpoRenglon())->assertStatus(409);
    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$renglon->id}")->assertStatus(409);
});

test('recalcular estancia en una aeronave en Guarda responde 200 y dice el motivo', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = conEstancia(App\Models\FactAeronave::ESTATUS_GUARDA);

    $respuesta = $this->patchJson("/api/facturacion/prefacturas/{$p->id}/estancia", [
        'pernoctas' => 2, 'transitos_2h' => 0, 'transitos_12h' => 0,
    ])
        ->assertOk()
        ->assertJsonPath('renglones', 0);

    // Se afirma que el motivo LLEGA y menciona Guarda, no su redacción exacta: de
    // la redacción es dueña la Task 5, y clavarla aquí haría que mejorar el texto
    // rompiera una prueba de endpoints.
    expect($respuesta->json('motivo'))->toContain('Guarda');
});

test('descartar un borrador lo saca de la lista y responde 409 la segunda vez', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/descartar")->assertOk();

    expect($p->fresh()->status)->toBe(FactPrefactura::STATUS_INACTIVO);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/descartar")
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_descartada');

    $this->getJson('/api/facturacion/prefacturas')->assertOk()->assertJsonCount(0, 'data');
});

test('una prefactura cerrada no se descarta: ya es un documento emitido', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta();
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar")->assertOk();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/descartar")
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_cerrada');

    expect($p->fresh()->status)->toBe(FactPrefactura::STATUS_ACTIVO);
});

test('cada ruta de escritura de prefacturas lleva su subdepartamento', function () {
    $esperado = [
        'POST api/facturacion/prefacturas' => 'subdep:factPrefacturas',
        'PUT api/facturacion/prefacturas/{id}' => 'subdep:factPrefacturas',
        'PATCH api/facturacion/prefacturas/{id}/cerrar' => 'subdep:factPrefacturas',
        'POST api/facturacion/prefacturas/{id}/renglones' => 'subdep:factPrefacturas',
        'DELETE api/facturacion/prefacturas/{id}/renglones/{renglon}' => 'subdep:factPrefacturas',
        'PATCH api/facturacion/prefacturas/{id}/estancia' => 'subdep:factPrefacturas',
        'PATCH api/facturacion/prefacturas/{id}/internacional' => 'subdep:factPrefacturas',
        'PATCH api/facturacion/prefacturas/{id}/descartar' => 'subdep:factPrefacturas',
    ];

    $real = [];

    foreach (app('router')->getRoutes() as $ruta) {
        if (! str_starts_with($ruta->uri(), 'api/facturacion/prefacturas')) {
            continue;
        }

        foreach (array_diff($ruta->methods(), ['GET', 'HEAD']) as $metodo) {
            $real["{$metodo} {$ruta->uri()}"] = collect($ruta->gatherMiddleware())
                ->first(fn ($m) => is_string($m) && str_starts_with($m, 'subdep:'));
        }
    }

    expect($real)->toEqual($esperado);
});

test('el seeder crea el subdepartamento nuevo', function () {
    $this->seed(Database\Seeders\FacturacionSubdepartamentosSeeder::class);

    $departamento = App\Models\Departamento::where('nombre', 'Facturacion')->sole();

    expect(App\Models\SubDepartamento::where('departamento_id', $departamento->id)->pluck('nombre')->sort()->values()->all())
        ->toBe([
            'factAeronaves', 'factCategoriasAeronave', 'factClientes', 'factCombustible',
            'factFormasPago', 'factPrefacturas', 'factProveedores', 'factServicios', 'factTiposMotor',
        ]);
});
```

Ayudantes, al principio del archivo:

```php
function cuerpoPrefactura(array $extra = []): array
{
    $aeronave = App\Models\Aeronave::firstOrCreate(['matricula' => 'XA-TEST']);
    App\Models\FactAeronave::firstOrCreate(['aeronave_id' => $aeronave->id], ['estatus' => App\Models\FactAeronave::ESTATUS_TRANSITO]);

    return array_merge([
        'aeronave_id' => $aeronave->id,
        'cliente_id' => null,
        'llegada_at' => '2026-10-01 08:00:00',
        'salida_at' => null,
        'origen' => 'MMTO',
        'destino' => null,
        'tipo_destino' => 'nacional',
    ], $extra);
}

function cuerpoRenglon(array $extra = []): array
{
    $servicio = App\Models\FactServicio::firstOrCreate(['nombre' => 'Comisariato'], ['precio_unitario' => 500.0]);

    return array_merge(['servicio_id' => $servicio->id, 'cantidad' => 1], $extra);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Facturacion/EndpointsPrefacturaTest.php`
Expected: FAIL — 404 en todas las rutas.

- [ ] **Step 3: Write the Form Requests**

`StorePrefacturaRequest.php`:

```php
<?php

namespace App\Http\Requests\Facturacion;

use App\Models\FactPrefactura;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePrefacturaRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'aeronave_id' => ['required', 'integer', 'exists:aeronaves,id'],
            'cliente_id' => ['nullable', 'integer', Rule::exists('fact_clientes', 'id')->where('status', 'A')],
            'llegada_at' => ['nullable', 'date'],
            'salida_at' => ['nullable', 'date', 'after_or_equal:llegada_at'],
            'origen' => ['nullable', 'string', 'max:120'],
            'destino' => ['nullable', 'string', 'max:120'],
            'operacion_llegada_id' => ['nullable', 'integer', 'exists:operaciones_diarias,id'],
            'operacion_salida_id' => ['nullable', 'integer', 'exists:operaciones_diarias,id'],
            'tipo_destino' => ['required', Rule::in([FactPrefactura::DESTINO_NACIONAL, FactPrefactura::DESTINO_INTERNACIONAL])],
        ];
    }

    public function messages(): array
    {
        return [
            'salida_at.after_or_equal' => 'La salida no puede ser anterior a la llegada.',
            'cliente_id.exists' => 'El cliente no existe o está dado de baja.',
        ];
    }
}
```

`UpdatePrefacturaRequest.php`:

```php
<?php

namespace App\Http\Requests\Facturacion;

/** Mismas reglas que el alta. */
class UpdatePrefacturaRequest extends StorePrefacturaRequest
{
}
```

`StoreRenglonRequest.php`:

```php
<?php

namespace App\Http\Requests\Facturacion;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRenglonRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'servicio_id' => ['required', 'integer', Rule::exists('fact_servicios', 'id')->where('status', 'A')],
            'cantidad' => ['required', 'integer', 'min:1', 'max:9999'],
            'proveedor_id' => ['nullable', 'integer', Rule::exists('fact_proveedores', 'id')->where('status', 'A')],
            'remision' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'servicio_id.exists' => 'El servicio no existe o está dado de baja.',
            'cantidad.min' => 'La cantidad debe ser al menos 1.',
        ];
    }
}
```

- [ ] **Step 4: Write the shared guard as a trait**

Los dos controladores necesitan rechazar cualquier escritura sobre una prefactura
cerrada. El cuerpo es el mismo, así que va una vez:

```php
<?php

namespace App\Http\Controllers\Api\Facturacion\Concerns;

use App\Models\FactPrefactura;
use Illuminate\Http\JsonResponse;

/**
 * Una prefactura cerrada es un documento que ya salió al cliente: no se edita.
 * Lo hace cumplir el endpoint, no solo la pantalla.
 */
trait RechazaPrefacturaCerrada
{
}
```

Los dos controladores lo usan con `use RechazaPrefacturaCerrada;` y **ninguno
declara el método**. En el código de los controladores que sigue, donde aparece
`private function rechazarSiCerrada(...)`, bórralo: está aquí.

- [ ] **Step 5: Write the controllers**

`PrefacturaController.php` — lista, ficha, alta, edición y cierre. La guarda de "cerrada no se edita" es un método privado que los dos controladores usan:

```php
<?php

namespace App\Http\Controllers\Api\Facturacion;

use App\Http\Controllers\Controller;
use App\Http\Requests\Facturacion\StorePrefacturaRequest;
use App\Http\Requests\Facturacion\UpdatePrefacturaRequest;
use App\Models\Bitacora;
use App\Models\FactPrefactura;
use App\Services\CierrePrefactura;
use App\Services\PrefacturaIncompletaException;
use App\Services\PrefacturaYaCerradaException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PrefacturaController extends Controller
{
    use \App\Http\Controllers\Api\Facturacion\Concerns\RechazaPrefacturaCerrada;

    private const PER_PAGE_PERMITIDOS = [10, 20, 50, 100];

    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        if (! in_array($perPage, self::PER_PAGE_PERMITIDOS, true)) {
            $perPage = 20;
        }

        $query = FactPrefactura::query()
            ->with(['aeronave:id,matricula', 'cliente:id,nombre'])
            ->where('status', FactPrefactura::STATUS_ACTIVO)
            ->orderByDesc('id');

        if (in_array($request->query('estado'), [FactPrefactura::ESTADO_BORRADOR, FactPrefactura::ESTADO_CERRADA], true)) {
            $query->where('estado', $request->query('estado'));
        }

        if ($request->filled('q')) {
            $patron = '%'.trim((string) $request->query('q')).'%';
            $query->where(function ($busqueda) use ($patron) {
                $busqueda->whereHas('aeronave', fn ($a) => $a->where('matricula', 'LIKE', $patron))
                    ->orWhereHas('cliente', fn ($c) => $c->where('nombre', 'LIKE', $patron))
                    ->orWhere('folio', 'LIKE', $patron);
            });
        }

        if ($request->filled('desde')) {
            $query->whereDate('created_at', '>=', $request->query('desde'));
        }

        if ($request->filled('hasta')) {
            $query->whereDate('created_at', '<=', $request->query('hasta'));
        }

        $pagina = $query->paginate($perPage)->appends($request->query());
        $pagina->through(fn (FactPrefactura $p) => $this->presentar($p, conRenglones: false));

        return response()->json($pagina);
    }

    public function show(int $id): JsonResponse
    {
        $prefactura = FactPrefactura::with(['renglones', 'aeronave:id,matricula', 'cliente:id,nombre'])->findOrFail($id);

        return response()->json(['prefactura' => $this->presentar($prefactura, conRenglones: true)]);
    }

    public function store(StorePrefacturaRequest $request): JsonResponse
    {
        $prefactura = FactPrefactura::create($request->validated() + [
            'estado' => FactPrefactura::ESTADO_BORRADOR,
            'user_id' => $request->user()->id,
            'status' => FactPrefactura::STATUS_ACTIVO,
        ]);

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
            accion: Bitacora::ACCION_CREAR,
            descripcion: "Se abrió un borrador de prefactura para la matrícula {$prefactura->aeronave->matricula}.",
            usuarioId: $request->user()->id,
            registroId: $prefactura->id,
        );

        return response()->json([
            'message' => 'Borrador de prefactura creado.',
            'prefactura' => $this->presentar($prefactura->fresh(), conRenglones: true),
        ], 201);
    }

    public function update(UpdatePrefacturaRequest $request, int $id): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazarSiCerrada($prefactura)) {
            return $respuesta;
        }

        $antes = $prefactura->only(array_keys($request->validated()));
        $prefactura->update($request->validated());

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
            accion: Bitacora::ACCION_ACTUALIZAR,
            descripcion: "Se editó el borrador de prefactura {$prefactura->id}.",
            usuarioId: $request->user()->id,
            registroId: $prefactura->id,
            datosAnteriores: $antes,
            datosNuevos: $request->validated(),
        );

        return response()->json([
            'message' => 'Prefactura actualizada.',
            'prefactura' => $this->presentar($prefactura->fresh(), conRenglones: true),
        ]);
    }

    public function cerrar(Request $request, int $id, CierrePrefactura $cierre): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        try {
            $cerrada = $cierre->cerrar($prefactura, $request->user()->id);
        } catch (PrefacturaYaCerradaException $e) {
            return response()->json(['message' => $e->getMessage(), 'codigo' => 'ya_cerrada'], 409);
        } catch (PrefacturaIncompletaException $e) {
            return response()->json(['message' => $e->getMessage(), 'codigo' => 'incompleta'], 422);
        }

        return response()->json([
            'message' => "Prefactura cerrada con folio {$cerrada->folio}.",
            'prefactura' => $this->presentar($cerrada, conRenglones: true),
        ]);
    }

    /**
     * Baja lógica de un borrador abierto por error. Atómica, como el resto del
     * proyecto: `WHERE id = ? AND status = 'A' AND estado = 'borrador'`.
     *
     * Una prefactura cerrada NO se descarta: ya es un documento emitido con su
     * folio consumido. Corregir una cerrada es del bloque 3.
     */
    public function descartar(Request $request, int $id): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($prefactura->estaCerrada()) {
            return response()->json([
                'message' => 'Esta prefactura ya está cerrada: un documento emitido no se descarta.',
                'codigo' => 'ya_cerrada',
            ], 409);
        }

        $filas = FactPrefactura::query()
            ->where('id', $id)
            ->where('status', FactPrefactura::STATUS_ACTIVO)
            ->where('estado', FactPrefactura::ESTADO_BORRADOR)
            ->update(['status' => FactPrefactura::STATUS_INACTIVO, 'updated_at' => now()]);

        if ($filas === 0) {
            return response()->json([
                'message' => 'Este borrador ya estaba descartado.',
                'codigo' => 'ya_descartada',
            ], 409);
        }

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
            accion: Bitacora::ACCION_DESACTIVAR,
            descripcion: "Se descartó el borrador de prefactura {$id}.",
            usuarioId: $request->user()->id,
            registroId: $id,
        );

        return response()->json(['message' => 'Borrador descartado.']);
    }

    private function presentar(FactPrefactura $p, bool $conRenglones): array
    {
        $datos = [
            'id' => $p->id,
            'folio' => $p->folio,
            'estado' => $p->estado,
            'matricula' => $p->aeronave?->matricula,
            'cliente' => $p->cliente?->nombre,
            'cliente_id' => $p->cliente_id,
            'aeronave_id' => $p->aeronave_id,
            'llegada_at' => $p->llegada_at?->toDateTimeString(),
            'salida_at' => $p->salida_at?->toDateTimeString(),
            'origen' => $p->origen,
            'destino' => $p->destino,
            'tipo_destino' => $p->tipo_destino,
            'subtotal' => $p->subtotal(),
            'iva' => $p->iva(),
            'iva_tasa' => $p->ivaTasa(),
            'total' => $p->total(),
            'cerrada_at' => $p->cerrada_at?->toDateTimeString(),
        ];

        if ($conRenglones) {
            $datos['renglones'] = $p->renglones->map(fn ($r) => [
                'id' => $r->id,
                'servicio_id' => $r->servicio_id,
                'nombre_servicio' => $r->nombre_servicio,
                'precio_unitario' => (string) $r->precio_unitario,
                'cantidad' => $r->cantidad,
                'margen' => (string) $r->margen,
                'ajuste_precio' => $r->ajuste_precio,
                'concepto' => $r->concepto,
                'remision' => $r->remision,
                'importe' => $r->importe(),
            ])->all();
        }

        return $datos;
    }
}
```

`PrefacturaRenglonController.php` — alta y baja de renglones, y los dos recálculos. **Usa el trait, no una copia**: el cuerpo de `rechazarSiCerrada()` sería idéntico en los dos controladores, y duplicar un bloque de lógica es un defecto. Borra el método `private` de `PrefacturaController` y pon el trait en los dos.

```php
<?php

namespace App\Http\Controllers\Api\Facturacion;

use App\Http\Controllers\Controller;
use App\Http\Requests\Facturacion\StoreRenglonRequest;
use App\Models\Bitacora;
use App\Models\FactPrefactura;
use App\Models\FactServicio;
use App\Services\CargosEstancia;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PrefacturaRenglonController extends Controller
{
    use \App\Http\Controllers\Api\Facturacion\Concerns\RechazaPrefacturaCerrada;

    public function store(StoreRenglonRequest $request, int $id): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazarSiCerrada($prefactura)) {
            return $respuesta;
        }

        $servicio = FactServicio::findOrFail($request->validated()['servicio_id']);

        // El renglón CONGELA lo que determina su importe: si el catálogo cambia
        // mañana, este documento no se mueve.
        $renglon = $prefactura->renglones()->create([
            'servicio_id' => $servicio->id,
            'nombre_servicio' => $servicio->nombre,
            'precio_unitario' => $servicio->precio_unitario,
            'cantidad' => $request->validated()['cantidad'],
            'es_de_tercero' => $servicio->es_de_tercero,
            'margen' => $servicio->margen,
            'ajuste_precio' => $servicio->ajuste_precio,
            'concepto' => $servicio->concepto,
            'proveedor_id' => $request->validated()['proveedor_id'] ?? null,
            'remision' => $request->validated()['remision'] ?? null,
            'orden' => (int) $prefactura->renglones()->max('orden') + 1,
        ]);

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
            accion: Bitacora::ACCION_CREAR,
            descripcion: "Se agregó el servicio {$renglon->nombre_servicio} a la prefactura {$prefactura->id} por {$renglon->importe()}.",
            usuarioId: $request->user()->id,
            registroId: $prefactura->id,
            datosNuevos: ['renglon_id' => $renglon->id, 'importe' => $renglon->importe()],
        );

        return response()->json([
            'message' => 'Renglón agregado.',
            'renglon_id' => $renglon->id,
        ], 201);
    }

    public function destroy(Request $request, int $id, int $renglon): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazarSiCerrada($prefactura)) {
            return $respuesta;
        }

        $fila = $prefactura->renglones()->whereKey($renglon)->firstOrFail();
        $nombre = $fila->nombre_servicio;
        $fila->delete();

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
            accion: Bitacora::ACCION_ELIMINAR,
            descripcion: "Se quitó el servicio {$nombre} de la prefactura {$prefactura->id}.",
            usuarioId: $request->user()->id,
            registroId: $prefactura->id,
        );

        return response()->json(['message' => 'Renglón eliminado.']);
    }

    public function estancia(Request $request, int $id, CargosEstancia $cargos): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazarSiCerrada($prefactura)) {
            return $respuesta;
        }

        $datos = $request->validate([
            'pernoctas' => ['required', 'integer', 'min:0', 'max:999'],
            'transitos_2h' => ['required', 'integer', 'min:0', 'max:999'],
            'transitos_12h' => ['required', 'integer', 'min:0', 'max:999'],
        ]);

        $resultado = $cargos->recalcular($prefactura, $datos['pernoctas'], $datos['transitos_2h'], $datos['transitos_12h']);

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
            accion: Bitacora::ACCION_ACTUALIZAR,
            descripcion: "Se recalculó la estancia de la prefactura {$prefactura->id}: {$resultado['renglones']} renglones.",
            usuarioId: $request->user()->id,
            registroId: $prefactura->id,
            datosNuevos: $datos,
        );

        return response()->json([
            'message' => $resultado['motivo'] ?? 'Estancia recalculada.',
            'renglones' => $resultado['renglones'],
            'motivo' => $resultado['motivo'],
        ]);
    }

    public function internacional(Request $request, int $id, CargosEstancia $cargos): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazarSiCerrada($prefactura)) {
            return $respuesta;
        }

        $prefactura->update(['tipo_destino' => FactPrefactura::DESTINO_INTERNACIONAL]);
        $agregados = $cargos->agregarPaqueteInternacional($prefactura);

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
            accion: Bitacora::ACCION_ACTUALIZAR,
            descripcion: "Se marcó internacional la prefactura {$prefactura->id} y se agregaron {$agregados} servicios del paquete.",
            usuarioId: $request->user()->id,
            registroId: $prefactura->id,
        );

        return response()->json(['message' => 'Paquete internacional agregado.', 'renglones' => $agregados]);
    }

}
```

- [ ] **Step 6: Register the routes**

En `routes/api.php`, dentro del grupo `prefix('facturacion')` que ya existe, las lecturas:

```php
    Route::get('/prefacturas', [PrefacturaController::class, 'index']);
    Route::get('/prefacturas/{id}', [PrefacturaController::class, 'show'])->whereNumber('id');
```

Y un grupo de escritura:

```php
    Route::middleware('subdep:factPrefacturas')->group(function () {
        Route::post('/prefacturas', [PrefacturaController::class, 'store']);
        Route::put('/prefacturas/{id}', [PrefacturaController::class, 'update'])->whereNumber('id');
        Route::patch('/prefacturas/{id}/cerrar', [PrefacturaController::class, 'cerrar'])->whereNumber('id');
        Route::post('/prefacturas/{id}/renglones', [PrefacturaRenglonController::class, 'store'])->whereNumber('id');
        Route::delete('/prefacturas/{id}/renglones/{renglon}', [PrefacturaRenglonController::class, 'destroy'])->whereNumber('id')->whereNumber('renglon');
        Route::patch('/prefacturas/{id}/estancia', [PrefacturaRenglonController::class, 'estancia'])->whereNumber('id');
        Route::patch('/prefacturas/{id}/internacional', [PrefacturaRenglonController::class, 'internacional'])->whereNumber('id');
        Route::patch('/prefacturas/{id}/descartar', [PrefacturaController::class, 'descartar'])->whereNumber('id');
    });
```

En `routes/web.php`, junto a las otras de Facturación:

```php
    Route::get('facturacion/prefacturas', fn () => Inertia::render('Facturacion/Prefacturas'))->name('facturacionPrefacturas');
    Route::get('facturacion/prefacturas/{id}', fn ($id) => Inertia::render('Facturacion/EditorPrefactura', ['id' => (int) $id]))->whereNumber('id')->name('facturacionEditorPrefactura');
```

- [ ] **Step 7: Add the subdepartamento to the seeder**

En `database/seeders/FacturacionSubdepartamentosSeeder.php`, agregar `'factPrefacturas'` al arreglo.

- [ ] **Step 8: Run the tests**

Run: `php artisan test tests/Feature/Facturacion/EndpointsPrefacturaTest.php`
Expected: PASS, 15 pruebas.

- [ ] **Step 9: Run the full suite**

Run: `php artisan test`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add app/Http/Controllers/Api/Facturacion app/Http/Requests/Facturacion routes database/seeders tests/Feature/Facturacion/EndpointsPrefacturaTest.php
git commit -m "Endpoints de prefactura con permisos, bitacora y seeder"
```

---

## Task 7: Las dos pantallas

**Files:**
- Create: `resources/js/pages/Facturacion/Prefacturas.tsx`, `resources/js/pages/Facturacion/EditorPrefactura.tsx`, `resources/js/pages/Facturacion/components/ModalRenglon.tsx`
- Modify: `resources/js/stores/apiFacturacionCatalogos.ts`
- Test: verificación con `tsc`, `eslint` y `build` (el proyecto no tiene pruebas de frontend)

**Interfaces:**
- Consumes: los endpoints de la Task 6.
- Produces: los tipos `Prefactura`, `RenglonPrefactura` y las funciones de acceso en el store.

**Reutiliza, no reimplementes:**
- `useListaPaginada` de `resources/js/pages/Facturacion/components/useListaPaginada.ts` para la lista. Recibe `{ obtener, vacios, mensajeError }` donde `obtener` y `vacios` **deben ser estables (de módulo)**, y devuelve `{ registros, total, pagina, totalPaginas, porPagina, cargando, error, filtros, busqueda, setBusqueda, setFiltros, limpiarFiltros, hayFiltros, cambiarPagina, cambiarPorPagina, recargar }`.
- `CampoMonto` para cualquier campo de importe: es `type="text"` a propósito para que `""` y `"0"` no se confundan.
- `importeVistaPrevia(precio: number, margen: number, ajuste: AjustePrecio, cantidad = 1): number` y `formatearMonto` de `components/formato.ts`.
- `ModalBase` y `PiePaginacion`.
- **No** uses `PantallaCatalogo`: el editor es un documento, no un catálogo.

- [ ] **Step 1: Add the store functions**

En `resources/js/stores/apiFacturacionCatalogos.ts`, los tipos y las funciones. `obtenerPrefacturasApi` debe ser una función de módulo para que `useListaPaginada` no la recree:

```ts
export interface RenglonPrefactura {
    id: number;
    servicio_id: number;
    nombre_servicio: string;
    precio_unitario: string;
    cantidad: number;
    margen: string;
    ajuste_precio: AjustePrecio;
    concepto: string | null;
    remision: string | null;
    importe: string;
}

export interface Prefactura {
    id: number;
    folio: number | null;
    estado: 'borrador' | 'cerrada';
    matricula: string | null;
    cliente: string | null;
    cliente_id: number | null;
    aeronave_id: number;
    llegada_at: string | null;
    salida_at: string | null;
    origen: string | null;
    destino: string | null;
    tipo_destino: 'nacional' | 'internacional';
    subtotal: string;
    iva: string;
    iva_tasa: string;
    total: string;
    cerrada_at: string | null;
    renglones?: RenglonPrefactura[];
}

export interface FiltrosPrefactura {
    q: string;
    estado: '' | 'borrador' | 'cerrada';
    desde: string;
    hasta: string;
}

export const FILTROS_PREFACTURA_VACIOS: FiltrosPrefactura = { q: '', estado: 'borrador', desde: '', hasta: '' };

export async function obtenerPrefacturasApi(filtros: FiltrosPrefactura, pagina: number, porPagina: number): Promise<Pagina<Prefactura>> {
    const params = new URLSearchParams({ page: String(pagina), per_page: String(porPagina) });
    if (filtros.q) params.set('q', filtros.q);
    if (filtros.estado) params.set('estado', filtros.estado);
    if (filtros.desde) params.set('desde', filtros.desde);
    if (filtros.hasta) params.set('hasta', filtros.hasta);

    return pedir<Pagina<Prefactura>>(`/api/facturacion/prefacturas?${params}`);
}

export const apiPrefacturas = {
    ficha: (id: number) => pedir<{ prefactura: Prefactura }>(`/api/facturacion/prefacturas/${id}`),
    crear: (datos: Record<string, unknown>) => pedir<{ prefactura: Prefactura }>('/api/facturacion/prefacturas', { method: 'POST', body: datos }),
    editar: (id: number, datos: Record<string, unknown>) => pedir<{ prefactura: Prefactura }>(`/api/facturacion/prefacturas/${id}`, { method: 'PUT', body: datos }),
    cerrar: (id: number) => pedir<{ prefactura: Prefactura; message: string }>(`/api/facturacion/prefacturas/${id}/cerrar`, { method: 'PATCH' }),
    agregarRenglon: (id: number, datos: Record<string, unknown>) => pedir<{ renglon_id: number }>(`/api/facturacion/prefacturas/${id}/renglones`, { method: 'POST', body: datos }),
    quitarRenglon: (id: number, renglon: number) => pedir<{ message: string }>(`/api/facturacion/prefacturas/${id}/renglones/${renglon}`, { method: 'DELETE' }),
    estancia: (id: number, datos: Record<string, unknown>) => pedir<{ renglones: number; motivo: string | null }>(`/api/facturacion/prefacturas/${id}/estancia`, { method: 'PATCH', body: datos }),
    internacional: (id: number) => pedir<{ renglones: number }>(`/api/facturacion/prefacturas/${id}/internacional`, { method: 'PATCH' }),
};
```

**Lee el archivo antes de escribir:** `pedir` y `Pagina<T>` ya existen ahí con su firma; úsalas tal cual en lugar de inventar un cliente nuevo.

- [ ] **Step 2: Build the list screen**

`Prefacturas.tsx` usa `useListaPaginada({ obtener: obtenerPrefacturasApi, vacios: FILTROS_PREFACTURA_VACIOS, mensajeError: 'No se pudieron cargar las prefacturas.' })`. Columnas: folio (o "Borrador" si es nulo), matrícula, cliente, fecha, total, estado. Filtros: buscador (matrícula, cliente o folio), selector de estado, y rango de fechas. Un clic en la fila lleva a `facturacionEditorPrefactura`.

Sigue la forma de `AeronavesFacturacion.tsx`, que es la pantalla paginada del 1a, y usa `PiePaginacion`.

- [ ] **Step 3: Build the editor**

`EditorPrefactura.tsx` recibe `id` como prop de Inertia. Tres zonas:

**Encabezado:** matrícula (solo lectura una vez creada), cliente (selector del catálogo de activos), llegada y salida, origen y destino, y el indicador de nacional/internacional. Si la prefactura está cerrada, **todo de solo lectura** y una insignia con el folio y la fecha de cierre.

**Renglones:** tabla con nombre, precio unitario, cantidad e importe, y un botón de quitar por renglón —oculto si está cerrada—. Los renglones cuyo `concepto` empieza por `estancia_` llevan una marca visual, porque los reemplaza el recálculo.

**Acciones:** agregar servicio (abre `ModalRenglon`), recalcular estancia (pide las tres cantidades y **muestra el `motivo` que devuelve el servidor** cuando no genera renglones, que es el caso de una aeronave en Guarda), marcar internacional, y cerrar.

**Totales:** subtotal, IVA con su tasa, y total, tomados de la respuesta del servidor. `importeVistaPrevia` se usa solo para la vista previa del renglón **dentro de `ModalRenglon`**, mientras se teclea la cantidad; el total que se muestra es siempre el del servidor.

**Cerrar** pide confirmación con SweetAlert2 siguiendo el patrón del proyecto, advirtiendo que el folio se consume y que la prefactura ya no se podrá editar. Si el servidor responde 422 con `codigo: 'incompleta'`, se muestra su mensaje; si responde 409, se recarga la ficha porque alguien más la cerró.

- [ ] **Step 4: Build the line modal**

`ModalRenglon.tsx`: selector de servicio (solo activos), cantidad, proveedor opcional, remisión opcional, y **la vista previa del importe** con `importeVistaPrevia` usando el margen y el ajuste del servicio elegido. El texto debe decir que es una vista previa y que el sistema calcula la cifra que cobra, igual que hace `ModalServicio.tsx`.

- [ ] **Step 5: Verify types, lint and build**

Run: `npx tsc --noEmit`
Expected: solo el error preexistente `resources/js/actions/App/Http/Controllers/Api/WalkAroundController.ts(905,5)`.

Run: `npx eslint resources/js/pages/Facturacion resources/js/stores/apiFacturacionCatalogos.ts`
Expected: sin errores ni advertencias.

Run: `npm run build`
Expected: `built in …` sin errores.

Run: `php artisan test`
Expected: PASS, sin cambios en el total (el frontend no agrega pruebas de PHP).

- [ ] **Step 6: Commit**

```bash
git add resources/js/pages/Facturacion resources/js/stores/apiFacturacionCatalogos.ts
git commit -m "Pantallas de prefacturas: lista y editor"
```

---

## Task 8: El comando de comparación contra el histórico

**Files:**
- Create: `app/Console/Commands/CompararPrefacturas.php`
- Test: `tests/Feature/Facturacion/CompararPrefacturasTest.php`

**Interfaces:**
- Consumes: `ImporteServicio::calcular()` (Task 1).
- Produces: el comando `facturacion:comparar-prefacturas`.

**Lo que hace y lo que no.** Lee el histórico del sistema viejo por la conexión `remota` y, para cada prefactura, recalcula con `ImporteServicio` usando **el precio y la cantidad que el sistema viejo guardó en cada renglón**. Compara contra el total guardado y clasifica. **Nunca escribe nada**, ni en la base legada ni en la local.

**Prueba la fidelidad de la aritmética**: dados los mismos renglones, la fórmula da el mismo importe, el subtotal es la suma, el IVA es 16% y el total es la suma. **No prueba el extremo a extremo**, porque las cantidades de estancia las teclea una persona y no son reproducibles desde el dato.

**Clasificación esperada contra el volcado de producción del 2026-09-29:**

| Clase | Esperado |
|---|---|
| Idénticas (≤ 2 centavos) | ~3,034 |
| Redondeo (≤ 1 peso) | ~422 |
| Estructurales (> 1 peso) | ~38 |
| Folio duplicado, excluidas | 207 folios, 290 filas |

**Dos trampas verificadas que el implementador debe conocer:**
1. **`tb_venta` cuelga del folio, no del id del encabezado.** Agrupar renglones por folio sin excluir los folios duplicados suma los renglones de todos los encabezados repetidos y contamina la comparación. Los duplicados se detectan con `GROUP BY fol_prefactura HAVING COUNT(*) > 1` y se reportan aparte.
2. **`tb_venta.precio_u` es `float` y `tb_hprefactura.iva` también.** Por eso las diferencias de centavos son esperadas y no un defecto: el número nuevo es el correcto.

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Facturacion/CompararPrefacturasTest.php

use Illuminate\Support\Facades\DB;

/*
 * `TestCase` apunta la conexión `remota` a un destino inválido para que ninguna
 * prueba pueda escribir en la base real del sistema viejo. Aquí se reemplaza por
 * sqlite en memoria, y hace falta `DB::purge` porque si no Laravel devuelve la
 * conexión ya resuelta con la configuración inválida.
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
    });

    $esquema->create('tb_venta', function ($t) {
        $t->integer('id_venta', true);
        $t->integer('fol_prefactura');
        $t->integer('id_servicio');
        $t->float('precio_u');
        $t->decimal('importe', 18, 2);
        $t->integer('cantidad');
    });
});

function legacyPref(int $folio, float $subtotal, float $iva, float $total): void
{
    DB::connection('remota')->table('tb_hprefactura')->insert([
        'fol_prefactura' => $folio, 'subtotal' => $subtotal, 'iva' => $iva, 'Total' => $total,
    ]);
}

function legacyVenta(int $folio, float $precio, int $cantidad, float $importe): void
{
    DB::connection('remota')->table('tb_venta')->insert([
        'fol_prefactura' => $folio, 'id_servicio' => 50, 'precio_u' => $precio, 'cantidad' => $cantidad, 'importe' => $importe,
    ]);
}

test('una prefactura que cuadra sale como identica', function () {
    legacyPref(1, 2000.00, 320.00, 2320.00);
    legacyVenta(1, 1000.00, 2, 2000.00);

    $this->artisan('facturacion:comparar-prefacturas')
        ->expectsOutputToContain('Idénticas: 1')
        ->assertExitCode(0);
});

test('una diferencia de centavos se clasifica como redondeo, no como defecto', function () {
    legacyPref(1, 24342.40, 3894.79, 28237.24);
    legacyVenta(1, 8114.15, 3, 24342.45);

    $this->artisan('facturacion:comparar-prefacturas')
        ->expectsOutputToContain('Redondeo: 1')
        ->assertExitCode(0);
});

test('un total que no corresponde a sus renglones se enumera como estructural', function () {
    legacyPref(2622, 33744.00, 5399.04, 39143.04);
    legacyVenta(2622, 4744.00, 1, 4744.00);

    $this->artisan('facturacion:comparar-prefacturas')
        ->expectsOutputToContain('Estructurales: 1')
        ->expectsOutputToContain('2622')
        ->assertExitCode(0);
});

test('los folios duplicados se excluyen y se reportan aparte', function () {
    legacyPref(3922, 100.00, 16.00, 116.00);
    legacyPref(3922, 100.00, 16.00, 116.00);
    legacyVenta(3922, 100.00, 1, 100.00);

    $this->artisan('facturacion:comparar-prefacturas')
        ->expectsOutputToContain('Folios duplicados en el origen: 1')
        ->expectsOutputToContain('Comparadas: 0')
        ->assertExitCode(0);
});

test('el comando no escribe nada en la base local', function () {
    legacyPref(1, 2000.00, 320.00, 2320.00);
    legacyVenta(1, 1000.00, 2, 2000.00);

    $this->artisan('facturacion:comparar-prefacturas')->assertExitCode(0);

    expect(App\Models\FactPrefactura::count())->toBe(0);
});

test('el comando no escribe nada en la base legada', function () {
    legacyPref(1, 2000.00, 320.00, 2320.00);
    legacyVenta(1, 1000.00, 2, 2000.00);

    $this->artisan('facturacion:comparar-prefacturas')->assertExitCode(0);

    expect(DB::connection('remota')->table('tb_hprefactura')->count())->toBe(1)
        ->and(DB::connection('remota')->table('tb_venta')->count())->toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Facturacion/CompararPrefacturasTest.php`
Expected: FAIL — el comando no existe.

- [ ] **Step 3: Write the command**

```php
<?php

namespace App\Console\Commands;

use App\Support\ImporteServicio;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Verifica contra el histórico del sistema viejo que la aritmética del bloque 2
 * da los mismos números. SOLO LEE: no escribe en ninguna de las dos bases.
 *
 * Qué prueba: dados los mismos renglones, el mismo precio y la misma cantidad,
 * la fórmula da el mismo importe, el subtotal es la suma, el IVA es 16% y el
 * total es la suma.
 *
 * Qué NO prueba: el extremo a extremo. Las cantidades de estancia las teclea una
 * persona y no son reproducibles desde el dato, así que si alguien cobró dos
 * pernoctas donde correspondían tres, esto no lo detecta.
 */
class CompararPrefacturas extends Command
{
    protected $signature = 'facturacion:comparar-prefacturas {--detalle=20 : Cuántas estructurales enumerar}';

    protected $description = 'Compara la aritmética de las prefacturas históricas contra la del bloque 2 (solo lectura)';

    /** Hasta aquí es redondeo del float del sistema viejo, no un defecto. */
    private const TOLERANCIA_IDENTICA = 0.02;

    private const TOLERANCIA_REDONDEO = 1.00;

    private const IVA_TASA = 0.16;

    public function handle(): int
    {
        $origen = config('database.connections.remota.database');
        $this->info("Comparando contra '{$origen}'. Este comando no escribe nada.");

        // `tb_venta` cuelga del folio, no del id del encabezado: con un folio
        // repetido, agrupar por folio suma los renglones de todos los
        // encabezados y contamina la comparación. Se excluyen.
        $duplicados = DB::connection('remota')->table('tb_hprefactura')
            ->select('fol_prefactura')
            ->groupBy('fol_prefactura')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('fol_prefactura')
            ->all();

        $renglonesPorFolio = DB::connection('remota')->table('tb_venta')
            ->select('fol_prefactura', 'precio_u', 'cantidad', 'importe')
            ->get()
            ->groupBy('fol_prefactura');

        $identicas = 0;
        $redondeo = 0;
        $estructurales = [];

        $encabezados = DB::connection('remota')->table('tb_hprefactura')
            ->whereNotIn('fol_prefactura', $duplicados ?: [0])
            ->orderBy('fol_prefactura')
            ->get();

        foreach ($encabezados as $h) {
            $renglones = $renglonesPorFolio[$h->fol_prefactura] ?? collect();

            $suma = '0.00';
            foreach ($renglones as $r) {
                // Sin margen ni ajuste: el histórico ya guarda el precio final
                // de cada renglón, así que esto comprueba la multiplicación y el
                // redondeo, que es lo que la fórmula hace con esos datos.
                $suma = bcadd($suma, ImporteServicio::calcular((float) $r->precio_u, (int) $r->cantidad, 0.0, ImporteServicio::AJUSTE_NINGUNO), 2);
            }

            $diferencia = abs((float) $h->subtotal - (float) $suma);

            if ($diferencia <= self::TOLERANCIA_IDENTICA) {
                $identicas++;
            } elseif ($diferencia <= self::TOLERANCIA_REDONDEO) {
                $redondeo++;
            } else {
                $estructurales[] = [
                    'folio' => $h->fol_prefactura,
                    'guardado' => number_format((float) $h->subtotal, 2, '.', ''),
                    'recalculado' => $suma,
                    'diferencia' => number_format($diferencia, 2, '.', ''),
                ];
            }
        }

        $this->newLine();
        $this->table(['Clase', 'Prefacturas'], [
            ['Comparadas', $encabezados->count()],
            ['Idénticas', $identicas],
            ['Redondeo', $redondeo],
            ['Estructurales', count($estructurales)],
            ['Folios duplicados en el origen', count($duplicados)],
        ]);

        if ($estructurales !== []) {
            $this->newLine();
            $this->warn('Prefacturas cuyo total guardado no corresponde a sus renglones:');
            $this->table(
                ['Folio', 'Subtotal guardado', 'Recalculado', 'Diferencia'],
                array_slice($estructurales, 0, (int) $this->option('detalle')),
            );

            if (count($estructurales) > (int) $this->option('detalle')) {
                $this->line('... y '.(count($estructurales) - (int) $this->option('detalle')).' más. Usa --detalle=N para ver más.');
            }
        }

        $this->newLine();
        $this->line('Esto comprueba la aritmética, NO el extremo a extremo: las cantidades de');
        $this->line('estancia las teclea una persona y no son reproducibles desde el dato.');

        return self::SUCCESS;
    }
}
```

- [ ] **Step 4: Run the tests**

Run: `php artisan test tests/Feature/Facturacion/CompararPrefacturasTest.php`
Expected: PASS, 6 pruebas.

- [ ] **Step 5: Run it against the real dump and report what it says**

Run: `php artisan facturacion:comparar-prefacturas`
Expected: una clasificación cercana a 3,034 idénticas, 422 de redondeo, ~38 estructurales y 207 folios duplicados. **Anota los números reales en el reporte**: si se alejan mucho de esos, es un hallazgo y hay que decirlo, no ajustar las tolerancias para que cuadren.

- [ ] **Step 6: Run the full suite**

Run: `php artisan test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/Console/Commands/CompararPrefacturas.php tests/Feature/Facturacion/CompararPrefacturasTest.php
git commit -m "Comando de comparacion de la aritmetica contra el historico"
```

---

## Task 9: Menú y guía de despliegue

**Files:**
- Modify: `resources/js/components/navigation.ts`
- Create: `docs/superpowers/specs/2026-10-01-facturacion-2-despliegue-y-pendientes.md`

**Interfaces:**
- Consumes: la ruta web de la Task 6 y el subdepartamento `factPrefacturas`.
- Produces: nada que otras tasks consuman.

**El menú se arma en DOS lugares de `navigation.ts` y hay que tocar los dos.** Si solo se toca uno, un administrador no vería la pantalla nueva, y es quien la va a abrir primero:

1. El arreglo `catalogosFacturacionRoutes` (alrededor de la línea 326) y `ROUTE_CONFIG`, que es el camino que arma el menú **por departamento**. La llave es el nombre del subdepartamento **en minúsculas y sin separadores**, que es lo que produce `Str::slug`: `factprefacturas`.
2. El bloque **hardcodeado para el rol admin** (alrededor de las líneas 267-298), que no usa `ROUTE_CONFIG` sino `href` directos e ids propios, y que **retorna antes** de llegar al mapeo por departamento.

Prefacturas va en el **primer nivel**, junto a "Aeronaves facturables", no bajo el nodo Catálogos: es la pantalla de uso diario del módulo.

- [ ] **Step 1: Add the ROUTE_CONFIG entry**

Importar `facturacionPrefacturas` de `@/routes` y agregar a `ROUTE_CONFIG`:

```ts
    factprefacturas: {
        href: facturacionPrefacturas,
        title: 'Prefacturas',
    },
```

- [ ] **Step 2: Add it to the admin branch**

En la rama de administrador de `getNavModules`, dentro del módulo `Facturacion`, en el primer nivel:

```tsx
                    { id: 'facturacion-prefacturas', title: 'Prefacturas', href: facturacionPrefacturas(), icon: LayoutGrid },
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx eslint resources/js/components/navigation.ts && npm run build`
Expected: sin errores nuevos.

- [ ] **Step 4: Write the deployment guide**

Crear `docs/superpowers/specs/2026-10-01-facturacion-2-despliegue-y-pendientes.md` siguiendo la forma de la guía del 1b que ya está en esa carpeta. Debe cubrir:

- **El orden de despliegue**: `migrate` (tres migraciones, todas aditivas: dos tablas nuevas y dos columnas en `fact_servicios`), volver a correr el importador **con `--forzar`** para que asigne los `concepto` a los servicios ya importados, el seeder de subdepartamentos, `optimize:clear`, y `npm ci && npm run build`.
- **Que el importador hay que volver a correrlo** y por qué: sin eso los siete servicios especiales quedan sin `concepto` y los cargos de estancia fallan con "No existe el servicio con concepto…". Decirlo explícitamente, porque es un paso fácil de omitir.
- **Qué pisa `--forzar`**, remitiendo a la sección equivalente de la guía del 1b.
- **El folio arranca en 10000** y por qué: el mayor del sistema viejo es 4121 y sus borradores llegan a 4123. Mientras los dos sistemas convivan, ningún folio puede coincidir y de un folio se sabe al instante qué sistema lo emitió.
- **El barrido PHP contra TypeScript de la Task 1**: qué resultado dio, y que hay
  que volver a correrlo si alguien toca `ImporteServicio` o `importeVistaPrevia`,
  porque la prueba permanente clava el lado de PHP pero no la equivalencia.
- **Las tres cosas que sqlite no puede demostrar** y hay que probar contra MySQL real: que el índice único del folio aguante dos cierres simultáneos; que el cierre atómico devuelva 409 bajo dos conexiones reales; y que la collation no colapse dos valores distintos de `concepto`.
- **La salida real del comando de comparación** con los números que dio en la Task 8, y la advertencia de que comprueba la aritmética y no el extremo a extremo.
- **Lo que queda para el bloque 3**: pagos, notas, impresión, corrección de una prefactura cerrada, y la importación del histórico — que sigue siendo parcial mientras pagos y notas no tengan tabla, y que arrastra dos decisiones: qué hacer con los 207 folios duplicados y con los 37 totales discrepantes. **El usuario pidió aviso explícito cuando eso sea posible.**
- **La deuda que este bloque NO retira**: el 500 en lugar de 422 de dos altas simultáneas del mismo nombre en los catálogos del 1b y su bitácora fuera de transacción; el nombre del comando `facturacion:importar-matriculas`; y los 19 hallazgos menores de la guía del 1b.

- [ ] **Step 5: Run the full suite**

Run: `php artisan test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add resources/js/components/navigation.ts docs/superpowers/specs/2026-10-01-facturacion-2-despliegue-y-pendientes.md
git commit -m "Menu de prefacturas y guia de despliegue del bloque 2"
```

---

## Orden de despliegue

```bash
git pull
composer install --no-dev --optimize-autoloader

# Tres migraciones, todas aditivas: dos tablas nuevas y dos columnas en
# fact_servicios. Ninguna toca datos existentes.
php artisan migrate

# OBLIGATORIO: sin esto los siete servicios especiales quedan sin `concepto` y
# los cargos de estancia fallan. Es idempotente, y --forzar hace falta porque
# fact_aeronaves ya tiene filas.
php artisan facturacion:importar-matriculas | tee storage/logs/facturacion-importacion-$(date +%F).log
php artisan facturacion:importar-matriculas --aplicar --forzar | tee -a storage/logs/facturacion-importacion-$(date +%F).log

# La verificación de que el dinero cuadra. Solo lee.
php artisan facturacion:comparar-prefacturas | tee storage/logs/facturacion-comparacion-$(date +%F).log

php artisan db:seed --class=FacturacionSubdepartamentosSeeder
php artisan optimize:clear
npm ci && npm run build
```

Después, asignar el subdepartamento `factPrefacturas` desde Gestión de usuarios, con la función de agrupar por departamento.

**Backend y frontend se despliegan juntos**, igual que en los bloques anteriores.
