# Bloque 3 — Pagos, notas y cortesía

**Fecha:** 2026-10-02
**Rama base:** `facturacion` (bloques 1a, 1b y 2 integrados, 751 pruebas en verde)
**Bloques previos:** `2026-09-28-facturacion-catalogos-design.md` (1a y 1b),
`2026-10-01-facturacion-2-prefactura-design.md` (2)

## Qué resuelve

El bloque 2 dejó una prefactura que se arma, se calcula y se cierra con folio y
sello. Lo que no tiene es **cómo se cobra**. Este bloque trae las dos tablas que
faltaban del sistema viejo —los pagos y las notas— más la **comisión Amex**, que
no es una función aparte sino un renglón que nace del pago, y la **cortesía**, que
es cómo el departamento deja de cobrar un servicio sin borrarlo del documento.

Con esto la prefactura queda completa como registro. Lo que sigue faltando para
que el departamento pueda dejar el sistema viejo es **imprimirla**, que es el
bloque 4.

## Cómo se parte lo que queda

Este bloque es el tercero de seis. El reparto se decidió el 2026-10-02 y el orden
lo manda una dependencia dura: **el PDF imprime los pagos y las notas, así que sus
tablas van antes que la impresión.**

| Bloque | Qué entra |
|---|---|
| 1a, 1b | Catálogos: matrículas, clientes, servicios, categorías, proveedores, formas de pago, tarifas |
| 2 | La prefactura: encabezado, renglones, estancia, paquete internacional, totales sellados, folio al cerrar |
| **3 (este)** | **Pagos, notas, comisión Amex, cortesía** |
| 4 | Impresión: el PDF de la prefactura, la cotización y la reimpresión |
| 5 | Agrupación de renglones y ajuste de estancia; el descuento (renglones negativos) |
| 6 | Importar el histórico y corregir una prefactura cerrada |

## El dato de origen

Base legada `fact-fbo`, conexión `remota`. **Solo se lee**: este bloque no importa
nada, igual que el 2.

| Tabla | Filas | Destino |
|---|---|---|
| `tb_formas_pago` | 3,534 | `fact_prefactura_pagos` (bloque 6 la importa) |
| `tb_notas` | 215 | Tres columnas en `fact_prefacturas` |
| `tb_tip_fpago` | 7 | Ya está: `fact_formas_pago`, lo trajo el 1b |
| `tb_venta` con `id_servicio = 100` | 733 | Renglones de comisión Amex |
| `tb_venta` con `remision = 'cortesia'` | 130 | Renglones con `es_cortesia` |

Las siete formas de pago del catálogo del 1b, con su reparto en el histórico:

| Forma | Pagos | Importe |
|---|---|---|
| Visa | 1,304 | 15,363,657.56 |
| Mastercard | 787 | 8,063,736.52 |
| Amex | 742 | 13,734,030.92 |
| Efectivo | 361 | 5,798,790.58 |
| Transferencia | 205 | 5,392,748.45 |
| AvCard by WFS | 130 | 2,494,500.83 |
| Tarjeta Remota | 5 | 44,267.34 |

**Nunca hay más de dos pagos por folio**: 3,498 folios con uno y 18 con dos. La
tabla no limita cuántos, pero conviene saber que el caso de dos es raro.

## Hechos medidos que deciden el diseño

### 1. El sistema viejo NO exige cobrar antes de imprimir

**289 de 3,764 folios cerrados no tienen ningún pago** (7.7%). De los 3,475 que sí
tienen: 3,417 cubren el total exacto, 31 quedan por debajo y 27 por encima
(efectivo con cambio).

**Consecuencia:** cerrar no puede exigir cobro, o esas 289 serían inimportables en
el bloque 6. Pero sí tiene que **avisar** — hoy nadie se entera.

### 2. El `Cambio` guardado está mal

Está mal en las dos direcciones. De los **27** folios con pagos por encima del
total, solo **15** tienen `Cambio` distinto de cero: los otros 12 lo tienen en cero.
Y de los **18** folios con `Cambio` distinto de cero, **3 no están sobrepagados**.

La causa de la primera dirección está en `mpago.php`: casi toda rama que inserta un
pago hace `UPDATE tb_prefcatura SET Cambio='0'`, así que un pago posterior borra el
cambio que el efectivo había dejado. La segunda dirección es su reflejo: el cambio
quedó escrito y después la prefactura cambió.

