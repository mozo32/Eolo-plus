# El proveedor del comisariato sale de una lista — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el proveedor de un comisariato se elija de una lista cerrada ligada al catálogo de facturación, en vez de teclearse como texto libre.

**Architecture:** Una columna nueva `fact_servicio_id` en `servicio_comisariatos` apunta al servicio de la categoría Comisariatos que determinará el cobro. Un endpoint propio de Tráfico sirve la lista (solo id y nombre, nunca precios ni márgenes). La validación, hoy en línea y duplicada en el controlador, se extrae a Form Requests. La columna `catering` se conserva como historia y deja de escribirse.

**Tech Stack:** Laravel 12, Pest 3, React 19 + TypeScript, Inertia 2, Tailwind 4. MySQL/MariaDB en desarrollo, **sqlite en memoria en pruebas**.

**Spec:** `docs/superpowers/specs/2026-10-27-trafico-proveedor-de-comisariato-design.md`

## Global Constraints

- Las pruebas corren **en serie** (`php artisan test`), **nunca con `--parallel`**: en este proyecto da falsos rojos.
- **No** ejecutar `vendor/bin/pint`, `prettier` ni `npm run lint`.
- **No** usar `git stash`: hay stashes guardados que no son de este trabajo.
- La conexión `remota` es de **solo lectura** por contrato.
- La base de desarrollo `eolo_plus` es la base **real del usuario**: se lee, no se escribe. Las pruebas corren en sqlite en memoria.
- En sqlite no existen `timestamp()`, `CONCAT()` ni `DATE_FORMAT()` de MySQL. `LOWER()` y `LIKE` sí.
- **No hay lanzador de pruebas de JavaScript.** La evidencia del front es `npx tsc --noEmit` contra una línea base de **exactamente 1 error** (un TS1117 en el fichero generado `WalkAroundController.ts`) más `npm run build`. El `tsc` se mide **después** del build: los ficheros que genera Wayfinder dan errores fantasma entre corridas.
- **Este proyecto no usa fábricas de modelos.** La única que existe es `UserFactory`. Las pruebas construyen las filas con `Modelo::create([...])`, como hace `tests/Feature/Facturacion/RemisionesDeCombustibleTest.php`. **No crear fábricas nuevas.**
- `RefreshDatabase` ya está aplicado globalmente a `tests/Feature` desde `tests/Pest.php`.
- Las rutas del grupo `ServicioComisariato` usan solo `auth:sanctum`, **sin** middleware de subdepartamento. No inventar un permiso que sus hermanas no tienen.
- Los mensajes de usuario van **en español**.
- La columna se llama `fact_servicio_id` en todas las tareas.

---

## Estructura de ficheros

**Backend**

| Fichero | Responsabilidad |
|---|---|
| `database/migrations/2026_10_28_100000_add_fact_servicio_id_to_servicio_comisariatos_table.php` | Crear la columna, la FK y rellenar las filas existentes. |
| `app/Models/ServicioComisariato.php` | Exponer la columna y la relación con el servicio. |
| `app/Http/Requests/Trafico/StoreServicioComisariatoRequest.php` | Reglas del alta. |
| `app/Http/Requests/Trafico/UpdateServicioComisariatoRequest.php` | Reglas de la edición, incluida la ventana de fecha condicional. |
| `app/Http/Controllers/Api/ServicioComisariatoController.php` | Usar los Form Requests, guardar el servicio, servir la lista, filtrar por proveedor. |
| `routes/api.php` | La ruta nueva. |

**Frontend**

| Fichero | Responsabilidad |
|---|---|
| `resources/js/stores/apiServicioComisariato.ts` | Tipos y la llamada que trae la lista. |
| `resources/js/pages/Trafico/servicioComisariato/ServicioComisariatoForm.tsx` | El campo pasa a desplegable. |
| `resources/js/pages/Trafico/servicioComisariato/validacion.ts` | El campo obligatorio cambia de nombre. |
| `resources/js/pages/Trafico/ServicioComisariato.tsx` | Filtro desplegable y celda de la tabla. |
| `resources/js/pages/Trafico/servicioComisariato/PdfComisariato.tsx` | Imprimir el nombre del servicio. |

**Pruebas**

| Fichero | Responsabilidad |
|---|---|
| `tests/Feature/Trafico/ServicioComisariatoProveedorTest.php` | Todo el servidor de este trabajo. **El módulo no tiene ninguna prueba hoy: este fichero es el primero.** |

---

### Task 1: La columna, la relación y el relleno

**Files:**
- Create: `database/migrations/2026_10_28_100000_add_fact_servicio_id_to_servicio_comisariatos_table.php`
- Modify: `app/Models/ServicioComisariato.php:15-27` (el array `$fillable`)
- Create: `tests/Feature/Trafico/ServicioComisariatoProveedorTest.php`

**Interfaces:**
- Produces: la columna `servicio_comisariatos.fact_servicio_id` (nullable, FK a `fact_servicios.id`, `restrictOnDelete`); la relación `ServicioComisariato::factServicio(): BelongsTo`; y en el fichero de pruebas los helpers `categoriaComisariatos(): FactCategoriaServicio` y `servicioComisariato(string $nombre, string $status = 'A'): FactServicio`, que las tareas 2, 3 y 4 reutilizan.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tests/Feature/Trafico/ServicioComisariatoProveedorTest.php`. Los helpers de arriba son los que usarán las tareas siguientes, así que van completos desde ya.

```php
<?php

use App\Models\FactCategoriaServicio;
use App\Models\FactServicio;
use App\Models\ServicioComisariato;
use App\Models\User;

/** La categoría a la que pertenecen los cinco proveedores de comisariato. */
function categoriaComisariatos(): FactCategoriaServicio
{
    return FactCategoriaServicio::firstOrCreate(['nombre' => 'Comisariatos'], ['status' => 'A']);
}

