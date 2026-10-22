# Excel mensual del estacionamiento subterráneo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que desde la lista «Registros por Periodo» se pueda descargar, por mes, una rejilla de Excel con una fila por placa y una columna por día, marcando los días que cada vehículo estuvo en el estacionamiento.

**Architecture:** Un endpoint nuevo agrega los registros del mes por placa normalizada y devuelve, por fila, los cinco datos de identificación más la lista de días con registro; el libro se arma en el cliente con ExcelJS, como las otras siete exportaciones del proyecto. La vista previa y la descarga consumen la misma rejilla y la misma lista de columnas fijas.

**Tech Stack:** Laravel 12, PHP 8.2, Pest 3 sobre sqlite, Inertia 2 + React 19 + TypeScript, Tailwind 4, ExcelJS 4.4, file-saver 2.0, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-22-estacionamiento-excel-mensual-design.md`

## Global Constraints

- **Rama base:** `vehiculos-tabla-desactivar`, punta `22b742a`. La rama ya lleva otros dos proyectos terminados; este es independiente de ellos y no toca ninguno de sus archivos.
- **Las pruebas corren EN SERIE:** `php artisan test` o `php artisan test <ruta>`. **Nunca `--parallel`**: en este proyecto da fallos falsos.
- **Hay un directorio atascado** en `storage/framework/testing/disks/public/movimientos-vehiculos/1` que no se puede borrar ni listar. Corre con un `TEST_TOKEN` fresco — **907 en adelante**, que 901 a 906 ya se usaron — y borra el `public_test_<n>` que deje. `TEST_TOKEN` **no** es ejecución en paralelo: solo hace que `Storage::fake` use otro directorio.
- **Nunca correr `vendor/bin/pint` ni `prettier`** sobre archivos preexistentes: reescriben cientos de líneas ajenas al cambio.
- **Nunca correr `npm run lint`**: lleva `--fix` y reescribe archivos ajenos.
- **Nunca usar `git stash`.** Hay tres stashes guardados en este repositorio que no son de este trabajo.
- **No cambies dependencias** ni toques `package.json`. `exceljs`, `file-saver` y `lucide-react` ya están.
- **La conexión `remota` es de solo lectura por contrato.** Este trabajo no la toca.
- **No hay ninguna prueba de JavaScript** en el proyecto. La verificación del front es `npx tsc --noEmit` contra una línea base de **1 error preexistente** (TS1117 en el generado `WalkAroundController.ts`) más `npm run build`.
- **La exportación NO lleva candado de rol y NO deja rastro en bitácora.** Decisiones 9 y 10 de la spec.
- **NO se toca `show()`.** Su defecto de agrupación es real y está medido, pero afecta a la pantalla de detalle y queda fuera de alcance (ver «No entra» en la spec).
- **NO se escribe ni se calcula nada con `fecha_salida`.** Está muerta en los 2 961 registros y así se queda.

---

## Estructura de archivos

**Se crean:**

| Archivo | Responsabilidad |
|---|---|
| `tests/Feature/EstacionamientoSubterraneo/ExcelMensualTest.php` | El endpoint: agrupación, días, bordes del mes, validación |
| `resources/js/pages/seguridad/estacionamientoSubTerraneo/excelEstacionamientoService.ts` | Las columnas fijas, el título del mes y el armado del libro |
| `resources/js/pages/seguridad/estacionamientoSubTerraneo/ModalExcelEstacionamiento.tsx` | El modal: consulta al abrir, vista previa y descarga |

**Se modifican:**

| Archivo | Cambio |
|---|---|
| `app/Http/Controllers/Api/EstacionamientoSubterraneoController.php` | Método `obtenerExcel` |
| `routes/api.php` | Ruta `GET /EstacionamientoSubTerraneo/Excel/{mes}` |
| `resources/js/stores/apiEstacionamientoSubterraneo.ts` | Tipos y `obtenerExcelEstacionamiento` |
| `resources/js/pages/seguridad/estacionamientoSubTerraneo/VehicleDashboard.tsx` | Botón de Excel por mes y montaje del modal |

**Orden de las tareas.** El servidor primero, después las dos piezas de cliente que no son UI, después el modal (completo pero sin montar), y al final el botón, que lo conecta. Ninguna tarea depende de un archivo a medio hacer.

---

### Task 1: El endpoint `GET /api/EstacionamientoSubTerraneo/Excel/{mes}`

**Files:**
- Modify: `app/Http/Controllers/Api/EstacionamientoSubterraneoController.php` (método nuevo después de `show`)
- Modify: `routes/api.php` (grupo `prefix('EstacionamientoSubTerraneo')`)
- Test: `tests/Feature/EstacionamientoSubterraneo/ExcelMensualTest.php`

**Interfaces:**
- Consumes: el modelo `App\Models\EstacionamientoSubterraneo` (tabla `estacionamiento_subterraneos`, `fecha_ingreso` casteada a `datetime`, `user_id` es una clave ajena obligatoria a `users`). El ayudante global de prueba `usuarioAdmin()`, ya en `tests/Pest.php`.
- Produces: `GET /api/EstacionamientoSubTerraneo/Excel/{mes}` con `{mes}` en formato `YYYY-MM`. Devuelve `{ mes: string, dias: int, filas: [...] }` donde cada fila tiene **exactamente** `placas`, `vehiculo`, `color`, `matricula`, `responsable`, `dias` (arreglo de enteros) y `total` (entero). Las tareas 2, 3 y 4 dependen de esos nombres.

**Contexto que el implementador necesita:**

El grupo de rutas de hoy es:

```php
Route::middleware(['api', 'auth:sanctum'])->prefix('EstacionamientoSubTerraneo')->group(function () {
    Route::get('/',[EstacionamientoSubterraneoController::class, 'index']);
    Route::get('/alerta',[EstacionamientoSubterraneoController::class, 'vehiculosMasDeCincoDias']);
    Route::post('/',[EstacionamientoSubterraneoController::class, 'store'])->name('estacionamiento.store');
    Route::get('/detalle/{fecha}',[EstacionamientoSubterraneoController::class, 'show']);
    Route::get('/buscar-placas',[EstacionamientoSubterraneoController::class, 'buscarPlacas']);
    Route::get('/detalle-placa/{placa}',[EstacionamientoSubterraneoController::class, 'detallePorPlaca']);
});
```

**El controlador NO importa la fachada `Validator`.** Sus imports son `Controller`, `Request`, `EstacionamientoSubterraneo`, `DentroDeLaVentana`, `Rule`, `Auth`, `Carbon` y `DB`. Su convención de validación es `$request->validate([...])`, que usa `vehiculosMasDeCincoDias`. Como `{mes}` llega como parámetro de ruta y no en el cuerpo, se mete en la petición con `merge` y se valida ahí: así no hace falta añadir un import que el archivo no tenía, y una petición con `Accept: application/json` recibe el 422 con su clave `errors` automáticamente.

**El filtro va con `whereBetween` sobre `fecha_ingreso`, no con `DATE_FORMAT`.** `show()` usa `DATE_FORMAT(fecha_ingreso, '%Y-%m') = ?`, que impide usar el índice que la tabla tiene en `fecha_ingreso`. Comparar contra un rango sí lo usa, y da el mismo resultado.

**Los registros se piden ya ordenados** por `fecha_ingreso` y luego `id`, ascendentes. Eso es lo que hace que `$grupo->last()` sea el registro más reciente del mes sin tener que volver a ordenar dentro del grupo, y es el desempate que la spec exige para que la fila no dependa del orden en que la base devuelva las filas.

Nombres de función global de prueba ya ocupados — redeclarar uno es un error fatal de PHP, no un fallo de prueba: `usuarioConRol`, `usuarioAdmin`, `usuarioConSubdepartamento`, `usuarioSinAcceso`, `vehiculoDePrueba`, `usuarioVehiculosConRol`, `movimientosDePrueba`, `listarVehiculos`, `cambiarActivo`, `registrarMovimientoDe`, `movimientoDe`, `consultarExcel`. Los que usa esta tarea —`registroDeEstacionamiento` y `consultarRejilla`— están libres.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tests/Feature/EstacionamientoSubterraneo/ExcelMensualTest.php`:

```php
<?php

use App\Models\EstacionamientoSubterraneo;
use App\Models\User;

/*
 * La rejilla mensual del estacionamiento. El módulo NO modela estancias con entrada y
 * salida: `fecha_salida` está en NULL en los 2 961 registros y nadie la escribe. Lo que
 * guarda es una fila por vehículo por cada día que la ronda lo ve, así que un día se
 * marca si existe un registro de esa placa ese día. No hay nada que calcular entre dos
 * fechas.
 */

/**
 * Un registro de ronda. `user_id` es una clave ajena obligatoria, de ahí el usuario.
 */
function registroDeEstacionamiento(string $placas, string $fechaIngreso, array $extra = []): EstacionamientoSubterraneo
{
    return EstacionamientoSubterraneo::create(array_merge([
        'user_id' => User::factory()->create()->id,
        'vehiculo' => 'MAZDA',
        'color' => 'GRIS',
        'placas' => $placas,
        'matricula' => 'EOLO',
        'llaves' => 'NO',
        'responsable' => 'KAREN SUÁREZ',
        'fecha_ingreso' => $fechaIngreso,
        'oficial' => 'Oficial de Turno',
    ], $extra));
}

function consultarRejilla(string $mes): Illuminate\Testing\TestResponse
{
    return test()->getJson("/api/EstacionamientoSubTerraneo/Excel/{$mes}");
}

beforeEach(function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
});

it('una placa con varios registros el mismo día cuenta un solo día', function () {
    // De los 2 491 pares (placa, día) del histórico, 469 tienen más de un registro. Si
    // la celda contara filas en vez de marcar presencia, los totales saldrían inflados.
    registroDeEstacionamiento('ABC-123', '2026-09-03 08:00:00');
    registroDeEstacionamiento('ABC-123', '2026-09-03 20:00:00');

    $filas = consultarRejilla('2026-09')->assertOk()->json('filas');

    expect($filas)->toHaveCount(1)
        ->and($filas[0]['dias'])->toBe([3])
        ->and($filas[0]['total'])->toBe(1);
});

it('una placa cuyo vehículo cambió entre días sale en UNA fila, no en dos', function () {
    // Es el defecto medido de show(), que agrupa por (placas, vehiculo, matricula) y en
    // marzo devuelve 202 filas donde hay 145 coches. Esta prueba falla si alguien
    // "simplifica" este agrupamiento al de allá.
    registroDeEstacionamiento('ABC-123', '2026-09-03 08:00:00', ['vehiculo' => 'MAZDA']);
    registroDeEstacionamiento('ABC-123', '2026-09-04 08:00:00', ['vehiculo' => 'MAZDA 3']);

    $filas = consultarRejilla('2026-09')->assertOk()->json('filas');

    expect($filas)->toHaveCount(1)
        ->and($filas[0]['dias'])->toBe([3, 4])
        ->and($filas[0]['total'])->toBe(2);
});

it('los cinco datos de identificación salen del registro más reciente del mes', function () {
    registroDeEstacionamiento('ABC-123', '2026-09-03 08:00:00', [
        'vehiculo' => 'VIEJO',
        'color' => 'VIEJO',
        'matricula' => 'VIEJO',
        'responsable' => 'VIEJO',
    ]);
    registroDeEstacionamiento('ABC-123', '2026-09-20 08:00:00', [
        'vehiculo' => 'NUEVO',
        'color' => 'NUEVO',
        'matricula' => 'NUEVO',
        'responsable' => 'NUEVO',
    ]);

    $fila = consultarRejilla('2026-09')->assertOk()->json('filas.0');

    expect($fila['vehiculo'])->toBe('NUEVO')
        ->and($fila['color'])->toBe('NUEVO')
        ->and($fila['matricula'])->toBe('NUEVO')
        ->and($fila['responsable'])->toBe('NUEVO');
});

it('el registro más reciente gana aunque se haya insertado primero', function () {
    // Insertado al revés a propósito: el de fecha posterior entra PRIMERO, así que tiene
    // el id MENOR. Sin el `orderBy('fecha_ingreso')` la base devolvería orden de clave
    // primaria y ganaría el viejo, y ninguna otra prueba lo vería.
    registroDeEstacionamiento('ABC-123', '2026-09-20 08:00:00', ['vehiculo' => 'NUEVO']);
    registroDeEstacionamiento('ABC-123', '2026-09-03 08:00:00', ['vehiculo' => 'VIEJO']);

    $fila = consultarRejilla('2026-09')->assertOk()->json('filas.0');

    expect($fila['vehiculo'])->toBe('NUEVO');
});

it('con la misma fecha y hora, gana el registro insertado después', function () {
    // El desempate por id que pide la spec. Sin él, la fila dependería del orden en que
    // la base devuelva las filas, que no está garantizado.
    registroDeEstacionamiento('ABC-123', '2026-09-10 08:00:00', ['vehiculo' => 'PRIMERO']);
    registroDeEstacionamiento('ABC-123', '2026-09-10 08:00:00', ['vehiculo' => 'SEGUNDO']);

    $fila = consultarRejilla('2026-09')->assertOk()->json('filas.0');

    expect($fila['vehiculo'])->toBe('SEGUNDO');
});

it('los días salen ascendentes y sin repetir, y el total cuadra con su longitud', function () {
    // Se insertan desordenados a propósito: si el endpoint devolviera el orden de
    // inserción, esta prueba lo vería.
    registroDeEstacionamiento('ABC-123', '2026-09-20 08:00:00');
    registroDeEstacionamiento('ABC-123', '2026-09-03 08:00:00');
    registroDeEstacionamiento('ABC-123', '2026-09-11 08:00:00');
    registroDeEstacionamiento('ABC-123', '2026-09-03 19:00:00');

    $fila = consultarRejilla('2026-09')->assertOk()->json('filas.0');

    expect($fila['dias'])->toBe([3, 11, 20])
        ->and($fila['total'])->toBe(3);
});

it('solo entran los registros del mes pedido', function () {
    // Incluido el último día del mes anterior y el primero del siguiente, que es donde
    // un filtro mal puesto se cuela.
    registroDeEstacionamiento('ABC-123', '2026-08-31 23:59:00');
    registroDeEstacionamiento('ABC-123', '2026-09-15 08:00:00');
    registroDeEstacionamiento('ABC-123', '2026-10-01 00:00:00');

    $fila = consultarRejilla('2026-09')->assertOk()->json('filas.0');

    expect($fila['dias'])->toBe([15]);
});

it('toma los registros de los bordes del propio mes', function () {
    registroDeEstacionamiento('ABC-123', '2026-09-01 00:00:00');
    registroDeEstacionamiento('ABC-123', '2026-09-30 23:59:59');

    $fila = consultarRejilla('2026-09')->assertOk()->json('filas.0');

    expect($fila['dias'])->toBe([1, 30]);
});

it('el número de días es el del calendario, no uno fijo', function () {
    // Sin esto la rejilla podría quedarse corta de columnas en los meses de 31.
    registroDeEstacionamiento('ABC-123', '2026-02-10 08:00:00');
    registroDeEstacionamiento('XYZ-999', '2026-07-10 08:00:00');

    expect(consultarRejilla('2026-02')->assertOk()->json('dias'))->toBe(28);
    expect(consultarRejilla('2026-07')->assertOk()->json('dias'))->toBe(31);
});

it('devuelve el mes que se pidió', function () {
    registroDeEstacionamiento('ABC-123', '2026-09-10 08:00:00');

    expect(consultarRejilla('2026-09')->assertOk()->json('mes'))->toBe('2026-09');
});

it('un mes sin registros devuelve 200 con la lista vacía, no un 404', function () {
    registroDeEstacionamiento('ABC-123', '2026-09-10 08:00:00');

    $respuesta = consultarRejilla('2026-06')->assertOk();

    expect($respuesta->json('filas'))->toBe([])
        ->and($respuesta->json('dias'))->toBe(30);
});

it('las placas se agrupan normalizadas', function () {
    // Hoy no hay variantes de caja en los datos: 479 placas distintas tal cual, 479 en
    // UPPER y 479 en UPPER(TRIM). Esta prueba es el único sitio donde la regla queda
    // fijada, precisamente porque los datos no la ejercen.
    registroDeEstacionamiento('abc-123', '2026-09-03 08:00:00');
    registroDeEstacionamiento(' ABC-123 ', '2026-09-04 08:00:00');

    $filas = consultarRejilla('2026-09')->assertOk()->json('filas');

    expect($filas)->toHaveCount(1)
        ->and($filas[0]['placas'])->toBe('ABC-123')
        ->and($filas[0]['dias'])->toBe([3, 4]);
});

it('las filas salen ordenadas por placas', function () {
    registroDeEstacionamiento('ZZZ-999', '2026-09-03 08:00:00');
    registroDeEstacionamiento('AAA-111', '2026-09-03 08:00:00');
    registroDeEstacionamiento('MMM-555', '2026-09-03 08:00:00');

    $placas = collect(consultarRejilla('2026-09')->assertOk()->json('filas'))
        ->pluck('placas')
        ->all();

    expect($placas)->toBe(['AAA-111', 'MMM-555', 'ZZZ-999']);
});

it('cada fila trae las siete claves del contrato', function () {
    // El servicio de Excel del cliente lee estas claves por nombre; si cambian aquí,
    // las columnas salen vacías sin que nada falle.
    registroDeEstacionamiento('ABC-123', '2026-09-03 08:00:00');

    $fila = consultarRejilla('2026-09')->assertOk()->json('filas.0');

    expect(array_keys($fila))->toBe([
        'placas',
        'vehiculo',
        'color',
        'matricula',
        'responsable',
        'dias',
        'total',
    ]);
});

it('rechaza un mes mal formado', function () {
    consultarRejilla('2026-13')
        ->assertUnprocessable()
        ->assertJsonValidationErrors('mes');
});

it('rechaza un mes que no es un mes', function () {
    consultarRejilla('septiembre')
        ->assertUnprocessable()
        ->assertJsonValidationErrors('mes');
});
```

