# Bloque 4 — La impresión: plan de implementación

> **Para trabajadores agénticos:** SUB-SKILL REQUERIDA: usa
> superpowers:subagent-driven-development (recomendada) o
> superpowers:executing-plans para implementar este plan task por task. Los pasos usan
> casillas (`- [ ]`) para seguimiento.

**Goal:** que una prefactura se pueda imprimir — el documento oficial de una cerrada, la
cotización de un borrador, y la reimpresión — con un PDF que el servidor genera y que
ninguna acción de impresión escriba nada.

**Architecture:** una sola vista Blade renderizada a PDF con DomPDF en el servidor. Dos
rutas `GET`: `/pdf` para una cerrada, que lee las cifras **selladas**, y `/cotizacion` para
un borrador, que lee las **derivadas**. Reimprimir no tiene ruta: es volver a pedir `/pdf`.
Las pruebas afirman sobre el **HTML** que la plantilla genera, sin parser de PDF, más una
comprobación de que el endpoint devuelve un PDF de verdad.

**Tech Stack:** Laravel 12, PHP 8.2, `barryvdh/laravel-dompdf` (**se instala en la Task 1**),
Blade, Pest sobre sqlite, React 19 + TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-05-facturacion-4-impresion-design.md`

## Global Constraints

- **Ningún cálculo de dinero en la plantilla.** La vista **formatea**, no calcula: todas las
  cifras llegan ya calculadas por el modelo. Las fórmulas siguen viviendo en
  `ImporteServicio::calcular()`, `FactPrefactura::calcularIva()`, `ComisionAmex::calcular()`
  y `PagosPrefactura::comisionQueCuadra()`. **Sin copias.**
- **Ningún `float` en el camino del dinero.**
- **El endpoint del PDF no escribe en ninguna rama**, salvo la bitácora. Es la decisión de
  más peso del bloque: en el sistema viejo imprimir escribía, y `invoice21.php` —el de la
  lista de cerradas— vuelve a insertar el encabezado histórico cada vez, que es una de las
  causas de sus 207 folios duplicados.
- **`/pdf` lee SOLO las cifras selladas** (`subtotal_sellado`, `iva_sellado`,
  `total_sellado`, `iva_tasa_sellada`). Nunca la derivación: el documento muestra lo que el
  cliente vio al emitirse.
- **`/cotizacion` lee las derivadas** (`subtotal()`, `iva()`, `total()`), porque un borrador
  no tiene sello.
- **Toda escritura queda en `Bitacora`, DENTRO de la transacción.**
- **Todo lo visible va en español**, el documento incluido.
- La suite se corre **en serie** con `php artisan test`. `--parallel` da 22 fallos falsos
  ajenos en esta máquina. Al empezar son **980**.
- El único error aceptable de `npx tsc --noEmit` es el preexistente
  `resources/js/actions/App/Http/Controllers/Api/WalkAroundController.ts(905,5)`.
- **No uses `git stash`:** hay tres stashes en el repositorio y el `stash@{0}` es trabajo
  ajeno a esto.

---

## Estructura de archivos

**Se crean:**

| Archivo | Responsabilidad |
|---|---|
| `resources/views/pdf/prefactura.blade.php` | La plantilla del documento, única para las tres acciones |
| `app/Http/Controllers/Api/Facturacion/PrefacturaPdfController.php` | Las dos rutas, sus rechazos y la bitácora |
| `public/img/logo-facturacion.jpg` | El logo, copiado de `Prefectura/img/logo.jpg` |
| `tests/Feature/Facturacion/DocumentoPrefacturaTest.php` | El contenido del documento, sobre el HTML |
| `tests/Feature/Facturacion/ImpresionPrefacturaTest.php` | Los endpoints: rechazos, bitácora y que no escriben |
| `docs/superpowers/specs/2026-10-05-facturacion-4-despliegue-y-pendientes.md` | La guía de despliegue |

**Se modifican:**

| Archivo | Qué cambia |
|---|---|
| `composer.json` | `barryvdh/laravel-dompdf` |
| `app/Models/FactPrefactura.php` | La relación `cerradaPor()` |
| `routes/api.php` | Las dos rutas `GET` |
| `resources/js/stores/apiFacturacionCatalogos.ts` | Las dos URLs |
| `resources/js/pages/Facturacion/EditorPrefactura.tsx` | Los botones Imprimir, Cotizar y «Cerrar e imprimir» |

**Por qué un controlador nuevo y no `PrefacturaController`:** ese ya tiene nueve métodos
públicos y 480 líneas. La impresión es una responsabilidad distinta —no escribe nada— y
tenerla aparte deja claro de un vistazo cuál de los dos controladores puede modificar un
documento.

---

## Task 1: La plantilla del documento

**Files:**
- Modify: `composer.json` (instalar `barryvdh/laravel-dompdf`)
- Create: `resources/views/pdf/prefactura.blade.php`
- Create: `public/img/logo-facturacion.jpg` (copiar de `C:\xampp\htdocs\EOLO\Prefectura\img\logo.jpg`)
- Modify: `app/Models/FactPrefactura.php` (la relación `cerradaPor()`)
- Test: `tests/Feature/Facturacion/DocumentoPrefacturaTest.php`

**Interfaces:**
- Consumes: de los bloques anteriores — `FactPrefactura` con `subtotal()`, `iva()`,
  `total()`, `ivaTasa()`, `pagado()`, `cambio()`, `cobradoDeMas()`, `renglones` (cada uno con
  `importe()`, `es_cortesia`, `concepto`, `remision`), `pagos` (cada uno con `formaPago` y
  `monto`), `cliente`, `aeronave`, y las columnas selladas; `FactServicio::CONCEPTO_COMISION_AMEX`.
- Produces: la vista `pdf.prefactura`, que recibe este array y **nada más** (la Task 2 y la
  Task 3 lo construyen):

```php
[
    'prefactura' => FactPrefactura,   // el modelo, con sus relaciones cargadas
    'esCotizacion' => bool,           // true: COTIZACIÓN sin folio; false: documento emitido
    'subtotal' => string,             // ya calculado: sellado o derivado según el caso
    'iva' => string,
    'ivaEtiqueta' => string,          // la tasa como porcentaje, p. ej. '16%'
    'total' => string,
    'cambio' => string,               // 2 decimales; la línea CAMBIO sale si es > 0
    'importes' => array,              // [id de renglón => importe], sobre los objetos cargados
    'elaboradoPor' => string,         // el nombre de quien cerró, o de quien imprime
]

**Las nueve claves las arma quien llama, DENTRO de su `try/catch`.** La vista no llama a
ningún método que calcule dinero ni que pueda lanzar, y eso no es estilo: la vista se
renderiza **después** de ese `try/catch`, así que una excepción nacida ahí sería un 500 en
lugar de un 422.

`importes` existe por la misma razón, y hay que armarlo **sobre la colección ya cargada que
la vista itera**, no releyendo:

```php
$importes = $prefactura->renglones
    ->mapWithKeys(fn (FactPrefacturaRenglon $renglon) => [$renglon->id => $renglon->importe()])
    ->all();
```

