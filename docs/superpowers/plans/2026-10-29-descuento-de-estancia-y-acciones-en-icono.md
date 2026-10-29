# Plan de implementación: el descuento de estancia y las acciones del renglón en icono

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un renglón de tránsito o pernocta pueda descontarse con un renglón negativo desde su propio icono, y que las cuatro acciones de la fila queden en icono sin texto.

**Architecture:** El descuento es un renglón más de `fact_prefactura_renglones` con precio negativo, cantidad 1 y un `concepto` propio (`descuento_estancia_*`) que a propósito NO está en `FactServicio::CONCEPTOS_ESTANCIA`, que es lo que hace que sobreviva al borrado masivo del recálculo. Un `App\Support\DescuentoDeEstancia` concentra qué concepto, qué nombre y qué precio le toca a cada tramo; un endpoint propio lo aplica con las mismas guardas que las demás acciones de renglón; y `CargosEstancia` gana un paso que retira el descuento cuyo concepto dejó de cobrarse y lo nombra en el aviso que ya existe.

**Tech Stack:** Laravel 12, Inertia 2, React 19, TypeScript, Tailwind 4, Pest 3, lucide-react 0.475.0. MariaDB en desarrollo, sqlite en memoria en las pruebas.

**Spec:** `docs/superpowers/specs/2026-10-28-descuento-de-estancia-y-acciones-en-icono-design.md`

## Global Constraints

- **No hay migración.** Ninguna columna nace en este trabajo. Si una tarea cree que la necesita, está mal leída.
- Las pruebas corren **en serie**: `php artisan test`, nunca con `--parallel` (da rojos falsos en este proyecto).
- **No ejecutes `vendor/bin/pint`, `prettier` ni `npm run lint`** aunque `CLAUDE.md` pida pint: `npm run lint` lleva `--fix` y toca ficheros fuera de la tarea.
- **No ejecutes `npm run build`**: tarda más de dos minutos en silencio. La evidencia del front la recoge el coordinador al final.
- **No hay factories** salvo `UserFactory`. Las filas se crean con `Modelo::create([...])`. Usa los ayudantes que ya existen en `tests/Pest.php`: `prefacturaBorrador()`, `renglonDe()`, `conEstancia()`, `usuarioConSubdepartamento()`, `matriculaDePrueba()`.
- `conEstancia()` ya crea los tres servicios de estancia con su concepto y una matrícula con las tarifas **pernocta 4676.00, tránsito 2 h 1144.50, tránsito 12 h 2338.00**. No la redeclares: está en `tests/Pest.php` y redeclararla revienta con error fatal.
- Aserciones de respuesta **específicas**: `assertOk()`, `assertUnprocessable()`, `assertConflict()`, `assertNotFound()`; no `assertStatus(200)`.
- PHP: llaves siempre, tipo de retorno explícito en cada método, PHPDoc en vez de comentarios dentro del código salvo que algo sea de verdad complejo.
- **Nunca `git add -A` ni `git add .`**: `CLAUDE.md`, `boost.json` y `.claude/` son locales y tienen que seguir sin seguimiento. Añade los ficheros por su nombre.
- **Nunca `git stash`**: hay tres guardados en este repositorio que no son de este trabajo.
- `eolo_plus` es la base real del usuario: no se escribe nada en ella. No corras `php artisan migrate`.
- El nombre del renglón que ve el cliente es exactamente **«Descuento pernocta»**, **«Descuento tránsito de 2 horas»** y **«Descuento tránsito de 12 horas»**.
- Los tres conceptos son exactamente **`descuento_estancia_pernocta`**, **`descuento_estancia_transito_2h`** y **`descuento_estancia_transito_12h`** (27, 30 y 31 caracteres; la columna es `varchar(32)`).

---

## Estructura de ficheros

| Fichero | Responsabilidad | Tarea |
|---|---|---|
| `app/Support/DescuentoDeEstancia.php` | **Crear.** Qué concepto, qué nombre, qué etiqueta y qué precio le toca a cada tramo descontable. Única fuente del mapa. | 1 |
| `app/Models/FactServicio.php` | **Modificar.** Las tres constantes de concepto del descuento. | 1 |
| `app/Http/Requests/Facturacion/StoreDescuentoEstanciaRequest.php` | **Crear.** La forma de la petición: de qué renglón sale y qué conceptos se perdonan. | 2 |
| `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php` | **Modificar.** `descuentosDeEstancia()` y `tarifasDeEstancia()`. | 2, 3, 5 |
| `routes/api.php` | **Modificar.** El POST en el grupo de escritura, el GET en el de lectura. | 2, 5 |
| `app/Services/CargosEstancia.php` | **Modificar.** El descuento sobrevive al recálculo, y se retira nombrado cuando su concepto deja de cobrarse. | 6 |
| `resources/js/pages/Facturacion/EditorPrefactura.tsx` | **Modificar.** Los tres botones a icono, el icono del descuento y el estado del modal. | 7, 8 |
| `resources/js/pages/Facturacion/components/ModalDescuentoEstancia.tsx` | **Crear.** El modal con los tres conceptos y sus tarifas. | 8 |
| `resources/js/pages/Facturacion/components/formato.ts` | **Modificar.** `admiteDescuentoDeEstancia()`. | 8 |
| `resources/js/stores/apiFacturacionCatalogos.ts` | **Modificar.** Los dos métodos nuevos del api. | 8 |
| `tests/Unit/DescuentoDeEstanciaTest.php` | **Crear.** El mapa y el precio, sin base de datos. | 1 |
| `tests/Feature/Facturacion/DescuentoEstanciaTest.php` | **Crear.** El endpoint: lo que aplica, lo que rechaza, el documento y el recálculo. | 2, 3, 4, 5, 6 |

---

### Task 1: `DescuentoDeEstancia`, el mapa en un solo sitio

**Files:**
- Create: `app/Support/DescuentoDeEstancia.php`
- Modify: `app/Models/FactServicio.php` (las constantes nuevas, junto a las de estancia, alrededor de la línea 44)
- Test: `tests/Unit/DescuentoDeEstanciaTest.php`

**Interfaces:**
- Consumes: `App\Models\FactServicio::CONCEPTO_ESTANCIA_PERNOCTA`, `CONCEPTO_ESTANCIA_TRANSITO_2H`, `CONCEPTO_ESTANCIA_TRANSITO_12H`, `CONCEPTOS_ESTANCIA`; `App\Models\FactAeronave::tarifaPernocta(): ?string`, `tarifaTransito2h(): ?string`, `tarifaTransito12h(): ?string`.
- Produces:
  - `FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA`, `CONCEPTO_DESCUENTO_ESTANCIA_TRANSITO_2H`, `CONCEPTO_DESCUENTO_ESTANCIA_TRANSITO_12H` (constantes string)
  - `DescuentoDeEstancia::conceptosDescontables(): list<string>` — los tres conceptos **de estancia** que admiten descuento
  - `DescuentoDeEstancia::conceptos(): list<string>` — los tres conceptos **de descuento**
  - `DescuentoDeEstancia::conceptoDe(string $conceptoDeEstancia): string`
  - `DescuentoDeEstancia::nombreDe(string $conceptoDeEstancia): string`
  - `DescuentoDeEstancia::etiquetaDe(string $conceptoDeEstancia): string`
  - `DescuentoDeEstancia::tarifaDe(FactAeronave $satelite, string $conceptoDeEstancia): ?string`
  - `DescuentoDeEstancia::precioDe(string $tarifa): string`

- [ ] **Step 1: Escribe las pruebas que fallan**

Crea `tests/Unit/DescuentoDeEstanciaTest.php`. Las pruebas de `tests/Unit` **no** tienen base de datos (`RefreshDatabase` solo se aplica a `Feature` en `tests/Pest.php`), así que los modelos se instancian sin guardar. Las tarifas están en `$fillable` y casteadas a `decimal:2`, por eso el constructor con array funciona y la lectura devuelve una cadena.

```php
<?php

use App\Models\FactAeronave;
use App\Models\FactServicio;
use App\Support\DescuentoDeEstancia;

test('el precio del descuento es la tarifa en negativo, con cuatro decimales', function () {
    expect(DescuentoDeEstancia::precioDe('4676.00'))->toBe('-4676.0000');
});

test('una tarifa capturada en negativo no se convierte en un cobro', function () {
    // El sistema viejo escribe -abs($importe) (aplicar_descuento.php:38). Sin el valor
    // absoluto, una tarifa en negativo daria un descuento POSITIVO, o sea un cargo.
    expect(DescuentoDeEstancia::precioDe('-1144.50'))->toBe('-1144.5000');
});

test('una tarifa en cero no cambia de signo ni se vuelve un menos cero', function () {
    expect(DescuentoDeEstancia::precioDe('0.00'))->toBe('0.0000');
});

test('el nombre del renglon es el que lee el cliente en el documento', function () {
    expect(DescuentoDeEstancia::nombreDe(FactServicio::CONCEPTO_ESTANCIA_PERNOCTA))->toBe('Descuento pernocta')
        ->and(DescuentoDeEstancia::nombreDe(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H))->toBe('Descuento tránsito de 2 horas')
        ->and(DescuentoDeEstancia::nombreDe(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H))->toBe('Descuento tránsito de 12 horas');
});

test('la etiqueta de la bitacora nombra el tramo, sin la palabra descuento', function () {
    expect(DescuentoDeEstancia::etiquetaDe(FactServicio::CONCEPTO_ESTANCIA_PERNOCTA))->toBe('pernocta')
        ->and(DescuentoDeEstancia::etiquetaDe(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H))->toBe('tránsito de 2 horas')
        ->and(DescuentoDeEstancia::etiquetaDe(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H))->toBe('tránsito de 12 horas');
});

test('cada tramo tiene su propio concepto de descuento', function () {
    expect(DescuentoDeEstancia::conceptoDe(FactServicio::CONCEPTO_ESTANCIA_PERNOCTA))->toBe('descuento_estancia_pernocta')
        ->and(DescuentoDeEstancia::conceptoDe(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H))->toBe('descuento_estancia_transito_2h')
        ->and(DescuentoDeEstancia::conceptoDe(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H))->toBe('descuento_estancia_transito_12h');
});

test('los tres tramos descontables son los del sistema viejo, y los dos ajustes no', function () {
    expect(DescuentoDeEstancia::conceptosDescontables())->toBe([
        FactServicio::CONCEPTO_ESTANCIA_PERNOCTA,
        FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H,
        FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H,
    ]);
});

test('el concepto del descuento NO es un concepto de estancia', function () {
    // Si lo fuera, `CargosEstancia::quitarEstancia()` lo borraria en cada recalculo:
    // borra `whereIn('concepto', CONCEPTOS_ESTANCIA)`.
    foreach (DescuentoDeEstancia::conceptos() as $concepto) {
        expect(FactServicio::CONCEPTOS_ESTANCIA)->not->toContain($concepto);
    }
});

test('el concepto del descuento no empieza por estancia_', function () {
    // `esConceptoDeEstancia()` del front (formato.ts:290) marca como «cargo de estancia»
    // todo lo que empiece por `estancia_`. Un descuento no lo es.
    foreach (DescuentoDeEstancia::conceptos() as $concepto) {
        expect(str_starts_with($concepto, 'estancia_'))->toBeFalse();
    }
});

test('los conceptos del descuento caben en la columna, que es varchar(32)', function () {
    foreach (DescuentoDeEstancia::conceptos() as $concepto) {
        expect(strlen($concepto))->toBeLessThanOrEqual(32);
    }
});

test('la tarifa sale de la matricula, tramo por tramo', function () {
    $satelite = new FactAeronave([
        'tarifa_pernocta' => 4676.00,
        'tarifa_transito_2h' => 1144.50,
        'tarifa_transito_12h' => 2338.00,
    ]);

    expect((float) DescuentoDeEstancia::tarifaDe($satelite, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA))->toBe(4676.00)
        ->and((float) DescuentoDeEstancia::tarifaDe($satelite, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H))->toBe(1144.50)
        ->and((float) DescuentoDeEstancia::tarifaDe($satelite, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H))->toBe(2338.00);
});

test('sin tarifa devuelve null y no inventa un cero', function () {
    expect(DescuentoDeEstancia::tarifaDe(new FactAeronave(), FactServicio::CONCEPTO_ESTANCIA_PERNOCTA))->toBeNull();
});

test('un concepto que no admite descuento lanza en lugar de devolver algo', function (string $metodo, string $concepto) {
    DescuentoDeEstancia::$metodo($concepto);
})->with([
    ['conceptoDe', FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H],
    ['conceptoDe', FactServicio::CONCEPTO_COMBUSTIBLE],
    ['nombreDe', FactServicio::CONCEPTO_ESTANCIA_AJUSTE_12H_PERNOCTA],
    ['etiquetaDe', FactServicio::CONCEPTO_COMISION_AMEX],
])->throws(InvalidArgumentException::class);

test('la tarifa de un concepto que no admite descuento lanza', function () {
    DescuentoDeEstancia::tarifaDe(new FactAeronave(), FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H);
})->throws(InvalidArgumentException::class);
```

