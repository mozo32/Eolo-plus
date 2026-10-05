# Bloque 4 — La impresión

**Fecha:** 2026-10-05
**Rama base:** `facturacion` (bloques 1a, 1b, 2 y 3 integrados, 980 pruebas en verde)
**Bloques previos:** `2026-09-28-facturacion-catalogos-design.md` (1a y 1b),
`2026-10-01-facturacion-2-prefactura-design.md` (2),
`2026-10-02-facturacion-3-pagos-y-notas-design.md` (3)

## Qué resuelve

Los tres bloques anteriores dejaron una prefactura que se arma, se calcula, se cobra y
se cierra con folio y sello. **Lo que no se puede todavía es imprimirla**, y eso es lo
único que impide al departamento de facturación dejar de usar el sistema viejo: el papel
es lo que el cliente firma y lo que la contabilidad archiva.

Este bloque trae **un documento y tres acciones**: imprimir la prefactura emitida,
cotizar sin emitir, y reimprimir.

## Cómo se parte lo que queda

| Bloque | Qué entra |
|---|---|
| 1a, 1b | Catálogos: matrículas, clientes, servicios, categorías, proveedores, formas de pago, tarifas |
| 2 | La prefactura: encabezado, renglones, estancia, paquete internacional, totales sellados, folio al cerrar |
| 3 | Pagos, notas, comisión Amex, cortesía, aviso al cerrar sin cobro |
| **4 (este)** | **La impresión: el PDF, la cotización y la reimpresión** |
| 5 | Agrupación de renglones, ajuste de estancia y el descuento (renglones negativos) |
| 6 | Importar el histórico y corregir una prefactura cerrada |

## El dato de origen

El sistema viejo tiene **doce** archivos de PDF. No hay doce documentos: hay copias.

**Alcanzables desde alguna pantalla viva:**

| Archivo | Desde | Qué hace además de imprimir |
|---|---|---|
| `invoice.php` | `prefactura.php` (el editor), `procesar.php`, `Servicios_p.php` | Inserta el encabezado histórico **y borra el borrador**: es el que cierra |
| `invoice21.php` | `p_cerradas.php` (lista de cerradas) | **Vuelve a insertar el encabezado histórico**, sin borrar nada |
| `invoice_p.php` | `p_impresas.php` (lista de impresas) | Nada: la única que no escribe |
| `invoicea2.php` | `agrupa.php` | Inserta y borra, como `invoice.php` |
| `invoiceagrupa.php` | `agrupa2.php` | Igual, con renglones agrupados |
| `invoicecot.php` | `procesar.php`, tras teclear un código | Nada: es `invoice.php` con las tres escrituras comentadas |

**Código muerto, que nadie enlaza:** `invoice2.php`, `invoice00.php`, `invoice1304.php`,
`invoicebak.php`, `invoicenew2.php` y `invoice_cerradas.php`.

## Hechos medidos que deciden el diseño

### 1. Cuatro de los seis vivos son la misma plantilla

Medido por diferencia de líneas contra `invoice.php`: `invoice21.php` difiere en **9**
líneas y `invoicea2.php` en **27**. No son documentos distintos; son el mismo con otra
fuente de datos o sin el borrado.

El único que difiere de verdad es `invoice_p.php`, con **609** líneas distintas — y no
porque sea otro documento: es **la plantilla vieja que nadie modernizó**. Usa la clase
base `PDF_Code128` mientras los demás usan `PDF_Eolo_Modern`, el rediseño con la cabecera
azul oscuro. Es rot, no un requisito.

**Consecuencia:** una plantilla, no cuatro. Una plantilla que cambia es una plantilla; cuatro
copias divergen, y este origen es la prueba.

### 2. Imprimir ESCRIBE, y es una de las causas de los 207 folios duplicados

`invoice.php` inserta en `tb_hprefactura` en su **línea 46**, y solo valida que haya cliente
y fecha de salida en las **líneas 66-80**, con un `break` que redirige. El borrado de
`tb_prefcatura` está en la **línea 293**, dentro de la rama `default`. Así que **cada intento
fallido de imprimir deja un encabezado histórico y no limpia nada**.

Y hay una segunda causa, probablemente la dominante: **`invoice21.php` lee de
`tb_hprefactura` y vuelve a insertar en ella** (líneas 30 y 47), sin ninguna guarda. Se
enlaza con un `<a href>` directo desde la lista de cerradas, así que **cada reimpresión
duplica el encabezado**.

