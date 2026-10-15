# Paquetes internacionales por dirección y estancia desde las fechas — Plan de implementación

> **Para trabajadores agénticos:** SUB-SKILL OBLIGATORIA: usa
> superpowers:subagent-driven-development (recomendada) o
> superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos
> usan casillas (`- [ ]`) para seguir el avance.

**Objetivo:** que una llegada internacional cargue sus seis servicios de entrada,
que una salida internacional cargue sus cuatro de salida, y que al guardar la
salida las cantidades de estancia se calculen desde las fechas en lugar de
teclearse.

**Arquitectura:** una calculadora pura traduce (llegada, salida) a las tres
cantidades de estancia y alimenta el `CargosEstancia::recalcular()` que ya existe,
que es quien pone las tarifas de la matrícula y aplica la regla de Guarda. El
paquete internacional deja de ser un booleano en el catálogo y pasa a distinguir
entrada de salida, disparado por dos campos independientes de la prefactura:
`tipo_origen` (nuevo) y `tipo_destino` (ya existe).

**Stack:** Laravel 12, PHP 8.2, Pest 3, Inertia 2 + React 19 + TypeScript,
Tailwind 4. Base MariaDB en producción, **sqlite en las pruebas**.

**Spec:** `docs/superpowers/specs/2026-10-15-facturacion-internacional-y-estancia-design.md`

## Restricciones globales

- **La suite corre EN SERIE**: `php artisan test`. Nunca `--parallel`: da fallos
  falsos en este proyecto.
- **TDD sin excepciones.** Ninguna línea de producción sin una prueba que haya
  fallado antes. Si escribes código antes de la prueba, bórralo y empieza de nuevo.
- **La conexión `remota` es de SOLO LECTURA por contrato.** Ninguna tarea escribe
  en ella. Hay una prueba que lo exige
  (`tests/Feature/Facturacion/SinConexionRemotaTest.php`).
- **Nunca uses `git stash`** en este repositorio.
- **Formato:** `vendor/bin/pint` solo sobre los archivos que creas. Los archivos
  que ya existían llevan años sin pasar por pint y reformatearlos entierra tu
  cambio bajo cientos de líneas ajenas. Comprueba primero si el archivo ya fallaba
  (`git show HEAD:<ruta>` a un directorio aparte y `pint --test` ahí).
- **Prettier:** igual. `resources/js/pages/Facturacion/EditorPrefactura.tsx` NO
  cumple prettier hoy (reescribiría 282 líneas). No lo formatees.
- **Las cantidades de estancia siguen siendo EDITABLES** después del cálculo. Es
  una decisión de la spec, no un olvido.
- **Criterio de aceptación global:** `php artisan facturacion:comparar-estancia`
  debe reportar **86,1 % de acierto sobre 2 803 folios**. Una cifra distinta
  significa que el código no implementa la regla medida.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `app/Services/CalculadoraEstancia.php` (nuevo) | Puro: (llegada, salida) → las tres cantidades. Sin base de datos, sin estado |
| `app/Console/Commands/CompararEstancia.php` (nuevo) | Solo lectura: contrasta la calculadora contra el histórico |
| `app/Services/CargosEstancia.php` | `agregarPaqueteInternacional()` pasa a recibir cuál paquete |
| `app/Models/FactServicio.php` | Constantes del paquete; el cast del booleano se va |
| `app/Models/FactPrefactura.php` | `tipo_origen` en fillable |
| `app/Services/ImportadorMatriculas.php` | Las dos listas de ids del origen |
| `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php` | El endpoint recibe cuál paquete |
| `app/Http/Controllers/Api/Facturacion/PrefacturaController.php` | Recalcula al cambiar la salida |
| `resources/js/pages/Facturacion/EditorPrefactura.tsx` | Hora en 24 h; interruptor de origen |
| `resources/js/pages/Facturacion/components/formato.ts` | Helpers de fecha y hora partidas |

---

### Task 1: La calculadora de estancia

Es la pieza central y es pura: se prueba a fondo sin montar nada. Todo lo demás
depende de que esta regla sea exactamente la medida.

**Archivos:**
- Crear: `app/Services/CalculadoraEstancia.php`
- Prueba: `tests/Unit/CalculadoraEstanciaTest.php`

**Interfaces:**
- Consume: nada.
- Produce: `CalculadoraEstancia::tramos(CarbonInterface $llegada, CarbonInterface $salida): array{pernoctas: int, transitos2h: int, transitos12h: int}`

- [ ] **Paso 1: escribe la prueba que falla**

En `tests/Unit/CalculadoraEstanciaTest.php`:

```php
<?php

use App\Services\CalculadoraEstancia;
use Illuminate\Support\Carbon;

/**
 * La regla salió de medir 2803 folios históricos, no de una conversación: días
 * completos son pernoctas, y el resto cae en un tramo. Acierta en el 86,1%.
 *
 * El caso que más cuesta creer es el último: un resto de MÁS de 12 h no cobra
 * «Tránsito 12 hrs», redondea a una pernocta más. Medido: con esa regla el acierto
 * es 86,1%; cobrando 12 hrs cae al 62,0%. No lo «arregles».
 */
function tramos(string $llegada, string $salida): array
{
    return CalculadoraEstancia::tramos(Carbon::parse($llegada), Carbon::parse($salida));
}

test('siete dias exactos son siete pernoctas y nada mas', function () {
    expect(tramos('2026-10-15 12:00:00', '2026-10-22 12:00:00'))
        ->toBe(['pernoctas' => 7, 'transitos2h' => 0, 'transitos12h' => 0]);
});

test('siete dias y ocho horas y cuarto son siete pernoctas y un transito de 12 h', function () {
    // El segundo ejemplo que dio el departamento, tal cual.
    expect(tramos('2026-10-15 12:00:00', '2026-10-22 20:15:00'))
        ->toBe(['pernoctas' => 7, 'transitos2h' => 0, 'transitos12h' => 1]);
});

test('el resto decide el tramo, y las fronteras son inclusivas por abajo', function (string $salida, array $esperado) {
    expect(tramos('2026-10-15 12:00:00', $salida))->toBe($esperado);
})->with([
    'un minuto'          => ['2026-10-15 12:01:00', ['pernoctas' => 0, 'transitos2h' => 1, 'transitos12h' => 0]],
    'dos horas exactas'  => ['2026-10-15 14:00:00', ['pernoctas' => 0, 'transitos2h' => 1, 'transitos12h' => 0]],
    'dos horas y un min' => ['2026-10-15 14:01:00', ['pernoctas' => 0, 'transitos2h' => 0, 'transitos12h' => 1]],
    'doce horas exactas' => ['2026-10-16 00:00:00', ['pernoctas' => 0, 'transitos2h' => 0, 'transitos12h' => 1]],
    'doce horas y un min'=> ['2026-10-16 00:01:00', ['pernoctas' => 1, 'transitos2h' => 0, 'transitos12h' => 0]],
    'un dia exacto'      => ['2026-10-16 12:00:00', ['pernoctas' => 1, 'transitos2h' => 0, 'transitos12h' => 0]],
]);

test('una estancia de cero o negativa no cobra nada', function (string $salida) {
    expect(tramos('2026-10-15 12:00:00', $salida))
        ->toBe(['pernoctas' => 0, 'transitos2h' => 0, 'transitos12h' => 0]);
})->with([
    'misma fecha y hora' => ['2026-10-15 12:00:00'],
    'salida anterior'    => ['2026-10-14 12:00:00'],
]);

test('los segundos sueltos no suman un minuto', function () {
    // 2 h y 59 s sigue siendo el tramo de 2 h: se trunca, no se redondea.
    expect(tramos('2026-10-15 12:00:00', '2026-10-15 14:00:59'))
        ->toBe(['pernoctas' => 0, 'transitos2h' => 1, 'transitos12h' => 0]);
});
```

- [ ] **Paso 2: corre la prueba y comprueba que falla**

```bash
php artisan test tests/Unit/CalculadoraEstanciaTest.php
```

Esperado: FALLA con `Class "App\Services\CalculadoraEstancia" not found`.

- [ ] **Paso 3: escribe la implementación mínima**

En `app/Services/CalculadoraEstancia.php`:

```php
<?php

namespace App\Services;

use Carbon\CarbonInterface;

/**
 * Las cantidades de estancia que corresponden a una llegada y una salida.
 *
 * Pura a propósito: sin base de datos y sin estado. Así se puede contrastar contra
 * los 2803 folios históricos (`facturacion:comparar-estancia`) sin montar nada, y
 * esa comparación es el criterio de aceptación de la regla.
 *
 * La regla se midió, no se acordó. Días completos son pernoctas y el resto cae en
 * un tramo. Un resto de MÁS de 12 h redondea a una pernocta más: medido, esa
 * variante acierta en el 86,1% y cobrarlo como «Tránsito 12 hrs» baja al 62,0%.
 *
 * Quien ponga aquí las tarifas se equivoca de sitio: esto solo cuenta. El precio
 * sale de la matrícula, en `CargosEstancia::recalcular()`.
 */
final class CalculadoraEstancia
{
    private const MINUTOS_POR_DIA = 1440;

    private const TOPE_TRANSITO_2H = 120;

    private const TOPE_TRANSITO_12H = 720;

    /**
     * @return array{pernoctas: int, transitos2h: int, transitos12h: int}
     */
    public static function tramos(CarbonInterface $llegada, CarbonInterface $salida): array
    {
        // Sin valor absoluto: una salida anterior a la llegada da negativo y no cobra.
        // El editor ya rechaza ese caso; aquí se responde igual en vez de lanzar, para
        // no ser una segunda puerta con otra respuesta.
        $minutos = (int) $llegada->diffInMinutes($salida, false);

        if ($minutos <= 0) {
            return self::nada();
        }

        $dias = intdiv($minutos, self::MINUTOS_POR_DIA);
        $resto = $minutos % self::MINUTOS_POR_DIA;

        if ($resto === 0) {
            return self::nada(pernoctas: $dias);
        }

        if ($resto <= self::TOPE_TRANSITO_2H) {
            return self::nada(pernoctas: $dias, transitos2h: 1);
        }

        if ($resto <= self::TOPE_TRANSITO_12H) {
            return self::nada(pernoctas: $dias, transitos12h: 1);
        }

        return self::nada(pernoctas: $dias + 1);
    }

    /**
     * @return array{pernoctas: int, transitos2h: int, transitos12h: int}
     */
    private static function nada(int $pernoctas = 0, int $transitos2h = 0, int $transitos12h = 0): array
    {
        return ['pernoctas' => $pernoctas, 'transitos2h' => $transitos2h, 'transitos12h' => $transitos12h];
    }
}
```

- [ ] **Paso 4: corre la prueba y comprueba que pasa**

```bash
php artisan test tests/Unit/CalculadoraEstanciaTest.php
```

Esperado: PASAN las 5 pruebas (11 casos con los datasets).

- [ ] **Paso 5: comprueba por mutación que las pruebas muerden**

Cambia a mano `$dias + 1` por `$dias` en la última rama y vuelve a correr: debe
ponerse roja la del dataset `'doce horas y un min'`. Deshaz el cambio.

Si NO se pone roja, la prueba no vale: arréglala antes de seguir.

- [ ] **Paso 6: formato y commit**

```bash
vendor/bin/pint app/Services/CalculadoraEstancia.php tests/Unit/CalculadoraEstanciaTest.php
php artisan test tests/Unit/CalculadoraEstanciaTest.php
git add app/Services/CalculadoraEstancia.php tests/Unit/CalculadoraEstanciaTest.php
git commit -m "feat: la calculadora de estancia, medida contra el historico"
```

---

### Task 2: El comando que verifica la regla contra el histórico

Esta tarea no cambia comportamiento: **demuestra** que la Task 1 reproduce lo que
hizo el sistema viejo. Va aquí a propósito, antes de que nada dependa de la regla.

**Archivos:**
- Crear: `app/Console/Commands/CompararEstancia.php`
- Prueba: `tests/Feature/Facturacion/CompararEstanciaTest.php`

**Interfaces:**
- Consume: `CalculadoraEstancia::tramos()` de la Task 1.
- Produce: el comando `facturacion:comparar-estancia`.

**Datos del origen que necesitas** (conexión `remota`, SOLO LECTURA):

| Tabla | Columnas |
|---|---|
| `tb_llegadas` | `fol_prefactura`, `Fecha_lleg`, `Fecha_sal` |
| `tb_venta` | `fol_prefactura`, `id_servicio`, `cantidad` |

Ids de servicio del origen: **2** = `Tránsito 02 hrs`, **3** = `Tránsito 12 hrs`,
**4** = `Tránsito 24 hrs - pernocta`.

- [ ] **Paso 1: escribe la prueba que falla**

En `tests/Feature/Facturacion/CompararEstanciaTest.php`:

```php
<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * El comando es de SOLO LECTURA sobre `remota`. Aquí se le da una sqlite en memoria
 * con cuatro folios de forma conocida y se comprueba que cuenta bien los aciertos.
 */
function prepararLegacyEstancia(array $llegadas, array $ventas): void
{
    config(['database.connections.remota' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
    DB::purge('remota');

    $esquema = Schema::connection('remota');

    $esquema->create('tb_llegadas', function ($t) {
        $t->integer('id_llegada', true);
        $t->integer('fol_prefactura');
        $t->dateTime('Fecha_lleg')->nullable();
        $t->dateTime('Fecha_sal')->nullable();
    });
    $esquema->create('tb_venta', function ($t) {
        $t->integer('id_venta', true);
        $t->integer('fol_prefactura');
        $t->integer('id_servicio');
        $t->integer('cantidad');
    });

    DB::connection('remota')->table('tb_llegadas')->insert($llegadas);
    DB::connection('remota')->table('tb_venta')->insert($ventas);
}

test('cuenta como acierto el folio cuyas cantidades coinciden con la regla', function () {
    prepararLegacyEstancia(
        [['fol_prefactura' => 100, 'Fecha_lleg' => '2026-10-15 12:00:00', 'Fecha_sal' => '2026-10-22 12:00:00']],
        [['fol_prefactura' => 100, 'id_servicio' => 4, 'cantidad' => 7]],
    );

    $this->artisan('facturacion:comparar-estancia')
        ->expectsOutputToContain('Folios comparados: 1')
        ->expectsOutputToContain('acierta')
        ->assertSuccessful();
});

test('cuenta como fallo el folio cuyas cantidades no coinciden, y dice el patron', function () {
    prepararLegacyEstancia(
        [['fol_prefactura' => 101, 'Fecha_lleg' => '2026-10-15 12:00:00', 'Fecha_sal' => '2026-10-22 12:00:00']],
        [['fol_prefactura' => 101, 'id_servicio' => 4, 'cantidad' => 1]],
    );

    $this->artisan('facturacion:comparar-estancia')
        ->expectsOutputToContain('pred 7/0/0 vs real 1/0/0')
        ->assertSuccessful();
});

test('las fechas inservibles se cuentan aparte y no como fallo', function () {
    prepararLegacyEstancia(
        [
            ['fol_prefactura' => 102, 'Fecha_lleg' => '2026-10-22 12:00:00', 'Fecha_sal' => '2026-10-15 12:00:00'],
            ['fol_prefactura' => 103, 'Fecha_lleg' => '2026-10-15 12:00:00', 'Fecha_sal' => null],
        ],
        [
            ['fol_prefactura' => 102, 'id_servicio' => 4, 'cantidad' => 1],
            ['fol_prefactura' => 103, 'id_servicio' => 4, 'cantidad' => 1],
        ],
    );

    $this->artisan('facturacion:comparar-estancia')
        ->expectsOutputToContain('Folios comparados: 0')
        ->expectsOutputToContain('Con fechas inservibles: 2')
        ->assertSuccessful();
});

test('el folio sin renglones de estancia no entra en la comparacion', function () {
    prepararLegacyEstancia(
        [['fol_prefactura' => 104, 'Fecha_lleg' => '2026-10-15 12:00:00', 'Fecha_sal' => '2026-10-22 12:00:00']],
        [['fol_prefactura' => 104, 'id_servicio' => 7, 'cantidad' => 1]],
    );

    $this->artisan('facturacion:comparar-estancia')
        ->expectsOutputToContain('Folios comparados: 0')
        ->assertSuccessful();
});

test('el comando NO escribe en la conexion remota', function () {
    prepararLegacyEstancia(
        [['fol_prefactura' => 105, 'Fecha_lleg' => '2026-10-15 12:00:00', 'Fecha_sal' => '2026-10-22 12:00:00']],
        [['fol_prefactura' => 105, 'id_servicio' => 4, 'cantidad' => 7]],
    );

    $antes = DB::connection('remota')->table('tb_venta')->count();
    $this->artisan('facturacion:comparar-estancia')->assertSuccessful();

    expect(DB::connection('remota')->table('tb_venta')->count())->toBe($antes)
        ->and(DB::connection('remota')->table('tb_llegadas')->count())->toBe(1);
});
```

- [ ] **Paso 2: corre la prueba y comprueba que falla**

```bash
php artisan test tests/Feature/Facturacion/CompararEstanciaTest.php
```

Esperado: FALLA con `The command "facturacion:comparar-estancia" does not exist.`

