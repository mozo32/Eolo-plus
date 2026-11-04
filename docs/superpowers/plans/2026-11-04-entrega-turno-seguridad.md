# Entrega de Turno de Seguridad — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un módulo nuevo en Seguridad que registra el relevo de turno
de sus dos puestos, frente y atrás, con un registro por puesto
combinados en una sola fila por día.

**Architecture:** Tabla propia `entregas_turno_seguridad`, un registro
por sección. Controlador de API bajo `auth:sanctum` cuyo listado pagina
**días** y no registros. Firmas por la tabla polimórfica `firmables` que
ya existe, con los roles `quien_entrega` y `fbo`. En el navegador, una
página de Inertia que reúsa `ModalPeriodo` y escribe su tabla con las
clases estándar del proyecto.

**Tech Stack:** Laravel 12, Inertia 2, React 19, TypeScript, Tailwind 4,
Pest 3.

**Spec:** [docs/superpowers/specs/2026-11-04-entrega-turno-seguridad-design.md](../specs/2026-11-04-entrega-turno-seguridad-design.md)

## Global Constraints

Los requisitos de cada tarea incluyen esta sección, siempre.

- **Las pruebas corren en serie:** `php artisan test`, **nunca**
  `--parallel` — en paralelo da rojos falsos.
- **Nunca** ejecutar `vendor/bin/pint`, `prettier` ni `npm run lint`,
  aunque CLAUDE.md pida pint.
- **Nunca** `git add -A` ni `git add .`. `CLAUDE.md`, `boost.json` y
  `.claude/` son locales y tienen que seguir sin rastrear. Se agregan
  los archivos por nombre.
- **Nunca** `git stash`: hay tres stashes en el repositorio que no son
  de este trabajo.
- **Las letras de estado son `A` activo y `N` retirado**, en el registro
  y en el pivote de firmas. La letra `I` no se usa: no existe en el
  servidor.
- **No hay factories** más que `UserFactory`. Las filas se crean con
  `Modelo::create([...])`.
- **La zona es `config('app.timezone')`**, que vale
  `America/Mexico_City`. Nunca se escribe la zona a mano.
- **Las fechas se muestran en 24 horas**, sin `am`/`pm`, en todo el
  módulo.
- **Ningún identificador de base de datos pasa de 64 caracteres.** MySQL
  los rechaza y sqlite no, así que una migración con nombres largos pasa
  todas las pruebas y revienta en producción. Ya pasó una vez aquí.
- **No se usa `resources/js/components/DataTable.tsx`.** Nadie lo
  importa y su aspecto no es el del proyecto. Tampoco se borra: eso es
  otra tarea.
- **PHP:** tipos de retorno explícitos siempre, llaves siempre en los
  condicionales, `env()` solo en los archivos de `config/`, y bloques
  PHPDoc en vez de comentarios dentro del código.
- **Los Form Request viven en**
  `app/Http/Requests/EntregaTurnoSeguridad/`, con los nombres
  `StoreEntregaTurnoSeguridadRequest` y
  `UpdateEntregaTurnoSeguridadRequest`, que es la convención de
  `app/Http/Requests/OperacionProgramada/`.
- **Los roles sembrados son** `admin`, `empleado`, `jefe_area` y `fbo`.
  «Administrador» es `admin`.
- **Quien implementa no corre `npm run build`.** La evidencia del
  navegador la levanta quien coordina, al cerrar cada tarea de front:
  `npm run build` con salida 0 y `npx tsc --noEmit` con **exactamente
  un** error, el de base que el proyecto ya arrastra (TS1117 en
  `resources/js/actions/App/Http/Controllers/Api/WalkAroundController.ts:905`).
- **`eolo_plus` es la base real del usuario.** No se corre
  `php artisan migrate` contra ella sin permiso. Las pruebas usan sqlite
  en memoria y no la tocan.

## Nota de orden: por qué la ventana de fecha va en la Tarea 8

`tests/Feature/VentanasDeFechaTest.php:296` exige que **cada** clave de
`VentanasDeFecha::CLAVES` aparezca en `app/` dentro de un
`new DentroDeLaVentana('clave')` **y** en `resources/js` dentro de un
`useVentanaDeFecha('clave', …)`. Una clave puesta en un solo lado deja
esa prueba en rojo.

Por eso la clave `seguridad.entrega_turno` no se agrega al principio.
Se agrega en la Tarea 8, cuando ya existen el Form Request (Tarea 2) y
el formulario (Tarea 7), y en esa tarea se tocan los cuatro sitios en un
solo commit. Así cada commit del plan deja la suite verde.

---

### Task 1: La migración y el modelo

**Files:**
- Create: `database/migrations/2026_11_04_120000_create_entregas_turno_seguridad_table.php`
- Create: `app/Models/EntregaTurnoSeguridad.php`
- Test: `tests/Feature/EntregaTurnoSeguridad/ModeloEntregaTurnoSeguridadTest.php`

**Interfaces:**
- Consumes: nada.
- Produces: el modelo `App\Models\EntregaTurnoSeguridad` con sus
  constantes `SECCION_FRENTE`, `SECCION_ATRAS`, `SECCIONES`,
  `PERNOCTA_HECHA`, `PERNOCTA_NO_HECHA`, `PERNOCTA_SIN_REVISAR`,
  `PERNOCTA_ESTADOS`, `ROL_QUIEN_ENTREGA`, `ROL_FBO`, `CASILLAS`; los
  métodos `scopeActivas(Builder): Builder`, `usuario(): BelongsTo`,
  `firmas(): MorphToMany`, `firmasAll(): MorphToMany` y
  `tieneFirmaDe(string): bool`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `tests/Feature/EntregaTurnoSeguridad/ModeloEntregaTurnoSeguridadTest.php`:

```php
<?php

use App\Models\EntregaTurnoSeguridad;
use App\Models\Firma;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;

/*
 * El registro de un relevo de Seguridad: una fila por sección, con sus
 * valores por omisión y sus firmas polimórficas.
 *
 * Las letras de estado son 'A' activo y 'N' retirado, igual que en el
 * resto del servidor.
 */

function relevoDeSeguridad(array $extra = []): EntregaTurnoSeguridad
{
    return EntregaTurnoSeguridad::create(array_merge([
        'user_id' => User::factory()->create()->id,
        'fecha_hora' => Carbon::now(config('app.timezone'))->format('Y-m-d H:i:s'),
        'seccion' => EntregaTurnoSeguridad::SECCION_FRENTE,
    ], $extra));
}

function firmaDePrueba(string $nombre): Firma
{
    return Firma::create([
        'disk' => 'public',
        'path' => "firmas/prueba/{$nombre}.png",
        'original_name' => "{$nombre}.png",
        'mime' => 'image/png',
        'size' => 10,
        'sha1' => sha1($nombre),
    ]);
}

test('un relevo nuevo nace activo y con la pernocta mensual sin revisar', function () {
    $relevo = relevoDeSeguridad()->fresh();

    expect($relevo->status)->toBe('A')
        ->and($relevo->pernocta_mensual)->toBe(EntregaTurnoSeguridad::PERNOCTA_SIN_REVISAR);
});

test('las ocho casillas nacen apagadas', function () {
    // El conteo va primero: sin él, un CASILLAS vacío dejaría pasar el
    // bucle sin comprobar nada y la prueba sería verde por omisión.
    expect(EntregaTurnoSeguridad::CASILLAS)->toHaveCount(8);

    $relevo = relevoDeSeguridad()->fresh();

    foreach (EntregaTurnoSeguridad::CASILLAS as $casilla) {
        expect($relevo->{$casilla})->toBeFalse();
    }
});

test('el scope de activas esconde lo retirado', function () {
    $activo = relevoDeSeguridad();
    $retirado = relevoDeSeguridad(['status' => 'N']);

    $ids = EntregaTurnoSeguridad::activas()->pluck('id')->all();

    expect($ids)->toContain($activo->id)
        ->and($ids)->not->toContain($retirado->id);
});

test('firmas solo devuelve las activas del pivote', function () {
    $relevo = relevoDeSeguridad();

    $vigente = firmaDePrueba('vigente');
    $retirada = firmaDePrueba('retirada');

    // Se engancha por firmasAll, que no filtra, para poder meter una
    // retirada a propósito.
    $relevo->firmasAll()->attach($retirada->id, [
        'rol' => EntregaTurnoSeguridad::ROL_QUIEN_ENTREGA,
        'orden' => 0,
        'status' => 'N',
    ]);
    $relevo->firmasAll()->attach($vigente->id, [
        'rol' => EntregaTurnoSeguridad::ROL_QUIEN_ENTREGA,
        'orden' => 0,
        'status' => 'A',
    ]);

    expect($relevo->firmas()->pluck('firmas.id')->all())->toBe([$vigente->id])
        ->and($relevo->firmasAll()->pluck('firmas.id')->all())->toHaveCount(2);
});

test('tieneFirmaDe distingue el rol que falta del que está', function () {
    $relevo = relevoDeSeguridad();

    $relevo->firmasAll()->attach(firmaDePrueba('entrega')->id, [
        'rol' => EntregaTurnoSeguridad::ROL_QUIEN_ENTREGA,
        'orden' => 0,
        'status' => 'A',
    ]);

    $relevo->load('firmas');

    expect($relevo->tieneFirmaDe(EntregaTurnoSeguridad::ROL_QUIEN_ENTREGA))->toBeTrue()
        ->and($relevo->tieneFirmaDe(EntregaTurnoSeguridad::ROL_FBO))->toBeFalse();
});

test('los nombres de índice que crea la migración caben en MySQL', function () {
    // MySQL rechaza identificadores de más de 64 caracteres y sqlite no,
    // así que sin esta prueba la migración pasaría aquí y reventaría en el
    // servidor. Ya pasó una vez en este proyecto.
    //
    // Lee el ESQUEMA y no una lista escrita a mano: una lista de literales
    // mediría su propia longitud y no detectaría un renombre en la
    // migración. El guardia de lista no vacía va primero porque sin él un
    // `getIndexes` vacío dejaría pasar el bucle sin comprobar nada.
    //
    // La llave foránea NO se mide: `SQLiteGrammar::getForeignKey()` emite
    // «foreign key(...) references ...» sin nombre de restricción, así que
    // en sqlite no hay nombre que medir. Sus 40 caracteres salen de la
    // convención de Laravel, no de un aserto.
    $nombres = array_column(Schema::getIndexes('entregas_turno_seguridad'), 'name');

    expect($nombres)->not->toBeEmpty()
        ->and($nombres)->toContain('entregas_turno_seg_fecha_seccion_idx');

    foreach ($nombres as $nombre) {
        expect(strlen($nombre))->toBeLessThanOrEqual(64);
    }
});
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Correr: `php artisan test tests/Feature/EntregaTurnoSeguridad/ModeloEntregaTurnoSeguridadTest.php`

Esperado: FALLA con `Class "App\Models\EntregaTurnoSeguridad" not found`.

- [ ] **Step 3: Escribir la migración**

Crear `database/migrations/2026_11_04_120000_create_entregas_turno_seguridad_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('entregas_turno_seguridad', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained();
            $table->dateTime('fecha_hora');
            $table->string('seccion', 10);

            $table->boolean('aviones_csae')->default(false);
            $table->boolean('combustible')->default(false);
            $table->boolean('resguardo_vehicular')->default(false);
            $table->boolean('estacionamiento')->default(false);
            $table->boolean('posiciones')->default(false);
            $table->boolean('vehiculos')->default(false);
            $table->boolean('operaciones')->default(false);
            $table->boolean('visitantes')->default(false);

            $table->char('pernocta_mensual', 1)->default('R');
            $table->text('observaciones')->nullable();
            $table->char('status', 1)->default('A');
            $table->timestamps();

            /*
             * El nombre va a mano y corto. El que Laravel generaría
             * (`entregas_turno_seguridad_fecha_hora_seccion_index`, 49)
             * cabría, pero dejarlo al generador es cómo se llegó una vez a
             * un índice de 69 caracteres que MySQL rechazó en producción
             * después de pasar toda la suite en sqlite.
             */
            $table->index(['fecha_hora', 'seccion'], 'entregas_turno_seg_fecha_seccion_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('entregas_turno_seguridad');
    }
};
```

- [ ] **Step 4: Escribir el modelo**

Crear `app/Models/EntregaTurnoSeguridad.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphToMany;

/**
 * El relevo de turno de UN puesto de Seguridad.
 *
 * Un día normal tiene dos filas, una del frente y una de atrás. No hay
 * índice único sobre día y sección a propósito: un relevo extra —un turno
 * partido, una emergencia— es un dato verdadero y el sistema no debe
 * negarse a guardarlo. Quien agrupe por día tiene que saber que una
 * sección puede traer más de una fila.
 */
class EntregaTurnoSeguridad extends Model
{
    protected $table = 'entregas_turno_seguridad';

    public const SECCION_FRENTE = 'frente';

    public const SECCION_ATRAS = 'atras';

    /** @var list<string> */
    public const SECCIONES = [self::SECCION_FRENTE, self::SECCION_ATRAS];

    public const PERNOCTA_HECHA = 'S';

    public const PERNOCTA_NO_HECHA = 'N';

    public const PERNOCTA_SIN_REVISAR = 'R';

    /** @var list<string> */
    public const PERNOCTA_ESTADOS = [
        self::PERNOCTA_HECHA,
        self::PERNOCTA_NO_HECHA,
        self::PERNOCTA_SIN_REVISAR,
    ];

    public const ROL_QUIEN_ENTREGA = 'quien_entrega';

    public const ROL_FBO = 'fbo';

    /**
     * Los ocho apartados que se contestan con una casilla.
     *
     * La pernocta mensual NO está aquí: lleva tres estados porque es una
     * tarea mensual y «hoy no la hice» es lo normal casi todos los días.
     *
     * @var list<string>
     */
    public const CASILLAS = [
        'aviones_csae',
        'combustible',
        'resguardo_vehicular',
        'estacionamiento',
        'posiciones',
        'vehiculos',
        'operaciones',
        'visitantes',
    ];

    /** @var list<string> */
    protected $fillable = [
        'user_id',
        'fecha_hora',
        'seccion',
        'aviones_csae',
        'combustible',
        'resguardo_vehicular',
        'estacionamiento',
        'posiciones',
        'vehiculos',
        'operaciones',
        'visitantes',
        'pernocta_mensual',
        'observaciones',
        'status',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'fecha_hora' => 'datetime',
            'aviones_csae' => 'boolean',
            'combustible' => 'boolean',
            'resguardo_vehicular' => 'boolean',
            'estacionamiento' => 'boolean',
            'posiciones' => 'boolean',
            'vehiculos' => 'boolean',
            'operaciones' => 'boolean',
            'visitantes' => 'boolean',
        ];
    }

    public function scopeActivas(Builder $query): Builder
    {
        return $query->where('status', 'A');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** Solo las firmas vigentes: el pivote retirado queda en `N`. */
    public function firmas(): MorphToMany
    {
        return $this->morphToMany(Firma::class, 'firmable', 'firmables')
            ->withPivot(['rol', 'tag', 'orden', 'status'])
            ->wherePivot('status', 'A')
            ->withTimestamps();
    }

    /** Todas, incluidas las retiradas. La usan el historial y las pruebas. */
    public function firmasAll(): MorphToMany
    {
        return $this->morphToMany(Firma::class, 'firmable', 'firmables')
            ->withPivot(['rol', 'tag', 'orden', 'status']);
    }

    /**
     * Si ya hay firma vigente de ese rol.
     *
     * Lee la relación YA CARGADA para no disparar una consulta por
     * renglón al armar el listado. Quien la llame tiene que haber hecho
     * `load('firmas')` o `with('firmas')`.
     */
    public function tieneFirmaDe(string $rol): bool
    {
        return $this->firmas->contains(
            fn (Firma $firma): bool => $firma->pivot->rol === $rol
        );
    }
}
```

- [ ] **Step 5: Correr las pruebas y ver que pasan**

Correr: `php artisan test tests/Feature/EntregaTurnoSeguridad/ModeloEntregaTurnoSeguridadTest.php`

Esperado: PASA, seis pruebas.

- [ ] **Step 6: Commit**

```bash
git add database/migrations/2026_11_04_120000_create_entregas_turno_seguridad_table.php app/Models/EntregaTurnoSeguridad.php tests/Feature/EntregaTurnoSeguridad/ModeloEntregaTurnoSeguridadTest.php
git commit -m "feat(seguridad): tabla y modelo del relevo de turno"
```

---

### Task 2: Crear un relevo

**Files:**
- Create: `app/Http/Requests/EntregaTurnoSeguridad/StoreEntregaTurnoSeguridadRequest.php`
- Create: `app/Http/Controllers/Api/EntregaTurnoSeguridadController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/EntregaTurnoSeguridad/CrearRelevoTest.php`

**Interfaces:**
- Consumes: `EntregaTurnoSeguridad` y sus constantes, de la Tarea 1.
- Produces: `POST /api/EntregaTurnoSeguridad`; y en el controlador los
  métodos privados `guardarFirmaBase64(string $value, string $rol, EntregaTurnoSeguridad $relevo): void`,
  `guardarFirmaArchivoBase64(string $base64, string $folder): Firma` y
  `humanizeRol(string $rol): string`, que las tareas 4 y 5 reúsan.

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `tests/Feature/EntregaTurnoSeguridad/CrearRelevoTest.php`:

```php
<?php

