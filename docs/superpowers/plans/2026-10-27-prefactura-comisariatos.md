# Los comisariatos entran solos en la prefactura — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una prefactura traiga solos los comisariatos de su matrícula entregados durante la estancia, y que se puedan buscar a mano desde el modal de agregar servicio.

**Architecture:** Calca el enlace que ya existe con las remisiones de combustible. Una columna `servicio_comisariato_id` en el renglón marca el comisariato como cobrado; un servicio `ComisariatosFacturables` concentra la regla de «tomado»; una tabla de exclusiones recuerda lo que el operador quitó a mano. La diferencia de fondo con el combustible es el dinero: allí se forzó margen 0, aquí el margen sale del servicio porque **es** el negocio.

**Tech Stack:** Laravel 12, Pest 3, React 19 + TypeScript, Inertia 2, Tailwind 4. MySQL/MariaDB en desarrollo, **sqlite en memoria en pruebas**.

**Spec:** `docs/superpowers/specs/2026-10-27-prefactura-comisariatos-design.md`

**Precedente a imitar:** `app/Services/RemisionesFacturables.php` y el método `sincronizarRemisiones()` de `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php`. **Léelos antes de empezar tu tarea**: este trabajo es su hermano y debe parecerse.

## Global Constraints

- Las pruebas corren **en serie** (`php artisan test`), **nunca con `--parallel`**: en este proyecto da falsos rojos.
- **No** ejecutar `vendor/bin/pint`, `prettier` ni `npm run lint` — el último lleva `--fix` y reformatea ficheros ajenos.
- **No** usar `git stash`.
- La conexión `remota` es de **solo lectura** por contrato.
- La base de desarrollo `eolo_plus` es la base **real del usuario**: se lee, no se escribe. **No correr `php artisan migrate`** contra ella salvo en la tarea que lo pide, y allí se pide permiso antes.
- En sqlite no existen `timestamp()`, `CONCAT()` ni `DATE_FORMAT()` de MySQL. `LOWER()`, `upper()`, `trim()` y `LIKE` sí.
- **Este proyecto no usa fábricas de modelos.** La única es `UserFactory`; las filas se construyen con `Modelo::create([...])`.
- `RefreshDatabase` está aplicado globalmente a `tests/Feature` desde `tests/Pest.php`.
- **No hay lanzador de pruebas de JavaScript.** La evidencia del front es `npx tsc --noEmit` contra una línea base de **exactamente 1 error** (un TS1117 en el fichero generado `WalkAroundController.ts`) más `npm run build`. El `tsc` se mide **después** del build.
- Los mensajes de usuario van **en español**.
- La columna del renglón se llama `servicio_comisariato_id` en todas las tareas.
- Terminar cada mensaje de commit con `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Todo nombre de índice o foránea que genere una migración debe quedar por debajo de 64 caracteres.** MySQL rechaza el resto y la migración falla entera; sqlite no tiene ese límite, así que las pruebas no lo detectan. Ya ocurrió una vez en la tabla hermana.

### Una decisión derivada que la spec no deletrea

**Un comisariato cuyo proveedor se dio de baja DESPUÉS de capturarlo se sigue cobrando con ese proveedor.** No se busca un sustituto ni se rechaza. Es la misma decisión que se tomó en el módulo de Tráfico para la edición: cambiar el proveedor de un registro histórico le cambia en silencio el margen con el que se cobra. El servicio viaja en el comisariato (`fact_servicio_id`), así que no hay que buscarlo en el catálogo: **no existe aquí el caso «no hay servicio activo» que sí tiene el combustible**.

---

## Estructura de ficheros

**Backend**

| Fichero | Responsabilidad |
|---|---|
| `database/migrations/2026_10_29_100000_add_servicio_comisariato_id_to_fact_prefactura_renglones_table.php` | La columna del renglón. |
| `database/migrations/2026_10_29_110000_create_fact_prefactura_comisariatos_excluidos_table.php` | La tabla de exclusiones. |
| `app/Models/FactPrefacturaComisariatoExcluido.php` | Su modelo, hermano de `FactPrefacturaRemisionExcluida`. |
| `app/Models/FactPrefacturaRenglon.php` | La columna en `$fillable` y la relación. |
| `app/Services/ComisariatosFacturables.php` | Qué comisariatos puede cobrar una prefactura, y la regla de «tomado». |
| `app/Services/RenglonDeComisariato.php` | **El único sitio** que arma el renglón, para las dos vías. |
| `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php` | Sincronizar, buscar, y el alta a mano. |
| `app/Http/Requests/Facturacion/StoreRenglonRequest.php` | Validar `servicio_comisariato_id`. |
| `routes/api.php` | Las dos rutas nuevas. |

**Frontend**

| Fichero | Responsabilidad |
|---|---|
| `resources/js/pages/Facturacion/components/ModalRenglon.tsx` | El buscador de comisariatos. |
| `resources/js/pages/Facturacion/EditorPrefactura.tsx` | Disparar la sincronización y pintar la forma de pago. |

**Pruebas**

| Fichero | Responsabilidad |
|---|---|
| `tests/Feature/Facturacion/ComisariatosEnPrefacturaTest.php` | Todo el servidor de este trabajo. |

---

### Task 1: La columna, la tabla de exclusiones y sus modelos

**Files:**
- Create: `database/migrations/2026_10_29_100000_add_servicio_comisariato_id_to_fact_prefactura_renglones_table.php`
- Create: `database/migrations/2026_10_29_110000_create_fact_prefactura_comisariatos_excluidos_table.php`
- Create: `app/Models/FactPrefacturaComisariatoExcluido.php`
- Modify: `app/Models/FactPrefacturaRenglon.php` (el array `$fillable` y una relación)
- Create: `tests/Feature/Facturacion/ComisariatosEnPrefacturaTest.php`

**Interfaces:**
- Produces: la columna `fact_prefactura_renglones.servicio_comisariato_id` (nullable, FK a `servicio_comisariatos`, `nullOnDelete`); la tabla `fact_prefactura_comisariatos_excluidos`; el modelo `FactPrefacturaComisariatoExcluido`; y en el fichero de pruebas los helpers `comisariatoPara()`, `prefacturaDe()` y `proveedorComisariato()`, que las tareas 2 a 5 reutilizan.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tests/Feature/Facturacion/ComisariatosEnPrefacturaTest.php`. Los helpers son los que heredan las tareas siguientes, así que van completos desde ya.

