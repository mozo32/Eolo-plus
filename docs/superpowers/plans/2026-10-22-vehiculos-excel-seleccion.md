# Exportar a Excel los vehículos seleccionados — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que se puedan marcar vehículos con casillas en la tabla, acotar sus movimientos por chofer, fechas y tipo, ver lo que saldrá y descargarlo como un Excel de una sola hoja.

**Architecture:** Un endpoint nuevo sirve los movimientos de varios vehículos como filas planas sin imágenes; el libro se arma en el cliente con ExcelJS, que es como se hacen las otras seis exportaciones del proyecto. La vista previa y la descarga consumen el mismo arreglo de filas y la misma lista de columnas, así que no pueden divergir.

**Tech Stack:** Laravel 12, PHP 8.2, Pest 3 sobre sqlite, Inertia 2 + React 19 + TypeScript, Tailwind 4, ExcelJS 4.4, file-saver 2.0, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-22-vehiculos-excel-seleccion-design.md`

## Global Constraints

- **Rama base:** `vehiculos-tabla-desactivar`, punta `cc00a17`. Este trabajo se apoya en el proyecto hermano ya terminado: la columna de casillas va **antes** de la columna «Vehículo / N. económico», que allí se creó.
- **Las pruebas corren EN SERIE:** `php artisan test` o `php artisan test <ruta>`. **Nunca `--parallel`**: en este proyecto da fallos falsos.
- **Hay un directorio atascado** en `storage/framework/testing/disks/public/movimientos-vehiculos/1` que no se puede borrar ni listar («Acceso denegado» desde `rm`, `rd /s /q` y `Get-Acl`). Mientras siga ahí, las pruebas que escriben una imagen de verdad fallan. Corre con un `TEST_TOKEN` fresco —**903 en adelante**, 901 y 902 ya se usaron— y borra el `public_test_<n>` que deje. `TEST_TOKEN` **no** es ejecución en paralelo: solo hace que `Storage::fake` use otro directorio.
- **Nunca correr `vendor/bin/pint` ni `prettier`** sobre archivos preexistentes: reescriben cientos de líneas ajenas al cambio.
- **Nunca correr `npm run lint`**: lleva `--fix` y reescribe archivos ajenos.
- **Nunca usar `git stash`.** Hay tres stashes guardados en este repositorio que no son de este trabajo.
- **No cambies dependencias** ni toques `package.json`. `exceljs`, `file-saver` y `lucide-react` ya están.
- **La conexión `remota` es de solo lectura por contrato.** Este trabajo no la toca.
- **No hay ninguna prueba de JavaScript** en el proyecto. La verificación del front es `npx tsc --noEmit` contra una línea base de **1 error preexistente** (TS1117 en el generado `WalkAroundController.ts`) más `npm run build`.
- **La exportación NO lleva candado de rol y NO deja rastro en bitácora.** Las dos cosas son decisiones 6 y 7 de la spec, no descuidos.
- **El endpoint no devuelve imágenes.** Es el motivo de que exista en vez de reusar `obtenerHistorial`.

---

## Estructura de archivos

**Se crean:**

| Archivo | Responsabilidad |
|---|---|
| `tests/Feature/MovimientosVehiculoEolo/ExcelVehiculosTest.php` | El endpoint: filtros, validación, forma de la fila |
| `resources/js/pages/seguridad/MovimientosVehiculoEolo/excelVehiculosService.ts` | Las columnas del reporte y el armado del libro |
| `resources/js/pages/seguridad/MovimientosVehiculoEolo/ExcelVehiculosModal.tsx` | El modal: filtros, consultar, vista previa, descargar |

**Se modifican:**

| Archivo | Cambio |
|---|---|
| `app/Http/Controllers/Api/VehiculoEoloController.php` | Método `obtenerExcel` |
| `routes/api.php` | Ruta `GET /VehiculoEolo/Excel/` |
| `resources/js/pages/seguridad/MovimientosVehiculoEolo/types.ts` | `FilaExcelVehiculo` y `FiltrosExcelVehiculos` |
| `resources/js/stores/apiVehiculoEolo.ts` | `getExcel()` |
| `resources/js/pages/seguridad/MovimientosVehiculoEolo/ControlVehiculos.tsx` | Selección, botón «Excel», montaje del modal |
| `resources/js/pages/seguridad/MovimientosVehiculoEolo/TablaVehiculos.tsx` | Columna de casillas y casilla de cabecera |
| `resources/js/pages/seguridad/MovimientosVehiculoEolo/FilaVehiculo.tsx` | Celda de casilla |

**Orden de las tareas.** El servidor primero, después las dos piezas de cliente que no son UI, después el modal (completo pero todavía sin montar), y al final la tabla, que es la que conecta todo. Así ninguna tarea depende de un archivo a medio hacer.

---

### Task 1: El endpoint `GET /api/VehiculoEolo/Excel/`

**Files:**
- Modify: `app/Http/Controllers/Api/VehiculoEoloController.php` (método nuevo después de `obtenerHistorial`)
- Modify: `routes/api.php` (grupo `prefix('VehiculoEolo')`)
- Test: `tests/Feature/MovimientosVehiculoEolo/ExcelVehiculosTest.php`

**Interfaces:**
- Consumes: el modelo `Vehiculo` (clave primaria `string`, campo `activo` booleano) y `movimientoVehiculo` (tabla `movimientos_vehiculos`, clave ajena `vehiculo_id`, columna `tipo` con `'Entrada'`/`'Salida'`). Los ayudantes globales de prueba `vehiculoDePrueba(id, nombre, estado = 'En Planta', activo = true)` y `usuarioAdmin()`, los dos ya en `tests/Pest.php`.
- Produces: `GET /api/VehiculoEolo/Excel/` con los parámetros `vehiculos[]`, `chofer`, `tipo`, `fecha_inicio`, `fecha_fin`. Devuelve un arreglo JSON de objetos con **exactamente estas doce claves y en este orden**: `vehiculo`, `numeroEconomico`, `fechaHora`, `tipo`, `chofer`, `kilometraje`, `gasolina`, `destino`, `autoriza`, `matricula`, `motivo`, `observaciones`. Las tareas 2 y 3 dependen de esos nombres exactos.

**Contexto que el implementador necesita:**

El grupo de rutas de hoy es:

```php
Route::middleware(['api', 'auth:sanctum'])->prefix('VehiculoEolo')->group(function () {
    Route::get('/', [VehiculoEoloController::class, 'index']);
    Route::post('/movimientos', [VehiculoEoloController::class, 'registrarMovimiento']);
    Route::get('/vehiculos/{id}/movimientos', [VehiculoEoloController::class, 'obtenerHistorial']);
    Route::patch('/vehiculos/{id}/activo', [VehiculoEoloController::class, 'cambiarActivo']);
    Route::post('/', [VehiculoEoloController::class, 'store']);
});
```

Los otros cuatro módulos con Excel exponen su ruta como `GET .../Excel/`, con esa barra final. Se sigue el mismo patrón.

Los cuatro filtros opcionales se comportan **igual que en `obtenerHistorial`**, que hoy hace:

```php
->when($request->chofer, function ($query, $chofer) {
    $query->where('chofer', 'like', '%' . $chofer . '%');
})
->when($request->tipo, function ($query, $tipo) {
    $query->where('tipo', $tipo);
})
->when($request->fecha_inicio, function ($query, $fechaInicio) {
    $query->whereDate('created_at', '>=', $fechaInicio);
})
->when($request->fecha_fin, function ($query, $fechaFin) {
    $query->whereDate('created_at', '<=', $fechaFin);
})
```

`whereDate` compara solo la parte de fecha, así que los dos extremos son inclusivos.

`movimientoVehiculo` castea `created_at` con `'datetime:Y-m-d H:i'`, así que `$m->created_at` es un Carbon y `->format('Y-m-d H:i')` funciona.

**Nombres de función global ya ocupados** — redeclarar uno es un error fatal de PHP, no un fallo de prueba: `usuarioConRol`, `usuarioAdmin`, `usuarioConSubdepartamento`, `usuarioSinAcceso`, `vehiculoDePrueba`, `usuarioVehiculosConRol`, `movimientosDePrueba`, `listarVehiculos`, `cambiarActivo`, `registrarMovimientoDe`. Los que usa esta tarea —`movimientoDe` y `consultarExcel`— están libres.

El ayudante compartido `movimientosDePrueba` **no sirve aquí**: escribe siempre el mismo chofer y alterna el tipo. Estas pruebas necesitan controlar chofer, tipo y fecha fila por fila, así que la tarea declara su propio ayudante.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tests/Feature/MovimientosVehiculoEolo/ExcelVehiculosTest.php`:

```php
<?php

use App\Models\movimientoVehiculo;

/*
 * El endpoint que alimenta el Excel. Es el único que devuelve movimientos de VARIOS
 * vehículos a la vez, y el único que no toca el disco: `obtenerHistorial` llama a
 * Storage::exists por cada imagen para armar URLs que el libro no usa.
 */

/**
 * Un movimiento con lo mínimo obligatorio. `created_at` se pasa aparte porque no está
 * en $fillable y la asignación masiva lo ignoraría.
 */
function movimientoDe(string $vehiculoId, array $extra = []): movimientoVehiculo
{
    $creadoEn = $extra['created_at'] ?? null;
    unset($extra['created_at']);

    $movimiento = movimientoVehiculo::create(array_merge([
        'vehiculo_id' => $vehiculoId,
        'tipo' => 'Salida',
        'chofer' => 'Juan Pérez',
        'kilometraje' => 1000,
        'gasolina' => '1/2',
    ], $extra));

    if ($creadoEn !== null) {
        $movimiento->forceFill(['created_at' => $creadoEn])->save();
    }

    return $movimiento;
}

function consultarExcel(array $parametros): Illuminate\Testing\TestResponse
{
    return test()->getJson('/api/VehiculoEolo/Excel/?' . http_build_query($parametros));
}

beforeEach(function () {
    $this->actingAs(usuarioAdmin(), 'sanctum');
});

it('devuelve los movimientos de los vehículos pedidos y de ningún otro', function () {
    vehiculoDePrueba('01-KIA', 'KIA');
    vehiculoDePrueba('TC-84', 'SUBURBAN');
    vehiculoDePrueba('IKON', 'IKON');
    movimientoDe('01-KIA');
    movimientoDe('TC-84');
    movimientoDe('IKON');

    $filas = consultarExcel(['vehiculos' => ['01-KIA', 'TC-84']])->assertOk()->json();

    $economicos = collect($filas)->pluck('numeroEconomico')->sort()->values()->all();
    expect($economicos)->toBe(['01-KIA', 'TC-84']);
});

it('filtra por chofer con coincidencia parcial', function () {
    vehiculoDePrueba('01-KIA', 'KIA');
    movimientoDe('01-KIA', ['chofer' => 'Ana Robles']);
    movimientoDe('01-KIA', ['chofer' => 'Beto Sánchez']);

    $filas = consultarExcel([
        'vehiculos' => ['01-KIA'],
        'chofer' => 'Robl',
    ])->assertOk()->json();

    expect($filas)->toHaveCount(1)
        ->and($filas[0]['chofer'])->toBe('Ana Robles');
});

it('filtra por tipo de movimiento', function () {
    vehiculoDePrueba('01-KIA', 'KIA');
    movimientoDe('01-KIA', ['tipo' => 'Salida']);
    movimientoDe('01-KIA', ['tipo' => 'Entrada']);
    movimientoDe('01-KIA', ['tipo' => 'Entrada']);

    $filas = consultarExcel([
        'vehiculos' => ['01-KIA'],
        'tipo' => 'Entrada',
    ])->assertOk()->json();

    expect($filas)->toHaveCount(2)
        ->and(collect($filas)->pluck('tipo')->unique()->all())->toBe(['Entrada']);
});

it('la fecha de inicio incluye el propio día', function () {
    // El movimiento cae exactamente en el borde: si la comparación fuera estricta, se
    // perdería, y esta prueba es lo único que lo detectaría.
    vehiculoDePrueba('01-KIA', 'KIA');
    movimientoDe('01-KIA', ['created_at' => '2026-03-10 23:59:00', 'kilometraje' => 111]);
    movimientoDe('01-KIA', ['created_at' => '2026-03-09 23:59:00', 'kilometraje' => 222]);

    $filas = consultarExcel([
        'vehiculos' => ['01-KIA'],
        'fecha_inicio' => '2026-03-10',
    ])->assertOk()->json();

    expect(collect($filas)->pluck('kilometraje')->all())->toBe([111]);
});

it('la fecha de fin incluye el propio día', function () {
    vehiculoDePrueba('01-KIA', 'KIA');
    movimientoDe('01-KIA', ['created_at' => '2026-03-10 00:01:00', 'kilometraje' => 111]);
    movimientoDe('01-KIA', ['created_at' => '2026-03-11 00:01:00', 'kilometraje' => 222]);

    $filas = consultarExcel([
        'vehiculos' => ['01-KIA'],
        'fecha_fin' => '2026-03-10',
    ])->assertOk()->json();

    expect(collect($filas)->pluck('kilometraje')->all())->toBe([111]);
});

it('combina el filtro de vehículo con el de fecha', function () {
    // Que cada filtro funcione por separado no garantiza que funcionen juntos.
    vehiculoDePrueba('01-KIA', 'KIA');
    vehiculoDePrueba('TC-84', 'SUBURBAN');
    movimientoDe('01-KIA', ['created_at' => '2026-03-10 10:00:00', 'kilometraje' => 111]);
    movimientoDe('01-KIA', ['created_at' => '2026-05-10 10:00:00', 'kilometraje' => 222]);
    movimientoDe('TC-84', ['created_at' => '2026-03-10 10:00:00', 'kilometraje' => 333]);

    $filas = consultarExcel([
        'vehiculos' => ['01-KIA'],
        'fecha_inicio' => '2026-03-01',
        'fecha_fin' => '2026-03-31',
    ])->assertOk()->json();

    expect(collect($filas)->pluck('kilometraje')->all())->toBe([111]);
});

it('ordena del movimiento más nuevo al más viejo', function () {
    // Se asegura sobre el kilometraje, distinto en cada fila: sobre `tipo` o `chofer`
    // una secuencia simétrica se leería igual del derecho que del revés y la prueba
    // pasaría también con el orden quitado o invertido.
    vehiculoDePrueba('01-KIA', 'KIA');
    movimientoDe('01-KIA', ['created_at' => '2026-03-01 08:00:00', 'kilometraje' => 111]);
    movimientoDe('01-KIA', ['created_at' => '2026-03-03 08:00:00', 'kilometraje' => 333]);
    movimientoDe('01-KIA', ['created_at' => '2026-03-02 08:00:00', 'kilometraje' => 222]);

    $filas = consultarExcel(['vehiculos' => ['01-KIA']])->assertOk()->json();

    expect(collect($filas)->pluck('kilometraje')->all())->toBe([333, 222, 111]);
});

it('un vehículo desactivado se exporta igual', function () {
    // Su bitácora es consultable por diseño; exportar es leer. Es justo lo que alguien
    // "arreglaría" por error más adelante.
    vehiculoDePrueba('EP-16', 'URVAN', 'En Planta', false);
    movimientoDe('EP-16', ['kilometraje' => 777]);

    $filas = consultarExcel(['vehiculos' => ['EP-16']])->assertOk()->json();

    expect(collect($filas)->pluck('kilometraje')->all())->toBe([777]);
});

it('no devuelve imágenes: es el motivo de que este endpoint exista', function () {
    vehiculoDePrueba('01-KIA', 'KIA');
    movimientoDe('01-KIA');

    $fila = consultarExcel(['vehiculos' => ['01-KIA']])->assertOk()->json('0');

    $clavesDeImagen = array_filter(
        array_keys($fila),
        fn (string $clave) => str_contains(strtolower($clave), 'imagen')
            || str_contains(strtolower($clave), 'evidencia')
    );

    expect($clavesDeImagen)->toBe([]);
});

it('cada fila trae las doce columnas del reporte, en orden', function () {
    // El servicio de Excel del cliente lee estas claves por nombre; si cambian aquí,
    // las columnas salen vacías sin que nada falle.
    vehiculoDePrueba('01-KIA', 'KIA');
    movimientoDe('01-KIA');

    $fila = consultarExcel(['vehiculos' => ['01-KIA']])->assertOk()->json('0');

    expect(array_keys($fila))->toBe([
        'vehiculo',
        'numeroEconomico',
        'fechaHora',
        'tipo',
        'chofer',
        'kilometraje',
        'gasolina',
        'destino',
        'autoriza',
        'matricula',
        'motivo',
        'observaciones',
    ]);
});

it('trae el nombre del vehículo, no solo su número económico', function () {
    vehiculoDePrueba('01-KIA', 'KIA');
    movimientoDe('01-KIA');

    $fila = consultarExcel(['vehiculos' => ['01-KIA']])->assertOk()->json('0');

    expect($fila['vehiculo'])->toBe('KIA')
        ->and($fila['numeroEconomico'])->toBe('01-KIA');
});

it('rechaza una lista de vehículos vacía', function () {
    // Sin esto, un descuido en la pantalla exportaría la flota entera en silencio.
    consultarExcel(['vehiculos' => []])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('vehiculos');
});

it('rechaza la petición sin el parámetro vehiculos', function () {
    consultarExcel([])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('vehiculos');
});

it('rechaza un vehículo que no existe', function () {
    vehiculoDePrueba('01-KIA', 'KIA');

    consultarExcel(['vehiculos' => ['01-KIA', 'NO-EXISTE']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('vehiculos.1');
});

it('una consulta sin resultados devuelve una lista vacía, no un error', function () {
    vehiculoDePrueba('01-KIA', 'KIA');
    movimientoDe('01-KIA', ['chofer' => 'Ana Robles']);

    $filas = consultarExcel([
        'vehiculos' => ['01-KIA'],
        'chofer' => 'Nadie',
    ])->assertOk()->json();

    expect($filas)->toBe([]);
});
```

