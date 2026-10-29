# El descuento de estancia, y las acciones del renglón en icono

**Fecha:** 2026-10-28
**Módulo:** Facturación (prefacturas), tabla de renglones del editor
**Estado:** aprobado en conversación, pendiente de plan
**Precedentes:** `2026-10-28-precio-capturado-en-renglon-design.md`,
`2026-10-27-prefactura-comisariatos-design.md`

## Por qué

Pedido tal cual: «en el sistema viejo había opciones en los servicios que se
agregaban como eliminar, cortesía, agrupar y descuento en sus tránsitos, quiero
que también se los apliques esos funciones al sistema nuevo y solo necesita su
icono para que no ocupe espacio».

**Tres de las cuatro ya existen** en el editor de prefacturas: quitar el
renglón (`destroy`), la cortesía (`cortesia`) y agrupar / cambiar grupo /
desagrupar (`grupo`). Lo que falta es **el descuento**, y lo que sobra es el
texto de los botones: en el sistema viejo la fila llevaba cuatro iconos pelones
(`prefactura.php`, líneas 527-545: `fa-trash`, `fa-pen-to-square`, `fa fa-gift`
y el botón amarillo del descuento) y aquí tres de los cuatro botones llevan la
palabra escrita al lado.

**Qué era el descuento del viejo**, leído en `obtener_datos_modal.php` y
`aplicar_descuento.php` y no supuesto: un modal con exactamente tres conceptos
—Tránsito 2 Horas, Tránsito 12 Horas y Pernocta—, cada uno con la tarifa de esa
matrícula (`tb_transito2h`, `tb_transito12h`, `tb_pernocta`). Por cada concepto
marcado insertaba un renglón nuevo con `precio_u` e `importe` en
`-abs($importe)`, `cantidad` 1, `remision = 'Cortesía'` y el `agrupar` heredado
del renglón desde el que se abrió. Sin tope, sin comprobar que ese concepto se
cobrara, y repetible.

**La medición pone el tamaño del trabajo.** De los **10,587** renglones
históricos de `tb_venta`, solo **10** son negativos. Seis vienen de ese botón
(servicios 2, 3 y 4: Tránsito 02 hrs, Tránsito 12 hrs y Tránsito 24 hrs -
pernocta), todos con `remision = 'Cortesía'`. Los otros **cuatro** los teclearon
a mano sobre «Otros_Servicios_sin_comision» con la remisión «SaldoaFavor»: un
saldo a favor, que es otra cosa y **no entra en esta spec**.

Seis usos en toda la vida del sistema. Eso pide la versión más simple que
funcione, no un motor de descuentos.

## Decisiones tomadas

Las cinco se preguntaron con su coste escrito y estas son las respuestas.

1. **Solo estancia.** El descuento se aplica a pernocta, tránsito de 2 h y
   tránsito de 12 h, como el viejo. No es un descuento general sobre cualquier
   renglón.
2. **El importe sale de la tarifa de la matrícula, como el viejo**: los tres
   conceptos siempre, una unidad de tarifa, **sin tope y sin impedir
   repetirlo**. Se eligió sobre la opción con tope —que solo habría ofrecido los
   conceptos que esa prefactura cobra de verdad, limitada a lo que cobra— con
   el coste dicho: se puede descontar un tránsito que no se cobró, y se puede
   descontar tres veces el mismo. La bitácora es el rastro; no es el freno.
3. **El descuento sobrevive al recálculo de estancia, y si el concepto
   descontado ya no se cobra, el recálculo lo retira y lo nombra** en el mismo
   aviso donde hoy se dicen las cortesías perdidas.
4. **El icono vive en cada renglón de tránsito y pernocta.** Se eligió sobre un
   icono único arriba de la tabla, con el coste dicho: se abre desde la fila de
   pernocta y el modal ofrece los tres conceptos, la misma incoherencia del
   viejo. Se reduce sin contradecir la decisión: **el concepto de la fila desde
   la que se abrió llega premarcado**.
