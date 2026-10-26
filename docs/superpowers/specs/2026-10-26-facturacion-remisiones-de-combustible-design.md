# Traer las remisiones de combustible a la prefactura

**Fecha:** 2026-10-26
**Rama:** `facturacion`
**Estado:** diseño aprobado, pendiente de plan de implementación

## Qué resuelve

El combustible se despacha en Rampa y se anota en una **remisión**: matrícula, fecha, horas,
litros y precio. La prefactura se captura en Facturación. Hoy los dos módulos no se hablan, y
alguien tiene que mirar las remisiones en una pantalla y teclear el cargo en la otra.

A partir de ahora la prefactura **busca sola** las remisiones de su matrícula que caen en su
estancia y las agrega como renglones, y el modal de servicios permite **buscarlas y elegirlas a
mano** desde la categoría Combustible & Servicios.

## Lo que ya existe, y por qué importa

### Un enlace, pero al revés

`RemisionController::vincularPrefactura` ya marca una remisión como facturada:

```php
$remision->update([
    'status_prefactura' => true,
    'folio_orden_venta' => $validated['prefactura'],   // texto libre, max 255
]);
```

Se opera **desde Rampa, a mano**, tecleando el folio. **89 de 330 remisiones ya están así.** Lo
que este trabajo añade es la misma unión vista desde el otro lado; las dos vías conviven.

### El folio no existe cuando esto corre

`folio_orden_venta` guarda el folio de la prefactura, y **un borrador no tiene folio**: se asigna
al cerrar. De 27 prefacturas, 7 tienen folio. Reusar esa columna para el enlace nuevo es
imposible, porque en el momento en que se necesita no hay nada que escribir en ella.

### El combustible ya tiene concepto, servicio y una regla de cobro

Un solo servicio en el catálogo: **id 7, «Combustible JET A-1»**, concepto `combustible`,
`es_de_tercero` false, margen 0.00, ajuste `ninguno`, precio $25.9940.

Y `PagosPrefactura` lo consulta para una regla de pago:

```php
if ($prefactura->renglones()->where('concepto', FactServicio::CONCEPTO_COMBUSTIBLE)->exists()) {
    throw new PagoNoPermitidoException("{$forma->nombre} no se puede usar en una prefactura que tiene combustible.", 'avcard_con_combustible');
}
```

**Agregar combustible impide pagar con AVCARD.** Es una regla que viene del sistema viejo, y este
trabajo la hace saltar más a menudo, porque el combustible empieza a entrar solo.

## El dato de hoy

| Medida | Valor |
|---|---|
| Remisiones | 330 |
| …activas (`status = 'A'`) | 327 |
| …ya marcadas como facturadas desde Rampa | 89 |
| …sin precio | 88, **todas anteriores al 2026-05-13** |
| …sin `hora_inicial` | 0 |
| …con litros decimales | 0 |
| Litros de la mayor | 9 129 |
| Productos distintos | 1 — «Turbosina JET A» |
| Matrículas distintas | 93 |
| Prefacturas sin `salida_at` | 16 de 27 |
| Renglones colgando de prefacturas descartadas | 78, de 13 prefacturas |

El precio de la última remisión es **25.9940**, exactamente el `precio_eolo` vigente del catálogo
de facturación. Las viejas traen precios históricos distintos (16.63, 20.08, 19.09).

## Decisiones tomadas

| # | Decisión | Por qué |
|---|---|---|
| 1 | El enlace es una columna **`remision_id` en el renglón** | El enlace vive donde vive el cobro: quitar el renglón o descartar la prefactura liberan la remisión sin que nadie tenga que acordarse de limpiar nada |
| 2 | La ventana va de **la llegada a `now()`**, y se reajusta al guardar la salida | Al iniciar la prefactura casi nunca hay salida: 16 de 27. Esperarla significaría no ver el combustible hasta el final |
| 3 | Lo **automático** trae solo las remisiones **libres** | Que el sistema meta solo una remisión ya facturada no es «bajo responsabilidad de quien captura»: es un doble cobro que nadie decidió |
| 4 | Lo **manual** sí ofrece las ya facturadas, avisadas | Rescata una marca puesta por error, y ahí sí hay alguien decidiendo |
| 5 | El precio es el **de la remisión**, no el del catálogo | Es el precio que el combustible tenía cuando se cargó y el que el cliente vio. Una carga de mayo no se recobra a precio de hoy |
| 6 | Una remisión **sin precio no se puede agregar** | Las 88 sin precio son anteriores a mayo de 2026; cobrarlas al precio de hoy sería inventar una cifra |
| 7 | Si al cerrar la ventana una remisión ya puesta queda fuera, **se queda y se avisa** | Nada desaparece solo de un documento de cobro; el operador decide |
| 8 | El renglón conserva **`concepto = 'combustible'`** | `PagosPrefactura` lo consulta para la regla de AVCARD. Y aquí no hay riesgo de borrado: nada borra por ese concepto |

