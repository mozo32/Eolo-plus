# Remisiones de combustible en la prefactura — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la prefactura traiga sola las remisiones de combustible de su matrícula dentro de su estancia, y que además se puedan buscar y elegir a mano desde el modal de servicios.

**Architecture:** El enlace es una columna `remision_combustible_id` en el renglón, no en la remisión: así quitar el renglón o descartar la prefactura liberan la remisión sin código de limpieza. Una consulta reutilizable decide qué remisiones son candidatas y cuáles están tomadas, y la usan tanto el endpoint que sincroniza como el buscador del modal.

**Tech Stack:** Laravel 12, PHP 8.2, Pest 3 sobre sqlite, React 19 + TypeScript, MySQL en desarrollo.

**Spec:** `docs/superpowers/specs/2026-10-26-facturacion-remisiones-de-combustible-design.md`

## Global Constraints

- **Rama:** `facturacion`, punta `3a375e4`. Tiene **29 commits sin subir** a `origin/facturacion`; no subas nada.
- **Las pruebas corren EN SERIE:** `php artisan test <ruta>`. **Nunca `--parallel`**: en este proyecto da fallos falsos.
- **Usa un `TEST_TOKEN` fresco** —**990 en adelante**— y borra los `public_test_<n>` y `local_test_<n>` que deje. `TEST_TOKEN` **no** es ejecución en paralelo.
- **Nunca `vendor/bin/pint`, `prettier` ni `npm run lint`.** El último lleva `--fix` y reescribe archivos ajenos.
- **Nunca `git stash`.** Hay tres stashes guardados que no son de este trabajo.
- **Al commitear, añade los archivos POR NOMBRE.** Nunca `git add -A`.
- **La columna se llama `remision_combustible_id`.** `fact_prefactura_renglones` ya tiene una columna `remision`, que es un `varchar` con el número de remisión del **proveedor** y no tiene nada que ver. No las confundas y no uses `remision_id`.
- **El renglón de combustible CONSERVA `concepto = 'combustible'`.** No lo pongas en `null`: `PagosPrefactura` lo consulta para impedir el pago con AVCARD. Nada borra por ese concepto, así que no hay riesgo de que desaparezca.
- **No se toca `app/Services/CargosEstancia.php`.** No participa en esto.
- **No se toca el marcado manual desde Rampa:** `RemisionController::vincularPrefactura`, `status_prefactura` y `folio_orden_venta` se quedan como están, y las 89 marcas existentes se respetan.
- **No hay ejecutor de pruebas de JavaScript.** La evidencia del front es `npx tsc --noEmit` contra una línea base de **1 error preexistente** (TS1117 en el generado `WalkAroundController.ts`) más `npm run build`. **Mide `tsc` DESPUÉS de un build**: entre medias, los archivos generados de Wayfinder dan errores falsos que desaparecen al regenerarse.
- **La base de desarrollo `eolo_plus` es la real del usuario.** Verifica leyendo; no registres ni borres nada.
- La conexión `remota` es de **solo lectura por contrato**.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| **Crear** `database/migrations/2026_10_27_100000_add_remision_combustible_id_to_fact_prefactura_renglones_table.php` | La columna y su clave foránea |
| **Crear** `app/Services/RemisionesFacturables.php` | La única consulta que decide qué remisiones son candidatas y cuáles están tomadas |
| **Crear** `tests/Feature/Facturacion/RemisionesDeCombustibleTest.php` | Las pruebas del servicio y del endpoint |
| **Modificar** `app/Models/FactPrefacturaRenglon.php` | `remision_combustible_id` en `$fillable` |
| **Modificar** `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php` | El endpoint que sincroniza, y aceptar la remisión al agregar a mano |
| **Modificar** `app/Http/Requests/Facturacion/StoreRenglonRequest.php` | El campo nuevo y su validación |
| **Modificar** `routes/api.php` | Las dos rutas nuevas |
| **Modificar** `resources/js/stores/apiFacturacionCatalogos.ts` | Cliente de las dos rutas |
| **Modificar** `resources/js/pages/Facturacion/EditorPrefactura.tsx` | Llamar a sincronizar al cargar y tras guardar la salida; el aviso |
| **Modificar** `resources/js/pages/Facturacion/components/ModalRenglon.tsx` | El buscador de remisiones |

`RemisionesFacturables` existe para que la regla de «candidata» y «tomada» esté escrita **una sola vez**: la usan el endpoint que sincroniza, el buscador y la validación del alta manual. Si viviera en el controlador, las tres copias se desalinearían.

Cuatro tareas: el servicio con su consulta, el endpoint que sincroniza, el alta manual, y la pantalla.

---

### Task 1: La consulta que decide qué remisiones entran

**Files:**
- Create: `database/migrations/2026_10_27_100000_add_remision_combustible_id_to_fact_prefactura_renglones_table.php`
- Create: `app/Services/RemisionesFacturables.php`
- Create: `tests/Feature/Facturacion/RemisionesDeCombustibleTest.php`
- Modify: `app/Models/FactPrefacturaRenglon.php`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: la clase `App\Services\RemisionesFacturables` con tres métodos públicos estáticos:
  - `candidatas(FactPrefactura $prefactura): Collection` — las remisiones **libres** de esa matrícula dentro de la ventana, ordenadas por fecha y hora. Es lo que agrega la sincronización.
  - `paraElegir(string $matricula, ?int $excluyePrefacturaId = null): Collection` — las remisiones de esa matrícula para el buscador manual, **con** las tomadas y las sin precio, cada una con dos atributos añadidos: `tomada_por` (string|null) y `sin_precio` (bool).
  - `momentoDe(Remision $remision): Carbon` — cuándo empezó la carga: su `fecha` con su `hora_inicial`, y las 00:00 de su día si no la tiene. La usa también la Task 2 para el aviso de fuera de ventana.

  Las Tasks 2, 3 y 4 los consumen.
- Produces: la columna `fact_prefactura_renglones.remision_combustible_id`, bigint unsigned nullable con FK a `remisiones.id`.

**Contexto que el implementador necesita:**

`remisiones` tiene estas columnas relevantes: `id` (bigint unsigned), `folio` (único en las 330, nunca vacío), `fecha` (date, NOT NULL), `hora_inicial` (time, **nullable** aunque hoy esté en las 330), `matricula` (varchar 255), `total_litros` (decimal 12,2 NOT NULL), `precio` (decimal 15,4 **nullable**), `status` (char 1: 'A' o 'N'), `status_prefactura` (boolean), `folio_orden_venta` (varchar nullable).

El modelo es `App\Models\Remision`, tabla `remisiones`, con `status_prefactura` casteado a boolean.

`fact_prefacturas` tiene `aeronave_id`, `llegada_at`, `salida_at` (nullable), `estado` ('borrador' o cerrada), `status` ('A' activa, 'N' descartada). La matrícula se llega por `aeronaves.matricula` desde `aeronave_id`.

**Descartar una prefactura solo pone `status = 'N'` y DEJA SUS RENGLONES EN PIE** — medido: 78 renglones vivos en 13 prefacturas descartadas. Por eso la consulta de «tomada» filtra por el estado de la prefactura y no por la existencia del renglón.

