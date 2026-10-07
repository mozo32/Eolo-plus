# Ventanas de fecha: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que la fecha de un registro no pueda ser futura y que hacia atrás solo retroceda lo que cada formulario permite, con la regla declarada en un solo sitio y hecha cumplir por el servidor.

**Architecture:** una clase con la tabla de ventanas; una regla de validación que la lee; y las ventanas ya calculadas publicadas al navegador por Inertia, que cada input consume como `min`/`max`. No se sustituye ningún input: solo se le añaden dos atributos.

**Tech Stack:** Laravel 12, Pest 3, Inertia 2 + React 19 + TypeScript, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-10-07-ventanas-de-fecha-design.md`

## Global Constraints

- **`atras` se cuenta inclusive y en días de calendario.** `atras => 1` significa mínimo = hoy − 1 día, es decir **hoy y ayer, dos días**. `atras => 3` da **cuatro** días. El máximo es **hoy**, salvo `futuro => true`, que no pone máximo. `atras => null` no pone mínimo.
- **Una clave desconocida LANZA.** Nunca un valor por omisión silencioso.
- **La regla SIEMPRE va acompañada de `date`, y el `required` que ya hubiera se conserva.** Las tres
  juntas: `['required', 'date', new DentroDeLaVentana('clave')]`. Medido en la Task 2 y no deducido:
  como toda regla no implícita de Laravel, `DentroDeLaVentana` **no corre con un valor vacío** —`''`,
  `null`, `'   '` y el campo ausente pasan—, así que quitar el `required` dejaría el campo opcional
  sin que nada falle. Y **sin `date` delante** deja pasar lo que no sea una fecha: con `fecha[]=…`,
  `Carbon::parse` de un arreglo lanza, el `rescue` se lo traga y la validación pasa.
- **Los filtros de búsqueda y reportes NO se tocan.** Son 60 de los 81 calendarios. La lista de los 12 verificados uno a uno está en la §6 de la especificación.
- **No se sustituye ningún input por un componente nuevo.** Solo se añaden `min` y `max`.
- Zona horaria: se usa la del servidor (`config('app.timezone')`), la misma que ya usan los modelos. No se introduce otra fuente de «hoy».
- La suite corre **en serie**: `php artisan test`. `--parallel` da fallos falsos en esta máquina.
- `npx tsc --noEmit`: el único error aceptable es el preexistente `resources/js/actions/App/Http/Controllers/Api/WalkAroundController.ts(905,5)`.
- `vendor/bin/pint --dirty` antes de cada commit; revertir lo que toque fuera del cambio.
- **No correr `prettier`** sobre ficheros con infracciones previas: revisar el diff y revertir lo ajeno.
- Rama: `ventanas-de-fecha`. Nada se fusiona a `main` hasta que esté probado.

## Estructura de ficheros

| Fichero | Responsabilidad |
|---|---|
| `app/Support/VentanasDeFecha.php` | la tabla de ventanas y su traducción a `min`/`max` |
| `app/Rules/DentroDeLaVentana.php` | la regla de validación que la lee |
| `app/Http/Middleware/HandleInertiaRequests.php` | **modificar**: publicar las ventanas calculadas |
| `resources/js/lib/ventanasDeFecha.ts` | leer la ventana de una clave desde las props |
| `resources/js/pages/DateTimeInput.tsx` | **modificar**: aceptar y reenviar `min`/`max` |
| 20 pantallas | **modificar**: dos atributos por input |
| `app/Http/Controllers/Api/*Controller.php` | **modificar**: la regla en cada validación |
| `tests/Feature/VentanasDeFechaTest.php` | la política y la regla |
| `tests/Feature/VentanasDeFechaEndpointsTest.php` | que los endpoints rechazan de verdad |

## Las claves

Una por formulario. `turno.checklist` la comparten el formulario y su sección, porque son la
misma captura.

| Clave | atras | futuro | Pantalla |
|---|---|---|---|
| `turno.checklist` | 1 | no | `Trafico/checkListTurno/CheckListTurnoForm` y `sections/HotTrasComiCoor` |
| `turno.entrega_rampa` | 1 | no | `Rampa/entregaTurnoR/RampaForm` |
| `autotanque.turno_inicio` | 1 | no | `Rampa/Autotanque/SeccionInicio` |
| `autotanque.turno_cierre` | 1 | no | `Rampa/Autotanque/SeccionCierre` |
| `chalecos.prestamo` | 1 | no | `Trafico/prestamoChalecos/PrestamoChalecoForm` |
| `planta.prestamo` | 1 | no | `Rampa/relacionPlanta/PrestamoModal` |
| `estacionamiento.ronda` | 1 | no | `seguridad/estacionamientoSubTerraneo/RoundRegisterForm` |
| `operaciones.llegada` | 3 | no | `Trafico/operacionesDiarias/FormLlegada` |
| `operaciones.salida` | 3 | no | `Trafico/operacionesDiarias/FormSalida` |
| `operaciones.registro` | 3 | no | `Trafico/operacionesDiarias/OperacionesDiariasForm` |
| `despacho.walk_around` | 3 | no | `despacho/components/walkAround/WalkAroundForm` |
| `despacho.informacion_general` | 3 | no | `despacho/componentes2/steps/GeneralInfo` |
| `autotanque.servicio` | 3 | no | `Rampa/Autotanque/EoloForm` |
| `comisariato.entrega` | 3 | no | `Trafico/servicioComisariato/ServicioComisariatoForm` |
| `csae.entrada` | 3 | no | `seguridad/MovimientoAvionesCSAE/MovimientoCSAEEntrada` |
| `csae.salida` | 3 | no | `seguridad/MovimientoAvionesCSAE/MovimientoCSAESalida` |
| `pernocta.dia` | 3 | no | `seguridad/pernoctaDia/PernoctaDiaForm` |
| `medicamento.movimiento` | 3 | no | `Trafico/controlMedicamento/ControlMedicamentoForm` |
| `programadas.operacion` | null | **sí** | `despacho/operacionesProgramadas/OperacionProgramadaModal` |

---

### Task 1: la política

**Files:**
- Create: `app/Support/VentanasDeFecha.php`
- Test: `tests/Feature/VentanasDeFechaTest.php`

**Interfaces:**
- Produces: `VentanasDeFecha::CLAVES` (array), `VentanasDeFecha::para(string $clave): array{min: ?string, max: ?string}` con fechas `Y-m-d`, y `VentanasDeFecha::todas(): array<string, array{min: ?string, max: ?string}>`.
- Lanza `InvalidArgumentException` con una clave desconocida.

- [ ] **Step 1: la prueba que falla**

```php
<?php

use App\Support\VentanasDeFecha;
use Illuminate\Support\Carbon;

test('una ventana de un dia atras da hoy y ayer', function () {
    Carbon::setTestNow('2026-10-07 15:00:00');

    expect(VentanasDeFecha::para('turno.checklist'))
        ->toBe(['min' => '2026-10-06', 'max' => '2026-10-07']);
});

test('una ventana de tres dias atras da cuatro dias, contando hoy', function () {
    Carbon::setTestNow('2026-10-07 15:00:00');

    expect(VentanasDeFecha::para('operaciones.llegada'))
        ->toBe(['min' => '2026-10-04', 'max' => '2026-10-07']);
});

test('la excepcion de Operaciones Programadas no pone techo ni suelo', function () {
    Carbon::setTestNow('2026-10-07 15:00:00');

    expect(VentanasDeFecha::para('programadas.operacion'))
        ->toBe(['min' => null, 'max' => null]);
});

test('UNA CLAVE DESCONOCIDA LANZA, no devuelve un valor por omision', function () {
    // Es la red de todo lo demas: con un valor por omision silencioso, un formulario
    // quedaria sin restriccion —o restringido de mas— y nadie se enteraria.
    expect(fn () => VentanasDeFecha::para('turno.checklis'))
        ->toThrow(InvalidArgumentException::class);
});

test('SOLO Operaciones Programadas admite futuro; se recorre la tabla entera', function () {
    // Asi, un formulario nuevo mal declarado sale en rojo en vez de colarse.
    Carbon::setTestNow('2026-10-07 15:00:00');

    foreach (array_keys(VentanasDeFecha::CLAVES) as $clave) {
        $max = VentanasDeFecha::para($clave)['max'];

        if ($clave === 'programadas.operacion') {
            expect($max)->toBeNull("la excepcion {$clave} deberia admitir futuro");

            continue;
        }

        expect($max)->toBe('2026-10-07', "la clave {$clave} NO deberia admitir futuro");
    }
});

test('todas() devuelve una entrada por clave', function () {
    expect(array_keys(VentanasDeFecha::todas()))
        ->toBe(array_keys(VentanasDeFecha::CLAVES));
});
```

- [ ] **Step 2: correr y ver que falla**

Run: `php artisan test tests/Feature/VentanasDeFechaTest.php`
Expected: FAIL con `Class "App\Support\VentanasDeFecha" not found`.

- [ ] **Step 3: la clase**

```php
<?php

namespace App\Support;

use Illuminate\Support\Carbon;
use InvalidArgumentException;

/**
 * Qué fechas puede elegir cada formulario, en UN solo sitio.
 *
 * La leen la regla de validación del servidor (`App\Rules\DentroDeLaVentana`) y las props
 * que `HandleInertiaRequests` publica al navegador. Si cada capa tuviera su copia podrían
 * divergir, y entonces el calendario ofrecería una fecha que el servidor rechaza.
 *
 * Es código y no configuración en base de datos a propósito: cambiar una ventana es una
 * decisión sobre la integridad de los datos, y así queda con su diff y su revisión en vez
 * de aparecer como una fila editada que nadie recuerda.
 *
 * `atras` se cuenta INCLUSIVE y en días de calendario: `1` deja hoy y ayer —dos días—, y
 * `3` deja cuatro. `null` no pone mínimo. `futuro` solo es `true` en Operaciones
 * Programadas, que por naturaleza registra lo que todavía no ha pasado.
 */
