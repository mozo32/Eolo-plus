# Bloque 4 — Guía de despliegue y pendientes abiertos

**Fecha:** 2026-10-05 · **Rama:** `facturacion` (base del bloque: `12440c3`, el último commit del bloque 3; `c97b12a` es el commit del plan del bloque 4 y queda **dentro** de él)

Acompaña a `2026-10-05-facturacion-4-impresion-design.md` y continúa la guía del bloque
anterior, `2026-10-02-facturacion-3-despliegue-y-pendientes.md`, a la que remite en varios
puntos en lugar de repetirla. Recoge lo que hay que hacer **antes** de poner el bloque en
producción, lo que las pruebas no pueden demostrar, y lo que alguien tiene que mirar con sus
ojos.

Cada afirmación de esta guía está respaldada por el código de la rama o por una medición que
se nombra. Donde algo **no** se comprobó, se dice.

**Nada de esta rama llega a `main` hasta que el departamento de facturación pruebe y apruebe.**
Esta guía es lo que ese departamento y quien despliegue van a leer.

**Los comandos de esta guía son de bash** (`ls -l`, `grep -E`, comentarios con `#`): córrelos desde Git
Bash o WSL (la pila es XAMPP sobre Windows y `cmd` no los entiende); donde importa, el equivalente de
PowerShell va junto al comando (se comprobaron las dos versiones en la máquina de desarrollo).

**Antes de desplegar nada hay que subir las ramas: hoy solo existen en local.** `git branch -a` no
muestra `remotes/origin/facturacion` ni `remotes/origin/reverb-declarado`, y
`git ls-remote --heads origin` (comprobado el 2026-10-05) solo lista `dev`, `firma-en-entrega-turno`,
`main` y `produccion`. Sin `git push -u origin facturacion` y `git push -u origin reverb-declarado`
el servidor no tiene nada que traer.

## Lo que hizo esta rama

Trae a Eolo-plus la impresión de la prefactura, en tres acciones:

- **Imprimir** el documento de una prefactura **cerrada**: `GET /api/facturacion/prefacturas/{id}/pdf`.
  Lee **solo** las cifras selladas al cerrar (subtotal, IVA, total y tasa de IVA), nunca la
  derivación.
- **Cotizar** un **borrador**: `GET /api/facturacion/prefacturas/{id}/cotizacion`. La misma hoja,
  con las cifras derivadas, sin folio y con la leyenda «Sin folio — no es un documento emitido».
- **Reimprimir**: no tiene ruta propia. Es volver a pedir `/pdf`.

El PDF lo genera el servidor (`barryvdh/laravel-dompdf`, a partir de una sola plantilla,
`resources/views/pdf/prefactura.blade.php`, con la tipografía DejaVu Sans). El editor de la
prefactura gana tres botones: **Imprimir**, **Cotizar** y **Cerrar e imprimir**.

Las dos rutas exigen el subdepartamento `factPrefacturas`, el mismo del bloque 2: **no hay
subdepartamento nuevo ni seeder que correr.**

## Lo que este bloque corrige del sistema viejo

Es la razón de ser del bloque y el departamento lo va a notar:

- **Imprimir ya no escribe nada.** En el sistema viejo imprimir escribía: `invoice.php` inserta
  el encabezado histórico **antes** de validar, y `invoice21.php` —el que se llama desde la
  lista de cerradas— lo vuelve a insertar **en cada reimpresión**, sin guarda. Es una de las
  causas de sus **207 folios duplicados**. Ahora reimprimir es volver a pedir la misma ruta, y
  no duplica nada: lo fija una prueba que captura toda sentencia SQL de la petición
  (`DB::listen`) y exige que no haya ninguna que no sea `select` salvo la de la bitácora, con el
  reloj adelantado para que un `touch()` no pase desapercibido. Lo único que se escribe es la
  bitácora.
- **Una prefactura cuyo sello no cuadra no se imprime.** Si el sello ya no corresponde a sus
  renglones, el endpoint responde 409 (`sello_inconsistente`). El sistema viejo emitiría el
  papel igual.
- **Quién imprimió qué y cuándo queda en la bitácora**, incluidas las cotizaciones. En el viejo,
  cotizar estaba detrás de un código `'1234'` escrito en el JavaScript del cliente y no dejaba
  rastro alguno.