5. **En el documento sale como renglón propio etiquetado «Descuento …»**, no
   repitiendo el nombre del concepto como el viejo, y no oculto.

Y la que no se preguntó porque es la petición misma: **los botones de cortesía,
agrupar y desagrupar pierden su texto** y se quedan en icono.

## Los datos

**No hay columna nueva y no hay migración.** El descuento es un renglón más de
`fact_prefactura_renglones`, y lo que lo distingue es su `concepto`.

Las dos comprobaciones del esquema, hechas contra la base real y no supuestas:

- `precio_unitario` es `decimal(10,4)` **con signo**: un precio negativo cabe.
- `cantidad` es `int unsigned`: el signo va en el precio, exactamente como en el
  viejo. No se intenta una cantidad negativa.

Un renglón por concepto marcado:

| columna | valor |
|---|---|
| `servicio_id` | el servicio **activo** de ese concepto de estancia (`FactServicio::porConcepto(...)->activos()->first()`), igual que el viejo, que insertaba el mismo `id_servicio` |
| `nombre_servicio` | «Descuento pernocta» · «Descuento tránsito de 2 horas» · «Descuento tránsito de 12 horas» |
| `precio_unitario` | la tarifa de la matrícula en negativo, congelada como cadena decimal |
| `cantidad` | 1 |
| `concepto` | `descuento_estancia_pernocta` · `descuento_estancia_transito_2h` · `descuento_estancia_transito_12h` |
| `margen` / `ajuste_precio` | 0 y `ninguno` |
| `es_de_tercero` | falso |
| `es_cortesia` | **falso**: marcarlo dejaría el importe en 0 y anularía el descuento |
| `grupo` | el del renglón desde el que se abrió el modal, como el viejo |
| `orden` | después del cargo que descuenta |

**El `servicio_id` apunta al servicio de estancia aunque el `concepto` del
renglón diga «descuento».** Se comprobó que nadie lee `$renglon->servicio->concepto`:
las tres lecturas de `$servicio->concepto` que existen son del servicio del
catálogo al dar de alta un renglón, no del renglón ya guardado. La alternativa
—un servicio nuevo «Descuento de estancia» en el catálogo— exige una fila de
catálogo que hoy se importa del sistema viejo, y eso es una decisión de negocio
que esta spec no toma.

**Los tres nombres de concepto miden 27, 30 y 31 caracteres y la columna es
`varchar(32)`.** Va con prueba: un cuarto nombre ya no cabría, y en sqlite —donde
corren las pruebas— no fallaría. Es la misma trampa que tumbó la migración de
exclusiones de remisiones, que pasó de los 64 caracteres de un identificador de
MySQL y falló entera contra la base real.

**Ninguno de los tres conceptos entra en `FactServicio::CONCEPTOS_ESTANCIA`.**
Eso es lo que hace que el descuento sobreviva al recálculo sin tocar el borrado
masivo: `CargosEstancia` borra `whereIn('concepto', CONCEPTOS_ESTANCIA)` y estos
no están ahí. La lista se amplía con una constante nueva propia,
`CONCEPTOS_DESCUENTO_ESTANCIA`, y el mapa de concepto de estancia a concepto de
descuento vive en un solo sitio.

## El servidor

Endpoint propio, porque no es dar de alta un servicio:

```
POST /api/facturacion/prefacturas/{id}/descuentos-estancia
{ "renglon_id": 412, "conceptos": ["estancia_pernocta", "estancia_transito_12h"] }
```

Se piden los conceptos **de estancia** que se perdonan, no los de descuento: es
lo que el modal tiene en la mano y lo que el usuario entiende. El servidor
traduce.

