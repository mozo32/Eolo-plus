# Entrega de Turno de Seguridad v2 — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el relevo de turno de Seguridad deje de preguntar con casillas y pase a mostrar los conteos del día leídos de los demás módulos, con tres firmas para cerrarlo y los puestos renombrados a caseta y plataforma.

**Architecture:** Un servicio nuevo, `ResumenDelDiaSeguridad`, hace las nueve consultas de conteo de un día y devuelve seis renglones de texto ya armado. El controlador los sirve en vivo mientras el relevo está abierto y los guarda en una columna `resumen` en el instante en que entra la tercera firma, que es cuando el relevo pasa a ser un documento cerrado. Las ocho columnas booleanas y `pernocta_mensual` desaparecen de la tabla.

**Tech Stack:** Laravel 12, Inertia 2, React 19, TypeScript, Tailwind 4, Pest 3. MySQL en desarrollo (`eolo_plus`), sqlite `:memory:` en las pruebas.

**Spec:** `docs/superpowers/specs/2026-11-09-entrega-turno-seguridad-v2-design.md`

## Global Constraints

- Las pruebas corren **en serie**: `php artisan test`. **Nunca `--parallel`**, que da rojos falsos en este proyecto.
- `php artisan test 2>&1 | tail` devuelve el código de salida de `tail` y esconde los fallos. Si se canaliza, se lee `${PIPESTATUS[0]}`.
- **Nunca** `vendor/bin/pint`, `prettier` ni `npm run lint`, aunque el CLAUDE.md pida pint.
- **Nunca** `git add -A` ni `git add .`: se nombran los archivos. `CLAUDE.md`, `boost.json`, `.claude/` y `.env.respaldo-antes-de-fact-fbo-prod` son locales y se quedan sin seguir.
- **Nunca** `git stash`: hay tres guardados que no son de este trabajo.
- **Sin factories** salvo `User::factory()`. Las filas se crean con `Modelo::create([...])`.
- Los ayudantes declarados en un archivo de Pest son **globales de toda la suite**. Cada archivo de pruebas nuevo declara los suyos con un nombre único; no se reutilizan los de otro archivo.
- Ningún archivo de pantalla pasa de **300 líneas**. `EntregaTurnoSeguridadController` es la excepción ya declarada.
- **Sin clases `dark:`** en las pantallas de Seguridad.
- Zona horaria de la aplicación: `America/Mexico_City`. Las fechas guardadas ya están en hora de México.
- La regla de forma de las firmas es **la misma** en los cuatro sitios donde aparece: `regex:/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+\/]{16,}={0,2}\z/`. Si se cambia una, se cambian las cuatro.
- Las consultas salen de los modelos, no de `DB::table()`, salvo en la migración.
- Los nombres de índice de MySQL no pasan de 64 caracteres.
- **El implementador NO corre `npm run build`.** Lo corre quien coordina la ejecución, y nunca mientras un subagente está vivo.
- `npx tsc --noEmit` tiene **un** error de base, preexistente y generado por Wayfinder: `resources/js/actions/App/Http/Controllers/Api/WalkAroundController.ts(905,5): error TS1117`. Ese es el estado limpio; cualquier otro error es del trabajo.
- **`eolo_plus` es la base real del usuario.** Ninguna tarea corre `php artisan migrate` contra ella. Lo pide quien coordina, con permiso explícito, al cerrar la Tarea 1.

---

## Orden y estados intermedios

Las tareas 1 a 6 son del servidor y dejan la suite en verde cada una. Las 7 y 8 son de pantalla y se verifican con `npx tsc --noEmit`.

Entre la Tarea 6 y la Tarea 8 la pantalla **no funciona en el navegador**: el servidor ya habla el contrato nuevo y el formulario todavía manda el viejo. Es una rama en obra; la Tarea 8 lo cierra. No hay que verificar en navegador hasta terminar la 8.

`resources/js/stores/apiEntregaTurnoSeguridad.ts` aparece en la §10 de la spec entre los archivos que se tocan, y **ninguna tarea lo toca**. Es correcto que no: ese archivo no nombra ni una casilla ni una sección: arma el query string recorriendo `Object.entries(filtros)` y devuelve lo que el servidor mande, tipado con los tipos de `types.ts`. Al cambiar los tipos, cambia con ellos sin editarlo. La spec lo listó de más.

---

### Task 1: Migración v2 y constantes del modelo

**Files:**
- Create: `database/migrations/<marca de tiempo>_v2_entrega_turno_seguridad.php`
- Modify: `app/Models/EntregaTurnoSeguridad.php`
- Test: `tests/Feature/EntregaTurnoSeguridad/EsquemaV2Test.php` (crear)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `EntregaTurnoSeguridad::SECCION_CASETA` = `'caseta'`
  - `EntregaTurnoSeguridad::SECCION_PLATAFORMA` = `'plataforma'`
  - `EntregaTurnoSeguridad::SECCIONES` = `['caseta', 'plataforma']`
  - `EntregaTurnoSeguridad::ROL_JEFE_AREA` = `'jefe_area'`
  - `EntregaTurnoSeguridad::ROLES_DE_CIERRE` = `['jefe_area', 'fbo']`
  - `$relevo->resumen`: `array|null`, casteada
  - `$relevo->firmasFaltantes(): array` — los roles de cierre sin firma vigente
  - `$relevo->estaCerrado(): bool` — las tres firmas puestas
  - Desaparecen: `CASILLAS`, `PERNOCTA_HECHA`, `PERNOCTA_NO_HECHA`, `PERNOCTA_SIN_REVISAR`, `PERNOCTA_ESTADOS`, `SECCION_FRENTE`, `SECCION_ATRAS`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tests/Feature/EntregaTurnoSeguridad/EsquemaV2Test.php`:

```php
<?php

use App\Models\EntregaTurnoSeguridad;
use App\Models\User;
use Illuminate\Support\Facades\Schema;

/*
 * El esquema después de la segunda versión.
 *
 * Lo que sqlite NO puede ver desde aquí: que la columna `seccion` se
 * ensanchó a 16. sqlite no aplica longitudes de varchar, así que un
 * `string('seccion', 10)` pasaría estas pruebas igual. Esa comprobación se
 * hace a mano contra MySQL al cerrar la tarea, que es la misma clase de
 * defecto que una vez dejó un índice de 69 caracteres pasar toda la suite.
 */

function relevoDeEsquema(array $extra = []): EntregaTurnoSeguridad
{
    return EntregaTurnoSeguridad::create(array_merge([
        'user_id' => User::factory()->create()->id,
        'fecha_hora' => '2026-11-09 08:00:00',
        'seccion' => EntregaTurnoSeguridad::SECCION_CASETA,
    ], $extra));
}

test('la tabla ya no guarda casillas ni pernocta mensual', function (string $columna) {
    expect(Schema::hasColumn('entregas_turno_seguridad', $columna))->toBeFalse();
})->with([
    'aviones_csae',
    'combustible',
    'resguardo_vehicular',
    'estacionamiento',
    'posiciones',
    'vehiculos',
    'operaciones',
    'visitantes',
    'pernocta_mensual',
]);

test('la tabla guarda el resumen congelado', function () {
    expect(Schema::hasColumn('entregas_turno_seguridad', 'resumen'))->toBeTrue();
});

test('el indice de fecha y seccion sobrevive al cambio de la columna', function () {
    // Cambiar una columna indexada hace que sqlite recree la tabla. Si el
    // índice se perdiera por el camino, el listado seguiría funcionando y
    // nadie lo notaría hasta que la tabla creciera.
    $nombres = collect(Schema::getIndexes('entregas_turno_seguridad'))->pluck('name');

    expect($nombres)->not->toBeEmpty()
        ->and($nombres)->toContain('entregas_turno_seg_fecha_seccion_idx');
});

test('las secciones son caseta y plataforma', function () {
    expect(EntregaTurnoSeguridad::SECCIONES)
        ->toBe([EntregaTurnoSeguridad::SECCION_CASETA, EntregaTurnoSeguridad::SECCION_PLATAFORMA])
        ->and(EntregaTurnoSeguridad::SECCION_CASETA)->toBe('caseta')
        ->and(EntregaTurnoSeguridad::SECCION_PLATAFORMA)->toBe('plataforma');
});

test('los roles de cierre son el jefe de area y el fbo, en ese orden', function () {
    expect(EntregaTurnoSeguridad::ROL_JEFE_AREA)->toBe('jefe_area')
        ->and(EntregaTurnoSeguridad::ROLES_DE_CIERRE)->toBe(['jefe_area', 'fbo']);
});

test('el resumen se lee como arreglo y no como cadena', function () {
    $relevo = relevoDeEsquema(['resumen' => [['clave' => 'pernocta', 'total' => 3]]]);

    expect($relevo->fresh()->resumen)->toBeArray()
        ->and($relevo->fresh()->resumen[0]['total'])->toBe(3);
});

test('un relevo recien creado no tiene resumen congelado', function () {
    expect(relevoDeEsquema()->fresh()->resumen)->toBeNull();
});

test('firmasFaltantes nombra los dos roles de cierre cuando nadie firmo', function () {
    $relevo = relevoDeEsquema()->load('firmas');

    expect($relevo->firmasFaltantes())->toBe(['jefe_area', 'fbo'])
        ->and($relevo->estaCerrado())->toBeFalse();
});
```

- [ ] **Step 2: Correr la prueba para verla fallar**

Run: `php artisan test tests/Feature/EntregaTurnoSeguridad/EsquemaV2Test.php`
Expected: FAIL. `EntregaTurnoSeguridad::SECCION_CASETA` no existe (error fatal de constante indefinida) y `hasColumn('resumen')` devuelve false.

- [ ] **Step 3: Crear la migración**

Run: `php artisan make:migration v2_entrega_turno_seguridad --no-interaction`

Contenido completo del archivo creado:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * La segunda versión del relevo de turno de Seguridad.
 *
 * Las ocho casillas y la pernocta mensual dejan de contestarse a mano: los
 * números salen ahora de los módulos que registran cada cosa. En su lugar
 * entra `resumen`, donde se congela el conteo del día cuando el relevo
 * queda cerrado con sus tres firmas.
 */
return new class extends Migration
{
    /** @var list<string> */
    private const CASILLAS_QUE_SE_VAN = [
        'aviones_csae',
        'combustible',
        'resguardo_vehicular',
        'estacionamiento',
        'posiciones',
        'vehiculos',
        'operaciones',
        'visitantes',
    ];

    public function up(): void
    {
        /*
         * Primero se ensancha y después se renombra, en ese orden.
         *
         * «plataforma» mide exactamente 10 y la columna nació con 10: cabe
         * justo. Al modificar una columna hay que repetir TODOS sus
         * atributos o Laravel los pierde, así que se aprovecha el paso para
         * dejar holgura en vez de quedarse en el borde.
         */
        Schema::table('entregas_turno_seguridad', function (Blueprint $table) {
            $table->string('seccion', 16)->change();
        });

        DB::table('entregas_turno_seguridad')
            ->where('seccion', 'frente')
            ->update(['seccion' => 'caseta']);

        DB::table('entregas_turno_seguridad')
            ->where('seccion', 'atras')
            ->update(['seccion' => 'plataforma']);

        Schema::table('entregas_turno_seguridad', function (Blueprint $table) {
            $table->dropColumn([...self::CASILLAS_QUE_SE_VAN, 'pernocta_mensual']);
        });

        Schema::table('entregas_turno_seguridad', function (Blueprint $table) {
            $table->json('resumen')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('entregas_turno_seguridad', function (Blueprint $table) {
            $table->dropColumn('resumen');
        });

        Schema::table('entregas_turno_seguridad', function (Blueprint $table) {
            foreach (self::CASILLAS_QUE_SE_VAN as $casilla) {
                $table->boolean($casilla)->default(false);
            }

            $table->char('pernocta_mensual', 1)->default('R');
        });

        DB::table('entregas_turno_seguridad')
            ->where('seccion', 'caseta')
            ->update(['seccion' => 'frente']);

        DB::table('entregas_turno_seguridad')
            ->where('seccion', 'plataforma')
            ->update(['seccion' => 'atras']);

        Schema::table('entregas_turno_seguridad', function (Blueprint $table) {
            $table->string('seccion', 10)->change();
        });
    }
};
```

Los tres `Schema::table` separados en `up()` son a propósito: quitar columnas y añadir otra en la misma llamada obliga a sqlite a recrear la tabla dos veces en una sola operación y el orden de las sentencias deja de ser el escrito.

- [ ] **Step 4: Cambiar las constantes y los ayudantes del modelo**

En `app/Models/EntregaTurnoSeguridad.php`:

Sustituir el bloque de constantes de sección, pernocta y roles por:

```php
    public const SECCION_CASETA = 'caseta';

    public const SECCION_PLATAFORMA = 'plataforma';

    /** @var list<string> */
    public const SECCIONES = [self::SECCION_CASETA, self::SECCION_PLATAFORMA];

    public const ROL_QUIEN_ENTREGA = 'quien_entrega';

    public const ROL_JEFE_AREA = 'jefe_area';

    public const ROL_FBO = 'fbo';

    /**
     * Los dos roles que CIERRAN el relevo, en el orden en que se enseñan.
     *
     * `quien_entrega` no está: esa firma entra al crear y sin ella no hay
     * relevo. Estos dos son los que pueden faltar, los que alimentan la cola
     * de pendientes y los que, al completarse, congelan el resumen.
     *
     * @var list<string>
     */
    public const ROLES_DE_CIERRE = [self::ROL_JEFE_AREA, self::ROL_FBO];
```

Borrar por completo `SECCION_FRENTE`, `SECCION_ATRAS`, `PERNOCTA_HECHA`, `PERNOCTA_NO_HECHA`, `PERNOCTA_SIN_REVISAR`, `PERNOCTA_ESTADOS` y la constante `CASILLAS` con su docblock.

Sustituir `$fillable` y `casts()` por:

```php
    /** @var list<string> */
    protected $fillable = [
        'user_id',
        'fecha_hora',
        'seccion',
        'resumen',
        'observaciones',
        'status',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'fecha_hora' => 'datetime',
            'resumen' => 'array',
        ];
    }
```

Añadir, después de `tieneFirmaDe()`:

```php
    /**
     * Los roles de cierre que todavía no han firmado, en el orden de
     * `ROLES_DE_CIERRE`.
     *
     * Lee la relación YA CARGADA, igual que `tieneFirmaDe`: quien la llame
     * tiene que haber hecho `load('firmas')` o `with('firmas')`.
     *
     * @return list<string>
     */
    public function firmasFaltantes(): array
    {
        return array_values(array_filter(
            self::ROLES_DE_CIERRE,
            fn (string $rol): bool => ! $this->tieneFirmaDe($rol),
        ));
    }

    /**
     * Las tres firmas están puestas: el relevo es un documento cerrado.
     *
     * Incluye la de quien entrega aunque `store` siempre la adjunte: si
     * alguna vez se retirara, el relevo dejaría de estar cerrado y el
     * resumen no debería congelarse.
     */
    public function estaCerrado(): bool
    {
        return $this->tieneFirmaDe(self::ROL_QUIEN_ENTREGA)
            && $this->firmasFaltantes() === [];
    }
```

- [ ] **Step 5: Correr la prueba para verla pasar**

Run: `php artisan test tests/Feature/EntregaTurnoSeguridad/EsquemaV2Test.php`
Expected: PASS, 9 pruebas (la de columnas corre nueve veces por su dataset).

El resto de la suite del módulo **va a fallar** en este punto, porque el controlador y los Form Requests siguen nombrando `CASILLAS` y `SECCION_FRENTE`. Es lo esperado: lo arreglan las tareas 3, 4 y 5.

- [ ] **Step 6: Comprobar que la migración se deshace**

Run: `php artisan migrate:fresh --env=testing && php artisan migrate:rollback --step=1 --env=testing && php artisan migrate --env=testing`
Expected: los tres comandos terminan sin error. Si `down()` falla, se arregla antes de seguir: una migración que no se deshace no se puede probar dos veces.

- [ ] **Step 7: Commit**

```bash
git add app/Models/EntregaTurnoSeguridad.php database/migrations tests/Feature/EntregaTurnoSeguridad/EsquemaV2Test.php
git commit -m "feat(seguridad): caseta y plataforma, y la tabla deja de guardar casillas"
```

> **Desviación declarada respecto de la spec.** La §11 de la spec pedía una prueba de que «la migración de datos convierte `frente` en `caseta` y `atras` en `plataforma`». Esa prueba **no** se escribe, y conviene saber por qué: las pruebas corren sobre una base recién migrada y vacía, así que no hay ninguna fila con el nombre viejo que convertir, y volver a llamar al `up()` de la migración fallaría al intentar borrar columnas que ya no están. Lo que sí queda cubierto es la otra mitad de ese punto —que la validación y los filtros solo aceptan los nombres nuevos—, en las tareas 3 y 5. La conversión de las tres filas reales se comprueba a mano contra MySQL en el paso de abajo.

> **Paso de quien coordina, no del implementador.** La migración **no** se corre contra `eolo_plus` sin permiso explícito del usuario. Cuando lo dé, además de `php artisan migrate` hay que comprobar en MySQL lo que sqlite no puede ver:
>
> ```sql
> SHOW COLUMNS FROM entregas_turno_seguridad LIKE 'seccion';   -- varchar(16)
> SELECT seccion, COUNT(*) FROM entregas_turno_seguridad GROUP BY seccion;  -- solo caseta y plataforma
> SHOW INDEX FROM entregas_turno_seguridad;                    -- entregas_turno_seg_fecha_seccion_idx
> ```
>
> Hasta que esa migración corra, la aplicación local da error en esta pantalla.

---

### Task 2: El servicio del resumen del día

**Files:**
- Create: `app/Support/ResumenDelDiaSeguridad.php`
- Test: `tests/Feature/EntregaTurnoSeguridad/ResumenDelDiaTest.php` (crear)

**Interfaces:**
- Consumes: nada de las tareas anteriores.
- Produces: `ResumenDelDiaSeguridad::para(CarbonInterface $dia): array` — una lista de seis renglones, siempre los seis y siempre en este orden: `aviones_csae`, `resguardo_vehicular`, `vehiculos`, `operaciones`, `visitantes`, `pernocta`. Los cinco primeros traen `clave`, `titulo`, `texto`, `entradas` y `salidas`; el último trae `clave`, `titulo`, `texto` y `total`.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tests/Feature/EntregaTurnoSeguridad/ResumenDelDiaTest.php`:

```php
<?php

use App\Models\EstacionamientoSubterraneo;
use App\Models\MovimientoCSAE;
use App\Models\movimientoVehiculo;
use App\Models\OperacionDiaria;
use App\Models\PernoctaDia;
use App\Models\RegistroVisitante;
use App\Models\User;
use App\Support\ResumenDelDiaSeguridad;
use Illuminate\Support\Carbon;

/*
 * El resumen de un día, leído de los seis módulos que registran cada cosa.
 *
 * Cada prueba siembra el día que mira Y los dos días vecinos: si una
 * consulta se dejara la fecha, el conteo saldría inflado y la prueba lo
 * vería. Sin los vecinos, quitar el filtro de fecha no rompería nada.
 */

const DIA_DEL_RESUMEN = '2026-11-09';
const DIA_ANTERIOR = '2026-11-08';
const DIA_SIGUIENTE = '2026-11-10';

/** El renglón de una clave dentro del resumen de `DIA_DEL_RESUMEN`. */
function renglonDelResumen(string $clave): array
{
    $renglones = ResumenDelDiaSeguridad::para(Carbon::parse(DIA_DEL_RESUMEN));

    $encontrado = collect($renglones)->firstWhere('clave', $clave);

    expect($encontrado)->not->toBeNull("el resumen no trae el renglón {$clave}");

    return $encontrado;
}

function avionCsaeDeResumen(?string $entrada, ?string $salida, string $status = 'A'): MovimientoCSAE
{
    return MovimientoCSAE::create([
        'user_entrada_id' => User::factory()->create()->id,
        'fecha_hora_entrada' => $entrada ?? DIA_ANTERIOR.' 06:00:00',
        'fecha_hora_salida' => $salida,
        'matricula' => 'XA-TST',
        'tipo_aeronave' => 'Lear 45',
        'como_llega' => 'Rodando',
        'transportista' => 'CSAE',
        'status' => $status,
    ]);
}

function resguardoDeResumen(string $ingreso, ?string $salida = null): EstacionamientoSubterraneo
{
    return EstacionamientoSubterraneo::create([
        'user_id' => User::factory()->create()->id,
        'vehiculo' => 'Tsuru',
        'placas' => 'ABC123',
        'llaves' => 'SI',
        'responsable' => 'Quien sea',
        'oficial' => 'Quien vigile',
        'fecha_ingreso' => $ingreso,
        'fecha_salida' => $salida,
    ]);
}

function vehiculoDeResumen(string $dia, string $tipo): movimientoVehiculo
{
    $movimiento = movimientoVehiculo::create([
        'vehiculo_id' => '1',
        'tipo' => $tipo,
        'chofer' => 'Quien maneje',
        'kilometraje' => 100,
        'gasolina' => '1/2',
    ]);

    // `movimientos_vehiculos` no tiene columna de fecha del hecho: el día
    // sale de `created_at`, que no es fillable y hay que poner a mano.
    $movimiento->created_at = $dia.' 10:00:00';
    $movimiento->save();

    return $movimiento;
}

function operacionDeResumen(string $dia, string $tipo, bool $status = true): OperacionDiaria
{
    return OperacionDiaria::create([
        'user_id' => User::factory()->create()->id,
        'fecha' => $dia,
        'tipo' => $tipo,
        'matricula' => 'XA-TST',
        'equipo' => 'Lear 45',
        'hora' => '10:00',
        'lugar' => 'Plataforma',
        'pax' => 3,
        'status' => $status,
        'departamento' => 'Trafico',
    ]);
}

function visitanteDeResumen(string $entrada, ?string $salida = null): RegistroVisitante
{
    return RegistroVisitante::create([
        'nombre' => 'Quien visite',
        'procedencia' => 'Fuera',
        'a_quien_visita' => 'Quien reciba',
        'gafete' => '12',
        'empresa' => 'Empresa',
        'autoriza' => 'Quien autorice',
        'fecha_entrada' => $entrada,
        'hora_entrada' => '09:00',
        'fecha_salida' => $salida,
        'hora_salida' => $salida ? '18:00' : null,
    ]);
}

function pernoctaDeResumen(string $dia): PernoctaDia
{
    return PernoctaDia::create([
        'fecha' => $dia,
        'matricula' => 'XA-'.substr(md5($dia.random_int(1, 9999)), 0, 3),
    ]);
}

test('el resumen trae los seis renglones, en orden, aunque no haya nada', function () {
    $claves = collect(ResumenDelDiaSeguridad::para(Carbon::parse(DIA_DEL_RESUMEN)))
        ->pluck('clave')
        ->all();

    expect($claves)->toBe([
        'aviones_csae',
        'resguardo_vehicular',
        'vehiculos',
        'operaciones',
        'visitantes',
        'pernocta',
    ]);
});

test('los aviones de csae cuentan entradas y salidas del dia', function () {
    avionCsaeDeResumen(DIA_DEL_RESUMEN.' 07:00:00', null);
    avionCsaeDeResumen(DIA_DEL_RESUMEN.' 08:00:00', DIA_DEL_RESUMEN.' 19:00:00');
    avionCsaeDeResumen(DIA_ANTERIOR.' 07:00:00', DIA_SIGUIENTE.' 07:00:00');

    expect(renglonDelResumen('aviones_csae'))
        ->entradas->toBe(2)
        ->salidas->toBe(1);
});

test('los aviones de csae dados de baja no cuentan', function () {
    avionCsaeDeResumen(DIA_DEL_RESUMEN.' 07:00:00', DIA_DEL_RESUMEN.' 19:00:00', 'N');

    expect(renglonDelResumen('aviones_csae'))
        ->entradas->toBe(0)
        ->salidas->toBe(0);
});

test('el resguardo vehicular cuenta ingresos y salidas del dia', function () {
    resguardoDeResumen(DIA_DEL_RESUMEN.' 07:00:00');
    resguardoDeResumen(DIA_ANTERIOR.' 07:00:00', DIA_DEL_RESUMEN.' 08:00:00');
    resguardoDeResumen(DIA_SIGUIENTE.' 07:00:00');

    expect(renglonDelResumen('resguardo_vehicular'))
        ->entradas->toBe(1)
        ->salidas->toBe(1);
});

test('los vehiculos cuentan por su tipo y por el dia en que se capturaron', function () {
    vehiculoDeResumen(DIA_DEL_RESUMEN, 'Entrada');
    vehiculoDeResumen(DIA_DEL_RESUMEN, 'Entrada');
    vehiculoDeResumen(DIA_DEL_RESUMEN, 'Salida');
    vehiculoDeResumen(DIA_ANTERIOR, 'Entrada');
    vehiculoDeResumen(DIA_SIGUIENTE, 'Salida');

    expect(renglonDelResumen('vehiculos'))
        ->entradas->toBe(2)
        ->salidas->toBe(1);
});

