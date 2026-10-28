# Precio capturado a mano en un renglón — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que al agregar un servicio a una prefactura se pueda teclear el precio unitario, con rastro de que se tecleó.

**Architecture:** el precio llega como un campo opcional en la petición que ya existe. Una clase pura (`App\Support\PrecioDeRenglon`) decide, en un solo sitio, qué precio se guarda y si cuenta como capturado; la usan los dos lugares donde nace un renglón. El importe sigue sin columna y derivado.

**Tech Stack:** Laravel 12, Inertia 2, React 19, TypeScript, Tailwind 4, Pest 3, MariaDB en desarrollo y sqlite en memoria en pruebas.

**Spec:** `docs/superpowers/specs/2026-10-28-precio-capturado-en-renglon-design.md`

## Global Constraints

- Las pruebas corren **en serie**: `php artisan test`. **Nunca `--parallel`** (da rojos falsos en este proyecto).
- **No ejecutar `vendor/bin/pint`, `prettier` ni `npm run lint`** (el último lleva `--fix`), aunque CLAUDE.md pida pint.
- **Nunca `git stash`**: hay tres stashes en el repo que no son de este trabajo.
- **No hay factories de modelo** salvo `UserFactory`: las filas se construyen con `Modelo::create([...])`.
- **No ejecutar `php artisan migrate`.** `eolo_plus` es la base real del usuario; migrarla es decisión suya. Las pruebas migran solas sobre sqlite en memoria.
- **Los implementadores NO ejecutan `npm run build`**: tarda más de dos minutos en silencio y ha dejado colgados a dos agentes. El build y `npx tsc --noEmit` los mide el controlador.
- Línea base del front, medida **después** del build: `npm run build` sale en 0 y `npx tsc --noEmit` da **exactamente 1 error**, el TS1117 de `resources/js/actions/App/Http/Controllers/Api/WalkAroundController.ts:905`, que es código generado.
- sqlite **no tiene** el límite de 64 caracteres de MySQL en los identificadores: una migración puede pasar todas las pruebas y fallar contra la base real.
- `fact_prefactura_renglones.precio_unitario` es `decimal(10,4)`: el precio va de **0 a 999999.9999** con **máximo 4 decimales**.
- **El precio tecleado sustituye SOLO al precio.** `margen`, `ajuste_precio`, `es_de_tercero`, `concepto` y `cantidad` conservan su regla actual en cada caso.
- **Sin `precio_unitario` en la petición, el comportamiento tiene que ser idéntico al de hoy.** Es la propiedad que hace seguro todo el trabajo.
- Un cero **no** es un campo vacío: `precio_unitario` igual a 0 es un precio tecleado, no una ausencia.

---

### Task 1: La columna `precio_capturado`, de la base al navegador

**Files:**
- Create: `database/migrations/2026_10_30_100000_add_precio_capturado_to_fact_prefactura_renglones_table.php`
- Modify: `app/Models/FactPrefacturaRenglon.php:14-25` (`$fillable` y `$casts`)
- Modify: `app/Http/Controllers/Api/Facturacion/PrefacturaController.php:724-740` (el mapa de renglones)
- Modify: `resources/js/stores/apiFacturacionCatalogos.ts:485-507` (`RenglonPrefactura`)
- Test: `tests/Feature/Facturacion/PrecioCapturadoEnRenglonTest.php`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: la columna `fact_prefactura_renglones.precio_capturado` (booleano, `false` por omisión), presente en `$fillable`, casteada a `boolean`, y el campo `precio_capturado: boolean` en el payload de la prefactura y en el tipo `RenglonPrefactura`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Fichero nuevo `tests/Feature/Facturacion/PrecioCapturadoEnRenglonTest.php`. Los helpers `prefacturaBorrador()`, `renglonDe()` y `usuarioConSubdepartamento()` son globales (`tests/Pest.php`): **no los redefinas**.

```php
<?php

use App\Models\FactPrefacturaRenglon;
use Illuminate\Support\Facades\Schema;

/*
 * `precio_capturado` marca el renglon cuyo precio alguien teclteó al agregarlo, en vez de
 * heredarlo del catalogo, de la remision, del comisariato o de la tarifa de la aeronave.
 *
 * Hasta este trabajo el navegador no mandaba ninguna cifra de dinero, asi que la columna nace
 * en falso y eso es la verdad de los 117 renglones que ya existen.
 */

test('un renglon nace con precio_capturado en falso', function () {
    $renglon = renglonDe(prefacturaBorrador(), 100.0, 1);

    expect($renglon->fresh()->precio_capturado)->toBeFalse();
});

test('precio_capturado es asignable y castea a booleano', function () {
    $renglon = renglonDe(prefacturaBorrador(), 100.0, 1);

    $renglon->update(['precio_capturado' => 1]);

    expect($renglon->fresh()->precio_capturado)->toBeTrue();
});

test('la ficha de la prefactura expone precio_capturado en cada renglon', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = prefacturaBorrador();
    $renglon = renglonDe($prefactura, 100.0, 1);
    $renglon->update(['precio_capturado' => true]);

    $this->getJson("/api/facturacion/prefacturas/{$prefactura->id}")
        ->assertOk()
        ->assertJsonPath('renglones.0.precio_capturado', true);
});

test('ningun indice de la tabla de renglones pasa de 64 caracteres', function () {
    // MySQL rechaza un identificador de mas de 64; sqlite no tiene ese limite, asi que una
    // migracion puede pasar en verde aqui y fallar entera contra la base real. Ya paso con
    // `fact_prefactura_remisiones_excluidas`, cuyo indice automatico salia de 69.
    foreach (Schema::getIndexes('fact_prefactura_renglones') as $indice) {
        expect(strlen((string) $indice['name']))->toBeLessThanOrEqual(64);
    }
});
```

