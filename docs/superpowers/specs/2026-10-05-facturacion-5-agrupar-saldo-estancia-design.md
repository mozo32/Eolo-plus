# Bloque 5 — Agrupar al imprimir, saldo a favor y ajuste de estancia

**Fecha:** 2026-10-05
**Rama:** `facturacion`
**Base del bloque:** la punta del bloque 4
**Bloques previos:** 1a (matrículas), 1b (catálogos), 2 (la prefactura y su cierre), 3 (pagos, notas, comisión Amex y cortesía), 4 (la impresión)

## Objetivo

Cerrar las tres funciones del sistema viejo que faltan antes de que el departamento de
facturación pruebe: **agrupar servicios al imprimir**, aplicar un **saldo a favor** del cliente,
y cobrar el **ajuste de estancia** entre dos tramos.

Las tres se midieron contra el histórico antes de diseñarlas, y la medición cambió lo que había
que construir en los tres casos. Esa evidencia es la parte más importante de este documento,
porque es la razón por la que el diseño **no** reproduce el sistema viejo.

---

## Lo que el sistema viejo hace, medido

Todas las cifras salen de `fact-fbo-prod` (el retrato de producción al 2026-09-28: 4.054 filas
de `tb_hprefactura`, 3.764 folios distintos). **Hay dos bases**: `conexion.php` lee `fact-fbo`,
que solo llega al 2026-08-21. La que se midió es la buena, pero sigue siendo un retrato.

### Agrupar: 5 usos en dos años, y uno perdió dinero

`agrupa.php` → `agrupar.php` pone los renglones elegidos en `importe = 0` con `agrupar = 1`, e
inserta **un renglón nuevo** de servicio 104 («Otros») con la suma, proveedor 5, cantidad 1.
`desagrupar.php` borra **todos** los renglones de servicio 104 del folio y restaura
`importe = precio_u * cantidad`.

| Folio | Qué pasó |
|---|---|
| 1177, 1178, 1824, 3100 | El «Otros» cuadra **exactamente** con lo escondido (250, 250, 3.734,65 y 8.788). Puramente cosmético |
| **932** | Dos renglones escondidos por **14.344,00** y **ningún «Otros» que los sustituya** |

El folio 932 se cerró con subtotal 17.755,00, que es lo que suman sus renglones vigentes. Debió
ser 32.099,00: **se dejaron de cobrar 14.344,00 más IVA, sin aviso y sin rastro.** De los 5 usos,
**ninguno** editó después el renglón agrupado, así que el caso de «cobro negociado» que la función
permitía **nunca ocurrió**.

Tres defectos más del mecanismo viejo:

- `desagrupar.php` borra **todos** los renglones de servicio 104, y en el histórico hay **54**
  escritos a mano, en 49 folios. Desagrupar una prefactura con un «Otros» legítimo lo destruye.
- Al restaurar usa `precio_u * cantidad`, que **pierde el margen y el ajuste de precio**: la
  fórmula real del importe es `ImporteServicio::calcular()`.
- `agrupa.php` **escribe al cargar la página**: recalcula `subtotal`, `iva`, `Total` y `ftotal`
  con un 16 % fijo, sin que nadie lo pida.

### Descuento y cortesía: dos archivos, y la «marca» vivía en un texto

El sistema viejo **no tiene columna ni tabla ni servicio** de cortesía o descuento. La marca vive
en el campo `remision`, lo que explica por qué no aparece en el esquema. Hay dos acciones vivas
desde `prefactura.php` (763 líneas, el editor real):

- **`cortecia.php`** — alterna: si el importe no es cero lo pone en cero y escribe `'cortesia'`
  en `remision`; si ya es cero, restaura `precio_u * cantidad` y limpia la remisión. **Pierde el
  margen al restaurar**, igual que desagrupar. El bloque 3 ya lo reimplementó limpio como el
  booleano `es_cortesia`, que conserva el precio y deriva el importe.
- **`aplicar_descuento.php`** — inserta un renglón con **precio negativo**, etiquetado `Cortesía`,
  y **fuerza el servicio a uno de los tres tramos de estancia** (remapea 1→2, 2→3, resto→4). El
  modal (`obtener_datos_modal.php`) ofrece las **tres tarifas de la matrícula** con casillas y el
  importe **fijo y de solo lectura**: no se puede escribir una cantidad.

En todo el histórico hay **10 renglones con precio negativo**, y el propio operador los separó en
dos grupos escribiéndolo en la remisión:

| Remisión | Folios | Qué son |
|---|---|---|
| `Cortesía` | 3090, 3393, 3507, 3508, 3640, 3646 | Los produjo el botón de descuento, todos en servicios 2/3/4 |
| `SaldoaFavor` / `SALDO A FAVOR` | 3109, 3118, 3160, 3746 | Escritos a mano en el servicio 91, por otra vía |

Y de los 6 de «Cortesía», al comprobar si cancelan un cargo igual del mismo servicio:

- **4 cancelan exactamente** (3393, 3508, 3640, 3646) → son **cortesías totales** sobre un cargo
  de estancia. El `es_cortesia` del bloque 3 ya los cubre.
- **1 no tiene ningún cargo que cancelar** (3090: −1.615,00 sin un Tránsito 02 que lo respalde,
  sobre una cuenta de 86.568,30).
- **1 cancela de más** (3507: −606,05 contra un cargo de 527,00 → 79,05 de exceso).

La causa de los dos últimos es un defecto del botón: ofrece **la tarifa vigente de la matrícula**,
no el **precio congelado del renglón**. Si la tarifa cambió, o si el cargo era un ajuste de
estancia (el 527,00 del folio 3507 es exactamente el precio del servicio 109), el negativo no
cancela nada.

### Ajuste de estancia: 2 usos en dos años, y no ajusta nada

`ajuste_estancia.php` → `insert_ajusteestancia.php` **crea una prefactura nueva** en la que el
operador elige a mano uno de cinco servicios, en lugar de que lo decidan las fechas:

| Servicio | Nombre en el catálogo | Precio que calcula |
|---|---|---|
| 2 | Tránsito 02 hrs | `transito` |
| 3 | Tránsito 12 hrs | `transito12` |
| 4 | Tránsito 24 hrs - pernocta | `pernocta` |
| 109 | **Ajuste de Estancia_de 2 hrs a 12 hrs** | `transito12 - transito` |
| 110 | **Ajuste de Estancia_de 12 hrs a pernocta** | `pernocta - transito12` |

Uso real: los servicios 2, 3 y 4 se usan en miles de folios; **el 109 y el 110, una vez cada
uno** (precios 527,00 y 2.022,00). Dos usos en dos años para una pantalla entera del menú.

Y tres defectos:

- **La fecha de salida que el usuario escribe se descarta**: el `INSERT` en `tb_llegadas` pone
  `Fecha_sal = $fllegada`, la de llegada. `Dias`, `Horas` y `minutos` quedan en 0.
- El `INSERT` del renglón está dentro de `if ($d_vuelos == 0)` y **`$d_vuelos` nunca se asigna**
  en ese ámbito: funciona solo porque `null == 0` es verdadero en PHP.
- Elegir el tramo a mano para una prefactura nueva es **lo que `CargosEstancia::recalcular()` ya
  hace mejor**: recibe cuántas pernoctas y cuántos tránsitos hay y los cotiza con la tarifa de la
  matrícula, en lugar de obligar a elegir uno solo.

---

## Las cuatro decisiones

| Decisión | Lo elegido | Por qué |
|---|---|---|
| **Agrupar** | **Solo al imprimir**, sin tocar el dinero | Cubre los 4 usos reales completados, y hace la pérdida del folio 932 estructuralmente imposible. El caso que justificaría la vía destructiva nunca ocurrió en dos años |
| **Saldo a favor** | **Forma de pago**, no renglón negativo | Un saldo a favor es **dinero**, no un precio menor: no debe bajar la base gravable. La vía vieja bajaba el IVA en los 4 casos |
| **Ajuste de estancia** | **Dos cantidades más en Recalcular estancia** | El precio sale de la diferencia entre tarifas, sin que nadie escriba un precio a mano, y es simétrico con lo que ya existe. Una pantalla aparte duplicaría `recalcular()` y arrastraría su defecto de la fecha |
| **Descuento de importe libre** | **No se hace** | La cortesía del bloque 3 cubre los 4 casos legítimos y el saldo a favor los otros 4. Los 2 restantes son precisamente lo que el botón viejo hacía mal; un sistema más estricto debe impedirlos, no reproducirlos |

---

## 1. Agrupar al imprimir

### El modelo

Una columna nueva en `fact_prefactura_renglones`:

```php
$table->string('grupo', 60)->nullable()->index();
```

Los renglones que comparten el **mismo `grupo` no nulo** se imprimen como **una sola línea**,
cuyo concepto es esa etiqueta y cuyo importe es la suma de sus importes. Agrupar es poner la
etiqueta en varios renglones; desagrupar es quitarla.

