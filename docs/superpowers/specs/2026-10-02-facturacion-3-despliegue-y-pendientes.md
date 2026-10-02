# Bloque 3 — Guía de despliegue y pendientes abiertos

**Fecha:** 2026-10-02 · **Rama:** `facturacion` (base del bloque: `0c8cd24`)

Acompaña a `2026-10-02-facturacion-3-pagos-y-notas-design.md` y continúa la guía del
bloque anterior, `2026-10-01-facturacion-2-despliegue-y-pendientes.md`, a la que remite
en varios puntos en lugar de repetirla. Recoge lo que hay que hacer **antes** de poner el
bloque en producción, lo que la suite no puede demostrar, y el resultado real de la
comprobación contra el histórico.

Cada afirmación de esta guía está respaldada por el código de la rama o por una medición
que se nombra. Donde algo **no** se midió, se dice.

## Lo que hizo esta rama

Trae a Eolo-plus el cobro de la prefactura: la tabla de pagos con las reglas de cada
forma de pago, la comisión Amex (con su ajuste de centavos), la cortesía, las tres notas,
el aviso al cerrar sin cobro completo, la pantalla de cobro y el comando
`facturacion:comparar-pagos`, que contrasta todo eso contra el histórico del sistema viejo
sin escribir nada.

Cuatro decisiones de diseño que explican el resto de la guía:

- **El cambio no se guarda: se deriva.** `sobrepago = max(0, pagado − total)`, y se parte
  en `cambio` (lo que se devuelve, hasta el efectivo que entró) y `cobrado de más` (un pago
  que hay que corregir). El `Cambio` del sistema viejo está mal en las dos direcciones
  (ver «El resultado real del comando de comparación»).
- **Las reglas de cobro se identifican por el `concepto` de la forma de pago**, no por su
  nombre, que se edita en pantalla (`fact_formas_pago.concepto`: `efectivo`, `amex`,
  `avcard`). Es el mismo patrón que `fact_servicios.concepto` del bloque 2.
- **Amex tiene su propia acción**, que agrega la comisión como renglón y la deja atada a SU
  pago: quitar el pago quita esa comisión y no las de otros pagos Amex.
- **Pagos solo en un borrador.** Cobrar una prefactura cerrada está decidido que no (ver la
  deuda nueva).

## Este bloque SÍ toca código del bloque 2 (y del 1b)

Las tablas y columnas nuevas no tocan nada existente, pero el código sí. Respecto a `0c8cd24`
cambian estos archivos que ya existían: `FactPrefactura`, `FactPrefacturaRenglon`,
`FactServicio`, `FactFormaPago`, `PrefacturaController`, `PrefacturaRenglonController` (su
guarda de «cerrada» se movió al trait `RechazaPrefacturaCerrada`), `CargosEstancia` (recalcular
la estancia conserva la cortesía de sus renglones), `CierrePrefactura` (el aviso de cobro),
`ImportadorMatriculas` (asigna los conceptos de las formas de pago y el de la comisión) y
`routes/api.php`. Además, en el cierre del bloque, `PagosPrefactura::totalConComision()` pasó de
`private` a `public static`, para que el comando de comparación la use en lugar de copiarla.

**Backend y frontend se despliegan juntos**, y hay que reconstruir el frontend. El backend
nuevo con el frontend viejo no se rompe (las rutas solo se agregan), pero no habría panel de
cobro, ni de notas, ni interruptor de cortesía.

**No hay subdepartamento nuevo**: las rutas de pagos, notas y cortesía cuelgan de
`subdep:factPrefacturas`, el mismo del bloque 2. No hay que correr ningún seeder.

## Orden de despliegue