- [ ] **Step 2: Corre las pruebas y comprueba que fallan**

Run: `php artisan test tests/Unit/DescuentoDeEstanciaTest.php`
Expected: FAIL con `Class "App\Support\DescuentoDeEstancia" not found`.

- [ ] **Step 3: Añade las tres constantes a `FactServicio`**

En `app/Models/FactServicio.php`, justo después de `CONCEPTO_ESTANCIA_AJUSTE_12H_PERNOCTA` y **antes** de `CONCEPTOS_ESTANCIA`:

```php
    /**
     * El descuento de un tramo de estancia: un renglón de precio negativo que perdona
     * lo que ese tramo cobra.
     *
     * NO entran en `CONCEPTOS_ESTANCIA` a propósito: esa lista es la que
     * `CargosEstancia` borra entera en cada recálculo, y un descuento concedido no se
     * pierde porque alguien corrija una hora de llegada. Tampoco empiezan por
     * `estancia_`, que es el prefijo con el que la pantalla marca un cargo de estancia.
     */
    public const CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA = 'descuento_estancia_pernocta';

    public const CONCEPTO_DESCUENTO_ESTANCIA_TRANSITO_2H = 'descuento_estancia_transito_2h';

    public const CONCEPTO_DESCUENTO_ESTANCIA_TRANSITO_12H = 'descuento_estancia_transito_12h';
```

- [ ] **Step 4: Escribe `DescuentoDeEstancia`**

Crea `app/Support/DescuentoDeEstancia.php`:

```php
<?php

namespace App\Support;

use App\Models\FactAeronave;
use App\Models\FactServicio;
use InvalidArgumentException;

/**
 * Qué es un descuento de estancia, en un solo lugar.
 *
 * Existe porque cuatro sitios necesitan la misma respuesta y cada copia se separaría
 * de las otras: el endpoint que lo aplica, la bitácora que lo cuenta, `CargosEstancia`
 * cuando lo retira, y las pruebas que fijan los nombres que ve el cliente.
 *
 * Replica el descuento del sistema viejo (`obtener_datos_modal.php` y
 * `aplicar_descuento.php`): los tres tramos de estancia, la tarifa de la matrícula y un
 * renglón negativo de cantidad 1. Los dos AJUSTES de estancia no se descuentan, igual
 * que en el viejo.
 */
final class DescuentoDeEstancia
{
    /**
     * Cómo se llama cada tramo en una frase. De aquí sale el nombre del renglón y la
     * línea de bitácora, para que no se puedan separar.
     *
     * @var array<string, string>
     */
    private const ETIQUETAS = [
        FactServicio::CONCEPTO_ESTANCIA_PERNOCTA => 'pernocta',
        FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H => 'tránsito de 2 horas',
        FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H => 'tránsito de 12 horas',
    ];

    /** @var array<string, string> concepto de estancia => concepto del descuento */
    private const CONCEPTOS = [
        FactServicio::CONCEPTO_ESTANCIA_PERNOCTA => FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA,
        FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H => FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_TRANSITO_2H,
        FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H => FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_TRANSITO_12H,
    ];

    /**
     * Los tres conceptos DE ESTANCIA que admiten descuento, en el orden en que se
     * enseñan y en que se nombran los avisos.
     *
     * @return list<string>
     */
    public static function conceptosDescontables(): array
    {
        return array_keys(self::CONCEPTOS);
    }

    /**
     * Los tres conceptos DEL DESCUENTO.
     *
     * @return list<string>
     */
    public static function conceptos(): array
    {
        return array_values(self::CONCEPTOS);
    }

    public static function conceptoDe(string $conceptoDeEstancia): string
    {
        return self::CONCEPTOS[$conceptoDeEstancia] ?? throw self::noSeDescuenta($conceptoDeEstancia);
    }

    /** El nombre con el que el renglón sale en la prefactura y en el documento. */
    public static function nombreDe(string $conceptoDeEstancia): string
    {
        return 'Descuento '.self::etiquetaDe($conceptoDeEstancia);
    }

    public static function etiquetaDe(string $conceptoDeEstancia): string
    {
        return self::ETIQUETAS[$conceptoDeEstancia] ?? throw self::noSeDescuenta($conceptoDeEstancia);
    }

    /** La tarifa de ese tramo para esa matrícula, o `null` si no hay ninguna. */
    public static function tarifaDe(FactAeronave $satelite, string $conceptoDeEstancia): ?string
    {
        return match ($conceptoDeEstancia) {
            FactServicio::CONCEPTO_ESTANCIA_PERNOCTA => $satelite->tarifaPernocta(),
            FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H => $satelite->tarifaTransito2h(),
            FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H => $satelite->tarifaTransito12h(),
            default => throw self::noSeDescuenta($conceptoDeEstancia),
        };
    }

    /**
     * El precio del renglón: la tarifa en negativo, con los cuatro decimales de la
     * columna.
     *
     * Aritmética de cadenas y no float, como el resto del dinero de este módulo. El
     * valor absoluto es el `-abs()` del sistema viejo y no es decorativo: una tarifa
     * capturada en negativo produciría, sin él, un descuento positivo, o sea un cobro
     * que nadie pidió.
     */
    public static function precioDe(string $tarifa): string
    {
        $positiva = bccomp($tarifa, '0', 4) < 0 ? bcmul($tarifa, '-1', 4) : $tarifa;

        return bccomp($positiva, '0', 4) === 0 ? bcadd('0', '0', 4) : bcmul($positiva, '-1', 4);
    }

    private static function noSeDescuenta(string $concepto): InvalidArgumentException
    {
        return new InvalidArgumentException("El concepto '{$concepto}' no admite descuento de estancia.");
    }
}
```

- [ ] **Step 5: Corre las pruebas y comprueba que pasan**

Run: `php artisan test tests/Unit/DescuentoDeEstanciaTest.php`
Expected: PASS, todas.

- [ ] **Step 6: Comprueba que no rompiste los conceptos existentes**

Run: `php artisan test tests/Feature/Facturacion/ConceptoServicioTest.php tests/Feature/Facturacion/CargosEstanciaTest.php`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/Support/DescuentoDeEstancia.php app/Models/FactServicio.php tests/Unit/DescuentoDeEstanciaTest.php
git commit -m "feat(facturacion): el mapa del descuento de estancia en un solo sitio"
```

---

### Task 2: El endpoint que aplica el descuento

**Files:**
- Create: `app/Http/Requests/Facturacion/StoreDescuentoEstanciaRequest.php`
- Modify: `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php` (método nuevo `descuentosDeEstancia()`; el ayudante privado `ordenDelDescuento()` junto a `maximoOrden`/`bloquear`, al final de la clase)
- Modify: `routes/api.php` (dentro de `Route::middleware('subdep:factPrefacturas')->group(...)`, justo después de la ruta de `grupo`, línea 456)
- Test: `tests/Feature/Facturacion/DescuentoEstanciaTest.php`

**Interfaces:**
- Consumes: `DescuentoDeEstancia::conceptosDescontables()`, `::conceptoDe()`, `::nombreDe()`, `::etiquetaDe()`, `::tarifaDe()`, `::precioDe()` (Task 1); el trait `RechazaPrefacturaCerrada` con `rechazoRapido()` y `rechazarSiDescartada()`, ya usado por `cortesia()` y `grupo()`; `$this->bloquear(int $id): FactPrefactura`; `app(PrefacturaController::class)->fichaDe($id)`.
- Produces: `POST /api/facturacion/prefacturas/{id}/descuentos-estancia` con cuerpo `{renglon_id: int, conceptos: string[]}`, que responde `{message: string, prefactura: <ficha>}`; `PrefacturaRenglonController::descuentosDeEstancia()`.

- [ ] **Step 1: Escribe las pruebas que fallan**

Crea `tests/Feature/Facturacion/DescuentoEstanciaTest.php`. `conEstancia()` ya existe en `tests/Pest.php`: **no la declares otra vez**.

```php
<?php

// tests/Feature/Facturacion/DescuentoEstanciaTest.php

use App\Models\Bitacora;
use App\Models\FactAeronave;
use App\Models\FactPrefactura;
use App\Models\FactServicio;
use App\Services\CargosEstancia;
use App\Support\DescuentoDeEstancia;

