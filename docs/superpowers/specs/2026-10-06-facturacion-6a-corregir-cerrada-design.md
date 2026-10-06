# Bloque 6a — Corregir una prefactura ya cerrada

**Fecha:** 2026-10-06
**Estado:** especificación aprobada, pendiente de plan de implementación
**Depende de:** bloques 1a, 1b, 2, 3, 4 y 5 (todos en la rama `facturacion`)
**No depende de:** la importación del histórico (bloque 6b), que sigue bloqueada por las decisiones 1 a 4 del documento de decisiones pendientes

## 1. El problema

Hoy una prefactura cerrada es absolutamente inmutable. Cinco candados, todos en el
modelo o el servicio y no en el controlador:

| # | Dónde | Qué impide |
|---|---|---|
| 1 | `FactPrefacturaRenglon::booted()` (`saving`, `deleting`) | crear, mover, editar o borrar un renglón |
| 2 | `PagosPrefactura::bloquearBorrador()` | registrar o quitar un pago |
| 3 | `RechazaPrefacturaCerrada::rechazarSiCerrada()` | editar las notas y la cabecera |
| 4 | `PrefacturaController::descartar()` (`where estado = borrador`) | descartar un documento emitido (409 `ya_cerrada`) |

> **Corregido 2026-10-06, medido en la Task 5.** Esta especificación daba `descartar()` por bueno tal cual («DEJAR: así una reabierta no se descarta, que es el invariante»). El invariante sí se cumplía, pero **el mensaje mentía**: una reabierta no es `cerrada`, así que caía en la rama del `else` y el sistema respondía «Este borrador ya estaba descartado» —sobre un documento emitido, con folio consumido y que nadie había descartado—. Lleva rama propia, con `codigo: reabierta`. La lección: que un filtro preserve un invariante no significa que el código que lo rodea diga la verdad.
| 5 | `CierrePrefactura::cerrar()` | volver a cerrar (`PrefacturaYaCerradaException`) |

Y el sello se verifica en **cada lectura** (`discrepanciasDelSello()`), así que ni una
edición directa en la base pasaría inadvertida.

El sistema viejo hacía lo contrario: la pantalla «Reimprimir Prefacturas»
(`p_impresas.php`) ofrecía tres editores —`altaserv_imp.php`, `actualizar_imp.php` y
`eliminar_imp.php`— que editan una prefactura **ya impresa** y **ninguno de los tres
actualiza el total del encabezado**. `altaserv_imp.php` además busca el folio en
`tb_prefcatura`, la tabla de borradores abiertos, partiendo de la matrícula: edita
otra prefactura que la que se pidió.

**Lo medido** (origen `fact-fbo-prod`, comparación exacta: `tb_hprefactura.subtotal` y
`tb_venta.importe` son los dos `decimal(18,2)`, sin tolerancia):

- 3,764 folios con encabezado. 2,934 cuadran. **830 no (el 22%)**: 406 porque los
  renglones suman más, 424 porque suman menos, 14 sin renglones.
- **822 de los 830 no los explica nada estructural**: cero por agrupados, 11 con algún
  renglón en cero, 3 con negativos, 14 sin renglones. Calcular el encabezado con
  `precio_u * cantidad` en vez de `importe` explica 8 más, y nada más.
- Borrar renglones era común: 10,310 filas vivas en un rango de ids de 18,662
  posiciones, unas **8,352 desaparecidas**. Y 42 folios tienen renglones sin encabezado.
- **La atribución no se pudo probar**, y se intentó. Un sustituto temporal —un renglón
  registrado después de crearse diez folios posteriores— da 654 de los 830, pero su
  **columna de control** delata que no vale: 2,371 folios que **cuadran** tienen
  igualmente renglones «tardíos», 3,025 de 3,764 en total. Los folios no se crean en
  secuencia temporal apretada. Y no hay ninguna marca del momento del cierre:
  `tb_hprefactura.fecha_pref` se copia de `tb_prefcatura`, donde se puso con `NOW()` al
  **crear**. Borrar un renglón de un borrador deja la misma huella que borrarlo de una
  impresa.