final class VentanasDeFecha
{
    /** @var array<string, array{atras: ?int, futuro: bool}> */
    public const CLAVES = [
        // Se llenan en el momento: un día de margen para quien cierra a la mañana siguiente.
        'turno.checklist' => ['atras' => 1, 'futuro' => false],
        'turno.entrega_rampa' => ['atras' => 1, 'futuro' => false],
        'autotanque.turno_inicio' => ['atras' => 1, 'futuro' => false],
        'autotanque.turno_cierre' => ['atras' => 1, 'futuro' => false],
        'chalecos.prestamo' => ['atras' => 1, 'futuro' => false],
        'planta.prestamo' => ['atras' => 1, 'futuro' => false],
        'estacionamiento.ronda' => ['atras' => 1, 'futuro' => false],

        // Registran un hecho que pudo pasar antes: tres días cubren un fin de semana, así
        // que lo del viernes se captura el lunes.
        'operaciones.llegada' => ['atras' => 3, 'futuro' => false],
        'operaciones.salida' => ['atras' => 3, 'futuro' => false],
        'operaciones.registro' => ['atras' => 3, 'futuro' => false],
        'despacho.walk_around' => ['atras' => 3, 'futuro' => false],
        'despacho.informacion_general' => ['atras' => 3, 'futuro' => false],
        'autotanque.servicio' => ['atras' => 3, 'futuro' => false],
        'comisariato.entrega' => ['atras' => 3, 'futuro' => false],
        'csae.entrada' => ['atras' => 3, 'futuro' => false],
        'csae.salida' => ['atras' => 3, 'futuro' => false],
        'pernocta.dia' => ['atras' => 3, 'futuro' => false],
        'medicamento.movimiento' => ['atras' => 3, 'futuro' => false],

        // La excepción, NOMBRADA y no omitida: se programa lo que aún no ha ocurrido.
        'programadas.operacion' => ['atras' => null, 'futuro' => true],
    ];