- [ ] **Step 2: Correr las pruebas y verlas fallar**

Run: `php artisan test tests/Feature/Facturacion/PrecioCapturadoEnRenglonTest.php`
Expected: FAIL. Las tres primeras por `precio_capturado` inexistente (`SQLSTATE[HY000]: no such column` o atributo nulo); la cuarta pasa ya y es un centinela para el futuro.

- [ ] **Step 3: La migración**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Marca el renglón cuyo precio se teclteó al agregarlo, en vez de heredarlo del catálogo, de la
 * remisión, del comisariato o de la tarifa de la aeronave.
 *
 * Nace en `false` y eso es la verdad de las filas que ya existen: hasta este trabajo el
 * navegador no podía mandar un precio, así que ninguna se capturó a mano. No hay relleno.
 *
 * Sin índice a propósito: se lee siempre junto a su renglón y nunca se filtra por este campo.
 * Un índice aquí tendría nombre automático largo, y MySQL rechaza los de más de 64 caracteres
 * mientras sqlite —donde corren las pruebas— los acepta.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fact_prefactura_renglones', function (Blueprint $tabla) {
            $tabla->boolean('precio_capturado')->default(false)->after('precio_unitario');
        });
    }

    public function down(): void
    {
        Schema::table('fact_prefactura_renglones', function (Blueprint $tabla) {
            $tabla->dropColumn('precio_capturado');
        });
    }
};
```

- [ ] **Step 4: El modelo**

En `app/Models/FactPrefacturaRenglon.php`, agregar `'precio_capturado'` al final de `$fillable` (Eloquent descarta en silencio lo que no esté ahí, así que el `$fillable` muerde antes que la columna) y `'precio_capturado' => 'boolean',` a `$casts`, junto a `'es_cortesia' => 'boolean'`.

- [ ] **Step 5: El payload y el tipo**

En `PrefacturaController.php`, dentro del `map()` de renglones, después de `'precio_unitario' => (string) $r->precio_unitario,`:

```php
                // El precio NO salió del catálogo ni del registro de origen: alguien lo teclteó
                // al agregar el renglón. La pantalla lo marca, porque quien revisa el documento
                // tiene que poder ver qué cifra no vino de un catálogo.
                'precio_capturado' => $r->precio_capturado,
```

En `apiFacturacionCatalogos.ts`, dentro de `RenglonPrefactura`, después de `precio_unitario: string;`:

```ts
    /** El precio se teclteó al agregar el renglón: no salió del catálogo ni del registro del que nació. */
    precio_capturado: boolean;
```

- [ ] **Step 6: Correr las pruebas y verlas pasar**

Run: `php artisan test tests/Feature/Facturacion/PrecioCapturadoEnRenglonTest.php`
Expected: PASS, 4 pruebas.

Luego, para que la columna nueva no haya roto nada que lea renglones:
Run: `php artisan test tests/Feature/Facturacion`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add database/migrations/2026_10_30_100000_add_precio_capturado_to_fact_prefactura_renglones_table.php app/Models/FactPrefacturaRenglon.php app/Http/Controllers/Api/Facturacion/PrefacturaController.php resources/js/stores/apiFacturacionCatalogos.ts tests/Feature/Facturacion/PrecioCapturadoEnRenglonTest.php
git commit -m "feat(facturacion): columna precio_capturado en los renglones de prefactura"
```

---

### Task 2: El servidor acepta un precio opcional

**Files:**
- Modify: `app/Http/Requests/Facturacion/StoreRenglonRequest.php` (`rules()`, `messages()`, un método privado nuevo)
- Test: `tests/Feature/Facturacion/PrecioCapturadoEnRenglonTest.php` (se agrega al fichero de la Task 1)

**Interfaces:**
- Consumes: la columna de la Task 1.
- Produces: la petición `POST /api/facturacion/prefacturas/{id}/renglones` acepta `precio_unitario` opcional. Validado: `nullable`, `numeric`, `min:0`, `max:999999.9999` y máximo 4 decimales. El controlador de la Task 4 lo lee con `$request->validated()['precio_unitario'] ?? null`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Al final de `tests/Feature/Facturacion/PrecioCapturadoEnRenglonTest.php`. Necesitas un servicio del catálogo; créalo con `FactServicio::create([...])` como hace el helper global `renglonDe()` (`categoria_servicio_id` es nulable).

```php
// ---------------------------------------------------------------------------
// La validacion del precio que llega
// ---------------------------------------------------------------------------

/** Un servicio normal del catalogo, sin margen ni ajuste. */
function servicioSimple(float $precio = 500.0): App\Models\FactServicio
{
    return App\Models\FactServicio::create([
        'nombre' => 'Servicio '.uniqid(),
        'precio_unitario' => $precio,
        'status' => 'A',
    ]);
}

/** Agrega un renglon por el endpoint, con el precio indicado si se da. */
function altaDeRenglon(App\Models\FactPrefactura $p, App\Models\FactServicio $s, array $extra = []): Illuminate\Testing\TestResponse
{
    return test()->postJson("/api/facturacion/prefacturas/{$p->id}/renglones", array_merge([
        'servicio_id' => $s->id,
        'cantidad' => 1,
    ], $extra));
}

test('un precio negativo se rechaza', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    altaDeRenglon(prefacturaBorrador(), servicioSimple(), ['precio_unitario' => '-1'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('precio_unitario');
});

test('un precio por encima del maximo de la columna se rechaza', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    altaDeRenglon(prefacturaBorrador(), servicioSimple(), ['precio_unitario' => '1000000'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('precio_unitario');
});

test('un precio con cinco decimales se rechaza: el quinto se perderia al escribirlo', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    altaDeRenglon(prefacturaBorrador(), servicioSimple(), ['precio_unitario' => '25.99401'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('precio_unitario');
});

test('los ceros de relleno no cuentan como decimales', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    altaDeRenglon(prefacturaBorrador(), servicioSimple(), ['precio_unitario' => '25.99400000'])
        ->assertCreated();
});

test('un precio de cero se acepta: cero es una tarifa, no un campo vacio', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    altaDeRenglon(prefacturaBorrador(), servicioSimple(), ['precio_unitario' => '0'])
        ->assertCreated();
});

test('sin precio el alta sigue funcionando', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    altaDeRenglon(prefacturaBorrador(), servicioSimple())->assertCreated();
});
```

