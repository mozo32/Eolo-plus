# Exención de las ventanas de fecha para FBO y admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los usuarios con rol `fbo` o `admin` puedan escribir cualquier fecha —pasada o futura— en los formularios, mientras el resto sigue sujeto a la ventana.

**Architecture:** La excepción se mete dentro de `VentanasDeFecha::para()`, que es la fuente que ya comparten la regla del servidor y la prop de Inertia que alimenta el calendario. Así los dos no pueden discrepar, y ni el hook ni las dieciocho pantallas que lo usan se tocan. El grueso del trabajo son las pruebas: las 162 que vigilan la ventana corren hoy como administrador, que es justo quien va a quedar exento.

**Tech Stack:** Laravel 12, Inertia 2, React 19, Pest 3, sqlite `:memory:` en las pruebas.

**Spec:** `docs/superpowers/specs/2026-11-18-ventanas-de-fecha-exencion-design.md`

## Global Constraints

- Las pruebas corren **en serie**: `php artisan test`. **Nunca `--parallel`**.
- `php artisan test 2>&1 | tail` devuelve el código de salida de `tail` y **esconde los fallos**: leer `${PIPESTATUS[0]}`.
- **No correr `vendor/bin/pint`, `prettier`, `npm run lint` ni `npm run format`.**
- **Los subagentes no corren `npm run build`**; lo corre el controlador.
- **No usar `git stash`** ni `git add -A` / `git add .`. Se añade por ruta. `CLAUDE.md`, `boost.json`, `.claude/` y `.env.respaldo-antes-de-fact-fbo-prod` siguen sin seguimiento.
- **`eolo_plus` es la base real del usuario.** **No hay migración en este plan**: los roles y la tabla pivote ya existen. Nadie corre `migrate`, `db:seed`, `migrate:fresh`, `migrate:refresh` ni `db:wipe`.
- **Antes de cada commit, verificar la rama**: `git rev-parse --abbrev-ref HEAD` debe decir `entrega-turno-seguridad`. En este plan ya ocurrió una vez que cuatro commits aterrizaran en `main` por no comprobarlo.
- Sin factories salvo `UserFactory`; las filas con `Modelo::create([...])`.
- Nada bajo `resources/js/routes/` ni `resources/js/actions/`; no se corre `wayfinder:generate`.
- **No se toca `resources/js/lib/ventanasDeFecha.ts` ni ninguna de las dieciocho pantallas que lo usan.** Si algo parece exigirlo, parar y reportarlo.
- Los archivos de código se quedan por debajo de 300 líneas (las pruebas están exentas).
- No hay runner de pruebas de JavaScript; la evidencia del front es `npx tsc --noEmit` con **exactamente un** error de base (`TS1117` en `resources/js/actions/.../WalkAroundController.ts:905`) y `npm run build` con salida 0.

---

### Task 1: Las pruebas de ventana dejan de correr como administrador

Va **primero**, antes de que exista la exención, y eso es deliberado: hoy estas pruebas pasan con cualquier usuario, así que si la suite sigue verde tras el cambio queda **demostrado** que nunca necesitaron el rol de administrador. Esa es la suposición sobre la que descansa el resto del plan, y así se comprueba en vez de darse por buena.

**Files:**
- Modify: `tests/Pest.php` (añadir `usuarioEmpleado()`)
- Modify: `tests/Feature/VentanasDeFechaEndpointsTest.php` (160 apariciones)

**Interfaces:**
- Produces: `usuarioEmpleado(): App\Models\User`, un usuario con rol `empleado`, que la Tarea 4 también usa.

- [ ] **Step 1: El ayudante**

En `tests/Pest.php`, justo después de `usuarioAdmin()`, siguiendo su misma forma:

```php
/**
 * Usuario con rol `empleado`: NO está exento de las ventanas de fecha.
 *
 * Lo usan las pruebas que existen para demostrar que la ventana muerde. Su
 * sujeto tiene que ser alguien a quien muerda, y `usuarioAdmin()` dejó de
 * serlo cuando `fbo` y `admin` quedaron exentos.
 */
function usuarioEmpleado(): App\Models\User
{
    $usuario = App\Models\User::factory()->create();
    $rol = App\Models\Role::firstOrCreate(
        ['slug' => 'empleado'],
        ['nombre' => 'Empleado']
    );
    $usuario->roles()->attach($rol->id);

    return $usuario;
}
```

- [ ] **Step 2: Cambiar las 160 apariciones**

En `tests/Feature/VentanasDeFechaEndpointsTest.php`, sustituir **todas** las apariciones de `usuarioAdmin()` por `usuarioEmpleado()`. Son 160: 159 como `actingAs(usuarioAdmin(), 'sanctum')` y una como `actingAs($usuario = usuarioAdmin(), 'sanctum')`.

**No se toca ningún otro archivo de prueba.** Está comprobado que ninguno más afirma un error de validación sobre un campo de fecha corriendo como administrador; los otros quince que usan `usuarioAdmin()` lo hacen por otras razones y siguen igual.

Actualizar también el comentario de cabecera del archivo si menciona al administrador, para que explique por qué su sujeto es un empleado.

- [ ] **Step 3: Correr el archivo y verlo verde**

```bash
php artisan test tests/Feature/VentanasDeFechaEndpointsTest.php
```

Esperado: **PASA, las 162**. Si alguna falla con 403, es que ese endpoint sí exige rol y la spec se equivocó al decir que ninguno lo hace: **parar y reportarlo** en vez de devolverle el administrador, porque entonces esa prueba estaría tapando otra cosa.

- [ ] **Step 4: Correr la suite entera**

```bash
php artisan test
```

Esperado: verde. Es la prueba de que el cambio de sujeto no arrastró nada.

- [ ] **Step 5: Commit**

```bash
git add tests/Pest.php tests/Feature/VentanasDeFechaEndpointsTest.php
git commit -m "test(ventanas): las pruebas de ventana corren como empleado, no como admin"
```

---

### Task 2: El predicado y la ventana por usuario

**Files:**
- Modify: `app/Support/VentanasDeFecha.php`
- Modify: `tests/Feature/VentanasDeFechaTest.php` (pruebas nuevas al final)

**Interfaces:**
- Produces, para las Tareas 3 y 4:
  - `VentanasDeFecha::exentoDeVentana(?User $usuario): bool`
  - `VentanasDeFecha::para(string $clave, ?User $usuario = null): array{min: ?string, max: ?string}`
  - `VentanasDeFecha::todas(?User $usuario = null): array<string, array{min: ?string, max: ?string}>`

- [ ] **Step 1: Escribir las pruebas, que todavía fallan**

Al final de `tests/Feature/VentanasDeFechaTest.php`:

```php
test('fbo y admin quedan exentos de la ventana', function (string $slug) {
    $usuario = User::factory()->create();
    $rol = Role::firstOrCreate(['slug' => $slug], ['nombre' => ucfirst($slug)]);
    $usuario->roles()->attach($rol->id);

    expect(VentanasDeFecha::exentoDeVentana($usuario))->toBeTrue();
})->with(['fbo', 'admin']);

test('los demas roles siguen sujetos a la ventana', function (string $slug) {
    $usuario = User::factory()->create();
    $rol = Role::firstOrCreate(['slug' => $slug], ['nombre' => ucfirst($slug)]);
    $usuario->roles()->attach($rol->id);

    expect(VentanasDeFecha::exentoDeVentana($usuario))->toBeFalse();
})->with(['empleado', 'jefe_area', 'admin2', 'fac']);

test('sin usuario no hay exencion', function () {
    // Falla cerrada: la única forma segura de equivocarse.
    expect(VentanasDeFecha::exentoDeVentana(null))->toBeFalse();
});

test('un usuario sin ningun rol no esta exento', function () {
    expect(VentanasDeFecha::exentoDeVentana(User::factory()->create()))->toBeFalse();
});

test('para un exento la ventana no tiene limites', function () {
    $usuario = User::factory()->create();
    $rol = Role::firstOrCreate(['slug' => 'fbo'], ['nombre' => 'FBO']);
    $usuario->roles()->attach($rol->id);

    expect(VentanasDeFecha::para('csae.entrada', $usuario))
        ->toBe(['min' => null, 'max' => null]);
});

test('para quien no esta exento la ventana sigue igual que sin usuario', function () {
    $usuario = User::factory()->create();

    expect(VentanasDeFecha::para('csae.entrada', $usuario))
        ->toBe(VentanasDeFecha::para('csae.entrada'));
});

test('una clave desconocida sigue lanzando aunque el usuario este exento', function () {
    // Que alguien sea administrador no convierte un error de programación en
    // silencio: la clave mal escrita tiene que doler igual.
    $usuario = User::factory()->create();
    $rol = Role::firstOrCreate(['slug' => 'admin'], ['nombre' => 'Administrador']);
    $usuario->roles()->attach($rol->id);

    expect(fn () => VentanasDeFecha::para('clave.que.no.existe', $usuario))
        ->toThrow(InvalidArgumentException::class);
});

test('todas devuelve las dieciocho claves sin limites para un exento', function () {
    $usuario = User::factory()->create();
    $rol = Role::firstOrCreate(['slug' => 'admin'], ['nombre' => 'Administrador']);
    $usuario->roles()->attach($rol->id);

    $ventanas = VentanasDeFecha::todas($usuario);

    expect($ventanas)->toHaveCount(count(VentanasDeFecha::todas()));

    foreach ($ventanas as $clave => $ventana) {
        expect($ventana)->toBe(['min' => null, 'max' => null], "la clave {$clave}");
    }
});

test('todas conserva los limites para quien no esta exento', function () {
    $ventanas = VentanasDeFecha::todas(User::factory()->create());

    expect($ventanas['csae.entrada']['max'])->not->toBeNull();
});
```

Añadir al principio del archivo los `use` que falten: `App\Models\Role`, `App\Models\User`, `InvalidArgumentException`.

- [ ] **Step 2: Correr y ver el rojo**

```bash
php artisan test tests/Feature/VentanasDeFechaTest.php
```

Esperado: FALLA. `exentoDeVentana` no existe, y `para()` no acepta un segundo argumento.

- [ ] **Step 3: El predicado y el parámetro**

En `app/Support/VentanasDeFecha.php`, añadir el `use App\Models\User;` y:

```php
    /**
     * Si este usuario puede escribir cualquier fecha, saltándose la ventana.
     *
     * Son `fbo` y `admin`: quienes corrigen registros viejos. `jefe_area` y
     * `admin2` NO están, aunque el segundo se llame «Administrativo» y se
     * confunda con el primero a simple vista.
     *
     * Sin usuario responde que no. Falla cerrada a propósito: la única forma
     * segura de equivocarse con un permiso es negándolo.
     */
    public static function exentoDeVentana(?User $usuario): bool
    {
        return $usuario !== null && $usuario->hasAnyRole(['fbo', 'admin']);
    }
```

Y `para()` pasa a:

```php
    public static function para(string $clave, ?User $usuario = null): array
    {
        // Lanza en vez de asumir: un valor por omisión silencioso dejaría un formulario sin
        // restricción, o restringido de más, y nadie lo sabría hasta que alguien no pudiera
        // trabajar.
        if (! array_key_exists($clave, self::CLAVES)) {
            throw new InvalidArgumentException("Ventana de fecha desconocida: '{$clave}'.");
        }

        /*
         * La exención va DESPUÉS de comprobar la clave: que quien pregunta sea
         * administrador no debe convertir una clave mal escrita en un formulario
         * sin límites.
         */
        if (self::exentoDeVentana($usuario)) {
            return ['min' => null, 'max' => null];
        }

        ['atras' => $atras, 'futuro' => $futuro] = self::CLAVES[$clave];
        $hoy = Carbon::today();

        return [
            'min' => $atras === null ? null : $hoy->copy()->subDays($atras)->toDateString(),
            'max' => $futuro ? null : $hoy->toDateString(),
        ];
    }
```

