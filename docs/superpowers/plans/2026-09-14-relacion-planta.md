# Relación de planta (GPU N.115) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Módulo de Rampa para registrar el préstamo y la entrega de la única planta de energía (GPU N.115) en un solo registro por préstamo, con histórico filtrable y paginado.

**Architecture:** Tabla `relaciones_planta` + modelo `RelacionPlanta`; controlador API con 5 endpoints (actual, prestar, finalizar, historico, empresas) protegidos por `auth:sanctum` y, para escribir, `subdep:relacionPlanta`. Un solo préstamo abierto garantizado con `lockForUpdate` dentro de transacción y finalización por `UPDATE … WHERE status='en_uso'`. Frontend Inertia/React: página `Rampa/RelacionPlanta` con tarjeta de estado, dos modales y tabla histórica estilo Rampa.

**Tech Stack:** Laravel 12, Pest (sqlite :memory:), Inertia 2, React 19, TypeScript, Tailwind 4, lucide-react, SweetAlert2, Wayfinder.

**Spec:** `docs/superpowers/specs/2026-09-14-relacion-planta-design.md`

## Global Constraints

- Nombre visible del módulo: **Relación de planta**. Equipo: **GPU N.115**.
- Estados: `en_uso`, `finalizado`. Horómetros `decimal(10,2)`, tiempo `decimal(8,2)` en **horas decimales**. Nunca `float`.
- Mensajes exactos:
  - 409 préstamo abierto: título Swal **GPU no disponible**, texto *"La GPU N.115 se encuentra en uso por la matrícula {matricula}. Debe registrarse su entrega antes de iniciar otro préstamo."*
  - 422 final < inicial: *"El horómetro final no puede ser menor que el horómetro inicial."*
  - 409 ya finalizado: *"Este préstamo ya fue finalizado por otro usuario."*
- Fechas locales con `fechaHoy()` de `@/pages/despacho/operacionesProgramadas/types`. Nunca `toISOString()`.
- Matrícula con `InputMatricula` (`@/pages/InputMatricula`). No crear catálogos.
- Rutas API con prefijo `RelacionPlanta` (PascalCase, como el resto del proyecto). Web: `/relacionPlanta`, nombre `relacionPlanta`.
- Permisos: `POST /prestar`, `PATCH /{id}/finalizar` → `subdep:relacionPlanta`; lecturas abiertas a autenticados.
- Bitácora: módulo `RELACION_PLANTA`, acciones `CREAR` y `FINALIZAR`. Sin columnas `user_id`.
- Bash en Windows: escribir archivos con la herramienta Write (no heredocs con comillas).
- Tests: `php artisan test tests/Feature/RelacionPlanta`. Helper existente en `tests/Pest.php`: `usuarioConSubdepartamento(string $sub, string $dep, string $rol = 'empleado')`, `usuarioAdmin()`, `usuarioSinAcceso()`.

---

## File map

| Archivo | Responsabilidad |
|---|---|
| `database/migrations/2026_09_14_100000_create_relaciones_planta_table.php` | Tabla |
| `app/Models/RelacionPlanta.php` | Modelo, constantes, scopes |
| `app/Models/Bitacora.php` | + `MODULO_RELACION_PLANTA` |
| `app/Http/Requests/RelacionPlanta/PrestarRelacionPlantaRequest.php` | Validación préstamo |
| `app/Http/Requests/RelacionPlanta/FinalizarRelacionPlantaRequest.php` | Validación entrega |
| `app/Http/Controllers/Api/RelacionPlantaController.php` | 5 endpoints |
| `routes/api.php`, `routes/web.php` | Rutas |
| `database/seeders/RelacionPlantaSubdepartamentoSeeder.php`, `DatabaseSeeder.php` | Subdepartamento |
| `tests/Feature/RelacionPlanta/{PrestarPlantaTest,FinalizarPlantaTest,HistoricoPlantaTest}.php` | Pruebas |
| `resources/js/stores/apiRelacionPlanta.ts` | Cliente HTTP |
| `resources/js/pages/Rampa/relacionPlanta/types.ts` | Tipos y helpers |
| `resources/js/pages/Rampa/relacionPlanta/useRelacionPlanta.ts` | Estado de la tarjeta |
| `resources/js/pages/Rampa/relacionPlanta/useHistoricoPlanta.ts` | Histórico |
| `resources/js/pages/Rampa/relacionPlanta/TarjetaGpu.tsx` | Tarjeta |
| `resources/js/pages/Rampa/relacionPlanta/PrestamoModal.tsx` | Modal préstamo |
| `resources/js/pages/Rampa/relacionPlanta/EntregaModal.tsx` | Modal entrega |
| `resources/js/pages/Rampa/relacionPlanta/TablaHistorico.tsx` | Tabla + paginación |
| `resources/js/pages/Rampa/RelacionPlanta.tsx` | Página |
| `resources/js/components/navigation.ts` | Menú |

---

### Task 1: Migración, modelo y bitácora

**Files:**
- Create: `database/migrations/2026_09_14_100000_create_relaciones_planta_table.php`
- Create: `app/Models/RelacionPlanta.php`
- Modify: `app/Models/Bitacora.php` (constantes de módulo)
- Test: `tests/Feature/RelacionPlanta/PrestarPlantaTest.php` (solo la primera prueba)

**Interfaces:**
- Produces: `App\Models\RelacionPlanta` con `STATUS_EN_USO='en_uso'`, `STATUS_FINALIZADO='finalizado'`, `EQUIPO='GPU N.115'`, `scopeEnUso()`, `scopeFinalizadas()`; `Bitacora::MODULO_RELACION_PLANTA`.

- [ ] **Step 1: Prueba de modelo (falla)**

`tests/Feature/RelacionPlanta/PrestarPlantaTest.php`:

```php
<?php

use App\Models\Bitacora;
use App\Models\RelacionPlanta;

function prestamoAbierto(array $extra = []): RelacionPlanta
{
    return RelacionPlanta::create(array_merge([
        'fecha' => '2026-09-14',
        'empresa' => 'AEROLÍNEA DEMO',
        'matricula' => 'XA-GPU',
        'horometro_inicio' => 125.30,
        'status' => RelacionPlanta::STATUS_EN_USO,
    ], $extra));
}

function prestamoFinalizado(array $extra = []): RelacionPlanta
{
    return prestamoAbierto(array_merge([
        'horometro_fin' => 126.05,
        'tiempo' => 0.75,
        'status' => RelacionPlanta::STATUS_FINALIZADO,
    ], $extra));
}

function usuarioPlanta()
{
    return usuarioConSubdepartamento('relacionPlanta', 'Rampa');
}

test('el modelo guarda horómetros como decimales y expone los scopes', function () {
    $abierto = prestamoAbierto();
    $cerrado = prestamoFinalizado(['matricula' => 'XA-FIN']);

    expect($abierto->fresh()->horometro_inicio)->toBe('125.30')
        ->and($abierto->fresh()->horometro_fin)->toBeNull()
        ->and($abierto->fresh()->tiempo)->toBeNull()
        ->and(RelacionPlanta::enUso()->pluck('id')->all())->toBe([$abierto->id])
        ->and(RelacionPlanta::finalizadas()->pluck('id')->all())->toBe([$cerrado->id])
        ->and(RelacionPlanta::EQUIPO)->toBe('GPU N.115')
        ->and(Bitacora::MODULO_RELACION_PLANTA)->toBe('RELACION_PLANTA');
});
```

- [ ] **Step 2: Correr** `php artisan test tests/Feature/RelacionPlanta` → FAIL (clase no existe).