- **La tasa de IVA del papel sigue a la configuración.** Los cuatro PDF viejos llevan
  `IVA (16%)` escrito a mano; el nuevo imprime la tasa que corresponde (la sellada, en una
  cerrada).

Los rechazos del endpoint, por si el departamento los ve en pantalla:

| Situación | Código HTTP | `codigo` |
|---|---|---|
| Imprimir un borrador (sin folio) | 422 | `sin_folio` |
| Cotizar una prefactura ya cerrada | 422 | `ya_cerrada` |
| Imprimir o cotizar una descartada | 409 | `ya_descartada` |
| Imprimir una cerrada cuyo sello no cuadra | 409 | `sello_inconsistente` |
| Un renglón o la tasa de IVA ilegibles | 422 | `totales_no_calculables` |

## PASO QUE UN DESPLIEGUE DE SOLO-CÓDIGO OMITE: `composer install`

**Este bloque no se despliega con un `git pull` a secas.** `composer.json` pide una
**dependencia de producción nueva**, `barryvdh/laravel-dompdf` (`^3.1`, que trae
`dompdf/dompdf`), y los dos están en `composer.lock`. Sin `composer install`, `vendor/` no los
tiene y **la primera petición de un PDF falla**. Es el paso que se olvida cuando el despliegue
«solo trae código».

Y hay un asunto aparte, grave, que **no es de esta rama sino de `main`** (la sección siguiente).

## Dos cosas distintas sobre reverb: desplegar esta rama es seguro, y `main` en producción no

Esto **no es del bloque 4 y no es una condición para desplegarlo**. Son dos asuntos, y conviene no
mezclarlos:

- **Desplegar `facturacion` es seguro por sí solo** (punto 1 de más abajo).
- **Aparte y en paralelo, `reverb-declarado` tiene que subir a `main`**, porque la aplicación en
  producción sobre `main` está a un `composer install` de romperse, con bloque 4 o sin él (punto 2).

El problema de fondo:

`laravel/reverb` y `pusher/pusher-php-server` estaban instalados en `vendor/` **sin figurar ni en
`composer.json` ni en `composer.lock`**. La aplicación los usa: el `.env` tiene
`BROADCAST_CONNECTION=reverb`, tres eventos transmiten (`OperacionProgramadaCambio`,
`RemisionCreada` y `MatriculaRestringidaCambio`) y el manifiesto de paquetes en caché
(`bootstrap/cache/packages.php`) los referencia.

Un `composer install` limpio **instala lo que dice el lock y retira lo que no está en él**: los
retiraría, y **`artisan` dejaría de arrancar por completo**. La bomba está puesta en `main`, con o
sin bloque 4: cualquier `composer install` en producción la detona (el bloque 4 solo da un
motivo más para correrlo, porque instalar DomPDF lo exige).

Se descubrió porque el `composer require` de DomPDF **desinstaló los dos paquetes del `vendor/`
durante el desarrollo**, y hubo que reinstalarlos desde la caché de Composer (reverb **1.12.0**,
pusher **7.3.0**, las versiones que ya estaban).

**Y después se detonó de verdad, lo que confirma que esto no es teórico.** Al preparar el arreglo
hubo que volver a la rama `facturacion` y correr `composer install`: sincronizó `vendor/` con un lock
que no declaraba pusher, lo retiró, y a partir de ese momento **ni `php artisan --version` ni
`php artisan test` arrancaban**. El error era
`Error::("Class "Pusher\Pusher" not found")` desde `BroadcastManager::pusher()`: con
`BROADCAST_CONNECTION=reverb` en el `.env`, la aplicación **no bootea** sin el paquete. Exactamente
lo que esta sección advierte que pasaría en producción.

### 1. Esta rama: instalable por sí sola, sin precondiciones

**`facturacion` ya trae el arreglo de reverb fusionado** (commit `7a421c9`): su `composer.json`
declara los tres paquetes y su lock los fija (dompdf **v3.1.2**, reverb **v1.12.0**, pusher
**7.3.0**). Un `composer install` sobre esta rama lee **su** lock, que declara reverb y pusher, así
que **no retira nada y no hay nada que romper**. Quien despliegue esta rama para que el departamento
pruebe **no tiene que confirmar nada en producción ni esperar a nadie**. Hizo falta fusionarlo
porque, sin eso, el departamento no habría podido ni instalar la rama para probarla.