```php
<?php

use App\Models\Aeronave;
use App\Models\FactCategoriaServicio;
use App\Models\FactPrefactura;
use App\Models\FactPrefacturaComisariatoExcluido;
use App\Models\FactServicio;
use App\Models\ServicioComisariato;
use App\Models\User;

/** Un proveedor de comisariato del catalogo, con el margen que de verdad llevan. */
function proveedorComisariato(string $nombre = 'Comisariato_Manny', float $margen = 50, string $ajuste = FactServicio::AJUSTE_NINGUNO): FactServicio
{
    $categoria = FactCategoriaServicio::firstOrCreate(['nombre' => 'Comisariatos'], ['status' => 'A']);

    return FactServicio::create([
        'categoria_servicio_id' => $categoria->id,
        'nombre' => $nombre,
        'precio_unitario' => 0,
        'es_de_tercero' => $margen > 0,
        'margen' => $margen,
        'ajuste_precio' => $ajuste,
        'status' => 'A',
    ]);
}

/** Un comisariato entregado. Solo `user_id`, `fecha_entrega` y `hora_entrega` son obligatorios. */
function comisariatoPara(string $matricula, string $fecha, string $hora, array $cambios = []): ServicioComisariato
{
    return ServicioComisariato::create(array_merge([
        'user_id' => User::factory()->create()->id,
        'matricula' => $matricula,
        'fecha_entrega' => $fecha,
        'hora_entrega' => $hora,
        'fact_servicio_id' => proveedorComisariato()->id,
        'forma_pago' => 'Cargo a la matrícula',
        'subtotal' => 1000,
        'total' => 1160,
        'status' => 'A',
    ], $cambios));
}

/** Una prefactura en borrador de esa matricula, con su ventana de estancia. */
function prefacturaDe(string $matricula, string $llegada, ?string $salida = null): FactPrefactura
{
    $aeronave = Aeronave::firstOrCreate(['matricula' => $matricula]);

    return FactPrefactura::create([
        'aeronave_id' => $aeronave->id,
        'llegada_at' => $llegada,
        'salida_at' => $salida,
        'estado' => FactPrefactura::ESTADO_BORRADOR,
        'status' => 'A',
    ]);
}

test('un renglon puede apuntar al comisariato que lo origino', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00');

    $renglon = $prefactura->renglones()->create([
        'servicio_id' => $comisariato->fact_servicio_id,
        'servicio_comisariato_id' => $comisariato->id,
        'nombre_servicio' => 'Comisariato_Manny',
        'precio_unitario' => 1000,
        'cantidad' => 1,
        'orden' => 1,
    ]);

    expect($renglon->fresh()->servicio_comisariato_id)->toBe($comisariato->id)
        ->and($renglon->fresh()->servicioComisariato->matricula)->toBe('XA-UNO');
});

test('la exclusion es unica por la pareja de prefactura y comisariato', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00');
    $usuario = User::factory()->create();

    FactPrefacturaComisariatoExcluido::create([
        'prefactura_id' => $prefactura->id,
        'servicio_comisariato_id' => $comisariato->id,
        'user_id' => $usuario->id,
    ]);

    expect(fn () => FactPrefacturaComisariatoExcluido::create([
        'prefactura_id' => $prefactura->id,
        'servicio_comisariato_id' => $comisariato->id,
        'user_id' => $usuario->id,
    ]))->toThrow(Illuminate\Database\QueryException::class);
});
```

- [ ] **Step 2: Correrla y verla fallar por la razón correcta**

```bash
TEST_TOKEN=1110 php artisan test tests/Feature/Facturacion/ComisariatosEnPrefacturaTest.php
```

Esperado: FALLA porque no existe la columna ni la tabla (`no such column: servicio_comisariato_id` y `Class "App\Models\FactPrefacturaComisariatoExcluido" not found`).

**Si falla por otra cosa** —por ejemplo porque a `FactPrefactura::create` le falta una columna obligatoria— **arregla el helper antes de seguir**: una roja por la razón equivocada no demuestra nada.

- [ ] **Step 3: La migración de la columna**

```bash
php artisan make:migration add_servicio_comisariato_id_to_fact_prefactura_renglones_table --no-interaction
```

Renombrar al sello `2026_10_29_100000_` y dejarlo así:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * El renglón que nació de un comisariato guarda cuál fue.
 *
 * Es lo ÚNICO que marca un comisariato como ya cobrado: a diferencia de las remisiones, aquí
 * no hay una marca anterior equivalente a `status_prefactura`, así que no hay dos fuentes de
 * verdad que sincronizar.
 *
 * `nullOnDelete` y no `restrict`: si alguien borra el comisariato de Tráfico, el renglón ya
 * cobrado no debe desaparecer de un documento; se queda huérfano y visible.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fact_prefactura_renglones', function (Blueprint $tabla) {
            $tabla->foreignId('servicio_comisariato_id')
                ->nullable()
                ->after('remision_combustible_id')
                ->constrained('servicio_comisariatos')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('fact_prefactura_renglones', function (Blueprint $tabla) {
            $tabla->dropForeign(['servicio_comisariato_id']);
            $tabla->dropColumn('servicio_comisariato_id');
        });
    }
};
```

**Comprueba la longitud del nombre generado** de esa foránea: `fact_prefactura_renglones_servicio_comisariato_id_foreign` son 56 caracteres, por debajo de 64. Verifícalo tú en vez de fiarte de esta cuenta.

- [ ] **Step 4: La migración de la tabla de exclusiones**

```bash
php artisan make:migration create_fact_prefactura_comisariatos_excluidos_table --no-interaction
```

Renombrar al sello `2026_10_29_110000_` y dejarlo así:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La decisión del operador de que ESTE comisariato no va en ESTA prefactura.
 *
 * Sin esto, quitar el renglón libera el comisariato y la siguiente carga de la pantalla
 * —que sincroniza siempre, y eso es deliberado— lo vuelve a meter con su importe.
 *
 * Hermana de `fact_prefactura_remisiones_excluidas`. NO se generalizan en una sola tabla:
 * serían dos conceptos distintos metidos en una abstracción que nadie ha pedido.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_prefactura_comisariatos_excluidos', function (Blueprint $tabla) {
            $tabla->id();
            $tabla->foreignId('prefactura_id')->constrained('fact_prefacturas')->cascadeOnDelete();
            $tabla->foreignId('servicio_comisariato_id')->constrained('servicio_comisariatos')->cascadeOnDelete();
            $tabla->foreignId('user_id')->constrained('users');
            $tabla->timestamps();

            // Nombre explícito y corto: el automático de Laravel pasaría de los 64 caracteres
            // que admite MySQL y la migración fallaría entera. Le pasó a la tabla hermana.
            $tabla->unique(['prefactura_id', 'servicio_comisariato_id'], 'fact_prefactura_comisariato_excluido_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_prefactura_comisariatos_excluidos');
    }
};
```

