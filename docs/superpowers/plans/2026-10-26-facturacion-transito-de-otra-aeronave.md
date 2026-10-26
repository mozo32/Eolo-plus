# Tránsito de otra aeronave en la prefactura — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que en una prefactura se pueda cobrar el tránsito de **otra** aeronave, con la tarifa de esa aeronave y sin que «Estancia y ajustes» lo borre ni lo duplique.

**Architecture:** El renglón se guarda con `concepto = null` y la matrícula dentro del nombre. Como `CargosEstancia::quitarEstancia()` borra por concepto, un renglón sin concepto de estancia sobrevive intacto al recálculo. No hay migración ni se toca el motor de estancia: todo el cambio vive en la validación del alta de renglones, en su controlador y en el modal.

**Tech Stack:** Laravel 12, PHP 8.2, Pest 3 sobre sqlite, React 19 + TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-26-facturacion-transito-de-otra-aeronave-design.md`

## Global Constraints

- **Rama:** `facturacion`, punta `3aa905b`. Tiene 3 trabajos sin commitear del modal de renglón (categoría, Proveedor oculto, No. Remisión) y 20 commits sin subir. **No commitees esos cambios ajenos**: añade solo tus archivos por nombre al hacer `git add`.
- **Las pruebas corren EN SERIE:** `php artisan test <ruta>`. **Nunca `--parallel`**: en este proyecto da fallos falsos.
- **Usa un `TEST_TOKEN` fresco** —**960 en adelante**— y borra los `public_test_<n>` y `local_test_<n>` que deje. Hay un directorio atascado en `storage/framework/testing/disks/` por eso. `TEST_TOKEN` **no** es ejecución en paralelo.
- **Nunca `vendor/bin/pint`, `prettier` ni `npm run lint`.** El último lleva `--fix` y reescribe archivos ajenos.
- **Nunca `git stash`.** Hay tres stashes guardados que no son de este trabajo.
- **No se toca `app/Services/CargosEstancia.php`.** Ni una línea. Que el tránsito ajeno sobreviva depende de que ese servicio siga borrando por concepto exactamente como hoy.
- **No hay migración.** `fact_prefactura_renglones` no cambia.
- **Los dos ajustes de estancia** (`estancia_ajuste_2h_12h`, `estancia_ajuste_12h_pernocta`) siguen sin poder agregarse a mano, con matrícula o sin ella.
- **No hay ejecutor de pruebas de JavaScript.** La evidencia del front es `npx tsc --noEmit` contra una línea base de **1 error preexistente** (TS1117 en el generado `WalkAroundController.ts`) más `npm run build`. Vite quita los tipos con esbuild sin comprobarlos: `tsc` es la única evidencia de tipos.
- **La base de desarrollo `eolo_plus` es la real del usuario.** Verifica leyendo; no registres ni borres nada.
- La conexión `remota` es de **solo lectura por contrato**.

---

## Estructura de archivos

**Se modifican, ninguno se crea:**

| Archivo | Cambio |
|---|---|
| `app/Http/Requests/Facturacion/StoreRenglonRequest.php` | Acepta `aeronave_id`; la regla de estancia se abre por una rendija |
| `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php` | Con `aeronave_id`, saca la tarifa y arma el renglón sin concepto |
| `tests/Feature/Facturacion/EndpointsPrefacturaTest.php` | Las pruebas del endpoint |
| `resources/js/stores/apiFacturacionCatalogos.ts` | `aeronave_id` en el tipo de alta de renglón |
| `resources/js/pages/Facturacion/components/ModalRenglon.tsx` | Tránsitos en el menú y el campo de matrícula |

Tres tareas: el backend con sus pruebas, la pantalla, y la verificación de punta a punta.

---

### Task 1: El backend acepta un tránsito con matrícula ajena

**Files:**
- Modify: `app/Http/Requests/Facturacion/StoreRenglonRequest.php`
- Modify: `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php`
- Test: `tests/Feature/Facturacion/EndpointsPrefacturaTest.php`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: `POST /api/facturacion/prefacturas/{id}/renglones` acepta un campo opcional `aeronave_id` (int, el `aeronaves.id`). Con él y un servicio de tránsito, crea un renglón con `concepto = null`, `nombre_servicio` igual a `"<nombre del servicio> — <MATRÍCULA>"` y `precio_unitario` igual a la tarifa de esa aeronave. La Task 2 llama a este endpoint con ese campo.

**Contexto que el implementador necesita:**

Hoy `StoreRenglonRequest` rechaza **los cinco** conceptos de estancia con una regla propia:

```php
private function noEsServicioDeEstancia(string $atributo, mixed $valor, \Closure $fallar): void
{
    $esEstancia = FactServicio::query()
        ->whereKey($valor)
        ->whereIn('concepto', FactServicio::CONCEPTOS_ESTANCIA)
        ->exists();

    if ($esEstancia) {
        $fallar('Los cargos de estancia no se agregan a mano: los pone «Estancia y ajustes», porque su precio sale de la tarifa de la matrícula y no del catálogo.');
    }
}
```

`FactServicio::CONCEPTOS_ESTANCIA` son cinco: `estancia_pernocta`, `estancia_transito_2h`, `estancia_transito_12h`, `estancia_ajuste_2h_12h`, `estancia_ajuste_12h_pernocta`. **Los tres primeros son los tramos**; los dos últimos son ajustes y siguen prohibidos.

Las tarifas se leen con `FactAeronave::tarifaPernocta()`, `tarifaTransito2h()` y `tarifaTransito12h()`. Cada una devuelve la tarifa propia de la ficha y, si es `null`, la de su categoría. Pueden devolver `null` las dos: a 63 de 847 aeronaves les pasa con la de 12 h.

`FactAeronave` se busca por `aeronave_id` (que es `aeronaves.id`), no por su propia clave:

```php
$ficha = FactAeronave::query()->where('aeronave_id', $aeronaveId)->first();
```

`FactAeronave::ESTATUS_GUARDA` es la constante del estatus que no paga estancia.

En las pruebas, el ayudante global `conEstancia()` (en `tests/Pest.php`) crea los tres servicios de tránsito, una aeronave con ficha y tarifas (`pernocta` 4676.00, `2h` 1144.50, `12h` 2338.00) y devuelve una prefactura en borrador de esa aeronave. `matriculaDePrueba()` da matrículas distintas en cada llamada. El archivo de pruebas autentica con `usuarioConSubdepartamento('factPrefacturas', 'Facturacion')`.

- [ ] **Step 1: Escribir las pruebas, todas antes de tocar el código**

Añádelas al final de `tests/Feature/Facturacion/EndpointsPrefacturaTest.php`:

```php
/*
 * TRANSITO DE OTRA AERONAVE. Una prefactura es de una matricula, pero puede cobrar el transito
 * de otra: se factura a XB-ACA y se incluye el transito de XA-CCC porque lo paga el mismo
 * cliente. El renglon se guarda SIN concepto de estancia, que es lo unico que lo hace sobrevivir
 * a «Estancia y ajustes»; la matricula viaja en el nombre.
 */