- [ ] **Step 2: Correr las pruebas y verlas fallar**

Run: `php artisan test tests/Feature/Facturacion/PrecioCapturadoEnRenglonTest.php`
Expected: FAIL en las tres primeras con un 201 en vez de 422 — hoy `precio_unitario` no se valida y Laravel lo ignora. Las tres últimas pasan ya.

- [ ] **Step 3: La regla**

En `rules()`, después de `'cantidad' => [...]`:

```php
            'precio_unitario' => ['nullable', 'numeric', 'min:0', 'max:999999.9999', $this->hasta4Decimales(...)],
```

Y el método privado, junto a los otros del fichero:

```php
    /**
     * `fact_prefactura_renglones.precio_unitario` es `decimal(10,4)`: un quinto decimal se
     * perdería al escribir y el renglón cobraría algo distinto de lo que se tecleó, en silencio.
     *
     * Los ceros de relleno no cuentan: `25.99400000` es el mismo precio de cuatro decimales, y
     * rechazarlo sería un rechazo sin motivo para quien escribe con el teclado numérico.
     */
    private function hasta4Decimales(string $atributo, mixed $valor, \Closure $fallar): void
    {
        $texto = (string) $valor;

        if (! str_contains($texto, '.')) {
            return;
        }

        if (strlen(rtrim(substr($texto, strpos($texto, '.') + 1), '0')) > 4) {
            $fallar('El precio unitario admite máximo 4 decimales.');
        }
    }
```

En `messages()`, junto a los de `cantidad`:

```php
            'precio_unitario.numeric' => 'El precio unitario debe ser un importe numérico, sin signos ni comas.',
            'precio_unitario.min' => 'El precio unitario no puede ser negativo.',
            'precio_unitario.max' => 'El precio unitario es demasiado grande.',
```

- [ ] **Step 4: Correr las pruebas y verlas pasar**

Run: `php artisan test tests/Feature/Facturacion/PrecioCapturadoEnRenglonTest.php`
Expected: PASS, 10 pruebas.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Requests/Facturacion/StoreRenglonRequest.php tests/Feature/Facturacion/PrecioCapturadoEnRenglonTest.php
git commit -m "feat(facturacion): el alta de un renglon acepta un precio unitario opcional"
```

---

### Task 3: `App\Support\PrecioDeRenglon`, el sitio único que decide

**Files:**
- Create: `app/Support/PrecioDeRenglon.php`
- Test: `tests/Unit/PrecioDeRenglonTest.php`

**Interfaces:**
- Consumes: nada.
- Produces: `App\Support\PrecioDeRenglon::resolver(string|float|null $pedido, string|float $delRegistro): array{precio: string, capturado: bool}`. `$precio` siempre sale como cadena de **4 decimales** (`'500.0000'`), lista para escribir en la columna. Lo usan la Task 4 en dos sitios.

- [ ] **Step 1: Escribir las pruebas que fallan**

```php
<?php

use App\Support\PrecioDeRenglon;

/*
 * Que precio se guarda en un renglon y si cuenta como capturado a mano. EN UN SOLO SITIO: la
 * regla la necesitan el controlador (catalogo, remision y transito ajeno) y
 * `RenglonDeComisariato`, y dos copias de la misma comparacion divergen. Ya paso en el trabajo
 * de remisiones, donde las dos vias armaban el renglon por separado y se separaron en tres
 * campos sin que nadie lo viera hasta la revision final de rama.
 */

test('sin precio pedido se usa el del registro y no cuenta como capturado', function () {
    expect(PrecioDeRenglon::resolver(null, '500.00'))
        ->toBe(['precio' => '500.0000', 'capturado' => false]);
});

test('el mismo precio escrito distinto no cuenta como capturado', function () {
    // La comparacion es NUMERICA a 4 decimales, no de texto: comparando cadenas, teclear `500`
    // donde el catalogo dice `500.0000` marcaria el renglon y la marca dejaria de significar nada.
    expect(PrecioDeRenglon::resolver('500', '500.0000'))
        ->toBe(['precio' => '500.0000', 'capturado' => false]);
});

test('un precio distinto se guarda y cuenta como capturado', function () {
    expect(PrecioDeRenglon::resolver('1050', '500.0000'))
        ->toBe(['precio' => '1050.0000', 'capturado' => true]);
});

test('una diferencia en el cuarto decimal SI cuenta', function () {
    expect(PrecioDeRenglon::resolver('25.9941', '25.9940'))
        ->toBe(['precio' => '25.9941', 'capturado' => true]);
});

