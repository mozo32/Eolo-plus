# Entrega de Turno de Seguridad v3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quitar el puesto —caseta y plataforma— del relevo de turno de Seguridad, dejar un documento por registro sin agrupar por fecha, y que el texto de cero diga que no hay movimientos.

**Architecture:** El `index` pasa de paginar días a paginar relevos, lo que borra cuatro métodos privados del controlador en vez de añadir código. Una migración suelta el índice compuesto, borra la columna `seccion`, crea un índice sobre `fecha_hora` sola y reescribe el texto de los resúmenes ya congelados. En el front, `FilaRelevo` se vuelve plana y el modal que preguntaba por cuál puesto actuar desaparece.

**Tech Stack:** Laravel 12, Inertia 2, React 19, TypeScript, Tailwind 4, Pest 3, MySQL (`eolo_plus`) y sqlite en las pruebas.

**Spec:** `docs/superpowers/specs/2026-11-18-entrega-turno-seguridad-v3-design.md`

## Global Constraints

- Las pruebas corren **en serie**: `php artisan test`. **Nunca `--parallel`** (da rojos falsos en este proyecto).
- `php artisan test 2>&1 | tail` devuelve el código de salida de `tail` y **esconde los fallos**: leer siempre `${PIPESTATUS[0]}`.
- **No correr `vendor/bin/pint`, `prettier` ni `npm run lint`**, aunque el CLAUDE.md pida pint.
- **No usar `git stash`**: hay tres stashes guardados que no son de este trabajo.
- **No usar `git add -A` ni `git add .`**: `CLAUDE.md`, `boost.json`, `.claude/` y `.env.respaldo-antes-de-fact-fbo-prod` son locales y deben seguir sin seguimiento. Se añade archivo por archivo.
- `resources/js/routes/` está en `.gitignore` y lo genera `php artisan wayfinder:generate --with-form`. Este plan no toca rutas, así que no hace falta regenerar.
- **`eolo_plus` es la base real del usuario.** Leerla sí; escribirla no. **`php artisan migrate` necesita permiso explícito del usuario** y es el paso 5 de la Tarea 5, no un paso de la Tarea 3.
- **Nunca `migrate:fresh`, `migrate:refresh` ni `db:wipe`.** No hay `.env.testing`, así que `--env=testing` **no** cambia de conexión.
- **Sin factories** salvo `UserFactory`: las filas se crean con `Modelo::create([...])`.
- Nada de clases `dark:` en los componentes de Seguridad: el módulo no las usa.
- Evitar `sed` para editar PHP y TSX. Se usa Edit.
- Los archivos de código se quedan por debajo de 300 líneas (las pruebas están exentas). `EntregaTurnoSeguridadController.php` ya nace con 611 y este plan lo baja a ~490: sigue por encima, es deuda previa y **no se arregla aquí**.
- No hay runner de pruebas de JavaScript. La evidencia del front es `npx tsc --noEmit` con **exactamente un** error de base —`TS1117` en `resources/js/actions/App/Http/Controllers/Api/WalkAroundController.ts:905`, generado por Wayfinder y previo a este trabajo— y `npm run build` con salida 0.
- **Entre la Tarea 2 y la Tarea 4 la pantalla queda rota** a propósito: el servidor ya manda renglones planos y el front todavía espera `caseta`/`plataforma`. Es una rama de trabajo sin despliegue; la Tarea 5 comprueba que al final funciona.
- El directorio real es `resources/js/pages/seguridad/` **en minúsculas**, aunque Windows acepte las dos formas.

---

### Task 1: El texto de cero dice que no hay movimientos

Es la única parte independiente de todo lo demás: no toca el puesto ni el listado.

**Files:**
- Modify: `app/Support/ResumenDelDiaSeguridad.php:134` y `:154`
- Test: `tests/Feature/EntregaTurnoSeguridad/ResumenDelDiaTest.php:235` y `:256`

**Interfaces:**
- Consumes: nada de otras tareas.
- Produces: las dos frases nuevas, `'No hay movimientos'` y `'No hay pernoctas'`, que la migración de la Tarea 3 usa para reescribir lo congelado.

- [ ] **Step 1: Cambiar las dos aserciones a lo que todavía no existe**

En `tests/Feature/EntregaTurnoSeguridad/ResumenDelDiaTest.php`, en el dataset de `'el texto de un renglon de dos lados'`:

```php
})->with([
    'ninguno' => [0, 0, 'No hay movimientos'],
    'uno de cada' => [1, 1, '1 entrada y 1 salida'],
    'varios' => [3, 2, '3 entradas y 2 salidas'],
    'solo entradas' => [2, 0, '2 entradas y 0 salidas'],
]);
```

Y en el de `'el texto de la pernocta distingue ninguna, una y varias'`:

```php
})->with([
    'ninguna' => [0, 'No hay pernoctas'],
    'una' => [1, '1 aeronave'],
    'varias' => [4, '4 aeronaves'],
]);
```

En el comentario de la línea 223 dice «la prueba del "Sin registros"». Cambiarlo a «la prueba del "No hay movimientos"».

- [ ] **Step 2: Correr y ver los dos rojos**

```bash
php artisan test tests/Feature/EntregaTurnoSeguridad/ResumenDelDiaTest.php
```

Esperado: FALLA. Dos casos de dataset —`ninguno` y `ninguna`— con «expected 'No hay movimientos', got 'Sin registros'» y su equivalente de pernocta. El resto pasa.

- [ ] **Step 3: Cambiar las dos frases**

En `app/Support/ResumenDelDiaSeguridad.php`, dentro de `dosLados()`:

```php
            'texto' => $entradas === 0 && $salidas === 0
                ? 'No hay movimientos'
                : sprintf(
```

Y dentro de `pernocta()`:

```php
            'texto' => match (true) {
                $total === 0 => 'No hay pernoctas',
                $total === 1 => '1 aeronave',
                default => $total.' aeronaves',
            },
```

La pernocta **no** dice «No hay movimientos» a propósito: una aeronave que se queda a dormir no se mueve. Añadir ese porqué como comentario de una línea sobre el `match`.

- [ ] **Step 4: Correr y ver verde**

```bash
php artisan test tests/Feature/EntregaTurnoSeguridad/ResumenDelDiaTest.php
```

Esperado: PASA, todos los casos.

- [ ] **Step 5: Correr lo que depende del texto**

```bash
php artisan test tests/Feature/EntregaTurnoSeguridad
```

Esperado: PASA. Si algo falla aquí es que otra prueba afirmaba la frase vieja sin que el grep la encontrara; se corrige en esa prueba, no revirtiendo el cambio.

- [ ] **Step 6: Commit**

```bash
git add app/Support/ResumenDelDiaSeguridad.php tests/Feature/EntregaTurnoSeguridad/ResumenDelDiaTest.php
git commit -m "feat(seguridad): el resumen dice que no hay movimientos en vez de sin registros"
```

---

### Task 2: El listado pagina relevos en vez de días

Esta tarea va **antes** de borrar la columna, y no después, por una razón concreta: si se borrara primero, `ListadoPorDiaTest` —cuyo contrato entero es el agrupamiento— se quedaría rojo durante toda una tarea. Aquí la columna sigue existiendo y sigue escribiéndose; lo que cambia es que el listado deja de mirarla.

**Files:**
- Modify: `app/Http/Controllers/Api/EntregaTurnoSeguridadController.php` (`index`, `consultaFiltrada`; se borran `filasDeLosDias`, `seccionDelDia`, `diasSinFirmaDe`, `diasIncompletos` y la constante `DIA`)
- Delete: `tests/Feature/EntregaTurnoSeguridad/ListadoPorDiaTest.php`
- Create: `tests/Feature/EntregaTurnoSeguridad/ListadoDeRelevosTest.php`

