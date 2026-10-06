# Bloque 6a — Corregir una prefactura cerrada: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que una prefactura cerrada se pueda corregir sin perder lo que ya se imprimió: vuelve a ser editable conservando su folio, la versión impresa queda guardada completa y reimprimible, y volver a cerrarla la vuelve a sellar.

**Architecture:** un estado nuevo `reabierta` abre los cinco candados existentes sin tocarlos (todos preguntan por `estaCerrada()`), así que el editor de los bloques 2, 3 y 5 se reusa entero. Antes de abrir nada, un servicio guarda el documento completo en `fact_prefactura_versiones` como el **contrato de la vista** y no como filas del modelo. El cierre se modifica para reusar el folio existente en vez de pedir uno nuevo.

**Tech Stack:** Laravel 12, Pest 3, MariaDB 10.4, DomPDF (`barryvdh/laravel-dompdf`), Inertia 2 + React 19 + TypeScript, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-10-06-facturacion-6a-corregir-cerrada-design.md`

## Global Constraints

- **Aritmética de dinero en cadenas con `bc`** (`bcadd`, `bcsub`, `bcmul`, `bcdiv`, `bccomp`). Nunca `float` en el camino del dinero. La única excepción permitida es `number_format` en la plantilla, como último paso antes de imprimir.
- **La vista `pdf.prefactura` no llama a ningún método que calcule dinero ni que pueda lanzar.** Se renderiza DESPUÉS del `try/catch` del controlador: una excepción nacida ahí sería un **500 en lugar de un 422**.
- **`filas` se construye dentro del `try/catch` y sobre la colección `$prefactura->renglones` YA CARGADA**, nunca releyendo, porque `subtotalDerivado()` sí relee.
- La conexión `remota` es **solo lectura** y no se toca en este bloque.
- **NO correr `vendor/bin/pint` ni `prettier` sobre estos seis ficheros**, que ya violaban el estilo antes: `routes/api.php`, `resources/js/pages/Facturacion/EditorPrefactura.tsx`, `resources/js/components/.../ModalEstancia.tsx`, `resources/js/stores/apiFacturacionCatalogos.ts`, `app/Services/ImportadorMatriculas.php`, `tests/Feature/Facturacion/ImportadorCatalogosTest.php`. En los demás, `pint --dirty` antes de cada commit.
- **Añadido en la Task 2: `tests/Feature/Facturacion/EndpointsPrefacturaTest.php` también trae infracciones de estilo previas** (línea en blanco tras `<?php`, un `use` sin usar, una línea doble), y `pint --dirty` lo reformatea entero. La **Task 5 lo modifica**: si pint lo toca, hay que revertir a mano lo que no sea tu cambio, para que el diff de ese fichero sean solo tus líneas.
- **Las pruebas corren sobre sqlite y producción es MariaDB 10.4.** Se nota en dos sitios: el `json` de `documento` es texto en sqlite y el cast `'array'` lo resuelve en las dos; y las migraciones caen todas en un solo lote, así que el peligro del `rollback` descrito en la guía del bloque 5 **no se reproduce en pruebas**. No deducir el comportamiento del lote a partir de la suite.
- La suite corre **en serie**: `php artisan test`. `--parallel` da 22 fallos falsos en esta máquina.
- El único error aceptable de `npx tsc --noEmit` es el preexistente `resources/js/actions/App/Http/Controllers/Api/WalkAroundController.ts(905,5)`.
- Los casts se declaran con la **propiedad `protected $casts`**, como `FactPrefactura` y sus hermanos, no con el método `casts()`: manda la convención del proyecto.
- **`FactPrefactura::create()` exige `aeronave_id`: la columna es NOT NULL.** No se crea una prefactura a mano en una prueba: se usa `prefacturaBorrador()` de `tests/Pest.php`, que ya crea la aeronave y su satélite, y después `update()` para lo que haga falta. (Medido en la Task 1: el plan lo tenía mal.)
- **En una migración, `dateTime()` y no `timestamp()` para una columna de fecha NOT NULL.** En MariaDB un `TIMESTAMP NOT NULL` que sigue a uno nullable recibe el default `0000-00-00`, y con `NO_ZERO_DATE` la migración falla con el error 1067. **sqlite no lo detecta**, así que la suite en verde no prueba que la migración aplique: hay que correr `php artisan migrate` contra `eolo_plus`. (Medido en la Task 1.)
- Nada se fusiona a `main`. La rama es `facturacion`.

---

## Estructura de ficheros

| Fichero | Responsabilidad |
|---|---|
| `database/migrations/2026_10_06_100000_create_fact_prefactura_versiones_table.php` | la tabla de versiones sustituidas |
| `app/Models/FactPrefacturaVersion.php` | el modelo de una versión; casts y relaciones |
| `app/Models/FactPrefactura.php` | **modificar**: `ESTADO_REABIERTA`, `estaReabierta()`, relación `versiones()` |
| `app/Services/DocumentoDePrefactura.php` | el contrato del documento: `filas()`, `cifrasDeCerrada()`, `instantanea()`, `hidratar()` |
| `app/Services/PrefacturaNoReabribleException.php` | por qué no se puede reabrir, con su traducción a HTTP |
| `app/Services/ReaperturaPrefactura.php` | la transacción de reapertura |
| `app/Services/CierrePrefactura.php` | **modificar**: reusar folio, aceptar `reabierta` |
| `app/Http/Requests/Facturacion/ReabrirPrefacturaRequest.php` | el motivo, obligatorio |
| `app/Http/Controllers/Api/Facturacion/PrefacturaController.php` | **modificar**: `reabrir()`, el filtro del índice, el docblock de `descartar` |
| `app/Http/Controllers/Api/Facturacion/PrefacturaPdfController.php` | **modificar**: delega `filas()`, rechaza reabiertas, `version()` |
| `resources/views/pdf/prefactura.blade.php` | **modificar**: las dos marcas nuevas |
| `routes/api.php` | **modificar**: dos rutas |
| `database/seeders/FacturacionSubdepartamentosSeeder.php` | **modificar**: `factReabrirPrefactura` |
| `resources/js/pages/Facturacion/EditorPrefactura.tsx` | **modificar**: botón y modal de reabrir, aviso de reabierta, lista de versiones |
| `tests/Feature/Facturacion/ReaperturaPrefacturaTest.php` | reapertura, permiso, motivo, sello roto, concurrencia, versiones sucesivas |
| `tests/Feature/Facturacion/CierreDeReabiertaTest.php` | el folio no cambia y el contador no avanza |
| `tests/Feature/Facturacion/DocumentoDeVersionTest.php` | **la prueba maestra** y la reimpresión |

---

### Task 1: la tabla de versiones y el estado nuevo

**Files:**
- Create: `database/migrations/2026_10_06_100000_create_fact_prefactura_versiones_table.php`
- Create: `app/Models/FactPrefacturaVersion.php`
- Modify: `app/Models/FactPrefactura.php` (constantes al principio; relación junto a `pagos()`)
- Test: `tests/Feature/Facturacion/ReaperturaPrefacturaTest.php`

**Interfaces:**
- Produces: `FactPrefactura::ESTADO_REABIERTA = 'reabierta'`; `FactPrefactura::estaReabierta(): bool`; `FactPrefactura::versiones()` (hasMany, ordenada por `version`); el modelo `FactPrefacturaVersion` con cast `documento => array`.
- Consumes: nada.

- [ ] **Step 1: la prueba que falla**

```php
<?php

use App\Models\FactPrefactura;
use App\Models\FactPrefacturaVersion;

test('una version guarda el documento como arreglo y se lee por su prefactura', function () {
    $prefactura = FactPrefactura::create([
        'estado' => FactPrefactura::ESTADO_CERRADA,
        'folio' => 10001,
        'status' => FactPrefactura::STATUS_ACTIVO,
    ]);

    FactPrefacturaVersion::create([
        'prefactura_id' => $prefactura->id,
        'version' => 1,
        'folio' => 10001,
        'subtotal_sellado' => '100.00',
        'iva_sellado' => '16.00',
        'total_sellado' => '116.00',
        'iva_tasa_sellada' => '0.1600',
        'reabierta_at' => now(),
        'reabierta_por' => null,
        'motivo' => 'Faltaba el combustible.',
        'documento' => ['folio' => 10001, 'filas' => []],
    ]);

    $version = $prefactura->fresh()->versiones->sole();

    expect($version->documento)->toBe(['folio' => 10001, 'filas' => []])
        ->and($version->version)->toBe(1)
        ->and($version->motivo)->toBe('Faltaba el combustible.');
});

test('el estado reabierta cabe en la columna y no es cerrada', function () {
    $prefactura = FactPrefactura::create([
        'estado' => FactPrefactura::ESTADO_REABIERTA,
        'folio' => 10002,
        'status' => FactPrefactura::STATUS_ACTIVO,
    ]);

    expect(FactPrefactura::ESTADO_REABIERTA)->toBe('reabierta')
        ->and(strlen(FactPrefactura::ESTADO_REABIERTA))->toBeLessThanOrEqual(10)
        ->and($prefactura->fresh()->estado)->toBe('reabierta')
        ->and($prefactura->estaCerrada())->toBeFalse()
        ->and($prefactura->estaReabierta())->toBeTrue();
});