## Alcance

### Entra

- La columna `remision_id` en `fact_prefactura_renglones` y su migración.
- La búsqueda automática al abrir la prefactura y al guardar la salida.
- El buscador de remisiones en el modal de servicios, para la categoría Combustible & Servicios.
- El aviso de las remisiones que quedan fuera de la ventana tras acotarla.

### No entra

- **Cambiar el marcado manual desde Rampa.** `vincularPrefactura`, `status_prefactura` y
  `folio_orden_venta` se quedan como están, y las 89 marcas existentes se respetan.
- **Escribir `status_prefactura` desde Facturación.** El enlace nuevo es `remision_id`; duplicar
  la marca obligaría a mantener las dos en sincronía.
- **Productos distintos de la turbosina.** Hay uno solo en los datos.
- **Ampliar la columna `cantidad`.** Ver «Riesgos».
- **Tocar `CargosEstancia`.** No participa: no borra por concepto `combustible`.

## Arquitectura

### La columna y qué significa «tomada»

```
fact_prefactura_renglones.remision_id   bigint unsigned, nullable, FK -> remisiones.id
```

Solo la llevan los renglones de combustible nacidos de una remisión. Una remisión está **tomada**
si se cumple cualquiera de las dos:

1. `status_prefactura = 1` — el marcado manual desde Rampa.
2. Existe un renglón con ese `remision_id` **en una prefactura con `status = 'A'`**.

La segunda condición es la que evita la contabilidad manual. Descartar una prefactura solo pone
`status = 'N'` y **deja sus renglones en pie** —medido: 78 renglones vivos en 13 prefacturas
descartadas—, así que filtrar por el estado de la prefactura es lo que libera la remisión. Quitar
el renglón la libera igual, sin código extra.

### La búsqueda

Una remisión es **candidata** para una prefactura cuando:

- `remisiones.status = 'A'`
- `upper(trim(matricula))` coincide con la de la prefactura
- `fecha` + `hora_inicial` cae entre `llegada_at` y el fin de la ventana, extremos incluidos
- tiene `precio` no nulo

El fin de la ventana es `salida_at` si existe, y `now()` si no. Se usa `hora_inicial` —el inicio
de la carga— y no `hora_llegada` ni `hora_final`, porque es la que sitúa el consumo. Está
presente en las 330 remisiones aunque la columna admita nulo; una remisión sin `hora_inicial` se
trata como si fuera a las 00:00 de su `fecha`.

**Automática** añade las candidatas que además **no estén tomadas**. **Manual** ofrece las
candidatas y también las tomadas, estas marcadas.

Correr la automática dos veces no duplica nada: una remisión ya puesta en esta prefactura está
tomada por su propio renglón, así que deja de ser elegible.

### El renglón

```
servicio_id       7 (Combustible JET A-1)
remision_id       el id de la remisión
nombre_servicio   "Combustible JET A-1 — EOLO-9397"   (el nombre del servicio y el folio)
precio_unitario   el `precio` de la remisión, no el del catálogo
cantidad          los `total_litros` de la remisión
concepto          'combustible'                       (SIN cambio)
es_de_tercero     false
margen            0
ajuste_precio     ninguno
```

Margen y ajuste van en duro, como en el tránsito de otra aeronave y por la misma razón: el precio
no viene del catálogo, así que los ajustes del catálogo no le aplican.

`concepto` sí se conserva, a diferencia del tránsito ajeno. Allí había que ponerlo en null para
que `CargosEstancia` no lo borrara; aquí **nada borra por concepto `combustible`**, y en cambio
`PagosPrefactura` lo necesita para la regla de AVCARD.

### Cuándo corre la automática, y por dónde

La automática **crea renglones**, así que no puede colgar del `GET` que sirve la prefactura: una
petición de lectura no escribe, y además se repetiría en cada recarga de la pantalla. Va en un
endpoint propio:

```
POST /api/facturacion/prefacturas/{id}/remisiones/sincronizar
```

El editor lo llama al cargar la prefactura y otra vez después de guardar un encabezado cuya
`salida_at` cambió. Devuelve cuántos renglones agregó y la lista de los que quedaron fuera de la
ventana, para el aviso.

Es **idempotente por construcción**: una remisión ya puesta en esta prefactura está tomada por su
propio renglón, así que la segunda llamada no la vuelve a ver. Llamarlo diez veces seguidas deja
el mismo resultado que llamarlo una.