/** Una aeronave ajena con ficha, tarifas y la matricula pedida. */
function aeronaveAjena(string $estatus = FactAeronave::ESTATUS_TRANSITO, bool $conTarifas = true): App\Models\Aeronave
{
    $aeronave = App\Models\Aeronave::create(['matricula' => matriculaDePrueba()]);

    FactAeronave::create([
        'aeronave_id' => $aeronave->id,
        'estatus' => $estatus,
        'tarifa_pernocta' => $conTarifas ? 9000.00 : null,
        'tarifa_transito_2h' => $conTarifas ? 3000.00 : null,
        'tarifa_transito_12h' => $conTarifas ? 6000.00 : null,
    ]);

    return $aeronave;
}

/** El servicio del tramo indicado, creado por `conEstancia()`. */
function servicioDeTransito(string $concepto): FactServicio
{
    return FactServicio::where('concepto', $concepto)->firstOrFail();
}

test('un transito de otra aeronave se cobra con la tarifa de ESA aeronave, no con el catalogo', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = conEstancia();
    $ajena = aeronaveAjena();
    $servicio = servicioDeTransito(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
        'aeronave_id' => $ajena->id,
    ])->assertCreated();

    $renglon = FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->sole();

    expect((float) $renglon->precio_unitario)->toBe(6000.00)
        ->and($renglon->concepto)->toBeNull()
        ->and($renglon->nombre_servicio)->toBe('Transito 12 hrs — '.$ajena->matricula)
        ->and($renglon->servicio_id)->toBe($servicio->id);
});

test('DEFECTO que este trabajo evita: «Estancia y ajustes» NO borra ni duplica el transito ajeno', function () {
    // Es la prueba que define el trabajo. El renglon ajeno no lleva concepto de estancia, y
    // `quitarEstancia()` borra por concepto: por eso sobrevive. Los cargos propios SI se
    // reemplazan, que es lo que ese boton hace.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = conEstancia();
    $ajena = aeronaveAjena();
    $servicio = servicioDeTransito(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
        'aeronave_id' => $ajena->id,
    ])->assertCreated();

    // Dos recalculos seguidos: si el ajeno se duplicara, el segundo lo delataria.
    foreach ([1, 2] as $vuelta) {
        $this->patchJson("/api/facturacion/prefacturas/{$prefactura->id}/estancia", [
            'pernoctas' => 0,
            'transitos_2h' => 0,
            'transitos_12h' => 1,
            'ajustes_2h_12h' => 0,
            'ajustes_12h_pernocta' => 0,
        ])->assertOk();
    }

    $ajenos = FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->whereNull('concepto')->get();
    $propios = FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->whereNotNull('concepto')->get();

    expect($ajenos)->toHaveCount(1)
        ->and((float) $ajenos->first()->precio_unitario)->toBe(6000.00)
        ->and($propios)->toHaveCount(1)
        ->and((float) $propios->first()->precio_unitario)->toBe(2338.00);
});