**Comprueba las tres foráneas generadas.** La más larga, `fact_prefactura_comisariatos_excluidos_servicio_comisariato_id_foreign`, son **69 caracteres y MySQL la rechazaría**. Dale nombre explícito a esa foránea —por ejemplo pasando un segundo argumento a `foreignId(...)->constrained(...)` o declarando el índice aparte— y comprueba que las tres quedan por debajo de 64.

- [ ] **Step 5: El modelo de la exclusión**

`app/Models/FactPrefacturaComisariatoExcluido.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * La decisión del operador de que ESTE comisariato no va en ESTA prefactura.
 *
 * La consulta `ComisariatosFacturables::candidatas()`, que es lo que la sincronización trae
 * sola; el buscador manual NO la consulta, porque excluirlo del automático no es prohibirlo.
 */
class FactPrefacturaComisariatoExcluido extends Model
{
    protected $table = 'fact_prefactura_comisariatos_excluidos';

    protected $fillable = ['prefactura_id', 'servicio_comisariato_id', 'user_id'];

    public function prefactura()
    {
        return $this->belongsTo(FactPrefactura::class, 'prefactura_id');
    }

    public function servicioComisariato()
    {
        return $this->belongsTo(ServicioComisariato::class, 'servicio_comisariato_id');
    }
}
```

- [ ] **Step 6: Abrir la columna en el renglón**

En `app/Models/FactPrefacturaRenglon.php`, añadir `'servicio_comisariato_id'` al array `$fillable`, justo después de `'remision_combustible_id'`, y la relación:

```php
    /** El comisariato que originó este renglón, si nació de uno. */
    public function servicioComisariato(): BelongsTo
    {
        return $this->belongsTo(ServicioComisariato::class, 'servicio_comisariato_id');
    }
```

`BelongsTo` ya está importado en ese fichero; comprueba su `use` antes de añadir otro.

- [ ] **Step 7: Correr las pruebas y verlas pasar**

```bash
TEST_TOKEN=1110 php artisan test tests/Feature/Facturacion/ComisariatosEnPrefacturaTest.php
```

Esperado: 2 pruebas en verde.

- [ ] **Step 8: Commit**

```bash
git add database/migrations app/Models tests/Feature/Facturacion/ComisariatosEnPrefacturaTest.php
git commit -m "feat(facturacion): el renglon puede apuntar al comisariato que lo origino

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: El servicio `ComisariatosFacturables`

**Files:**
- Create: `app/Services/ComisariatosFacturables.php`
- Modify: `tests/Feature/Facturacion/ComisariatosEnPrefacturaTest.php`

**Interfaces:**
- Consumes: los helpers y la columna de la Task 1.
- Produces:
  - `ComisariatosFacturables::candidatas(FactPrefactura $prefactura): Collection` — los libres de la matrícula dentro de la ventana, ordenados por momento.
  - `ComisariatosFacturables::paraElegir(string $matricula, ?int $excluyePrefacturaId = null): Collection` — todos los de la matrícula, cada uno con `tomado_por`, `en_este_documento`, `sin_proveedor` y `sin_importe` puestos.
  - `ComisariatosFacturables::momentoDe(ServicioComisariato $c): Carbon`
  - `ComisariatosFacturables::normalizarMatricula(?string $m): string`
  - `ComisariatosFacturables::excluir(FactPrefactura $p, int $comisariatoId, int $userId): void`
  - `ComisariatosFacturables::revocarExclusion(FactPrefactura $p, int $comisariatoId): void`

**LEE PRIMERO `app/Services/RemisionesFacturables.php`.** Este servicio es su hermano y debe parecerse: misma estructura, mismos nombres de método, misma forma de documentar. Las diferencias, todas deliberadas:

1. **No hay marca vieja.** «Tomado» es solo: existe un renglón que lo referencia en una prefactura con `status = 'A'`. No hay equivalente a `status_prefactura`.
2. **El momento** se compone de `fecha_entrega` y `hora_entrega`. **Ojo con el cast**: el modelo declara `'hora_entrega' => 'datetime:H:i'`, así que al leerla llega como una fecha-hora con el día de HOY. Hay que tomar **solo su parte horaria** y montarla sobre `fecha_entrega`.
3. **La partición de la consulta es la misma** que en remisiones: el filtro por día en SQL y la hora exacta en PHP, porque combinar fecha y hora en SQL pide funciones distintas en MySQL y en sqlite.
4. **`candidatas()` excluye los que no tienen proveedor** (`fact_servicio_id` nulo): sin servicio no hay renglón posible, porque `fact_prefactura_renglones.servicio_id` es NOT NULL.
5. **`candidatas()` NO excluye los de importe 0.** Entran, y la pantalla los marca. Es una decisión del usuario: puede ser una cortesía o un importe que falta por capturar, y eso lo sabe quien factura.

- [ ] **Step 1: Escribir las pruebas que fallan**

Añadir al final del fichero de pruebas:

```php
test('trae los comisariatos de la matricula dentro de la ventana', function () {
    $dentro = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    comisariatoPara('XA-UNO', '2026-10-19', '10:00');        // antes de llegar
    comisariatoPara('XA-UNO', '2026-10-22', '10:00');        // despues de salir
    comisariatoPara('XA-OTRA', '2026-10-20', '10:00');       // otra matricula

    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    expect(App\Services\ComisariatosFacturables::candidatas($prefactura)->pluck('id')->all())
        ->toBe([$dentro->id]);
});

test('los bordes de la ventana entran, el minuto de fuera no', function () {
    $justoAlLlegar = comisariatoPara('XA-UNO', '2026-10-20', '08:00');
    $justoAlSalir = comisariatoPara('XA-UNO', '2026-10-21', '08:00');
    comisariatoPara('XA-UNO', '2026-10-21', '08:01');

    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    expect(App\Services\ComisariatosFacturables::candidatas($prefactura)->pluck('id')->all())
        ->toBe([$justoAlLlegar->id, $justoAlSalir->id]);
});

test('una estancia sin salida llega hasta ahora', function () {
    $ayer = comisariatoPara('XA-UNO', now()->subDay()->toDateString(), '10:00');
    comisariatoPara('XA-UNO', now()->addDay()->toDateString(), '10:00');

    $prefactura = prefacturaDe('XA-UNO', now()->subDays(2)->toDateTimeString());

    expect(App\Services\ComisariatosFacturables::candidatas($prefactura)->pluck('id')->all())
        ->toBe([$ayer->id]);
});

test('un comisariato sin proveedor no se puede cobrar y no es candidato', function () {
    comisariatoPara('XA-UNO', '2026-10-20', '10:00', ['fact_servicio_id' => null]);

    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    expect(App\Services\ComisariatosFacturables::candidatas($prefactura))->toBeEmpty();
});