### 2. Aparte y en paralelo: `reverb-declarado` tiene que subir a `main`

La aplicación en producción **corriendo `main`** está hoy a un `composer install` de romperse, **con
bloque 4 o sin él**. Es un asunto de `main` y no bloquea el despliegue de esta rama; pero no debe
esperar a que facturación apruebe.

1. **Existe la rama `reverb-declarado`** —**solo en local**: no está en el remoto (ver arriba)—,
   creada desde `main` (commit `94a3a19`), que los declara con las versiones que ya estaban
   corriendo: `laravel/reverb:^1.12` → **v1.12.0** y `pusher/pusher-php-server:^7.3` → **7.3.0**. Su
   lock gana 13 paquetes —los dos y sus dependencias de ReactPHP— y **no retira ni cambia de versión
   ninguno**, comprobado comparando el lock antes y después. Suite en esa rama: **229 en verde**.
2. **Hay que subirla y fusionarla en `main` sin esperar a `facturacion`**: mientras no esté, un
   `composer install` en producción retira los dos paquetes.
3. **Al fusionar las dos habrá conflicto en `composer.lock`**, porque cada una añade paquetes
   distintos. Ya ocurrió al traer `reverb-declarado` a `facturacion`, y se resuelve así: tomar el
   lock de la rama que se conserva y regenerarlo con
   `composer update laravel/reverb pusher/pusher-php-server`. **No se resuelve el lock a mano.**

**Comprobación inmediata tras el `composer install`**, antes de seguir con nada más:

```bash
php artisan --version                     # debe responder; si falla, reverb o pusher se retiraron
composer show laravel/reverb              # debe mostrar la versión 1.12.x
composer show pusher/pusher-php-server    # debe mostrar la versión 7.3.x
composer show barryvdh/laravel-dompdf     # debe mostrar la versión 3.1.x
```

## Orden de despliegue

```bash
# Nada que confirmar antes: esta rama es instalable por sí sola (trae reverb y pusher declarados),
# así que `reverb-declarado` en `main` NO es una condición de este despliegue (ver arriba).
# Sí hace falta que la rama `facturacion` esté subida al remoto (hoy solo existe en local) y que sea
# la rama activa del servidor: con `main` activo, `git pull` no trae este bloque.

git pull
composer install --no-dev --optimize-autoloader

# Comprobar que arranca y que las tres dependencias están. SI `artisan` falla, PARAR.
php artisan --version
composer show | grep -E 'laravel/reverb|pusher/pusher-php-server|barryvdh/laravel-dompdf'   # deben salir las tres
# en PowerShell: composer show | Select-String 'laravel/reverb|pusher/pusher-php-server|barryvdh/laravel-dompdf'

# El logo del documento. Si falta, el PDF sale SIN CABECERA Y NO DA ERROR (ver abajo).
ls -l public/img/logo-facturacion.jpg      # en PowerShell: Get-Item public\img\logo-facturacion.jpg

php artisan optimize:clear
npm ci && npm run build
```

**No hay migraciones nuevas en este bloque** (la rama no añade ni modifica ningún archivo de
`database/`), y **no hay seeder ni importador que correr**. Si los bloques 2 y 3 **tampoco** están
aún en producción, sus migraciones y sus pasos obligatorios se aplican como dicen sus guías
(`2026-10-01-facturacion-2-despliegue-y-pendientes.md` y la del bloque 3): este bloque no las
sustituye.

**Backend y frontend se despliegan juntos**, y hay que reconstruir el frontend. El backend nuevo
con el frontend viejo no se rompe (las rutas solo se agregan), pero no habría botones para
imprimir: el departamento no vería el cambio.

## El logo: si falta, el PDF sale mal y no avisa

`public/img/logo-facturacion.jpg` **va en el repositorio** (se copió de `Prefectura/img/logo.jpg`).
La plantilla lo carga con `public_path('img/logo-facturacion.jpg')`.