- [ ] **Step 1: La migración**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * El enlace entre un renglón de combustible y la remisión de la que nació.
 *
 * Vive aquí y no en `remisiones` a propósito: quitar el renglón o descartar la prefactura
 * liberan la remisión sin que nadie tenga que acordarse de limpiar nada. Si el enlace
 * estuviera del otro lado, cada sitio que lo olvidara dejaría una remisión bloqueada para
 * siempre sin que nadie supiera por qué.
 *
 * OJO con el nombre: esta tabla YA tiene una columna `remision`, un varchar con el número
 * de remisión del PROVEEDOR que se captura a mano. No es esto.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fact_prefactura_renglones', function (Blueprint $table) {
            $table->foreignId('remision_combustible_id')
                ->nullable()
                ->after('remision')
                ->constrained('remisiones')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('fact_prefactura_renglones', function (Blueprint $table) {
            $table->dropConstrainedForeignId('remision_combustible_id');
        });
    }
};
```

`nullOnDelete` y no `cascadeOnDelete`: si alguien borrara una remisión, el renglón ya cobrado no debe desaparecer del documento.

- [ ] **Step 2: La columna en el modelo**

En `app/Models/FactPrefacturaRenglon.php`, añade `'remision_combustible_id'` al final de `$fillable`, después de `'grupo'`.

- [ ] **Step 3: Escribir las pruebas, todas antes del servicio**

Crea `tests/Feature/Facturacion/RemisionesDeCombustibleTest.php`:

```php
<?php

use App\Models\Aeronave;
use App\Models\FactAeronave;
use App\Models\FactPrefactura;
use App\Models\FactPrefacturaRenglon;
use App\Models\FactServicio;
use App\Models\Remision;
use App\Models\User;
use App\Services\RemisionesFacturables;

/*
 * El combustible se despacha en Rampa y se anota en una remision; la prefactura se captura en
 * Facturacion. Estas pruebas fijan QUE remisiones entran en una prefactura y cuales no.
 *
 * La regla de «tomada» tiene dos mitades: la marca manual que Rampa ya pone
 * (`status_prefactura`), y la existencia de un renglon que la referencia en una prefactura
 * ACTIVA. La segunda mitad es la que hace que no haya contabilidad manual: quitar el renglon o
 * descartar la prefactura liberan la remision solos.
 */

/** Una prefactura en borrador de una matricula nueva, con la llegada indicada y sin salida. */
function prefacturaConMatricula(string $llegada, ?string $salida = null): FactPrefactura
{
    $aeronave = Aeronave::create(['matricula' => matriculaDePrueba()]);
    FactAeronave::create(['aeronave_id' => $aeronave->id, 'estatus' => FactAeronave::ESTATUS_TRANSITO]);

    return FactPrefactura::create([
        'aeronave_id' => $aeronave->id,
        'estado' => FactPrefactura::ESTADO_BORRADOR,
        'tipo_destino' => FactPrefactura::DESTINO_NACIONAL,
        'llegada_at' => $llegada,
        'salida_at' => $salida,
        'user_id' => User::factory()->create()->id,
    ]);
}

/** Una remision de combustible de esa matricula, en esa fecha y hora. */
function remisionDe(FactPrefactura $prefactura, string $fecha, string $horaInicial, array $extra = []): Remision
{
    static $contador = 0;

    return Remision::create(array_merge([
        'folio' => 'EOLO-'.(9000 + ++$contador),
        'fecha' => $fecha,
        'hora_inicial' => $horaInicial,
        'hora_llegada' => $horaInicial,
        'matricula' => $prefactura->aeronave->matricula,
        'total_litros' => 2650.00,
        'precio' => 25.9940,
        'status' => 'A',
        'status_prefactura' => false,
    ], $extra));
}

/** El servicio 7 del catalogo, que es el unico de combustible. */
function servicioDeCombustible(): FactServicio
{
    return FactServicio::firstOrCreate(
        ['concepto' => FactServicio::CONCEPTO_COMBUSTIBLE],
        ['nombre' => 'Combustible JET A-1', 'precio_unitario' => 25.9940],
    );
}

/** Mete la remision en la prefactura como lo hara el codigo de verdad. */
function renglonDeRemision(FactPrefactura $prefactura, Remision $remision): FactPrefacturaRenglon
{
    return $prefactura->renglones()->create([
        'servicio_id' => servicioDeCombustible()->id,
        'remision_combustible_id' => $remision->id,
        'nombre_servicio' => 'Combustible JET A-1 — '.$remision->folio,
        'precio_unitario' => $remision->precio,
        'cantidad' => (int) $remision->total_litros,
        'es_de_tercero' => false,
        'margen' => 0,
        'ajuste_precio' => FactServicio::AJUSTE_NINGUNO,
        'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE,
        'orden' => 1,
    ]);
}

// ---------------------------------------------------------------------------
// candidatas(): lo que entra solo
// ---------------------------------------------------------------------------

test('una remision de la matricula dentro de la ventana es candidata', function () {
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:30:00');

    expect(RemisionesFacturables::candidatas($prefactura)->pluck('id')->all())->toBe([$remision->id]);
});

test('sin salida la ventana llega hasta ahora', function () {
    // Es el caso normal: 16 de 27 prefacturas no tienen salida cuando se capturan.
    $prefactura = prefacturaConMatricula(now()->subDay()->format('Y-m-d H:i:s'));
    $remision = remisionDe($prefactura, now()->format('Y-m-d'), now()->subHour()->format('H:i:s'));

    expect(RemisionesFacturables::candidatas($prefactura)->pluck('id')->all())->toBe([$remision->id]);
});

test('no son candidatas las de otra matricula, ni las de antes de la llegada, ni las de despues de la salida', function () {
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');

    $otra = remisionDe($prefactura, '2026-10-20', '10:00:00', ['matricula' => 'XB-OTRA']);
    $antes = remisionDe($prefactura, '2026-10-20', '07:59:00');
    $despues = remisionDe($prefactura, '2026-10-20', '18:01:00');
    $dentro = remisionDe($prefactura, '2026-10-20', '12:00:00');

    expect(RemisionesFacturables::candidatas($prefactura)->pluck('id')->all())->toBe([$dentro->id])
        ->and([$otra->id, $antes->id, $despues->id])->not->toContain($dentro->id);
});

test('los extremos de la ventana SI entran', function () {
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $alEmpezar = remisionDe($prefactura, '2026-10-20', '08:00:00');
    $alTerminar = remisionDe($prefactura, '2026-10-20', '18:00:00');

    expect(RemisionesFacturables::candidatas($prefactura)->pluck('id')->all())
        ->toBe([$alEmpezar->id, $alTerminar->id]);
});

test('no es candidata una remision dada de baja', function () {
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    remisionDe($prefactura, '2026-10-20', '10:00:00', ['status' => 'N']);

    expect(RemisionesFacturables::candidatas($prefactura))->toHaveCount(0);
});

test('no es candidata una remision sin precio', function () {
    // Las 88 sin precio son todas anteriores al 2026-05-13: cobrarlas al precio de hoy seria
    // inventar una cifra.
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    remisionDe($prefactura, '2026-10-20', '10:00:00', ['precio' => null]);

    expect(RemisionesFacturables::candidatas($prefactura))->toHaveCount(0);
});