```bash
git pull
composer install --no-dev --optimize-autoloader

# CUATRO migraciones, todas aditivas. Ninguna modifica ni borra filas existentes:
#   2026_09_29_093000  agrega a fact_formas_pago `concepto` (única, nula) y lo asigna POR NOMBRE
#                      a 'Efectivo', 'Amex' y 'AvCard by WFS' si esas filas existen con ese nombre
#   2026_09_29_093100  crea fact_prefactura_pagos
#   2026_09_29_093200  agrega `es_cortesia` (0 por omisión) a fact_prefactura_renglones
#   2026_09_29_093300  agrega las tres notas a fact_prefacturas
php artisan migrate

# +- ¿QUÉ BASE ES ESTA? El paso siguiente depende de la respuesta --------------------+
# | (a) El 1b y el 2 NO estaban aplicados (se despliegan juntos con este bloque): el  |
# |     importador tal como está; la primera --aplicar asigna TODOS los conceptos.    |
# | (b) El 1b o el 2 YA ESTABAN en uso: NO correr el importador con --forzar. Usar la |
# |     OPCIÓN B de más abajo, que asigna solo los conceptos de este bloque con un    |
# |     UPDATE dirigido y no toca ningún precio. Es la misma regla de la guía del 2.  |
# +-----------------------------------------------------------------------------------+

# PASO OBLIGATORIO, CASO (a): el importador de catálogos.
# 1. Simulación: lee fact-fbo, escribe y revierte. LEER ENTERA la salida.
php artisan facturacion:importar-matriculas | tee storage/logs/facturacion-importacion-$(date +%F).log
# 2. Aplicar. --forzar hace falta si fact_aeronaves ya tiene filas.
php artisan facturacion:importar-matriculas --aplicar --forzar | tee -a storage/logs/facturacion-importacion-$(date +%F).log

# La comprobación de que el dinero cuadra contra el histórico. SOLO LEE.
# Ver «El resultado real del comando de comparación» para leer su salida.
php artisan facturacion:comparar-pagos | tee storage/logs/facturacion-comparacion-pagos-$(date +%F).log

php artisan optimize:clear
npm ci && npm run build
```

### Paso obligatorio: asignar los conceptos DESPUÉS de migrar

**Es el paso más fácil de omitir, y el bloque 2 ya lo llamó así.** Ahora tiene una
consecuencia más. La migración `093000` agrega `concepto` y solo lo rellena **por nombre**
y **solo en las tres formas de pago**; el concepto del servicio «Comisión AMEX»
(`comision_amex`, el `id_servicio = 100` del sistema viejo) **no lo asigna ninguna migración,
solo el importador**. Lo que pasa mientras falte, y qué tan visible es:

| Falta | Qué pasa | ¿Se nota? |
|---|---|---|
| El concepto del servicio «Comisión AMEX» | El pago Amex responde **422** `servicio_comision_no_disponible`; la transacción se revierte y no queda nada escrito | Sí, en el primer pago Amex |
| El concepto `amex` en la forma Amex | `registrarAmex()` responde **422** `forma_de_pago_no_disponible`. Peor: si el pago Amex se registra por el endpoint genérico, se trata como una tarjeta cualquiera, **sin comisión** | El 422, sí; el pago genérico, no |
| El concepto `avcard` | **AvCard no se rechaza con combustible** (la regla de `mpago.php:48`) y se cobra sin ningún tope | **No: es silencioso** |
| El concepto `efectivo` | El efectivo se trata como tarjeta: un monto mayor que lo que falta se rechaza (422 `supera_lo_que_falta`), así que **no se puede cobrar efectivo con cambio** (el histórico tiene **17** folios sobrepagados que llevan un pago en efectivo; 16 de ellos con `Cambio` guardado) | Sí, en el primer efectivo con cambio |

El importador asigna **cuatro conceptos nuevos** en este bloque: las
tres formas (`tb_tip_fpago` ids 3 → `amex`, 4 → `efectivo`, 5 → `avcard`) y el servicio
`id_servicio = 100` → `comision_amex`. Solo asigna a una fila que lo tiene en NULL y nunca
cambia uno ya puesto.

### Opción B (caso b): asignarlos a mano, sin tocar ningún precio

**Sin este paso, o sin el importador en el caso (a), el pago Amex responde 422, y AvCard no se
rechaza con combustible, en silencio.** Es una instrucción de despliegue: no se probó contra
ninguna base, porque no hay una con el catálogo del 1b a mano.

Es la vía cuando el 1b o el 2 ya estaban en uso. `--forzar` pisa **seis** tablas
(aeronaves, categorías de aeronave, tipos de motor, precio de combustible, clientes y
servicios): ver «Qué pisa `--forzar`» en la guía del 1b y la del 2. Cualquier tarifa, RFC o
precio editado a mano **vuelve al del sistema viejo, y eso cambia cobros**.

**B.0 Comprobar antes de escribir** (con `SET NAMES utf8mb4;`: el cliente `mysql` de Windows
arranca en cp850 y una sentencia con acento afecta 0 filas **sin error**). Deben salir
**tres** filas de formas y **una** del servicio; si un nombre sale dos veces o no sale,
decidir a mano antes de seguir:

```sql
SET NAMES utf8mb4;
SELECT id, nombre, concepto, status FROM fact_formas_pago
 WHERE nombre IN ('Efectivo', 'Amex', 'AvCard by WFS') ORDER BY nombre, id;     -- 3 filas
SELECT id, nombre, concepto, status FROM fact_servicios WHERE nombre = 'Comisión AMEX';  -- 1 fila
```

**B.1 Asignar.** Pegar tal cual. Las tres primeras casi seguro ya las hizo la migración
`093000`; se repiten porque solo tocan filas con `concepto` en NULL y no cuesta nada:

```sql
SET NAMES utf8mb4;

UPDATE fact_formas_pago SET concepto = 'efectivo' WHERE concepto IS NULL AND nombre = 'Efectivo';
UPDATE fact_formas_pago SET concepto = 'amex'     WHERE concepto IS NULL AND nombre = 'Amex';
UPDATE fact_formas_pago SET concepto = 'avcard'   WHERE concepto IS NULL AND nombre = 'AvCard by WFS';

UPDATE fact_servicios SET concepto = 'comision_amex' WHERE concepto IS NULL AND nombre = 'Comisión AMEX';
```

El `mysql` en lote **aborta el resto del script al primer error** (por ejemplo, un `concepto`
que ya lleva otra fila, por el índice único): lo que sigue no se ejecuta y la verificación lo
refleja con menos filas.

### Verificación (haya sido el importador o la opción B)

```sql
SET NAMES utf8mb4;
SELECT concepto, nombre FROM fact_formas_pago WHERE concepto IS NOT NULL ORDER BY concepto;
-- 3 filas: amex, avcard, efectivo
SELECT concepto, nombre FROM fact_servicios WHERE concepto = 'comision_amex';        -- 1 fila
```

Contar no basta: se listan. Y, ya con los conceptos puestos, **probar a mano un pago Amex en
un borrador de prueba** y descartarlo: es la única comprobación de punta a punta.

## ATENCIÓN: revertir este bloque DESTRUYE pagos

**No ejecutar `php artisan migrate:rollback` en una base donde alguien ya cobró.**
`migrate:rollback` no revierte «una migración»: **revierte el último lote**. Si este bloque
se desplegó **junto con el 2** (un solo `migrate`), el lote incluye también las cuatro
migraciones del bloque 2 y **el rollback borra además todas las prefacturas** (ver la guía
del 2). Si se desplegó solo, el lote son estas cuatro, y sus `down()` son:

| Migración | Lo que hace su `down()` |
|---|---|
| `093300` | quita las tres notas de `fact_prefacturas`: **se pierden todas las notas** |
| `093200` | quita `es_cortesia`: **las cortesías vuelven a cobrar su precio completo** (el renglón conserva su precio; solo la marca decía que no se cobraba). Cambia los totales de todo borrador con cortesías |
| `093100` | **`dropIfExists('fact_prefactura_pagos')`: se pierden TODOS los pagos**, sin copia en ningún otro lado. Los renglones de comisión Amex **se quedan** en sus prefacturas y siguen sumando al total: quedarían prefacturas con la comisión y sin el pago que la originó |
| `093000` | quita `concepto` de `fact_formas_pago`: las reglas de cobro dejan de reconocer a Efectivo, Amex y AvCard |

Reglas:

- **Antes de migrar**, sacar copia de `fact_prefactura_pagos` (si ya existe), `fact_prefacturas`,
  `fact_prefactura_renglones`, `fact_formas_pago` y `fact_servicios` (por ejemplo con `mysqldump`).
- **Después del primer pago, ninguna migración de este bloque se revierte.** Si hay que dar
  marcha atrás del despliegue, se vuelve al código anterior y las tablas y columnas se dejan
  donde están. **Pero ojo con esa vuelta:** el código del bloque 2 **no conoce `es_cortesia`**
  (su `importe()` nunca la mira), así que con él los renglones marcados como cortesía **cobran su
  precio completo** aunque la columna siga ahí. Volver atrás no es inocuo si ya hay cortesías.