test('las operaciones cuentan llegadas y salidas del dia', function () {
    operacionDeResumen(DIA_DEL_RESUMEN, 'llegada');
    operacionDeResumen(DIA_DEL_RESUMEN, 'salida');
    operacionDeResumen(DIA_DEL_RESUMEN, 'salida');
    operacionDeResumen(DIA_ANTERIOR, 'llegada');

    expect(renglonDelResumen('operaciones'))
        ->entradas->toBe(1)
        ->salidas->toBe(2);
});

test('las operaciones canceladas no cuentan', function () {
    operacionDeResumen(DIA_DEL_RESUMEN, 'llegada', false);

    expect(renglonDelResumen('operaciones'))
        ->entradas->toBe(0)
        ->salidas->toBe(0);
});

test('los visitantes cuentan entradas y salidas del dia', function () {
    visitanteDeResumen(DIA_DEL_RESUMEN);
    visitanteDeResumen(DIA_DEL_RESUMEN, DIA_DEL_RESUMEN);
    visitanteDeResumen(DIA_ANTERIOR, DIA_SIGUIENTE);

    expect(renglonDelResumen('visitantes'))
        ->entradas->toBe(2)
        ->salidas->toBe(1);
});

test('la pernocta del dia cuenta sus aeronaves', function () {
    pernoctaDeResumen(DIA_DEL_RESUMEN);
    pernoctaDeResumen(DIA_DEL_RESUMEN);
    pernoctaDeResumen(DIA_ANTERIOR);

    expect(renglonDelResumen('pernocta'))
        ->total->toBe(2)
        ->texto->toBe('2 aeronaves');
});

test('el texto de un renglon de dos lados', function (int $entradas, int $salidas, string $esperado) {
    // `for` y no `range()`: `range(1, 0)` devuelve `[1, 0]`, así que el caso
    // de cero sembraría una fila y la prueba del «Sin registros» nunca se
    // cumpliría.
    for ($i = 0; $i < $entradas; $i++) {
        visitanteDeResumen(DIA_DEL_RESUMEN);
    }

    for ($i = 0; $i < $salidas; $i++) {
        visitanteDeResumen(DIA_ANTERIOR, DIA_DEL_RESUMEN);
    }

    expect(renglonDelResumen('visitantes')['texto'])->toBe($esperado);
})->with([
    'ninguno' => [0, 0, 'Sin registros'],
    'uno de cada' => [1, 1, '1 entrada y 1 salida'],
    'varios' => [3, 2, '3 entradas y 2 salidas'],
    'solo entradas' => [2, 0, '2 entradas y 0 salidas'],
]);

test('cada modulo usa su propia palabra para la entrada', function () {
    resguardoDeResumen(DIA_DEL_RESUMEN.' 07:00:00');
    operacionDeResumen(DIA_DEL_RESUMEN, 'llegada');

    expect(renglonDelResumen('resguardo_vehicular')['texto'])->toBe('1 ingreso y 0 salidas')
        ->and(renglonDelResumen('operaciones')['texto'])->toBe('1 llegada y 0 salidas');
});

test('el texto de la pernocta distingue ninguna, una y varias', function (int $cuantas, string $esperado) {
    for ($i = 0; $i < $cuantas; $i++) {
        pernoctaDeResumen(DIA_DEL_RESUMEN);
    }

    expect(renglonDelResumen('pernocta')['texto'])->toBe($esperado);
})->with([
    'ninguna' => [0, 'Sin pernoctas'],
    'una' => [1, '1 aeronave'],
    'varias' => [4, '4 aeronaves'],
]);

test('cada renglon lleva su titulo para la pantalla', function () {
    $titulos = collect(ResumenDelDiaSeguridad::para(Carbon::parse(DIA_DEL_RESUMEN)))
        ->pluck('titulo', 'clave')
        ->all();

    expect($titulos)->toBe([
        'aviones_csae' => 'Aviones de CSAE',
        'resguardo_vehicular' => 'Resguardo vehicular',
        'vehiculos' => 'Vehículos',
        'operaciones' => 'Operaciones',
        'visitantes' => 'Visitantes',
        'pernocta' => 'Pernocta del día',
    ]);
});
```

`expect($arreglo)->entradas->toBe(2)` funciona porque Pest deja acceder a las claves de un arreglo asociativo como si fueran propiedades. Si al correr fallara, cambiar esas aserciones a `expect($arreglo['entradas'])->toBe(2)` y dejar constancia en el reporte.

- [ ] **Step 2: Correr la prueba para verla fallar**

Run: `php artisan test tests/Feature/EntregaTurnoSeguridad/ResumenDelDiaTest.php`
Expected: FAIL. `App\Support\ResumenDelDiaSeguridad` no existe.

- [ ] **Step 3: Escribir el servicio**

Crear `app/Support/ResumenDelDiaSeguridad.php`:

```php
<?php

namespace App\Support;

use App\Models\EstacionamientoSubterraneo;
use App\Models\MovimientoCSAE;
use App\Models\movimientoVehiculo;
use App\Models\OperacionDiaria;
use App\Models\PernoctaDia;
use App\Models\RegistroVisitante;
use Carbon\CarbonInterface;

/**
 * El resumen de un día de Seguridad, leído de los módulos que lo registran.
 *
 * Sustituye a las ocho casillas que alguien marcaba: el relevo ya no
 * pregunta «¿revisaste los vehículos?», dice cuántos movimientos de
 * vehículos hubo.
 *
 * No conoce relevos, solo fechas. Quien lo llame decide si el número se
 * enseña en vivo o se guarda congelado.
 *
 * Son nueve consultas y no seis porque tres de las tablas guardan la entrada
 * y la salida en columnas distintas y cada lado necesita su propio conteo.
 * Juntarlos con sumas condicionales pediría `DATE()` en crudo, que no se
 * comporta igual en MySQL y en el sqlite de las pruebas.
 */
final class ResumenDelDiaSeguridad
{
    /**
     * @return list<array{clave: string, titulo: string, texto: string, entradas?: int, salidas?: int, total?: int}>
     */
    public static function para(CarbonInterface $dia): array
    {
        $fecha = $dia->toDateString();

        $vehiculos = movimientoVehiculo::query()
            ->whereDate('created_at', $fecha)
            ->selectRaw('tipo, COUNT(*) as total')
            ->groupBy('tipo')
            ->pluck('total', 'tipo');

        $operaciones = OperacionDiaria::activas()
            ->where('fecha', $fecha)
            ->selectRaw('tipo, COUNT(*) as total')
            ->groupBy('tipo')
            ->pluck('total', 'tipo');

        return [
            self::dosLados(
                'aviones_csae',
                'Aviones de CSAE',
                'entrada',
                MovimientoCSAE::query()->where('status', 'A')->whereDate('fecha_hora_entrada', $fecha)->count(),
                MovimientoCSAE::query()->where('status', 'A')->whereDate('fecha_hora_salida', $fecha)->count(),
            ),
            self::dosLados(
                'resguardo_vehicular',
                'Resguardo vehicular',
                'ingreso',
                EstacionamientoSubterraneo::query()->whereDate('fecha_ingreso', $fecha)->count(),
                EstacionamientoSubterraneo::query()->whereDate('fecha_salida', $fecha)->count(),
            ),
            self::dosLados(
                'vehiculos',
                'Vehículos',
                'entrada',
                (int) ($vehiculos['Entrada'] ?? 0),
                (int) ($vehiculos['Salida'] ?? 0),
            ),
            self::dosLados(
                'operaciones',
                'Operaciones',
                'llegada',
                (int) ($operaciones['llegada'] ?? 0),
                (int) ($operaciones['salida'] ?? 0),
            ),
            self::dosLados(
                'visitantes',
                'Visitantes',
                'entrada',
                RegistroVisitante::query()->where('fecha_entrada', $fecha)->count(),
                RegistroVisitante::query()->where('fecha_salida', $fecha)->count(),
            ),
            self::pernocta(PernoctaDia::query()->where('fecha', $fecha)->count()),
        ];
    }

    /**
     * Un renglón de los que tienen dos lados.
     *
     * `$palabraEntrada` cambia por módulo —entrada, ingreso, llegada— porque
     * es la palabra que usa cada pantalla, y quien lee el relevo es la misma
     * gente que las usa. El plural se hace añadiendo una `s`, que vale para
     * las tres.
     *
     * El texto se arma aquí y no en la pantalla para que el navegador no
     * tenga que saber pluralizar en español.
     *
     * @return array{clave: string, titulo: string, texto: string, entradas: int, salidas: int}
     */
    private static function dosLados(
        string $clave,
        string $titulo,
        string $palabraEntrada,
        int $entradas,
        int $salidas,
    ): array {
        return [
            'clave' => $clave,
            'titulo' => $titulo,
            'texto' => $entradas === 0 && $salidas === 0
                ? 'Sin registros'
                : sprintf(
                    '%d %s y %d %s',
                    $entradas,
                    $entradas === 1 ? $palabraEntrada : $palabraEntrada.'s',
                    $salidas,
                    $salidas === 1 ? 'salida' : 'salidas',
                ),
            'entradas' => $entradas,
            'salidas' => $salidas,
        ];
    }

    /** @return array{clave: string, titulo: string, texto: string, total: int} */
    private static function pernocta(int $total): array
    {
        return [
            'clave' => 'pernocta',
            'titulo' => 'Pernocta del día',
            'texto' => match (true) {
                $total === 0 => 'Sin pernoctas',
                $total === 1 => '1 aeronave',
                default => $total.' aeronaves',
            },
            'total' => $total,
        ];
    }
}
```

- [ ] **Step 4: Correr la prueba para verla pasar**

Run: `php artisan test tests/Feature/EntregaTurnoSeguridad/ResumenDelDiaTest.php`
Expected: PASS.

- [ ] **Step 5: Comprobar que las pruebas vigilan lo que dicen vigilar**

Quitar `->where('status', 'A')` de la consulta de `aviones_csae` y volver a correr: la prueba «los aviones de csae dados de baja no cuentan» tiene que ponerse roja. Reponerlo.

Quitar `->whereDate('created_at', $fecha)` de la consulta de vehículos y volver a correr: «los vehiculos cuentan por su tipo y por el dia en que se capturaron» tiene que ponerse roja. Reponerlo.

Si alguna de las dos sigue verde, la prueba no vigila nada y hay que arreglarla antes de seguir.

- [ ] **Step 6: Commit**

```bash
git add app/Support/ResumenDelDiaSeguridad.php tests/Feature/EntregaTurnoSeguridad/ResumenDelDiaTest.php
git commit -m "feat(seguridad): el resumen del dia sale de los modulos que lo registran"
```

---

### Task 3: El alta y el detalle dejan de hablar de casillas

**Files:**
- Modify: `app/Http/Controllers/Api/EntregaTurnoSeguridadController.php` (métodos `detalle` y `store`)
- Modify: `app/Http/Requests/EntregaTurnoSeguridad/StoreEntregaTurnoSeguridadRequest.php`
- Test: `tests/Feature/EntregaTurnoSeguridad/CrearRelevoTest.php` (modificar)

**Interfaces:**
- Consumes: `EntregaTurnoSeguridad::SECCION_CASETA`, `::SECCIONES` (Tarea 1); `ResumenDelDiaSeguridad::para()` (Tarea 2).
- Produces: el detalle del relevo trae `resumen` con la forma `{ congelado: bool, renglones: [...] }` y ya no trae las ocho claves booleanas ni `pernocta_mensual`.

- [ ] **Step 1: Ajustar las pruebas de alta**

En `tests/Feature/EntregaTurnoSeguridad/CrearRelevoTest.php`:

Cambiar el ayudante `datosDeRelevo` para que use la sección nueva:

```php
        'seccion' => EntregaTurnoSeguridad::SECCION_CASETA,
```

Borrar las cuatro pruebas de pernocta mensual (`'la pernocta mensual se queda en sin revisar cuando no se manda'`, `'la pernocta mensual acepta sus tres letras'`, `'la pernocta mensual rechaza cualquier otra letra'` y cualquier otra que nombre `pernocta_mensual`) y las que afirmen sobre casillas.

Añadir al final del archivo:

```php
test('la seccion solo admite caseta y plataforma', function (string $seccion) {
    $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo(['seccion' => $seccion]))
        ->assertSuccessful();
})->with(['caseta', 'plataforma']);

test('la seccion ya no admite los nombres viejos', function (string $seccion) {
    $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo(['seccion' => $seccion]))
        ->assertStatus(422)
        ->assertJsonValidationErrors('seccion');
})->with(['frente', 'atras']);