test('no es candidata una remision ya marcada desde Rampa', function () {
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    remisionDe($prefactura, '2026-10-20', '10:00:00', ['status_prefactura' => true, 'folio_orden_venta' => 'OV-123']);

    expect(RemisionesFacturables::candidatas($prefactura))->toHaveCount(0);
});

test('una remision sin hora_inicial cuenta como las 00:00 de su fecha', function () {
    // La columna admite nulo aunque hoy las 330 la tengan.
    $prefactura = prefacturaConMatricula('2026-10-20 00:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00', ['hora_inicial' => null]);

    expect(RemisionesFacturables::candidatas($prefactura)->pluck('id')->all())->toBe([$remision->id]);
});

// ---------------------------------------------------------------------------
// Lo que libera una remision: es el nucleo del diseño
// ---------------------------------------------------------------------------

test('una remision usada por otra prefactura ACTIVA no es candidata', function () {
    $primera = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($primera, '2026-10-20', '10:00:00');
    renglonDeRemision($primera, $remision);

    $segunda = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $segunda->aeronave_id = $primera->aeronave_id;
    $segunda->save();

    expect(RemisionesFacturables::candidatas($segunda->fresh()))->toHaveCount(0);
});

test('DESCARTAR la prefactura que la usaba vuelve a liberar la remision', function () {
    // Descartar solo pone status = 'N' y DEJA los renglones en pie. Si la consulta mirara solo
    // la existencia del renglon, la remision quedaria bloqueada para siempre.
    $primera = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($primera, '2026-10-20', '10:00:00');
    renglonDeRemision($primera, $remision);

    $segunda = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $segunda->aeronave_id = $primera->aeronave_id;
    $segunda->save();

    expect(RemisionesFacturables::candidatas($segunda->fresh()))->toHaveCount(0);

    $primera->update(['status' => FactPrefactura::STATUS_INACTIVO]);

    expect(RemisionesFacturables::candidatas($segunda->fresh())->pluck('id')->all())->toBe([$remision->id]);
});

test('QUITAR el renglon vuelve a liberar la remision', function () {
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00');
    $renglon = renglonDeRemision($prefactura, $remision);

    expect(RemisionesFacturables::candidatas($prefactura->fresh()))->toHaveCount(0);

    $renglon->delete();

    expect(RemisionesFacturables::candidatas($prefactura->fresh())->pluck('id')->all())->toBe([$remision->id]);
});

// ---------------------------------------------------------------------------
// paraElegir(): lo que ve el buscador del modal
// ---------------------------------------------------------------------------

test('el buscador SI devuelve las tomadas y las sin precio, marcadas', function () {
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $libre = remisionDe($prefactura, '2026-10-20', '09:00:00');
    $sinPrecio = remisionDe($prefactura, '2026-10-20', '10:00:00', ['precio' => null]);
    $deRampa = remisionDe($prefactura, '2026-10-20', '11:00:00', ['status_prefactura' => true, 'folio_orden_venta' => 'OV-123']);

    $lista = RemisionesFacturables::paraElegir($prefactura->aeronave->matricula)->keyBy('id');

    expect($lista->get($libre->id)->tomada_por)->toBeNull()
        ->and($lista->get($libre->id)->sin_precio)->toBeFalse()
        ->and($lista->get($sinPrecio->id)->sin_precio)->toBeTrue()
        ->and($lista->get($deRampa->id)->tomada_por)->toBe('OV-123');
});

test('el buscador NO acota por ventana: devuelve todas las de la matricula', function () {
    // El buscador manual es para los casos que la automatica no cubre, asi que acotar por la
    // ventana lo dejaria sin su razon de ser.
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    remisionDe($prefactura, '2026-01-01', '10:00:00');
    remisionDe($prefactura, '2026-12-31', '10:00:00');

    expect(RemisionesFacturables::paraElegir($prefactura->aeronave->matricula))->toHaveCount(2);
});
```

- [ ] **Step 4: Correr y ver el rojo**

```bash
TEST_TOKEN=990 php artisan test tests/Feature/Facturacion/RemisionesDeCombustibleTest.php
```

Esperado: todas fallan, porque `App\Services\RemisionesFacturables` no existe. Anótalo.

- [ ] **Step 5: El servicio**

Crea `app/Services/RemisionesFacturables.php`:

```php
<?php

namespace App\Services;

use App\Models\FactPrefactura;
use App\Models\Remision;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Qué remisiones de combustible puede cobrar una prefactura.
 *
 * La regla de «tomada» vive aquí y en un solo sitio, porque la consultan tres caminos: el
 * endpoint que sincroniza, el buscador del modal y la validación del alta a mano. Repartida,
 * las tres copias se desalinearían y el síntoma sería cobrar dos veces el mismo combustible.
 *
 * Una remisión está TOMADA si cualquiera de las dos:
 *
 * 1. `status_prefactura = 1`, que es la marca manual que Rampa ya pone desde su propia
 *    pantalla (89 remisiones de 330 lo están hoy).
 * 2. Existe un renglón que la referencia en una prefactura con `status = 'A'`.
 *
 * La segunda mira el estado de la PREFACTURA y no solo la existencia del renglón, y eso es lo
 * que hace que no haya contabilidad manual: descartar una prefactura solo pone `status = 'N'` y
 * deja sus renglones en pie, así que la remisión vuelve a estar libre sola. Quitar el renglón
 * la libera igual.
 */
final class RemisionesFacturables
{
    /**
     * Las remisiones LIBRES de la matrícula de la prefactura dentro de su estancia.
     *
     * Es lo que la sincronización agrega. La ventana va de `llegada_at` al `salida_at` si lo
     * hay y a `now()` si no: al capturar la prefactura casi nunca hay salida todavía.
     *
     * @return Collection<int, Remision>
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

        // El filtro por DIA va en SQL y la hora exacta en PHP. Combinar fecha y hora en SQL
        // pediría `timestamp()`, que es de MySQL y que sqlite —donde corren las pruebas— no
        // tiene; y el resto de facturación no usa SQL crudo en ningún sitio. Con 330 remisiones
        // y 93 matrículas, lo que llega a PHP tras el filtro por día son unas pocas filas.
        return self::deLaMatricula($matricula)
            ->whereNotNull('precio')
            ->whereBetween('fecha', [$inicio->toDateString(), $fin->toDateString()])
            ->where('status_prefactura', false)
            ->whereNotExists(self::yaCobradaEnUnaPrefacturaActiva(...))
            ->orderBy('fecha')
            ->orderBy('hora_inicial')
            ->orderBy('id')
            ->get()
            ->filter(fn (Remision $r) => self::momentoDe($r)->betweenIncluded($inicio, $fin))
            ->values();
    }

    /** Cuándo empezó la carga. Sin `hora_inicial`, cuenta como las 00:00 de su día. */
    public static function momentoDe(Remision $remision): Carbon
    {
        return Carbon::parse($remision->fecha)
            ->setTimeFromTimeString($remision->hora_inicial ?: '00:00:00');
    }