`renglon_id` es el renglón de estancia desde cuyo icono se abrió el modal, y
está porque la decisión 4 lo necesita: **de él se hereda el `grupo`**. Es
obligatorio, tiene que ser un renglón **de esta prefactura** y su `concepto`
tiene que ser uno de los tres de estancia; cualquier otra cosa es 422. Sin ese
dato el descuento no sabría en qué grupo nacer, y el modal solo se abre desde
una de esas filas.

Form Request propio. `conceptos` es una lista obligatoria de al menos uno, cada
valor dentro de los tres permitidos (`Rule::in`), **sin repetidos** (`distinct`).
Una lista vacía, un concepto de los dos ajustes de estancia, un concepto
inventado o un repetido se rechazan con 422 y su mensaje por campo.

El `orden` de cada descuento es el del renglón que cobra ese concepto más uno,
cuando ese renglón existe; cuando no existe —porque la decisión 2 permite
descontar algo que no se cobra— es el máximo de la prefactura más uno, que es lo
que ya hace `CargosEstancia` cuando no encuentra un orden previo.

**Las tarifas que el modal muestra tienen su propio endpoint de solo lectura**,
`GET /api/facturacion/prefacturas/{id}/tarifas-estancia`, que devuelve las tres
(`pernocta`, `transito_2h`, `transito_12h`) tal como las resuelve
`FactAeronave`, con `null` cuando no hay. Hace falta porque `show()` carga la
aeronave con `id, matricula` y nada más: hoy la pantalla no tiene las tarifas.
Sigue el precedente de `estanciaSugerida()`, que ya existe para rellenar un
formulario sin escribir nada. **No es la autoridad de la cifra**: al aplicar, el
servidor vuelve a leer la tarifa y es esa la que se congela en el renglón.

Las guardas son las que ya tienen las demás acciones de renglón, en el mismo
orden: `rechazoRapido()` para cerrada, `rechazarSiDescartada()`, el candado de
fila y la transacción. Una prefactura cerrada, descartada o tocada por otra
sesión se rechaza igual que hoy.

**Sin tarifa no hay descuento.** Si la matrícula no tiene ficha de facturación,
o `tarifaPernocta()` / `tarifaTransito2h()` / `tarifaTransito12h()` devuelven
`null` para el concepto pedido (son `?string` y caen a la categoría cuando la
ficha no la fija), se responde 422 **nombrando el concepto** y no se escribe
nada. Teclear la cifra a mano no es lo que se eligió en la decisión 2.

**La bitácora es obligatoria, una línea por descuento**, con la cifra completa y
formateada: «Se aplicó un descuento de pernocta por 2,009.00 a la prefactura
37.» Sin tope ni límite de repetición, la bitácora es el único rastro de por qué
el documento bajó; y una frase de dinero que se puede invertir sin romper su
prueba es una frase que miente en verde, así que se asierta entera.

**Quitar un descuento ya funciona.** `destroy()` no tiene guarda por concepto:
el renglón de descuento se quita con el bote de basura que ya está en su fila,
sin endpoint nuevo.

## El recálculo de estancia

`CargosEstancia::sincronizar()` lee el orden y las cortesías **antes** de borrar,
borra los conceptos de estancia, recrea los que tienen cantidad y tarifa, y
arma un `motivo` que ya dice qué cortesías se conservaron y qué cortesías se
perdieron. El descuento se engancha en ese mismo sitio y con esa misma forma:

- Sobrevive solo, porque su concepto no está en la lista que se borra.
- Al terminar de recrear, un descuento cuyo concepto de estancia **no quedó
  cobrado** en esta pasada —cantidad 0, sin tarifa, aeronave en Guarda, matrícula
  sin ficha— **se retira**, y se nombra en el `motivo`, junto a las cortesías
  perdidas.

Ese `motivo` ya viaja a la pantalla y ya se muestra en el diálogo de «Recalcular
estancia» y al guardar el encabezado. No hay plomería nueva.