/** Un servicio de comisariato del catálogo. El precio es 0 a propósito: el importe viene de fuera. */
function servicioComisariato(string $nombre, string $status = 'A'): FactServicio
{
    return FactServicio::create([
        'categoria_servicio_id' => categoriaComisariatos()->id,
        'nombre' => $nombre,
        'precio_unitario' => 0,
        'es_de_tercero' => false,
        'margen' => 0,
        'ajuste_precio' => FactServicio::AJUSTE_NINGUNO,
        'status' => $status,
    ]);
}

/** Un comisariato ya guardado. Solo `user_id`, `fecha_entrega` y `hora_entrega` son obligatorios. */
function comisariatoDe(array $atributos = []): ServicioComisariato
{
    return ServicioComisariato::create(array_merge([
        'user_id' => User::factory()->create()->id,
        'fecha_entrega' => '2026-03-26',
        'hora_entrega' => '07:00',
        'matricula' => 'XA-ABC',
        'subtotal' => 520,
        'total' => 520,
        'status' => 'A',
    ], $atributos));
}

test('un comisariato puede apuntar a su servicio del catalogo', function () {
    $servicio = servicioComisariato('Comisariato_Comexa');

    $comisariato = comisariatoDe(['fact_servicio_id' => $servicio->id]);

    expect($comisariato->fresh()->fact_servicio_id)->toBe($servicio->id)
        ->and($comisariato->fresh()->factServicio->nombre)->toBe('Comisariato_Comexa');
});

test('un comisariato sin proveedor elegido es valido: las filas viejas no tienen', function () {
    expect(comisariatoDe()->fresh()->fact_servicio_id)->toBeNull();
});
```

- [ ] **Step 2: Correrla y verla fallar por la razón correcta**

```bash
TEST_TOKEN=1040 php artisan test tests/Feature/Trafico/ServicioComisariatoProveedorTest.php
```

Esperado: FALLA con `SQLSTATE[HY000]: General error: 1 table servicio_comisariatos has no column named fact_servicio_id`.

Si falla por otra cosa —por ejemplo porque a `FactServicio::create` le falta una columna obligatoria—, **arregla el helper antes de seguir**: una roja por la razón equivocada no demuestra nada.

- [ ] **Step 3: Crear la migración**

```bash
php artisan make:migration add_fact_servicio_id_to_servicio_comisariatos_table --no-interaction
```

Renombrar el fichero generado a `2026_10_28_100000_add_fact_servicio_id_to_servicio_comisariatos_table.php` para seguir el sello redondo que usan las migraciones recientes del proyecto, y dejarlo así:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * El proveedor del comisariato deja de ser texto libre.
 *
 * `catering` se queda como historia y deja de escribirse: es lo que tecleó alguien antes de que
 * existiera la lista. La columna nueva apunta al servicio del catálogo, que es lo que determina
 * el margen y el ajuste con los que se cobrará.
 *
 * Nullable porque las filas existentes no tienen proveedor elegido y no se les inventa uno.
 * `restrictOnDelete` porque un servicio que ya identificó un comisariato no debe poder
 * desaparecer y dejar el registro sin explicación; el catálogo además no borra, desactiva.
 */
return new class extends Migration
{
    /** Lo que se rellena sin adivinar: el texto contiene el nombre del proveedor. */
    private const EQUIVALENCIAS = [
        'comexa' => 'Comisariato_Comexa',
        'manny' => 'Comisariato_Manny',
    ];

    public function up(): void
    {
        Schema::table('servicio_comisariatos', function (Blueprint $tabla) {
            $tabla->foreignId('fact_servicio_id')
                ->nullable()
                ->after('catering')
                ->constrained('fact_servicios')
                ->restrictOnDelete();
        });

        $this->rellenarLoQueNoAdmiteDuda();
    }

    public function down(): void
    {
        Schema::table('servicio_comisariatos', function (Blueprint $tabla) {
            $tabla->dropForeign(['fact_servicio_id']);
            $tabla->dropColumn('fact_servicio_id');
        });
    }

    /**
     * Empareja por texto, sin distinguir mayúsculas. Lo que no empareja se queda en nulo:
     * adivinar ahí sería inventar. Si el servicio no existe en esta base —una instalación
     * nueva, o las pruebas— no hay nada que rellenar y la migración sigue sin romperse.
     */
    private function rellenarLoQueNoAdmiteDuda(): void
    {
        foreach (self::EQUIVALENCIAS as $fragmento => $nombreDelServicio) {
            $servicioId = DB::table('fact_servicios')->where('nombre', $nombreDelServicio)->value('id');

            if ($servicioId === null) {
                continue;
            }

            DB::table('servicio_comisariatos')
                ->whereNull('fact_servicio_id')
                ->whereRaw('LOWER(catering) LIKE ?', ["%{$fragmento}%"])
                ->update(['fact_servicio_id' => $servicioId]);
        }
    }
};
```

- [ ] **Step 4: Abrir la columna en el modelo**

En `app/Models/ServicioComisariato.php`, añadir `'fact_servicio_id'` al array `$fillable`, justo después de `'catering'`, y añadir la relación junto a las que ya existan:

```php
    /** El servicio del catálogo con el que se cobrará este comisariato. Nulo en las filas anteriores a la lista. */
    public function factServicio(): BelongsTo
    {
        return $this->belongsTo(FactServicio::class, 'fact_servicio_id');
    }
```

`BelongsTo` ya está importado en el fichero. Añadir `use App\Models\FactServicio;` no hace falta: están en el mismo namespace.

- [ ] **Step 5: Correr las pruebas y verlas pasar**

```bash
TEST_TOKEN=1040 php artisan test tests/Feature/Trafico/ServicioComisariatoProveedorTest.php
```

Esperado: 2 pruebas en verde.

- [ ] **Step 6: Comprobar el relleno en la base real, sin escribirla**

