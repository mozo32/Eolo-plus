# Evidencias fotográficas en Servicio Comisariato — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir evidencias fotográficas opcionales y sin límite al recibo de Servicio Comisariato, capturables desde el formulario y desde un botón nuevo de la tabla, e impresas en el PDF.

**Architecture:** Sin tabla nueva: se usa el par polimórfico `imagens` + `imageables` que el proyecto ya tiene para Walk Around. El backend gana tres cosas (una relación, dos endpoints) y el `show` pasa a devolver las evidencias. En el front, un componente de captura sigue el patrón de `FotoIne.tsx` —cámara en vivo cuando el navegador la permita, captura nativa cuando no—, y el PDF gana una rejilla de dos por renglón al final.

**Tech Stack:** Laravel 12, Inertia 2, React 19, TypeScript, Tailwind 4, Pest 3, `@react-pdf/renderer` 4.3.1, MySQL (`eolo_plus`) y sqlite `:memory:` en las pruebas.

**Spec:** `docs/superpowers/specs/2026-11-18-evidencias-comisariato-design.md`

## Global Constraints

- Las pruebas corren **en serie**: `php artisan test`. **Nunca `--parallel`** (da rojos falsos en este proyecto).
- `php artisan test 2>&1 | tail` devuelve el código de salida de `tail` y **esconde los fallos**: leer siempre `${PIPESTATUS[0]}`.
- **No correr `vendor/bin/pint`, `prettier`, `npm run lint` ni `npm run format`**, aunque el CLAUDE.md pida pint.
- **Los subagentes no corren `npm run build`.** Llegan hasta `npx tsc --noEmit`; el build lo corre el controlador.
- **No usar `git stash`**: hay tres stashes guardados que no son de este trabajo.
- **No usar `git add -A` ni `git add .`**: `CLAUDE.md`, `boost.json`, `.claude/` y `.env.respaldo-antes-de-fact-fbo-prod` son locales y deben seguir sin seguimiento. Se añade archivo por archivo.
- **`eolo_plus` es la base real del usuario.** Leerla sí; escribirla no. **No hay migración en este plan**, así que nadie debe correr `php artisan migrate`. Nunca `migrate:fresh`, `migrate:refresh`, `db:wipe` ni `db:seed`.
- No hay `.env.testing`; `--env=testing` **no** cambia de conexión. `phpunit.xml` ya fija sqlite `:memory:`.
- **Sin factories** salvo `UserFactory`: las filas se crean con `Modelo::create([...])`.
- La conexión **`remota` es de solo lectura por contrato**. El `store` existente inserta en ella; eso es deuda previa y **no se toca**.
- No hay runner de pruebas de JavaScript. La evidencia del front es `npx tsc --noEmit` con **exactamente un** error de base —`TS1117` en `resources/js/actions/App/Http/Controllers/Api/WalkAroundController.ts:905`, generado por Wayfinder— y `npm run build` con salida 0.
- Los archivos de código se quedan por debajo de 300 líneas (las pruebas están exentas). `ServicioComisariato.tsx` ya tiene 808 y `ServicioComisariatoController.php` es largo: **deuda previa, fuera de alcance, no se parten**.
- Este plan no añade rutas con nombre, así que **no hay que regenerar Wayfinder**.
- Se sigue el estilo de los archivos vecinos de `Trafico/` para las clases de Tailwind.

---

### Task 1: El backend de las evidencias

**Files:**
- Modify: `app/Models/ServicioComisariato.php`
- Create: `app/Http/Requests/ServicioComisariato/GuardarEvidenciaComisariatoRequest.php`
- Modify: `app/Http/Controllers/Api/ServicioComisariatoController.php` (`show`, y dos métodos nuevos)
- Modify: `routes/api.php:173-179`
- Test: `tests/Feature/ServicioComisariato/EvidenciasComisariatoTest.php` (nuevo)

**Interfaces:**
- Consumes: `App\Models\Imagen` (ya existe, con `getUrlAttribute()`), las tablas `imagens` e `imageables`.
- Produces: lo que el front consume en las tareas 2 y 4 —
  - `POST /api/ServicioComisariato/{id}/evidencias` con `{ foto: "data:image/jpeg;base64,…" }` → `201 { message, data: { id, url, orden } }`
  - `DELETE /api/ServicioComisariato/{id}/evidencias/{imagenId}` → `200 { message }` o `404`
  - `GET /api/ServicioComisariato/{id}` → el servicio más `evidencias: [{ id, url, orden }]`

- [ ] **Step 1: Escribir las pruebas, que todavía fallan**

Crear `tests/Feature/ServicioComisariato/EvidenciasComisariatoTest.php`:

```php
<?php

use App\Models\Imagen;
use App\Models\ServicioComisariato;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/*
 * Las evidencias cuelgan del par polimórfico imagens/imageables, el mismo que
 * usa Walk Around. Borrar es poner el pivote en `N`: en un documento que sirve
 * de prueba, destruir no es una opción.
 */

/** Un JPEG de un pixel, con el prefijo que el servidor espera. */
function fotoBase64(): string
{
    return 'data:image/jpeg;base64,'
        .'/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a'
        .'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA'
        .'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
}

/** @param array<string, mixed> $extra */
function servicioDeEvidencias(array $extra = []): ServicioComisariato
{
    return ServicioComisariato::create(array_merge([
        'user_id' => User::factory()->create()->id,
        'catering' => 'CATERING UNO',
        'forma_pago' => 'EFECTIVO',
        'fecha_entrega' => '2026-11-18',
        'hora_entrega' => '14:30',
        'matricula' => 'XA-TSR',
        'subtotal' => 100,
        'total' => 116,
    ], $extra));
}

function subirEvidencia(ServicioComisariato $servicio, ?string $foto = null): \Illuminate\Testing\TestResponse
{
    return test()->postJson(
        "/api/ServicioComisariato/{$servicio->id}/evidencias",
        ['foto' => $foto ?? fotoBase64()]
    );
}

beforeEach(function () {
    Storage::fake('public');
    $this->actingAs(User::factory()->create());
});

test('subir una evidencia crea la imagen, el pivote y el archivo', function () {
    $servicio = servicioDeEvidencias();

    $respuesta = subirEvidencia($servicio)->assertCreated();

    $imagen = Imagen::sole();

    expect($respuesta->json('data.id'))->toBe($imagen->id)
        ->and($respuesta->json('data.orden'))->toBe(0)
        ->and($respuesta->json('data.url'))->toBeString()->not->toBeEmpty();

    Storage::disk('public')->assertExists($imagen->path);

    expect($imagen->mime)->toBe('image/jpeg')
        ->and($imagen->size)->toBeGreaterThan(0)
        ->and(DB::table('imageables')->where('imagen_id', $imagen->id)->count())->toBe(1);
});

test('el archivo aterriza en la carpeta del mes', function () {
    subirEvidencia(servicioDeEvidencias())->assertCreated();

    expect(Imagen::sole()->path)
        ->toStartWith('evidencias/ServicioComisariato/'.now()->format('Y/m').'/')
        ->toEndWith('.jpg');
});

test('dos subidas dan orden cero y uno', function () {
    $servicio = servicioDeEvidencias();

    expect(subirEvidencia($servicio)->json('data.orden'))->toBe(0)
        ->and(subirEvidencia($servicio)->json('data.orden'))->toBe(1);
});

test('el orden no reutiliza el numero de una evidencia borrada', function () {
    // La tercera es la 2 aunque la segunda ya no esté: dos evidencias
    // distintas no pueden haber ocupado nunca el mismo sitio.
    $servicio = servicioDeEvidencias();

    subirEvidencia($servicio);
    $segunda = subirEvidencia($servicio)->json('data.id');

    test()->deleteJson("/api/ServicioComisariato/{$servicio->id}/evidencias/{$segunda}")
        ->assertSuccessful();

    expect(subirEvidencia($servicio)->json('data.orden'))->toBe(2);
});

test('un base64 invalido se rechaza y no deja nada', function (string $foto) {
    $servicio = servicioDeEvidencias();

    subirEvidencia($servicio, $foto)
        ->assertStatus(422)
        ->assertJsonValidationErrors('foto');

    expect(Imagen::count())->toBe(0)
        ->and(DB::table('imageables')->count())->toBe(0);
})->with([
    'texto pelado' => ['abc'],
    'sin prefijo' => ['iVBORw0KGgoAAAANSUhEUg=='],
    'tipo que no es imagen' => ['data:application/pdf;base64,JVBERi0xLjQKJeLjz9MK'],
    // Dieciséis `=` de relleno: la regex vieja los dejaba pasar, base64_decode
    // devolvía cadena vacía y quedaba un archivo de cero bytes con su renglón.
    'relleno de iguales' => ['data:image/png;base64,================'],
]);

test('el show devuelve las evidencias ordenadas', function () {
    $servicio = servicioDeEvidencias();
    $primera = subirEvidencia($servicio)->json('data.id');
    $segunda = subirEvidencia($servicio)->json('data.id');

    $evidencias = test()->getJson("/api/ServicioComisariato/{$servicio->id}")
        ->assertSuccessful()
        ->json('evidencias');

    expect(array_column($evidencias, 'id'))->toBe([$primera, $segunda])
        ->and($evidencias[0])->toHaveKeys(['id', 'url', 'orden']);
});

test('un servicio sin fotos devuelve una lista vacia, no null', function () {
    expect(test()->getJson('/api/ServicioComisariato/'.servicioDeEvidencias()->id)->json('evidencias'))
        ->toBe([]);
});

test('borrar esconde la evidencia pero conserva la imagen', function () {
    $servicio = servicioDeEvidencias();
    $imagenId = subirEvidencia($servicio)->json('data.id');

    test()->deleteJson("/api/ServicioComisariato/{$servicio->id}/evidencias/{$imagenId}")
        ->assertSuccessful();

    expect(test()->getJson("/api/ServicioComisariato/{$servicio->id}")->json('evidencias'))->toBe([])
        ->and(Imagen::whereKey($imagenId)->exists())->toBeTrue()
        ->and(DB::table('imageables')->where('imagen_id', $imagenId)->value('status'))->toBe('N');
});

test('no se puede borrar la evidencia de otro servicio', function () {
    // `imageables` es polimórfica: sin el id del servicio por delante, un id
    // equivocado despegaría la foto de otro dueño sin que nadie se enterara.
    $mio = servicioDeEvidencias();
    $ajeno = servicioDeEvidencias();
    $imagenId = subirEvidencia($ajeno)->json('data.id');

    test()->deleteJson("/api/ServicioComisariato/{$mio->id}/evidencias/{$imagenId}")
        ->assertNotFound();

    expect(DB::table('imageables')->where('imagen_id', $imagenId)->value('status'))->toBe('A');
});

test('borrar dos veces la misma evidencia da 404 la segunda', function () {
    $servicio = servicioDeEvidencias();
    $imagenId = subirEvidencia($servicio)->json('data.id');
    $url = "/api/ServicioComisariato/{$servicio->id}/evidencias/{$imagenId}";

    test()->deleteJson($url)->assertSuccessful();
    test()->deleteJson($url)->assertNotFound();
});

test('subir a un servicio que no existe da 404', function () {
    test()->postJson('/api/ServicioComisariato/999999/evidencias', ['foto' => fotoBase64()])
        ->assertNotFound();
});

test('sin sesion no se sube ni se borra nada', function () {
    $servicio = servicioDeEvidencias();
    $imagenId = subirEvidencia($servicio)->json('data.id');

    auth()->logout();

    test()->postJson("/api/ServicioComisariato/{$servicio->id}/evidencias", ['foto' => fotoBase64()])
        ->assertUnauthorized();

    test()->deleteJson("/api/ServicioComisariato/{$servicio->id}/evidencias/{$imagenId}")
        ->assertUnauthorized();

    expect(Imagen::count())->toBe(1);
});
```

