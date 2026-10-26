# Cobrar el tránsito de otra aeronave en la prefactura

**Fecha:** 2026-10-26
**Rama:** `facturacion`
**Estado:** diseño aprobado, pendiente de plan de implementación

## Qué resuelve

Una prefactura es de una matrícula. Pero el departamento necesita cobrar en ella el tránsito de
**otra** aeronave: se factura a XB-ACA y hay que incluir el tránsito de 12 horas del helicóptero
XA-CCC, porque lo paga el mismo cliente.

Hoy no se puede de ninguna forma. El menú de agregar servicio no ofrece los tránsitos, y si los
ofreciera el servidor los rechazaría: hay una validación que lo impide a propósito.

## Lo que ya estaba decidido, y por qué importa

El precio de un cargo de estancia **no sale del catálogo**. En el catálogo los tres tramos valen
$99.00, que es relleno; el precio real sale de la tarifa de la matrícula. Lo pone
`CargosEstancia`, y lo dispara el botón «Estancia y ajustes» de la prefactura.

Por eso existe `StoreRenglonRequest::noEsServicioDeEstancia()`, que rechaza agregar a mano
cualquiera de los cinco servicios de estancia, con dos razones escritas en su docblock:

1. Congelaría el relleno de $99 en el renglón, sin forma de corregirlo.
2. **Duplicaría el cobro** cuando se recalcule la estancia.

La segunda razón es la que manda en este diseño, y nace de una línea concreta:

```php
// CargosEstancia::quitarEstancia()
return $prefactura->renglones()->whereIn('concepto', FactServicio::CONCEPTOS_ESTANCIA)->delete();
```

`Recalcular estancia` **borra por concepto, sin condición**, y vuelve a crear los cargos desde la
ficha de la matrícula propia. Cualquier cargo que lleve concepto de estancia muere ahí.

## El dato de hoy

| Medida | Valor |
|---|---|
| Aeronaves en el sistema | 847 |
| …con ficha de facturación | 847 (todas) |
| …en Tránsito | 816 |
| …en Guarda | 31 |
| …sin tarifa de tránsito de 12 h, ni propia ni por categoría | 63 |

Los tres servicios de tránsito, medidos:

| Servicio | `concepto` | Precio de catálogo | `es_de_tercero` | `margen` | `ajuste_precio` |
|---|---|---|---|---|---|
| Tránsito 02 hrs | `estancia_transito_2h` | $99.00 | no | 0.00 | ninguno |
| Tránsito 12 hrs | `estancia_transito_12h` | $99.00 | no | 0.00 | ninguno |
| Tránsito 24 hrs - pernocta | `estancia_pernocta` | $99.00 | no | 0.00 | ninguno |

Lo que de verdad se ha cobrado por esos conceptos en renglones reales: de **$2,022 a $3,014** el
tránsito de 12 h, y de **$4,044 a $6,027** la pernocta. El $99 subfacturaría por miles.

## Hechos medidos que deciden el diseño

### 1. El renglón congela su precio, y eso basta

`PrefacturaRenglonController::store()` copia al renglón el nombre, el precio, el margen y el
ajuste del servicio, «si el catálogo cambia mañana, este documento no se mueve». Nada obliga a
que el precio guardado sea el del catálogo: el renglón es el lugar correcto para un precio que
viene de otra parte. `CargosEstancia` ya hace exactamente eso.

### 2. El renglón no sabe de quién es

`fact_prefactura_renglones` no tiene columna de aeronave ni de matrícula. Guardar «este tránsito
es de XA-CCC» como dato estructurado exigiría una migración y enseñar al motor de estancia a
distinguir los propios de los ajenos.

### 3. El buscador de aeronaves ya existe

`GET /api/facturacion/aeronaves` acepta `q` (busca por matrícula, en mayúsculas y con `LIKE`) y
`estatus`, y devuelve la ficha con su categoría y su tipo de motor. No hay que construirlo.

### 4. Las tarifas no salen del tipo de motor

`FactAeronave::tarifaTransito2h()`, `tarifaTransito12h()` y `tarifaPernocta()` devuelven la
tarifa propia de la aeronave y, si no la tiene, la de su **categoría**. El tipo de motor solo
manda en la tarifa de aterrizaje.

## Decisiones tomadas