La migración **no** se corre contra `eolo_plus` en esta tarea. Solo comprobar que los dos servicios que busca existen con ese nombre exacto:

```bash
php artisan tinker --execute="echo App\Models\FactServicio::whereIn('nombre',['Comisariato_Comexa','Comisariato_Manny'])->pluck('nombre','id');"
```

Esperado: los dos, con ids 36 y 48. Si algún nombre no apareciera, **no cambiar la migración a mano con ids**: reportarlo.

- [ ] **Step 7: Commit**

```bash
git add database/migrations/2026_10_28_100000_add_fact_servicio_id_to_servicio_comisariatos_table.php app/Models/ServicioComisariato.php tests/Feature/Trafico/ServicioComisariatoProveedorTest.php
git commit -m "feat(trafico): el comisariato puede apuntar a su servicio del catalogo

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: El endpoint que sirve la lista

**Files:**
- Modify: `app/Http/Controllers/Api/ServicioComisariatoController.php` (método nuevo)
- Modify: `routes/api.php:185-190` (el grupo `ServicioComisariato`)
- Modify: `tests/Feature/Trafico/ServicioComisariatoProveedorTest.php`

**Interfaces:**
- Consumes: los helpers `categoriaComisariatos()` y `servicioComisariato()` de la Task 1.
- Produces: `GET /api/ServicioComisariato/proveedores`, que responde `200` con un array plano de objetos `{ id: int, nombre: string }`, ordenado por nombre.

- [ ] **Step 1: Escribir las pruebas que fallan**

Añadir al final de `tests/Feature/Trafico/ServicioComisariatoProveedorTest.php`:

```php
test('la lista de proveedores trae solo los servicios activos de la categoria Comisariatos', function () {
    $comexa = servicioComisariato('Comisariato_Comexa');
    servicioComisariato('Comisariato_Avemex', 'N');

    $otraCategoria = FactCategoriaServicio::create(['nombre' => 'Combustible & Servicios', 'status' => 'A']);
    FactServicio::create([
        'categoria_servicio_id' => $otraCategoria->id,
        'nombre' => 'Combustible JET A-1',
        'precio_unitario' => 25.99,
        'es_de_tercero' => false,
        'margen' => 0,
        'ajuste_precio' => FactServicio::AJUSTE_NINGUNO,
        'status' => 'A',
    ]);

    $this->actingAs(User::factory()->create());

    $respuesta = $this->getJson('/api/ServicioComisariato/proveedores');

    $respuesta->assertOk();
    expect($respuesta->json())->toHaveCount(1)
        ->and($respuesta->json('0.id'))->toBe($comexa->id)
        ->and($respuesta->json('0.nombre'))->toBe('Comisariato_Comexa');
});

test('la lista NO filtra el margen ni el precio a Trafico', function () {
    servicioComisariato('Comisariato_Manny');

    $this->actingAs(User::factory()->create());

    $claves = array_keys($this->getJson('/api/ServicioComisariato/proveedores')->json('0'));

    // Parece de más hasta que alguien añade un campo al recurso y filtra el margen sin querer.
    expect($claves)->toBe(['id', 'nombre']);
});

test('la lista de proveedores exige haber iniciado sesion', function () {
    $this->getJson('/api/ServicioComisariato/proveedores')->assertUnauthorized();
});
```

- [ ] **Step 2: Correrlas y verlas fallar por la razón correcta**

```bash
TEST_TOKEN=1040 php artisan test tests/Feature/Trafico/ServicioComisariatoProveedorTest.php
```

Esperado: las tres primeras fallan con `404 Not Found` (la ruta no existe todavía). La de sesión puede dar 404 en vez de 401 por el mismo motivo; pasará cuando la ruta exista.

- [ ] **Step 3: Añadir el método al controlador**

En `app/Http/Controllers/Api/ServicioComisariatoController.php`, añadir el `use App\Models\FactServicio;` que falte y este método:

```php
    /**
     * Los proveedores entre los que elige Tráfico al capturar.
     *
     * Del otro lado son servicios del catálogo de facturación, y lo que llevan dentro —precio,
     * margen, ajuste— es asunto de facturación: aquí se devuelve SOLO id y nombre. Un usuario de
     * Tráfico no tiene por qué ver cuánto se le carga encima a lo que entregó un proveedor, y así
     * tampoco hace falta darle permiso sobre el catálogo.
     */
    public function proveedores()
    {
        return response()->json(
            FactServicio::query()
                ->whereHas('categoria', fn ($q) => $q->where('nombre', 'Comisariatos'))
                ->where('status', 'A')
                ->orderBy('nombre')
                ->get(['id', 'nombre'])
        );
    }
```

Si `FactServicio` no tuviera una relación `categoria()`, usar en su lugar una subconsulta por `categoria_servicio_id`:

```php
                ->whereIn('categoria_servicio_id', FactCategoriaServicio::where('nombre', 'Comisariatos')->select('id'))
```

**Comprobar cuál de las dos aplica leyendo `app/Models/FactServicio.php` antes de escribir.** No dejar las dos.

- [ ] **Step 4: Añadir la ruta**

En `routes/api.php`, dentro del grupo que empieza en la línea 185, **antes** de la ruta `GET /{servicioComisariato}` — si va después, `proveedores` se tomaría por un id y daría 404:

```php
    Route::get('/proveedores', [ServicioComisariatoController::class, 'proveedores']);