test('el detalle del alta trae el resumen del dia, en vivo', function () {
    $respuesta = $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo());

    $respuesta->assertSuccessful();

    $resumen = $respuesta->json('data.resumen');

    expect($resumen['congelado'])->toBeFalse()
        ->and(collect($resumen['renglones'])->pluck('clave')->all())->toBe([
            'aviones_csae',
            'resguardo_vehicular',
            'vehiculos',
            'operaciones',
            'visitantes',
            'pernocta',
        ]);
});

test('el detalle ya no trae casillas ni pernocta mensual', function () {
    $respuesta = $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo());

    $datos = $respuesta->json('data');

    expect($datos)->not->toHaveKey('pernocta_mensual')
        ->and($datos)->not->toHaveKey('aviones_csae')
        ->and($datos)->not->toHaveKey('combustible')
        ->and($datos)->not->toHaveKey('posiciones');
});

test('mandar casillas en el alta no crea columnas ni revienta', function () {
    $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo([
            'aviones_csae' => true,
            'pernocta_mensual' => 'S',
        ]))
        ->assertSuccessful();

    expect(EntregaTurnoSeguridad::sole()->resumen)->toBeNull();
});
```

- [ ] **Step 2: Correr las pruebas para verlas fallar**

Run: `php artisan test tests/Feature/EntregaTurnoSeguridad/CrearRelevoTest.php`
Expected: FAIL. El controlador sigue nombrando `EntregaTurnoSeguridad::CASILLAS`, que ya no existe.

- [ ] **Step 3: Limpiar el Form Request del alta**

En `StoreEntregaTurnoSeguridadRequest::rules()`, borrar las nueve reglas de casillas y pernocta. El método queda:

```php
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'fecha_hora' => ['required', 'date', new DentroDeLaVentana('seguridad.entrega_turno')],
            'seccion' => ['required', Rule::in(EntregaTurnoSeguridad::SECCIONES)],
            'observaciones' => ['nullable', 'string'],
            /*
             * El `=` solo se admite como relleno FINAL, y el cierre es `\z` y
             * no `$`.
             *
             * Con `[A-Za-z0-9+\/=]{16,}$` dieciséis `=` pasaban la
             * validación: `base64_decode` devolvía cadena vacía, se escribía
             * un archivo de cero bytes y se creaba el renglón de `Firma`. El
             * `detalle()` solo descarta las firmas cuyo archivo NO existe, y
             * éste existe, así que el relevo quedaba «firmado» con una imagen
             * rota. En este módulo la firma es lo que da valor al registro.
             *
             * El `\z` cierra además que `$` en PHP, sin el modificador `D`,
             * acepta un salto de línea final.
             *
             * La MISMA regla va en UpdateEntregaTurnoSeguridadRequest, tres
             * veces: si se cambia una, se cambian las cuatro.
             */
            'firma_quien_entrega' => [
                'required',
                'string',
                'regex:/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+\/]{16,}={0,2}\z/',
            ],
        ];
    }
```

Y en `messages()`, cambiar los dos mensajes de sección y borrar el de pernocta:

```php
    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'seccion.required' => 'Hay que decir si el relevo es de la caseta o de la plataforma.',
            'seccion.in' => 'La sección solo puede ser caseta o plataforma.',
            'firma_quien_entrega.required' => 'Falta la firma de quien entrega el turno.',
            'firma_quien_entrega.regex' => 'La firma de quien entrega no llegó como una imagen válida.',
        ];
    }
```

- [ ] **Step 4: Cambiar `detalle()` en el controlador**

Añadir el import `use App\Support\ResumenDelDiaSeguridad;`.

Sustituir el cuerpo de `detalle()` desde `$casillas = [];` hasta el `return`:

```php
        return [
            'id' => $relevo->id,
            'nombre' => $relevo->usuario?->name ?? '',
            'fecha' => $relevo->fecha_hora->toDateString(),
            'hora' => $relevo->fecha_hora->format('H:i'),
            'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
            'seccion' => $relevo->seccion,
            'resumen' => [
                /*
                 * `congelado` sale de si la columna tiene algo, no de un
                 * campo dentro del JSON: un relevo cerrado guarda sus
                 * renglones y deja de consultar; uno abierto los recalcula
                 * en cada lectura y sus números crecen con el día.
                 */
                'congelado' => $relevo->resumen !== null,
                'renglones' => $relevo->resumen ?? ResumenDelDiaSeguridad::para($relevo->fecha_hora),
            ],
            'observaciones' => $relevo->observaciones,
            'firmas' => $firmas,
        ];
```

Borrar el bloque del `foreach (EntregaTurnoSeguridad::CASILLAS as $casilla)` y la variable `$casillas`.

- [ ] **Step 5: Correr las pruebas para verlas pasar**

Run: `php artisan test tests/Feature/EntregaTurnoSeguridad/CrearRelevoTest.php tests/Feature/EntregaTurnoSeguridad/EsquemaV2Test.php tests/Feature/EntregaTurnoSeguridad/ResumenDelDiaTest.php`
Expected: PASS las tres. Las demás pruebas del módulo siguen rojas hasta la Tarea 5.

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/Api/EntregaTurnoSeguridadController.php app/Http/Requests/EntregaTurnoSeguridad/StoreEntregaTurnoSeguridadRequest.php tests/Feature/EntregaTurnoSeguridad/CrearRelevoTest.php
git commit -m "feat(seguridad): el relevo sirve el resumen del dia en vez de las casillas"
```

---

### Task 4: Tres firmas, permisos y congelado

**Files:**
- Modify: `app/Http/Controllers/Api/EntregaTurnoSeguridadController.php` (`humanizeRol`, `update`, `eliminar`, y el método nuevo `congelarSiCerro`)
- Modify: `app/Http/Requests/EntregaTurnoSeguridad/UpdateEntregaTurnoSeguridadRequest.php`
- Test: `tests/Feature/EntregaTurnoSeguridad/EditarYEliminarRelevoTest.php` (modificar)
- Test: `tests/Feature/EntregaTurnoSeguridad/CongelarResumenTest.php` (crear)

**Interfaces:**
- Consumes: `EntregaTurnoSeguridad::ROL_JEFE_AREA`, `::ROLES_DE_CIERRE`, `$relevo->estaCerrado()` (Tarea 1); `ResumenDelDiaSeguridad::para()` (Tarea 2).
- Produces: `PUT /api/EntregaTurnoSeguridad/{id}` acepta `firma_jefe_area`; al entrar la tercera firma la columna `resumen` queda escrita.

- [ ] **Step 1: Escribir la prueba del congelado**

Crear `tests/Feature/EntregaTurnoSeguridad/CongelarResumenTest.php`:

```php
<?php

use App\Models\EntregaTurnoSeguridad;
use App\Models\PernoctaDia;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

/*
 * El resumen se congela en el instante en que entra la TERCERA firma, y no
 * antes ni después.
 */

/** Un PNG de un pixel con el prefijo que el servidor espera. */
function firmaDeCongelado(): string
{
    return 'data:image/png;base64,'
        .'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
}

function usuarioDeCongelado(string $slug): User
{
    $usuario = User::factory()->create();
    $rol = Role::firstOrCreate(['slug' => $slug], ['nombre' => ucfirst($slug)]);
    $usuario->roles()->attach($rol->id);

    return $usuario;
}

/** Un relevo recién creado por la API: ya trae la firma de quien entrega. */
function relevoReciénCreado(): EntregaTurnoSeguridad
{
    test()->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', [
            'fecha_hora' => now()->format('Y-m-d H:i:s'),
            'seccion' => EntregaTurnoSeguridad::SECCION_CASETA,
            'firma_quien_entrega' => firmaDeCongelado(),
        ])->assertSuccessful();

    return EntregaTurnoSeguridad::sole();
}

beforeEach(function () {
    Storage::fake('public');
});

test('con dos firmas el resumen sigue sin congelar', function () {
    $relevo = relevoReciénCreado();

    $this->actingAs(usuarioDeCongelado('jefe_area'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
            'firma_jefe_area' => firmaDeCongelado(),
        ])->assertSuccessful();

    expect($relevo->fresh()->resumen)->toBeNull();
});

test('la tercera firma congela el resumen', function () {
    PernoctaDia::create(['fecha' => now()->toDateString(), 'matricula' => 'XA-UNO']);

    $relevo = relevoReciénCreado();

    $this->actingAs(usuarioDeCongelado('jefe_area'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
            'firma_jefe_area' => firmaDeCongelado(),
        ])->assertSuccessful();

    $this->actingAs(usuarioDeCongelado('fbo'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
            'firma_fbo' => firmaDeCongelado(),
        ])->assertSuccessful();

    $congelado = $relevo->fresh()->resumen;

    expect($congelado)->toBeArray()
        ->and(collect($congelado)->firstWhere('clave', 'pernocta')['total'])->toBe(1);
});

test('el orden de las dos firmas de cierre da igual', function () {
    $relevo = relevoReciénCreado();

    $this->actingAs(usuarioDeCongelado('fbo'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
            'firma_fbo' => firmaDeCongelado(),
        ])->assertSuccessful();

    expect($relevo->fresh()->resumen)->toBeNull();

    $this->actingAs(usuarioDeCongelado('jefe_area'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
            'firma_jefe_area' => firmaDeCongelado(),
        ])->assertSuccessful();

    expect($relevo->fresh()->resumen)->toBeArray();
});

test('un relevo congelado no cambia aunque despues se registre mas movimiento', function () {
    $relevo = relevoReciénCreado();

    foreach (['jefe_area', 'fbo'] as $rol) {
        $this->actingAs(usuarioDeCongelado($rol))
            ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
                'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
                'firma_'.$rol => firmaDeCongelado(),
            ])->assertSuccessful();
    }

    PernoctaDia::create(['fecha' => now()->toDateString(), 'matricula' => 'XA-DOS']);

    $respuesta = $this->actingAs(usuarioDeCongelado('fbo'))
        ->getJson("/api/EntregaTurnoSeguridad/{$relevo->id}");

    expect($respuesta->json('data.resumen.congelado'))->toBeTrue()
        ->and(collect($respuesta->json('data.resumen.renglones'))->firstWhere('clave', 'pernocta')['total'])
        ->toBe(0);
});

test('reponer una firma no recalcula un resumen ya congelado', function () {
    $relevo = relevoReciénCreado();

    foreach (['jefe_area', 'fbo'] as $rol) {
        $this->actingAs(usuarioDeCongelado($rol))
            ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
                'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
                'firma_'.$rol => firmaDeCongelado(),
            ])->assertSuccessful();
    }

    PernoctaDia::create(['fecha' => now()->toDateString(), 'matricula' => 'XA-TRES']);

    $this->actingAs(usuarioDeCongelado('fbo'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
            'firma_fbo' => firmaDeCongelado(),
        ])->assertSuccessful();

    expect(collect($relevo->fresh()->resumen)->firstWhere('clave', 'pernocta')['total'])->toBe(0);
});

test('el jefe de area no puede poner la firma del fbo', function () {
    $relevo = relevoReciénCreado();

    $this->actingAs(usuarioDeCongelado('jefe_area'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
            'firma_fbo' => firmaDeCongelado(),
        ])->assertForbidden();

    expect($relevo->fresh()->load('firmas')->tieneFirmaDe(EntregaTurnoSeguridad::ROL_FBO))->toBeFalse();
});

test('el fbo no puede poner la firma del jefe de area', function () {
    $relevo = relevoReciénCreado();

    $this->actingAs(usuarioDeCongelado('fbo'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
            'firma_jefe_area' => firmaDeCongelado(),
        ])->assertForbidden();

    expect($relevo->fresh()->load('firmas')->tieneFirmaDe(EntregaTurnoSeguridad::ROL_JEFE_AREA))->toBeFalse();
});

test('el administrador puede poner las dos firmas de cierre', function () {
    $relevo = relevoReciénCreado();

    $this->actingAs(usuarioDeCongelado('admin'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
            'firma_jefe_area' => firmaDeCongelado(),
            'firma_fbo' => firmaDeCongelado(),
        ])->assertSuccessful();

    expect($relevo->fresh()->resumen)->toBeArray();
});

test('la firma del jefe de area se guarda con su etiqueta', function () {
    $relevo = relevoReciénCreado();

    $this->actingAs(usuarioDeCongelado('jefe_area'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
            'firma_jefe_area' => firmaDeCongelado(),
        ])->assertSuccessful();

    $firma = $relevo->fresh()->load('firmas')->firmas
        ->first(fn ($firma) => $firma->pivot->rol === EntregaTurnoSeguridad::ROL_JEFE_AREA);

    expect($firma)->not->toBeNull()
        ->and($firma->pivot->tag)->toBe('Firma del jefe de área');
});
```