| # | Decisión | Por qué |
|---|---|---|
| 1 | El renglón se guarda **sin concepto de estancia** (`concepto = null`) | Es lo único que lo hace sobrevivir a `Recalcular estancia`: ni se borra ni se duplica. Cierra la segunda razón de la validación |
| 2 | La matrícula va **en el nombre** del renglón, no en una columna nueva | Basta con que el documento diga de quién es y cobre bien. Sin migración y sin tocar el motor de estancia |
| 3 | Se entra por **AGREGAR SERVICIO**, categoría Tránsitos | Es donde el departamento lo busca, y donde estaba en el sistema viejo |
| 4 | Una aeronave en **Guarda** no se puede cobrar aquí | Es la regla que el sistema ya aplica; una segunda puerta que la saltee la volvería inútil |
| 5 | Sin tarifa para el tramo, **no se cobra** | Cobrar el relleno de $99 es peor que no cobrar: pasa inadvertido |
| 6 | La **matrícula propia** se rechaza y se manda a «Estancia y ajustes» | Por ahí sí se duplicaría o se borraría al recalcular |

## Alcance

### Entra

- Los **tres tramos de tránsito** cobrados a nombre de otra matrícula, con cantidad.
- El campo de matrícula en el modal de agregar servicio, visible solo para esos tres servicios.
- La categoría **Tránsitos** vuelve al menú.
- La validación del backend deja pasar esos tres **solo** cuando traen matrícula ajena.

### No entra

- **Los dos ajustes de estancia** (`estancia_ajuste_2h_12h`, `estancia_ajuste_12h_pernocta`). Son
  para subir de tramo la estancia propia y ya se aplican desde «Estancia y ajustes». Siguen sin
  poder agregarse a mano.
- **Una columna de aeronave en el renglón.** Ver decisión 2.
- **Reportes por matrícula** de los tránsitos ajenos. Es la consecuencia aceptada de la
  decisión 2.
- **Cambiar quién borra qué en `CargosEstancia`.** No se toca una línea de ese servicio.
- **Las otras dos peticiones del menú de categorías** (quitar «Sin categoría», mostrar «Dugaeam
  Fee» vacía). Se hacen al final de este trabajo, cuando el menú se toque una sola vez.

## Arquitectura

### El renglón que se crea

Un renglón normal, con cuatro diferencias respecto a los que crea hoy `store()`:

```
nombre_servicio   "Tránsito 12 hrs — XA-CCC"   (el nombre del servicio, un guion largo, la matrícula)
precio_unitario   la tarifa del tramo SEGÚN LA FICHA DE XA-CCC, no el 99.00 del catálogo
concepto          null                          (en vez de `estancia_transito_12h`)
servicio_id       el del servicio de tránsito   (sin cambio: el tramo sigue siendo rastreable)
```

El resto se copia del servicio como siempre: `es_de_tercero` en false, `margen` en 0 y
`ajuste_precio` en `ninguno`, que es lo que esos tres servicios ya tienen y lo que
`CargosEstancia` fija para los suyos.

`servicio_id` se conserva a propósito: el sistema sigue sabiendo **qué tramo** se cobró, aunque no
de qué aeronave. Lo que se pierde con la decisión 2 es la matrícula, no el tramo.

### El endpoint

`POST /api/facturacion/prefacturas/{id}/renglones` gana un campo opcional:

```
aeronave_id   int|null   el `aeronaves.id` de la matrícula ajena
```

`StoreRenglonRequest` cambia así:

- `aeronave_id` es `nullable`, `integer` y debe existir en `aeronaves`.
- La regla `noEsServicioDeEstancia` deja de rechazar los **tres tramos de tránsito** cuando viene
  `aeronave_id`. Sigue rechazándolos sin él, con su mensaje de siempre, y sigue rechazando **los
  dos ajustes** siempre, con o sin matrícula.
- `aeronave_id` sin un servicio de tránsito se rechaza: no significa nada en un servicio normal y
  aceptarlo en silencio escondería un error de quien llama.

El controlador, cuando viene `aeronave_id`, busca la ficha, saca la tarifa del tramo y arma el
renglón descrito arriba.

### Las tres negativas, y su mensaje

| Caso | Respuesta |
|---|---|
| `aeronave_id` es la matrícula de esta prefactura | 422: «Para la estancia de esta aeronave usa «Estancia y ajustes»: por aquí el cargo se duplicaría al recalcular.» |
| La aeronave está en Guarda | 422: «XA-CCC está en Guarda y una aeronave en Guarda no paga estancia.» |
| No hay tarifa para ese tramo | 422: «XA-CCC no tiene tarifa de tránsito de 12 horas, ni propia ni por su categoría, así que no hay precio que cobrar.» |
| La aeronave no tiene ficha de facturación | 422: «XA-CCC no tiene ficha de facturación, así que no hay tarifas que aplicar.» |