test('dos versiones no pueden llevar el mismo numero en la misma prefactura', function () {
    $prefactura = FactPrefactura::create([
        'estado' => FactPrefactura::ESTADO_CERRADA,
        'folio' => 10003,
        'status' => FactPrefactura::STATUS_ACTIVO,
    ]);

    $fila = [
        'prefactura_id' => $prefactura->id,
        'version' => 1,
        'folio' => 10003,
        'subtotal_sellado' => '1.00',
        'iva_sellado' => '0.16',
        'total_sellado' => '1.16',
        'iva_tasa_sellada' => '0.1600',
        'reabierta_at' => now(),
        'reabierta_por' => null,
        'motivo' => 'x',
        'documento' => [],
    ];

    FactPrefacturaVersion::create($fila);

    expect(fn () => FactPrefacturaVersion::create($fila))
        ->toThrow(Illuminate\Database\UniqueConstraintViolationException::class);
});
```

- [ ] **Step 2: correr y ver que falla**

Run: `php artisan test tests/Feature/Facturacion/ReaperturaPrefacturaTest.php`
Expected: FAIL con `Undefined constant App\Models\FactPrefactura::ESTADO_REABIERTA` y `Class "App\Models\FactPrefacturaVersion" not found`.

- [ ] **Step 3: la migración**

El `down()` borra la tabla, y eso importa: la guía de despliegue del bloque 5 documenta que un `migrate:rollback` a secas revierte **el lote entero**, no una migración. Esta tabla entra en el lote siguiente, así que un rollback después de desplegarla se la lleva con las versiones dentro. Va dicho en el docblock.

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Las versiones SUSTITUIDAS de una prefactura. La vigente vive en `fact_prefacturas`:
 * aquí solo entra lo que ya fue reemplazado, así que mientras nadie corrija nada la
 * tabla está vacía.
 *
 * `documento` guarda el contrato de la vista —lo que se imprimió, ya resuelto— y no las
 * filas del modelo, por la misma razón que existe el sello: si mañana cambia `importe()`,
 * reconstruir el documento desde las filas cambiaría lo que dice un papel que ya salió.
 *
 * CUIDADO con el rollback: `down()` borra la tabla con las versiones dentro, y
 * `migrate:rollback` a secas revierte el LOTE completo, no una migración (ver la guía de
 * despliegue del bloque 5). Después de desplegar esto, un rollback es pérdida de datos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_prefactura_versiones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('prefactura_id')->constrained('fact_prefacturas')->cascadeOnDelete();
            $table->unsignedSmallInteger('version');

            // Desnormalizado a propósito: la versión es un registro histórico y no debe
            // depender de leer una fila que sí cambia. (NO es porque el folio pueda faltar:
            // reabrir lo CONSERVA, y eso es el invariante de la Task 4.)
            $table->unsignedInteger('folio');

            // Mismos tipos que las columnas selladas de `fact_prefacturas`: decimal(12,2)
            // los tres montos y decimal(5,4) la tasa. Si divergieran, el sello guardado no
            // sería comparable con el que se verifica.
            $table->decimal('subtotal_sellado', 12, 2);
            $table->decimal('iva_sellado', 12, 2);
            $table->decimal('total_sellado', 12, 2);
            $table->decimal('iva_tasa_sellada', 5, 4);

            $table->timestamp('cerrada_at')->nullable();
            $table->foreignId('cerrada_por')->nullable()->constrained('users');

            $table->timestamp('reabierta_at');
            $table->foreignId('reabierta_por')->nullable()->constrained('users');
            $table->string('motivo', 500);

            $table->json('documento');
            $table->timestamps();

            // La red del número de versión: dos sesiones reabriendo a la vez no pueden
            // escribir dos veces la 1.
            $table->unique(['prefactura_id', 'version']);
            $table->index('folio');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_prefactura_versiones');
    }
};
```

- [ ] **Step 4: el modelo**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Una versión sustituida de una prefactura: el documento tal como se imprimió antes de
 * que alguien lo corrigiera.
 *
 * `documento` es dato muerto: no se consulta relacionalmente, solo se lee entero para
 * reimprimir. Por eso es JSON y no tablas hijas.
 */
class FactPrefacturaVersion extends Model
{
    protected $table = 'fact_prefactura_versiones';

    protected $fillable = [
        'prefactura_id', 'version', 'folio',
        'subtotal_sellado', 'iva_sellado', 'total_sellado', 'iva_tasa_sellada',
        'cerrada_at', 'cerrada_por',
        'reabierta_at', 'reabierta_por', 'motivo',
        'documento',
    ];

    protected $casts = [
        'version' => 'integer',
        'folio' => 'integer',
        'subtotal_sellado' => 'decimal:2',
        'iva_sellado' => 'decimal:2',
        'total_sellado' => 'decimal:2',
        'iva_tasa_sellada' => 'decimal:4',
        'cerrada_at' => 'datetime',
        'reabierta_at' => 'datetime',
        'documento' => 'array',
    ];

    public function prefactura(): BelongsTo
    {
        return $this->belongsTo(FactPrefactura::class, 'prefactura_id');
    }

    public function cerradaPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cerrada_por');
    }

    public function reabiertaPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reabierta_por');
    }
}
```

- [ ] **Step 5: la constante, el predicado y la relación**

En `app/Models/FactPrefactura.php`, junto a las otras constantes de estado:

```php
    public const ESTADO_CERRADA = 'cerrada';

    /**
     * Cerrada que volvió a ser editable. Estado propio y NO `borrador` con folio: así
     * `descartar()`, que filtra por `estado = borrador`, no puede descartar una prefactura
     * cuyo folio ya se consumió.
     */
    public const ESTADO_REABIERTA = 'reabierta';
```

Y junto a `estaCerrada()` y `pagos()`:

```php
    public function estaReabierta(): bool
    {
        return $this->estado === self::ESTADO_REABIERTA;
    }

    public function versiones()
    {
        return $this->hasMany(FactPrefacturaVersion::class, 'prefactura_id')->orderBy('version');
    }
```

- [ ] **Step 6: correr y ver que pasa**

Run: `php artisan test tests/Feature/Facturacion/ReaperturaPrefacturaTest.php`
Expected: PASS, 3 pruebas.

- [ ] **Step 7: commit**

```bash
vendor/bin/pint --dirty
git add database/migrations app/Models tests/Feature/Facturacion/ReaperturaPrefacturaTest.php
git commit -m "feat(facturacion): la tabla de versiones y el estado reabierta"
```

---

### Task 2: el contrato del documento

Mueve `filasDe()` del controlador de PDF a un servicio compartido y le añade las dos operaciones nuevas: tomar la instantánea e hidratarla de vuelta. **Mover y no copiar** es el punto: dos copias de esa función harían que el documento guardado pudiera divergir del impreso, que es precisamente lo que el bloque entero existe para evitar.

**Files:**
- Create: `app/Services/DocumentoDePrefactura.php`
- Modify: `app/Http/Controllers/Api/Facturacion/PrefacturaPdfController.php` (borrar `filasDe()`, delegar; `pdf()` usa `cifrasDeCerrada()`)
- Modify: `tests/Pest.php` (añadir `prefacturaCerradaParaDocumento()`; **mover** aquí `completarParaCerrar()`)
- Modify: `tests/Feature/Facturacion/EndpointsPrefacturaTest.php` (quitar `completarParaCerrar()`, que se fue a `Pest.php`)
- Test: `tests/Feature/Facturacion/DocumentoDeVersionTest.php`

**Interfaces:**
- Consumes: `FactPrefactura` con `renglones`, `pagos.formaPago`, `cliente`, `aeronave.tipoAeronave`, `satelite.categoria`, `cerradaPor` ya cargados.
- Produces:
  - `filas(FactPrefactura $p): array` — `list<array{concepto: string, cortesia: bool, remision: ?string, precio: ?string, cantidad: ?int, importe: string}>`
  - `cifrasDeCerrada(FactPrefactura $p): array` — `array{subtotal: string, iva: string, ivaEtiqueta: string, total: string, cambio: string, filas: array}`
  - `instantanea(FactPrefactura $p): array` — el documento completo para guardar
  - `hidratar(array $documento): FactPrefactura` — un modelo NO persistido
  - Las tres primeras pueden lanzar `UnexpectedValueException`; quien llame traduce a 422.

- [ ] **Step 1: la prueba que falla**

```php
<?php

use App\Models\FactPrefactura;
use App\Services\DocumentoDePrefactura;

test('la instantanea trae todo lo que la plantilla lee de la prefactura', function () {
    $cerrada = prefacturaCerradaParaDocumento();

    $documento = app(DocumentoDePrefactura::class)->instantanea($cerrada);

    // Las claves son el contrato: si la plantilla empieza a leer algo que no esta aqui,
    // las versiones viejas se imprimirian incompletas.
    expect(array_keys($documento))->toEqualCanonicalizing([
        'folio', 'cerrada_at', 'llegada_at', 'salida_at', 'origen', 'destino',
        'nota_externa', 'cliente', 'aeronave', 'pagos',
        'subtotal', 'iva', 'ivaEtiqueta', 'total', 'cambio', 'filas', 'elaboradoPor',
    ]);

    expect($documento['folio'])->toBe($cerrada->folio)
        ->and($documento['subtotal'])->toBe((string) $cerrada->subtotal_sellado)
        ->and($documento['cliente']['nombre'])->toBe($cerrada->cliente->nombre)
        ->and($documento['aeronave']['matricula'])->toBe($cerrada->aeronave->matricula)
        ->and($documento['filas'])->toHaveCount(1);
});

test('hidratar devuelve un modelo que NO se guarda y que la plantilla puede leer', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $servicio = app(DocumentoDePrefactura::class);

    $documento = $servicio->instantanea($cerrada);
    $hidratada = $servicio->hidratar($documento);

    expect($hidratada->exists)->toBeFalse()
        ->and($hidratada->folio)->toBe($cerrada->folio)
        ->and($hidratada->cerrada_at->format('Y-m-d H:i'))->toBe($cerrada->cerrada_at->format('Y-m-d H:i'))
        ->and($hidratada->cliente?->nombre)->toBe($cerrada->cliente->nombre)
        ->and($hidratada->aeronave?->matricula)->toBe($cerrada->aeronave->matricula)
        ->and($hidratada->aeronave?->tipoAeronave?->nombre)->toBe($cerrada->aeronave->tipoAeronave->nombre)
        ->and($hidratada->pagos)->toHaveCount($cerrada->pagos->count());

    // Y de verdad no se guardo nada.
    expect(FactPrefactura::count())->toBe(1);
});