Esa segunda causa explica algo que el bloque 2 dejó sin cerrar: que **424 de las filas
duplicadas tengan cliente**, cuando un intento fallido *por falta* de cliente no debería
tenerlo. Una reimpresión de un cierre exitoso sí lo tiene.

**Consecuencia, y es la decisión de más peso del bloque: el endpoint del PDF NUNCA escribe.**

*Pendiente de medir, cuando MySQL esté disponible:* cuál de las dos causas domina. Se
distingue comparando si las copias de cada folio son **idénticas** en dinero, cliente y
estatus (reimpresión) o **difieren** (intento fallido y luego éxito). El bloque 6 necesita
saberlo para decidir qué conserva de cada folio duplicado.

### 3. El código de barras no se imprime

Las variantes heredan de `PDF_Code128`, pero **la llamada a dibujarlo está comentada**
(`invoice_p.php:324`) y en `invoice.php` no existe. No hay nada que portar.

### 4. La cotización está protegida por un secreto en el cliente

`procesar.php` ofrece dos tarjetas: «Prefactura», que va a `invoice.php`, y «Cotización»,
que pide un código con un diálogo y solo entonces va a `invoicecot.php`. El código es
`const CODIGO_CORRECTO = '1234'` en el **JavaScript del cliente** (`procesar.php:166`).

La intención es clara —imprimir sin emitir es privilegiado— pero el mecanismo no protege
nada: está a la vista en el navegador y basta ver a un compañero teclearlo.

### 5. «Elaborado por» está escrito a mano

La plantilla imprime el literal `"Elaborado por: AJE"`, mientras `tb_prefcatura` y
`tb_hprefactura` guardan un `id_elaborador` que **ningún PDF lee**. El papel afirma siempre
la misma persona, sea quien sea quien lo hizo.

### 6. Los datos de la empresa están en la plantilla, no en configuración

`fact_configuracion` solo tiene `iva_tasa`, `combustible_ajuste`, `combustible_margen` y
`prefactura_folio_siguiente`. El RFC, el domicilio y el correo están escritos en el PDF
viejo, y **aquí se quedan igual** (ver Decisiones).

## Alcance

**Entra:**

- Una plantilla Blade del documento, renderizada a PDF en el servidor.
- **Imprimir** el documento oficial de una prefactura cerrada, con sus cifras **selladas**.
- **Cotizar**: la misma hoja de un borrador, con cifras derivadas, sin folio y marcada como
  no emitida.
- **Reimprimir**: no es una acción aparte; es volver a pedir el PDF de una cerrada.
- El rechazo de los cinco casos en que el documento no se debe emitir.
- La bitácora de cada impresión.

**No entra:**

- **Cerrar.** Ya es su propia acción desde el bloque 2 y no se toca. La pantalla puede
  ofrecer «Cerrar e imprimir» como un botón que llama a las dos.
- **La agrupación de renglones** (bloque 5). La plantilla imprime los renglones que haya;
  cuando el bloque 5 los agrupe, los imprimirá agrupados sin cambiar nada aquí.
- **El código de barras**, que no se imprime en el origen.
- **La plantilla vieja de `invoice_p.php`**, que es rot y no un requisito.
- **Corregir una cerrada** (bloque 6).

## Decisiones tomadas

Las tres primeras las decidió el usuario el 2026-10-05; las demás se derivan de los hechos
medidos.

1. **Un documento y tres acciones**, no cuatro plantillas.
2. **Cotizar lo puede hacer cualquiera que pueda facturar**, con el mismo
   `subdep:factPrefacturas` que gobierna el módulo. Es la acción menos grave de las tres
   —no emite nada ni consume folio— y el código del viejo no protegía nada real, así que
   esto no afloja ninguna puerta que estuviera cerrada. **Lo que sustituye al código es la
   bitácora**, que es la trazabilidad que hoy no existe.
3. **Con el sello roto, el PDF se niega a imprimir.** El bloque 2 detecta cuando los totales
   sellados de una cerrada ya no corresponden a lo que suman sus renglones; en el histórico
   hay **37 así, la peor por 29,000 pesos**. Un PDF es papel que sale de la oficina y que
   alguien usa para pagar o para contabilizar: imprimir un documento del que el propio
   sistema sabe que no cuadra es peor que no imprimirlo. La pantalla ya muestra el aviso
   rojo en esos casos, así que el operador no se queda sin saber por qué.