- [ ] **Step 2: Correr y ver el rojo**

```bash
php artisan test tests/Feature/ServicioComisariato/EvidenciasComisariatoTest.php
```

Esperado: FALLA. Las rutas no existen, así que casi todo da 404 en vez de 201, y el `show` no trae la clave `evidencias`.

- [ ] **Step 3: La relación en el modelo**

En `app/Models/ServicioComisariato.php`, añadir los dos `use` que faltan (`Imagen` no hace falta importarlo si se usa `Imagen::class`; sí hacen falta `MorphToMany`) y las dos relaciones:

```php
    /**
     * Las evidencias fotográficas vigentes del servicio.
     *
     * El pivote retirado queda en `N` y deja de verse, igual que hacen las
     * firmas en el resto del proyecto: en un documento que sirve de prueba,
     * lo retirado tiene que poder recuperarse.
     */
    public function evidencias(): MorphToMany
    {
        return $this->morphToMany(Imagen::class, 'imageable', 'imageables')
            ->withPivot(['tag', 'orden', 'status'])
            ->wherePivot('status', 'A')
            ->withTimestamps();
    }

    /**
     * Todas, incluidas las retiradas.
     *
     * La usa el cálculo del `orden`: si contara solo las vigentes, borrar la
     * última y subir otra reutilizaría un número ya usado.
     */
    public function evidenciasAll(): MorphToMany
    {
        return $this->morphToMany(Imagen::class, 'imageable', 'imageables')
            ->withPivot(['tag', 'orden', 'status']);
    }
```

- [ ] **Step 4: El Form Request**

Crear `app/Http/Requests/ServicioComisariato/GuardarEvidenciaComisariatoRequest.php`:

```php
<?php

namespace App\Http\Requests\ServicioComisariato;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Lo que se admite al subir UNA evidencia.
 *
 * Una foto por petición y no todas juntas: veinte imágenes en base64 dentro
 * de un solo cuerpo chocan con `post_max_size` de PHP, y un fallo tumbaría
 * la tanda entera en vez de una foto.
 */
class GuardarEvidenciaComisariatoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            /*
             * El `=` solo se admite como relleno FINAL, y el cierre es `\z`.
             *
             * Con `[A-Za-z0-9+\/=]{16,}$` dieciséis `=` pasaban la validación:
             * `base64_decode` devolvía cadena vacía, se escribía un archivo de
             * cero bytes y se creaba el renglón de la imagen. En un módulo de
             * evidencias, una foto de cero bytes es una prueba que no existe.
             *
             * El `\z` cierra además que `$` en PHP, sin el modificador `D`,
             * acepta un salto de línea final.
             *
             * Es la MISMA regla que usa el módulo de Seguridad para las firmas:
             * si se cambia una, se cambian las dos.
             */
            'foto' => [
                'required',
                'string',
                'regex:/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+\/]{16,}={0,2}\z/',
            ],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'foto.required' => 'No llegó ninguna fotografía.',
            'foto.regex' => 'La fotografía no llegó como una imagen válida.',
        ];
    }
}
```