test('imprimir una cerrada sigue dando las mismas cifras que antes del refactor', function () {
    $cerrada = prefacturaCerradaParaDocumento();

    $cifras = app(DocumentoDePrefactura::class)->cifrasDeCerrada($cerrada);

    expect($cifras['subtotal'])->toBe((string) $cerrada->subtotal_sellado)
        ->and($cifras['iva'])->toBe((string) $cerrada->iva_sellado)
        ->and($cifras['total'])->toBe((string) $cerrada->total_sellado)
        ->and($cifras['ivaEtiqueta'])->toBe($cerrada->ivaTasaEtiqueta())
        ->and($cifras['filas'])->toBeArray();
});
```

**El ayudante va en `tests/Pest.php`, NO en el fichero de pruebas**, y esto no es una preferencia de estilo: las tareas 3, 4, 5, 6 y 7 lo usan desde cuatro ficheros distintos, y `php artisan test <un fichero>` no carga los demás. Declarado en `DocumentoDeVersionTest.php` daría «undefined function» en los comandos `Run` de este mismo plan. `Pest.php` ya es la casa de `usuarioConSubdepartamento()`, `renglonDe()` y `prefacturaCompleta()`: va con ellos, en la sección «Functions».

**Y hay que MOVER `completarParaCerrar()` de `tests/Feature/Facturacion/EndpointsPrefacturaTest.php:209` a `tests/Pest.php`, sin dejar copia**, por la misma razón: hoy solo existe si corre ese fichero, y las tareas 2, 4 y 7 lo necesitan desde otros. Dejar dos copias sería peor que el problema. El paso 5 de esta tarea corre `EndpointsPrefacturaTest.php`, así que un movimiento mal hecho se ve enseguida.

**Ojo con el nombre:** no se puede llamar `aeronaveConTarifas()`, que ya existe como función global de Pest en `TarifasPropiasTest.php:15`; redeclararla tumba la suite entera.

```php
/**
 * Una cerrada completa, con TODO lo que la plantilla imprime: cliente con sus tres campos,
 * aeronave con tipo y categoria, fechas, origen y destino, nota externa, un renglon y un pago.
 *
 * Se apoya en `prefacturaBorrador()` en vez de crear la prefactura a mano, porque
 * `fact_prefacturas.aeronave_id` es NOT NULL y ese ayudante ya encadena las tres tablas.
 * Lo que SI hay que anadirle: `prefacturaBorrador()` crea la aeronave sin tipo y el satelite
 * sin categoria, y la plantilla imprime los dos.
 */
function prefacturaCerradaParaDocumento(): App\Models\FactPrefactura
{
    $p = prefacturaBorrador();

    // `aeronaves.aeronave_id` apunta al TIPO (ver la tabla de nombres mas abajo).
    $tipo = App\Models\TipoAeronave::create(['nombre' => 'Learjet 45']);
    $p->aeronave->update(['aeronave_id' => $tipo->id]);

    // La categoria vive en el SATELITE, `fact_aeronaves`, cuyo `aeronave_id` apunta a `aeronaves.id`.
    $categoria = App\Models\FactCategoriaAeronave::create(['nombre' => 'Mediana', 'status' => 'A']);
    App\Models\FactAeronave::where('aeronave_id', $p->aeronave_id)
        ->update(['categoria_aeronave_id' => $categoria->id]);

    $p->update([
        'cliente_id' => App\Models\FactCliente::create([
            'nombre' => 'Cliente del documento',
            'telefono' => '5555555555',
            'correo' => 'cliente@example.test',
        ])->id,
        'llegada_at' => now()->subDay(),
        'salida_at' => now(),
        'origen' => 'MMMX',
        'destino' => 'MMTO',
        'nota_externa' => 'Gracias por su visita.',
    ]);

    renglonDe($p, 100.0, 1);

    // Un pago EXACTO, para que el documento lleve su tabla de pagos: sin pagos, la mitad
    // del contrato de la vista no se ejercita. Pagar exacto deja `cambio` en 0.00 y la
    // linea CAMBIO NO sale en el papel: esa rama se cubre en una prueba aparte, con una
    // prefactura que paga de mas. Y el ayudante tiene que seguir pagando exacto, porque la
    // prueba de sobrepago de la Task 4 crea el sobrepago CORRIGIENDO a la baja.
    // `formasDePago()` y `pagoDe()` son los ayudantes que ya usa todo el proyecto
    // (`tests/Pest.php`): en la base de pruebas NO hay formas de pago sembradas, porque
    // corren las migraciones y no los seeders, asi que hay que crearlas.
    pagoDe($p->fresh(), formasDePago()[App\Models\FactFormaPago::CONCEPTO_EFECTIVO], '116.00');

    return app(App\Services\CierrePrefactura::class)
        ->cerrar($p->fresh(), usuarioConSubdepartamento('factPrefacturas', 'Facturacion')->id, confirmarSinCobro: true)
        ->load(['renglones', 'pagos.formaPago', 'cliente', 'aeronave.tipoAeronave', 'satelite.categoria', 'cerradaPor']);
}
```

Ya verificado, no hace falta volver a comprobarlo: `usuarioConSubdepartamento()`, `renglonDe()` y `prefacturaCompleta()` **están en `tests/Pest.php`** y se cargan siempre; `completarParaCerrar()` está en `EndpointsPrefacturaTest.php:209` y hay que **moverlo** a `Pest.php` como dice arriba.

- [ ] **Step 2: correr y ver que falla**

Run: `php artisan test tests/Feature/Facturacion/DocumentoDeVersionTest.php`
Expected: FAIL con `Class "App\Services\DocumentoDePrefactura" not found`.

- [ ] **Step 3: el servicio**

```php
<?php

namespace App\Services;

use App\Models\Aeronave;
use App\Models\FactAeronave;
use App\Models\FactCategoriaAeronave;
use App\Models\FactCliente;
use App\Models\FactFormaPago;
use App\Models\FactPrefactura;
use App\Models\FactPrefacturaPago;
use App\Models\TipoAeronave;
use Illuminate\Support\Collection;

/**
 * El documento de una prefactura: lo que se imprime, en un solo lugar.
 *
 * Existe para que la instantánea que se guarda al reabrir y el papel que se imprime salgan
 * de la MISMA función. Si fueran dos copias podrían divergir, y entonces la versión
 * guardada no sería el documento que el cliente tiene en la mano, que es todo el propósito
 * del bloque.
 *
 * Nada de aquí se llama desde la vista: todo se llama desde el `try/catch` del controlador,
 * porque `importe()` y `ivaTasaEtiqueta()` pueden lanzar y la vista se renderiza después.
 */
class DocumentoDePrefactura
{
    /**
     * Las filas del documento, ya resueltas, en el orden en que se imprimen.
     *
     * [Aquí se MUEVE íntegro el docblock de `PrefacturaPdfController::filasDe()`, con sus
     * dos invariantes: se construye dentro del try/catch del llamador, y sobre la colección
     * `$prefactura->renglones` YA CARGADA y no otra lectura.]
     *
     * @return list<array{concepto: string, cortesia: bool, remision: ?string, precio: ?string, cantidad: ?int, importe: string}>
     */
    public function filas(FactPrefactura $prefactura): array
    {
        // Cuerpo IDÉNTICO al de PrefacturaPdfController::filasDe(): se mueve, no se reescribe.
        $filas = [];
        $lugarDelGrupo = [];

        foreach ($prefactura->renglones as $renglon) {
            if ($renglon->grupo === null) {
                $filas[] = [
                    'concepto' => $renglon->nombre_servicio,
                    'cortesia' => (bool) $renglon->es_cortesia,
                    'remision' => $renglon->remision,
                    'precio' => (string) $renglon->precio_unitario,
                    'cantidad' => $renglon->cantidad,
                    'importe' => $renglon->importe(),
                ];

                continue;
            }

            if (! isset($lugarDelGrupo[$renglon->grupo])) {
                $lugarDelGrupo[$renglon->grupo] = count($filas);
                $filas[] = [
                    'concepto' => $renglon->grupo,
                    'cortesia' => false,
                    'remision' => null,
                    'precio' => null,
                    'cantidad' => null,
                    'importe' => '0.00',
                ];
            }

            $lugar = $lugarDelGrupo[$renglon->grupo];
            $filas[$lugar]['importe'] = bcadd($filas[$lugar]['importe'], $renglon->importe(), 2);
        }

        return $filas;
    }

    /**
     * Las seis cifras de una cerrada, SELLADAS. Nunca la derivación: el papel muestra lo
     * que el cliente vio cuando se emitió.
     *
     * @return array{subtotal: string, iva: string, ivaEtiqueta: string, total: string, cambio: string, filas: array}
     *
     * @throws \UnexpectedValueException si un renglón o la tasa no se reconocen.
     */
    public function cifrasDeCerrada(FactPrefactura $prefactura): array
    {
        return [
            'subtotal' => (string) $prefactura->subtotal_sellado,
            'iva' => (string) $prefactura->iva_sellado,
            'ivaEtiqueta' => $prefactura->ivaTasaEtiqueta(),
            'total' => (string) $prefactura->total_sellado,
            'cambio' => $prefactura->cambio(),
            'filas' => $this->filas($prefactura),
        ];
    }

    /**
     * El documento entero, listo para guardar como JSON.
     *
     * Las claves salen de LEER la plantilla, no de suponer: son exactamente lo que
     * `pdf.prefactura` lee de `$prefactura` más las cifras calculadas. `tipo_destino` no va
     * porque la plantilla no lo lee; la tasa que de él se derivó viaja en `ivaEtiqueta`.
     *
     * @throws \UnexpectedValueException si un renglón o la tasa no se reconocen.
     */
    public function instantanea(FactPrefactura $prefactura): array
    {
        return [
            'folio' => $prefactura->folio,
            'cerrada_at' => $prefactura->cerrada_at?->toIso8601String(),
            'llegada_at' => $prefactura->llegada_at?->toIso8601String(),
            'salida_at' => $prefactura->salida_at?->toIso8601String(),
            'origen' => $prefactura->origen,
            'destino' => $prefactura->destino,
            'nota_externa' => $prefactura->nota_externa,
            'cliente' => $prefactura->cliente === null ? null : [
                'nombre' => $prefactura->cliente->nombre,
                'telefono' => $prefactura->cliente->telefono,
                'correo' => $prefactura->cliente->correo,
            ],
            'aeronave' => $prefactura->aeronave === null ? null : [
                'matricula' => $prefactura->aeronave->matricula,
                'tipo' => $prefactura->aeronave->tipoAeronave?->nombre,
                'categoria' => $prefactura->satelite?->categoria?->nombre,
            ],
            'pagos' => $prefactura->pagos
                ->map(fn ($pago) => ['forma' => $pago->formaPago?->nombre, 'monto' => (string) $pago->monto])
                ->values()
                ->all(),
            'elaboradoPor' => $prefactura->cerradaPor?->name ?? 'Sin registrar',
        ] + $this->cifrasDeCerrada($prefactura);
    }