Releer abre una carrera real: `subtotalDerivado()` relee los renglones con
`renglones()->get()`, así que si alguien **corrige** un `ajuste_precio` desconocido entre la
carga y esa relectura, la verificación no lanza, la vista sí sobre el objeto viejo, y sale un
**500 sobre una prefactura cuyos datos vigentes están bien**. Calculando sobre los mismos
objetos, el agujero no existe.
```

**Contexto que el brief no puede saber:**

- **DomPDF no está instalado.** `composer.json` solo requiere inertia, fortify, framework,
  sanctum, tinker, wayfinder y php. Hay un `use Barryvdh\DomPDF\Facade\Pdf;` en
  `ControlMedicamentoController` que **importa una clase que no existe**, así que esa ruta
  reventaría si alguien la llamara. Instalar el paquete la deja funcionando como efecto
  lateral; **no la toques por lo demás**, está fuera de alcance.
- **La fuente tiene que ser `DejaVu Sans`.** Es la Unicode que DomPDF trae y es lo que hace
  que los acentos salgan. `resources/views/pdf/control-medicamento-cierres.blade.php` ya la
  usa; **léelo antes de escribir la tuya** y sigue su forma: `<!DOCTYPE html>`, un `<style>`
  en el `<head>`, clases con nombres en español, sin dependencias externas.
- **El logo se referencia con `public_path()`**, no con una URL: DomPDF no resuelve rutas web.
- **`FactPrefactura` no tiene relación para `cerrada_por`.** La columna existe
  (`constrained('users')`) pero no hay método. Añade
  `cerradaPor()` → `belongsTo(User::class, 'cerrada_por')`.
- **`$prefactura->renglones` ya viene ordenada** por `orden` y luego `id`.

- [ ] **Step 1: Instala DomPDF**

```bash
composer require barryvdh/laravel-dompdf
```

Comprueba que quedó: `php -r 'require "vendor/autoload.php"; var_dump(class_exists("Barryvdh\\DomPDF\\Facade\\Pdf"));'`
Expected: `bool(true)`

- [ ] **Step 2: Copia el logo**

```bash
mkdir -p public/img && cp "C:/xampp/htdocs/EOLO/Prefectura/img/logo.jpg" public/img/logo-facturacion.jpg
```

- [ ] **Step 3: Escribe las pruebas que fallan**

Las pruebas renderizan **la vista**, no el PDF: `view('pdf.prefactura', [...])->render()`
devuelve el HTML, y sobre eso se afirma. Eso evita un parser de PDF y es mucho más rápido.

```php
<?php

use App\Models\FactPrefactura;
use App\Models\FactServicio;
use App\Models\User;

/** El HTML que la plantilla genera para una prefactura. */
function documentoDe(FactPrefactura $p, bool $esCotizacion, string $elaboradoPor = 'Ana Pérez'): string
{
    $p = $p->fresh(['renglones', 'pagos.formaPago', 'cliente', 'aeronave']);

    return view('pdf.prefactura', [
        'prefactura' => $p,
        'esCotizacion' => $esCotizacion,
        'subtotal' => $esCotizacion ? $p->subtotal() : (string) $p->subtotal_sellado,
        'iva' => $esCotizacion ? $p->iva() : (string) $p->iva_sellado,
        'ivaTasa' => $esCotizacion ? $p->ivaTasa() : (string) $p->iva_tasa_sellada,
        'total' => $esCotizacion ? $p->total() : (string) $p->total_sellado,
        'elaboradoPor' => $elaboradoPor,
    ])->render();
}

test('el documento emitido trae el folio, el total SELLADO y cada renglon', function () {
    [$p] = prefacturaCompleta(1000.0, 2);
    renglonDe($p, 250.0, 1);
    // El sello dice 2250.00 y los renglones derivan 2250.00; aqui coinciden a proposito.
    $cerrada = cerrarConSello($p, '2250.00', '360.00', '2610.00');

    $html = documentoDe($cerrada, esCotizacion: false);

    expect($html)->toContain('PREFACTURA DE SERVICIOS')
        ->and($html)->toContain('10000')          // el folio que cerrarConSello pone
        ->and($html)->toContain('2,610.00')       // el total sellado, formateado
        ->and($html)->not->toContain('COTIZACIÓN');

    foreach ($cerrada->renglones as $renglon) {
        expect($html)->toContain($renglon->nombre_servicio);
    }
});

test('el documento usa el sello y NO lo que derivan los renglones', function () {
    // Esta es la prueba que protege el invariante del documento: el cliente vio el sello.
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '999.00', '159.84', '1158.84');

    $html = documentoDe($cerrada, esCotizacion: false);

    expect($html)->toContain('1,158.84')   // el sello
        ->and($html)->not->toContain('116.00');  // lo que derivarian los renglones
});

test('la cotizacion dice COTIZACION, no trae folio y avisa de que no esta emitida', function () {
    $p = prefacturaBorrador();
    renglonDe($p, 500.0, 1);

    $html = documentoDe($p->fresh(), esCotizacion: true);

    expect($html)->toContain('COTIZACIÓN')
        ->and($html)->toContain('no es un documento emitido')
        ->and($html)->not->toContain('PREFACTURA DE SERVICIOS')
        ->and($html)->toContain('580.00');   // el total derivado
});

test('un renglon de cortesia sale con su precio y el importe en cero, marcado', function () {
    $p = prefacturaBorrador();
    $renglon = renglonDe($p, 300.0, 2);
    $renglon->update(['es_cortesia' => true]);

    $html = documentoDe($p->fresh(), esCotizacion: true);

    // El documento tiene que mostrar QUE se dejo de cobrar, no esconderlo.
    expect($html)->toContain('300.0000')     // el precio unitario sigue visible
        ->and($html)->toContain('Cortesía')
        ->and($html)->toContain('0.00');
});

test('el renglon de comision Amex se identifica en el documento', function () {
    $p = prefacturaBorrador();
    $servicio = FactServicio::create([
        'nombre' => 'Comisión AMEX', 'precio_unitario' => 48.80,
        'concepto' => FactServicio::CONCEPTO_COMISION_AMEX,
    ]);
    $p->renglones()->create([
        'servicio_id' => $servicio->id, 'nombre_servicio' => $servicio->nombre,
        'precio_unitario' => 48.80, 'cantidad' => 1, 'es_de_tercero' => false,
        'margen' => 0, 'ajuste_precio' => 'ninguno',
        'concepto' => FactServicio::CONCEPTO_COMISION_AMEX, 'orden' => 2,
    ]);

    expect(documentoDe($p->fresh(), esCotizacion: true))->toContain('Comisión AMEX');
});

test('las formas de pago salen con su monto, y el cambio cuando lo hay', function () {
    [$p] = prefacturaCompleta(100.0, 1);
    $formas = formasDePago();
    pagoDe($p, $formas[App\Models\FactFormaPago::CONCEPTO_EFECTIVO], '200.00');
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    $html = documentoDe($cerrada, esCotizacion: false);

    expect($html)->toContain('Efectivo')
        ->and($html)->toContain('200.00')
        ->and($html)->toContain('84.00');   // el cambio derivado
});