```

- [ ] **Step 5: Correr las pruebas y verlas pasar**

```bash
TEST_TOKEN=1040 php artisan test tests/Feature/Trafico/ServicioComisariatoProveedorTest.php
```

Esperado: 5 pruebas en verde.

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/Api/ServicioComisariatoController.php routes/api.php tests/Feature/Trafico/ServicioComisariatoProveedorTest.php
git commit -m "feat(trafico): endpoint con los proveedores de comisariato, solo id y nombre

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Los Form Requests y el guardado

**Files:**
- Create: `app/Http/Requests/Trafico/StoreServicioComisariatoRequest.php`
- Create: `app/Http/Requests/Trafico/UpdateServicioComisariatoRequest.php`
- Modify: `app/Http/Controllers/Api/ServicioComisariatoController.php:19-56` (`store`) y `:112-186` (`update` y `validarFechaSiCambia`)
- Modify: `tests/Feature/Trafico/ServicioComisariatoProveedorTest.php`

**Interfaces:**
- Consumes: los helpers de la Task 1 y la columna `fact_servicio_id`.
- Produces: el alta y la edición aceptan `proveedorId` (camelCase, como el resto de las claves que ya recibe este controlador) y lo guardan en `fact_servicio_id`; ninguna de las dos escribe ya `catering`.

**Cuidado con la ventana de fecha.** Hoy `update()` llama a `validarFechaSiCambia()` **antes** de validar el resto: la ventana `comisariato.entrega` solo se exige cuando la fecha **cambia**, para que una ficha vieja con fecha ya fuera de ventana se pueda seguir corrigiendo. Al mover la validación a un Form Request ese orden se invierte, así que la condición se traslada **dentro** del Update Request y el método privado del controlador desaparece. El comportamiento no cambia; el sitio sí.

- [ ] **Step 1: Escribir las pruebas que fallan**

Añadir al fichero de pruebas:

```php
test('el alta guarda el proveedor elegido y ya no escribe catering', function () {
    $servicio = servicioComisariato('Comisariato_Comexa');
    $this->actingAs(User::factory()->create());

    $this->postJson('/api/ServicioComisariato', [
        'proveedorId' => $servicio->id,
        'formaPago' => 'Cargo a la matrícula',
        'fechaEntrega' => now()->toDateString(),
        'horaEntrega' => '07:00',
        'matricula' => 'XA-ABC',
        'detalle' => 'Salmón y ensalada cesar',
        'solicitadoPor' => 'Capitán',
        'atendio' => 'Mostrador',
        'subtotal' => 520,
        'total' => 520,
    ])->assertCreated();

    $guardado = ServicioComisariato::latest('id')->first();

    expect($guardado->fact_servicio_id)->toBe($servicio->id)
        ->and($guardado->catering)->toBeNull();
});

test('el alta rechaza un servicio que no es de la categoria Comisariatos', function () {
    $otraCategoria = FactCategoriaServicio::create(['nombre' => 'Tránsitos', 'status' => 'A']);
    $ajeno = FactServicio::create([
        'categoria_servicio_id' => $otraCategoria->id,
        'nombre' => 'Transito 12 horas',
        'precio_unitario' => 99,
        'es_de_tercero' => false,
        'margen' => 0,
        'ajuste_precio' => FactServicio::AJUSTE_NINGUNO,
        'status' => 'A',
    ]);

    $this->actingAs(User::factory()->create());

    $this->postJson('/api/ServicioComisariato', [
        'proveedorId' => $ajeno->id,
        'fechaEntrega' => now()->toDateString(),
        'horaEntrega' => '07:00',
        'subtotal' => 520,
        'total' => 520,
    ])->assertStatus(422)->assertJsonValidationErrors('proveedorId');
});

test('el alta rechaza un proveedor dado de baja', function () {
    $baja = servicioComisariato('Comisariato_Avemex', 'N');
    $this->actingAs(User::factory()->create());

    $this->postJson('/api/ServicioComisariato', [
        'proveedorId' => $baja->id,
        'fechaEntrega' => now()->toDateString(),
        'horaEntrega' => '07:00',
        'subtotal' => 520,
        'total' => 520,
    ])->assertStatus(422)->assertJsonValidationErrors('proveedorId');
});

test('el alta exige elegir proveedor', function () {
    $this->actingAs(User::factory()->create());

    $this->postJson('/api/ServicioComisariato', [
        'fechaEntrega' => now()->toDateString(),
        'horaEntrega' => '07:00',
        'subtotal' => 520,
        'total' => 520,
    ])->assertStatus(422)->assertJsonValidationErrors('proveedorId');
});

test('la edicion cambia el proveedor', function () {
    $comexa = servicioComisariato('Comisariato_Comexa');
    $manny = servicioComisariato('Comisariato_Manny');
    $comisariato = comisariatoDe(['fact_servicio_id' => $comexa->id, 'fecha_entrega' => now()->toDateString()]);

    $this->actingAs(User::factory()->create());

    $this->putJson("/api/ServicioComisariato/{$comisariato->id}", [
        'proveedorId' => $manny->id,
        'fechaEntrega' => $comisariato->fecha_entrega->toDateString(),
        'horaEntrega' => '07:00',
        'subtotal' => 520,
        'total' => 520,
    ])->assertOk();

    expect($comisariato->fresh()->fact_servicio_id)->toBe($manny->id);
});

test('una ficha con la fecha ya fuera de ventana se sigue pudiendo corregir', function () {
    // Es la razón de ser de la condición: la ventana solo se exige cuando la fecha CAMBIA.
    $comexa = servicioComisariato('Comisariato_Comexa');
    $vieja = comisariatoDe(['fact_servicio_id' => $comexa->id, 'fecha_entrega' => '2020-01-01']);

    $this->actingAs(User::factory()->create());

    $this->putJson("/api/ServicioComisariato/{$vieja->id}", [
        'proveedorId' => $comexa->id,
        'fechaEntrega' => '2020-01-01',
        'horaEntrega' => '09:30',
        'subtotal' => 700,
        'total' => 700,
    ])->assertOk();

    expect($vieja->fresh()->hora_entrega->format('H:i'))->toBe('09:30');
});
```

- [ ] **Step 2: Correrlas y verlas fallar por la razón correcta**

```bash
TEST_TOKEN=1040 php artisan test tests/Feature/Trafico/ServicioComisariatoProveedorTest.php
```

Esperado: las de rechazo fallan porque la respuesta es `201` en vez de `422` (hoy `proveedorId` ni se mira), y la primera falla porque `fact_servicio_id` es `null`.

- [ ] **Step 3: Crear el Store Request**

`app/Http/Requests/Trafico/StoreServicioComisariatoRequest.php`:

```php
<?php