    /**
     * Reconstruye el modelo que la plantilla necesita, SIN persistirlo.
     *
     * Se hidrata un modelo en vez de refactorizar la plantilla para que reciba sus veinte
     * valores como claves planas: esa refactorización pondría en riesgo el invariante del
     * bloque 4 —la vista no llama a nada que pueda lanzar— sin comprar nada.
     *
     * Las relaciones se ponen con `setRelation`, así que la vista no dispara ni una consulta
     * y `$prefactura->aeronave?->tipoAeronave?->nombre` resuelve contra estos objetos.
     */
    public function hidratar(array $documento): FactPrefactura
    {
        $prefactura = new FactPrefactura([
            'folio' => $documento['folio'],
            'cerrada_at' => $documento['cerrada_at'],
            'llegada_at' => $documento['llegada_at'],
            'salida_at' => $documento['salida_at'],
            'origen' => $documento['origen'],
            'destino' => $documento['destino'],
            'nota_externa' => $documento['nota_externa'],
            'estado' => FactPrefactura::ESTADO_CERRADA,
        ]);

        $prefactura->setRelation('cliente', $documento['cliente'] === null ? null : new FactCliente([
            'nombre' => $documento['cliente']['nombre'],
            'telefono' => $documento['cliente']['telefono'],
            'correo' => $documento['cliente']['correo'],
        ]));

        // `aeronave` y `satelite` son DOS modelos distintos, no dos vistas del mismo:
        // `aeronave` es `App\Models\Aeronave` (tabla `aeronaves`, con la matrícula) y
        // `satelite` es `App\Models\FactAeronave` (tabla `fact_aeronaves`, con la categoría
        // y las tarifas propias). La plantilla lee la matrícula y el tipo del primero y la
        // categoría del segundo.
        $aeronave = null;
        $satelite = null;

        if ($documento['aeronave'] !== null) {
            $aeronave = new Aeronave(['matricula' => $documento['aeronave']['matricula']]);
            $aeronave->setRelation('tipoAeronave', $documento['aeronave']['tipo'] === null
                ? null
                : new TipoAeronave(['nombre' => $documento['aeronave']['tipo']]));

            $satelite = new FactAeronave;
            $satelite->setRelation('categoria', $documento['aeronave']['categoria'] === null
                ? null
                : new FactCategoriaAeronave(['nombre' => $documento['aeronave']['categoria']]));
        }

        $prefactura->setRelation('aeronave', $aeronave);

        // `satelite` es un `hasOne`: se pone UN modelo, no una colección.
        $prefactura->setRelation('satelite', $satelite);

        $prefactura->setRelation('pagos', Collection::make($documento['pagos'])->map(function (array $pago) {
            $modelo = new FactPrefacturaPago(['monto' => $pago['monto']]);
            $modelo->setRelation('formaPago', $pago['forma'] === null
                ? null
                : new FactFormaPago(['nombre' => $pago['forma']]));

            return $modelo;
        }));

        return $prefactura;
    }
}
```

**Trampa de nombres, ya verificada — no volver a deducirla:**

| Relación | Modelo | Tabla | De dónde sale lo que imprime |
|---|---|---|---|
| `$prefactura->aeronave` | `App\Models\Aeronave` | `aeronaves` | `matricula`, y `tipoAeronave->nombre` |
| `$prefactura->satelite` | `App\Models\FactAeronave` | `fact_aeronaves` | `categoria->nombre` |

**No existe `FactTipoAeronave`**: el tipo es `App\Models\TipoAeronave` (tabla `tipo_aeronaves`, columna `nombre`), y se llega a él desde `Aeronave`.

Y el detalle que muerde: **`aeronaves.aeronave_id` y `fact_aeronaves.aeronave_id` son la misma columna con significados distintos.** En `aeronaves` es la llave al tipo (`Aeronave::tipoAeronave()` hace `belongsTo(TipoAeronave::class, 'aeronave_id')`); en `fact_aeronaves` es la llave a `aeronaves.id` (`FactPrefactura::satelite()` hace `hasOne(FactAeronave::class, 'aeronave_id', 'aeronave_id')`). Confundirlas da una categoría que no corresponde a la matrícula.

- [ ] **Step 4: el controlador delega**

En `PrefacturaPdfController`: inyectar el servicio en el constructor con promoción de propiedades, **con el nombre exacto `$documento`** porque la Task 6 lo llama como `$this->documento`:

```php
    public function __construct(private DocumentoDePrefactura $documento) {}
```

Después **borrar** `filasDe()` entero y sustituir sus dos llamadas. En `pdf()`, el bloque `$cifras` pasa a ser una línea:

```php
        try {
            $discrepancias = $prefactura->discrepanciasDelSello();

            $cifras = $this->documento->cifrasDeCerrada($prefactura);
        } catch (UnexpectedValueException $e) {
```

En `cotizacion()`, cambiar `'filas' => $this->filasDe($prefactura)` por `'filas' => $this->documento->filas($prefactura)`. **No tocar nada más de `cotizacion()`**: sus cifras son derivadas, no selladas.

- [ ] **Step 5: correr las pruebas del documento Y las del bloque 4**

Run: `php artisan test tests/Feature/Facturacion/DocumentoDeVersionTest.php tests/Feature/Facturacion/ImpresionPrefacturaTest.php tests/Feature/Facturacion/DocumentoPrefacturaTest.php`
Expected: PASS. Las del bloque 4 son la red del refactor: si alguna falla, el movimiento de `filasDe()` cambió comportamiento y hay que arreglarlo, no actualizar la prueba.

- [ ] **Step 6: commit**

```bash
vendor/bin/pint --dirty
git add app/Services/DocumentoDePrefactura.php app/Http/Controllers/Api/Facturacion/PrefacturaPdfController.php tests/Feature/Facturacion/DocumentoDeVersionTest.php
git commit -m "refactor(facturacion): el documento de una prefactura, en un solo lugar"
```

---

### Task 3: el servicio de reapertura

**Files:**
- Create: `app/Services/PrefacturaNoReabribleException.php`
- Create: `app/Services/ReaperturaPrefactura.php`
- Test: `tests/Feature/Facturacion/ReaperturaPrefacturaTest.php` (se añade a lo de la Task 1)

**Interfaces:**
- Consumes: `DocumentoDePrefactura::instantanea()`, `FactPrefacturaVersion`, `FactPrefactura::ESTADO_REABIERTA`.
- Produces: `ReaperturaPrefactura::reabrir(FactPrefactura $p, int $userId, string $motivo): FactPrefactura`. Lanza `PrefacturaNoReabribleException` (409) y deja pasar `UnexpectedValueException` (que el controlador traduce a 422).

- [ ] **Step 1: las pruebas que fallan**

```php
test('reabrir guarda la version, limpia el sello y deja la prefactura editable', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $folio = $cerrada->folio;
    $selloAnterior = (string) $cerrada->total_sellado;
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');

    $reabierta = app(App\Services\ReaperturaPrefactura::class)
        ->reabrir($cerrada, $usuario->id, 'Faltaba el combustible del dia 3.');

    expect($reabierta->estado)->toBe(FactPrefactura::ESTADO_REABIERTA)
        ->and($reabierta->folio)->toBe($folio)
        ->and($reabierta->subtotal_sellado)->toBeNull()
        ->and($reabierta->iva_sellado)->toBeNull()
        ->and($reabierta->total_sellado)->toBeNull()
        ->and($reabierta->iva_tasa_sellada)->toBeNull()
        ->and($reabierta->cerrada_at)->toBeNull()
        ->and($reabierta->cerrada_por)->toBeNull();

    $version = $reabierta->versiones()->sole();

    expect($version->version)->toBe(1)
        ->and($version->folio)->toBe($folio)
        ->and((string) $version->total_sellado)->toBe($selloAnterior)
        ->and($version->motivo)->toBe('Faltaba el combustible del dia 3.')
        ->and($version->reabierta_por)->toBe($usuario->id)
        ->and($version->documento['folio'])->toBe($folio);
});

test('reabierta, los renglones y los pagos vuelven a aceptar cambios', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');

    app(App\Services\ReaperturaPrefactura::class)->reabrir($cerrada, $usuario->id, 'Motivo suficiente.');

    // Lo que ANTES lanzaba RenglonDePrefacturaCerradaException ahora pasa: los cinco
    // candados preguntan por estaCerrada(), y una reabierta no esta cerrada.
    expect(fn () => renglonDe($cerrada->fresh(), 50.0, 1))->not->toThrow(
        App\Services\RenglonDePrefacturaCerradaException::class
    );
});

test('un borrador no se reabre', function () {
    $borrador = prefacturaBorrador();

    expect(fn () => app(App\Services\ReaperturaPrefactura::class)->reabrir($borrador, 1, 'x'))
        ->toThrow(App\Services\PrefacturaNoReabribleException::class);

    expect(App\Models\FactPrefacturaVersion::count())->toBe(0);
});

test('una cerrada con el sello roto NO se reabre: primero se aclara la diferencia', function () {
    $cerrada = prefacturaCerradaParaDocumento();

    // Se rompe el sello por abajo, sin pasar por el modelo del renglon.
    DB::table('fact_prefacturas')->where('id', $cerrada->id)->update(['total_sellado' => '99999.00']);

    expect(fn () => app(App\Services\ReaperturaPrefactura::class)
        ->reabrir($cerrada->fresh(), 1, 'Motivo suficiente.'))
        ->toThrow(App\Services\PrefacturaNoReabribleException::class);

    expect(App\Models\FactPrefacturaVersion::count())->toBe(0)
        ->and($cerrada->fresh()->estado)->toBe(FactPrefactura::ESTADO_CERRADA);
});
```

```php
test('si otra sesion reabre entre el chequeo y el candado, la segunda se rechaza y hay UNA version', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $usuario = usuarioConSubdepartamento('factReabrirPrefactura', 'Facturacion');
    $reapertura = app(App\Services\ReaperturaPrefactura::class);

    // El patron de carrera del proyecto: se cuela la otra sesion cuando el servicio ya paso
    // su comprobacion rapida y todavia no tomo el candado.
    $hecho = false;
    DB::listen(function ($consulta) use ($cerrada, $usuario, $reapertura, &$hecho) {
        if (! $hecho && str_contains($consulta->sql, 'fact_prefacturas')) {
            $hecho = true;
            $reapertura->reabrir($cerrada->fresh(), $usuario->id, 'La otra sesion llego primero.');
        }
    });

    expect(fn () => $reapertura->reabrir($cerrada->fresh(), $usuario->id, 'Y esta llego despues.'))
        ->toThrow(App\Services\PrefacturaNoReabribleException::class);

    // Una sola version, y el folio intacto: la perdedora no escribio nada.
    expect($cerrada->fresh()->versiones()->count())->toBe(1)
        ->and($cerrada->fresh()->folio)->not->toBeNull();
});