test('un cero pedido es un precio, no una ausencia', function () {
    expect(PrecioDeRenglon::resolver('0', '500.0000'))
        ->toBe(['precio' => '0.0000', 'capturado' => true]);
});

test('acepta flotantes en los dos lados', function () {
    expect(PrecioDeRenglon::resolver(1050.5, 500.0))
        ->toBe(['precio' => '1050.5000', 'capturado' => true]);
});
```

- [ ] **Step 2: Correr las pruebas y verlas fallar**

Run: `php artisan test tests/Unit/PrecioDeRenglonTest.php`
Expected: FAIL con `Class "App\Support\PrecioDeRenglon" not found`.

- [ ] **Step 3: La clase**

```php
<?php

namespace App\Support;

/**
 * Qué precio se guarda en un renglón y si cuenta como capturado a mano. EN UN SOLO SITIO.
 *
 * Pura a propósito, igual que `VentanaDeEstancia` y `CalculadoraEstancia`: recibe dos cifras y
 * no sabe nada de la base de datos.
 *
 * La necesitan `PrefacturaRenglonController::store()` —para el catálogo, la remisión y el
 * tránsito ajeno— y `RenglonDeComisariato::atributos()`. Dos copias de la misma comparación
 * divergen: en el trabajo de remisiones las dos vías armaban el renglón por separado y se
 * separaron en `margen`, `ajuste_precio` y `es_de_tercero` sin que nadie lo viera hasta la
 * revisión final de rama.
 *
 * `$pedido` nulo es «no se tecleó nada»; `'0'` es un precio de cero, que es una tarifa válida.
 * Es la misma regla que gobierna los importes del front: un campo vacío y un cero no son lo
 * mismo.
 */
final class PrecioDeRenglon
{
    /**
     * @param  string|float|null  $pedido  Lo que llegó en la petición, o null si no llegó nada.
     * @param  string|float  $delRegistro  El precio que aplicaría sin él: el del catálogo, el de
     *                                     la remisión, el subtotal del comisariato o la tarifa
     *                                     del tramo de la aeronave.
     * @return array{precio: string, capturado: bool}
     */
    public static function resolver(string|float|null $pedido, string|float $delRegistro): array
    {
        $delRegistro = self::aCuatroDecimales($delRegistro);

        if ($pedido === null) {
            return ['precio' => $delRegistro, 'capturado' => false];
        }

        $tecleado = self::aCuatroDecimales($pedido);

        return ['precio' => $tecleado, 'capturado' => $tecleado !== $delRegistro];
    }

    /**
     * La cifra tal como la guarda `decimal(10,4)`.
     *
     * Normalizar los dos lados a esto ES la comparación: así `500`, `500.00` y `500.0000` son el
     * mismo precio, y la marca solo aparece cuando de verdad se cobra otra cosa.
     */
    private static function aCuatroDecimales(string|float $valor): string
    {
        return number_format((float) $valor, 4, '.', '');
    }
}
```

- [ ] **Step 4: Correr las pruebas y verlas pasar**

Run: `php artisan test tests/Unit/PrecioDeRenglonTest.php`
Expected: PASS, 6 pruebas.

- [ ] **Step 5: Commit**

```bash
git add app/Support/PrecioDeRenglon.php tests/Unit/PrecioDeRenglonTest.php
git commit -m "feat(facturacion): PrecioDeRenglon decide en un solo sitio que precio se guarda"
```

---

### Task 4: El controlador y `RenglonDeComisariato` aplican el precio

**Files:**
- Modify: `app/Services/RenglonDeComisariato.php` (firma de `atributos()` y dos claves del arreglo)
- Modify: `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php` (el `create([...])` de `store()`, la rama del comisariato y las dos líneas de bitácora)
- Test: `tests/Feature/Facturacion/PrecioCapturadoEnRenglonTest.php`
- Test: `tests/Feature/Facturacion/ComisariatosEnPrefacturaTest.php` (dos pruebas, con los helpers de ese fichero)
- Test: `tests/Feature/Facturacion/RemisionesDeCombustibleTest.php` (una prueba, con los helpers de ese fichero)
- Test: `tests/Feature/Facturacion/EndpointsPrefacturaTest.php` (una prueba, con `aeronaveAjena()` de ese fichero)

**La no-regresión de los otros tres casos SIN precio ya está guardada**, y por eso no se duplica
aquí: `RemisionesDeCombustibleTest` fija campo por campo el renglón nacido de una remisión,
`ComisariatosEnPrefacturaTest` el del comisariato por las dos vías, `EndpointsPrefacturaTest` el
del tránsito ajeno en los tres tramos, y `ReaperturaPrefacturaTest` más `CierrePrefacturaTest` que
una prefactura cerrada, descartada o reabierta rechaza el alta. **Las cuatro tienen que seguir en
verde**, y el Step 6 las corre. Una tarea que solo mira sus propias pruebas no dice nada de las
guardas que viven en ficheros que no toca: eso ya escondió aquí una regresión durante cuatro
commits.

**Interfaces:**
- Consumes: la columna de la Task 1, la validación de la Task 2 y `PrecioDeRenglon::resolver()` de la Task 3.
- Produces: `RenglonDeComisariato::atributos(ServicioComisariato $comisariato, int $orden, string|float|null $precioPedido = null): array` — el tercer parámetro es **opcional y la vía automática no lo pasa**, así que sigue tomando el subtotal del comisariato. El arreglo gana la clave `precio_capturado`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Al final de `tests/Feature/Facturacion/PrecioCapturadoEnRenglonTest.php`. Para los casos de remisión, comisariato y tránsito ajeno reutiliza el modo de construir las filas de `tests/Feature/Facturacion/RemisionesDeCombustibleTest.php` y `ComisariatosEnPrefacturaTest.php`, que ya tienen helpers propios en sus ficheros; **mide las columnas NOT NULL antes de escribir el tuyo** (en este proyecto se han omitido tres veces).

```php
// ---------------------------------------------------------------------------
// El precio que llega se aplica, y solo el precio
// ---------------------------------------------------------------------------