- [ ] **Step 2: Correr la prueba para verla fallar**

Run: `php artisan test tests/Feature/EntregaTurnoSeguridad/CongelarResumenTest.php`
Expected: FAIL. `firma_jefe_area` no está en las reglas, así que se ignora y nunca entra la tercera firma.

- [ ] **Step 3: Añadir la regla al Form Request de edición**

En `UpdateEntregaTurnoSeguridadRequest::rules()`, borrar las nueve reglas de casillas y pernocta, y añadir `firma_jefe_area` entre las otras dos firmas:

```php
            'firma_jefe_area' => [
                'sometimes',
                'nullable',
                'string',
                'regex:/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+\/]{16,}={0,2}\z/',
            ],
```

En `messages()`, quitar los de pernocta, cambiar el de sección y añadir el de la firma nueva:

```php
    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'seccion.in' => 'La sección solo puede ser caseta o plataforma.',
            'firma_quien_entrega.regex' => 'La firma de quien entrega no llegó en un formato válido.',
            'firma_jefe_area.regex' => 'La firma del jefe de área no llegó en un formato válido.',
            'firma_fbo.regex' => 'La firma del FBO no llegó en un formato válido.',
        ];
    }
```

- [ ] **Step 4: Cambiar `humanizeRol` y `update` en el controlador**

`humanizeRol` gana su caso:

```php
    private function humanizeRol(string $rol): string
    {
        return match ($rol) {
            EntregaTurnoSeguridad::ROL_QUIEN_ENTREGA => 'Firma de quien entrega',
            EntregaTurnoSeguridad::ROL_JEFE_AREA => 'Firma del jefe de área',
            EntregaTurnoSeguridad::ROL_FBO => 'Firma del FBO',
            default => ucfirst(str_replace('_', ' ', $rol)),
        };
    }
```

`update` queda así:

```php
    public function update(UpdateEntregaTurnoSeguridadRequest $request, int $id): JsonResponse
    {
        $usuario = $request->user();

        if (! $usuario->hasAnyRole(['fbo', 'jefe_area', 'admin'])) {
            return response()->json([
                'message' => 'Solo el jefe de área, el FBO y el administrador pueden editar un relevo.',
            ], 403);
        }

        $relevo = EntregaTurnoSeguridad::activas()->find($id);

        if ($relevo === null) {
            return response()->json(['message' => 'El relevo no existe.'], 404);
        }

        $validado = $request->validated();
        $firmaEntrega = $validado['firma_quien_entrega'] ?? null;
        $firmaJefe = $validado['firma_jefe_area'] ?? null;
        $firmaFbo = $validado['firma_fbo'] ?? null;
        unset($validado['firma_quien_entrega'], $validado['firma_jefe_area'], $validado['firma_fbo']);

        /*
         * Tener permiso para EDITAR no es tener permiso para firmar por otro.
         * Sin esta guardia, un jefe de área podría poner la firma del FBO y
         * cerrar el relevo él solo, que es justo lo que las tres firmas
         * vienen a impedir.
         */
        $esAdmin = $usuario->hasRole('admin');

        if (is_string($firmaJefe) && ! $esAdmin && ! $usuario->hasRole(EntregaTurnoSeguridad::ROL_JEFE_AREA)) {
            return response()->json(['message' => 'Solo el jefe de área puede poner su firma.'], 403);
        }

        if (is_string($firmaFbo) && ! $esAdmin && ! $usuario->hasRole(EntregaTurnoSeguridad::ROL_FBO)) {
            return response()->json(['message' => 'Solo el FBO puede poner su firma.'], 403);
        }

        DB::transaction(function () use ($relevo, $validado, $firmaEntrega, $firmaJefe, $firmaFbo): void {
            if ($validado !== []) {
                $relevo->update($validado);
            }

            if (is_string($firmaEntrega)) {
                $this->guardarFirmaBase64($firmaEntrega, EntregaTurnoSeguridad::ROL_QUIEN_ENTREGA, $relevo);
            }

            if (is_string($firmaJefe)) {
                $this->guardarFirmaBase64($firmaJefe, EntregaTurnoSeguridad::ROL_JEFE_AREA, $relevo);
            }

            if (is_string($firmaFbo)) {
                $this->guardarFirmaBase64($firmaFbo, EntregaTurnoSeguridad::ROL_FBO, $relevo);
            }

            $this->congelarSiCerro($relevo);
        });

        return response()->json([
            'message' => 'Relevo actualizado correctamente',
            'data' => $this->detalle($relevo->fresh()->load(['usuario:id,name', 'firmas'])),
        ]);
    }

    /**
     * Guarda el resumen del día en cuanto el relevo queda cerrado.
     *
     * Se llama DESPUÉS de adjuntar las firmas y dentro de la misma
     * transacción. El `load` es obligatorio: la relación que trae el modelo
     * es la de antes de adjuntar, así que sin releerla la firma recién
     * puesta no contaría y el relevo nunca se cerraría.
     *
     * No recalcula lo ya congelado. Un relevo cerrado es un documento:
     * reponer una firma no cambia el día que describe.
     */
    private function congelarSiCerro(EntregaTurnoSeguridad $relevo): void
    {
        if ($relevo->resumen !== null) {
            return;
        }

        $relevo->load('firmas');

        if (! $relevo->estaCerrado()) {
            return;
        }

        $relevo->update(['resumen' => ResumenDelDiaSeguridad::para($relevo->fecha_hora)]);
    }
```

`eliminar` cambia su guardia y su mensaje:

```php
        if (! $request->user()->hasAnyRole(['fbo', 'jefe_area', 'admin'])) {
            return response()->json([
                'message' => 'Solo el jefe de área, el FBO y el administrador pueden eliminar un relevo.',
            ], 403);
        }
```

- [ ] **Step 5: Ajustar las pruebas de edición**

En `tests/Feature/EntregaTurnoSeguridad/EditarYEliminarRelevoTest.php`: cambiar `SECCION_FRENTE` por `SECCION_CASETA` y `SECCION_ATRAS` por `SECCION_PLATAFORMA` donde aparezcan, y borrar las pruebas que manden casillas o `pernocta_mensual`. Donde una prueba afirme que un usuario sin rol recibe 403 al editar, añadir una gemela con el rol `jefe_area` que reciba éxito.

- [ ] **Step 6: Correr las pruebas para verlas pasar**

Run: `php artisan test tests/Feature/EntregaTurnoSeguridad/CongelarResumenTest.php tests/Feature/EntregaTurnoSeguridad/EditarYEliminarRelevoTest.php`
Expected: PASS.

- [ ] **Step 7: Comprobar que las pruebas vigilan lo que dicen vigilar**

Quitar la línea `$relevo->load('firmas');` de `congelarSiCerro` y correr de nuevo: «la tercera firma congela el resumen» tiene que ponerse roja. Reponerla.

Quitar la guardia de `firma_fbo` por rol y correr de nuevo: «el jefe de area no puede poner la firma del fbo» tiene que ponerse roja. Reponerla.

- [ ] **Step 8: Commit**

```bash
git add app/Http/Controllers/Api/EntregaTurnoSeguridadController.php app/Http/Requests/EntregaTurnoSeguridad/UpdateEntregaTurnoSeguridadRequest.php tests/Feature/EntregaTurnoSeguridad/CongelarResumenTest.php tests/Feature/EntregaTurnoSeguridad/EditarYEliminarRelevoTest.php
git commit -m "feat(seguridad): tres firmas cierran el relevo y congelan el resumen"
```

---

### Task 5: El listado, su distintivo y sus filtros

**Files:**
- Modify: `app/Http/Controllers/Api/EntregaTurnoSeguridadController.php` (`filasDeLosDias`, `seccionDelDia`, `consultaFiltrada`, `diasIncompletos`)
- Modify: `app/Http/Requests/EntregaTurnoSeguridad/IndexEntregaTurnoSeguridadRequest.php`
- Test: `tests/Feature/EntregaTurnoSeguridad/ListadoPorDiaTest.php` (modificar)

**Interfaces:**
- Consumes: `EntregaTurnoSeguridad::SECCIONES`, `$relevo->firmasFaltantes()` (Tarea 1).
- Produces: cada fila del listado trae `fecha`, `caseta` y `plataforma`; cada sección trae `id`, `nombre`, `hora`, `firmas_faltantes` (lista), `pernocta` (entero) y `extras`. El filtro `estado` acepta `completas`, `falta_jefe_area` y `falta_fbo`.

- [ ] **Step 1: Escribir las pruebas que fallan**

El archivo ya trae tres ayudantes que se reutilizan tal cual: `relevoDelDia(string $dia, string $seccion, string $hora = '07:30', array $extra = [])`, que recibe el DÍA y la hora por separado; `listado(array $parametros = [])`, que crea su propio usuario y devuelve la respuesta; y `firmarComoFbo(EntregaTurnoSeguridad $relevo)`.

Primero, **generalizar `firmarComoFbo`** para que sirva a los dos roles de cierre, y cambiar sus llamadas existentes en el archivo:

```php
/**
 * Firma un relevo con el rol que se le diga.
 *
 * El rol es un parámetro y no una constante escondida: con un ayudante que
 * solo supiera firmar como FBO, el distintivo de «falta jefe de área» no
 * tendría quien lo vigilara.
 */
function firmarRelevoDelDia(EntregaTurnoSeguridad $relevo, string $rol): void
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
```

Borrar `firmarComoFbo` y sustituir sus llamadas por `firmarRelevoDelDia($relevo, EntregaTurnoSeguridad::ROL_FBO)`. Cambiar en todo el archivo `SECCION_FRENTE` por `SECCION_CASETA` y `SECCION_ATRAS` por `SECCION_PLATAFORMA`, y las claves `'frente'`/`'atras'` de los `json(...)` por `'caseta'`/`'plataforma'`. Añadir los imports `use App\Models\PernoctaDia;` y `use Illuminate\Support\Facades\DB;`.

Luego añadir:

```php
test('la fila del dia se llama caseta y plataforma', function () {
    relevoDelDia('2026-11-09', EntregaTurnoSeguridad::SECCION_CASETA);

    $fila = listado()->json('data.0');

    expect($fila)->toHaveKeys(['fecha', 'caseta', 'plataforma'])
        ->and($fila)->not->toHaveKey('frente')
        ->and($fila)->not->toHaveKey('atras');
});

test('la seccion dice que firmas le faltan, en orden', function () {
    relevoDelDia('2026-11-09', EntregaTurnoSeguridad::SECCION_CASETA);

    expect(listado()->json('data.0.caseta.firmas_faltantes'))->toBe(['jefe_area', 'fbo']);
});

test('con solo la firma del jefe queda faltando la del fbo', function () {
    $relevo = relevoDelDia('2026-11-09', EntregaTurnoSeguridad::SECCION_CASETA);
    firmarRelevoDelDia($relevo, EntregaTurnoSeguridad::ROL_JEFE_AREA);

    expect(listado()->json('data.0.caseta.firmas_faltantes'))->toBe(['fbo']);
});

test('con las dos firmas de cierre la lista de faltantes queda vacia', function () {
    $relevo = relevoDelDia('2026-11-09', EntregaTurnoSeguridad::SECCION_CASETA);
    firmarRelevoDelDia($relevo, EntregaTurnoSeguridad::ROL_JEFE_AREA);
    firmarRelevoDelDia($relevo, EntregaTurnoSeguridad::ROL_FBO);

    expect(listado()->json('data.0.caseta.firmas_faltantes'))->toBe([]);
});

test('la seccion trae la pernocta del dia en vivo', function () {
    PernoctaDia::create(['fecha' => '2026-11-09', 'matricula' => 'XA-UNO']);
    PernoctaDia::create(['fecha' => '2026-11-09', 'matricula' => 'XA-DOS']);
    PernoctaDia::create(['fecha' => '2026-11-08', 'matricula' => 'XA-TRE']);

    relevoDelDia('2026-11-09', EntregaTurnoSeguridad::SECCION_CASETA);

    expect(listado()->json('data.0.caseta.pernocta'))->toBe(2);
});

test('la seccion congelada trae la pernocta que se guardo, no la de hoy', function () {
    $relevo = relevoDelDia('2026-11-09', EntregaTurnoSeguridad::SECCION_CASETA);
    $relevo->update(['resumen' => [
        ['clave' => 'pernocta', 'titulo' => 'Pernocta del día', 'texto' => '9 aeronaves', 'total' => 9],
    ]]);

    PernoctaDia::create(['fecha' => '2026-11-09', 'matricula' => 'XA-UNO']);

    expect(listado()->json('data.0.caseta.pernocta'))->toBe(9);
});

test('el listado no pide el resumen completo por renglon', function () {
    // Diez días con sus dos puestos. Si el controlador llamara al servicio
    // del resumen por sección, serían ciento ochenta consultas para pintar
    // diez renglones, y nadie lo vería hasta que la tabla creciera.
    for ($dia = 1; $dia <= 10; $dia++) {
        $fecha = sprintf('2026-11-%02d', $dia);
        relevoDelDia($fecha, EntregaTurnoSeguridad::SECCION_CASETA, '07:30');
        relevoDelDia($fecha, EntregaTurnoSeguridad::SECCION_PLATAFORMA, '19:00');
    }

    $usuario = User::factory()->create();

    DB::enableQueryLog();

    $this->actingAs($usuario)
        ->getJson('/api/EntregaTurnoSeguridad?per_page=10')
        ->assertSuccessful();

    $consultas = count(DB::getQueryLog());
    DB::disableQueryLog();

    expect($consultas)->toBeLessThan(15);
});

test('el filtro de estado distingue a quien le falta', function () {
    $soloJefe = relevoDelDia('2026-11-09', EntregaTurnoSeguridad::SECCION_CASETA);
    firmarRelevoDelDia($soloJefe, EntregaTurnoSeguridad::ROL_JEFE_AREA);

    $completo = relevoDelDia('2026-11-07', EntregaTurnoSeguridad::SECCION_CASETA);
    firmarRelevoDelDia($completo, EntregaTurnoSeguridad::ROL_JEFE_AREA);
    firmarRelevoDelDia($completo, EntregaTurnoSeguridad::ROL_FBO);

    expect(listado(['estado' => 'falta_fbo'])->json('meta.total'))->toBe(1)
        ->and(listado(['estado' => 'falta_jefe_area'])->json('meta.total'))->toBe(0)
        ->and(listado(['estado' => 'completas'])->json('meta.total'))->toBe(1);
});

test('el estado solo admite sus tres valores', function () {
    listado(['estado' => 'cualquiera'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('estado');
});

test('la seccion solo admite los nombres nuevos', function () {
    listado(['seccion' => 'frente'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('seccion');
});
```