- Si de verdad hace falta revertir una sola migración, y **solo en una base sin pagos ni
  cortesías**: `--step=N` cuenta desde la migración más reciente de toda la base, no desde la
  que dice `--path`, y `--path` solo filtra qué archivos acepta (una que no coincide sale como
  «Migration not found» y no se hace nada). Por eso:

  ```bash
  php artisan migrate:status        # ver cuáles son las más recientes
  php artisan migrate:rollback --pretend --step=1 --path=database/migrations/2026_09_29_093300_add_notas_to_fact_prefacturas_table.php
  ```

  **Leer la salida de `--pretend`**: debe listar exactamente las sentencias de esa migración y
  ningún «Migration not found». Solo entonces repetir el comando sin `--pretend`. Una
  migración intermedia no se puede revertir sin revertir antes las posteriores, porque el
  rollback va en orden inverso (`093300`, `093200`, `093100`, `093000`).

## El resultado real del comando de comparación

`php artisan facturacion:comparar-pagos` **solo lee**: lo fijan tres pruebas (cero filas
nuevas, mismos conteos en el origen antes y después, y una captura de toda sentencia en
cualquier conexión que exige que todas sean `select` y todas vayan por `remota`). Esta es su
salida real contra el volcado de producción (`fact-fbo-prod`, conexión `remota`), sin tocar
ninguna tolerancia. **Cada comparación tiene su propia etiqueta en la salida**, por la
lección del bloque 2.

**Hay cifras de la especificación que NO salieron**, y se explican aquí en lugar de
ajustarse. La tabla las separa:

| Comparación | Medido | La especificación decía | Por qué |
|---|---|---|---|
| Pagos | **3,534** (3,516 folios) | 3,534 | Coincide |
| Comisiones Amex (`tb_venta`, servicio 100) | **733**, una por folio | 733 | Coincide |
| Folios con encabezado repetido | **207** (497 filas) | 207 | Coincide |
| Poblaciones Amex, en folios | **719** (único pago Amex, subtotal > 0, último encabezado) → **716** (con una sola comisión); y **718** para la fórmula (sin exigir encabezado) | 771 → 765 → 718 | **771 y 765 eran filas, no folios** (ver abajo) |
| Comisión Amex: exactas / segunda rama / ninguna | **696 / 5 / 24** de 725 comparables | 765 / 5 / 11 de 781 | **765 y 781 son filas de un join** (ver abajo) |
| Ajustes de `comisionQueCuadra()` | **21** de 718, de 1 a 3 centavos | 21, de 1 a 3 | Coincide |
| …que coinciden con la comisión del viejo | **21 de 21** | 21 de 21 | Coincide |
| La fórmula sola cuadra el total | **690** | 690 | Coincide |
| Sin candidato en la ventana de ±5 centavos | **7**: 47, 200, 587, 1732, 2061, 2062, 2235 | 7, los mismos | Coincide el conjunto; **no todos difieren del viejo** (ver abajo) |
| El 200 | pago completo, comisión del viejo a 28.18 de la fórmula, **32.69** por cobrar | ~28 pesos, 32.69 | Coincide |
| Sobrepagadas / con Cambio en cero / Cambio sin sobrepago | **30 / 14 / 2**, sin tolerancia | 27 / 12 / 3 | **El diseño midió con un centavo de tolerancia que no declaró; el comando no la usa**, por eso son tres más (ver abajo) |
| Folios con encabezado y sin ningún pago | **289** | 289 | Coincide |
| Cortesías marcadas | **130** | 130 | Coincide |
| Importe 0 con `precio_u > 0` | **142** | 142 | Coincide |
| Importe 0 con `precio_u > 0` **sin** marca de cortesía | **19** | 12 (= 142 − 130) | **Las 130 no son un subconjunto de las 142**: 123 en las dos, 7 marcadas sin importe 0, 19 con importe 0 sin marca (ver abajo) |

### Lo que cada cifra que no salió significa