**Interfaces:**
- Consumes: `pernoctaDe()` del propio controlador, que no cambia; `EntregaTurnoSeguridad::firmasFaltantes()` y `::ROLES_DE_CIERRE`.
- Produces: la forma nueva de `GET /api/EntregaTurnoSeguridad`, que la Tarea 4 consume desde el front:

```json
{ "id": 12, "fecha": "2026-11-18", "hora": "14:30", "nombre": "Juan Pérez", "firmas_faltantes": ["fbo"], "pernocta": 7 }
```

- [ ] **Step 1: Escribir la prueba nueva del listado**

Crear `tests/Feature/EntregaTurnoSeguridad/ListadoDeRelevosTest.php`. El ayudante **todavía manda `seccion`** porque la columna sigue siendo `NOT NULL` sin valor por omisión: la Tarea 3 borra esa línea.

```php
<?php

use App\Models\EntregaTurnoSeguridad;
use App\Models\Firma;
use App\Models\PernoctaDia;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/*
 * El listado pagina RELEVOS: un renglón por registro. Antes paginaba días y
 * combinaba los dos puestos en una fila; la v3 quitó el puesto, así que ya no
 * hay nada que combinar.
 */

function relevoDeListado(string $dia, string $hora = '07:30', array $extra = []): EntregaTurnoSeguridad
{
    return EntregaTurnoSeguridad::create(array_merge([
        'user_id' => User::factory()->create()->id,
        'fecha_hora' => "{$dia} {$hora}:00",
        // La columna `seccion` sigue siendo NOT NULL hasta la migración de la v3.
        'seccion' => EntregaTurnoSeguridad::SECCION_CASETA,
    ], $extra));
}

/**
 * Firma un relevo con el rol que se le diga.
 *
 * El rol es un parámetro y no una constante escondida: con un ayudante que
 * solo supiera firmar como FBO, el distintivo de «falta jefe de área» no
 * tendría quien lo vigilara.
 */
function firmarRelevoDeListado(EntregaTurnoSeguridad $relevo, string $rol): void
{
    $firma = Firma::create([
        'disk' => 'public',
        'path' => 'firmas/prueba/'.$rol.'-'.$relevo->id.'.png',
        'original_name' => $rol.'.png',
        'mime' => 'image/png',
        'size' => 10,
        'sha1' => sha1($rol.$relevo->id),
    ]);

    $relevo->firmas()->attach($firma->id, [
        'rol' => $rol,
        'orden' => 0,
        'status' => 'A',
    ]);
}

function listado(array $parametros = []): \Illuminate\Testing\TestResponse
{
    return test()->actingAs(User::factory()->create())
        ->getJson('/api/EntregaTurnoSeguridad?'.http_build_query($parametros));
}

test('el renglon es un relevo y trae sus seis claves', function () {
    relevoDeListado('2026-11-09', '14:30');

    $fila = listado()->assertSuccessful()->json('data.0');

    expect($fila)->toHaveKeys(['id', 'fecha', 'hora', 'nombre', 'firmas_faltantes', 'pernocta'])
        ->and($fila)->not->toHaveKey('caseta')
        ->and($fila)->not->toHaveKey('plataforma')
        ->and($fila)->not->toHaveKey('extras')
        ->and($fila['fecha'])->toBe('2026-11-09')
        ->and($fila['hora'])->toBe('14:30');
});

test('el nombre es el de quien entrego', function () {
    $usuario = User::factory()->create(['name' => 'Juan Pérez']);
    relevoDeListado('2026-11-09', '07:30', ['user_id' => $usuario->id]);

    expect(listado()->json('data.0.nombre'))->toBe('Juan Pérez');
});

test('dos relevos del mismo dia son dos renglones', function () {
    // Es lo contrario de lo que pedía la v2, y es lo pedido: sin puesto, dos
    // registros del mismo día son dos documentos y el total cuenta relevos.
    relevoDeListado('2026-11-09', '07:30');
    relevoDeListado('2026-11-09', '19:00');

    $respuesta = listado()->assertSuccessful();

    expect($respuesta->json('data'))->toHaveCount(2)
        ->and($respuesta->json('meta.total'))->toBe(2);
});

test('los relevos salen del mas reciente al mas viejo, tambien dentro del dia', function () {
    relevoDeListado('2026-11-01', '07:30');
    relevoDeListado('2026-11-04', '07:30');
    relevoDeListado('2026-11-04', '19:00');
    relevoDeListado('2026-11-02', '07:30');

    $renglones = listado()->json('data');

    expect(array_column($renglones, 'fecha'))
        ->toBe(['2026-11-04', '2026-11-04', '2026-11-02', '2026-11-01'])
        ->and(array_column($renglones, 'hora'))
        ->toBe(['19:00', '07:30', '07:30', '07:30']);
});

test('la hora viene en 24 horas', function () {
    relevoDeListado('2026-11-09', '19:45');

    expect(listado()->json('data.0.hora'))->toBe('19:45');
});

test('un relevo retirado no aparece', function () {
    relevoDeListado('2026-11-04', '07:30', ['status' => 'N']);

    expect(listado()->json('data'))->toBe([])
        ->and(listado()->json('meta.total'))->toBe(0);
});

test('sin registros el listado viene vacio y no revienta', function () {
    $respuesta = listado()->assertSuccessful();

    expect($respuesta->json('data'))->toBe([])
        ->and($respuesta->json('meta.total'))->toBe(0);
});

test('la paginacion cuenta relevos', function () {
    foreach (range(1, 11) as $dia) {
        relevoDeListado(Carbon::parse('2026-11-01')->addDays($dia - 1)->toDateString());
    }

    $respuesta = listado(['per_page' => 10])->assertSuccessful();

    expect($respuesta->json('data'))->toHaveCount(10)
        ->and($respuesta->json('meta.total'))->toBe(11)
        ->and($respuesta->json('meta.last_page'))->toBe(2);
});

test('per_page tiene techo: no se puede pedir la tabla entera de un jalon', function () {
    relevoDeListado('2026-11-04');

    expect(listado(['per_page' => 100000])->json('meta.per_page'))->toBe(100);
});

test('per_page tiene piso: el cero y los negativos dan uno', function (int $pedido) {
    relevoDeListado('2026-11-04');

    expect(listado(['per_page' => $pedido])->json('meta.per_page'))->toBe(1);
})->with([0, -5]);

test('el buscador filtra por el nombre de quien entrego', function () {
    $ana = User::factory()->create(['name' => 'Ana López']);
    $beto = User::factory()->create(['name' => 'Beto Ruiz']);

    relevoDeListado('2026-11-09', '07:30', ['user_id' => $ana->id]);
    relevoDeListado('2026-11-08', '07:30', ['user_id' => $beto->id]);

    expect(array_column(listado(['search' => 'Ana'])->json('data'), 'nombre'))->toBe(['Ana López']);
});

test('el rango de fechas incluye sus dos bordes', function () {
    relevoDeListado('2026-11-01');
    relevoDeListado('2026-11-04');
    relevoDeListado('2026-11-08');

    $fechas = array_column(
        listado(['fecha_inicio' => '2026-11-01', 'fecha_fin' => '2026-11-04'])->json('data'),
        'fecha'
    );

    expect($fechas)->toBe(['2026-11-04', '2026-11-01']);
});

test('el renglon dice que firmas le faltan, en orden', function () {
    relevoDeListado('2026-11-09');

    expect(listado()->json('data.0.firmas_faltantes'))->toBe(['jefe_area', 'fbo']);
});

test('con solo la firma del jefe queda faltando la del fbo', function () {
    firmarRelevoDeListado(relevoDeListado('2026-11-09'), EntregaTurnoSeguridad::ROL_JEFE_AREA);

    expect(listado()->json('data.0.firmas_faltantes'))->toBe(['fbo']);
});

test('con las dos firmas de cierre la lista de faltantes queda vacia', function () {
    $relevo = relevoDeListado('2026-11-09');
    firmarRelevoDeListado($relevo, EntregaTurnoSeguridad::ROL_JEFE_AREA);
    firmarRelevoDeListado($relevo, EntregaTurnoSeguridad::ROL_FBO);

    expect(listado()->json('data.0.firmas_faltantes'))->toBe([]);
});

test('el filtro de estado juzga cada relevo por su cuenta', function () {
    // Mismo día, dos relevos: uno firmado por los dos y otro sin nada. El
    // filtro por día daba el día entero por incompleto o por completo; ahora
    // cada renglón responde por sí mismo.
    $completo = relevoDeListado('2026-11-09', '07:30');
    firmarRelevoDeListado($completo, EntregaTurnoSeguridad::ROL_JEFE_AREA);
    firmarRelevoDeListado($completo, EntregaTurnoSeguridad::ROL_FBO);

    $pelado = relevoDeListado('2026-11-09', '19:00');

    expect(array_column(listado(['estado' => 'completas'])->json('data'), 'id'))->toBe([$completo->id])
        ->and(array_column(listado(['estado' => 'falta_jefe_area'])->json('data'), 'id'))->toBe([$pelado->id])
        ->and(array_column(listado(['estado' => 'falta_fbo'])->json('data'), 'id'))->toBe([$pelado->id]);
});

test('completas pide las DOS firmas de cierre, no una', function () {
    firmarRelevoDeListado(relevoDeListado('2026-11-09'), EntregaTurnoSeguridad::ROL_JEFE_AREA);

    expect(listado(['estado' => 'completas'])->json('meta.total'))->toBe(0)
        ->and(listado(['estado' => 'falta_fbo'])->json('meta.total'))->toBe(1)
        ->and(listado(['estado' => 'falta_jefe_area'])->json('meta.total'))->toBe(0);
});

test('una firma retirada no cuenta como puesta', function () {
    // `firmas()` filtra el pivote por `A`. Sin eso, un relevo al que le
    // retiraron la firma del FBO saldría como completo.
    $relevo = relevoDeListado('2026-11-09');
    firmarRelevoDeListado($relevo, EntregaTurnoSeguridad::ROL_JEFE_AREA);
    firmarRelevoDeListado($relevo, EntregaTurnoSeguridad::ROL_FBO);

    DB::table('firmables')
        ->where('firmable_id', $relevo->id)
        ->where('rol', EntregaTurnoSeguridad::ROL_FBO)
        ->update(['status' => 'N']);

    expect(listado()->json('data.0.firmas_faltantes'))->toBe(['fbo'])
        ->and(listado(['estado' => 'completas'])->json('meta.total'))->toBe(0);
});

test('el estado solo admite sus tres valores', function () {
    listado(['estado' => 'cualquiera'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('estado');
});

test('un filtro en forma de arreglo se rechaza con 422, no con 500', function (string $campo) {
    test()->actingAs(User::factory()->create())
        ->getJson("/api/EntregaTurnoSeguridad?{$campo}[]=x")
        ->assertStatus(422);
})->with(['search', 'estado']);

test('el relevo trae la pernocta del dia en vivo', function () {
    PernoctaDia::create(['fecha' => '2026-11-09', 'matricula' => 'XA-UNO']);
    PernoctaDia::create(['fecha' => '2026-11-09', 'matricula' => 'XA-DOS']);
    PernoctaDia::create(['fecha' => '2026-11-08', 'matricula' => 'XA-TRE']);

    relevoDeListado('2026-11-09');

    expect(listado()->json('data.0.pernocta'))->toBe(2);
});

test('el relevo congelado trae la pernocta que se guardo, no la de hoy', function () {
    $relevo = relevoDeListado('2026-11-09');
    $relevo->update(['resumen' => [
        ['clave' => 'pernocta', 'titulo' => 'Pernocta del día', 'texto' => '9 aeronaves', 'total' => 9],
    ]]);

    PernoctaDia::create(['fecha' => '2026-11-09', 'matricula' => 'XA-UNO']);

    expect(listado()->json('data.0.pernocta'))->toBe(9);
});

test('la pernocta de la pagina se pide en una sola consulta', function () {
    // Veinte relevos en diez días. Si el controlador llamara al servicio del
    // resumen por renglón serían nueve consultas por relevo, y nadie lo vería
    // hasta que la tabla creciera.
    for ($dia = 1; $dia <= 10; $dia++) {
        $fecha = sprintf('2026-11-%02d', $dia);
        relevoDeListado($fecha, '07:30');
        relevoDeListado($fecha, '19:00');
    }

    $usuario = User::factory()->create();

    DB::enableQueryLog();

    test()->actingAs($usuario)
        ->getJson('/api/EntregaTurnoSeguridad?per_page=10')
        ->assertSuccessful();

    $consultas = count(DB::getQueryLog());
    DB::disableQueryLog();

    expect($consultas)->toBeLessThan(10);
});
```