Solo actúa sobre prefacturas en **borrador** y **no descartadas**: una cerrada no recibe
renglones, y la guarda que ya existe para eso se aplica igual. Exige el subdepartamento
`factPrefacturas`, como el resto de la escritura de renglones.

Las remisiones que **ya estaban** en la prefactura **no se tocan nunca**. La automática solo
añade.

### El aviso de la ventana

Tras guardar una salida, los renglones con `remision_id` cuya remisión quede **fuera** de la
ventana nueva se señalan en pantalla: «esta remisión quedó fuera de la estancia». El renglón no se
quita ni se modifica; el aviso es de pantalla, no del documento impreso.

## Errores y casos límite

| Caso | Qué pasa |
|---|---|
| La prefactura no tiene `salida_at` | La ventana va de la llegada a `now()`. Es el caso normal: 16 de 27 |
| La salida se corrige a una hora anterior | Las remisiones que queden fuera se avisan; ninguna se quita |
| La misma remisión en dos prefacturas | La segunda no la ve en la automática. En la manual sale marcada y se puede agregar: es la decisión 4 |
| Remisión sin precio | No es candidata. En la manual sale marcada y **no** se puede agregar |
| Remisión marcada desde Rampa | No es candidata para la automática. En la manual sale con su `folio_orden_venta` |
| La prefactura se descarta | Sus renglones siguen, pero la remisión vuelve a estar libre, porque la consulta filtra por `status = 'A'` |
| Se quita el renglón | La remisión vuelve a estar libre, sin código extra |
| Litros con decimales | No ocurre hoy. Ver «Riesgos» |
| La matrícula no tiene remisiones | La automática no agrega nada y no avisa de nada: es lo normal en la mayoría de las prefacturas |

## Pruebas

### Backend

1. Al abrir una prefactura con llegada y sin salida, entran las remisiones de su matrícula
   cargadas entre la llegada y ahora, con **el precio de la remisión** y los litros como cantidad.
2. **La prueba que define el trabajo:** correr la automática **dos veces** no duplica ningún
   renglón.
3. Una remisión de otra matrícula, una anterior a la llegada y una posterior a la salida **no**
   entran.
4. Una remisión con `status_prefactura = 1` no entra en la automática.
5. Una remisión ya usada por otra prefactura **activa** no entra; si esa prefactura se **descarta**,
   vuelve a entrar.
6. Una remisión sin precio no entra.
7. El renglón conserva `concepto = 'combustible'`, y con él la prefactura **rechaza el pago con
   AVCARD** — la regla de `PagosPrefactura` sigue viéndolo.
8. Quitar el renglón libera la remisión: vuelve a ser candidata.
9. Una prefactura cerrada no recibe renglones automáticos.
10. El buscador manual devuelve las tomadas y las sin precio, marcadas, y las libres sin marca.

La 2, la 5 y la 8 son las que sostienen la decisión 1: si el enlace dejara de liberarse solo, esas
tres se ponen rojas.

### Front

No hay ejecutor de pruebas de JavaScript. La evidencia es `npx tsc --noEmit` contra la línea base
de 1 error preexistente, `npm run build`, y una pasada por el navegador: abrir una prefactura de
una matrícula con remisiones y ver los renglones; buscar una remisión en el modal y comprobar las
marcas de «ya facturada» y «sin precio».

## Riesgos

**La cantidad del renglón es un entero con tope de 9 999.** `total_litros` es `decimal(12,2)`.
Hoy ninguna remisión tiene decimales y la mayor es de 9 129, así que entra — pero **una carga de
10 000 litros o con decimales no cabría**, y el renglón saldría con una cantidad truncada o
rechazada. Cuando aparezca la primera, habrá que ampliar la columna, y eso es una migración sobre
una tabla con renglones vivos.

**El combustible empieza a entrar solo, y eso bloquea AVCARD más a menudo.** La regla no es nueva,
pero hasta ahora alguien tenía que agregar el combustible a mano. A partir de aquí una prefactura
puede quedar sin poder cobrarse con AVCARD sin que nadie haya hecho nada: lo hizo la automática.

**El aviso de «ya facturada» no siempre puede nombrar el documento.** Cuando la marca viene del
enlace nuevo, se sabe en qué prefactura está. Cuando viene de Rampa, `folio_orden_venta` es texto
libre y se mostrará tal cual se tecleó, sin garantía de que corresponda a una prefactura que
exista.

**Dos mecanismos para la misma idea.** `status_prefactura` y `remision_id` responden los dos a
«¿está facturada?», y este diseño los consulta a los dos sin unificarlos. Unificarlos exigiría
migrar las 89 marcas existentes a enlaces reales, y no se puede: su `folio_orden_venta` es texto
libre que no siempre apunta a una prefactura de este sistema.