**Por qué una etiqueta y no un número de grupo.** La línea impresa necesita un nombre. El sistema
viejo usaba el servicio «Otros», que no le dice nada al cliente. Una etiqueta que el operador
escribe —«Servicios de rampa», «Maniobras»— describe el grupo, no necesita tabla ni catálogo
nuevos, y hace que desagrupar sea poner la columna a `null`.

### El invariante que lo hace seguro

**El dinero no cambia nunca.** `FactPrefactura::subtotal()` sigue sumando el `importe()` de
**cada** renglón, uno por uno. El grupo solo existe al imprimir. De ahí se sigue, sin escribir
ninguna guarda:

- El **sello**, el IVA, el total, los pagos, el cambio y el sobrepago quedan intactos.
- **La pérdida del folio 932 es imposible**: no hay nada que poner en cero ni nada que borrar.
- `discrepanciasDelSello()` sigue cuadrando, porque deriva de los mismos renglones.
- Desagrupar no puede perder el margen, porque no recalcula nada.

### El documento

El PDF colapsa los grupos: **una fila por grupo**, más las filas de los renglones sin agrupar,
ordenadas por el `orden` **menor** de los renglones que componen cada grupo, de modo que un grupo
ocupa el lugar de su primer renglón.

En la fila de un grupo:

- **CONCEPTO / SERVICIO:** la etiqueta del grupo.
- **REMISIÓN, PRECIO U. y CANT.:** sin valor, y **la plantilla los imprime como un guion «—»**, no como celdas vacías (enmendado tras la implementación; una prueba exige exactamente tres guiones en esa fila). No tienen un valor único, e inventar uno mentiría.
- **IMPORTE:** la suma de los importes de sus renglones, calculada con `bcadd` sobre los valores
  que el controlador ya pasa en la clave `importes`.

La suma se arma **en el controlador**, dentro de su `try/catch`, igual que `importes`: el contrato
de la vista del bloque 4 dice que la plantilla no llama a ningún método que calcule ni que pueda
lanzar, y eso se respeta. La clave `importes` pasa a acompañarse de una estructura de filas ya
resuelta; el detalle exacto lo fija el plan.

### Dos consecuencias que hay que decir

- **Una cortesía dentro de un grupo deja de verse.** Su importe es `0.00`, así que contribuye cero
  a la suma y el cliente no ve que ese servicio fue gratis. El total sigue correcto. Es una
  consecuencia legítima de agrupar, y la pantalla debe advertirlo al agrupar un renglón marcado
  como cortesía.
- **Queda congelado al cerrar.** Un documento emitido tiene que poder reimprimirse igual, así que
  el grupo de un renglón no se cambia en una prefactura cerrada. No hace falta guarda nueva: la
  del modelo `FactPrefacturaRenglon` ya rechaza cualquier escritura sobre una cerrada.

### Qué se rechaza

| Caso | Respuesta |
|---|---|
| Agrupar en una prefactura **cerrada** | La guarda del modelo lanza `RenglonDePrefacturaCerradaException`; el endpoint responde `409 ya_cerrada` |
| Agrupar en una **descartada** | `409 ya_descartada`, por el trait compartido |
| Etiqueta vacía o solo espacios | **`200`, y DESAGRUPA** (enmendado tras la implementación; el diseño original pedía `422`). Laravel convierte la cadena vacía en `null` (`ConvertEmptyStringsToNull`) antes de validar, y `null` ya es el contrato para desagrupar; abrir una excepción en el middleware global por un solo endpoint se descartó. La exigencia de etiqueta no vacía vive **en la pantalla**, que además comprueba contra la respuesta que el renglón quedó agrupado. Una prueba fija este contrato |
| Etiqueta de más de 60 caracteres | `422` |
| Un renglón que no es de esa prefactura | `404` |

Un grupo de un solo renglón **se permite**: imprime una línea con su etiqueta en lugar del nombre
del servicio, que es un uso legítimo (renombrar un concepto de cara al cliente) y prohibirlo
costaría más de lo que evita.

**La etiqueta ES la identidad del grupo**, con una consecuencia que conviene tener presente: dos
renglones con la misma etiqueta **son el mismo grupo**, aunque el operador los agrupara en dos
momentos y con dos intenciones distintas. No hay forma de tener dos grupos llamados igual. Es el
precio de no meter un identificador de grupo, y a cambio desagrupar es poner la columna a `null` y
la etiqueta impresa no necesita catálogo. La pantalla debe mostrar las etiquetas que ya existen en
la prefactura, para que reutilizar una sea deliberado y no un accidente.

---

## 2. Saldo a favor

### Lo que se construye