- [ ] **Step 2: Correr las pruebas para verlas fallar**

Run: `php artisan test tests/Feature/EntregaTurnoSeguridad/ListadoPorDiaTest.php`
Expected: FAIL. La fila sigue diciendo `frente` y `atras`, y la sección sigue trayendo `firmado_fbo`.

- [ ] **Step 3: Cambiar `filasDeLosDias` y `seccionDelDia`**

```php
    /**
     * Un renglón por día, con sus dos puestos.
     *
     * La pernocta del día se pide UNA vez para toda la página, agrupada por
     * fecha, en vez de llamar al servicio del resumen por sección: esa
     * llamada son nueve consultas, y por sección serían ciento ochenta para
     * pintar diez renglones.
     *
     * @param  list<string>  $diasDeLaPagina
     * @return list<array{fecha: string, caseta: ?array, plataforma: ?array}>
     */
    private function filasDeLosDias(array $diasDeLaPagina): array
    {
        if ($diasDeLaPagina === []) {
            return [];
        }

        $registros = EntregaTurnoSeguridad::activas()
            ->with(['usuario:id,name', 'firmas'])
            ->whereIn(DB::raw(self::DIA), $diasDeLaPagina)
            ->get()
            ->groupBy(
                static fn (EntregaTurnoSeguridad $relevo): string => $relevo->fecha_hora->toDateString()
            );

        $pernoctas = PernoctaDia::query()
            ->whereIn('fecha', $diasDeLaPagina)
            ->selectRaw('fecha, COUNT(*) as total')
            ->groupBy('fecha')
            ->pluck('total', 'fecha');

        return array_map(
            fn (string $dia): array => [
                'fecha' => $dia,
                'caseta' => $this->seccionDelDia(
                    $registros->get($dia, collect()),
                    EntregaTurnoSeguridad::SECCION_CASETA,
                    (int) ($pernoctas[$dia] ?? 0),
                ),
                'plataforma' => $this->seccionDelDia(
                    $registros->get($dia, collect()),
                    EntregaTurnoSeguridad::SECCION_PLATAFORMA,
                    (int) ($pernoctas[$dia] ?? 0),
                ),
            ],
            $diasDeLaPagina
        );
    }

    /**
     * Lo que se enseña de un puesto, o null si ese puesto no entregó.
     *
     * Con más de un registro del mismo puesto ese día devuelve el MÁS
     * RECIENTE y cuenta los demás en `extras`. No se descarta ninguno: la
     * tabla no tiene candado de uno por día y puesto a propósito.
     *
     * @param  Collection<int, EntregaTurnoSeguridad>  $delDia
     * @return array{id: int, nombre: string, hora: string, firmas_faltantes: list<string>, pernocta: int, extras: int}|null
     */
    private function seccionDelDia(Collection $delDia, string $seccion, int $pernoctaEnVivo): ?array
    {
        $deLaSeccion = $delDia->where('seccion', $seccion)->sortByDesc('fecha_hora')->values();

        if ($deLaSeccion->isEmpty()) {
            return null;
        }

        /** @var EntregaTurnoSeguridad $reciente */
        $reciente = $deLaSeccion->first();

        return [
            'id' => $reciente->id,
            'nombre' => $reciente->usuario?->name ?? '',
            'hora' => $reciente->fecha_hora->format('H:i'),
            'firmas_faltantes' => $reciente->firmasFaltantes(),
            'pernocta' => $this->pernoctaDe($reciente, $pernoctaEnVivo),
            'extras' => $deLaSeccion->count() - 1,
        ];
    }

    /**
     * La pernocta que enseña la tabla: la congelada si el relevo lo está, y
     * si no la del día, que viene contada para toda la página.
     */
    private function pernoctaDe(EntregaTurnoSeguridad $relevo, int $enVivo): int
    {
        if ($relevo->resumen === null) {
            return $enVivo;
        }

        foreach ($relevo->resumen as $renglon) {
            if (($renglon['clave'] ?? null) === 'pernocta') {
                return (int) ($renglon['total'] ?? 0);
            }
        }

        return 0;
    }
```

Añadir el import `use App\Models\PernoctaDia;`.

- [ ] **Step 4: Cambiar los filtros de estado**

Sustituir el bloque de `$estado` en `consultaFiltrada`:

```php
        $estado = $request->string('estado')->toString();

        if ($estado === 'falta_jefe_area') {
            $query->whereIn(DB::raw(self::DIA), $this->diasSinFirmaDe(EntregaTurnoSeguridad::ROL_JEFE_AREA));
        }

        if ($estado === 'falta_fbo') {
            $query->whereIn(DB::raw(self::DIA), $this->diasSinFirmaDe(EntregaTurnoSeguridad::ROL_FBO));
        }

        if ($estado === 'completas') {
            $query->whereNotIn(DB::raw(self::DIA), $this->diasIncompletos());
        }
```

Y sustituir `diasIncompletos()` por estos dos métodos:

```php
    /**
     * Los días con al menos un registro sin la firma de ese rol.
     *
     * Se calcula por DÍA y no por registro porque el estado es del día: un
     * día en que la caseta firmó y la plataforma no está incompleto, y un
     * filtro por registro lo daría por completo a través de la caseta.
     *
     * La base agrupa y devuelve días: traer un renglón por registro sin
     * firmar y deduplicar en PHP crecía sin tope con el historial.
     *
     * @return list<string>
     */
    private function diasSinFirmaDe(string $rol): array
    {
        return EntregaTurnoSeguridad::activas()
            ->whereDoesntHave(
                'firmas',
                static fn (Builder $firma): Builder => $firma->where('firmables.rol', $rol)
            )
            ->selectRaw(self::DIA.' as dia')
            ->distinct()
            ->pluck('dia')
            ->all();
    }

    /**
     * Los días a los que les falta CUALQUIERA de las dos firmas de cierre.
     *
     * Es la unión de los dos conjuntos, no su intersección: un día con el
     * jefe firmado y el FBO sin firmar sigue sin estar completo.
     *
     * @return list<string>
     */
    private function diasIncompletos(): array
    {
        return array_values(array_unique(array_merge(
            $this->diasSinFirmaDe(EntregaTurnoSeguridad::ROL_JEFE_AREA),
            $this->diasSinFirmaDe(EntregaTurnoSeguridad::ROL_FBO),
        )));
    }
```

- [ ] **Step 5: Cambiar el Form Request del listado**

En `IndexEntregaTurnoSeguridadRequest`:

```php
            'estado' => ['sometimes', 'nullable', Rule::in(['falta_jefe_area', 'falta_fbo', 'completas'])],
```

y en `messages()`:

```php
            'seccion.in' => 'La sección solo puede ser caseta o plataforma.',
            'estado.in' => 'El estado solo puede ser «falta la firma del jefe de área», «falta la firma del FBO» o «completas».',
```

- [ ] **Step 6: Correr las pruebas para verlas pasar**

Run: `php artisan test tests/Feature/EntregaTurnoSeguridad/ListadoPorDiaTest.php`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/Http/Controllers/Api/EntregaTurnoSeguridadController.php app/Http/Requests/EntregaTurnoSeguridad/IndexEntregaTurnoSeguridadRequest.php tests/Feature/EntregaTurnoSeguridad/ListadoPorDiaTest.php
git commit -m "feat(seguridad): el listado habla de caseta, plataforma y firmas que faltan"
```

---

### Task 6: La cola de pendientes depende de quién pregunta

**Files:**
- Modify: `app/Http/Controllers/Api/EntregaTurnoSeguridadController.php` (`pendientes`)
- Test: `tests/Feature/EntregaTurnoSeguridad/PendientesDeFirmaTest.php` (modificar)

**Interfaces:**
- Consumes: `EntregaTurnoSeguridad::ROLES_DE_CIERRE`, `$relevo->firmasFaltantes()` (Tarea 1).
- Produces: cada renglón de `GET /pendientes` trae además `falta`, una lista con los roles que le faltan de entre los que quien pregunta puede firmar.

- [ ] **Step 1: Escribir las pruebas que fallan**

En `tests/Feature/EntregaTurnoSeguridad/PendientesDeFirmaTest.php`, cambiar `SECCION_FRENTE`/`SECCION_ATRAS` por las nuevas y añadir:

```php
test('el jefe de area ve lo que le falta firmar a el', function () {
    $sinNada = relevoEn(now()->format('Y-m-d H:i:s'), EntregaTurnoSeguridad::SECCION_CASETA);

    $conJefe = relevoEn(now()->format('Y-m-d H:i:s'), EntregaTurnoSeguridad::SECCION_PLATAFORMA);
    firmarConRol($conJefe, EntregaTurnoSeguridad::ROL_JEFE_AREA);

    $respuesta = $this->actingAs(usuarioFboDePendientes('jefe_area'))
        ->getJson('/api/EntregaTurnoSeguridad/pendientes');

    expect($respuesta->json('data'))->toHaveCount(1)
        ->and($respuesta->json('data.0.id'))->toBe($sinNada->id)
        ->and($respuesta->json('data.0.falta'))->toBe(['jefe_area']);
});

test('el fbo ve lo que le falta firmar a el', function () {
    $sinNada = relevoEn(now()->format('Y-m-d H:i:s'), EntregaTurnoSeguridad::SECCION_CASETA);

    $conFbo = relevoEn(now()->format('Y-m-d H:i:s'), EntregaTurnoSeguridad::SECCION_PLATAFORMA);
    firmarConRol($conFbo, EntregaTurnoSeguridad::ROL_FBO);

    $respuesta = $this->actingAs(usuarioFboDePendientes('fbo'))
        ->getJson('/api/EntregaTurnoSeguridad/pendientes');

    expect($respuesta->json('data'))->toHaveCount(1)
        ->and($respuesta->json('data.0.id'))->toBe($sinNada->id)
        ->and($respuesta->json('data.0.falta'))->toBe(['fbo']);
});

test('el administrador ve los dos huecos en un solo renglon', function () {
    $relevo = relevoEn(now()->format('Y-m-d H:i:s'), EntregaTurnoSeguridad::SECCION_CASETA);

    $respuesta = $this->actingAs(usuarioFboDePendientes('admin'))
        ->getJson('/api/EntregaTurnoSeguridad/pendientes');

    expect($respuesta->json('data'))->toHaveCount(1)
        ->and($respuesta->json('data.0.id'))->toBe($relevo->id)
        ->and($respuesta->json('data.0.falta'))->toBe(['jefe_area', 'fbo']);
});