- [ ] **Step 2: Correrla y ver que falla**

```bash
TEST_TOKEN=907 php artisan test tests/Feature/EstacionamientoSubterraneo/ExcelMensualTest.php
```

Esperado: FALLA. La ruta no existe, así que todo responde 404.

- [ ] **Step 3: Escribir el método `obtenerExcel`**

En `app/Http/Controllers/Api/EstacionamientoSubterraneoController.php`, después del método `show`:

```php
    /**
     * Rejilla mensual para el Excel: una fila por placa, con los días que tuvo registro.
     *
     * El módulo no modela estancias con entrada y salida —`fecha_salida` está en NULL en
     * todos los registros y nadie la escribe—, sino una fila por vehículo por día de
     * ronda. Por eso un día se marca si existe un registro, sin calcular nada entre dos
     * fechas.
     *
     * No reutiliza `show()` a propósito: aquel agrupa por (placas, vehiculo, matricula),
     * así que una placa cuyo vehículo se escribió distinto algún día sale partida en
     * varias filas con sus días repartidos.
     */
    public function obtenerExcel(Request $request, string $mes)
    {
        $request->merge(['mes' => $mes]);
        $request->validate([
            // El modificador D no es decorativo: sin el, `$` tambien casa ANTES de un
            // salto de linea final, asi que un «2026-09
» pasaria la validacion y
            // reventaria despues en Carbon con un 500 donde se espera un 422.
            'mes' => ['required', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/D'],
        ]);

        $inicio = Carbon::createFromFormat('Y-m-d H:i:s', $mes . '-01 00:00:00')->startOfDay();
        $fin = $inicio->copy()->endOfMonth()->endOfDay();

        $registros = EstacionamientoSubterraneo::query()
            ->whereBetween('fecha_ingreso', [$inicio, $fin])
            ->orderBy('fecha_ingreso')
            ->orderBy('id')
            ->get(['id', 'placas', 'vehiculo', 'color', 'matricula', 'responsable', 'fecha_ingreso']);

        $filas = $registros
            ->groupBy(fn (EstacionamientoSubterraneo $registro) => strtoupper(trim($registro->placas)))
            ->map(function ($grupo, string $placas) {
                // Los registros vienen ordenados ascendente por fecha_ingreso e id, así
                // que el último del grupo es el más reciente del mes.
                $ultimo = $grupo->last();

                $dias = $grupo
                    ->map(fn (EstacionamientoSubterraneo $registro) => (int) $registro->fecha_ingreso->day)
                    ->unique()
                    ->sort()
                    ->values();

                return [
                    'placas' => $placas,
                    'vehiculo' => $ultimo->vehiculo,
                    'color' => $ultimo->color,
                    'matricula' => $ultimo->matricula,
                    'responsable' => $ultimo->responsable,
                    'dias' => $dias->all(),
                    'total' => $dias->count(),
                ];
            })
            ->sortKeys()
            ->values();

        return response()->json([
            'mes' => $mes,
            'dias' => $inicio->daysInMonth,
            'filas' => $filas,
        ], 200);
    }
```