**Si el despliegue sincroniza `public/` de otra forma** (un `rsync` con exclusiones, una carpeta
`public/` que no viene del repositorio, un servidor de archivos estáticos aparte), **hay que
comprobar que el archivo está**. Sin él, **el PDF sale sin cabecera y no da ningún error**: sale
mal en silencio, que es el peor modo de fallar. Esta guía no conoce ninguna prueba que lo detecte
en producción; solo mirar la hoja.

## ATENCIÓN: sin migraciones aquí, pero las advertencias de los bloques 2 y 3 siguen vigentes

Este bloque **no tiene nada que revertir**, así que **no aplica la advertencia de rollback de los
bloques anteriores a sus propios cambios**. Pero las de los bloques 2 y 3 **siguen vigentes**, y
hay que recordarlas porque `php artisan migrate:rollback` no pregunta:

- `migrate:rollback` revierte **el lote entero**, no «una migración».
- El `down()` de la tabla de pagos (`2026_09_29_093100`) es un **`dropIfExists`**: un rollback
  **después de que alguien cobre pierde TODOS los pagos**, sin copia en ningún otro lado.
- Si los bloques 2 y 3 se desplegaron en un solo `migrate`, el rollback borra además todas las
  prefacturas (ver la guía del 2).

Detalle y reglas en la sección «ATENCIÓN: revertir este bloque DESTRUYE pagos» de la guía del
bloque 3. **Para dar marcha atrás con este bloque no hace falta ninguna migración**: se vuelve al
código anterior y listo (el único efecto: sin botones y sin las dos rutas).

## Lo que hay que probar a mano, y es lo más importante del bloque

### 1. Que alguien imprima una prefactura de verdad y la compare con una del sistema viejo

**Las pruebas garantizan el contenido; que la hoja se vea bien no lo puede comprobar ninguna.**
Nadie ha visto todavía la página renderizada: `pdftoppm` no está instalado en la máquina de
desarrollo.

Lo que **sí** se verificó, sobre un PDF real generado por el servidor y leído con `pdftotext`:

| Qué | Resultado |
|---|---|
| Acentos y ñ a través de DejaVu Sans | Intactos, sin mojibake («Atención», «señalización», «Ñandú», «Pérez Núñez», «Cortesía», «REMISIÓN», «OPERACIÓN») |
| Una prefactura normal (4 renglones) | **1 página**, con totales, FIRMA CLIENTE y el pie dentro |
| Una de 41 renglones | 3 páginas: la tabla ocupa 1–2, los totales cierran en la 2, la firma y el pie van en la 3 |
| El `<thead>` en un documento de varias páginas | **Se repite** en las dos páginas que la tabla ocupa |
| El pie, completo y sin recortar | Sí: las 72 horas, `MXN $250.00 + IVA` y el aviso de privacidad |
| El renglón de cortesía | Sale con su precio y el importe en **`0.00`** |
| Totales y formas de pago | `SUBTOTAL`, `IVA (16%)`, `TOTAL`, la forma de pago y el `CAMBIO` |

**Lo que eso NO dice es si la hoja se ve bien.** `pdftotext` lee texto, no mira la página:
no dice si algo se encima, si el logo está donde debe, ni si la alineación de las columnas es
legible. Por eso hace falta una persona con la hoja delante (en pantalla y **impresa en papel**,
si es lo que el departamento entrega al cliente).

**Qué mirar:**

- [ ] **Que el logo sale**, arriba a la izquierda, junto al RFC y los datos del emisor.
- [ ] **Que la tabla de renglones no se corta**: ningún renglón partido entre dos páginas, y en
      un documento de varias páginas la cabecera de la tabla se repite.
- [ ] **Que los acentos y la ñ salen bien**: nombres de cliente, conceptos, la palabra
      «REMISIÓN».
- [ ] **Que el pie entra en la página**: las 72 horas, `MXN $250.00 + IVA` y el aviso de
      privacidad, completos.
- [ ] **Que una cotización se distingue a simple vista de un documento emitido**: la cotización
      dice «COTIZACIÓN» y «Sin folio — no es un documento emitido» donde el emitido lleva
      «PREFACTURA DE SERVICIOS» y «FOLIO: n».