test('un comisariato de importe cero SI es candidato: lo marca la pantalla, no se descarta', function () {
    $gratis = comisariatoPara('XA-UNO', '2026-10-20', '10:00', ['subtotal' => 0, 'total' => 0]);

    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    expect(App\Services\ComisariatosFacturables::candidatas($prefactura)->pluck('id')->all())
        ->toBe([$gratis->id]);
});

test('un comisariato ya cobrado en una prefactura activa deja de ser candidato', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $otra = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $otra->renglones()->create([
        'servicio_id' => $comisariato->fact_servicio_id,
        'servicio_comisariato_id' => $comisariato->id,
        'nombre_servicio' => 'Comisariato_Manny',
        'precio_unitario' => 1000,
        'cantidad' => 1,
        'orden' => 1,
    ]);

    $nueva = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    expect(App\Services\ComisariatosFacturables::candidatas($nueva))->toBeEmpty();
});

test('descartar la prefactura que lo tenia lo libera, sin tocar sus renglones', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $descartada = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $descartada->renglones()->create([
        'servicio_id' => $comisariato->fact_servicio_id,
        'servicio_comisariato_id' => $comisariato->id,
        'nombre_servicio' => 'Comisariato_Manny',
        'precio_unitario' => 1000,
        'cantidad' => 1,
        'orden' => 1,
    ]);
    $descartada->update(['status' => 'N']);

    $nueva = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    expect(App\Services\ComisariatosFacturables::candidatas($nueva)->pluck('id')->all())
        ->toBe([$comisariato->id]);
});

test('lo excluido a mano no vuelve, y el alta a mano revoca la exclusion', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $usuario = User::factory()->create();

    App\Services\ComisariatosFacturables::excluir($prefactura, $comisariato->id, $usuario->id);
    expect(App\Services\ComisariatosFacturables::candidatas($prefactura))->toBeEmpty();

    App\Services\ComisariatosFacturables::revocarExclusion($prefactura, $comisariato->id);
    expect(App\Services\ComisariatosFacturables::candidatas($prefactura)->pluck('id')->all())
        ->toBe([$comisariato->id]);
});

test('excluir dos veces seguidas el mismo comisariato deja UNA fila: es la misma decision', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $usuario = User::factory()->create();

    App\Services\ComisariatosFacturables::excluir($prefactura, $comisariato->id, $usuario->id);
    App\Services\ComisariatosFacturables::excluir($prefactura, $comisariato->id, $usuario->id);

    expect(App\Models\FactPrefacturaComisariatoExcluido::count())->toBe(1);
});

test('el buscador trae todos los de la matricula, marcados', function () {
    $libre = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $sinProveedor = comisariatoPara('XA-UNO', '2026-10-20', '11:00', ['fact_servicio_id' => null]);
    $sinImporte = comisariatoPara('XA-UNO', '2026-10-20', '12:00', ['subtotal' => 0]);

    $enEste = comisariatoPara('XA-UNO', '2026-10-20', '13:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $prefactura->renglones()->create([
        'servicio_id' => $enEste->fact_servicio_id,
        'servicio_comisariato_id' => $enEste->id,
        'nombre_servicio' => 'Comisariato_Manny',
        'precio_unitario' => 1000,
        'cantidad' => 1,
        'orden' => 1,
    ]);

    $porId = App\Services\ComisariatosFacturables::paraElegir('XA-UNO', $prefactura->id)->keyBy('id');

    expect($porId)->toHaveCount(4)
        ->and($porId[$libre->id]->tomado_por)->toBeNull()
        ->and($porId[$libre->id]->en_este_documento)->toBeFalse()
        ->and($porId[$sinProveedor->id]->sin_proveedor)->toBeTrue()
        ->and($porId[$sinImporte->id]->sin_importe)->toBeTrue()
        ->and($porId[$enEste->id]->en_este_documento)->toBeTrue()
        ->and($porId[$enEste->id]->tomado_por)->toBeNull();
});

test('el buscador dice quien lo tiene cuando es OTRO documento', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $otra = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $otra->renglones()->create([
        'servicio_id' => $comisariato->fact_servicio_id,
        'servicio_comisariato_id' => $comisariato->id,
        'nombre_servicio' => 'Comisariato_Manny',
        'precio_unitario' => 1000,
        'cantidad' => 1,
        'orden' => 1,
    ]);

    $otraPrefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $elegibles = App\Services\ComisariatosFacturables::paraElegir('XA-UNO', $otraPrefactura->id)->keyBy('id');

    expect($elegibles[$comisariato->id]->tomado_por)->not->toBeNull()
        ->and($elegibles[$comisariato->id]->en_este_documento)->toBeFalse();
});