Así que lo que queda establecido no es la frecuencia, es la asimetría: **el sistema
viejo lo permitía y tenía tres pantallas para hacerlo; el nuevo tiene cero.** El
departamento confirmó que lo que se corrige puede ser cualquiera de las cuatro cosas:
falta o sobra un servicio, el importe de un renglón, el cobro, o los datos de la
cabecera.

## 2. La forma

Reabrir con historia. La prefactura cerrada vuelve a ser editable, **conserva su
folio**, y al volver a cerrarla se vuelve a sellar. La versión que ya se imprimió se
guarda completa antes de abrir nada.

Las cinco decisiones del departamento, para que no haya que reconstruirlas:

1. **La corrección puede tocar cualquier cosa** (las cuatro clases de error), así que no
   se construye un parche por campo: se reusa el editor de borrador que ya existe.
2. **Reabrir, no cancelar ni emitir un documento de ajuste.** Se descartó cancelar y
   reemitir porque gasta un folio por cada corrección —incluso por un destino mal
   teclado— y deja al cliente con dos papeles; y el documento de ajuste porque la
   prefactura no es un documento fiscal y para una matrícula mal puesta no significa nada.
3. **Permiso aparte**, no el de capturar.
4. **Se guarda el documento completo**, no solo los totales: hay que poder reimprimir
   exactamente el papel que el cliente tiene en la mano.
5. **El papel lo dice**, con la fecha de la versión anterior.

## 3. El estado nuevo

`FactPrefactura::ESTADO_REABIERTA = 'reabierta'`. Nueve caracteres en una columna
`string(10)`: entra, sin migración de tipo.

Podría bastar con `estado = 'borrador'` y `folio IS NOT NULL` como discriminador, y se
rechaza: `descartar()` filtra por `estado = borrador`, así que aceptaría una prefactura
cuyo folio ya se consumió. Se perdería el folio y el documento emitido desaparecería de
la lista. **Con un estado propio ese agujero no existe y `descartar()` no se toca.**

Lo que el estado nuevo compra gratis: los cinco candados preguntan por `estaCerrada()`,
que sigue siendo `estado === 'cerrada'`. Ante una reabierta se abren solos y **el editor
completo de los bloques 2, 3 y 5 funciona tal cual**: renglones, importes, cortesía,
agrupar, estancia, pagos, notas y cabecera. Cero pantallas nuevas de edición.

### Los once sitios que suponen algo sobre el estado

Enumerados, no estimados. Dos rompen en silencio y hay que cambiarlos; uno es correcto
precisamente porque excluye el estado nuevo.

| Sitio | Hoy | Qué hacer |
|---|---|---|
| `CierrePrefactura.php:130` | el `update` que cierra filtra `estado = borrador` | **CAMBIAR**: aceptar `borrador` y `reabierta`. Sin esto, volver a cerrar afecta **cero filas** y no emite nada |
| `PrefacturaController.php:71` | el filtro del índice solo admite `borrador` y `cerrada` | **CAMBIAR**: admitir `reabierta`, o las reabiertas no se pueden listar |
| `PrefacturaController.php:369` (`descartar`) | filtra `estado = borrador` | **DEJAR**: así una reabierta no se descarta, que es el invariante |
| `PrefacturaController.php:158` (`store`) | crea en `borrador` | dejar |
| `FactPrefactura.php:87` (`estaCerrada`) | `estado === cerrada` | dejar: es lo que abre los candados |
| `FactPrefacturaRenglon.php:60` | lanza si `=== cerrada` | dejar |
| `CierrePrefactura.php:133` | pone `cerrada` | dejar |
| `FactPrefactura.php:77` y `:82` (`scopeBorradores`, `scopeCerradas`) | — | **código muerto: nadie los llama.** No se «arreglan» ni se amplían; si alguien los usa después, que decida entonces |
| `2026_09_29_092100_create_fact_prefacturas_table.php:26` | `default('borrador')` | dejar |
| `PrefacturaController.php:358` | un docblock que escribe la consulta de `descartar` como `estado = 'borrador'` | **CAMBIAR el texto**: seguirá siendo verdad, pero hay que decir que excluye a las reabiertas a propósito, o el próximo lector lo lee como un olvido |