- [ ] **Que las cifras coinciden con la pantalla**: subtotal, IVA, total, formas de pago y cambio.
- [ ] **Una prefactura con cortesía**: el renglón sale con su precio y el importe en `0.00`.
- [ ] **Una prefactura larga** (decenas de renglones): la firma y el pie no quedan huérfanos ni
      recortados.
- [ ] **La aeronave en DATOS DE OPERACIÓN**: sale como `tipo (categoría)`, igual que en el papel
      viejo (`invoice.php:134-135`), y un guion donde falte el dato. Fue lo único de la
      especificación que el primer borrador de la plantilla se dejó fuera.
- [ ] **Mirar el precio unitario en la hoja impresa.** El papel lo imprime con **cuatro decimales
      y sin símbolo de moneda** (`100.0000`), mientras el viejo imprime `$100.00`; los importes y
      los totales también salen sin `$` donde el viejo ponía `$` por fila y `MXN $` en el total
      (`invoice.php:225,231,243,253`). Lo manda el plan del bloque; **la especificación no dice
      nada**, y **nadie ha visto la hoja**: el departamento tiene que decidirlo mirándola, no
      adivinándolo quien programa. De paso: la tasa se escribe `16 %` con espacio en la pantalla y
      `16%` sin espacio en el papel.

**El PDF viejo y el nuevo pueden diferir en el aspecto.** El viejo es `fpdf` con posicionamiento
absoluto; el nuevo es HTML renderizado por DomPDF. **El contenido es el mismo; la maquetación no
será idéntica al píxel.** La pregunta para el departamento no es «¿es igual?» sino «¿dice lo
mismo y se lee igual de bien?».

La fecha del documento emitido es la de **cierre** (`cerrada_at`); la de una cotización, la de
**hoy**. Si el departamento esperaba otra, hay que decirlo ahora: es un cambio de una línea, pero
es una decisión de contenido (se tomó porque `fact_prefacturas` no tiene columna `fecha`).

### 2. Los tres botones, en el navegador

**Este proyecto no tiene pruebas de frontend** (no hay vitest, ni jsdom, ni testing-library), así
que los tres botones solo están verificados **por lectura del código**, más `tsc`, `eslint` y el
build. Que alguien los pruebe en el navegador:

- [ ] **Imprimir** aparece en una prefactura **cerrada** y abre el PDF en una pestaña nueva.
- [ ] Con el **sello roto** (la ficha avisa de que no coincide con los renglones), **Imprimir
      está deshabilitado y dice por qué**.
- [ ] **Cotizar**, en un borrador, **avisa de que el papel lleva precios y no es un documento
      emitido**, y abre la cotización.
- [ ] **Cerrar e imprimir** cierra la prefactura y abre el documento **en un solo gesto**.

**Este último es el que más falta hace probar**, porque depende de que el navegador permita abrir
la pestaña. El código la abre **justo después de la última confirmación y antes de la petición**,
para conservar la autorización que el navegador da a un clic (una pestaña abierta después de
esperar la respuesta del servidor puede bloquearse). Pero **eso no se ha probado en un navegador
real**: ni con un bloqueador de ventanas emergentes estricto, ni en Safari. Si el navegador la
bloquea, el cierre **se completa igual** y sale un aviso diciendo que se imprima con el botón
**Imprimir**: la pestaña no impide el cierre.

Probarlo en: Chrome, Firefox y Safari al menos; una vez con el bloqueador de ventanas emergentes
activado y una sin él; y cancelando el diálogo de confirmación (no debe quedar ninguna pestaña en
blanco abierta). Si el cierre sale bien pero el sello no cuadra, el operador ve un aviso de que
quedó cerrada con su folio pero el documento no se pudo emitir.

**Y una casilla más, que ninguna prueba puede marcar:**