**Consecuencia:** el cambio **se deriva, no se guarda**. Es la misma decisión que
el bloque 2 tomó con `importe`, y por la misma razón: un valor guardado que se
puede recalcular acaba contradiciendo a sus partes.

### 2b. Un sobrepago no siempre es cambio

De los 27 folios sobrepagados, **16 tienen efectivo y 11 no**: 7 Visa, 4 Amex, 1
Transferencia, 1 Mastercard y 1 AvCard. Y Visa, Mastercard y Transferencia **sí
tienen tope** en `mpago.php`, que rechaza un monto mayor que lo que falta.

La explicación es que el tope se calcula contra el `Total` **guardado** en el
encabezado. Si se cobra primero y después se quita un servicio o se marca una
cortesía, el total baja por debajo de lo ya pagado y el tope nunca se enteró. En
Eolo-plus pasa lo mismo: los pagos van en el borrador, y el borrador se sigue
editando.

**Consecuencia:** el número derivado es `sobrepago = max(0, pagado − total)`, pero
lo que *significa* depende de cómo nació:

- Con un pago en **efectivo**, es **cambio**: dinero que se devuelve.
- **Sin efectivo**, es **cobrado de más**: el documento se editó después de
  cobrarse, y lo que hay que hacer es corregir el pago, no devolver nada.

La pantalla lo nombra distinto en cada caso. Llamar «cambio» a un sobrecargo de
tarjeta sería decirle al operador que entregue efectivo que nadie le dio.

### 3. La regla de AvCard es real y se cumple sin excepción

`mpago.php:48` rechaza AvCard by WFS cuando la prefactura tiene un renglón de
combustible (`id_servicio = 7`). En el histórico: **0 de los 130 folios con AvCard
tienen combustible**, habiendo 1,152 folios con combustible. La regla no es
decorativa; se queda tal cual.

### 4. La comisión Amex tiene una sola fórmula en la práctica, y es exacta

`mpamex.php` tiene dos ramas según si ya había pagos registrados. Contra las 781
comisiones comparables del histórico:

| Fórmula | Coincidencias |
|---|---|
| `monto × 0.06 / 1.2296` (rama sin pagos previos) | **765** |
| `monto × 0.06` (rama con pagos previos) | 5 |
| `subtotal × 0.06` | 0 |
| Ninguna de las tres | 11 |

Y la que gana **no es un parche**. `1.2296 = 1.16 × 1.06`. Si el operador teclea lo
que se le va a cargar a la tarjeta:

```
base     = monto / ((1 + iva) × 1.06)
comisión = base × 0.06                        ← el renglón que se agrega
subtotal = base + comisión = base × 1.06
total    = subtotal × (1 + iva) = monto       ← cuadra exacto
```

La comisión es **el 6% de la base que implica el monto bruto**, y está construida
para que el total de la prefactura caiga justo en lo que se cobra a la tarjeta.

**Consecuencia:** se implementa **una sola fórmula**, escrita con la tasa de IVA
configurable que el bloque 2 ya tiene (`FactPrefactura::ivaTasa()`) en lugar del
`1.2296` literal. Con 16% da el mismo número que el histórico; el día que la tasa
cambie, sigue siendo correcta. La segunda rama se descarta y queda documentada con
sus 5 folios.

### 5. Los dos errores de margen del viejo no se pueden reproducir

`cortecia.php` y `desagrupar.php` devuelven un renglón a su importe con
`importe = precio_u × cantidad`, que **pierde el margen y el ajuste**. En Eolo-plus
`importe` no se guarda: se deriva de precio, cantidad, margen y ajuste, que el
renglón congeló al capturarse. El error desaparece por construcción, no por
cuidado.

## Alcance

**Entra:**

- Registrar y quitar pagos de una prefactura en borrador, con las reglas por forma
  de pago.
- El pago Amex con su renglón de comisión.
- Las tres notas (interna, externa, de factura).
- La cortesía: dejar de cobrar un renglón sin borrarlo, y revertirlo.
- El aviso al cerrar cuando los pagos no cubren el total.
- Un comando que **solo lee** y compara los 3,534 pagos y las 733 comisiones del
  histórico contra lo que calcula este bloque.