test('la nota externa se imprime y las otras dos NO', function () {
    // De las tres notas, solo la externa sale en papel: lo confirman los cuatro PDF
    // vivos del sistema viejo, que leen unicamente nota_ext.
    [$p] = prefacturaCompleta(100.0, 1);
    $p->update([
        'nota_interna' => 'OJO ESTA ES INTERNA',
        'nota_externa' => 'Servicio nocturno',
        'nota_factura' => 'OJO ESTA ES DE FACTURA',
    ]);
    $cerrada = cerrarConSello($p->fresh(), '100.00', '16.00', '116.00');

    $html = documentoDe($cerrada, esCotizacion: false);

    expect($html)->toContain('Servicio nocturno')
        ->and($html)->not->toContain('OJO ESTA ES INTERNA')
        ->and($html)->not->toContain('OJO ESTA ES DE FACTURA');
});

test('Elaborado por trae el nombre que se le pasa, no un literal', function () {
    // El PDF viejo imprime "Elaborado por: AJE" escrito a mano, mientras el dato guarda
    // un id_elaborador que ningun PDF lee.
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    expect(documentoDe($cerrada, esCotizacion: false, elaboradoPor: 'Luis Ramírez'))
        ->toContain('Luis Ramírez')
        ->and(documentoDe($cerrada, esCotizacion: false, elaboradoPor: 'Luis Ramírez'))
        ->not->toContain('AJE');
});

test('el pie trae el aviso de las 72 horas y el de privacidad, literales', function () {
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    $html = documentoDe($cerrada, esCotizacion: false);

    expect($html)->toContain('72 horas naturales')
        ->and($html)->toContain('MXN $250.00 + IVA')
        ->and($html)->toContain('eolo.com.mx/#/privacidad');
});

test('la relacion cerradaPor da el usuario que cerro', function () {
    [$p, $usuario] = prefacturaCompleta(100.0, 1);
    $p->update(['cerrada_por' => $usuario->id]);

    expect($p->fresh()->cerradaPor->name)->toBe($usuario->name);
});
```

- [ ] **Step 4: Córrelas para verificar que fallan**

Run: `php artisan test tests/Feature/Facturacion/DocumentoPrefacturaTest.php`
Expected: FAIL — la vista `pdf.prefactura` no existe.

- [ ] **Step 5: La relación en el modelo**

En `app/Models/FactPrefactura.php`, junto a las otras relaciones:

```php
    /**
     * Quien cerró la prefactura, que es quien la emitió. El documento lo nombra en
     * «Elaborado por», en lugar del literal «AJE» que el PDF viejo trae escrito a mano
     * mientras `id_elaborador` no lo lee nadie.
     */
    public function cerradaPor()
    {
        return $this->belongsTo(User::class, 'cerrada_por');
    }
```

- [ ] **Step 6: La plantilla**

`resources/views/pdf/prefactura.blade.php`. Sigue la forma de
`control-medicamento-cierres.blade.php`: `<!DOCTYPE html>`, `<style>` en el `<head>`,
`font-family: DejaVu Sans, sans-serif`.

**Las secciones, en este orden:**

1. **Cabecera:** el logo con
   `<img src="{{ public_path('img/logo-facturacion.jpg') }}">`, y a la derecha
   `RFC: EPL060619669`, `Carr Toluca-Atlacomulco KM 5.3`, `Toluca, Edo. de México`,
   `facturacion@eolo.com.mx`.
2. **El recuadro del título**, fondo `#073b4b` y texto blanco, como el rediseño del viejo:
   `PREFACTURA DE SERVICIOS` con `FOLIO: {{ $prefactura->folio }}` a la derecha, o
   `COTIZACIÓN` con la leyenda `Sin folio — no es un documento emitido` cuando
   `$esCotizacion`.
3. **DATOS DE OPERACIÓN:** matrícula (`$prefactura->aeronave?->matricula`), la fecha,
   `llegada_at` y `salida_at`, `origen` y `destino`.

   **No hay columna `fecha`.** La fecha del documento es **`cerrada_at`** en uno emitido —la
   de su emisión, no la de su impresión— y **la de hoy** en una cotización. Y las tres
   fechas pueden llegar nulas: `cerrarConSello()` no pone `cerrada_at`, y un borrador recién
   creado no tiene llegada ni salida. La plantilla imprime `—` ante una fecha nula en lugar
   de reventar.
4. **DETALLES DEL CLIENTE:** nombre, teléfono y correo del `$prefactura->cliente`, con `?->`
   y `—` cuando falten: `prefacturaBorrador()` no crea cliente y siete pruebas lo usan.
5. **La tabla de renglones**, con cabeceras `CONCEPTO / SERVICIO`, `REMISIÓN`, `PRECIO U.`,
   `CANT.` e `IMPORTE`. Por cada renglón: `nombre_servicio`, `remision`,
   `precio_unitario`, `cantidad` y su importe, que llega en `$importes[$renglon->id]`
   — **la vista no lo calcula**. **Si `es_cortesia`**, ese importe vale `0.00` y la fila
   lleva la palabra `Cortesía`; el precio unitario **se sigue mostrando**.
6. **Los totales:** `$subtotal`, `IVA ({{ $ivaEtiqueta }})` —un porcentaje, `'16%'`, como
   los cuatro PDF viejos— con `$iva`, y `TOTAL` con `$total`.
7. **FORMA DE PAGO:** una línea por `$prefactura->pagos`, con
   `$pago->formaPago?->nombre` y `$pago->monto`. Y, si `$cambio` es mayor que cero
   (`bccomp($cambio, '0', 2) > 0`), una línea `CAMBIO`.
8. **OBSERVACIONES:** `$prefactura->nota_externa`, o `Sin observaciones adicionales.` si está
   vacía. **Solo la externa**; la interna y la de factura **no salen**.
9. **FIRMA CLIENTE** y `Elaborado por: {{ $elaboradoPor }}`.
10. **El pie**, literal: «Estimado cliente, usted cuenta con un máximo de 72 horas naturales
    posteriores a la fecha de emisión de esta prefactura para solicitar su factura fiscal.
    Tarifa de refacturación: MXN $250.00 + IVA. Contacto: facturacion@eolo.com.mx» y
    `Revisa Nuestro Aviso de Privacidad https://www.eolo.com.mx/#/privacidad`.

**Formatea el dinero con `number_format($valor, 2)`** para los importes de dos decimales y
deja el precio unitario con sus cuatro (`decimal(10,4)`). **No calcules nada**: las cuatro
cifras de totales llegan en el array.

- [ ] **Step 7: Corre las pruebas**

Run: `php artisan test tests/Feature/Facturacion/DocumentoPrefacturaTest.php`
Expected: PASS, 10 pruebas.

Run: `php artisan test`
Expected: PASS, 980 + 10.

- [ ] **Step 8: Verifica por mutación**

1. Haz que la plantilla use `$prefactura->total()` en lugar de `$total`. Expected: falla «el
   documento usa el sello y NO lo que derivan los renglones».
2. Haz que imprima el importe de una cortesía sin la rama de `es_cortesia`. Expected: falla
   su prueba.
3. Haz que imprima `nota_interna` además de la externa. Expected: falla «la nota externa se
   imprime y las otras dos NO».