4. **El endpoint del PDF nunca escribe.** Ver el hecho medido 2. Es lo que convierte la
   reimpresión en una operación segura y lo que impide reproducir los encabezados
   duplicados.
5. **«Elaborado por» dice quién de verdad.** El documento emitido nombra a **quien lo cerró**
   (`cerrada_por`), porque cerrar es emitir. La cotización nombra a **quien la está
   imprimiendo**, porque no hay emisión que atribuir.
6. **La cotización se distingue a la vista.** «Un documento» no puede significar
   «indistinguible»: una hoja con precios, sin folio e idéntica a una emitida es peligrosa.
   El recuadro dice **COTIZACIÓN** en lugar de **PREFACTURA DE SERVICIOS**, y lleva la
   leyenda «Sin folio — no es un documento emitido». Es una variación de la misma plantilla,
   no una segunda.
7. **Los renglones de cortesía se imprimen con su precio unitario y el importe en `0.00`**,
   con la marca «Cortesía». El documento tiene que mostrar qué se dejó de cobrar.
8. **Los datos de la empresa van en la plantilla, no en `fact_configuracion`.** El RFC y el
   domicilio no son dato operativo que cambie: son la identidad de la empresa en un
   documento fiscal, y ponerlos en una tabla invita a que alguien edite el RFC desde una
   pantalla de catálogo. Si alguna vez cambian, es un despliegue.

## Arquitectura

### Cómo se genera

**DomPDF con una vista Blade**, en el servidor:
`Pdf::loadView('pdf.prefactura', [...])->setPaper('letter','portrait')`. La vista nueva va
en `resources/views/pdf/`, al lado de `control-medicamento-cierres.blade.php`.

**Hay que decir con honestidad que esta NO es la vía más usada del repositorio, y por qué se
elige de todos modos.** Eolo-plus tiene tres formas de hacer PDFs:

| Vía | Estado real |
|---|---|
| DomPDF + Blade, servidor | Existe en `ControlMedicamentoController::exportarPdf()` con su vista, pero **ninguna página la llama**: el ayudante generado está sin usar |
| `@react-pdf/renderer`, cliente | **Es la que de verdad se usa**: `PdfExporterControlMedicamento.tsx`, 697 líneas, pide los datos como JSON, arma el PDF en el navegador, muestra vista previa y descarga ese blob |
| `html2pdf.js` | En `package.json`, sin uso localizado |

Una versión anterior de esta especificación afirmaba que DomPDF era «el patrón
establecido». **Es al revés:** DomPDF es el camino muerto y react-pdf el vivo.

**Se elige DomPDF igual, y la razón que decide es la verificación.** El plan de pruebas de
este bloque es extraer el texto del PDF y afirmar sobre él —que trae el folio, el total
sellado, cada renglón, cada forma de pago y la nota externa—. **Eso solo es posible si el
PDF se genera en el servidor**, porque este proyecto **no tiene ninguna herramienta de prueba
de frontend**: ni vitest, ni jsdom, ni testing-library. Con react-pdf, la corrección del
documento fiscal que el cliente firma no la comprobaría nadie más que una lectura.

Las dos vías satisfacen la restricción de no calcular dinero en el cliente —en la de
react-pdf las cifras también llegan calculadas del servidor y el navegador solo las
maqueta— así que **ese no es el argumento**; el argumento es que una de las dos se puede
probar y la otra no.

**Lo que se pierde al elegir DomPDF**, y conviene tenerlo escrito: la **vista previa** antes
de descargar, que el exportador de control de medicamentos sí ofrece y que es cómoda. Se
mitiga abriendo el PDF en una pestaña, que es una vista previa de hecho. Si el departamento
echa en falta la previa con botón de descarga, añadirla es trabajo de pantalla, no de
arquitectura.

Y se descarta portar `fpdf`: es posicionamiento imperativo, ajeno al código, y un paso atrás
respecto a lo que ya hay.

**La fuente es `DejaVu Sans`**, la Unicode que la vista Blade existente ya usa; es lo que
hace que los acentos salgan.

**El logo** se copia del origen (`Prefectura/img/logo.jpg`) a `public/`, y la vista lo
referencia con `public_path()`: DomPDF no resuelve rutas web.

### Las tres acciones

| Verbo y ruta | Quién | Qué devuelve |
|---|---|---|
| `GET /api/facturacion/prefacturas/{id}/pdf` | `subdep:factPrefacturas` | El PDF de una **cerrada**, con las cifras **selladas** |
| `GET /api/facturacion/prefacturas/{id}/cotizacion` | `subdep:factPrefacturas` | El PDF de un **borrador**, con cifras derivadas, sin folio |