- [ ] **Step 5: Los dos métodos del controlador**

En `app/Http/Controllers/Api/ServicioComisariatoController.php`, añadir los `use` que falten (`App\Http\Requests\ServicioComisariato\GuardarEvidenciaComisariatoRequest`, `App\Models\Imagen`, `Illuminate\Http\JsonResponse`, `Illuminate\Support\Str`) y estos métodos:

```php
    /**
     * Guarda UNA evidencia del servicio.
     *
     * El `orden` sale del máximo de TODAS —también las retiradas— más uno:
     * dos evidencias distintas no pueden haber ocupado nunca el mismo sitio.
     */
    public function guardarEvidencia(
        GuardarEvidenciaComisariatoRequest $request,
        ServicioComisariato $servicioComisariato
    ): JsonResponse {
        $imagen = $this->guardarImagenBase64(
            $request->validated()['foto'],
            'evidencias/ServicioComisariato/'.now()->format('Y/m')
        );

        $maximo = $servicioComisariato->evidenciasAll()->max('imageables.orden');
        $orden = $maximo === null ? 0 : (int) $maximo + 1;

        $servicioComisariato->evidencias()->attach($imagen->id, [
            'tag' => 'evidencia',
            'orden' => $orden,
            'status' => 'A',
        ]);

        return response()->json([
            'message' => 'Evidencia guardada correctamente',
            'data' => [
                'id' => $imagen->id,
                'url' => $imagen->url,
                'orden' => $orden,
            ],
        ], 201);
    }

    /**
     * Retira una evidencia de ESTE servicio.
     *
     * Pide los dos ids a propósito. `imageables` es polimórfica y una misma
     * imagen puede colgar de más de un dueño; sin el servicio por delante, un
     * id equivocado despegaría la foto de otro registro —de un Walk Around,
     * por ejemplo— sin que nadie se enterara.
     */
    public function eliminarEvidencia(ServicioComisariato $servicioComisariato, int $imagenId): JsonResponse
    {
        $retiradas = $servicioComisariato->evidencias()
            ->newPivotStatement()
            ->where('imageable_type', ServicioComisariato::class)
            ->where('imageable_id', $servicioComisariato->id)
            ->where('imagen_id', $imagenId)
            ->where('status', 'A')
            ->update(['status' => 'N']);

        if ($retiradas === 0) {
            return response()->json(['message' => 'La evidencia no existe o no es de este servicio.'], 404);
        }

        return response()->json(['message' => 'Evidencia eliminada correctamente']);
    }

    /**
     * Escribe la imagen en el disco `public` y registra su `Imagen`.
     *
     * La extensión sale de una lista cerrada y no de partir el mime, a
     * propósito: `MovimientoCSAEController` sí lo parte y arrastra ese defecto
     * (un SVG quedaba como `.svg+xml`). Aquí no se copia.
     */
    private function guardarImagenBase64(string $base64, string $carpeta): Imagen
    {
        [$meta, $contenido] = explode(',', $base64);
        preg_match('/data:(.*?);base64/', $meta, $coincidencias);

        $mime = $coincidencias[1] ?? 'image/jpeg';
        $extension = match ($mime) {
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => 'jpg',
        };

        $ruta = $carpeta.'/'.Str::uuid().'.'.$extension;

        Storage::disk('public')->put($ruta, base64_decode($contenido));

        return Imagen::create([
            'disk' => 'public',
            'path' => $ruta,
            'original_name' => basename($ruta),
            'mime' => $mime,
            'size' => Storage::disk('public')->size($ruta),
        ]);
    }
```

Si `Storage` no estaba importado, añadir `use Illuminate\Support\Facades\Storage;`.

- [ ] **Step 6: El `show` devuelve las evidencias**

Sustituir el método `show` entero:

```php
    public function show(ServicioComisariato $servicioComisariato)
    {
        /*
         * La relación NO se carga con `load()` a propósito: `toArray()`
         * serializaría la colección entera de imágenes con sus columnas
         * internas, y la pantalla solo necesita tres campos.
         */
        $evidencias = $servicioComisariato->evidencias()
            ->orderBy('imageables.orden')
            ->get()
            ->map(static fn (Imagen $imagen): array => [
                'id' => $imagen->id,
                'url' => $imagen->url,
                'orden' => (int) $imagen->pivot->orden,
            ])
            ->values()
            ->all();

        return response()->json([
            ...$servicioComisariato->toArray(),
            'evidencias' => $evidencias,
        ]);
    }
```

- [ ] **Step 7: Las dos rutas**

En `routes/api.php`, dentro del grupo con prefijo `ServicioComisariato`, añadir **antes** de la ruta `GET /{servicioComisariato}` para que se lean juntas:

```php
    Route::post('{servicioComisariato}/evidencias', [ServicioComisariatoController::class, 'guardarEvidencia']);
    Route::delete('{servicioComisariato}/evidencias/{imagenId}', [ServicioComisariatoController::class, 'eliminarEvidencia']);
```