test('la matricula se compara sin distinguir mayusculas ni espacios de sobra', function () {
    $comisariato = comisariatoPara('  xa-uno  ', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    expect(App\Services\ComisariatosFacturables::candidatas($prefactura)->pluck('id')->all())
        ->toBe([$comisariato->id]);
});
```

- [ ] **Step 2: Correrlas y verlas fallar por la razón correcta**

```bash
TEST_TOKEN=1110 php artisan test tests/Feature/Facturacion/ComisariatosEnPrefacturaTest.php
```

Esperado: todas las nuevas fallan con `Class "App\Services\ComisariatosFacturables" not found`.

- [ ] **Step 3: Escribir el servicio**

Crear `app/Services/ComisariatosFacturables.php` calcando la estructura de `RemisionesFacturables`. El esqueleto, con lo que cambia:

```php
<?php

namespace App\Services;

use App\Models\FactPrefactura;
use App\Models\FactPrefacturaComisariatoExcluido;
use App\Models\ServicioComisariato;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Qué comisariatos puede cobrar una prefactura.
 *
 * Hermano de `RemisionesFacturables`, y más simple que él: aquí «tomado» es UNA sola cosa
 * —existe un renglón que lo referencia en una prefactura con `status = 'A'`— porque no hay
 * una marca manual anterior equivalente a `status_prefactura`. Una fuente de verdad, no dos.
 *
 * Como allí, la regla vive en un solo sitio porque la consultan tres caminos: el endpoint que
 * sincroniza, el buscador del modal y la validación del alta a mano.
 */
final class ComisariatosFacturables
{
    /**
     * Los comisariatos LIBRES de la matrícula de la prefactura dentro de su estancia.
     *
     * Excluye los que no tienen proveedor: `fact_prefactura_renglones.servicio_id` es NOT NULL,
     * así que sin servicio no hay renglón posible. NO excluye los de importe 0: esos entran y
     * la pantalla los marca, porque pueden ser una cortesía o un importe que falta por
     * capturar, y eso lo sabe quien factura.
     *
     * @return Collection<int, ServicioComisariato>
     */
    public static function candidatas(FactPrefactura $prefactura): Collection
    {
        $matricula = $prefactura->aeronave?->matricula;

        if ($matricula === null || $prefactura->llegada_at === null) {
            return collect();
        }

        $inicio = Carbon::parse($prefactura->llegada_at);
        $fin = $prefactura->salida_at ? Carbon::parse($prefactura->salida_at) : now();

        if ($fin->lessThan($inicio)) {
            return collect();
        }

        // El filtro por DIA va en SQL y la hora exacta en PHP, igual que en remisiones y por el
        // mismo motivo: combinar fecha y hora en SQL pide `CONCAT`/`timestamp()` en MySQL y
        // `||` en sqlite, y las pruebas corren en sqlite.
        return self::deLaMatricula($matricula)
            ->whereNotNull('fact_servicio_id')
            ->whereBetween('fecha_entrega', [$inicio->toDateString(), $fin->toDateString()])
            ->whereNotExists(self::yaCobradoEnUnaPrefacturaActiva(...))
            ->whereNotExists(fn (QueryBuilder $consulta) => self::excluidoAMano($consulta, $prefactura->id))
            ->orderBy('fecha_entrega')
            ->orderBy('hora_entrega')
            ->orderBy('id')
            ->get()
            ->filter(fn (ServicioComisariato $c) => self::momentoDe($c)->betweenIncluded($inicio, $fin))
            ->values();
    }

    /**
     * Cuándo se entregó.
     *
     * El modelo castea `hora_entrega` como `datetime:H:i`, así que llega como una fecha-hora
     * con el día de HOY. Se toma SOLO su parte horaria y se monta sobre `fecha_entrega`.
     */
    public static function momentoDe(ServicioComisariato $comisariato): Carbon
    {
        return Carbon::parse($comisariato->fecha_entrega)
            ->setTimeFromTimeString($comisariato->hora_entrega?->format('H:i:s') ?: '00:00:00');
    }
}
```

Los demás métodos —`paraElegir()`, `normalizarMatricula()`, `deLaMatricula()`, `renglonesEnPrefacturaActiva()`, `yaCobradoEnUnaPrefacturaActiva()`, `excluidoAMano()`, `excluir()`, `revocarExclusion()`, `estaEnEsteDocumento()`, `quienLoTiene()`— se escriben calcando los de `RemisionesFacturables`, cambiando el modelo, la tabla (`servicio_comisariatos`), la columna del renglón (`r.servicio_comisariato_id`), la tabla de exclusiones y **quitando la rama de `status_prefactura` de `quienLoTiene()`, que aquí no existe**.

En `paraElegir()`, las marcas que pone cada fila son:

```php
                $comisariato->sin_proveedor = $comisariato->fact_servicio_id === null;
                $comisariato->sin_importe = (float) $comisariato->subtotal === 0.0;
                $comisariato->en_este_documento = self::estaEnEsteDocumento($comisariato, $excluyePrefacturaId);
                $comisariato->tomado_por = $comisariato->en_este_documento ? null : self::quienLoTiene($comisariato);
```

- [ ] **Step 4: Correr las pruebas y verlas pasar**

```bash
TEST_TOKEN=1110 php artisan test tests/Feature/Facturacion/ComisariatosEnPrefacturaTest.php
```

Esperado: 14 pruebas en verde.

- [ ] **Step 5: Comprobar que las pruebas muerden**

Muta y confirma que cada una mata algo; restaura el fichero con `git checkout --` después de cada una y dime el texto de las rojas:

1. Quitar `->whereNotNull('fact_servicio_id')` → debe morir la del comisariato sin proveedor.
2. Quitar `->whereNotExists(self::yaCobradoEnUnaPrefacturaActiva(...))` → debe morir la del ya cobrado.
3. Cambiar `betweenIncluded` por `between` → deben morir las de los bordes.
4. Quitar el `upper(trim(...))` de `deLaMatricula()` → debe morir la de mayúsculas y espacios.

**Si alguna sobrevive, esa prueba no vigila lo que dice.** Arréglala antes de seguir.

- [ ] **Step 6: Commit**

```bash
git add app/Services/ComisariatosFacturables.php tests/Feature/Facturacion/ComisariatosEnPrefacturaTest.php
git commit -m "feat(facturacion): que comisariatos puede cobrar una prefactura

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: El constructor del renglón y la sincronización

**Files:**
- Create: `app/Services/RenglonDeComisariato.php`
- Modify: `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php`
- Modify: `routes/api.php`
- Modify: `tests/Feature/Facturacion/ComisariatosEnPrefacturaTest.php`

**Interfaces:**
- Consumes: `ComisariatosFacturables::candidatas()`.
- Produces: `RenglonDeComisariato::atributos(ServicioComisariato $c, int $orden): array`, el **único** sitio que decide qué lleva un renglón de comisariato; y `POST /api/facturacion/prefacturas/{id}/comisariatos/sincronizar`.

**POR QUÉ EXISTE `RenglonDeComisariato`, y no es una floritura.** En el trabajo de remisiones el alta automática y la manual armaban el renglón cada una por su cuenta, y **divergieron en tres campos** (`margen`, `ajuste_precio`, `es_de_tercero`) sin que nadie lo viera hasta la revisión final de rama: el mismo combustible se cobraba distinto según por dónde hubiera entrado. Aquí no puede pasar porque solo hay un sitio donde se decide.

**EL DINERO, y aquí va lo contrario que en combustible.** En las remisiones se forzó `margen` 0, `ajuste_precio` ninguno y `es_de_tercero` false, porque el precio de la remisión era el precio final. **Aquí el margen ES el negocio**: Comexa va al 0 % y los otros cuatro al 50 % con su ajuste propio. El renglón toma `margen`, `ajuste_precio` y `es_de_tercero` **del servicio del comisariato**. Tomarlos en cero cobraría de menos en cuatro de cinco proveedores.

- [ ] **Step 1: Escribir las pruebas que fallan**

```php
test('el renglon de un comisariato toma el margen y el ajuste DEL SERVICIO, no ceros', function () {
    $proveedor = proveedorComisariato('Comisariato_Manny', 50, FactServicio::AJUSTE_MAS_5);
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00', [
        'fact_servicio_id' => $proveedor->id,
        'subtotal' => 1000,
    ]);
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/comisariatos/sincronizar")
        ->assertOk()
        ->assertJsonPath('agregados', 1);

    $renglon = $prefactura->renglones()->whereNotNull('servicio_comisariato_id')->sole();

    // Lo contrario que en combustible, y a proposito: aqui el margen ES el negocio.
    expect((float) $renglon->margen)->toBe(50.0)
        ->and($renglon->ajuste_precio)->toBe(FactServicio::AJUSTE_MAS_5)
        ->and($renglon->es_de_tercero)->toBeTrue()
        ->and((float) $renglon->precio_unitario)->toBe(1000.0)
        ->and($renglon->cantidad)->toBe(1)
        ->and($renglon->servicio_comisariato_id)->toBe($comisariato->id);
});

test('sincronizar dos veces no duplica nada', function () {
    comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $ruta = "/api/facturacion/prefacturas/{$prefactura->id}/comisariatos/sincronizar";
    $this->postJson($ruta)->assertOk()->assertJsonPath('agregados', 1);
    $this->postJson($ruta)->assertOk()->assertJsonPath('agregados', 0);

    expect($prefactura->renglones()->whereNotNull('servicio_comisariato_id')->count())->toBe(1);
});

test('una prefactura cerrada, descartada o reabierta no sincroniza', function (string $campo, string $valor, string $codigo) {
    comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $prefactura->update([$campo => $valor]);

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/comisariatos/sincronizar")
        ->assertStatus(409)
        ->assertJsonPath('codigo', $codigo);

    expect($prefactura->renglones()->count())->toBe(0);
})->with([
    'cerrada' => ['estado', FactPrefactura::ESTADO_CERRADA, 'ya_cerrada'],
    'reabierta' => ['estado', FactPrefactura::ESTADO_REABIERTA, 'reabierta'],
    'descartada' => ['status', 'N', 'ya_descartada'],
]);
```

**El helper `usuarioConSubdepartamento()` ya existe** y lo usan las demás pruebas de facturación; no lo redefinas. **Comprueba los tres códigos de rechazo** leyendo `rechazoRapido()`, `rechazarSiDescartada()` y `rechazarSincronizarSiReabierta()` en el controlador: si no son exactamente esos, usa los reales y dilo en el informe.

- [ ] **Step 2: Correrlas y verlas fallar por la razón correcta**

```bash
TEST_TOKEN=1110 php artisan test tests/Feature/Facturacion/ComisariatosEnPrefacturaTest.php
```

Esperado: las tres fallan con 404, porque la ruta no existe todavía.

- [ ] **Step 3: El constructor del renglón**

`app/Services/RenglonDeComisariato.php`:

```php
<?php

namespace App\Services;

use App\Models\ServicioComisariato;

/**
 * Qué lleva un renglón nacido de un comisariato. EL ÚNICO SITIO donde se decide.
 *
 * Existe por una cicatriz: en el trabajo de remisiones, el alta automática y la manual armaban
 * el renglón cada una por su cuenta y divergieron en `margen`, `ajuste_precio` y
 * `es_de_tercero` sin que nadie lo viera hasta la revisión final. El mismo combustible se
 * cobraba distinto según por dónde hubiera entrado. Con un solo sitio, no pueden separarse.
 *
 * El margen y el ajuste salen DEL SERVICIO, al revés que en combustible. Allí el precio de la
 * remisión era el final y un margen encima lo habría falseado; aquí el margen es el negocio:
 * Comexa al 0 % y los otros cuatro al 50 % con su ajuste. Ponerlos a cero cobraría de menos en
 * cuatro de los cinco proveedores.
 */
final class RenglonDeComisariato
{
    /** @return array<string, mixed> */
    public static function atributos(ServicioComisariato $comisariato, int $orden): array
    {
        $servicio = $comisariato->factServicio;

        return [
            'servicio_id' => $servicio->id,
            'servicio_comisariato_id' => $comisariato->id,
            'nombre_servicio' => $servicio->nombre,
            'precio_unitario' => $comisariato->subtotal,
            'cantidad' => 1,
            'es_de_tercero' => $servicio->es_de_tercero,
            'margen' => $servicio->margen,
            'ajuste_precio' => $servicio->ajuste_precio,
            'orden' => $orden,
        ];
    }
}
```

- [ ] **Step 4: El endpoint que sincroniza**

En `PrefacturaRenglonController`, añadir `sincronizarComisariatos()` calcando `sincronizarRemisiones()`, con dos diferencias:

- **No hay el caso «no hay servicio activo»**: el servicio viaja en cada comisariato (`fact_servicio_id`), y `candidatas()` ya descarta los que no lo tienen. No inventes ese rechazo.
- El renglón se arma con `RenglonDeComisariato::atributos($comisariato, ++$orden)`, no a mano.

Las guardas —`rechazoRapido()`, `rechazarSiDescartada()`, `rechazarSincronizarSiReabierta()`, el `bloquear()` dentro de la transacción— van **exactamente igual** que en su hermano, y en el mismo orden. La bitácora también.

- [ ] **Step 5: La ruta**

En `routes/api.php`, dentro del grupo `subdep:factPrefacturas` y junto a la de remisiones:

```php
        Route::post('/prefacturas/{id}/comisariatos/sincronizar', [PrefacturaRenglonController::class, 'sincronizarComisariatos'])->whereNumber('id');
```

**Hay una prueba guardia que enumera TODAS las rutas de escritura de prefacturas con su subdepartamento** (`tests/Feature/Facturacion/EndpointsPrefacturaTest.php`). Añade la entrada nueva a su array `$esperado`, o la suite se pondrá roja. Esa guardia existe justamente para que nadie añada una ruta sin decidir su permiso.

- [ ] **Step 6: Correr las pruebas y verlas pasar**

```bash
TEST_TOKEN=1110 php artisan test tests/Feature/Facturacion/ComisariatosEnPrefacturaTest.php tests/Feature/Facturacion/EndpointsPrefacturaTest.php
```

- [ ] **Step 7: Commit**

```bash
git add app/Services/RenglonDeComisariato.php app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php routes/api.php tests/
git commit -m "feat(facturacion): la prefactura trae sola los comisariatos de su estancia

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: El alta a mano, el buscador y la exclusión al quitar

**Files:**
- Modify: `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php` (`store()`, `destroy()`, y un `comisariatos()` nuevo)
- Modify: `app/Http/Requests/Facturacion/StoreRenglonRequest.php`
- Modify: `routes/api.php`
- Modify: `tests/Feature/Facturacion/ComisariatosEnPrefacturaTest.php`

**Interfaces:**
- Consumes: `ComisariatosFacturables::paraElegir()`, `::excluir()`, `::revocarExclusion()`, `RenglonDeComisariato::atributos()`.
- Produces: `GET /api/facturacion/prefacturas/{id}/comisariatos`, que devuelve un array de objetos con `id`, `fecha_entrega`, `hora_entrega`, `subtotal`, `forma_pago`, `proveedor` (el nombre del servicio o null), `tomado_por`, `en_este_documento`, `sin_proveedor` y `sin_importe`; y el campo `servicio_comisariato_id` aceptado por el alta de renglones.

- [ ] **Step 1: Escribir las pruebas que fallan**

```php
test('el alta a mano guarda el comisariato elegido con el margen de su servicio', function () {
    $proveedor = proveedorComisariato('Comisariato_Manny', 50, FactServicio::AJUSTE_MAS_5);
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00', ['fact_servicio_id' => $proveedor->id]);
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $proveedor->id,
        'cantidad' => 1,
        'servicio_comisariato_id' => $comisariato->id,
    ])->assertCreated();

    $renglon = $prefactura->renglones()->sole();

    // Identico a lo que habria puesto la via automatica: un solo sitio lo decide.
    expect($renglon->servicio_comisariato_id)->toBe($comisariato->id)
        ->and((float) $renglon->margen)->toBe(50.0)
        ->and($renglon->ajuste_precio)->toBe(FactServicio::AJUSTE_MAS_5);
});