- [ ] **Pegar la URL del PDF en una pestaña nueva** (la de `/api/facturacion/prefacturas/{id}/pdf`,
      copiada de la barra de direcciones tras pulsar **Imprimir**) y comprobar que **la sesión
      sirve**. La razón: la pila `api` lleva `EnsureFrontendRequestsAreStateful`, que **solo aplica
      la sesión cuando la petición trae `Referer` u `Origin` de un dominio de `sanctum.stateful`**
      (la lista sale de `SANCTUM_STATEFUL_DOMAINS` en `config/sanctum.php`). Una navegación desde el
      botón sí lo manda, pero **una URL pegada a mano, marcada como favorito o enviada a un
      compañero puede no mandarlo**, y entonces `auth:sanctum` buscaría un token y respondería
      **401**. **Ninguna prueba lo detecta**, porque todas usan `actingAs()`, que no pasa por el
      guard real. Y es un caso natural: la especificación describe reimprimir como «volver a pedir
      `/pdf`». **Si falla, hay que decidir si las dos rutas de impresión se mueven a la pila
      `web`.** Hoy solo se documenta: no se tocó la pila de middleware.

## Resultado de las pruebas al cierre

**1034 pruebas en verde**, medidas con `php artisan test` **en serie** (980 al empezar el
bloque; 1024 antes de la revisión final, que añadió pruebas y no quitó ninguna). `npx tsc --noEmit` solo da el error preexistente de
`resources/js/actions/App/Http/Controllers/Api/WalkAroundController.ts(905,5)`; `eslint` queda
limpio y `npm run build` termina bien.

## Nota de entorno

**`php artisan test --parallel` no se usa en esta máquina:** da 22 fallos falsos, ajenos a este
trabajo (ver la guía del 1b). **La suite se corre en serie.**

Las pruebas de este bloque afirman sobre el **HTML** que la plantilla genera, más una
comprobación de que el endpoint devuelve un PDF de verdad (`%PDF-` y el `content-type`). Corren
sobre sqlite en memoria, igual que el resto: lo que sqlite no puede demostrar (puntos 1 a 6 de las
guías de los bloques 2 y 3) **sigue pendiente** de MySQL real y este bloque no lo cambia.

## ADVERTENCIA PARA EL BLOQUE 6: el CAMBIO de un documento emitido no está sellado, y nada lo verifica

**Es el único camino por el que este bloque podría, en el futuro, emitir dos papeles distintos con
el mismo folio, y el bloque 6 es quien lo abre.**

- `cambio()` **se deriva**: resta el total (el sellado, en una cerrada) de los pagos **vigentes** que
  lee de la base (`sobrepago()` y `efectivoPagado()`). **No hay columna `cambio_sellado`**
  (la migración de pagos lo dice: «NO se guarda el cambio»), mientras que el sistema viejo **sí** lo
  guardaba: `tb_prefcatura` y `tb_hprefactura` llevan `Cambio` (`Prefectura/invoice.php:30,47`), aunque el dato del viejo no era fiable
  (la propia migración de pagos mide que está mal en las dos direcciones): lo que falta es **sellar el
  cambio bien calculado**, no copiar el del viejo.
- `discrepanciasDelSello()` compara subtotal, IVA, total y tasa. **No compara el cambio**, así que
  nada avisa si cambia.
- Hoy el papel es estable **solo** porque el bloque 3 bloquea los pagos de una cerrada
  (`PagosPrefactura::bloquearBorrador` lanza `RenglonDePrefacturaCerradaException`). Es una
  protección de otro bloque, no del papel.
- **El bloque 6 es «corregir una prefactura cerrada»: en el momento en que permita tocar los pagos
  de una cerrada, una reimpresión imprimirá un cambio distinto del que firmó el cliente, sin 409 y
  sin aviso.** El folio será el mismo y el papel no.
- Quien lo herede tiene que decidirlo **antes** de abrir ese camino: o sellar el cambio al cerrar
  (columna `cambio_sellado`, que `discrepanciasDelSello()` compare y que el documento lea, como ya
  hace con las otras tres cifras), o dejar escrito que el cambio de un documento emitido es el de
  hoy y no el de la firma.

## La deuda que este bloque NO retira

**Nueva o tocada por este bloque:**