test('quien no firma nada recibe la cola vacia', function () {
    relevoEn(now()->format('Y-m-d H:i:s'), EntregaTurnoSeguridad::SECCION_CASETA);

    $respuesta = $this->actingAs(usuarioFboDePendientes('empleado'))
        ->getJson('/api/EntregaTurnoSeguridad/pendientes');

    expect($respuesta->json('data'))->toBe([]);
});

test('un relevo con las dos firmas sale de la cola de todos', function () {
    $relevo = relevoEn(now()->format('Y-m-d H:i:s'), EntregaTurnoSeguridad::SECCION_CASETA);
    firmarConRol($relevo, EntregaTurnoSeguridad::ROL_JEFE_AREA);
    firmarConRol($relevo, EntregaTurnoSeguridad::ROL_FBO);

    foreach (['jefe_area', 'fbo', 'admin'] as $slug) {
        $respuesta = $this->actingAs(usuarioFboDePendientes($slug))
            ->getJson('/api/EntregaTurnoSeguridad/pendientes');

        expect($respuesta->json('data'))->toBe([], "la cola de {$slug} debería estar vacía");
    }
});
```

- [ ] **Step 2: Correr las pruebas para verlas fallar**

Run: `php artisan test tests/Feature/EntregaTurnoSeguridad/PendientesDeFirmaTest.php`
Expected: FAIL. `pendientes` sigue filtrando fijo por el rol FBO y no manda `falta`.

- [ ] **Step 3: Reescribir `pendientes`**

```php
    /**
     * Los relevos que a QUIEN PREGUNTA le falta firmar.
     *
     * No es una lista fija: un jefe de área ve los que no tienen su firma,
     * un FBO los que no tienen la suya, y un administrador los que no tienen
     * alguna de las dos. Quien no pueda firmar ninguna recibe la cola vacía,
     * porque una cola de trabajo ajena no es información, es ruido.
     *
     * De lo más viejo a lo más nuevo a propósito: es una cola de trabajo, y
     * lo que lleva días sin firmar es lo que corre prisa.
     */
    public function pendientes(Request $request): JsonResponse
    {
        $usuario = $request->user();
        $esAdmin = $usuario->hasRole('admin');

        $roles = array_values(array_filter(
            EntregaTurnoSeguridad::ROLES_DE_CIERRE,
            static fn (string $rol): bool => $esAdmin || $usuario->hasRole($rol),
        ));

        if ($roles === []) {
            return response()->json(['data' => []]);
        }

        $relevos = EntregaTurnoSeguridad::activas()
            ->with(['usuario:id,name', 'firmas'])
            ->where(function (Builder $query) use ($roles): void {
                foreach ($roles as $rol) {
                    $query->orWhereDoesntHave(
                        'firmas',
                        static fn (Builder $firma): Builder => $firma->where('firmables.rol', $rol)
                    );
                }
            })
            ->orderBy('fecha_hora')
            ->orderBy('id')
            ->get()
            ->map(static fn (EntregaTurnoSeguridad $relevo): array => [
                'id' => $relevo->id,
                'nombre' => $relevo->usuario?->name ?? '',
                'fecha' => $relevo->fecha_hora->toDateString(),
                'hora' => $relevo->fecha_hora->format('H:i'),
                'seccion' => $relevo->seccion,
                'falta' => array_values(array_intersect($relevo->firmasFaltantes(), $roles)),
            ])
            ->all();

        return response()->json(['data' => $relevos]);
    }
```

- [ ] **Step 4: Correr las pruebas para verlas pasar**

Run: `php artisan test tests/Feature/EntregaTurnoSeguridad/PendientesDeFirmaTest.php`
Expected: PASS.

- [ ] **Step 5: Comprobar que la prueba vigila lo que dice vigilar**

Cambiar el `if ($roles === [])` por `if (false)` y correr de nuevo: «quien no firma nada recibe la cola vacia» tiene que ponerse roja. Reponerlo.

- [ ] **Step 6: Correr la suite completa del módulo**

Run: `php artisan test tests/Feature/EntregaTurnoSeguridad`
Expected: PASS todo. Si alguna prueba vieja sigue nombrando `frente`, `atras`, casillas o `pernocta_mensual`, se arregla aquí.

- [ ] **Step 7: Commit**

```bash
git add app/Http/Controllers/Api/EntregaTurnoSeguridadController.php tests/Feature/EntregaTurnoSeguridad/PendientesDeFirmaTest.php
git commit -m "feat(seguridad): la cola de pendientes es la de quien pregunta"
```

---

### Task 7: El listado del front se alinea con el contrato nuevo

**Files:**
- Modify: `resources/js/pages/seguridad/entregaTurno/types.ts`
- Modify: `resources/js/pages/seguridad/entregaTurno/CeldasRelevo.tsx`
- Modify: `resources/js/pages/seguridad/entregaTurno/TablaEntregaTurno.tsx`
- Modify: `resources/js/pages/seguridad/entregaTurno/SelectorSeccion.tsx`
- Modify: `resources/js/pages/seguridad/entregaTurno/FilaFiltros.tsx`
- Rename + modify: `resources/js/pages/seguridad/entregaTurno/PendientesFirmaFbo.tsx` → `PendientesDeFirma.tsx`
- Modify: `resources/js/pages/seguridad/EntregaTurno.tsx`

**Interfaces:**
- Consumes: el contrato del listado y de la cola de las tareas 5 y 6.
- Produces: `SECCIONES = ['caseta', 'plataforma']`, `SeccionRelevo` con `firmas_faltantes` y `pernocta`, `FilaRelevo` con `caseta` y `plataforma`, `PendienteRelevo` con `falta`, `ROL_JEFE_AREA`, `ETIQUETA_ROL`, y `FiltrosRelevo['estado']` con los tres valores nuevos.

En esta tarea `types.ts` **conserva** `CASILLAS`, `ETIQUETA_CASILLA`, `PERNOCTA` y `ETIQUETA_PERNOCTA`: los borra la Tarea 8, que es la que toca el formulario y la vista previa. Borrarlos aquí dejaría el árbol sin compilar.

- [ ] **Step 1: Cambiar los tipos**

En `types.ts`:

```ts
export const SECCIONES = ['caseta', 'plataforma'] as const;

export type Seccion = (typeof SECCIONES)[number];

export const ETIQUETA_SECCION: Record<Seccion, string> = {
    caseta: 'Caseta',
    plataforma: 'Plataforma',
};
```

Añadir, junto a `ROL_QUIEN_ENTREGA` y `ROL_FBO`:

```ts
export const ROL_JEFE_AREA = 'jefe_area';

/** Los dos roles que cierran el relevo, en el orden en que los manda el servidor. */
export const ROLES_DE_CIERRE = [ROL_JEFE_AREA, ROL_FBO] as const;

export const ETIQUETA_ROL: Record<string, string> = {
    quien_entrega: 'Quien entrega',
    jefe_area: 'Jefe de área',
    fbo: 'FBO',
};
```

Sustituir `SeccionRelevo` y `FilaRelevo`:

```ts
export type SeccionRelevo = {
    id: number;
    nombre: string;
    hora: string;
    /** Los roles de cierre que faltan. Vacío quiere decir cerrado. */
    firmas_faltantes: string[];
    /** Aeronaves que pernoctaron ese día: congelada si el relevo lo está. */
    pernocta: number;
    extras: number;
};

export type FilaRelevo = {
    fecha: string;
    caseta: SeccionRelevo | null;
    plataforma: SeccionRelevo | null;
};
```

Sustituir `PendienteRelevo` y el `estado` de `FiltrosRelevo`:

```ts
export type PendienteRelevo = {
    id: number;
    nombre: string;
    fecha: string;
    hora: string;
    seccion: Seccion;
    /** Lo que a QUIEN PREGUNTA le falta firmar de ese relevo. */
    falta: string[];
};
```

```ts
    estado?: '' | 'falta_jefe_area' | 'falta_fbo' | 'completas';
```

- [ ] **Step 2: Cambiar el distintivo y la pernocta de la tabla**

En `CeldasRelevo.tsx`, sustituir el import y las dos primeras funciones:

```tsx
import { ETIQUETA_ROL, type FilaRelevo, type SeccionRelevo } from './types';

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

