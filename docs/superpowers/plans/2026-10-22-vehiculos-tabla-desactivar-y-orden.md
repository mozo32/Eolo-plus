# Vehículos Eolo: número económico, desactivar y orden por uso — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la tabla de `MovimientosVehiculoEolo` muestre el número económico bajo el nombre, permita desactivar y reactivar un vehículo con candados de rol y de «En Ruta», y salga ordenada por número de movimientos con los desactivados al fondo.

**Architecture:** Una columna `activo` en `vehiculos` separa «dado de baja» de `estado`, que sigue siendo la posición física. El orden lo calcula el servidor con `withCount('movimientos')`, lo que obliga a arreglar la relación rota del modelo. Un endpoint `PATCH` nuevo cambia `activo` con dos candados en servidor (rol y «En Ruta») y deja rastro en bitácora; la pantalla esconde el botón por rol y los de entrada/salida en un inactivo.

**Tech Stack:** Laravel 12, PHP 8.2, Pest 3 sobre sqlite, Inertia 2 + React 19 + TypeScript, Tailwind 4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-22-vehiculos-tabla-desactivar-y-orden-design.md`

## Global Constraints

- **Rama base:** `main`, punta `b57acf5`. Trabajar en una rama propia, nunca directamente sobre `main`.
- **Las pruebas corren EN SERIE:** `php artisan test` o `php artisan test --filter=X`. **Nunca `--parallel`**: da fallos falsos en este proyecto.
- **Nunca correr `vendor/bin/pint` ni `prettier` sobre archivos preexistentes.** Reescriben cientos de líneas ajenas al cambio. Solo formatear archivos creados por este plan, y solo si hace falta.
- **Nunca usar `git stash`.** Hay tres stashes guardados en este repositorio que no son de este trabajo.
- **No existe ninguna prueba de JavaScript** en el proyecto (ni vitest ni jest). La verificación del front es `npx tsc --noEmit` comparado contra una línea base tomada ANTES de tocar nada, más `npm run build`. **No correr `npm run lint`**: lleva `--fix` y reescribe archivos ajenos.
- **La conexión `remota` es de solo lectura por contrato.** Este trabajo no la toca en ningún punto.
- **Los tres roles permitidos para desactivar son exactamente `fbo`, `admin2` y `admin`**, y se comprueba la lista entera de roles del usuario, nunca `roles[0]`.
- **`bitacoras.registro_id` es `unsignedBigInteger`.** El id de un vehículo es una cadena (`01-KIA`), así que NUNCA se pasa como `registroId`: viaja en la descripción y en `datos_nuevos`.
- **No declarar una función de prueba llamada `usuarioConRol`**: ya existe como función global en `tests/Feature/OperacionesDiarias/CancelarOperacionTest.php` y una segunda declaración es un error fatal de PHP, no un fallo de prueba.

---

## Estructura de archivos

**Se crean:**

| Archivo | Responsabilidad |
|---|---|
| `database/migrations/2026_10_22_090000_add_activo_to_vehiculos_table.php` | Columna `activo` |
| `tests/Feature/MovimientosVehiculoEolo/VehiculoActivoTest.php` | Modelo: default de `activo`, relación `movimientos()` |
| `tests/Feature/MovimientosVehiculoEolo/ListadoVehiculosTest.php` | `index()`: campos nuevos y orden |
| `tests/Feature/MovimientosVehiculoEolo/DesactivarVehiculoTest.php` | Endpoint `PATCH`: roles, «En Ruta», idempotencia, bitácora |
| `tests/Feature/MovimientosVehiculoEolo/MovimientosDeInactivoTest.php` | Consecuencias: no registra, sí consulta, reactivar devuelve el permiso |

**Se modifican:**

| Archivo | Cambio |
|---|---|
| `app/Models/Vehiculo.php` | `movimientos()` apunta a la clase correcta; `activo` en `$fillable` y casteado |
| `app/Models/Bitacora.php` | Constante `MODULO_MOVIMIENTOS_VEHICULOS` |
| `app/Http/Controllers/Api/VehiculoEoloController.php` | `index()` con cuenta y orden; `cambiarActivo()`; candado en `registrarMovimiento()` |
| `routes/api.php` | Ruta `PATCH /VehiculoEolo/vehiculos/{id}/activo` |
| `tests/Pest.php` | Dos ayudantes compartidos para vehículos |
| `resources/js/pages/seguridad/MovimientosVehiculoEolo/types.ts` | `activo` y `movimientos` |
| `resources/js/stores/apiVehiculoEolo.ts` | `cambiarActivo()` |
| `resources/js/pages/seguridad/MovimientosVehiculoEolo/TablaVehiculos.tsx` | Cabecera nueva, props nuevas |
| `resources/js/pages/seguridad/MovimientosVehiculoEolo/FilaVehiculo.tsx` | Id apilado, insignia, cuarta acción, botones ocultos |
| `resources/js/pages/seguridad/MovimientosVehiculoEolo/ControlVehiculos.tsx` | Lee roles, maneja el cambio de `activo` |

---

### Task 1: La columna `activo` y la relación arreglada

**Files:**
- Create: `database/migrations/2026_10_22_090000_add_activo_to_vehiculos_table.php`
- Modify: `app/Models/Vehiculo.php`
- Modify: `tests/Pest.php` (añadir al final)
- Test: `tests/Feature/MovimientosVehiculoEolo/VehiculoActivoTest.php`

**Interfaces:**
- Produces: `Vehiculo::$activo` (bool, default `true`); `Vehiculo::movimientos(): HasMany` de `movimientoVehiculo`, ordenada por `created_at` descendente; las funciones globales de prueba `vehiculoDePrueba(string $id, string $nombre, string $estado = 'En Planta', bool $activo = true): Vehiculo` y `usuarioVehiculosConRol(string $slug): User`.
- Consumes: nada.

**Contexto que el implementador necesita:**

`vehiculos` tiene clave primaria `string` (`id`), que es el número económico (`01-KIA`, `TC-84`, `12`). El modelo ya declara `$keyType = 'string'` e `$incrementing = false`. La tabla de movimientos es `movimientos_vehiculos`, su modelo es `App\Models\movimientoVehiculo` (minúscula inicial, así se llama de verdad), su clave ajena es `vehiculo_id` y su columna de tipo es `tipo` con valores `'Entrada'` y `'Salida'`. `movimientoVehiculo` exige al crear: `vehiculo_id`, `tipo`, `chofer`, `kilometraje`, `gasolina`.

La relación de hoy apunta a `Movimiento::class`, clase que **no existe**. Por eso la prueba de `withCount` falla antes del arreglo con `Class "App\Models\Movimiento" not found`.

- [ ] **Step 1: Escribir los ayudantes compartidos de prueba**

Al final de `tests/Pest.php`, después de `usuarioSinAcceso()`:

```php
/**
 * Vehículo de la flota Eolo. El id ES el número económico, una cadena.
 */
function vehiculoDePrueba(
    string $id,
    string $nombre,
    string $estado = 'En Planta',
    bool $activo = true
): App\Models\Vehiculo {
    return App\Models\Vehiculo::create([
        'id' => $id,
        'nombre' => $nombre,
        'estado' => $estado,
        'activo' => $activo,
    ]);
}