use App\Models\EntregaTurnoSeguridad;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/*
 * Crear un relevo. Está abierto a cualquiera con sesión: editar y
 * eliminar son los que piden rol.
 */

/** Un PNG de un pixel, en base64, con el prefijo que el servidor espera. */
function firmaBase64(): string
{
    return 'data:image/png;base64,'
        .'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
}

/** @param array<string, mixed> $extra */
function datosDeRelevo(array $extra = []): array
{
    return array_merge([
        'fecha_hora' => Carbon::now(config('app.timezone'))->format('Y-m-d H:i:s'),
        'seccion' => EntregaTurnoSeguridad::SECCION_FRENTE,
        'firma_quien_entrega' => firmaBase64(),
    ], $extra);
}

beforeEach(function () {
    Storage::fake('public');
});

test('el user_id es del autenticado, no del que manda el navegador', function () {
    $autenticado = User::factory()->create();
    $otro = User::factory()->create();

    $respuesta = $this->actingAs($autenticado)
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo(['user_id' => $otro->id]));

    $respuesta->assertSuccessful();

    expect(EntregaTurnoSeguridad::sole()->user_id)->toBe($autenticado->id);
});

test('sin sesión no se crea nada', function () {
    $this->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo())
        ->assertUnauthorized();

    expect(EntregaTurnoSeguridad::count())->toBe(0);
});

test('la pernocta mensual se queda en sin revisar cuando no se manda', function () {
    $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo())
        ->assertSuccessful();

    expect(EntregaTurnoSeguridad::sole()->pernocta_mensual)
        ->toBe(EntregaTurnoSeguridad::PERNOCTA_SIN_REVISAR);
});

test('la pernocta mensual acepta sus tres letras', function (string $letra) {
    $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo(['pernocta_mensual' => $letra]))
        ->assertSuccessful();

    expect(EntregaTurnoSeguridad::sole()->pernocta_mensual)->toBe($letra);
})->with(['S', 'N', 'R']);

test('la pernocta mensual rechaza cualquier otra letra', function () {
    $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo(['pernocta_mensual' => 'X']))
        ->assertJsonValidationErrorFor('pernocta_mensual');

    expect(EntregaTurnoSeguridad::count())->toBe(0);
});

test('la sección acepta frente y atras y rechaza lo demás', function () {
    $usuario = User::factory()->create();

    foreach (EntregaTurnoSeguridad::SECCIONES as $seccion) {
        $this->actingAs($usuario)
            ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo(['seccion' => $seccion]))
            ->assertSuccessful();
    }

    $this->actingAs($usuario)
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo(['seccion' => 'arriba']))
        ->assertJsonValidationErrorFor('seccion');

    expect(EntregaTurnoSeguridad::count())->toBe(2);
});

test('las casillas marcadas se guardan y las demás quedan apagadas', function () {
    $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo([
            'aviones_csae' => true,
            'visitantes' => true,
        ]))
        ->assertSuccessful();

    $relevo = EntregaTurnoSeguridad::sole();

    expect($relevo->aviones_csae)->toBeTrue()
        ->and($relevo->visitantes)->toBeTrue()
        ->and($relevo->combustible)->toBeFalse()
        ->and($relevo->posiciones)->toBeFalse();
});

test('se guarda con la firma de quien entrega y sin la del FBO', function () {
    $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo())
        ->assertCreated();

    $relevo = EntregaTurnoSeguridad::with('firmas')->sole();

    expect($relevo->tieneFirmaDe(EntregaTurnoSeguridad::ROL_QUIEN_ENTREGA))->toBeTrue()
        ->and($relevo->tieneFirmaDe(EntregaTurnoSeguridad::ROL_FBO))->toBeFalse();

    // El renglón del pivote no prueba que el archivo exista. Sin esto, un
    // fallo al escribir en el disco dejaría la firma «guardada» apuntando a
    // una ruta vacía, y la vista previa pintaría una imagen rota.
    $firma = $relevo->firmas->first();

    Storage::disk('public')->assertExists($firma->path);

    expect($firma->path)->toStartWith('firmas/EntregaTurnoSeguridad/')
        ->and($firma->path)->toEndWith('.png')
        ->and(Storage::disk('public')->size($firma->path))->toBeGreaterThan(0);
});

test('un SVG se rechaza aunque sea una imagen', function (string $firma) {
    // El archivo se guarda en el disco `public`. Un SVG servido por su URL
    // directa corre su propio script en el origen de la aplicación, y crear
    // un relevo está abierto a cualquiera con sesión: sería XSS almacenado.
    // Un `text/html` se rechaza por lo mismo.
    $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo(['firma_quien_entrega' => $firma]))
        ->assertJsonValidationErrorFor('firma_quien_entrega');

    expect(EntregaTurnoSeguridad::count())->toBe(0);
})->with([
    'svg' => 'data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+',
    'html' => 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
]);

test('una cabecera de imagen sin cuerpo se rechaza', function () {
    // `data:image/png;base64,` a secas pasaba la regla anterior y escribía un
    // archivo de cero bytes: una firma que existe en la base y no se ve.
    $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo([
            'firma_quien_entrega' => 'data:image/png;base64,',
        ]))
        ->assertJsonValidationErrorFor('firma_quien_entrega');

    expect(EntregaTurnoSeguridad::count())->toBe(0);
});

test('sin la firma de quien entrega no se guarda', function () {
    $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo(['firma_quien_entrega' => '']))
        ->assertJsonValidationErrorFor('firma_quien_entrega');

    expect(EntregaTurnoSeguridad::count())->toBe(0);
});

test('un texto que no es una firma se rechaza y no crea nada', function () {
    // Sin la regla de forma, `required|string` dejaba pasar cualquier texto,
    // el guardia de guardarFirmaBase64 hacía `return` en silencio y el
    // relevo se guardaba SIN firma de quien entrega, que es obligatoria.
    // El fallo era silencioso: 201 y un relevo sin firmar.
    $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo(['firma_quien_entrega' => 'abc']))
        ->assertJsonValidationErrorFor('firma_quien_entrega');

    expect(EntregaTurnoSeguridad::count())->toBe(0);
});

test('las observaciones se guardan tal como se escribieron', function () {
    $texto = 'Se quedó una camioneta sin resguardo en la posición 4.';

    $this->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', datosDeRelevo(['observaciones' => $texto]))
        ->assertSuccessful();

    expect(EntregaTurnoSeguridad::sole()->observaciones)->toBe($texto);
});
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Correr: `php artisan test tests/Feature/EntregaTurnoSeguridad/CrearRelevoTest.php`

Esperado: FALLA — la ruta no existe, así que el primer aserto de éxito
devuelve 404.

- [ ] **Step 3: Escribir el Form Request**

Crear `app/Http/Requests/EntregaTurnoSeguridad/StoreEntregaTurnoSeguridadRequest.php`:

```php
<?php

namespace App\Http\Requests\EntregaTurnoSeguridad;

use App\Models\EntregaTurnoSeguridad;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Lo que se admite al crear un relevo.
 *
 * `user_id` NO está en las reglas a propósito: el nombre de quien entrega
 * sale del usuario autenticado y no de la petición. Si estuviera aquí,
 * cualquiera podría firmar un relevo a nombre de otro.
 *
 * La regla de ventana de fecha se agrega en la Tarea 8, cuando el
 * formulario ya exista: una clave usada en un solo lado deja en rojo
 * `tests/Feature/VentanasDeFechaTest.php`.
 */
class StoreEntregaTurnoSeguridadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'fecha_hora' => ['required', 'date'],
            'seccion' => ['required', Rule::in(EntregaTurnoSeguridad::SECCIONES)],
            'aviones_csae' => ['sometimes', 'boolean'],
            'combustible' => ['sometimes', 'boolean'],
            'resguardo_vehicular' => ['sometimes', 'boolean'],
            'estacionamiento' => ['sometimes', 'boolean'],
            'posiciones' => ['sometimes', 'boolean'],
            'vehiculos' => ['sometimes', 'boolean'],
            'operaciones' => ['sometimes', 'boolean'],
            'visitantes' => ['sometimes', 'boolean'],
            'pernocta_mensual' => ['sometimes', Rule::in(EntregaTurnoSeguridad::PERNOCTA_ESTADOS)],
            'observaciones' => ['nullable', 'string'],
            /*
             * La forma se valida, no solo que sea texto. Con `required|string`
             * a secas, un `"abc"` pasaba, el guardia de guardarFirmaBase64
             * hacía `return` en silencio y el relevo se guardaba SIN firma de
             * quien entrega, que es obligatoria: 201 y un relevo sin firmar.
             *
             * Los tipos van en lista blanca y no como `image/*`, por dos
             * razones concretas:
             *
             * - `image/svg+xml` es ejecutable. El archivo se guarda en el
             *   disco `public`, así que abrir su URL directa correría el
             *   script del SVG en el origen de la aplicación: XSS almacenado
             *   por un endpoint abierto a cualquiera con sesión.
             * - El cuerpo tiene que traer algo. `data:image/png;base64,` sin
             *   nada detrás pasaba y escribía un archivo de cero bytes que
             *   luego se pinta como imagen rota.
             *
             * La única fuente real es SignaturePad, que emite
             * `toDataURL("image/png")`, así que la lista blanca no quita nada
             * que el sistema use.
             */
            'firma_quien_entrega' => [
                'required',
                'string',
                'regex:/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+\/=]{16,}$/',
            ],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'seccion.required' => 'Hay que decir si el relevo es del frente o de atrás.',
            'seccion.in' => 'La sección solo puede ser frente o atrás.',
            'pernocta_mensual.in' => 'La pernocta mensual solo puede estar hecha, no hecha o sin revisar.',
            'firma_quien_entrega.required' => 'Falta la firma de quien entrega el turno.',
            'firma_quien_entrega.regex' => 'La firma de quien entrega no llegó como una imagen válida.',
        ];
    }
}
```

- [ ] **Step 4: Escribir el controlador con su `store` y las firmas**

Crear `app/Http/Controllers/Api/EntregaTurnoSeguridadController.php`:

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\EntregaTurnoSeguridad\StoreEntregaTurnoSeguridadRequest;
use App\Models\EntregaTurnoSeguridad;
use App\Models\Firma;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class EntregaTurnoSeguridadController extends Controller
{
    public function store(StoreEntregaTurnoSeguridadRequest $request): JsonResponse
    {
        $validado = $request->validated();
        $firma = $validado['firma_quien_entrega'];
        unset($validado['firma_quien_entrega']);

        $relevo = DB::transaction(function () use ($validado, $firma, $request): EntregaTurnoSeguridad {
            $relevo = EntregaTurnoSeguridad::create([
                ...$validado,
                'user_id' => $request->user()->id,
            ]);

            $this->guardarFirmaBase64($firma, EntregaTurnoSeguridad::ROL_QUIEN_ENTREGA, $relevo);

            return $relevo;
        });

        return response()->json([
            'message' => 'Relevo registrado correctamente',
            'data' => $relevo->load(['usuario:id,name', 'firmas']),
        ], 201);
    }

    /**
     * Guarda una firma nueva y retira la anterior de ese mismo rol.
     *
     * Retirar es poner el pivote en `N`, que es lo que hacen los otros
     * siete módulos con firmas. La relación `firmas()` filtra por `A`, así
     * que la anterior deja de verse sin borrarse: queda el historial.
     */
    private function guardarFirmaBase64(string $value, string $rol, EntregaTurnoSeguridad $relevo): void
    {
        if (trim($value) === '') {
            return;
        }

        if (! str_contains($value, 'base64,')) {
            return;
        }

        $relevo->firmas()
            ->newPivotStatement()
            ->where('firmable_type', EntregaTurnoSeguridad::class)
            ->where('firmable_id', $relevo->id)
            ->where('rol', $rol)
            ->where('status', 'A')
            ->update(['status' => 'N']);

        $firma = $this->guardarFirmaArchivoBase64(
            $value,
            'firmas/EntregaTurnoSeguridad/'.now()->format('Y/m')
        );

        $relevo->firmas()->attach($firma->id, [
            'rol' => $rol,
            'tag' => $this->humanizeRol($rol),
            'orden' => 0,
            'status' => 'A',
        ]);
    }

    private function guardarFirmaArchivoBase64(string $base64, string $folder): Firma
    {
        [$meta, $content] = explode(',', $base64);
        preg_match('/data:(.*?);base64/', $meta, $matches);

        $mime = $matches[1] ?? 'image/png';

        /*
         * La extensión sale de una lista blanca y NO de partir el mime. Con
         * `explode('/', $mime)[1]`, un `image/svg+xml` dejaba un archivo
         * `.svg+xml` en el disco público, y un SVG servido por su URL corre
         * su propio script en el origen de la aplicación.
         *
         * Aquí se separa de `MovimientoCSAEController`, que sí parte el mime.
         * La diferencia es deliberada: ese módulo arrastra el defecto y este
         * no lo copia.
         */
        $extension = match ($mime) {
            'image/jpeg', 'image/jpg' => 'jpg',
            'image/webp' => 'webp',
            default => 'png',
        };

        $fileName = Str::uuid().'.'.$extension;
        $path = $folder.'/'.$fileName;

        Storage::disk('public')->put($path, base64_decode($content));

        return Firma::create([
            'disk' => 'public',
            'path' => $path,
            'original_name' => $fileName,
            'mime' => $mime,
            'size' => Storage::disk('public')->size($path),
            'sha1' => sha1_file(Storage::disk('public')->path($path)),
        ]);
    }

    private function humanizeRol(string $rol): string
    {
        return match ($rol) {
            EntregaTurnoSeguridad::ROL_QUIEN_ENTREGA => 'Firma de quien entrega',
            EntregaTurnoSeguridad::ROL_FBO => 'Firma del FBO',
            default => ucfirst(str_replace('_', ' ', $rol)),
        };
    }
}
```

- [ ] **Step 5: Registrar la ruta**

En `routes/api.php`, agregar el `use` del controlador junto a los demás y
el grupo, siguiendo el de `ChecklistEquipoSeguridad`:

```php
Route::middleware(['api', 'auth:sanctum'])->prefix('EntregaTurnoSeguridad')->group(function () {
    Route::post('/', [EntregaTurnoSeguridadController::class, 'store']);
});
```

- [ ] **Step 6: Correr las pruebas y ver que pasan**

Correr: `php artisan test tests/Feature/EntregaTurnoSeguridad/`

Esperado: PASA, el archivo nuevo y el de la Tarea 1.

- [ ] **Step 7: Commit**

```bash
git add app/Http/Requests/EntregaTurnoSeguridad/StoreEntregaTurnoSeguridadRequest.php app/Http/Controllers/Api/EntregaTurnoSeguridadController.php routes/api.php tests/Feature/EntregaTurnoSeguridad/CrearRelevoTest.php
git commit -m "feat(seguridad): crear un relevo de turno con la firma de quien entrega"
```

---

### Task 3: El listado agrupado por día, con sus filtros

**Files:**
- Modify: `app/Http/Controllers/Api/EntregaTurnoSeguridadController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/EntregaTurnoSeguridad/ListadoPorDiaTest.php`