    /**
     * @return array{min: ?string, max: ?string} fechas `Y-m-d`, o null donde no hay límite
     */
    public static function para(string $clave): array
    {
        // Lanza en vez de asumir: un valor por omisión silencioso dejaría un formulario sin
        // restricción, o restringido de más, y nadie lo sabría hasta que alguien no pudiera
        // trabajar.
        if (! array_key_exists($clave, self::CLAVES)) {
            throw new InvalidArgumentException("Ventana de fecha desconocida: '{$clave}'.");
        }

        ['atras' => $atras, 'futuro' => $futuro] = self::CLAVES[$clave];
        $hoy = Carbon::today();

        return [
            'min' => $atras === null ? null : $hoy->copy()->subDays($atras)->toDateString(),
            'max' => $futuro ? null : $hoy->toDateString(),
        ];
    }

    /** @return array<string, array{min: ?string, max: ?string}> */
    public static function todas(): array
    {
        $ventanas = [];

        foreach (array_keys(self::CLAVES) as $clave) {
            $ventanas[$clave] = self::para($clave);
        }

        return $ventanas;
    }
}
```

- [ ] **Step 4: correr**

Run: `php artisan test tests/Feature/VentanasDeFechaTest.php`
Expected: PASS, 6 pruebas.

- [ ] **Step 5: commit**

```bash
vendor/bin/pint --dirty
git add app/Support/VentanasDeFecha.php tests/Feature/VentanasDeFechaTest.php
git commit -m "feat: la tabla de ventanas de fecha, en un solo sitio"
```

---

### Task 2: la regla de validación

**Files:**
- Create: `app/Rules/DentroDeLaVentana.php`
- Test: `tests/Feature/VentanasDeFechaTest.php` (se **añade** al final; no se tocan las de la Task 1)

**Interfaces:**
- Consumes: `VentanasDeFecha::para()`.
- Produces: `new DentroDeLaVentana(string $clave)`, usable en una validación en línea o en un Form Request.

- [ ] **Step 1: las pruebas que fallan**

```php
test('la regla acepta hoy y el borde, y rechaza un dia mas alla', function (string $fecha, bool $valida) {
    Carbon::setTestNow('2026-10-07 15:00:00');

    $validador = Validator::make(['fecha' => $fecha], [
        'fecha' => [new App\Rules\DentroDeLaVentana('operaciones.llegada')],
    ]);

    expect($validador->passes())->toBe($valida);
})->with([
    'hoy'                      => ['2026-10-07', true],
    'el borde de atras'        => ['2026-10-04', true],
    'un dia ANTES del borde'   => ['2026-10-03', false],
    'manana'                   => ['2026-10-08', false],
]);