    /**
     * Las remisiones de una matrícula para el buscador del modal: TODAS, con o sin precio y
     * tomadas o no, cada una con `tomada_por` y `sin_precio` puestos.
     *
     * No acota por ventana a propósito: el buscador manual es justo para los casos que la
     * automática no cubre.
     *
     * @return Collection<int, Remision>
     */
    public static function paraElegir(string $matricula, ?int $excluyePrefacturaId = null): Collection
    {
        return self::deLaMatricula($matricula)
            ->orderByDesc('fecha')
            ->orderByDesc('hora_inicial')
            ->orderByDesc('id')
            ->get()
            ->each(function (Remision $remision) use ($excluyePrefacturaId) {
                $remision->sin_precio = $remision->precio === null;
                $remision->tomada_por = self::quienLaTiene($remision, $excluyePrefacturaId);
            });
    }

    /** @return Builder<Remision> */
    private static function deLaMatricula(string $matricula): Builder
    {
        return Remision::query()
            ->where('status', 'A')
            ->whereRaw('upper(trim(matricula)) = ?', [mb_strtoupper(trim($matricula))]);
    }

    private static function yaCobradaEnUnaPrefacturaActiva(\Illuminate\Database\Query\Builder $consulta): void
    {
        $consulta->select(DB::raw(1))
            ->from('fact_prefactura_renglones as r')
            ->join('fact_prefacturas as p', 'p.id', '=', 'r.prefactura_id')
            ->whereColumn('r.remision_combustible_id', 'remisiones.id')
            ->where('p.status', 'A');
    }

    /** El documento que ya la tiene, o null si está libre. */
    private static function quienLaTiene(Remision $remision, ?int $excluyePrefacturaId): ?string
    {
        if ($remision->status_prefactura) {
            return $remision->folio_orden_venta ?: 'otro documento';
        }

        $renglon = DB::table('fact_prefactura_renglones as r')
            ->join('fact_prefacturas as p', 'p.id', '=', 'r.prefactura_id')
            ->where('r.remision_combustible_id', $remision->id)
            ->where('p.status', 'A')
            ->when($excluyePrefacturaId !== null, fn ($q) => $q->where('p.id', '<>', $excluyePrefacturaId))
            ->select('p.id', 'p.folio')
            ->first();

        if ($renglon === null) {
            return null;
        }

        return $renglon->folio ?: "borrador #{$renglon->id}";
    }
}
```

**Nada de SQL específico de MySQL.** Las pruebas corren sobre **sqlite en memoria** y el desarrollo sobre MySQL, así que la consulta tiene que valer en los dos. `timestamp()`, `CONCAT()` y `DATE_FORMAT()` son de MySQL; el único sitio del repo que las usa es `RelacionOperacionCSAETest.php`, que las emula con `sqliteCreateFunction` **dentro de su propio archivo de pruebas**. No sigas ese camino aquí: el filtro por día en SQL más la hora en PHP no necesita ninguna función, y el resto de facturación no usa `DB::raw` en ningún sitio.

- [ ] **Step 6: Correr y ver el verde**

```bash
TEST_TOKEN=991 php artisan test tests/Feature/Facturacion/RemisionesDeCombustibleTest.php
```

Esperado: **14 pruebas en verde**.

- [ ] **Step 7: Comprobar que las pruebas muerden**

Rompe a propósito, corre solo este archivo, anota qué se pone en rojo y restaura:

1. Quita `->where('p.status', 'A')` de `yaCobradaEnUnaPrefacturaActiva` → debe fallar «DESCARTAR la prefactura que la usaba vuelve a liberar la remision».
2. Quita `->where('status_prefactura', false)` de `candidatas` → debe fallar «no es candidata una remision ya marcada desde Rampa».
3. Cambia `>=` por `>` en el extremo inferior de la ventana → debe fallar «los extremos de la ventana SI entran».

Si alguna no se pone en rojo, para y repórtalo.

- [ ] **Step 8: Commitear**

```bash
rm -rf storage/framework/testing/disks/public_test_990 storage/framework/testing/disks/local_test_990 storage/framework/testing/disks/public_test_991 storage/framework/testing/disks/local_test_991
git add database/migrations/2026_10_27_100000_add_remision_combustible_id_to_fact_prefactura_renglones_table.php app/Services/RemisionesFacturables.php app/Models/FactPrefacturaRenglon.php tests/Feature/Facturacion/RemisionesDeCombustibleTest.php
git commit -m "feat(facturacion): la consulta que decide que remisiones puede cobrar una prefactura"
```

---

### Task 2: El endpoint que sincroniza

**Files:**
- Modify: `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Facturacion/RemisionesDeCombustibleTest.php`

**Interfaces:**
- Consumes: `RemisionesFacturables::candidatas(FactPrefactura $prefactura): Collection` de la Task 1, y la columna `remision_combustible_id`.
- Produces: `POST /api/facturacion/prefacturas/{id}/remisiones/sincronizar`, que devuelve `{"agregados": int, "fuera_de_ventana": [{"renglon_id": int, "folio": string}]}`. La Task 4 lo llama desde el editor.

**Contexto:**

El endpoint **crea renglones**, así que no puede colgar del `GET` que sirve la prefactura: una petición de lectura no escribe y se repetiría en cada recarga.

Es **idempotente por construcción**: una remisión ya puesta en esta prefactura está tomada por su propio renglón, así que `candidatas()` no la vuelve a devolver.

El renglón que crea:

```
servicio_id                el del servicio con concepto `combustible`
remision_combustible_id    el id de la remisión
nombre_servicio            "<nombre del servicio> — <folio de la remisión>"
precio_unitario            el `precio` de la remisión, NO el del catálogo
cantidad                   (int) los `total_litros`
concepto                   'combustible'   (SE CONSERVA)
es_de_tercero              false
margen                     0
ajuste_precio              FactServicio::AJUSTE_NINGUNO
orden                      el siguiente, como hace `store()`
```

Mira cómo `PrefacturaRenglonController::store()` calcula `orden` (`reorder()->max('orden') + 1`), cómo bloquea la prefactura y cómo rechaza las cerradas y descartadas; usa los mismos mecanismos, no inventes otros.

«Fuera de ventana» son los renglones de esta prefactura **con `remision_combustible_id`** cuya remisión **no** cae ya en la ventana actual. No se tocan: solo se reportan.

- [ ] **Step 1: Escribir las pruebas**

Añade al final de `tests/Feature/Facturacion/RemisionesDeCombustibleTest.php`:

```php
// ---------------------------------------------------------------------------
// El endpoint que sincroniza
// ---------------------------------------------------------------------------

test('sincronizar agrega las remisiones de la ventana con el precio de la remision', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00', ['precio' => 30.5, 'total_litros' => 1200]);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")
        ->assertOk()
        ->assertJsonPath('agregados', 1);

    $renglon = FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->sole();

    expect((float) $renglon->precio_unitario)->toBe(30.5)
        ->and($renglon->cantidad)->toBe(1200)
        ->and($renglon->remision_combustible_id)->toBe($remision->id)
        ->and($renglon->nombre_servicio)->toBe('Combustible JET A-1 — '.$remision->folio)
        ->and($renglon->concepto)->toBe(FactServicio::CONCEPTO_COMBUSTIBLE);
});