- [ ] **Paso 3: escribe la implementación**

En `app/Console/Commands/CompararEstancia.php`:

```php
<?php

namespace App\Console\Commands;

use App\Services\CalculadoraEstancia;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Contrasta `CalculadoraEstancia` contra lo que el sistema viejo cobró de verdad.
 *
 * Es el criterio de aceptación de la regla, no un informe más: sobre el volcado
 * completo debe reportar 86,1% de acierto en 2803 folios. Si da otra cifra, el
 * código no implementa la regla que se midió al diseñar esto.
 *
 * Solo lectura, como `comparar-prefacturas` y `comparar-pagos`.
 */
class CompararEstancia extends Command
{
    protected $signature = 'facturacion:comparar-estancia
        {--detalle=10 : Cuántos patrones de desajuste enumerar}';

    protected $description = 'Compara las cantidades de estancia históricas contra CalculadoraEstancia (solo lectura)';

    /** `tb_venta.id_servicio` de los tres tramos en el sistema viejo. */
    private const S_2H = 2;

    private const S_12H = 3;

    private const S_PERNOCTA = 4;

    public function handle(): int
    {
        $origen = config('database.connections.remota.database');
        $this->line("Comparando contra '{$origen}'. Este comando no escribe nada.");

        $conexion = DB::connection('remota');

        $reales = [];
        foreach ($conexion->table('tb_venta')
            ->whereIn('id_servicio', [self::S_2H, self::S_12H, self::S_PERNOCTA])
            ->selectRaw('fol_prefactura, id_servicio, sum(cantidad) c')
            ->groupBy('fol_prefactura', 'id_servicio')
            ->get() as $fila) {
            $reales[$fila->fol_prefactura][$fila->id_servicio] = (int) $fila->c;
        }

        $aciertos = 0;
        $fallos = 0;
        $inservibles = 0;
        $patrones = [];

        foreach ($conexion->table('tb_llegadas')->get() as $llegada) {
            $folio = $llegada->fol_prefactura;

            if (! isset($reales[$folio])) {
                continue;
            }

            $ini = $this->momento($llegada->Fecha_lleg);
            $fin = $this->momento($llegada->Fecha_sal);

            if ($ini === null || $fin === null || $fin->lessThanOrEqualTo($ini)) {
                $inservibles++;

                continue;
            }

            $pred = CalculadoraEstancia::tramos($ini, $fin);

            $realP = $reales[$folio][self::S_PERNOCTA] ?? 0;
            $real12 = $reales[$folio][self::S_12H] ?? 0;
            $real2 = $reales[$folio][self::S_2H] ?? 0;

            if ($pred['pernoctas'] === $realP && $pred['transitos12h'] === $real12 && $pred['transitos2h'] === $real2) {
                $aciertos++;

                continue;
            }

            $fallos++;
            $clave = sprintf('pred %d/%d/%d vs real %d/%d/%d',
                $pred['pernoctas'], $pred['transitos12h'], $pred['transitos2h'], $realP, $real12, $real2);
            $patrones[$clave] = ($patrones[$clave] ?? 0) + 1;
        }

        $total = $aciertos + $fallos;

        $this->newLine();
        $this->line(sprintf('Folios comparados: %d', $total));
        $this->line(sprintf('  La regla acierta en: %d  (%.1f%%)', $aciertos, $total ? 100 * $aciertos / $total : 0));
        $this->line(sprintf('  Falla en:            %d  (%.1f%%)', $fallos, $total ? 100 * $fallos / $total : 0));
        $this->line(sprintf('  Con fechas inservibles: %d', $inservibles));

        if ($patrones !== []) {
            arsort($patrones);
            $this->newLine();
            $this->line('Los desajustes más frecuentes (pernocta/12h/2h):');

            foreach (array_slice($patrones, 0, (int) $this->option('detalle'), true) as $clave => $cuantos) {
                $this->line(sprintf('  %5d x  %s', $cuantos, $clave));
            }
        }

        $this->newLine();
        $this->line('Qué prueba esto: que la regla reproduce lo que el sistema viejo cobró.');
        $this->line('Qué NO prueba: que el cobro del viejo fuera correcto. Un desajuste puede');
        $this->line('ser una cortesía del operador o un acuerdo a tanto alzado, no un defecto.');

        return self::SUCCESS;
    }

    private function momento(mixed $valor): ?Carbon
    {
        if (! $valor) {
            return null;
        }

        try {
            return Carbon::parse((string) $valor);
        } catch (\Throwable) {
            return null;
        }
    }
}
```

- [ ] **Paso 4: corre la prueba y comprueba que pasa**

```bash
php artisan test tests/Feature/Facturacion/CompararEstanciaTest.php
```

Esperado: PASAN las 5.

- [ ] **Paso 5: corre el comando contra el volcado real — ESTE ES EL CRITERIO DE ACEPTACIÓN**

```bash
php artisan facturacion:comparar-estancia
```

Esperado, exactamente:

```
Folios comparados: 2803
  La regla acierta en: 2412  (86.1%)
  Falla en:            391  (13.9%)
  Con fechas inservibles: 31
```

**Si la cifra no es 86,1 % sobre 2 803 folios, PARA.** No ajustes la regla para
que cuadre: averigua por qué difiere. Las causas probables son que `remota` apunte
a otra base (debe ser `fact_fbo_20261014`) o que la calculadora de la Task 1 no sea
la de la spec.

- [ ] **Paso 6: formato y commit**

```bash
vendor/bin/pint app/Console/Commands/CompararEstancia.php tests/Feature/Facturacion/CompararEstanciaTest.php
git add app/Console/Commands/CompararEstancia.php tests/Feature/Facturacion/CompararEstanciaTest.php
git commit -m "feat: comando que verifica la estancia contra el historico (86,1%)"
```

---

### Task 3: El catálogo distingue paquete de entrada y de salida

**Archivos:**
- Crear: `database/migrations/2026_10_15_100000_cambiar_paquete_internacional_en_fact_servicios.php`
- Modificar: `app/Models/FactServicio.php` (fillable y casts, líneas 62 y 74)
- Modificar: `app/Services/ImportadorMatriculas.php` (la constante de la línea 84)
- Prueba: `tests/Feature/Facturacion/PaqueteInternacionalCatalogoTest.php`

**Interfaces:**
- Consume: nada.
- Produce: `FactServicio::PAQUETE_ENTRADA = 'entrada'`, `FactServicio::PAQUETE_SALIDA = 'salida'`,
  y la columna `fact_servicios.paquete_internacional` (`string(10)`, nullable).

**Las dos listas, por id del ORIGEN** (los ids locales NO coinciden: `Servicios
Internacionales - entrada` es 92 allá y 38 aquí):

| Paquete | Ids del origen | Nombres |
|---|---|---|
| `entrada` | 8, 11, 12, 13, 15, 92 | DSMEE - entrada, DNR - entrada, Autorización de Internacion unica - AIU, Mex-eAPI - entrada, Basura Internacional by SENASICA, Servicios Internacionales - entrada |
| `salida` | 9, 10, 14, 93 | DSMES - salida, DSM - salida, Mex-eAPI - salida, Servicios Internacionales - salida |

`Despacho de Vuelos` NO entra: aparece en el 53 % de los folios nacionales.

- [ ] **Paso 1: escribe la prueba que falla**

En `tests/Feature/Facturacion/PaqueteInternacionalCatalogoTest.php`:

```php
<?php

use App\Models\FactServicio;

/**
 * El paquete internacional deja de ser un sí/no y pasa a decir de qué dirección es.
 * El origen internacional pide los de ENTRADA; el destino, los de SALIDA. Medido:
 * de 485 folios internacionales, 386 lo son en una sola dirección.
 */
test('un servicio puede pertenecer al paquete de entrada, al de salida, o a ninguno', function () {
    $entrada = FactServicio::create(['nombre' => 'DSMEE - entrada', 'precio_unitario' => 4060.50, 'paquete_internacional' => FactServicio::PAQUETE_ENTRADA]);
    $salida = FactServicio::create(['nombre' => 'DSMES - salida', 'precio_unitario' => 4060.50, 'paquete_internacional' => FactServicio::PAQUETE_SALIDA]);
    $suelto = FactServicio::create(['nombre' => 'Despacho de Vuelos', 'precio_unitario' => 900]);

    expect($entrada->fresh()->paquete_internacional)->toBe('entrada')
        ->and($salida->fresh()->paquete_internacional)->toBe('salida')
        ->and($suelto->fresh()->paquete_internacional)->toBeNull();
});

/**
 * El marcado se prueba invocándolo, no corriendo la migración: en sqlite la suite
 * migra desde cero y `fact_servicios` nace vacía, así que cuando la migración pasó
 * no había nada que marcar. Por eso el marcado vive en un método estático público
 * de la clase de la migración.
 */
function marcarPaquetesDePrueba(): array
{
    $migracion = require database_path('migrations/2026_10_15_100000_cambiar_paquete_internacional_en_fact_servicios.php');

    return $migracion::marcarPaquetes();
}

test('el marcado deja los cuatro de salida como salida', function () {
    // Se emparejan por NOMBRE: los ids locales no son los del origen.
    foreach (['DSM - salida', 'DSMES - salida', 'Mex-eAPI - salida', 'Servicios Internacionales - salida'] as $nombre) {
        FactServicio::create(['nombre' => $nombre, 'precio_unitario' => 100]);
    }

    marcarPaquetesDePrueba();

    expect(FactServicio::where('paquete_internacional', FactServicio::PAQUETE_SALIDA)->pluck('nombre')->sort()->values()->all())
        ->toBe(['DSM - salida', 'DSMES - salida', 'Mex-eAPI - salida', 'Servicios Internacionales - salida']);
});

test('el marcado deja los seis de entrada como entrada', function () {
    $entrada = [
        'Autorización de Internacion unica - AIU',
        'Basura Internacional by SENASICA',
        'DNR - entrada',
        'DSMEE - entrada',
        'Mex-eAPI - entrada',
        'Servicios Internacionales - entrada',
    ];

    foreach ($entrada as $nombre) {
        FactServicio::create(['nombre' => $nombre, 'precio_unitario' => 100]);
    }

    marcarPaquetesDePrueba();

    expect(FactServicio::where('paquete_internacional', FactServicio::PAQUETE_ENTRADA)->pluck('nombre')->sort()->values()->all())
        ->toBe($entrada);
});

test('Despacho de Vuelos NO entra en ningun paquete', function () {
    // Está en el 53% de los folios puramente nacionales: no es un servicio internacional.
    FactServicio::create(['nombre' => 'Despacho de Vuelos', 'precio_unitario' => 900]);

    marcarPaquetesDePrueba();

    expect(FactServicio::where('nombre', 'Despacho de Vuelos')->value('paquete_internacional'))->toBeNull();
});

test('un servicio del paquete que no esta en el catalogo se reporta, y el resto se marca igual', function () {
    // La spec lo exige: una migración que falle a medias deja el catálogo peor que un
    // paquete incompleto, que la pantalla ya sabe avisar.
    FactServicio::create(['nombre' => 'DSMES - salida', 'precio_unitario' => 100]);

    $resultado = marcarPaquetesDePrueba();

    expect($resultado['salida'])->toBe(1)
        ->and($resultado['no_encontrados'])->toContain('DSM - salida')
        ->and($resultado['no_encontrados'])->toContain('DSMEE - entrada');
});
```

- [ ] **Paso 2: corre la prueba y comprueba que falla**

```bash
php artisan test tests/Feature/Facturacion/PaqueteInternacionalCatalogoTest.php
```

Esperado: FALLA con `Undefined constant App\Models\FactServicio::PAQUETE_ENTRADA`.

- [ ] **Paso 3: la migración**

En `database/migrations/2026_10_15_100000_cambiar_paquete_internacional_en_fact_servicios.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * El paquete internacional no es uno, son dos, y los dispara una dirección distinta:
 * el origen internacional pide los servicios de ENTRADA y el destino los de SALIDA.
 * Medido sobre el histórico: de 485 folios internacionales, 386 lo son en una sola
 * dirección, así que un único paquete acierta en el 20% de los casos.
 *
 * El emparejamiento es por NOMBRE y no por id: el importador renumera los servicios
 * al traerlos, y `Servicios Internacionales - entrada` es el 92 en el origen y el 38
 * aquí. Un nombre que no se encuentre se registra y la migración sigue: dejar el
 * catálogo a medias sería peor que un paquete incompleto, que la pantalla ya avisa.
 */
return new class extends Migration
{
    public const ENTRADA = [
        'DSMEE - entrada',
        'DNR - entrada',
        'Autorización de Internacion unica - AIU',
        'Mex-eAPI - entrada',
        'Basura Internacional by SENASICA',
        'Servicios Internacionales - entrada',
    ];

    public const SALIDA = [
        'DSMES - salida',
        'DSM - salida',
        'Mex-eAPI - salida',
        'Servicios Internacionales - salida',
    ];

    public function up(): void
    {
        Schema::table('fact_servicios', function (Blueprint $table) {
            $table->string('paquete_internacional', 10)->nullable()->after('concepto');
        });

        $resultado = self::marcarPaquetes();

        if ($resultado['no_encontrados'] !== []) {
            Log::warning('Servicios del paquete internacional que no están en el catálogo y quedaron sin marcar', [
                'nombres' => $resultado['no_encontrados'],
            ]);
        }

        Schema::table('fact_servicios', function (Blueprint $table) {
            $table->dropColumn('en_paquete_internacional');
        });
    }

    /**
     * Marca los dos paquetes por nombre. Público y estático para que la prueba pueda
     * invocarlo sobre servicios que ella misma crea: en sqlite la tabla nace vacía.
     *
     * Un nombre que no esté en el catálogo se devuelve en `no_encontrados` y la
     * migración sigue. Dejar el catálogo a medias sería peor que un paquete
     * incompleto, que `agregarPaqueteInternacional()` ya avisa por pantalla.
     *
     * @return array{entrada: int, salida: int, no_encontrados: list<string>}
     */
    public static function marcarPaquetes(): array
    {
        $existentes = DB::table('fact_servicios')
            ->whereIn('nombre', array_merge(self::ENTRADA, self::SALIDA))
            ->pluck('nombre')
            ->all();

        return [
            'entrada' => DB::table('fact_servicios')->whereIn('nombre', self::ENTRADA)->update(['paquete_internacional' => 'entrada']),
            'salida' => DB::table('fact_servicios')->whereIn('nombre', self::SALIDA)->update(['paquete_internacional' => 'salida']),
            'no_encontrados' => array_values(array_diff(array_merge(self::ENTRADA, self::SALIDA), $existentes)),
        ];
    }

    public function down(): void
    {
        Schema::table('fact_servicios', function (Blueprint $table) {
            $table->boolean('en_paquete_internacional')->default(false)->after('concepto');
        });

        DB::table('fact_servicios')->whereIn('nombre', self::SALIDA)->update(['en_paquete_internacional' => true]);

        Schema::table('fact_servicios', function (Blueprint $table) {
            $table->dropColumn('paquete_internacional');
        });
    }
};
```

- [ ] **Paso 4: el modelo**

En `app/Models/FactServicio.php`, junto a las otras constantes (hacia la línea 30):

```php
    /** Servicios que carga una LLEGADA internacional. */
    public const PAQUETE_ENTRADA = 'entrada';

    /** Servicios que carga una SALIDA internacional. */
    public const PAQUETE_SALIDA = 'salida';
```

En `$fillable` (línea 62), sustituye `'en_paquete_internacional',` por
`'paquete_internacional',`.

En `casts()` (línea 74), **borra** la línea `'en_paquete_internacional' => 'boolean',`
sin sustituirla: una cadena no lleva cast.

- [ ] **Paso 5: el importador**

En `app/Services/ImportadorMatriculas.php`, sustituye la constante de la línea 84:

```php
    /** Los cuatro que `insert22.php` agrega cuando el DESTINO es internacional. */
    private const SERVICIOS_PAQUETE_SALIDA = [9, 10, 14, 93];

    /**
     * Los seis que el sistema viejo agrega cuando el ORIGEN es internacional. Sin
     * «Despacho de Vuelos» (id 24): medido, está en el 53% de los folios puramente
     * nacionales, así que no es un servicio del paquete.
     */
    private const SERVICIOS_PAQUETE_ENTRADA = [8, 11, 12, 13, 15, 92];
```

Y en la línea 838, sustituye la asignación:

```php
                'paquete_internacional' => match (true) {
                    in_array($idViejo, self::SERVICIOS_PAQUETE_ENTRADA, true) => FactServicio::PAQUETE_ENTRADA,
                    in_array($idViejo, self::SERVICIOS_PAQUETE_SALIDA, true) => FactServicio::PAQUETE_SALIDA,
                    default => null,
                },
```

- [ ] **Paso 6: corre las pruebas tocadas**

```bash
php artisan test tests/Feature/Facturacion/PaqueteInternacionalCatalogoTest.php tests/Feature/Facturacion/ImportadorMatriculasTest.php tests/Feature/Facturacion/CargosEstanciaTest.php
```

Esperado: todas en verde. Si `CargosEstanciaTest` falla, es porque
`agregarPaqueteInternacional()` todavía consulta `en_paquete_internacional`:
**eso es la Task 4**, no lo arregles aquí; anótalo y sigue.