- [ ] **Step 2: Correrla y ver que falla**

```bash
TEST_TOKEN=903 php artisan test tests/Feature/MovimientosVehiculoEolo/ExcelVehiculosTest.php
```

Esperado: FALLA. La ruta no existe, así que todo responde 404.

- [ ] **Step 3: Escribir el método `obtenerExcel`**

En `app/Http/Controllers/Api/VehiculoEoloController.php`, después del método `obtenerHistorial`:

```php
    /**
     * Movimientos de VARIOS vehículos, como filas planas para el Excel.
     *
     * No devuelve imágenes a propósito: `obtenerHistorial` llama a Storage::exists por
     * cada una para construir su URL, y el libro de Excel no las contiene. Esa es la
     * razón de que esta consulta exista en vez de llamar seis veces a la otra.
     */
    public function obtenerExcel(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'vehiculos' => 'required|array|min:1',
            'vehiculos.*' => 'required|string|exists:vehiculos,id',
            'chofer' => 'nullable|string|max:255',
            'tipo' => 'nullable|in:Entrada,Salida',
            'fecha_inicio' => 'nullable|date',
            'fecha_fin' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors(),
            ], 422);
        }

        $ids = $request->input('vehiculos');

        $movimientos = movimientoVehiculo::query()
            ->whereIn('vehiculo_id', $ids)
            ->when($request->chofer, function ($query, $chofer) {
                $query->where('chofer', 'like', '%' . $chofer . '%');
            })
            ->when($request->tipo, function ($query, $tipo) {
                $query->where('tipo', $tipo);
            })
            ->when($request->fecha_inicio, function ($query, $fechaInicio) {
                $query->whereDate('created_at', '>=', $fechaInicio);
            })
            ->when($request->fecha_fin, function ($query, $fechaFin) {
                $query->whereDate('created_at', '<=', $fechaFin);
            })
            ->orderBy('created_at', 'desc')
            ->orderBy('vehiculo_id')
            ->get();

        $nombres = Vehiculo::query()
            ->whereIn('id', $ids)
            ->pluck('nombre', 'id');

        $filas = $movimientos->map(function (movimientoVehiculo $movimiento) use ($nombres) {
            return [
                'vehiculo' => $nombres[$movimiento->vehiculo_id] ?? '',
                'numeroEconomico' => $movimiento->vehiculo_id,
                'fechaHora' => $movimiento->created_at?->format('Y-m-d H:i'),
                'tipo' => $movimiento->tipo,
                'chofer' => $movimiento->chofer,
                'kilometraje' => $movimiento->kilometraje,
                'gasolina' => $movimiento->gasolina,
                'destino' => $movimiento->destino,
                'autoriza' => $movimiento->autoriza,
                'matricula' => $movimiento->matricula,
                'motivo' => $movimiento->motivo,
                'observaciones' => $movimiento->observaciones,
            ];
        });

        return response()->json($filas->values(), 200);
    }
```