No hay conflicto con las existentes: los métodos y el número de segmentos difieren.

- [ ] **Step 8: Correr y ver verde**

```bash
php artisan test tests/Feature/ServicioComisariato/EvidenciasComisariatoTest.php
```

Esperado: PASA, los trece casos (contando el dataset de cuatro).

Si falla `sin sesion no se sube ni se borra nada` con 302 en vez de 401, es que la petición no se está mandando como JSON: `postJson`/`deleteJson` son obligatorios.

- [ ] **Step 9: Que no se haya roto el módulo**

```bash
php artisan test --filter=Comisariato
```

Esperado: PASA. El `show` cambió de forma y puede haber pruebas viejas que lo afirmen.

- [ ] **Step 10: Commit**

```bash
git add app/Models/ServicioComisariato.php app/Http/Requests/ServicioComisariato app/Http/Controllers/Api/ServicioComisariatoController.php routes/api.php tests/Feature/ServicioComisariato
git commit -m "feat(comisariato): el servicio guarda evidencias fotograficas"
```

---

### Task 2: La tienda y la compresión

Las dos piezas sin interfaz que consumen las tareas 3 y 4. El árbol sigue compilando: nadie las usa todavía.

**Files:**
- Create: `resources/js/pages/Trafico/servicioComisariato/comprimirImagen.ts`
- Modify: `resources/js/stores/apiServicioComisariato.ts`

**Interfaces:**
- Consumes: los dos endpoints de la Tarea 1.
- Produces:
  - `comprimirImagen(archivo: File | Blob): Promise<string>` → un data URL JPEG
  - `subirEvidenciaComisariato(servicioId: number, foto: string): Promise<{ id: number; url: string; orden: number }>`
  - `eliminarEvidenciaComisariato(servicioId: number, imagenId: number): Promise<void>`
  - `type EvidenciaComisariato = { id: number; url: string; orden: number }`

- [ ] **Step 1: La compresión**

Crear `resources/js/pages/Trafico/servicioComisariato/comprimirImagen.ts`:

```ts
/**
 * Reduce una foto antes de subirla y la devuelve como data URL JPEG.
 *
 * No es un adorno: «sin límite» con fotos a resolución de tablet son veinte
 * imágenes de 3 MB, o sea 60 MB de subida y un PDF que no se abre. A 1280 px
 * y calidad 0.7 cada una ronda los 200 KB.
 *
 * Siempre sale JPEG, aunque entre un PNG: una foto de cámara no gana nada con
 * la compresión sin pérdida y sí pesa cinco veces más.
 */
const LADO_MAXIMO = 1280;

const CALIDAD = 0.7;

export function comprimirImagen(archivo: File | Blob): Promise<string> {
    return new Promise((resolver, rechazar) => {
        const lector = new FileReader();

        lector.onerror = () => rechazar(new Error('No se pudo leer la fotografía.'));

        lector.onload = () => {
            const imagen = new Image();

            imagen.onerror = () => rechazar(new Error('La fotografía no se pudo interpretar.'));

            imagen.onload = () => {
                const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
                const lienzo = document.createElement('canvas');

                lienzo.width = Math.round(imagen.width * escala);
                lienzo.height = Math.round(imagen.height * escala);

                const contexto = lienzo.getContext('2d');

                if (contexto === null) {
                    rechazar(new Error('El navegador no permitió preparar la fotografía.'));
                    return;
                }

                contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);

                resolver(lienzo.toDataURL('image/jpeg', CALIDAD));
            };

            imagen.src = String(lector.result);
        };

        lector.readAsDataURL(archivo);
    });
}
```

El `Math.min(1, …)` importa: sin él, una foto de 400 px se **ampliaría** a 1280 y pesaría más que la original.

- [ ] **Step 2: Las dos funciones de la tienda**

En `resources/js/stores/apiServicioComisariato.ts`, al final, siguiendo el estilo del archivo (que usa `getXsrfToken()` y `credentials: "same-origin"`):

```ts
export type EvidenciaComisariato = {
    id: number;
    url: string;
    orden: number;
};

export async function subirEvidenciaComisariato(servicioId: number, foto: string): Promise<EvidenciaComisariato> {
    const res = await fetch(`/api/ServicioComisariato/${servicioId}/evidencias`, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-XSRF-TOKEN": getXsrfToken(),
        },
        body: JSON.stringify({ foto }),
        credentials: "same-origin",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data?.message || "No se pudo guardar la evidencia");
    }

    return data.data;
}

export async function eliminarEvidenciaComisariato(servicioId: number, imagenId: number): Promise<void> {
    const res = await fetch(`/api/ServicioComisariato/${servicioId}/evidencias/${imagenId}`, {
        method: "DELETE",
        headers: {
            Accept: "application/json",
            "X-XSRF-TOKEN": getXsrfToken(),
        },
        credentials: "same-origin",
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "No se pudo eliminar la evidencia");
    }
}
```