test('un transito SIN aeronave_id se sigue rechazando con el mensaje de siempre', function () {
    // No regresion: la validacion se abre por una rendija y el resto sigue cerrado.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = conEstancia();
    $servicio = servicioDeTransito(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H);

    $respuesta = $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
    ])->assertStatus(422)->assertJsonValidationErrors(['servicio_id']);

    expect($respuesta->json('errors.servicio_id.0'))->toContain('Estancia y ajustes')
        ->and(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->count())->toBe(0);
});

test('los dos ajustes de estancia se siguen rechazando, con matricula ajena y sin ella', function (string $concepto) {
    // No regresion: los ajustes son para subir de tramo la estancia PROPIA y salen de
    // «Estancia y ajustes». Una matricula ajena no los habilita.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = conEstancia();
    $ajena = aeronaveAjena();
    $servicio = FactServicio::create(['nombre' => 'Ajuste '.$concepto, 'precio_unitario' => 0.0, 'concepto' => $concepto]);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", ['servicio_id' => $servicio->id, 'cantidad' => 1])
        ->assertStatus(422)->assertJsonValidationErrors(['servicio_id']);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", ['servicio_id' => $servicio->id, 'cantidad' => 1, 'aeronave_id' => $ajena->id])
        ->assertStatus(422)->assertJsonValidationErrors(['servicio_id']);

    expect(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->count())->toBe(0);
})->with([
    'ajuste 2h a 12h' => FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H,
    'ajuste 12h a pernocta' => FactServicio::CONCEPTO_ESTANCIA_AJUSTE_12H_PERNOCTA,
]);

test('se rechaza la matricula de la PROPIA prefactura y se manda a «Estancia y ajustes»', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = conEstancia();
    $servicio = servicioDeTransito(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H);

    $respuesta = $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
        'aeronave_id' => $prefactura->aeronave_id,
    ])->assertStatus(422);

    expect($respuesta->json('errors.aeronave_id.0'))->toContain('Estancia y ajustes')
        ->and(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->count())->toBe(0);
});

test('se rechaza una aeronave ajena en Guarda', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = conEstancia();
    $ajena = aeronaveAjena(FactAeronave::ESTATUS_GUARDA);
    $servicio = servicioDeTransito(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H);

    $respuesta = $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
        'aeronave_id' => $ajena->id,
    ])->assertStatus(422);

    expect($respuesta->json('errors.aeronave_id.0'))->toContain('Guarda')
        ->and(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->count())->toBe(0);
});

test('se rechaza una aeronave ajena sin tarifa para ese tramo', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = conEstancia();
    $ajena = aeronaveAjena(conTarifas: false);
    $servicio = servicioDeTransito(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H);

    $respuesta = $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
        'aeronave_id' => $ajena->id,
    ])->assertStatus(422);

    expect($respuesta->json('errors.aeronave_id.0'))->toContain('tarifa')
        ->and(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->count())->toBe(0);
});

test('se rechaza una aeronave ajena sin ficha de facturacion', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = conEstancia();
    $sinFicha = App\Models\Aeronave::create(['matricula' => matriculaDePrueba()]);
    $servicio = servicioDeTransito(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H);

    $respuesta = $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 1,
        'aeronave_id' => $sinFicha->id,
    ])->assertStatus(422);

    expect($respuesta->json('errors.aeronave_id.0'))->toContain('ficha')
        ->and(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->count())->toBe(0);
});

test('aeronave_id en un servicio que NO es de transito se rechaza', function () {
    // Aceptarlo en silencio esconderia un error de quien llama: en un servicio normal el campo
    // no significa nada y el precio seguiria saliendo del catalogo.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = conEstancia();
    $ajena = aeronaveAjena();
    $normal = FactServicio::create(['nombre' => 'Remolque', 'precio_unitario' => 867.87]);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $normal->id,
        'cantidad' => 1,
        'aeronave_id' => $ajena->id,
    ])->assertStatus(422)->assertJsonValidationErrors(['aeronave_id']);

    expect(FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->count())->toBe(0);
});