`Validator`, `Vehiculo` y `movimientoVehiculo` ya están importados al principio del archivo; no hace falta añadir ningún `use`.

- [ ] **Step 4: Registrar la ruta**

En `routes/api.php`, dentro del grupo `prefix('VehiculoEolo')`, después de la línea de `index`:

```php
    Route::get('/Excel/', [VehiculoEoloController::class, 'obtenerExcel']);
```

- [ ] **Step 5: Correr la prueba y verla pasar**

```bash
TEST_TOKEN=903 php artisan test tests/Feature/MovimientosVehiculoEolo/ExcelVehiculosTest.php
```

Esperado: 15 pruebas en verde.

- [ ] **Step 6: Comprobar que las pruebas muerden**

Antes de dar la tarea por buena, verifica que tres de ellas no son decorativas. Quita temporalmente una cosa, corre **solo este archivo**, anota qué se pone en rojo, y restaura:

1. Quita `->orderBy('created_at', 'desc')` → debe fallar «ordena del movimiento más nuevo al más viejo».
2. Cambia `whereDate('created_at', '>=', ...)` por `'>'` → debe fallar «la fecha de inicio incluye el propio día».
3. Cambia `'vehiculos' => 'required|array|min:1'` por `'vehiculos' => 'nullable|array'` → deben fallar las dos pruebas de rechazo.

Si alguna no se pone en rojo, para y repórtalo: esa prueba no está probando lo que dice. Después de cada prueba, restaura el código y confirma con `git diff --stat` que el controlador queda intacto.

- [ ] **Step 7: Limpiar y commitear**

```bash
rm -rf storage/framework/testing/disks/public_test_903 storage/framework/testing/disks/local_test_903
git add app/Http/Controllers/Api/VehiculoEoloController.php routes/api.php tests/Feature/MovimientosVehiculoEolo/ExcelVehiculosTest.php
git commit -m "feat(vehiculos): endpoint que sirve los movimientos de varios vehiculos para el Excel"
```

---

### Task 2: El cliente de API y el servicio que arma el libro

**Files:**
- Modify: `resources/js/pages/seguridad/MovimientosVehiculoEolo/types.ts`
- Modify: `resources/js/stores/apiVehiculoEolo.ts`
- Create: `resources/js/pages/seguridad/MovimientosVehiculoEolo/excelVehiculosService.ts`

**Interfaces:**
- Consumes: `GET /api/VehiculoEolo/Excel/` de la Task 1, con sus doce claves exactas.
- Produces: los tipos `FilaExcelVehiculo` y `FiltrosExcelVehiculos` en `types.ts`; `apiVehiculoEolo.getExcel(vehiculoIds: string[], filtros?: FiltrosExcelVehiculos): Promise<FilaExcelVehiculo[]>`; y de `excelVehiculosService.ts`, la constante `COLUMNAS_EXCEL_VEHICULOS` y la función `descargarExcelVehiculos(filas: FilaExcelVehiculo[]): Promise<void>`. La Task 3 usa las tres cosas.

**Contexto:**

No hay ejecutor de pruebas de JavaScript en el proyecto, así que esta tarea no tiene ciclo TDD. Dilo así en el informe en vez de inventarte uno. La verificación es de tipos y compilación.

`apiVehiculoEolo.ts` tiene un `headers` de módulo que se construye una vez al importar:

```ts
const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-XSRF-TOKEN': getXsrfToken()
};
```

Las cuatro llamadas que ya existen lo reutilizan. `getExcel` hace lo mismo, por consistencia. **No lo reestructures**: que capture el token al importar es un comportamiento preexistente compartido por todo el archivo, y arreglarlo es una limpieza de ese archivo, no parte de esta funcionalidad.

`COLUMNAS_EXCEL_VEHICULOS` se exporta a propósito: el modal pinta la vista previa con la misma lista, así que la vista previa y el libro no pueden tener columnas distintas. Es el invariante de la spec hecho estructura en vez de disciplina.

- [ ] **Step 1: Ampliar `types.ts`**

Añadir al final de `resources/js/pages/seguridad/MovimientosVehiculoEolo/types.ts`:

```ts
/** Una fila del reporte, tal y como la sirve GET /api/VehiculoEolo/Excel/. */
export interface FilaExcelVehiculo {
    vehiculo: string;
    numeroEconomico: string;
    fechaHora: string;
    tipo: 'Entrada' | 'Salida';
    chofer: string;
    kilometraje: number;
    gasolina: string;
    destino: string | null;
    autoriza: string | null;
    matricula: string | null;
    motivo: string | null;
    observaciones: string | null;
}

export interface FiltrosExcelVehiculos {
    chofer?: string;
    tipo?: 'Entrada' | 'Salida' | 'Todos';
    fechaInicio?: string;
    fechaFin?: string;
}
```

- [ ] **Step 2: Añadir `getExcel` al cliente de API**

En `resources/js/stores/apiVehiculoEolo.ts`, ampliar el import del principio:

```ts
import { Vehiculo, FilaExcelVehiculo, FiltrosExcelVehiculos } from "@/pages/seguridad/MovimientosVehiculoEolo/types";
```

y añadir dentro del objeto `apiVehiculoEolo`, después de `cambiarActivo`:

```ts
    getExcel: async (
        vehiculoIds: string[],
        filtros: FiltrosExcelVehiculos = {},
    ): Promise<FilaExcelVehiculo[]> => {
        const params = new URLSearchParams();
        vehiculoIds.forEach(id => params.append('vehiculos[]', id));
        if (filtros.chofer) params.append('chofer', filtros.chofer);
        if (filtros.tipo && filtros.tipo !== 'Todos') params.append('tipo', filtros.tipo);
        if (filtros.fechaInicio) params.append('fecha_inicio', filtros.fechaInicio);
        if (filtros.fechaFin) params.append('fecha_fin', filtros.fechaFin);

        const response = await fetch(`/api/VehiculoEolo/Excel/?${params.toString()}`, {
            method: 'GET',
            headers: headers,
        });
        const result = await response.json();
        if (!response.ok) throw result;
        return result;
    },
```