test('la reapertura queda en la bitacora con el motivo y el sello anterior', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $usuario = usuarioConSubdepartamento('factReabrirPrefactura', 'Facturacion');
    $totalAnterior = (string) $cerrada->total_sellado;

    app(App\Services\ReaperturaPrefactura::class)
        ->reabrir($cerrada, $usuario->id, 'Faltaba el combustible del dia 3.');

    $registro = App\Models\Bitacora::where('modulo', App\Models\Bitacora::MODULO_FACTURACION_PREFACTURAS)
        ->where('registro_id', $cerrada->id)
        ->where('accion', App\Models\Bitacora::ACCION_ACTUALIZAR)
        ->latest('id')
        ->first();

    expect($registro)->not->toBeNull()
        ->and($registro->descripcion)->toContain('Faltaba el combustible del dia 3.')
        ->and($registro->descripcion)->toContain((string) $cerrada->folio);

    // El sello anterior tiene que quedar registrado: es lo que convierte la reapertura en
    // auditable en vez de en un cambio sin rastro, que es el defecto del sistema viejo.
    expect(json_encode($registro->datos_anteriores))->toContain($totalAnterior);
});
```

**Comprobar el nombre real de las columnas de `bitacoras`** (`registro_id`, `datos_anteriores`) y cómo las lee el modelo antes de escribir la segunda: el proyecto ya tiene el ayudante `bitacoraDePrefacturas()` en `EndpointsPrefacturaTest.php:237` y pruebas de bitácora que enseñan la forma.

- [ ] **Step 2: correr y ver que falla**

Run: `php artisan test tests/Feature/Facturacion/ReaperturaPrefacturaTest.php`
Expected: FAIL con `Class "App\Services\ReaperturaPrefactura" not found`.

- [ ] **Step 3: la excepción**

Seguir el patrón de `RenglonDePrefacturaCerradaException`, que ya traduce a HTTP:

```php
<?php

namespace App\Services;

use DomainException;
use Illuminate\Http\JsonResponse;

/**
 * No se puede reabrir: no está cerrada, o su sello no coincide con sus renglones.
 *
 * Lo segundo importa más de lo que parece: reabrir guarda una instantánea, y guardar como
 * «esto es lo que se imprimió» un documento del que el propio sistema sabe que no cuadra
 * convertiría una discrepancia detectable en un registro histórico falso.
 */
class PrefacturaNoReabribleException extends DomainException
{
    public function aJson(): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'codigo' => 'no_reabrible',
        ], 409);
    }
}
```

- [ ] **Step 4: el servicio**

```php
<?php

namespace App\Services;

use App\Models\Bitacora;
use App\Models\FactPrefactura;
use App\Models\FactPrefacturaVersion;
use Illuminate\Support\Facades\DB;

/**
 * Reabre una prefactura cerrada: guarda el documento que se imprimió como una versión y la
 * deja editable, con su folio.
 *
 * El folio NO se libera ni se vuelve a pedir: es el mismo documento corregido, no otro.
 * Quien lo conserva es `CierrePrefactura::cerrar()`, que pide folio nuevo solo si la
 * prefactura no tiene.
 */
class ReaperturaPrefactura
{
    public function __construct(private DocumentoDePrefactura $documento) {}

    /**
     * @throws PrefacturaNoReabribleException si no está cerrada o su sello no cuadra.
     * @throws \UnexpectedValueException si un renglón o la tasa no se reconocen (el
     *                                   controlador lo traduce a 422).
     */
    public function reabrir(FactPrefactura $prefactura, int $userId, string $motivo): FactPrefactura
    {
        // Falla rápido sin abrir transacción; se REPITE adentro, ya con candado, porque la
        // instancia recibida pudo quedar vieja.
        if (! $prefactura->estaCerrada()) {
            throw new PrefacturaNoReabribleException('Solo una prefactura cerrada se reabre.');
        }

        return DB::transaction(function () use ($prefactura, $userId, $motivo) {
            // CANDADO antes de leer los renglones: sin él, dos sesiones reabriendo a la vez
            // tomarían dos instantáneas de lo mismo y pelearían por el número de versión.
            $actual = FactPrefactura::query()->whereKey($prefactura->id)->lockForUpdate()->firstOrFail();

            if (! $actual->estaCerrada()) {
                throw new PrefacturaNoReabribleException('Solo una prefactura cerrada se reabre.');
            }

            $actual->load(['renglones', 'pagos.formaPago', 'cliente', 'aeronave.tipoAeronave', 'satelite.categoria', 'cerradaPor']);

            if ($actual->selloDiscrepa()) {
                throw new PrefacturaNoReabribleException(
                    'El sello de esta prefactura no coincide con sus renglones, así que no se puede reabrir. Aclara la diferencia primero.'
                );
            }

            $documento = $this->documento->instantanea($actual);

            $version = ((int) FactPrefacturaVersion::query()
                ->where('prefactura_id', $actual->id)
                ->max('version')) + 1;

            FactPrefacturaVersion::create([
                'prefactura_id' => $actual->id,
                'version' => $version,
                'folio' => $actual->folio,
                'subtotal_sellado' => $actual->subtotal_sellado,
                'iva_sellado' => $actual->iva_sellado,
                'total_sellado' => $actual->total_sellado,
                'iva_tasa_sellada' => $actual->iva_tasa_sellada,
                'cerrada_at' => $actual->cerrada_at,
                'cerrada_por' => $actual->cerrada_por,
                'reabierta_at' => now(),
                'reabierta_por' => $userId,
                'motivo' => $motivo,
                'documento' => $documento,
            ]);

            // El sello se LIMPIA: su único dueño es ahora la versión. Dejarlo aquí sería un
            // número sin dueño esperando que alguien lo lea como vigente.
            $actual->update([
                'estado' => FactPrefactura::ESTADO_REABIERTA,
                'subtotal_sellado' => null,
                'iva_sellado' => null,
                'total_sellado' => null,
                'iva_tasa_sellada' => null,
                'cerrada_at' => null,
                'cerrada_por' => null,
            ]);

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_ACTUALIZAR,
                descripcion: "Se reabrió la prefactura con folio {$actual->folio} para corregirla (versión {$version} guardada). Motivo: {$motivo}",
                usuarioId: $userId,
                registroId: $actual->id,
                datosAnteriores: [
                    'estado' => FactPrefactura::ESTADO_CERRADA,
                    'subtotal' => (string) $documento['subtotal'],
                    'iva' => (string) $documento['iva'],
                    'total' => (string) $documento['total'],
                ],
                datosNuevos: ['estado' => FactPrefactura::ESTADO_REABIERTA, 'version_guardada' => $version],
            );

            return $actual->fresh();
        });
    }
}
```

- [ ] **Step 5: correr**

Run: `php artisan test tests/Feature/Facturacion/ReaperturaPrefacturaTest.php`
Expected: PASS, todas. **Ninguna prueba de esta tarea puede quedar roja:** la de las tres reaperturas sucesivas se movió a la Task 4, porque necesita el folio reusado que allí se implementa.

- [ ] **Step 6: commit**

```bash
vendor/bin/pint --dirty
git add app/Services/ReaperturaPrefactura.php app/Services/PrefacturaNoReabribleException.php tests/Feature/Facturacion/ReaperturaPrefacturaTest.php
git commit -m "feat(facturacion): el servicio de reapertura, con la version guardada antes de abrir"
```

---

### Task 4: el cierre reusa el folio

La trampa 1 y la 3 de la especificación. **El punto más delicado del bloque:** si se escapa, cada corrección quema un folio y le cambia el número al papel del cliente.

**Files:**
- Modify: `app/Services/CierrePrefactura.php` (la asignación del folio; el `where` del `update` en la línea ~130)
- Test: `tests/Feature/Facturacion/CierreDeReabiertaTest.php`

**Interfaces:**
- La firma de `cerrar()` **no cambia**. Cambia su comportamiento con una prefactura que ya tiene folio.

- [ ] **Step 1: las pruebas que fallan**

```php
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

    $recerrada = app(CierrePrefactura::class)->cerrar($cerrada->fresh(), $usuario->id);

    expect((string) $recerrada->total_sellado)->not->toBe($totalViejo)
        ->and($recerrada->selloDiscrepa())->toBeFalse()
        ->and((string) $recerrada->versiones->sole()->total_sellado)->toBe($totalViejo);
});

test('un borrador normal sigue consumiendo un folio nuevo', function () {
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $contadorAntes = (int) FactConfiguracion::where('clave', CierrePrefactura::CLAVE_FOLIO)->value('valor');

    $borrador = prefacturaBorrador();
    renglonDe($borrador, 10.0, 1);
    completarParaCerrar($borrador);

    $cerrada = app(CierrePrefactura::class)->cerrar($borrador->fresh(), $usuario->id);

    expect($cerrada->folio)->toBe($contadorAntes)
        ->and((int) FactConfiguracion::where('clave', CierrePrefactura::CLAVE_FOLIO)->value('valor'))
        ->toBe($contadorAntes + 1);
});
```

```php
test('tres reaperturas dan tres versiones numeradas 1, 2 y 3', function () {
    $prefactura = prefacturaCerradaParaDocumento();
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $cierre = app(CierrePrefactura::class);
    $reapertura = app(ReaperturaPrefactura::class);

    foreach (range(1, 3) as $vuelta) {
        $reapertura->reabrir($prefactura->fresh(), $usuario->id, "Correccion {$vuelta}.");
        $cierre->cerrar($prefactura->fresh(), $usuario->id);
    }

    expect($prefactura->fresh()->versiones->pluck('version')->all())->toBe([1, 2, 3]);
});