test('con precio tecleado el renglon lo guarda y el importe lo sigue', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = prefacturaBorrador();

    altaDeRenglon($prefactura, servicioSimple(500.0), ['precio_unitario' => '1050', 'cantidad' => 2])
        ->assertCreated();

    $renglon = $prefactura->renglones()->sole();

    expect((string) $renglon->precio_unitario)->toBe('1050.0000')
        ->and($renglon->precio_capturado)->toBeTrue()
        ->and($renglon->importe())->toBe('2100.00');
});

test('teclear el mismo precio del catalogo NO marca el renglon', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = prefacturaBorrador();

    altaDeRenglon($prefactura, servicioSimple(500.0), ['precio_unitario' => '500'])->assertCreated();

    expect($prefactura->renglones()->sole()->precio_capturado)->toBeFalse();
});

test('el precio tecleado NO mueve el margen, el ajuste, el tercero ni el concepto', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = prefacturaBorrador();
    $servicio = App\Models\FactServicio::create([
        'nombre' => 'Servicio '.uniqid(),
        'precio_unitario' => 500.0,
        'es_de_tercero' => true,
        'margen' => 50,
        'ajuste_precio' => App\Models\FactServicio::AJUSTE_MAS_5,
        'status' => 'A',
    ]);

    altaDeRenglon($prefactura, $servicio, ['precio_unitario' => '1000'])->assertCreated();

    $renglon = $prefactura->renglones()->sole();

    expect($renglon->es_de_tercero)->toBeTrue()
        ->and((string) $renglon->margen)->toBe('50.00')
        ->and($renglon->ajuste_precio)->toBe(App\Models\FactServicio::AJUSTE_MAS_5);
});

test('el alta sin precio produce exactamente el renglon de siempre', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = prefacturaBorrador();
    $servicio = servicioSimple(500.0);

    altaDeRenglon($prefactura, $servicio, ['cantidad' => 3])->assertCreated();

    $renglon = $prefactura->renglones()->sole();

    expect((string) $renglon->precio_unitario)->toBe('500.0000')
        ->and($renglon->precio_capturado)->toBeFalse()
        ->and($renglon->cantidad)->toBe(3)
        ->and($renglon->importe())->toBe('1500.00');
});

test('la bitacora dice con que precio se cobro y cual habria sido', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = prefacturaBorrador();

    altaDeRenglon($prefactura, servicioSimple(500.0), ['precio_unitario' => '1050'])->assertCreated();

    expect(App\Models\Bitacora::latest('id')->first()->descripcion)
        ->toContain('1050.0000')
        ->toContain('500.0000');
});

test('sin precio capturado la bitacora no habla de precios tecleados', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    altaDeRenglon(prefacturaBorrador(), servicioSimple(500.0))->assertCreated();

    expect(App\Models\Bitacora::latest('id')->first()->descripcion)
        ->not->toContain('capturado');
});

test('teclear un precio NO cambia el del catalogo', function () {
    // Decision 5 de la spec. El renglon congela su precio; el catalogo se edita en su pantalla.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $servicio = servicioSimple(500.0);

    altaDeRenglon(prefacturaBorrador(), $servicio, ['precio_unitario' => '1050'])->assertCreated();

    expect((string) $servicio->fresh()->precio_unitario)->toBe('500.0000');
});
```

En `tests/Feature/Facturacion/RemisionesDeCombustibleTest.php`, el caso de la remisión con precio
tecleado, que es además donde se comprueba que la **cantidad sigue siendo los litros de la carga** y
no lo que venga en la petición:

```php
test('con precio tecleado la remision cobra ese precio, pero la cantidad sigue siendo sus litros', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $servicio = servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00');

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        // La cantidad que se manda es mentira a proposito: en combustible la pone la remision.
        'cantidad' => 1,
        'remision_combustible_id' => $remision->id,
        'precio_unitario' => '30',
    ])->assertCreated();

    $renglon = $prefactura->renglones()->sole();

    expect((string) $renglon->precio_unitario)->toBe('30.0000')
        ->and($renglon->precio_capturado)->toBeTrue()
        ->and($renglon->cantidad)->toBe((int) $remision->total_litros)
        // El margen y el ajuste siguen en cero y «ninguno», como en toda remision.
        ->and((string) $renglon->margen)->toBe('0.00')
        ->and($renglon->ajuste_precio)->toBe(FactServicio::AJUSTE_NINGUNO);
});
```

En `tests/Feature/Facturacion/EndpointsPrefacturaTest.php`, el caso del tránsito ajeno, junto a la
prueba que ya cobra con la tarifa de la otra aeronave:

```php
test('en un transito ajeno el precio tecleado gana a la tarifa de la aeronave, y se marca', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = conEstancia();
    $ajena = aeronaveAjena();

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => servicioDeTransito(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H)->id,
        'cantidad' => 1,
        'aeronave_id' => $ajena->id,
        'precio_unitario' => '3500',
    ])->assertCreated();

    $renglon = FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->sole();

    // La tarifa de 2 h de `aeronaveAjena()` es 3000.00: 3500 es otro precio y se marca.
    expect((string) $renglon->precio_unitario)->toBe('3500.0000')
        ->and($renglon->precio_capturado)->toBeTrue()
        // Sigue sin concepto, que es lo que lo hace sobrevivir a «Estancia y ajustes».
        ->and($renglon->concepto)->toBeNull()
        ->and((string) $renglon->margen)->toBe('0.00');
});
```

Y en `tests/Feature/Facturacion/ComisariatosEnPrefacturaTest.php`, dos pruebas más con sus helpers de ese fichero:

```php
test('la via AUTOMATICA sigue tomando el subtotal del comisariato', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-21', '10:00', ['subtotal' => 777]);

    $atributos = App\Services\RenglonDeComisariato::atributos($comisariato->fresh('factServicio'), 1);

    expect($atributos['precio_unitario'])->toBe('777.0000')
        ->and($atributos['precio_capturado'])->toBeFalse();
});