`tipo: 'Todos'` no se manda: el servidor entiende la ausencia del parámetro como «sin filtrar», igual que `obtenerHistorial`.

- [ ] **Step 3: Escribir el servicio del libro**

Crear `resources/js/pages/seguridad/MovimientosVehiculoEolo/excelVehiculosService.ts`:

```ts
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { FilaExcelVehiculo } from './types';

/**
 * Las columnas del reporte, en orden. La vista previa del modal pinta esta misma
 * lista, así que lo que se ve y lo que se descarga no pueden divergir.
 */
export const COLUMNAS_EXCEL_VEHICULOS: {
    clave: keyof FilaExcelVehiculo;
    titulo: string;
    ancho: number;
}[] = [
    { clave: 'vehiculo', titulo: 'Vehículo', ancho: 18 },
    { clave: 'numeroEconomico', titulo: 'N. económico', ancho: 14 },
    { clave: 'fechaHora', titulo: 'Fecha y hora', ancho: 18 },
    { clave: 'tipo', titulo: 'Tipo', ancho: 10 },
    { clave: 'chofer', titulo: 'Chofer', ancho: 22 },
    { clave: 'kilometraje', titulo: 'Kilometraje', ancho: 13 },
    { clave: 'gasolina', titulo: 'Gasolina', ancho: 11 },
    { clave: 'destino', titulo: 'Destino', ancho: 26 },
    { clave: 'autoriza', titulo: 'Autoriza', ancho: 22 },
    { clave: 'matricula', titulo: 'Matrícula', ancho: 13 },
    { clave: 'motivo', titulo: 'Motivo', ancho: 22 },
    { clave: 'observaciones', titulo: 'Observaciones', ancho: 34 },
];

const nombreDelArchivo = (): string => {
    const hoy = new Date();
    const dia = String(hoy.getDate()).padStart(2, '0');
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');

    return `movimientos-vehiculos-${hoy.getFullYear()}-${mes}-${dia}.xlsx`;
};

export async function descargarExcelVehiculos(filas: FilaExcelVehiculo[]): Promise<void> {
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Movimientos');

    hoja.columns = COLUMNAS_EXCEL_VEHICULOS.map(columna => ({
        header: columna.titulo,
        key: columna.clave,
        width: columna.ancho,
    }));

    filas.forEach(fila => {
        const valores: Record<string, unknown> = {};

        COLUMNAS_EXCEL_VEHICULOS.forEach(columna => {
            valores[columna.clave] = fila[columna.clave] ?? '';
        });

        hoja.addRow(valores);
    });

    const encabezado = hoja.getRow(1);
    encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    encabezado.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF003E51' },
    };
    encabezado.alignment = { vertical: 'middle', horizontal: 'center' };
    encabezado.height = 22;

    hoja.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: COLUMNAS_EXCEL_VEHICULOS.length },
    };
    hoja.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await libro.xlsx.writeBuffer();

    saveAs(
        new Blob([buffer as ArrayBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        nombreDelArchivo(),
    );
}
```

El `as ArrayBuffer` es necesario: `writeBuffer()` devuelve el tipo `ExcelJS.Buffer`, que TypeScript no acepta directamente en el constructor de `Blob`.

La fecha del nombre se arma a mano en vez de con `toISOString()`, que da la fecha en UTC y adelantaría el día por la tarde en la zona horaria de México.

- [ ] **Step 4: Comprobar tipos y compilación**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Esperado: `1`, el error preexistente TS1117 en el `WalkAroundController.ts` generado. Si sube, los errores nuevos son de este cambio.

```bash
npm run build
```

Esperado: termina sin errores. Tarda un par de minutos; déjalo acabar.

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/seguridad/MovimientosVehiculoEolo/types.ts resources/js/stores/apiVehiculoEolo.ts resources/js/pages/seguridad/MovimientosVehiculoEolo/excelVehiculosService.ts
git commit -m "feat(vehiculos): cliente de API y servicio que arma el libro de Excel"
```

---

### Task 3: El modal de exportación

**Files:**
- Create: `resources/js/pages/seguridad/MovimientosVehiculoEolo/ExcelVehiculosModal.tsx`

**Interfaces:**
- Consumes: `apiVehiculoEolo.getExcel(vehiculoIds, filtros)`, `COLUMNAS_EXCEL_VEHICULOS`, `descargarExcelVehiculos(filas)`, y los tipos `Vehiculo`, `FilaExcelVehiculo`, `FiltrosExcelVehiculos` de la Task 2.
- Produces: el componente `ExcelVehiculosModal` con las props `{ isOpen: boolean; vehiculosSeleccionados: Vehiculo[]; onClose: () => void }`. La Task 4 lo monta.

**Contexto:**

Esta tarea crea el modal **completo pero todavía sin montar**: nadie lo renderiza hasta la Task 4. Eso es deliberado, para que el modal se pueda revisar por sí solo. Compila y pasa `tsc` igualmente.

Los cuatro filtros son los mismos de `HistorialVehiculo.tsx`, con su mismo aspecto. Así se ven allí:

```tsx
<div className="grid grid-cols-1 md:grid-cols-4 gap-3">
    <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
        <input
            type="text"
            placeholder="Chofer..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
        />
    </div>
    ...
</div>
```

**La diferencia que importa:** `HistorialVehiculo` recarga en un `useEffect` cada vez que cambia un filtro. Este modal **no**: solo consulta al pulsar «Consultar». Se reutilizan los campos, no el disparador.

Regla de seguridad del flujo: cambiar cualquier filtro borra las filas consultadas, de modo que el botón de descarga se apaga. Sin eso se podría descargar un archivo distinto del que se está viendo, que es justo lo que el invariante de la spec prohíbe.

- [ ] **Step 1: Escribir el componente**

Crear `resources/js/pages/seguridad/MovimientosVehiculoEolo/ExcelVehiculosModal.tsx`:

```tsx
import { useState } from 'react';
import { Search, X, FileSpreadsheet, Download } from 'lucide-react';
import { Vehiculo, FilaExcelVehiculo } from './types';
import { apiVehiculoEolo } from '@/stores/apiVehiculoEolo';
import { COLUMNAS_EXCEL_VEHICULOS, descargarExcelVehiculos } from './excelVehiculosService';

interface Props {
    isOpen: boolean;
    vehiculosSeleccionados: Vehiculo[];
    onClose: () => void;
}

