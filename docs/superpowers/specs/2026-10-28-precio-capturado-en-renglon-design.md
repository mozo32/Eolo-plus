# El precio de un renglón se puede teclear al agregarlo

**Fecha:** 2026-10-28
**Módulo:** Facturación (prefacturas), modal «Agregar servicio»
**Estado:** aprobado en conversación, pendiente de plan
**Precedentes:** `2026-10-26-facturacion-remisiones-de-combustible-design.md`,
`2026-10-27-prefactura-comisariatos-design.md`

## Por qué

Pedido tal cual: «cuando le doy al botón de agregar servicio, en Vista previa
del importe quiero que se pueda editar».

La vista previa no se edita: es el resultado. Lo que se vuelve editable es el
**precio unitario**, y la vista previa recalcula. Se eligió así sobre las otras
dos formas —despejar el precio a partir del importe, o guardar el importe tal
cual en una columna nueva— porque es la única exacta siempre: un importe
tecleado no siempre es alcanzable al centavo con el margen, el ajuste y la
cantidad de ese renglón, y guardarlo tal cual dejaría el importe sin derivar y
el margen de adorno.

**Y la medición le da otro sentido al pedido.** De los **54** servicios activos
del catálogo, **20 tienen precio 0**. Cinco son proveedores de comisariato, uno
es la comisión AMEX y dos son ajustes de estancia: esos toman su precio de otro
registro y funcionan. Los otros **doce no se pueden cobrar en absoluto** hoy, su
renglón saldría en $0.00:

Agua Potable · Ground Power Unit 28V · Ground Power Unit 115V · Lavado de
vajilla · PRIST · Recarga de oxígeno · Recarga de nitrógeno · Transportación
Terrestre Tercero · Otros Servicios · Otros_Servicios_con_comision ·
Otros_Servicios_sin_comision · Participación Aeroportuaria

La confirmación: de los **117** renglones vivos, **ninguno** tiene precio 0.
Esos doce servicios están en el catálogo y nunca se han usado. Son servicios
cuyo precio es por evento —el agua, el oxígeno, una transportación— y el
catálogo no puede saberlo de antemano.

Así que esto no es «poder cambiar precios». Es que doce servicios del catálogo
están muertos y la única forma de cobrarlos hoy sería crear un servicio nuevo
con ese precio cada vez.

## Lo que esto rompe, y es una decisión tomada

Hasta hoy **el navegador no manda ninguna cifra de dinero**.
`StoreRenglonRequest` acepta servicio, cantidad, proveedor, remisión,
comisariato y matrícula, y nada más; el precio lo pone el servidor desde uno de
cuatro registros. La pantalla lo dice: «Las cifras las calcula el sistema; esta
pantalla no suma nada».

Esta spec rompe ese invariante a propósito. Se preguntó si el precio sería
editable solo en el servicio del catálogo o **en los cuatro casos**, con el
coste de cada opción escrito, y la respuesta fue **en los cuatro**. El coste
aceptado: un renglón nacido de una remisión o de un comisariato puede quedar
con un precio que ya no coincide con el registro del que nació, y ese registro
sigue marcado como cobrado. Sirve para cobrar bien hoy cuando el precio se
capturó mal en Rampa o en Tráfico, sin esperar la corrección.

De ahí sale la columna `precio_capturado`: es lo que hace soportable esa
decisión, porque deja rastro de que la cifra se tecleó.

## Decisiones tomadas

1. **Se edita el precio unitario, no el importe.** El importe sigue sin columna
   y sigue derivándose en `App\Support\ImporteServicio`.
2. **Editable en los cuatro casos**: servicio del catálogo, combustible con
   remisión, comisariato elegido y tránsito ajeno.