test('el alta a mano de un comisariato acepta otro precio y lo marca', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-21', '10:00', ['subtotal' => 777]);

    $atributos = App\Services\RenglonDeComisariato::atributos($comisariato->fresh('factServicio'), 1, '900');

    expect($atributos['precio_unitario'])->toBe('900.0000')
        ->and($atributos['precio_capturado'])->toBeTrue();
});
```

- [ ] **Step 2: Correr las pruebas y verlas fallar**

Run: `php artisan test tests/Feature/Facturacion/PrecioCapturadoEnRenglonTest.php tests/Feature/Facturacion/ComisariatosEnPrefacturaTest.php tests/Feature/Facturacion/RemisionesDeCombustibleTest.php tests/Feature/Facturacion/EndpointsPrefacturaTest.php`
Expected: FAIL. El precio tecleado se ignora (el renglón sale al precio del registro), `precio_capturado` sigue en falso, la bitácora no menciona los precios y `atributos()` no acepta un tercer parámetro. La prueba del catálogo intacto pasa ya.

- [ ] **Step 3: `RenglonDeComisariato`**

```php
    /**
     * @param  string|float|null  $precioPedido  El precio tecleado en el alta a mano, o null. La
     *                                           vía AUTOMÁTICA no pasa ninguno: sigue cobrando
     *                                           el subtotal del comisariato, que es su contrato.
     * @return array<string, mixed>
     */
    public static function atributos(ServicioComisariato $comisariato, int $orden, string|float|null $precioPedido = null): array
    {
        $servicio = $comisariato->factServicio;
        $precio = PrecioDeRenglon::resolver($precioPedido, $comisariato->subtotal);

        return [
            'servicio_id' => $servicio->id,
            'servicio_comisariato_id' => $comisariato->id,
            'nombre_servicio' => $servicio->nombre,
            'precio_unitario' => $precio['precio'],
            'precio_capturado' => $precio['capturado'],
            'cantidad' => 1,
            'es_de_tercero' => $servicio->es_de_tercero,
            'margen' => $servicio->margen,
            'ajuste_precio' => $servicio->ajuste_precio,
            'orden' => $orden,
        ];
    }