/**
 * Usuario con un rol concreto, para los candados de MovimientosVehiculoEolo.
 *
 * No se llama `usuarioConRol`: ese nombre ya está tomado como función global
 * en tests/Feature/OperacionesDiarias/CancelarOperacionTest.php.
 */
function usuarioVehiculosConRol(string $slug): App\Models\User
{
    $usuario = App\Models\User::factory()->create();
    $rol = App\Models\Role::firstOrCreate(
        ['slug' => $slug],
        ['nombre' => ucfirst($slug)]
    );
    $usuario->roles()->attach($rol->id);

    return $usuario;
}

/**
 * N movimientos de un vehículo, para las pruebas de conteo y orden.
 */
function movimientosDePrueba(string $vehiculoId, int $cuantos): void
{
    foreach (range(1, $cuantos) as $i) {
        $movimiento = App\Models\movimientoVehiculo::create([
            'vehiculo_id' => $vehiculoId,
            'tipo' => $i % 2 === 1 ? 'Salida' : 'Entrada',
            'chofer' => 'Chofer de prueba',
            'kilometraje' => 1000 + $i,
            'gasolina' => '1/2',
        ]);

        // Marcas de tiempo separadas a propósito. Creados todos en el mismo
        // segundo, el orden por `created_at` sería un empate y la prueba del
        // orden pasaría o fallaría según el humor de la base. `created_at` no
        // está en $fillable, así que se escribe con forceFill.
        $movimiento->forceFill(['created_at' => now()->addSeconds($i)])->save();
    }
}
```

- [ ] **Step 2: Escribir la prueba que falla**

Crear `tests/Feature/MovimientosVehiculoEolo/VehiculoActivoTest.php`:

```php
<?php

use App\Models\Vehiculo;

/*
 * `activo` es «de alta en la flota», distinto de `estado`, que es dónde está el
 * vehículo. Y la relación movimientos() apuntaba a una clase inexistente: contar
 * movimientos por vehículo es lo que necesita el orden nuevo de la tabla.
 */

it('nace activo: un vehículo nuevo no cambia de comportamiento', function () {
    $vehiculo = vehiculoDePrueba('01-KIA', 'KIA');

    expect($vehiculo->fresh()->activo)->toBeTrue();
});

it('guarda la baja y la vuelve a leer como booleano, no como 0', function () {
    $vehiculo = vehiculoDePrueba('EP-16', 'URVAN');

    $vehiculo->update(['activo' => false]);

    expect($vehiculo->fresh()->activo)->toBeFalse();
});

it('cuenta los movimientos de cada vehículo con withCount', function () {
    vehiculoDePrueba('01-KIA', 'KIA');
    vehiculoDePrueba('IKON', 'IKON');
    movimientosDePrueba('01-KIA', 7);
    movimientosDePrueba('IKON', 2);

    $cuentas = Vehiculo::withCount('movimientos')
        ->pluck('movimientos_count', 'id')
        ->all();

    expect($cuentas)->toBe(['01-KIA' => 7, 'IKON' => 2]);
});

it('devuelve los movimientos del más nuevo al más viejo', function () {
    vehiculoDePrueba('TC-84', 'SUBURBAN');
    movimientosDePrueba('TC-84', 3);

    // Se asegura sobre el kilometraje (1000 + i), que es distinto en cada fila.
    // Sobre `tipo` no serviría: la secuencia Salida/Entrada/Salida es un
    // palíndromo y se lee igual del derecho que del revés, así que la prueba
    // pasaría también sin el orden, o con el orden al revés.
    $kilometrajes = Vehiculo::find('TC-84')->movimientos->pluck('kilometraje')->all();

    expect($kilometrajes)->toBe([1003, 1002, 1001]);
});
```

- [ ] **Step 3: Correrla y ver que falla**

```bash
php artisan test tests/Feature/MovimientosVehiculoEolo/VehiculoActivoTest.php
```

Esperado: FALLA. Las dos primeras por `activo` (columna inexistente), las dos últimas por `Class "App\Models\Movimiento" not found`.

- [ ] **Step 4: Escribir la migración**

Crear `database/migrations/2026_10_22_090000_add_activo_to_vehiculos_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->boolean('activo')
                ->default(true)
                ->after('estado');
        });
    }

    public function down(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->dropColumn('activo');
        });
    }
};
```

- [ ] **Step 5: Arreglar el modelo**

En `app/Models/Vehiculo.php`, el archivo entero queda así:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Vehiculo extends Model
{
    use HasFactory;

    protected $table = 'vehiculos';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'nombre',
        'estado',
        'activo',
        'ultima_actividad',
    ];

    protected function casts(): array
    {
        return [
            'activo' => 'boolean',
        ];
    }

    /**
     * Movimientos del vehículo, del más reciente al más antiguo.
     *
     * Apuntaba a `Movimiento::class`, que no existe: el modelo se llama
     * `movimientoVehiculo`. Nadie la usaba, así que el defecto estaba dormido.
     */
    public function movimientos(): HasMany
    {
        return $this->hasMany(movimientoVehiculo::class, 'vehiculo_id')
            ->orderBy('created_at', 'desc');
    }
}
```

Conservar cualquier otro método o propiedad que el archivo tuviera y no esté arriba; si el archivo difiere de lo esperado, aplicar solo los cambios descritos (`$fillable`, `casts()`, `movimientos()`) y nada más.

- [ ] **Step 6: Correr la prueba y verla pasar**

```bash
php artisan test tests/Feature/MovimientosVehiculoEolo/VehiculoActivoTest.php
```

Esperado: 4 pruebas en verde.

- [ ] **Step 7: Correr la migración en la base de desarrollo**

```bash
php artisan migrate
```

Esperado: `add_activo_to_vehiculos_table` migrada. Los seis vehículos existentes quedan con `activo = 1`.

- [ ] **Step 8: Commit**

```bash
git add database/migrations/2026_10_22_090000_add_activo_to_vehiculos_table.php app/Models/Vehiculo.php tests/Pest.php tests/Feature/MovimientosVehiculoEolo/VehiculoActivoTest.php
git commit -m "feat(vehiculos): columna activo y relacion movimientos arreglada"
```

---

### Task 2: `index()` devuelve `activo` y `movimientos`, y ordena por uso

**Files:**
- Modify: `app/Http/Controllers/Api/VehiculoEoloController.php:17-32` (método `index`)
- Test: `tests/Feature/MovimientosVehiculoEolo/ListadoVehiculosTest.php`

**Interfaces:**
- Consumes: `Vehiculo::movimientos()` y el casteo de `activo` de la Task 1; `vehiculoDePrueba()`, `movimientosDePrueba()`, `usuarioAdmin()`.
- Produces: la respuesta de `GET /api/VehiculoEolo` pasa a ser una lista de objetos `{ id: string, nombre: string, estado: string, ultimaActividad: string, activo: bool, movimientos: int }`, ordenada por `activo` descendente, luego `movimientos` descendente, luego `id` ascendente.

**Contexto:**

El `index()` de hoy es:

```php
    public function index()
    {
        try {
            $vehiculos = Vehiculo::all()->map(function ($v) {
                return [
                    'id' => $v->id,
                    'nombre' => $v->nombre,
                    'estado' => $v->estado,
                    'ultimaActividad' => $v->ultima_actividad ?? 'N/A'
                ];
            });

            return response()->json($vehiculos, 200);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
```

La ruta es `GET /api/VehiculoEolo`, dentro del grupo `['api', 'auth:sanctum']` con prefijo `VehiculoEolo`, así que las pruebas autentican con `$this->actingAs($usuario, 'sanctum')`.

El tercer criterio de orden (`id` ascendente) no está en la spec: se añade para que el resultado sea determinista cuando dos vehículos empatan en número de movimientos. Sin él la prueba del orden sería inestable.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tests/Feature/MovimientosVehiculoEolo/ListadoVehiculosTest.php`:

```php
<?php

/*
 * La tabla principal se ordena por uso. Lo que se quiere arriba es lo que se
 * puede usar HOY: un desactivado con 933 movimientos va debajo de un activo
 * con 9.
 */

function listarVehiculos(): Illuminate\Testing\TestResponse
{
    return test()->getJson('/api/VehiculoEolo');
}

beforeEach(function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
});

it('devuelve activo y la cuenta de movimientos de cada vehículo', function () {
    vehiculoDePrueba('01-KIA', 'KIA');
    movimientosDePrueba('01-KIA', 5);

    $fila = listarVehiculos()->assertOk()->json('0');

    expect($fila['id'])->toBe('01-KIA')
        ->and($fila['nombre'])->toBe('KIA')
        ->and($fila['estado'])->toBe('En Planta')
        ->and($fila['activo'])->toBeTrue()
        ->and($fila['movimientos'])->toBe(5);
});

it('ordena por número de movimientos, de más usado a menos', function () {
    vehiculoDePrueba('N-15', 'NISSAN');
    vehiculoDePrueba('01-KIA', 'KIA');
    vehiculoDePrueba('EP-16', 'URVAN');
    movimientosDePrueba('N-15', 4);
    movimientosDePrueba('01-KIA', 9);
    movimientosDePrueba('EP-16', 1);

    $ids = collect(listarVehiculos()->assertOk()->json())->pluck('id')->all();

    expect($ids)->toBe(['01-KIA', 'N-15', 'EP-16']);
});

it('deja los desactivados al fondo aunque sean los más usados', function () {
    // Esta prueba falla si se ordenara solo por movimientos sin mirar `activo`.
    vehiculoDePrueba('TC-84', 'SUBURBAN', 'En Planta', false);
    vehiculoDePrueba('IKON', 'IKON');
    movimientosDePrueba('TC-84', 900);
    movimientosDePrueba('IKON', 2);

    $ids = collect(listarVehiculos()->assertOk()->json())->pluck('id')->all();

    expect($ids)->toBe(['IKON', 'TC-84']);
});

it('desempata por id para que el orden no dependa de la base', function () {
    vehiculoDePrueba('N-15', 'NISSAN');
    vehiculoDePrueba('12', 'NISSAN');
    movimientosDePrueba('N-15', 3);
    movimientosDePrueba('12', 3);

    $ids = collect(listarVehiculos()->assertOk()->json())->pluck('id')->all();

    expect($ids)->toBe(['12', 'N-15']);
});