- [ ] **Step 2: Borrar la prueba vieja**

```bash
git rm tests/Feature/EntregaTurnoSeguridad/ListadoPorDiaTest.php
```

Sus 33 pruebas vigilaban el agrupamiento: días que no se parten, dos secciones en un renglón, `extras`, el filtro de puesto. Nada de eso existe en la v3. Lo que sí valía la pena —orden, piso y techo de `per_page`, buscador, bordes del rango, firmas faltantes, pernocta congelada, cuenta de consultas— está reescrito en el paso 1. **No se borra ninguna otra prueba del directorio.**

- [ ] **Step 3: Correr y ver el rojo**

```bash
php artisan test tests/Feature/EntregaTurnoSeguridad/ListadoDeRelevosTest.php
```

Esperado: FALLA. La mayoría por `toHaveKeys` sobre un renglón que todavía trae `fecha`, `caseta` y `plataforma`; los de estado por juzgar por día.

- [ ] **Step 4: Reescribir el `index`**

En `app/Http/Controllers/Api/EntregaTurnoSeguridadController.php`, sustituir el método `index` y los métodos privados `filasDeLosDias` y `seccionDelDia` por:

```php
    /** `consultaFiltrada()` sigue pidiendo un `Request`: un Form Request lo es. */
    public function index(IndexEntregaTurnoSeguridadRequest $request): JsonResponse
    {
        /*
         * El techo es tan necesario como el piso: sin él, un `per_page=100000`
         * arrastra toda la tabla con sus firmas.
         */
        $porPagina = min(100, max(1, (int) $request->integer('per_page', 10)));

        $relevos = $this->consultaFiltrada($request)
            ->with(['usuario:id,name', 'firmas'])
            ->orderByDesc('fecha_hora')
            ->orderByDesc('id')
            ->paginate($porPagina);

        return response()->json([
            'data' => $this->renglones($relevos->getCollection()),
            'meta' => [
                'current_page' => $relevos->currentPage(),
                'last_page' => $relevos->lastPage(),
                'per_page' => $relevos->perPage(),
                'total' => $relevos->total(),
            ],
        ]);
    }

    /**
     * Un renglón por relevo.
     *
     * @param  Collection<int, EntregaTurnoSeguridad>  $relevos
     * @return list<array{id: int, fecha: string, hora: string, nombre: string, firmas_faltantes: list<string>, pernocta: int}>
     */
    private function renglones(Collection $relevos): array
    {
        $pernoctas = $this->pernoctasDeLaPagina($relevos);

        return $relevos
            ->map(fn (EntregaTurnoSeguridad $relevo): array => [
                'id' => $relevo->id,
                'fecha' => $relevo->fecha_hora->toDateString(),
                'hora' => $relevo->fecha_hora->format('H:i'),
                'nombre' => $relevo->usuario?->name ?? '',
                'firmas_faltantes' => $relevo->firmasFaltantes(),
                'pernocta' => $this->pernoctaDe(
                    $relevo,
                    (int) ($pernoctas[$relevo->fecha_hora->toDateString()] ?? 0),
                ),
            ])
            ->values()
            ->all();
    }

    /**
     * La pernocta de cada día de la página, en UNA consulta.
     *
     * Se pide por fecha y no por relevo a propósito: llamar al servicio del
     * resumen por renglón son nueve consultas cada uno, noventa para pintar
     * diez. Si la página sale vacía no se consulta nada.
     *
     * @param  Collection<int, EntregaTurnoSeguridad>  $relevos
     * @return Collection<string, int>
     */
    private function pernoctasDeLaPagina(Collection $relevos): Collection
    {
        $fechas = $relevos
            ->map(static fn (EntregaTurnoSeguridad $relevo): string => $relevo->fecha_hora->toDateString())
            ->unique()
            ->values()
            ->all();

        if ($fechas === []) {
            return collect();
        }

        return PernoctaDia::query()
            ->whereIn('fecha', $fechas)
            ->selectRaw('fecha, COUNT(*) as total')
            ->groupBy('fecha')
            ->pluck('total', 'fecha');
    }
```