test('el alta a mano rechaza un comisariato de OTRA matricula', function () {
    $ajeno = comisariatoPara('XA-OTRA', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $ajeno->fact_servicio_id,
        'cantidad' => 1,
        'servicio_comisariato_id' => $ajeno->id,
    ])->assertStatus(422)->assertJsonValidationErrors('servicio_comisariato_id');
});

test('el alta a mano rechaza un comisariato sin proveedor', function () {
    $sinProveedor = comisariatoPara('XA-UNO', '2026-10-20', '10:00', ['fact_servicio_id' => null]);
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');
    $otroServicio = proveedorComisariato('Comisariato_Comexa', 0);

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $otroServicio->id,
        'cantidad' => 1,
        'servicio_comisariato_id' => $sinProveedor->id,
    ])->assertStatus(422)->assertJsonValidationErrors('servicio_comisariato_id');
});

test('el mismo comisariato no se cobra dos veces en el mismo documento', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $carga = [
        'servicio_id' => $comisariato->fact_servicio_id,
        'cantidad' => 1,
        'servicio_comisariato_id' => $comisariato->id,
    ];

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", $carga)->assertCreated();
    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", $carga)->assertStatus(422);

    expect($prefactura->renglones()->count())->toBe(1);
});

test('quitar un renglon de comisariato lo excluye, y volver a ponerlo a mano revoca la exclusion', function () {
    $comisariato = comisariatoPara('XA-UNO', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $sincronizar = "/api/facturacion/prefacturas/{$prefactura->id}/comisariatos/sincronizar";
    $this->postJson($sincronizar)->assertOk()->assertJsonPath('agregados', 1);

    $renglon = $prefactura->renglones()->sole();
    $this->deleteJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones/{$renglon->id}")->assertOk();

    // No vuelve solo.
    $this->postJson($sincronizar)->assertOk()->assertJsonPath('agregados', 0);

    // Pero a mano si, y eso revoca la exclusion.
    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $comisariato->fact_servicio_id,
        'cantidad' => 1,
        'servicio_comisariato_id' => $comisariato->id,
    ])->assertCreated();

    expect(App\Models\FactPrefacturaComisariatoExcluido::count())->toBe(0);
});