test('si la correccion BAJA el total y el cliente ya pago, queda sobrepago y no se inventa nada', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');

    app(ReaperturaPrefactura::class)->reabrir($cerrada, $usuario->id, 'Se cobro un servicio que no fue.');

    // Se quita el renglon mas caro: el total baja por debajo de lo ya pagado.
    $viva = $cerrada->fresh();
    $viva->renglones()->orderByDesc('precio_unitario')->first()->delete();

    $recerrada = app(CierrePrefactura::class)->cerrar($viva->fresh(), $usuario->id, confirmarSinCobro: true);

    // La maquinaria que ya existe lo dice; no hay nada nuevo que construir para esto.
    expect(bccomp($recerrada->sobrepago(), '0.00', 2))->toBeGreaterThan(0)
        ->and($recerrada->selloDiscrepa())->toBeFalse();
});
```

**Si el cierre con sobrepago exige una confirmación distinta**, leer qué pide `cerrar()` para ese caso (el docblock habla de `$confirmarSinCobro` y de `$faltanteConfirmado`) y pasarle lo que corresponda; la prueba documenta el camino real, no uno inventado.

- [ ] **Step 2: correr y ver que falla**

Run: `php artisan test tests/Feature/Facturacion/CierreDeReabiertaTest.php`
Expected: FAIL. La primera falla porque el folio cambia y el contador avanza; la segunda, porque el `update` filtra `estado = borrador` y no afecta ninguna fila.

- [ ] **Step 3: reusar el folio**

En `cerrar()`, donde hoy se pide el folio sin condición, condicionarlo. Buscar la línea que llama a `$this->siguienteFolio()` y envolverla:

```php
            // Una reabierta YA tiene folio: es el mismo documento corregido, no otro. Pedir
            // uno nuevo quemaría un folio por cada corrección y le cambiaría el número al
            // papel que el cliente ya tiene en la mano.
            $folio = $prefactura->folio ?? $this->siguienteFolio();
```

**Usar `$prefactura->folio`, de la instancia LEÍDA CON CANDADO dentro de la transacción**, no de la que llegó por parámetro.

- [ ] **Step 4: el `update` alcanza a las reabiertas**

```php
            $filas = FactPrefactura::query()
                ->where('id', $prefactura->id)
                ->whereIn('estado', [FactPrefactura::ESTADO_BORRADOR, FactPrefactura::ESTADO_REABIERTA])
                ->update([
```

El `whereIn` sigue siendo la guarda que buscaba el `where` original: una prefactura **cerrada** no la alcanza, así que dos cierres simultáneos siguen dando un solo documento.

- [ ] **Step 5: correr el cierre entero**

Run: `php artisan test tests/Feature/Facturacion/CierreDeReabiertaTest.php tests/Feature/Facturacion/ReaperturaPrefacturaTest.php tests/Feature/Facturacion/CierreSinCobroTest.php tests/Feature/Facturacion/EndpointsPrefacturaTest.php`
Expected: PASS, incluida la de las tres reaperturas sucesivas, que es de esta tarea.

- [ ] **Step 6: commit**

```bash
vendor/bin/pint --dirty
git add app/Services/CierrePrefactura.php tests/Feature/Facturacion/CierreDeReabiertaTest.php
git commit -m "fix(facturacion): cerrar una reabierta conserva su folio y no toca el contador"
```

---

### Task 5: el endpoint, el permiso y las tres guardas

**Files:**
- Create: `app/Http/Requests/Facturacion/ReabrirPrefacturaRequest.php`
- Modify: `app/Http/Controllers/Api/Facturacion/PrefacturaController.php` (`reabrir()`; el filtro de `index` en la línea ~71; el docblock de la línea ~358)
- Modify: `app/Http/Controllers/Api/Facturacion/PrefacturaPdfController.php` (`cotizacion()` rechaza reabiertas)
- Modify: `routes/api.php` (**sin pint ni prettier**)
- Modify: `database/seeders/FacturacionSubdepartamentosSeeder.php`
- Modify: `tests/Feature/Facturacion/EndpointsPrefacturaTest.php` (la tabla de rutas y la lista del seeder)
- Test: `tests/Feature/Facturacion/ReaperturaPrefacturaTest.php`

**Interfaces:**
- Produces: `PATCH /api/facturacion/prefacturas/{id}/reabrir`, cuerpo `{ "motivo": string }`, protegida con `subdep:factReabrirPrefactura`. Devuelve la prefactura presentada, igual que `cerrar()`.
- Consumes: `ReaperturaPrefactura::reabrir()`.

- [ ] **Step 1: las pruebas que fallan**

```php
test('reabrir por API exige el subdepartamento propio: con el de capturar no basta', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->patchJson("/api/facturacion/prefacturas/{$cerrada->id}/reabrir", ['motivo' => 'Motivo suficiente.'])
        ->assertForbidden();

    expect($cerrada->fresh()->estado)->toBe(FactPrefactura::ESTADO_CERRADA);
});

test('con el subdepartamento de reabrir, se reabre', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $this->actingAs(usuarioConSubdepartamento('factReabrirPrefactura', 'Facturacion'));

    $this->patchJson("/api/facturacion/prefacturas/{$cerrada->id}/reabrir", ['motivo' => 'Faltaba el combustible.'])
        ->assertSuccessful()
        ->assertJsonPath('prefactura.estado', FactPrefactura::ESTADO_REABIERTA);

    expect($cerrada->fresh()->versiones()->count())->toBe(1);
});

test('sin motivo no se reabre', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $this->actingAs(usuarioConSubdepartamento('factReabrirPrefactura', 'Facturacion'));

    $this->patchJson("/api/facturacion/prefacturas/{$cerrada->id}/reabrir", [])
        ->assertStatus(422)
        ->assertJsonValidationErrors('motivo');

    // Y un motivo de puros espacios tampoco: ConvertEmptyStringsToNull lo deja en null
    // DESPUES de TrimStrings, asi que `required` lo atrapa.
    $this->patchJson("/api/facturacion/prefacturas/{$cerrada->id}/reabrir", ['motivo' => '   '])
        ->assertStatus(422)
        ->assertJsonValidationErrors('motivo');

    expect($cerrada->fresh()->estado)->toBe(FactPrefactura::ESTADO_CERRADA);
});

test('una reabierta no se descarta', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    app(App\Services\ReaperturaPrefactura::class)->reabrir($cerrada, 1, 'Motivo suficiente.');
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->patchJson("/api/facturacion/prefacturas/{$cerrada->id}/descartar")
        ->assertStatus(409);

    expect($cerrada->fresh()->status)->toBe(FactPrefactura::STATUS_ACTIVO)
        ->and($cerrada->fresh()->folio)->not->toBeNull();
});

test('una reabierta NO se imprime como cotizacion: tiene folio gastado', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    app(App\Services\ReaperturaPrefactura::class)->reabrir($cerrada, 1, 'Motivo suficiente.');
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/cotizacion")
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'reabierta');

    // Ni como documento: no tiene sello.
    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")
        ->assertStatus(422);
});

test('el indice puede filtrar por reabierta', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    app(App\Services\ReaperturaPrefactura::class)->reabrir($cerrada, 1, 'Motivo suficiente.');
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $respuesta = $this->getJson('/api/facturacion/prefacturas?estado=reabierta')->assertSuccessful();

    expect($respuesta->json('data'))->toHaveCount(1)
        ->and($respuesta->json('data.0.id'))->toBe($cerrada->id);
});
```

Y actualizar las dos pruebas que ya existen en `EndpointsPrefacturaTest.php`:

```php
// En 'cada ruta de escritura de prefacturas lleva su subdepartamento', añadir al array
// $esperado (el test excluye GET, asi que la ruta de reimpresion de una version NO va):
        'PATCH api/facturacion/prefacturas/{id}/reabrir' => 'subdep:factReabrirPrefactura',

// En 'el seeder crea el subdepartamento nuevo', la lista ordenada pasa a diez
// ('factReabrirPrefactura' entra entre Proveedores y Servicios):
            'factAeronaves', 'factCategoriasAeronave', 'factClientes', 'factCombustible',
            'factFormasPago', 'factPrefacturas', 'factProveedores', 'factReabrirPrefactura',
            'factServicios', 'factTiposMotor',
```

- [ ] **Step 2: correr y ver que falla**

Run: `php artisan test tests/Feature/Facturacion/ReaperturaPrefacturaTest.php tests/Feature/Facturacion/EndpointsPrefacturaTest.php`
Expected: FAIL — 404 en la ruta de reabrir, y las dos pruebas actualizadas en rojo.

- [ ] **Step 3: el Request**

```php
<?php

namespace App\Http\Requests\Facturacion;

use Illuminate\Foundation\Http\FormRequest;

/**
 * El motivo de una reapertura es obligatorio: sin él la historia no sirve para nada, que es
 * todo el argumento de poder reabrir.
 *
 * `min:10` no es un capricho: «error» o «ajuste» no explican nada al que lea el registro en
 * seis meses. Y un motivo de puros espacios llega como `null` —`ConvertEmptyStringsToNull`
 * actúa DESPUÉS de `TrimStrings`—, así que `required` lo atrapa solo.
 */
class ReabrirPrefacturaRequest extends FormRequest
{
    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'motivo' => ['required', 'string', 'min:10', 'max:500'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'motivo.required' => 'Escribe por qué se reabre: queda en la historia del documento.',
            'motivo.min' => 'El motivo es demasiado corto: explica qué hay que corregir.',
        ];
    }
}
```

Comprobar primero si el proyecto usa reglas en array o en cadena en sus otros Form Requests de facturación y seguir esa convención.

- [ ] **Step 4: el método del controlador**

En `PrefacturaController`, junto a `cerrar()`:

```php
    /**
     * Reabre una cerrada para corregirla. El documento anterior queda guardado como versión
     * antes de que nada cambie.
     */
    public function reabrir(ReabrirPrefacturaRequest $request, int $id): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazarSiDescartada($prefactura)) {
            return $respuesta;
        }

        try {
            $reabierta = app(ReaperturaPrefactura::class)->reabrir(
                $prefactura,
                $request->user()->id,
                $request->validated()['motivo'],
            );
        } catch (PrefacturaNoReabribleException $e) {
            return $e->aJson();
        } catch (UnexpectedValueException $e) {
            report($e);

            return response()->json([
                'message' => 'No se puede guardar el documento anterior: un renglón o la tasa de IVA tienen un valor que no se reconoce. Corrígelo antes de reabrir.',
                'codigo' => 'totales_no_calculables',
            ], 422);
        }

        return response()->json([
            'prefactura' => $this->presentar($reabierta, conRenglones: true),
        ]);
    }