**771, 765 y 781 eran filas, no folios.** La consulta unía `tb_formas_pago` a `tb_hprefactura`,
que tiene 207 folios duplicados, sin deduplicar, y el `JOIN` multiplica cada pago por cada
encabezado repetido. Se reprodujo exacto: los folios cuyo único pago es un Amex, con encabezado
de subtotal > 0, son **771 filas y 719 folios**; con una sola línea de comisión, **765 filas y 716
folios**; y **781 es el número de filas** de pagos Amex × encabezados × comisión, sobre 729 pagos
distintos. Y **765 / 5 / 11 sale, aproximadamente (766 / 5 / 10), solo contando
filas y aceptando hasta 3 centavos de diferencia**; al centavo, sobre las mismas 781 filas, son
750 / 5 / 26. Contado por folios, que es lo que importa, y **al centavo**: de las 733
comisiones, 725 son comparables con un pago Amex (8 no: 5 folios sin pago Amex —23, 50, 108,
134, 273— y 3 con más de uno —246, 3261, 3555—, y el comando los lista); de las 725,
**696 siguen `ComisionAmex::calcular()`, 5 siguen la segunda rama (2, 3, 29, 32 y 47) y 24 no
siguen ninguna**. De esas 24, **21 son los ajustes de 1 a 3 centavos que
`comisionQueCuadra()` reproduce al centavo**, y quedan **3 que ningún ajuste alcanza: 22
(la comisión guardada es 600 y la fórmula da 1,082.29; el folio tiene dos pagos con el mismo
monto, uno Amex y uno Mastercard), 200 (ver abajo) y 3484 (guardada 1,667.78, fórmula 94.40:
el pago Amex es 1,934.62 de un total de 34,178.33)**. **El 718 de la comparación de la fórmula sí
era de folios y coincide:** los folios cuyo **único pago** es un Amex, con una sola línea de
comisión y partida mayor que cero, **sin exigir encabezado**: 716 tienen encabezado y el 2061 y
el 2062 no lo tienen (por eso no son los 716 de arriba más nada: la población se definió sin
encabezado a propósito). El comando imprime el funnel por folios: 729 con único pago Amex, 719 de
ellos con encabezado de subtotal > 0, 718 con una sola comisión y partida > 0.

**El monto con el que se calcula la comisión es el importable** (el del pago ya redondeado a
centavos, el que el sistema nuevo tendrá en `fact_prefactura_pagos.monto`): con él salen las
690 y los 21 de la especificación; con el monto crudo del DOUBLE saldrían 695 y 16. Es una
decisión del comando y está en su cabecera.

**«Los 7 folios sin candidato sí difieren del viejo» solo es cierto de dos.** Ninguno tiene
candidato en la ventana porque el pago **no es la prefactura completa**, pero la comisión
que el viejo guardó **coincide con la de la fórmula en cinco de ellos** (587, 1732, 2061, 2062
y 2235): ahí el sistema nuevo y el viejo cobrarían lo mismo. Difieren el **47** (comisión de la
segunda rama, 1,080.22 contra 878.51) y el **200**. El comando los separa por caso:

- **Pago completo, 1 folio (el 200):** el total viejo (15,412.27) cuadra exactamente con el
  monto, pero el operador tecleó unos 34 pesos menos que `partida × 1.2296`, así que la
  comisión del viejo (723.88) se aleja 28.18 de la fórmula (752.06) y ningún ajuste de ±5
  centavos la alcanza. **Con la fórmula quedan 32.69 por cobrar.**
- **Monto distinto del total viejo, 4 folios (47, 587, 1732, 2235):** pagos que no son la
  prefactura completa (por ejemplo, el 1732 paga 12,910.80 de 159,363.12).
- **Sin encabezado, 2 folios (2061 y 2062):** no hay total viejo contra el que comparar.
  Con los renglones que sí tienen, el pago **excede** lo que ellos suman (por cobrar −812.00
  y −1,137.96): no son pagos parciales sino pagos mayores que el detalle que sobrevivió.

**El sobrepago, sin tolerancia, da 30 / 14 / 2, no 27 / 12 / 3.** El diseño midió con **un
centavo de tolerancia que nunca declaró** (sus consultas llevaban `+ 0.011`). El comando **no la
usa**: el sobrepago del sistema nuevo es exacto (`pagado − total > 0`) y el comando no debe ser
más laxo que el sistema que verifica. Por eso sus cifras son tres más, y no hay una segunda cuenta
«sin contar el centavo». Los tres folios que lo son **por un solo centavo** salen nombrados, cada
uno con su causa, y la distinción importa para el bloque 6:

- **3261 y 3555 los crea la propia importación; no existen en el origen.** Cada uno tiene dos pagos
  Amex de cuatro decimales (59,316.136 y 7,449.4156; 47,477.4776 y 4,600.7572), cada pago se redondea
  hacia arriba, y la suma de lo importado queda un centavo por encima del Total, mientras que la
  suma del origen, a centavos, cuadra con él (66,765.55 y 52,078.23). Importar pagos de uno en uno a
  `decimal(12,2)` **fabrica** estos dos sobrepagos.
- **El 394 es un cambio real de 0.01:** un pago en efectivo de 7,606.43 sobre un Total de 7,606.42,
  con un `Cambio` guardado de 0.01. Ya estaba en el origen.