test('un transito ajeno con cantidad 2 cobra dos veces la tarifa de la ajena', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $prefactura = conEstancia();
    $ajena = aeronaveAjena();
    $servicio = servicioDeTransito(FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H);

    $this->postJson("/api/facturacion/prefacturas/{$prefactura->id}/renglones", [
        'servicio_id' => $servicio->id,
        'cantidad' => 2,
        'aeronave_id' => $ajena->id,
    ])->assertCreated();

    $renglon = FactPrefacturaRenglon::where('prefactura_id', $prefactura->id)->sole();

    expect((float) $renglon->precio_unitario)->toBe(3000.00)
        ->and($renglon->cantidad)->toBe(2)
        ->and($renglon->nombre_servicio)->toBe('Transito 02 hrs — '.$ajena->matricula);
});
```

**Nota sobre los nombres:** `conEstancia()` crea los servicios con nombre **sin acento** (`Transito 12 hrs`), no con el del catálogo real (`Tránsito 12 hrs`). Las pruebas de arriba usan el nombre tal como lo crea el ayudante. El código que compone el nombre no debe escribir el nombre a mano: debe tomar `$servicio->nombre`.

Si `FactServicio::CONCEPTO_ESTANCIA_AJUSTE_2H_12H` o `CONCEPTO_ESTANCIA_AJUSTE_12H_PERNOCTA` no existen con ese nombre exacto, **para y repórtalo** en vez de adivinar: míralas en `app/Models/FactServicio.php`.

- [ ] **Step 2: Correr y ver el rojo**

```bash
TEST_TOKEN=960 php artisan test tests/Feature/Facturacion/EndpointsPrefacturaTest.php
```

Esperado: fallan las pruebas nuevas que mandan `aeronave_id` (hoy el campo se ignora y el servicio de tránsito se rechaza). La de «sin aeronave_id» y las de los ajustes deberían pasar ya: son de no regresión. Anota qué falló y por qué.

- [ ] **Step 3: `StoreRenglonRequest` acepta la matrícula**

Sustituye el método `rules()` entero por:

```php
    public function rules(): array
    {
        return [
            // `bail`: el rechazo de estancia consulta el catálogo y solo tiene sentido si el servicio existe.
            'servicio_id' => [
                'bail',
                'required',
                'integer',
                Rule::exists('fact_servicios', 'id')->where('status', 'A'),
                $this->noEsServicioDeEstancia(...),
            ],
            'cantidad' => ['required', 'integer', 'min:1', 'max:9999'],
            'aeronave_id' => ['bail', 'nullable', 'integer', Rule::exists('aeronaves', 'id'), $this->soloParaTransito(...)],
            'proveedor_id' => ['nullable', 'integer', Rule::exists('fact_proveedores', 'id')->where('status', 'A')],
            'remision' => ['nullable', 'string', 'max:255'],
        ];
    }

    /** Los tres tramos de tránsito, que SÍ se pueden cobrar a nombre de otra aeronave. */
    private function esTramoDeTransito(mixed $servicioId): bool
    {
        return FactServicio::query()
            ->whereKey($servicioId)
            ->whereIn('concepto', [
                FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H,
                FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H,
                FactServicio::CONCEPTO_ESTANCIA_PERNOCTA,
            ])
            ->exists();
    }
```

Sustituye el cuerpo de `noEsServicioDeEstancia` y su docblock por:

```php
    /**
     * Los servicios de estancia no se agregan a mano, con UNA excepción.
     *
     * Su precio real sale de la tarifa de la matrícula y el del catálogo es relleno (99.00 en los
     * tres tramos y 0.0000 en los dos ajustes). Agregarlos a secas congelaría ese relleno en el
     * renglón, sin forma de corregirlo, y además duplicaría el cobro al recalcular la estancia.
     *
     * LA EXCEPCIÓN: los tres TRAMOS de tránsito sí se agregan cuando vienen con `aeronave_id`, es
     * decir cuando se cobra el tránsito de OTRA aeronave. Ahí el precio sale de la tarifa de esa
     * aeronave y el renglón se guarda sin concepto, así que no hay relleno ni doble cobro. Los dos
     * AJUSTES no tienen excepción: son para subir de tramo la estancia propia.
     */
    private function noEsServicioDeEstancia(string $atributo, mixed $valor, \Closure $fallar): void
    {
        $esEstancia = FactServicio::query()
            ->whereKey($valor)
            ->whereIn('concepto', FactServicio::CONCEPTOS_ESTANCIA)
            ->exists();

        if (! $esEstancia) {
            return;
        }

        if ($this->filled('aeronave_id') && $this->esTramoDeTransito($valor)) {
            return;
        }

        $fallar('Los cargos de estancia no se agregan a mano: los pone «Estancia y ajustes», porque su precio sale de la tarifa de la matrícula y no del catálogo.');
    }

    /** `aeronave_id` no significa nada en un servicio normal: aceptarlo escondería un error de quien llama. */
    private function soloParaTransito(string $atributo, mixed $valor, \Closure $fallar): void
    {
        if (! $this->esTramoDeTransito($this->input('servicio_id'))) {
            $fallar('La matrícula solo se indica al cobrar el tránsito de otra aeronave.');
        }
    }
```

Y añade a `messages()`, junto a los demás:

```php
            'aeronave_id.integer' => 'La matrícula no es válida.',
            'aeronave_id.exists' => 'Esa matrícula no está en el sistema.',
```

- [ ] **Step 4: El controlador saca la tarifa y arma el renglón**

En `PrefacturaRenglonController`, añade `use App\Models\FactAeronave;` a los `use` si no está.

Dentro de `store()`, justo después de `$servicio = FactServicio::findOrFail(...)`, añade:

```php
        // El tránsito de OTRA aeronave: el precio sale de la tarifa de esa aeronave y el nombre
        // dice de quién es. Se guarda SIN concepto de estancia, que es lo que lo hace sobrevivir
        // a «Estancia y ajustes» —que borra por concepto— sin duplicarse.
        $ajena = null;

        if ($request->validated()['aeronave_id'] ?? null) {
            $ajena = $this->resolverTransitoAjeno($prefactura, $servicio, (int) $request->validated()['aeronave_id']);

            if ($ajena instanceof JsonResponse) {
                return $ajena;
            }
        }