## 4. Las tres trampas

Las tres producirían exactamente el defecto del sistema viejo, y las tres son silenciosas.

**Trampa 1 — el folio.** `cerrar()` llama siempre a `siguienteFolio()`. Volver a cerrar
una reabierta consumiría un **segundo folio** y le cambiaría el número al documento que
el cliente ya tiene. **`cerrar()` pide folio nuevo solo si la prefactura no tiene; con
folio, lo conserva y no toca el contador.** Es el punto más delicado del bloque.

**Trampa 2 — la cotización.** `cotizacion()` rechaza las cerradas y las descartadas. Una
reabierta no está cerrada, así que saldría impresa **como cotización**: un presupuesto,
sin folio, para un trabajo ya facturado y con folio gastado. **Una reabierta no se
imprime de ninguna forma**: ni documento (no tiene sello) ni cotización. Se rechaza con
un código propio y un mensaje que diga qué hacer: volver a cerrarla.

**Trampa 3 — el `update` de cierre.** Ya está en la tabla de arriba, y se repite aquí
porque su síntoma es el peor: `update` que afecta cero filas, transacción que se
revierte, y nada que lo explique salvo que el documento no aparece.

## 5. La tabla de versiones

`fact_prefactura_versiones` guarda solo versiones **sustituidas**. La vigente vive en la
prefactura. Por eso **la versión 1 es el primer documento que se imprimió, y la fila nace
en el momento de la primera reapertura**, no al cerrar: mientras nadie corrija nada, la
tabla está vacía y no sobra ni una fila.

- `prefactura_id`, `version` (1, 2, 3…), único por pareja
- `folio` (desnormalizado a propósito: una versión sin folio legible no sirve de nada)
- el sello de esa versión: `subtotal_sellado`, `iva_sellado`, `total_sellado`,
  `iva_tasa_sellada`
- `cerrada_at`, `cerrada_por` de esa versión
- `reabierta_at`, `reabierta_por`, `motivo` (obligatorio)
- `documento` JSON: el documento entero

**Qué contiene `documento`.** Exactamente lo que la plantilla necesita, y por eso se
enumera aquí en vez de dejarlo al plan: es el contrato del que depende §6.

Sale de leer la plantilla, campo por campo, no de suponer:

- de la prefactura: `folio`, `cerrada_at`, `llegada_at`, `salida_at`, `origen`, `destino`,
  `nota_externa`
- del cliente: `nombre`, `telefono` y `correo` (la plantilla imprime los tres)
- de la aeronave: `matricula`, el nombre del tipo (`aeronave.tipoAeronave.nombre`) y el de
  la categoría (`satelite.categoria.nombre`); todos pueden faltar y la plantilla ya lo
  tolera: ausentes salen «—», y la categoría ausente simplemente no se imprime
- `tipo_destino` **no** va, y por una sola razón: **la plantilla no lo lee**. (Corrección
  2026-10-06, medida en la revisión final: una versión anterior de esta línea añadía que «la
  tasa que de él se derivó viaja en `ivaEtiqueta`». **Es falso**: ninguna tasa se deriva de
  `tipo_destino`. `ivaTasa()` es el único origen y lee `fact_configuracion.iva_tasa`, y los
  usos de `tipo_destino` en `app/` no tocan el dinero. Importa porque esta lista es el
  contrato que el bloque 6b va a leer.)
- las nueve claves calculadas del contrato del bloque 4, ya resueltas: `subtotal`, `iva`,
  `ivaEtiqueta`, `total`, `cambio`, `filas` y `elaboradoPor` (`esCotizacion` es siempre
  falso en una versión, y `prefactura` es el modelo que se hidrata)
- los pagos: forma de pago y monto de cada uno, en el orden impreso

**En JSON y no en tablas hijas** porque es dato muerto: nunca se consulta
relacionalmente, solo se lee entero para reimprimir. Tablas hijas duplicarían el esquema
e invitarían a que alguien hiciera un `join` contra ellas.