**Interfaces:**
- Consumes: el modelo y los ayudantes de firma de las tareas 1 y 2.
- Produces: `GET /api/EntregaTurnoSeguridad`, que devuelve
  `{ data: Fila[], meta: { current_page, last_page, total, per_page } }`
  con
  `Fila = { fecha: string, frente: Seccion|null, atras: Seccion|null }`
  y
  `Seccion = { id: number, nombre: string, hora: string, firmado_fbo: boolean, pernocta_mensual: 'S'|'N'|'R', extras: number }`.
  Los parámetros son `page`, `per_page`, `search`, `seccion`,
  `fecha_inicio`, `fecha_fin` y `estado` (`''`, `falta_fbo`,
  `completas`).

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `tests/Feature/EntregaTurnoSeguridad/ListadoPorDiaTest.php`:

```php
<?php

use App\Models\EntregaTurnoSeguridad;
use App\Models\Firma;
use App\Models\User;
use Illuminate\Support\Carbon;

/*
 * El listado combina las dos secciones de un día en UN renglón, y pagina
 * días y no registros: si paginara registros, una página podría partir un
 * día y dejar el frente en una hoja y el de atrás en la siguiente.
 */

function relevoDelDia(string $dia, string $seccion, string $hora = '07:30', array $extra = []): EntregaTurnoSeguridad
{
    return EntregaTurnoSeguridad::create(array_merge([
        'user_id' => User::factory()->create()->id,
        'fecha_hora' => "{$dia} {$hora}:00",
        'seccion' => $seccion,
    ], $extra));
}

function firmarComoFbo(EntregaTurnoSeguridad $relevo): void
{
    $firma = Firma::create([
        'disk' => 'public',
        'path' => 'firmas/prueba/fbo-'.$relevo->id.'.png',
        'original_name' => 'fbo.png',
        'mime' => 'image/png',
        'size' => 10,
        'sha1' => sha1('fbo'.$relevo->id),
    ]);

    $relevo->firmas()->attach($firma->id, [
        'rol' => EntregaTurnoSeguridad::ROL_FBO,
        'orden' => 0,
        'status' => 'A',
    ]);
}

function listado(array $parametros = []): \Illuminate\Testing\TestResponse
{
    return test()->actingAs(User::factory()->create())
        ->getJson('/api/EntregaTurnoSeguridad?'.http_build_query($parametros));
}

test('las dos secciones del mismo día salen en un solo renglón', function () {
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE, '07:30');
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_ATRAS, '19:00');

    $datos = listado()->assertSuccessful()->json('data');

    expect($datos)->toHaveCount(1)
        ->and($datos[0]['fecha'])->toBe('2026-11-04')
        ->and($datos[0]['frente']['hora'])->toBe('07:30')
        ->and($datos[0]['atras']['hora'])->toBe('19:00');
});

test('la hora viene en 24 horas', function () {
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_ATRAS, '19:45');

    $fila = listado()->json('data.0');

    expect($fila['atras']['hora'])->toBe('19:45');
});

test('un día con una sola sección deja la otra en null', function () {
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE);

    $fila = listado()->json('data.0');

    expect($fila['frente'])->not->toBeNull()
        ->and($fila['atras'])->toBeNull();
});

test('tres registros de la misma sección dan un renglón con dos extras', function () {
    // El de las 23:00 se crea PRIMERO a propósito. Creándolos en orden de
    // hora, el id mayor coincide con la hora mayor y la prueba no
    // distinguiría `sortByDesc('fecha_hora')` de «el último que se creó».
    $ultimo = relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE, '23:00');
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE, '07:00');
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE, '15:00');

    $datos = listado()->json('data');

    expect($datos)->toHaveCount(1)
        ->and($datos[0]['frente']['extras'])->toBe(2)
        ->and($datos[0]['frente']['id'])->toBe($ultimo->id)
        ->and($datos[0]['frente']['hora'])->toBe('23:00');
});

test('la paginación cuenta días y no parte ninguno', function () {
    // Once días con sus dos secciones: 22 registros. Si paginara registros,
    // diez por página cortarían el quinto día a la mitad.
    foreach (range(1, 11) as $dia) {
        $fecha = Carbon::parse('2026-11-01')->addDays($dia - 1)->toDateString();
        relevoDelDia($fecha, EntregaTurnoSeguridad::SECCION_FRENTE, '07:00');
        relevoDelDia($fecha, EntregaTurnoSeguridad::SECCION_ATRAS, '19:00');
    }

    $respuesta = listado(['per_page' => 10])->assertSuccessful();

    expect($respuesta->json('data'))->toHaveCount(10)
        ->and($respuesta->json('meta.total'))->toBe(11)
        ->and($respuesta->json('meta.last_page'))->toBe(2);

    foreach ($respuesta->json('data') as $fila) {
        expect($fila['frente'])->not->toBeNull()
            ->and($fila['atras'])->not->toBeNull();
    }
});

test('los días salen del más reciente al más viejo', function () {
    relevoDelDia('2026-11-01', EntregaTurnoSeguridad::SECCION_FRENTE);
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE);
    relevoDelDia('2026-11-02', EntregaTurnoSeguridad::SECCION_FRENTE);

    expect(array_column(listado()->json('data'), 'fecha'))
        ->toBe(['2026-11-04', '2026-11-02', '2026-11-01']);
});

test('un relevo retirado no aparece en el listado', function () {
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE, '07:30', ['status' => 'N']);

    expect(listado()->json('data'))->toBe([]);
});

test('un retirado no cuenta como el más reciente ni infla los extras', function () {
    // Esta prueba existe porque la de arriba NO vigila el `activas()` del
    // listado: con un solo registro retirado, el día no entra en la página
    // y la prueba pasaría igual aunque se cayera el filtro.
    //
    // Aquí el día lleva un activo y un retirado MÁS RECIENTE. Sin el filtro,
    // el retirado saldría como «el más reciente», `extras` valdría 1 y el día
    // se marcaría como incompleto por una firma que nadie debe esperar.
    $activo = relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE, '07:30');
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE, '23:00', ['status' => 'N']);

    $fila = listado()->json('data.0');

    expect($fila['frente']['id'])->toBe($activo->id)
        ->and($fila['frente']['hora'])->toBe('07:30')
        ->and($fila['frente']['extras'])->toBe(0);
});

test('firmado_fbo dice si el FBO ya firmó esa sección', function () {
    $frente = relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE);
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_ATRAS, '19:00');

    firmarComoFbo($frente);

    $fila = listado()->json('data.0');

    expect($fila['frente']['firmado_fbo'])->toBeTrue()
        ->and($fila['atras']['firmado_fbo'])->toBeFalse();
});

test('la pernocta mensual de cada sección viaja por separado', function () {
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE, '07:30', [
        'pernocta_mensual' => EntregaTurnoSeguridad::PERNOCTA_HECHA,
    ]);
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_ATRAS, '19:00', [
        'pernocta_mensual' => EntregaTurnoSeguridad::PERNOCTA_SIN_REVISAR,
    ]);

    $fila = listado()->json('data.0');

    expect($fila['frente']['pernocta_mensual'])->toBe('S')
        ->and($fila['atras']['pernocta_mensual'])->toBe('R');
});

test('el buscador filtra por el nombre de quien entregó', function () {
    $ana = User::factory()->create(['name' => 'Ana Robles']);
    EntregaTurnoSeguridad::create([
        'user_id' => $ana->id,
        'fecha_hora' => '2026-11-04 07:30:00',
        'seccion' => EntregaTurnoSeguridad::SECCION_FRENTE,
    ]);

    // El nombre del otro va explícito: con el que invente la factory hay
    // una posibilidad remota de que contenga «Robles» y la prueba falle
    // sin que nada esté roto.
    $otro = User::factory()->create(['name' => 'Beto Sánchez']);
    EntregaTurnoSeguridad::create([
        'user_id' => $otro->id,
        'fecha_hora' => '2026-11-03 07:30:00',
        'seccion' => EntregaTurnoSeguridad::SECCION_FRENTE,
    ]);

    expect(array_column(listado(['search' => 'Robles'])->json('data'), 'fecha'))
        ->toBe(['2026-11-04']);
});

test('el filtro de sección deja solo los días con esa sección', function () {
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE);
    relevoDelDia('2026-11-03', EntregaTurnoSeguridad::SECCION_ATRAS, '19:00');

    expect(array_column(listado(['seccion' => 'atras'])->json('data'), 'fecha'))
        ->toBe(['2026-11-03']);
});

test('el rango de fechas acota los días', function () {
    relevoDelDia('2026-11-01', EntregaTurnoSeguridad::SECCION_FRENTE);
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE);
    relevoDelDia('2026-11-08', EntregaTurnoSeguridad::SECCION_FRENTE);

    $fechas = array_column(
        listado(['fecha_inicio' => '2026-11-02', 'fecha_fin' => '2026-11-05'])->json('data'),
        'fecha'
    );

    expect($fechas)->toBe(['2026-11-04']);
});

test('falta_fbo excluye los días ya firmados y el renglón sigue completo', function () {
    // Esta prueba NO distingue un filtro por día de uno por registro: para
    // «falta_fbo» los dos dan el mismo conjunto de días, así que no hay
    // nada que distinguir. La que vigila esa diferencia es la de
    // «completas». Lo que se comprueba aquí es otra cosa, y sí importa: que
    // el filtro decida qué DÍAS salen y no qué secciones se ven, y que un
    // día enteramente firmado no aparezca.
    $frente = relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE);
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_ATRAS, '19:00');
    firmarComoFbo($frente);

    firmarComoFbo(relevoDelDia('2026-11-03', EntregaTurnoSeguridad::SECCION_FRENTE));

    $datos = listado(['estado' => 'falta_fbo'])->json('data');

    expect(array_column($datos, 'fecha'))->toBe(['2026-11-04'])
        ->and($datos[0]['frente'])->not->toBeNull()
        ->and($datos[0]['atras'])->not->toBeNull();
});

test('el rango de fechas incluye sus dos bordes', function () {
    // Las horas de los bordes no son 07:30 a propósito. Comparar un datetime
    // contra `'2026-11-05'` como cadena excluye el día entero, y con todos
    // los registros a media mañana y ninguno en el borde ese fallo no se
    // vería: la prueba pasaría con `where` en vez de `whereDate`.
    relevoDelDia('2026-11-02', EntregaTurnoSeguridad::SECCION_FRENTE, '00:00');
    relevoDelDia('2026-11-05', EntregaTurnoSeguridad::SECCION_ATRAS, '23:59');
    relevoDelDia('2026-11-06', EntregaTurnoSeguridad::SECCION_FRENTE, '07:30');

    $fechas = array_column(
        listado(['fecha_inicio' => '2026-11-02', 'fecha_fin' => '2026-11-05'])->json('data'),
        'fecha'
    );

    expect($fechas)->toBe(['2026-11-05', '2026-11-02']);
});

test('per_page tiene piso: el cero y los negativos dan uno', function (int $pedido) {
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE);
    relevoDelDia('2026-11-03', EntregaTurnoSeguridad::SECCION_FRENTE);

    expect(listado(['per_page' => $pedido])->json('meta.per_page'))->toBe(1);
})->with([0, -5]);

test('per_page tiene techo: no se puede pedir la tabla entera de un jalón', function () {
    // Sin techo, un per_page=100000 pide cien mil días y arrastra toda la
    // tabla con sus firmas.
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE);

    expect(listado(['per_page' => 100000])->json('meta.per_page'))->toBe(100);
});

test('completas excluye el día en que una sección no está firmada', function () {
    // El día 4 tiene el frente firmado y atrás sin firmar: NO está
    // completo. Filtrar registro por registro lo daría por completo a
    // través del frente, que es el error que esta prueba vigila.
    $frente4 = relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_FRENTE);
    relevoDelDia('2026-11-04', EntregaTurnoSeguridad::SECCION_ATRAS, '19:00');
    firmarComoFbo($frente4);

    $frente3 = relevoDelDia('2026-11-03', EntregaTurnoSeguridad::SECCION_FRENTE);
    firmarComoFbo($frente3);

    expect(array_column(listado(['estado' => 'completas'])->json('data'), 'fecha'))
        ->toBe(['2026-11-03']);
});

test('sin registros el listado viene vacío y no revienta', function () {
    $respuesta = listado()->assertSuccessful();

    expect($respuesta->json('data'))->toBe([])
        ->and($respuesta->json('meta.total'))->toBe(0);
});
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Correr: `php artisan test tests/Feature/EntregaTurnoSeguridad/ListadoPorDiaTest.php`

Esperado: FALLA con 405 o 404 — la ruta `GET` no existe todavía.

- [ ] **Step 3: Escribir el `index` y sus ayudantes**

Agregar al controlador. Los `use` que faltan:
`Illuminate\Database\Eloquent\Builder`,
`Illuminate\Database\Eloquent\Relations\MorphToMany`,
`Illuminate\Http\Request`, `Illuminate\Support\Collection`.

```php
    /**
     * La expresión del día.
     *
     * Vive en una constante porque la usan el agrupamiento y el filtro por
     * estado, y tienen que ser la MISMA: si una dijera `DATE(fecha_hora)` y
     * la otra `fecha_hora`, el filtro excluiría horas en vez de días y
     * nadie lo notaría hasta que un día saliera a medias.
     */
    private const DIA = 'DATE(fecha_hora)';

    public function index(Request $request): JsonResponse
    {
        /*
         * El techo es tan necesario como el piso: sin él, un `per_page=100000`
         * pide cien mil días y arrastra toda la tabla con sus firmas.
         */
        $porPagina = min(100, max(1, (int) $request->integer('per_page', 10)));

        $dias = $this->consultaFiltrada($request)
            ->selectRaw(self::DIA.' as dia')
            ->groupBy('dia')
            ->orderByDesc('dia')
            ->paginate($porPagina);

        $diasDeLaPagina = array_map(
            static fn (mixed $fila): string => (string) (is_array($fila) ? $fila['dia'] : $fila->dia),
            $dias->items()
        );

        return response()->json([
            'data' => $this->filasDeLosDias($diasDeLaPagina),
            'meta' => [
                'current_page' => $dias->currentPage(),
                'last_page' => $dias->lastPage(),
                'per_page' => $dias->perPage(),
                'total' => $dias->total(),
            ],
        ]);
    }

    /**
     * Un renglón por día, con sus dos secciones.
     *
     * Pide exactamente los días de la página con un `IN` sobre la misma
     * expresión del día que usa el agrupamiento.
     *
     * NO se usa un rango entre el día más viejo y el más nuevo. Parecía
     * más simple, pero con un filtro disperso —un buscador que acierte un
     * día por mes— una página de diez días abarca casi un año y trae
     * cientos de registros para pintar diez renglones.
     *
     * @param  list<string>  $diasDeLaPagina
     * @return list<array{fecha: string, frente: ?array, atras: ?array}>
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

        return array_map(
            fn (string $dia): array => [
                'fecha' => $dia,
                'frente' => $this->seccionDelDia($registros->get($dia, collect()), EntregaTurnoSeguridad::SECCION_FRENTE),
                'atras' => $this->seccionDelDia($registros->get($dia, collect()), EntregaTurnoSeguridad::SECCION_ATRAS),
            ],
            $diasDeLaPagina
        );
    }

    /**
     * Lo que se enseña de una sección, o null si ese puesto no entregó.
     *
     * Con más de un registro de la misma sección ese día devuelve el MÁS
     * RECIENTE y cuenta los demás en `extras`. No se descarta ninguno: la
     * tabla no tiene candado de uno por día y sección a propósito.
     *
     * @param  Collection<int, EntregaTurnoSeguridad>  $delDia
     * @return array{id: int, nombre: string, hora: string, firmado_fbo: bool, pernocta_mensual: string, extras: int}|null
     */
    private function seccionDelDia(Collection $delDia, string $seccion): ?array
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
            'firmado_fbo' => $reciente->tieneFirmaDe(EntregaTurnoSeguridad::ROL_FBO),
            'pernocta_mensual' => $reciente->pernocta_mensual,
            'extras' => $deLaSeccion->count() - 1,
        ];
    }

    private function consultaFiltrada(Request $request): Builder
    {
        $query = EntregaTurnoSeguridad::activas();

        if ($request->filled('search')) {
            $buscado = $request->string('search')->toString();
            $query->whereHas(
                'usuario',
                static fn (Builder $usuario): Builder => $usuario->where('name', 'like', "%{$buscado}%")
            );
        }

        if ($request->filled('seccion')) {
            $query->where('seccion', $request->string('seccion')->toString());
        }

        if ($request->filled('fecha_inicio')) {
            $query->whereDate('fecha_hora', '>=', $request->string('fecha_inicio')->toString());
        }

        if ($request->filled('fecha_fin')) {
            $query->whereDate('fecha_hora', '<=', $request->string('fecha_fin')->toString());
        }

        $estado = $request->string('estado')->toString();

        if ($estado === 'falta_fbo') {
            $query->whereIn(DB::raw(self::DIA), $this->diasIncompletos());
        }

        if ($estado === 'completas') {
            $query->whereNotIn(DB::raw(self::DIA), $this->diasIncompletos());
        }

        return $query;
    }

    /**
     * Los días que tienen al menos un registro sin la firma del FBO.
     *
     * Se calcula por DÍA y no por registro porque el estado es del día: un
     * día en que el frente firmó y el de atrás no está incompleto, y un
     * filtro por registro lo daría por completo a través del frente.
     *
     * La base agrupa y devuelve días, no fechas completas: traer un renglón
     * por registro sin firmar y deduplicar en PHP crecía sin tope con el
     * historial, y en un mes en que el FBO se atrasara serían sesenta
     * valores para distinguir treinta días.
     *
     * @return list<string>
     */
    private function diasIncompletos(): array
    {
        return EntregaTurnoSeguridad::activas()
            ->whereDoesntHave(
                'firmas',
                static fn (Builder $firma): Builder => $firma->where('firmables.rol', EntregaTurnoSeguridad::ROL_FBO)
            )
            ->selectRaw(self::DIA.' as dia')
            ->distinct()
            ->pluck('dia')
            ->all();
    }