```

Y en el `create([...])` del renglón, sustituye las dos líneas de nombre y precio y la de concepto por:

```php
                'nombre_servicio' => $ajena === null ? $servicio->nombre : $ajena['nombre'],
                'precio_unitario' => $ajena === null ? $servicio->precio_unitario : $ajena['precio'],
                ...
                'concepto' => $ajena === null ? $servicio->concepto : null,
```

(El `...` representa las líneas intermedias que no cambian: `cantidad`, `es_de_tercero`, `margen`, `ajuste_precio`. Déjalas tal cual.)

Como `$ajena` se usa dentro del closure de `DB::transaction`, añádelo al `use (...)` de ese closure.

Añade el método privado al final de la clase:

```php
    /**
     * El nombre y el precio de un tránsito cobrado a nombre de otra aeronave, o el 422 que
     * corresponda.
     *
     * @return array{nombre: string, precio: string}|JsonResponse
     */
    private function resolverTransitoAjeno(FactPrefactura $prefactura, FactServicio $servicio, int $aeronaveId): array|JsonResponse
    {
        if ($aeronaveId === (int) $prefactura->aeronave_id) {
            return $this->rechazoDeMatricula('Para la estancia de esta aeronave usa «Estancia y ajustes»: por aquí el cargo se duplicaría al recalcular.');
        }

        $ficha = FactAeronave::query()->with('aeronave')->where('aeronave_id', $aeronaveId)->first();
        $matricula = $ficha?->aeronave?->matricula ?? Aeronave::whereKey($aeronaveId)->value('matricula') ?? '';

        if ($ficha === null) {
            return $this->rechazoDeMatricula("{$matricula} no tiene ficha de facturación, así que no hay tarifas que aplicar.");
        }

        if ($ficha->estatus === FactAeronave::ESTATUS_GUARDA) {
            return $this->rechazoDeMatricula("{$matricula} está en Guarda y una aeronave en Guarda no paga estancia.");
        }

        $tarifa = match ($servicio->concepto) {
            FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H => $ficha->tarifaTransito2h(),
            FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H => $ficha->tarifaTransito12h(),
            FactServicio::CONCEPTO_ESTANCIA_PERNOCTA => $ficha->tarifaPernocta(),
        };

        if ($tarifa === null) {
            return $this->rechazoDeMatricula("{$matricula} no tiene tarifa de «{$servicio->nombre}», ni propia ni por su categoría, así que no hay precio que cobrar.");
        }

        return ['nombre' => "{$servicio->nombre} — {$matricula}", 'precio' => (string) $tarifa];
    }

    private function rechazoDeMatricula(string $mensaje): JsonResponse
    {
        return response()->json(['message' => $mensaje, 'errors' => ['aeronave_id' => [$mensaje]]], 422);
    }
```

Añade `use App\Models\Aeronave;` a los `use` de la clase.

El `match` no lleva rama por defecto a propósito: solo llega aquí con uno de los tres tramos, porque `soloParaTransito` rechazó cualquier otro. Si algún día llega otro concepto, el `\UnhandledMatchError` es mejor que cobrar un precio equivocado en silencio.

- [ ] **Step 5: Correr y ver el verde**

```bash
TEST_TOKEN=961 php artisan test tests/Feature/Facturacion/EndpointsPrefacturaTest.php
```

Esperado: **74 pruebas en verde** (las 64 de antes más las 10 nuevas, contando las dos del dataset de ajustes como dos).

Si el recuento no cuadra, no lo fuerces: reporta el número real.

- [ ] **Step 6: Comprobar que las pruebas muerden**

Rompe el código a propósito, corre **solo este archivo**, anota qué se pone en rojo, y restaura:

1. En `resolverTransitoAjeno`, devuelve `$servicio->precio_unitario` en vez de `$tarifa` → debe fallar la del precio y la de cantidad 2.
2. En el `create`, pon `'concepto' => $servicio->concepto` siempre → **debe fallar la del doble cobro**, que es la que define el trabajo.
3. En `noEsServicioDeEstancia`, quita la comprobación `esTramoDeTransito` del `return` temprano → deben fallar las de los ajustes.

Si alguna no se pone en rojo, para y repórtalo.

- [ ] **Step 7: Limpiar y commitear**

```bash
rm -rf storage/framework/testing/disks/public_test_960 storage/framework/testing/disks/local_test_960 storage/framework/testing/disks/public_test_961 storage/framework/testing/disks/local_test_961
git add app/Http/Requests/Facturacion/StoreRenglonRequest.php app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php tests/Feature/Facturacion/EndpointsPrefacturaTest.php
git commit -m "feat(facturacion): cobrar el transito de otra aeronave con su propia tarifa"
```

**Añade solo esos tres archivos.** El árbol tiene cambios de otro trabajo sin commitear; `git add -A` se los llevaría.

---

### Task 2: La pantalla pide la matrícula

**Files:**
- Modify: `resources/js/stores/apiFacturacionCatalogos.ts`
- Modify: `resources/js/pages/Facturacion/components/ModalRenglon.tsx`

**Interfaces:**
- Consumes: el campo `aeronave_id` del endpoint de la Task 1.
- Produces: nada que otra tarea use.

**Contexto:**

Esta tarea **no tiene ciclo TDD**: no hay ejecutor de pruebas de JavaScript. Dilo así en el informe en vez de inventarte uno.

`ModalRenglon.tsx` ya tiene, de un trabajo anterior sin commitear, un menú de **Categoría** que se deriva de los servicios y una constante `MUESTRA_PROVEEDOR = false`. **Respétalos**: no los quites ni los cambies.

Hoy el modal excluye los servicios de estancia con `esConceptoDeEstancia(s.concepto)`, que devuelve `true` para todo concepto que empiece por `estancia_`. Hay que dejar pasar los **tres tramos** y seguir excluyendo los **dos ajustes**.

**El cliente de API ya existe y resuelve las tarifas por ti.** En `apiFacturacionCatalogos.ts`:

```ts
obtenerAeronavesFacturablesApi(filtros: FiltrosAeronaves, pagina: number, porPagina: number): Promise<Pagina<AeronaveFacturable>>
// FiltrosAeronaves = { q: string; estatus: '' | EstatusAeronave; sin_categoria: boolean }
```

y `AeronaveFacturable` trae, además de `aeronave_id`, `matricula` y `estatus`, estas tres, ya con la herencia resuelta —la propia si existe, si no la de su categoría, y `null` si no hay de dónde—:

```ts
tarifa_pernocta_efectiva: string | null;
tarifa_transito_2h_efectiva: string | null;
tarifa_transito_12h_efectiva: string | null;
```

Úsalas tal cual: **no vuelvas a resolver la herencia en el front**. `FILTROS_AERONAVES_VACIOS` da el objeto base.

Mira cómo `SelectorCliente.tsx` hace su búsqueda con retardo; sigue ese mismo patrón.

- [ ] **Step 1: Tomar la línea base de tipos**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Anótalo **antes de tocar nada**. Esperado: `1`.

- [ ] **Step 2: Dejar pasar los tres tramos en el menú**

En `ModalRenglon.tsx`, sustituye el filtro de `opcionesServicio` para que excluya solo los dos ajustes:

```ts
/** Los tres tramos SI se pueden agregar, a nombre de otra aeronave; los dos ajustes no. */
const CONCEPTOS_DE_TRANSITO = ['estancia_transito_2h', 'estancia_transito_12h', 'estancia_pernocta'];