Restaura con `git checkout -- resources/views/pdf/prefactura.blade.php` después de cada una.

- [ ] **Step 9: Commit**

```bash
git add composer.json composer.lock public/img/logo-facturacion.jpg resources/views/pdf/prefactura.blade.php app/Models/FactPrefactura.php tests/Feature/Facturacion/DocumentoPrefacturaTest.php
git commit -m "La plantilla del documento de prefactura, con el sello y no la derivacion"
```

---

## Task 2: El endpoint del documento emitido

**Files:**
- Create: `app/Http/Controllers/Api/Facturacion/PrefacturaPdfController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Facturacion/ImpresionPrefacturaTest.php`

**Interfaces:**
- Consumes: la vista `pdf.prefactura` con su array (Task 1); la relación `cerradaPor()`
  (Task 1); de los bloques anteriores, el trait
  `App\Http\Controllers\Api\Facturacion\Concerns\RechazaPrefacturaCerrada` con
  `rechazarSiDescartada()`, y `FactPrefactura::discrepanciasDelSello()`.
- Produces: `GET /api/facturacion/prefacturas/{id}/pdf`, que devuelve el PDF o uno de los
  cuatro rechazos. La Task 3 añade `/cotizacion` al mismo controlador; la Task 4 lo llama.

**Contexto que el brief no puede saber:**

- **Las rutas van en el grupo de solo lectura**, el
  `Route::middleware(['api','auth:sanctum'])->prefix('facturacion')` que empieza en la
  **línea 364** de `routes/api.php`, junto a `GET /prefacturas/{id}`. **No** en el grupo
  `subdep:factPrefacturas`, que es el de escritura — pero **sí** con ese middleware propio,
  porque imprimir es una acción del departamento:
  `Route::get('/prefacturas/{id}/pdf', ...)->middleware('subdep:factPrefacturas')->whereNumber('id')`.
- **`auth:sanctum` funciona con un enlace del navegador** porque este proyecto usa el modo de
  cookie de Sanctum (`EnsureFrontendRequestsAreStateful` está en `bootstrap/app.php`). Por
  eso la Task 4 puede abrir el PDF en una pestaña sin montar una descarga por `fetch`.
- **NO toques la tabla de rutas protegidas** de
  `tests/Feature/Facturacion/EndpointsPrefacturaTest.php:157`. Es tentador, porque es la que
  garantiza que ningún endpoint queda sin permiso, pero construye su lado real iterando el
  router con `array_diff($ruta->methods(), ['GET','HEAD'])`: **una ruta GET no puede aparecer
  ahí nunca**, así que agregarla al `$esperado` rompería el `toEqual` para siempre. Esa tabla
  es la de las rutas de **escritura**, y las de impresión no escriben. El mismo invariante se
  conserva con una aserción propia en `ImpresionPrefacturaTest`, que está más abajo.
- **`Bitacora::log()` tiene esta firma**, con argumentos con nombre:
  `log(string $modulo, string $accion, string $descripcion, ?int $usuarioId = null, ?string $elabora = null, ?int $registroId = null, ?array $datosAnteriores = null, ?array $datosNuevos = null)`.
  Usa `Bitacora::ACCION_EXPORTAR`, que ya existe, y
  `Bitacora::MODULO_FACTURACION_PREFACTURAS`.

- [ ] **Step 1: Escribe las pruebas que fallan**

```php
<?php

use App\Models\Bitacora;
use App\Models\FactPrefactura;
use Illuminate\Support\Facades\DB;

test('el documento de una cerrada se descarga como PDF', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    $respuesta = $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf");

    $respuesta->assertOk()->assertHeader('content-type', 'application/pdf');
    // Un PDF de verdad empieza por %PDF-. No comparamos bytes: cambian con la version
    // de la libreria y con la fecha.
    // getContent() y no streamedContent(): DomPDF devuelve una Response normal, no una
    // StreamedResponse, asi que streamedContent() no sirve aqui.
    expect(substr($respuesta->getContent(), 0, 5))->toBe('%PDF-');
});

test('un borrador NO tiene documento: se cotiza', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/pdf")
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'sin_folio');
});

test('una cerrada con el sello roto NO se imprime, y el mensaje da las dos cifras', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    // El sello dice 999.00 y los renglones derivan 100.00: discrepa.
    $cerrada = cerrarConSello($p, '999.00', '159.84', '1158.84');

    $respuesta = $this->getJson("/api/facturacion/prefacturas/{$cerrada->id}/pdf")
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'sello_inconsistente');

    expect($respuesta->json('message'))->toContain('1158.84')
        ->and($respuesta->json('message'))->toContain('116.00');
});

test('un borrador descartado no se imprime', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');
    $cerrada->update(['status' => FactPrefactura::STATUS_INACTIVO]);

    $this->getJson("/api/facturacion/prefacturas/{$cerrada->id}/pdf")
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_descartada');
});

test('con un renglon ilegible responde 422 y no un 500', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');
    // Verificar el sello SI deriva de los renglones, y un ajuste que no se reconoce no se
    // interpreta: lanza. La tasa no sirve para provocarlo en una cerrada, porque `ivaTasa()`
    // devuelve la SELLADA y no lee la configuracion.
    $cerrada->renglones()->first()->update(['ajuste_precio' => 'raro']);

    $this->getJson("/api/facturacion/prefacturas/{$cerrada->id}/pdf")
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'totales_no_calculables');
});

test('imprimir queda en la bitacora como EXPORTAR, con la prefactura', function () {
    $usuario = usuarioConSubdepartamento('factPrefacturas', 'Facturacion');
    $this->actingAs($usuario);
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertOk();

    $registro = Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)
        ->where('accion', Bitacora::ACCION_EXPORTAR)->sole();

    expect($registro->registro_id)->toBe($cerrada->id)
        ->and($registro->descripcion)->toContain((string) $cerrada->folio);
});

test('imprimir NO escribe nada mas que la bitacora', function () {
    // Es el invariante central del bloque: en el sistema viejo imprimir escribia, y la
    // reimpresion desde la lista de cerradas duplicaba el encabezado historico.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    $sentencias = [];
    DB::listen(function ($consulta) use (&$sentencias) {
        $sentencias[] = ltrim(strtolower($consulta->sql));
    });

    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertOk();

    $escrituras = array_values(array_filter(
        $sentencias,
        fn (string $sql) => ! str_starts_with($sql, 'select') && ! str_contains($sql, 'bitacora'),
    ));

    expect($escrituras)->toBe([]);
});

test('reimprimir dos veces NO duplica nada y da el mismo documento', function () {
    // Reimprimir no tiene ruta propia: es volver a pedir la misma. En el viejo hacia falta
    // un archivo aparte precisamente porque imprimir escribia.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertOk();
    $this->get("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertOk();

    expect(FactPrefactura::count())->toBe(1)
        ->and($cerrada->fresh()->folio)->toBe(10000)
        ->and($cerrada->fresh()->renglones()->count())->toBe(1);
});

test('sin el subdepartamento no se imprime', function () {
    $this->actingAs(usuarioSinAcceso());
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    $this->getJson("/api/facturacion/prefacturas/{$cerrada->id}/pdf")->assertForbidden();
});
```