Y `todas()`:

```php
    /** @return array<string, array{min: ?string, max: ?string}> */
    public static function todas(?User $usuario = null): array
    {
        $ventanas = [];

        foreach (array_keys(self::CLAVES) as $clave) {
            $ventanas[$clave] = self::para($clave, $usuario);
        }

        return $ventanas;
    }
```

El parámetro va al final y es opcional, así que las llamadas que no lo pasan se comportan exactamente igual que hoy.

- [ ] **Step 4: Correr y ver verde**

```bash
php artisan test tests/Feature/VentanasDeFechaTest.php
```

Esperado: PASA.

- [ ] **Step 5: La suite entera sigue verde**

```bash
php artisan test
```

Esperado: verde. Nadie consume todavía el parámetro nuevo, así que nada debe moverse.

- [ ] **Step 6: Commit**

```bash
git add app/Support/VentanasDeFecha.php tests/Feature/VentanasDeFechaTest.php
git commit -m "feat(ventanas): la ventana de fecha sabe a quien se le aplica"
```

---

### Task 3: Los dos consumidores

**Files:**
- Modify: `app/Rules/DentroDeLaVentana.php`
- Modify: `app/Http/Middleware/HandleInertiaRequests.php`

**Interfaces:**
- Consumes: `VentanasDeFecha::para($clave, $usuario)` y `::todas($usuario)` de la Tarea 2.
- Produces: el comportamiento que la Tarea 4 prueba de punta a punta.

- [ ] **Step 1: La regla**

En `app/Rules/DentroDeLaVentana.php`, la línea que pide la ventana pasa a llevar el usuario:

```php
        ['min' => $min, 'max' => $max] = VentanasDeFecha::para($this->clave, auth()->user());
```

Con un exento, `$min` y `$max` llegan en `null` y las dos comparaciones del final se saltan solas: la regla no falla. No hace falta ningún `return` temprano, y añadirlo sería una segunda forma de decir lo mismo.

Añadir al docblock de la clase, después del párrafo que ya explica que el calendario guía y la regla decide:

```
 * Desde que `fbo` y `admin` quedaron exentos, esta regla DEPENDE de quién manda la
 * petición: pide la ventana del usuario autenticado. Deja de ser pura a propósito, y
 * conviene saberlo: su trabajo es validar UNA PETICIÓN, y quién la firma es parte de
 * la petición. Sin usuario —una consola, un job— no hay exención y la ventana se
 * aplica entera.
```

- [ ] **Step 2: El middleware**

En `app/Http/Middleware/HandleInertiaRequests.php`, la línea 43 pasa a:

```php
            'ventanasDeFecha' => VentanasDeFecha::todas($user),
```

`$user` ya está en el alcance, porque la clave `auth.user` de arriba lo usa. No hay que resolverlo otra vez.

- [ ] **Step 3: Correr la suite entera**

```bash
php artisan test
```

Esperado: **verde**. Aquí es donde el orden del plan se paga: las 162 pruebas de ventana ya corren como `empleado`, así que la regla las sigue mordiendo. Si alguna falla ahora, es una prueba que dependía de que el administrador estuviera sujeto a la ventana y que el escaneo previo no encontró: **reportarla**, no silenciarla.

- [ ] **Step 4: Que el front siga compilando**

```bash
npx tsc --noEmit
```

Esperado: exactamente el error de base `TS1117`. No se ha tocado nada de `resources/js`, así que cualquier otra cosa es una sorpresa que hay que entender antes de seguir.

- [ ] **Step 5: Commit**

```bash
git add app/Rules/DentroDeLaVentana.php app/Http/Middleware/HandleInertiaRequests.php
git commit -m "feat(ventanas): fbo y admin escriben cualquier fecha"
```

---