const esTramoDeTransito = (concepto: string | null | undefined): boolean => typeof concepto === 'string' && CONCEPTOS_DE_TRANSITO.includes(concepto);
```

y en el `useMemo` de `opcionesServicio` cambia la condición `!esConceptoDeEstancia(s.concepto)` por `(!esConceptoDeEstancia(s.concepto) || esTramoDeTransito(s.concepto))`.

- [ ] **Step 3: El campo de matrícula, solo para tránsitos**

Añade a los `import` de arriba:

```ts
import { FILTROS_AERONAVES_VACIOS, obtenerAeronavesFacturablesApi, type AeronaveFacturable } from '@/stores/apiFacturacionCatalogos';
```

(únelo al `import` que ya existe de ese módulo en vez de duplicar la línea).

Estado y búsqueda, junto a los demás `useState` del componente:

```ts
    const [busquedaAeronave, setBusquedaAeronave] = useState('');
    const [aeronaves, setAeronaves] = useState<AeronaveFacturable[]>([]);
    const [aeronaveElegida, setAeronaveElegida] = useState<AeronaveFacturable | null>(null);
    const [buscandoAeronave, setBuscandoAeronave] = useState(false);

    const pideMatricula = esTramoDeTransito(servicio?.concepto);
```

El efecto de búsqueda, con el mismo retardo que `SelectorCliente`:

```ts
    useEffect(() => {
        if (! pideMatricula) return;

        let vigente = true;

        const temporizador = setTimeout(async () => {
            setBuscandoAeronave(true);

            try {
                const pagina = await obtenerAeronavesFacturablesApi({ ...FILTROS_AERONAVES_VACIOS, q: busquedaAeronave }, 1, 20);
                if (vigente) setAeronaves(pagina.data);
            } catch {
                if (vigente) setAeronaves([]);
            } finally {
                if (vigente) setBuscandoAeronave(false);
            }
        }, busquedaAeronave === '' ? 0 : ESPERA_AERONAVE_MS);

        return () => {
            vigente = false;
            clearTimeout(temporizador);
        };
    }, [busquedaAeronave, pideMatricula]);