Los dos caminos de salida temprana de `sincronizar()` —la matrícula sin ficha y
la aeronave en Guarda— quitan la estancia y devuelven antes de llegar a la
creación. Los descuentos también se retiran ahí, con su nombre en el aviso: una
aeronave en Guarda no paga estancia, así que tampoco tiene nada que descontar.

## La pantalla

**Los cuatro iconos de la fila.** Cortesía, agrupar / cambiar grupo y desagrupar
pierden su texto y quedan en icono de 16 px, como el bote de Quitar que ya está
así. Lo que **no** se pierde:

- El `title` y el `aria-label` que cada botón ya tiene. Sin el texto, son lo
  único que dice qué hace el botón, y el `aria-label` es lo único que lo dice a
  quien usa un lector de pantalla.
- El estado visible en el color: cortesía puesta en verde, grupo puesto en
  índigo, igual que hoy.
- `aria-pressed` en el de cortesía, que ya está.

**El icono del descuento** es `TicketPercent` de `lucide-react` (comprobado que
existe en la versión instalada, 0.475.0, igual que `Gift`, `Group`, `Ungroup` y
`Trash2`, que ya se usan). Aparece **solo** en los renglones cuyo `concepto` es
`estancia_pernocta`, `estancia_transito_2h` o `estancia_transito_12h`. **No** en
los dos ajustes de estancia (2 h → 12 h y 12 h → pernocta): el viejo tampoco los
ofrecía. Es una exclusión deliberada, no un olvido, y ampliarla es añadir dos
valores a una lista.

**El modal** lista los tres conceptos con la tarifa de esa matrícula —pedidas al
abrirlo con `GET tarifas-estancia`— y el concepto de la fila desde la que se
abrió ya marcado. Marcas los que perdonas y aplicas, y la petición lleva el
`renglon_id` de esa fila. Un concepto cuya tarifa viene en `null` se muestra
deshabilitado y dice por qué, en lugar de dejar que el servidor responda 422
después del clic.

El modal reutiliza el formato de dinero de la pantalla (`formatearMonto`) y no
escribe cifras a mano.

## El documento y los totales

`DocumentoDePrefactura::filas()` usa `nombre_servicio` como concepto de la fila,
así que la línea sale **«Descuento tránsito de 12 horas  −3,014.00» sin tocar el
documento ni la vista del PDF**.

El subtotal, el IVA y el total se derivan con `bcadd` y `bccomp`: un importe
negativo resta y el IVA baja en proporción. No hay nada que cambiar en los
totales.

`ComisionAmex` ya contempla esto: su PHPDoc dice que con un monto negativo
devuelve una comisión negativa y que **quien llame con renglones de descuento
debe validarlo fuera**. Esta spec no cambia el cálculo de la comisión Amex, que
se computa sobre el monto del pago y no sobre los renglones.

**Dentro de un grupo el descuento se suma al importe del grupo y deja de verse
como línea**, igual que una cortesía agrupada. No se bloquea: heredar el grupo
del renglón es lo que hacía el viejo y la decisión 4 lo mantiene.

## Qué NO cambia

- **No hay migración** y ninguna columna nace.
- **`StoreRenglonRequest` no se toca**: su `precio_unitario` sigue en `min:0`.
  El descuento entra por su propio endpoint, no por el alta de servicios, y la
  pantalla de agregar servicio sigue sin poder teclear un precio negativo.
- **La cortesía, el grupo, el precio capturado a mano y el sellado al cierre**
  siguen exactamente como están.
- **El PDF, `DocumentoDePrefactura` y el sello** no cambian de código.
- **El saldo a favor** —las cuatro líneas negativas que el viejo tecleó sobre
  «Otros_Servicios_sin_comision»— no entra aquí. Es otra práctica y sería otra
  spec.
- **Editar un renglón** sigue sin existir: el lápiz que tenía la fila del viejo
  no está en el pedido y no se añade. Para corregir, se quita y se vuelve a
  agregar.
- **La vía automática** de remisiones y comisariatos no se entera de nada.

## Pruebas

Del servidor:

- Un descuento por cada uno de los tres conceptos: el renglón sale con el precio
  y el importe negativos, la cantidad en 1, `es_cortesia` en falso, y el total
  de la prefactura baja **exactamente** la tarifa.
- Varios conceptos en una sola llamada: entran los dos renglones.
- Repetir el mismo concepto en dos llamadas entra dos veces, y el total baja el
  doble: es la decisión 2 y se fija con una prueba para que nadie «la arregle»
  sin leer esta spec.
- El descuento hereda el `grupo` del renglón desde el que se pidió.
- Sin ficha de facturación y con la tarifa de ese concepto nula: 422 con el
  concepto nombrado en el mensaje y **nada escrito**.
- Lista vacía, concepto inventado, un concepto de ajuste de estancia y un
  concepto repetido: 422 con su mensaje por campo.
- `renglon_id` ausente, inexistente, **de otra prefactura** y de un renglón que
  no es de estancia: 422, y nada escrito. El de otra prefactura importa: es la
  vía por la que alguien podría heredar el grupo de un documento ajeno.
- `GET tarifas-estancia` devuelve las tres tarifas de esa matrícula, `null` en
  la que no existe, y la heredada de la categoría cuando la ficha no la fija
  —que es lo que hace `FactAeronave`— sin escribir nada.
- Prefactura cerrada, descartada y reabierta: se comportan como con las demás
  acciones de renglón.
- La bitácora, asertada por su **frase completa** y con el separador de miles.
- Los tres nombres de concepto por debajo de 32 caracteres.
- `destroy` quita un renglón de descuento y el total vuelve a subir.

Del recálculo, los **dos** caminos:

- El concepto se sigue cobrando: el descuento sigue ahí después de recalcular,
  con su importe intacto.
- El concepto deja de cobrarse (cantidad 0, sin tarifa, Guarda, sin ficha): el
  descuento se retira y **el `motivo` lo nombra**, asertado por su frase
  completa junto al aviso de cortesías perdidas.

Del documento y los totales:

- La fila del documento sale con el nombre «Descuento …» y el importe negativo.
- El subtotal, el IVA y el total de una prefactura con descuento, comparados
  contra la suma a mano.
- **Cerrar una prefactura cuyo total queda negativo**: nunca ha pasado en este
  sistema y la prueba dice qué hace hoy.

Las pruebas corren **en serie**, nunca con `--parallel`, sobre sqlite en
memoria. Del front no hay lanzador: la evidencia es `npm run build` en 0 más
`npx tsc --noEmit` contra su línea base, y comprobación en el navegador de que
los tres botones quedaron sin texto, que el icono de descuento sale solo en las
filas de estancia y que el modal premarca el concepto de su fila.

## Riesgos conocidos

**Sin tope y sin límite de repetición.** Se puede descontar un tránsito que esa
prefactura no cobró, y se puede descontar tres veces el mismo concepto hasta
dejar el documento en negativo. Es el coste aceptado de la decisión 2 y el
riesgo principal. La bitácora y la línea visible en el documento son el rastro;
no lo evitan.

**Cerrar con total negativo no tiene precedente.** Ninguna de las 10 líneas
negativas del sistema viejo dejó un documento negativo, así que nadie sabe qué
hace el cierre ahí. La prueba va incluida precisamente para que salga en la
ejecución y no en producción.

**Un descuento agrupado desaparece como línea** y el cliente deja de ver que se
le perdonó algo. Es coherente con lo que ya le pasa a una cortesía agrupada,
pero con el descuento el importe del grupo baja sin nada que lo explique.

**El `servicio_id` del descuento apunta al servicio de estancia.** Hoy nadie lee
el concepto del servicio a través del renglón, y por eso es seguro; si mañana
alguien lo hace, un descuento se le va a parecer a un cargo de estancia. La
defensa es el `concepto` del renglón, que es lo que todo el módulo ya usa para
distinguir.