/** Lo que se ve de un puesto: quién, a qué hora y qué firmas le faltan. */
export function CeldaSeccion({ seccion }: { seccion: SeccionRelevo | null }) {
    if (seccion === null) {
        return <span className="text-[10px] font-bold uppercase text-slate-300">—</span>;
    }

    const cerrado = seccion.firmas_faltantes.length === 0;

    return (
        <div className="flex flex-col items-center gap-0.5">
            <span className="text-[11px] font-bold text-slate-700">{seccion.nombre}</span>
            <span className="text-[10px] text-slate-400">{seccion.hora}</span>
            <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                    cerrado ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'
                }`}
            >
                {textoDelDistintivo(seccion.firmas_faltantes)}
            </span>
            {seccion.extras > 0 && (
                <span className="text-[9px] font-bold uppercase text-slate-400">
                    {seccion.extras + 1} registros
                </span>
            )}
        </div>
    );
}

/**
 * La pernocta del día que enseña la tabla.
 *
 * Si los dos puestos traen números distintos se imprimen LOS DOS, la caseta
 * primero: pasa cuando uno quedó congelado antes que el otro, y quedarse con
 * uno borraría lo que dice el otro documento.
 */
export function pernoctaDelDia(fila: FilaRelevo): string {
    const numeros = [fila.caseta?.pernocta, fila.plataforma?.pernocta]
        .filter((numero): numero is number => numero !== undefined);

    if (numeros.length === 0) {
        return '—';
    }

    return [...new Set(numeros)].join(' / ');
}

/** El id sobre el que actuar, o null si hay que preguntar primero. */
export function idUnicoDe(fila: FilaRelevo): number | null {
    const presentes = [fila.caseta, fila.plataforma].filter(
        (seccion): seccion is SeccionRelevo => seccion !== null,
    );

    return presentes.length === 1 ? presentes[0].id : null;
}
```

- [ ] **Step 3: Cambiar la tabla y el selector**

En `TablaEntregaTurno.tsx`:
- Las dos cabeceras `<th className={TH}>Frente</th>` y `<th className={TH}>Atrás</th>` pasan a `Caseta` y `Plataforma`.
- La cabecera `<th className={TH}>Pernocta mensual</th>` pasa a `Pernocta del día`.
- Las dos celdas `<CeldaSeccion seccion={fila.frente} />` y `<CeldaSeccion seccion={fila.atras} />` pasan a `fila.caseta` y `fila.plataforma`.
- En `pedirAccion`, `fila.frente !== null || fila.atras !== null` pasa a `fila.caseta !== null || fila.plataforma !== null`.

En `SelectorSeccion.tsx` no hay literales que cambiar: recorre `SECCIONES` y lee `fila[clave]`, así que sigue el renombre solo. Comprobarlo leyéndolo; si aparece algún literal `'frente'` o `'atras'`, cambiarlo.

- [ ] **Step 4: Cambiar las opciones del filtro de estado**

En `FilaFiltros.tsx`, el `<select>` de estado:

```tsx
                    <option value="">TODOS</option>
                    <option value="falta_jefe_area">FALTA JEFE DE ÁREA</option>
                    <option value="falta_fbo">FALTA FBO</option>
                    <option value="completas">COMPLETAS</option>
```

Y las dos opciones de sección:

```tsx
                    <option value="">AMBOS PUESTOS</option>
                    <option value="caseta">CASETA</option>
                    <option value="plataforma">PLATAFORMA</option>
```

- [ ] **Step 5: Renombrar el cajón de pendientes**

```bash
git mv resources/js/pages/seguridad/entregaTurno/PendientesFirmaFbo.tsx resources/js/pages/seguridad/entregaTurno/PendientesDeFirma.tsx
```

Dentro del archivo: renombrar el componente a `PendientesDeFirma`, cambiar el docblock, y cambiar los dos textos fijos y el renglón para que digan qué falta:

```tsx
                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Relevos que te falta firmar</p>
```

```tsx
                            <p className="mt-1 text-[10px] font-semibold uppercase text-emerald-600">No tienes relevos por firmar.</p>
```

```tsx
                                    <p className="text-[10px] font-medium text-slate-400">
                                        {formatearFecha(pendiente.fecha)} {pendiente.hora} · {ETIQUETA_SECCION[pendiente.seccion]}
                                    </p>
                                    <p className="text-[9px] font-black uppercase tracking-wider text-amber-600">
                                        Falta: {pendiente.falta.map(rol => ETIQUETA_ROL[rol] ?? rol).join(' y ')}
                                    </p>
```

Añadir `ETIQUETA_ROL` al import de `./types`.

- [ ] **Step 6: Cambiar la página**

En `EntregaTurno.tsx`:
- El import pasa a `import PendientesDeFirma from './entregaTurno/PendientesDeFirma';` y el uso del componente también.
- `const puedeEditar = tieneRol('fbo', 'admin');` pasa a `const puedeEditar = tieneRol('fbo', 'jefe_area', 'admin');`
- Añadir, junto a `puedeEditar`:

```tsx
    // Qué firma de cierre puede poner ESTE usuario. El administrador las dos.
    const puedeFirmarJefe = tieneRol('jefe_area', 'admin');
    const puedeFirmarFbo = tieneRol('fbo', 'admin');
```

- La prop que recibe `FormEntregaTurno` pasa de `puedeFirmarComoFbo={puedeEditar}` a `puedeFirmarComoFbo={puedeFirmarFbo}`. **El nombre de la prop no cambia todavía**: `FormEntregaTurno` sigue siendo el de la primera versión y lo reescribe la Tarea 8, que es la que lo parte en dos props. Cambiarlo aquí dejaría el árbol sin compilar.

`puedeFirmarJefe` queda declarada y sin usar en esta tarea. No molesta: `noUnusedLocals` está apagado en `tsconfig.json`, y la Tarea 8 la usa. Es a propósito, para que las dos constantes nazcan juntas y de la misma regla.

- [ ] **Step 7: Comprobar que compila**

Run: `npx tsc --noEmit`
Expected: un único error, el de base: `resources/js/actions/App/Http/Controllers/Api/WalkAroundController.ts(905,5): error TS1117`.

- [ ] **Step 8: Commit**

```bash
git add resources/js/pages/seguridad/entregaTurno/types.ts resources/js/pages/seguridad/entregaTurno/CeldasRelevo.tsx resources/js/pages/seguridad/entregaTurno/TablaEntregaTurno.tsx resources/js/pages/seguridad/entregaTurno/SelectorSeccion.tsx resources/js/pages/seguridad/entregaTurno/FilaFiltros.tsx resources/js/pages/seguridad/entregaTurno/PendientesDeFirma.tsx resources/js/pages/seguridad/EntregaTurno.tsx
git commit -m "feat(seguridad): caseta, plataforma y las firmas que faltan en el listado"
```

---

### Task 8: El formulario y la vista previa pasan a resumen y tres firmas

**Files:**
- Modify: `resources/js/pages/seguridad/entregaTurno/types.ts`
- Modify: `resources/js/pages/seguridad/entregaTurno/FormEntregaTurno.tsx`
- Modify: `resources/js/pages/seguridad/entregaTurno/VistaPreviaEntregaTurno.tsx`
- Modify: `resources/js/pages/seguridad/EntregaTurno.tsx`

**Interfaces:**
- Consumes: todo lo de la Tarea 7, y el contrato del detalle de la Tarea 3.
- Produces: el formulario deja de pintar casillas y pernocta, enseña el resumen del día en texto y ofrece la firma que corresponda al rol; la vista previa pinta los seis renglones y las tres firmas.

- [ ] **Step 1: Terminar los tipos**

En `types.ts`, **borrar** `CASILLAS`, `Casilla`, `ETIQUETA_CASILLA`, `PERNOCTA`, `Pernocta` y `ETIQUETA_PERNOCTA`. Añadir:

```ts
/** Un renglón del resumen del día, con su texto ya armado por el servidor. */
export type RenglonResumen = {
    clave: string;
    titulo: string;
    texto: string;
    entradas?: number;
    salidas?: number;
    total?: number;
};

export type ResumenRelevo = {
    /** El relevo está cerrado y sus cifras ya no cambian. */
    congelado: boolean;
    renglones: RenglonResumen[];
};
```

Sustituir `DetalleRelevo`, `PayloadRelevo` y `PayloadRelevoNuevo`:

```ts
export type DetalleRelevo = {
    id: number;
    nombre: string;
    fecha: string;
    hora: string;
    fecha_hora: string;
    seccion: Seccion;
    resumen: ResumenRelevo;
    observaciones: string | null;
    firmas: FirmaRelevo[];
};

/**
 * Lo que el formulario manda al editar: todo opcional, porque el `PUT`
 * acepta cambios parciales.
 */
export type PayloadRelevo = {
    fecha_hora?: string;
    seccion?: Seccion;
    observaciones?: string | null;
    firma_quien_entrega?: string;
    firma_jefe_area?: string;
    firma_fbo?: string;
};

/** Lo que manda al CREAR, donde tres campos son obligatorios. */
export type PayloadRelevoNuevo = PayloadRelevo & {
    fecha_hora: string;
    seccion: Seccion;
    firma_quien_entrega: string;
};
```

- [ ] **Step 2: Cambiar el formulario**

En `FormEntregaTurno.tsx`:

El tipo `Props` pasa a:

```tsx
type Props = {
    abierto: boolean;
    relevo: DetalleRelevo | null;
    nombreUsuario: string;
    puedeFirmarJefe: boolean;
    puedeFirmarFbo: boolean;
    onCerrar: () => void;
    onGuardado: () => void;
};
```

El estado pierde casillas y pernocta:

```tsx
    const [datos, setDatos] = useState({
        fecha: relevo?.fecha ?? fechaHoy(),
        hora: relevo?.hora ?? horaAhora(),
        seccion: relevo?.seccion ?? ('caseta' as Seccion),
        observaciones: relevo?.observaciones ?? '',
    });
    const [firmaQuienEntrega, setFirmaQuienEntrega] = useState('');
    const [firmaJefe, setFirmaJefe] = useState('');
    const [firmaFbo, setFirmaFbo] = useState('');
```

Borrar la función `alternar`.

Los dos payloads pierden `...datos.casillas` y `pernocta_mensual`, y el de edición gana la firma del jefe:

```tsx
                const payload: PayloadRelevo = {
                    fecha_hora: `${datos.fecha} ${datos.hora}:00`,
                    seccion: datos.seccion,
                    observaciones: datos.observaciones.trim() || null,
                    ...(firmaQuienEntrega ? { firma_quien_entrega: firmaQuienEntrega } : {}),
                    ...(puedeFirmarJefe && firmaJefe ? { firma_jefe_area: firmaJefe } : {}),
                    ...(puedeFirmarFbo && firmaFbo ? { firma_fbo: firmaFbo } : {}),
                };
```

El bloque «Apartados» con las casillas y el bloque «Pernocta mensual» con los radios se sustituyen por el resumen en texto, que solo se enseña al editar porque al crear todavía no hay relevo del que leerlo:

```tsx
                    {relevo !== null && (
                        <div>
                            <label className={ETIQUETA}>
                                Resumen del día{relevo.resumen.congelado ? ' (cerrado)' : ''}
                            </label>
                            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                                {relevo.resumen.renglones.map(renglon => (
                                    <li key={renglon.clave} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                                        <span className="font-bold text-slate-600">{renglon.titulo}</span>
                                        <span className="text-right text-slate-700">{renglon.texto}</span>
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-1 text-[10px] text-slate-500">
                                {relevo.resumen.congelado
                                    ? 'El relevo está firmado por los tres: estas cifras ya no cambian.'
                                    : 'Se cuenta solo, de los registros del día. Se congela cuando entre la tercera firma.'}
                            </p>
                        </div>
                    )}
```

El bloque de firmas del final pasa a tres:

```tsx
                    <div>
                        <FirmaActual firma={firmaGuardada(ROL_QUIEN_ENTREGA)} />
                        <SignaturePad title="Firma de quien entrega" value={firmaQuienEntrega} onChange={setFirmaQuienEntrega} compact />
                        {editando && <p className="mt-1 text-[10px] text-slate-500">Déjala en blanco para conservar la firma actual.</p>}
                        <MensajeError mensajes={errores.firma_quien_entrega} />
                    </div>
                    {/* §5 de la spec: al crear se guarda la firma de quien entrega NADA MÁS. Las dos de cierre entran al editar, sin orden entre ellas, y cada quien ve solo la suya: ofrecer la ajena hace dibujar una firma que el servidor rechaza con 403. */}
                    {editando && puedeFirmarJefe && (
                        <div>
                            <FirmaActual firma={firmaGuardada(ROL_JEFE_AREA)} />
                            <SignaturePad title="Firma del jefe de área" value={firmaJefe} onChange={setFirmaJefe} compact />
                            <MensajeError mensajes={errores.firma_jefe_area} />
                        </div>
                    )}
                    {editando && puedeFirmarFbo && (
                        <div>
                            <FirmaActual firma={firmaGuardada(ROL_FBO)} />
                            <SignaturePad title="Firma del FBO" value={firmaFbo} onChange={setFirmaFbo} compact />
                            <MensajeError mensajes={errores.firma_fbo} />
                        </div>
                    )}
```

Ajustar el import de `./types`: quitar `CASILLAS`, `ETIQUETA_CASILLA`, `ETIQUETA_PERNOCTA`, `PERNOCTA`, `Casilla` y `Pernocta`; añadir `ROL_JEFE_AREA`.

Si el archivo pasa de 300 líneas al terminar, sacar el bloque del resumen a `resources/js/pages/seguridad/entregaTurno/ResumenDelDia.tsx` como componente propio, que recibe `resumen: ResumenRelevo`.

- [ ] **Step 3: Cambiar la vista previa**

En `VistaPreviaEntregaTurno.tsx`:

La lista de casillas de `Columna` se sustituye por los renglones del resumen, y las dos firmas por tres:

```tsx
                    <ul className="divide-y divide-slate-100">
                        {detalle.resumen.renglones.map(renglon => (
                            <li key={renglon.clave} className="flex items-center justify-between gap-3 py-1.5 text-xs text-slate-700">
                                <span className="font-bold">{renglon.titulo}</span>
                                <span className="text-right">{renglon.texto}</span>
                            </li>
                        ))}
                    </ul>
```

```tsx
                    <div className="grid grid-cols-3 gap-3 pt-2">
                        <Firma firma={firmaPorRol(detalle, ROL_QUIEN_ENTREGA)} titulo="Quien entrega" />
                        <Firma firma={firmaPorRol(detalle, ROL_JEFE_AREA)} titulo="Jefe de área" />
                        <Firma firma={firmaPorRol(detalle, ROL_FBO)} titulo="FBO" />
                    </div>
```

Borrar el párrafo de «Pernocta mensual».

Las dos llamadas de `Promise.all` pasan a los puestos nuevos:

```tsx
        Promise.all([pedir('caseta'), pedir('plataforma')])
            .then(([caseta, plataforma]) => {
                if (vigente) setDetalles({ caseta, plataforma });
            })
```

Ajustar el import: quitar `CASILLAS`, `ETIQUETA_CASILLA` y `ETIQUETA_PERNOCTA`; añadir `ROL_JEFE_AREA`. Quitar también el import de `Check` de `lucide-react` si deja de usarse.

- [ ] **Step 4: Terminar la página**

En `EntregaTurno.tsx`, sustituir la prop vieja por las dos nuevas:

```tsx
                puedeFirmarJefe={puedeFirmarJefe}
                puedeFirmarFbo={puedeFirmarFbo}
```

- [ ] **Step 5: Comprobar que compila**

Run: `npx tsc --noEmit`
Expected: un único error, el de base en `WalkAroundController.ts(905,5)`.

- [ ] **Step 6: Commit**

```bash
git add resources/js/pages/seguridad/entregaTurno/types.ts resources/js/pages/seguridad/entregaTurno/FormEntregaTurno.tsx resources/js/pages/seguridad/entregaTurno/VistaPreviaEntregaTurno.tsx resources/js/pages/seguridad/EntregaTurno.tsx
git commit -m "feat(seguridad): el relevo ensena el resumen del dia y pide tres firmas"
```

---

## Cierre

Después de la Tarea 8, quien coordina:

1. `php artisan test` completo, en serie. Expected: verde. El número a batir es **2 596 pasadas / 5 216 asertos** de antes de esta rama más lo que añadan estas tareas.
2. `npm run build`. Expected: código de salida 0. **Nunca mientras un subagente esté vivo**: Wayfinder regenera `resources/js/actions` durante la compilación y produce errores fantasma en el `tsc` del subagente.
3. Pedir permiso al usuario para correr `php artisan migrate` contra `eolo_plus`, y al correrla comprobar en MySQL lo que sqlite no ve: `seccion` en `varchar(16)`, los tres relevos existentes con `caseta` o `plataforma`, y el índice todavía llamado `entregas_turno_seg_fecha_seccion_idx`.
4. Verificación en navegador con el preview en el puerto 3000: `public/hot` apartado y **restaurado después**, y el `launch.json` del directorio padre devuelto al 8000.
5. Actualizar `docs/superpowers/notas/2026-11-04-entrega-turno-seguridad-menores-aparcados.md` si esta rama deja deuda nueva.