`Carbon` y `EstacionamientoSubterraneo` ya están importados al principio del archivo; no hace falta añadir ningún `use`.

El filtro usa `whereBetween` en vez del `DATE_FORMAT` de `show()` porque así aprovecha el índice que la tabla tiene en `fecha_ingreso`.

- [ ] **Step 4: Registrar la ruta**

En `routes/api.php`, dentro del grupo `prefix('EstacionamientoSubTerraneo')`, después de la línea de `detalle/{fecha}`:

```php
    Route::get('/Excel/{mes}',[EstacionamientoSubterraneoController::class, 'obtenerExcel']);
```

- [ ] **Step 5: Correr la prueba y verla pasar**

```bash
TEST_TOKEN=907 php artisan test tests/Feature/EstacionamientoSubterraneo/ExcelMensualTest.php
```

Esperado: 16 pruebas en verde.

- [ ] **Step 6: Comprobar que las pruebas muerden**

Antes de dar la tarea por buena, verifica que cuatro de ellas no son decorativas. Rompe el código a propósito, corre **solo este archivo**, anota qué se pone en rojo, y restaura:

1. Cambia el `groupBy` para que agrupe por `$registro->placas . '|' . $registro->vehiculo` → debe fallar «una placa cuyo vehículo cambió entre días sale en UNA fila».
2. Quita el `->unique()` de `$dias` → debe fallar «una placa con varios registros el mismo día cuenta un solo día».
3. Cambia `$grupo->last()` por `$grupo->first()` → debe fallar «los cinco datos de identificación salen del registro más reciente».
4. Cambia `strtoupper(trim(...))` por `$registro->placas` a secas → debe fallar «las placas se agrupan normalizadas».

Si alguna no se pone en rojo, para y repórtalo: esa prueba no está probando lo que dice. Después de cada una, restaura el código y confirma con `git diff --stat` que el controlador queda intacto.

- [ ] **Step 7: Limpiar y commitear**

```bash
rm -rf storage/framework/testing/disks/public_test_907 storage/framework/testing/disks/local_test_907
git add app/Http/Controllers/Api/EstacionamientoSubterraneoController.php routes/api.php tests/Feature/EstacionamientoSubterraneo/ExcelMensualTest.php
git commit -m "feat(estacionamiento): endpoint con la rejilla mensual para el Excel"
```

---

### Task 2: El cliente de API y el servicio que arma el libro

**Files:**
- Modify: `resources/js/stores/apiEstacionamientoSubterraneo.ts`
- Create: `resources/js/pages/seguridad/estacionamientoSubTerraneo/excelEstacionamientoService.ts`