**Una forma de pago nueva** en el catálogo, con un concepto propio
(`FactFormaPago::CONCEPTO_SALDO_A_FAVOR`), sembrada por el seeder de formas de pago.

Y nada más. La tabla `fact_prefactura_pagos` del bloque 3 ya hace el resto: el pago se registra,
la cuenta conserva **su precio y su IVA completos**, y queda en bitácora con quién lo aplicó.

### Lo que sale bien sin escribir código

- **No genera cambio.** `FactPrefactura::cambio()` acota el sobrepago al **efectivo pagado**
  (`efectivoPagado()` filtra por `CONCEPTO_EFECTIVO`), así que pagar de más con saldo a favor cae
  en `cobradoDeMas` y no en `cambio`. Es lo correcto: no se devuelve efectivo por un saldo.
- **El sobrepago se sigue vigilando**, y el cierre sigue avisando si la prefactura queda cobrada
  de más.
- **No entra en la comisión Amex**, porque esa se calcula sobre el pago Amex y no sobre el total.

### La limitación, dicha y no escondida

**El sistema no lleva la cuenta del saldo de cada cliente.** El operador escribe el importe, igual
que con el efectivo. Avisar de que se intentó aplicar más saldo del que existe no es posible sin
un saldo que consultar, y construir ese registro es otro bloque: exigiría un libro de saldos por
cliente, con su origen (una nota de crédito, un cobro de más anterior) y su consumo.

Esto va en la guía de despliegue como limitación conocida, no como defecto.

---

## 3. Ajuste de estancia

### Lo que se construye

**Dos servicios nuevos** en el catálogo, con conceptos propios:

| Concepto | Nombre | Precio |
|---|---|---|
| `estancia_ajuste_2h_12h` | Ajuste de estancia: de 2 h a 12 h | `tarifaTransito12h − tarifaTransito2h` |
| `estancia_ajuste_12h_pernocta` | Ajuste de estancia: de 12 h a pernocta | `tarifaPernocta − tarifaTransito12h` |

Y **dos cantidades más** en `CargosEstancia::recalcular()`, que pasa de

```php
recalcular(FactPrefactura $prefactura, int $pernoctas, int $transitos2h, int $transitos12h)
```

a recibir además las cantidades de los dos ajustes. Los dos conceptos se añaden a
`FactServicio::CONCEPTOS_ESTANCIA`, con lo que heredan **sin tocar nada más**:

- `StoreRenglonRequest` los **rechaza a mano**, porque su precio sale de la tarifa y no del
  catálogo (el catálogo viejo los tiene en 0,00, que es relleno).
- `recalcular()` los **reemplaza** limpiamente, porque `quitarEstancia()` borra por esa lista.
- La **cortesía se conserva** al recalcular, igual que para los otros tres.

**Y una trampa que hay que tocar a la vez, o el bloque revienta.** `CargosEstancia::etiquetaDe()`
es un `match` **sin `default`** que cubre exactamente los tres conceptos de hoy, y el camino de
las cortesías perdidas lo llama **iterando `CONCEPTOS_ESTANCIA`**
(`CargosEstancia.php:183`). En cuanto los dos conceptos nuevos entren en esa lista, ese `match`
lanza `UnhandledMatchError` para ellos. Hay que extenderlo con sus dos etiquetas en el mismo
cambio. `conceptosEnCortesia()` llama al mismo método, así que se arregla con él.

La resta se hace con `bcsub` a **escala 4**, porque `precio_unitario` es `decimal(10,4)` y las
tarifas llegan como cadenas decimales. **Nada de `float`.**

### Las dos guardas nuevas

El sistema viejo no las tenía, y son la lección de los 10 renglones negativos:

1. **Si falta cualquiera de las dos tarifas** que la resta necesita, el ajuste no se cobra y el
   `motivo` dice **cuál** falta. Reaprovecha el camino de `$sinTarifa` que ya existe, que hoy
   nombra una tarifa; aquí nombra la que falta de las dos.
2. **Si la diferencia sale cero o negativa, se rechaza**: no se crea el renglón, y el `motivo` lo
   explica diciendo las dos tarifas. Cobrar un ajuste negativo es cobrar de menos sin que nada lo
   explique, que es exactamente lo que produjo los negativos del histórico.

En los dos casos **el resto del recálculo continúa**: una tarifa que falta no debe impedir que se
cobren las pernoctas.

### Lo que NO se construye

**No se replica la pantalla de `ajuste_estancia.php`**, que crea una prefactura eligiendo el tramo
a mano. `recalcular()` ya cubre eso y mejor, y esa pantalla arrastra el defecto de descartar la
fecha de salida.