**Reimprimir no tiene ruta propia:** es volver a pedir `/pdf`. Esa es la consecuencia
directa de que el endpoint no escriba — en el sistema viejo hacía falta un archivo distinto
por cada reimpresión precisamente porque imprimir escribía.

Las dos van dentro del grupo `Route::middleware('subdep:factPrefacturas')` de
`routes/api.php`, con las demás de prefacturas.

### Qué lee cada una, y esto es lo que no puede confundirse

- **`/pdf`** lee `subtotal_sellado`, `iva_sellado`, `total_sellado` e `iva_tasa_sellada`.
  **Nunca la derivación.** El documento tiene que mostrar lo que el cliente vio cuando se
  emitió, que es justamente lo que el sello existe para conservar.
- **`/cotizacion`** lee `subtotal()`, `iva()` y `total()` derivados, porque un borrador no
  tiene sello y sus renglones todavía se mueven.

### El documento

Una sola plantilla, con las secciones del original:

- **Cabecera:** el logo, y a la derecha el RFC `EPL060619669`, el domicilio
  `Carr Toluca-Atlacomulco KM 5.3`, `Toluca, Edo. de México` y
  `facturacion@eolo.com.mx`.
- **El recuadro del título**, con el folio a la derecha: `PREFACTURA DE SERVICIOS` en el
  documento emitido, `COTIZACIÓN` en la cotización.
- **DATOS DE OPERACIÓN:** matrícula, aeronave, fecha, llegada y salida, origen y destino.
- **DETALLES DEL CLIENTE:** cliente, teléfono y correo.
- **La tabla de renglones:** concepto o servicio, remisión, precio unitario, cantidad e
  importe. Los de cortesía con su precio y el importe en `0.00`, marcados.
- **Los totales:** subtotal, IVA con su tasa, total.
- **FORMA DE PAGO:** cada pago con su forma y su monto. Y el **cambio** cuando lo haya.
- **OBSERVACIONES:** la nota externa, que es la única de las tres que se imprime — lo
  confirman los cuatro PDF vivos, que leen solo `nota_ext`.
- **FIRMA CLIENTE** y **Elaborado por**, con el nombre real.
- **Al pie**, literal: «Estimado cliente, usted cuenta con un máximo de 72 horas naturales
  posteriores a la fecha de emisión de esta prefactura para solicitar su factura fiscal.
  Tarifa de refacturación: MXN $250.00 + IVA. Contacto: facturacion@eolo.com.mx», y el aviso
  de privacidad `https://www.eolo.com.mx/#/privacidad`.

### Qué rechaza, y con qué código

| Caso | Respuesta |
|---|---|
| El sello de la cerrada discrepa de sus renglones | **409** `sello_inconsistente`, con las dos cifras en el mensaje |
| Un borrador por la ruta `/pdf` | **422** `sin_folio`: sin folio no hay documento; se cotiza |
| Una cerrada por la ruta `/cotizacion` | **422** `ya_cerrada`: ya está emitida; se imprime |
| Un borrador descartado, por cualquiera de las dos | **409** `ya_descartada` |
| La tasa de IVA o el ajuste de un renglón son ilegibles | **422** `totales_no_calculables` |

Los códigos `sello_inconsistente`, `ya_cerrada`, `ya_descartada` y `totales_no_calculables`
**ya existen** en el módulo con ese significado; el único nuevo es `sin_folio`. Cada uno
lleva su mensaje en español, y la pantalla los muestra tal cual.

### Bitácora

Cada impresión y cada cotización se registra, **dentro de la transacción**, con el módulo
`FACTURACION_PREFACTURAS`, la acción `ACCION_EXPORTAR` —que ya existe en `Bitacora`— y el id
de la prefactura. La cotización registra además que no se emitió nada.

Esa es la trazabilidad que sustituye al código `'1234'`: en el sistema viejo, quién imprimió
una cotización y cuándo **no queda en ninguna parte**.

### Pantalla

**No hay pantalla nueva.** `EditorPrefactura.tsx` gana dos botones:

- **Imprimir**, visible cuando la prefactura está cerrada. Abre el PDF.
- **Cotizar**, visible cuando es un borrador, con una confirmación que explica que el papel
  lleva precios y no es un documento emitido.