- [ ] **Step 3: Migración**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Préstamos de la única planta de energía (GPU N.115). El préstamo y su
 * entrega son el mismo registro: al prestar se guarda el horómetro inicial y
 * al entregar se completan horómetro final, tiempo y status.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('relaciones_planta', function (Blueprint $table) {
            $table->id();
            $table->date('fecha');
            $table->string('empresa', 120);
            $table->string('matricula', 20)->index();
            // Horas decimales del horómetro; nunca float.
            $table->decimal('horometro_inicio', 10, 2);
            $table->decimal('horometro_fin', 10, 2)->nullable();
            // Horas decimales de uso (fin - inicio, o el valor editado).
            $table->decimal('tiempo', 8, 2)->nullable();
            $table->string('status', 12)->default('en_uso')->index();
            $table->timestamps();

            $table->index(['fecha', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('relaciones_planta');
    }
};
```

- [ ] **Step 4: Modelo**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Préstamo de la GPU N.115. Solo puede existir un registro en_uso a la vez;
 * esa regla la garantiza el controlador con bloqueo dentro de transacción.
 */
class RelacionPlanta extends Model
{
    protected $table = 'relaciones_planta';

    public const EQUIPO = 'GPU N.115';

    public const STATUS_EN_USO = 'en_uso';
    public const STATUS_FINALIZADO = 'finalizado';

    protected $fillable = [
        'fecha',
        'empresa',
        'matricula',
        'horometro_inicio',
        'horometro_fin',
        'tiempo',
        'status',
    ];

    protected $casts = [
        'fecha' => 'date:Y-m-d',
        'horometro_inicio' => 'decimal:2',
        'horometro_fin' => 'decimal:2',
        'tiempo' => 'decimal:2',
    ];

    protected $appends = ['equipo'];

    public function getEquipoAttribute(): string
    {
        return self::EQUIPO;
    }

    public function scopeEnUso(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_EN_USO);
    }

    public function scopeFinalizadas(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_FINALIZADO);
    }
}
```

- [ ] **Step 5: Bitácora** — en `app/Models/Bitacora.php`, junto a `MODULO_MATRICULAS_RESTRINGIDAS`, agregar:

```php
    public const MODULO_RELACION_PLANTA = 'RELACION_PLANTA';
```

- [ ] **Step 6: Correr** `php artisan test tests/Feature/RelacionPlanta` → PASS (1).

---

### Task 2: Endpoint `actual` y `prestar` (con bloqueo)

**Files:**
- Create: `app/Http/Requests/RelacionPlanta/PrestarRelacionPlantaRequest.php`
- Create: `app/Http/Controllers/Api/RelacionPlantaController.php`
- Create: `database/seeders/RelacionPlantaSubdepartamentoSeeder.php`
- Modify: `database/seeders/DatabaseSeeder.php`, `routes/api.php`
- Test: `tests/Feature/RelacionPlanta/PrestarPlantaTest.php`

**Interfaces:**
- Produces: `GET /api/RelacionPlanta/actual` → `{ prestamo: RelacionPlanta|null }`; `POST /api/RelacionPlanta/prestar` → 201 `{ message, prestamo }` | 409 `{ message, codigo:'gpu_en_uso', matricula }`.

- [ ] **Step 1: Pruebas (fallan)** — agregar al mismo archivo:

```php
test('actual devuelve null sin préstamo abierto y el préstamo cuando existe', function () {
    $this->actingAs(usuarioSinAcceso());

    $this->getJson('/api/RelacionPlanta/actual')->assertOk()->assertJsonPath('prestamo', null);

    $abierto = prestamoAbierto();

    $this->getJson('/api/RelacionPlanta/actual')
        ->assertOk()
        ->assertJsonPath('prestamo.id', $abierto->id)
        ->assertJsonPath('prestamo.equipo', 'GPU N.115')
        ->assertJsonPath('prestamo.status', 'en_uso');
});

test('un invitado recibe 401 y un usuario sin subdepartamento 403 al prestar', function () {
    $datos = ['fecha' => '2026-09-14', 'empresa' => 'DEMO', 'matricula' => 'xa-gpu', 'horometro_inicio' => 10];

    $this->postJson('/api/RelacionPlanta/prestar', $datos)->assertUnauthorized();

    $this->actingAs(usuarioSinAcceso());
    $this->postJson('/api/RelacionPlanta/prestar', $datos)->assertForbidden();

    expect(RelacionPlanta::count())->toBe(0);
});

test('prestar guarda solo el horómetro inicial, normaliza y registra bitácora', function () {
    $this->actingAs(usuarioPlanta());

    $this->postJson('/api/RelacionPlanta/prestar', [
        'fecha' => '2026-09-14',
        'empresa' => '  Aerolínea Demo  ',
        'matricula' => 'xa-gpu',
        'horometro_inicio' => '125.30',
    ])
        ->assertCreated()
        ->assertJsonPath('message', 'Préstamo registrado correctamente.')
        ->assertJsonPath('prestamo.matricula', 'XA-GPU')
        ->assertJsonPath('prestamo.empresa', 'Aerolínea Demo')
        ->assertJsonPath('prestamo.status', 'en_uso');

    $guardado = RelacionPlanta::first();

    expect($guardado->horometro_inicio)->toBe('125.30')
        ->and($guardado->horometro_fin)->toBeNull()
        ->and($guardado->tiempo)->toBeNull();

    expect(Bitacora::query()
        ->where('modulo', 'RELACION_PLANTA')
        ->where('accion', Bitacora::ACCION_CREAR)
        ->where('registro_id', $guardado->id)
        ->exists())->toBeTrue();
});

test('el admin puede prestar aunque no tenga el subdepartamento', function () {
    $this->actingAs(usuarioAdmin());

    $this->postJson('/api/RelacionPlanta/prestar', [
        'fecha' => '2026-09-14', 'empresa' => 'DEMO', 'matricula' => 'XA-ADM', 'horometro_inicio' => 1,
    ])->assertCreated();
});

test('no se puede prestar mientras exista un préstamo abierto', function () {
    prestamoAbierto(['matricula' => 'XA-OCU']);

    $this->actingAs(usuarioPlanta());

    $this->postJson('/api/RelacionPlanta/prestar', [
        'fecha' => '2026-09-14', 'empresa' => 'OTRA', 'matricula' => 'XA-NUE', 'horometro_inicio' => 200,
    ])
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'gpu_en_uso')
        ->assertJsonPath('matricula', 'XA-OCU')
        ->assertJsonPath('message', 'La GPU N.115 se encuentra en uso por la matrícula XA-OCU. Debe registrarse su entrega antes de iniciar otro préstamo.');

    expect(RelacionPlanta::count())->toBe(1);
});

test('prestar valida empresa obligatoria, matrícula y horómetro no negativo', function () {
    $this->actingAs(usuarioPlanta());

    $this->postJson('/api/RelacionPlanta/prestar', [
        'fecha' => 'ayer', 'empresa' => '   ', 'matricula' => '', 'horometro_inicio' => -1,
    ])->assertStatus(422)->assertJsonValidationErrors(['fecha', 'empresa', 'matricula', 'horometro_inicio']);
});
```

- [ ] **Step 2: Correr** → FAIL (404 / clases inexistentes).

- [ ] **Step 3: Form Request**

```php
<?php

namespace App\Http\Requests\RelacionPlanta;

use Illuminate\Foundation\Http\FormRequest;

class PrestarRelacionPlantaRequest extends FormRequest
{
    /** El acceso lo resuelve el middleware subdep:relacionPlanta. */
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'empresa' => trim((string) $this->input('empresa')),
            'matricula' => strtoupper(trim((string) $this->input('matricula'))),
        ]);
    }

    public function rules(): array
    {
        return [
            'fecha' => ['required', 'date_format:Y-m-d'],
            'empresa' => ['required', 'string', 'max:120'],
            'matricula' => ['required', 'string', 'max:20'],
            'horometro_inicio' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
        ];
    }

    public function messages(): array
    {
        return [
            'fecha.required' => 'La fecha es obligatoria.',
            'fecha.date_format' => 'La fecha debe tener el formato AAAA-MM-DD.',
            'empresa.required' => 'La empresa es obligatoria.',
            'matricula.required' => 'La matrícula es obligatoria.',
            'horometro_inicio.required' => 'El horómetro inicial es obligatorio.',
            'horometro_inicio.numeric' => 'El horómetro inicial debe ser numérico.',
            'horometro_inicio.min' => 'El horómetro inicial no puede ser negativo.',
        ];
    }
}
```

- [ ] **Step 4: Controlador (actual + prestar)**

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RelacionPlanta\FinalizarRelacionPlantaRequest;
use App\Http\Requests\RelacionPlanta\PrestarRelacionPlantaRequest;
use App\Models\Bitacora;
use App\Models\RelacionPlanta;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Control de préstamo de la GPU N.115.
 *
 * Solo existe una planta, así que a lo sumo hay un registro en_uso. Prestar y
 * finalizar corren dentro de una transacción con bloqueo para que dos usuarios
 * simultáneos no abran dos préstamos ni cierren dos veces el mismo.
 */
class RelacionPlantaController extends Controller
{
    private const PER_PAGE_PERMITIDOS = [10, 20, 50, 100];

    /** Préstamo abierto (o null): alimenta la tarjeta de estado. */
    public function actual(): JsonResponse
    {
        return response()->json([
            'prestamo' => RelacionPlanta::enUso()->latest('id')->first(),
        ]);
    }

    public function prestar(PrestarRelacionPlantaRequest $request): JsonResponse
    {
        $datos = $request->validated();

        $resultado = DB::transaction(function () use ($datos) {
            // FOR UPDATE sobre status='en_uso' (indexado): en InnoDB bloquea el
            // hueco y serializa a quien intente prestar al mismo tiempo.
            $abierto = RelacionPlanta::enUso()->lockForUpdate()->latest('id')->first();

            if ($abierto) {
                return ['ocupado' => $abierto];
            }

            $prestamo = RelacionPlanta::create([
                'fecha' => $datos['fecha'],
                'empresa' => $datos['empresa'],
                'matricula' => $datos['matricula'],
                'horometro_inicio' => $datos['horometro_inicio'],
                'horometro_fin' => null,
                'tiempo' => null,
                'status' => RelacionPlanta::STATUS_EN_USO,
            ]);

            Bitacora::log(
                modulo: Bitacora::MODULO_RELACION_PLANTA,
                accion: Bitacora::ACCION_CREAR,
                descripcion: "Se prestó la {$prestamo->equipo} a la matrícula {$prestamo->matricula} ({$prestamo->empresa}) con horómetro inicial {$prestamo->horometro_inicio}.",
                registroId: $prestamo->id,
                datosAnteriores: null,
                datosNuevos: $this->datosBitacora($prestamo),
            );

            return ['prestamo' => $prestamo];
        });

        if (isset($resultado['ocupado'])) {
            $ocupado = $resultado['ocupado'];

            return response()->json([
                'message' => "La GPU N.115 se encuentra en uso por la matrícula {$ocupado->matricula}. Debe registrarse su entrega antes de iniciar otro préstamo.",
                'codigo' => 'gpu_en_uso',
                'matricula' => $ocupado->matricula,
                'prestamo' => $ocupado,
            ], 409);
        }

        return response()->json([
            'message' => 'Préstamo registrado correctamente.',
            'prestamo' => $resultado['prestamo'],
        ], 201);
    }

    private function datosBitacora(RelacionPlanta $prestamo): array
    {
        return [
            'equipo' => $prestamo->equipo,
            'fecha' => $prestamo->fecha?->format('Y-m-d'),
            'empresa' => $prestamo->empresa,
            'matricula' => $prestamo->matricula,
            'horometro_inicio' => $prestamo->horometro_inicio,
            'horometro_fin' => $prestamo->horometro_fin,
            'tiempo' => $prestamo->tiempo,
            'status' => $prestamo->status,
        ];
    }
}
```

(Los métodos `finalizar`, `historico` y `empresas` se agregan en las tareas 3 y 4; el `use FinalizarRelacionPlantaRequest` se puede dejar desde ahora porque la clase se crea en la Task 3 — si el linter se queja, agregarlo en la Task 3.)

- [ ] **Step 5: Rutas API** — en `routes/api.php`, después del bloque de `MatriculasRestringidas`:

```php
/*
|--------------------------------------------------------------------------
| Relación de planta (Rampa) — préstamo de la GPU N.115
|--------------------------------------------------------------------------
| Consultar es abierto a cualquier usuario autenticado. Prestar y finalizar
| exigen el subdepartamento relacionPlanta (admin siempre pasa).
*/
Route::middleware(['api', 'auth:sanctum'])->prefix('RelacionPlanta')->group(function () {
    Route::get('/actual', [RelacionPlantaController::class, 'actual']);
    Route::get('/historico', [RelacionPlantaController::class, 'historico']);
    Route::get('/empresas', [RelacionPlantaController::class, 'empresas']);

    Route::middleware('subdep:relacionPlanta')->group(function () {
        Route::post('/prestar', [RelacionPlantaController::class, 'prestar']);
        Route::patch('/{id}/finalizar', [RelacionPlantaController::class, 'finalizar'])->whereNumber('id');
    });
});
```

y el `use App\Http\Controllers\Api\RelacionPlantaController;` arriba junto a los demás.

- [ ] **Step 6: Seeder**

```php
<?php

namespace Database\Seeders;

use App\Models\Departamento;
use App\Models\SubDepartamento;
use Illuminate\Database\Seeder;

/**
 * Subdepartamento que habilita "Relación de planta" dentro de Rampa. El nombre
 * coincide con el middleware subdep:relacionPlanta y con la llave de
 * ROUTE_CONFIG en navigation.ts (Str::slug: "relacionplanta").
 */
class RelacionPlantaSubdepartamentoSeeder extends Seeder
{
    public function run(): void
    {
        $departamento = Departamento::firstOrCreate(['nombre' => 'Rampa']);

        SubDepartamento::firstOrCreate(
            ['departamento_id' => $departamento->id, 'nombre' => 'relacionPlanta'],
            ['status' => 'A']
        );
    }
}
```

En `DatabaseSeeder.php`, junto a `OperacionesProgramadasSubdepartamentoSeeder::class`, agregar `RelacionPlantaSubdepartamentoSeeder::class`.

- [ ] **Step 7: Correr** `php artisan test tests/Feature/RelacionPlanta` → PASS (7).

---

### Task 3: Endpoint `finalizar`

**Files:**
- Create: `app/Http/Requests/RelacionPlanta/FinalizarRelacionPlantaRequest.php`
- Modify: `app/Http/Controllers/Api/RelacionPlantaController.php`
- Test: `tests/Feature/RelacionPlanta/FinalizarPlantaTest.php`

**Interfaces:**
- Produces: `PATCH /api/RelacionPlanta/{id}/finalizar` body `{ horometro_fin: number, tiempo?: number|null }` → 200 `{ message, prestamo }` | 422 | 409 `{ codigo:'ya_finalizado' }`.

- [ ] **Step 1: Pruebas (fallan)**

```php
<?php

use App\Models\Bitacora;
use App\Models\RelacionPlanta;

// Helpers prestamoAbierto(), prestamoFinalizado(), usuarioPlanta() viven en PrestarPlantaTest.php
// (Pest carga todos los archivos del directorio, así que están disponibles aquí).

function finalizar(int $id, array $datos)
{
    return test()->patchJson("/api/RelacionPlanta/{$id}/finalizar", $datos);
}

test('finalizar calcula el tiempo como final menos inicial cuando no se envía', function () {
    $abierto = prestamoAbierto(['horometro_inicio' => 125.30]);

    $this->actingAs(usuarioPlanta());

    finalizar($abierto->id, ['horometro_fin' => '126.05'])
        ->assertOk()
        ->assertJsonPath('message', 'Entrega registrada correctamente.')
        ->assertJsonPath('prestamo.id', $abierto->id)
        ->assertJsonPath('prestamo.status', 'finalizado');

    $guardado = $abierto->fresh();

    expect($guardado->horometro_fin)->toBe('126.05')
        ->and($guardado->tiempo)->toBe('0.75')
        ->and(RelacionPlanta::count())->toBe(1);

    expect(Bitacora::query()
        ->where('modulo', 'RELACION_PLANTA')
        ->where('accion', Bitacora::ACCION_FINALIZAR)
        ->where('registro_id', $abierto->id)
        ->exists())->toBeTrue();
});

test('finalizar acepta un tiempo editado manualmente', function () {
    $abierto = prestamoAbierto(['horometro_inicio' => 100]);

    $this->actingAs(usuarioPlanta());

    finalizar($abierto->id, ['horometro_fin' => 101, 'tiempo' => '1.25'])->assertOk();

    expect($abierto->fresh()->tiempo)->toBe('1.25');
});

test('el horómetro final no puede ser menor que el inicial', function () {
    $abierto = prestamoAbierto(['horometro_inicio' => 125.30]);

    $this->actingAs(usuarioPlanta());

    finalizar($abierto->id, ['horometro_fin' => 125.29])
        ->assertStatus(422)
        ->assertJsonPath('errors.horometro_fin.0', 'El horómetro final no puede ser menor que el horómetro inicial.');

    expect($abierto->fresh()->status)->toBe('en_uso');
});

test('finalizar valida horómetro final obligatorio, no negativo y tiempo no negativo', function () {
    $abierto = prestamoAbierto();

    $this->actingAs(usuarioPlanta());

    finalizar($abierto->id, ['horometro_fin' => null])->assertStatus(422)->assertJsonValidationErrors(['horometro_fin']);
    finalizar($abierto->id, ['horometro_fin' => -3])->assertStatus(422)->assertJsonValidationErrors(['horometro_fin']);
    finalizar($abierto->id, ['horometro_fin' => 200, 'tiempo' => -1])->assertStatus(422)->assertJsonValidationErrors(['tiempo']);
});

test('no se puede finalizar dos veces: la segunda responde 409', function () {
    $abierto = prestamoAbierto(['horometro_inicio' => 10]);

    $this->actingAs(usuarioPlanta());

    finalizar($abierto->id, ['horometro_fin' => 11])->assertOk();

    finalizar($abierto->id, ['horometro_fin' => 12])
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_finalizado')
        ->assertJsonPath('message', 'Este préstamo ya fue finalizado por otro usuario.');

    expect($abierto->fresh()->horometro_fin)->toBe('11.00');
});

test('tras finalizar la GPU vuelve a estar disponible y se puede prestar de nuevo', function () {
    $abierto = prestamoAbierto(['horometro_inicio' => 10]);

    $this->actingAs(usuarioPlanta());

    finalizar($abierto->id, ['horometro_fin' => 11])->assertOk();

    $this->getJson('/api/RelacionPlanta/actual')->assertOk()->assertJsonPath('prestamo', null);

    $this->postJson('/api/RelacionPlanta/prestar', [
        'fecha' => '2026-09-14', 'empresa' => 'OTRA', 'matricula' => 'XA-DOS', 'horometro_inicio' => 11,
    ])->assertCreated();

    expect(RelacionPlanta::count())->toBe(2);
});

test('finalizar exige el subdepartamento y responde 404 si no existe', function () {
    $abierto = prestamoAbierto();

    $this->patchJson("/api/RelacionPlanta/{$abierto->id}/finalizar", ['horometro_fin' => 200])->assertUnauthorized();

    $this->actingAs(usuarioSinAcceso());
    finalizar($abierto->id, ['horometro_fin' => 200])->assertForbidden();

    $this->actingAs(usuarioPlanta());
    finalizar(999999, ['horometro_fin' => 200])->assertNotFound();
});
```

- [ ] **Step 2: Correr** → FAIL.

- [ ] **Step 3: Form Request**

```php
<?php

namespace App\Http\Requests\RelacionPlanta;

use Illuminate\Foundation\Http\FormRequest;

class FinalizarRelacionPlantaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        // Un tiempo vacío significa "calcúlalo tú".
        if ($this->input('tiempo') === '' ) {
            $this->merge(['tiempo' => null]);
        }
    }

    public function rules(): array
    {
        return [
            'horometro_fin' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
            'tiempo' => ['nullable', 'numeric', 'min:0', 'max:999999.99'],
        ];
    }

    public function messages(): array
    {
        return [
            'horometro_fin.required' => 'El horómetro final es obligatorio.',
            'horometro_fin.numeric' => 'El horómetro final debe ser numérico.',
            'horometro_fin.min' => 'El horómetro final no puede ser negativo.',
            'tiempo.numeric' => 'El tiempo de uso debe ser numérico.',
            'tiempo.min' => 'El tiempo de uso no puede ser negativo.',
        ];
    }
}
```

- [ ] **Step 4: Método `finalizar`** en el controlador (antes de `datosBitacora`):

```php
    public function finalizar(FinalizarRelacionPlantaRequest $request, int $id): JsonResponse
    {
        $datos = $request->validated();

        $resultado = DB::transaction(function () use ($datos, $id) {
            $prestamo = RelacionPlanta::query()->whereKey($id)->lockForUpdate()->firstOrFail();

            if ($prestamo->status !== RelacionPlanta::STATUS_EN_USO) {
                return ['ya_finalizado' => true];
            }

            $inicio = (float) $prestamo->horometro_inicio;
            $fin = (float) $datos['horometro_fin'];

            if ($fin < $inicio) {
                return ['menor' => true];
            }

            // El backend no confía en el cálculo de React: si no viene, lo hace;
            // si viene (editado), se acepta porque ya pasó la validación.
            $tiempo = array_key_exists('tiempo', $datos) && $datos['tiempo'] !== null
                ? round((float) $datos['tiempo'], 2)
                : round($fin - $inicio, 2);

            $anteriores = $this->datosBitacora($prestamo);

            // Atómico: solo cierra si sigue en uso.
            $afectadas = RelacionPlanta::query()
                ->whereKey($prestamo->id)
                ->where('status', RelacionPlanta::STATUS_EN_USO)
                ->update([
                    'horometro_fin' => $fin,
                    'tiempo' => $tiempo,
                    'status' => RelacionPlanta::STATUS_FINALIZADO,
                    'updated_at' => now(),
                ]);

            if ($afectadas !== 1) {
                return ['ya_finalizado' => true];
            }

            $prestamo->refresh();

            Bitacora::log(
                modulo: Bitacora::MODULO_RELACION_PLANTA,
                accion: Bitacora::ACCION_FINALIZAR,
                descripcion: "Se registró la entrega de la {$prestamo->equipo} por la matrícula {$prestamo->matricula}: horómetro final {$prestamo->horometro_fin}, tiempo {$prestamo->tiempo} h.",
                registroId: $prestamo->id,
                datosAnteriores: $anteriores,
                datosNuevos: $this->datosBitacora($prestamo),
            );

            return ['prestamo' => $prestamo];
        });

        if (isset($resultado['menor'])) {
            return response()->json([
                'message' => 'El horómetro final no puede ser menor que el horómetro inicial.',
                'errors' => ['horometro_fin' => ['El horómetro final no puede ser menor que el horómetro inicial.']],
            ], 422);
        }

        if (isset($resultado['ya_finalizado'])) {
            return response()->json([
                'message' => 'Este préstamo ya fue finalizado por otro usuario.',
                'codigo' => 'ya_finalizado',
            ], 409);
        }

        return response()->json([
            'message' => 'Entrega registrada correctamente.',
            'prestamo' => $resultado['prestamo'],
        ]);
    }