test('DEFECTO que este trabajo evita: sincronizar dos veces no duplica nada', function () {
    // Es la prueba que define el endpoint. Si `candidatas()` dejara de excluir lo ya cobrado,
    // cada carga de la pantalla anadiria el combustible otra vez.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    remisionDe($prefactura, '2026-10-20', '10:00:00');

    foreach ([1, 2, 3] as $vuelta) {
        $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")->assertOk();
    }

    expect(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->count())->toBe(1);
});

test('el renglon de combustible impide pagar con AVCARD', function () {
    // El concepto se conserva justamente para esto: `PagosPrefactura` lo consulta.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    remisionDe($prefactura, '2026-10-20', '10:00:00');

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")->assertOk();

    expect(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)
        ->where('concepto', FactServicio::CONCEPTO_COMBUSTIBLE)->exists())->toBeTrue();
});

test('sincronizar reporta los renglones que quedaron fuera de la ventana, sin quitarlos', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 23:00:00');
    $tarde = remisionDe($prefactura, '2026-10-20', '20:00:00');

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")
        ->assertOk()->assertJsonPath('agregados', 1);

    // La salida se corrige a una hora anterior: la remision de las 20:00 queda fuera.
    $prefactura->update(['salida_at' => '2026-10-20 18:00:00']);

    $respuesta = $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")->assertOk();

    expect($respuesta->json('agregados'))->toBe(0)
        ->and($respuesta->json('fuera_de_ventana.0.folio'))->toBe($tarde->folio)
        ->and(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->count())->toBe(1);
});

test('una prefactura cerrada no recibe renglones de sincronizar', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    remisionDe($prefactura, '2026-10-20', '10:00:00');
    cerrarConSello($prefactura, '0.00', '0.00', '0.00');

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")
        ->assertStatus(422);

    expect(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->count())->toBe(0);
});

test('sincronizar exige el subdepartamento', function () {
    $this->actingAs(usuarioSinAcceso());
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones/sincronizar")
        ->assertForbidden();
});
```

**Sobre `cerrarConSello()`:** es el ayudante de `tests/Pest.php:278` que cierra una prefactura a mano, sin pasar por el servicio de cierre. Su firma es `cerrarConSello(FactPrefactura $p, string $subtotal, string $iva, string $total, string $tasa = '0.1600', ?User $cierra = null)`; los montos en cero bastan para esta prueba, que solo necesita que la prefactura esté cerrada.

- [ ] **Step 2: Correr y ver el rojo**

```bash
TEST_TOKEN=992 php artisan test tests/Feature/Facturacion/RemisionesDeCombustibleTest.php
```

Esperado: las 14 de la Task 1 pasan y las 6 nuevas fallan con 404, porque la ruta no existe.

- [ ] **Step 3: El método del controlador**

En `PrefacturaRenglonController`, añade `use App\Models\Remision;`, `use App\Services\RemisionesFacturables;` y `use Illuminate\Support\Carbon;` a los `use`, y este método público:

```php
    /**
     * Trae a la prefactura las remisiones de combustible de su matrícula que caen en su estancia.
     *
     * Es IDEMPOTENTE: una remisión ya cobrada aquí está tomada por su propio renglón, así que
     * `candidatas()` no la vuelve a devolver. Llamarlo diez veces deja el mismo resultado que
     * llamarlo una, y por eso el editor puede llamarlo en cada carga sin pensarlo.
     *
     * Solo AÑADE. Las remisiones que quedan fuera de la ventana tras acotarla se reportan para
     * que la pantalla avise, pero el renglón no se toca: nada desaparece solo de un documento
     * de cobro.
     */
    public function sincronizarRemisiones(Request $request, int $id): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazoRapido($prefactura)) {
            return $respuesta;
        }

        $servicio = FactServicio::where('concepto', FactServicio::CONCEPTO_COMBUSTIBLE)->first();

        if ($servicio === null) {
            return response()->json([
                'message' => 'No hay servicio de combustible en el catálogo, así que no hay con qué cobrarlo.',
            ], 422);
        }

        return DB::transaction(function () use ($id, $servicio, $request) {
            $actual = $this->bloquear($id);

            if ($respuesta = $this->rechazarSiDescartada($actual)) {
                return $respuesta;
            }

            $orden = (int) $actual->renglones()->reorder()->max('orden');
            $agregados = 0;

            foreach (RemisionesFacturables::candidatas($actual) as $remision) {
                $actual->renglones()->create([
                    'servicio_id' => $servicio->id,
                    'remision_combustible_id' => $remision->id,
                    'nombre_servicio' => "{$servicio->nombre} — {$remision->folio}",
                    'precio_unitario' => $remision->precio,
                    'cantidad' => (int) $remision->total_litros,
                    'es_de_tercero' => false,
                    'margen' => 0,
                    'ajuste_precio' => FactServicio::AJUSTE_NINGUNO,
                    'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE,
                    'orden' => ++$orden,
                ]);

                $agregados++;
            }

            if ($agregados > 0) {
                Bitacora::log(
                    modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                    accion: Bitacora::ACCION_CREAR,
                    descripcion: "Se trajeron {$agregados} remisiones de combustible a la prefactura {$actual->id}.",
                    usuarioId: $request->user()->id,
                    registroId: $actual->id,
                );
            }

            return response()->json([
                'agregados' => $agregados,
                'fuera_de_ventana' => $this->remisionesFueraDeVentana($actual),
            ]);
        });
    }

    /**
     * Los renglones de remisión de esta prefactura cuya remisión ya no cae en su ventana.
     *
     * Solo para avisar. Pasa cuando la salida se corrige a una hora anterior a una carga que ya
     * estaba cobrada.
     *
     * @return array<int, array{renglon_id: int, folio: string}>
     */
    private function remisionesFueraDeVentana(FactPrefactura $prefactura): array
    {
        $renglones = $prefactura->renglones()->whereNotNull('remision_combustible_id')->get();

        if ($renglones->isEmpty()) {
            return [];
        }

        // Una sola consulta para todas: buscarlas de una en una dentro del filtro seria N+1.
        $remisiones = Remision::whereKey($renglones->pluck('remision_combustible_id'))->get()->keyBy('id');

        $inicio = Carbon::parse($prefactura->llegada_at);
        $fin = $prefactura->salida_at ? Carbon::parse($prefactura->salida_at) : now();

        return $renglones
            ->filter(function ($renglon) use ($remisiones, $inicio, $fin) {
                $remision = $remisiones->get($renglon->remision_combustible_id);

                return $remision !== null
                    && ! RemisionesFacturables::momentoDe($remision)->betweenIncluded($inicio, $fin);
            })
            ->map(fn ($renglon) => [
                'renglon_id' => $renglon->id,
                'folio' => $remisiones->get($renglon->remision_combustible_id)->folio,
            ])
            ->values()
            ->all();
    }
