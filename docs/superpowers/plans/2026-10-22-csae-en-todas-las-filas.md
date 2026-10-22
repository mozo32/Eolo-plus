# CSAE en todas las filas que cruza — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una corrida de CSAE que cruza varias estancias se vea en todas sus filas del Excel de Operaciones Diarias, contando para los totales en una sola.

**Architecture:** El cálculo de solape de `RelacionOperacionCSAE` no cambia; lo que cambia es que deja de descartar las estancias que no son la más reciente. Cada operación gana un campo, `csae_es_referencia`, y sus tres agregados pasan a contar solo las corridas que esa estancia posee, de modo que la suma sobre todas las filas sigue siendo el número de corridas. El Excel lee el campo nuevo y deja vacía una sola celda.

**Tech Stack:** Laravel 12, PHP 8.2, Pest 3 sobre sqlite, React 19 + TypeScript, ExcelJS.

**Spec:** `docs/superpowers/specs/2026-10-22-csae-en-todas-las-filas-design.md`

## Global Constraints

- **Rama base:** `vehiculos-tabla-desactivar`, punta `f25223c`. La rama ya lleva seis trabajos terminados; este es independiente de todos ellos.
- **EL GUARDARRAÍL DEL PROYECTO.** La prueba `'DEFECTO doble conteo: la suma de visitas de todas las estancias es el numero de corridas, ni una de mas'` **debe seguir pasando sin modificarla**. Si en algún momento hay que tocarla para que pase, el defecto que se cerró ha vuelto: hay que parar y reportarlo, no ajustarla.
- **Solo DOS pruebas existentes pueden cambiar**, y están nombradas en la Task 1. Si hace falta tocar una tercera, parar y reportarlo: es señal de que el diseño no encaja.
- **Las pruebas corren EN SERIE:** `php artisan test <ruta>`. **Nunca `--parallel`**: en este proyecto da fallos falsos.
- **Hay un directorio atascado** en `storage/framework/testing/disks/`. Corre con un `TEST_TOKEN` fresco — **922 en adelante**, que del 901 al 921 ya se usaron — y borra el `public_test_<n>` y el `local_test_<n>` que deje. `TEST_TOKEN` **no** es ejecución en paralelo: solo hace que `Storage::fake` use otro directorio.
- **Nunca correr `vendor/bin/pint` ni `prettier`** sobre ningún archivo. **Nunca `npm run lint`**: lleva `--fix`.
- **Nunca usar `git stash`.** Hay tres stashes guardados que no son de este trabajo.
- **No cambies dependencias** ni toques `package.json`.
- **No hay ejecutor de pruebas de JavaScript.** La verificación del front es `npx tsc --noEmit` contra una línea base de **1 error preexistente** (TS1117 en el generado `WalkAroundController.ts`) más `npm run build`. Ojo: Vite quita los tipos con esbuild sin comprobarlos, así que `tsc` es la única evidencia de tipos.
- **No se toca el cálculo del solape**, ni se pone techo a las estancias sin salida, ni se cambia quién es la dueña (sigue siendo la de llegada más reciente), ni se tocan los huérfanos. Todo eso es «No entra» en la spec.
- **La conexión `remota` es de solo lectura por contrato.**

---

## Estructura de archivos

**Se modifican:**

| Archivo | Cambio |
|---|---|
| `app/Support/RelacionOperacionCSAE.php` | Reparto a todas las estancias, campo `csae_es_referencia`, agregados sobre lo poseído |
| `tests/Feature/RelacionOperacionCSAETest.php` | 7 pruebas nuevas, 2 modificadas, 1 ayudante ampliado |
| `resources/js/pages/Trafico/operacionesDiarias/excelService.ts` | Lee el campo nuevo y vacía ESTANCIA CSAE en las referencias |

No se crea ningún archivo. La clase tiene un único consumidor —`OperacionesDiariasController::obtenerExcel`— y solo `excelService.ts` lee los campos que decora, así que el alcance acaba ahí.

---

### Task 1: El reparto a todas las estancias

**Files:**
- Modify: `app/Support/RelacionOperacionCSAE.php`
- Test: `tests/Feature/RelacionOperacionCSAETest.php`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: cada operación decorada gana el campo `csae_es_referencia` (bool). Los campos `cantidad_visitas_csae`, `minutos_estancia_csae_total` y `salidas_csae_pendientes` pasan a contar **solo las corridas que esa estancia posee**. `mantenimiento_csae`, `fecha_hora_csae`, `fecha_hora_salida_csae` y `movimientos_csae` reflejan **todas** las que cruza. La Task 2 lee `csae_es_referencia`.