**Las 130 cortesías marcadas no son un subconjunto de las 142 filas con importe 0, y el bloque 6
necesita tres cosas para no perder ni inventar cortesías.** `remision = 'cortesia'` se evalúa en
SQL, con la collation del origen, que no distingue mayúsculas ni acentos: así salen las 130. De
ellas:

- **123** tienen importe 0 y `precio_u > 0` (las que el bloque 6 traducirá a `es_cortesia`);
- **7 no tienen importe 0**, y son dos cosas distintas: **seis renglones escritos «Cortesía» con
  precio e importe NEGATIVOS** (folios 3090, 3393, 3507, 3508, 3640 y 3646), que **no son cortesías
  sino descuentos** (renglones negativos), y el bloque 5 los trae; y el folio **1031**, que está
  marcado pero cobra (importe 700.00). Con la regla «importe 0 con `precio_u > 0`», ninguno de los
  siete se traduce a `es_cortesia`. **La condición no captura las 130: deja fuera 7 y agrega 19.**
- **19** filas con importe 0 y `precio_u > 0` **no llevan marca** (el diseño decía 12). **Una es el
  folio 53, escrita «cortecia»**: una errata de «cortesía» en el origen, que ninguna comparación
  exacta captura. Otras viven en los folios 866, 869, 932, 1177, 1178, 1824, 2558 y 3100, donde hay
  renglones a precio completo con importe 0 sin que nada diga por qué (el 866 ya apareció en el
  bloque 2 con 13,644.00 de diferencia). **No se sabe si son cortesías olvidadas de marcar o
  errores**; el comando las lista una por una, y marca la errata.

Las tres cosas, en una línea: hay seis filas negativas que pertenecen al bloque 5, hay una errata
en el origen, y la condición del bloque 6 y la marca del origen son conjuntos distintos.

### Lo que el comando mide además

- **Pagos que se redondean al importar: 687** (166 con tres decimales y 521 con cuatro, **todos
  son pagos Amex**: es el bruto que Amex cargó, no un error). Pasarlos a `decimal(12,2)` suma una
  diferencia neta de **−0.3476** (3,534 pagos; 1.8228 en valor absoluto). La suma de Amex pasa de
  13,734,030.92 en el origen a 13,734,030.57 importados; las demás formas coinciden al centavo.
  Los pagos que caben tal cual son 2,847. **La suma por folio no coincide al centavo en 2 folios**
  (3261 y 3555, los de arriba).
- **19 pagos con monto 0.00.** Caben en `decimal(12,2)`, pero **`registrar()` exige un monto mayor
  que cero**: el bloque 6 no puede importarlos tal cual. Están en los folios 239, 246, 257, 1917,
  1918, 1952, 1977, 2026, 2034, 2282, 2287, 2342, 2343, 2490, 3507, 3640, 3646, 3690 y 4103.
- **41 pagos de folios sin encabezado** en `tb_hprefactura` (41 folios): se cuentan y quedan fuera
  del sobrepago, que necesita el `Total`.
- **El `Cambio` guardado está mal en las dos direcciones, confirmado:** 14 folios sobrepagados lo
  tienen en cero (2, 3, 4, 22, 67, 84, 2699, 2914, 3261, 3555, 3661, 3715, 3989 y 4101); y 2
  folios (308 y 1837) lo tienen distinto de cero sin estar sobrepagados. Entre los primeros hay
  casos que parecen **errores de captura, no de cambio**: el 3661 tiene un Total de 8,637.94 y un
  pago de **863,794.00** (cien veces), y el 308 un `Cambio` de 10,006.73 sobre un Total de 1,006.73.
  Los folios 3715, 3989 y 4101 tienen **Total 0.00** y pagos de 13,265.53, 3,956.76 y 1,327.04.

### Cómo leerlo

- **Los folios repetidos**: `invoice.php` inserta el encabezado histórico **antes** de validar
  cliente y fecha de salida, y solo borra de `tb_prefcatura` cuando la validación pasa, así que
  **cada intento fallido de imprimir deja un encabezado** (`invoice.php:47` inserta, `:72` y `:77`
  rechazan, `:293` borra). Esto **sí es mecánico** y está en el código, a diferencia de la
  hipótesis de `MAX + 1` que la guía del bloque 2 dejó abierta (esa sigue sin demostrarse como
  causa de nada). Por eso el comando toma **la última fila de cada folio**, la del intento que sí
  imprimió, y lo dice en su salida. Que esa fila sea la vigente **se deduce del código y no se
  comprobó contra los 207 folios**.