### Task 4: Las pruebas de la exención de punta a punta

Las de la Tarea 2 prueban el predicado. Éstas prueban que la exención **llega** hasta donde importa: un endpoint real y la prop que alimenta el calendario.

**Files:**
- Create: `tests/Feature/VentanasDeFecha/ExencionPorRolTest.php`

**Interfaces:**
- Consumes: `usuarioEmpleado()` (Tarea 1) y todo lo anterior.

- [ ] **Step 1: Escribir el archivo**

El endpoint es `POST /api/ControlMedicamento`, del que `VentanasDeFechaEndpointsTest.php` ya tiene pruebas de ventana (clave `medicamento.movimiento`, que no admite futuro y retrocede tres días).

**Los ayudantes de un archivo Pest son funciones globales de PHP**, así que repetir el nombre `cargaDeControlMedicamento` daría un error fatal de redeclaración en cuanto los dos archivos se carguen. El de aquí se llama distinto.

```php
<?php

use App\Models\ControlMedicamento;
use App\Models\Role;
use App\Models\User;
use App\Support\VentanasDeFecha;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * La exención de `fbo` y `admin` probada donde importa: un endpoint real y la
 * prop que alimenta el calendario. Las pruebas de `VentanasDeFechaTest` cubren
 * el predicado; éstas cubren que llega.
 *
 * El nombre del ayudante NO es el de `VentanasDeFechaEndpointsTest`: los
 * ayudantes de Pest son funciones globales y repetirlo sería un fatal.
 */

function usuarioConRol(string $slug): User
{
    $usuario = User::factory()->create();
    $rol = Role::firstOrCreate(['slug' => $slug], ['nombre' => ucfirst($slug)]);
    $usuario->roles()->attach($rol->id);

    return $usuario;
}

/** @return array<string, mixed> */
function cargaDeMedicamentoParaExencion(string $fecha): array
{
    return [
        'responsable' => 'Responsable Uno',
        'fecha' => $fecha,
        'dia' => 'Lunes',
        'aparatos' => ['Baumanometro'],
        'firma' => 'sin-firma',
        'medicamentos' => ['Paracetamol' => ['inicio' => 5, 'final' => 3]],
    ];
}

test('un exento guarda una fecha de hace un mes', function (string $slug) {
    $this->actingAs(usuarioConRol($slug), 'sanctum');
    $antes = ControlMedicamento::count();

    $this->postJson(
        '/api/ControlMedicamento',
        cargaDeMedicamentoParaExencion(Carbon::today()->subMonth()->toDateString()),
    )->assertSuccessful();

    expect(ControlMedicamento::count())->toBe($antes + 1);
})->with(['fbo', 'admin']);

test('un exento guarda una fecha futura aunque la clave no admita futuro', function () {
    $this->actingAs(usuarioConRol('fbo'), 'sanctum');

    $this->postJson(
        '/api/ControlMedicamento',
        cargaDeMedicamentoParaExencion(Carbon::today()->addDays(5)->toDateString()),
    )->assertSuccessful();
});

test('quien no esta exento sigue recibiendo 422 con la MISMA fecha', function (string $slug) {
    /*
     * El par con la prueba de arriba es lo que la hace honesta: misma fecha,
     * mismo endpoint. Sin él, un 200 del exento podría venir de que la fecha
     * estaba dentro de la ventana y nadie se enteraría.
     */
    $this->actingAs(usuarioConRol($slug), 'sanctum');
    $antes = ControlMedicamento::count();

    $this->postJson(
        '/api/ControlMedicamento',
        cargaDeMedicamentoParaExencion(Carbon::today()->subMonth()->toDateString()),
    )->assertUnprocessable()->assertJsonValidationErrors('fecha');

    expect(ControlMedicamento::count())->toBe($antes);
})->with(['empleado', 'jefe_area']);

test('la prop de inertia llega sin limites para un exento', function () {
    /*
     * Las claves llevan PUNTOS literales, así que no se leen con
     * `->where('ventanasDeFecha.csae.entrada')`: hay que sacar el arreglo y
     * comprobarlo en PHP. Lo avisa el docblock de VentanasDeFecha.
     */
    $this->actingAs(usuarioConRol('admin'));

    $this->get('/dashboard')->assertInertia(function (Assert $page) {
        $ventanas = $page->toArray()['props']['ventanasDeFecha'];

        expect($ventanas['csae.entrada'])->toBe(['min' => null, 'max' => null]);
    });
});

test('la prop de inertia conserva los limites para quien no esta exento', function () {
    $this->actingAs(usuarioConRol('empleado'));

    $this->get('/dashboard')->assertInertia(function (Assert $page) {
        $ventanas = $page->toArray()['props']['ventanasDeFecha'];

        expect($ventanas['csae.entrada'])->toBe(VentanasDeFecha::para('csae.entrada'));
    });
});
```