**Contexto que el implementador necesita:**

La clase es pura: recibe colecciones y devuelve datos, sin tocar base ni petición. Su método `relacionar` hace hoy esto:

```php
foreach (self::corridasEnOrden($movimientos) as $corrida) {
    $estancia = self::estanciaMasReciente(
        $estanciasPorMatricula->get($corrida['matricula'], []),
        $corrida,
        $ahora,
    );

    if ($estancia === null) {
        $huerfanos->push(self::huerfano($corrida));

        continue;
    }

    $asignadas[$estancia['clave']][] = self::visita($corrida);
}

$operaciones->each(function ($operacion) use ($asignadas) {
    self::decorar($operacion, $asignadas[self::claveDe($operacion)] ?? []);
});
```

`estanciaMasReciente` recorre las estancias **al revés** (`array_reverse`) y devuelve la primera que solapa, es decir la de llegada más reciente. El cálculo del solape es correcto y se copia tal cual; lo único que sobra es quedarse con una.

El archivo de pruebas tiene ayudantes que vas a usar: `relacionLlegada($matricula, $cuando)`, `relacionSalida(...)`, `relacionMovimiento($matricula, $entrada, $salida = null)`, `relacionExcel()` que devuelve `['operaciones' => [...], 'huerfanos' => [...]]`, `relacionFila($excel, $operacion)` que saca la fila de una operación, `relacionIdsDe($fila)` que da los ids de sus corridas, y `relacionEsperaSinCorridas($fila)` que comprueba que la fila no tenga ninguna.

Para las pruebas de la clase sin HTTP hay otro juego: `relacionOperacionSuelta($id, $tipo, $matricula, $cuando)`, `relacionMovimientoSuelto($id, $matricula, $entrada, $salida)`, `relacionSuelta($operaciones, $movimientos, $historial, $ahora)` y `relacionIdsEn($resultado, $idOperacion)`.

- [ ] **Step 1: Ampliar el ayudante compartido**

`relacionEsperaSinCorridas` comprueba los siete campos del contrato. Añádele el octavo, que en una fila sin corridas va en `false`. Lo usan 7 pruebas y para todas ellas esto es una comprobación **de más**, no un cambio de intención:

```php
function relacionEsperaSinCorridas(array $fila): void
{
    expect($fila['mantenimiento_csae'])->toBeFalse()
        ->and($fila['fecha_hora_csae'])->toBeNull()
        ->and($fila['fecha_hora_salida_csae'])->toBeNull()
        ->and($fila['movimientos_csae'])->toBe([])
        ->and($fila['csae_es_referencia'])->toBeFalse()
        ->and($fila['cantidad_visitas_csae'])->toBe(0)
        ->and($fila['minutos_estancia_csae_total'])->toBe(0)
        ->and($fila['salidas_csae_pendientes'])->toBe(0);
}
```

Y actualiza su comentario: donde dice «los siete campos del contrato en su valor vacio», que diga ocho.

- [ ] **Step 2: Escribir las siete pruebas nuevas**

Añádelas al final de `tests/Feature/RelacionOperacionCSAETest.php`:

```php
// ===========================================================================
// REPARTO A TODAS LAS ESTANCIAS. Una corrida que cruza varias se MUESTRA en todas y se
// CUENTA en una: la de llegada mas reciente, igual que antes.
// ===========================================================================

it('REPARTO XB-GTH: la corrida que cruza dos estancias se ve en las dos', function () {
    // El caso que motiva el trabajo. Llega y sale el 24, vuelve a entrar y sale el 25;
    // la corrida de CSAE va del 24 a las 12:30 al 25 a las 14:37 y cruza las dos.
    $primera = relacionLlegada('XB-GTH', '2026-06-24 12:01');
    relacionSalida('XB-GTH', '2026-06-24 13:52');
    $segunda = relacionLlegada('XB-GTH', '2026-06-25 11:27');
    relacionSalida('XB-GTH', '2026-06-25 14:37');
    $corrida = relacionMovimiento('XB-GTH', '2026-06-24 12:30', '2026-06-25 14:37');

    $excel = relacionExcel();

    expect(relacionIdsDe(relacionFila($excel, $primera)))->toBe([$corrida->id])
        ->and(relacionIdsDe(relacionFila($excel, $segunda)))->toBe([$corrida->id]);
});

it('REPARTO XB-GTH: solo la llegada mas reciente la cuenta', function () {
    $primera = relacionLlegada('XB-GTH', '2026-06-24 12:01');
    relacionSalida('XB-GTH', '2026-06-24 13:52');
    $segunda = relacionLlegada('XB-GTH', '2026-06-25 11:27');
    relacionSalida('XB-GTH', '2026-06-25 14:37');
    relacionMovimiento('XB-GTH', '2026-06-24 12:30', '2026-06-25 14:37');

    $excel = relacionExcel();
    $filaPrimera = relacionFila($excel, $primera);
    $filaSegunda = relacionFila($excel, $segunda);

    expect($filaPrimera['csae_es_referencia'])->toBeTrue()
        ->and($filaPrimera['cantidad_visitas_csae'])->toBe(0)
        ->and($filaSegunda['csae_es_referencia'])->toBeFalse()
        ->and($filaSegunda['cantidad_visitas_csae'])->toBe(1);
});

it('REPARTO: una fila de referencia trae las fechas aunque no cuente', function () {
    // Lo que el departamento va a buscar: la fila de la primera llegada tiene que
    // enseñar la visita, no quedarse en blanco como hasta ahora.
    $primera = relacionLlegada('XA-REF', '2026-03-01 08:00');
    relacionSalida('XA-REF', '2026-03-10 08:00');
    relacionLlegada('XA-REF', '2026-03-05 08:00');
    relacionSalida('XA-REF', '2026-03-20 08:00');
    relacionMovimiento('XA-REF', '2026-03-06 09:00', '2026-03-07 09:00');

    $fila = relacionFila(relacionExcel(), $primera);

    expect($fila['mantenimiento_csae'])->toBeTrue()
        ->and($fila['fecha_hora_csae'])->toBe('06/03/2026 09:00:00')
        ->and($fila['fecha_hora_salida_csae'])->toBe('07/03/2026 09:00:00')
        ->and($fila['movimientos_csae'])->toHaveCount(1)
        ->and($fila['minutos_estancia_csae_total'])->toBe(0)
        ->and($fila['salidas_csae_pendientes'])->toBe(0);
});

it('REPARTO: una corrida que cruza TRES estancias se ve en las tres y cuenta en una', function () {
    $a = relacionLlegada('XA-TRES', '2026-04-01 08:00');
    relacionSalida('XA-TRES', '2026-05-01 08:00');
    $b = relacionLlegada('XA-TRES', '2026-04-10 08:00');
    relacionSalida('XA-TRES', '2026-06-01 08:00');
    $c = relacionLlegada('XA-TRES', '2026-04-20 08:00');
    relacionSalida('XA-TRES', '2026-07-01 08:00');
    $corrida = relacionMovimiento('XA-TRES', '2026-04-25 08:00', '2026-04-26 08:00');

    $excel = relacionExcel();

    expect(relacionIdsDe(relacionFila($excel, $a)))->toBe([$corrida->id])
        ->and(relacionIdsDe(relacionFila($excel, $b)))->toBe([$corrida->id])
        ->and(relacionIdsDe(relacionFila($excel, $c)))->toBe([$corrida->id])
        ->and(relacionFila($excel, $a)['cantidad_visitas_csae'])->toBe(0)
        ->and(relacionFila($excel, $b)['cantidad_visitas_csae'])->toBe(0)
        ->and(relacionFila($excel, $c)['cantidad_visitas_csae'])->toBe(1);
});

it('REPARTO: una corrida que cruza UNA sola estancia no la marca como referencia', function () {
    // Es el caso de las 46 corridas de 73 que no deben cambiar en nada.
    $llegada = relacionLlegada('XA-UNA', '2026-03-01 08:00');
    relacionSalida('XA-UNA', '2026-03-10 08:00');
    $corrida = relacionMovimiento('XA-UNA', '2026-03-02 09:00', '2026-03-03 09:00');

    $fila = relacionFila(relacionExcel(), $llegada);

    expect($fila['csae_es_referencia'])->toBeFalse()
        ->and(relacionIdsDe($fila))->toBe([$corrida->id])
        ->and($fila['cantidad_visitas_csae'])->toBe(1)
        ->and($fila['minutos_estancia_csae_total'])->toBe(1440);
});

it('REPARTO: una fila que POSEE una corrida y REFLEJA otra no es referencia', function () {
    // El caso mixto. Con los datos de hoy no ocurre ni una vez --57 estancias poseen
    // alguna corrida, 16 reflejan alguna, y la interseccion es cero-- asi que esta
    // prueba es el unico sitio donde la regla queda fijada: los agregados cuentan solo
    // lo que la estancia posee, y poseer algo basta para no ser referencia.
    $primera = relacionLlegada('XA-MIX', '2026-03-01 08:00');
    relacionSalida('XA-MIX', '2026-03-20 08:00');
    $segunda = relacionLlegada('XA-MIX', '2026-03-10 08:00');
    relacionSalida('XA-MIX', '2026-03-25 08:00');

    // Solo cruza la primera: la posee.
    $suya = relacionMovimiento('XA-MIX', '2026-03-02 09:00', '2026-03-03 09:00');
    // Cruza las dos: la posee la segunda, la primera solo la refleja.
    $compartida = relacionMovimiento('XA-MIX', '2026-03-12 08:00', '2026-03-15 08:00');

    $fila = relacionFila(relacionExcel(), $primera);

    expect(relacionIdsDe($fila))->toBe([$suya->id, $compartida->id])
        ->and($fila['csae_es_referencia'])->toBeFalse()
        ->and($fila['cantidad_visitas_csae'])->toBe(1)
        ->and(relacionFila(relacionExcel(), $segunda)['cantidad_visitas_csae'])->toBe(1);
});

it('REPARTO: una corrida sin estancia sigue siendo huerfana aunque otra se reparta', function () {
    $llegada = relacionLlegada('XA-HUE', '2026-03-01 08:00');
    relacionSalida('XA-HUE', '2026-03-20 08:00');
    relacionLlegada('XA-HUE', '2026-03-10 08:00');
    relacionSalida('XA-HUE', '2026-03-25 08:00');
    relacionMovimiento('XA-HUE', '2026-03-12 08:00', '2026-03-15 08:00');
    $fuera = relacionMovimiento('XA-HUE', '2026-08-01 08:00', '2026-08-02 08:00');

    $excel = relacionExcel();

    expect(relacionIdsDe(relacionFila($excel, $llegada)))->not->toContain($fuera->id)
        ->and(collect($excel['huerfanos'])->pluck('id')->all())->toBe([$fuera->id]);
});
```