/**
 * Un borrador con los tres cargos de estancia ya puestos y el usuario autenticado.
 * Devuelve la prefactura; el renglon de cada concepto se busca por `concepto`.
 */
function conEstanciaCobrada(): FactPrefactura
{
    test()->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = conEstancia();

    app(CargosEstancia::class)->recalcular($p, pernoctas: 1, transitos2h: 1, transitos12h: 1);

    return $p->fresh();
}

function renglonDeConcepto(FactPrefactura $p, string $concepto): App\Models\FactPrefacturaRenglon
{
    return $p->fresh()->renglones()->where('concepto', $concepto)->sole();
}

function urlDescuentos(FactPrefactura $p): string
{
    return "/api/facturacion/prefacturas/{$p->id}/descuentos-estancia";
}

test('el descuento de un tramo entra como renglon negativo de cantidad 1', function () {
    $p = conEstanciaCobrada();
    $pernocta = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => $pernocta->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    $descuento = renglonDeConcepto($p, FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA);

    expect($descuento->nombre_servicio)->toBe('Descuento pernocta')
        ->and((float) $descuento->precio_unitario)->toBe(-4676.00)
        ->and($descuento->cantidad)->toBe(1)
        ->and($descuento->importe())->toBe('-4676.00')
        ->and($descuento->es_cortesia)->toBeFalse()
        ->and((float) $descuento->margen)->toBe(0.0)
        ->and($descuento->ajuste_precio)->toBe(FactServicio::AJUSTE_NINGUNO)
        ->and($descuento->es_de_tercero)->toBeFalse()
        ->and($descuento->servicio_id)->toBe($pernocta->servicio_id);
});

test('el total baja exactamente la tarifa del tramo descontado', function () {
    $p = conEstanciaCobrada();
    $antes = $p->subtotal();
    expect($antes)->toBe('8158.50');

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H],
    ])->assertOk()->assertJsonPath('prefactura.subtotal', '5820.50');

    expect($p->fresh()->subtotal())->toBe('5820.50');
});

test('los tres tramos se descuentan en una sola llamada', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => DescuentoDeEstancia::conceptosDescontables(),
    ])->assertOk();

    expect($p->fresh()->renglones()->whereIn('concepto', DescuentoDeEstancia::conceptos())->count())->toBe(3)
        ->and($p->fresh()->subtotal())->toBe('0.00');
});

test('el descuento hereda el grupo del renglon desde el que se pidio', function () {
    $p = conEstanciaCobrada();
    $pernocta = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);
    $pernocta->update(['grupo' => 'Estancia']);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => $pernocta->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    expect(renglonDeConcepto($p, FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA)->grupo)->toBe('Estancia');
});

test('sin grupo en el renglon de origen el descuento sale suelto', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    expect(renglonDeConcepto($p, FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA)->grupo)->toBeNull();
});

test('el descuento sale justo despues del cargo que descuenta', function () {
    $p = conEstanciaCobrada();
    $transito2h = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => $transito2h->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H],
    ])->assertOk();

    expect(renglonDeConcepto($p, FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_TRANSITO_2H)->orden)
        ->toBe($transito2h->orden + 1);
});

test('el mismo tramo se puede descontar dos veces y el total baja el doble', function () {
    // Es la decision 2 de la spec, tomada con su costo escrito: sin tope y repetible.
    // Esta prueba la fija para que nadie «la arregle» sin leer la spec.
    $p = conEstanciaCobrada();
    $pernocta = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);

    foreach ([1, 2] as $vez) {
        $this->postJson(urlDescuentos($p), [
            'renglon_id' => $pernocta->id,
            'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
        ])->assertOk();
    }

    expect($p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA)->count())->toBe(2)
        ->and($p->fresh()->subtotal())->toBe('-1193.50');
});

test('la bitacora dice que tramo se descuento y por cuanto', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    // La frase COMPLETA: una frase de dinero que se puede invertir sin romper su prueba
    // es una frase que miente en verde.
    expect(Bitacora::query()->latest('id')->first()->descripcion)
        ->toBe("Se aplicó un descuento de pernocta por 4,676.00 a la prefactura {$p->id}.");
});

test('se escribe una linea de bitacora por cada tramo descontado', function () {
    $p = conEstanciaCobrada();
    $antes = Bitacora::query()->count();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H],
    ])->assertOk();

    expect(Bitacora::query()->count() - $antes)->toBe(2);
});

test('quitar el renglon del descuento devuelve el total a su sitio', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    $descuento = renglonDeConcepto($p, FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA);

    $this->deleteJson("/api/facturacion/prefacturas/{$p->id}/renglones/{$descuento->id}")->assertOk();

    expect($p->fresh()->subtotal())->toBe('8158.50');
});

test('la ficha que responde el endpoint ya trae el renglon del descuento', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk()
        ->assertJsonPath('prefactura.renglones.3.concepto', FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA);
});
```

- [ ] **Step 2: Corre las pruebas y comprueba que fallan**

Run: `php artisan test tests/Feature/Facturacion/DescuentoEstanciaTest.php`
Expected: FAIL con 404 en todas las llamadas (la ruta no existe todavía).

- [ ] **Step 3: Escribe el Form Request**

Crea `app/Http/Requests/Facturacion/StoreDescuentoEstanciaRequest.php`:

```php
<?php

namespace App\Http\Requests\Facturacion;

use App\Models\FactPrefactura;
use App\Support\DescuentoDeEstancia;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * La forma de un descuento de estancia: de qué renglón sale y qué tramos se perdonan.
 *
 * `renglon_id` no es decoración: de él hereda el descuento su `grupo`, que es la
 * decisión 4 de la spec y lo que hacía el sistema viejo (`aplicar_descuento.php` copia
 * el `agrupar` del renglón de origen). Tiene que ser un renglón DE ESTA prefactura:
 * sin esa comprobación, el grupo de un documento ajeno entraría en este.
 */
class StoreDescuentoEstanciaRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'renglon_id' => ['bail', 'required', 'integer', $this->deEstaPrefacturaYDeEstancia(...)],
            'conceptos' => ['required', 'array', 'min:1'],
            'conceptos.*' => ['distinct', Rule::in(DescuentoDeEstancia::conceptosDescontables())],
        ];
    }

    /**
     * El renglón de origen tiene que ser de esta prefactura y cobrar uno de los tres
     * tramos descontables. Los dos ajustes de estancia no abren el modal, así que
     * tampoco lo abren por endpoint.
     */
    private function deEstaPrefacturaYDeEstancia(string $atributo, mixed $valor, \Closure $fallar): void
    {
        $prefactura = FactPrefactura::find($this->route('id'));

        // Sin prefactura el controlador ya devuelve 404; no se inventa una comprobación.
        if ($prefactura === null) {
            return;
        }

        $renglon = $prefactura->renglones()->whereKey($valor)->first();

        if ($renglon === null) {
            $fallar('Ese renglón no es de esta prefactura.');

            return;
        }

        if (! in_array($renglon->concepto, DescuentoDeEstancia::conceptosDescontables(), true)) {
            $fallar('El descuento se aplica desde un renglón de tránsito o de pernocta.');
        }
    }

    public function messages(): array
    {
        return [
            'renglon_id.required' => 'Indica desde qué renglón se aplica el descuento.',
            'renglon_id.integer' => 'El renglón no es válido.',
            'conceptos.required' => 'Elige al menos un tramo que descontar.',
            'conceptos.array' => 'Los tramos a descontar van en una lista.',
            'conceptos.min' => 'Elige al menos un tramo que descontar.',
            'conceptos.*.in' => 'Solo se descuentan la pernocta y los tránsitos de 2 y de 12 horas.',
            'conceptos.*.distinct' => 'Ese tramo viene repetido en la lista.',
        ];
    }
}
```

- [ ] **Step 4: Escribe el método del controlador**

En `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php`, después de `grupo()`. Añade los `use` que falten al principio del fichero (`App\Http\Requests\Facturacion\StoreDescuentoEstanciaRequest`, `App\Support\DescuentoDeEstancia`; `FactAeronave`, `FactServicio`, `Bitacora` y `DB` ya están importados).

```php
    /**
     * Aplica un descuento a uno o varios tramos de estancia: un renglón negativo por
     * tramo, con la tarifa de la matrícula.
     *
     * Réplica del descuento del sistema viejo, decisión por decisión (spec
     * 2026-10-28): la cifra sale de la TARIFA y no de lo que la prefactura cobra, es
     * una unidad, **no tiene tope y se puede repetir**. Eso permite descontar un tramo
     * que no se cobró y dejar el documento en negativo; se eligió así con el costo
     * escrito, y el rastro es la bitácora, que no es un freno.
     *
     * El `grupo` lo hereda del renglón de origen, como el viejo.
     */
    public function descuentosDeEstancia(StoreDescuentoEstanciaRequest $request, int $id): JsonResponse
    {
        $datos = $request->validated();

        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazoRapido($prefactura)) {
            return $respuesta;
        }

        $resultado = DB::transaction(function () use ($request, $datos, $id) {
            $actual = $this->bloquear($id);

            if ($respuesta = $this->rechazarSiDescartada($actual)) {
                return $respuesta;
            }

            $origen = $actual->renglones()->whereKey($datos['renglon_id'])->firstOrFail();

            // La ficha se lee aquí, ya con candado, y no de la relación cacheada: es la
            // misma razón por la que `CargosEstancia::recalcular()` la relee.
            $satelite = FactAeronave::query()->where('aeronave_id', $actual->aeronave_id)->first();

            foreach ($datos['conceptos'] as $concepto) {
                $tarifa = $satelite === null ? null : DescuentoDeEstancia::tarifaDe($satelite, $concepto);
                $servicio = FactServicio::porConcepto($concepto)->activos()->first();
                $etiqueta = DescuentoDeEstancia::etiquetaDe($concepto);

                $renglon = $actual->renglones()->create([
                    'servicio_id' => $servicio->id,
                    'nombre_servicio' => DescuentoDeEstancia::nombreDe($concepto),
                    'precio_unitario' => DescuentoDeEstancia::precioDe($tarifa),
                    'cantidad' => 1,
                    'es_de_tercero' => false,
                    'margen' => 0,
                    'ajuste_precio' => FactServicio::AJUSTE_NINGUNO,
                    'concepto' => DescuentoDeEstancia::conceptoDe($concepto),
                    'grupo' => $origen->grupo,
                    'orden' => $this->ordenDelDescuento($actual, $concepto),
                ]);

                Bitacora::log(
                    modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                    accion: Bitacora::ACCION_CREAR,
                    descripcion: "Se aplicó un descuento de {$etiqueta} por ".number_format((float) $tarifa, 2).' a la prefactura '.$actual->id.'.',
                    usuarioId: $request->user()->id,
                    registroId: $actual->id,
                    datosNuevos: [
                        'renglon_id' => $renglon->id,
                        'concepto' => $renglon->concepto,
                        'precio_unitario' => $renglon->precio_unitario,
                        'importe' => $renglon->importe(),
                    ],
                );
            }

            return $actual;
        });

        if ($resultado instanceof JsonResponse) {
            return $resultado;
        }

        return response()->json([
            'message' => count($datos['conceptos']) === 1 ? 'Descuento aplicado.' : 'Descuentos aplicados.',
            'prefactura' => app(PrefacturaController::class)->fichaDe($resultado->id),
        ]);
    }