Y añade esta prueba, que es la que conserva el invariante sin romper la tabla de las rutas
de escritura. **Agrégala en esta task aunque `/cotizacion` no exista todavía**: hasta la
Task 3 solo habrá una ruta de impresión, así que afirma sobre las que hay y no sobre un
número fijo.

```php
test('ninguna ruta de impresion queda sin su subdepartamento', function () {
    // La tabla de EndpointsPrefacturaTest no sirve para esto: excluye GET y HEAD, asi que
    // una ruta de impresion no aparece ahi nunca. Esta es su contraparte para las de lectura.
    $impresion = [];

    foreach (app('router')->getRoutes() as $ruta) {
        if (! preg_match('#^api/facturacion/prefacturas/\{id\}/(pdf|cotizacion)$#', $ruta->uri())) {
            continue;
        }

        $impresion[$ruta->uri()] = collect($ruta->gatherMiddleware())
            ->first(fn ($m) => is_string($m) && str_starts_with($m, 'subdep:'));
    }

    expect($impresion)->not->toBeEmpty()
        ->and(array_unique(array_values($impresion)))->toBe(['subdep:factPrefacturas']);
});
```

- [ ] **Step 2: Córrelas para verificar que fallan**

Run: `php artisan test tests/Feature/Facturacion/ImpresionPrefacturaTest.php`
Expected: FAIL con 404: la ruta no existe.

- [ ] **Step 3: El controlador**

```php
<?php

namespace App\Http\Controllers\Api\Facturacion;

use App\Http\Controllers\Api\Facturacion\Concerns\RechazaPrefacturaCerrada;
use App\Http\Controllers\Controller;
use App\Models\Bitacora;
use App\Models\FactPrefactura;
use App\Models\FactPrefacturaRenglon;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;
use UnexpectedValueException;

/**
 * La impresión de una prefactura. Dos acciones y una sola plantilla.
 *
 * ESTE CONTROLADOR NO ESCRIBE NADA salvo la bitácora, y eso es deliberado. En el sistema
 * viejo imprimir escribía: `invoice.php` insertaba el encabezado histórico antes de
 * validar, y `invoice21.php` —el que se llama desde la lista de cerradas— lo vuelve a
 * insertar en cada reimpresión, sin guarda. Es una de las causas de sus 207 folios
 * duplicados, y explica que 424 de las filas repetidas tengan cliente.
 *
 * Por eso aquí **reimprimir no tiene ruta propia**: es volver a pedir `pdf()`.
 */
class PrefacturaPdfController extends Controller
{
    use RechazaPrefacturaCerrada;

    /**
     * El documento oficial de una prefactura cerrada, con sus cifras SELLADAS.
     *
     * Nunca la derivación: el papel tiene que mostrar lo que el cliente vio cuando se
     * emitió, que es justamente para lo que el sello existe.
     */
    public function pdf(Request $request, int $id): Response|JsonResponse
    {
        $prefactura = FactPrefactura::with(['renglones', 'pagos.formaPago', 'cliente', 'aeronave', 'cerradaPor'])
            ->findOrFail($id);

        if ($respuesta = $this->rechazarSiDescartada($prefactura)) {
            return $respuesta;
        }

        if (! $prefactura->estaCerrada()) {
            return response()->json([
                'message' => 'Esta prefactura todavía es un borrador: sin folio no hay documento. Imprime una cotización, o ciérrala primero.',
                'codigo' => 'sin_folio',
            ], 422);
        }

        // Un sello que ya no corresponde a sus renglones NO se imprime. Un PDF es papel que
        // sale de la oficina: emitir un documento del que el propio sistema sabe que no
        // cuadra es peor que no emitirlo.
        // El `try` abarca TAMBIÉN las cifras, no solo la verificación: `importesDe()`,
        // `cambio()` y `ivaTasaEtiqueta()` pueden lanzar, y si lo hicieran fuera de aquí
        // sería un 500 en lugar de un 422 — justo lo que la vista promete que no pasa.
        try {
            $discrepancias = $prefactura->discrepanciasDelSello();

            $cifras = [
                'subtotal' => (string) $prefactura->subtotal_sellado,
                'iva' => (string) $prefactura->iva_sellado,
                'ivaEtiqueta' => $prefactura->ivaTasaEtiqueta(),
                'total' => (string) $prefactura->total_sellado,
                'cambio' => $prefactura->cambio(),
                'importes' => $this->importesDe($prefactura),
            ];
        } catch (UnexpectedValueException $e) {
            report($e);

            return response()->json([
                'message' => 'No se puede verificar el documento: un renglón o la tasa de IVA tienen un valor que no se reconoce. Corrige el ajuste del renglón o la tasa en la configuración.',
                'codigo' => 'totales_no_calculables',
            ], 422);
        }

        if ($discrepancias !== []) {
            $total = $discrepancias['total'] ?? null;

            return response()->json([
                'message' => $total === null
                    ? 'El sello de esta prefactura no coincide con sus renglones, así que no se puede imprimir. Aclara la diferencia antes de emitir el documento.'
                    : "El sello de esta prefactura dice {$total['sellado']} y sus renglones suman {$total['derivado']}, así que no se puede imprimir. Aclara la diferencia antes de emitir el documento.",
                'codigo' => 'sello_inconsistente',
            ], 409);
        }

        $this->registrar(
            $request->user()->id,
            $prefactura,
            "Se imprimió el documento de la prefactura con folio {$prefactura->folio}.",
            ['folio' => $prefactura->folio, 'total' => (string) $prefactura->total_sellado],
        );

        return $this->render($prefactura, esCotizacion: false, cifras: $cifras,
            elaboradoPor: $prefactura->cerradaPor?->name ?? 'Sin registrar');
    }

    /**
     * El importe de cada renglón, indexado por su id, calculado sobre la colección YA
     * CARGADA que la vista itera y no releyendo de la base.
     *
     * Las dos cosas importan. Que lo llame el controlador DENTRO de su `try/catch` y no la
     * vista, porque la vista se renderiza después de ese `try/catch` y una excepción de
     * `importe()` ahí sería un 500 en lugar de un 422. Y que use estos objetos y no otra
     * lectura, porque
     * `subtotalDerivado()` sí relee: si alguien corrigiera un `ajuste_precio` desconocido
     * entre la carga y esa relectura, la verificación no lanzaría y la vista sí, sobre el
     * objeto viejo, y saldría un 500 en un documento cuyos datos vigentes están bien.
     *
     * @return array<int, string>
     */
    private function importesDe(FactPrefactura $prefactura): array
    {
        return $prefactura->renglones
            ->mapWithKeys(fn (FactPrefacturaRenglon $renglon) => [$renglon->id => $renglon->importe()])
            ->all();
    }

    /** Arma el PDF. La plantilla solo formatea: las cifras llegan ya calculadas. */
    private function render(FactPrefactura $prefactura, bool $esCotizacion, array $cifras, string $elaboradoPor): Response
    {
        $pdf = Pdf::loadView('pdf.prefactura', [
            'prefactura' => $prefactura,
            'esCotizacion' => $esCotizacion,
            'elaboradoPor' => $elaboradoPor,
        ] + $cifras)->setPaper('letter', 'portrait');

        $nombre = $esCotizacion
            ? "cotizacion-{$prefactura->id}.pdf"
            : "prefactura-{$prefactura->folio}.pdf";

        return $pdf->stream($nombre);
    }

    /** La bitácora, dentro de su transacción. Es la trazabilidad que el sistema viejo no tiene. */
    private function registrar(int $userId, FactPrefactura $prefactura, string $descripcion, array $datos): void
    {
        DB::transaction(fn () => Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
            accion: Bitacora::ACCION_EXPORTAR,
            descripcion: $descripcion,
            usuarioId: $userId,
            registroId: $prefactura->id,
            datosNuevos: $datos,
        ));
    }
}
```