```

**Ojo con `whereDoesntHave('firmas', …)`:** la relación ya trae
`wherePivot('status', 'A')`, así que la subconsulta solo mira firmas
vigentes, que es lo que se quiere. El filtro de rol va sobre la columna
del pivote con su tabla por delante (`firmables.rol`): dentro de un
`whereDoesntHave` el callback recibe un `Builder` del modelo relacionado,
no la relación, y por eso `wherePivot` no está disponible ahí.

Agregar al `use` del controlador: `Illuminate\Support\Carbon`.

- [ ] **Step 4: Registrar la ruta**

En el grupo de `routes/api.php`, antes de la de `store`:

```php
    Route::get('/', [EntregaTurnoSeguridadController::class, 'index']);
```

- [ ] **Step 5: Correr las pruebas y ver que pasan**

Correr: `php artisan test tests/Feature/EntregaTurnoSeguridad/`

Esperado: PASA todo.

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/Api/EntregaTurnoSeguridadController.php routes/api.php tests/Feature/EntregaTurnoSeguridad/ListadoPorDiaTest.php
git commit -m "feat(seguridad): listado del relevo agrupado por dia, con sus filtros"
```

---

### Task 4: Detalle, edición y borrado lógico, con permisos

**Files:**
- Create: `app/Http/Requests/EntregaTurnoSeguridad/UpdateEntregaTurnoSeguridadRequest.php`
- Modify: `app/Http/Controllers/Api/EntregaTurnoSeguridadController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/EntregaTurnoSeguridad/EditarYEliminarRelevoTest.php`

**Interfaces:**
- Consumes: todo lo de las tareas 1 a 3, incluido
  `guardarFirmaBase64()`.
- Produces: `GET /api/EntregaTurnoSeguridad/{id}`,
  `PUT /api/EntregaTurnoSeguridad/{id}` y
  `GET /api/EntregaTurnoSeguridad/eliminar/{id}`. El detalle devuelve
  `{ data: { …columnas…, nombre, firmas: [{ id, rol, tag, orden, url }] } }`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `tests/Feature/EntregaTurnoSeguridad/EditarYEliminarRelevoTest.php`:

```php
<?php

use App\Models\EntregaTurnoSeguridad;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

/*
 * Editar y eliminar son de `fbo` y `admin`. El front esconde los botones,
 * pero eso no es un permiso: el servidor es el que decide.
 *
 * La firma del FBO llega por este mismo PUT, en `firma_fbo`.
 */

function usuarioCon(string $slug): User
{
    $usuario = User::factory()->create();
    $rol = Role::firstOrCreate(['slug' => $slug], ['nombre' => ucfirst($slug)]);
    $usuario->roles()->attach($rol->id);

    return $usuario;
}

function relevoGuardado(array $extra = []): EntregaTurnoSeguridad
{
    return EntregaTurnoSeguridad::create(array_merge([
        'user_id' => User::factory()->create()->id,
        'fecha_hora' => '2026-11-04 07:30:00',
        'seccion' => EntregaTurnoSeguridad::SECCION_FRENTE,
    ], $extra));
}

function firmaBase64Valida(): string
{
    return 'data:image/png;base64,'
        .'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
}

beforeEach(function () {
    Storage::fake('public');
});

test('un empleado no puede editar', function () {
    $relevo = relevoGuardado();

    $this->actingAs(usuarioCon('empleado'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", ['combustible' => true])
        ->assertForbidden();

    expect($relevo->fresh()->combustible)->toBeFalse();
});

test('un empleado no puede eliminar', function () {
    $relevo = relevoGuardado();

    $this->actingAs(usuarioCon('empleado'))
        ->getJson("/api/EntregaTurnoSeguridad/eliminar/{$relevo->id}")
        ->assertForbidden();

    expect($relevo->fresh()->status)->toBe('A');
});

test('el fbo y el admin sí pueden editar', function (string $slug) {
    $relevo = relevoGuardado();

    $this->actingAs(usuarioCon($slug))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", ['combustible' => true])
        ->assertSuccessful();

    expect($relevo->fresh()->combustible)->toBeTrue();
})->with(['fbo', 'admin']);

test('el fbo y el admin sí pueden eliminar', function (string $slug) {
    $relevo = relevoGuardado();

    $this->actingAs(usuarioCon($slug))
        ->getJson("/api/EntregaTurnoSeguridad/eliminar/{$relevo->id}")
        ->assertSuccessful();

    expect($relevo->fresh()->status)->toBe('N');
})->with(['fbo', 'admin']);

test('eliminar solo cambia el status: el renglón sigue en la base', function () {
    $relevo = relevoGuardado();

    $this->actingAs(usuarioCon('fbo'))
        ->getJson("/api/EntregaTurnoSeguridad/eliminar/{$relevo->id}")
        ->assertSuccessful();

    // `find` sin el scope ve todo: el modelo no tiene scopes globales, el
    // filtro de activas es local. Si el registro se hubiera borrado de
    // verdad, este primer aserto fallaría.
    expect(EntregaTurnoSeguridad::find($relevo->id))->not->toBeNull()
        ->and(EntregaTurnoSeguridad::activas()->find($relevo->id))->toBeNull();
});

test('eliminar algo que no existe devuelve el 404 del controlador', function () {
    // El mensaje se asserta a propósito. Con solo `assertNotFound()`, la
    // prueba pasaría igual si alguien borrara la ruta: Laravel devuelve 404
    // cuando no hay ruta, y entonces la prueba daría por vigilado un guardia
    // que ya no se ejecuta. El mensaje solo lo escribe el controlador.
    $this->actingAs(usuarioCon('fbo'))
        ->getJson('/api/EntregaTurnoSeguridad/eliminar/999')
        ->assertNotFound()
        ->assertJson(['message' => 'El relevo no existe.']);
});

test('el detalle de algo que no existe devuelve el 404 del controlador', function () {
    $this->actingAs(usuarioCon('empleado'))
        ->getJson('/api/EntregaTurnoSeguridad/999')
        ->assertNotFound()
        ->assertJson(['message' => 'El relevo no existe.']);
});

test('editar algo que no existe devuelve el 404 del controlador', function () {
    $this->actingAs(usuarioCon('fbo'))
        ->putJson('/api/EntregaTurnoSeguridad/999', ['combustible' => true])
        ->assertNotFound()
        ->assertJson(['message' => 'El relevo no existe.']);
});

test('la firma del FBO llega por el PUT y deja de faltar', function () {
    $relevo = relevoGuardado();

    $this->actingAs(usuarioCon('fbo'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'firma_fbo' => firmaBase64Valida(),
        ])
        ->assertSuccessful();

    $relevo->load('firmas');

    expect($relevo->tieneFirmaDe(EntregaTurnoSeguridad::ROL_FBO))->toBeTrue();
});

test('volver a firmar deja la anterior retirada y una sola vigente', function () {
    $relevo = relevoGuardado();
    $fbo = usuarioCon('fbo');

    foreach ([1, 2] as $vez) {
        $this->actingAs($fbo)
            ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
                'firma_fbo' => firmaBase64Valida(),
            ])
            ->assertSuccessful();
    }

    expect($relevo->firmas()->wherePivot('rol', EntregaTurnoSeguridad::ROL_FBO)->count())->toBe(1)
        ->and($relevo->firmasAll()->wherePivot('rol', EntregaTurnoSeguridad::ROL_FBO)->count())->toBe(2)
        ->and($relevo->firmasAll()->wherePivot('status', 'N')->count())->toBe(1);
});

test('un texto que no es una firma se rechaza también al editar', function () {
    // El mismo hueco que al crear: sin la regla de forma, el guardia hacía
    // `return` en silencio y la respuesta decía que todo salió bien mientras
    // el relevo se quedaba sin la firma del FBO.
    $relevo = relevoGuardado();

    $this->actingAs(usuarioCon('fbo'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", ['firma_fbo' => 'abc'])
        ->assertJsonValidationErrorFor('firma_fbo');

    $relevo->load('firmas');

    expect($relevo->tieneFirmaDe(EntregaTurnoSeguridad::ROL_FBO))->toBeFalse();
});

test('una firma vacía al editar significa «no firmé», no un error', function () {
    // Lo que hace que esto funcione NO es código de este módulo: Laravel
    // registra `ConvertEmptyStringsToNull` en su pila global, así que el `''`
    // llega al Form Request ya como `null` y `nullable` se salta la regex.
    //
    // La prueba se queda porque el comportamiento importa: un formulario que
    // arranque con `useState('')` no debe recibir 422 por no haber firmado.
    // Pero vigila el comportamiento de punta a punta, no un guardia propio;
    // si alguien desactivara ese middleware, esta prueba lo diría.
    $relevo = relevoGuardado();

    $this->actingAs(usuarioCon('fbo'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", [
            'firma_fbo' => '',
            'combustible' => true,
        ])
        ->assertSuccessful();

    expect($relevo->fresh()->combustible)->toBeTrue();
});

test('el detalle trae el nombre, la hora en 24 horas y las firmas', function () {
    $usuario = User::factory()->create(['name' => 'Ana Robles']);
    $relevo = relevoGuardado(['user_id' => $usuario->id, 'fecha_hora' => '2026-11-04 19:45:00']);

    $this->actingAs(usuarioCon('fbo'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", ['firma_fbo' => firmaBase64Valida()])
        ->assertSuccessful();

    $datos = $this->actingAs(usuarioCon('empleado'))
        ->getJson("/api/EntregaTurnoSeguridad/{$relevo->id}")
        ->assertSuccessful()
        ->json('data');

    expect($datos['nombre'])->toBe('Ana Robles')
        ->and($datos['hora'])->toBe('19:45')
        ->and($datos['fecha'])->toBe('2026-11-04')
        ->and(array_column($datos['firmas'], 'rol'))->toContain(EntregaTurnoSeguridad::ROL_FBO);
});

test('el detalle lo puede ver cualquiera con sesión', function () {
    $relevo = relevoGuardado();

    $this->actingAs(usuarioCon('empleado'))
        ->getJson("/api/EntregaTurnoSeguridad/{$relevo->id}")
        ->assertSuccessful();
});

test('un relevo eliminado deja de poder verse y de poder editarse', function () {
    // Sin estas dos, quitar el `activas()` de `show` o de `update` no rompería
    // ninguna prueba: la de «solo cambia el status» comprueba el scope del
    // modelo, no que los endpoints lo usen. Un relevo borrado que se pueda
    // seguir editando es un borrado que no borra.
    $relevo = relevoGuardado(['status' => 'N']);

    $this->actingAs(usuarioCon('empleado'))
        ->getJson("/api/EntregaTurnoSeguridad/{$relevo->id}")
        ->assertNotFound()
        ->assertJson(['message' => 'El relevo no existe.']);

    $this->actingAs(usuarioCon('fbo'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", ['combustible' => true])
        ->assertNotFound()
        ->assertJson(['message' => 'El relevo no existe.']);

    expect($relevo->fresh()->combustible)->toBeFalse();
});

test('la edición no deja cambiar de dueño', function () {
    $otro = User::factory()->create();
    $relevo = relevoGuardado();
    $dueno = $relevo->user_id;

    $this->actingAs(usuarioCon('fbo'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", ['user_id' => $otro->id])
        ->assertSuccessful();

    expect($relevo->fresh()->user_id)->toBe($dueno);
});

test('la edición respeta las tres letras de la pernocta mensual', function () {
    $relevo = relevoGuardado();

    $this->actingAs(usuarioCon('fbo'))
        ->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", ['pernocta_mensual' => 'X'])
        ->assertJsonValidationErrorFor('pernocta_mensual');

    expect($relevo->fresh()->pernocta_mensual)
        ->toBe(EntregaTurnoSeguridad::PERNOCTA_SIN_REVISAR);
});
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Correr: `php artisan test tests/Feature/EntregaTurnoSeguridad/EditarYEliminarRelevoTest.php`

Esperado: FALLA — no hay rutas `GET /{id}`, `PUT /{id}` ni
`GET /eliminar/{id}`.

- [ ] **Step 3: Escribir el Form Request de edición**

Crear `app/Http/Requests/EntregaTurnoSeguridad/UpdateEntregaTurnoSeguridadRequest.php`:

```php
<?php

namespace App\Http\Requests\EntregaTurnoSeguridad;

use App\Models\EntregaTurnoSeguridad;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Lo que se admite al editar un relevo.
 *
 * `user_id` no está, igual que al crear: el dueño del relevo no se
 * cambia. Por aquí entra también la firma del FBO, en `firma_fbo`.
 *
 * El rol se revisa en el controlador y no aquí, que es la costumbre del
 * proyecto: no hay `app/Policies`.
 */
class UpdateEntregaTurnoSeguridadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /*
     * NO hace falta un `prepareForValidation` que pase `''` a `null`.
     *
     * Una versión anterior de este plan lo mandaba, razonando que `nullable`
     * solo se salta las reglas siguientes con `null` y no con `''`, y que un
     * formulario de React que arranque con `useState('')` chocaría con la
     * regex. El razonamiento es correcto en abstracto y falso aquí: Laravel
     * registra `ConvertEmptyStringsToNull` en su pila global de middleware
     * (`Foundation\Configuration\Middleware`) y `bootstrap/app.php` no lo
     * quita, así que la cadena vacía llega ya como `null`. El método era
     * código inalcanzable y su prueba pasaba sin él.
     */

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'fecha_hora' => ['sometimes', 'date'],
            'seccion' => ['sometimes', Rule::in(EntregaTurnoSeguridad::SECCIONES)],
            'aviones_csae' => ['sometimes', 'boolean'],
            'combustible' => ['sometimes', 'boolean'],
            'resguardo_vehicular' => ['sometimes', 'boolean'],
            'estacionamiento' => ['sometimes', 'boolean'],
            'posiciones' => ['sometimes', 'boolean'],
            'vehiculos' => ['sometimes', 'boolean'],
            'operaciones' => ['sometimes', 'boolean'],
            'visitantes' => ['sometimes', 'boolean'],
            'pernocta_mensual' => ['sometimes', Rule::in(EntregaTurnoSeguridad::PERNOCTA_ESTADOS)],
            'observaciones' => ['sometimes', 'nullable', 'string'],
            /*
             * La misma regla de forma que al crear, y por lo mismo: sin ella
             * un PUT con `firma_fbo => "abc"` pasaba la validación, el guardia
             * hacía `return` en silencio y el relevo se quedaba sin la firma
             * del FBO mientras la respuesta decía que todo salió bien.
             *
             * `nullable` va por delante para que un `null` explícito —no
             * mandar firma— siga siendo válido: la regex solo juzga lo que
             * llega con contenido.
             */
            'firma_quien_entrega' => [
                'sometimes',
                'nullable',
                'string',
                'regex:/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+\/=]{16,}$/',
            ],
            'firma_fbo' => [
                'sometimes',
                'nullable',
                'string',
                'regex:/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+\/=]{16,}$/',
            ],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'seccion.in' => 'La sección solo puede ser frente o atrás.',
            'pernocta_mensual.in' => 'La pernocta mensual solo puede estar hecha, no hecha o sin revisar.',
            'firma_quien_entrega.regex' => 'La firma de quien entrega no llegó en un formato válido.',
            'firma_fbo.regex' => 'La firma del FBO no llegó en un formato válido.',
        ];
    }
}
```

- [ ] **Step 4: Escribir `show`, `update` y `eliminar`**

Agregar al controlador:

```php
    public function show(int $id): JsonResponse
    {
        $relevo = EntregaTurnoSeguridad::activas()
            ->with(['usuario:id,name', 'firmas'])
            ->find($id);

        if ($relevo === null) {
            return response()->json(['message' => 'El relevo no existe.'], 404);
        }

        return response()->json(['data' => $this->detalle($relevo)]);
    }

    public function update(UpdateEntregaTurnoSeguridadRequest $request, int $id): JsonResponse
    {
        if (! $request->user()->hasAnyRole(['fbo', 'admin'])) {
            return response()->json([
                'message' => 'Solo el FBO y el administrador pueden editar un relevo.',
            ], 403);
        }

        $relevo = EntregaTurnoSeguridad::activas()->find($id);

        if ($relevo === null) {
            return response()->json(['message' => 'El relevo no existe.'], 404);
        }

        $validado = $request->validated();
        $firmaEntrega = $validado['firma_quien_entrega'] ?? null;
        $firmaFbo = $validado['firma_fbo'] ?? null;
        unset($validado['firma_quien_entrega'], $validado['firma_fbo']);

        DB::transaction(function () use ($relevo, $validado, $firmaEntrega, $firmaFbo): void {
            if ($validado !== []) {
                $relevo->update($validado);
            }

            if (is_string($firmaEntrega)) {
                $this->guardarFirmaBase64($firmaEntrega, EntregaTurnoSeguridad::ROL_QUIEN_ENTREGA, $relevo);
            }

            if (is_string($firmaFbo)) {
                $this->guardarFirmaBase64($firmaFbo, EntregaTurnoSeguridad::ROL_FBO, $relevo);
            }
        });

        return response()->json([
            'message' => 'Relevo actualizado correctamente',
            'data' => $this->detalle($relevo->fresh()->load(['usuario:id,name', 'firmas'])),
        ]);
    }

    public function eliminar(Request $request, int $id): JsonResponse
    {
        if (! $request->user()->hasAnyRole(['fbo', 'admin'])) {
            return response()->json([
                'message' => 'Solo el FBO y el administrador pueden eliminar un relevo.',
            ], 403);
        }

        $relevo = EntregaTurnoSeguridad::activas()->find($id);

        if ($relevo === null) {
            return response()->json(['message' => 'El relevo no existe.'], 404);
        }

        $relevo->update(['status' => 'N']);

        return response()->json(['message' => 'Relevo eliminado correctamente']);
    }

    /**
     * El relevo como lo espera la pantalla: el nombre resuelto, el día y la
     * hora por separado en 24 horas, y las firmas con su URL.
     *
     * Las firmas cuyo archivo ya no está en el disco se omiten en vez de
     * devolver una URL muerta que el navegador pintaría como imagen rota.
     *
     * @return array<string, mixed>
     */
    private function detalle(EntregaTurnoSeguridad $relevo): array
    {
        $firmas = $relevo->firmas
            ->filter(static fn (Firma $firma): bool => Storage::disk($firma->disk ?? 'public')->exists($firma->path))
            ->map(static fn (Firma $firma): array => [
                'id' => $firma->id,
                'rol' => $firma->pivot->rol,
                'tag' => $firma->pivot->tag,
                'orden' => $firma->pivot->orden,
                'url' => $firma->url(),
            ])
            ->values()
            ->all();

        $casillas = [];

        foreach (EntregaTurnoSeguridad::CASILLAS as $casilla) {
            $casillas[$casilla] = (bool) $relevo->{$casilla};
        }

        return [
            'id' => $relevo->id,
            'nombre' => $relevo->usuario?->name ?? '',
            'fecha' => $relevo->fecha_hora->toDateString(),
            'hora' => $relevo->fecha_hora->format('H:i'),
            'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
            'seccion' => $relevo->seccion,
            ...$casillas,
            'pernocta_mensual' => $relevo->pernocta_mensual,
            'observaciones' => $relevo->observaciones,
            'firmas' => $firmas,
        ];
    }
```

Agregar al `use` del controlador:
`App\Http\Requests\EntregaTurnoSeguridad\UpdateEntregaTurnoSeguridadRequest`.

**Y cambiar la respuesta de `store`** para que también pase por `detalle()`:

```php
            'data' => $this->detalle($relevo->fresh()->load(['usuario:id,name', 'firmas'])),
```

El `fresh()` **no** es decoración, y es la razón por la que `update` ya lo
tenía. `create()` devuelve el modelo con solo los atributos que se le
pasaron: si la petición omite `pernocta_mensual`, el valor `R` lo pone el
valor por omisión de la columna y el modelo en memoria lo tiene en `null`.
Sin refrescar, el 201 devolvería `pernocta_mensual: null` mientras el tipo
del navegador promete `'S' | 'N' | 'R'`. Ninguna prueba lo atrapaba,
porque las de la Tarea 2 releen el registro de la base y no el cuerpo de
la respuesta.

Antes devolvía el modelo crudo, con `usuario` anidado, las firmas del
pivote y `fecha_hora` en ISO. Que el POST y el PUT devolvieran formas
distintas del mismo recurso obliga al navegador a tipar una de las dos
como `unknown` y es la clase de incoherencia que muerde al siguiente que
la use. Las pruebas de la Tarea 2 no asertan el cuerpo de la respuesta,
así que el cambio no rompe ninguna.

- [ ] **Step 5: Registrar las rutas**

En el grupo de `routes/api.php`. **El orden importa:** `eliminar/{id}`
va antes de `{id}`, porque si no, `eliminar` se leería como un id.

```php
    Route::get('/eliminar/{id}', [EntregaTurnoSeguridadController::class, 'eliminar'])->whereNumber('id');
    Route::get('/{id}', [EntregaTurnoSeguridadController::class, 'show'])->whereNumber('id');
    Route::put('/{id}', [EntregaTurnoSeguridadController::class, 'update'])->whereNumber('id');
```

El `whereNumber('id')` no es adorno. Los métodos reciben `int $id`, así que
un `GET /EntregaTurnoSeguridad/abc` reventaría con un `TypeError` y un 500 en
vez de un 404. Además deja libre el prefijo para cualquier ruta literal que
se agregue después —`pendientes` es la primera— sin que `/{id}` se la coma.

- [ ] **Step 6: Correr las pruebas y ver que pasan**

Correr: `php artisan test tests/Feature/EntregaTurnoSeguridad/`

Esperado: PASA todo.

- [ ] **Step 7: Commit**

```bash
git add app/Http/Requests/EntregaTurnoSeguridad/UpdateEntregaTurnoSeguridadRequest.php app/Http/Controllers/Api/EntregaTurnoSeguridadController.php routes/api.php tests/Feature/EntregaTurnoSeguridad/EditarYEliminarRelevoTest.php
git commit -m "feat(seguridad): detalle, edicion con firma del FBO y borrado logico del relevo"
```

---

### Task 5: Pendientes de firma del FBO

**Files:**
- Modify: `app/Http/Controllers/Api/EntregaTurnoSeguridadController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/EntregaTurnoSeguridad/PendientesDeFirmaTest.php`

**Interfaces:**
- Consumes: el controlador de las tareas 2 a 4.
- Produces: `GET /api/EntregaTurnoSeguridad/pendientes`, que devuelve
  `{ data: { id, nombre, fecha, hora, seccion }[] }`, de lo más viejo a
  lo más nuevo.

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `tests/Feature/EntregaTurnoSeguridad/PendientesDeFirmaTest.php`:

```php
<?php

use App\Models\EntregaTurnoSeguridad;
use App\Models\Firma;
use App\Models\Role;
use App\Models\User;

/*
 * El botón de pendientes del FBO: qué relevos le faltan por firmar.
 *
 * Son por SECCIÓN, no por día: si el frente entregó y el de atrás no,
 * pendientes enseña solo el del frente.
 */

/**
 * El nombre lleva sufijo a propósito.
 *
 * En Pest las funciones declaradas en un archivo de pruebas son GLOBALES de
 * toda la suite, y `usuarioConRol` ya existe en
 * `tests/Feature/OperacionesDiarias/CancelarOperacionTest.php`. Declararla
 * otra vez da un fatal por redeclaración que no se ve corriendo solo esta
 * carpeta y revienta `php artisan test` completo.
 */
function usuarioFboDePendientes(string $slug): User
{
    $usuario = User::factory()->create();
    $rol = Role::firstOrCreate(['slug' => $slug], ['nombre' => ucfirst($slug)]);
    $usuario->roles()->attach($rol->id);

    return $usuario;
}

function relevoEn(string $fechaHora, string $seccion, array $extra = []): EntregaTurnoSeguridad
{
    return EntregaTurnoSeguridad::create(array_merge([
        'user_id' => User::factory()->create()->id,
        'fecha_hora' => $fechaHora,
        'seccion' => $seccion,
    ], $extra));
}

/**
 * Firma un relevo con el rol que se le diga.
 *
 * El rol es un parámetro y no una constante escondida a propósito: con un
 * ayudante que solo supiera firmar como FBO, el filtro `firmables.rol` de
 * `pendientes()` no tendría quien lo vigilara, y quitarlo no rompería
 * ninguna prueba. Eso importa porque `store` adjunta la firma de quien
 * entrega a TODOS los relevos: sin el filtro, cada relevo contaría como
 * firmado y la cola del FBO quedaría siempre vacía.
 */
function firmarConRol(EntregaTurnoSeguridad $relevo, string $rol): void
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

function pendientes(): \Illuminate\Testing\TestResponse
{
    return test()->actingAs(usuarioFboDePendientes('fbo'))
        ->getJson('/api/EntregaTurnoSeguridad/pendientes');
}

test('lista solo lo que le falta firmar al FBO', function () {
    $firmado = relevoEn('2026-11-04 07:30:00', EntregaTurnoSeguridad::SECCION_FRENTE);
    $sinFirmar = relevoEn('2026-11-04 19:00:00', EntregaTurnoSeguridad::SECCION_ATRAS);

    firmarFbo($firmado);

    expect(array_column(pendientes()->assertSuccessful()->json('data'), 'id'))
        ->toBe([$sinFirmar->id]);
});

test('deja de listar un relevo en cuanto se firma', function () {
    $relevo = relevoEn('2026-11-04 07:30:00', EntregaTurnoSeguridad::SECCION_FRENTE);

    expect(array_column(pendientes()->json('data'), 'id'))->toBe([$relevo->id]);

    firmarFbo($relevo);

    expect(pendientes()->json('data'))->toBe([]);
});

test('una firma retirada vuelve a dejarlo pendiente', function () {
    // Retirar es poner el pivote en 'N'. Si `pendientes` mirara el
    // historial en vez de las vigentes, este relevo seguiría dado por
    // firmado y nadie lo firmaría de nuevo.
    $relevo = relevoEn('2026-11-04 07:30:00', EntregaTurnoSeguridad::SECCION_FRENTE);
    firmarFbo($relevo);

    $relevo->firmasAll()->newPivotStatement()
        ->where('firmable_id', $relevo->id)
        ->update(['status' => 'N']);

    expect(array_column(pendientes()->json('data'), 'id'))->toBe([$relevo->id]);
});

test('un relevo retirado no sale como pendiente', function () {
    relevoEn('2026-11-04 07:30:00', EntregaTurnoSeguridad::SECCION_FRENTE, ['status' => 'N']);

    expect(pendientes()->json('data'))->toBe([]);
});

test('lo más viejo va primero: es la cola de trabajo del FBO', function () {
    $nuevo = relevoEn('2026-11-04 07:30:00', EntregaTurnoSeguridad::SECCION_FRENTE);
    $viejo = relevoEn('2026-11-01 19:00:00', EntregaTurnoSeguridad::SECCION_ATRAS);

    expect(array_column(pendientes()->json('data'), 'id'))->toBe([$viejo->id, $nuevo->id]);
});

test('la firma de quien entrega no cuenta como la del FBO', function () {
    // El relevo lleva SOLO la firma de quien entrega, que es lo que `store`
    // adjunta a todos. Sin el filtro `firmables.rol` de `pendientes()`, esa
    // firma lo daría por firmado y la cola quedaría siempre vacía: la función
    // entera muerta sin una sola prueba roja.
    $relevo = relevoEn('2026-11-04 07:30:00', EntregaTurnoSeguridad::SECCION_FRENTE);
    firmarConRol($relevo, EntregaTurnoSeguridad::ROL_QUIEN_ENTREGA);

    expect(array_column(pendientes()->json('data'), 'id'))->toBe([$relevo->id]);
});

test('con la misma fecha y hora el orden lo rompe el id', function () {
    // El frente y atrás del mismo relevo pueden compartir `fecha_hora`. Sin
    // un desempate, el orden lo decide la base y cambia entre corridas.
    $primero = relevoEn('2026-11-04 07:30:00', EntregaTurnoSeguridad::SECCION_FRENTE);
    $segundo = relevoEn('2026-11-04 07:30:00', EntregaTurnoSeguridad::SECCION_ATRAS);

    expect(array_column(pendientes()->json('data'), 'id'))
        ->toBe([$primero->id, $segundo->id]);
});

test('cada pendiente dice de quién, de cuándo y de qué sección es', function () {
    $usuario = User::factory()->create(['name' => 'Luis Gómez']);
    relevoEn('2026-11-04 19:45:00', EntregaTurnoSeguridad::SECCION_ATRAS, ['user_id' => $usuario->id]);

    $pendiente = pendientes()->json('data.0');

    expect($pendiente['nombre'])->toBe('Luis Gómez')
        ->and($pendiente['fecha'])->toBe('2026-11-04')
        ->and($pendiente['hora'])->toBe('19:45')
        ->and($pendiente['seccion'])->toBe(EntregaTurnoSeguridad::SECCION_ATRAS);
});
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Correr: `php artisan test tests/Feature/EntregaTurnoSeguridad/PendientesDeFirmaTest.php`

Esperado: FALLA — la ruta `pendientes` no existe y cae en `show`, que
devuelve 404.

- [ ] **Step 3: Escribir `pendientes`**

Agregar al controlador:

```php
    /**
     * Los relevos a los que les falta la firma del FBO.
     *
     * De lo más viejo a lo más nuevo a propósito: es una cola de trabajo, y
     * lo que lleva días sin firmar es lo que corre prisa.
     */
    public function pendientes(): JsonResponse
    {
        $relevos = EntregaTurnoSeguridad::activas()
            ->with('usuario:id,name')
            ->whereDoesntHave(
                'firmas',
                static fn (Builder $firma): Builder => $firma->where('firmables.rol', EntregaTurnoSeguridad::ROL_FBO)
            )
            ->orderBy('fecha_hora')
            ->orderBy('id')
            ->get()
            ->map(static fn (EntregaTurnoSeguridad $relevo): array => [
                'id' => $relevo->id,
                'nombre' => $relevo->usuario?->name ?? '',
                'fecha' => $relevo->fecha_hora->toDateString(),
                'hora' => $relevo->fecha_hora->format('H:i'),
                'seccion' => $relevo->seccion,
            ])
            ->all();

        return response()->json(['data' => $relevos]);
    }
```

- [ ] **Step 4: Registrar la ruta**

En `routes/api.php`, **antes** de `/{id}`, por lo mismo que `eliminar`:

```php
    Route::get('/pendientes', [EntregaTurnoSeguridadController::class, 'pendientes']);
```

- [ ] **Step 4 bis: La deuda que arrastra la Tarea 4**

`/{id}` lleva `->whereNumber('id')` desde la tarea anterior, y hoy
quitarlo no rompe ninguna prueba: la restricción es del framework, pero
que nadie la vigile es la misma clase de defecto que esta rama ya
corrigió seis veces. Ahora que existe `pendientes` hay además un segundo
motivo para que esté: sin la restricción, una ruta literal nueva bajo
este prefijo podría caer dentro de `/{id}`.

Agregar en `tests/Feature/EntregaTurnoSeguridad/EditarYEliminarRelevoTest.php`:

```php
test('un id que no es un número no llega al controlador', function (string $metodo, string $ruta) {
    // Sin el `->whereNumber('id')` de las rutas, los métodos reciben
    // `int $id` y un `/abc` revienta con TypeError y 500 en vez de 404.
    // La restricción es del framework, pero sin esta prueba nadie nota si
    // alguien la quita.
    //
    // Las TRES rutas con `{id}` entran en el dataset: vigilar solo una
    // dejaría las otras dos sin guardia, que es la misma deuda una capa
    // más abajo.
    $this->actingAs(usuarioCon('fbo'))
        ->json($metodo, $ruta)
        ->assertNotFound();
})->with([
    'detalle' => ['GET', '/api/EntregaTurnoSeguridad/abc'],
    'editar' => ['PUT', '/api/EntregaTurnoSeguridad/abc'],
    'eliminar' => ['GET', '/api/EntregaTurnoSeguridad/eliminar/abc'],
]);
```

Comprobarla por mutación: quitar `->whereNumber('id')` de la ruta `GET
/{id}` y confirmar que la prueba falla —probablemente con un 500— y
restaurarlo antes de commitear.

- [ ] **Step 5: Correr las pruebas y ver que pasan**

Correr: `php artisan test tests/Feature/EntregaTurnoSeguridad/`

Esperado: PASA todo.

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/Api/EntregaTurnoSeguridadController.php routes/api.php tests/Feature/EntregaTurnoSeguridad/PendientesDeFirmaTest.php tests/Feature/EntregaTurnoSeguridad/EditarYEliminarRelevoTest.php
git commit -m "feat(seguridad): cola de pendientes de firma del FBO"
```

El cuarto archivo es el del paso «4 bis»: la prueba del id no numérico vive
con las demás de edición y borrado, no con las de pendientes.

---

### Task 6: Ruta web, menú y el store del navegador

**Files:**
- Modify: `routes/web.php`
- Modify: `resources/js/components/navigation.ts`
- Create: `resources/js/stores/apiEntregaTurnoSeguridad.ts`
- Create: `resources/js/pages/seguridad/EntregaTurno.tsx`
- Create: `resources/js/pages/seguridad/entregaTurno/types.ts`

**Interfaces:**
- Consumes: las rutas de API de las tareas 2 a 5.
- Produces: los tipos `SeccionRelevo`, `FilaRelevo`, `DetalleRelevo`,
  `PendienteRelevo`, `FiltrosRelevo`; y las funciones
  `fetchRelevos`, `fetchRelevo`, `fetchPendientesRelevo`,
  `guardarRelevo`, `actualizarRelevo`, `eliminarRelevo`. La página
  `seguridad/EntregaTurno` queda renderizando un armazón que las tareas
  9 y 10 llenan.

- [ ] **Step 1: Escribir los tipos**

Crear `resources/js/pages/seguridad/entregaTurno/types.ts`:

```ts
/** Los ocho apartados que se contestan con una casilla. */
export const CASILLAS = [
    'aviones_csae',
    'combustible',
    'resguardo_vehicular',
    'estacionamiento',
    'posiciones',
    'vehiculos',
    'operaciones',
    'visitantes',
] as const;

export type Casilla = (typeof CASILLAS)[number];

/** Lo que se lee en pantalla de cada apartado. */
export const ETIQUETA_CASILLA: Record<Casilla, string> = {
    aviones_csae: 'Aviones de CSAE',
    combustible: 'Combustible',
    resguardo_vehicular: 'Resguardo vehicular',
    estacionamiento: 'Estacionamiento',
    posiciones: 'Posiciones',
    vehiculos: 'Vehículos',
    operaciones: 'Operaciones',
    visitantes: 'Visitantes',
};

export const SECCIONES = ['frente', 'atras'] as const;

export type Seccion = (typeof SECCIONES)[number];

export const ETIQUETA_SECCION: Record<Seccion, string> = {
    frente: 'Frente',
    atras: 'Atrás',
};

/**
 * La pernocta mensual lleva tres estados, no dos: la entrega de turno es
 * diaria y la pernocta es mensual, así que «no marcado» no significa que
 * se haya dejado de hacer.
 */
export const PERNOCTA = ['S', 'N', 'R'] as const;

export type Pernocta = (typeof PERNOCTA)[number];

export const ETIQUETA_PERNOCTA: Record<Pernocta, string> = {
    S: 'Hecho',
    N: 'No hecho',
    R: 'Sin revisar',
};

export type SeccionRelevo = {
    id: number;
    nombre: string;
    hora: string;
    firmado_fbo: boolean;
    pernocta_mensual: Pernocta;
    extras: number;
};

export type FilaRelevo = {
    fecha: string;
    frente: SeccionRelevo | null;
    atras: SeccionRelevo | null;
};

/**
 * `orden` NO se tipa a propósito.
 *
 * Viene de la columna del pivote sin cast, así que según el driver puede
 * llegar como número o como cadena. Nadie en el navegador lo lee —la vista
 * previa busca las firmas por `rol`—, así que tiparlo sería prometer algo
 * que no se ha comprobado para un dato que no se usa.
 */
export type FirmaRelevo = {
    id: number;
    rol: string;
    tag: string | null;
    url: string;
};

export type DetalleRelevo = {
    id: number;
    nombre: string;
    fecha: string;
    hora: string;
    fecha_hora: string;
    seccion: Seccion;
    pernocta_mensual: Pernocta;
    observaciones: string | null;
    firmas: FirmaRelevo[];
} & Record<Casilla, boolean>;

export type PendienteRelevo = {
    id: number;
    nombre: string;
    fecha: string;
    hora: string;
    seccion: Seccion;
};

/**
 * Lo que el formulario manda al editar: todo opcional, porque el `PUT`
 * acepta cambios parciales.
 */
export type PayloadRelevo = Partial<Record<Casilla, boolean>> & {
    fecha_hora?: string;
    seccion?: Seccion;
    pernocta_mensual?: Pernocta;
    observaciones?: string | null;
    firma_quien_entrega?: string;
    firma_fbo?: string;
};

/**
 * Lo que manda al CREAR, donde tres campos son obligatorios.
 *
 * Tiparlo así y no como `Record<string, unknown>` es lo único que aquí
 * atrapa un nombre de campo mal escrito: no hay corredor de pruebas de
 * JavaScript, así que un `observacioens` pasaría hasta producción, el
 * servidor lo descartaría al validar y el texto se perdería en silencio.
 */
export type PayloadRelevoNuevo = PayloadRelevo & {
    fecha_hora: string;
    seccion: Seccion;
    firma_quien_entrega: string;
};

export type FiltrosRelevo = {
    page?: number;
    per_page?: number;
    search?: string;
    seccion?: '' | Seccion;
    fecha_inicio?: string;
    fecha_fin?: string;
    estado?: '' | 'falta_fbo' | 'completas';
};

/** `dd/mm/aaaa` a partir de `aaaa-mm-dd`, sin pasar por Date. */
export const formatearFecha = (fecha: string): string => {
    const [anio, mes, dia] = fecha.split('-');

    return anio && mes && dia ? `${dia}/${mes}/${anio}` : fecha;
};

/*
 * «Hoy» NO se define aquí. Se importa de `@/lib/fechaHoy`.
 *
 * Ese ayudante toma el día del SERVIDOR, que es el mismo reloj con el que
 * `DentroDeLaVentana` valida: si el navegador y el servidor discreparan
 * sobre qué día es hoy, el formulario ofrecería una fecha que el servidor
 * rechaza con 422 —y este módulo estrena ventana de fecha en la Tarea 8.
 *
 * Una versión anterior de este plan definía aquí un `fechaHoy` con la zona
 * del equipo. Además de reintroducir ese error, rompía
 * `tests/Feature/FechaHoyTest.php:281`, que exige que la única definición
 * viva en `resources/js/lib/fechaHoy.ts`.
 */

/*
 * Hay otra copia de `horaAhora` en
 * `pages/despacho/operacionesProgramadas/types.ts`. Se deja duplicada a
 * propósito: su sitio natural sería `lib/`, junto a `fechaHoy`, pero
 * mudarla obligaría a tocar un módulo ajeno a este trabajo. Son cuatro
 * líneas de función pura; acoplar los tipos de Seguridad a los de
 * Operaciones Programadas costaría más que la copia.
 */