namespace App\Http\Requests\Trafico;

use App\Models\FactCategoriaServicio;
use App\Models\FactServicio;
use App\Rules\DentroDeLaVentana;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreServicioComisariatoRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            // `bail`: la comprobación de la categoría consulta el catálogo y solo tiene sentido si el servicio existe.
            'proveedorId' => ['bail', 'required', 'integer', Rule::exists('fact_servicios', 'id')->where('status', 'A'), $this->esProveedorDeComisariato(...)],
            'formaPago' => ['nullable', 'string', 'max:100'],
            'fechaEntrega' => ['required', 'date', new DentroDeLaVentana('comisariato.entrega')],
            'horaEntrega' => ['required', 'date_format:H:i'],
            'matricula' => ['nullable', 'string', 'max:50'],
            'detalle' => ['nullable', 'string'],
            'solicitadoPor' => ['nullable', 'string', 'max:150'],
            'atendio' => ['nullable', 'string', 'max:150'],
            'subtotal' => ['required', 'numeric', 'min:0'],
            'total' => ['required', 'numeric', 'min:0'],
        ];
    }

    /**
     * Que el servicio exista no basta: tiene que ser de la categoría Comisariatos.
     *
     * Sin esta comprobación, el id de Combustible o de un Tránsito pasaría, y el comisariato
     * acabaría cobrándose como otra cosa, con el margen y el ajuste de otro servicio.
     */
    protected function esProveedorDeComisariato(string $atributo, mixed $valor, \Closure $fallar): void
    {
        $esDeComisariato = FactServicio::query()
            ->whereKey($valor)
            ->whereIn('categoria_servicio_id', FactCategoriaServicio::where('nombre', 'Comisariatos')->select('id'))
            ->exists();

        if (! $esDeComisariato) {
            $fallar('Ese proveedor no es de comisariato.');
        }
    }

    public function messages(): array
    {
        return [
            'proveedorId.required' => 'Elige el proveedor del comisariato.',
            'proveedorId.integer' => 'El proveedor no es válido.',
            'proveedorId.exists' => 'Ese proveedor no existe o está dado de baja.',
            'fechaEntrega.required' => 'La fecha de entrega es obligatoria.',
            'horaEntrega.required' => 'La hora de entrega es obligatoria.',
            'horaEntrega.date_format' => 'La hora de entrega va en formato de 24 horas, HH:MM.',
            'subtotal.required' => 'El subtotal es obligatorio.',
            'total.required' => 'El total es obligatorio.',
        ];
    }
}
```

- [ ] **Step 4: Crear el Update Request**

`app/Http/Requests/Trafico/UpdateServicioComisariatoRequest.php`: igual que el anterior salvo la regla de `fechaEntrega`, que lleva la ventana **solo si la fecha cambia**. Repetido entero a propósito, porque quien lo lea puede no haber visto el otro:

```php
<?php

namespace App\Http\Requests\Trafico;

use App\Models\FactCategoriaServicio;
use App\Models\FactServicio;
use App\Models\ServicioComisariato;
use App\Rules\DentroDeLaVentana;
use App\Support\VentanasDeFecha;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateServicioComisariatoRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'proveedorId' => ['bail', 'required', 'integer', Rule::exists('fact_servicios', 'id')->where('status', 'A'), $this->esProveedorDeComisariato(...)],
            'formaPago' => ['nullable', 'string', 'max:100'],
            'fechaEntrega' => $this->reglasDeLaFecha(),
            'horaEntrega' => ['required', 'date_format:H:i'],
            'matricula' => ['nullable', 'string', 'max:50'],
            'detalle' => ['nullable', 'string'],
            'solicitadoPor' => ['nullable', 'string', 'max:150'],
            'atendio' => ['nullable', 'string', 'max:150'],
            'subtotal' => ['required', 'numeric', 'min:0'],
            'total' => ['required', 'numeric', 'min:0'],
        ];
    }

    /**
     * Una edición solo juzga la fecha de entrega cuando CAMBIA.
     *
     * Un servicio guardado con una fecha que ya quedó fuera de la ventana conserva esa fecha
     * intacta; exigirle la ventana bloquearía cualquier corrección del resto del registro. Lo
     * que la ventana impide es poner una fecha fuera de ella.
     *
     * @return array<int, mixed>
     */
    protected function reglasDeLaFecha(): array
    {
        $comisariato = $this->route('servicioComisariato');
        $recibidaComoDia = VentanasDeFecha::diaQueGuardaElModelo($this->input('fechaEntrega'));

        $noCambia = $comisariato instanceof ServicioComisariato
            && $recibidaComoDia !== null
            && $recibidaComoDia === $comisariato->fecha_entrega?->toDateString();

        return $noCambia
            ? ['required', 'date']
            : ['required', 'date', new DentroDeLaVentana('comisariato.entrega')];
    }

    /**
     * Que el servicio exista no basta: tiene que ser de la categoría Comisariatos.
     *
     * Sin esta comprobación, el id de Combustible o de un Tránsito pasaría, y el comisariato
     * acabaría cobrándose como otra cosa, con el margen y el ajuste de otro servicio.
     */
    protected function esProveedorDeComisariato(string $atributo, mixed $valor, \Closure $fallar): void
    {
        $esDeComisariato = FactServicio::query()
            ->whereKey($valor)
            ->whereIn('categoria_servicio_id', FactCategoriaServicio::where('nombre', 'Comisariatos')->select('id'))
            ->exists();

        if (! $esDeComisariato) {
            $fallar('Ese proveedor no es de comisariato.');
        }
    }

    public function messages(): array
    {
        return [
            'proveedorId.required' => 'Elige el proveedor del comisariato.',
            'proveedorId.integer' => 'El proveedor no es válido.',
            'proveedorId.exists' => 'Ese proveedor no existe o está dado de baja.',
            'fechaEntrega.required' => 'La fecha de entrega es obligatoria.',
            'horaEntrega.required' => 'La hora de entrega es obligatoria.',
            'horaEntrega.date_format' => 'La hora de entrega va en formato de 24 horas, HH:MM.',
            'subtotal.required' => 'El subtotal es obligatorio.',
            'total.required' => 'El total es obligatorio.',
        ];
    }
}
```

- [ ] **Step 5: Usar los Form Requests en el controlador**

En `app/Http/Controllers/Api/ServicioComisariatoController.php`:

1. Añadir los `use App\Http\Requests\Trafico\StoreServicioComisariatoRequest;` y `...\UpdateServicioComisariatoRequest;`.
2. `store(Request $request)` pasa a `store(StoreServicioComisariatoRequest $request)`, y la llamada a `$request->validate([...])` se sustituye por `$validated = $request->validated();`.
3. En el array que se pasa a `ServicioComisariato::create([...])`, **quitar** la línea `'catering' => $validated['catering'] ?? null,` y **añadir** `'fact_servicio_id' => $validated['proveedorId'],`.
4. `update(Request $request, ...)` pasa a `update(UpdateServicioComisariatoRequest $request, ...)`; se borran la llamada a `$this->validarFechaSiCambia(...)`, el bloque `$request->validate([...])` y el método privado `validarFechaSiCambia()` entero, con su bloque de documentación (se movió al Update Request).
5. En el array de `update([...])`, el mismo cambio que en el punto 3.
6. Si al quitar `validarFechaSiCambia()` quedan `use` sin usar (`DentroDeLaVentana`, `VentanasDeFecha`, `Illuminate\Http\Request` si ya no se usa en `index`), quitarlos. **`Request` sigue haciendo falta en `index`**: comprobarlo antes de borrarlo.

- [ ] **Step 6: Correr las pruebas y verlas pasar**

```bash
TEST_TOKEN=1040 php artisan test tests/Feature/Trafico/ServicioComisariatoProveedorTest.php
```

Esperado: 11 pruebas en verde.

- [ ] **Step 7: Commit**

```bash
git add app/Http/Requests/Trafico app/Http/Controllers/Api/ServicioComisariatoController.php tests/Feature/Trafico/ServicioComisariatoProveedorTest.php
git commit -m "feat(trafico): el alta y la edicion guardan el proveedor elegido

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Filtrar la tabla por proveedor