**Y guarda el contrato de la vista, no las filas del modelo.** Por la misma razón que
existe el sello: si mañana cambia `importe()`, reconstruir el documento desde las filas
cambiaría lo que dice un papel que ya salió. Un documento emitido es un hecho histórico;
no se mueve cuando se mueve el código.

**Al reabrir se limpian** `subtotal_sellado`, `iva_sellado`, `total_sellado`,
`iva_tasa_sellada`, `cerrada_at` y `cerrada_por` de la prefactura. Todo eso queda en la
versión. La fila de la prefactura describe solo su estado actual, y así no queda un
sello sin dueño esperando que alguien lo lea como vigente.

## 6. Reimprimir una versión sustituida

La vista del bloque 4 recibe nueve claves calculadas **y además lee `$prefactura`
directamente**: el folio, `cerrada_at`, el cliente, la aeronave con su tipo y categoría
(`satelite.categoria`), las notas y los pagos. Pasarle el modelo vivo para reimprimir
una versión daría el documento viejo con la cabecera nueva: lo peor de los dos.

**Se hidrata una `FactPrefactura` NO persistida** desde el JSON, con sus relaciones
puestas a mano (`setRelation`), y se le pasa a la misma vista. Nunca se guarda.

Se eligió esto y no refactorizar la plantilla para que reciba sus veinte valores como
claves planas, porque esa refactorización pondría en riesgo el invariante que el bloque 4
pagó caro —la vista no llama a ningún método que calcule dinero o pueda lanzar, porque se
renderiza **después** del `try/catch` y una excepción ahí sería un 500 en vez de un
422— sin comprar nada.

El costo de la decisión, dicho: **la forma del JSON queda acoplada a lo que la plantilla
lee.** Si alguien añade a la plantilla un campo que el JSON no trae, las versiones viejas
se imprimirían incompletas. La prueba maestra de §9 es lo que lo impide, y es la razón de
que exista.

## 7. El papel

El contrato pasa de nueve claves a **once**, porque son dos marcas distintas y no una:
confundirlas imprimiría «Corregida» en el papel viejo, que es justo el que no hay que dar
por bueno. Las dos son valores planos calculados en el controlador **dentro** del
`try/catch`, igual que las otras nueve y por la misma razón.

| Clave | En el documento vigente | En una versión reimpresa |
|---|---|---|
| `sustituye` | `null` si nunca se corrigió; si sí, `['fecha' => ?string]` con la fecha de la versión anterior | `null` |
| `versionSustituida` | `null` | el número de versión y la fecha en que se reemplazó |

**Por qué `sustituye` es un arreglo y no una cadena** (decidido al construirlo, 2026-10-06;
esta sección decía `?string` y se corrige aquí). Con `?string` harían falta **tres** estados en
dos valores: `null` = no sustituye a nada, `''` = sustituye pero sin fecha conocida, y una
fecha. El día que alguien escribiera `@if($sustituye)` —lo natural en Blade— **el caso sin
fecha perdería la marca en silencio**. Con un arreglo, un `@if` honesto funciona en los dos
casos, y queda simétrico con `versionSustituida`.

**Y el caso sin fecha no es hipotético, que es la otra mitad de la decisión:** si hay versión
sustituida **la marca sale siempre**, con fecha cuando se sabe y sin ella cuando no —«Corregida
— sustituye a la versión anterior.»—, y **no se inventa ninguna fecha**. Lo va a producir la
importación del histórico: el sistema viejo **no tiene marca del momento del cierre**, porque
su `fecha_pref` se copia de la tabla de borradores, donde se puso con `NOW()` al **crear**. Una
cerrada importada sin fecha de cierre, reabierta, daría un documento corregido
**indistinguible de un original** si la marca se callara.

- Documento corregido: «Corregida — sustituye a la versión del 3 de octubre de 2026».
- Versión sustituida reimpresa: «Versión 1 — reemplazada el 6 de octubre de 2026. No
  vigente.», de forma inequívoca, para que nadie la entregue como actual.

Endpoint nuevo: `GET /facturacion/prefacturas/{id}/versiones/{version}/pdf`.

## 8. El permiso