```

**Ojo con la tarifa ausente:** `DescuentoDeEstancia::precioDe()` recibe `string` y aquí `$tarifa` es `?string`. En esta tarea no pasa nunca `null` porque `conEstancia()` siempre trae las tres tarifas; el rechazo que lo cierra de verdad lo escribe la **Task 3**. No lo adelantes aquí.

Y el ayudante privado, junto a `maximoOrden()` si existe en esta clase o al final de los privados:

```php
    /**
     * El `orden` del descuento: justo después del cargo que descuenta.
     *
     * Cuando ese cargo no existe —la decisión 2 permite descontar un tramo que no se
     * cobra— va al final. `reorder()` es obligatorio: la relación `renglones()` tiene
     * orden por defecto y sin él el `max()` saldría con un ORDER BY que MySQL rechaza
     * en algunos modos; es lo que ya hace `CargosEstancia::maximoOrden()`.
     */
    private function ordenDelDescuento(FactPrefactura $prefactura, string $concepto): int
    {
        $delCargo = $prefactura->renglones()->where('concepto', $concepto)->reorder()->max('orden');

        if ($delCargo !== null) {
            return (int) $delCargo + 1;
        }

        return (int) $prefactura->renglones()->reorder()->max('orden') + 1;
    }
```

- [ ] **Step 5: Añade la ruta**

En `routes/api.php`, dentro de `Route::middleware('subdep:factPrefacturas')->group(...)`, inmediatamente después de la ruta de `grupo`:

```php
        Route::post('/prefacturas/{id}/descuentos-estancia', [PrefacturaRenglonController::class, 'descuentosDeEstancia'])->whereNumber('id');
```

- [ ] **Step 6: Corre las pruebas y comprueba que pasan**

Run: `php artisan test tests/Feature/Facturacion/DescuentoEstanciaTest.php`
Expected: PASS, todas.

Si `prefactura.renglones.3.concepto` falla, lee la ficha que devuelve `fichaDe()` y ajusta el índice al orden real; el renglón del descuento va después de los tres cargos de estancia.

- [ ] **Step 7: Comprueba que no rompiste las demás acciones de renglón**

Run: `php artisan test tests/Feature/Facturacion/CortesiaTest.php tests/Feature/Facturacion/AgruparRenglonesTest.php tests/Feature/Facturacion/EndpointsPrefacturaTest.php`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/Http/Requests/Facturacion/StoreDescuentoEstanciaRequest.php app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php routes/api.php tests/Feature/Facturacion/DescuentoEstanciaTest.php
git commit -m "feat(facturacion): el descuento de estancia entra como renglon negativo"
```

---

### Task 3: Lo que el servidor se niega a descontar

**Files:**
- Modify: `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php` (dentro de `descuentosDeEstancia()`, el rechazo antes de crear el renglón)
- Test: `tests/Feature/Facturacion/DescuentoEstanciaTest.php` (añadir al final)

**Interfaces:**
- Consumes: `descuentosDeEstancia()` de la Task 2 y su bucle sobre `$datos['conceptos']`.
- Produces: respuesta 422 con `{message, codigo: 'sin_tarifa_de_estancia'}` cuando falta la tarifa o la ficha, y con `{message, codigo: 'servicio_de_estancia_no_disponible'}` cuando el servicio del catálogo está de baja. En los dos casos **no se escribe nada**.

**Nota para quien implementa:** el caso del servicio de catálogo dado de baja **no está en la spec**. Lo añade este plan porque `FactServicio::porConcepto($concepto)->activos()->first()` puede devolver `null` y la Task 2 escribe `$servicio->id` sin comprobarlo: sería un 500 en un endpoint de dinero. `CargosEstancia` lanza ahí su propia excepción; aquí se devuelve 422 porque el operador puede entenderlo y corregirlo.

- [ ] **Step 1: Escribe las pruebas que fallan**

Añade a `tests/Feature/Facturacion/DescuentoEstanciaTest.php`:

```php
test('sin tarifa para ese tramo se rechaza nombrando el tramo, y no se escribe nada', function () {
    $p = conEstanciaCobrada();
    $pernocta = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);
    $renglonesAntes = $p->fresh()->renglones()->count();

    FactAeronave::query()->where('aeronave_id', $p->aeronave_id)->update(['tarifa_pernocta' => null]);

    $respuesta = $this->postJson(urlDescuentos($p), [
        'renglon_id' => $pernocta->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertUnprocessable()->assertJsonPath('codigo', 'sin_tarifa_de_estancia');

    expect($respuesta->json('message'))->toContain('pernocta')
        ->and($p->fresh()->renglones()->count())->toBe($renglonesAntes);
});

test('un tramo sin tarifa no deja pasar los otros de la misma llamada', function () {
    // La transaccion es una: o entran los dos descuentos o no entra ninguno. Si entrara
    // el primero, el operador veria un documento a medias y creeria que fallo todo.
    $p = conEstanciaCobrada();
    FactAeronave::query()->where('aeronave_id', $p->aeronave_id)->update(['tarifa_transito_2h' => null]);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H],
    ])->assertUnprocessable();

    expect($p->fresh()->renglones()->whereIn('concepto', DescuentoDeEstancia::conceptos())->count())->toBe(0);
});

test('sin ficha de facturacion no hay tarifa que descontar', function () {
    $p = conEstanciaCobrada();
    $pernocta = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);

    FactAeronave::query()->where('aeronave_id', $p->aeronave_id)->delete();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => $pernocta->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertUnprocessable()->assertJsonPath('codigo', 'sin_tarifa_de_estancia');
});

test('un servicio de estancia dado de baja se rechaza en lugar de reventar', function () {
    $p = conEstanciaCobrada();
    $pernocta = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);

    FactServicio::query()->where('concepto', FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->update(['status' => 'I']);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => $pernocta->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertUnprocessable()->assertJsonPath('codigo', 'servicio_de_estancia_no_disponible');

    expect($p->fresh()->renglones()->whereIn('concepto', DescuentoDeEstancia::conceptos())->count())->toBe(0);
});

test('el renglon de origen tiene que ser de esta prefactura', function () {
    $p = conEstanciaCobrada();
    $otra = conEstancia();
    app(CargosEstancia::class)->recalcular($otra, pernoctas: 1, transitos2h: 0, transitos12h: 0);
    $ajeno = renglonDeConcepto($otra, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => $ajeno->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertUnprocessable()->assertJsonValidationErrors('renglon_id');

    expect($p->fresh()->renglones()->whereIn('concepto', DescuentoDeEstancia::conceptos())->count())->toBe(0);
});

test('el renglon de origen no puede ser un servicio cualquiera', function () {
    $p = conEstanciaCobrada();
    $suelto = renglonDe($p, 500.0, 1);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => $suelto->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertUnprocessable()->assertJsonValidationErrors('renglon_id');
});

test('un renglon de origen que no existe se rechaza', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => 999999,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertUnprocessable()->assertJsonValidationErrors('renglon_id');
});

test('la lista de tramos no puede venir vacia ni con basura ni repetida', function (array $cuerpo, string $campo) {
    $p = conEstanciaCobrada();
    $pernocta = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);

    $this->postJson(urlDescuentos($p), ['renglon_id' => $pernocta->id] + $cuerpo)
        ->assertUnprocessable()
        ->assertJsonValidationErrors($campo);
})->with([
    'vacia' => [['conceptos' => []], 'conceptos'],
    'ausente' => [[], 'conceptos'],
    'no es lista' => [['conceptos' => 'estancia_pernocta'], 'conceptos'],
    'inventado' => [['conceptos' => ['estancia_lo_que_sea']], 'conceptos.0'],
    'un ajuste de estancia' => [['conceptos' => ['estancia_ajuste_2h_12h']], 'conceptos.0'],
    'repetido' => [['conceptos' => ['estancia_pernocta', 'estancia_pernocta']], 'conceptos.0'],
]);

test('una prefactura cerrada no acepta descuentos', function () {
    $p = conEstanciaCobrada();
    $pernocta = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);

    $p->update(['estado' => FactPrefactura::ESTADO_CERRADA]);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => $pernocta->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertConflict()->assertJsonPath('codigo', 'ya_cerrada');
});

test('un borrador descartado no acepta descuentos', function () {
    $p = conEstanciaCobrada();
    $pernocta = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);

    $p->update(['status' => FactPrefactura::STATUS_INACTIVO]);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => $pernocta->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertConflict()->assertJsonPath('codigo', 'ya_descartada');
});

test('una prefactura REABIERTA si acepta descuentos: se reabre justo para corregir', function () {
    // `rechazoRapido()` rechaza cerrada y descartada, no reabierta (ESTADO_REABIERTA es su
    // propio estado, no el status 'N'). Es el mismo trato que le dan las demas acciones de
    // renglon, y esta prueba lo fija para que nadie lo cierre por simetria.
    $p = conEstanciaCobrada();
    $pernocta = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);

    $p->update(['estado' => FactPrefactura::ESTADO_REABIERTA]);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => $pernocta->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    expect($p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA)->count())->toBe(1);
});

test('una prefactura que no existe da 404', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson('/api/facturacion/prefacturas/999999/descuentos-estancia', [
        'renglon_id' => 1,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertNotFound();
});
```

- [ ] **Step 2: Corre las pruebas y comprueba que fallan**

Run: `php artisan test tests/Feature/Facturacion/DescuentoEstanciaTest.php`
Expected: FAIL. Las de tarifa ausente fallan con un error de `bccomp` o un 500 (se le pasa `null` a `precioDe()`); la del servicio de baja, con «Attempt to read property "id" on null». Las de validación y las de las guardas deberían PASAR ya, porque el Request y el trait de la Task 2 las cubren: compruébalo y si alguna falla, es un defecto de la Task 2.

- [ ] **Step 3: Añade los dos rechazos en el controlador**

Dentro del `foreach` de `descuentosDeEstancia()`, **antes** del `create()`:

```php
                $tarifa = $satelite === null ? null : DescuentoDeEstancia::tarifaDe($satelite, $concepto);
                $etiqueta = DescuentoDeEstancia::etiquetaDe($concepto);

                // Sin tarifa no hay cifra que descontar, y teclearla a mano no es lo que se
                // eligió (decisión 2 de la spec).
                //
                // CORRECCIÓN DEL PLAN (ruling del coordinador, 2026-10-29): la versión
                // anterior de este plan decía que el `return` dentro de `DB::transaction()`
                // revierte lo escrito. ES FALSO: `DB::transaction()` confirma salvo que se
                // lance. Con el rechazo dentro del bucle, pedir dos tramos y fallar el
                // segundo dejaba el primer descuento GUARDADO. Por eso la comprobación de
                // tarifa y de servicio activo se hace en una PRIMERA PASADA sobre todos los
                // tramos, sin escribir nada, y solo después se crean los renglones.
                if ($tarifa === null) {
                    return response()->json([
                        'message' => "Esta matrícula no tiene tarifa de {$etiqueta}, así que no hay nada que descontar. Captúrala en la ficha de facturación de la aeronave (o en su categoría) y vuelve a intentarlo.",
                        'codigo' => 'sin_tarifa_de_estancia',
                    ], 422);
                }

                $servicio = FactServicio::porConcepto($concepto)->activos()->first();

                if ($servicio === null) {
                    return response()->json([
                        'message' => "El servicio de {$etiqueta} está dado de baja en el catálogo, así que no se puede armar su descuento. Reactívalo y vuelve a intentarlo.",
                        'codigo' => 'servicio_de_estancia_no_disponible',
                    ], 422);
                }
```

Y borra del cuerpo las tres líneas que la Task 2 tenía al principio del `foreach` (`$tarifa = ...`, `$servicio = ...`, `$etiqueta = ...`), que ahora están aquí arriba.

- [ ] **Step 4: Corre las pruebas y comprueba que pasan**

Run: `php artisan test tests/Feature/Facturacion/DescuentoEstanciaTest.php`
Expected: PASS, todas.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php tests/Feature/Facturacion/DescuentoEstanciaTest.php
git commit -m "fix(facturacion): sin tarifa y sin servicio activo el descuento se rechaza, no revienta"
```

---

### Task 4: El documento, los totales y cerrar con total negativo

**Files:**
- Test: `tests/Feature/Facturacion/DescuentoEstanciaTest.php` (añadir al final)
- Modify (solo si una prueba lo exige): `app/Services/DocumentoDePrefactura.php`, `app/Services/CierrePrefactura.php`

**Interfaces:**
- Consumes: el endpoint de las Tasks 2 y 3; `DocumentoDePrefactura::filas(FactPrefactura): array` (devuelve filas con `concepto`, `cortesia`, `remision`, `precio`, `cantidad`, `importe`); `FactPrefactura::subtotal()`, `iva()`, `total()`.
- Produces: nada de producción si todo se comporta. Si el cierre con total negativo falla, esta tarea lo arregla y el arreglo viaja con su prueba.

**Nota para quien implementa:** esta tarea es de fijación. La spec dice que **cerrar con total negativo no tiene precedente**: ninguna de las 10 líneas negativas del sistema viejo dejó un documento negativo. Si la prueba del cierre revela un fallo, **no lo tapes cambiando la prueba**: arregla el cierre o, si el arreglo es grande, deja la prueba marcada y dilo en el informe con el error exacto.

- [ ] **Step 1: Escribe las pruebas**

```php
test('el documento saca el descuento como una linea propia con su nombre', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H],
    ])->assertOk();

    $filas = app(App\Services\DocumentoDePrefactura::class)->filas($p->fresh()->load('renglones'));
    $linea = collect($filas)->firstWhere('concepto', 'Descuento tránsito de 12 horas');

    expect($linea)->not->toBeNull()
        ->and($linea['importe'])->toBe('-2338.00')
        ->and($linea['cortesia'])->toBeFalse()
        ->and($linea['cantidad'])->toBe(1);
});

test('dentro de un grupo el descuento se suma al importe del grupo y no sale como linea', function () {
    // Es el riesgo aceptado de la spec: el cliente deja de ver que se le perdono algo.
    // Se fija con una prueba para que el dia que moleste se sepa donde cambiarlo.
    $p = conEstanciaCobrada();
    $pernocta = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);
    $pernocta->update(['grupo' => 'Estancia']);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => $pernocta->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    $filas = app(App\Services\DocumentoDePrefactura::class)->filas($p->fresh()->load('renglones'));

    expect(collect($filas)->firstWhere('concepto', 'Descuento pernocta'))->toBeNull()
        ->and(collect($filas)->firstWhere('concepto', 'Estancia')['importe'])->toBe('0.00');
});

test('el iva y el total bajan con el descuento, derivados', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H],
    ])->assertOk();

    $p = $p->fresh();

    // 8158.50 - 1144.50 = 7014.00; el IVA sale de la tasa configurada y no se teclea aquí.
    expect($p->subtotal())->toBe('7014.00')
        ->and(bcadd($p->subtotal(), $p->iva(), 2))->toBe($p->total());
});

test('una prefactura cuyo total queda negativo: esto es lo que hace el cierre hoy', function () {
    // Sin precedente en el sistema viejo. La prueba existe para que el comportamiento
    // salga aqui y no en produccion.
    $p = conEstanciaCobrada();
    $pernocta = renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA);

    foreach ([1, 2, 3, 4] as $vez) {
        $this->postJson(urlDescuentos($p), [
            'renglon_id' => $pernocta->id,
            'conceptos' => DescuentoDeEstancia::conceptosDescontables(),
        ])->assertOk();
    }

    expect(bccomp($p->fresh()->subtotal(), '0.00', 2))->toBe(-1);

    $respuesta = $this->patchJson("/api/facturacion/prefacturas/{$p->id}/cerrar", ['confirmar_sin_cobro' => true]);

    // AQUI NO DEJES UN RANGO. Corre la prueba, mira que hace el cierre de verdad, y fija
    // ESE comportamiento con una asercion exacta, eligiendo una de las dos ramas de abajo
    // y borrando la otra. Una prueba que acepta tres codigos de respuesta no guarda nada.
    //
    // Rama A, si el cierre ACEPTA el total negativo:
    //   $respuesta->assertOk();
    //   expect($p->fresh()->estado)->toBe(FactPrefactura::ESTADO_CERRADA)
    //       ->and(bccomp((string) $p->fresh()->total_sellado, '0.00', 2))->toBe(-1)
    //       ->and($p->fresh()->folio)->not->toBeNull();
    //
    // Rama B, si el cierre lo RECHAZA: asierta el codigo HTTP exacto y el `codigo` del
    // cuerpo que devolvio, y que no consumio folio:
    //   $respuesta->assertUnprocessable()->assertJsonPath('codigo', '<el que salga>');
    //   expect($p->fresh()->estado)->toBe(FactPrefactura::ESTADO_BORRADOR)
    //       ->and($p->fresh()->folio)->toBeNull();
    //
    // Y di en el informe cual de las dos rige, con el status y el message literales.
});
```

- [ ] **Step 2: Corre las pruebas y mira qué dicen**

Run: `php artisan test tests/Feature/Facturacion/DescuentoEstanciaTest.php`
Expected: las tres primeras PASS sin tocar producción. La del cierre dirá cuál de las dos ramas ocurre: apunta el `status` y el `message` exactos en el informe.

La columna sellada se llama `total_sellado` (comprobado en `fact_prefacturas`, junto a `subtotal_sellado` e `iva_sellado`). Si el cierre exige más campos en el cuerpo, léelos en `PrefacturaController::cerrar()` y pásalos.

- [ ] **Step 3: Si el cierre revela un fallo, arréglalo**

Solo si la rama de error no es un rechazo limpio (es decir: 500, folio consumido sin cerrar, o sello que no cuadra con la derivación). El arreglo mínimo es que el cierre rechace con su `codigo` y su mensaje, sin consumir folio. Si el cierre acepta y sella bien, **no cambies nada**.

- [ ] **Step 4: Corre las pruebas del cierre y del documento**

Run: `php artisan test tests/Feature/Facturacion/CierrePrefacturaTest.php tests/Feature/Facturacion/CierreSinCobroTest.php tests/Feature/Facturacion/DocumentoPrefacturaTest.php tests/Feature/Facturacion/ImpresionPrefacturaTest.php tests/Feature/Facturacion/DescuentoEstanciaTest.php`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/Feature/Facturacion/DescuentoEstanciaTest.php
git commit -m "test(facturacion): el descuento en el documento, en los totales y al cerrar"
```

---

### Task 5: `GET tarifas-estancia`, para que el modal sepa qué ofrecer

**Files:**
- Modify: `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php` (método `tarifasDeEstancia()`)
- Modify: `routes/api.php` (en el área de lectura, justo después de `/prefacturas/{id}/estancia-sugerida`, línea 382)
- Test: `tests/Feature/Facturacion/DescuentoEstanciaTest.php` (añadir al final)

**Interfaces:**
- Consumes: `DescuentoDeEstancia::conceptosDescontables()`, `::tarifaDe()`, `::etiquetaDe()`.
- Produces: `GET /api/facturacion/prefacturas/{id}/tarifas-estancia` → `{"tarifas": {"estancia_pernocta": "4676.00"|null, "estancia_transito_2h": ..., "estancia_transito_12h": ...}}`.

**Nota:** las claves son los **conceptos completos** y no `pernocta`/`transito_2h`/`transito_12h` como los nombra la spec. Es el mismo dato: así la pantalla manda en el POST exactamente la clave que leyó, sin traducir, y una clave mal escrita se cae en la validación en lugar de descontar otro tramo.

- [ ] **Step 1: Escribe las pruebas que fallan**