- [ ] **Step 3: Correr y ver el rojo**

```bash
TEST_TOKEN=922 php artisan test tests/Feature/RelacionOperacionCSAETest.php
```

Esperado: FALLAN las siete nuevas y las siete que usan `relacionEsperaSinCorridas`, porque `csae_es_referencia` todavía no existe. El resto en verde. Anota qué falló y por qué.

- [ ] **Step 4: Cambiar las DOS pruebas existentes que afirman lo contrario**

Estas dos dicen que la fila anterior queda **vacía**, que es justo lo que este trabajo revierte. Cambia **solo** su aserción sobre la fila anterior y **conserva intacta** la que dice dónde se cuenta.

En `'DEFECTO doble conteo: con dos llegadas abiertas la corrida posterior a la segunda sale SOLO bajo la segunda'` (línea 330; la línea a sustituir es la 338), sustituye la línea `relacionEsperaSinCorridas(relacionFila($excel, $primera));` por:

```php
    // La primera ahora MUESTRA la corrida, pero no la cuenta: el reparto a todas las
    // estancias no reabre el doble conteo porque los agregados solo cuentan lo poseido.
    $filaPrimera = relacionFila($excel, $primera);
    expect(relacionIdsDe($filaPrimera))->toBe([$movimiento->id])
        ->and($filaPrimera['csae_es_referencia'])->toBeTrue()
        ->and($filaPrimera['cantidad_visitas_csae'])->toBe(0);
```

En `'DEFECTO doble conteo: una corrida que cruza dos estancias se queda con la de llegada mas reciente'` (línea 357; la línea a sustituir es la 367), sustituye `relacionEsperaSinCorridas(relacionFila($excel, $primera));` por ese mismo bloque, y cambia el nombre de la prueba a:

```php
it('DEFECTO doble conteo: una corrida que cruza dos estancias la cuenta la de llegada mas reciente', function () {
```

**No toques ninguna otra prueba.** En particular, `'DEFECTO doble conteo: la suma de visitas de todas las estancias es el numero de corridas, ni una de mas'` se queda **exactamente como está**: es el guardarraíl del proyecto.

- [ ] **Step 5: Reescribir el reparto**

En `app/Support/RelacionOperacionCSAE.php`, sustituye las líneas 65-87 de `relacionar`. La variable
`$asignadas` desaparece: la sustituyen dos, una para lo que se muestra y otra para lo que se cuenta.
Las demás líneas del método --el `$ahora` de arriba y el `return` de abajo-- no se tocan:

```php
        $estanciasPorMatricula = self::estanciasPorMatricula($historial ?? $operaciones);
        $mostradas = [];
        $poseidas = [];
        $huerfanos = collect();

        foreach (self::corridasEnOrden($movimientos) as $corrida) {
            $estancias = self::estanciasQueSolapan(
                $estanciasPorMatricula->get($corrida['matricula'], []),
                $corrida,
                $ahora,
            );

            if ($estancias === []) {
                $huerfanos->push(self::huerfano($corrida));

                continue;
            }

            $visita = self::visita($corrida);

            // Las estancias vienen de la mas antigua a la mas reciente, asi que la
            // dueña es la ultima: la misma regla de siempre.
            $claveDeLaDuena = $estancias[array_key_last($estancias)]['clave'];

            foreach ($estancias as $estancia) {
                $mostradas[$estancia['clave']][] = $visita;
            }

            $poseidas[$claveDeLaDuena][] = $visita;
        }

        $operaciones->each(function ($operacion) use ($mostradas, $poseidas) {
            $clave = self::claveDe($operacion);

            self::decorar(
                $operacion,
                $mostradas[$clave] ?? [],
                $poseidas[$clave] ?? [],
            );
        });
```

- [ ] **Step 6: Sustituir `estanciaMasReciente` por `estanciasQueSolapan`**

La aritmética del solape se copia sin tocar una coma; lo único que cambia es que devuelve todas en vez de la última:

```php
    /**
     * Todas las estancias que solapan con la corrida, de la mas antigua a la mas reciente.
     *
     * La aritmetica del solape es la de siempre: el intervalo de la corrida va de su entrada a su
     * salida (o hasta `$ahora`), el de la estancia de la llegada a la primera salida posterior (o
     * sin techo), y pertenecen si se cruzan con los extremos incluidos.
     *
     * @param  array<int, array{clave: string, inicio: Carbon, fin: ?Carbon}>  $estancias  De la mas antigua a la mas reciente.
     * @param  array{entrada: Carbon, salida: ?Carbon}  $corrida
     * @return array<int, array{clave: string, inicio: Carbon, fin: ?Carbon}>
     */
    private static function estanciasQueSolapan(array $estancias, array $corrida, Carbon $ahora): array
    {
        $finDeLaCorrida = $corrida['salida'] ?? $ahora;

        if ($finDeLaCorrida->lessThan($corrida['entrada'])) {
            $finDeLaCorrida = $corrida['entrada'];
        }

        return array_values(array_filter(
            $estancias,
            function (array $estancia) use ($corrida, $finDeLaCorrida) {
                $empiezaAntesDeQueTermineLaCorrida = $estancia['inicio']->lessThanOrEqualTo($finDeLaCorrida);
                $terminaDespuesDeQueEmpieceLaCorrida = $estancia['fin'] === null
                    || $estancia['fin']->greaterThanOrEqualTo($corrida['entrada']);

                return $empiezaAntesDeQueTermineLaCorrida && $terminaDespuesDeQueEmpieceLaCorrida;
            }
        ));
    }
```

Borra el método `estanciaMasReciente` entero: ya no lo llama nadie.

- [ ] **Step 7: Reescribir `decorar`**

Recibe dos listas en vez de una. Los agregados cuentan **solo lo poseído**, que es lo que mantiene en pie el guardarraíl:

```php
    /**
     * Pone en la operacion los ocho campos del contrato: vacios, y llenos si la estancia cruza
     * alguna corrida.
     *
     * `$mostradas` son todas las corridas que la estancia cruza; `$poseidas`, las que ademas
     * cuenta. Los agregados salen SOLO de las poseidas, para que la suma sobre todas las filas
     * siga siendo el numero de corridas y no una por cada fila que la enseña.
     *
     * @param  array<int, array<string, mixed>>  $mostradas
     * @param  array<int, array<string, mixed>>  $poseidas
     */
    private static function decorar(object $operacion, array $mostradas, array $poseidas): void
    {
        $operacion->mantenimiento_csae = false;
        $operacion->fecha_hora_csae = null;
        $operacion->fecha_hora_salida_csae = null;
        $operacion->movimientos_csae = [];
        $operacion->csae_es_referencia = false;
        $operacion->cantidad_visitas_csae = 0;
        $operacion->minutos_estancia_csae_total = 0;
        $operacion->salidas_csae_pendientes = 0;

        if ($mostradas === []) {
            return;
        }

        $primera = $mostradas[0];

        $operacion->mantenimiento_csae = true;
        $operacion->fecha_hora_csae = $primera['fecha_hora_entrada'];
        $operacion->fecha_hora_salida_csae = $primera['fecha_hora_salida'];
        $operacion->movimientos_csae = $mostradas;
        $operacion->csae_es_referencia = $poseidas === [];
        $operacion->cantidad_visitas_csae = count($poseidas);
        $operacion->minutos_estancia_csae_total = (int) array_sum(array_column($poseidas, 'minutos_estancia'));
        $operacion->salidas_csae_pendientes = count(array_filter($poseidas, fn (array $visita) => $visita['pendiente']));
    }
```