test('el mensaje dice LAS DOS FECHAS, no «fecha invalida»', function () {
    Carbon::setTestNow('2026-10-07 15:00:00');

    $validador = Validator::make(['fecha' => '2026-10-01'], [
        'fecha' => [new App\Rules\DentroDeLaVentana('operaciones.llegada')],
    ]);

    expect($validador->errors()->first('fecha'))
        ->toContain('04/10/2026')
        ->toContain('07/10/2026');
});

test('la excepcion acepta una fecha futura', function () {
    Carbon::setTestNow('2026-10-07 15:00:00');

    $validador = Validator::make(['fecha' => '2026-12-25'], [
        'fecha' => [new App\Rules\DentroDeLaVentana('programadas.operacion')],
    ]);

    expect($validador->passes())->toBeTrue();
});
```

- [ ] **Step 2: correr y ver que falla**

Run: `php artisan test tests/Feature/VentanasDeFechaTest.php`
Expected: FAIL con `Class "App\Rules\DentroDeLaVentana" not found`.

- [ ] **Step 3: la regla**

```php
<?php

namespace App\Rules;

use App\Support\VentanasDeFecha;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Carbon;

/**
 * Hace cumplir la ventana de un formulario. El calendario del navegador GUÍA; esta regla
 * DECIDE: un `min`/`max` en un input se salta con las herramientas del navegador o con una
 * petición directa, así que sin esto la regla sería decoración.
 */
class DentroDeLaVentana implements ValidationRule
{
    public function __construct(private string $clave) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        ['min' => $min, 'max' => $max] = VentanasDeFecha::para($this->clave);

        $fecha = rescue(fn () => Carbon::parse($value)->toDateString(), null, false);

        // Una fecha ilegible no es cosa de esta regla: la atrapa `date`, que va antes.
        if ($fecha === null) {
            return;
        }