Si no puedes dejar la suite verde sin tocar `CargosEstancia`, haz el cambio mínimo
en este punto: sustituye `->where('en_paquete_internacional', true)` por
`->whereNotNull('paquete_internacional')`. La Task 4 lo parametriza.

- [ ] **Paso 7: formato y commit**

```bash
vendor/bin/pint database/migrations/2026_10_15_100000_cambiar_paquete_internacional_en_fact_servicios.php tests/Feature/Facturacion/PaqueteInternacionalCatalogoTest.php
php artisan migrate
php artisan test tests/Feature/Facturacion/
git add -A app/Models/FactServicio.php app/Services/ImportadorMatriculas.php app/Services/CargosEstancia.php database/migrations tests/Feature/Facturacion/PaqueteInternacionalCatalogoTest.php
git commit -m "feat: el catalogo distingue paquete internacional de entrada y de salida"
```

---

### Task 4: `agregarPaqueteInternacional()` recibe cuál paquete

**Archivos:**
- Modificar: `app/Services/CargosEstancia.php` (el método de la línea 226)
- Modificar: `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php` (`internacional()`, línea 332)
- Prueba: `tests/Feature/Facturacion/CargosEstanciaTest.php` (añadir)

**Interfaces:**
- Consume: `FactServicio::PAQUETE_ENTRADA` y `PAQUETE_SALIDA` de la Task 3.
- Produce: `CargosEstancia::agregarPaqueteInternacional(FactPrefactura $prefactura, string $paquete): array{renglones: int, en_paquete: int, activos: int, faltantes: list<string>, motivo: ?string}`

- [ ] **Paso 1: escribe la prueba que falla**

Añade al final de `tests/Feature/Facturacion/CargosEstanciaTest.php`:

```php
test('el paquete de ENTRADA agrega solo sus servicios, y no los de salida', function () {
    $prefactura = prefacturaBorrador();
    $entrada = App\Models\FactServicio::create(['nombre' => 'DSMEE - entrada', 'precio_unitario' => 4060.50, 'paquete_internacional' => App\Models\FactServicio::PAQUETE_ENTRADA]);
    App\Models\FactServicio::create(['nombre' => 'DSMES - salida', 'precio_unitario' => 4060.50, 'paquete_internacional' => App\Models\FactServicio::PAQUETE_SALIDA]);

    $resultado = app(App\Services\CargosEstancia::class)
        ->agregarPaqueteInternacional($prefactura, App\Models\FactServicio::PAQUETE_ENTRADA);

    expect($resultado['renglones'])->toBe(1)
        ->and($prefactura->fresh()->renglones()->pluck('servicio_id')->all())->toBe([$entrada->id]);
});

test('el paquete de SALIDA agrega solo sus servicios, y no los de entrada', function () {
    $prefactura = prefacturaBorrador();
    App\Models\FactServicio::create(['nombre' => 'DSMEE - entrada', 'precio_unitario' => 4060.50, 'paquete_internacional' => App\Models\FactServicio::PAQUETE_ENTRADA]);
    $salida = App\Models\FactServicio::create(['nombre' => 'DSMES - salida', 'precio_unitario' => 4060.50, 'paquete_internacional' => App\Models\FactServicio::PAQUETE_SALIDA]);

    $resultado = app(App\Services\CargosEstancia::class)
        ->agregarPaqueteInternacional($prefactura, App\Models\FactServicio::PAQUETE_SALIDA);

    expect($resultado['renglones'])->toBe(1)
        ->and($prefactura->fresh()->renglones()->pluck('servicio_id')->all())->toBe([$salida->id]);
});

test('agregar los dos paquetes deja los dos, sin duplicar', function () {
    $prefactura = prefacturaBorrador();
    App\Models\FactServicio::create(['nombre' => 'DSMEE - entrada', 'precio_unitario' => 4060.50, 'paquete_internacional' => App\Models\FactServicio::PAQUETE_ENTRADA]);
    App\Models\FactServicio::create(['nombre' => 'DSMES - salida', 'precio_unitario' => 4060.50, 'paquete_internacional' => App\Models\FactServicio::PAQUETE_SALIDA]);

    $servicio = app(App\Services\CargosEstancia::class);
    $servicio->agregarPaqueteInternacional($prefactura, App\Models\FactServicio::PAQUETE_ENTRADA);
    $servicio->agregarPaqueteInternacional($prefactura, App\Models\FactServicio::PAQUETE_SALIDA);
    // Repetido a propósito: no debe duplicar.
    $tercero = $servicio->agregarPaqueteInternacional($prefactura, App\Models\FactServicio::PAQUETE_ENTRADA);

    expect($tercero['renglones'])->toBe(0)
        ->and($prefactura->fresh()->renglones()->count())->toBe(2);
});

test('un paquete que no existe se rechaza en vez de agregar nada', function () {
    $prefactura = prefacturaBorrador();

    expect(fn () => app(App\Services\CargosEstancia::class)->agregarPaqueteInternacional($prefactura, 'tranvia'))
        ->toThrow(InvalidArgumentException::class);
});
```

- [ ] **Paso 2: corre la prueba y comprueba que falla**

```bash
php artisan test tests/Feature/Facturacion/CargosEstanciaTest.php
```

Esperado: FALLA con `Too few arguments` o `ArgumentCountError`.

- [ ] **Paso 3: el servicio**

En `app/Services/CargosEstancia.php`, cambia la firma y la consulta del paquete:

```php
    public function agregarPaqueteInternacional(FactPrefactura $prefactura, string $paquete): array
    {
        if (! in_array($paquete, [FactServicio::PAQUETE_ENTRADA, FactServicio::PAQUETE_SALIDA], true)) {
            throw new InvalidArgumentException("No existe el paquete internacional '{$paquete}'.");
        }

        return DB::transaction(function () use ($prefactura, $paquete) {
```

Y dentro, sustituye la consulta del paquete:

```php
            $paqueteCompleto = FactServicio::query()
                ->where('paquete_internacional', $paquete)
                ->orderBy('id')
                ->get();
```

Renombra el resto de usos de `$paquete` dentro del método a `$paqueteCompleto`
(hoy la variable se llama `$paquete` y ahora ese nombre lo ocupa el argumento).
Todo lo demás del método se queda como está.

- [ ] **Paso 4: el controlador**

En `PrefacturaRenglonController::internacional()`, línea 348, pasa el paquete de
salida —es el comportamiento que el endpoint tiene hoy y no debe cambiar:

```php
            $resultado = $cargos->agregarPaqueteInternacional($prefactura, FactServicio::PAQUETE_SALIDA);
```

Añade el `use App\Models\FactServicio;` si no está.

- [ ] **Paso 5: corre las pruebas y comprueba que pasan**

```bash
php artisan test tests/Feature/Facturacion/CargosEstanciaTest.php tests/Feature/Facturacion/EndpointsPrefacturaTest.php
```

Esperado: todas en verde, incluidas las que ya existían del paquete.

- [ ] **Paso 6: commit**

```bash
git add app/Services/CargosEstancia.php app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php tests/Feature/Facturacion/CargosEstanciaTest.php
git commit -m "feat: el paquete internacional se pide por direccion"
```

---

### Task 5: `tipo_origen` en la prefactura, y el endpoint que lo marca

**Archivos:**
- Crear: `database/migrations/2026_10_15_110000_add_tipo_origen_to_fact_prefacturas.php`
- Modificar: `app/Models/FactPrefactura.php` (fillable, línea 36)
- Modificar: `app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php`
- Modificar: `routes/api.php` (junto a la línea 446)
- Prueba: `tests/Feature/Facturacion/OrigenInternacionalTest.php`

**Interfaces:**
- Consume: `CargosEstancia::agregarPaqueteInternacional($prefactura, $paquete)` de la Task 4.
- Produce: `PATCH /api/facturacion/prefacturas/{id}/origen-internacional`, y la
  columna `fact_prefacturas.tipo_origen` (`string(15)`, por omisión `'nacional'`).

- [ ] **Paso 1: escribe la prueba que falla**

En `tests/Feature/Facturacion/OrigenInternacionalTest.php`:

```php
<?php

use App\Models\FactPrefactura;
use App\Models\FactServicio;

/**
 * El origen y el destino son independientes. Medido sobre el histórico: 220 folios
 * llegan del extranjero y salen a destino nacional, y 166 al revés; solo 99 de 485
 * son internacionales en las dos direcciones.
 */
beforeEach(function () {
    FactServicio::create(['nombre' => 'DSMEE - entrada', 'precio_unitario' => 4060.50, 'paquete_internacional' => FactServicio::PAQUETE_ENTRADA]);
    FactServicio::create(['nombre' => 'DSMES - salida', 'precio_unitario' => 4060.50, 'paquete_internacional' => FactServicio::PAQUETE_SALIDA]);
});

test('una prefactura nace con el origen nacional', function () {
    expect(prefacturaBorrador()->tipo_origen)->toBe(FactPrefactura::DESTINO_NACIONAL);
});

test('marcar el origen internacional agrega el paquete de ENTRADA y marca el campo', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/origen-internacional")->assertOk();

    expect($p->fresh()->tipo_origen)->toBe(FactPrefactura::DESTINO_INTERNACIONAL)
        ->and($p->fresh()->renglones()->pluck('nombre_servicio')->all())->toBe(['DSMEE - entrada']);
});

test('marcar el origen NO toca el destino', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/origen-internacional")->assertOk();

    expect($p->fresh()->tipo_destino)->toBe(FactPrefactura::DESTINO_NACIONAL);
});

test('marcar el destino NO toca el origen', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/internacional")->assertOk();

    expect($p->fresh()->tipo_origen)->toBe(FactPrefactura::DESTINO_NACIONAL)
        ->and($p->fresh()->tipo_destino)->toBe(FactPrefactura::DESTINO_INTERNACIONAL);
});

test('marcar el origen exige el subdepartamento, como el destino', function () {
    $p = prefacturaBorrador();

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/origen-internacional")->assertUnauthorized();

    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));
    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/origen-internacional")->assertForbidden();
});

test('una prefactura cerrada no acepta el paquete de entrada', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    $p->update(['estado' => FactPrefactura::ESTADO_CERRADA]);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/origen-internacional")->assertStatus(409);

    expect($p->fresh()->renglones()->count())->toBe(0);
});
```

- [ ] **Paso 2: corre la prueba y comprueba que falla**

```bash
php artisan test tests/Feature/Facturacion/OrigenInternacionalTest.php
```

Esperado: FALLA con 404 en la ruta nueva (y la primera, con `tipo_origen` nulo).

- [ ] **Paso 3: la migración**

En `database/migrations/2026_10_15_110000_add_tipo_origen_to_fact_prefacturas.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * De dónde VIENE el vuelo, aparte de a dónde va.
 *
 * El sistema viejo lo guarda así (`tb_llegadas.id_origen` e `id_destino`) y el
 * histórico dice por qué importa: de 485 folios internacionales, 386 lo son en una
 * sola dirección. Con un único campo se cargaría el paquete equivocado en el 80%.
 *
 * Por omisión nacional, que es el caso de 3398 de 3883 folios: ninguna prefactura
 * existente cambia de comportamiento.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fact_prefacturas', function (Blueprint $table) {
            $table->string('tipo_origen', 15)->default('nacional')->after('operacion_salida_id');
        });
    }

    public function down(): void
    {
        Schema::table('fact_prefacturas', function (Blueprint $table) {
            $table->dropColumn('tipo_origen');
        });
    }
};
```

- [ ] **Paso 4: el modelo**

En `app/Models/FactPrefactura.php`, línea 36, añade `'tipo_origen'` al `$fillable`,
justo antes de `'tipo_destino'`.

- [ ] **Paso 5: el endpoint**

En `PrefacturaRenglonController`, añade un método hermano de `internacional()`. Es
el mismo cuerpo con dos cambios: el paquete que pide y el campo que marca.

```php
    /**
     * Marca que el vuelo LLEGÓ del extranjero y carga el paquete de entrada.
     *
     * Hermano de `internacional()`, que hace lo propio con la salida. Son endpoints
     * separados porque las dos direcciones son independientes: medido, 386 de 485
     * folios internacionales lo son en una sola.
     */
    public function origenInternacional(Request $request, int $id, CargosEstancia $cargos): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazoRapido($prefactura)) {
            return $respuesta;
        }

        $resultado = DB::transaction(function () use ($request, $prefactura, $cargos) {
            if ($respuesta = $this->rechazarSiDescartada($this->bloquear($prefactura->id))) {
                return $respuesta;
            }

            $resultado = $cargos->agregarPaqueteInternacional($prefactura, FactServicio::PAQUETE_ENTRADA);

            if ($resultado['en_paquete'] > 0) {
                $prefactura->update(['tipo_origen' => FactPrefactura::DESTINO_INTERNACIONAL]);
            }

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_EDITAR,
                descripcion: "Se marcó el origen internacional de la prefactura {$id} y se agregaron {$resultado['renglones']} servicios del paquete de entrada.",
                usuarioId: $request->user()->id,
                registroId: $id,
            );

            return $resultado;
        });

        if ($resultado instanceof JsonResponse) {
            return $resultado;
        }

        return response()->json([
            'message' => 'Origen marcado como internacional.',
            'renglones' => $resultado['renglones'],
            'motivo' => $resultado['motivo'],
        ]);
    }
```

**Antes de escribirlo, lee `internacional()` entero** (línea 332 en adelante) y
copia su forma exacta: los nombres de `rechazoRapido`, `rechazarSiDescartada` y
`bloquear`, y la forma de la respuesta de error. Si difieren de lo de arriba, manda
lo que hay en el archivo.

- [ ] **Paso 6: la ruta**

En `routes/api.php`, junto a la línea 446:

```php
        Route::patch('/prefacturas/{id}/origen-internacional', [PrefacturaRenglonController::class, 'origenInternacional'])->whereNumber('id');
```

- [ ] **Paso 7: corre las pruebas y comprueba que pasan**

```bash
php artisan migrate
php artisan test tests/Feature/Facturacion/OrigenInternacionalTest.php
```

Esperado: las 6 en verde.

- [ ] **Paso 8: commit**

```bash
php artisan test tests/Feature/Facturacion/
git add -A app/Models/FactPrefactura.php app/Http/Controllers/Api/Facturacion/PrefacturaRenglonController.php routes/api.php database/migrations tests/Feature/Facturacion/OrigenInternacionalTest.php
git commit -m "feat: tipo_origen y el paquete internacional de entrada"
```

---

### Task 6: La estancia se calcula al cambiar la salida

**Archivos:**
- Modificar: `app/Http/Controllers/Api/Facturacion/PrefacturaController.php` (`update()`, línea 190)
- Prueba: `tests/Feature/Facturacion/EstanciaAutomaticaTest.php`

**Interfaces:**
- Consume: `CalculadoraEstancia::tramos()` (Task 1) y
  `CargosEstancia::recalcular($prefactura, $pernoctas, $transitos2h, $transitos12h, $ajustes2a12, $ajustes12aPernocta)` (ya existe).
- Produce: nada para tareas posteriores.

**La regla del disparo, y es la parte delicada:** se recalcula **solo cuando la
salida cambia**, no en cada guardado. Si no, un operador que corrigió a mano las
cantidades de un caso raro las pierde la próxima vez que toque el cliente. Es el
mismo criterio de `OperacionesDiariasController::validarFechaSiCambia()`.

- [ ] **Paso 1: escribe la prueba que falla**

En `tests/Feature/Facturacion/EstanciaAutomaticaTest.php`:

```php
<?php

use App\Models\FactPrefactura;
use App\Models\FactServicio;

/**
 * Al guardar la salida, las cantidades de estancia salen del reloj. La regla se
 * midió contra 2803 folios históricos y acierta en el 86,1%; el 13,9% restante es
 * cortesía del operador o acuerdos a tanto alzado, y por eso las cantidades siguen
 * siendo EDITABLES después.
 */
function cabecera(array $extra = []): array
{
    return array_merge([
        'cliente_id' => null,
        'llegada_at' => '2026-10-15 12:00:00',
        'salida_at' => null,
        'origen' => 'MMTO',
        'destino' => null,
    ], $extra);
}

function cantidadDe(FactPrefactura $p, string $concepto): int
{
    return (int) $p->renglones()
        ->whereHas('servicio', fn ($q) => $q->where('concepto', $concepto))
        ->sum('cantidad');
}

test('guardar la salida calcula las cantidades de estancia', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();

    $this->putJson("/api/facturacion/prefacturas/{$p->id}", cabecera(['salida_at' => '2026-10-22 20:15:00']))
        ->assertOk();

    // 7 dias y 8:15 -> 7 pernoctas y 1 transito de 12 h.
    expect(cantidadDe($p->fresh(), FactServicio::CONCEPTO_ESTANCIA_PERNOCTA))->toBe(7)
        ->and(cantidadDe($p->fresh(), FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H))->toBe(1)
        ->and(cantidadDe($p->fresh(), FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H))->toBe(0);
});

test('guardar SIN salida no toca la estancia: la aeronave sigue en tierra', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();

    $this->putJson("/api/facturacion/prefacturas/{$p->id}", cabecera())->assertOk();

    expect($p->fresh()->renglones()->count())->toBe(0);
});

test('guardar por otro motivo NO vuelve a calcular, y conserva la correccion a mano', function () {
    // Es la razón de que el disparo mire si la salida CAMBIA. Sin esto, el operador
    // pierde su corrección al tocar cualquier otro campo, y sin avisarle.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();

    $this->putJson("/api/facturacion/prefacturas/{$p->id}", cabecera(['salida_at' => '2026-10-22 20:15:00']))->assertOk();

    // El operador corrige: era cortesía, se quita el tránsito.
    $p->fresh()->renglones()
        ->whereHas('servicio', fn ($q) => $q->where('concepto', FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H))
        ->update(['cantidad' => 0]);

    // Y luego guarda por otra cosa, con la MISMA salida.
    $this->putJson("/api/facturacion/prefacturas/{$p->id}", cabecera(['salida_at' => '2026-10-22 20:15:00', 'origen' => 'KMIA']))->assertOk();

    expect(cantidadDe($p->fresh(), FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H))->toBe(0);
});

test('cambiar la salida SI vuelve a calcular', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();

    $this->putJson("/api/facturacion/prefacturas/{$p->id}", cabecera(['salida_at' => '2026-10-22 12:00:00']))->assertOk();
    expect(cantidadDe($p->fresh(), FactServicio::CONCEPTO_ESTANCIA_PERNOCTA))->toBe(7);

    $this->putJson("/api/facturacion/prefacturas/{$p->id}", cabecera(['salida_at' => '2026-10-23 12:00:00']))->assertOk();
    expect(cantidadDe($p->fresh(), FactServicio::CONCEPTO_ESTANCIA_PERNOCTA))->toBe(8);
});

test('las cantidades calculadas siguen siendo editables por el camino de siempre', function () {
    // No hay endpoint para editar la cantidad de UN renglón: las de estancia se corrigen
    // reenviando las cinco por `PATCH /estancia`, que es el botón «Recalcular estancia».
    // Esa es la salida del 13,9% de casos que la regla no reproduce.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();

    $this->putJson("/api/facturacion/prefacturas/{$p->id}", cabecera(['salida_at' => '2026-10-22 12:00:00']))->assertOk();
    expect(cantidadDe($p->fresh(), FactServicio::CONCEPTO_ESTANCIA_PERNOCTA))->toBe(7);

    $this->patchJson("/api/facturacion/prefacturas/{$p->id}/estancia", [
        'pernoctas' => 3,
        'transitos_2h' => 0,
        'transitos_12h' => 0,
    ])->assertOk();

    expect(cantidadDe($p->fresh(), FactServicio::CONCEPTO_ESTANCIA_PERNOCTA))->toBe(3);
});
```

**Antes de correr esta última, mira el cuerpo que espera `PATCH /estancia`** en
`PrefacturaRenglonController::estancia()` (línea 268): los nombres de los cinco
campos deben ser los que ese método valida, y arriba están los que usa la pantalla
hoy (`DatosEstancia` en `apiFacturacionCatalogos.ts`). Si no coinciden, manda el
controlador.

- [ ] **Paso 2: corre la prueba y comprueba que falla**

```bash
php artisan test tests/Feature/Facturacion/EstanciaAutomaticaTest.php
```

Esperado: FALLAN la primera y la cuarta, con 0 pernoctas donde se esperan 7 y 8.

- [ ] **Paso 3: el controlador**

En `PrefacturaController::update()`, **antes** de escribir los cambios, guarda la
salida que había:

```php
        $salidaAnterior = $prefactura->salida_at?->format('Y-m-d H:i:s');
```

Y **después** de la escritura, dentro de la misma transacción:

```php
            // La estancia se recalcula SOLO cuando la salida cambia. Guardar la cabecera
            // por otro motivo no debe pisar una cantidad que el operador corrigió a mano:
            // la regla acierta en el 86,1% de los casos y el 13,9% restante es suyo. Es el
            // mismo criterio de `OperacionesDiariasController::validarFechaSiCambia()`.
            $salidaNueva = $actual->fresh()->salida_at?->format('Y-m-d H:i:s');
            $llegada = $actual->fresh()->llegada_at;

            if ($salidaNueva !== $salidaAnterior && $salidaNueva !== null && $llegada !== null) {
                $tramos = CalculadoraEstancia::tramos($llegada, $actual->fresh()->salida_at);

                $cargos->recalcular(
                    $actual,
                    $tramos['pernoctas'],
                    $tramos['transitos2h'],
                    $tramos['transitos12h'],
                );
            }
```

Añade `CargosEstancia $cargos` a la firma de `update()` (Laravel lo inyecta) y los
`use` de `App\Services\CalculadoraEstancia` y `App\Services\CargosEstancia`.

**Lee `update()` entero antes de tocarlo**: tiene candado y comprobación de
cerrada dentro de la transacción, y el recálculo va DENTRO de ese candado. Los dos
ajustes de estancia se dejan en cero: siguen siendo manuales.

- [ ] **Paso 4: corre las pruebas y comprueba que pasan**

```bash
php artisan test tests/Feature/Facturacion/EstanciaAutomaticaTest.php
```

Esperado: las 5 en verde.

- [ ] **Paso 5: comprueba por mutación que la prueba del disparo muerde**

Quita `$salidaNueva !== $salidaAnterior &&` de la condición y corre de nuevo: debe
ponerse roja `guardar por otro motivo NO vuelve a calcular`. Deshaz el cambio.

- [ ] **Paso 6: suite completa y commit**

```bash
php artisan test
git add app/Http/Controllers/Api/Facturacion/PrefacturaController.php tests/Feature/Facturacion/EstanciaAutomaticaTest.php
git commit -m "feat: la estancia se calcula al cambiar la salida"
```

---

### Task 7: La hora de llegada y salida, escribible en 24 horas

**Archivos:**
- Modificar: `resources/js/pages/Facturacion/components/formato.ts`
- Modificar: `resources/js/pages/Facturacion/EditorPrefactura.tsx` (líneas 1064-1095)

**Interfaces:**
- Consume: nada.
- Produce: en `formato.ts`,
  `partirFechaHora(valor: string | null | undefined): { fecha: string; hora: string }`
  y `unirFechaHora(fecha: string, hora: string): string | null`.

**Por qué no `<input type="time">`:** tiene el mismo defecto de idioma que el
`datetime-local` actual —en español el navegador lo pinta con AM/PM y casillas— así
que no resuelve nada. La hora va en un campo de texto validado.

- [ ] **Paso 1: los helpers**

Añade al final de `resources/js/pages/Facturacion/components/formato.ts`:

```ts
/** Formato de 24 horas, de 00:00 a 23:59. */
const HORA_24 = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Parte "2026-09-30 14:30:00" en los dos campos que se dibujan.
 *
 * Van separados porque `<input type="datetime-local">` —y también `type="time"`—
 * se pintan según el idioma del navegador: en español salen con AM/PM y la hora se
 * teclea por casillas. El día sigue en un `type="date"`, que no tiene ese problema,
 * y la hora pasa a ser texto en 24 h.
 */
export function partirFechaHora(valor: string | null | undefined): { fecha: string; hora: string } {
    const partes = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(valor ?? '');

    return partes ? { fecha: partes[1], hora: partes[2] } : { fecha: '', hora: '' };
}

/** Junta los dos campos en lo que recibe el servidor; null si falta uno o la hora no es válida. */
export function unirFechaHora(fecha: string, hora: string): string | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !HORA_24.test(hora)) {
        return null;
    }

    return `${fecha} ${hora}:00`;
}

/** Para avisar al usuario antes de enviar. */
export function esHora24(hora: string): boolean {
    return HORA_24.test(hora);
}
```

- [ ] **Paso 2: comprueba los helpers en el navegador**

No hay banco de pruebas de JavaScript en este proyecto (no existe vitest ni jest),
así que la verificación es la del paso 5: la pantalla real. Comprueba al menos que
`npm run types` pasa:

```bash
npm run types
```

Esperado: solo el error preexistente de
`resources/js/actions/.../WalkAroundController.ts(905,5)`, que viene de que
`routes/api.php` registra `PUT` y `PATCH` a la misma URI y Wayfinder emite la clave
dos veces. No es tuyo y no se arregla aquí.

- [ ] **Paso 3: la pantalla**

En `EditorPrefactura.tsx`, el estado del formulario pasa de dos campos a cuatro.
Donde hoy hay (línea 53):

```tsx
    llegada: aCampoFechaHora(p.llegada_at),
    salida: aCampoFechaHora(p.salida_at),
```

pon:

```tsx
    llegadaFecha: partirFechaHora(p.llegada_at).fecha,
    llegadaHora: partirFechaHora(p.llegada_at).hora,
    salidaFecha: partirFechaHora(p.salida_at).fecha,
    salidaHora: partirFechaHora(p.salida_at).hora,
```

Donde hoy se envía (línea 495):

```tsx
                llegada_at: deCampoFechaHora(form.llegada),
                salida_at: deCampoFechaHora(form.salida),
```

pon:

```tsx
                llegada_at: unirFechaHora(form.llegadaFecha, form.llegadaHora),
                salida_at: unirFechaHora(form.salidaFecha, form.salidaHora),
```

Y cada `<input type="datetime-local">` (líneas 1069 y 1086) se parte en dos
controles. El de llegada queda así, y el de salida igual cambiando `llegada` por
`salida`:

```tsx
                                <div className="flex gap-2">
                                    <input
                                        id="encabezado-llegada"
                                        type="date"
                                        value={soloLectura ? partirFechaHora(prefactura.llegada_at).fecha : form.llegadaFecha}
                                        disabled={soloLectura}
                                        onChange={e => cambiar('llegadaFecha', e.target.value, 'llegada_at')}
                                        className={campoConError(!!erroresForm.llegada_at)}
                                        aria-invalid={erroresForm.llegada_at ? true : undefined}
                                    />
                                    <input
                                        id="encabezado-llegada-hora"
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="HH:MM"
                                        maxLength={5}
                                        aria-label="Hora de llegada, en formato de 24 horas"
                                        value={soloLectura ? partirFechaHora(prefactura.llegada_at).hora : form.llegadaHora}
                                        disabled={soloLectura}
                                        onChange={e => cambiar('llegadaHora', e.target.value, 'llegada_at')}
                                        className={campoConError(!!erroresForm.llegada_at)}
                                    />
                                </div>
```

- [ ] **Paso 4: la validación en pantalla**

Donde hoy se valida (línea 480), sustituye la comparación de cadenas por una que
compare los instantes ya unidos, y añade el aviso de hora mal escrita:

```tsx
        const llegadaUnida = unirFechaHora(form.llegadaFecha, form.llegadaHora);
        const salidaUnida = unirFechaHora(form.salidaFecha, form.salidaHora);

        if (form.llegadaHora !== '' && !esHora24(form.llegadaHora)) nuevos.llegada_at = 'La hora va en formato de 24 horas, de 00:00 a 23:59.';
        if (form.salidaHora !== '' && !esHora24(form.salidaHora)) nuevos.salida_at = 'La hora va en formato de 24 horas, de 00:00 a 23:59.';
        if (llegadaUnida !== null && salidaUnida !== null && salidaUnida < llegadaUnida) nuevos.salida_at = 'La salida no puede ser anterior a la llegada.';
```

Importa `partirFechaHora`, `unirFechaHora` y `esHora24` en la línea 11, y quita
`aCampoFechaHora` y `deCampoFechaHora` del import **solo si ya no se usan en el
archivo** (compruébalo con una búsqueda; `aCampoFechaHora` puede seguir usándose en
otro sitio).

- [ ] **Paso 5: verifica en la pantalla real**

```bash
npm run build
```

Abre el editor de una prefactura y comprueba las tres cosas: que la hora se puede
teclear como `14:30`, que escribir `25:00` da el mensaje de 24 horas, y que al
guardar y recargar la hora vuelve igual.

- [ ] **Paso 6: commit**

```bash
npm run types
git add resources/js/pages/Facturacion/components/formato.ts resources/js/pages/Facturacion/EditorPrefactura.tsx
git commit -m "feat: la hora de llegada y salida se escribe en 24 horas"
```

---

### Task 8: El interruptor de origen internacional en el editor

**Archivos:**
- Modificar: `resources/js/stores/apiFacturacionCatalogos.ts`
- Modificar: `resources/js/pages/Facturacion/EditorPrefactura.tsx` (junto al botón de la línea 657)

**Interfaces:**
- Consume: `PATCH /api/facturacion/prefacturas/{id}/origen-internacional` (Task 5).
- Produce: nada.

- [ ] **Paso 1: el cliente de API**

En `apiFacturacionCatalogos.ts`, junto a `apiPrefacturas.internacional`, añade:

```ts
    /** Marca que el vuelo LLEGÓ del extranjero y carga el paquete de entrada. */
    origenInternacional: async (id: number) =>
        await pedir<{ message: string; renglones: number; motivo: string | null }>(
            `${BASE}/prefacturas/${id}/origen-internacional`,
            { method: 'PATCH' },
        ),
```

**Lee antes cómo está escrito `internacional` en ese objeto** y copia su forma
exacta: el nombre del helper y la forma del tipo de respuesta.

- [ ] **Paso 2: el manejador**

Junto al de destino (línea 657 en adelante), añade este. La forma —`ejecutar`, el
diálogo de Swal, el tratamiento del motivo— es la del hermano, que debes leer
antes para que los nombres coincidan con los del archivo:

```tsx
    const marcarOrigenInternacional = () =>
        ejecutar('origen-internacional', 'No se pudo marcar el origen como internacional', async () => {
            const confirmacion = await Swal.fire({
                titleText: 'Marcar el origen como internacional',
                text: 'Se agregan a la prefactura los servicios del paquete de ENTRADA, los que cobra una aeronave que llega del extranjero. No hay forma de deshacerlo desde esta pantalla.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Sí, marcar el origen',
                cancelButtonText: 'Cancelar',
            });

            if (!confirmacion.isConfirmed) return;

            const { renglones: agregados, motivo } = await apiPrefacturas.origenInternacional(prefactura.id);

            if (motivo) {
                await Swal.fire({
                    titleText: agregados === 0 ? 'No se agregó el paquete de entrada' : 'El paquete de entrada quedó incompleto',
                    text: motivo,
                    icon: agregados === 0 ? 'error' : 'warning',
                });
            }

            return agregados === 0
                ? 'Origen marcado internacional: el paquete ya estaba en los renglones.'
                : `Origen marcado internacional: se agregaron ${agregados} servicios de entrada.`;
        });
```

**Comprueba antes** cómo se llama el primer argumento de `ejecutar` en el hermano
(es una clave para el estado de «ocupado») y qué devuelve el callback: si el
hermano devuelve otra cosa, manda el hermano.

- [ ] **Paso 3: el botón**

Junto al de destino, con la misma clase. Se oculta cuando el origen ya es
internacional, igual que el de destino con `tipo_destino`:

```tsx
                        {prefactura.tipo_origen !== 'internacional' && !soloLectura && (
                            <button type="button" onClick={marcarOrigenInternacional} className={BOTON_SECUNDARIO}>
                                ORIGEN INTERNACIONAL
                            </button>
                        )}
```

**Lee el botón de destino y copia su `className` y su condición de visibilidad
exactas**: si usa otra constante de estilo o comprueba algo más que `soloLectura`,
manda lo que hay.

- [ ] **Paso 4: el tipo de la prefactura en TypeScript**

En `apiFacturacionCatalogos.ts`, en la interfaz `Prefactura`, añade junto a
`tipo_destino`:

```ts
    tipo_origen: 'nacional' | 'internacional';
```

Y comprueba que el servidor lo sirve: si `PrefacturaController::presentar()` no
incluye `tipo_origen`, añádelo ahí.

- [ ] **Paso 5: verifica en la pantalla real**

```bash
npm run types
npm run build
```

Comprueba las cuatro: que el botón de origen aparece, que al pulsarlo se agregan
los seis servicios de entrada, que el de destino sigue agregando los cuatro de
salida, y que marcar uno no oculta el otro.

- [ ] **Paso 6: suite completa y commit**

```bash
php artisan test
git add resources/js/stores/apiFacturacionCatalogos.ts resources/js/pages/Facturacion/EditorPrefactura.tsx app/Http/Controllers/Api/Facturacion/PrefacturaController.php
git commit -m "feat: el interruptor de origen internacional en el editor"
```

---

## Cierre

- [ ] **Suite completa, en serie**

```bash
php artisan test
```

Esperado: todas en verde. La referencia antes de empezar son **3367 pruebas**.

- [ ] **El criterio de aceptación, otra vez**

```bash
php artisan facturacion:comparar-estancia
```

Esperado: **86,1 % sobre 2 803 folios**. Si cambió respecto a la Task 2, algo de
las tareas posteriores tocó la regla sin querer.

- [ ] **Los dos comparadores que ya existían, para comprobar que nada se movió**

```bash
php artisan facturacion:comparar-prefacturas --detalle=3
php artisan facturacion:comparar-pagos --detalle=3
```

Esperado: 220 folios duplicados en el origen y las mismas cifras de antes. Este
trabajo no toca los históricos; si se movieron, hay un efecto no previsto.