- [ ] **Step 8: Actualizar el comentario de la clase**

El docblock de `RelacionOperacionCSAE` dice hoy:

```
 * Cada corrida se asigna a UNA sola estancia: la de llegada más reciente entre las que solapan con
 * ella. Eso es lo que hace seguro dejar sin techo una estancia sin salida: la siguiente llegada se
 * queda la corrida. Las que no solapan con ninguna estancia son los huérfanos.
```

Sustitúyelo por:

```
 * Una corrida se MUESTRA en todas las estancias que solapan con ella, y se CUENTA en una sola: la
 * de llegada más reciente. Las demás la enseñan como referencia, con `csae_es_referencia` en true
 * y sus agregados en cero, de modo que la suma de visitas sobre todas las filas sigue siendo el
 * número de corridas. Las que no solapan con ninguna estancia son los huérfanos.
```

Y en la lista de campos del final del docblock, añade `csae_es_referencia` junto a los otros siete.

- [ ] **Step 9: Correr y ver el verde**

```bash
TEST_TOKEN=923 php artisan test tests/Feature/RelacionOperacionCSAETest.php
```

Esperado: **46 pruebas en verde** (las 39 de antes más las 7 nuevas), sin ningún fallo.

**Comprueba explícitamente que el guardarraíl pasó sin tocarlo** y dilo en el informe: `git diff` sobre el archivo de pruebas no debe mostrar ningún cambio dentro de `'DEFECTO doble conteo: la suma de visitas de todas las estancias es el numero de corridas, ni una de mas'`.

- [ ] **Step 10: Comprobar que las pruebas muerden**

Rompe el código a propósito, corre **solo este archivo**, anota qué se pone en rojo, y restaura:

1. En `estanciasQueSolapan`, devuelve solo la última: `return array_slice(array_values(array_filter(...)), -1);` → deben fallar las pruebas de reparto (XB-GTH, tres estancias, referencia con fechas).
2. En `decorar`, haz que los agregados salgan de `$mostradas` en vez de `$poseidas` → **debe fallar el guardarraíl**, la prueba de la suma. Esta es la comprobación más importante del trabajo: demuestra que la prueba sigue protegiendo lo que protegía.
3. En `decorar`, pon `csae_es_referencia` siempre en `false` → deben fallar las pruebas que lo esperan en `true`.

Si alguna de las tres no se pone en rojo, para y repórtalo.

- [ ] **Step 11: Limpiar y commitear**

```bash
rm -rf storage/framework/testing/disks/public_test_922 storage/framework/testing/disks/local_test_922 storage/framework/testing/disks/public_test_923 storage/framework/testing/disks/local_test_923
git add app/Support/RelacionOperacionCSAE.php tests/Feature/RelacionOperacionCSAETest.php
git commit -m "feat(csae): la corrida se muestra en todas las estancias que cruza y cuenta en una"
```

---

### Task 2: El Excel deja vacía la estancia en las filas de referencia

**Files:**
- Modify: `resources/js/pages/Trafico/operacionesDiarias/excelService.ts`

**Interfaces:**
- Consumes: el campo `csae_es_referencia` (bool) que la Task 1 pone en cada operación.
- Produces: nada que otra tarea use.

**Contexto:**

No hay ejecutor de pruebas de JavaScript, así que esta tarea **no tiene ciclo TDD**. Dilo así en el informe en vez de inventarte uno.

El tipo `Operacion` declara hoy los campos de CSAE así:

```ts
    mantenimiento_csae?: boolean | number | null;
    fecha_hora_csae?: string | null;
    fecha_hora_llegada_csae?: string | null;
    fecha_hora_salida_csae?: string | null;
    movimientos_csae?: MovimientoCsaeOperacion[];
    cantidad_visitas_csae?: number;
    minutos_estancia_csae_total?: number;
    salidas_csae_pendientes?: number;
```

**Un dato que importa:** los tres agregados están declarados pero **el Excel no lee ninguno**. Todo se recalcula desde `movimientos_csae` dentro de `prepararFilasReporteOperaciones`:

```ts
        const movimientosCsae = obtenerMovimientosCsae(fila);
        const cantidadVisitasCsae = movimientosCsae.length;
```

Por eso no basta con que el backend ponga los agregados en cero: hace falta leer el campo nuevo. **No reescribas el recálculo** para que use los agregados del backend; eso es otro trabajo y cambiaría el comportamiento de filas que no tienen nada que ver.

Cada fila del Excel junta una llegada y una salida. El resto de campos de CSAE se leen con el patrón `llegada?.X ?? salida?.X`, y el campo nuevo sigue ese mismo patrón.

Las cuatro celdas del grupo CSAE son, en orden: `textoMantenimientoCsae`, las entradas, las salidas y `partesEstanciaCsae.join('\n')`. **Solo cambia la última.**

- [ ] **Step 1: Tomar la línea base de tipos**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Anótalo **antes de tocar nada**. Esperado: `1`, el error preexistente TS1117 en el `WalkAroundController.ts` generado.

- [ ] **Step 2: Declarar el campo en el tipo**

En `resources/js/pages/Trafico/operacionesDiarias/excelService.ts`, añade la línea justo después de `movimientos_csae`:

```ts
    movimientos_csae?: MovimientoCsaeOperacion[];
    /** La fila enseña la visita pero no la cuenta: otra estancia es la dueña. */
    csae_es_referencia?: boolean | number | null;
    cantidad_visitas_csae?: number;
```

- [ ] **Step 3: Leer el campo y vaciar la celda**

Dentro de `prepararFilasReporteOperaciones`, después de la línea que calcula `minutosEstanciaCsae`, añade:

```ts
        // Esta fila cruza la visita pero no la cuenta: otra estancia es la dueña. Se
        // enseñan las fechas, que es lo que se va a buscar, y se deja vacia la estancia
        // para que la columna siga sumando el tiempo real una sola vez.
        const csaeEsReferencia = Boolean(
            llegada?.csae_es_referencia ?? salida?.csae_es_referencia
        );
```

Y envuelve los dos `if` que llenan `partesEstanciaCsae`:

```ts
        const partesEstanciaCsae: string[] = [];

        if (!csaeEsReferencia) {
            if (cantidadCompletadasCsae > 0) {
                partesEstanciaCsae.push(
                    formatearDuracionMinutos(minutosEstanciaCsae)
                );
            }

            if (cantidadPendientesCsae > 0) {
                partesEstanciaCsae.push(
                    cantidadPendientesCsae === 1
                        ? '1 salida pendiente'
                        : `${cantidadPendientesCsae} salidas pendientes`
                );
            }
        }
```

No toques `textoMantenimientoCsae` ni las celdas de entradas y salidas: las tres siguen pintándose igual en todas las filas.

- [ ] **Step 3b: Apagar el resaltado en las filas de referencia**

La fila que se devuelve lleva también `estanciaCsaePendiente`, y con ese booleano el modal y el
`.xlsx` pintan la celda de ESTANCIA CSAE en ámbar. En una fila de referencia la celda queda
vacía, así que resaltarla sería pintar un hueco de color. Cámbialo:

```ts
            estanciaCsaePendiente: !csaeEsReferencia && cantidadPendientesCsae > 0,
```

- [ ] **Step 4: Comprobar tipos y compilación**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Esperado: el mismo número del Step 1. Si sube, los errores nuevos son de este cambio.

```bash
npm run build
```

Esperado: termina sin errores. Tarda un par de minutos; déjalo acabar.

- [ ] **Step 5: Revisar estos cuatro puntos en tu propio diff**

1. `csaeEsReferencia` se lee de la llegada y, si no está, de la salida — el mismo patrón que los campos vecinos.
2. Solo la celda de ESTANCIA CSAE queda condicionada; las otras tres del grupo no se tocan.
3. Una fila que no es referencia pinta exactamente lo que pintaba antes.
4. No reescribiste el recálculo desde `movimientos_csae`.

**Una divergencia conocida, a propósito.** La spec dice que una fila mixta llena ESTANCIA CSAE
«con el tiempo de las corridas que posee, no con el de todas las que enseña». Con la bandera sola
eso no se consigue: el Excel recalcula desde `movimientos_csae`, que trae todas, y conseguirlo
obligaría a leer los tres agregados del backend desde el mismo lado que aportó los movimientos
--una pieza nueva, más grande que esta tarea--. Se deja así porque **hoy no hay ni una fila
mixta**: 57 estancias poseen alguna corrida, 16 reflejan alguna, y la intersección es cero. La
regla sí queda fijada donde importa, en la prueba de backend de la Task 1, que es la que define
el contrato. **No intentes cerrar esta divergencia dentro de esta tarea.**