```php
test('las tarifas de estancia se sirven por concepto, listas para el modal', function () {
    $p = conEstanciaCobrada();

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/tarifas-estancia")
        ->assertOk()
        ->assertJsonPath('tarifas.estancia_pernocta', '4676.00')
        ->assertJsonPath('tarifas.estancia_transito_2h', '1144.50')
        ->assertJsonPath('tarifas.estancia_transito_12h', '2338.00');
});

test('una tarifa que no existe viaja como null y no como cero', function () {
    $p = conEstanciaCobrada();
    FactAeronave::query()->where('aeronave_id', $p->aeronave_id)->update(['tarifa_pernocta' => null]);

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/tarifas-estancia")
        ->assertOk()
        ->assertJsonPath('tarifas.estancia_pernocta', null)
        ->assertJsonPath('tarifas.estancia_transito_2h', '1144.50');
});

test('sin ficha de facturacion las tres tarifas son null', function () {
    $p = conEstanciaCobrada();
    FactAeronave::query()->where('aeronave_id', $p->aeronave_id)->delete();

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/tarifas-estancia")
        ->assertOk()
        ->assertJsonPath('tarifas.estancia_pernocta', null)
        ->assertJsonPath('tarifas.estancia_transito_2h', null)
        ->assertJsonPath('tarifas.estancia_transito_12h', null);
});

test('la tarifa heredada de la categoria tambien se sirve', function () {
    $p = conEstanciaCobrada();
    $categoria = App\Models\FactCategoriaAeronave::create(['nombre' => 'Categoria '.uniqid(), 'tarifa_pernocta' => 7000.00]);
    FactAeronave::query()->where('aeronave_id', $p->aeronave_id)
        ->update(['tarifa_pernocta' => null, 'categoria_aeronave_id' => $categoria->id]);

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/tarifas-estancia")
        ->assertOk()
        ->assertJsonPath('tarifas.estancia_pernocta', '7000.00');
});

test('consultar las tarifas no escribe nada', function () {
    $p = conEstanciaCobrada();
    $renglones = $p->fresh()->renglones()->count();
    $bitacora = Bitacora::query()->count();

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/tarifas-estancia")->assertOk();

    expect($p->fresh()->renglones()->count())->toBe($renglones)
        ->and(Bitacora::query()->count())->toBe($bitacora);
});

test('las tarifas de una prefactura que no existe dan 404', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->getJson('/api/facturacion/prefacturas/999999/tarifas-estancia')->assertNotFound();
});
```

`FactCategoriaAeronave` acepta `nombre`, `tarifa_pernocta`, `tarifa_transito_2h`, `tarifa_transito_12h` y `status` (comprobado en el modelo): con `nombre` y la tarifa basta.

- [ ] **Step 2: Corre las pruebas y comprueba que fallan**

Run: `php artisan test tests/Feature/Facturacion/DescuentoEstanciaTest.php`
Expected: FAIL con 404 en las nuevas.

- [ ] **Step 3: Escribe el método**

En `PrefacturaRenglonController`, junto a los demás métodos de lectura (`remisiones()`, `comisariatos()`):

```php
    /**
     * Las tarifas de estancia de esta matrícula, por concepto, para el modal del
     * descuento.
     *
     * Es de SOLO LECTURA y **no es la autoridad de la cifra**: al aplicar el descuento,
     * el endpoint vuelve a leer la tarifa con candado y es esa la que se congela en el
     * renglón. Esto solo evita que la pantalla ofrezca un tramo que acabaría en 422.
     *
     * Existe porque `show()` carga la aeronave con `id, matricula` y nada más. Sigue el
     * precedente de `PrefacturaController::estanciaSugerida()`.
     *
     * Las claves son los conceptos de estancia tal cual: la pantalla devuelve en el POST
     * la misma clave que leyó, sin traducirla.
     */
    public function tarifasDeEstancia(int $id): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);
        $satelite = FactAeronave::query()->where('aeronave_id', $prefactura->aeronave_id)->first();

        $tarifas = [];

        foreach (DescuentoDeEstancia::conceptosDescontables() as $concepto) {
            $tarifas[$concepto] = $satelite === null ? null : DescuentoDeEstancia::tarifaDe($satelite, $concepto);
        }

        return response()->json(['tarifas' => $tarifas]);
    }
```

- [ ] **Step 4: Añade la ruta**

En `routes/api.php`, inmediatamente después de la línea de `estancia-sugerida` y **antes** de la de `/prefacturas/{id}`:

```php
    Route::get('/prefacturas/{id}/tarifas-estancia', [PrefacturaRenglonController::class, 'tarifasDeEstancia'])->whereNumber('id');
```

- [ ] **Step 5: Corre las pruebas y comprueba que pasan**

Run: `php artisan test tests/Feature/Facturacion/DescuentoEstanciaTest.php`
Expected: PASS, todas.

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php routes/api.php tests/Feature/Facturacion/DescuentoEstanciaTest.php
git commit -m "feat(facturacion): las tarifas de estancia, de solo lectura, para el modal del descuento"
```

---

### Task 6: El descuento sobrevive al recálculo, y se retira nombrado

**Files:**
- Modify: `app/Services/CargosEstancia.php` (el método `recalcular()`: sus dos salidas tempranas y el final; dos privados nuevos junto a `quitarEstancia()` y `avisoDePerdidas()`)
- Test: `tests/Feature/Facturacion/DescuentoEstanciaTest.php` (añadir al final)

**Interfaces:**
- Consumes: `DescuentoDeEstancia::conceptosDescontables()`, `::conceptoDe()`, `::etiquetaDe()`; `CargosEstancia::recalcular(FactPrefactura $p, int $pernoctas, int $transitos2h, int $transitos12h, int $ajustes2a12 = 0, int $ajustes12aPernocta = 0): array{renglones: int, motivo: ?string}`.
- Produces: `CargosEstancia` retira los descuentos sin cargo y los nombra en `motivo`.

- [ ] **Step 1: Escribe las pruebas que fallan**

```php
test('el descuento sigue ahi despues de recalcular, si su tramo se sigue cobrando', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    $resultado = app(CargosEstancia::class)->recalcular($p->fresh(), pernoctas: 3, transitos2h: 1, transitos12h: 1);

    $descuento = renglonDeConcepto($p, FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA);

    expect((float) $descuento->precio_unitario)->toBe(-4676.00)
        ->and($descuento->cantidad)->toBe(1)
        // `motivo` es null cuando no hay nada que avisar, y `toContain` sobre null revienta:
        // la comprobacion es «no lo menciona», que es verdad tambien cuando no hay motivo.
        ->and($resultado['motivo'] === null || ! str_contains($resultado['motivo'], 'descuento'))->toBeTrue();
});

test('si el tramo descontado deja de cobrarse, el descuento se retira y el aviso lo nombra', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    $resultado = app(CargosEstancia::class)->recalcular($p->fresh(), pernoctas: 0, transitos2h: 1, transitos12h: 1);

    expect($p->fresh()->renglones()->where('concepto', FactServicio::CONCEPTO_DESCUENTO_ESTANCIA_PERNOCTA)->count())->toBe(0)
        ->and($resultado['motivo'])->toBe('Se retiró 1 descuento de estancia cuyo concepto ya no se cobra: pernocta. Si vuelve a cobrarse, el descuento se aplica otra vez a mano.');
});

test('dos descuentos retirados se cuentan y se nombran los dos', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H],
    ])->assertOk();

    $resultado = app(CargosEstancia::class)->recalcular($p->fresh(), pernoctas: 0, transitos2h: 1, transitos12h: 0);

    expect($p->fresh()->renglones()->whereIn('concepto', DescuentoDeEstancia::conceptos())->count())->toBe(0)
        ->and($resultado['motivo'])->toContain('Se retiraron 2 descuentos de estancia cuyos conceptos ya no se cobran: pernocta, tránsito de 12 horas.');
});

test('el aviso del descuento retirado convive con el de la cortesia perdida', function () {
    $p = conEstanciaCobrada();
    renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H)->update(['es_cortesia' => true]);

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    $resultado = app(CargosEstancia::class)->recalcular($p->fresh(), pernoctas: 0, transitos2h: 0, transitos12h: 1);

    expect($resultado['motivo'])->toContain('Se perdió la cortesía')
        ->and($resultado['motivo'])->toContain('Se retiró 1 descuento de estancia');
});

test('una aeronave en Guarda pierde sus descuentos y el aviso lo dice', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    FactAeronave::query()->where('aeronave_id', $p->aeronave_id)->update(['estatus' => FactAeronave::ESTATUS_GUARDA]);

    $resultado = app(CargosEstancia::class)->recalcular($p->fresh(), pernoctas: 1, transitos2h: 1, transitos12h: 1);

    expect($p->fresh()->renglones()->whereIn('concepto', DescuentoDeEstancia::conceptos())->count())->toBe(0)
        ->and($resultado['motivo'])->toContain('Guarda')
        ->and($resultado['motivo'])->toContain('Se retiró 1 descuento de estancia');
});

test('sin ficha de facturacion los descuentos tambien se retiran nombrados', function () {
    $p = conEstanciaCobrada();

    $this->postJson(urlDescuentos($p), [
        'renglon_id' => renglonDeConcepto($p, FactServicio::CONCEPTO_ESTANCIA_PERNOCTA)->id,
        'conceptos' => [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA],
    ])->assertOk();

    FactAeronave::query()->where('aeronave_id', $p->aeronave_id)->delete();

    $resultado = app(CargosEstancia::class)->recalcular($p->fresh(), pernoctas: 1, transitos2h: 1, transitos12h: 1);

    expect($p->fresh()->renglones()->whereIn('concepto', DescuentoDeEstancia::conceptos())->count())->toBe(0)
        ->and($resultado['motivo'])->toContain('Se retiró 1 descuento de estancia');
});

test('el recalculo no toca un renglon que no es descuento ni cargo de estancia', function () {
    $p = conEstanciaCobrada();
    $suelto = renglonDe($p, 500.0, 1);

    app(CargosEstancia::class)->recalcular($p->fresh(), pernoctas: 1, transitos2h: 0, transitos12h: 0);

    expect($p->fresh()->renglones()->whereKey($suelto->id)->exists())->toBeTrue();
});
```

- [ ] **Step 2: Corre las pruebas y comprueba que fallan**

Run: `php artisan test tests/Feature/Facturacion/DescuentoEstanciaTest.php`
Expected: la primera PASS (el descuento ya sobrevive solo, porque su concepto no está en `CONCEPTOS_ESTANCIA`: eso es justo lo que esa prueba fija). Las demás FAIL: el descuento sigue ahí cuando no debería y el `motivo` no lo nombra.

- [ ] **Step 3: Añade los dos privados a `CargosEstancia`**

Junto a `quitarEstancia()` y `avisoDePerdidas()`:

```php
    /**
     * Retira los descuentos de estancia cuyo tramo NO quedó cobrado en esta pasada, y
     * devuelve sus etiquetas en el orden en que se nombran.
     *
     * Un descuento es una decisión comercial y sobrevive al recálculo solo (su concepto
     * no está en `CONCEPTOS_ESTANCIA`, que es lo que `quitarEstancia()` borra). Pero un
     * descuento de pernocta en una prefactura que ya no cobra pernocta es un renglón
     * negativo suelto que baja el total sin contraparte: ese se retira, y se dice.
     *
     * Con `$conceptosCobrados` vacío retira todos, que es lo que necesitan las dos
     * salidas tempranas (sin ficha y Guarda).
     *
     * El borrado es masivo y no pasa por la guarda del modelo, igual que
     * `quitarEstancia()`: lo protege el candado y la comprobación de cerrada.
     *
     * @param  list<string>  $conceptosCobrados conceptos DE ESTANCIA que sí se cobraron
     * @return list<string>
     */
    private function retirarDescuentosSinCargo(FactPrefactura $prefactura, array $conceptosCobrados): array
    {
        $etiquetas = [];

        foreach (DescuentoDeEstancia::conceptosDescontables() as $concepto) {
            if (in_array($concepto, $conceptosCobrados, true)) {
                continue;
            }

            $retirados = $prefactura->renglones()
                ->where('concepto', DescuentoDeEstancia::conceptoDe($concepto))
                ->delete();

            if ($retirados > 0) {
                $etiquetas[] = DescuentoDeEstancia::etiquetaDe($concepto);
            }
        }

        return $etiquetas;
    }

    /**
     * El aviso de los descuentos retirados. Mismo molde que `avisoDePerdidas()`: una
     * decisión de dinero que desaparece no puede desaparecer en silencio.
     *
     * @param  list<string>  $etiquetas
     */
    private function avisoDeDescuentosRetirados(array $etiquetas): string
    {
        if ($etiquetas === []) {
            return '';
        }

        $lista = implode(', ', $etiquetas);

        return count($etiquetas) === 1
            ? " Se retiró 1 descuento de estancia cuyo concepto ya no se cobra: {$lista}. Si vuelve a cobrarse, el descuento se aplica otra vez a mano."
            : ' Se retiraron '.count($etiquetas)." descuentos de estancia cuyos conceptos ya no se cobran: {$lista}. Si vuelven a cobrarse, los descuentos se aplican otra vez a mano.";
    }