```

Si `Bitacora`, `MODULO_FACTURACION_PREFACTURAS` o `ACCION_CREAR` no se llaman exactamente así, mira cómo lo hace `store()` en ese mismo archivo y copia su forma.

- [ ] **Step 4: La ruta**

En `routes/api.php`, dentro del grupo que ya protege la escritura de renglones con `subdep:factPrefacturas` —el mismo donde viven `POST /prefacturas/{id}/renglones` y `PATCH /prefacturas/{id}/estancia`—, añade:

```php
        Route::post('/prefacturas/{id}/remisiones/sincronizar', [PrefacturaRenglonController::class, 'sincronizarRemisiones'])->whereNumber('id');
```

- [ ] **Step 5: Correr y ver el verde**

```bash
TEST_TOKEN=993 php artisan test tests/Feature/Facturacion/RemisionesDeCombustibleTest.php
```

Esperado: **20 pruebas en verde**.

- [ ] **Step 6: Comprobar que las pruebas muerden**

1. En `sincronizarRemisiones`, quita el filtro de ya-cobradas llamando a una consulta sin `whereNotExists` → debe fallar la del doble conteo («sincronizar dos veces no duplica nada»).
2. Cambia `'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE` por `null` → debe fallar la de AVCARD.
3. Haz que `remisionesFueraDeVentana` devuelva siempre `[]` → debe fallar la del aviso.

Restaura después de cada una y verifica que el archivo quedó idéntico.

- [ ] **Step 7: Commitear**

```bash
rm -rf storage/framework/testing/disks/public_test_992 storage/framework/testing/disks/local_test_992 storage/framework/testing/disks/public_test_993 storage/framework/testing/disks/local_test_993
git add app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php routes/api.php tests/Feature/Facturacion/RemisionesDeCombustibleTest.php
git commit -m "feat(facturacion): endpoint idempotente que trae las remisiones de combustible"
```

---

### Task 3: Elegir una remisión a mano

**Files:**
- Modify: `app/Http/Requests/Facturacion/StoreRenglonRequest.php`
- Modify: `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Facturacion/RemisionesDeCombustibleTest.php`

**Interfaces:**
- Consumes: `RemisionesFacturables::paraElegir(string $matricula, ?int $excluyePrefacturaId = null): Collection` de la Task 1.
- Produces: dos cosas que usa la Task 4:
  - `GET /api/facturacion/prefacturas/{id}/remisiones?q=<matricula>` → `{"remisiones": [{id, folio, fecha, hora_inicial, total_litros, precio, tomada_por, sin_precio}]}`
  - `POST /prefacturas/{id}/renglones` acepta `remision_combustible_id` (int|null), que solo vale con el servicio de combustible.

**Contexto:**

`StoreRenglonRequest` ya tiene un campo opcional del mismo corte, `aeronave_id`, que solo vale para los tres tramos de tránsito y se valida con una regla de closure `soloParaTransito`. **Lee cómo está hecho y sigue ese patrón exactamente**: `bail`, `nullable`, `integer`, `Rule::exists`, y una closure que rechaza el campo cuando el servicio no corresponde.

La diferencia con el tránsito: una remisión **tomada sí se puede elegir** a mano, que es lo que decidió el usuario. Solo se rechaza la que **no tiene precio**.

- [ ] **Step 1: Escribir las pruebas**

Añade al final del archivo de pruebas:

```php
// ---------------------------------------------------------------------------
// Elegir una remision a mano
// ---------------------------------------------------------------------------

test('el buscador del modal devuelve las remisiones de la matricula con sus marcas', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $libre = remisionDe($prefactura, '2026-10-20', '09:00:00');
    $deRampa = remisionDe($prefactura, '2026-10-20', '11:00:00', ['status_prefactura' => true, 'folio_orden_venta' => 'OV-123']);

    $respuesta = $this->getJson("/api/facturacion/prefacturas/{$prefactura->id}/remisiones?q=".$prefactura->aeronave->matricula)
        ->assertOk();

    $porId = collect($respuesta->json('remisiones'))->keyBy('id');

    expect($porId->get($libre->id)['tomada_por'])->toBeNull()
        ->and($porId->get($deRampa->id)['tomada_por'])->toBe('OV-123');
});

test('se puede agregar a mano una remision YA tomada, que es lo decidido', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $servicio = servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00', ['status_prefactura' => true, 'folio_orden_venta' => 'OV-123']);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
        'remision_combustible_id' => $remision->id,
    ])->assertCreated();

    $renglon = FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->sole();

    expect($renglon->remision_combustible_id)->toBe($remision->id)
        ->and((float) $renglon->precio_unitario)->toBe(25.994)
        ->and($renglon->cantidad)->toBe(2650);
});

test('la cantidad y el precio los pone la remision, no lo que mande el cliente', function () {
    // Si el cliente pudiera fijar la cantidad, un error de tecleo cobraria litros que no se
    // cargaron. Los litros son un hecho de la remision.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $servicio = servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00', ['total_litros' => 777, 'precio' => 31.25]);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
        'remision_combustible_id' => $remision->id,
    ])->assertCreated();

    $renglon = FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->sole();

    expect($renglon->cantidad)->toBe(777)
        ->and((float) $renglon->precio_unitario)->toBe(31.25);
});

test('no se puede agregar una remision sin precio', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $servicio = servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00', ['precio' => null]);

    $respuesta = $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
        'remision_combustible_id' => $remision->id,
    ])->assertStatus(422);

    expect($respuesta->json('errors.remision_combustible_id.0'))->toContain('precio')
        ->and(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->count())->toBe(0);
});

test('remision_combustible_id en un servicio que no es combustible se rechaza', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');
    $remision = remisionDe($prefactura, '2026-10-20', '10:00:00');
    $normal = FactServicio::create(['nombre' => 'Remolque', 'precio_unitario' => 867.87]);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $normal->id,
        'cantidad' => 1,
        'remision_combustible_id' => $remision->id,
    ])->assertStatus(422)->assertJsonValidationErrors(['remision_combustible_id']);
});

test('el servicio de combustible SIN remision se sigue agregando como siempre', function () {
    // No regresion: el combustible tambien se puede cobrar a mano sin remision, al precio del
    // catalogo, como antes de este trabajo.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $servicio = servicioDeCombustible();
    $prefactura = prefacturaConMatricula('2026-10-20 08:00:00', '2026-10-20 18:00:00');

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 500,
    ])->assertCreated();

    $renglon = FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->sole();

    expect($renglon->remision_combustible_id)->toBeNull()
        ->and($renglon->cantidad)->toBe(500)
        ->and((float) $renglon->precio_unitario)->toBe(25.994);
});
```

- [ ] **Step 2: Correr y ver el rojo**

```bash
TEST_TOKEN=994 php artisan test tests/Feature/Facturacion/RemisionesDeCombustibleTest.php
```

Esperado: las 20 anteriores pasan; de las 6 nuevas fallan las que mandan `remision_combustible_id` o piden el buscador. La última, la de no regresión, debería pasar ya.

- [ ] **Step 3: La validación**

En `StoreRenglonRequest`, añade a `rules()`, junto a `aeronave_id`:

```php
            'remision_combustible_id' => ['bail', 'nullable', 'integer', Rule::exists('remisiones', 'id'), $this->soloParaCombustible(...)],
```

y el método privado, junto a `soloParaTransito`:

```php
    /** La remisión solo tiene sentido en el servicio de combustible, y solo si tiene precio. */
    private function soloParaCombustible(string $atributo, mixed $valor, \Closure $fallar): void
    {
        $esCombustible = FactServicio::query()
            ->whereKey($this->input('servicio_id'))
            ->where('concepto', FactServicio::CONCEPTO_COMBUSTIBLE)
            ->exists();

        if (! $esCombustible) {
            $fallar('La remisión solo se indica al cobrar combustible.');

            return;
        }

        if (\App\Models\Remision::whereKey($valor)->whereNull('precio')->exists()) {
            $fallar('Esa remisión no tiene precio registrado, así que no hay nada que cobrar. Captúralo en Rampa primero.');
        }
    }
```

Y a `messages()`:

```php
            'remision_combustible_id.integer' => 'La remisión no es válida.',
            'remision_combustible_id.exists' => 'Esa remisión no está en el sistema.',
```

- [ ] **Step 4: El alta en el controlador**

En `store()`, después de resolver `$ajena` (el tránsito de otra aeronave), añade:

```php
        // El combustible nacido de una remisión toma de ella su precio y sus litros: el precio
        // del catálogo es el vigente, y una carga de hace un mes no se recobra al de hoy.
        $remision = null;

        if ($request->validated()['remision_combustible_id'] ?? null) {
            $remision = Remision::findOrFail($request->validated()['remision_combustible_id']);
        }
```

Añádelo al `use (...)` del closure de la transacción, y en el `create([...])` del renglón:

```php
                'nombre_servicio' => $remision !== null ? "{$servicio->nombre} — {$remision->folio}" : ($ajena === null ? $servicio->nombre : $ajena['nombre']),
                'precio_unitario' => $remision !== null ? $remision->precio : ($ajena === null ? $servicio->precio_unitario : $ajena['precio']),
                'cantidad' => $remision !== null ? (int) $remision->total_litros : $request->validated()['cantidad'],
                'remision_combustible_id' => $remision?->id,
```

Las demás líneas del `create` no cambian.

**Que la cantidad la ponga la remisión y no el cliente es deliberado:** los litros son un hecho de la carga, y dejar que el navegador los fije convertiría un error de tecleo en litros cobrados que nunca se despacharon.

- [ ] **Step 5: El buscador**

Añade al controlador:

```php
    /** Las remisiones de una matrícula para el buscador del modal, con sus marcas. */
    public function remisiones(Request $request, int $id): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);
        $matricula = trim((string) $request->query('q', ''));

        if ($matricula === '') {
            $matricula = (string) $prefactura->aeronave?->matricula;
        }

        if ($matricula === '') {
            return response()->json(['remisiones' => []]);
        }

        $remisiones = RemisionesFacturables::paraElegir($matricula, $prefactura->id)
            ->map(fn (Remision $r) => [
                'id' => $r->id,
                'folio' => $r->folio,
                'fecha' => $r->fecha,
                'hora_inicial' => $r->hora_inicial,
                'total_litros' => $r->total_litros,
                'precio' => $r->precio,
                'tomada_por' => $r->tomada_por,
                'sin_precio' => $r->sin_precio,
            ])
            ->all();

        return response()->json(['remisiones' => $remisiones]);
    }
```

Y la ruta, **fuera** del grupo de escritura porque es una lectura, junto a los demás `GET` de prefacturas:

```php
    Route::get('/prefacturas/{id}/remisiones', [PrefacturaRenglonController::class, 'remisiones'])->whereNumber('id');
```

- [ ] **Step 6: Correr y ver el verde**

```bash
TEST_TOKEN=995 php artisan test tests/Feature/Facturacion/RemisionesDeCombustibleTest.php
```

Esperado: **26 pruebas en verde**.

- [ ] **Step 7: Comprobar que las pruebas muerden**

1. Haz que `cantidad` venga del cliente en vez de la remisión → debe fallar «la cantidad y el precio los pone la remision».
2. Quita la segunda mitad de `soloParaCombustible`, la del precio → debe fallar «no se puede agregar una remision sin precio».
3. Quita la primera mitad, la del concepto → debe fallar «remision_combustible_id en un servicio que no es combustible».

- [ ] **Step 8: Commitear**

```bash
rm -rf storage/framework/testing/disks/public_test_994 storage/framework/testing/disks/local_test_994 storage/framework/testing/disks/public_test_995 storage/framework/testing/disks/local_test_995
git add app/Http/Requests/Facturacion/StoreRenglonRequest.php app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php routes/api.php tests/Feature/Facturacion/RemisionesDeCombustibleTest.php
git commit -m "feat(facturacion): elegir a mano la remision de combustible de un renglon"
```

---

### Task 4: La pantalla

**Files:**
- Modify: `resources/js/stores/apiFacturacionCatalogos.ts`
- Modify: `resources/js/pages/Facturacion/EditorPrefactura.tsx`
- Modify: `resources/js/pages/Facturacion/components/ModalRenglon.tsx`

**Interfaces:**
- Consumes: `POST /prefacturas/{id}/remisiones/sincronizar` → `{agregados, fuera_de_ventana: [{renglon_id, folio}]}` y `GET /prefacturas/{id}/remisiones?q=` → `{remisiones: [...]}`, los dos de las Tasks 2 y 3, y el campo `remision_combustible_id` del alta.
- Produces: nada que otra tarea use.

**Contexto:**

Esta tarea **no tiene ciclo TDD**: no hay ejecutor de pruebas de JavaScript. Dilo así en el informe en vez de fingir uno.

`ModalRenglon.tsx` ya tiene **dos** patrones que vas a imitar, y los dos funcionan igual: el menú de **Categoría** que deriva de los servicios, y el campo de **matrícula** que aparece solo para los tres tramos de tránsito, con su buscador con retardo de 300 ms y su lista de opciones que conserva la elegida. Haz el buscador de remisiones con esa misma forma y reutiliza lo que puedas.

Hay además una constante `MUESTRA_PROVEEDOR = false` que oculta el campo Proveedor. **No la toques.**

- [ ] **Step 1: Tomar la línea base de tipos**

```bash
npm run build && npx tsc --noEmit > /tmp/tsc.txt 2>&1; grep -c "error TS" /tmp/tsc.txt
```

Esperado: `1`. **Mide después del build**: entre medias los archivos generados de Wayfinder dan errores falsos.

- [ ] **Step 2: El cliente de API**

En `apiFacturacionCatalogos.ts`, junto a los demás métodos de prefactura, añade:

```ts
export type RemisionFacturable = {
    id: number;
    folio: string;
    fecha: string;
    hora_inicial: string | null;
    total_litros: string;
    precio: string | null;
    /** El documento que ya la tiene, o null si está libre. */
    tomada_por: string | null;
    sin_precio: boolean;
};

export type ResultadoSincronizar = {
    agregados: number;
    fuera_de_ventana: { renglon_id: number; folio: string }[];
};
```

y los dos métodos, siguiendo la forma de los que ya hay en ese objeto:

```ts
    sincronizarRemisiones: (id: number) => pedir<ResultadoSincronizar>(`${BASE}/prefacturas/${id}/remisiones/sincronizar`, { method: 'POST' }),
    remisionesDe: (id: number, q: string) => pedir<{ remisiones: RemisionFacturable[] }>(`${BASE}/prefacturas/${id}/remisiones?q=${encodeURIComponent(q)}`),
```