- **La ruta `GET /api/ControlMedicamento/exportar-pdf` estaba rota y deja de estarlo; lo que hay que decidir es su puerta.**
  `ControlMedicamentoController::exportarPdf` importa `Barryvdh\DomPDF\Facade\Pdf`, una clase que
  no existía; al instalar DomPDF **ya existe**, y la ruta pasa de fallar a funcionar. **Nadie la
  llama todavía desde el frontend** (solo aparece en el archivo generado
  `resources/js/actions/.../ControlMedicamentoController.ts`). **Falta el dato que
  hace falta para decidir si se usa o se borra:** ese grupo de rutas (`routes/api.php:169`) lleva
  `['api', 'auth:sanctum']` **y nada más**, sin `subdep`. **No tiene puerta departamental**, así que
  la ruta entrega el PDF de los cierres de control de medicamentos a **cualquier usuario
  autenticado**. Antes reventaba por una clase inexistente; ahora funciona. Eso es lo que hay que
  decidir: si el PDF lleva puerta departamental o si la ruta se borra.
- **Las dos vías de PDF del repositorio siguen sin unificar.** Este bloque usa DomPDF **en el
  servidor**; el control de medicamentos, la entrega de turno y el walk-around usan
  `@react-pdf/renderer` **en el cliente**. Alguien debería decidirlo antes de que haya una tercera.
- **No hay vista previa** antes de descargar: el PDF se abre en una pestaña, que sirve de previa.
  Si el departamento la echa en falta, es trabajo de pantalla.
- **El mensaje del trait `RechazaPrefacturaCerrada` es impreciso al imprimir.** Cuando alguien
  intenta **imprimir** una prefactura descartada, el rechazo dice «Este borrador está descartado:
  ya no se puede modificar ni cerrar». No es falso, pero habla de modificar y cerrar cuando la
  persona quería imprimir. El trait lo comparten todas las escrituras (y el mismo texto vive en
  `PagosPrefactura` y en `PrefacturaDescartadaException`), así que cambiarlo afectaría a otros
  endpoints: no se tocó en este bloque.
- **`routes/api.php` está marcado por `pint`**, y **`EditorPrefactura.tsx` por `prettier`**,
  **los dos de antes de este bloque**: se comprobó contra el historial en los dos casos (el primero
  extrayendo el archivo en `c97b12a`, en `55947f4` y en `HEAD`: marcado en los tres; el segundo
  contra `HEAD~1` de la task del editor). **No se reformatearon**, para no mezclar un diff de
  estilo ajeno en una rama que espera aprobación.
- **`EditorPrefactura.tsx` pasa de las mil líneas** (**1097** al cerrar el bloque, contadas con
  `wc -l`). Este
  bloque añadió una fracción y **movió el flujo de cierre a una función** (`flujoDeCierre`,
  alrededor de 90 líneas de código que ya existían), pero el archivo sigue creciendo y **el bloque
  5 lo hereda así**. Partirlo es un refactor que no cabía en una rama que espera aprobación.
- **Cuál de las dos causas de los 207 folios duplicados domina sigue sin medir.** Hace falta que
  MySQL vuelva. Se distingue comparando si las copias de cada folio son **idénticas** en dinero,
  cliente y estatus (**reimpresión**: `invoice21.php` reinserta) o **difieren** (**intento fallido
  y luego éxito**: `invoice.php` inserta antes de validar). **El bloque 6 lo necesita.** Lo que
  este bloque sí garantiza es que **el sistema nuevo no fabrica ninguna de las dos**.
- **`DomPDF` escribe en `storage/` y en el directorio temporal del sistema** (`storage/fonts`, y
  `sys_get_temp_dir()`, según `vendor/barryvdh/laravel-dompdf/config/dompdf.php`). **No se
  comprobó en un servidor de producción** que el usuario del servidor web pueda escribir ahí: si
  el PDF funciona en pruebas y falla solo en producción, es lo primero que hay que mirar. Aquí
  `storage/fonts` ni siquiera existe y el PDF sale con DejaVu: por eso no se afirma que haga falta,
  solo que **no se midió**.

- **El `chroot` de DomPDF es la raíz del proyecto, y el logo tiene que vivir DENTRO de ella.** Con
  la configuración que viene en el paquete (no hay `config/dompdf.php` propio), `chroot` es
  `realpath(base_path())`: medido en esta máquina, un logo en `public/img/` y uno en `storage/app/`
  se incrustan en el PDF, y uno **fuera del proyecto** (el directorio temporal) **no**, y **sin
  ningún error**: el PDF sale sin imagen. Eso significa que mover el logo a `storage/` **no lo
  rompe**, y que lo que sí lo rompe es sacarlo del proyecto, o que alguien publique
  `config/dompdf.php` y estreche el `chroot` (por ejemplo a `public_path()`): entonces el logo sí
  tendría que vivir en `public/`. `enable_remote` está en `false`, así que una URL tampoco serviría.
  Quien toque el logo, la ruta o esa configuración tiene que volver a mirar la hoja.