- [ ] **Step 3: Que compile**

```bash
npx tsc --noEmit
```

Esperado: **exactamente un** error, el de base `TS1117` en `WalkAroundController.ts:905`.

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/Trafico/servicioComisariato/comprimirImagen.ts resources/js/stores/apiServicioComisariato.ts
git commit -m "feat(comisariato): comprimir la foto y hablar con el endpoint de evidencias"
```

---

### Task 3: El componente de captura

**Files:**
- Create: `resources/js/pages/Trafico/servicioComisariato/CamaraEvidencias.tsx`

**Interfaces:**
- Consumes: `comprimirImagen`, `subirEvidenciaComisariato`, `eliminarEvidenciaComisariato` y el tipo `EvidenciaComisariato` de la Tarea 2.
- Produces:

```tsx
export type FotoEvidencia = {
    /** null mientras no se haya subido: el servicio todavía no existe. */
    id: number | null;
    /** La URL del servidor, o un data URL local si aún está sin subir. */
    url: string;
};

type Props = {
    abierto: boolean;
    /** null durante el alta, antes de guardar el servicio. */
    servicioId: number | null;
    fotos: FotoEvidencia[];
    onCerrar: () => void;
    /** Se llama tras cada alta o baja, con la lista completa ya actualizada. */
    onCambio: (fotos: FotoEvidencia[]) => void;
};

export default function CamaraEvidencias(props: Props)
```

**El `id: number | null` es lo que hace que el componente sirva en los dos
momentos.** Con `servicioId`, cada foto se sube en cuanto se toma y entra en la
lista con su id. Sin él —alta sin guardar— la foto se queda con `id: null` y su
data URL, se ve igual en las miniaturas, y es el formulario quien la sube
después de guardar el servicio. Borrar una foto sin id no llama a la API: basta
con quitarla de la lista.

- [ ] **Step 1: Escribir el componente**

Un modal con: las miniaturas de lo que ya hay, cada una con una X; un botón «Añadir foto»; y, cuando el navegador lo permita, el vídeo en vivo con su botón de disparo.

Lo que hace la captura, en este orden:

1. Al pulsar «Añadir foto», si `navigator.mediaDevices?.getUserMedia` existe, abre el vídeo en vivo. Si no, dispara el `<input type="file" accept="image/*" capture="environment">` escondido, que en tablet abre la cámara nativa del aparato.
2. La foto —venga del canvas del vídeo o del input— pasa por `comprimirImagen`.
3. Si hay `servicioId`, se sube; si no, se queda pendiente con `id: null`.

Esa tercera parte es la lógica del componente y va verbatim:

```tsx
    const aceptarFoto = async (origen: File | Blob) => {
        setSubiendo(true);
        setError('');

        try {
            const dataUrl = await comprimirImagen(origen);

            if (servicioId === null) {
                onCambio([...fotos, { id: null, url: dataUrl }]);
                return;
            }

            const guardada = await subirEvidenciaComisariato(servicioId, dataUrl);
            onCambio([...fotos, { id: guardada.id, url: guardada.url }]);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo guardar la fotografía.');
        } finally {
            setSubiendo(false);
        }
    };

    const quitarFoto = async (indice: number) => {
        const foto = fotos[indice];

        // Una foto sin id nunca llegó al servidor: basta con sacarla de la lista.
        if (foto.id !== null && servicioId !== null) {
            try {
                await eliminarEvidenciaComisariato(servicioId, foto.id);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'No se pudo eliminar la fotografía.');
                return;
            }
        }

        onCambio(fotos.filter((_, i) => i !== indice));
    };
```

La doble ruta se copia de `resources/js/pages/Trafico/prestamoChalecos/FotoIne.tsx`, que ya la resolvió bien. De ahí sale también el esqueleto del efecto de la cámara:

```tsx
    useEffect(() => {
        if (!camaraAbierta) return;

        let cancelado = false;

        const iniciar = async () => {
            setErrorCamara('');

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: 'environment' } },
                    audio: false,
                });

                if (cancelado) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                streamRef.current = stream;

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
            } catch {
                setErrorCamara('No se pudo abrir la cámara. Usa «Añadir foto» para tomarla con el aparato.');
                setCamaraAbierta(false);
            }
        };

        void iniciar();

        return () => {
            cancelado = true;
            detenerCamara();
        };
    }, [camaraAbierta, detenerCamara]);