- Y **«Cerrar e imprimir»** como conveniencia: llama al cierre que ya existe y, si cuadra,
  abre el PDF. Así el operador conserva el gesto de un clic que tenía en el sistema viejo.

Con el sello roto, el botón de imprimir queda **deshabilitado** con el motivo escrito, igual
que el bloque 3 hizo con «Cerrar» cuando los totales no se pueden calcular: es mejor que el
operador no pueda pulsarlo que recibir un 409 después.

## Verificación

**Las pruebas comprueban el contenido, no los píxeles.** Un PDF no se compara byte a byte
—cambia con la versión de la librería y con la fecha— así que se extrae su texto y se afirma
sobre él:

- Que el documento de una cerrada contiene el folio, el **total sellado**, el nombre de cada
  renglón, cada forma de pago con su monto, y la nota externa.
- Que una cerrada cuyo sello se tocó **no** se imprime, y que el 409 trae las dos cifras.
- Que la cotización **no** contiene folio, **sí** contiene la leyenda de no emitida, y usa
  las cifras **derivadas**.
- Que un renglón de cortesía sale con su precio y con `0.00`.
- Que los cinco rechazos responden lo que deben.
- **Que el endpoint no escribe nada**, con el mismo patrón de `DB::listen` con que el bloque
  3 fijó que su comando de comparación solo lee.
- Que «Elaborado por» trae el nombre de quien cerró, y la cotización el de quien imprime.

**Esto es posible porque el PDF se genera en el servidor.** Es la razón por la que se eligió
DomPDF sobre la vía de react-pdf, que es la que el repositorio usa de verdad: sin
herramientas de prueba de frontend, un PDF armado en el navegador no lo verificaría nada.

**Lo que las pruebas no cubren:** el aspecto. No hay forma automática de saber si la hoja se
ve bien, así que la guía de despliegue tiene que pedir que alguien **imprima una de verdad y
la compare con una del sistema viejo** antes de dar el bloque por bueno.

## Restricciones globales

Heredadas de los bloques anteriores y vigentes:

- **Ningún cálculo de dinero en el PDF.** La plantilla **formatea**, no calcula: todas las
  cifras llegan ya calculadas por el modelo. Las fórmulas siguen viviendo en
  `ImporteServicio::calcular()`, `FactPrefactura::calcularIva()`,
  `ComisionAmex::calcular()` y `PagosPrefactura::comisionQueCuadra()`.
- **Ningún `float` en el camino del dinero.**
- **El endpoint del PDF no escribe** en ninguna rama, salvo la bitácora.
- **Toda escritura queda en `Bitacora`, dentro de la transacción.**
- **Todo lo visible va en español**, el documento incluido.
- La suite se corre **en serie** con `php artisan test`; `--parallel` da 22 fallos falsos
  ajenos en esta máquina. Al empezar este bloque son **980**.
- El único error aceptable de `npx tsc --noEmit` es el preexistente
  `resources/js/actions/App/Http/Controllers/Api/WalkAroundController.ts(905,5)`.

## Lo que este bloque deja abierto

- **Cuál de las dos causas de los 207 folios duplicados domina.** Se mide comparando si las
  copias de cada folio son idénticas o difieren; hace falta MySQL arriba. **El bloque 6 lo
  necesita** para decidir qué conserva de cada folio.
- **El aspecto de la hoja.** Las pruebas garantizan el contenido; que se vea bien lo tiene
  que confirmar una persona con una impresión en la mano.
- **La agrupación** (bloque 5) va a cambiar qué renglones existen, no cómo se imprimen.
- **Los renglones negativos** del descuento (bloque 5) todavía no están definidos para el
  redondeo del IVA, y cuando lo estén la plantilla tendrá que mostrarlos con su signo.
- **`invoice_p.php`**, la plantilla vieja de la lista de impresas, se deja fuera por ser rot.
  Si alguien del departamento la echa de menos, es una decisión, no un defecto.
- **La vista previa antes de descargar.** El exportador de control de medicamentos la tiene,
  porque genera en el cliente. Aquí el PDF se abre en una pestaña, que sirve de previa. Si
  hace falta la previa con botón, es trabajo de pantalla.
- **Las dos vías de PDF del repositorio quedan sin unificar.** Este bloque usa DomPDF y el
  control de medicamentos usa react-pdf. Unificarlas no sirve a este objetivo y no entra
  aquí, pero alguien debería decidirlo antes de que haya una tercera.