- **El RFC del cliente sale en el papel viejo y no en el nuevo** (`invoice.php:137-138`). La
  especificación decidió los tres campos del cliente (nombre, teléfono, correo) y está en su derecho,
  pero es una omisión en un documento que el cliente usa para pedir su factura fiscal. Mejor
  declararla que descubrirla cuando el departamento la eche en falta.
- **La cotización mezcla dos lecturas de los renglones.** `subtotal()`, `iva()` y `total()`
  **releen** los renglones de la base, mientras `importesDe()` usa la colección ya cargada. Una
  edición concurrente a mitad de petición imprimiría renglones que no suman el subtotal impreso, y
  **un borrador no tiene sello que lo delate**. La ventana es diminuta y es una cotización, no un
  documento emitido, así que **no se arregla aquí**; pero es la cara opuesta de la carrera que el
  documento emitido sí tiene cubierta (ahí los importes se calculan sobre los objetos cargados y el
  sello se verifica). Además, esas llamadas son **muchas relecturas**: medido sobre sqlite, una
  cotización consulta los renglones **7 veces** (1 carga y 6 relecturas) y los pagos **3** (1 carga y
  2 relecturas).

**De los bloques anteriores, sigue abierta sin cambios** (los archivos del bloque no la tocan):

- **La conexión `remota` entra con credenciales de escritura** (`root` contra la base legada). La
  defensa estructural sería un usuario de MySQL de solo lectura. Importa más en el bloque 6.
- **No hay restricción única sobre `fact_prefacturas.operacion_llegada_id`**: dos operadores
  pueden crear dos borradores sobre la misma llegada a la vez.
- **Reabrir una cerrada no está protegido en el modelo**: las defensas son las de los endpoints.
- **Cobrar una prefactura cerrada** está decidido que no, pero el departamento todavía no lo ha
  probado, y las 289 cerradas sin pago del histórico sugieren que en algún sitio se cobra después.
- **El descuento** (bloque 5) y **la importación del histórico** (bloque 6) siguen sin existir.
  La importación del histórico sigue siendo parcial hasta el bloque 6.
- **Los puntos 1 a 6 de «Lo que sqlite no puede demostrar»** de las guías de los bloques 2 y 3
  (contador del folio, 409 del cierre, candado de estancia, collation de `concepto`, cobros
  simultáneos, cobrar mientras otra sesión cierra) siguen sin probarse contra MySQL real y deben
  probarse **antes** de que dos operadores usen el módulo a la vez.
- Los menores del 1b y del 2: ver sus guías.

## Resumen: lo que hay que hacer, en orden

**Desplegar esta rama es seguro por sí solo**: trae reverb y pusher declarados y no hay nada que
confirmar en producción antes.

1. **Subir `facturacion` al remoto** (hoy solo existe en local) y que sea la rama activa del
   servidor.
2. `git pull` y **`composer install --no-dev --optimize-autoloader`** (no basta el `git pull`).
3. `php artisan --version` y comprobar que las tres dependencias aparecen en `composer show`. Si
   `artisan` falla, **parar**.
4. Comprobar que `public/img/logo-facturacion.jpg` está en el servidor.
5. `php artisan optimize:clear` y `npm ci && npm run build`.
6. **Que alguien imprima una prefactura real y la compare con una del sistema viejo**, con la
   lista de arriba (incluidos el precio unitario sin `$` y la URL pegada en una pestaña nueva), y
   que pruebe los tres botones en el navegador (sobre todo **Cerrar e imprimir**).
7. Solo entonces, que el departamento decida si aprueba.

**Aparte y en paralelo, sin esperar a los pasos de arriba:** subir `reverb-declarado` y fusionarla
en `main`, porque la aplicación en producción sobre `main` está a un `composer install` de
romperse, con bloque 4 o sin él. Y decidir qué se hace con
`GET /api/ControlMedicamento/exportar-pdf`, que ahora funciona y no tiene puerta departamental.