```

El `cancelado` y el `detenerCamara()` del cleanup son obligatorios: sin ellos, cerrar el modal deja la cámara encendida y el piloto del aparato prendido.

**El mensaje cuando no hay cámara en vivo no dice «este navegador no soporta la cámara»** —que es lo que dice hoy Walk Around y es falso—. Dice que la página no está en HTTPS y que por eso se usa la cámara del aparato. Una línea, en gris, bajo el botón.

Con `servicioId === null` —el alta antes de guardar— el botón de añadir **sigue funcionando**: las fotos se acumulan como pendientes y un texto en gris avisa de que se subirán al guardar el servicio. Las miniaturas de las pendientes se distinguen de las ya guardadas con un distintivo discreto.

Cada subida enseña su propio estado de «subiendo…» y, si falla, un mensaje que no borra las que ya subieron.

Mantener el archivo **por debajo de 300 líneas**. Si no cabe, parar y reportarlo en vez de partirlo por cuenta propia.

- [ ] **Step 2: Que compile**

```bash
npx tsc --noEmit
```

Esperado: el único error de base. El componente todavía no lo usa nadie, lo cual es correcto en esta tarea.

- [ ] **Step 3: Commit**

```bash
git add resources/js/pages/Trafico/servicioComisariato/CamaraEvidencias.tsx
git commit -m "feat(comisariato): el modal de evidencias con camara en vivo o del aparato"
```

---

### Task 4: Conectar el formulario y la tabla

**Files:**
- Modify: `resources/js/pages/Trafico/servicioComisariato/ServicioComisariatoForm.tsx`
- Modify: `resources/js/pages/Trafico/ServicioComisariato.tsx`

**Interfaces:**
- Consumes: `CamaraEvidencias` (Tarea 3), la tienda (Tarea 2) y el `show` con `evidencias` (Tarea 1).
- Produces: nada que otra tarea consuma.

- [ ] **Step 1: La sección del formulario**

En `ServicioComisariatoForm.tsx`, antes del `<div className="flex justify-end p-5">` del botón de guardar, una sección opcional con el conteo de evidencias y un botón que abre `CamaraEvidencias`.

El estado arranca de `data?.evidencias ?? []` cuando `isEdit`, y vacío al crear.

En `handleSubmit`, **después** de que la llamada a la API tenga éxito y **antes** del `Swal` de éxito:

```tsx
            const respuesta = isEdit && data?.id
                ? await actualizarServicioComisariatoApi(data.id, payload)
                : await guardarServicioComisariatoApi(payload);

            const servicioId = isEdit && data?.id ? data.id : respuesta?.data?.id;
```

`store` devuelve `{ message, data: servicio }` con 201, así que `respuesta.data.id` es el id recién nacido. **Si no lo trae, parar y reportarlo**: sin id no hay dónde colgar las fotos y el resto del paso no tiene sentido.

Luego se suben las pendientes —las que tienen `id === null`— una por una:

```tsx
            const pendientes = fotos.filter(foto => foto.id === null);
            const fallidas: number[] = [];

            for (const [indice, foto] of pendientes.entries()) {
                try {
                    await subirEvidenciaComisariato(servicioId, foto.url);
                } catch {
                    fallidas.push(indice + 1);
                }
            }
```

Una por una y no con `Promise.all`: el `orden` lo asigna el servidor leyendo el máximo actual, y en paralelo dos peticiones leerían el mismo máximo y pedirían el mismo sitio.

Si alguna falla, el servicio **ya está guardado**. El mensaje lo dice con esas palabras —«el servicio se guardó, pero N fotografías no subieron; puedes volver a tomarlas desde la tabla»— en vez de dar a entender que se perdió todo.

- [ ] **Step 2: El botón de la tabla**

En `ServicioComisariato.tsx`, en la columna de acciones, un botón de cámara **entre** «Vista previa» y «PDF`:

```tsx
                                                        <button
                                                            type="button"
                                                            className="p-2 rounded transition-colors text-slate-400 hover:text-indigo-600"
                                                            title="Evidencias fotográficas"
                                                            onClick={() => setEvidenciasId(row.id)}
                                                        >
                                                            <Camera size={16} />
                                                        </button>
```

Con `Camera` añadido al import de `lucide-react`, un `const [evidenciasId, setEvidenciasId] = useState<number | null>(null);`, y al final, junto a los otros modales, `CamaraEvidencias` con `servicioId={evidenciasId}`.

Al abrirlo se piden las evidencias con `fetchShowServicioComisariato(evidenciasId)` y se le pasan mapeadas a la forma del componente, que no lleva `orden` —el servidor ya las devuelve ordenadas, así que repetir el campo solo da dos sitios donde pueda discrepar:

```tsx
const fotos: FotoEvidencia[] = (detalle?.evidencias ?? []).map(
    (evidencia: EvidenciaComisariato) => ({ id: evidencia.id, url: evidencia.url }),
);
```

Al cerrar, se refresca la tabla por si el PDF cambia.

- [ ] **Step 3: Que compile**

```bash
npx tsc --noEmit
```