```

Añade `use App\Support\DescuentoDeEstancia;` al principio del fichero.

- [ ] **Step 4: Engancha las dos salidas tempranas**

En `recalcular()`, en la rama `$satelite === null`, entre la lectura de las cortesías y el `return`:

```php
            if ($satelite === null) {
                $perdidas = $this->conceptosEnCortesia($actual);
                $descuentos = $this->retirarDescuentosSinCargo($actual, []);
                $quitados = $this->quitarEstancia($actual);

                return [
                    'renglones' => 0,
                    'motivo' => 'La matrícula no tiene ficha de facturación, así que no hay tarifas de estancia que aplicar.'.$this->nota($quitados).$this->avisoDePerdidas($perdidas).$this->avisoDeDescuentosRetirados($descuentos),
                ];
            }
```

Y lo mismo en la rama de `ESTATUS_GUARDA`, añadiendo `$descuentos = $this->retirarDescuentosSinCargo($actual, []);` y `.$this->avisoDeDescuentosRetirados($descuentos)` al final de su `motivo`.

- [ ] **Step 5: Engancha el camino normal**

Dentro del `foreach ($conceptos as [$concepto, $etiqueta, $cantidad, $tarifa])`, justo después de `$creados++;`:

```php
                $cobrados[] = $concepto;
```

Declara `$cobrados = [];` junto a `$creados = 0;`, antes del bucle. Y después del bloque que compone `$perdidas` (el que termina con `$motivo = trim(($motivo ?? '').$this->avisoDePerdidas($perdidas));`), antes del `return`:

```php
            // Un descuento cuyo tramo no se cobró en esta pasada se retira: ver
            // `retirarDescuentosSinCargo()`.
            $descuentos = $this->retirarDescuentosSinCargo($actual, $cobrados);

            if ($descuentos !== []) {
                $motivo = trim(($motivo ?? '').$this->avisoDeDescuentosRetirados($descuentos));
            }
```

- [ ] **Step 6: Corre las pruebas y comprueba que pasan**

Run: `php artisan test tests/Feature/Facturacion/DescuentoEstanciaTest.php tests/Feature/Facturacion/CargosEstanciaTest.php tests/Feature/Facturacion/AjusteEstanciaTest.php tests/Feature/Facturacion/EstanciaAutomaticaTest.php`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/Services/CargosEstancia.php tests/Feature/Facturacion/DescuentoEstanciaTest.php
git commit -m "feat(facturacion): el descuento sobrevive al recalculo y se retira nombrado si su tramo deja de cobrarse"
```

---

### Task 7: Los tres botones de la fila, a icono

**Files:**
- Modify: `resources/js/pages/Facturacion/EditorPrefactura.tsx` (la celda de acciones, líneas 1494-1545 aproximadamente)

**Interfaces:**
- Consumes: `cortesia()`, `agrupar()`, `desagrupar()`, `quitarRenglon()`, que ya existen en el fichero.
- Produces: nada que otra tarea consuma.

**Esto es lo único que cambia:** desaparece el texto de los tres botones y el icono sube de 12 a 16 px, como el bote de `Quitar` que ya está así. **No se toca** ningún `title`, ningún `aria-label`, ni `aria-pressed`, ni el color que marca el estado: sin el texto, el `title` y el `aria-label` son lo único que dice qué hace el botón.

- [ ] **Step 1: Quita el texto del botón de cortesía**

Sustituye el contenido del botón (deja `onClick`, `disabled`, `aria-pressed`, `title`, `aria-label` y `className` **exactamente** como están, cambiando solo `gap-1 ... px-2 py-1 text-[9px] font-black uppercase` por `p-2` para que el icono quede centrado):