**Files:**
- Modify: `app/Http/Controllers/Api/ServicioComisariatoController.php:79-81` (el filtro `catering` de `index`)
- Modify: `tests/Feature/Trafico/ServicioComisariatoProveedorTest.php`

**Interfaces:**
- Consumes: la columna `fact_servicio_id` y los helpers de la Task 1.
- Produces: `GET /api/ServicioComisariato` acepta `proveedorId=<id>` y `proveedorId=sin` (las que no tienen proveedor). El parámetro `catering` deja de existir. El buscador general (`search`) **sigue mirando `catering`** y no se toca.

- [ ] **Step 1: Escribir las pruebas que fallan**

```php
test('la tabla se filtra por proveedor', function () {
    $comexa = servicioComisariato('Comisariato_Comexa');
    $manny = servicioComisariato('Comisariato_Manny');
    comisariatoDe(['fact_servicio_id' => $comexa->id, 'matricula' => 'XA-UNO']);
    comisariatoDe(['fact_servicio_id' => $manny->id, 'matricula' => 'XA-DOS']);

    $this->actingAs(User::factory()->create());

    $datos = $this->getJson("/api/ServicioComisariato?proveedorId={$comexa->id}")->assertOk()->json('data');

    expect($datos)->toHaveCount(1)->and($datos[0]['matricula'])->toBe('XA-UNO');
});

test('la tabla encuentra las que se quedaron sin proveedor', function () {
    $comexa = servicioComisariato('Comisariato_Comexa');
    comisariatoDe(['fact_servicio_id' => $comexa->id, 'matricula' => 'XA-UNO']);
    comisariatoDe(['matricula' => 'XA-VIEJA', 'catering' => 'fd']);

    $this->actingAs(User::factory()->create());

    $datos = $this->getJson('/api/ServicioComisariato?proveedorId=sin')->assertOk()->json('data');

    expect($datos)->toHaveCount(1)->and($datos[0]['matricula'])->toBe('XA-VIEJA');
});

test('el buscador general sigue encontrando el texto viejo de catering', function () {
    comisariatoDe(['matricula' => 'XA-VIEJA', 'catering' => 'Mannys Catering']);

    $this->actingAs(User::factory()->create());

    $datos = $this->getJson('/api/ServicioComisariato?search=Mannys')->assertOk()->json('data');

    expect($datos)->toHaveCount(1)->and($datos[0]['matricula'])->toBe('XA-VIEJA');
});
```

- [ ] **Step 2: Correrlas y verlas fallar por la razón correcta**

```bash
TEST_TOKEN=1040 php artisan test tests/Feature/Trafico/ServicioComisariatoProveedorTest.php
```

Esperado: las dos primeras fallan contando 2 en vez de 1 (el parámetro se ignora). La tercera **debe pasar ya**: fija que el buscador general no se rompe. Si falla, el montaje está mal.

- [ ] **Step 3: Cambiar el filtro**

Sustituir el bloque de las líneas 79-81:

```php
        if ($request->filled('catering')) {
            $query->where('catering', 'like', '%' . trim($request->catering) . '%');
        }
```

por:

```php
        // `sin` son las filas anteriores a la lista de proveedores, que quedaron sin elegir.
        if ($request->filled('proveedorId')) {
            $request->proveedorId === 'sin'
                ? $query->whereNull('fact_servicio_id')
                : $query->where('fact_servicio_id', $request->proveedorId);
        }
```