- [ ] **Step 4: Las rutas**

En `routes/api.php`, dentro del grupo de la **línea 364**, junto a
`GET /prefacturas/{id}`:

```php
    // Imprimir no escribe nada, así que vive fuera del grupo de escritura; pero exige el
    // subdepartamento, porque emitir un documento es una acción del departamento.
    Route::get('/prefacturas/{id}/pdf', [PrefacturaPdfController::class, 'pdf'])
        ->middleware('subdep:factPrefacturas')->whereNumber('id');
```

Y el `use App\Http\Controllers\Api\Facturacion\PrefacturaPdfController;` arriba.

- [ ] **Step 5: Corre las pruebas**

Run: `php artisan test tests/Feature/Facturacion/ImpresionPrefacturaTest.php`
Expected: PASS, 10 pruebas.

Run: `php artisan test`
Expected: PASS.

- [ ] **Step 6: Verifica por mutación**

1. Quita la comprobación del sello. Expected: falla «una cerrada con el sello roto NO se
   imprime».
2. Haz que el método escriba algo —por ejemplo `$prefactura->touch()`— antes de devolver.
   Expected: falla «imprimir NO escribe nada más que la bitácora».

Restaura con `git checkout -- app/Http/Controllers/Api/Facturacion/PrefacturaPdfController.php`.

- [ ] **Step 7: Commit**

```bash
git add app/Http/Controllers/Api/Facturacion/PrefacturaPdfController.php routes/api.php tests/Feature/Facturacion/ImpresionPrefacturaTest.php
git commit -m "El documento de una cerrada: lee el sello, rechaza lo que no se debe emitir, y no escribe"
```

---

## Task 3: La cotización

**Files:**
- Modify: `app/Http/Controllers/Api/Facturacion/PrefacturaPdfController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Facturacion/ImpresionPrefacturaTest.php`

**Interfaces:**
- Consumes: el `render()` y el `registrar()` privados de la Task 2, y la vista con
  `esCotizacion: true` de la Task 1.
- Produces: `GET /api/facturacion/prefacturas/{id}/cotizacion`. La Task 4 lo llama.

**Tres trampas que la Task 2 descubrió por las malas. No repitas ninguna:**

- **`streamedContent()` no sirve:** DomPDF devuelve una `Response` normal, no una
  `StreamedResponse`. Usa **`getContent()`**. Ya está corregido en el código de abajo.
- **`->first()->update()` sobre una prefactura cerrada lanza en la propia preparación de la
  prueba**, porque pasa por la guarda del modelo. Para preparar un renglón inválido en una
  cerrada hay que usar `DB::table('fact_prefactura_renglones')->where(...)->update(...)`, que
  es el patrón del repositorio. En un **borrador** `->update()` sí vale, y la cotización
  siempre es un borrador, así que aquí no debería hacerte falta — pero tenlo presente.
- **Una mutación con `touch()` no muere dentro del mismo segundo**, porque `updated_at` no
  cambia. Si compruebas que algo no escribe con esa mutación, adelanta el reloj:
  `$this->travel(5)->seconds()`.

**Contexto:** la cotización es la misma hoja de un **borrador**, con cifras **derivadas**,
sin folio y marcada como no emitida. Es la acción menos grave de las tres —no emite nada ni
consume folio— y por eso la puede hacer cualquiera que pueda facturar. **Lo que sustituye al
código `'1234'`** que el sistema viejo lleva en el JavaScript del cliente (`procesar.php:166`)
**es la bitácora**: hoy, quién imprimió una cotización y cuándo no queda en ninguna parte.

- [ ] **Step 1: Escribe las pruebas que fallan**

Añádelas a `tests/Feature/Facturacion/ImpresionPrefacturaTest.php`:

```php
test('la cotizacion de un borrador se descarga como PDF', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    renglonDe($p, 500.0, 1);

    $respuesta = $this->get("/api/facturacion/prefacturas/{$p->id}/cotizacion");

    $respuesta->assertOk()->assertHeader('content-type', 'application/pdf');
    // getContent() y no streamedContent(): DomPDF devuelve una Response normal, no una
    // StreamedResponse, asi que streamedContent() no sirve aqui.
    expect(substr($respuesta->getContent(), 0, 5))->toBe('%PDF-');
});

test('una cerrada NO se cotiza: ya esta emitida', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    [$p] = prefacturaCompleta(100.0, 1);
    $cerrada = cerrarConSello($p, '100.00', '16.00', '116.00');

    $this->getJson("/api/facturacion/prefacturas/{$cerrada->id}/cotizacion")
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'ya_cerrada');
});

test('un borrador descartado no se cotiza', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);
    $p->update(['status' => FactPrefactura::STATUS_INACTIVO]);

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/cotizacion")
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'ya_descartada');
});

test('cotizar con un ajuste de renglon ilegible responde 422', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1)->update(['ajuste_precio' => 'raro']);

    $this->getJson("/api/facturacion/prefacturas/{$p->id}/cotizacion")
        ->assertStatus(422)
        ->assertJsonPath('codigo', 'totales_no_calculables');
});

test('cotizar queda en la bitacora y dice que NO se emitio nada', function () {
    // Es lo que sustituye al codigo '1234' del sistema viejo, que esta en el JavaScript del
    // cliente y no deja rastro de quien cotizo ni cuando.
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);

    $this->get("/api/facturacion/prefacturas/{$p->id}/cotizacion")->assertOk();

    $registro = Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_PREFACTURAS)
        ->where('accion', Bitacora::ACCION_EXPORTAR)->sole();

    expect($registro->registro_id)->toBe($p->id)
        ->and($registro->descripcion)->toContain('cotización')
        ->and($registro->descripcion)->toContain('no se emitió');
});

test('cotizar NO escribe nada mas que la bitacora, ni consume folio', function () {
    $this->actingAs(usuarioConSubdepartamento('factPrefacturas', 'Facturacion'));
    $p = prefacturaBorrador();
    renglonDe($p, 100.0, 1);

    $sentencias = [];
    DB::listen(function ($consulta) use (&$sentencias) {
        $sentencias[] = ltrim(strtolower($consulta->sql));
    });

    $this->get("/api/facturacion/prefacturas/{$p->id}/cotizacion")->assertOk();

    $escrituras = array_values(array_filter(
        $sentencias,
        fn (string $sql) => ! str_starts_with($sql, 'select') && ! str_contains($sql, 'bitacora'),
    ));

    expect($escrituras)->toBe([])
        ->and($p->fresh()->folio)->toBeNull()
        ->and($p->fresh()->estado)->toBe(FactPrefactura::ESTADO_BORRADOR);
});
```