- **El comando prueba la aritmética y las reglas, no el extremo a extremo.** Los montos los teclea
  una persona: si alguien cobró la mitad de una prefactura, esto no lo detecta.
- **Los números pueden moverse** si el volcado se refresca. No es una regresión: el comando mide el
  origen tal como está. Estas cifras se midieron el 2026-10-02.

## Lo que sqlite no puede demostrar

La suite corre sobre sqlite en memoria. Sqlite **ignora `lockForUpdate()`**, compara texto en
binario y no aplica concurrencia real. Esta lista **continúa** la de la guía del bloque 2
(sus cuatro puntos: el contador del folio, el 409 del cierre, el candado de los cargos de
estancia y la collation de `concepto`), y todo hay que probarlo contra MySQL real **antes** de que
dos operadores usen el módulo a la vez. Los puntos 5 y 6 son nuevos.

### 5. Dos sesiones cobrando la misma prefactura a la vez

`PagosPrefactura::registrar()` y `registrarAmex()` toman `lockForUpdate()` sobre la fila de la
prefactura **dentro de su transacción**, y es lo que hace que el tope («el monto supera lo que falta
por cobrar») vea el pago de la otra sesión. **Sin el candado, dos pagos que caben cada uno pero no
los dos juntos pasarían los dos.** La suite lo prueba con peticiones secuenciales: no demuestra nada
de esto.

La prueba, sobre un borrador **de prueba** al que le falten, por ejemplo, 100.00:

- **Dos pagos con una tarjeta con tope (Visa, Mastercard, Transferencia) de 100.00 a la vez.** El
  resultado correcto es que **exactamente uno** responda 201 y el otro **422 `supera_lo_que_falta`**,
  y que `pagado` quede en 100.00, nunca en 200.00.
- **Dos pagos Amex a la vez**, cada uno por lo que falta de la misma prefactura: exactamente uno gana y el otro responde
  422 `amex_supera_lo_que_falta`, y **queda una sola comisión** (no dos renglones de comisión para
  un solo pago).
- **Un pago y el borrado del pago de otra sesión** (`DELETE .../pagos/{pago}`): sin `quitar()` y el
  candado, un pago Amex borrado a la vez que se registra otro podría llevarse la comisión equivocada.

### 6. Cobrar mientras otra sesión cierra

`CierrePrefactura::cerrar()` toma el **mismo** candado sobre la prefactura, de modo que cobrar y
cerrar se serializan: sin él, un pago que entra durante el cierre quedaría fuera de la comprobación
de cobro y el documento saldría diciendo otra cosa que lo cobrado.

La prueba: una sesión registrando un pago y otra cerrando la **misma** prefactura. El resultado
correcto es **uno de dos**, nunca un tercero: (a) el pago entra primero y el cierre **lo ve** (el
aviso de cobro y la bitácora dicen lo pagado, y el sello coincide con los renglones); o (b) el cierre
entra primero y el pago recibe **409** (`ya_cerrada`) sin haber escrito nada. Repetirla con un pago
Amex, que además agrega un renglón y por lo tanto **cambia el total** que el cierre sella: si el
renglón de comisión llegara después del sello, el documento quedaría con un total que no incluye una
comisión que el pago dice haber cobrado. El cierre tiene su segunda red (compara su sello contra la
derivación y lanza `SelloInconsistenteException`), pero **solo es coherente bajo REPEATABLE READ**, que
`config/database.php` no fija (ver el punto 3 de la guía del bloque 2).

## La importación del histórico: el aviso que el usuario pidió

**Pagos y notas ya tienen tabla**, que era lo que hacía a la importación parcial por construcción.
Eso es lo que el usuario pidió que se avisara en voz alta. **La importación sigue sin existir** (es el
bloque 6), pero ya no le falta una tabla de destino, y llega con **decisiones pendientes**, ahora
más numerosas:

- Qué hacer con los **207 folios repetidos** (497 filas): consolidar, marcar o dejarlos en el viejo.
  El comando ya sabe cuál es la fila vigente (la última), pero **la decisión es del negocio**.
- Qué hacer con las **estructurales** del bloque 2 (171 en el subtotal, 86 renglones sin
  encabezado, los totales que no salen de subtotal + IVA).