```

con la constante arriba del archivo, junto a `CANTIDAD_MAX`:

```ts
const ESPERA_AERONAVE_MS = 300;
```

En el JSX, debajo del bloque del menú de servicio:

```tsx
                    {pideMatricula && (
                        <div>
                            <label htmlFor="renglon-aeronave" className={labelStyle}>
                                Matrícula de la aeronave <span className="text-red-500">*</span>
                            </label>
                            <p className="mb-1 text-[10px] font-bold text-slate-400 italic">El precio sale de la tarifa de ESTA aeronave, no del catálogo.</p>
                            <input
                                type="text"
                                value={busquedaAeronave}
                                onChange={e => setBusquedaAeronave(e.target.value)}
                                placeholder="Buscar matrícula…"
                                autoComplete="off"
                                className="mb-2 w-full text-[11px] border border-slate-200 p-2 rounded bg-white outline-none focus:border-blue-400"
                                aria-label="Buscar matrícula"
                            />
                            <select
                                id="renglon-aeronave"
                                value={aeronaveElegida === null ? '' : String(aeronaveElegida.aeronave_id)}
                                onChange={e => {
                                    setAeronaveElegida(aeronaves.find(a => String(a.aeronave_id) === e.target.value) ?? null);
                                    limpiarError('aeronave_id');
                                }}
                                className={campoConError(!!errores.aeronave_id)}
                                aria-invalid={errores.aeronave_id ? true : undefined}
                            >
                                <option value="">Elige la aeronave…</option>
                                {aeronaves.map(a => (
                                    <option key={a.aeronave_id} value={a.aeronave_id}>
                                        {a.matricula ?? `Aeronave ${a.aeronave_id}`}
                                    </option>
                                ))}
                            </select>
                            {buscandoAeronave && <p className="mt-1 text-[10px] font-bold text-slate-400 italic">Buscando…</p>}
                            {errores.aeronave_id && <p className={errorStyle}>{errores.aeronave_id}</p>}
                        </div>
                    )}
```

Y en el `onChange` del menú de **servicio**, junto a `setServicioId(...)`, limpia la matrícula: una elegida para otro tramo no debe quedarse colgada.

```ts
                                setAeronaveElegida(null);
                                setBusquedaAeronave('');
```

- [ ] **Step 4: Enviar el campo y validarlo en pantalla**

En `DatosRenglon` añade el campo, y en el tipo `Campo` añade `'aeronave_id'`:

```ts
export interface DatosRenglon {
    servicio_id: number;
    cantidad: number;
    proveedor_id: number | null;
    remision: string | null;
    /** Solo en los tres tramos de tránsito: la aeronave cuya tarifa se cobra. */
    aeronave_id: number | null;
}

type Campo = 'servicio_id' | 'cantidad' | 'proveedor_id' | 'remision' | 'aeronave_id';
```

En `validar()`, añade antes de la comprobación de cantidad:

```ts
        if (pideMatricula && aeronaveElegida === null) nuevos.aeronave_id = 'Elige la aeronave cuyo tránsito se va a cobrar.';
```

En `guardar()`, añade el campo a lo que se envía:

```ts
                aeronave_id: aeronaveElegida?.aeronave_id ?? null,
```

Y en `tieneCambios`, añade `|| aeronaveElegida !== null`.

En `apiFacturacionCatalogos.ts`, busca el tipo que viaja al endpoint de renglones y añádele la misma línea opcional:

```ts
    aeronave_id?: number | null;
```

- [ ] **Step 5: La vista previa usa la tarifa, no el catálogo**

Hoy la vista previa se calcula así, con el precio del catálogo:

```ts
    let vistaPrevia: { importe: number } | { problema: string } | null = null;
    if (servicio && cantidadNumero !== null && cantidadNumero >= 1 && cantidadNumero <= CANTIDAD_MAX) {
        try {
            vistaPrevia = { importe: importeVistaPrevia(Number(servicio.precio_unitario), Number(servicio.margen), servicio.ajuste_precio, cantidadNumero) };
        } catch {
            vistaPrevia = { problema: 'El ajuste de precio de este servicio no se reconoce: no se puede mostrar la vista previa.' };
        }
    }
```

Añade justo encima el precio que corresponde, y usa ese en vez de `servicio.precio_unitario`:

```ts
    /** La tarifa EFECTIVA del tramo —propia o heredada de la categoría—, ya resuelta por el servidor. */
    const tarifaDelTramo = (aeronave: AeronaveFacturable, concepto: string | null | undefined): string | null =>
        concepto === 'estancia_transito_2h' ? aeronave.tarifa_transito_2h_efectiva
            : concepto === 'estancia_transito_12h' ? aeronave.tarifa_transito_12h_efectiva
                : concepto === 'estancia_pernocta' ? aeronave.tarifa_pernocta_efectiva
                    : null;

    // En un tránsito ajeno el precio NO es el del catálogo —ahí vale 99.00, que es relleno— sino
    // la tarifa de la aeronave elegida. Es el mismo precio que el servidor va a cobrar.
    const precioEfectivo = pideMatricula
        ? (aeronaveElegida === null ? null : tarifaDelTramo(aeronaveElegida, servicio?.concepto))
        : (servicio?.precio_unitario ?? null);
```

y la vista previa pasa a:

```ts
    let vistaPrevia: { importe: number } | { problema: string } | null = null;
    if (servicio && pideMatricula && aeronaveElegida !== null && precioEfectivo === null) {
        vistaPrevia = { problema: 'Esta aeronave no tiene tarifa para ese tramo, ni propia ni por su categoría: no hay precio que cobrar.' };
    } else if (servicio && precioEfectivo !== null && cantidadNumero !== null && cantidadNumero >= 1 && cantidadNumero <= CANTIDAD_MAX) {
        try {
            vistaPrevia = { importe: importeVistaPrevia(Number(precioEfectivo), Number(servicio.margen), servicio.ajuste_precio, cantidadNumero) };
        } catch {
            vistaPrevia = { problema: 'El ajuste de precio de este servicio no se reconoce: no se puede mostrar la vista previa.' };
        }
    }