Esperado: el único error de base.

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/Trafico/servicioComisariato/ServicioComisariatoForm.tsx resources/js/pages/Trafico/ServicioComisariato.tsx
git commit -m "feat(comisariato): las evidencias se toman desde el formulario y desde la tabla"
```

---

### Task 5: Las fotos en el PDF

**Files:**
- Modify: `resources/js/pages/Trafico/servicioComisariato/PdfComisariato.tsx`

**Interfaces:**
- Consumes: `data.evidencias` del `show` (Tarea 1).
- Produces: el documento con la rejilla; `VistaPreviaComisariato` lo hereda sin tocarlo.

- [ ] **Step 1: Convertir las fotos antes de pintarlas**

`PdfComisariato.tsx` ya tiene `urlToDataUrl` **que hoy no llama nadie**. Las fotos la necesitan: `@react-pdf/renderer` se atraganta con imágenes remotas.

`ComisariatoPdfDoc` pasa a recibir las evidencias ya convertidas, y quien lo monta las prepara antes:

```tsx
const evidenciasEnDataUrl = async (data: any): Promise<string[]> => {
    const evidencias: Array<{ url: string }> = data?.evidencias ?? [];

    const convertidas = await Promise.all(
        evidencias.map(evidencia =>
            urlToDataUrl(evidencia.url).catch(() => null)
        )
    );

    // Una foto cuyo archivo ya no está se omite en vez de romper el PDF
    // entero: el mismo criterio que usan las firmas en Seguridad.
    return convertidas.filter((foto): foto is string => foto !== null);
};
```

En paralelo con `Promise.all` y no en serie: veinte peticiones encadenadas se notan.

- [ ] **Step 2: La rejilla**

En los estilos, dos entradas nuevas:

```tsx
    evidenciasGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
    evidenciaFoto: { width: "48%", height: 150, objectFit: "cover", borderWidth: 1, borderColor: BORDER },
```

Y, después del bloque de firmas, la sección — que **no se pinta** si no hay fotos:

```tsx
                {fotos.length > 0 && (
                    <View break>
                        <Text style={styles.sectionTitle}>Evidencias fotográficas</Text>
                        <View style={styles.evidenciasGrid}>
                            {fotos.map((foto, indice) => (
                                <Image key={indice} src={foto} style={styles.evidenciaFoto} />
                            ))}
                        </View>
                    </View>
                )}
```

El `break` manda las evidencias a su propia página y deja el recibo entero en la primera. La rejilla fluye sola a las siguientes si no caben.

- [ ] **Step 3: Que compile**

```bash
npx tsc --noEmit
```

Esperado: el único error de base.

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/Trafico/servicioComisariato/PdfComisariato.tsx
git commit -m "feat(comisariato): el pdf imprime las evidencias en rejilla"
```

---

### Task 6: Verificación en el navegador

Lo que las pruebas no pueden demostrar: que la cámara del aparato se abre, que la compresión produce un archivo sensato y que las fotos salen en el PDF.

**Files:** ninguno. Es verificación.

- [ ] **Step 1: La suite completa, en serie**

```bash
php artisan test
```

Esperado: verde. **Leer `${PIPESTATUS[0]}` si se canaliza la salida.**

- [ ] **Step 2: El build**

```bash
npm run build
```

Esperado: salida 0. Lo corre el controlador, no un subagente.

- [ ] **Step 3: Preparar el navegador**

`public/hot` contiene `http://192.168.7.10:5173` y hay que apartarlo, **y volverlo a poner al terminar**. El preview lee el `launch.json` del padre (`EOLO/.claude/launch.json`) y tiene que servir el puerto **3000** —fuera de 3000 Sanctum devuelve 401—, y se deja en **8000** al acabar. Entrar como `Administrador EOLO` / `admin123`.

- [ ] **Step 4: Qué mirar**

1. En la tabla, el botón de cámara nuevo entre la vista previa y el PDF.
2. Abrirlo en un servicio: el modal sale sin fotos y con su mensaje.
3. Subir una evidencia. En `localhost` la cámara en vivo **sí** funciona (es contexto seguro), así que ahí se prueba esa rama; la del aparato solo se puede probar en un tablet real.
4. Que la miniatura aparezca y que la X la quite.
5. Que el PDF del servicio traiga la sección «Evidencias fotográficas» con la foto, y que un servicio sin fotos **no** la traiga.
6. Que la vista previa enseñe lo mismo.
7. Consola y red sin errores.

- [ ] **Step 5: Medir lo que la compresión produjo**

```bash
php artisan tinker --execute="foreach (\App\Models\Imagen::latest('id')->take(3)->get() as \$i) { echo \$i->path.' '.round(\$i->size/1024).' KB'.PHP_EOL; }"
```

Esperado: del orden de 100-300 KB por foto. Si sale en megas, la compresión no corrió y hay que averiguar por qué antes de dar nada por bueno.

- [ ] **Step 6: Restaurar y enseñar la evidencia**

Devolver `public/hot` y el `launch.json` a como estaban, detener el preview, y enseñar una captura de la tabla con el botón, otra del modal con la foto, y el tamaño que dio el paso 5.

- [ ] **Step 7: Cerrar la rama**

Con todo verde, usar la skill `superpowers:finishing-a-development-branch`. **La fusión y el borrado de la rama los decide el usuario**, y un `push` es hacia fuera: se pregunta antes. Recordar que esta rama lleva además el trabajo de Entrega de Turno de Seguridad v3, así que fusionarla fusiona las dos cosas.