Borrar también la constante `private const DIA` y su comentario: nadie la usa ya.

- [ ] **Step 5: Reescribir el filtro de estado y quitar el de puesto**

En el mismo archivo, dentro de `consultaFiltrada`, borrar el bloque `if ($request->filled('seccion'))` completo y sustituir los tres `if` del estado por:

```php
        $estado = $request->string('estado')->toString();

        /*
         * El estado se juzga por RELEVO y no por día. Antes se calculaba por
         * día porque el día tenía dos puestos y uno firmado no hacía completo
         * al otro; sin puesto, cada relevo responde por sí mismo. Los
         * `whereHas` heredan el `wherePivot('status', 'A')` de `firmas()`, así
         * que una firma retirada no cuenta como puesta.
         */
        if ($estado === 'falta_jefe_area') {
            $query->whereDoesntHave(
                'firmas',
                static fn (Builder $firma): Builder => $firma->where('firmables.rol', EntregaTurnoSeguridad::ROL_JEFE_AREA)
            );
        }

        if ($estado === 'falta_fbo') {
            $query->whereDoesntHave(
                'firmas',
                static fn (Builder $firma): Builder => $firma->where('firmables.rol', EntregaTurnoSeguridad::ROL_FBO)
            );
        }

        if ($estado === 'completas') {
            foreach (EntregaTurnoSeguridad::ROLES_DE_CIERRE as $rol) {
                $query->whereHas(
                    'firmas',
                    static fn (Builder $firma): Builder => $firma->where('firmables.rol', $rol)
                );
            }
        }
```

Y borrar los métodos privados `diasSinFirmaDe()` y `diasIncompletos()` con sus docblocks.

- [ ] **Step 6: Correr y ver verde**

```bash
php artisan test tests/Feature/EntregaTurnoSeguridad/ListadoDeRelevosTest.php
```

Esperado: PASA. Si queda rojo `la pernocta de la pagina se pide en una sola consulta`, contar las consultas del log antes de subir el límite: lo esperado son unas seis —sesión, cuenta, relevos, usuarios, firmas, pernoctas—.

- [ ] **Step 7: Correr el módulo entero**

```bash
php artisan test tests/Feature/EntregaTurnoSeguridad
```

Esperado: PASA. La columna `seccion` sigue existiendo y escribiéndose, así que las otras ocho pruebas no se enteran de nada.

- [ ] **Step 8: Commit**

```bash
git add app/Http/Controllers/Api/EntregaTurnoSeguridadController.php tests/Feature/EntregaTurnoSeguridad/ListadoDeRelevosTest.php tests/Feature/EntregaTurnoSeguridad/ListadoPorDiaTest.php
git commit -m "feat(seguridad): el listado del relevo pagina registros y no dias"
```

---

### Task 3: Fuera el puesto

**Files:**
- Create: `database/migrations/2026_11_18_120000_v3_entrega_turno_seguridad_sin_seccion.php`
- Modify: `app/Models/EntregaTurnoSeguridad.php`
- Modify: `app/Http/Controllers/Api/EntregaTurnoSeguridadController.php` (`detalle`, `pendientes`)
- Modify: `app/Http/Requests/EntregaTurnoSeguridad/IndexEntregaTurnoSeguridadRequest.php`
- Modify: `app/Http/Requests/EntregaTurnoSeguridad/StoreEntregaTurnoSeguridadRequest.php`
- Modify: `app/Http/Requests/EntregaTurnoSeguridad/UpdateEntregaTurnoSeguridadRequest.php`
- Test: `EsquemaV2Test.php`, `ModeloEntregaTurnoSeguridadTest.php`, `CrearRelevoTest.php`, `EditarYEliminarRelevoTest.php`, `VentanaDeFechaDelRelevoTest.php`, `CongelarResumenTest.php`, `PendientesDeFirmaTest.php`, `ListadoDeRelevosTest.php`

**Interfaces:**
- Consumes: las dos frases nuevas de la Tarea 1 (`'No hay movimientos'`, `'No hay pernoctas'`), que la migración usa para reescribir lo congelado; el listado de la Tarea 2, que ya no mira `seccion`.
- Produces: `detalle` y `pendientes` sin la clave `seccion`, que la Tarea 4 consume; el índice pasa a llamarse `entregas_turno_seg_fecha_idx`.

- [ ] **Step 1: Escribir las dos pruebas de esquema que todavía fallan**

En `tests/Feature/EntregaTurnoSeguridad/EsquemaV2Test.php`: borrar la prueba `'las secciones son caseta y plataforma'` entera (las constantes dejan de existir), sustituir la del índice y añadir una de la columna:

```php
test('la tabla ya no guarda el puesto', function () {
    expect(Schema::hasColumn('entregas_turno_seguridad', 'seccion'))->toBeFalse();
});

test('el indice queda sobre la fecha sola', function () {
    // Cambiar o borrar una columna indexada hace que sqlite recree la tabla.
    // Si el índice se perdiera por el camino, el listado seguiría funcionando
    // y nadie lo notaría hasta que la tabla creciera.
    $nombres = collect(Schema::getIndexes('entregas_turno_seguridad'))->pluck('name');

    expect($nombres)->not->toBeEmpty()
        ->and($nombres)->toContain('entregas_turno_seg_fecha_idx')
        ->and($nombres)->not->toContain('entregas_turno_seg_fecha_seccion_idx');
});
```

Y en su ayudante de siembra (línea 23) borrar `'seccion' => EntregaTurnoSeguridad::SECCION_CASETA,`.

En `tests/Feature/EntregaTurnoSeguridad/ModeloEntregaTurnoSeguridadTest.php`: borrar el `'seccion' => ...` de la siembra (línea 22) y, en `'los nombres de índice que crea la migración caben en MySQL'`, cambiar `toContain('entregas_turno_seg_fecha_seccion_idx')` por `toContain('entregas_turno_seg_fecha_idx')`. El `foreach` de los 64 caracteres se queda tal cual.

- [ ] **Step 2: Correr y ver el rojo**

```bash
php artisan test tests/Feature/EntregaTurnoSeguridad/EsquemaV2Test.php tests/Feature/EntregaTurnoSeguridad/ModeloEntregaTurnoSeguridadTest.php
```