- [ ] **Step 4: Correr las pruebas y verlas pasar**

```bash
TEST_TOKEN=1040 php artisan test tests/Feature/Trafico/ServicioComisariatoProveedorTest.php
```

Esperado: 14 pruebas en verde.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Api/ServicioComisariatoController.php tests/Feature/Trafico/ServicioComisariatoProveedorTest.php
git commit -m "feat(trafico): la tabla de comisariatos se filtra por proveedor

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Las pantallas

**Files:**
- Modify: `resources/js/stores/apiServicioComisariato.ts:38` (el tipo) y la función que llama al índice
- Modify: `resources/js/pages/Trafico/servicioComisariato/ServicioComisariatoForm.tsx:73` (estado) y `:188-196` (el campo)
- Modify: `resources/js/pages/Trafico/servicioComisariato/validacion.ts:2` y `:28`
- Modify: `resources/js/pages/Trafico/ServicioComisariato.tsx:32`, `:42`, `:219`, `:402-410` (filtro) y `:479-486` (celda)
- Modify: `resources/js/pages/Trafico/servicioComisariato/PdfComisariato.tsx:82`

**Interfaces:**
- Consumes: `GET /api/ServicioComisariato/proveedores` → `{ id: number; nombre: string }[]`; el campo `proveedorId` que esperan el alta y la edición; el parámetro `proveedorId` del índice (`<id>` o `'sin'`).
- Produces: nada que consuman otras tareas.

**No hay lanzador de pruebas de JavaScript.** La evidencia es `tsc` y el build, y la comprobación en el navegador.

- [ ] **Step 1: Medir la línea base de `tsc`**

```bash
npm run build && npx tsc --noEmit
```

Esperado: el build sale con 0 y `tsc` da **exactamente 1 error**, un TS1117 en `WalkAroundController.ts`. Anotar el número: al terminar tiene que seguir siendo 1.

- [ ] **Step 2: El store**

En `resources/js/stores/apiServicioComisariato.ts`: en el tipo de la fila, sustituir `catering?: string;` por

```ts
    catering?: string | null;
    fact_servicio_id?: number | null;
    fact_servicio?: { id: number; nombre: string } | null;
```

y añadir la función que trae la lista. **Este fichero usa `fetch` crudo, no axios**, y las rutas van con el prefijo `/api` completo:

```ts
export type ProveedorComisariato = { id: number; nombre: string };

export async function obtenerProveedoresComisariato(): Promise<ProveedorComisariato[]> {
    const res = await fetch('/api/ServicioComisariato/proveedores', {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
    });

    const data = await res.json().catch(() => []);

    if (!res.ok) {
        throw new Error('No se pudo cargar la lista de proveedores');
    }

    return data;
}
```

En el objeto de parámetros de `fetchServicioComisariato`, la clave `catering` pasa a `proveedorId`.

- [ ] **Step 3: El formulario**

En `ServicioComisariatoForm.tsx`:

1. En el estado inicial (línea 73), sustituir `catering: data?.catering ?? ""` por `proveedorId: data?.fact_servicio_id ? String(data.fact_servicio_id) : ""`.
2. Cargar la lista con `obtenerProveedoresComisariato()` en un efecto al montar, guardándola en estado.
3. Sustituir el bloque del `<input>` de Catering (líneas 188-196) por esto. El aviso de lista vacía sale **aquí**, que es donde de verdad impide guardar, y en ninguna otra pantalla:

```tsx
                        <div>
                            <label className={labelStyle}>Proveedor</label>
                            {proveedores.length === 0 ? (
                                <p className="text-xs text-amber-700">
                                    No hay proveedores de comisariato activos en el catálogo. Pide que
                                    reactiven uno en Facturación → Servicios antes de capturar.
                                </p>
                            ) : (
                                <select
                                    className={inputStyle}
                                    value={form.proveedorId}
                                    onChange={(e) => updateField("proveedorId", e.target.value)}
                                >
                                    <option value="">Elige un proveedor…</option>
                                    {proveedores.map((p) => (
                                        <option key={p.id} value={String(p.id)}>
                                            {p.nombre}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
```

Los nombres van **tal cual vienen del catálogo** (`Comisariato_Comexa`), sin quitarles el prefijo: sería lógica escondida que mentiría en cuanto alguien diera de alta un proveedor con otro nombre.

4. Donde el formulario arma el cuerpo de la petición, mandar `proveedorId: Number(form.proveedorId)` y **dejar de mandar `catering`**.

- [ ] **Step 4: La validación del front**

En `validacion.ts`: en el tipo, `catering: string;` pasa a `proveedorId: string;`. En la línea 28, la comprobación pasa a:

```ts
    if (!form.proveedorId) errores.push("Proveedor es obligatorio");
```

- [ ] **Step 5: La tabla y el filtro**

En `ServicioComisariato.tsx`:

1. En el tipo de filtros (línea 32) y en `filtrosIniciales()` (línea 42), `catering` pasa a `proveedorId`, con `''` inicial.
2. Donde se arman los parámetros (línea 219), mandar `proveedorId: filtros.proveedorId`.
3. El `<input type="text">` del filtro (líneas 402-410) pasa a `<select>` con las mismas clases, con una opción vacía «Todos», una opción `value="sin"` con el texto «Sin proveedor», y una por proveedor. La lista se trae con `obtenerProveedoresComisariato()` al montar.
4. En la celda (línea 482), `{row.catering || "S/N"}` pasa a `{row.fact_servicio?.nombre ?? row.catering ?? "S/N"}`.

Para que `fact_servicio` llegue en la respuesta, el índice tiene que cargar la relación: en `index()` del controlador, cambiar `ServicioComisariato::query()` por `ServicioComisariato::query()->with('factServicio:id,nombre')`. **Esto toca el backend, así que lleva su prueba** (añadirla al fichero de pruebas):