```

- [ ] **Step 5: Correr** → PASS (14).

---

### Task 4: Endpoints `historico` y `empresas`

**Files:**
- Modify: `app/Http/Controllers/Api/RelacionPlantaController.php`
- Test: `tests/Feature/RelacionPlanta/HistoricoPlantaTest.php`

**Interfaces:**
- Produces: `GET /api/RelacionPlanta/historico?page&per_page&fecha_inicio&fecha_fin&empresa&matricula&status` → paginador Laravel; `GET /api/RelacionPlanta/empresas?q=` → `string[]`.

- [ ] **Step 1: Pruebas (fallan)**

```php
<?php

use App\Models\RelacionPlanta;

test('el histórico ordena en_uso primero y luego por fecha descendente', function () {
    $viejo = prestamoFinalizado(['fecha' => '2026-09-01', 'matricula' => 'XA-V']);
    $nuevo = prestamoFinalizado(['fecha' => '2026-09-13', 'matricula' => 'XA-N']);
    $abierto = prestamoAbierto(['fecha' => '2026-09-05', 'matricula' => 'XA-A']);

    $this->actingAs(usuarioSinAcceso());

    $ids = collect($this->getJson('/api/RelacionPlanta/historico')->assertOk()->json('data'))->pluck('id')->all();

    expect($ids)->toBe([$abierto->id, $nuevo->id, $viejo->id]);
});