test('el buscador devuelve los comisariatos de la matricula con sus marcas', function () {
    comisariatoPara('XA-UNO', '2026-10-20', '10:00', ['forma_pago' => 'Efectivo']);
    comisariatoPara('XA-OTRA', '2026-10-20', '10:00');
    $prefactura = prefacturaDe('XA-UNO', '2026-10-20 08:00:00', '2026-10-21 08:00:00');

    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));

    $datos = $this->getJson("/api/facturacion/prefacturas/{$prefactura->id}/comisariatos")
        ->assertOk()
        ->json();

    expect($datos)->toHaveCount(1)
        ->and(array_keys($datos[0]))->toBe([
            'id', 'fecha_entrega', 'hora_entrega', 'subtotal', 'forma_pago',
            'proveedor', 'tomado_por', 'en_este_documento', 'sin_proveedor', 'sin_importe',
        ])
        ->and($datos[0]['forma_pago'])->toBe('Efectivo');
});
```

- [ ] **Step 2: Correrlas y verlas fallar por la razón correcta**

```bash
TEST_TOKEN=1110 php artisan test tests/Feature/Facturacion/ComisariatosEnPrefacturaTest.php
```

Esperado: las de rechazo devuelven 201 en vez de 422 (el campo aún no se valida), la del buscador da 404, y la de la exclusión falla porque el renglón vuelve a entrar.

- [ ] **Step 3: Validar el campo nuevo**

En `StoreRenglonRequest`, añadir la regla de `servicio_comisariato_id`, calcando la de `remision_combustible_id` que ya está ahí. Debe exigir, con `bail`:

1. Que exista y esté activo (`status` A en `servicio_comisariatos`).
2. Que **tenga proveedor** (`fact_servicio_id` no nulo): sin servicio no hay renglón posible.
3. Que su matrícula sea **la de la prefactura**, comparada con `ComisariatosFacturables::normalizarMatricula()`. Usa ese método y no escribas otra normalización: que las dos vías comparen igual es justo lo que evita que diverjan.

Mensajes en español, como los que ya hay en ese fichero.

- [ ] **Step 4: El alta, la baja y el buscador en el controlador**

- En `store()`, cuando venga `servicio_comisariato_id`, el renglón se arma con `RenglonDeComisariato::atributos()` y se llama a `ComisariatosFacturables::revocarExclusion()`. **Dentro de la transacción y después del `bloquear()`**, rechazar si ese comisariato ya tiene renglón en esta misma prefactura.
- En `destroy()`, si el renglón lleva `servicio_comisariato_id`, llamar a `ComisariatosFacturables::excluir()`. Mira cómo lo hace hoy para las remisiones y hazlo igual.
- Añadir `comisariatos(int $id)`, que devuelve `ComisariatosFacturables::paraElegir($matricula, $id)` mapeado a **exactamente** las diez claves que fija la prueba, en ese orden. `proveedor` es el nombre del servicio o null.

- [ ] **Step 5: La ruta del buscador**

Junto a la de remisiones, fuera del grupo de escritura y con `whereNumber('id')`:

```php
    Route::get('/prefacturas/{id}/comisariatos', [PrefacturaRenglonController::class, 'comisariatos'])->whereNumber('id');