/** La hora de ahora en 24 horas, como `HH:mm`. */
export const horaAhora = (): string => {
    const ahora = new Date();

    return `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
};
```

- [ ] **Step 2: Escribir el store**

Crear `resources/js/stores/apiEntregaTurnoSeguridad.ts`, con la misma
forma que `resources/js/stores/apiMovimientoCSAE.ts` — el `getXsrfToken`
se repite ahí porque cada store del proyecto trae el suyo:

```ts
import type {
    DetalleRelevo,
    FilaRelevo,
    FiltrosRelevo,
    PendienteRelevo,
} from '@/pages/seguridad/entregaTurno/types';

const BASE = '/api/EntregaTurnoSeguridad';

function getXsrfToken(): string {
    const match = document.cookie.split('; ').find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}

/**
 * Un error que conserva el estado y los errores por campo.
 *
 * Un `Error` pelado con solo el mensaje no sirve: el formulario no podría
 * pintar «la pernocta mensual solo puede estar hecha, no hecha o sin
 * revisar» junto a su campo, ni distinguir un 403 —no tienes permiso— de
 * un 404 —alguien ya lo borró— de un 422. Y el servidor manda los tres con
 * la misma forma `{ message }`, así que sin el estado son indistinguibles.
 */
export class ErrorDeApi extends Error {
    constructor(
        mensaje: string,
        public readonly status: number,
        public readonly errors: Record<string, string[]> = {},
    ) {
        super(mensaje);
        this.name = 'ErrorDeApi';
    }
}

async function leerJson(res: Response, mensajeDeError: string) {
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new ErrorDeApi(data?.message || mensajeDeError, res.status, data?.errors ?? {});
    }

    return data;
}

export type ListadoRelevos = {
    data: FilaRelevo[];
    meta: { current_page: number; last_page: number; per_page: number; total: number };
};

export async function fetchRelevos(filtros: FiltrosRelevo): Promise<ListadoRelevos> {
    const qs = new URLSearchParams();

    Object.entries(filtros).forEach(([clave, valor]) => {
        if (valor !== undefined && valor !== null && String(valor).trim() !== '') {
            qs.set(clave, String(valor));
        }
    });

    const query = qs.toString();

    const res = await fetch(`${BASE}${query ? `?${query}` : ''}`, {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
    });

    return leerJson(res, 'No se pudo cargar la lista de relevos');
}

export async function fetchRelevo(id: number): Promise<{ data: DetalleRelevo }> {
    const res = await fetch(`${BASE}/${id}`, {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
    });

    return leerJson(res, 'No se pudo cargar el relevo');
}

export async function fetchPendientesRelevo(): Promise<{ data: PendienteRelevo[] }> {
    const res = await fetch(`${BASE}/pendientes`, {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
    });

    return leerJson(res, 'No se pudieron cargar los pendientes');
}

export async function guardarRelevo(form: Record<string, unknown>) {
    const res = await fetch(BASE, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': getXsrfToken(),
        },
        body: JSON.stringify(form),
        credentials: 'same-origin',
    });

    return leerJson(res, 'No se pudo guardar el relevo');
}

export async function actualizarRelevo(id: number, form: Record<string, unknown>) {
    const res = await fetch(`${BASE}/${id}`, {
        method: 'PUT',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': getXsrfToken(),
        },
        body: JSON.stringify(form),
        credentials: 'same-origin',
    });

    return leerJson(res, 'No se pudo actualizar el relevo');
}

export async function eliminarRelevo(id: number) {
    const res = await fetch(`${BASE}/eliminar/${id}`, {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
    });

    return leerJson(res, 'No se pudo eliminar el relevo');
}
```

- [ ] **Step 3: La página, de momento un armazón**

Crear `resources/js/pages/seguridad/EntregaTurno.tsx`. Copiar el
encabezado, el `AppLayout` y los `breadcrumbs` de
`resources/js/pages/seguridad/MovimientoAvionesCSAE.tsx`, y dejar el
cuerpo con el título y un hueco que las tareas 9 y 10 llenan. El tipo
`AuthUser` y el juego de `rolesUsuario` / `tieneRol` se copian de
`MovimientoAvionesCSAE.tsx:38` y `:473-477`:

```tsx
const rolesUsuario = new Set(
    (user?.roles ?? []).map(role => role.slug.trim().toLowerCase()),
);
const tieneRol = (...roles: string[]) => roles.some(role => rolesUsuario.has(role));
const puedeEditar = tieneRol('fbo', 'admin');
```

- [ ] **Step 4: La ruta web**

En `routes/web.php`, dentro del mismo grupo que las demás de Seguridad:

```php
    Route::get('entregaTurnoSeguridad', function () {
        return Inertia::render('seguridad/EntregaTurno');
    })->name('entregaTurnoSeguridad');
```

- [ ] **Step 5: Generar el ayudante de ruta**

`navigation.ts` importa sus ayudantes de `@/routes`, que es
`resources/js/routes/` — una carpeta **generada por Wayfinder** y que está
en `.gitignore` (línea 8). El ayudante `entregaTurnoSeguridad` no existe
hasta que se regenere, así que importarlo antes deja el TypeScript roto.

Correr:

```bash
php artisan wayfinder:generate --with-form
```

Es un comando de artisan, no una compilación: no hace falta `npm run
build` para esto. Lo que genere **no se commitea**, porque la carpeta
está ignorada y el build la vuelve a producir.

**La bandera `--with-form` no es opcional.** `vite.config.ts` llama a
`wayfinder({ formVariants: true })`, así que todo el proyecto espera las
variantes `.form`. Generando sin la bandera desaparecen de `login`,
`delete-user` y varias más, y `npx tsc --noEmit` pasa de un error a
decenas, ninguno de este módulo.

- [ ] **Step 6: El renglón del menú**

En `resources/js/components/navigation.ts`: agregar
`entregaTurnoSeguridad` a los `import` de rutas desde `@/routes`, y el
renglón al módulo `Seguridad`, después de `seguridad-operaciones`:

```ts
{ id: 'seguridad-entrega-turno', title: 'Entrega de Turno', href: entregaTurnoSeguridad(), icon: LayoutGrid },
```

Ojo: ya existe un `entregaTurno` importado ahí, que es el de Despacho.
Son dos rutas distintas y dos páginas distintas; no se reúsa ninguna.

- [ ] **Step 7: Comprobar que compila**

Quien coordina corre `npm run build` y `npx tsc --noEmit`.

Esperado: `npm run build` sale con 0; `tsc` reporta **exactamente un**
error, el de base en `WalkAroundController.ts:905`.

- [ ] **Step 8: Commit**

```bash
git add routes/web.php resources/js/components/navigation.ts resources/js/stores/apiEntregaTurnoSeguridad.ts resources/js/pages/seguridad/EntregaTurno.tsx resources/js/pages/seguridad/entregaTurno/types.ts
git commit -m "feat(seguridad): ruta, menu y store del relevo de turno"
```

---

### Task 7: El formulario

**Files:**
- Create: `resources/js/pages/seguridad/entregaTurno/FormEntregaTurno.tsx`
- Modify: `resources/js/pages/seguridad/EntregaTurno.tsx`

**Interfaces:**
- Consumes: `types.ts` y el store de la Tarea 6.
- Produces:
  `<FormEntregaTurno abierto={boolean} relevo={DetalleRelevo | null} nombreUsuario={string} puedeFirmarComoFbo={boolean} onCerrar={() => void} onGuardado={() => void} />`.
  Con `relevo` en `null` crea; con un relevo, edita.
  `puedeFirmarComoFbo` enciende el campo de la firma del FBO.

- [ ] **Step 1: Escribir el componente**

Seguir la estructura de `resources/js/pages/Rampa/entregaTurnoR/RampaForm.tsx`,
que es el otro relevo del proyecto, y el modal de
`MovimientoAvionesCSAE.tsx` para las clases. Los puntos que no se
negocian:

El estado:

`fechaHoy` se importa de `@/lib/fechaHoy`, **no** de `./types`: es el día
del servidor, el mismo con el que se valida la ventana de fecha.

```tsx
import { fechaHoy } from '@/lib/fechaHoy';

const [datos, setDatos] = useState({
    fecha: relevo?.fecha ?? fechaHoy(),
    hora: relevo?.hora ?? horaAhora(),
    seccion: relevo?.seccion ?? ('frente' as Seccion),
    pernocta_mensual: relevo?.pernocta_mensual ?? ('R' as Pernocta),
    observaciones: relevo?.observaciones ?? '',
    casillas: Object.fromEntries(
        CASILLAS.map(casilla => [casilla, relevo?.[casilla] ?? false]),
    ) as Record<Casilla, boolean>,
});
```

- El **nombre** se pinta de `nombreUsuario` en un campo
  `readOnly disabled`, y **no** se manda al servidor: el servidor lo toma
  del autenticado.
- La **hora** es `<input type="time" step="60" />`, que es 24 horas sin
  `am`/`pm`.
- Al enviar, el día y la hora se juntan en `fecha_hora`:
  `` `${datos.fecha} ${datos.hora}:00` ``.
- Las **ocho casillas** se recorren con `CASILLAS` y se etiquetan con
  `ETIQUETA_CASILLA`. No se escribe la lista a mano en el JSX: duplicarla
  es cómo se desincroniza del servidor.

  El marcado sale del relevo hermano,
  `despacho/components/entregaTurno/ChecklistComunicacion.tsx:104-111`:

```tsx
<label className="inline-flex items-center gap-2 text-xs text-gray-800">
    <input
        type="checkbox"
        checked={datos.casillas[casilla]}
        onChange={() => alternar(casilla)}
        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
    />
    <span>{ETIQUETA_CASILLA[casilla]}</span>
</label>
```

  **No se usa `components/ui/checkbox.tsx`.** Existe, pero en todo el
  proyecto solo lo importa `pages/auth/login.tsx`: es del sistema de
  diseño de las pantallas de autenticación, no del de los módulos. Es el
  mismo caso que `DataTable`.

  **Sin clases `dark:`.** Las pantallas de Seguridad no traen ni una
  (`MovimientoAvionesCSAE` y `RegistroVisitantes` dan cero), así que este
  módulo tampoco. La regla del proyecto es seguir a las páginas
  existentes, y las existentes de esta área no soportan modo oscuro. Que
  falte **no es un defecto** en este módulo.
- La **pernocta mensual** son tres botones de opción recorriendo
  `PERNOCTA` con `ETIQUETA_PERNOCTA`, con `R` marcado al abrir.
- Las **observaciones** son un `<textarea rows={4} />`.
- La **firma de quien entrega** se captura con el componente que ya
  existe,
  `resources/js/pages/despacho/components/walkAround/SignaturePad.tsx`,
  cuyo contrato es justo el que hace falta:

```tsx
import SignaturePad from '@/pages/despacho/components/walkAround/SignaturePad';

<SignaturePad
    title="Firma de quien entrega"
    value={firmaQuienEntrega}
    onChange={setFirmaQuienEntrega}
    compact
/>
```

  Devuelve `canvas.toDataURL("image/png")`, que es exactamente el
  `data:image/png;base64,…` que el servidor espera, y ya respalda otros
  tres formularios. **No se escribe otro canvas a mano**: el relevo de
  Rampa lo hizo así (`RampaSignaturesSection.tsx:103`) y es la copia que
  no hay que repetir. Que el componente viva bajo `pages/despacho/` es
  incómodo pero no se mueve en este trabajo: ya lo importan de fuera
  `FirmaCanvas.tsx` y `WalkAroundForm.tsx`, y mudarlo es otra tarea.

  Viaja en `firma_quien_entrega`.

  **Obligatoria al CREAR, opcional al editar.** Al crear, sin ella el botón
  de guardar queda deshabilitado. Al editar no se pide: el `PUT` conserva la
  firma anterior si no llega una nueva, y el Form Request de edición ya la
  declara `sometimes|nullable`. Exigirla al editar obligaría a quien corrige
  una casilla a redibujar la firma de otra persona, que es falsificarla.
- La **firma del FBO** aparece en el formulario **solo** cuando quien
  mira tiene `fbo` o `admin`, con otro `SignaturePad`, y viaja en
  `firma_fbo`. Es por aquí por donde el FBO firma lo que la cola de
  pendientes de la Tarea 10 le señala, así que el campo tiene que estar
  desde esta tarea aunque la cola llegue después. Al crear no es
  obligatoria.
- Guardar llama a `guardarRelevo` cuando `relevo` es `null` y a
  `actualizarRelevo(relevo.id, …)` cuando no, y avisa con el `Swal.mixin`
  de `toast` que ya usa `TablaPrestamosChalecos.tsx:31`.

  **El payload va anotado**, y esto no es estilo:

```tsx
const payload: PayloadRelevoNuevo = {
    ...datos.casillas,
    fecha_hora: `${datos.fecha} ${datos.hora}:00`,
    seccion: datos.seccion,
    pernocta_mensual: datos.pernocta_mensual,
    observaciones: datos.observaciones.trim() || null,
    firma_quien_entrega: firmaQuienEntrega,
};
```

  TypeScript solo comprueba propiedades sobrantes en **literales frescos**.
  Armar el objeto con spread y pasarlo por una variable sin anotar desactiva
  esa comprobación, y entonces un `observacioens` o un `aviones_csea`
  pasarían sin queja: el tipo quedaría de adorno y el dato se perdería en
  silencio al validar en el servidor. Con la anotación en la variable, la
  comprobación corre.

- **Los errores se leen con `instanceof ErrorDeApi`**, no suponiendo que
  todo error trae `status`: un fallo de red hace que `fetch` lance un
  `TypeError` pelado.

```tsx
try {
    // …guardar…
} catch (error) {
    if (error instanceof ErrorDeApi) {
        setErrores(error.errors);

        toast.fire({
            icon: 'error',
            title: error.status === 403
                ? 'No tienes permiso para editar este relevo.'
                : error.status === 404
                  ? 'El relevo ya no existe.'
                  : error.message,
        });

        return;
    }

    toast.fire({ icon: 'error', title: 'No se pudo conectar con el servidor.' });
}
```

  `errores` es un `Record<string, string[]>` y cada campo pinta el suyo con
  `errores.observaciones?.[0]`. Distinguir el 403 del 404 importa: el
  servidor manda los dos con la misma forma `{ message }`, y «no tienes
  permiso» y «alguien ya lo borró» piden al usuario cosas distintas.

La ventana de fecha **no** se conecta aquí: es la Tarea 8.

- [ ] **Step 2: Colgar el formulario de la página**

En `EntregaTurno.tsx`, un botón «Nuevo relevo» que abre el formulario con
`relevo = null`, y el estado `relevoEnEdicion` que la Tarea 9 va a
alimentar desde la tabla.

- [ ] **Step 3: Comprobar que compila**

Quien coordina corre `npm run build` y `npx tsc --noEmit`, con el mismo
criterio de la Tarea 6.

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/seguridad/entregaTurno/FormEntregaTurno.tsx resources/js/pages/seguridad/EntregaTurno.tsx
git commit -m "feat(seguridad): formulario del relevo de turno"
```

---

### Task 8: La ventana de fecha, en sus cuatro sitios

**Files:**
- Modify: `app/Support/VentanasDeFecha.php`
- Modify: `tests/Feature/VentanasDeFechaTest.php:211`
- Modify: `app/Http/Requests/EntregaTurnoSeguridad/StoreEntregaTurnoSeguridadRequest.php`
- Modify: `app/Http/Requests/EntregaTurnoSeguridad/UpdateEntregaTurnoSeguridadRequest.php`
- Modify: `resources/js/pages/seguridad/entregaTurno/FormEntregaTurno.tsx`
- Test: `tests/Feature/EntregaTurnoSeguridad/VentanaDeFechaDelRelevoTest.php`

**Interfaces:**
- Consumes: el Form Request de la Tarea 2, el de la Tarea 4 y el
  formulario de la Tarea 7. Los tres tienen que existir ya.
- Produces: la clave `seguridad.entrega_turno`.

**Esta tarea se hace de una sola pieza.** Poner la clave en la tabla y
usarla en un solo lado deja en rojo
`tests/Feature/VentanasDeFechaTest.php:296`, que exige que cada clave
aparezca en `app/` y en `resources/js`. Los cinco archivos van en el
mismo commit.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tests/Feature/EntregaTurnoSeguridad/VentanaDeFechaDelRelevoTest.php`:

```php
<?php

use App\Models\EntregaTurnoSeguridad;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/*
 * El relevo se llena en el momento, con un día de margen para quien
 * cierra a la mañana siguiente: hoy y ayer. Es la misma ventana que
 * `turno.checklist` y `turno.entrega_rampa`.
 */

beforeEach(function () {
    Storage::fake('public');
});

/**
 * La firma de prueba, propia de ESTE archivo.
 *
 * No se reúsa el `firmaBase64Valida()` de `EditarYEliminarRelevoTest.php`
 * aunque en Pest las funciones de un archivo de pruebas sean globales de
 * toda la suite: correr este archivo suelto daría «Call to undefined
 * function», porque el otro no se habría cargado. Un archivo de pruebas que
 * solo funciona si antes se cargó otro es frágil, y la duplicación de un
 * PNG de un pixel cuesta menos que esa dependencia escondida.
 */
function firmaPngMinima(): string
{
    return 'data:image/png;base64,'
        .'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
}

function intentarRelevoEl(string $dia): \Illuminate\Testing\TestResponse
{
    return test()->actingAs(User::factory()->create())
        ->postJson('/api/EntregaTurnoSeguridad', [
            'fecha_hora' => "{$dia} 07:30:00",
            'seccion' => EntregaTurnoSeguridad::SECCION_FRENTE,
            'firma_quien_entrega' => firmaPngMinima(),
        ]);
}

test('acepta hoy y ayer', function (int $diasAtras) {
    $dia = Carbon::today(config('app.timezone'))->subDays($diasAtras)->toDateString();

    intentarRelevoEl($dia)->assertSuccessful();
})->with([0, 1]);

test('rechaza un relevo de hace una semana', function () {
    $dia = Carbon::today(config('app.timezone'))->subDays(7)->toDateString();

    intentarRelevoEl($dia)->assertJsonValidationErrorFor('fecha_hora');

    expect(EntregaTurnoSeguridad::count())->toBe(0);
});

test('rechaza un relevo de mañana', function () {
    $dia = Carbon::today(config('app.timezone'))->addDay()->toDateString();

    intentarRelevoEl($dia)->assertJsonValidationErrorFor('fecha_hora');

    expect(EntregaTurnoSeguridad::count())->toBe(0);
});

/*
 * Al editar: no puedes PONER una fecha fuera de ventana, pero puedes DEJAR
 * la que ya estaba. Sin esto, el FBO no podría firmar un relevo de hace tres
 * días, que es justo lo que la cola de pendientes saca a flote.
 */

function relevoViejo(): EntregaTurnoSeguridad
{
    $hace3 = Carbon::today(config('app.timezone'))->subDays(3);

    return EntregaTurnoSeguridad::create([
        'user_id' => User::factory()->create()->id,
        'fecha_hora' => $hace3->copy()->setTime(7, 30)->format('Y-m-d H:i:s'),
        'seccion' => EntregaTurnoSeguridad::SECCION_FRENTE,
    ]);
}

function editarComoFbo(EntregaTurnoSeguridad $relevo, array $datos): \Illuminate\Testing\TestResponse
{
    $fbo = User::factory()->create();
    $rol = \App\Models\Role::firstOrCreate(['slug' => 'fbo'], ['nombre' => 'FBO']);
    $fbo->roles()->attach($rol->id);

    return test()->actingAs($fbo)->putJson("/api/EntregaTurnoSeguridad/{$relevo->id}", $datos);
}

test('el FBO puede firmar un relevo viejo dejando su fecha', function () {
    // Éste es el caso que la cola de pendientes necesita. Si falla, el botón
    // de pendientes enseña relevos que nadie puede firmar.
    $relevo = relevoViejo();
    $suFecha = $relevo->fecha_hora->format('Y-m-d H:i:s');

    editarComoFbo($relevo, ['fecha_hora' => $suFecha, 'firma_fbo' => firmaPngMinima()])
        ->assertSuccessful();

    $relevo->load('firmas');

    expect($relevo->tieneFirmaDe(EntregaTurnoSeguridad::ROL_FBO))->toBeTrue();
});

test('no se puede mover un relevo viejo a otra fecha vieja', function () {
    $relevo = relevoViejo();
    $otraVieja = Carbon::today(config('app.timezone'))->subDays(5)->format('Y-m-d H:i:s');

    editarComoFbo($relevo, ['fecha_hora' => $otraVieja])
        ->assertJsonValidationErrorFor('fecha_hora');

    expect($relevo->fresh()->fecha_hora->toDateString())
        ->toBe($relevo->fecha_hora->toDateString());
});

test('sí se puede traer un relevo viejo a hoy', function () {
    $relevo = relevoViejo();
    $hoy = Carbon::today(config('app.timezone'))->setTime(8, 0)->format('Y-m-d H:i:s');

    editarComoFbo($relevo, ['fecha_hora' => $hoy])->assertSuccessful();

    expect($relevo->fresh()->fecha_hora->toDateString())
        ->toBe(Carbon::today(config('app.timezone'))->toDateString());
});

test('una fecha no se puede lavar pasando por una válida', function () {
    // Cada petición se juzga contra lo guardado EN ESE MOMENTO. Traer el
    // relevo a hoy y devolverlo a su fecha vieja debe fallar en el segundo
    // paso: si pasara, la ventana no serviría de nada.
    $relevo = relevoViejo();
    $vieja = $relevo->fecha_hora->format('Y-m-d H:i:s');
    $hoy = Carbon::today(config('app.timezone'))->setTime(8, 0)->format('Y-m-d H:i:s');

    editarComoFbo($relevo, ['fecha_hora' => $hoy])->assertSuccessful();

    editarComoFbo($relevo, ['fecha_hora' => $vieja])
        ->assertJsonValidationErrorFor('fecha_hora');

    expect($relevo->fresh()->fecha_hora->toDateString())
        ->toBe(Carbon::today(config('app.timezone'))->toDateString());
});
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Correr: `php artisan test tests/Feature/EntregaTurnoSeguridad/VentanaDeFechaDelRelevoTest.php`

Esperado: las dos de rechazo FALLAN — hoy el servidor acepta cualquier
fecha.

- [ ] **Step 3: La clave en la tabla**

En `app/Support/VentanasDeFecha.php`, en el primer bloque, el de las que
se llenan en el momento, después de `'turno.entrega_rampa'`:

```php
        'seguridad.entrega_turno' => ['atras' => 1, 'futuro' => false],
```

- [ ] **Step 4: La misma clave en la prueba que fija la tabla**

En `tests/Feature/VentanasDeFechaTest.php`, dentro del `toBe([...])` de
la línea 211, en el mismo lugar:

```php
        'seguridad.entrega_turno' => ['atras' => 1, 'futuro' => false],
```

La tabla está duplicada a propósito: cambiarla obliga a reconocerlo en
dos sitios.

- [ ] **Step 5: La regla en los dos Form Request**

En `StoreEntregaTurnoSeguridadRequest::rules()`, pegada a `date`, que es
lo que exige `tests/Feature/VentanasDeFechaTest.php`:

```php
            'fecha_hora' => ['required', 'date', new DentroDeLaVentana('seguridad.entrega_turno')],
```

En `UpdateEntregaTurnoSeguridadRequest::rules()` la regla va
**condicionada**, y esto es lo más importante de la tarea:

```php
            'fecha_hora' => $this->cambiaElDia()
                ? ['sometimes', 'date', new DentroDeLaVentana('seguridad.entrega_turno')]
                : ['sometimes', 'date'],
```

con este ayudante privado en el mismo Form Request:

```php
    /**
     * Si la fecha recibida es un día DISTINTO del que ya está guardado.
     *
     * La regla del proyecto al editar es «no puedes PONER una fecha fuera de
     * ventana, pero puedes DEJAR la que ya estaba». Sin esto, el FBO no
     * podría firmar un relevo de hace tres días: el formulario manda
     * `fecha_hora` siempre, esa fecha está fuera de «hoy y ayer», y el
     * servidor devolvería 422 —justo con los relevos viejos que la cola de
     * pendientes existe para sacar a flote, ordenados de más viejo primero.
     *
     * Tampoco se puede «lavar» una fecha: cada petición se juzga contra lo
     * que hay guardado en ese momento, así que pasar por una fecha válida y
     * volver a la vieja se rechaza en el segundo paso.
     *
     * El día se compara con `diaQueGuardaElModelo` y no con `Carbon::parse`,
     * por lo mismo que la regla: difieren con una cadena numérica y con un
     * desfase de zona.
     */
    private function cambiaElDia(): bool
    {
        $relevo = EntregaTurnoSeguridad::activas()->find($this->route('id'));

        if ($relevo === null) {
            return true;
        }

        $recibido = VentanasDeFecha::diaQueGuardaElModelo($this->input('fecha_hora'));

        return $recibido !== $relevo->fecha_hora?->toDateString();
    }
```

Agregar los `use` de `App\Support\VentanasDeFecha` y
`App\Models\EntregaTurnoSeguridad`.

El patrón sale de `MovimientoCSAEController.php:251` y `:307-312`, que
resuelve lo mismo para la salida de un avión. Ese módulo valida en el
controlador y aquí se hace en el Form Request, que es donde vive la
validación de este módulo; la decisión es la misma.

Y el `use App\Rules\DentroDeLaVentana;` en los dos. Quitar de los
docblocks la nota que decía que la regla llegaba en esta tarea.

- [ ] **Step 5 bis: La deuda que arrastra la Tarea 7**

Al editar, el formulario dice por texto que ya hay firma pero no la
enseña. `SignaturePad` no sirve para eso: su `value` espera un
`data:image/png;base64,…` y lo guardado es una URL a un archivo.

Eso importa porque quien edita puede dibujar encima de una firma buena sin
darse cuenta de que existía. El dato está a mano en
`DetalleRelevo.firmas[].url`, así que se enseña:

```tsx
/** La firma vigente de un rol, o null si ese rol no ha firmado. */
const firmaGuardada = (rol: string): FirmaRelevo | null =>
    relevo?.firmas.find(firma => firma.rol === rol) ?? null;
```

y, encima de cada `SignaturePad`, cuando hay firma guardada:

```tsx
<div className="mb-2">
    <p className="text-[10px] font-bold uppercase text-slate-400">Firma actual</p>
    <img
        src={firma.url}
        alt="Firma registrada"
        className="h-16 rounded border border-slate-200 bg-white"
    />
    <p className="text-[10px] text-slate-400">
        Dibujar una nueva la reemplaza; la anterior queda en el historial.
    </p>
</div>
```

El texto de abajo no es adorno: el servidor no borra la firma anterior, la
retira poniendo su pivote en `N`. Quien edita merece saber que lo que hace
es reemplazar y no destruir.

- [ ] **Step 6: El calendario en el formulario**

En `FormEntregaTurno.tsx`:

```tsx
import { useVentanaDeFecha } from '@/lib/ventanasDeFecha';

// Al editar se le pasa la fecha original: si no, un relevo de hace tres
// días no se podría ni corregir porque su propia fecha quedaría fuera de
// la ventana.
const { min, max } = useVentanaDeFecha('seguridad.entrega_turno', relevo?.fecha);
```

y colgar `min` y `max` del `<input type="date" />` del día.

- [ ] **Step 7: Correr las pruebas y ver que pasan**

Correr: `php artisan test tests/Feature/EntregaTurnoSeguridad/ tests/Feature/VentanasDeFechaTest.php`

Esperado: PASA todo. Si
«toda clave de la tabla esta puesta en el servidor Y en el navegador»
sale en rojo, es que falta el paso 5 o el 6.

- [ ] **Step 8: Comprobar que compila**

Quien coordina corre `npm run build` y `npx tsc --noEmit`, con el mismo
criterio de la Tarea 6.

- [ ] **Step 9: Commit**

```bash
git add app/Support/VentanasDeFecha.php tests/Feature/VentanasDeFechaTest.php app/Http/Requests/EntregaTurnoSeguridad/StoreEntregaTurnoSeguridadRequest.php app/Http/Requests/EntregaTurnoSeguridad/UpdateEntregaTurnoSeguridadRequest.php resources/js/pages/seguridad/entregaTurno/FormEntregaTurno.tsx tests/Feature/EntregaTurnoSeguridad/VentanaDeFechaDelRelevoTest.php
git commit -m "feat(seguridad): el relevo de turno solo admite hoy y ayer"
```

---

### Task 9: La tabla y el selector de sección

**Files:**
- Create: `resources/js/pages/seguridad/entregaTurno/TablaEntregaTurno.tsx`
- Create: `resources/js/pages/seguridad/entregaTurno/SelectorSeccion.tsx`
- Modify: `resources/js/pages/seguridad/EntregaTurno.tsx`

**Interfaces:**
- Consumes: `types.ts`, `fetchRelevos`, `eliminarRelevo`, y
  `ModalPeriodo` de `@/components/ModalPeriodo`.
- Produces:
  `<TablaEntregaTurno puedeEditar={boolean} recargar={number} onEditar={(id: number) => void} onVerPrevia={(fila: FilaRelevo) => void} />`
  — `onVerPrevia` entrega la **fila completa**, no la fecha: la tabla ya
  la tiene, y mandar solo la fecha obligaría a la página a buscar un
  renglón que nunca tuvo o a pedirlo otra vez al servidor
  y
  `<SelectorSeccion fila={FilaRelevo} accion={'editar' | 'eliminar'} onElegir={(id: number) => void} onCerrar={() => void} />`.

- [ ] **Step 1: Escribir la tabla**

Seguir `resources/js/pages/Trafico/prestamoChalecos/TablaPrestamosChalecos.tsx`,
que resuelve tabla, filtros, paginación y acciones en 285 líneas. Se
copian tal cual sus constantes de la línea 23:

```tsx
const TH = 'px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center';
const FILTRO = 'w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white outline-none focus:border-blue-400 uppercase text-center';
```

**No se importa `DataTable`.** Nadie lo usa y su aspecto
(`rounded-xl`, `bg-muted/50`) no es el de estas tablas.

Las columnas, en este orden: Fecha, Frente, Atrás, Pernocta mensual,
Acciones.

El estado de los filtros. `RangoPeriodo` y `ModalPeriodo` se importan
del componente compartido, no se redeclaran:

```tsx
import ModalPeriodo, { type RangoPeriodo } from '@/components/ModalPeriodo';

const [filtros, setFiltros] = useState<FiltrosRelevo>({
    search: '',
    seccion: '',
    estado: '',
    fecha_inicio: '',
    fecha_fin: '',
});
const [periodo, setPeriodo] = useState<RangoPeriodo>({
    periodo: 'mes',
    fecha_inicio: '',
    fecha_fin: '',
});
const [modalPeriodoAbierto, setModalPeriodoAbierto] = useState(false);
const [pagina, setPagina] = useState(1);
```

El botón de fechas abre `ModalPeriodo`, y su `onAplicar` escribe
`fecha_inicio` y `fecha_fin` en los filtros y regresa `pagina` a 1.
«Limpiar» devuelve todo a su valor inicial.

El rótulo del botón lo arma un `etiquetaPeriodo` **propio del módulo**, en
`types.ts`:

```ts
/** Lo que el botón de fechas dice cuando está cerrado. */
export const etiquetaPeriodo = (rango: RangoPeriodo): string => {
    if (!rango.fecha_inicio && !rango.fecha_fin) return 'Todas las fechas';
    if (rango.periodo === 'dia') return formatearFecha(rango.fecha_inicio);
    if (rango.periodo === 'rango') {
        return `${formatearFecha(rango.fecha_inicio)} / ${formatearFecha(rango.fecha_fin)}`;
    }
    if (rango.periodo === 'mes') return rango.fecha_inicio.substring(0, 7);

    return rango.fecha_inicio.substring(0, 4);
};
```

La copia es deliberada y **no es un hallazgo de duplicación**: ya existen
dos, en `Trafico/prestamoChalecos/types.ts:130` y
`Rampa/relacionPlanta/types.ts:115`, cada una tipada contra el tipo de
filtros de su módulo. Unificarlas pediría un tipo compartido y tocar dos
módulos ajenos a este trabajo. Aquí se tipa contra el `RangoPeriodo` que
`ModalPeriodo` ya exporta, que es lo más cerca de compartido que hay.

La celda de cada sección:

```tsx
/** Lo que se ve de una sección: quién, a qué hora y si el FBO ya firmó. */
function CeldaSeccion({ seccion }: { seccion: SeccionRelevo | null }) {
    if (seccion === null) {
        return <span className="text-[10px] font-bold uppercase text-slate-300">—</span>;
    }

    return (
        <div className="flex flex-col items-center gap-0.5">
            <span className="text-[11px] font-bold text-slate-700">{seccion.nombre}</span>
            <span className="text-[10px] text-slate-400">{seccion.hora}</span>
            <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                    seccion.firmado_fbo
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-orange-100 text-orange-600'
                }`}
            >
                {seccion.firmado_fbo ? 'Firmado' : 'Falta FBO'}
            </span>
            {seccion.extras > 0 && (
                <span className="text-[9px] font-bold uppercase text-slate-400">
                    {seccion.extras + 1} registros
                </span>
            )}
        </div>
    );
}
```

La columna de pernocta mensual, con la regla de la spec: una etiqueta si
las dos secciones coinciden, las dos si discrepan, el frente primero.

```tsx
/**
 * La pernocta mensual del día.
 *
 * Si las dos secciones no coinciden se imprimen LAS DOS, el frente
 * primero. Resumirlas a una obligaría a decidir cuál gana, y cualquier
 * elección borraría lo que una de las dos dijo.
 */
function pernoctaDelDia(fila: FilaRelevo): string {
    const estados = [fila.frente?.pernocta_mensual, fila.atras?.pernocta_mensual]
        .filter((estado): estado is Pernocta => estado !== undefined);

    if (estados.length === 0) {
        return '—';
    }

    const etiquetas = [...new Set(estados)].map(estado => ETIQUETA_PERNOCTA[estado]);

    return etiquetas.join(' / ');
}
```

Las acciones: el ojo siempre; el lápiz y el bote solo con
`puedeEditar`. Las dos que actúan sobre un registro preguntan sobre qué
sección cuando el día trae las dos, y entran directo cuando trae una:

```tsx
/** El id sobre el que actuar, o null si hay que preguntar primero. */
function idUnicoDe(fila: FilaRelevo): number | null {
    const presentes = [fila.frente, fila.atras].filter(
        (seccion): seccion is SeccionRelevo => seccion !== null,
    );

    return presentes.length === 1 ? presentes[0].id : null;
}
```

Eliminar confirma con `Swal.fire` antes, como
`TablaPrestamosChalecos.tsx:47`, y recarga el listado al terminar.

- [ ] **Step 2: Escribir el selector de sección**

Crear `SelectorSeccion.tsx`: un modal chico con un botón por sección
presente, cada uno con el nombre y la hora, y el texto de la acción
(«¿Qué sección quieres editar?» / «¿Qué sección quieres eliminar?»).
Mismas clases de modal que `MovimientoAvionesCSAE.tsx`.

- [ ] **Step 3: Colgar la tabla de la página**

En `EntregaTurno.tsx`: la tabla debajo del encabezado, con
`puedeEditar`, y `onEditar` cargando el detalle con `fetchRelevo` para
abrir el formulario en modo edición.

- [ ] **Step 4: Comprobar que compila**

Quien coordina corre `npm run build` y `npx tsc --noEmit`, con el mismo
criterio de la Tarea 6.

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/seguridad/entregaTurno/TablaEntregaTurno.tsx resources/js/pages/seguridad/entregaTurno/SelectorSeccion.tsx resources/js/pages/seguridad/EntregaTurno.tsx
git commit -m "feat(seguridad): tabla del relevo con una fila por dia"
```

---

### Task 10: La vista previa y la cola de pendientes

**Files:**
- Create: `resources/js/pages/seguridad/entregaTurno/VistaPreviaEntregaTurno.tsx`
- Create: `resources/js/pages/seguridad/entregaTurno/PendientesFirmaFbo.tsx`
- Modify: `resources/js/pages/seguridad/EntregaTurno.tsx`
- Modify: `resources/js/pages/seguridad/entregaTurno/TablaEntregaTurno.tsx`

**Interfaces:**
- Consumes: `fetchRelevo`, `fetchPendientesRelevo`, `actualizarRelevo`
  y los tipos de la Tarea 6.
- Produces:
  `<VistaPreviaEntregaTurno fila={FilaRelevo | null} onCerrar={() => void} />`
  y
  `<PendientesFirmaFbo abierto={boolean} onCerrar={() => void} onFirmar={(id: number) => void} />`.

- [ ] **Step 1: Escribir la vista previa**

Seguir `resources/js/pages/seguridad/MovimientoAvionesCSAE/VistaPreviaCsae.tsx`,
incluido su manejo de los tres estados: un `cargando` con `LoaderCircle`
mientras llega el detalle, un `error` con `AlertCircle` y su mensaje si
falla, y el contenido cuando hay datos. Pedir dos secciones en paralelo
hace esto más necesario que allí, no menos: si una de las dos peticiones
falla, la pantalla tiene que decirlo en vez de pintar media vista previa
como si estuviera completa.

Lo que sí cambia:

- recibe la **fila del día** y pide el detalle de cada sección presente
  con `fetchRelevo`, en paralelo con `Promise.all`;
- dibuja **dos columnas** lado a lado, Frente y Atrás;
- cada columna lleva los ocho apartados recorriendo `CASILLAS` con
  `ETIQUETA_CASILLA`, en ✓/✗, más la pernocta mensual con su etiqueta de
  `ETIQUETA_PERNOCTA` y el texto de las observaciones;
- las dos firmas salen como imagen, leídas por el `rol` del pivote. Se
  copia la idea de `getFirmaByRol` de esa vista, **pero sin** su
  comparación `firma?.status !== 'I'`: el servidor nunca escribe `I`, y
  la relación ya filtra por `A`, así que esa línea no hace nada. Queda:

```tsx
const firmaPorRol = (detalle: DetalleRelevo | null, rol: string): FirmaRelevo | null =>
    detalle?.firmas.find(firma => firma.rol === rol) ?? null;
```

- una sección en `null` se dibuja como **«Sin entregar»**, no como una
  columna de casillas vacías: vacío y no entregado no son lo mismo.

- [ ] **Step 2: Escribir la cola de pendientes**

Crear `PendientesFirmaFbo.tsx`. **No es un modal: es un cajón lateral**,
siguiendo `resources/js/pages/Rampa/checkListEquipo/PendientesDrawer.tsx`,
que resuelve exactamente esto en 101 líneas y es el hermano del mismo
endpoint de pendientes. De ahí salen la estructura
(`fixed inset-0 z-[80] flex justify-end`, el fondo difuminado, la entrada
desde la derecha), el estado vacío en panel verde y el renglón con su
botón de acción.

Sus props son casi las que hacen falta: donde él tiene
`{ isOpen, onClose, onSelectUser }`, aquí va
`{ abierto, onCerrar, onFirmar }`.

Llama a `fetchPendientesRelevo` al abrirse y lista cada pendiente con su
fecha (`formatearFecha`), su hora en 24 horas, su sección
(`ETIQUETA_SECCION`) y su nombre, con un botón que avisa al padre con el
id. Lo más viejo ya viene primero del servidor; **no se reordena en el
navegador**, que es donde se perdería el criterio de la cola.

Cuando no hay nada pendiente lo dice con el panel verde del hermano, no
con una lista vacía muda.

- [ ] **Step 3: Colgar las dos de la página**

En `EntregaTurno.tsx`:

- el `onVerPrevia` de la tabla abre la vista previa con la fila del día;
- el botón «Pendientes» se pinta **solo** con `puedeEditar`, y su
  `onFirmar` abre el formulario de esa sección en modo edición, donde la
  firma del FBO entra por `firma_fbo`;
- al guardar o al eliminar, la tabla se recarga subiendo el contador de
  `recargar`.

- [ ] **Step 4: Comprobar que compila**

Quien coordina corre `npm run build` y `npx tsc --noEmit`, con el mismo
criterio de la Tarea 6.

- [ ] **Step 5: Correr la suite completa**

Correr: `php artisan test`

Esperado: verde. Leer la salida de artisan y **no** la de `tail`: en
bash, `php artisan test 2>&1 | tail` devuelve el código de `tail` y
enmascara un fallo. Si hace falta recortar la salida, usar
`${PIPESTATUS[0]}`.

- [ ] **Step 6: Commit**

```bash
git add resources/js/pages/seguridad/entregaTurno/VistaPreviaEntregaTurno.tsx resources/js/pages/seguridad/entregaTurno/PendientesFirmaFbo.tsx resources/js/pages/seguridad/EntregaTurno.tsx resources/js/pages/seguridad/entregaTurno/TablaEntregaTurno.tsx
git commit -m "feat(seguridad): vista previa del dia y cola de pendientes del FBO"
```