test('el histórico filtra por rango de fechas, empresa, matrícula y estado', function () {
    prestamoFinalizado(['fecha' => '2026-09-01', 'empresa' => 'ALFA', 'matricula' => 'XA-UNO']);
    prestamoFinalizado(['fecha' => '2026-09-10', 'empresa' => 'BETA', 'matricula' => 'XA-DOS']);
    prestamoAbierto(['fecha' => '2026-09-12', 'empresa' => 'ALFA', 'matricula' => 'N123']);

    $this->actingAs(usuarioSinAcceso());

    $consulta = fn (string $q) => collect($this->getJson("/api/RelacionPlanta/historico?{$q}")->assertOk()->json('data'))->pluck('matricula')->all();

    expect($consulta('fecha_inicio=2026-09-05&fecha_fin=2026-09-11'))->toBe(['XA-DOS'])
        ->and($consulta('empresa=alf'))->toBe(['N123', 'XA-UNO'])
        ->and($consulta('matricula=xa-'))->toBe(['XA-DOS', 'XA-UNO'])
        ->and($consulta('status=en_uso'))->toBe(['N123'])
        ->and($consulta('status=finalizado'))->toBe(['XA-DOS', 'XA-UNO']);
});

test('el histórico pagina y acota per_page a los valores permitidos', function () {
    foreach (range(1, 25) as $i) {
        prestamoFinalizado(['fecha' => '2026-09-01', 'matricula' => "XA-{$i}"]);
    }

    $this->actingAs(usuarioSinAcceso());

    $this->getJson('/api/RelacionPlanta/historico?per_page=10&page=2')
        ->assertOk()
        ->assertJsonPath('per_page', 10)
        ->assertJsonPath('current_page', 2)
        ->assertJsonPath('total', 25)
        ->assertJsonCount(10, 'data');

    // Un valor no permitido cae al default de 20.
    $this->getJson('/api/RelacionPlanta/historico?per_page=7')->assertOk()->assertJsonPath('per_page', 20);
});

test('empresas devuelve las distintas ya usadas, filtradas por texto', function () {
    prestamoFinalizado(['empresa' => 'BETA AIR']);
    prestamoFinalizado(['empresa' => 'ALFA JET']);
    prestamoFinalizado(['empresa' => 'ALFA JET']);

    $this->actingAs(usuarioSinAcceso());

    $this->getJson('/api/RelacionPlanta/empresas')->assertOk()->assertExactJson(['ALFA JET', 'BETA AIR']);
    $this->getJson('/api/RelacionPlanta/empresas?q=bet')->assertOk()->assertExactJson(['BETA AIR']);
});
```

- [ ] **Step 2: Correr** → FAIL.

- [ ] **Step 3: Métodos** en el controlador:

```php
    /** Histórico paginado: en_uso arriba, luego del más reciente al más antiguo. */
    public function historico(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        if (! in_array($perPage, self::PER_PAGE_PERMITIDOS, true)) {
            $perPage = 20;
        }

        $query = RelacionPlanta::query();

        if ($request->filled('fecha_inicio')) {
            $query->whereDate('fecha', '>=', $request->query('fecha_inicio'));
        }

        if ($request->filled('fecha_fin')) {
            $query->whereDate('fecha', '<=', $request->query('fecha_fin'));
        }

        if ($request->filled('empresa')) {
            $query->where('empresa', 'LIKE', '%' . trim((string) $request->query('empresa')) . '%');
        }

        if ($request->filled('matricula')) {
            $query->where('matricula', 'LIKE', '%' . strtoupper(trim((string) $request->query('matricula'))) . '%');
        }

        if (in_array($request->query('status'), [RelacionPlanta::STATUS_EN_USO, RelacionPlanta::STATUS_FINALIZADO], true)) {
            $query->where('status', $request->query('status'));
        }

        $registros = $query
            ->orderByRaw("CASE WHEN status = '" . RelacionPlanta::STATUS_EN_USO . "' THEN 0 ELSE 1 END")
            ->orderByDesc('fecha')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->appends($request->query());

        return response()->json($registros);
    }

    /** Empresas ya usadas en este módulo, para sugerirlas al capturar. */
    public function empresas(Request $request): JsonResponse
    {
        $query = RelacionPlanta::query()->select('empresa')->distinct()->orderBy('empresa');

        if ($request->filled('q')) {
            $query->where('empresa', 'LIKE', '%' . trim((string) $request->query('q')) . '%');
        }

        return response()->json($query->limit(20)->pluck('empresa')->values());
    }
```

- [ ] **Step 4: Correr** `php artisan test tests/Feature/RelacionPlanta` → PASS (18). Luego `php artisan test` completo → todo verde. `./vendor/bin/pint --test` sobre los archivos nuevos.

---

### Task 5: Ruta web, menú y cliente HTTP

**Files:**
- Modify: `routes/web.php`, `resources/js/components/navigation.ts`
- Create: `resources/js/stores/apiRelacionPlanta.ts`, `resources/js/pages/Rampa/relacionPlanta/types.ts`

**Interfaces:**
- Produces (types.ts): `Prestamo`, `EstadoPrestamo`, `FiltrosHistorico`, `MetaPaginacion`, `PER_PAGE_OPCIONES`, `calcularTiempo(inicio, fin): number|null`, `horasAHHMM(horas): string`, `formatearHoras(valor): string`, `puedeOperarPlanta(usuario)`.
- Produces (store): `obtenerPrestamoActualApi()`, `prestarGpuApi(payload)`, `finalizarPrestamoApi(id, payload)`, `obtenerHistoricoPlantaApi(filtros, pagina, porPagina)`, `obtenerEmpresasPlantaApi(q?)`, clase `ErrorApi { status, codigo }`.

- [ ] **Step 1: Ruta web** — dentro del grupo `auth` de `routes/web.php`, junto a `remision`:

```php
    Route::get('relacionPlanta', function () {
        return Inertia::render('Rampa/RelacionPlanta');
    })->name('relacionPlanta');