```

Seguir cómo `cerrar()` obtiene sus servicios (inyección en el método o `app()`) y hacer igual.

- [ ] **Step 5: el filtro del índice**

Línea ~71: añadir el estado a la lista blanca.

```php
        if (in_array($request->query('estado'), [
            FactPrefactura::ESTADO_BORRADOR,
            FactPrefactura::ESTADO_CERRADA,
            FactPrefactura::ESTADO_REABIERTA,
        ], true)) {
```

- [ ] **Step 6: el docblock de `descartar`**

Línea ~358. El texto sigue siendo verdad pero hay que decir que la exclusión es deliberada, o el próximo lector lo lee como un olvido y lo «arregla»:

```php
     * proyecto: `WHERE id = ? AND status = 'A' AND estado = 'borrador'`. El `estado` excluye
     * a propósito a las REABIERTAS: su folio ya se consumió, y descartarlas lo perdería y
     * haría desaparecer de la lista un documento que ya salió al cliente.
```

- [ ] **Step 7: `cotizacion()` rechaza las reabiertas**

En `PrefacturaPdfController::cotizacion()`, **antes** del `if ($prefactura->estaCerrada())`:

```php
        // Una reabierta no es un borrador: su folio ya se consumió. Cotizarla sacaría un
        // presupuesto, sin folio, de un trabajo ya facturado.
        if ($prefactura->estaReabierta()) {
            return response()->json([
                'message' => 'Esta prefactura está reabierta para corregirse: no se cotiza ni se imprime hasta que se vuelva a cerrar.',
                'codigo' => 'reabierta',
            ], 422);
        }
```

`pdf()` ya la rechaza con `sin_folio` por no estar cerrada, y eso basta; no se toca.

- [ ] **Step 8: la ruta y el seeder**

En `routes/api.php`, **dentro del grupo de prefacturas pero con su propio middleware**:

```php
        // Reabrir lleva subdepartamento PROPIO: es deshacer un documento que ya salió al
        // cliente. Editarla después usa los permisos normales.
        Route::patch('/prefacturas/{id}/reabrir', [PrefacturaController::class, 'reabrir'])
            ->whereNumber('id')
            ->middleware('subdep:factReabrirPrefactura');
```

En el seeder, añadir `'factReabrirPrefactura'` al array. **No añadir nada a `ROUTE_CONFIG` de `navigation.ts`**: `navigation.ts:355` hace `if (!routeKey || !ROUTE_CONFIG[routeKey]) return null`, así que un subdepartamento que es solo permiso no produce entrada de menú, que es lo que se quiere. Una entrada inventada sería un enlace roto.

- [ ] **Step 9: correr**

Run: `php artisan test tests/Feature/Facturacion/ReaperturaPrefacturaTest.php tests/Feature/Facturacion/EndpointsPrefacturaTest.php tests/Feature/Facturacion/ImpresionPrefacturaTest.php`
Expected: PASS.

- [ ] **Step 10: commit**

```bash
vendor/bin/pint --dirty   # routes/api.php NO lo toca pint; si lo lista, revisar el diff y descartar lo que no sea tuyo
git add app/Http routes/api.php database/seeders/FacturacionSubdepartamentosSeeder.php tests/Feature/Facturacion
git commit -m "feat(facturacion): el endpoint de reapertura, su permiso propio y las tres guardas"
```

---

### Task 6: el papel y la reimpresión de una versión

**Files:**
- Modify: `resources/views/pdf/prefactura.blade.php`
- Modify: `app/Http/Controllers/Api/Facturacion/PrefacturaPdfController.php` (`render()`, `version()`)
- Modify: `routes/api.php`
- Test: `tests/Feature/Facturacion/DocumentoDeVersionTest.php`

**Interfaces:**
- Produces: `GET /api/facturacion/prefacturas/{id}/versiones/{version}/pdf`; el contrato de la vista pasa a **once claves**: las nueve del bloque 4 más `sustituye` y `versionSustituida`.
- `render()` cambia de firma: `render(FactPrefactura $p, bool $esCotizacion, array $cifras, string $elaboradoPor, ?string $sustituye = null, ?array $versionSustituida = null): Response`. Las dos nuevas se pasan SIEMPRE a la vista, también cuando son `null`, o Blade revienta por variable indefinida.

- [ ] **Step 1: las pruebas que fallan**

```php
test('el documento corregido dice a que version sustituye, y el original no dice nada', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $this->actingAs($usuario);

    $recibido = [];
    capturarLoQueRecibeLaVista($recibido);

    // Antes de corregir: sin marca.
    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertSuccessful();
    expect($recibido['sustituye'])->toBeNull()
        ->and($recibido['versionSustituida'])->toBeNull();

    $fechaOriginal = $cerrada->cerrada_at;
    app(App\Services\ReaperturaPrefactura::class)->reabrir($cerrada, $usuario->id, 'Faltaba un servicio.');
    renglonDe($cerrada->fresh(), 250.0, 1);
    app(App\Services\CierrePrefactura::class)->cerrar($cerrada->fresh(), $usuario->id);

    // Despues: la marca con la fecha de la version anterior.
    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertSuccessful();
    expect($recibido['sustituye'])->toContain($fechaOriginal->format('d/m/Y'))
        ->and($recibido['versionSustituida'])->toBeNull();
});

test('una version sustituida se reimprime marcada como NO vigente', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $this->actingAs($usuario);

    app(App\Services\ReaperturaPrefactura::class)->reabrir($cerrada, $usuario->id, 'Faltaba un servicio.');

    $recibido = [];
    capturarLoQueRecibeLaVista($recibido);

    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/versiones/1/pdf")->assertSuccessful();

    expect($recibido['versionSustituida']['version'])->toBe(1)
        ->and($recibido['sustituye'])->toBeNull()
        ->and($recibido['esCotizacion'])->toBeFalse();
});

test('una version que no existe da 404', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/versiones/7/pdf")->assertNotFound();
});
```

`capturarLoQueRecibeLaVista()` ya existe en `ImpresionPrefacturaTest.php:251`. Comprobar si está accesible desde este fichero; si no, replicarla con otro nombre en vez de redeclararla.

- [ ] **Step 2: correr y ver que falla**

Run: `php artisan test tests/Feature/Facturacion/DocumentoDeVersionTest.php`
Expected: FAIL con `Undefined variable $sustituye` y 404 en la ruta de la versión.

- [ ] **Step 3: la plantilla**

Añadir las dos claves al docblock del contrato (que pasa a decir **once**) y las dos líneas. Debajo del recuadro del título, donde ya se decide COTIZACIÓN o FOLIO:

```blade
    @if($versionSustituida !== null)
        <table>
            <tr>
                <td class="aviso-no-vigente">
                    VERSIÓN {{ $versionSustituida['version'] }} — REEMPLAZADA EL
                    {{ $versionSustituida['reemplazada'] }}. NO VIGENTE.
                </td>
            </tr>
        </table>
    @elseif($sustituye !== null)
        <table>
            <tr>
                <td class="aviso-corregida">Corregida — sustituye a la versión del {{ $sustituye }}.</td>
            </tr>
        </table>
    @endif
```

Las dos ramas son excluyentes a propósito: con una sola clave, reimprimir una versión vieja le estamparía «Corregida» al papel que precisamente no hay que dar por bueno. Los dos estilos van en el `<style>` de la plantilla, siguiendo los que ya hay (`titulo-recuadro`); el de no vigente, bien visible.

- [ ] **Step 4: `render()` y las dos marcas**

Cambiar la firma de `render()` como dice **Interfaces** y pasar las dos claves a `Pdf::loadView`:

```php
        $pdf = Pdf::loadView('pdf.prefactura', [
            'prefactura' => $prefactura,
            'esCotizacion' => $esCotizacion,
            'elaboradoPor' => $elaboradoPor,
            'sustituye' => $sustituye,
            'versionSustituida' => $versionSustituida,
        ] + $cifras)->setPaper('letter', 'portrait');
```

En `pdf()`, calcular `sustituye` **dentro del `try/catch`**, junto a las cifras:

```php
            // DENTRO del try, como las cifras: `last()` sobre la relación no lanza, pero la
            // regla del bloque 4 es que todo lo que la vista recibe se arma aquí.
            $ultima = $prefactura->versiones->last();
            $sustituye = $ultima?->cerrada_at?->format('d/m/Y');
```

y pasarlo a `render()`. En `cotizacion()`, pasar `sustituye: null, versionSustituida: null` explícitamente: un borrador no sustituye nada.

**Cargar `versiones` en el `with()` de `pdf()`**, o cada impresión dispara una consulta extra y la vista podría leer una relación no cargada.

- [ ] **Step 5: el endpoint de la versión**

```php
    /**
     * Reimprime una versión SUSTITUIDA: el papel que el cliente tiene en la mano y que el
     * sistema ya no considera vigente.
     *
     * No lee la prefactura viva para nada del documento: se hidrata un modelo desde el JSON
     * guardado. Si leyera la viva daría el documento viejo con la cabecera nueva.
     */
    public function version(Request $request, int $id, int $version): Response|JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        $guardada = $prefactura->versiones()->where('version', $version)->firstOrFail();

        $documento = $guardada->documento;
        $hidratada = $this->documento->hidratar($documento);

        // Las cifras vienen del JSON: ya están resueltas y NO se recalculan. Por eso aquí no
        // hace falta try/catch: nada de esto puede lanzar una excepción de cálculo.
        $cifras = [
            'subtotal' => $documento['subtotal'],
            'iva' => $documento['iva'],
            'ivaEtiqueta' => $documento['ivaEtiqueta'],
            'total' => $documento['total'],
            'cambio' => $documento['cambio'],
            'filas' => $documento['filas'],
        ];

        $pdf = $this->render($hidratada, esCotizacion: false, cifras: $cifras,
            elaboradoPor: $documento['elaboradoPor'],
            versionSustituida: [
                'version' => $guardada->version,
                'reemplazada' => $guardada->reabierta_at->format('d/m/Y'),
            ]);

        $this->registrar(
            $request->user()->id,
            $prefactura,
            "Se reimprimió la versión {$version} —sustituida— de la prefactura con folio {$guardada->folio}.",
            ['folio' => $guardada->folio, 'version' => $version, 'vigente' => false],
        );

        return $pdf;
    }
```

**`render()` devuelve el stream, así que el nombre del fichero sale como `prefactura-{folio}.pdf` y choca con el de la versión vigente.** Añadir a `render()` un parámetro para el sufijo, o nombrar aquí el fichero como `prefactura-{folio}-version-{n}.pdf`: dos ficheros con el mismo nombre en la carpeta de descargas del usuario es justo la confusión que este bloque evita.

La ruta, en el grupo de **lectura** (no necesita `subdep:` de escritura, igual que `pdf`):

```php
    Route::get('/prefacturas/{id}/versiones/{version}/pdf', [PrefacturaPdfController::class, 'version'])
        ->whereNumber('id')->whereNumber('version');