- [ ] **Step 2: Córrelas para verificar que fallan**

Run: `php artisan test tests/Feature/Facturacion/ImpresionPrefacturaTest.php`
Expected: FAIL con 404 en las de cotización.

- [ ] **Step 3: El método**

En `PrefacturaPdfController`:

```php
    /**
     * La cotización: la misma hoja de un BORRADOR, con cifras derivadas y sin folio.
     *
     * Es la acción menos grave de las tres —no emite nada ni consume folio— y por eso la
     * puede hacer cualquiera que pueda facturar. Lo que sustituye al código `'1234'` que el
     * sistema viejo lleva en el JavaScript del cliente es la bitácora: hoy, quién cotizó y
     * cuándo no queda en ninguna parte.
     */
    public function cotizacion(Request $request, int $id): Response|JsonResponse
    {
        $prefactura = FactPrefactura::with(['renglones', 'pagos.formaPago', 'cliente', 'aeronave'])
            ->findOrFail($id);

        if ($respuesta = $this->rechazarSiDescartada($prefactura)) {
            return $respuesta;
        }

        if ($prefactura->estaCerrada()) {
            return response()->json([
                'message' => 'Esta prefactura ya está emitida con folio '.$prefactura->folio.': imprime el documento, no una cotización.',
                'codigo' => 'ya_cerrada',
            ], 422);
        }

        // Un borrador no tiene sello, así que las cifras son las derivadas. Si un renglón o
        // la tasa son ilegibles, eso es 422 y no un 500.
        try {
            $cifras = [
                'subtotal' => $prefactura->subtotal(),
                'iva' => $prefactura->iva(),
                'ivaEtiqueta' => $prefactura->ivaTasaEtiqueta(),
                'total' => $prefactura->total(),
                'cambio' => $prefactura->cambio(),
                'importes' => $this->importesDe($prefactura),
            ];
        } catch (UnexpectedValueException $e) {
            report($e);

            return response()->json([
                'message' => 'No se pueden calcular los totales: un renglón o la tasa de IVA tienen un valor que no se reconoce. Corrige el ajuste del renglón o la tasa en la configuración.',
                'codigo' => 'totales_no_calculables',
            ], 422);
        }

        $this->registrar(
            $request->user()->id,
            $prefactura,
            "Se imprimió una cotización de la prefactura {$prefactura->id} por {$cifras['total']}: no se emitió ningún documento y no se consumió folio.",
            ['total' => $cifras['total'], 'emitido' => false],
        );

        return $this->render($prefactura, esCotizacion: true, cifras: $cifras,
            elaboradoPor: $request->user()->name);
    }
```

- [ ] **Step 4: La ruta**

```php
    Route::get('/prefacturas/{id}/cotizacion', [PrefacturaPdfController::class, 'cotizacion'])
        ->middleware('subdep:factPrefacturas')->whereNumber('id');
```

- [ ] **Step 5: Corre las pruebas**

Run: `php artisan test tests/Feature/Facturacion/ImpresionPrefacturaTest.php`
Expected: PASS, 16 pruebas (10 de la Task 2 y 6 de esta).

Run: `php artisan test`
Expected: PASS.

- [ ] **Step 6: Verifica por mutación**

1. Haz que `cotizacion()` lea las cifras selladas. Expected: falla la prueba del PDF de un
   borrador, porque un borrador las tiene en `null`.
2. Quita la guarda de `estaCerrada()`. Expected: falla «una cerrada NO se cotiza».

- [ ] **Step 7: Commit**

```bash
git add app/Http/Controllers/Api/Facturacion/PrefacturaPdfController.php routes/api.php tests/Feature/Facturacion/ImpresionPrefacturaTest.php
git commit -m "La cotizacion: cifras derivadas, sin folio, y en bitacora en vez de tras un codigo en el cliente"
```

---

## Task 4: Los botones en la pantalla

**Files:**
- Modify: `resources/js/stores/apiFacturacionCatalogos.ts`
- Modify: `resources/js/pages/Facturacion/EditorPrefactura.tsx`

**Interfaces:**
- Consumes: las dos rutas de las Tasks 2 y 3.
- Produces: nada que otra task consuma. Es la última de producto.

**Contexto que el brief no puede saber:**

- **El PDF se abre con `window.open(url, '_blank')`**, no con un `fetch`. Funciona porque
  este proyecto usa el modo de cookie de Sanctum, así que la pestaña nueva lleva la sesión.
  Es además lo que el sistema viejo hace (`target="_blank"`), así que el operador conserva
  el gesto.
- **No metas estas dos URLs en `apiPrefacturas`**, que es el objeto de llamadas por `fetch`
  y devuelve JSON. Expórtalas como **funciones que construyen la URL**, al lado, para que
  quede claro que no se piden con `pedir()`.
- **`prefactura.sello_discrepa`** ya viene en la ficha: es `true` cuando el sello no cuadra,
  `false` cuando sí, y **`null` cuando no se pudo verificar** — y `null` no es lo mismo que
  `false`. Con `true` **o** `null` el botón de imprimir se deshabilita.
- **El editor ya tiene** `soloLectura`, `ocupado`, `manejarError`, `toast`, `BOTON_PRIMARIO`,
  `BOTON_SECUNDARIO` y el patrón de `Swal` con `confirmButtonColor: '#4f46e5'`. Reúsalos.
- **El botón «Cerrar e imprimir»** llama al cierre que ya existe —con su diálogo de
  confirmación, el de «hay cambios sin guardar» y el del faltante— y **solo si el cierre sale
  bien** abre el PDF.

- [ ] **Step 1: Las URLs en el store**

En `resources/js/stores/apiFacturacionCatalogos.ts`, junto a `apiPrefacturas`:

```typescript
/**
 * El PDF y la cotización NO se piden con `pedir()`: se abren en una pestaña, porque son
 * archivos y no JSON. La sesión viaja en la cookie de Sanctum, así que un `window.open`
 * basta y no hace falta montar una descarga por `fetch`.
 */
export const urlDocumentoPrefactura = (id: number) => `${BASE}/prefacturas/${id}/pdf`;
export const urlCotizacionPrefactura = (id: number) => `${BASE}/prefacturas/${id}/cotizacion`;
```

- [ ] **Step 2: Los tres botones**

En `EditorPrefactura.tsx`:

- **Imprimir**, visible cuando `prefactura.estado === 'cerrada'`. Abre
  `urlDocumentoPrefactura(prefactura.id)` en una pestaña. **Deshabilitado** cuando
  `prefactura.sello_discrepa !== false`, con el motivo junto al botón y como `title`: con el
  sello roto el servidor responde 409, y es mejor que el operador no pueda pulsarlo que
  recibir el error después. Es el mismo criterio que el bloque 3 usó con «Cerrar» cuando los
  totales no se pueden calcular.