Esperado: FALLA. `la tabla ya no guarda el puesto` dice que la columna sigue ahí, `el indice queda sobre la fecha sola` no encuentra el nombre nuevo, y las siembras revientan con «NOT NULL constraint failed: entregas_turno_seguridad.seccion» porque la columna existe y ya no se le manda valor.

- [ ] **Step 3: Escribir la migración**

Crear `database/migrations/2026_11_18_120000_v3_entrega_turno_seguridad_sin_seccion.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * La tercera versión del relevo de turno de Seguridad.
 *
 * Se va el puesto. La v2 sustituyó las casillas por conteos leídos de los
 * demás módulos, y esa consulta automática dejó sin razón de ser a llenar el
 * relevo dos veces al día: uno basta, y no hace falta decir desde dónde.
 *
 * Los relevos que ya existen conservan fecha, firmas, observaciones y
 * resumen; solo pierden la etiqueta del puesto. El `down()` devuelve la
 * columna pero NO sus valores: eso se pierde de verdad, y está aceptado.
 */
return new class extends Migration
{
    private const INDICE_VIEJO = 'entregas_turno_seg_fecha_seccion_idx';

    private const INDICE_NUEVO = 'entregas_turno_seg_fecha_idx';

    /**
     * El texto de cero, antes y después.
     *
     * Un relevo cerrado guarda su resumen y deja de consultar, así que sin
     * esta reescritura los relevos ya firmados seguirían diciendo «Sin
     * registros» para siempre.
     *
     * @var array<string, string>
     */
    private const TEXTOS = [
        'Sin registros' => 'No hay movimientos',
        'Sin pernoctas' => 'No hay pernoctas',
    ];

    public function up(): void
    {
        /*
         * La reescritura va PRIMERO: si la migración fallara a medio camino,
         * es mejor haber perdido una frase que una columna.
         */
        $this->reescribirTextos(self::TEXTOS);

        /*
         * Soltar el índice no es opcional: sqlite —el motor de las pruebas— se
         * niega a borrar una columna que está indexada. En MySQL el índice
         * sobreviviría degradado a `(fecha_hora)` con un nombre que menciona
         * una columna inexistente, que es peor que un error: funciona y miente.
         *
         * Van en tres llamadas separadas porque dentro de un mismo Blueprint
         * no está garantizado que el dropIndex corra antes del dropColumn.
         */
        Schema::table('entregas_turno_seguridad', function (Blueprint $table) {
            $table->dropIndex(self::INDICE_VIEJO);
        });

        Schema::table('entregas_turno_seguridad', function (Blueprint $table) {
            $table->dropColumn('seccion');
        });

        Schema::table('entregas_turno_seguridad', function (Blueprint $table) {
            $table->index(['fecha_hora'], self::INDICE_NUEVO);
        });
    }

    public function down(): void
    {
        Schema::table('entregas_turno_seguridad', function (Blueprint $table) {
            $table->dropIndex(self::INDICE_NUEVO);
        });

        /*
         * El valor por omisión es `caseta` para que la columna pueda volver a
         * ser NOT NULL sobre filas que ya existen. Los puestos originales no
         * vuelven.
         */
        Schema::table('entregas_turno_seguridad', function (Blueprint $table) {
            $table->string('seccion', 16)->default('caseta');
        });

        Schema::table('entregas_turno_seguridad', function (Blueprint $table) {
            $table->index(['fecha_hora', 'seccion'], self::INDICE_VIEJO);
        });

        $this->reescribirTextos(array_flip(self::TEXTOS));
    }

    /**
     * Cambia el texto de los resúmenes YA congelados, sin tocar sus cifras.
     *
     * Las cifras —`entradas`, `salidas`, `total`— son lo que hace del relevo
     * un documento, y cambiarlas sería falsificarlo. Cambiar una frase que se
     * deriva de ellas no cambia lo que el documento dice.
     *
     * `json_encode` va sin banderas, igual que el cast del modelo, para no
     * dejar unos relevos con los acentos escapados y otros no.
     *
     * @param  array<string, string>  $cambios
     */
    private function reescribirTextos(array $cambios): void
    {
        DB::table('entregas_turno_seguridad')
            ->whereNotNull('resumen')
            ->orderBy('id')
            ->each(function (object $fila) use ($cambios): void {
                $renglones = json_decode((string) $fila->resumen, true);

                if (! is_array($renglones)) {
                    return;
                }

                $nuevos = array_map(static function (mixed $renglon) use ($cambios): mixed {
                    if (! is_array($renglon) || ! is_string($renglon['texto'] ?? null)) {
                        return $renglon;
                    }

                    $renglon['texto'] = $cambios[$renglon['texto']] ?? $renglon['texto'];

                    return $renglon;
                }, $renglones);

                DB::table('entregas_turno_seguridad')
                    ->where('id', $fila->id)
                    ->update(['resumen' => json_encode($nuevos)]);
            });
    }
};
```

- [ ] **Step 4: Quitar el puesto del modelo**

En `app/Models/EntregaTurnoSeguridad.php`: borrar `SECCION_CASETA`, `SECCION_PLATAFORMA` y `SECCIONES`, borrar `'seccion',` del `$fillable`, y sustituir el docblock de la clase por:

```php
/**
 * El relevo de turno de UN día de Seguridad.
 *
 * Desde la v3 no hay puestos: el relevo se llena una vez y sus cifras salen
 * de los módulos que registran cada cosa. No hay índice único sobre el día a
 * propósito: un relevo extra —un turno partido, una emergencia— es un dato
 * verdadero y el sistema no debe negarse a guardarlo.
 */
```

- [ ] **Step 5: Quitar el puesto de los tres Form Request**

`IndexEntregaTurnoSeguridadRequest`: borrar la regla `'seccion' => [...]`, el mensaje `'seccion.in'` y el `use App\Models\EntregaTurnoSeguridad;` (queda sin uso). **`use Illuminate\Validation\Rule;` se queda**: `estado` lo sigue usando.

`StoreEntregaTurnoSeguridadRequest`: borrar la regla, los dos mensajes `'seccion.required'` y `'seccion.in'`, y los dos imports `App\Models\EntregaTurnoSeguridad` y `Illuminate\Validation\Rule`, que quedan sin uso. Actualizar el docblock de la clase, que menciona la sección.

`UpdateEntregaTurnoSeguridadRequest`: borrar la regla, el mensaje `'seccion.in'` y el `use Illuminate\Validation\Rule;`. **`use App\Models\EntregaTurnoSeguridad;` se queda**: `cambiaElDia()` lo usa.

- [ ] **Step 6: Quitar el puesto de las dos respuestas del controlador**

En `app/Http/Controllers/Api/EntregaTurnoSeguridadController.php`, borrar `'seccion' => $relevo->seccion,` de `detalle()` y `'seccion' => $relevo->seccion,` del `map` de `pendientes()`.

- [ ] **Step 7: Quitar el puesto de las siembras y payloads de las pruebas**

Son ocho archivos y el cambio es mecánico. Archivo por archivo:

`ListadoDeRelevosTest.php` — en `relevoDeListado`, borrar la línea `'seccion' => EntregaTurnoSeguridad::SECCION_CASETA,` y su comentario de encima.

`CrearRelevoTest.php` — en `datosDeRelevo()` borrar `'seccion' => EntregaTurnoSeguridad::SECCION_CASETA,`; borrar las pruebas `'la seccion solo admite caseta y plataforma'` y `'la seccion ya no admite los nombres viejos'`; y añadir en su lugar:

```php
test('mandar una seccion ya no hace nada ni revienta', function () {
    // La columna se fue en la v3. Un cliente viejo que la siga mandando no
    // debe recibir un 422 por un campo que ya no existe.
    $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo(['seccion' => 'caseta']))
        ->assertCreated();

    expect(EntregaTurnoSeguridad::count())->toBe(1);
});

test('el detalle del alta ya no trae la seccion', function () {
    $respuesta = $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo());

    expect($respuesta->json('data'))->not->toHaveKey('seccion');
});
```

`EditarYEliminarRelevoTest.php` — borrar `'seccion' => EntregaTurnoSeguridad::SECCION_CASETA,` de la siembra (línea 30) y quitar `'seccion'` de la lista de claves del contrato del detalle (línea 272), que queda `['id', 'nombre', 'fecha', 'hora', 'fecha_hora', 'resumen', 'observaciones', 'firmas']`.

`VentanaDeFechaDelRelevoTest.php` — borrar las dos líneas `'seccion' => ...` (33 y 73).

`CongelarResumenTest.php` — borrar la línea `'seccion' => ...` (36).

`PendientesDeFirmaTest.php` — el ayudante pierde su segundo parámetro:

```php
function relevoEn(string $fechaHora, array $extra = []): EntregaTurnoSeguridad
{
    return EntregaTurnoSeguridad::create(array_merge([
        'user_id' => User::factory()->create()->id,
        'fecha_hora' => $fechaHora,
    ], $extra));
}
```

Hay que ajustar sus **diecisiete** llamadas: las que pasaban solo el puesto se quedan con la fecha (`relevoEn('2026-11-04 07:30:00')`) y las que pasaban un tercer argumento lo suben al segundo (`relevoEn('2026-11-04 07:30:00', ['status' => 'N'])`). Donde dos llamadas del mismo día se distinguían por el puesto, ahora se distinguen por la hora, que ya es distinta en todas. Y borrar la aserción `->and($pendiente['seccion'])->toBe(...)` de la línea 155, dejando una en su lugar:

```php
    expect($pendiente)->not->toHaveKey('seccion');
```

`EsquemaV2Test.php` y `ModeloEntregaTurnoSeguridadTest.php` ya quedaron hechos en el paso 1.

Y añadir a `ListadoDeRelevosTest.php` la prueba de que el filtro muerto no estorba:

```php
test('un seccion en el query string ya no filtra nada ni revienta', function () {
    // La regla se fue con la columna. Un cliente viejo que siga mandando
    // `?seccion=caseta` debe recibir la lista completa, no un 422 ni media.
    relevoDeListado('2026-11-09');
    relevoDeListado('2026-11-08');

    expect(listado(['seccion' => 'caseta'])->json('meta.total'))->toBe(2)
        ->and(listado(['seccion' => 'frente'])->json('meta.total'))->toBe(2);
});
```

- [ ] **Step 8: Correr el módulo y ver verde**

```bash
php artisan test tests/Feature/EntregaTurnoSeguridad
```

Esperado: PASA, los diez archivos. Las pruebas corren la migración sobre sqlite al arrancar, así que un verde aquí demuestra además que el baile de índice y columna funciona en sqlite.

Si falla `SQLSTATE[HY000]: General error: 1 error in index ... no such column: seccion`, es que el `dropIndex` no corrió antes del `dropColumn`: revisar que sean tres `Schema::table` separadas.

- [ ] **Step 9: Comprobar que nada más en el proyecto nombra el puesto**

```bash
grep -rn "SECCION_CASETA\|SECCION_PLATAFORMA\|EntregaTurnoSeguridad::SECCIONES" app tests database
```

Esperado: ninguna línea. Si sale alguna, arreglarla antes de seguir.

- [ ] **Step 10: Commit**

```bash
git add database/migrations/2026_11_18_120000_v3_entrega_turno_seguridad_sin_seccion.php app/Models/EntregaTurnoSeguridad.php app/Http/Controllers/Api/EntregaTurnoSeguridadController.php app/Http/Requests/EntregaTurnoSeguridad tests/Feature/EntregaTurnoSeguridad
git commit -m "feat(seguridad)!: el relevo deja de tener puesto y reescribe el texto congelado"
```

---

### Task 4: El front deja de conocer el puesto

Va en **una sola tarea** y no en varias porque `types.ts` es compartido: en el momento en que `Seccion` desaparece, los siete componentes dejan de compilar a la vez. El árbol no vuelve a compilar hasta el último archivo.

**Files:**
- Modify: `resources/js/pages/seguridad/entregaTurno/types.ts`
- Modify: `resources/js/pages/seguridad/entregaTurno/CeldasRelevo.tsx`
- Modify: `resources/js/pages/seguridad/entregaTurno/TablaEntregaTurno.tsx`
- Modify: `resources/js/pages/seguridad/entregaTurno/FilaFiltros.tsx`
- Modify: `resources/js/pages/seguridad/entregaTurno/FormEntregaTurno.tsx`
- Modify: `resources/js/pages/seguridad/entregaTurno/VistaPreviaEntregaTurno.tsx`
- Modify: `resources/js/pages/seguridad/entregaTurno/PendientesDeFirma.tsx`
- Modify: `resources/js/pages/seguridad/EntregaTurno.tsx`
- Delete: `resources/js/pages/seguridad/entregaTurno/SelectorSeccion.tsx`

**Interfaces:**
- Consumes: la forma plana del listado (Tarea 2) y el detalle y los pendientes sin `seccion` (Tarea 3).
- Produces: nada que otra tarea consuma; la Tarea 5 lo verifica en el navegador.

- [ ] **Step 1: Aplanar los tipos**

En `types.ts`: borrar `SECCIONES`, `Seccion`, `ETIQUETA_SECCION` y el tipo `SeccionRelevo`; dejar `FilaRelevo` así:

```ts
/** Un renglón de la tabla: un relevo. */
export type FilaRelevo = {
    id: number;
    fecha: string;
    hora: string;
    nombre: string;
    /** Los roles de cierre que faltan. Vacío quiere decir cerrado. */
    firmas_faltantes: string[];
    /** Aeronaves que pernoctaron ese día: congelada si el relevo lo está. */
    pernocta: number;
};
```

Y borrar la línea `seccion: Seccion;` de `DetalleRelevo`, `seccion: Seccion;` de `PendienteRelevo`, `seccion?: Seccion;` de `PayloadRelevo`, `seccion: Seccion;` de `PayloadRelevoNuevo` y `seccion?: '' | Seccion;` de `FiltrosRelevo`. `PayloadRelevoNuevo` queda:

```ts
/** Lo que manda al CREAR, donde dos campos son obligatorios. */
export type PayloadRelevoNuevo = PayloadRelevo & {
    fecha_hora: string;
    firma_quien_entrega: string;
};
```

Lo demás del archivo —`RenglonResumen`, `ResumenRelevo`, los tres roles, `ETIQUETA_ROL`, `FirmaRelevo`, `formatearFecha`, `horaAhora`, `etiquetaPeriodo`— no se toca.

- [ ] **Step 2: Dejar en `CeldasRelevo` solo el distintivo**

El archivo entero queda:

```tsx
import { ETIQUETA_ROL } from './types';

/** Lo que dice el distintivo según cuántas firmas de cierre falten. */
function textoDelDistintivo(faltantes: string[]): string {
    if (faltantes.length === 0) {
        return 'Firmado';
    }

    if (faltantes.length === 1) {
        return `Falta ${ETIQUETA_ROL[faltantes[0]] ?? faltantes[0]}`;
    }

    return `Faltan ${faltantes.length}`;
}

/** Verde si el relevo está cerrado, naranja si le falta alguna firma de cierre. */
export function DistintivoFirmas({ faltantes }: { faltantes: string[] }) {
    const cerrado = faltantes.length === 0;

    return (
        <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                cerrado ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'
            }`}
        >
            {textoDelDistintivo(faltantes)}
        </span>
    );
}
```

Se van `CeldaSeccion`, `pernoctaDelDia` —la pernocta ahora es un número del renglón, no la conciliación de dos puestos— e `idUnicoDe`.

- [ ] **Step 3: Borrar el selector**

```bash
git rm resources/js/pages/seguridad/entregaTurno/SelectorSeccion.tsx
```

Preguntaba sobre cuál puesto actuar. Con un relevo por renglón no hay nada que preguntar.

- [ ] **Step 4: La tabla de seis columnas**

En `TablaEntregaTurno.tsx`:

- En los imports: `import { DistintivoFirmas } from './CeldasRelevo';` en vez de los tres de antes, y borrar el de `SelectorSeccion`.
- En `Props`, `onVerPrevia: (id: number) => void;`.
- Borrar `const [eligiendo, setEligiendo] = useState<...>(null);`, el tipo `type Accion`, la función `pedirAccion` y el bloque `{eligiendo && (<SelectorSeccion ... />)}` del final. `actuar` también se va: `onEditar` y `eliminar` se llaman directo.
- En `FILTROS_INICIALES`, borrar `seccion: ''`.
- En el `useEffect` que carga, borrar `seccion` del desestructurado `const { seccion, estado, ... } = filtros;`, de la llamada a `fetchRelevos` y del arreglo de dependencias.
- El encabezado del panel pasa de `Relevos por día` a `Relevos`.
- La fila de encabezados:

```tsx
                            <tr className="border-b border-slate-100 bg-white">
                                <th className={TH}>Fecha</th>
                                <th className={TH}>Hora</th>
                                <th className={TH}>Quien entrega</th>
                                <th className={TH}>Pernocta del día</th>
                                <th className={TH}>Estado</th>
                                <th className="px-6 py-4 text-right text-[9px] font-black uppercase text-slate-400">Acciones</th>
                            </tr>