```

- [ ] **Step 6: Correr las pruebas y verlas pasar**

```bash
TEST_TOKEN=1110 php artisan test tests/Feature/Facturacion
```

- [ ] **Step 7: Commit**

```bash
git add app/ routes/api.php tests/
git commit -m "feat(facturacion): elegir un comisariato a mano desde el modal

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: La pantalla

**Files:**
- Modify: `resources/js/pages/Facturacion/components/ModalRenglon.tsx`
- Modify: `resources/js/pages/Facturacion/EditorPrefactura.tsx`

**Interfaces:**
- Consumes: `GET /api/facturacion/prefacturas/{id}/comisariatos` y `POST .../comisariatos/sincronizar`.

**LEE PRIMERO cómo lo hace el combustible en esos dos ficheros.** Esta tarea es su calco: el buscador de remisiones dentro del modal y el disparo de la sincronización al cargar el editor. Las diferencias:

1. El buscador aparece al elegir la categoría **Comisariatos** y su servicio.
2. Las marcas son otras: `sin_proveedor` y `sin_importe` en vez de `sin_precio`. Las de `tomado_por` y `en_este_documento` funcionan igual — **`en_este_documento` deshabilita la opción**, y `tomado_por` la deshabilita también (y la marca, para que se vea quién lo tiene). *Corrección de revisión:* este plan decía que `tomado_por` «solo la marca, porque elegir uno tomado por OTRO documento está permitido a propósito». Fue un error heredado de la spec, que lo copió del módulo de remisiones: allí «tomada» tiene dos fuentes y una puede estar marcada sin renglón detrás (el caso que vale rescatar); aquí hay una sola, así que `tomado_por` no nulo siempre es dinero ya cobrándose, y el servidor lo rechaza con 422.
3. **En la tabla de renglones, un renglón de comisariato muestra su forma de pago** tal como está escrita en el registro de Tráfico. Sirve para que quien factura vea de un vistazo cuál quitar, sin que el sistema finja interpretar un campo que nadie ha normalizado.
4. **Los de importe 0 se marcan para revisar**, derivando la marca del propio importe, sin columna nueva.

**Por qué esta tarea no trae el JSX escrito, al contrario que las demás:** el
precedente exacto está en el repositorio y esos dos ficheros han cambiado
varias veces en las últimas semanas. Un bloque de código inventado aquí no
encajaría con el fichero que te vas a encontrar, y seguirlo al pie de la letra
sería peor que leer el original. Lee cómo lo hace el combustible y cálcalo.

- [ ] **Step 1: Medir la línea base**

```bash
npm run build && npx tsc --noEmit
```

Build con 0 y `tsc` con **exactamente 1 error**, el TS1117 de `WalkAroundController.ts`. Anótalo.

- [ ] **Step 2: El buscador en el modal**

Calcar el de remisiones, con las marcas del punto 2. La opción deshabilitada se decide con el **booleano** `en_este_documento`, nunca comparando el texto de `tomado_por`: en remisiones esa comparación de texto fue un defecto que hubo que arreglar.

- [ ] **Step 3: La sincronización al cargar el editor**

Calcar el disparo que ya hace el combustible, con la misma condición: **solo sobre una prefactura en borrador activa**. No sobre cerrada, descartada ni reabierta.

- [ ] **Step 4: La forma de pago y la marca de importe 0 en la tabla**

- [ ] **Step 5: Build y `tsc`**

```bash
npm run build && npx tsc --noEmit
```

Esperado: build 0 y `tsc` con **exactamente 1 error**, el mismo de la línea base. Cualquier error nuevo se arregla antes de seguir.

- [ ] **Step 6: Commit**

```bash
git add resources/js
git commit -m "feat(facturacion): los comisariatos en la pantalla de la prefactura

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: La suite entera, la migración y el navegador

**Files:** ninguno. Esta tarea verifica.

- [ ] **Step 1: La suite entera, en serie**

```bash
TEST_TOKEN=1111 php artisan test
```

**Nunca con `--parallel`.** La línea base de la rama al escribir este plan es **3555 pruebas, 0 fallos**; con las de este trabajo serán más. **Reporta el número real** en vez de ajustar la expectativa. Borra tus discos de prueba al acabar.

- [ ] **Step 2: La migración en la base de desarrollo**

**Pide permiso antes.** `eolo_plus` es la base real del usuario. Con permiso:

```bash
php artisan migrate
```

**Si falla a mitad, NO vuelvas a lanzarla sin mirar**: una migración que revienta puede dejar la tabla creada y sin registrar en `migrations`, y el segundo intento dirá «ya existe». Comprueba el estado antes de tocar nada. Le pasó a la tabla hermana.

- [ ] **Step 3: El navegador**

Tres trampas del entorno, ya medidas. **No las redescubras:**

1. El preview arranca desde `C:\xampp\htdocs\EOLO` (el **PADRE**), así que lee `EOLO\.claude\launch.json`.
2. **Sanctum** solo trata como *stateful* `localhost:3000`, `127.0.0.1:8000` y el host de `APP_URL`. En otro puerto `/api/*` da **401** y las tablas salen vacías. Comprueba si ya hay un servidor en el 8000 antes de levantar otro.
3. `public/hot` apunta a una IP que ya no responde: hay que **apartarlo** y **restaurarlo al terminar**.

Entrar como `Administrador EOLO`, contraseña del seeder `AdminUserSeeder`. Fortify autentica por **`name`**.

**Qué comprobar.** Primero busca en la base, **en solo lectura**, una prefactura en borrador cuya matrícula tenga comisariatos en su ventana. **Si no existe ninguna, dilo y para**: pedir permiso para crear datos es mejor que inventar una comprobación.

1. Al abrir esa prefactura, los comisariatos aparecen solos con el importe y el proveedor correctos.
2. Recargar no los duplica.
3. En el modal, al elegir la categoría Comisariatos y su servicio, sale el buscador con sus marcas.
4. Quitar un renglón de comisariato y recargar: **no vuelve**.

**No cierres ni descartes nada.** Haz una captura.

- [ ] **Step 4: Informe**

Con el recuento real de la suite, los cuatro puntos del navegador uno a uno, la confirmación de que `public/hot` quedó restaurado, y la captura. Si todo salió verde y no tocaste código, **no hay nada que commitear**: dilo en vez de inventarte un commit.

---

## Qué queda fuera, a propósito

- **Normalizar `forma_pago`**, que sigue siendo texto libre con cuatro grafías de lo mismo.
- **Limpiar las seis parejas de matrículas duplicadas.** Es el arreglo de fondo del coste aceptado al emparejar por texto.
- **Cualquier cambio en el módulo de Tráfico.**
- **El seeder del catálogo de Comisariatos.**
- **El `total` del comisariato**, que se teclea aparte del `subtotal` y hoy se contradice con él en varias filas.