3. **El precio sustituye SOLO al precio.** El margen, el ajuste,
   `es_de_tercero`, el concepto y la cantidad conservan su regla actual en cada
   caso: con remisión siguen en 0 y «ninguno» y la cantidad sigue siendo los
   litros de la carga; con comisariato siguen saliendo del proveedor; en
   tránsito ajeno siguen en 0; del catálogo, los del servicio.
4. **El campo llega precargado** con el precio que hoy aplicaría. No tocarlo
   produce un renglón **idéntico** al de hoy. La función es opcional renglón a
   renglón, no un modo nuevo.
5. **El catálogo nunca se escribe desde aquí.** Teclear 1,050 en un renglón no
   cambia `fact_servicios`. Para eso está la pantalla de servicios.

## Los datos

**Columna nueva `precio_capturado`** en `fact_prefactura_renglones`: booleano,
`false` por omisión. Ninguna columna de esa tabla choca con ese nombre.

Se pone en verdadero **solo cuando el precio que llega difiere** del que habría
aplicado sin él. Teclear el mismo número que ya estaba no es capturar un
precio.

**Contra qué se compara**, caso por caso, porque de esto no puede quedar duda:

| caso | el precio que habría aplicado |
|---|---|
| servicio del catálogo | `fact_servicios.precio_unitario` del servicio elegido |
| combustible con remisión | `remisiones.precio` de la remisión elegida |
| comisariato elegido | `servicio_comisariatos.subtotal` del comisariato |
| tránsito ajeno | la tarifa efectiva del tramo de esa aeronave |

**Con qué precisión:** la comparación es **numérica a 4 decimales**, no de
texto. Teclear `500` cuando el catálogo dice `500.0000` es el mismo precio y
`precio_capturado` queda en falso. Comparar las cadenas marcaría ese renglón y
la marca dejaría de significar nada.

La migración **no crea índices**: es una columna booleana y se consulta por
renglón, nunca por este campo. Aun así, cualquier identificador que genere se
comprueba por debajo de los **64 caracteres** que admite MySQL: a la tabla de
exclusiones de remisiones se le pasó de 69 y la migración falló entera contra
la base real, porque las pruebas corren en sqlite, que no tiene ese límite.

**No hay relleno que ejecutar.** La columna nace en falso y eso es la verdad de
los 117 renglones existentes: ninguno se capturó a mano, porque hasta hoy no se
podía.

## El servidor

`StoreRenglonRequest` acepta `precio_unitario` **opcional**:
`['nullable', 'numeric', 'min:0', 'max:999999.9999']` más la comprobación de
que no trae más de **4 decimales**, que es lo que guarda la columna
(`decimal(10,4)`). Sin él, el camino actual no cambia ni una línea: esa es la
prueba que más importa de todo este trabajo.

El controlador lo aplica en los dos sitios donde hoy nace un renglón:

- En el `create([...])` de `PrefacturaRenglonController::store()`, sustituyendo
  la expresión que elige entre el precio de la remisión, el del tránsito ajeno
  y el del catálogo.
- En `App\Services\RenglonDeComisariato::atributos()`, que es el ÚNICO sitio
  donde se arma un renglón de comisariato y lo usan las dos vías, la manual y
  la automática. Recibe el precio como parámetro opcional; **la vía automática
  no le pasa ninguno**, así que sigue tomando el subtotal del comisariato.

Un precio por encima del máximo, negativo o con cinco decimales se rechaza con
422 y su mensaje por campo, como el resto del formulario.

**La bitácora lo dice.** La línea que ya se escribe al agregar un renglón
añade, solo cuando `precio_capturado` es verdadero, con qué precio se cobró y
cuál habría sido: «precio capturado a mano: 1050.0000 en vez de 500.0000». Sin
esa línea, el «en todos» de la decisión 2 sería un cambio de dinero sin rastro.

## La pantalla

**En el modal**, un campo PRECIO UNITARIO encima de la cantidad, precargado con
el precio que aplica. La validación y los límites son los que ya usa
`ModalServicio` para el precio de un servicio del catálogo —`OPCIONES_PRECIO`
con `decimales: 4`, `minimo: 0`, `maximo: PRECIO_SERVICIO_MAX`, vía
`validarMonto`—, reutilizados y no reescritos.