        if (($min !== null && $fecha < $min) || ($max !== null && $fecha > $max)) {
            $fail($this->mensaje($min, $max));
        }
    }

    /** El mensaje nombra las dos fechas: quien lo lea sabe qué hacer sin preguntar. */
    private function mensaje(?string $min, ?string $max): string
    {
        $bonita = fn (string $f) => Carbon::parse($f)->format('d/m/Y');

        if ($min !== null && $max !== null) {
            return "La fecha tiene que estar entre el {$bonita($min)} y el {$bonita($max)}.";
        }

        return $max !== null
            ? "La fecha no puede ser posterior al {$bonita($max)}."
            : "La fecha no puede ser anterior al {$bonita($min)}.";
    }
}
```

- [ ] **Step 4: correr y commitear**

Run: `php artisan test tests/Feature/VentanasDeFechaTest.php`
Expected: PASS.

```bash
vendor/bin/pint --dirty
git add app/Rules/DentroDeLaVentana.php tests/Feature/VentanasDeFechaTest.php
git commit -m "feat: la regla que hace cumplir la ventana en el servidor"
```

---

### Task 3: publicar las ventanas al navegador

**Files:**
- Modify: `app/Http/Middleware/HandleInertiaRequests.php`
- Create: `resources/js/lib/ventanasDeFecha.ts`
- Modify: `resources/js/pages/DateTimeInput.tsx`
- Test: `tests/Feature/VentanasDeFechaTest.php` (se añade)

**Interfaces:**
- Produces: la prop compartida `ventanasDeFecha`, y en TypeScript `useVentanaDeFecha(clave: string): { min?: string; max?: string }`.
- `DateTimeInput` acepta `min` y `max` opcionales y los reenvía a su `<input type="date">` interno.

- [ ] **Step 1: la prueba que falla**

```php
test('las ventanas viajan en las props de Inertia', function () {
    Carbon::setTestNow('2026-10-07 15:00:00');
    $this->actingAs(App\Models\User::factory()->create());

    // OJO: `->where('ventanasDeFecha.operaciones.llegada.min', …)` NO funciona. Las
    // claves llevan punto y viajan PLANAS, pero `where()` lee el punto como
    // anidamiento y busca una estructura que no existe. Verificado ejecutandolo:
    // falla con «Property [...] does not exist». Se lee el arreglo directamente.
    $this->get('/dashboard')->assertInertia(function (Assert $page) {
        $ventanas = $page->toArray()['props']['ventanasDeFecha'];

        expect($ventanas['operaciones.llegada'])->toBe(['min' => '2026-10-04', 'max' => '2026-10-07'])
            ->and($ventanas['programadas.operacion'])->toBe(['min' => null, 'max' => null]);
    });
});
```

**Comprobar antes** que `/dashboard` es una ruta Inertia accesible con un usuario recién creado; si no lo es, usar la que sí lo sea y decirlo en el informe.

- [ ] **Step 2: publicar la prop**

En `HandleInertiaRequests::share()`, junto a lo que ya publica:

```php
            'ventanasDeFecha' => VentanasDeFecha::todas(),
```

- [ ] **Step 3: el ayudante de TypeScript**

```ts
import { usePage } from '@inertiajs/react'

type Ventana = { min: string | null; max: string | null }

/**
 * La ventana de un formulario, para pasarla como `min`/`max` a un `<input type="date">`.
 *
 * El navegador GUÍA y el servidor DECIDE: si una pestaña lleva abierta desde anoche, su
 * ventana es la de ayer y el servidor rechazará la fecha con un mensaje que nombra las dos
 * fechas. No se recalcula aquí a propósito, porque el reloj del cliente puede estar mal.
 */