```tsx
                                                        <button
                                                            type="button"
                                                            onClick={() => void cortesia(renglon.id, renglon.nombre_servicio, !renglon.es_cortesia, renglon.concepto, renglon.grupo)}
                                                            disabled={ocupado}
                                                            aria-pressed={renglon.es_cortesia}
                                                            title={renglon.es_cortesia ? 'Quitar la cortesía: vuelve a cobrarse' : 'Marcar como cortesía: se ve en el documento pero no se cobra'}
                                                            aria-label={`${renglon.es_cortesia ? 'Quitar la cortesía de' : 'Marcar como cortesía'} ${renglon.nombre_servicio}`}
                                                            className={`rounded border p-2 transition-colors disabled:opacity-50 ${renglon.es_cortesia ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-slate-200 bg-white text-slate-400 hover:text-emerald-700'}`}
                                                        >
                                                            <Gift size={16} />
                                                        </button>
```

- [ ] **Step 2: Quita el texto del botón de agrupar**

```tsx
                                                        <button
                                                            type="button"
                                                            onClick={() => void agrupar(renglon)}
                                                            disabled={ocupado}
                                                            title={ocupado ? 'Hay otra operación en curso: espera a que termine.' : renglon.grupo === null ? 'Agrupar: sale en el documento junto con los renglones de la misma etiqueta' : `Cambiar de grupo (hoy «${renglon.grupo}»)`}
                                                            aria-label={`${renglon.grupo === null ? 'Agrupar' : 'Cambiar el grupo de'} ${renglon.nombre_servicio}`}
                                                            className="rounded border border-slate-200 bg-white p-2 text-slate-400 transition-colors hover:text-indigo-700 disabled:opacity-50"
                                                        >
                                                            <Group size={16} />
                                                        </button>
```

- [ ] **Step 3: Quita el texto del botón de desagrupar**

```tsx
                                                        {renglon.grupo !== null && (
                                                            <button
                                                                type="button"
                                                                onClick={() => void desagrupar(renglon)}
                                                                disabled={ocupado}
                                                                title={ocupado ? 'Hay otra operación en curso: espera a que termine.' : `Desagrupar: sale del grupo «${renglon.grupo}» y vuelve a salir suelto`}
                                                                aria-label={`Desagrupar ${renglon.nombre_servicio}`}
                                                                className="rounded border border-indigo-200 bg-indigo-50 p-2 text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-50"
                                                            >
                                                                <Ungroup size={16} />
                                                            </button>
                                                        )}
```

- [ ] **Step 4: Comprueba que TypeScript sigue limpio**

Run: `npx tsc --noEmit`
Expected: exactamente **un** error, el de la línea base conocida: `TS1117` en `resources/js/actions/App/Http/Controllers/WalkAroundController.ts:905` (fichero generado por Wayfinder, no es de este trabajo). Cualquier otro error es tuyo.

No corras `npm run build`: lo hace el coordinador.

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/Facturacion/EditorPrefactura.tsx
git commit -m "feat(facturacion): las acciones del renglon quedan en icono, sin texto"
```

---

### Task 8: El icono del descuento, su modal y el api

**Files:**
- Create: `resources/js/pages/Facturacion/components/ModalDescuentoEstancia.tsx`
- Modify: `resources/js/stores/apiFacturacionCatalogos.ts` (dos métodos en `apiPrefacturas`, junto a `cortesia` y `grupo`, línea 653)
- Modify: `resources/js/pages/Facturacion/components/formato.ts` (`admiteDescuentoDeEstancia`, junto a `esConceptoDeEstancia`, línea 290)
- Modify: `resources/js/pages/Facturacion/EditorPrefactura.tsx` (el import del icono y del modal, el estado, la acción y el botón nuevo en la celda de acciones)

**Interfaces:**
- Consumes: `GET /prefacturas/{id}/tarifas-estancia` (Task 5) y `POST /prefacturas/{id}/descuentos-estancia` (Tasks 2 y 3); `ModalBase`, `BOTON_PRIMARIO`, `BOTON_SECUNDARIO`, `labelStyle`, `errorStyle`, `toast`, `formatearMonto`; `type RenglonPrefactura`, `type Prefactura`, `ErrorApi`, `mensajeDeError`.
- Produces: `apiPrefacturas.tarifasDeEstancia(id: number)`, `apiPrefacturas.descuentosDeEstancia(id: number, renglonId: number, conceptos: string[])`, `admiteDescuentoDeEstancia(concepto)`, y el componente `ModalDescuentoEstancia`.

- [ ] **Step 1: Añade los dos métodos al api**

En `resources/js/stores/apiFacturacionCatalogos.ts`, dentro de `apiPrefacturas`, junto a `cortesia` y `grupo`:

```ts
    /** Las tarifas de estancia de la matrícula de esa prefactura, por concepto. Solo lectura: la cifra que cuenta la relee el servidor al aplicar. */
    tarifasDeEstancia: (id: number) => pedir<{ tarifas: Record<string, string | null> }>(`${BASE}/prefacturas/${id}/tarifas-estancia`),
    /** Aplica un descuento por cada concepto de estancia indicado. `renglonId` es el renglón desde el que se pidió: de él hereda el grupo. */
    descuentosDeEstancia: (id: number, renglonId: number, conceptos: string[]) =>
        pedir<{ message: string; prefactura: Prefactura }>(`${BASE}/prefacturas/${id}/descuentos-estancia`, {
            method: 'POST',
            body: { renglon_id: renglonId, conceptos },
        }),
```

- [ ] **Step 2: Añade el ayudante a `formato.ts`**

Justo después de `esConceptoDeEstancia`:

```ts
/**
 * Los tres tramos a los que se les puede aplicar un descuento. Los dos AJUSTES de estancia no, igual que en el sistema viejo.
 *
 * Es una lista y no un prefijo a propósito: `esConceptoDeEstancia()` acepta los cinco, y el descuento solo existe para estos tres.
 */
const CONCEPTOS_DESCONTABLES = ['estancia_pernocta', 'estancia_transito_2h', 'estancia_transito_12h'];

export const admiteDescuentoDeEstancia = (concepto: string | null | undefined): boolean =>
    typeof concepto === 'string' && CONCEPTOS_DESCONTABLES.includes(concepto);
```

- [ ] **Step 3: Escribe el modal**

Crea `resources/js/pages/Facturacion/components/ModalDescuentoEstancia.tsx`:

```tsx
import { apiPrefacturas, mensajeDeError, type RenglonPrefactura } from '@/stores/apiFacturacionCatalogos';
import { useEffect, useState } from 'react';
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, errorStyle } from './estilos';
import { formatearMonto } from './formato';
import ModalBase from './ModalBase';

/** Los tres tramos, en el orden en que los enseñaba el sistema viejo. Las etiquetas son las de la bitácora del servidor. */
const TRAMOS: { concepto: string; etiqueta: string }[] = [
    { concepto: 'estancia_pernocta', etiqueta: 'Pernocta' },
    { concepto: 'estancia_transito_2h', etiqueta: 'Tránsito de 2 horas' },
    { concepto: 'estancia_transito_12h', etiqueta: 'Tránsito de 12 horas' },
];

interface Props {
    prefacturaId: number;
    /** El renglón de estancia desde cuyo icono se abrió: de él hereda el descuento su grupo. */
    renglon: RenglonPrefactura;
    onCerrar: () => void;
    /** Aplica. Debe lanzar el ErrorApi si el servidor rechaza, para que el modal lo muestre. */
    onAplicar: (conceptos: string[]) => Promise<void>;
}

/**
 * Descontar un tramo de estancia.
 *
 * Réplica del modal del sistema viejo (`obtener_datos_modal.php`): los tres tramos con la tarifa de la matrícula, y por cada uno marcado un
 * renglón negativo. La cifra sale de la TARIFA y no de lo que la prefactura cobra, así que se puede descontar un tramo que no se cobró y se
 * puede repetir: es la decisión tomada en la spec, con su costo escrito, y la bitácora es el rastro.
 *
 * El tramo del renglón desde el que se abrió llega marcado. Un tramo sin tarifa no se puede marcar: el servidor lo rechazaría con un 422
 * después del clic.
 */
export default function ModalDescuentoEstancia({ prefacturaId, renglon, onCerrar, onAplicar }: Props) {
    const [tarifas, setTarifas] = useState<Record<string, string | null> | null>(null);
    const [elegidos, setElegidos] = useState<string[]>(renglon.concepto === null ? [] : [renglon.concepto]);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let vivo = true;

        void (async () => {
            try {
                const { tarifas: traidas } = await apiPrefacturas.tarifasDeEstancia(prefacturaId);
                if (vivo) setTarifas(traidas);
            } catch (e) {
                if (vivo) setError(mensajeDeError(e));
            } finally {
                if (vivo) setCargando(false);
            }
        })();

        return () => {
            vivo = false;
        };
    }, [prefacturaId]);

    const alternar = (concepto: string) =>
        setElegidos(previos => (previos.includes(concepto) ? previos.filter(c => c !== concepto) : [...previos, concepto]));

    const aplicar = async () => {
        setError(null);
        setGuardando(true);

        try {
            await onAplicar(elegidos);
        } catch (e) {
            setError(mensajeDeError(e));
        } finally {
            setGuardando(false);
        }
    };

    const total = elegidos.reduce((suma, concepto) => suma + Number(tarifas?.[concepto] ?? 0), 0);

    return (
        <ModalBase
            idTitulo="titulo-descuento-estancia"
            titulo="Descontar estancia"
            subtitulo={`Desde «${renglon.nombre_servicio}»`}
            tieneCambios={elegidos.length > 0}
            bloqueado={guardando}
            onCerrar={onCerrar}
            ancho="max-w-xl"
        >
            <div className="flex flex-col gap-4">
                <p className="text-[11px] font-bold text-slate-500">
                    Por cada tramo que marques entra un renglón con la tarifa de esta matrícula en negativo. El cliente lo verá como «Descuento …» en el
                    documento.
                </p>

                {cargando && <p className="text-[11px] font-bold text-slate-400">Leyendo las tarifas…</p>}

                {!cargando && tarifas !== null && (
                    <ul className="flex flex-col gap-2">
                        {TRAMOS.map(({ concepto, etiqueta }) => {
                            const tarifa = tarifas[concepto];
                            const sinTarifa = tarifa === null || tarifa === undefined;

                            return (
                                <li key={concepto}>
                                    <label className={`flex items-center justify-between gap-4 rounded border px-3 py-2 ${sinTarifa ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'}`}>
                                        <span className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={elegidos.includes(concepto)}
                                                onChange={() => alternar(concepto)}
                                                disabled={sinTarifa || guardando}
                                                className="size-4 accent-indigo-600 disabled:opacity-40"
                                            />
                                            <span className={`text-[11px] font-black uppercase ${sinTarifa ? 'text-slate-400' : 'text-slate-700'}`}>{etiqueta}</span>
                                        </span>

                                        <span className="text-[11px] font-bold text-slate-600">
                                            {sinTarifa ? 'Sin tarifa: no se puede descontar' : `−${formatearMonto(tarifa)}`}
                                        </span>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {elegidos.length > 0 && (
                    <p className="text-[11px] font-black uppercase text-slate-700">
                        Se descontará {formatearMonto(String(total))} en {elegidos.length === 1 ? '1 renglón' : `${elegidos.length} renglones`}.
                    </p>
                )}

                {error !== null && <p className={errorStyle}>{error}</p>}

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onCerrar} disabled={guardando} className={BOTON_SECUNDARIO}>
                        Cancelar
                    </button>
                    <button type="button" onClick={() => void aplicar()} disabled={guardando || elegidos.length === 0} className={BOTON_PRIMARIO}>
                        {guardando ? 'Aplicando…' : 'Aplicar descuento'}
                    </button>
                </div>
            </div>
        </ModalBase>
    );
}
```

`mensajeDeError(e)` toma **un solo argumento** (`apiFacturacionCatalogos.ts:44`): no le pases un texto de respaldo. No importes nada que no uses: un import sin usar es un error de `tsc` en este proyecto.

- [ ] **Step 4: Engancha el modal en el editor**

En `EditorPrefactura.tsx`:

1. En el import de `lucide-react`, añade `TicketPercent` en orden alfabético (existe en lucide-react 0.475.0, comprobado).
2. En el import de `formato`, añade `admiteDescuentoDeEstancia`.
3. Añade `import ModalDescuentoEstancia from './components/ModalDescuentoEstancia';` junto a los demás modales.
4. Cambia el estado del modal para que admita el nuevo y recuerde desde qué renglón se abrió:

```tsx
    const [modal, setModal] = useState<'renglon' | 'estancia' | 'reabrir' | null>(null);
    /** El renglón de estancia desde cuyo icono se abrió el modal del descuento. `null` = cerrado. */
    const [descuentoDe, setDescuentoDe] = useState<RenglonPrefactura | null>(null);
```

5. La acción, junto a `cortesia` y `agrupar`:

```tsx
    /**
     * Aplica los descuentos elegidos. La cifra la pone el servidor con la tarifa de la matrícula; aquí no se calcula dinero.
     *
     * Deja que el ErrorApi suba: el modal lo muestra en su propio sitio, que es donde la persona está mirando.
     */
    const aplicarDescuento = async (renglon: RenglonPrefactura, conceptos: string[]): Promise<void> => {
        const { prefactura: ficha } = await apiPrefacturas.descuentosDeEstancia(prefactura.id, renglon.id, conceptos);

        aplicar(ficha);
        setDescuentoDe(null);
        toast.fire({ icon: 'success', titleText: conceptos.length === 1 ? 'Descuento aplicado.' : 'Descuentos aplicados.' });
    };
```

`aplicar(ficha)` es la función que ya pone la ficha del servidor en este fichero (línea 330): se usa la ficha que devuelve el endpoint en vez de pedir otra con `cargar()`. Y **no** metas la llamada dentro de `ejecutar()`: ese ayudante se come el error en un toast, y aquí el modal necesita recibirlo para pintarlo donde la persona está mirando.

6. El botón, en la celda de acciones, entre el de desagrupar y el de quitar:

```tsx
                                                        {admiteDescuentoDeEstancia(renglon.concepto) && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setDescuentoDe(renglon)}
                                                                disabled={ocupado}
                                                                title="Descontar: entra un renglón negativo con la tarifa de esta matrícula"
                                                                aria-label={`Descontar ${renglon.nombre_servicio}`}
                                                                className="rounded border border-slate-200 bg-white p-2 text-slate-400 transition-colors hover:text-amber-700 disabled:opacity-50"
                                                            >
                                                                <TicketPercent size={16} />
                                                            </button>
                                                        )}
```

7. El modal, junto a los demás al final del JSX:

```tsx
            {descuentoDe !== null && (
                <ModalDescuentoEstancia
                    prefacturaId={prefactura.id}
                    renglon={descuentoDe}
                    onCerrar={() => setDescuentoDe(null)}
                    onAplicar={conceptos => aplicarDescuento(descuentoDe, conceptos)}
                />
            )}
```

- [ ] **Step 5: Comprueba que TypeScript sigue limpio**

Run: `npx tsc --noEmit`
Expected: exactamente **un** error, el `TS1117` de `WalkAroundController.ts:905`. Cualquier otro es tuyo.

- [ ] **Step 6: Commit**

```bash
git add resources/js/pages/Facturacion/components/ModalDescuentoEstancia.tsx resources/js/pages/Facturacion/components/formato.ts resources/js/stores/apiFacturacionCatalogos.ts resources/js/pages/Facturacion/EditorPrefactura.tsx
git commit -m "feat(facturacion): el icono del descuento de estancia y su modal"
```

---

## Cierre (lo hace el coordinador, no una tarea)

- Suite completa **en serie**: `php artisan test`. Partimos de 3662 en verde.
- `npm run build` debe salir en 0, y después `npx tsc --noEmit` debe dar su único error de línea base.
- Comprobación en el navegador: los tres botones sin texto, el icono del descuento solo en las filas de tránsito y pernocta, el modal con el tramo de su fila premarcado, y un descuento aplicado que baja el total.