El cuarto caso no ocurre hoy —las 847 tienen ficha— pero una matrícula nueva puede no tenerla, y
sin ficha no hay de dónde sacar el precio.

### La pantalla

En `ModalRenglon`:

- La categoría **Tránsitos** vuelve al menú. Para que aparezca, el modal deja de excluir los
  servicios de tránsito; los **dos ajustes** siguen excluidos, porque siguen sin poder agregarse.
- Al elegir uno de los tres tránsitos aparece un campo **Matrícula de la aeronave**, con el mismo
  patrón de búsqueda que `SelectorCliente`: se teclea, se consulta `GET /facturacion/aeronaves`
  con `q`, y se elige de los resultados. Para cualquier otro servicio el campo no existe.
- Sin matrícula elegida no deja agregar, y lo dice en el campo.
- La **vista previa del importe** usa la tarifa de la aeronave elegida, no el precio del catálogo.
  Mientras no haya matrícula, no muestra importe.

El aviso que hoy dice «Los cargos de estancia no aparecen aquí: los pone «Estancia y ajustes»…»
deja de ser cierto tal cual y pasa a explicar la regla nueva: los tránsitos de **otra** aeronave
se agregan aquí; la estancia **de esta** sale de «Estancia y ajustes».

## Errores y casos límite

| Caso | Qué pasa |
|---|---|
| Se agrega un tránsito ajeno y después se pulsa «Estancia y ajustes» | El ajeno **no se toca**: `quitarEstancia` borra por concepto y el ajeno tiene `concepto = null` |
| La tarifa de XA-CCC cambia mañana | El renglón ya creado no se mueve: congeló su precio, como cualquier otro |
| La prefactura está cerrada o descartada | Se rechaza como cualquier alta de renglón; no hay camino nuevo |
| Dos tránsitos de la misma aeronave ajena | Permitido, con la cantidad del propio modal o como dos renglones |
| Teclean una matrícula que no está en el sistema | La regla `exists` sobre `aeronaves` la rechaza antes de llegar al controlador. No hay alta de aeronave desde aquí |

Una aeronave **no se puede dar de baja**: ni `aeronaves` ni `fact_aeronaves` tienen columna de
status. El único estado es `estatus`, que vale `transito` o `guarda`, y eso ya está arriba.

## Pruebas

### Backend

1. Un tránsito con matrícula ajena se cobra con **la tarifa de esa aeronave**, no con los $99 del
   catálogo, y el renglón queda con `concepto = null` y el nombre con la matrícula.
2. **La prueba que define este trabajo:** tras agregar un tránsito ajeno, `Recalcular estancia`
   lo deja intacto —ni lo borra ni lo duplica— y los cargos propios sí se reemplazan.
3. Un tránsito **sin** `aeronave_id` sigue dando 422 con el mensaje de siempre.
4. Los **dos ajustes** siguen dando 422 con `aeronave_id` y sin él.
5. Se rechaza la **matrícula propia**, la que está en **Guarda**, la que **no tiene tarifa** para
   ese tramo y la que **no tiene ficha**, cada una con su mensaje.
6. `aeronave_id` en un servicio que no es de tránsito se rechaza.

Las pruebas 3 y 4 son de no regresión: la validación se abre por una rendija, y hay que fijar que
el resto sigue cerrado.

### Front

No hay ejecutor de pruebas de JavaScript en el proyecto. La evidencia es `npx tsc --noEmit`
contra la línea base de 1 error preexistente, `npm run build`, y una pasada por el navegador:
elegir Tránsitos, teclear una matrícula ajena, ver el precio real en la vista previa, y
comprobar que el campo no aparece en un servicio normal.

## Riesgos

**La validación se abre por primera vez.** Hoy es un «no» absoluto a los cinco conceptos de
estancia; pasa a ser un «no, salvo estos tres con matrícula ajena». Es la clase de regla que se
relaja de nuevo con el tiempo hasta no proteger nada. Las pruebas 3, 4 y 6 son el candado.

**Un tránsito ajeno mal tecleado se cobra igual.** Si eligen XA-CCD en vez de XA-CCC, el sistema
no tiene forma de notarlo: la matrícula es texto en el nombre. El documento lo muestra, así que
se ve al revisarlo, pero nada lo impide.

**La matrícula vive solo en el nombre.** Si mañana quieren saber cuánto tránsito generó cada
aeronave, este diseño no lo da y habrá que hacer la columna y migrar lo ya cobrado. Es la
consecuencia aceptada de la decisión 2, y conviene que esté escrita para cuando alguien lo pida.