export function useVentanaDeFecha(clave: string): { min?: string; max?: string } {
    const ventanas = (usePage().props as { ventanasDeFecha?: Record<string, Ventana> })
        .ventanasDeFecha

    const ventana = ventanas?.[clave]

    return {
        min: ventana?.min ?? undefined,
        max: ventana?.max ?? undefined,
    }
}
```

- [ ] **Step 4: `DateTimeInput` reenvía min y max**

Añadir `min?: string` y `max?: string` a sus props y pasarlos al `<input type="date">` interno (el de la línea ~114, dentro del modal). **No cambiar nada más de ese componente.**

- [ ] **Step 5: correr y commitear**

Run: `php artisan test tests/Feature/VentanasDeFechaTest.php` y `npx tsc --noEmit`
Expected: PASS; `tsc` solo con el error preexistente.

```bash
vendor/bin/pint --dirty
git add app/Http/Middleware/HandleInertiaRequests.php resources/js/lib/ventanasDeFecha.ts resources/js/pages/DateTimeInput.tsx tests/Feature/VentanasDeFechaTest.php
git commit -m "feat: las ventanas de fecha llegan al navegador"
```

---

### El patrón compartido de las tareas 4 a 8

Las cinco tienen **la misma forma**, y por eso se describen juntas. Cada una toma un grupo de
pantallas de la tabla de claves y hace, por cada una:

1. **En la pantalla**, añadir los dos atributos al input de fecha —y **solo** a ese; los
   filtros del mismo fichero no se tocan:

```jsx
const { min, max } = useVentanaDeFecha('operaciones.llegada')
…
<input type="date" min={min} max={max} … />   // el resto del input, intacto
```

2. **En el controlador** que recibe esa fecha, añadir la regla a la validación que ya existe:

```php
'fecha' => ['required', 'date', new DentroDeLaVentana('operaciones.llegada')],
```

3. **Si el endpoint tiene EDICIÓN, valida solo cuando la fecha CAMBIA.** Varios `update` no
   validaban nada. Exigir la ventana siempre haría que corregir cualquier otro campo de un registro
   viejo diera 422. Sigue el patrón de `OperacionesDiariasController::validarFechaSiCambia()`, que
   ya está escrito y probado: valida si la fecha recibida difiere de la guardada, falta o es
   ilegible. **No inventes otra variante**: cuatro módulos con cuatro semánticas distintas sería
   peor que no tener regla.

4. **En la pantalla, pásale la fecha original al hook** cuando el formulario edite:
   `useVentanaDeFecha(clave, fechaOriginal)` devuelve la unión de la ventana con esa fecha, para que
   el navegador no bloquee guardar un registro viejo.

5. **Una prueba por endpoint** en `tests/Feature/VentanasDeFechaEndpointsTest.php`: una
   petición real con una fecha fuera de ventana devuelve **422**, el mensaje nombra las dos
   fechas, y **no se escribió nada** (contar las filas antes y después).

**Dónde está el endpoint:** las pantallas no envían por su cuenta —son de presentación—. La
llamada vive en `resources/js/stores/api<Modulo>.ts` y el controlador en
`app/Http/Controllers/Api/<Modulo>Controller.php`. Ya verificado que existen todos.

### Task 4: Operaciones diarias

**Sigue el patrón compartido de arriba**, para cada una de estas pantallas:

- `Trafico/operacionesDiarias/FormLlegada` → `operaciones.llegada`
- `Trafico/operacionesDiarias/FormSalida` → `operaciones.salida`
- `Trafico/operacionesDiarias/OperacionesDiariasForm` → `operaciones.registro`

**Dónde está el envío:** `resources/js/stores/apiOperacionesDiarias.ts`.

**Dónde va la regla:** `app/Http/Controllers/Api/OperacionesDiariasController.php`.

- [ ] **Step 1:** los dos atributos en el input de fecha de cada pantalla, y **solo** en ese: los filtros del mismo fichero no se tocan.
- [ ] **Step 2:** la regla en la validación que ya existe, como `['required', 'date', new DentroDeLaVentana('clave')]`, **conservando el `required`**.
- [ ] **Step 3:** una prueba por endpoint en `tests/Feature/VentanasDeFechaEndpointsTest.php` (se **añade** al final): fecha fuera de ventana → **422**, el mensaje nombra las dos fechas, y **no se escribió nada** (contar filas antes y después).
- [ ] **Step 4:** `vendor/bin/pint --dirty` revirtiendo lo ajeno, `npx tsc --noEmit`, **la suite ENTERA en serie**, y un commit del módulo.

### Task 5: Tráfico, el resto

**Sigue el patrón compartido de arriba**, para cada una de estas pantallas:

- `Trafico/checkListTurno/CheckListTurnoForm` y `sections/HotTrasComiCoor` → **los dos** con `turno.checklist`
- `Trafico/prestamoChalecos/PrestamoChalecoForm` → `chalecos.prestamo`
- `Trafico/servicioComisariato/ServicioComisariatoForm` → `comisariato.entrega`
- `Trafico/controlMedicamento/ControlMedicamentoForm` → `medicamento.movimiento`

**Dónde está el envío:** `apiCheckListTurno.ts`, `apiPrestamoChalecos.ts`, `apiServicioComisariato.ts`, `apiControlMedicamento.ts`.

**Dónde va la regla:** `ChecklistTurnoController`, `PrestamoChalecoController`, `ServicioComisariatoController`, `ControlMedicamentoController`.

- [ ] **Step 1:** los dos atributos en el input de fecha de cada pantalla, y **solo** en ese: los filtros del mismo fichero no se tocan.
- [ ] **Step 2:** la regla en la validación que ya existe, como `['required', 'date', new DentroDeLaVentana('clave')]`, **conservando el `required`**.
- [ ] **Step 3:** una prueba por endpoint en `tests/Feature/VentanasDeFechaEndpointsTest.php` (se **añade** al final): fecha fuera de ventana → **422**, el mensaje nombra las dos fechas, y **no se escribió nada** (contar filas antes y después).
- [ ] **Step 4:** `vendor/bin/pint --dirty` revirtiendo lo ajeno, `npx tsc --noEmit`, **la suite ENTERA en serie**, y un commit del módulo.

### Task 6: Rampa

**Sigue el patrón compartido de arriba**, para cada una de estas pantallas:

- `Rampa/entregaTurnoR/RampaForm` → `turno.entrega_rampa`
- `Rampa/Autotanque/SeccionInicio` → `autotanque.turno_inicio`
- `Rampa/Autotanque/SeccionCierre` → `autotanque.turno_cierre`
- `Rampa/Autotanque/EoloForm` → `autotanque.servicio`
- `Rampa/relacionPlanta/PrestamoModal` → `planta.prestamo`

**Dónde está el envío:** `apiEntregaTurnoR.ts`, `apiAutoTanque.ts`, `apiRelacionPlanta.ts`.

**Dónde va la regla:** `EntregaTurnoRController`, `TurnoAutotanqueController`, `RelacionPlantaController`.

- [ ] **Step 1:** los dos atributos en el input de fecha de cada pantalla, y **solo** en ese: los filtros del mismo fichero no se tocan.
- [ ] **Step 2:** la regla en la validación que ya existe, como `['required', 'date', new DentroDeLaVentana('clave')]`, **conservando el `required`**.
- [ ] **Step 3:** una prueba por endpoint en `tests/Feature/VentanasDeFechaEndpointsTest.php` (se **añade** al final): fecha fuera de ventana → **422**, el mensaje nombra las dos fechas, y **no se escribió nada** (contar filas antes y después).
- [ ] **Step 4:** `vendor/bin/pint --dirty` revirtiendo lo ajeno, `npx tsc --noEmit`, **la suite ENTERA en serie**, y un commit del módulo.

### Task 7: Seguridad

**Sigue el patrón compartido de arriba**, para cada una de estas pantallas:

- `seguridad/MovimientoAvionesCSAE/MovimientoCSAEEntrada` → `csae.entrada`
- `seguridad/MovimientoAvionesCSAE/MovimientoCSAESalida` → `csae.salida`
- `seguridad/pernoctaDia/PernoctaDiaForm` → `pernocta.dia`
- `seguridad/estacionamientoSubTerraneo/RoundRegisterForm` → `estacionamiento.ronda`

**Dónde está el envío:** `apiMovimientoCSAE.ts`, `apiPernoctaDia.ts`, `apiEstacionamientoSubterraneo.ts`.

**Dónde va la regla:** `MovimientoCSAEController`, `PernoctaDiaController`, `EstacionamientoSubterraneoController`.

- [ ] **Step 1:** los dos atributos en el input de fecha de cada pantalla, y **solo** en ese: los filtros del mismo fichero no se tocan.
- [ ] **Step 2:** la regla en la validación que ya existe, como `['required', 'date', new DentroDeLaVentana('clave')]`, **conservando el `required`**.
- [ ] **Step 3:** una prueba por endpoint en `tests/Feature/VentanasDeFechaEndpointsTest.php` (se **añade** al final): fecha fuera de ventana → **422**, el mensaje nombra las dos fechas, y **no se escribió nada** (contar filas antes y después).
- [ ] **Step 4:** `vendor/bin/pint --dirty` revirtiendo lo ajeno, `npx tsc --noEmit`, **la suite ENTERA en serie**, y un commit del módulo.

### Task 8: Despacho y la excepción

**Sigue el patrón compartido de arriba**, para cada una de estas pantallas:

- `despacho/components/walkAround/WalkAroundForm` → `despacho.walk_around`
- `despacho/componentes2/steps/GeneralInfo` → `despacho.informacion_general`
- `despacho/operacionesProgramadas/OperacionProgramadaModal` → `programadas.operacion` (**la excepción**)

**Dónde está el envío:** `apiWalkaround.ts`, `apiOperacionesProgramadas.ts`.

**Dónde va la regla:** `WalkAroundController`, y el de Operaciones Programadas, que valida con el **Form Request** `app/Http/Requests/OperacionProgramada`.

- [ ] **Step 1:** los dos atributos en el input de fecha de cada pantalla, y **solo** en ese: los filtros del mismo fichero no se tocan.
- [ ] **Step 2:** la regla en la validación que ya existe, como `['required', 'date', new DentroDeLaVentana('clave')]`, **conservando el `required`**.
- [ ] **Step 3:** una prueba por endpoint en `tests/Feature/VentanasDeFechaEndpointsTest.php` (se **añade** al final): fecha fuera de ventana → **422**, el mensaje nombra las dos fechas, y **no se escribió nada** (contar filas antes y después).
- [ ] **Step 4:** `vendor/bin/pint --dirty` revirtiendo lo ajeno, `npx tsc --noEmit`, **la suite ENTERA en serie**, y un commit del módulo.
> Los dos avisos de la Task 8 están justo debajo de este bloque de tareas: **léelos antes de empezar**.


**Dos avisos para la Task 8**, que es la que puede salir mal en silencio:

- **La regla de `programadas.operacion` no restringe nada** —`atras: null`, `futuro: true`—, así
  que añadirla no cambia el comportamiento. **Se añade igual**, porque deja la excepción
  declarada en el código y porque el día que esa ventana se estreche, ya está cableada. Dilo en
  el commit para que nadie la borre por «inútil».
- Operaciones Programadas valida con un **Form Request**, no en línea. La regla se pone en su
  método `rules()`.

**Al cerrar cada task:** `vendor/bin/pint --dirty`, `npx tsc --noEmit`, y **la suite ENTERA en
serie**. Un commit por módulo.

---

### Task 9: la prueba de que no rompimos los reportes

**Files:**
- Test: `tests/Feature/VentanasDeFechaEndpointsTest.php` (se añade)

Es la red de lo único que este cambio podría romper de forma invisible: que alguien haya puesto
la regla en un filtro y ahora no se pueda consultar el mes pasado.

- [ ] **Step 1: la prueba**

```php
test('los filtros de busqueda siguen aceptando CUALQUIER rango', function () {
    Carbon::setTestNow('2026-10-07 15:00:00');
    $this->actingAs(App\Models\User::factory()->create());

    // Un rango del mes pasado, muy fuera de cualquier ventana de registro.
    $this->getJson('/api/OperacionesDiarias?fecha=2026-09-01')->assertSuccessful();
});
```

**Si ese endpoint exige un permiso**, usar el ayudante que ya use su propia suite para
construir el usuario; no inventar uno nuevo. Y repetirlo con **al menos un endpoint de
consulta por módulo tocado**, sacados de los 12 filtros de la §6 de la especificación.

- [ ] **Step 2: y la comprobación que ninguna prueba puede hacer**

Buscar `DentroDeLaVentana` en todo el código y comprobar, uno por uno, que **ninguna** de sus
apariciones está en un endpoint de consulta:

```bash
grep -rn "DentroDeLaVentana" app/Http/Controllers/ app/Http/Requests/
```

**No se cuenta un número exacto, y conviene explicar por qué:** un controlador que valide en
`store` **y** en `update` usará la misma clave dos veces, así que «19 apariciones» sería un
criterio falso que haría perseguir un fantasma. Lo que sí tiene que cumplirse es:

- **las 19 claves aparecen al menos una vez** —si falta alguna, ese formulario quedó sin
  proteger en el servidor y solo tiene el calendario, que es decoración—; y
- **ninguna aparición está en un método de consulta** (`index`, `buscar`, `exportar`,
  `obtenerPdf`…). Revisar las apariciones una por una y nombrarlas en el informe.

- [ ] **Step 3: commit**

```bash
git add tests/Feature/VentanasDeFechaEndpointsTest.php
git commit -m "test: los filtros de busqueda siguen libres"
```

## Lo que NO entra

- Un permiso para saltarse la ventana. Ver §8 de la especificación.
- Recalcular la ventana en el navegador para una pestaña abierta de un día para otro.
- Un componente de fecha unificado.
- Los 60 calendarios de búsqueda y reportes.
- Facturación.