**No entra:**

- **El PDF** (bloque 4). Las notas y los pagos se guardan aquí; imprimirlos es del 4.
- **El descuento** (`aplicar_descuento.php`, renglones negativos, 10 veces en el
  histórico). Mete importes negativos, para los que el bloque 2 dejó el redondeo
  del IVA expresamente sin definir y cuyo precio exige `min:0`. Va al bloque 5 con
  su propio diseño.
- **La agrupación y el ajuste de estancia** (bloque 5).
- **Importar el histórico** (bloque 6). Este bloque le da tabla a pagos y notas,
  que es lo que lo desbloquea.
- **Cobrar una prefactura cerrada.** Decidido: los pagos se congelan al cerrar,
  como los renglones y los totales.

## Decisiones tomadas

Las cinco primeras las decidió el usuario el 2026-10-02; las demás se derivan de
los hechos medidos.

1. **Cerrar sin cobro: avisar y dejar cerrar.** No se bloquea, pero no es
   silencioso.
2. **Los pagos solo se registran en borrador.** Al cerrar quedan congelados, igual
   que los renglones y los totales. Un documento emitido no cambia.
3. **La cortesía entra en este bloque** (130 usos, es trabajo diario). **El
   descuento va al 5** (10 usos, y arrastra los negativos).
4. **Las notas son tres columnas en `fact_prefacturas`**, no una tabla: el viejo ya
   es uno-a-uno.
5. **El cambio se deriva.**
6. **La comisión Amex se redondea a dos decimales** al crear el renglón. El viejo
   la guarda sin redondear en un `float` y la suma así, por lo que el total puede
   quedar **un centavo** por debajo de lo que se tecleó. Se elige el redondeo
   porque el renglón es dinero que el cliente ve impreso, y un precio con cuatro
   decimales en el PDF es peor que un centavo. El comando de comparación lo mide y
   lo reporta en lugar de esconderlo.
7. **Borrar un pago Amex borra la comisión que ese pago creó**, no todas las de la
   prefactura, que es lo que hace `eliminar_f.php`.

## Arquitectura

### Datos

**Tabla nueva `fact_prefactura_pagos`:**

| Columna | Tipo | Nota |
|---|---|---|
| `id` | id | |
| `prefactura_id` | foreignId → `fact_prefacturas` | `cascadeOnDelete` |
| `forma_pago_id` | foreignId → `fact_formas_pago` | del catálogo del 1b; `restrictOnDelete` |
| `monto` | `decimal(12,2)` | mismo tipo que los totales del bloque 2 |
| `renglon_comision_id` | foreignId → `fact_prefactura_renglones`, nullable | solo Amex: el renglón que este pago creó, para poder quitarlo. `nullOnDelete`: si el renglón se va por otra vía, el pago sobrevive sin referencia colgada |
| `user_id` | foreignId → `users` | quién lo registró |
| `status` | `char(1)` default `'A'` | baja lógica, como el resto del módulo |
| `timestamps` | | |

**Columnas nuevas en `fact_prefacturas`:** `nota_interna varchar(200) nullable`,
`nota_externa varchar(200) nullable`, `nota_factura varchar(100) nullable`. Los
largos son los del origen.

**Columna nueva en `fact_prefactura_renglones`:** `es_cortesia boolean default
false`.

El viejo marca la cortesía escribiendo `'cortesia'` en `remision`, que es **el
mismo campo** donde van los números de remisión reales (`HANDLING`, `9226`,
`000015`…). Separarlo arregla esa ambigüedad: `remision` sigue siendo la remisión,
y la cortesía tiene su propia columna.

**Tres migraciones aditivas**, numeradas después de las del bloque 2 y **antes**
de `2026_09_29_099000_add_unique_matricula_to_aeronaves.php`, que
`MatriculaUnicaTest` exige que siga siendo la última. Se fechan `2026_09_29_093000`,
`093100` y `093200` por eso: la tabla de pagos, las tres notas y `es_cortesia`.

### El dinero

**`App\Support\ComisionAmex`** — la fórmula, en un solo lugar, al lado de
`ImporteServicio`:

```php
/**
 * El 6% de la base que implica el monto bruto cargado a la tarjeta.
 *
 * El viejo escribe `monto * 0.06 / 1.2296`, y 1.2296 es 1.16 × 1.06 precalculado.
 * Aquí la tasa de IVA se lee en lugar de fijarse: con 16% da el mismo número que
 * las 765 comisiones del histórico, y sobrevive a un cambio de tasa.
 */
public static function calcular(string $montoBruto, string $tasaIva): string
```

Aritmética de cadenas con `bc`, como el resto del camino del dinero del bloque 2.
Redondeo de medio centavo hacia arriba con la misma forma que
`FactPrefactura::calcularIva()`: `bcadd(bcmul(..., 6), '0.005', 2)` — **nunca**
`bcmul(..., 2)` a secas, que trunca.

**El importe de un renglón de cortesía es `'0.00'`.** La comprobación va en
`FactPrefacturaRenglon::importe()`, que es lo único que conoce la fila, y **no** en
`ImporteServicio::calcular()`, que es la fórmula compartida y no debe saber de
cortesías. Los campos congelados del renglón no se tocan, así que quitar la
cortesía devuelve el importe exacto, con su margen y su ajuste.

### Servicios

**`App\Services\PagosPrefactura`** — registrar y quitar, cada operación con
`lockForUpdate()` sobre la prefactura y rechazando una cerrada, igual que
`CargosEstancia` del bloque 2. Las reglas por forma de pago viven aquí:

| Forma | Regla |
|---|---|
| Efectivo | Puede exceder lo que falta; el exceso es cambio |
| AvCard by WFS | **Rechazada si la prefactura tiene un renglón con concepto combustible.** Sin tope de monto, como el viejo: puede dejar la prefactura sobrepagada, y entonces la pantalla avisa que se cobró de más |
| Amex | Por `registrarAmex()`, que además crea el renglón de comisión |
| Visa, Mastercard, Transferencia, Tarjeta Remota | Rechazada si el monto supera lo que falta por cobrar |

`registrarAmex()` rechaza con un mensaje propio cuando el bruto tecleado supera el
subtotal, como hace `mpamex.php` («La comisión supera el monto del subtotal»).

El combustible se detecta por **concepto**, no por id: `FactServicio::CONCEPTO_COMBUSTIBLE`
existe desde el bloque 2 justo para no depender del `id_servicio = 7` del viejo.

**`CierrePrefactura::cerrar()`** gana un parámetro: sin confirmación explícita,
cuando los pagos no cubren el total lanza `PrefacturaSinCobroException` con cuánto
falta. Con confirmación, cierra. La comprobación va **dentro del candado que ya
tiene**, con las otras tres (cerrada, descartada, sin cliente).

Toda escritura queda en `Bitacora`, **dentro de la transacción**, como el bloque 2.

### HTTP

Todos bajo `subdep:factPrefacturas`, el mismo del bloque 2.

| Verbo y ruta | Qué hace |
|---|---|
| `POST /api/facturacion/prefacturas/{id}/pagos` | Registra un pago no-Amex |
| `POST /api/facturacion/prefacturas/{id}/pagos/amex` | Registra el pago Amex y su comisión |
| `DELETE /api/facturacion/prefacturas/{id}/pagos/{pago}` | Lo quita, y con él su comisión si la creó |
| `PATCH /api/facturacion/prefacturas/{id}/notas` | Las tres notas de una vez |
| `PATCH /api/facturacion/prefacturas/{id}/renglones/{renglon}/cortesia` | Marca o desmarca |
| `PATCH /api/facturacion/prefacturas/{id}/cerrar` | Acepta `confirmar_sin_cobro` |

Códigos de error, siguiendo el patrón del bloque 2 (un `codigo` propio junto al
mensaje en español): `ya_cerrada` (409), `ya_descartada` (409),
`avcard_con_combustible` (422), `supera_lo_que_falta` (422),
`comision_supera_subtotal` (422), `sin_cobro` (422, solo al cerrar sin confirmar).

La ficha de la prefactura (`show`) gana `pagos`, `pagado`, `por_cobrar` y
`sobrepago`, todos como cadenas, como los totales del bloque 2, más un booleano
`sobrepago_es_cambio` que dice si hay un pago en efectivo detrás.

### Pantalla

**No hay pantalla nueva.** `EditorPrefactura.tsx` gana tres cosas:

- Un panel de **cobro**: las formas de pago, lo pagado, lo que falta, y el cambio
  o el aviso de cobrado de más según corresponda;
  botón de agregar y de quitar. El de Amex abre su propio diálogo, que explica que
  el monto es **lo que se carga a la tarjeta** y muestra la comisión que va a
  agregar antes de confirmarla.
- Un panel de **notas**, con las tres y sus largos.
- Un **interruptor de cortesía** por renglón, que deja el renglón visible con
  importe 0 y una marca.

El diálogo de cierre que ya existe muestra cuánto falta por cobrar cuando falta, y
exige confirmarlo.

## Verificación

**`php artisan facturacion:comparar-pagos`** — **solo lee**, como el del bloque 2,
y lo fijan pruebas que cuentan las escrituras. Compara:

- **Los 3,534 pagos**: que cada uno se pueda representar y que la suma por folio
  coincida con la del origen.
- **Las 733 comisiones Amex**: la comisión calculada contra la guardada, al
  centavo, separando las 765 que siguen la fórmula de las 5 de la segunda rama y
  las 11 irreconciliables, en lugar de meterlas en un solo número.
- **El sobrepago derivado** contra el `Cambio` guardado, que se sabe mal **en las
  dos direcciones**: de los 27 folios sobrepagados, 15 tienen `Cambio` distinto de
  cero y **12 lo tienen en cero**; y de los 18 folios con `Cambio` distinto de cero,
  **3 no están sobrepagados**. El comando reporta las dos listas por separado, para
  que el bloque 6 sepa qué está importando.

Las etiquetas de la salida son **distintas por concepto**. El bloque 2 aprendió por
qué: una desviación de un centavo en el IVA pasó 19 pruebas porque el IVA y el
total compartían etiqueta.

**Pruebas:** Pest sobre sqlite, en serie (`--parallel` da 22 fallos falsos ajenos
en esta máquina). Cubren las reglas de cada forma de pago, la fórmula de la
comisión contra valores del histórico, el borrado del pago Amex y su comisión, la
cortesía ida y vuelta conservando el margen, el aviso al cerrar, y que una cerrada
rechaza todo lo anterior.

**Lo que sqlite no prueba:** ignora `lockForUpdate()`, así que la concurrencia de
los pagos queda verificada solo por lectura. Va a la lista de comprobaciones contra
MySQL real de la guía de despliegue, donde el bloque 2 ya puso el candado del cierre
y el de los cargos de estancia.

## Restricciones globales

Heredadas del bloque 2 y vigentes:

- **Ningún cobro existente puede cambiar.** `precio_unitario` es `decimal(10,4)`;
  `subtotal`, `iva`, `total`, `importe` y `monto` son `decimal(12,2)`. Ningún
  `float` en el camino del dinero.
- **Cada fórmula de dinero vive en un solo lugar:** `ImporteServicio::calcular()`
  el importe, `FactPrefactura::calcularIva()` el IVA, y ahora
  `ComisionAmex::calcular()` la comisión. Sin copias.
- **Nunca `increment()`, `decrement()` ni escrituras masivas sobre renglones:** no
  disparan `saving` y se saltan la guarda de la prefactura cerrada.
- **Toda escritura en `Bitacora`, dentro de la transacción.**
- **Todo lo visible, en español.**
- La suite se corre **en serie**.
- El único error aceptable de `npx tsc --noEmit` es el preexistente
  `resources/js/actions/App/Http/Controllers/Api/WalkAroundController.ts(905,5)`.

## Lo que este bloque deja abierto

- **Imprimir** (bloque 4). Sin PDF el departamento no puede dejar el sistema viejo.
- **Cobrar una prefactura cerrada.** Decidido que no, pero el departamento todavía
  no lo ha probado; las 289 cerradas sin pago sugieren que en algún sitio se cobra
  después. Si en las pruebas resulta que hace falta, añadirlo es agregar, no
  deshacer.
- **Los 5 folios de la segunda rama de la comisión Amex y los 11 irreconciliables.**
  El comando los nombra uno por uno; qué hacer con ellos es decisión del bloque 6,
  cuando se importen.
- **El descuento** (bloque 5) y con él la pregunta que el bloque 2 dejó escrita: el
  redondeo del IVA no está definido para subtotales negativos (el viejo redondea
  lejos del cero, nosotros truncamos hacia el cero).