```php
test('la tabla trae el nombre del proveedor para pintarlo', function () {
    $comexa = servicioComisariato('Comisariato_Comexa');
    comisariatoDe(['fact_servicio_id' => $comexa->id]);

    $this->actingAs(User::factory()->create());

    expect($this->getJson('/api/ServicioComisariato')->assertOk()->json('data.0.fact_servicio.nombre'))
        ->toBe('Comisariato_Comexa');
});
```

Escribirla **antes** del cambio y verla fallar con `null`.

**El nombre de la clave en el JSON ya está comprobado:** `Model::$snakeAttributes` es `true` en este proyecto, así que la relación `factServicio()` se serializa como **`fact_servicio`**. Es la clave que usan la prueba de arriba y el `.tsx`.

- [ ] **Step 6: El PDF**

En `PdfComisariato.tsx`, línea 82: `{data.catering}` pasa a `{data.fact_servicio?.nombre ?? data.catering ?? ""}`, y la etiqueta «Catering» pasa a «Proveedor».

- [ ] **Step 7: Build y `tsc`**

```bash
npm run build && npx tsc --noEmit
```

Esperado: build 0 y `tsc` con **exactamente 1 error**, el mismo de la línea base. Cualquier error nuevo se arregla antes de seguir.

- [ ] **Step 8: Correr las pruebas del servidor**

```bash
TEST_TOKEN=1040 php artisan test tests/Feature/Trafico/ServicioComisariatoProveedorTest.php
```

Esperado: 15 en verde.

- [ ] **Step 9: Commit**

```bash
git add resources/js app/Http/Controllers/Api/ServicioComisariatoController.php tests/Feature/Trafico/ServicioComisariatoProveedorTest.php
git commit -m "feat(trafico): el proveedor del comisariato se elige de una lista en pantalla

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: La suite entera y la pantalla de verdad

**Files:** ninguno. Esta tarea verifica.

- [ ] **Step 1: La migración en la base de desarrollo**

**Pedir permiso antes de correrla.** `eolo_plus` es la base real del usuario y esto la escribe. Con permiso:

```bash
php artisan migrate
```

Después, comprobar el relleno **leyendo**:

```bash
php artisan tinker --execute="foreach (App\Models\ServicioComisariato::orderBy('id')->get() as \$c) { echo \$c->id.' | '.var_export(\$c->catering,true).' -> '.var_export(\$c->fact_servicio_id,true).PHP_EOL; }"
```

Esperado exacto: las filas **3, 5, 6, 8, 9** apuntando a 36; las filas **4, 7, 10** a 48; las filas **1 y 2** en `NULL`.

- [ ] **Step 2: La suite entera, en serie**

```bash
TEST_TOKEN=1041 php artisan test
```

**Nunca con `--parallel`.** La línea base de la rama es **3507 pruebas, 0 fallos**; con las 15 de este trabajo deberían ser **3522**. Si no cuadra, reportar el número real en vez de ajustar la expectativa.

Después: `rm -rf storage/framework/testing/disks/*_test_1041`

- [ ] **Step 3: El navegador**

Tres trampas del entorno, ya medidas. **No redescubrirlas:**

1. El preview arranca desde `C:\xampp\htdocs\EOLO` (el **PADRE**), así que lee `EOLO\.claude\launch.json`, no el de `Eolo-plus\`.
2. **Sanctum** solo trata como *stateful* `localhost`, `localhost:3000`, `127.0.0.1`, `127.0.0.1:8000`, `::1` y el host de `APP_URL`. En otro puerto `/api/*` da **401** y las tablas salen vacías.
3. `public/hot` apunta a `http://192.168.7.10:5173`, **una IP que ya no responde**. Hay que **apartarlo** (`mv public/hot public/hot.bak`) y **restaurarlo al terminar**.

Entrar como `Administrador EOLO`, contraseña del seeder `AdminUserSeeder`. Fortify autentica por **`name`**, no por correo. La pantalla está en `/trafico/...` según `routes/web.php:84`.

Qué comprobar:

1. El campo Proveedor es un desplegable con los cinco servicios y ya no se puede teclear.
2. La tabla muestra el nombre del proveedor en las filas rellenadas y el texto viejo en las dos que quedaron en nulo.
3. El filtro por proveedor acota, y «Sin proveedor» encuentra esas dos.
4. Guardar un comisariato nuevo con proveedor funciona, y al volver a abrirlo el desplegable aparece con su valor.

**No borrar ni cancelar registros.** La base es la real del usuario. Si hace falta escribir para probar algo más, **pedirlo antes**.

Hacer una **captura** de la tabla con los nombres de proveedor.

- [ ] **Step 4: Informe**

Con el recuento de la suite, el resultado del relleno fila por fila, los cuatro puntos del navegador uno a uno, la confirmación de que `public/hot` quedó restaurado, y la captura.

Si todo salió verde y no se tocó código, **no hay nada que commitear**: decirlo en vez de inventarse un commit.

---

## Qué queda fuera, a propósito

- **El enlace con las prefacturas**, que es el trabajo siguiente y tendrá su propia spec.
- **Tirar la columna `catering`.**
- **Renombrar los cinco servicios del catálogo** para que se lean limpios en el desplegable.
- **Normalizar `forma_pago`**, que también es texto libre con cuatro grafías de «cargo a la matrícula».
- **Ordenar `subtotal` y `total`.** El front ya impide que el total sea menor que el subtotal (`validacion.ts`), pero **el servidor no lo valida**, así que la API sigue aceptando importes incoherentes. Así entraron las filas que hoy se contradicen.
- **`GET eliminar/{id}`**, que borra con un GET.
- **Que el controlador cree aeronaves desde texto libre** (`buscarOCrear`). Es el origen de las seis parejas de matrículas duplicadas y **va a importar en el enlace con facturación**, pero no en esta pieza.