---

## Fuera de alcance

- **Descuento de importe libre** y **negociar el precio de un renglón**: decidido que no hacen
  falta. Si el departamento los pide después de probar, es un bloque propio, porque permitir que
  el total baje sin un cargo que lo explique necesita su propio rastro y su propio permiso.
- **Llevar el saldo de cada cliente.**
- **El histórico y corregir una prefactura cerrada:** son el bloque 6.
- **Los renglones negativos del histórico**: cómo se importan los 10 es una decisión del bloque 6.
  Este bloque deja el camino: los 6 de «Cortesía» entran como `es_cortesia` sobre el cargo que
  cancelan, y los 4 de «Saldo a favor» como pagos con la forma nueva.

---

## Invariantes que el bloque mantiene

De los bloques anteriores, y ninguno se toca:

1. **No hay pago después del sello.**
2. **No hay folio sin documento.**
3. **Ningún renglón es mutable en una prefactura cerrada** — y de aquí sale gratis que el grupo de
   un renglón quede congelado al cerrar.
4. **El documento emitido muestra el sello, nunca la derivación.**
5. **Ninguna excepción de cálculo nace durante el render**, porque las nueve claves (y ahora las
   filas ya resueltas del grupo) las arma el controlador dentro de su `try/catch`.

Y uno nuevo:

6. **Agrupar no cambia el dinero.** Es el invariante central del bloque, y la razón por la que el
   diseño es seguro donde el viejo perdía 14.344 pesos.

---

## Verificación

Pest sobre sqlite, en serie (`--parallel` da 22 fallos falsos ajenos en esta máquina). Al empezar
el bloque son **1034** pruebas en verde.

Lo que hay que probar, y cada punto tiene que poder fallar:

**Agrupar**
- Agrupar dos renglones **no cambia** `subtotal()`, `iva()`, `total()` ni `cambio()`. Es el
  invariante 6 y la prueba que más importa del bloque.
- Desagrupar tampoco los cambia, y **no pierde el margen**: un renglón con margen conserva su
  importe exacto después de agrupar y desagrupar.
- El documento imprime **una** fila por grupo, con su etiqueta y la suma, y **no** imprime los
  nombres de los renglones agrupados.
- El grupo ocupa el lugar del `orden` menor de sus renglones.
- Una cortesía dentro de un grupo contribuye `0.00` a la suma.
- Agrupar en una cerrada responde 409; en una descartada, 409; con etiqueta vacía, **200 y desagrupa** (enmendado: ver «Qué se rechaza»).
- Un «Otros» capturado a mano **sobrevive** a desagrupar — la prueba que el defecto del sistema
  viejo exige.

**Saldo a favor**
- Un pago con saldo a favor **no cambia** el subtotal ni el IVA de la prefactura.
- Un sobrepago con saldo a favor cae en `cobradoDeMas` y **no** en `cambio`.
- La forma de pago nueva existe tras el seeder y tiene su concepto.

**Ajuste de estancia**
- Con tarifas 2 h = 1.000 y 12 h = 1.500, un ajuste de 2 h a 12 h cobra **500,00**.
- Si falta una de las dos tarifas, no se cobra y el `motivo` **nombra la que falta**.
- Si la diferencia es cero o negativa, no se crea renglón y el `motivo` dice las dos tarifas.
- Recalcular **reemplaza** los ajustes previos y **conserva** su cortesía.
- `StoreRenglonRequest` **rechaza** agregar los dos conceptos a mano.

Más `npx tsc --noEmit` (el único error aceptable es el preexistente de
`WalkAroundController.ts(905,5)`), eslint y `npm run build`.

**Lo que las pruebas no cubren:** el aspecto de la hoja con grupos. `pdftoppm` no está instalado,
así que nadie puede verla; la guía de despliegue tiene que pedir que alguien imprima una prefactura
con un grupo y la mire.

---

## Deuda que este bloque deja escrita

- **El saldo a favor no se valida contra ningún saldo**: limitación de diseño, arriba.
- **La etiqueta del grupo no tiene catálogo**: dos operadores pueden escribir «Rampa» y «rampa» y
  serán grupos distintos. Es deliberado (un catálogo de etiquetas es más máquina de la que el uso
  justifica), pero conviene decirlo.
- **Cómo se importan los 10 renglones negativos** queda para el bloque 6, con el camino ya
  decidido.
- **La medición es de un retrato** de `fact-fbo-prod` al 2026-09-28. La importación del bloque 6
  necesitará una copia fresca, y conviene repetir estas mediciones sobre ella.