Subdepartamento nuevo `factReabrirPrefactura`, décimo de la lista, mismo patrón que los
nueve que ya existen (una fila en `FacturacionSubdepartamentosSeeder`, una cadena
`subdep:` en la ruta). Capturar y cerrar siguen con `factPrefacturas`.

Solo la reapertura lo exige. Una vez reabierta, editarla usa los permisos normales: el
freno está en abrir el documento, no en trabajar sobre un borrador.

## 9. Invariantes y qué se prueba

**La prueba maestra.** El bloque 4 no lee el texto dentro del PDF —va comprimido y en
glifos— sino que **captura lo que recibe la vista** con un `View::composer`
(`capturarLoQueRecibeLaVista`, `ImpresionPrefacturaTest.php:251`). Entonces:

> Imprimir el documento y capturar lo que recibe la vista. Reabrir. Corregir algo de cada
> clase: un renglón, un importe, un pago y la cabecera. Reimprimir **la versión 1** y
> capturar otra vez. **Las dos capturas tienen que ser idénticas**, salvo la marca de
> versión sustituida.

Esa prueba es lo que hace que el acoplamiento de §6 sea seguro: falla el día en que la
plantilla lea algo que el JSON no guarda.

Lo demás que hay que probar, cada punto por lo que rompería:

- **El folio no cambia** al reabrir y volver a cerrar, **y el contador no avanza**
  (trampa 1). Se mide el contador antes y después.
- **Volver a cerrar una reabierta funciona** (trampa 3): el `update` la alcanza.
- **Una reabierta no se imprime**, ni como documento ni como cotización (trampa 2).
- **Una reabierta no se descarta.**
- **Sin motivo no se reabre.**
- **Sin el permiso no se reabre**, aunque se tenga `factPrefacturas`.
- **Una cerrada con el sello roto no se reabre**: reabrir snapshotearía un documento que
  ya no se puede verificar. Primero se explica la discrepancia.
- **Reaperturas sucesivas**: tres versiones, numeradas 1, 2, 3, y las tres reimprimibles.
- **Concurrencia**: dos sesiones reabriendo a la vez crean **una** versión, no dos con el
  mismo número. Candado `lockForUpdate()` y único `(prefactura_id, version)`.
- **El total corregido a la baja** con el cliente ya pagado deja `sobrepago()` como ya lo
  hace hoy; no se construye nada nuevo para eso.
- **La bitácora** registra la reapertura con el motivo, el sello anterior en
  `datosAnteriores` y quién la hizo. Acción: `ACCION_ACTUALIZAR` sobre
  `MODULO_FACTURACION_PREFACTURAS` (no hay `ACCION_REABRIR` y no se añade una constante
  por un solo uso).

**Riesgo asumido, por escrito:** una reabierta a la que se le borren todos los renglones
no se puede volver a cerrar y queda con el folio gastado. Se arregla añadiendo un
renglón, pero **la lista tiene que mostrar las reabiertas de forma visible**, porque un
folio consumido y no reemitido es un hueco en la secuencia. Va en el índice como estado
propio y con distintivo en la pantalla.

## 10. Lo que NO entra

- **La importación del histórico** (bloque 6b): otro subsistema, otra especificación,
  bloqueado por otras decisiones.
- **Limpiar los nombres que el viejo reescribía al imprimir** (`invoice21.php:187-189`
  convertía los dos `Ajuste de Estancia_*` en «Ajuste de Estancia», los servicios 91 y 103
  en «Otros servicios» y los dos `Comisariato_*` en «Comisariato»). Es la decisión 6 y
  sigue abierta.
- **Un límite de antigüedad o de número de reaperturas.** Un error de hace seis meses
  sigue siendo un error.
- **Cancelar una prefactura** sin reemitirla. No se pidió y no existe hoy.

## 11. Decisiones registradas

- La decisión 5 del documento de decisiones pendientes —si hay que sellar el cambio— **se
  disuelve**: volver a cerrar vuelve a sellar necesariamente.
- `scopeBorradores` y `scopeCerradas` son código muerto y se dejan como están.
- No se añade `ACCION_REABRIR` a `Bitacora`.