**Interfaces:**
- Consumes: `GET /api/EstacionamientoSubTerraneo/Excel/{mes}` de la Task 1, con sus siete claves por fila.
- Produces: los tipos `FilaExcelEstacionamiento` y `RejillaExcelEstacionamiento`, y la función `obtenerExcelEstacionamiento(mes: string): Promise<RejillaExcelEstacionamiento>`, todos exportados desde `apiEstacionamientoSubterraneo.ts`. De `excelEstacionamientoService.ts`: `COLUMNAS_FIJAS`, `tituloDelMes(mes: string): string` y `descargarExcelEstacionamiento(rejilla: RejillaExcelEstacionamiento): Promise<void>`. La Task 3 usa las tres.

**Contexto:**

No hay ejecutor de pruebas de JavaScript en el proyecto, así que esta tarea **no tiene ciclo TDD**. Dilo así en el informe en vez de inventarte uno.

**`apiEstacionamientoSubterraneo.ts` no usa un objeto con métodos.** A diferencia de `apiVehiculoEolo.ts`, este archivo exporta funciones sueltas (`export async function guardarEstaSubTerraneo`, `export const obtenerDetalleVehiculo = async ...`), cada una con sus cabeceras en línea y `credentials: "same-origin"`, y lanza `new Error('...')` cuando la respuesta no es correcta. Sigue ESA forma, no la del otro archivo.

**`COLUMNAS_FIJAS` se exporta a propósito:** el modal recorre esa misma lista para pintar las cinco primeras columnas de la vista previa, así que la vista previa y el libro no pueden tener columnas distintas.

- [ ] **Step 1: Ampliar el cliente de API**

Añadir al final de `resources/js/stores/apiEstacionamientoSubterraneo.ts`:

```ts
export type FilaExcelEstacionamiento = {
    placas: string;
    vehiculo: string;
    color: string | null;
    matricula: string | null;
    responsable: string;
    /** Días del mes con registro, ascendentes y sin repetir. */
    dias: number[];
    total: number;
};

export type RejillaExcelEstacionamiento = {
    mes: string;
    /** Días que tiene el mes: 28, 29, 30 o 31. */
    dias: number;
    filas: FilaExcelEstacionamiento[];
};

export const obtenerExcelEstacionamiento = async (
    mes: string,
): Promise<RejillaExcelEstacionamiento> => {
    const response = await fetch(`/api/EstacionamientoSubTerraneo/Excel/${mes}`, {
        method: "GET",
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        credentials: "same-origin",
    });

    if (!response.ok) {
        throw new Error('No fue posible obtener los registros del mes');
    }

    return await response.json();
};
```

- [ ] **Step 2: Escribir el servicio del libro**

Crear `resources/js/pages/seguridad/estacionamientoSubTerraneo/excelEstacionamientoService.ts`:

```ts
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type {
    FilaExcelEstacionamiento,
    RejillaExcelEstacionamiento,
} from '@/stores/apiEstacionamientoSubterraneo';

/**
 * Las cinco columnas de identificación, en orden. El modal pinta esta misma lista, así
 * que la vista previa y el libro no pueden divergir.
 */
export const COLUMNAS_FIJAS: {
    clave: keyof FilaExcelEstacionamiento;
    titulo: string;
    ancho: number;
}[] = [
    { clave: 'placas', titulo: 'PLACAS', ancho: 14 },
    { clave: 'vehiculo', titulo: 'VEHÍCULO', ancho: 16 },
    { clave: 'color', titulo: 'COLOR', ancho: 12 },
    { clave: 'matricula', titulo: 'MATRÍCULA', ancho: 14 },
    { clave: 'responsable', titulo: 'RESPONSABLE', ancho: 24 },
];

const MESES = [
    'ENERO',
    'FEBRERO',
    'MARZO',
    'ABRIL',
    'MAYO',
    'JUNIO',
    'JULIO',
    'AGOSTO',
    'SEPTIEMBRE',
    'OCTUBRE',
    'NOVIEMBRE',
    'DICIEMBRE',
];

/** '2026-09' → 'SEPTIEMBRE 2026'. */
export const tituloDelMes = (mes: string): string => {
    const [anio, numero] = mes.split('-');

    return `${MESES[Number(numero) - 1]} ${anio}`;
};

export async function descargarExcelEstacionamiento(
    rejilla: RejillaExcelEstacionamiento,
): Promise<void> {
    const titulo = tituloDelMes(rejilla.mes);
    const totalColumnas = COLUMNAS_FIJAS.length + rejilla.dias + 1;

    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet(titulo);

    COLUMNAS_FIJAS.forEach((columna, indice) => {
        hoja.getColumn(indice + 1).width = columna.ancho;
    });

    for (let dia = 1; dia <= rejilla.dias; dia++) {
        hoja.getColumn(COLUMNAS_FIJAS.length + dia).width = 4;
    }

    hoja.getColumn(totalColumnas).width = 8;

    hoja.mergeCells(1, 1, 1, totalColumnas);
    const celdaTitulo = hoja.getCell(1, 1);
    celdaTitulo.value = titulo;
    celdaTitulo.font = { bold: true, size: 14 };
    celdaTitulo.alignment = { horizontal: 'center', vertical: 'middle' };
    hoja.getRow(1).height = 26;

    const encabezado = hoja.getRow(2);

    COLUMNAS_FIJAS.forEach((columna, indice) => {
        encabezado.getCell(indice + 1).value = columna.titulo;
    });

    for (let dia = 1; dia <= rejilla.dias; dia++) {
        encabezado.getCell(COLUMNAS_FIJAS.length + dia).value = dia;
    }

    encabezado.getCell(totalColumnas).value = 'TOTAL';
    encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    encabezado.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF003E51' },
    };
    encabezado.alignment = { horizontal: 'center', vertical: 'middle' };
    encabezado.height = 20;

    rejilla.filas.forEach((fila, indice) => {
        const renglon = hoja.getRow(3 + indice);

        COLUMNAS_FIJAS.forEach((columna, posicion) => {
            renglon.getCell(posicion + 1).value = (fila[columna.clave] as string | null) ?? '';
        });

        const presentes = new Set(fila.dias);

        for (let dia = 1; dia <= rejilla.dias; dia++) {
            const celda = renglon.getCell(COLUMNAS_FIJAS.length + dia);
            celda.value = presentes.has(dia) ? 1 : null;
            celda.alignment = { horizontal: 'center' };
        }

        const celdaTotal = renglon.getCell(totalColumnas);
        celdaTotal.value = fila.total;
        celdaTotal.font = { bold: true };
        celdaTotal.alignment = { horizontal: 'center' };
    });

    // Fija el encabezado y las cinco columnas de identificación: al llegar al día 28 se
    // sigue viendo de qué placa es la fila.
    hoja.views = [{ state: 'frozen', xSplit: COLUMNAS_FIJAS.length, ySplit: 2 }];

    const buffer = await libro.xlsx.writeBuffer();

    saveAs(
        new Blob([buffer as ArrayBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        `estacionamiento-${rejilla.mes}.xlsx`,
    );
}
```