```

- El renglón:

```tsx
                                filas.map(fila => (
                                    <tr key={fila.id} className="border-b border-slate-50 transition-colors hover:bg-slate-50/80">
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-[10px] font-bold text-slate-800">{formatearFecha(fila.fecha)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-[10px] text-slate-500">{fila.hora}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-[11px] font-bold text-slate-700">{fila.nombre}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-[10px] font-bold uppercase text-slate-600">{fila.pernocta}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <DistintivoFirmas faltantes={fila.firmas_faltantes} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-1">
                                                <button type="button" onClick={() => onVerPrevia(fila.id)} title="Vista previa" className="p-2 text-slate-400 transition-colors hover:text-indigo-600">
                                                    <Eye size={16} />
                                                </button>
                                                {puedeEditar && (
                                                    <>
                                                        <button type="button" onClick={() => onEditar(fila.id)} title="Editar" className="p-2 text-slate-400 transition-colors hover:text-indigo-600">
                                                            <Pencil size={16} />
                                                        </button>
                                                        <button type="button" onClick={() => void eliminar(fila.id)} title="Eliminar" className="p-2 text-slate-400 transition-colors hover:text-red-500">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
```

- El `colSpan` del renglón vacío pasa de `5` a `6`, y su texto de `No se encontraron relevos` se queda.
- En `eliminar`, el texto del `Swal` pasa de `Se eliminará el registro de esta sección.` a `Se eliminará este relevo.`

- [ ] **Step 5: La fila de filtros, recolocada**

En `FilaFiltros.tsx`, el orden de las celdas pasa a ser: fecha, hora (vacía), buscador, pernocta (vacía), estado, limpiar. Se borra el `<select>` del puesto. Las dos celdas vacías llevan la misma clase que las demás para que la fila cuadre con los encabezados:

```tsx
            <td className="border-b border-slate-200 px-2 py-2" />
```

La del buscador y la del estado se quedan igual; solo cambian de sitio.

- [ ] **Step 6: El formulario sin puesto**

En `FormEntregaTurno.tsx`:

- Borrar `ETIQUETA_SECCION` y `SECCIONES` de los imports de `./types`.
- En el `useState` de `datos`, borrar `seccion: relevo?.seccion ?? SECCIONES[0],`.
- Borrar el bloque entero del `<div>` con la etiqueta `Puesto` (los dos botones y su `MensajeError`).
- En los dos payloads de `enviar`, borrar `seccion: datos.seccion,`.

- [ ] **Step 7: La vista previa de un solo documento**

`VistaPreviaEntregaTurno.tsx` recibe un id y pinta un documento. El archivo entero:

```tsx
import { useEffect, useState } from 'react';
import { AlertCircle, LoaderCircle, X } from 'lucide-react';
import { ErrorDeApi, fetchRelevo } from '@/stores/apiEntregaTurnoSeguridad';
import {
    ROL_FBO,
    ROL_JEFE_AREA,
    ROL_QUIEN_ENTREGA,
    formatearFecha,
    type DetalleRelevo,
    type FirmaRelevo,
} from './types';

interface Props {
    id: number | null;
    onCerrar: () => void;
}

const firmaPorRol = (detalle: DetalleRelevo, rol: string): FirmaRelevo | null =>
    detalle.firmas.find(firma => firma.rol === rol) ?? null;

function Firma({ firma, titulo }: { firma: FirmaRelevo | null; titulo: string }) {
    return (
        <div className="text-center">
            <div className="flex h-16 items-center justify-center border-b border-slate-400">
                {firma ? (
                    <img src={firma.url} alt={titulo} className="max-h-16" />
                ) : (
                    <span className="text-[9px] font-bold uppercase text-slate-300">Sin firma</span>
                )}
            </div>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">{titulo}</p>
        </div>
    );
}

function Documento({ detalle }: { detalle: DetalleRelevo }) {
    return (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase text-slate-500">
                    {detalle.nombre} · {detalle.hora}
                </p>
                <ul className="divide-y divide-slate-100">
                    {detalle.resumen.renglones.map(renglon => (
                        <li key={renglon.clave} className="flex items-center justify-between gap-3 py-1.5 text-xs text-slate-700">
                            <span className="font-bold">{renglon.titulo}</span>
                            <span className="text-right">{renglon.texto}</span>
                        </li>
                    ))}
                </ul>
                <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Observaciones</p>
                    <p className="whitespace-pre-wrap text-xs text-slate-700">{detalle.observaciones?.trim() || '—'}</p>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2">
                    <Firma firma={firmaPorRol(detalle, ROL_QUIEN_ENTREGA)} titulo="Quien entrega" />
                    <Firma firma={firmaPorRol(detalle, ROL_JEFE_AREA)} titulo="Jefe de área" />
                    <Firma firma={firmaPorRol(detalle, ROL_FBO)} titulo="FBO" />
                </div>
            </div>
        </section>
    );
}

export default function VistaPreviaEntregaTurno({ id, onCerrar }: Props) {
    const [detalle, setDetalle] = useState<DetalleRelevo | null>(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setDetalle(null);
        setError(null);

        if (id === null) return;

        let vigente = true;
        setCargando(true);

        fetchRelevo(id)
            .then(respuesta => {
                if (vigente) setDetalle(respuesta.data);
            })
            .catch((e: unknown) => {
                if (vigente) setError(e instanceof ErrorDeApi ? e.message : 'No se pudo conectar con el servidor.');
            })
            .finally(() => {
                if (vigente) setCargando(false);
            });

        return () => {
            vigente = false;
        };
    }, [id]);

    if (id === null) return null;

    return (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 md:p-6">
            <button
                type="button"
                aria-label="Cerrar vista previa"
                onClick={onCerrar}
                className="absolute inset-0 h-full w-full cursor-default bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-300"
            />

            <div className="relative z-10 flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 md:px-6">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-tight text-slate-800 md:text-lg">Vista previa de la entrega de turno</h3>
                        {detalle && (
                            <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">{formatearFecha(detalle.fecha)}</p>
                        )}
                    </div>
                    <button type="button" onClick={onCerrar} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-500" title="Cerrar">
                        <X size={20} />
                    </button>
                </div>

                <div className="custom-scrollbar flex-1 overflow-y-auto bg-slate-100 p-3 md:p-6">
                    {/* Sin detalle ni error aún (primer render tras elegir relevo) también es «cargando». */}
                    {cargando || (!error && !detalle) ? (
                        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl bg-white">
                            <LoaderCircle size={34} className="mb-3 animate-spin text-[#003E51]" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cargando vista previa...</p>
                        </div>
                    ) : error ? (
                        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                            <AlertCircle size={34} className="mb-3 text-red-500" />
                            <h4 className="text-sm font-black uppercase text-red-700">No se pudo cargar</h4>
                            <p className="mt-2 text-xs text-red-600">{error}</p>
                        </div>
                    ) : detalle ? (
                        <Documento detalle={detalle} />
                    ) : null}
                </div>
            </div>
        </div>
    );
}
```

El ancho máximo baja de `max-w-5xl` a `max-w-2xl`: ya no hay dos columnas que acomodar.

- [ ] **Step 8: La cola de pendientes sin el puesto**

En `PendientesDeFirma.tsx`, quitar `ETIQUETA_SECCION` del import de `./types` y dejar el renglón de la fecha así:

```tsx
                                    <p className="text-[10px] font-medium text-slate-400">
                                        {formatearFecha(pendiente.fecha)} {pendiente.hora}
                                    </p>
```

- [ ] **Step 9: La página pasa un id a la previa**

En `resources/js/pages/seguridad/EntregaTurno.tsx`:

- `const [previa, setPrevia] = useState<number | null>(null);`
- `<VistaPreviaEntregaTurno id={previa} onCerrar={() => setPrevia(null)} />`
- `onVerPrevia={setPrevia}` se queda igual: ahora recibe un número.
- Borrar `FilaRelevo` del import de tipos, que queda `import type { DetalleRelevo } from './entregaTurno/types';`

- [ ] **Step 10: El docblock de la tienda**

`resources/js/stores/apiEntregaTurnoSeguridad.ts` no cambia de forma: importa los tipos y los sigue importando. Lo único que se toca es el docblock de `ErrorDeApi`, que pone como ejemplo «la pernocta mensual solo puede estar hecha, no hecha o sin revisar» —un campo que la v2 borró—. Cambiar ese ejemplo por uno vivo, como el mensaje de una firma que no llegó en formato válido.

- [ ] **Step 11: Comprobar que nada del front nombra el puesto**

```bash
grep -rn "ETIQUETA_SECCION\|SeccionRelevo\|SelectorSeccion\|CeldaSeccion\|pernoctaDelDia\|idUnicoDe" resources/js
```

Esperado: ninguna línea.

- [ ] **Step 12: Que compile**

```bash
npx tsc --noEmit
```

Esperado: **exactamente un** error, el de base: `TS1117` en `resources/js/actions/App/Http/Controllers/Api/WalkAroundController.ts:905`. Cualquier otro error es de este trabajo y se arregla antes de seguir.

- [ ] **Step 13: Que construya**

```bash
npm run build
```

Esperado: salida 0.

- [ ] **Step 14: Commit**

```bash
git add resources/js/pages/seguridad/entregaTurno resources/js/pages/seguridad/EntregaTurno.tsx resources/js/stores/apiEntregaTurnoSeguridad.ts
git commit -m "feat(seguridad): la pantalla del relevo ensena un renglon por registro"
```

---

### Task 5: La suite entera, la migración real y el navegador

La reescritura del texto congelado SÍ está probada: `EsquemaV2Test` siembra filas crudas, hace un rollback de un paso sobre esta migración y vuelve a migrar, y comprueba ambas direcciones y que las cifras quedan byte a byte idénticas. Lo que las pruebas no pueden demostrar es que esos cinco relevos de verdad quedaron bien, y que la pantalla funciona.

**Files:** ninguno. Es verificación.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la evidencia.

- [ ] **Step 1: La suite completa, en serie**

```bash
php artisan test
```

Esperado: verde. **Leer `${PIPESTATUS[0]}` si se canaliza la salida.** La referencia es 2 502 pruebas pasando antes de esta rama; aquí habrá algunas menos por las pruebas de agrupamiento que se fueron y algunas más por las nuevas. Lo que importa es que no haya rojos.

- [ ] **Step 2: Pedir permiso para migrar, y esperarlo**

`eolo_plus` es la base real. Decirle al usuario qué va a pasar —la columna se va, los cinco resúmenes cambian de frase— y **esperar su sí** antes del paso siguiente. Sin ese sí, la tarea para aquí y se le informa.

- [ ] **Step 3: Migrar**

```bash
php artisan migrate
```

Esperado: una sola migración aplicada, `2026_11_18_120000_v3_entrega_turno_seguridad_sin_seccion`.

El servidor de pruebas (192.168.7.229) tiene su propia base y también la necesita. **Eso no es parte de este plan**: queda apuntado para cuando el usuario quiera subir la rama.

- [ ] **Step 4: Comprobar los cinco relevos con los ojos**

```bash
php artisan tinker --execute="foreach (\App\Models\EntregaTurnoSeguridad::orderBy('id')->get() as \$r) { echo \$r->id.' '.\$r->fecha_hora.' | '.collect(\$r->resumen)->pluck('texto')->implode(' / ').PHP_EOL; }"
```

Esperado: cinco renglones, ninguno con `Sin registros` ni `Sin pernoctas`, y las cifras intactas. Si alguno sigue con la frase vieja, la reescritura no lo alcanzó y hay que averiguar por qué antes de dar nada por bueno.

- [ ] **Step 5: Verificar en el navegador**

Antes: `public/hot` contiene `http://192.168.7.10:5173` y hay que apartarlo, **y volverlo a poner al terminar**. El preview lee el `launch.json` del padre (`EOLO/.claude/launch.json`) y tiene que servir el puerto **3000** —fuera de 3000 Sanctum devuelve 401—, y se deja en **8000** al acabar. Entrar como `Administrador EOLO` / `admin123`.

Qué mirar, en este orden:

1. La tabla: seis columnas, un renglón por relevo, y **dos renglones** en las dos fechas que tenían los dos puestos.
2. Que no haya errores en la consola ni peticiones en rojo.
3. El ojo abre la vista previa de un solo documento, con sus seis renglones y sus tres firmas.
4. El lápiz abre el relevo directo, **sin preguntar por el puesto**, y el formulario no tiene el bloque Puesto.
5. Crear un relevo nuevo y ver en su resumen el texto nuevo: «No hay movimientos» en los módulos sin movimiento del día.
6. El filtro de estado: FALTA JEFE DE ÁREA, FALTA FBO y COMPLETAS devuelven lo que dicen, y en la fila de filtros ya no está el select de puesto.

- [ ] **Step 6: Enseñar la evidencia**

Una captura de la tabla y otra de la vista previa, y el conteo de la suite. Si algo no cuadra, se dice cuál y por qué, no se da por bueno.

- [ ] **Step 7: Cerrar la rama**

Con todo verde, usar la skill `superpowers:finishing-a-development-branch`. **La fusión y el borrado de la rama los decide el usuario**, y un `push` es hacia fuera: se pregunta antes.