```

Correr `php artisan wayfinder:generate --with-form` para que `@/routes` exporte `relacionPlanta`.

- [ ] **Step 2: Menú** — en `navigation.ts`: importar `relacionPlanta` desde `@/routes`; en `ROUTE_CONFIG` agregar

```ts
    relacionplanta: {
        href: relacionPlanta,
        title: 'Relación de planta',
    },
```

y en el bloque admin de Rampa, después de `rampa-around`:

```ts
                    { id: 'rampa-planta', title: 'Relación de planta', href: relacionPlanta(), icon: LayoutGrid },
```

- [ ] **Step 3: types.ts**

```ts
import type { UsuarioAutenticado } from '@/pages/despacho/operacionesProgramadas/types';

export const EQUIPO_GPU = 'GPU N.115';

export type EstadoPrestamo = 'en_uso' | 'finalizado';

/** Un préstamo de la GPU tal como lo devuelve la API (decimales como texto). */
export interface Prestamo {
    id: number;
    equipo: string;
    fecha: string;
    empresa: string;
    matricula: string;
    horometro_inicio: string;
    horometro_fin: string | null;
    tiempo: string | null;
    status: EstadoPrestamo;
    created_at?: string;
    updated_at?: string;
}

export interface PrestamoPayload {
    fecha: string;
    empresa: string;
    matricula: string;
    horometro_inicio: number;
}

export interface EntregaPayload {
    horometro_fin: number;
    tiempo: number | null;
}

export interface FiltrosHistorico {
    fecha_inicio: string;
    fecha_fin: string;
    empresa: string;
    matricula: string;
    status: '' | EstadoPrestamo;
}

export const FILTROS_VACIOS: FiltrosHistorico = { fecha_inicio: '', fecha_fin: '', empresa: '', matricula: '', status: '' };

export interface MetaPaginacion {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

export const PER_PAGE_OPCIONES = [10, 20, 50, 100] as const;

/** fin − inicio en horas decimales, a 2 decimales. null si algo no es número o fin < inicio. */
export const calcularTiempo = (inicio: number | string, fin: number | string): number | null => {
    const a = Number(inicio);
    const b = Number(fin);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
    return Math.round((b - a) * 100) / 100;
};

/** 0.75 → "00:45". Redondea al minuto. */
export const horasAHHMM = (horas: number | string | null | undefined): string => {
    const valor = Number(horas);
    if (!Number.isFinite(valor) || valor < 0) return '--:--';
    const totalMinutos = Math.round(valor * 60);
    const hh = Math.floor(totalMinutos / 60);
    const mm = totalMinutos % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

/** "125.30" → "125.30" con dos decimales; vacío/nulo → "—". */
export const formatearHoras = (valor: number | string | null | undefined): string => {
    const numero = Number(valor);
    if (valor === null || valor === undefined || valor === '' || !Number.isFinite(numero)) return '—';
    return numero.toFixed(2);
};

/** Fecha AAAA-MM-DD → DD/MM/AAAA sin pasar por Date (evita corrimientos por zona). */
export const fechaCorta = (fecha: string): string => {
    const [a, m, d] = fecha.slice(0, 10).split('-');
    return a && m && d ? `${d}/${m}/${a}` : fecha;
};

/** Admin o quien tenga el subdepartamento relacionPlanta: el mismo criterio que subdep en backend. */
export const puedeOperarPlanta = (usuario?: UsuarioAutenticado | null): boolean => {
    if (!usuario) return false;
    if (usuario.isAdmin) return true;
    return (usuario.departamentos ?? []).some(dep =>
        (dep.subdepartamentos ?? []).some(sub => sub.route?.endsWith('relacionplanta')),
    );
};
```

- [ ] **Step 4: Store** `resources/js/stores/apiRelacionPlanta.ts`

```ts
import type {
    EntregaPayload,
    FiltrosHistorico,
    MetaPaginacion,
    Prestamo,
    PrestamoPayload,
} from '@/pages/Rampa/relacionPlanta/types';

function getXsrfToken(): string {
    const match = document.cookie.split('; ').find(row => row.startsWith('XSRF-TOKEN='));
    return match ? decodeURIComponent(match.split('=')[1]) : '';
}

const BASE = '/api/RelacionPlanta';

/** Error de la API con el código HTTP y el código de negocio del backend. */
export class ErrorApi extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly codigo: string | null = null,
        public readonly errors: Record<string, string[]> = {},
    ) {
        super(message);
        this.name = 'ErrorApi';
    }
}

async function pedir<T>(url: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(url, {
        ...init,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': getXsrfToken(),
            ...(init.headers || {}),
        },
        credentials: 'same-origin',
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new ErrorApi(data?.message || 'Error en el servidor', res.status, data?.codigo ?? null, data?.errors ?? {});
    }

    return data as T;
}

export async function obtenerPrestamoActualApi(): Promise<Prestamo | null> {
    const data = await pedir<{ prestamo: Prestamo | null }>(`${BASE}/actual`, { method: 'GET' });
    return data.prestamo;
}

export function prestarGpuApi(payload: PrestamoPayload): Promise<{ message: string; prestamo: Prestamo }> {
    return pedir(`${BASE}/prestar`, { method: 'POST', body: JSON.stringify(payload) });
}