En los tres casos en que el precio viene de otro registro, debajo del campo se
dice de dónde venía: «La remisión EOLO-9401 trae 25.9940», «El comisariato trae
500.00», «La tarifa de XB-AMZ es 1,200.00». Y si el valor tecleado difiere, se
avisa en ese mismo sitio de que el registro de origen quedará marcado como
cobrado con otro precio.

**La vista previa sigue siendo vista previa**: se calcula con el precio del
campo y el margen y el ajuste que apliquen, y la cifra que cuenta la sigue
calculando el servidor. El texto que ya lo dice no cambia.

**En la tabla de renglones**, un renglón con `precio_capturado` se marca, igual
que hoy se marcan la cortesía y los cargos de estancia. Quien revisa el
documento tiene que poder ver qué cifra no salió de un catálogo.

## Qué NO cambia

- **El importe no gana columna** y sigue derivándose.
- **Cortesía, sellado al cerrar, la regla de AvCard y el PDF** siguen leyendo
  `importe()` sin enterarse de nada.
- **Un renglón sigue sin poder editarse** después de agregado: para corregir el
  precio se quita y se vuelve a agregar, igual que con la cantidad hoy.
- **Las prefacturas cerradas, descartadas y reabiertas** se comportan igual: la
  guarda de `rechazoRapido()` corre antes de todo esto.
- **La vía automática** de remisiones y comisariatos no recibe precio y no
  cambia.
- **El catálogo**, que no se escribe desde aquí.

## Pruebas

- **Sin `precio_unitario` en la petición, el renglón sale idéntico al de hoy**,
  en los cuatro casos: catálogo, remisión, comisariato y tránsito ajeno. Campo
  por campo, no solo el importe.
- Con precio, el renglón lo guarda y el importe lo sigue: en los cuatro casos.
- El margen, el ajuste, `es_de_tercero`, el concepto y la cantidad **no se
  mueven** al teclear un precio. En combustible la cantidad sigue siendo los
  litros de la remisión, no lo que venga en la petición.
- Los límites: negativo, por encima del máximo y con cinco decimales se
  rechazan con 422; 0 se acepta; los 4 decimales se guardan sin perderse.
- `precio_capturado` en verdadero solo cuando el precio **difiere**; teclear el
  mismo número lo deja en falso.
- La vía automática de comisariatos sigue tomando el subtotal: `atributos()`
  sin precio no cambia nada.
- La remisión se sigue marcando y su exclusión se sigue revocando al agregarla
  con precio tecleado; el guardia de doble cobro del comisariato sigue igual.
- Una prefactura cerrada, descartada o reabierta sigue rechazando el alta.
- Los identificadores de la migración, por debajo de 64 caracteres.

Las pruebas corren **en serie**, nunca con `--parallel`, sobre sqlite en
memoria. Del front no hay lanzador: la evidencia es `npm run build` en 0 más
`npx tsc --noEmit` contra su línea base, y comprobación en el navegador.

## Riesgos conocidos

**El renglón puede contradecir el registro del que nació.** Es el coste
aceptado de la decisión 2 y el riesgo principal. La columna `precio_capturado`
y la línea de bitácora son el rastro; no lo evitan.

**El precio capturado no se puede corregir sin quitar el renglón.** Es
coherente con la cantidad, que ya funciona así, pero con el precio editable se
va a tropezar más seguido. Si molesta, editar un renglón es otro trabajo.

**Ya no hay una sola fuente de verdad del precio.** Hasta hoy, ver un renglón
raro llevaba a un registro que lo explicaba. Con esto, a veces la explicación
es «alguien lo tecleó», y la única forma de saberlo es la marca y la bitácora.
Por eso ninguna de las dos es opcional.