/** Cuántas filas se pintan en la vista previa. La descarga siempre trae todas. */
const FILAS_VISTA_PREVIA = 100;

export const ExcelVehiculosModal = ({ isOpen, vehiculosSeleccionados, onClose }: Props) => {
    const [chofer, setChofer] = useState('');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [tipo, setTipo] = useState<'Todos' | 'Entrada' | 'Salida'>('Todos');
    const [filas, setFilas] = useState<FilaExcelVehiculo[] | null>(null);
    const [consultando, setConsultando] = useState(false);
    const [descargando, setDescargando] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) {
        return null;
    }

    /**
     * Cambiar un filtro invalida lo consultado: así no se puede descargar un archivo
     * distinto del que se está viendo.
     */
    const invalidarConsulta = () => {
        setFilas(null);
        setError('');
    };

    const limpiarFiltros = () => {
        setChofer('');
        setFechaInicio('');
        setFechaFin('');
        setTipo('Todos');
        setFilas(null);
        setError('');
    };

    const consultar = async () => {
        setConsultando(true);
        setError('');

        try {
            const resultado = await apiVehiculoEolo.getExcel(
                vehiculosSeleccionados.map(v => v.id),
                { chofer, tipo, fechaInicio, fechaFin },
            );
            setFilas(resultado);
        } catch (e: any) {
            setFilas(null);
            setError(e?.message || 'No fue posible consultar los movimientos.');
        } finally {
            setConsultando(false);
        }
    };

    const descargar = async () => {
        if (!filas || filas.length === 0) {
            return;
        }

        setDescargando(true);
        setError('');

        try {
            await descargarExcelVehiculos(filas);
        } catch (e: any) {
            setError(e?.message || 'No fue posible generar el archivo de Excel.');
        } finally {
            setDescargando(false);
        }
    };

    const filasVistaPrevia = (filas ?? []).slice(0, FILAS_VISTA_PREVIA);
    const hayFilas = filas !== null && filas.length > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="text-emerald-600" size={20} />
                        <h3 className="font-bold text-gray-800">
                            Exportar movimientos ({vehiculosSeleccionados.length}{' '}
                            {vehiculosSeleccionados.length === 1 ? 'vehículo' : 'vehículos'})
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <div className="p-4 border-b bg-white">
                    <div className="flex justify-between items-center mb-3">
                        <p className="text-xs text-gray-500">
                            {vehiculosSeleccionados.map(v => `${v.nombre} (${v.id})`).join(', ')}
                        </p>
                        <button
                            onClick={limpiarFiltros}
                            className="text-[10px] font-bold text-gray-400 hover:text-gray-600 tracking-wider"
                        >
                            LIMPIAR FILTROS
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                            <input
                                type="text"
                                placeholder="Chofer..."
                                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                value={chofer}
                                onChange={(e) => { setChofer(e.target.value); invalidarConsulta(); }}
                            />
                        </div>
                        <div className="flex items-center gap-2 md:col-span-2">
                            <input
                                type="date"
                                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-gray-600 bg-white"
                                value={fechaInicio}
                                onChange={(e) => { setFechaInicio(e.target.value); invalidarConsulta(); }}
                            />
                            <span className="text-gray-400 text-xs">-</span>
                            <input
                                type="date"
                                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-gray-600 bg-white"
                                value={fechaFin}
                                onChange={(e) => { setFechaFin(e.target.value); invalidarConsulta(); }}
                            />
                        </div>
                        <select
                            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-gray-600 bg-white cursor-pointer"
                            value={tipo}
                            onChange={(e) => { setTipo(e.target.value as 'Todos' | 'Entrada' | 'Salida'); invalidarConsulta(); }}
                        >
                            <option value="Todos">Todos los tipos</option>
                            <option value="Entrada">Entradas</option>
                            <option value="Salida">Salidas</option>
                        </select>
                        <button
                            onClick={consultar}
                            disabled={consultando}
                            className="px-4 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                        >
                            {consultando ? 'Consultando...' : 'Consultar'}
                        </button>
                    </div>
                </div>

                <div className="overflow-auto flex-1 bg-white p-4">
                    {error && (
                        <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
                            {error}
                        </div>
                    )}

                    {filas === null && !consultando && (
                        <p className="text-sm text-gray-400 italic">
                            Ajusta los filtros y pulsa «Consultar» para ver qué se va a exportar.
                        </p>
                    )}

                    {filas !== null && filas.length === 0 && (
                        <p className="text-sm text-gray-400 italic">
                            No hay movimientos con esos filtros.
                        </p>
                    )}

                    {hayFilas && (
                        <>
                            <p className="mb-3 text-xs text-gray-500">
                                Mostrando {filasVistaPrevia.length} de {filas!.length} movimientos.
                                La descarga incluye los {filas!.length}.
                            </p>
                            <table className="w-full text-left text-xs">
                                <thead className="bg-gray-100 border-b">
                                    <tr>
                                        {COLUMNAS_EXCEL_VEHICULOS.map(columna => (
                                            <th
                                                key={columna.clave}
                                                className="p-2 font-semibold text-gray-600 whitespace-nowrap"
                                            >
                                                {columna.titulo}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filasVistaPrevia.map((fila, indice) => (
                                        <tr key={indice} className="border-t border-gray-100">
                                            {COLUMNAS_EXCEL_VEHICULOS.map(columna => (
                                                <td key={columna.clave} className="p-2 text-gray-700">
                                                    {fila[columna.clave] ?? ''}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}
                </div>

                <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors"
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
};
```

- [ ] **Step 2: Comprobar tipos y compilación**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Esperado: `1`, el mismo error preexistente de siempre.

```bash
npm run build
```

Esperado: termina sin errores.

- [ ] **Step 3: Revisar a conciencia estos cuatro puntos**

El modal todavía no se puede probar a mano porque nadie lo monta. Léelo y confirma, apuntándolo en tu informe:

1. Cambiar cualquiera de los cuatro filtros deja `filas` en `null`, y por tanto apaga «Descargar Excel».
2. «Descargar Excel» está apagado mientras no haya al menos una fila consultada.
3. La cabecera de la vista previa y las celdas recorren la **misma** `COLUMNAS_EXCEL_VEHICULOS` que usa el servicio: no hay ninguna lista de columnas escrita dos veces.
4. Un fallo de red deja el modal abierto, con los filtros puestos y el mensaje a la vista.

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/seguridad/MovimientosVehiculoEolo/ExcelVehiculosModal.tsx
git commit -m "feat(vehiculos): modal de exportacion con filtros, vista previa y descarga"
```

---

### Task 4: Las casillas de la tabla y el botón «Excel»

**Files:**
- Modify: `resources/js/pages/seguridad/MovimientosVehiculoEolo/ControlVehiculos.tsx`
- Modify: `resources/js/pages/seguridad/MovimientosVehiculoEolo/TablaVehiculos.tsx`
- Modify: `resources/js/pages/seguridad/MovimientosVehiculoEolo/FilaVehiculo.tsx`

**Interfaces:**
- Consumes: `ExcelVehiculosModal` de la Task 3, con las props `{ isOpen, vehiculosSeleccionados, onClose }`.
- Produces: nada que otra tarea use. Esta es la que conecta todo.

**Contexto:**

La selección vive en `ControlVehiculos` como un `Set<string>` de ids, no en la fila. `fetchVehiculos()` recarga la lista entera tras cada movimiento y tras cada cambio de `activo`, así que un estado guardado dentro de `FilaVehiculo` se perdería en cada recarga. Con los ids en el padre, la selección sobrevive.

`ControlVehiculos` hoy tiene esta cabecera:

```tsx
<header className="mb-8 flex justify-between items-end">
    <div>
        <h1 className="text-2xl font-bold text-gray-800">
            Control de Bitácora: Entradas y Salidas
        </h1>
        <p className="text-gray-500">Gestión de flota vehicular</p>
    </div>
    <button
        onClick={() => setIsNuevoModalOpen(true)}
        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
    >
        <Plus size={18} />
        Nuevo Vehículo
    </button>
</header>
```

La casilla de cabecera tiene tres estados: vacía, marcada e **indeterminada**. El tercero no se puede poner por atributo en React, solo por propiedad del nodo, así que hace falta una `ref` y un `useEffect`.

`FilaVehiculo` envuelve su `<tr>` y el modal de historial en un fragmento. La celda de la casilla va como **primera** `<td>`, antes de la del vehículo; la fila pasa de cuatro celdas a cinco, y la cabecera de cinco columnas.

- [ ] **Step 1: La selección y el botón en `ControlVehiculos.tsx`**

Ampliar los imports del principio:

```tsx
import { Plus, FileSpreadsheet } from 'lucide-react';
```

y añadir, junto a los demás imports del módulo:

```tsx
import { ExcelVehiculosModal } from './ExcelVehiculosModal';
```

Añadir dos estados, después de `const [tipoAccion, setTipoAccion] = useState<'Salida' | 'Entrada'>('Salida');`:

```tsx
    const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
    const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
```

Añadir los dos manejadores y el derivado, después de `handleCambiarActivo`:

```tsx
    const alternarSeleccion = (id: string) => {
        setSeleccionados(previos => {
            const siguiente = new Set(previos);

            if (siguiente.has(id)) {
                siguiente.delete(id);
            } else {
                siguiente.add(id);
            }

            return siguiente;
        });
    };

    const alternarTodos = () => {
        setSeleccionados(previos =>
            previos.size === vehiculos.length ? new Set() : new Set(vehiculos.map(v => v.id)),
        );
    };

    const vehiculosSeleccionados = vehiculos.filter(v => seleccionados.has(v.id));
```

Sustituir el botón «Nuevo Vehículo» de la cabecera por los dos botones:

```tsx
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsExcelModalOpen(true)}
                            disabled={seleccionados.size === 0}
                            title={
                                seleccionados.size === 0
                                    ? 'Marca al menos un vehículo para exportar'
                                    : `Exportar ${seleccionados.size} vehículo(s)`
                            }
                            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-100"
                        >
                            <FileSpreadsheet size={18} />
                            Excel
                        </button>
                        <button
                            onClick={() => setIsNuevoModalOpen(true)}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                        >
                            <Plus size={18} />
                            Nuevo Vehículo
                        </button>
                    </div>
```

Pasar las props nuevas a la tabla:

```tsx
                        <TablaVehiculos
                            vehiculos={vehiculos}
                            onAccion={abrirModal}
                            puedeDesactivar={puedeDesactivar}
                            onCambiarActivo={handleCambiarActivo}
                            seleccionados={seleccionados}
                            onAlternarSeleccion={alternarSeleccion}
                            onAlternarTodos={alternarTodos}
                        />
```

Y montar el modal junto a los otros dos, al final del componente, después de `<ModalNuevoVehiculo ... />`:

```tsx
            <ExcelVehiculosModal
                isOpen={isExcelModalOpen}
                vehiculosSeleccionados={vehiculosSeleccionados}
                onClose={() => setIsExcelModalOpen(false)}
            />
```

- [ ] **Step 2: La columna y la casilla de cabecera en `TablaVehiculos.tsx`**

El archivo entero queda así:

```tsx
import { useEffect, useRef } from 'react';
import { Vehiculo } from './types';
import { FilaVehiculo } from './FilaVehiculo';

interface Props {
    vehiculos: Vehiculo[];
    onAccion: (vehiculo: Vehiculo, tipo: 'Salida' | 'Entrada') => void;
    puedeDesactivar: boolean;
    onCambiarActivo: (vehiculo: Vehiculo) => void;
    seleccionados: Set<string>;
    onAlternarSeleccion: (id: string) => void;
    onAlternarTodos: () => void;
}

export const TablaVehiculos = ({
    vehiculos,
    onAccion,
    puedeDesactivar,
    onCambiarActivo,
    seleccionados,
    onAlternarSeleccion,
    onAlternarTodos,
}: Props) => {
    const casillaTodos = useRef<HTMLInputElement>(null);
    const todosMarcados = vehiculos.length > 0 && seleccionados.size === vehiculos.length;
    const algunosMarcados = seleccionados.size > 0 && !todosMarcados;

    // El estado indeterminado no existe como atributo en React: solo se puede poner
    // sobre el nodo, de ahí la ref.
    useEffect(() => {
        if (casillaTodos.current) {
            casillaTodos.current.indeterminate = algunosMarcados;
        }
    }, [algunosMarcados]);

    return (
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
            <table className="w-full text-left">
                <thead className="bg-gray-100 border-b">
                    <tr>
                        <th className="p-4 w-12">
                            <input
                                ref={casillaTodos}
                                type="checkbox"
                                checked={todosMarcados}
                                onChange={onAlternarTodos}
                                title="Seleccionar todos"
                                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                        </th>
                        <th className="p-4 text-sm font-semibold text-gray-600">Vehículo / N. económico</th>
                        <th className="p-4 text-sm font-semibold text-gray-600">Estado</th>
                        <th className="p-4 text-sm font-semibold text-gray-600">Último Movimiento</th>
                        <th className="p-4 text-sm font-semibold text-gray-600 text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {vehiculos.map(v => (
                        <FilaVehiculo
                            key={v.id}
                            vehiculo={v}
                            onAccion={onAccion}
                            puedeDesactivar={puedeDesactivar}
                            onCambiarActivo={onCambiarActivo}
                            seleccionado={seleccionados.has(v.id)}
                            onAlternarSeleccion={() => onAlternarSeleccion(v.id)}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
};
```

- [ ] **Step 3: La celda de la casilla en `FilaVehiculo.tsx`**

Ampliar la interfaz de props:

```tsx
interface Props {
    vehiculo: Vehiculo;
    onAccion: (vehiculo: Vehiculo, tipo: 'Salida' | 'Entrada') => void;
    puedeDesactivar: boolean;
    onCambiarActivo: (vehiculo: Vehiculo) => void;
    seleccionado: boolean;
    onAlternarSeleccion: () => void;
}

export const FilaVehiculo = ({
    vehiculo,
    onAccion,
    puedeDesactivar,
    onCambiarActivo,
    seleccionado,
    onAlternarSeleccion,
}: Props) => {
```

E insertar una celda nueva como **primera** del `<tr>`, justo después de
`<tr className="border-t border-gray-100 hover:bg-gray-50 transition-all">` y antes de
la celda que empieza con `<td className="p-4 font-medium text-gray-700">`:

```tsx
                <td className="p-4 w-12">
                    <input
                        type="checkbox"
                        checked={seleccionado}
                        onChange={onAlternarSeleccion}
                        title={`Seleccionar ${vehiculo.nombre}`}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                </td>
```

No cambies nada más del archivo: las cuatro acciones, la insignia de desactivado y el modal de historial se quedan como están.

- [ ] **Step 4: Comprobar tipos y compilación**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Esperado: `1`.

```bash
npm run build
```

Esperado: termina sin errores.

- [ ] **Step 5: Revisar estos cinco puntos en tu propio diff**

1. La cabecera tiene cinco `<th>` y la fila cinco `<td>`.
2. La casilla de cabecera sale marcada solo cuando están todos, e indeterminada cuando hay algunos pero no todos.
3. Con la tabla vacía, `todosMarcados` es `false` (de ahí el `vehiculos.length > 0`), y no una casilla marcada sobre cero filas.
4. El botón «Excel» está apagado con cero seleccionados y encendido con uno.
5. La selección se guarda por id, así que sobrevive a la recarga que hace `fetchVehiculos()`.

- [ ] **Step 6: Commit**

```bash
git add resources/js/pages/seguridad/MovimientosVehiculoEolo/ControlVehiculos.tsx resources/js/pages/seguridad/MovimientosVehiculoEolo/TablaVehiculos.tsx resources/js/pages/seguridad/MovimientosVehiculoEolo/FilaVehiculo.tsx
git commit -m "feat(vehiculos): casillas de seleccion en la tabla y boton Excel"
```

---

### Task 5: La suite entera y la pantalla de verdad

**Files:**
- Test: toda la suite; después, la pantalla en un navegador

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada.

**Contexto:**

El endpoint nuevo no cambia ninguna respuesta existente, así que no se esperan efectos a distancia. Esta tarea está para confirmarlo y para mirar la pantalla una vez, que es lo único que ninguna prueba de este proyecto cubre.

- [ ] **Step 1: Correr la suite entera, en serie**

```bash
TEST_TOKEN=904 php artisan test
```

**Nunca con `--parallel`.** Esperado: 2444 pruebas de antes más las 15 de la Task 1, sin ningún fallo. Tarda unos seis minutos; déjalo acabar.

Después:

```bash
rm -rf storage/framework/testing/disks/public_test_904 storage/framework/testing/disks/local_test_904
```

- [ ] **Step 2: Si algo falla**

Lee el fallo antes de tocar nada. Si no tiene relación con vehículos, comprueba si ya venía fallando, en un árbol aparte y sin tocar el de trabajo:

```bash
git worktree add ../eolo-base cc00a17
cd ../eolo-base && TEST_TOKEN=905 php artisan test --filter=NombreDeLaPrueba
```

Si allí también falla, es previo: anótalo y sigue. Límpialo con `git worktree remove ../eolo-base`.

- [ ] **Step 3: Abrir la pantalla en el navegador**

Hay dos trampas conocidas en este entorno, y las dos dan síntomas que parecen defectos del código:

- El preview arranca desde `C:\xampp\htdocs\EOLO` (el **padre**), así que lee `EOLO/.claude/launch.json`, **no** el de `Eolo-plus/`.
- Sanctum solo considera *stateful* los orígenes `localhost`, `localhost:3000`, `127.0.0.1`, `127.0.0.1:8000`, `::1` y el host de `APP_URL`. En cualquier otro puerto, `/api/*` responde **401** y las tablas salen vacías.

Receta: edita `C:\xampp\htdocs\EOLO\.claude\launch.json` para que sirva en el **puerto 3000**, arranca el preview y entra por `http://localhost:3000`. **Devuelve el archivo a 8000 al terminar.**

Entra como `Administrador EOLO` con la contraseña del seeder (`AdminUserSeeder`). Fortify autentica por `name`, no por correo.

- [ ] **Step 4: Comprobar en pantalla, sin escribir nada**

La base de desarrollo es la de verdad, con los 6 vehículos y ~1389 movimientos. **Verifica leyendo, no pulsando nada que escriba.** Exportar es de solo lectura, así que todo esto es seguro:

1. La columna de casillas sale la primera, antes de «Vehículo / N. económico».
2. Con cero marcados, el botón «Excel» está apagado.
3. Al marcar uno, se enciende.
4. La casilla de cabecera queda indeterminada con algunos marcados y marcada con todos.
5. Abre el modal, pulsa «Consultar» sin filtros y comprueba que la cabecera dice «Mostrando 100 de N movimientos» con una N creíble.
6. Cambia un filtro sin volver a consultar: «Descargar Excel» debe apagarse.
7. Vuelve a consultar y descarga. Abre el archivo: una hoja, doce columnas, encabezado fijo y autofiltro.

Haz una captura de la tabla con el modal abierto y la vista previa cargada, y adjúntala al informe.

- [ ] **Step 5: Informe**

No hay nada que commitear si todo salió verde y no tocaste nada: dilo explícitamente en vez de inventarte un commit. Si tuviste que arreglar alguna prueba, commitea con:

```bash
git add -A
git commit -m "test: ajusta las pruebas afectadas por el endpoint de Excel"
```

---

## Qué queda fuera, a propósito

- **Emparejar salidas con entradas en viajes.** Un renglón por movimiento, que es lo pedido.
- **Las evidencias fotográficas.** No caben en una celda y son el motivo del trabajo de disco que este endpoint evita.
- **Rastro en bitácora de quién exportó.** Ninguna exportación del proyecto lo deja.
- **Candado de rol sobre la exportación.** Es la misma información que ya está en pantalla. Si el departamento cambia de opinión, es un `hasAnyRole` y una prueba.
- **Programar el reporte o mandarlo por correo.**