```

Agregar `use App\Support\PrecioDeRenglon;` a los imports.

- [ ] **Step 4: El controlador**

En `store()`, **dentro de la transacción**, la rama del comisariato pasa el precio y guarda de dónde venía para la bitácora:

```php
            if ($comisariato !== null) {
                $precioDelRegistro = $comisariato->subtotal;
                // `reorder()`: la relación trae ORDER BY, que un agregado no admite en MySQL estricto.
                $renglon = $actual->renglones()->create(
                    RenglonDeComisariato::atributos(
                        $comisariato,
                        (int) $actual->renglones()->reorder()->max('orden') + 1,
                        $request->validated()['precio_unitario'] ?? null,
                    ),
                );
```

Y en el `create([...])` del resto, sustituir la línea de `precio_unitario`:

```php
            // El precio sale del registro que corresponda —la remisión, la tarifa de la aeronave
            // o el catálogo— salvo que la petición traiga uno tecleado. `PrecioDeRenglon` decide
            // cuál se guarda y si cuenta como capturado a mano, en un solo sitio para las dos
            // vías. Lo tecleado sustituye SOLO al precio: margen, ajuste, tercero, concepto y
            // cantidad siguen su propia regla, justo debajo.
            $precioDelRegistro = $remision !== null ? $remision->precio : ($ajena === null ? $servicio->precio_unitario : $ajena['precio']);
            $precio = PrecioDeRenglon::resolver($request->validated()['precio_unitario'] ?? null, $precioDelRegistro);

            $renglon = $actual->renglones()->create([
                'servicio_id' => $servicio->id,
                'nombre_servicio' => $remision !== null ? "{$servicio->nombre} — {$remision->folio}" : ($ajena === null ? $servicio->nombre : $ajena['nombre']),
                'precio_unitario' => $precio['precio'],
                'precio_capturado' => $precio['capturado'],
                'cantidad' => $remision !== null ? (int) $remision->total_litros : $request->validated()['cantidad'],
```

El resto de las claves no se toca.

- [ ] **Step 5: La bitácora, en las dos ramas**

Un método privado nuevo, junto a `remisionesFueraDeVentana()`:

```php
    /**
     * La frase que añade a la bitácora el precio que se cobró y el que habría aplicado.
     *
     * Vacía cuando el precio se heredó, que es el caso normal. Sin esta línea, un precio tecleado
     * sería un cambio de dinero sin rastro: el renglón puede quedar con un precio que ya no
     * coincide con la remisión o el comisariato del que nació, y ese registro sigue marcado como
     * cobrado.
     */
    private function avisoDePrecioCapturado(FactPrefacturaRenglon $renglon, string|float $precioDelRegistro): string
    {
        if (! $renglon->precio_capturado) {
            return '';
        }

        return " Precio capturado a mano: {$renglon->precio_unitario} en vez de ".number_format((float) $precioDelRegistro, 4, '.', '').'.';
    }
```

Y en las **dos** llamadas a `Bitacora::log()` de `store()`, la descripción pasa a:

```php
                    descripcion: "Se agregó el servicio {$renglon->nombre_servicio} a la prefactura {$actual->id} por {$renglon->importe()}.".$this->avisoDePrecioCapturado($renglon, $precioDelRegistro),
```

Agregar `use App\Models\FactPrefacturaRenglon;` y `use App\Support\PrecioDeRenglon;` a los imports si no están.

- [ ] **Step 6: Correr las pruebas y verlas pasar**

Run: `php artisan test tests/Feature/Facturacion/PrecioCapturadoEnRenglonTest.php tests/Feature/Facturacion/ComisariatosEnPrefacturaTest.php tests/Feature/Facturacion/RemisionesDeCombustibleTest.php tests/Feature/Facturacion/EndpointsPrefacturaTest.php tests/Feature/Facturacion/ReaperturaPrefacturaTest.php tests/Feature/Facturacion/CierrePrefacturaTest.php`
Expected: PASS. Esas seis son las guardas nombradas arriba; si cae una, la regresión es de esta tarea.

Luego toda la carpeta, porque esto toca el camino por el que nacen TODOS los renglones:
Run: `php artisan test tests/Feature/Facturacion`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/Services/RenglonDeComisariato.php app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php tests/Feature/Facturacion/PrecioCapturadoEnRenglonTest.php tests/Feature/Facturacion/ComisariatosEnPrefacturaTest.php tests/Feature/Facturacion/RemisionesDeCombustibleTest.php tests/Feature/Facturacion/EndpointsPrefacturaTest.php
git commit -m "feat(facturacion): el alta de un renglon aplica el precio tecleado y lo deja en bitacora"
```

---

### Task 5: El campo PRECIO UNITARIO en el modal

**Files:**
- Modify: `resources/js/pages/Facturacion/components/ModalRenglon.tsx` — **es el único fichero de esta tarea**

**Interfaces:**
- Consumes: el endpoint de las Tasks 2 y 4.
- Produces: `DatosRenglon` (que se declara y se exporta en este mismo fichero) gana
  `precio_unitario: number | null`.

**Medido: no hay nada que cambiar en `EditorPrefactura` ni en el store.**
`EditorPrefactura.tsx:664` hace `apiPrefacturas.agregarRenglon(prefactura.id, { ...datos })` y
`apiFacturacionCatalogos.ts:655` lo recibe como `Record<string, unknown>` y lo manda tal cual, así
que el campo nuevo viaja solo. No los toques.

**No ejecutes `npm run build`.** Lo mide el controlador.

- [ ] **Step 1: El tipo y el estado**

En `DatosRenglon`, después de `cantidad: number;`:

```ts
    /** El precio tecleado, o null para que el servidor use el del catálogo, la remisión, el comisariato o la tarifa. */
    precio_unitario: number | null;
```

Agregar `'precio_unitario'` al tipo `Campo`. Importar de `./formato` lo que ya usa `ModalServicio`: `PRECIO_SERVICIO_MAX`, `parsearMonto`, `sinCerosFinales`, `validarMonto`.

Junto a `CANTIDAD_MAX`:

```tsx
/** Los mismos límites que el precio de un servicio del catálogo: la columna es la misma, `decimal(10,4)`. */
const OPCIONES_PRECIO = { nombre: 'el precio unitario', obligatorio: true, decimales: 4, minimo: 0, maximo: PRECIO_SERVICIO_MAX } as const;
```

Y junto a `const [cantidad, setCantidad] = useState('1');`:

```tsx
const [precio, setPrecio] = useState('');
```

- [ ] **Step 2: El precio que aplicaría, y la precarga**

Sustituir el cálculo de `precioEfectivo` (hoy en `ModalRenglon.tsx:300-312`) por dos cosas distintas. Primero, el precio heredado, que ahora incluye el caso del comisariato:

```tsx
// El precio que aplicaría sin teclear nada. En un tránsito ajeno NO es el del catálogo —ahí vale
// 99.00, que es relleno— sino la tarifa de la aeronave elegida; con una remisión o un comisariato
// elegidos, el de ese registro. Es con lo que se precarga el campo y contra lo que el servidor
// decide si el precio se capturó a mano.
const precioHeredado = pideMatricula
    ? (aeronaveElegida === null ? null : tarifaDelTramo(aeronaveElegida, servicio?.concepto))
    : esCombustible && remisionElegida !== null
      ? remisionElegida.precio
      : esComisariato && comisariatoElegido !== null
        ? comisariatoElegido.subtotal
        : (servicio?.precio_unitario ?? null);

// Al cambiar de servicio, de remisión, de comisariato o de aeronave, el precio heredado cambia y
// el campo vuelve a precargarse: si no, quedaría el de la elección anterior y se cobraría eso.
useEffect(() => {
    setPrecio(precioHeredado === null ? '' : sinCerosFinales(precioHeredado));
    setErrores(previos => (previos.precio_unitario ? { ...previos, precio_unitario: undefined } : previos));
}, [precioHeredado]);

/** Lo tecleado, solo si es un importe válido. Es lo que se manda y con lo que se calcula la vista previa. */
const precioTecleado = validarMonto(precio, OPCIONES_PRECIO) === null ? parsearMonto(precio) : null;
const precioEfectivo = precioTecleado === null ? null : String(precioTecleado);
```

El resto del fichero sigue leyendo `precioEfectivo` y no se toca: la vista previa pasa a calcularse con lo tecleado sola.

- [ ] **Step 3: El campo, encima de la cantidad**

Antes del `<div>` de la cantidad:

```tsx
                    <div>
                        <label htmlFor="renglon-precio" className={labelStyle}>
                            Precio unitario <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="renglon-precio"
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            value={precio}
                            onChange={e => {
                                setPrecio(e.target.value);
                                limpiarError('precio_unitario');
                            }}
                            className={campoConError(!!errores.precio_unitario)}
                            aria-invalid={errores.precio_unitario ? true : undefined}
                        />
                        {precioHeredado !== null && precioTecleado !== null && Number(precioHeredado) !== precioTecleado && (
                            <p className="mt-1 text-[10px] font-bold text-amber-700">
                                {remisionElegida !== null
                                    ? `La remisión ${remisionElegida.folio} trae ${remisionElegida.precio}: el renglón cobrará otro precio y la remisión seguirá marcada como cobrada.`
                                    : comisariatoElegido !== null
                                      ? `El comisariato trae ${comisariatoElegido.subtotal}: el renglón cobrará otro precio y el comisariato seguirá marcado como cobrado.`
                                      : aeronaveElegida !== null
                                        ? `La tarifa de ${aeronaveElegida.matricula ?? 'esa aeronave'} para este tramo es ${precioHeredado}.`
                                        : `El catálogo dice ${precioHeredado}.`}
                            </p>
                        )}
                        {errores.precio_unitario && <p className={errorStyle}>{errores.precio_unitario}</p>}
                    </div>
```

- [ ] **Step 4: La validación al enviar y el envío**

En el bloque que valida antes de guardar (junto a las líneas 374-375 de hoy):

```tsx
            const errorPrecio = validarMonto(precio, OPCIONES_PRECIO);
            if (errorPrecio !== null) nuevos.precio_unitario = errorPrecio;
```

Y en el objeto que se pasa a `onGuardar`, agregar:

```tsx
                precio_unitario: precioTecleado,
```

Con eso termina la tarea: `EditorPrefactura` ya reenvía el objeto completo.

- [ ] **Step 5: La vista previa del comisariato NO se toca**

Deja tal cual la rama que hoy pone `vistaPrevia = null` para un comisariato elegido, con su texto («El importe sale del comisariato, con el margen de su proveedor…»), y **agrégale este comentario**:

```tsx
        // Sigue sin vista previa aunque el precio ya se pueda teclear, y es a propósito: el margen
        // y el ajuste que se aplican salen del proveedor DEL COMISARIATO
        // (`RenglonDeComisariato` lee `$comisariato->factServicio`), que no tiene por qué ser el
        // servicio elegido en este menú. Calcularla con `servicio.margen` enseñaría una cifra que
        // el servidor no va a cobrar. El precio tecleado SÍ viaja.
```

- [ ] **Step 6: Comprobar los tipos**

El controlador corre `npm run build` y luego `npx tsc --noEmit`, y compara contra la línea base de un solo TS1117. Si aparece cualquier otro error, es de esta tarea.

- [ ] **Step 7: Commit**

```bash
git add resources/js/pages/Facturacion/components/ModalRenglon.tsx resources/js/pages/Facturacion/EditorPrefactura.tsx resources/js/stores/apiFacturacionCatalogos.ts
git commit -m "feat(facturacion): el precio unitario se teclea al agregar un servicio"
```

---

### Task 6: La marca en la tabla de renglones

**Files:**
- Modify: `resources/js/pages/Facturacion/EditorPrefactura.tsx:1455-1465` (las marcas del nombre del renglón)

**Interfaces:**
- Consumes: `renglon.precio_capturado` del payload de la Task 1.
- Produces: nada que otra tarea use.

**No ejecutes `npm run build`.**

- [ ] **Step 1: La marca**

Junto a la de «REVISAR: IMPORTE 0» y antes de la del grupo, con el mismo patrón de píldora:

```tsx
                                                    {renglon.precio_capturado && (
                                                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black text-amber-700" title="El precio de este renglón se tecleó al agregarlo: no salió del catálogo ni del registro del que nació.">
                                                            PRECIO A MANO
                                                        </span>
                                                    )}
```

- [ ] **Step 2: Comprobar los tipos**

Lo mide el controlador, igual que en la Task 5.

- [ ] **Step 3: Commit**

```bash
git add resources/js/pages/Facturacion/EditorPrefactura.tsx
git commit -m "feat(facturacion): la tabla de renglones marca el precio capturado a mano"
```

---

## Cierre

Cuando las seis tareas estén en verde:

1. `php artisan test` completo, **en serie**. La línea base antes de este trabajo es **3623 pruebas**.
2. `npm run build` (sale en 0) y después `npx tsc --noEmit` (un solo TS1117 en código generado).
3. Comprobar en el navegador con la receta de la memoria del proyecto: `EOLO/.claude/launch.json` al puerto **3000**, apartar `Eolo-plus/public/hot` y **devolverlo al terminar**; entrar con `Administrador EOLO`. Agregar un servicio de los que tienen precio 0 —Agua Potable, por ejemplo— con un precio tecleado, y ver la marca «PRECIO A MANO» en la tabla. `eolo_plus` es la base real: ese renglón de prueba se quita después y se dice al usuario que se escribió.
4. **No migrar `eolo_plus`.** La migración de la Task 1 queda pendiente y es decisión del usuario cuándo correrla.