- **Cotizar**, visible cuando es un borrador y no está descartado. Pide confirmación con
  `Swal`, explicando que **el papel lleva precios y no es un documento emitido**, y al
  aceptar abre `urlCotizacionPrefactura(prefactura.id)`.
- **Cerrar e imprimir**, visible cuando es un borrador: llama al cierre que ya existe y, si
  sale bien, abre el documento. Así el operador conserva el gesto de un clic que tenía.

- [ ] **Step 3: Verifica**

```bash
npx tsc --noEmit
npx eslint resources/js/pages/Facturacion/EditorPrefactura.tsx resources/js/stores/apiFacturacionCatalogos.ts
npm run build
php artisan test
```

Expected: `tsc` solo con el error preexistente de `WalkAroundController.ts(905,5)`; eslint
limpio; build correcto; la suite en verde.

- [ ] **Step 4: Recorre a mano los cuatro casos y repórtalos**

El proyecto **no tiene pruebas de frontend**, así que la lectura es la red. Recorre sobre tu
código y di en el reporte qué pasa en cada uno:

1. Una cerrada con el sello bueno: ¿qué botones hay y qué abren?
2. Una cerrada con `sello_discrepa: true`, y otra con `null`: ¿queda deshabilitado en los dos?
3. Un borrador: ¿sale Cotizar y «Cerrar e imprimir», y no Imprimir?
4. Un borrador descartado: ¿queda algún botón de impresión?

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/Facturacion/EditorPrefactura.tsx resources/js/stores/apiFacturacionCatalogos.ts
git commit -m "El editor imprime, cotiza y cierra-e-imprime; con el sello roto no deja imprimir"
```

---

## Task 5: La guía de despliegue

**Files:**
- Create: `docs/superpowers/specs/2026-10-05-facturacion-4-despliegue-y-pendientes.md`

**Interfaces:** ninguna.

**Contexto:** sigue la forma de `2026-10-02-facturacion-3-despliegue-y-pendientes.md`.

- [ ] **Step 1: Escribe la guía**

Tiene que incluir, y esto no es negociable:

- **La dependencia nueva.** `composer require barryvdh/laravel-dompdf` ya está en
  `composer.json`, así que el despliegue necesita **`composer install`** y no solo un `git
  pull`. Dilo explícitamente: es el paso que un despliegue de solo-código omite.
- **El logo.** `public/img/logo-facturacion.jpg` va en el repositorio; si el despliegue
  sincroniza `public/` de otra forma, hay que comprobarlo, porque sin el logo el PDF sale sin
  cabecera y **no falla**: sale mal en silencio.
- **Que este bloque no tiene migraciones**, así que no hay nada que revertir — y por tanto
  tampoco la advertencia de rollback de los bloques anteriores. **Pero las de los bloques 2 y
  3 siguen vigentes:** `migrate:rollback` revierte el lote entero y el `down()` de la tabla
  de pagos es un `dropIfExists`, así que un rollback después de que alguien cobre pierde los
  pagos.
- **El número de pruebas en verde al cierre, medido, no estimado.**
- **Lo que hay que probar a mano, y aquí es lo más importante del bloque:** que alguien
  **imprima una prefactura de verdad y la compare con una del sistema viejo**. Las pruebas
  garantizan el contenido; que la hoja se vea bien no lo puede comprobar ninguna. Enumera qué
  mirar: que el logo sale, que la tabla no se corta, que los acentos salen bien, que el pie
  entra en la página, y que una cotización se distingue a simple vista de un documento
  emitido.
- **Que el PDF viejo y el nuevo pueden diferir en el aspecto**, porque uno es `fpdf` con
  posicionamiento absoluto y el otro es HTML. El contenido es el mismo; la maquetación no
  será idéntica al píxel.
- **La deuda que este bloque NO retira**, incluida la de los anteriores que sigue abierta y
  la nueva:
  - **La ruta `GET /api/ControlMedicamento/exportar-pdf` estaba rota** —importaba una clase
    que no existía— y al instalar DomPDF **deja de estarlo**. Nadie la llama todavía desde el
    frontend. Conviene que alguien decida si se usa o se borra.
  - **Las dos vías de PDF del repositorio siguen sin unificar:** este bloque usa DomPDF en el
    servidor y el control de medicamentos usa `@react-pdf/renderer` en el cliente. Alguien
    debería decidirlo antes de que haya una tercera.
  - **No hay vista previa** antes de descargar: el PDF se abre en una pestaña, que sirve de
    previa. Si el departamento la echa en falta, es trabajo de pantalla.
  - **Cuál de las dos causas de los 207 folios duplicados domina** sigue sin medir; hace
    falta MySQL arriba. Se distingue comparando si las copias de cada folio son idénticas en
    dinero, cliente y estatus (reimpresión) o difieren (intento fallido y luego éxito). **El
    bloque 6 lo necesita.**

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-10-05-facturacion-4-despliegue-y-pendientes.md
git commit -m "Guia de despliegue del bloque 4: composer install, el logo, y que alguien imprima una de verdad"
```

---

## Autorrevisión del plan

**Cobertura de la spec.** Cada requisito tiene su task:

| Requisito de la spec | Task |
|---|---|
| Una plantilla Blade, DomPDF, `DejaVu Sans`, el logo con `public_path()` | 1 |
| `/pdf` lee **solo** el sello | 1 (la prueba) y 2 (el controlador) |
| `/cotizacion` lee las derivadas, sin folio, con la leyenda | 1 (la prueba) y 3 |
| Reimprimir sin ruta propia | 2 (su prueba de las dos llamadas) |
| El endpoint no escribe | 2 y 3 (las pruebas con `DB::listen`) |
| Los cinco rechazos | 2 (cuatro) y 3 (`ya_cerrada` y los suyos) |
| «Elaborado por» con el nombre real | 1 y 2 |
| La cortesía con su precio y `0.00` | 1 |
| Solo la nota externa | 1 |
| El pie literal de las 72 horas | 1 |
| La bitácora de las dos acciones | 2 y 3 |
| Los botones y el deshabilitado con el sello roto | 4 |
| Que alguien imprima una de verdad | 5 |

**Hueco que encontré y cerré:** la spec dice que las pruebas «extraen el texto del PDF». Eso
exigiría un parser nuevo. El plan lo cambia por afirmar sobre el **HTML que la vista genera**
—que es donde está el contenido— más una comprobación de que el endpoint devuelve un PDF de
verdad (`%PDF-` y el `content-type`). Misma garantía, sin dependencia nueva, y mucho más
rápido.

**Consistencia de tipos.** La vista recibe siempre las mismas siete claves
(`prefactura`, `esCotizacion`, `subtotal`, `iva`, `ivaEtiqueta`, `total`, `cambio`,
`importes`, `elaboradoPor`), y las
cuatro de dinero y el `cambio` son **cadenas**, e `importes` es un
`array<int, string>` indexado por id de renglón. `render()` y `registrar()` son privados de
`PrefacturaPdfController` y los usan sus dos métodos públicos. `sello_discrepa` es
`boolean | null` en TypeScript, y la Task 4 compara con `!== false` justamente por el `null`.

---

## Entrega

Plan guardado en `docs/superpowers/plans/2026-10-05-facturacion-4-impresion.md`.