- [ ] **Step 6: Commit**

```bash
git add resources/js/pages/Trafico/operacionesDiarias/excelService.ts
git commit -m "feat(csae): la estancia CSAE solo se llena en la fila que cuenta la visita"
```

---

### Task 3: La suite entera y la pantalla de verdad

**Files:**
- Test: toda la suite; después, el Excel en un navegador

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada.

**Contexto:**

El cambio toca una clase que decora las filas del Excel y el servicio que las pinta. No cambia ninguna otra respuesta de la API. Esta tarea confirma que es así.

- [ ] **Step 1: Correr la suite entera, en serie**

```bash
TEST_TOKEN=924 php artisan test
```

**Nunca con `--parallel`.** Esperado: **2493** pruebas (las 2486 de antes más las 7 nuevas), sin ningún fallo.

Después:

```bash
rm -rf storage/framework/testing/disks/public_test_924 storage/framework/testing/disks/local_test_924
```

- [ ] **Step 2: Si algo falla**

Lee el fallo antes de tocar nada. Si es una prueba de `RelacionOperacionCSAETest` distinta de las dos que la Task 1 autorizó a cambiar, **para y repórtalo**: significa que el diseño no encaja, no que la prueba esté mal.

Si el fallo no tiene relación con CSAE, comprueba si ya venía fallando, en un árbol aparte y sin tocar el de trabajo:

```bash
git worktree add ../eolo-base f25223c
cd ../eolo-base && TEST_TOKEN=925 php artisan test --filter=NombreDeLaPrueba
```

`f25223c` es la punta antes de este trabajo. Si allí también falla, es previo: anótalo y sigue. Límpialo con `git worktree remove ../eolo-base`.

- [ ] **Step 3: Abrir el Excel en el navegador**

Dos trampas conocidas del entorno, las dos con síntomas que parecen defectos del código:

- El preview arranca desde `C:\xampp\htdocs\EOLO` (el **padre**), así que lee `EOLO/.claude/launch.json`, **no** el de `Eolo-plus/`.
- Sanctum solo considera *stateful* los orígenes `localhost`, `localhost:3000`, `127.0.0.1`, `127.0.0.1:8000`, `::1` y el host de `APP_URL`. En cualquier otro puerto, `/api/*` responde **401** y las tablas salen vacías.

Receta: edita `C:\xampp\htdocs\EOLO\.claude\launch.json` para que sirva en el **puerto 3000**, arranca el preview y entra por `http://localhost:3000`. **Devuelve el archivo a 8000 al terminar.**

Entra como `Administrador EOLO` con la contraseña del seeder (`AdminUserSeeder`). Fortify autentica por `name`, no por correo.

- [ ] **Step 4: Comprobar el caso XB-GTH en pantalla**

Abre Operaciones Diarias, filtra por la matrícula `XB-GTH` y abre la vista previa del Excel. **Verifica leyendo y descargando; no registres ninguna operación.**

1. Las filas que antes salían con las columnas de CSAE en blanco y que corresponden a una corrida larga ahora enseñan **FECHA-HORA LLEGADA CSAE** y **FECHA-HORA SALIDA CSAE**.
2. De esas filas, **solo una** tiene **ESTANCIA CSAE** llena. Las demás la tienen vacía.
3. MANTENIMIENTO CSAE dice «SI (…)» en todas ellas: es lo esperado, el texto es por fila y no suma.
4. Descarga el archivo y comprueba que la vista previa y la hoja coinciden fila por fila.

Haz una captura de la vista previa con las filas de `XB-GTH` y adjúntala al informe.

- [ ] **Step 5: Informe**

Si todo salió verde y no tocaste nada, **no hay nada que commitear**: dilo explícitamente en vez de inventarte un commit.

---

## Qué queda fuera, a propósito

- **Cambiar quién es la dueña.** Sigue siendo la estancia de llegada más reciente.
- **Poner techo a las estancias sin salida.** Medido: cero corridas cambiarían.
- **Quitar los tres agregados que el Excel no lee.** Son el contrato que el guardarraíl verifica.
- **Cambiar el texto de MANTENIMIENTO CSAE**, que seguirá diciendo «SI (1 VISITA)» también en las filas de referencia.
- **La pantalla de Operaciones Diarias**, que no consume esta clase.
- **Los huérfanos**, que se comportan exactamente igual.