Si `/dashboard` no resulta ser una ruta Inertia accesible para estos usuarios, usar la que `MenuDelModuloTest` u otra prueba de pantalla ya use, y decirlo en el informe.

- [ ] **Step 2: Correr y ver verde**

```bash
php artisan test tests/Feature/VentanasDeFecha/ExencionPorRolTest.php
```

Esperado: PASA. El código ya está, así que estas pruebas nacen verdes; su valor es dejar la conducta clavada para quien venga después.

Si alguna falla, **no es que la prueba esté mal por definición**: puede que la exención no llegue de verdad al endpoint elegido. Averiguarlo antes de tocar la prueba.

- [ ] **Step 3: La suite entera**

```bash
php artisan test
```

Esperado: verde.

- [ ] **Step 4: Commit**

```bash
git add tests/Feature/VentanasDeFecha
git commit -m "test(ventanas): la exencion por rol llega al endpoint y al calendario"
```

---

### Task 5: Verificación

**Files:** ninguno.

- [ ] **Step 1: La suite completa, en serie**

```bash
php artisan test
```

Esperado: verde, con una omitida (la del acento, de otro módulo). **Leer `${PIPESTATUS[0]}` si se canaliza.**

- [ ] **Step 2: El build**

```bash
npm run build
```

Esperado: salida 0. Lo corre el controlador.

- [ ] **Step 3: El navegador**

`public/hot` contiene `http://192.168.7.10:5173` y hay que apartarlo **y volverlo a poner al terminar**. El preview lee el `launch.json` del padre (`EOLO/.claude/launch.json`) y tiene que servir el puerto **3000** —fuera de 3000 Sanctum devuelve 401—, dejándolo en **8000** al acabar. Se entra como `Administrador EOLO` / `admin123`, que **es un usuario exento**, lo cual viene bien para esta comprobación.

Qué mirar, sin escribir nada en la base:

1. En cualquier formulario con fecha, que el `<input type="date">` **no traiga `min` ni `max`**. Se lee con `document.querySelector('input[type=date]').min` en la consola del panel: debe venir vacío.
2. Que la prop de Inertia llegue sin límites: `JSON.parse(document.getElementById('app').dataset.page).props.ventanasDeFecha['csae.entrada']` debe dar `{min: null, max: null}`.
3. Consola y red sin errores nuevos.

**No hace falta guardar nada**: que el calendario quede libre y la prop llegue vacía es exactamente lo que esta tarea añade, y las pruebas ya cubren que el servidor acepta la fecha.

- [ ] **Step 4: Restaurar y enseñar la evidencia**

Devolver `public/hot` y el `launch.json`, detener el preview, y enseñar el valor de los dos `min`/`max` leídos.

- [ ] **Step 5: Cerrar**

Con todo verde, usar la skill `superpowers:finishing-a-development-branch`. **La fusión, el borrado y cualquier `push` los decide el usuario.** Recordar que esta rama lleva además Entrega de Turno de Seguridad v3, las evidencias de Comisariato, el Excel multi-mes de Estacionamiento y el arreglo de CSAE: fusionarla fusiona todo eso.