El `as ArrayBuffer` es necesario: `writeBuffer()` devuelve el tipo `ExcelJS.Buffer`, que TypeScript no acepta directamente en el constructor de `Blob`.

Las celdas de día vacías se dejan en `null` y no en `''`: una celda nula no existe en el archivo, mientras que una cadena vacía sí ocupa, y con 31 columnas por 145 filas la diferencia se nota.

- [ ] **Step 3: Comprobar tipos y compilación**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Esperado: `1`, el error preexistente TS1117 en el `WalkAroundController.ts` generado. Si sube, los errores nuevos son de este cambio.

```bash
npm run build
```

Esperado: termina sin errores. Tarda un par de minutos; déjalo acabar.

- [ ] **Step 4: Commit**

```bash
git add resources/js/stores/apiEstacionamientoSubterraneo.ts resources/js/pages/seguridad/estacionamientoSubTerraneo/excelEstacionamientoService.ts
git commit -m "feat(estacionamiento): cliente de API y servicio que arma el libro mensual"
```

---

### Task 3: El modal de vista previa

**Files:**
- Create: `resources/js/pages/seguridad/estacionamientoSubTerraneo/ModalExcelEstacionamiento.tsx`

**Interfaces:**
- Consumes: `obtenerExcelEstacionamiento(mes)`, `COLUMNAS_FIJAS`, `tituloDelMes(mes)`, `descargarExcelEstacionamiento(rejilla)` y el tipo `RejillaExcelEstacionamiento` de la Task 2. El tipo de cada fila no se importa: se infiere del `map` sobre `rejilla.filas`.
- Produces: el componente `ModalExcelEstacionamiento` con las props `{ mes: string; onClose: () => void }`. La Task 4 lo monta.

**Contexto:**

Esta tarea crea el modal **completo pero todavía sin montar**: nadie lo renderiza hasta la Task 4. Es deliberado, para que se pueda revisar por sí solo. Compila y pasa `tsc` igualmente.

**No lleva props `isOpen`.** A diferencia del modal de exportación de vehículos, aquí el padre lo monta condicionalmente y punto: el mes es lo único que necesita y ya viene elegido. Por eso tampoco hay filtros ni botón de «Consultar» — la consulta se lanza al montarse, en un `useEffect`.

La vista previa enseña **todas las filas**, no un recorte: el peor mes medido tiene 145, y así la vista previa es literalmente el archivo.

- [ ] **Step 1: Escribir el componente**