it('un vehículo sin movimientos sale con cero, no se pierde de la lista', function () {
    vehiculoDePrueba('IKON', 'IKON');

    $filas = listarVehiculos()->assertOk()->json();

    expect($filas)->toHaveCount(1)
        ->and($filas[0]['movimientos'])->toBe(0);
});
```

- [ ] **Step 2: Correrla y ver que falla**

```bash
php artisan test tests/Feature/MovimientosVehiculoEolo/ListadoVehiculosTest.php
```

Esperado: FALLA. Las claves `activo` y `movimientos` no existen en la respuesta, y el orden no es el pedido.

- [ ] **Step 3: Reescribir `index()`**

Sustituir el método `index()` de `app/Http/Controllers/Api/VehiculoEoloController.php` por:

```php
    public function index()
    {
        try {
            $vehiculos = Vehiculo::query()
                ->withCount('movimientos')
                ->orderByDesc('activo')
                ->orderByDesc('movimientos_count')
                ->orderBy('id')
                ->get()
                ->map(function (Vehiculo $v) {
                    return [
                        'id' => $v->id,
                        'nombre' => $v->nombre,
                        'estado' => $v->estado,
                        'ultimaActividad' => $v->ultima_actividad ?? 'N/A',
                        'activo' => $v->activo,
                        'movimientos' => $v->movimientos_count,
                    ];
                });

            return response()->json($vehiculos, 200);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
```

- [ ] **Step 4: Correr la prueba y verla pasar**

```bash
php artisan test tests/Feature/MovimientosVehiculoEolo/ListadoVehiculosTest.php
```

Esperado: 5 pruebas en verde.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Api/VehiculoEoloController.php tests/Feature/MovimientosVehiculoEolo/ListadoVehiculosTest.php
git commit -m "feat(vehiculos): el listado trae activo, la cuenta de movimientos y el orden por uso"
```

---

### Task 3: El endpoint para desactivar y reactivar

**Files:**
- Modify: `app/Models/Bitacora.php` (añadir una constante junto a las demás `MODULO_`)
- Modify: `app/Http/Controllers/Api/VehiculoEoloController.php` (método nuevo `cambiarActivo`)
- Modify: `routes/api.php:201-206` (grupo `VehiculoEolo`)
- Test: `tests/Feature/MovimientosVehiculoEolo/DesactivarVehiculoTest.php`

**Interfaces:**
- Consumes: `Vehiculo::$activo` (Task 1); `vehiculoDePrueba()`, `usuarioVehiculosConRol()`.
- Produces: `PATCH /api/VehiculoEolo/vehiculos/{id}/activo` con cuerpo `{ "activo": bool }`. Respuesta 200 `{ "message": string, "vehiculo": { "id", "nombre", "estado", "activo" } }`. Errores: 403 sin rol, 404 id inexistente, 409 al desactivar «En Ruta», 422 si falta `activo`. `Bitacora::MODULO_MOVIMIENTOS_VEHICULOS === 'MOVIMIENTOS_VEHICULOS'`.

**Contexto:**

`User` ya trae `hasAnyRole(array $roles): bool` — úsalo, no hace falta escribir la comprobación a mano, y resuelve por sí solo el requisito de mirar la lista entera de roles en vez de `roles[0]`.

`Bitacora::log()` tiene esta firma:

```php
Bitacora::log(
    string $modulo,
    string $accion,
    string $descripcion,
    ?int $usuarioId = null,
    ?string $elabora = null,
    ?int $registroId = null,
    ?array $datosAnteriores = null,
    ?array $datosNuevos = null
): self
```

`registro_id` es `unsignedBigInteger` en la base: **no cabe `01-KIA`**. Se pasa `registroId: null` y el id del vehículo va en la descripción y en `datos_nuevos`. Las constantes de acción que existen son `Bitacora::ACCION_DESACTIVAR` y `Bitacora::ACCION_ACTIVAR`.

Orden de los candados, que importa: **rol primero**, después existencia, después «En Ruta». Así un usuario sin permiso recibe 403 sin enterarse de si el id existe.

El 409 se comprueba con `assertStatus(409)`: la convención del proyecto es preferir el método específico (`assertForbidden`, `assertNotFound`), pero `TestResponse` de esta versión de Laravel **no trae `assertConflict()`** — está verificado. No cambiarlo por uno que no existe.

El grupo de rutas de hoy es:

```php
Route::middleware(['api', 'auth:sanctum'])->prefix('VehiculoEolo')->group(function () {
    Route::get('/', [VehiculoEoloController::class, 'index']);
    Route::post('/movimientos', [VehiculoEoloController::class, 'registrarMovimiento']);
    Route::get('/vehiculos/{id}/movimientos', [VehiculoEoloController::class, 'obtenerHistorial']);
    Route::post('/', [VehiculoEoloController::class, 'store']);
});
```

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tests/Feature/MovimientosVehiculoEolo/DesactivarVehiculoTest.php`:

```php
<?php

use App\Models\Bitacora;
use App\Models\Vehiculo;

/*
 * Desactivar deja un vehículo sin poder trabajar. Por eso vive detrás de tres
 * roles y de un candado que impide dar de baja algo que está fuera de la planta:
 * si no, no podría registrar nunca su entrada.
 */

function cambiarActivo(string $id, bool $activo): Illuminate\Testing\TestResponse
{
    return test()->patchJson("/api/VehiculoEolo/vehiculos/{$id}/activo", ['activo' => $activo]);
}

it('los tres roles permitidos pueden desactivar', function (string $rol) {
    $this->actingAs(usuarioVehiculosConRol($rol), 'sanctum');
    vehiculoDePrueba('01-KIA', 'KIA');

    cambiarActivo('01-KIA', false)->assertOk();

    // Se comprueba la columna, no la respuesta: lo que importa es lo que quedó escrito.
    expect(Vehiculo::find('01-KIA')->activo)->toBeFalse();
})->with([
    'fbo' => ['fbo'],
    'administrativo' => ['admin2'],
    'administrador' => ['admin'],
]);

it('el permiso no depende del ORDEN de los roles del usuario', function () {
    // La decisión 4 del diseño: se mira la lista entera, no `roles[0]`. Sin esta
    // prueba, alguien podría «simplificar» a `roles[0]->slug` y la suite entera
    // seguiría verde mientras un usuario con dos roles pierde el permiso.
    $usuario = usuarioVehiculosConRol('empleado');
    $rolFbo = App\Models\Role::firstOrCreate(['slug' => 'fbo'], ['nombre' => 'FBO']);
    $usuario->roles()->attach($rolFbo->id);

    $this->actingAs($usuario, 'sanctum');
    vehiculoDePrueba('01-KIA', 'KIA');

    cambiarActivo('01-KIA', false)->assertOk();

    expect(Vehiculo::find('01-KIA')->activo)->toBeFalse();
});

it('un rol sin permiso recibe 403 y el vehículo no cambia', function () {
    $this->actingAs(usuarioVehiculosConRol('empleado'), 'sanctum');
    vehiculoDePrueba('01-KIA', 'KIA');

    cambiarActivo('01-KIA', false)->assertForbidden();

    expect(Vehiculo::find('01-KIA')->activo)->toBeTrue();
});

it('esconder el botón no basta: el 403 llega aunque el id no exista', function () {
    // El candado de rol va ANTES de buscar el vehículo, para no filtrar qué ids hay.
    $this->actingAs(usuarioVehiculosConRol('empleado'), 'sanctum');

    cambiarActivo('NO-EXISTE', false)->assertForbidden();
});

it('no se puede desactivar un vehículo que está En Ruta', function () {
    $this->actingAs(usuarioVehiculosConRol('fbo'), 'sanctum');
    vehiculoDePrueba('IKON', 'IKON', 'En Ruta');

    cambiarActivo('IKON', false)->assertStatus(409);

    expect(Vehiculo::find('IKON')->activo)->toBeTrue();
});

it('el mensaje del 409 dice qué hay que hacer antes', function () {
    $this->actingAs(usuarioVehiculosConRol('fbo'), 'sanctum');
    vehiculoDePrueba('IKON', 'IKON', 'En Ruta');

    $respuesta = cambiarActivo('IKON', false);

    expect($respuesta->json('message'))->toContain('entrada');
});

it('una vez registrada su entrada, el mismo vehículo sí se desactiva', function () {
    $this->actingAs(usuarioVehiculosConRol('fbo'), 'sanctum');
    $vehiculo = vehiculoDePrueba('IKON', 'IKON', 'En Ruta');

    cambiarActivo('IKON', false)->assertStatus(409);
    $vehiculo->update(['estado' => 'En Planta']);
    cambiarActivo('IKON', false)->assertOk();

    expect(Vehiculo::find('IKON')->activo)->toBeFalse();
});

it('reactivar no lleva el candado de En Ruta: un inactivo no pudo salir', function () {
    $this->actingAs(usuarioVehiculosConRol('admin'), 'sanctum');
    vehiculoDePrueba('EP-16', 'URVAN', 'En Planta', false);

    cambiarActivo('EP-16', true)->assertOk();

    expect(Vehiculo::find('EP-16')->activo)->toBeTrue();
});

it('es idempotente: desactivar algo ya inactivo responde 200 y no rompe nada', function () {
    $this->actingAs(usuarioVehiculosConRol('admin'), 'sanctum');
    vehiculoDePrueba('EP-16', 'URVAN', 'En Planta', false);

    cambiarActivo('EP-16', false)->assertOk();

    expect(Vehiculo::find('EP-16')->activo)->toBeFalse();
});

it('un id que no existe da 404 para quien sí tiene permiso', function () {
    $this->actingAs(usuarioVehiculosConRol('fbo'), 'sanctum');

    cambiarActivo('NO-EXISTE', false)->assertNotFound();
});

it('exige el campo activo y que sea booleano', function () {
    $this->actingAs(usuarioVehiculosConRol('fbo'), 'sanctum');
    vehiculoDePrueba('01-KIA', 'KIA');

    test()->patchJson('/api/VehiculoEolo/vehiculos/01-KIA/activo', [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('activo');
});

it('deja rastro de quién desactivó y a qué vehículo', function () {
    // La pregunta que llega cuando una unidad deja de poder trabajar es «¿quién
    // fue?». Sin este registro la respuesta es que no se sabe.
    $usuario = usuarioVehiculosConRol('fbo');
    $this->actingAs($usuario, 'sanctum');
    vehiculoDePrueba('01-KIA', 'KIA');

    cambiarActivo('01-KIA', false)->assertOk();

    $registro = Bitacora::where('modulo', Bitacora::MODULO_MOVIMIENTOS_VEHICULOS)->sole();

    expect($registro->accion)->toBe(Bitacora::ACCION_DESACTIVAR)
        ->and($registro->usuario_id)->toBe($usuario->id)
        ->and($registro->descripcion)->toContain('01-KIA')
        ->and($registro->datos_nuevos)->toBe(['vehiculo_id' => '01-KIA', 'activo' => false]);
});

it('reactivar deja su propio rastro, con la acción contraria', function () {
    $this->actingAs(usuarioVehiculosConRol('admin'), 'sanctum');
    vehiculoDePrueba('EP-16', 'URVAN', 'En Planta', false);

    cambiarActivo('EP-16', true)->assertOk();

    expect(Bitacora::where('modulo', Bitacora::MODULO_MOVIMIENTOS_VEHICULOS)->sole()->accion)
        ->toBe(Bitacora::ACCION_ACTIVAR);
});

it('un intento rechazado por rol no deja rastro en bitácora', function () {
    $this->actingAs(usuarioVehiculosConRol('empleado'), 'sanctum');
    vehiculoDePrueba('01-KIA', 'KIA');

    cambiarActivo('01-KIA', false)->assertForbidden();

    expect(Bitacora::where('modulo', Bitacora::MODULO_MOVIMIENTOS_VEHICULOS)->count())->toBe(0);
});
```

- [ ] **Step 2: Correrla y ver que falla**

```bash
php artisan test tests/Feature/MovimientosVehiculoEolo/DesactivarVehiculoTest.php
```

Esperado: FALLA. La ruta no existe (404 en todo) y `Bitacora::MODULO_MOVIMIENTOS_VEHICULOS` no está definida.

- [ ] **Step 3: Añadir la constante de módulo a la bitácora**

En `app/Models/Bitacora.php`, justo después de `public const MODULO_GESTION_USUARIOS = 'GESTION_USUARIOS';`:

```php
    public const MODULO_MOVIMIENTOS_VEHICULOS = 'MOVIMIENTOS_VEHICULOS';
```

- [ ] **Step 4: Escribir el método `cambiarActivo`**

En `app/Http/Controllers/Api/VehiculoEoloController.php`, añadir el `use App\Models\Bitacora;` junto a los demás `use` del principio, una constante de clase justo debajo de `class VehiculoEoloController extends Controller {`:

```php
    /**
     * Roles que pueden dar de baja o de alta un vehículo. Se comprueba la lista
     * entera de roles del usuario, no el primero: con dos roles, el permitido
     * podría no ser el primero.
     */
    private const ROLES_PARA_CAMBIAR_ACTIVO = ['fbo', 'admin2', 'admin'];
```

y el método nuevo después de `index()`:

```php
    public function cambiarActivo(Request $request, string $id)
    {
        if (! $request->user()?->hasAnyRole(self::ROLES_PARA_CAMBIAR_ACTIVO)) {
            return response()->json([
                'message' => 'No tienes permiso para dar de baja o de alta un vehículo.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'activo' => 'required|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors(),
            ], 422);
        }

        $vehiculo = Vehiculo::findOrFail($id);
        $activo = $request->boolean('activo');

        if (! $activo && $vehiculo->estado === 'En Ruta') {
            return response()->json([
                'message' => "El vehículo {$vehiculo->id} está En Ruta. Registra su entrada antes de desactivarlo.",
            ], 409);
        }

        $vehiculo->update(['activo' => $activo]);

        Bitacora::log(
            Bitacora::MODULO_MOVIMIENTOS_VEHICULOS,
            $activo ? Bitacora::ACCION_ACTIVAR : Bitacora::ACCION_DESACTIVAR,
            ($activo ? 'Reactivó' : 'Desactivó')." el vehículo {$vehiculo->id} ({$vehiculo->nombre})",
            datosNuevos: ['vehiculo_id' => $vehiculo->id, 'activo' => $activo],
        );

        return response()->json([
            'message' => $activo
                ? 'Vehículo reactivado'
                : 'Vehículo desactivado',
            'vehiculo' => [
                'id' => $vehiculo->id,
                'nombre' => $vehiculo->nombre,
                'estado' => $vehiculo->estado,
                'activo' => $vehiculo->activo,
            ],
        ], 200);
    }
```

`registroId` se deja sin pasar a propósito: la columna es `unsignedBigInteger` y el id de un vehículo es una cadena.

- [ ] **Step 5: Registrar la ruta**

En `routes/api.php`, dentro del grupo `prefix('VehiculoEolo')`, después de la línea de `obtenerHistorial`:

```php
    Route::patch('/vehiculos/{id}/activo', [VehiculoEoloController::class, 'cambiarActivo']);
```

- [ ] **Step 6: Correr la prueba y verla pasar**

```bash
php artisan test tests/Feature/MovimientosVehiculoEolo/DesactivarVehiculoTest.php
```

Esperado: 15 pruebas en verde (la primera es un dataset de 3).

- [ ] **Step 7: Commit**

```bash
git add app/Models/Bitacora.php app/Http/Controllers/Api/VehiculoEoloController.php routes/api.php tests/Feature/MovimientosVehiculoEolo/DesactivarVehiculoTest.php
git commit -m "feat(vehiculos): endpoint para desactivar y reactivar con candados de rol y En Ruta"
```

---

### Task 4: Un inactivo no se mueve, pero su bitácora se consulta

**Files:**
- Modify: `app/Http/Controllers/Api/VehiculoEoloController.php` (método `registrarMovimiento`)
- Test: `tests/Feature/MovimientosVehiculoEolo/MovimientosDeInactivoTest.php`

**Interfaces:**
- Consumes: `PATCH .../activo` (Task 3), `Vehiculo::$activo` (Task 1).
- Produces: `POST /api/VehiculoEolo/movimientos` responde **409** con `{ "message": "..." }` cuando el vehículo está inactivo, antes de guardar nada. `GET /api/VehiculoEolo/vehiculos/{id}/movimientos` no cambia.

**Contexto:**

`registrarMovimiento` valida primero con `Validator::make(...)` (devuelve 422 con `errors`), y después abre `DB::transaction(...)` donde crea el movimiento, guarda las evidencias en disco y actualiza el vehículo. El candado del inactivo va **después** de la validación y **antes** de la transacción: así no se guarda ninguna imagen de un movimiento que se va a rechazar.

Las evidencias son obligatorias (`'evidencias' => 'required|array|min:1'` y cada una `required|image`), así que la prueba necesita archivos falsos:

```php
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
```

y `Storage::fake('public')` en el `beforeEach` para no escribir en el disco real.

**Ojo con el verbo de prueba:** este endpoint recibe archivos, así que la petición va como `multipart/form-data`. Se usa `post(...)` con una cabecera `Accept: application/json`, **no `postJson(...)`**: `postJson` serializa el cuerpo como JSON y el `UploadedFile` no llegaría nunca, de modo que la validación fallaría con un 422 y la prueba parecería rota por otro motivo.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tests/Feature/MovimientosVehiculoEolo/MovimientosDeInactivoTest.php`:

```php
<?php

use App\Models\movimientoVehiculo;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/*
 * La consecuencia de desactivar: la unidad deja de poder registrar entradas y
 * salidas. Lo que NO deja de poder hacerse es consultar su bitácora — eso lo
 * pidió el departamento de forma explícita.
 */

beforeEach(function () {
    Storage::fake('public');
    $this->actingAs(usuarioVehiculosConRol('fbo'), 'sanctum');
});

function registrarMovimientoDe(string $vehiculoId, string $tipo): Illuminate\Testing\TestResponse
{
    // post(), no postJson(): el endpoint recibe archivos y el cuerpo va multipart.
    return test()->post('/api/VehiculoEolo/movimientos', [
        'vehiculo_id' => $vehiculoId,
        'movimiento' => $tipo,
        'chofer' => 'Juan Pérez',
        'kilometraje' => 12345,
        'gasolina' => '1/2',
        'evidencias' => [UploadedFile::fake()->image('tablero.jpg')],
    ], ['Accept' => 'application/json']);
}

it('un vehículo inactivo no registra salida', function () {
    vehiculoDePrueba('EP-16', 'URVAN', 'En Planta', false);

    registrarMovimientoDe('EP-16', 'Salida')->assertStatus(409);

    expect(movimientoVehiculo::count())->toBe(0);
});

it('un vehículo inactivo tampoco registra entrada', function () {
    vehiculoDePrueba('EP-16', 'URVAN', 'En Planta', false);

    registrarMovimientoDe('EP-16', 'Entrada')->assertStatus(409);

    expect(movimientoVehiculo::count())->toBe(0);
});

it('el mensaje del rechazo nombra al vehículo', function () {
    vehiculoDePrueba('EP-16', 'URVAN', 'En Planta', false);

    expect(registrarMovimientoDe('EP-16', 'Salida')->json('message'))->toContain('EP-16');
});

it('no guarda ninguna evidencia de un movimiento rechazado', function () {
    // El candado va antes de la transacción: nada llega al disco.
    vehiculoDePrueba('EP-16', 'URVAN', 'En Planta', false);

    registrarMovimientoDe('EP-16', 'Salida')->assertStatus(409);

    expect(Storage::disk('public')->allFiles())->toBe([]);
});

it('la bitácora de un inactivo se consulta igual', function () {
    vehiculoDePrueba('EP-16', 'URVAN', 'En Planta', false);
    movimientosDePrueba('EP-16', 3);

    $respuesta = test()->getJson('/api/VehiculoEolo/vehiculos/EP-16/movimientos');

    $respuesta->assertOk();
    expect($respuesta->json())->toHaveCount(3);
});

it('un vehículo activo sigue registrando movimientos con normalidad', function () {
    vehiculoDePrueba('01-KIA', 'KIA');

    registrarMovimientoDe('01-KIA', 'Salida')->assertCreated();

    expect(movimientoVehiculo::count())->toBe(1);
});

it('reactivar devuelve el permiso de registrar', function () {
    vehiculoDePrueba('EP-16', 'URVAN', 'En Planta', false);

    registrarMovimientoDe('EP-16', 'Salida')->assertStatus(409);
    test()->patchJson('/api/VehiculoEolo/vehiculos/EP-16/activo', ['activo' => true])->assertOk();
    registrarMovimientoDe('EP-16', 'Salida')->assertCreated();

    expect(movimientoVehiculo::count())->toBe(1);
});
```

- [ ] **Step 2: Correrla y ver que falla**

```bash
php artisan test tests/Feature/MovimientosVehiculoEolo/MovimientosDeInactivoTest.php
```

Esperado: FALLAN las cinco primeras y la última (el movimiento se registra con 201 en vez de rechazarse con 409). «un vehículo activo sigue registrando» y «la bitácora de un inactivo se consulta igual» deberían pasar ya: son la red que avisa si el candado se pasa de frenada.

- [ ] **Step 3: Añadir el candado**

En `registrarMovimiento`, entre el bloque que devuelve el 422 de validación y la línea `$rutasGuardadas = [];`, insertar:

```php
        $vehiculo = Vehiculo::find($request->vehiculo_id);

        if ($vehiculo && ! $vehiculo->activo) {
            return response()->json([
                'message' => "El vehículo {$vehiculo->id} ({$vehiculo->nombre}) está desactivado. Reactívalo para registrar entradas o salidas.",
            ], 409);
        }
```

Se usa `find` y no `findOrFail` porque la validación `exists:vehiculos,id` ya cubrió el id inexistente con un 422; el `&&` solo protege de una carrera.

Dentro de la transacción ya existe `$vehiculo = Vehiculo::findOrFail($request->vehiculo_id);`. **No tocar esa línea.** La closure solo recibe `$request` y `$rutasGuardadas` en su `use`, así que su `$vehiculo` es una variable distinta de la que añade este paso: no hay conflicto ni hace falta reaprovecharla.

- [ ] **Step 4: Correr la prueba y verla pasar**

```bash
php artisan test tests/Feature/MovimientosVehiculoEolo/MovimientosDeInactivoTest.php
```

Esperado: 7 pruebas en verde.

- [ ] **Step 5: Correr las cuatro pruebas del módulo juntas**

```bash
php artisan test tests/Feature/MovimientosVehiculoEolo
```

Esperado: todo en verde.

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/Api/VehiculoEoloController.php tests/Feature/MovimientosVehiculoEolo/MovimientosDeInactivoTest.php
git commit -m "feat(vehiculos): un vehiculo desactivado no registra movimientos"
```

---

### Task 5: La columna «Vehículo / N. económico» y la insignia del desactivado

**Files:**
- Modify: `resources/js/pages/seguridad/MovimientosVehiculoEolo/types.ts`
- Modify: `resources/js/pages/seguridad/MovimientosVehiculoEolo/TablaVehiculos.tsx:15`
- Modify: `resources/js/pages/seguridad/MovimientosVehiculoEolo/FilaVehiculo.tsx:17-24`

**Interfaces:**
- Consumes: la respuesta de `index()` de la Task 2, que ya trae `activo` y `movimientos`.
- Produces: el tipo `Vehiculo` gana `activo: boolean` y `movimientos: number`. La Task 6 añade props a `TablaVehiculos` y `FilaVehiculo`; esta tarea no cambia sus firmas.

**Contexto:**

No hay pruebas de JavaScript en el proyecto. La verificación es de tipos y de compilación, contra una línea base tomada antes de tocar nada.

El patrón de dato apilado que pidió el usuario es el de Operaciones Diarias (`resources/js/pages/Trafico/operacionesDiarias/OperacionesCards.tsx:1081-1082`): el dato principal en negrita y el secundario debajo, más pequeño y en gris. Aquí la fila usa texto más grande, así que el secundario va en `text-xs font-mono text-gray-400`, que es la misma familia monoespaciada que ya usa la celda de «Último Movimiento».

- [ ] **Step 1: Tomar la línea base de TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Anotar el número **antes de tocar nada**. El proyecto puede arrastrar errores de tipos previos y no es trabajo de este plan arreglarlos; lo que importa es que el conteo no suba. Si el comando no imprime ningún error, `grep -c` devuelve `0` y termina con código 1: eso es la línea base cero, no un fallo.

- [ ] **Step 2: Ampliar el tipo**

`resources/js/pages/seguridad/MovimientosVehiculoEolo/types.ts` queda así:

```ts
export type EstadoVehiculo = 'En Planta' | 'En Ruta';

export interface Vehiculo {
    id: string;
    nombre: string;
    estado: EstadoVehiculo;
    ultimaActividad: string;
    /** De alta en la flota. Distinto de `estado`, que es dónde está el vehículo. */
    activo: boolean;
    /** Cuántos movimientos tiene. El servidor ordena la tabla con esto. */
    movimientos: number;
}
```

- [ ] **Step 3: Cambiar la cabecera**

En `resources/js/pages/seguridad/MovimientosVehiculoEolo/TablaVehiculos.tsx`, sustituir la línea 15:

```tsx
                        <th className="p-4 text-sm font-semibold text-gray-600">Vehículo</th>
```

por:

```tsx
                        <th className="p-4 text-sm font-semibold text-gray-600">Vehículo / N. económico</th>
```

- [ ] **Step 4: Apilar el id bajo el nombre y pintar la insignia**

En `resources/js/pages/seguridad/MovimientosVehiculoEolo/FilaVehiculo.tsx`, sustituir la primera celda (líneas 17-24):

```tsx
                <td className="p-4 font-medium text-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
                            <Car size={18} />
                        </div>
                        <span className="font-bold">{vehiculo.nombre}</span>
                    </div>
                </td>
```

por:

```tsx
                <td className="p-4 font-medium text-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
                            <Car size={18} />
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="font-bold">{vehiculo.nombre}</span>
                                {!vehiculo.activo && (
                                    <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold uppercase tracking-wide">
                                        Desactivado
                                    </span>
                                )}
                            </div>
                            <span className="text-xs font-mono text-gray-400">{vehiculo.id}</span>
                        </div>
                    </div>
                </td>
```

Sin la insignia la única pista de que un vehículo está de baja sería que le faltan botones, y eso se lee como un fallo de la pantalla.

- [ ] **Step 5: Comprobar tipos y compilación**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Esperado: el mismo número que en el Step 1, o menos. Si sube, los errores nuevos son de este cambio y hay que arreglarlos.

```bash
npm run build
```

Esperado: la compilación termina sin errores.

- [ ] **Step 6: Commit**

```bash
git add resources/js/pages/seguridad/MovimientosVehiculoEolo/types.ts resources/js/pages/seguridad/MovimientosVehiculoEolo/TablaVehiculos.tsx resources/js/pages/seguridad/MovimientosVehiculoEolo/FilaVehiculo.tsx
git commit -m "feat(vehiculos): la columna muestra el numero economico y marca los desactivados"
```

---

### Task 6: La cuarta acción, con el candado de rol en la pantalla

**Files:**
- Modify: `resources/js/stores/apiVehiculoEolo.ts`
- Modify: `resources/js/pages/seguridad/MovimientosVehiculoEolo/ControlVehiculos.tsx`
- Modify: `resources/js/pages/seguridad/MovimientosVehiculoEolo/TablaVehiculos.tsx`
- Modify: `resources/js/pages/seguridad/MovimientosVehiculoEolo/FilaVehiculo.tsx`

**Interfaces:**
- Consumes: `PATCH /api/VehiculoEolo/vehiculos/{id}/activo` (Task 3); el tipo `Vehiculo` con `activo` (Task 5).
- Produces: `apiVehiculoEolo.cambiarActivo(vehiculoId: string, activo: boolean): Promise<any>`. `TablaVehiculos` y `FilaVehiculo` ganan las props `puedeDesactivar: boolean` y `onCambiarActivo: (vehiculo: Vehiculo) => void`.

**Contexto:**

El patrón del proyecto para leer el rol en una pantalla es `usePage` sobre las props compartidas de Inertia; `HandleInertiaRequests` publica `auth.user.roles` como una lista de `{ id, slug, nombre }`. El patrón existente en otras pantallas lee `roles?.[0]?.slug`, **solo el primero**. Esta pantalla no lo repite: un usuario con dos roles cuyo permitido no fuera el primero se quedaría sin el botón.

`ControlVehiculos.tsx` ya tiene `fetchVehiculos()`, que recarga la lista del servidor; tras cambiar `activo` hay que llamarla para que el orden se recalcule. El resto de la pantalla avisa con `alert(...)`: se sigue ese mismo estilo, no se introduce otro.

El icono para la acción es `Ban` de lucide-react para desactivar y `RotateCcw` para reactivar; los dos están en la librería que ya usa el archivo.

- [ ] **Step 1: Añadir la llamada al cliente de API**

En `resources/js/stores/apiVehiculoEolo.ts`, dentro del objeto `apiVehiculoEolo`, después de `getHistorial` y antes de `crearVehiculo`:

```ts
    cambiarActivo: async (vehiculoId: string, activo: boolean) => {
        const response = await fetch(`/api/VehiculoEolo/vehiculos/${vehiculoId}/activo`, {
            method: 'PATCH',
            headers: headers,
            body: JSON.stringify({ activo }),
        });
        const result = await response.json();
        if (!response.ok) throw result;
        return result;
    },
```

- [ ] **Step 2: Leer los roles y manejar el cambio en `ControlVehiculos.tsx`**

Añadir a los imports del principio:

```tsx
import { usePage } from '@inertiajs/react';
```

Justo después de la línea `import { apiVehiculoEolo } from '@/stores/apiVehiculoEolo';`:

```tsx
/**
 * Roles que pueden dar de baja o de alta un vehículo. La misma lista que
 * guarda el servidor en VehiculoEoloController::ROLES_PARA_CAMBIAR_ACTIVO:
 * aquí solo decide si se dibuja el botón, el permiso de verdad está allá.
 */
const ROLES_PARA_DESACTIVAR = ['fbo', 'admin2', 'admin'];
```

Dentro de `const ControlVehiculos = () => {`, después de la última llamada a `useState`:

```tsx
    const { auth } = usePage<{ auth: { user: { roles?: { slug: string }[] } } }>().props;
    // La lista ENTERA, no roles[0]: con dos roles, el permitido podría no ser el primero.
    const puedeDesactivar = (auth.user.roles ?? []).some(rol => ROLES_PARA_DESACTIVAR.includes(rol.slug));
```

Después de `handleNuevoVehiculo`:

```tsx
    const handleCambiarActivo = async (vehiculo: Vehiculo) => {
        const desactivando = vehiculo.activo;
        const pregunta = desactivando
            ? `¿Desactivar ${vehiculo.nombre} (${vehiculo.id})? Dejará de poder registrar entradas y salidas; su bitácora se seguirá consultando.`
            : `¿Reactivar ${vehiculo.nombre} (${vehiculo.id})?`;

        if (!window.confirm(pregunta)) {
            return;
        }

        try {
            await apiVehiculoEolo.cambiarActivo(vehiculo.id, !vehiculo.activo);
            await fetchVehiculos();
        } catch (error: any) {
            alert('Error: ' + (error.message || 'No se pudo cambiar el estado del vehículo'));
        }
    };
```

Y pasar las dos props nuevas a la tabla:

```tsx
                        <TablaVehiculos
                            vehiculos={vehiculos}
                            onAccion={abrirModal}
                            puedeDesactivar={puedeDesactivar}
                            onCambiarActivo={handleCambiarActivo}
                        />
```

- [ ] **Step 3: Pasar las props por la tabla**

En `resources/js/pages/seguridad/MovimientosVehiculoEolo/TablaVehiculos.tsx`, ampliar la interfaz y la llamada a la fila:

```tsx
interface Props {
    vehiculos: Vehiculo[];
    onAccion: (vehiculo: Vehiculo, tipo: 'Salida' | 'Entrada') => void;
    puedeDesactivar: boolean;
    onCambiarActivo: (vehiculo: Vehiculo) => void;
}

export const TablaVehiculos = ({ vehiculos, onAccion, puedeDesactivar, onCambiarActivo }: Props) => {
```

y dentro del `map`:

```tsx
                        <FilaVehiculo
                            key={v.id}
                            vehiculo={v}
                            onAccion={onAccion}
                            puedeDesactivar={puedeDesactivar}
                            onCambiarActivo={onCambiarActivo}
                        />
```

- [ ] **Step 4: Dibujar la cuarta acción**

En `resources/js/pages/seguridad/MovimientosVehiculoEolo/FilaVehiculo.tsx`:

Ampliar el import de iconos:

```tsx
import { Car, ArrowUpRight, ArrowDownLeft, History, X, Ban, RotateCcw } from 'lucide-react';
```

Ampliar las props:

```tsx
interface Props {
    vehiculo: Vehiculo;
    onAccion: (vehiculo: Vehiculo, tipo: 'Salida' | 'Entrada') => void;
    puedeDesactivar: boolean;
    onCambiarActivo: (vehiculo: Vehiculo) => void;
}

export const FilaVehiculo = ({ vehiculo, onAccion, puedeDesactivar, onCambiarActivo }: Props) => {
```

Sustituir los dos botones de salida y entrada (los de `ArrowUpRight` y `ArrowDownLeft`) por esta versión, que los esconde en un vehículo inactivo, y añadir detrás el botón nuevo:

```tsx
                        {vehiculo.activo && (
                            <>
                                <button
                                    onClick={() => onAccion(vehiculo, 'Salida')}
                                    disabled={vehiculo.estado === 'En Ruta'}
                                    className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-600 hover:text-white disabled:opacity-30 transition-all shadow-sm"
                                >
                                    <ArrowUpRight size={18} />
                                </button>

                                <button
                                    onClick={() => onAccion(vehiculo, 'Entrada')}
                                    disabled={vehiculo.estado === 'En Planta'}
                                    className="bg-blue-50 text-blue-600 p-2 rounded-lg hover:bg-blue-600 hover:text-white disabled:opacity-30 transition-all shadow-sm"
                                >
                                    <ArrowDownLeft size={18} />
                                </button>
                            </>
                        )}

                        {puedeDesactivar && (
                            <button
                                onClick={() => onCambiarActivo(vehiculo)}
                                disabled={vehiculo.activo && vehiculo.estado === 'En Ruta'}
                                title={
                                    vehiculo.activo && vehiculo.estado === 'En Ruta'
                                        ? 'Está En Ruta: registra su entrada antes de desactivarlo'
                                        : vehiculo.activo
                                          ? 'Desactivar vehículo'
                                          : 'Reactivar vehículo'
                                }
                                className={`p-2 rounded-lg disabled:opacity-30 transition-all shadow-sm ${
                                    vehiculo.activo
                                        ? 'bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white'
                                        : 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white'
                                }`}
                            >
                                {vehiculo.activo ? <Ban size={18} /> : <RotateCcw size={18} />}
                            </button>
                        )}
```

El botón de historial se queda como está, antes de este bloque: la bitácora de un inactivo se consulta igual.

- [ ] **Step 5: Comprobar tipos y compilación**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Esperado: el mismo conteo que la línea base del Step 1 de la Task 5.

```bash
npm run build
```

Esperado: compila sin errores.

- [ ] **Step 6: Commit**

```bash
git add resources/js/stores/apiVehiculoEolo.ts resources/js/pages/seguridad/MovimientosVehiculoEolo/ControlVehiculos.tsx resources/js/pages/seguridad/MovimientosVehiculoEolo/TablaVehiculos.tsx resources/js/pages/seguridad/MovimientosVehiculoEolo/FilaVehiculo.tsx
git commit -m "feat(vehiculos): accion de desactivar y reactivar en la tabla, limitada por rol"
```

---

### Task 7: La suite entera en verde

**Files:**
- Test: toda la suite

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada.

**Contexto:**

El cambio de `index()` altera una respuesta de API que otras pruebas podrían estar leyendo, y la columna nueva cambia el esquema. Esta tarea existe para encontrar esos efectos a distancia antes de dar el trabajo por terminado.

- [ ] **Step 1: Correr la suite entera, en serie**

```bash
TEST_TOKEN=901 php artisan test
```

**Nunca con `--parallel`**: en este proyecto da fallos falsos. `TEST_TOKEN` **no** es ejecución en paralelo: es el mecanismo propio de Laravel para que `Storage::fake` use un directorio de disco falso distinto (`public_test_901` en vez de `public`). Las pruebas siguen corriendo en serie y se comprueba exactamente lo mismo.

Hace falta porque en esta máquina quedó un directorio atascado en
`storage/framework/testing/disks/public/movimientos-vehiculos/1` que no se puede
listar ni borrar («Acceso denegado» desde `rm`, `rd /s /q` y hasta `Get-Acl`):
algún proceso lo tiene cogido. Mientras siga ahí, las pruebas que escriben una
imagen de verdad fallan con «Unable to create a directory». Usa un número que no
hayas usado antes en esta máquina y borra después el `public_test_<n>` que deje.

Para arreglarlo de raíz hace falta cerrar lo que lo retiene (vite, VS Code o
Apache) o reiniciar, y entonces borrar el directorio.

Esperado: el total de la rama `main` (2412 en verde en `dbf0ce9`) más las de este plan, sin ningún fallo.

- [ ] **Step 2: Si algo falla**

Leer el fallo antes de tocar nada. Lo esperable, si algo falla, es una prueba que daba por hecha la forma antigua de la respuesta de `GET /api/VehiculoEolo` o el orden de sus filas. Arreglar la prueba para que lea la forma nueva, no retroceder el código.

Si el fallo no tiene ninguna relación con vehículos, comprobar primero si ya venía fallando desde antes, en un árbol aparte y sin tocar el de trabajo:

```bash
git worktree add ../eolo-base b57acf5
cd ../eolo-base && php artisan test --filter=NombreDeLaPruebaQueFalla
```

Si allí también falla, es un fallo previo: anotarlo y seguir. Al terminar, `git worktree remove ../eolo-base`.

- [ ] **Step 3: Commit, si el Step 2 tocó algo**

```bash
git add -A
git commit -m "test: ajusta las pruebas que leian la forma antigua del listado de vehiculos"
```

---

## Qué queda fuera, a propósito

- **La exportación a Excel con casillas de selección** (punto 2 de la petición original). Proyecto hermano, con su propia spec: necesita un endpoint que devuelva los movimientos de varios vehículos a la vez, que hoy no existe.
- **Borrar un vehículo**, **un motivo de la desactivación** y **reordenar desde la pantalla**: ver «No entra» en la spec.
- **Auditar las demás relaciones rotas** del proyecto. Se arregla la de `Vehiculo` porque este trabajo la necesita.