```

Comprobar qué middleware llevan `pdf` y `cotizacion` en las líneas ~382-385 y seguirlo.

- [ ] **Step 6: correr**

Run: `php artisan test tests/Feature/Facturacion/DocumentoDeVersionTest.php tests/Feature/Facturacion/ImpresionPrefacturaTest.php tests/Feature/Facturacion/DocumentoPrefacturaTest.php`
Expected: PASS.

- [ ] **Step 7: commit**

```bash
vendor/bin/pint --dirty
git add resources/views/pdf/prefactura.blade.php app/Http/Controllers/Api/Facturacion/PrefacturaPdfController.php routes/api.php tests/Feature/Facturacion/DocumentoDeVersionTest.php
git commit -m "feat(facturacion): el papel dice a que version sustituye, y la sustituida se reimprime"
```

---

### Task 7: la prueba maestra

Es la que hace seguro el acoplamiento de §6 de la especificación: **falla el día en que la plantilla lea algo que el JSON no guarda.** Va en su propia tarea porque necesita todo lo anterior y porque es la prueba que más vale del bloque.

**Antes de escribirla, lee lo que la Task 2 ya dejó.** Allí nació una prueba que no estaba en el plan y que es más fuerte que esta: renderiza `pdf.prefactura` con la prefactura viva y con `hidratar(json_decode(json_encode(instantanea)))`, y exige **HTML idéntico** con `toBe`, sin normalizar. Compara el papel, no el arreglo que recibe la vista. **No la dupliques.** Lo que esta tarea añade sobre ella es el recorrido completo: imprimir, reabrir, corregir algo de cada una de las cuatro clases, volver a cerrar, y reimprimir la versión 1 **por el endpoint**, que es el camino que usará el departamento. Si al escribirla ves que la de la Task 2 ya cubre una parte, apóyate en ella y dilo en el informe.

**Y el límite de esa prueba, medido en la re-revisión de la Task 2, que esta tarea tiene que cubrir:** la prueba de la Task 2 es **circular en TODAS las cifras**, no solo en el `cambio`. Los dos lados nacen de `cifrasDeCerrada()`, así que se demostró que con un `total` falso en esa función **la prueba sigue pasando**. Ejercita el modelo hidratado y el viaje por JSON, no las cifras.

Por eso la prueba maestra **no puede comparar solo la reimpresión contra la impresión original**: las dos descienden de la misma función aplicada al mismo estado, así que un error constante en `cifrasDeCerrada()` las movría a la vez y pasaría inadvertido. Tiene que **anclar al menos una cifra a algo ajeno a ese par**: los literales con los que la propia prueba montó la prefactura, o las columnas selladas leídas de la base. Concretamente, además de exigir que la versión reimpresa y el original coincidan, exige que el total de la versión reimpresa sea **el literal que la prueba sembró** y que el de la prefactura corregida sea **distinto**: eso es lo que demuestra que el JSON conservó las cifras viejas mientras las vivas se movían.

**Files:**
- Test: `tests/Feature/Facturacion/DocumentoDeVersionTest.php`

- [ ] **Step 1: escribirla**

```php
test('LA PRUEBA MAESTRA: reimprimir la version 1 da exactamente lo que se imprimio', function () {
    $cerrada = prefacturaCerradaParaDocumento();
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $this->actingAs($usuario);

    $alImprimir = [];
    capturarLoQueRecibeLaVista($alImprimir);
    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertSuccessful();
    $original = $alImprimir;

    // Se corrige algo de CADA una de las cuatro clases que el departamento nombro.
    app(App\Services\ReaperturaPrefactura::class)->reabrir($cerrada, $usuario->id, 'Correccion completa de prueba.');

    $viva = $cerrada->fresh();
    renglonDe($viva, 250.0, 1);                                   // (1) falta un servicio
    $viva->renglones()->first()->update(['cantidad' => 9]);        // (2) el importe de un renglon
    App\Models\FactPrefacturaPago::where('prefactura_id', $viva->id)->delete();  // (3) el cobro
    $viva->update([                                               // (4) la cabecera
        'destino' => 'MMGL',
        'nota_externa' => 'Nota corregida.',
    ]);
    completarParaCerrar($viva->fresh());
    app(App\Services\CierrePrefactura::class)->cerrar($viva->fresh(), $usuario->id);

    $alReimprimir = [];
    capturarLoQueRecibeLaVista($alReimprimir);
    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/versiones/1/pdf")->assertSuccessful();

    // Las CIFRAS y las FILAS, identicas.
    foreach (['subtotal', 'iva', 'ivaEtiqueta', 'total', 'cambio', 'filas', 'elaboradoPor', 'esCotizacion'] as $clave) {
        expect($alReimprimir[$clave])->toEqual($original[$clave], "cambio la clave {$clave}");
    }

    // Y todo lo que la plantilla lee de $prefactura: si manana lee un campo mas y el JSON no
    // lo guarda, esta comparacion lo delata.
    $delModelo = fn (FactPrefactura $p) => [
        'folio' => $p->folio,
        'cerrada_at' => $p->cerrada_at?->format('d/m/Y'),
        'llegada_at' => $p->llegada_at?->format('d/m/Y H:i'),
        'salida_at' => $p->salida_at?->format('d/m/Y H:i'),
        'origen' => $p->origen,
        'destino' => $p->destino,
        'nota_externa' => $p->nota_externa,
        'cliente' => [$p->cliente?->nombre, $p->cliente?->telefono, $p->cliente?->correo],
        'matricula' => $p->aeronave?->matricula,
        'tipo' => $p->aeronave?->tipoAeronave?->nombre,
        'categoria' => $p->satelite?->categoria?->nombre,
        'pagos' => $p->pagos->map(fn ($g) => [$g->formaPago?->nombre, (string) $g->monto])->all(),
    ];

    expect($delModelo($alReimprimir['prefactura']))->toEqual($delModelo($original['prefactura']));

    // Y la unica diferencia permitida: la marca.
    expect($alReimprimir['versionSustituida'])->not->toBeNull()
        ->and($original['versionSustituida'])->toBeNull();
});
```

- [ ] **Step 2: correr**

Run: `php artisan test tests/Feature/Facturacion/DocumentoDeVersionTest.php`
Expected: PASS. **Si falla, el fallo es real y señala exactamente qué campo no se guarda** — arreglar `instantanea()` y `hidratar()`, nunca relajar la comparación.

- [ ] **Step 3: la suite entera**

Run: `php artisan test`
Expected: PASS, 1088 + las nuevas. En serie, no `--parallel`.

- [ ] **Step 4: commit**

```bash
git add tests/Feature/Facturacion/DocumentoDeVersionTest.php
git commit -m "test(facturacion): la prueba maestra, que la version reimpresa es el papel que salio"
```

---

### Task 8: la pantalla

**Files:**
- Modify: `resources/js/pages/Facturacion/EditorPrefactura.tsx` (**NO correr prettier sobre este fichero**)
- Modify: `resources/js/pages/Facturacion/` (la lista de prefacturas: añadir el distintivo; buscar el fichero del índice)

**Interfaces:**
- Consumes: `PATCH /api/facturacion/prefacturas/{id}/reabrir` y `GET /api/facturacion/prefacturas/{id}/versiones/{version}/pdf`; el campo `estado` del presentador, que ahora puede ser `'reabierta'`.

**Por qué esta tarea no trae código y las otras sí, dicho a propósito:** `EditorPrefactura.tsx` tiene 1,272 líneas y sus patrones —cómo abre un modal, cómo pide al API, cómo muestra un aviso— hay que leerlos y seguirlos. Un bloque de TSX inventado aquí sería más probable que estorbara que que ayudara. **Paso cero de esta tarea: leer el fichero completo**, junto con `AvisosDelServidor` (línea ~114) y `ModalEstancia`, y recién entonces escribir. Lo que no es negociable son los cinco comportamientos de los pasos 2 a 5 y las dos comprobaciones del paso 6.

- [ ] **Step 1: comprobar qué expone `presentar()`**

Leer `PrefacturaController::presentar()` y confirmar que `estado` viaja y que las versiones **no**. Si la pantalla va a listar versiones, añadir al presentador una lista mínima (`version`, `cerrada_at`, `total_sellado`, `motivo`, `reabierta_at`) y escribir la prueba de que viaja. Si no hace falta, no añadir nada: el presentador no crece sin usuario.

- [ ] **Step 2: el botón y el modal de reabrir**

Botón visible solo cuando `estado === 'cerrada'`, que abre un modal con un campo de motivo obligatorio (mínimo 10 caracteres, para que la validación del servidor no sea la primera vez que el usuario se entera) y un aviso de que el documento actual queda guardado como versión. Seguir el patrón del modal que ya usa la pantalla (`ModalEstancia`) y el de `sweetalert2` si es el que se usa para confirmar.

- [ ] **Step 3: el aviso de reabierta**

Cuando `estado === 'reabierta'`, un aviso permanente y bien visible en la cabecera del editor: **está reabierta, conserva el folio N, no se puede imprimir hasta volver a cerrarla.** Es el aviso que evita que alguien la deje abierta y el folio quede como hueco en la secuencia. Va junto a `AvisosDelServidor`, que ya existe para esto.

- [ ] **Step 4: la lista de versiones**

Si hay versiones, una sección que las liste con su número, la fecha en que se cerró, su total y su motivo, y un enlace a su PDF. Cada enlace tiene que decir **no vigente**, igual que el papel.

- [ ] **Step 5: el distintivo en el índice**

En la lista de prefacturas, las reabiertas se ven distintas de los borradores y de las cerradas. Y el filtro por estado admite `reabierta`.

- [ ] **Step 6: comprobar**

Run: `npx tsc --noEmit`
Expected: solo el error preexistente de `WalkAroundController.ts(905,5)`.

Run: `npm run build`
Expected: termina bien.

- [ ] **Step 7: commit**

```bash
# prettier NO: EditorPrefactura.tsx esta en la lista de los seis
git add resources/js
git commit -m "feat(facturacion): reabrir desde la pantalla, con el aviso y la lista de versiones"
```

---

## Qué queda fuera, y dónde está escrito

- **La importación del histórico** (bloque 6b): otra especificación, bloqueada por las decisiones 1 a 4.
- **Limpiar los nombres que el viejo reescribía al imprimir**: decisión 6, abierta.
- **Un límite de antigüedad o de número de reaperturas**: no hay, a propósito.
- **Cancelar una prefactura sin reemitirla**: no se pidió.