```

Con eso, mientras falte la matrícula no sale importe —`precioEfectivo` es `null`—, y si la aeronave no tiene tarifa se dice en vez de mostrar una cifra falsa. El servidor lo rechaza igual; esto solo evita que lo descubran al guardar.

- [ ] **Step 6: Actualizar el aviso del modal**

El texto que hoy dice «Los cargos de estancia no aparecen aquí: los pone «Estancia y ajustes», porque su precio sale de la tarifa de la matrícula.» ya no es cierto. Sustitúyelo por:

```tsx
                            Los tránsitos de OTRA aeronave se agregan aquí, con su matrícula. La estancia de la aeronave de esta prefactura sale de «Estancia y ajustes», que la calcula con su tarifa.
```

- [ ] **Step 7: Comprobar tipos y compilación**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Esperado: el mismo número del Step 1. Mídelo escribiendo a un archivo si la tubería te da un número raro: `npx tsc --noEmit > /tmp/tsc.txt 2>&1; grep -c "error TS" /tmp/tsc.txt`.

```bash
npm run build
```

Esperado: termina sin errores. Tarda varios minutos.

- [ ] **Step 8: Commit**

```bash
git add resources/js/pages/Facturacion/components/ModalRenglon.tsx resources/js/stores/apiFacturacionCatalogos.ts
git commit -m "feat(facturacion): el modal pide la matricula al cobrar un transito ajeno"
```

**Ojo:** `ModalRenglon.tsx` lleva también cambios de otro trabajo sin commitear. Eso es correcto y esperado; van juntos.

---

### Task 3: La suite entera y la pantalla de verdad

**Files:** ninguno. Esta tarea verifica.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada.

- [ ] **Step 1: La suite entera, en serie**

```bash
TEST_TOKEN=962 php artisan test
```

**Nunca con `--parallel`.** Tarda unos 32 minutos; arráncala en segundo plano. Esperado: **3447** pruebas sin fallos (las 3437 de la rama más las 10 nuevas).

Después: `rm -rf storage/framework/testing/disks/public_test_962 storage/framework/testing/disks/local_test_962`

Si falla algo de `CargosEstancia`, `EstanciaAutomatica` o `CompararEstancia`, **para y repórtalo**: significa que la rendija de la validación tocó algo que no debía.

- [ ] **Step 2: El navegador**

Dos trampas del entorno, las dos medidas. No las redescubras:

- El preview arranca desde `C:\xampp\htdocs\EOLO` (el **padre**), así que lee `EOLO/.claude/launch.json`, no el de `Eolo-plus/`.
- Sanctum solo trata como *stateful* `localhost`, `localhost:3000`, `127.0.0.1`, `127.0.0.1:8000`, `::1` y el host de `APP_URL`. En otro puerto, `/api/*` responde **401** y las tablas salen vacías.

Además: la aplicación sirve desde Vite por `public/hot`, que apunta a `http://192.168.7.10:5173`, **una IP que ya no responde**. Para ver el bundle compilado hay que **apartar ese archivo** (`mv public/hot public/hot.bak`) y **restaurarlo al terminar**. Es imprescindible y es reversible.

Entra como `Administrador EOLO` con la contraseña del seeder `AdminUserSeeder`. Fortify autentica por **`name`**, no por correo. Ese rol salta el chequeo de subdepartamento, así que la pasada por navegador prueba el cableado; el permiso lo cubren las pruebas.

Usa una prefactura con `status = 'A'` y `estado = 'borrador'`: las de `status = 'N'` están descartadas y son de solo lectura. La **22** servía en la última sesión.

Qué comprobar:

1. La categoría **Tránsitos** aparece en el menú.
2. Al elegir **Tránsito 12 hrs** aparece el campo de matrícula; al elegir un servicio normal, no.
3. Al teclear una matrícula ajena y elegirla, la vista previa muestra **la tarifa de esa aeronave**, no $99.
4. **No agregues el renglón**: la base de desarrollo es la real del usuario. Si hace falta probar el guardado, pídeselo antes.

- [ ] **Step 3: Informe**

Con el recuento de la suite, los cuatro puntos del navegador uno a uno, la confirmación de que `public/hot` quedó restaurado, y una captura del modal con el campo de matrícula visible.

Si todo salió verde y no tocaste código, **no hay nada que commitear**: dilo en vez de inventarte un commit.

---

## Qué queda fuera, a propósito

- **Una columna de aeronave en el renglón.** La matrícula vive en el nombre; `servicio_id` conserva el tramo.
- **Reportes por matrícula** de los tránsitos ajenos.
- **Los dos ajustes de estancia**, que siguen saliendo solo de «Estancia y ajustes».
- **`CargosEstancia`**, que no se toca ni una línea.
- **Las otras dos peticiones del menú de categorías** —quitar «Sin categoría» y mostrar «Dugaeam Fee» vacía—, que se hacen después, con el menú ya en su forma final.