Crear `resources/js/pages/seguridad/estacionamientoSubTerraneo/ModalExcelEstacionamiento.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { X, FileSpreadsheet, Download } from 'lucide-react';
import {
    obtenerExcelEstacionamiento,
    type RejillaExcelEstacionamiento,
} from '@/stores/apiEstacionamientoSubterraneo';
import {
    COLUMNAS_FIJAS,
    tituloDelMes,
    descargarExcelEstacionamiento,
} from './excelEstacionamientoService';

interface Props {
    mes: string;
    onClose: () => void;
}

export default function ModalExcelEstacionamiento({ mes, onClose }: Props) {
    const [rejilla, setRejilla] = useState<RejillaExcelEstacionamiento | null>(null);
    const [cargando, setCargando] = useState(true);
    const [descargando, setDescargando] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let vigente = true;

        const consultar = async () => {
            setCargando(true);
            setError('');

            try {
                const resultado = await obtenerExcelEstacionamiento(mes);

                if (vigente) {
                    setRejilla(resultado);
                }
            } catch (e: any) {
                if (vigente) {
                    setRejilla(null);
                    setError(e?.message || 'No fue posible consultar los registros del mes.');
                }
            } finally {
                if (vigente) {
                    setCargando(false);
                }
            }
        };

        consultar();

        // Si el modal se cierra antes de que llegue la respuesta, no se toca el estado
        // de un componente ya desmontado.
        return () => {
            vigente = false;
        };
    }, [mes]);

    const descargar = async () => {
        if (!rejilla || rejilla.filas.length === 0) {
            return;
        }

        setDescargando(true);
        setError('');

        try {
            await descargarExcelEstacionamiento(rejilla);
        } catch (e: any) {
            setError(e?.message || 'No fue posible generar el archivo de Excel.');
        } finally {
            setDescargando(false);
        }
    };

    const hayFilas = rejilla !== null && rejilla.filas.length > 0;
    const dias = rejilla ? Array.from({ length: rejilla.dias }, (_, i) => i + 1) : [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="text-emerald-600" size={20} />
                        <h3 className="font-bold text-slate-800">
                            Vista previa del Excel: {tituloDelMes(mes)}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                <div className="overflow-auto flex-1 bg-white p-4">
                    {error && (
                        <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
                            {error}
                        </div>
                    )}

                    {cargando && (
                        <p className="text-sm text-slate-400 italic">Consultando el mes...</p>
                    )}

                    {!cargando && rejilla !== null && rejilla.filas.length === 0 && (
                        <p className="text-sm text-slate-400 italic">
                            No hay registros en este mes.
                        </p>
                    )}

                    {!cargando && hayFilas && (
                        <>
                            <p className="mb-3 text-xs text-slate-500">
                                {rejilla!.filas.length}{' '}
                                {rejilla!.filas.length === 1 ? 'placa' : 'placas'} en{' '}
                                {rejilla!.dias} días.
                            </p>
                            <table className="text-left text-[11px] border-collapse">
                                <thead className="bg-slate-100">
                                    <tr>
                                        {COLUMNAS_FIJAS.map(columna => (
                                            <th
                                                key={columna.clave}
                                                className="p-2 font-semibold text-slate-600 whitespace-nowrap border border-slate-200"
                                            >
                                                {columna.titulo}
                                            </th>
                                        ))}
                                        {dias.map(dia => (
                                            <th
                                                key={dia}
                                                className="p-1 w-7 text-center font-semibold text-slate-600 border border-slate-200"
                                            >
                                                {dia}
                                            </th>
                                        ))}
                                        <th className="p-2 text-center font-semibold text-slate-600 border border-slate-200">
                                            TOTAL
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rejilla!.filas.map(fila => {
                                        const presentes = new Set(fila.dias);

                                        return (
                                            <tr key={fila.placas}>
                                                {COLUMNAS_FIJAS.map(columna => (
                                                    <td
                                                        key={columna.clave}
                                                        className="p-2 text-slate-700 whitespace-nowrap border border-slate-200"
                                                    >
                                                        {(fila[columna.clave] as string | null) ?? ''}
                                                    </td>
                                                ))}
                                                {dias.map(dia => (
                                                    <td
                                                        key={dia}
                                                        className={`p-1 text-center border border-slate-200 ${
                                                            presentes.has(dia)
                                                                ? 'bg-emerald-100 text-emerald-700 font-bold'
                                                                : ''
                                                        }`}
                                                    >
                                                        {presentes.has(dia) ? 1 : ''}
                                                    </td>
                                                ))}
                                                <td className="p-2 text-center font-bold text-slate-800 border border-slate-200">
                                                    {fila.total}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </>
                    )}
                </div>

                <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition-colors"
                    >
                        Cerrar
                    </button>
                    <button
                        onClick={descargar}
                        disabled={!hayFilas || descargando}
                        className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        <Download size={16} />
                        {descargando ? 'Generando...' : 'Descargar Excel'}
                    </button>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Comprobar tipos y compilación**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Esperado: `1`, el mismo error preexistente.

```bash
npm run build
```

Esperado: termina sin errores.

- [ ] **Step 3: Revisar a conciencia estos cinco puntos**

El modal todavía no se puede probar a mano porque nadie lo monta. Léelo y confirma en tu informe lo que trazaste, línea por línea:

1. La consulta se lanza al montarse y solo se repite si cambia `mes`.
2. Si el modal se desmonta antes de que llegue la respuesta, la bandera `vigente` impide tocar el estado.
3. «Descargar Excel» está apagado mientras no haya al menos una fila.
4. La cabecera y las celdas de las cinco columnas fijas recorren la **misma** `COLUMNAS_FIJAS` que usa el servicio: no hay ninguna lista de columnas escrita dos veces.
5. Un mes sin registros enseña el mensaje y deja la descarga apagada, en vez de una tabla vacía.

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/seguridad/estacionamientoSubTerraneo/ModalExcelEstacionamiento.tsx
git commit -m "feat(estacionamiento): modal con la vista previa de la rejilla mensual"
```

---

### Task 4: El botón de Excel en cada mes

**Files:**
- Modify: `resources/js/pages/seguridad/estacionamientoSubTerraneo/VehicleDashboard.tsx`

**Interfaces:**
- Consumes: `ModalExcelEstacionamiento` de la Task 3, con las props `{ mes: string; onClose: () => void }` y export por defecto.
- Produces: nada que otra tarea use. Esta es la que conecta.

**Contexto:**

**El `<tr>` de cada mes lleva `onClick={() => handleOpenDetail(mes)}`**, así que un botón nuevo dentro de la fila tiene que llamar a `e.stopPropagation()` o al pulsarlo se abrirá también el detalle del mes. El botón que ya existe en esa celda lo hace, y el nuevo lo copia:

```tsx
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenDetail(mes);
                                                        }}
                                                        className="p-2 rounded transition-colors text-slate-400 hover:text-sky-600"
                                                        title="Ver detalle"
                                                    >
                                                        <ChevronRight size={16} />
                                                    </button>
                                                </div>
                                            </td>
```

El modal se monta **condicionalmente**. No es un gusto estético: guarda la rejilla consultada en su propio estado, y montado siempre ese estado sobreviviría al cierre, de modo que al abrirlo para otro mes se vería un instante la rejilla del anterior. Desmontarlo lo reinicia, y además su `useEffect` vuelve a consultar.

- [ ] **Step 1: Añadir el import y el estado**

En `resources/js/pages/seguridad/estacionamientoSubTerraneo/VehicleDashboard.tsx`, ampliar el import de iconos de la línea 2:

```tsx
import { Calendar, ChevronRight, FileText, Filter, Plus, X, TriangleAlert, FileSpreadsheet } from 'lucide-react';
```

Añadir, junto a los demás imports de componentes del módulo:

```tsx
import ModalExcelEstacionamiento from './ModalExcelEstacionamiento';
```

Y un estado nuevo, junto a los que ya tiene el componente:

```tsx
    const [mesParaExcel, setMesParaExcel] = useState<string | null>(null);
```

- [ ] **Step 2: Añadir el botón a la celda de acciones**

Dentro del `<div className="flex items-center justify-end gap-1">` de la celda «Acciones», **antes** del botón de «Ver detalle**»**:

```tsx
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setMesParaExcel(mes.valor);
                                                        }}
                                                        className="p-2 rounded transition-colors text-slate-400 hover:text-emerald-600"
                                                        title="Descargar Excel del mes"
                                                    >
                                                        <FileSpreadsheet size={16} />
                                                    </button>
```

- [ ] **Step 3: Montar el modal**

Al final del componente, junto a donde se montan los demás modales de esta pantalla:

```tsx
            {mesParaExcel !== null && (
                <ModalExcelEstacionamiento
                    mes={mesParaExcel}
                    onClose={() => setMesParaExcel(null)}
                />
            )}
```

- [ ] **Step 4: Comprobar tipos y compilación**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Esperado: `1`.

```bash
npm run build
```

Esperado: termina sin errores.

- [ ] **Step 5: Revisar estos cuatro puntos en tu propio diff**

1. El botón nuevo llama a `e.stopPropagation()`, así que no abre también el detalle.
2. El modal se monta condicionalmente con `{mesParaExcel !== null && ...}`, no con una prop `isOpen` sobre un montaje permanente.
3. `onClose` deja `mesParaExcel` en `null`, lo que desmonta el modal.
4. No tocaste nada más del archivo: ni los filtros, ni la alerta de cinco días, ni el detalle.

- [ ] **Step 6: Commit**

```bash
git add resources/js/pages/seguridad/estacionamientoSubTerraneo/VehicleDashboard.tsx
git commit -m "feat(estacionamiento): boton de Excel en cada mes de la lista"
```

---

### Task 5: La suite entera y la pantalla de verdad

**Files:**
- Test: toda la suite; después, la pantalla en un navegador

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada.

**Contexto:**

El endpoint nuevo es aditivo y no cambia ninguna respuesta existente, así que no se esperan efectos a distancia. Esta tarea está para confirmarlo y para mirar la pantalla una vez, que es lo único que ninguna prueba de este proyecto cubre.

- [ ] **Step 1: Correr la suite entera, en serie**

```bash
TEST_TOKEN=908 php artisan test
```

**Nunca con `--parallel`.** Esperado: 2459 pruebas de antes más las 16 de la Task 1, o sea **2475**, sin ningún fallo. Tarda unos seis minutos; déjalo acabar.

Después:

```bash
rm -rf storage/framework/testing/disks/public_test_908 storage/framework/testing/disks/local_test_908
```

- [ ] **Step 2: Si algo falla**

Lee el fallo antes de tocar nada. Si no tiene relación con el estacionamiento, comprueba si ya venía fallando, en un árbol aparte y sin tocar el de trabajo:

```bash
git worktree add ../eolo-base 22b742a
cd ../eolo-base && TEST_TOKEN=909 php artisan test --filter=NombreDeLaPrueba
```

`22b742a` es la punta antes de este trabajo. Si allí también falla, es previo: anótalo y sigue. Límpialo con `git worktree remove ../eolo-base`.

- [ ] **Step 3: Abrir la pantalla en el navegador**

Hay dos trampas conocidas en este entorno, y las dos dan síntomas que parecen defectos del código:

- El preview arranca desde `C:\xampp\htdocs\EOLO` (el **padre**), así que lee `EOLO/.claude/launch.json`, **no** el de `Eolo-plus/`.
- Sanctum solo considera *stateful* los orígenes `localhost`, `localhost:3000`, `127.0.0.1`, `127.0.0.1:8000`, `::1` y el host de `APP_URL`. En cualquier otro puerto, `/api/*` responde **401** y las tablas salen vacías.

Receta: edita `C:\xampp\htdocs\EOLO\.claude\launch.json` para que sirva en el **puerto 3000**, arranca el preview y entra por `http://localhost:3000/estacionamiento`. **Devuelve el archivo a 8000 al terminar.**

Entra como `Administrador EOLO` con la contraseña del seeder (`AdminUserSeeder`). Fortify autentica por `name`, no por correo.

- [ ] **Step 4: Comprobar en pantalla, sin escribir nada**

La base de desarrollo es la de verdad, con 2 961 registros. **Verifica leyendo y descargando, que son operaciones de solo lectura; no registres ningún vehículo ni ninguna ronda.**

1. La lista «Registros por Periodo» enseña un icono de hoja de cálculo en cada mes.
2. Pulsarlo abre el modal **sin** abrir además el detalle del mes — ese es el `stopPropagation`.
3. Para **2026-03**, el modal debe enseñar **145 placas**, no 202. Ese número es la razón de ser del endpoint nuevo: `show()` devuelve 202 para ese mes.
4. La rejilla tiene 31 columnas de día en marzo y 28 en febrero de 2026.
5. Descarga el de marzo y ábrelo: título «MARZO 2026», encabezado fijo, las cinco primeras columnas fijas al desplazarse, y los TOTALES cuadran con los unos de cada fila.
6. Abre el modal de otro mes después de cerrar el primero: debe consultar de nuevo y no enseñar ni un instante la rejilla anterior.

Haz una captura del modal abierto con la rejilla cargada y adjúntala al informe.

- [ ] **Step 5: Informe**

No hay nada que commitear si todo salió verde y no tocaste nada: dilo explícitamente en vez de inventarte un commit. Si tuviste que arreglar alguna prueba, commitea con:

```bash
git add -A
git commit -m "test: ajusta las pruebas afectadas por la rejilla mensual"
```

---

## Qué queda fuera, a propósito

- **Arreglar `show()`.** Su defecto de agrupación afecta hoy a la pantalla de detalle —202 filas donde hay 145 coches en marzo— pero es de esa pantalla, no de esta exportación.
- **`fecha_salida`.** No se escribe ni se calcula nada con ella. Que esté muerta es un hallazgo de la spec, no un problema que este plan resuelva.
- **Las columnas `oficial` y `llaves`.** La primera es la constante «Oficial de Turno» en los 2 961 registros; la segunda es un hecho de la ronda, no del coche.
- **Exportar varios meses en un archivo.**
- **Candado de rol y rastro en bitácora.**