Mira la firma real de `pedir` en ese archivo antes de escribirlo; si el `GET` necesita otra forma, usa la de los demás `GET` de ese mismo objeto.

- [ ] **Step 3: Sincronizar al cargar y tras guardar la salida**

En `EditorPrefactura.tsx`, llama a `sincronizarRemisiones(prefactura.id)` en dos momentos:

1. Al cargar la prefactura, **solo si está en borrador y no descartada** — si es de solo lectura, no se llama.
2. Después de guardar el encabezado, **solo si la `salida_at` cambió** respecto a la que había.

Tras cada llamada, recarga los renglones como ya se hace después de agregar uno, y:

- si `agregados > 0`, muestra un `toast` con «Se trajeron N remisiones de combustible.»
- si `fuera_de_ventana` no está vacío, muestra un aviso persistente —no un toast— encima de la tabla de renglones con los folios: «Estas remisiones quedaron fuera de la estancia: EOLO-9397. Revísalas y quítalas si no corresponden.»

El aviso es de pantalla y no del documento impreso.

- [ ] **Step 4: El buscador en el modal**

En `ModalRenglon.tsx`, con la misma forma que el campo de matrícula:

```ts
const esCombustible = servicio?.concepto === 'combustible';
```

Cuando `esCombustible` sea cierto, aparece un campo **Remisión de combustible** con su buscador por matrícula —arranca con la matrícula de la prefactura, que hay que pasarle al modal como prop nueva— y un `<select>` con los resultados. Cada opción se lee:

- libre: `EOLO-9397 — 20/10/2026 10:00 — 2,650 L a $25.99`
- tomada: lo mismo más ` · ya facturada en OV-123`
- sin precio: lo mismo más ` · sin precio`, y la opción va `disabled`

Elegir una remisión **no** es obligatorio: el combustible se puede seguir cobrando a mano sin ella, al precio del catálogo. Si se elige, la cantidad del formulario deja de usarse —la pone el servidor desde los litros— y conviene deshabilitar ese campo y explicar por qué debajo: «Los litros los pone la remisión.»

Al cambiar de servicio, limpia la remisión elegida, igual que se hace con la matrícula.

`DatosRenglon` gana `remision_combustible_id: number | null`, y `guardar()` lo envía solo cuando `esCombustible`.

- [ ] **Step 5: Comprobar tipos y compilación**

```bash
npm run build && npx tsc --noEmit > /tmp/tsc.txt 2>&1; grep -c "error TS" /tmp/tsc.txt
```

Esperado: el mismo número del Step 1.

- [ ] **Step 6: Revisar cuatro puntos en tu propio diff**

1. Un servicio que no es combustible se comporta exactamente como antes.
2. La sincronización **no** se llama en una prefactura cerrada o descartada.
3. Al cambiar de servicio se limpia la remisión elegida.
4. `MUESTRA_PROVEEDOR`, el menú de Categoría y el campo de matrícula siguen intactos.

- [ ] **Step 7: Commitear**

```bash
git add resources/js/stores/apiFacturacionCatalogos.ts resources/js/pages/Facturacion/EditorPrefactura.tsx resources/js/pages/Facturacion/components/ModalRenglon.tsx
git commit -m "feat(facturacion): la pantalla trae y deja elegir las remisiones de combustible"
```

---

### Task 5: La suite entera y la pantalla de verdad

**Files:** ninguno. Esta tarea verifica.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada.

- [ ] **Step 1: La migración en la base de desarrollo**

```bash
php artisan migrate
```

Es aditiva: una columna nullable con FK. **Confirma que corrió** antes de abrir el navegador, o la pantalla fallará con «columna desconocida».

- [ ] **Step 2: La suite entera, en serie**

Arráncala en segundo plano; tarda unos 16 minutos.

```bash
TEST_TOKEN=996 php artisan test
```

**Nunca con `--parallel`.** Esperado: **3478** pruebas sin fallos — las 3452 de la rama más las 26 nuevas. Si no cuadra, reporta el número real.

Después: `rm -rf storage/framework/testing/disks/public_test_996 storage/framework/testing/disks/local_test_996`

**Si falla algo de `PagosPrefactura`, `CompararPagos` o `CierrePrefactura`, para y repórtalo**: el renglón de combustible toca la regla de AVCARD y ahí es donde se vería.

- [ ] **Step 3: El navegador**

Tres trampas del entorno, las tres medidas. **No las redescubras:**

1. El preview arranca desde `C:\xampp\htdocs\EOLO` (el **PADRE**), así que lee `EOLO\.claude\launch.json`, no el de `Eolo-plus\`.
2. **Sanctum** solo trata como *stateful* `localhost`, `localhost:3000`, `127.0.0.1`, `127.0.0.1:8000`, `::1` y el host de `APP_URL`. En otro puerto `/api/*` da **401** y las tablas salen vacías.
3. `public/hot` apunta a `http://192.168.7.10:5173`, **una IP que ya no responde**. Para ver el bundle hay que **apartarlo** (`mv public/hot public/hot.bak`) y **restaurarlo al terminar**.

Entra como `Administrador EOLO` con la contraseña del seeder `AdminUserSeeder`. Fortify autentica por **`name`**, no por correo.

Busca en la base una matrícula que **tenga remisiones** y, a ser posible, una prefactura suya en borrador con `status = 'A'`. Hay 93 matrículas con remisiones. **Consulta de solo lectura**; no crees prefacturas.

Qué comprobar:

1. Al abrir una prefactura de una matrícula con remisiones en su ventana, los renglones de combustible **aparecen solos**, con el precio de la remisión y los litros como cantidad.
2. **Recargar la pantalla no los duplica.**
3. En el modal, al elegir Combustible & Servicios y su servicio, sale el buscador de remisiones.
4. Una remisión ya tomada sale marcada con el documento, y una sin precio sale marcada y no se puede elegir.

**No agregues ni cierres nada.** La base es la real del usuario. Si algo requiere escribir para probarlo, **pídelo antes**.

Haz una **captura** de la prefactura con los renglones de combustible traídos solos.

- [ ] **Step 4: Informe**

Con el recuento de la suite, los cuatro puntos del navegador uno a uno, la confirmación de que `public/hot` quedó restaurado, y la captura.

Si todo salió verde y no tocaste código, **no hay nada que commitear**: dilo en vez de inventarte un commit.

---

## Qué queda fuera, a propósito

- **Cambiar el marcado manual desde Rampa.** `vincularPrefactura`, `status_prefactura` y `folio_orden_venta` se quedan como están.
- **Escribir `status_prefactura` desde Facturación.** El enlace nuevo es la columna; duplicar la marca obligaría a sincronizar las dos.
- **Ampliar la columna `cantidad`**, que es un entero con tope de 9 999. Hoy la mayor remisión es de 9 129 litros y ninguna tiene decimales.
- **Productos distintos de la turbosina.** Hay uno solo en los 330 registros.
- **`CargosEstancia`**, que no participa: no borra por concepto `combustible`.