export function finalizarPrestamoApi(id: number, payload: EntregaPayload): Promise<{ message: string; prestamo: Prestamo }> {
    return pedir(`${BASE}/${id}/finalizar`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export type PaginaHistorico = MetaPaginacion & { data: Prestamo[] };

export function obtenerHistoricoPlantaApi(filtros: FiltrosHistorico, pagina: number, porPagina: number): Promise<PaginaHistorico> {
    const params = new URLSearchParams({ page: String(pagina), per_page: String(porPagina) });
    (Object.entries(filtros) as [keyof FiltrosHistorico, string][]).forEach(([clave, valor]) => {
        if (valor) params.set(clave, valor);
    });
    return pedir(`${BASE}/historico?${params.toString()}`, { method: 'GET' });
}

export function obtenerEmpresasPlantaApi(q = ''): Promise<string[]> {
    const sufijo = q ? `?q=${encodeURIComponent(q)}` : '';
    return pedir(`${BASE}/empresas${sufijo}`, { method: 'GET' });
}
```

- [ ] **Step 5: Verificar** `npx tsc --noEmit -p .` sin errores nuevos (la página aún no existe; `@/routes` debe exportar `relacionPlanta`).

---

### Task 6: Hooks de estado (tarjeta e histórico)

**Files:**
- Create: `resources/js/pages/Rampa/relacionPlanta/useRelacionPlanta.ts`
- Create: `resources/js/pages/Rampa/relacionPlanta/useHistoricoPlanta.ts`

**Interfaces:**
- Produces: `useRelacionPlanta()` → `{ actual, cargando, error, recargar, prestar(payload): Promise<boolean>, finalizar(id, payload): Promise<boolean> }` (los booleanos indican éxito; las alertas Swal las dispara el hook).
- Produces: `useHistoricoPlanta()` → `{ registros, meta, cargando, filtros, setFiltros, limpiarFiltros, pagina, cambiarPagina, porPagina, cambiarPorPagina, tablaRef, recargar }`.

- [ ] **Step 1: useRelacionPlanta.ts**

```ts
import { ErrorApi, finalizarPrestamoApi, obtenerPrestamoActualApi, prestarGpuApi } from '@/stores/apiRelacionPlanta';
import { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import type { EntregaPayload, Prestamo, PrestamoPayload } from './types';

const toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3500, timerProgressBar: true });

/**
 * Estado de la GPU N.115: el préstamo abierto (o null) y las dos acciones.
 * Un 409 significa que otro usuario se adelantó: se avisa y se recarga.
 */
export function useRelacionPlanta() {
    const [actual, setActual] = useState<Prestamo | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const recargar = useCallback(async () => {
        try {
            setActual(await obtenerPrestamoActualApi());
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo consultar el estado de la GPU.');
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        recargar();
    }, [recargar]);

    const prestar = useCallback(async (payload: PrestamoPayload): Promise<boolean> => {
        try {
            const { message, prestamo } = await prestarGpuApi(payload);
            setActual(prestamo);
            toast.fire({ icon: 'success', title: message });
            return true;
        } catch (e) {
            if (e instanceof ErrorApi && e.codigo === 'gpu_en_uso') {
                await Swal.fire({ icon: 'warning', title: 'GPU no disponible', text: e.message, confirmButtonText: 'Entendido' });
                recargar();
                return false;
            }
            Swal.fire({ icon: 'error', title: 'No se pudo registrar el préstamo', text: e instanceof Error ? e.message : 'Error inesperado' });
            return false;
        }
    }, [recargar]);

    const finalizar = useCallback(async (id: number, payload: EntregaPayload): Promise<boolean> => {
        try {
            const { message } = await finalizarPrestamoApi(id, payload);
            setActual(null);
            toast.fire({ icon: 'success', title: message });
            return true;
        } catch (e) {
            if (e instanceof ErrorApi && e.codigo === 'ya_finalizado') {
                await Swal.fire({ icon: 'info', title: 'Préstamo ya finalizado', text: e.message, confirmButtonText: 'Entendido' });
                recargar();
                return true; // La pantalla debe cerrar el modal: ya no hay nada que finalizar.
            }
            Swal.fire({ icon: 'error', title: 'No se pudo registrar la entrega', text: e instanceof Error ? e.message : 'Error inesperado' });
            return false;
        }
    }, [recargar]);

    return { actual, cargando, error, recargar, prestar, finalizar };
}
```

- [ ] **Step 2: useHistoricoPlanta.ts**

```ts
import { obtenerHistoricoPlantaApi } from '@/stores/apiRelacionPlanta';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FILTROS_VACIOS, type FiltrosHistorico, type MetaPaginacion, type Prestamo } from './types';

/**
 * Histórico paginado con filtros. Al cambiar de página hace scroll al inicio
 * de la tabla; al cambiar filtros o tamaño de página vuelve a la página 1.
 */
export function useHistoricoPlanta() {
    const [registros, setRegistros] = useState<Prestamo[]>([]);
    const [meta, setMeta] = useState<MetaPaginacion | null>(null);
    const [cargando, setCargando] = useState(true);
    const [filtros, setFiltrosEstado] = useState<FiltrosHistorico>(FILTROS_VACIOS);
    const [pagina, setPagina] = useState(1);
    const [porPagina, setPorPagina] = useState(20);
    const tablaRef = useRef<HTMLDivElement | null>(null);
    const peticionRef = useRef(0);

    const recargar = useCallback(async () => {
        const numero = ++peticionRef.current;
        setCargando(true);
        try {
            const respuesta = await obtenerHistoricoPlantaApi(filtros, pagina, porPagina);
            if (numero !== peticionRef.current) return;
            setRegistros(respuesta.data);
            setMeta({
                current_page: respuesta.current_page,
                last_page: respuesta.last_page,
                per_page: respuesta.per_page,
                total: respuesta.total,
                from: respuesta.from,
                to: respuesta.to,
            });
        } catch (e) {
            console.error('No se pudo cargar el histórico de la GPU', e);
        } finally {
            if (numero === peticionRef.current) setCargando(false);
        }
    }, [filtros, pagina, porPagina]);

    useEffect(() => {
        recargar();
    }, [recargar]);

    const setFiltros = useCallback((cambio: Partial<FiltrosHistorico>) => {
        setFiltrosEstado(previos => ({ ...previos, ...cambio }));
        setPagina(1);
    }, []);

    const limpiarFiltros = useCallback(() => {
        setFiltrosEstado(FILTROS_VACIOS);
        setPagina(1);
    }, []);

    const cambiarPagina = useCallback((nueva: number) => {
        setPagina(nueva);
        tablaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    const cambiarPorPagina = useCallback((cantidad: number) => {
        setPorPagina(cantidad);
        setPagina(1);
    }, []);

    return { registros, meta, cargando, filtros, setFiltros, limpiarFiltros, pagina, cambiarPagina, porPagina, cambiarPorPagina, tablaRef, recargar };
}
```

- [ ] **Step 3:** `npx tsc --noEmit -p .` limpio.

---

### Task 7: Tarjeta y modales

**Files:**
- Create: `resources/js/pages/Rampa/relacionPlanta/TarjetaGpu.tsx`
- Create: `resources/js/pages/Rampa/relacionPlanta/PrestamoModal.tsx`
- Create: `resources/js/pages/Rampa/relacionPlanta/EntregaModal.tsx`

**Interfaces:**
- `TarjetaGpu({ actual, cargando, puedeOperar, onPrestar, onEntregar })`
- `PrestamoModal({ onCerrar, onGuardar(payload): Promise<boolean> })`
- `EntregaModal({ prestamo, onCerrar, onGuardar(payload): Promise<boolean> })`

- [ ] **Step 1: TarjetaGpu.tsx**

```tsx
import { BatteryCharging, CircleCheck, Clock3, Plus } from 'lucide-react';
import { EQUIPO_GPU, fechaCorta, formatearHoras, type Prestamo } from './types';

interface Props {
    actual: Prestamo | null;
    cargando: boolean;
    puedeOperar: boolean;
    onPrestar: () => void;
    onEntregar: () => void;
}

/** Tarjeta grande de estado de la GPU N.115: Disponible (esmeralda) o En uso (ámbar). */
export default function TarjetaGpu({ actual, cargando, puedeOperar, onPrestar, onEntregar }: Props) {
    const enUso = actual !== null;

    const marco = enUso
        ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-white'
        : 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-white';
    const icono = enUso ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600';

    return (
        <section className={`rounded-2xl border-2 p-5 shadow-sm md:p-6 ${marco}`}>
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="flex items-center gap-4">
                    <span className={`rounded-2xl p-3 ${icono}`}>
                        <BatteryCharging size={36} strokeWidth={2.25} />
                    </span>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Planta de energía</p>
                        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-800 md:text-3xl">{EQUIPO_GPU}</h2>
                    </div>
                </div>

                {cargando ? (
                    <span className="text-[10px] font-black uppercase text-slate-400">Consultando…</span>
                ) : (
                    <span
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-black uppercase tracking-wider ${
                            enUso ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'
                        }`}
                    >
                        {enUso ? <Clock3 size={14} strokeWidth={3} /> : <CircleCheck size={14} strokeWidth={3} />}
                        {enUso ? 'En uso' : 'Disponible'}
                    </span>
                )}
            </div>

            {!cargando && enUso && actual && (
                <dl className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                    {[
                        ['Matrícula', actual.matricula],
                        ['Empresa', actual.empresa],
                        ['Fecha del préstamo', fechaCorta(actual.fecha)],
                        ['Horómetro inicial', `${formatearHoras(actual.horometro_inicio)} h`],
                    ].map(([etiqueta, valor]) => (
                        <div key={etiqueta} className="rounded-xl border border-amber-200/70 bg-white/80 p-3">
                            <dt className="text-[9px] font-black uppercase tracking-wider text-slate-400">{etiqueta}</dt>
                            <dd className="mt-1 truncate text-base font-black uppercase text-slate-800" title={String(valor)}>
                                {valor}
                            </dd>
                        </div>
                    ))}
                </dl>
            )}

            {!cargando && !enUso && (
                <p className="mt-6 text-sm font-semibold text-slate-500">
                    Sin préstamo abierto. La planta puede prestarse a una aeronave.
                </p>
            )}

            {!cargando && puedeOperar && (
                <div className="mt-6 flex justify-end">
                    {enUso ? (
                        <button
                            type="button"
                            onClick={onEntregar}
                            className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-amber-600 active:scale-95"
                        >
                            <CircleCheck size={18} />
                            Registrar entrega
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={onPrestar}
                            className="flex items-center gap-2 rounded-xl bg-[#00677F] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#00586D] active:scale-95"
                        >
                            <Plus size={18} />
                            Registrar préstamo
                        </button>
                    )}
                </div>
            )}
        </section>
    );
}
```

- [ ] **Step 2: PrestamoModal.tsx**

```tsx
import InputMatricula from '@/pages/InputMatricula';
import { fechaHoy } from '@/pages/despacho/operacionesProgramadas/types';
import { obtenerEmpresasPlantaApi } from '@/stores/apiRelacionPlanta';
import { BatteryCharging, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EQUIPO_GPU, type PrestamoPayload } from './types';

interface Props {
    onCerrar: () => void;
    /** Devuelve true si se guardó; el modal se cierra solo en ese caso. */
    onGuardar: (payload: PrestamoPayload) => Promise<boolean>;
}

const CAMPO = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-[#00677F] focus:ring-1 focus:ring-[#00677F]';
const ETIQUETA = 'mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500';

export default function PrestamoModal({ onCerrar, onGuardar }: Props) {
    const [fecha, setFecha] = useState(() => fechaHoy());
    const [empresa, setEmpresa] = useState('');
    const [matricula, setMatricula] = useState('');
    const [horometro, setHorometro] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [errores, setErrores] = useState<Record<string, string>>({});
    const [empresas, setEmpresas] = useState<string[]>([]);

    // Sugerencias de empresas ya usadas en este módulo (no es un catálogo).
    useEffect(() => {
        obtenerEmpresasPlantaApi().then(setEmpresas).catch(() => setEmpresas([]));
    }, []);

    const validar = (): boolean => {
        const nuevos: Record<string, string> = {};
        if (!fecha) nuevos.fecha = 'La fecha es obligatoria.';
        if (!empresa.trim()) nuevos.empresa = 'La empresa es obligatoria.';
        if (!matricula.trim()) nuevos.matricula = 'La matrícula es obligatoria.';
        const h = Number(horometro);
        if (horometro === '' || !Number.isFinite(h)) nuevos.horometro = 'El horómetro inicial es obligatorio.';
        else if (h < 0) nuevos.horometro = 'El horómetro inicial no puede ser negativo.';
        setErrores(nuevos);
        return Object.keys(nuevos).length === 0;
    };

    const enviar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (guardando || !validar()) return;

        setGuardando(true);
        const ok = await onGuardar({
            fecha,
            empresa: empresa.trim(),
            matricula: matricula.trim().toUpperCase(),
            horometro_inicio: Math.round(Number(horometro) * 100) / 100,
        });
        setGuardando(false);
        if (ok) onCerrar();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCerrar} />
            <form
                onSubmit={enviar}
                className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200"
            >
                <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <span className="rounded-xl bg-emerald-100 p-2 text-emerald-600"><BatteryCharging size={20} /></span>
                        <div>
                            <h3 className="text-base font-black uppercase tracking-tight text-slate-800">Registrar préstamo</h3>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{EQUIPO_GPU}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onCerrar} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </header>

                <div className="space-y-4 p-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className={ETIQUETA}>Fecha</label>
                            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={CAMPO} required />
                            {errores.fecha && <p className="mt-1 text-[10px] font-bold text-red-600">{errores.fecha}</p>}
                        </div>
                        <div>
                            <label className={ETIQUETA}>Horómetro inicial (horas)</label>
                            <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0"
                                value={horometro}
                                onChange={e => setHorometro(e.target.value)}
                                placeholder="125.30"
                                className={CAMPO}
                                required
                            />
                            {errores.horometro && <p className="mt-1 text-[10px] font-bold text-red-600">{errores.horometro}</p>}
                        </div>
                    </div>

                    <div>
                        <label className={ETIQUETA}>Empresa</label>
                        <input
                            type="text"
                            list="empresas-planta"
                            value={empresa}
                            onChange={e => setEmpresa(e.target.value.toUpperCase())}
                            placeholder="Nombre de la empresa"
                            className={`${CAMPO} uppercase`}
                            maxLength={120}
                            required
                        />
                        <datalist id="empresas-planta">
                            {empresas.map(nombre => <option key={nombre} value={nombre} />)}
                        </datalist>
                        {errores.empresa && <p className="mt-1 text-[10px] font-bold text-red-600">{errores.empresa}</p>}
                    </div>

                    <div>
                        <InputMatricula label="Matrícula" value={matricula} onSelect={setMatricula} required />
                        {errores.matricula && <p className="mt-1 text-[10px] font-bold text-red-600">{errores.matricula}</p>}
                    </div>
                </div>

                <footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
                    <button type="button" onClick={onCerrar} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase text-slate-600 hover:bg-slate-100">
                        Cancelar
                    </button>
                    <button type="submit" disabled={guardando} className="rounded-xl bg-[#00677F] px-5 py-2 text-xs font-bold uppercase text-white shadow-sm hover:bg-[#00586D] disabled:opacity-50">
                        {guardando ? 'Guardando…' : 'Registrar préstamo'}
                    </button>
                </footer>
            </form>
        </div>
    );
}
```

- [ ] **Step 3: EntregaModal.tsx**

```tsx
import { CircleCheck, Clock3, X } from 'lucide-react';
import { useState } from 'react';
import Swal from 'sweetalert2';
import { calcularTiempo, fechaCorta, formatearHoras, horasAHHMM, type EntregaPayload, type Prestamo } from './types';

interface Props {
    prestamo: Prestamo;
    onCerrar: () => void;
    onGuardar: (payload: EntregaPayload) => Promise<boolean>;
}

const CAMPO = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500';
const ETIQUETA = 'mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500';
const MENSAJE_MENOR = 'El horómetro final no puede ser menor que el horómetro inicial.';

/**
 * Entrega de la GPU. El tiempo se calcula (fin − inicio) cada vez que cambia
 * el horómetro final y se coloca en el campo; el usuario puede editarlo antes
 * de guardar. Todo en horas decimales; HH:MM es solo una ayuda visual.
 */
export default function EntregaModal({ prestamo, onCerrar, onGuardar }: Props) {
    const inicio = Number(prestamo.horometro_inicio);
    const [fin, setFin] = useState('');
    const [tiempo, setTiempo] = useState('');
    const [guardando, setGuardando] = useState(false);

    const finNumero = fin === '' ? null : Number(fin);
    const finInvalido = finNumero !== null && (!Number.isFinite(finNumero) || finNumero < 0);
    const finMenor = finNumero !== null && !finInvalido && finNumero < inicio;
    const tiempoNumero = tiempo === '' ? null : Number(tiempo);
    const tiempoInvalido = tiempoNumero !== null && (!Number.isFinite(tiempoNumero) || tiempoNumero < 0);

    const cambiarFin = (valor: string) => {
        setFin(valor);
        // Cada cambio del final recalcula y pisa lo editado a mano.
        const calculado = valor === '' ? null : calcularTiempo(inicio, valor);
        setTiempo(calculado === null ? '' : calculado.toFixed(2));
    };

    const puedeGuardar = finNumero !== null && !finInvalido && !finMenor && !tiempoInvalido && !guardando;

    const enviar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!puedeGuardar || finNumero === null) return;

        const confirmacion = await Swal.fire({
            title: 'Registrar entrega',
            text: `Se cerrará el préstamo de la matrícula ${prestamo.matricula} con horómetro final ${finNumero.toFixed(2)} y ${tiempoNumero === null ? formatearHoras(calcularTiempo(inicio, finNumero)) : tiempoNumero.toFixed(2)} h de uso.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, registrar',
            cancelButtonText: 'Regresar',
            confirmButtonColor: '#d97706',
            reverseButtons: true,
        });
        if (!confirmacion.isConfirmed) return;

        setGuardando(true);
        const ok = await onGuardar({
            horometro_fin: Math.round(finNumero * 100) / 100,
            tiempo: tiempoNumero === null ? null : Math.round(tiempoNumero * 100) / 100,
        });
        setGuardando(false);
        if (ok) onCerrar();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCerrar} />
            <form
                onSubmit={enviar}
                className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200"
            >
                <header className="flex items-center justify-between border-b border-slate-100 bg-amber-50 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <span className="rounded-xl bg-amber-100 p-2 text-amber-600"><CircleCheck size={20} /></span>
                        <div>
                            <h3 className="text-base font-black uppercase tracking-tight text-slate-800">Registrar entrega</h3>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                {prestamo.matricula} · {prestamo.empresa} · {fechaCorta(prestamo.fecha)}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onCerrar} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </header>

                <div className="space-y-4 p-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className={ETIQUETA}>Horómetro inicial (horas)</label>
                            <input type="text" value={formatearHoras(prestamo.horometro_inicio)} readOnly className={`${CAMPO} bg-slate-100 text-slate-500`} />
                            <p className="mt-1 text-[10px] font-semibold text-slate-400">Solo referencia, no se modifica.</p>
                        </div>
                        <div>
                            <label className={ETIQUETA}>Horómetro final (horas)</label>
                            <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0"
                                value={fin}
                                onChange={e => cambiarFin(e.target.value)}
                                placeholder={formatearHoras(inicio)}
                                className={`${CAMPO} ${finMenor || finInvalido ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
                                autoFocus
                                required
                            />
                            {finMenor && <p className="mt-1 text-[10px] font-bold text-red-600">{MENSAJE_MENOR}</p>}
                            {finInvalido && <p className="mt-1 text-[10px] font-bold text-red-600">El horómetro final no puede ser negativo.</p>}
                        </div>
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                        <label className={ETIQUETA}>Tiempo de uso (horas decimales)</label>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0"
                                value={tiempo}
                                onChange={e => setTiempo(e.target.value)}
                                placeholder="0.00"
                                className={`${CAMPO} sm:max-w-[160px] ${tiempoInvalido ? 'border-red-400' : ''}`}
                            />
                            <div className="flex items-center gap-2 text-slate-600">
                                <Clock3 size={16} className="text-amber-600" />
                                <span className="text-sm font-black">
                                    {tiempoNumero === null || tiempoInvalido ? '—' : `${tiempoNumero.toFixed(2)} h`}
                                </span>
                                <span className="text-sm font-semibold text-slate-400">≈ {horasAHHMM(tiempoNumero)}</span>
                            </div>
                        </div>
                        <p className="mt-2 text-[10px] font-semibold text-slate-500">
                            Se calcula como horómetro final − inicial. Puedes ajustarlo antes de guardar. Horas decimales: 0.50 h = 30 min, no 50 min.
                        </p>
                        {tiempoInvalido && <p className="mt-1 text-[10px] font-bold text-red-600">El tiempo de uso no puede ser negativo.</p>}
                    </div>
                </div>

                <footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
                    <button type="button" onClick={onCerrar} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase text-slate-600 hover:bg-slate-100">
                        Cancelar
                    </button>
                    <button type="submit" disabled={!puedeGuardar} className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold uppercase text-white shadow-sm hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50">
                        {guardando ? 'Guardando…' : 'Registrar entrega'}
                    </button>
                </footer>
            </form>
        </div>
    );
}
```

- [ ] **Step 4:** `npx tsc --noEmit -p .` limpio.

---

### Task 8: Tabla histórica y página

**Files:**
- Create: `resources/js/pages/Rampa/relacionPlanta/TablaHistorico.tsx`
- Create: `resources/js/pages/Rampa/RelacionPlanta.tsx`

**Interfaces:**
- `TablaHistorico({ historico: ReturnType<typeof useHistoricoPlanta>, mostrarFiltros })`

- [ ] **Step 1: TablaHistorico.tsx**

```tsx
import { X } from 'lucide-react';
import { PER_PAGE_OPCIONES, fechaCorta, formatearHoras, horasAHHMM, type EstadoPrestamo } from './types';
import type { useHistoricoPlanta } from './useHistoricoPlanta';

interface Props {
    historico: ReturnType<typeof useHistoricoPlanta>;
    mostrarFiltros: boolean;
}

const TH = 'px-4 py-4 text-[9px] font-black uppercase text-slate-400 text-center';
const TD = 'px-4 py-3 text-center text-xs font-semibold text-slate-700';
const FILTRO = 'w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white outline-none focus:border-blue-400';

const BADGE: Record<EstadoPrestamo, string> = {
    en_uso: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
    finalizado: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
};

/** Histórico de préstamos con el mismo estilo de tabla que Remisiones. */
export default function TablaHistorico({ historico, mostrarFiltros }: Props) {
    const { registros, meta, cargando, filtros, setFiltros, limpiarFiltros, pagina, cambiarPagina, porPagina, cambiarPorPagina, tablaRef } = historico;

    return (
        <div ref={tablaRef} className="scroll-mt-4 space-y-4">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] border-collapse text-left">
                        <thead>
                            <tr className="border-b border-slate-100 bg-white">
                                <th className={`${TH} w-12`}>#</th>
                                <th className={TH}>Fecha</th>
                                <th className={TH}>Empresa</th>
                                <th className={TH}>Matrícula</th>
                                <th className={TH}>Horóm. inicial</th>
                                <th className={TH}>Horóm. final</th>
                                <th className={TH}>Tiempo (h)</th>
                                <th className={TH}>Estado</th>
                            </tr>
                            <tr className={`border-b border-slate-200 bg-slate-50 ${mostrarFiltros ? '' : 'hidden'}`}>
                                <td className="px-2 py-2 text-center">
                                    <button type="button" onClick={limpiarFiltros} title="Limpiar filtros" className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                                </td>
                                <td className="px-2 py-2">
                                    <div className="flex flex-col gap-1">
                                        <input type="date" value={filtros.fecha_inicio} onChange={e => setFiltros({ fecha_inicio: e.target.value })} className={FILTRO} title="Desde" />
                                        <input type="date" value={filtros.fecha_fin} onChange={e => setFiltros({ fecha_fin: e.target.value })} className={FILTRO} title="Hasta" />
                                    </div>
                                </td>
                                <td className="px-2 py-2">
                                    <input type="text" placeholder="Empresa…" value={filtros.empresa} onChange={e => setFiltros({ empresa: e.target.value.toUpperCase() })} className={`${FILTRO} uppercase`} />
                                </td>
                                <td className="px-2 py-2">
                                    <input type="text" placeholder="Matrícula…" value={filtros.matricula} onChange={e => setFiltros({ matricula: e.target.value.toUpperCase() })} className={`${FILTRO} uppercase`} />
                                </td>
                                <td />
                                <td />
                                <td />
                                <td className="px-2 py-2">
                                    <select value={filtros.status} onChange={e => setFiltros({ status: e.target.value as '' | EstadoPrestamo })} className={FILTRO}>
                                        <option value="">TODOS</option>
                                        <option value="en_uso">EN USO</option>
                                        <option value="finalizado">FINALIZADO</option>
                                    </select>
                                </td>
                            </tr>
                        </thead>
                        <tbody>
                            {cargando ? (
                                <tr><td colSpan={8} className="px-6 py-20 text-center text-[10px] font-black uppercase text-slate-400">Cargando datos…</td></tr>
                            ) : registros.length === 0 ? (
                                <tr><td colSpan={8} className="px-6 py-20 text-center text-[10px] font-black uppercase text-slate-400">No hay préstamos con esos criterios</td></tr>
                            ) : (
                                registros.map((p, index) => {
                                    const numero = ((meta?.current_page ?? 1) - 1) * (meta?.per_page ?? porPagina) + index + 1;
                                    return (
                                        <tr key={p.id} className={`border-b border-slate-100 transition-colors hover:bg-slate-50 ${p.status === 'en_uso' ? 'bg-amber-50/40' : ''}`}>
                                            <td className={`${TD} font-mono text-[10px] text-slate-400`}>{numero}</td>
                                            <td className={TD}>{fechaCorta(p.fecha)}</td>
                                            <td className={`${TD} uppercase`}>{p.empresa}</td>
                                            <td className={`${TD} font-black tracking-tight`}>{p.matricula}</td>
                                            <td className={`${TD} tabular-nums`}>{formatearHoras(p.horometro_inicio)}</td>
                                            <td className={`${TD} tabular-nums`}>{formatearHoras(p.horometro_fin)}</td>
                                            <td className={`${TD} tabular-nums`}>
                                                {p.tiempo === null ? '—' : (
                                                    <span title="Horas decimales">
                                                        <span className="font-black">{formatearHoras(p.tiempo)} h</span>
                                                        <span className="ml-1 text-[10px] text-slate-400">({horasAHHMM(p.tiempo)})</span>
                                                    </span>
                                                )}
                                            </td>
                                            <td className={TD}>
                                                <span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${BADGE[p.status]}`}>
                                                    {p.status === 'en_uso' ? 'En uso' : 'Finalizado'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {meta && (
                <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-500">
                        Página {meta.current_page} de {Math.max(meta.last_page, 1)} · {meta.total} registros
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-500">
                            <select value={porPagina} onChange={e => cambiarPorPagina(Number(e.target.value))} className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-black">
                                {PER_PAGE_OPCIONES.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                            por página
                        </label>
                        <button type="button" disabled={pagina <= 1} onClick={() => cambiarPagina(pagina - 1)} className="rounded border border-slate-200 px-3 py-1 text-[10px] font-black hover:bg-slate-50 disabled:opacity-50">ANTERIOR</button>
                        <button type="button" disabled={pagina >= meta.last_page} onClick={() => cambiarPagina(pagina + 1)} className="rounded border border-slate-200 px-3 py-1 text-[10px] font-black hover:bg-slate-50 disabled:opacity-50">SIGUIENTE</button>
                    </div>
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Página** `resources/js/pages/Rampa/RelacionPlanta.tsx`

```tsx
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import type { UsuarioAutenticado } from '@/pages/despacho/operacionesProgramadas/types';
import { Head, usePage } from '@inertiajs/react';
import { AlertCircle, Filter } from 'lucide-react';
import { useMemo, useState } from 'react';
import EntregaModal from './relacionPlanta/EntregaModal';
import PrestamoModal from './relacionPlanta/PrestamoModal';
import TablaHistorico from './relacionPlanta/TablaHistorico';
import TarjetaGpu from './relacionPlanta/TarjetaGpu';
import { EQUIPO_GPU, puedeOperarPlanta } from './relacionPlanta/types';
import { useHistoricoPlanta } from './relacionPlanta/useHistoricoPlanta';
import { useRelacionPlanta } from './relacionPlanta/useRelacionPlanta';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Relación de planta' }];

export default function RelacionPlanta() {
    const { auth } = usePage<{ auth: { user: UsuarioAutenticado | null } }>().props;
    const puedeOperar = useMemo(() => puedeOperarPlanta(auth?.user), [auth?.user]);

    const gpu = useRelacionPlanta();
    const historico = useHistoricoPlanta();

    const [modal, setModal] = useState<'prestamo' | 'entrega' | null>(null);
    const [mostrarFiltros, setMostrarFiltros] = useState(false);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Relación de planta" />
            <div className="min-h-screen bg-[#f3f4f6] p-6">
                <div className="space-y-4 animate-in fade-in duration-500">
                    <div className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-tighter text-slate-800">Relación de planta</h2>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Control de préstamo · {EQUIPO_GPU}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setMostrarFiltros(!mostrarFiltros)}
                            className={`flex items-center gap-2 rounded border px-4 py-2 text-[10px] font-black transition-all ${mostrarFiltros ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                        >
                            <Filter size={14} />
                            <span>{mostrarFiltros ? 'OCULTAR FILTROS' : 'FILTRAR'}</span>
                        </button>
                    </div>

                    {gpu.error && (
                        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                            <AlertCircle className="mt-0.5 shrink-0 text-red-500" size={18} />
                            <p className="text-sm font-medium text-red-700">{gpu.error}</p>
                        </div>
                    )}

                    <TarjetaGpu
                        actual={gpu.actual}
                        cargando={gpu.cargando}
                        puedeOperar={puedeOperar}
                        onPrestar={() => setModal('prestamo')}
                        onEntregar={() => setModal('entrega')}
                    />

                    <TablaHistorico historico={historico} mostrarFiltros={mostrarFiltros} />
                </div>
            </div>

            {modal === 'prestamo' && (
                <PrestamoModal
                    onCerrar={() => setModal(null)}
                    onGuardar={async payload => {
                        const ok = await gpu.prestar(payload);
                        if (ok) historico.recargar();
                        return ok;
                    }}
                />
            )}

            {modal === 'entrega' && gpu.actual && (
                <EntregaModal
                    prestamo={gpu.actual}
                    onCerrar={() => setModal(null)}
                    onGuardar={async payload => {
                        const ok = await gpu.finalizar(gpu.actual!.id, payload);
                        if (ok) historico.recargar();
                        return ok;
                    }}
                />
            )}
        </AppLayout>
    );
}
```

- [ ] **Step 3:** `npx tsc --noEmit -p .`, `npx eslint` sobre `resources/js/pages/Rampa/relacionPlanta resources/js/pages/Rampa/RelacionPlanta.tsx resources/js/stores/apiRelacionPlanta.ts`, `npm run build`.

- [ ] **Step 4: Sembrar el subdepartamento localmente** `php artisan db:seed --class=RelacionPlantaSubdepartamentoSeeder` y `php artisan migrate`.

- [ ] **Step 5: Verificación en navegador** (usuario admin o con subdepartamento): menú Rampa muestra "Relación de planta"; tarjeta Disponible; Registrar préstamo con fecha de hoy precargada, matrícula con sugerencias, guardar → tarjeta En uso ámbar; segundo préstamo desde otra pestaña → Swal "GPU no disponible"; Registrar entrega: final 126.05 sobre inicial 125.30 → tiempo 0.75 h ≈ 00:45, editar a 1.00, guardar → tarjeta Disponible, histórico con la fila finalizada; filtros y paginación; final menor → mensaje rojo y botón deshabilitado.

---

## Self-review

- **Cobertura del spec:** datos (T1), actual/prestar + bloqueo + 409 (T2), finalizar + cálculo + 422/409 (T3), histórico/filtros/per_page/empresas (T4), ruta web/menú/store/tipos (T5), hooks (T6), tarjeta/modales con textos exactos y HH:MM (T7), tabla/paginación/scroll/página (T8), seeder (T2), bitácora (T2/T3), permisos frontend `puedeOperarPlanta` (T5/T8). Pruebas backend en T1–T4; frontend en T8.
- **Placeholders:** ninguno.
- **Consistencia de nombres:** `prestarGpuApi`, `finalizarPrestamoApi`, `obtenerHistoricoPlantaApi`, `obtenerEmpresasPlantaApi`, `obtenerPrestamoActualApi` usados igual en store y hooks; `useHistoricoPlanta` devuelve `recargar`/`tablaRef`/`cambiarPagina`/`cambiarPorPagina` y `TablaHistorico` los consume con esos nombres; `EntregaPayload.tiempo: number|null` coincide con el Form Request (`nullable`).