- **Nuevas de este bloque:** los **19 pagos en cero**, los **41 pagos de folios sin encabezado**
  (incluidos los de los folios 2061 y 2062, que además tienen comisión Amex), los **dos sobrepagos de
  un centavo** que crea el redondeo (3261 y 3555), las **comisiones que no siguen ninguna fórmula**
  (22, 200 y 3484) y las **de la segunda rama** (2, 3, 29, 32 y 47), las **7 marcas de cortesía sin
  importe en cero** (1031 y los 6 descuentos escritos «Cortesía») y las **19 filas con importe 0
  sin marca**.

## La deuda que este bloque NO retira

Del bloque 2, **sigue abierta, sin cambios** (los archivos del bloque no la tocan):

- **La conexión `remota` entra con credenciales de escritura.** Que el comando de comparación solo
  lea es una garantía de **código**, fijada por pruebas; el `.env` usa `root` contra la base legada.
  La defensa estructural sería un usuario de MySQL de solo lectura para esa conexión. **Importa más
  en el bloque 6, que sí escribirá**, y ahora son dos comandos de comparación que dependen de esa
  garantía.
- **No hay restricción única sobre `fact_prefacturas.operacion_llegada_id`**, ni comprobación en el
  Form Request: dos operadores pueden crear dos borradores sobre la **misma llegada** a la vez.
- **Reabrir una cerrada no está protegido en el modelo.** `FactPrefactura` no tiene guarda sobre el
  cambio de `estado`; las defensas son las de los endpoints y la guarda de renglones. Un `update`
  directo (tinker, un llamador futuro) podría devolver una cerrada a borrador, con su folio y su sello
  puestos. **Ahora también con sus pagos**: la guarda de pagos de una cerrada vive en el servicio y en
  el endpoint, no en el modelo `FactPrefacturaPago`.
- Los menores del bloque 2 que quedaron fuera a propósito, y la deuda heredada del 1b (el 500 en lugar
  de 422 en altas simultáneas, la bitácora fuera de transacción en sus controladores, el nombre del
  comando `facturacion:importar-matriculas`): ver las guías del 2 y del 1b.

**Nueva, de este bloque:**

- **Cobrar una prefactura cerrada.** Está decidido que no, pero el departamento todavía no lo ha
  probado, y **las 289 cerradas sin pago del histórico sugieren que en algún sitio se cobra después**.
  Si en las pruebas resulta que hace falta, añadirlo es agregar, no deshacer: pero mientras tanto
  cualquier cobro posterior al cierre ocurre fuera del sistema.
- **Imprimir** (bloque 4). Sin PDF el departamento no puede dejar el sistema viejo.
- **El descuento** (bloque 5): renglones negativos. Los 6 renglones «Cortesía» con precio negativo del
  histórico son de este tipo, y la pregunta que el bloque 2 dejó escrita sigue abierta: el redondeo del
  IVA no está definido para subtotales negativos (el viejo redondea lejos del cero, nosotros truncamos
  hacia el cero).
- **Sin pruebas de interfaz**: el panel de cobro, el modal de Amex, el panel de notas y el interruptor
  de cortesía se verifican con `tsc`, `eslint` y el build, igual que las pantallas del bloque 2.
  Conviene abrirlos a mano tras desplegar: cobrar con efectivo y con cambio, un pago Amex y quitarlo
  (debe quitar su comisión), marcar y desmarcar una cortesía, cerrar sin cobro completo y confirmar, y
  una cerrada en solo lectura.
- **La ventana de ±5 centavos de `comisionQueCuadra()` es una guarda intencionada** que el sistema viejo
  no tenía (él calculaba por diferencia y por eso siempre cerraba, y absorbía cualquier desvío: en el
  folio 200, 28 pesos de comisión). Con ella, la comisión se queda en la de la fórmula. Un monto tecleado
  **de más** se rechaza (el total con comisión queda por debajo del monto: `amex_supera_lo_que_falta`);
  uno **de menos**, como el del folio 200, **se acepta y deja 32.69 por cobrar**. Lo segundo no avisa
  de nada más que del faltante en la pantalla.

## Nota de entorno

`php artisan test --parallel` produce falsos fallos en la máquina de desarrollo actual (ver la guía del
1b). **La suite se corre en serie.** Al cierre de este bloque son **979 pruebas** en
verde, medidas con `php artisan test` en serie: 947 al empezar la última task del bloque y 32 de
`CompararPagosTest` (751 al cerrar el bloque 2).
