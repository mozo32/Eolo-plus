# El proveedor del comisariato sale de una lista

**Fecha:** 2026-10-27
**Módulo:** Tráfico — Servicio Comisariato
**Estado:** aprobado en conversación, pendiente de plan

## Por qué

El objetivo final es que las prefacturas traigan solos los comisariatos de una
matrícula, como ya hacen con las remisiones de combustible. Ese enlace no se
puede construir todavía, y la razón no es de diseño sino de datos.

En facturación, un comisariato no se cobra a secas: la categoría
**Comisariatos** tiene cinco servicios, uno por proveedor, y **no son
equivalentes**.

| Servicio | id | Margen | Ajuste de precio |
|---|---|---|---|
| `Comisariato_Comexa` | 36 | 0 % | ninguno |
| `Comisariato, Tercero` | 40 | 50 % | ninguno |
| `Comisariato_Manny` | 48 | 50 % | más 5 |
| `Comisariato_Avemex` | 49 | 50 % | sin IVA |
| `Comisariato_Fly Across` | 54 | 50 % | comisión 131 |

Los cinco tienen `precio_unitario` en 0: el importe viene siempre de fuera, y
lo que el servicio aporta es **cómo se transforma** ese importe. Entre Comexa y
Manny hay un 50 % de diferencia en lo que se le cobra al cliente.

Hoy el proveedor se captura en `servicio_comisariatos.catering`, que es texto
libre. En las diez filas existentes ya hay tres grafías del mismo proveedor
(`Manny`, `Mannys`, `Mannys Catering`) y dos valores que no son proveedores
(`F`, `fd`). Mientras eso siga así, facturación tendría que **adivinar** qué
margen aplicar, y equivocarse cuesta dinero real.

Este trabajo cierra esa puerta: el proveedor se elige de una lista cerrada
ligada al catálogo, desde el momento en que se captura.

## Decisiones tomadas

1. **El comisariato apunta al servicio del catálogo**, no a un proveedor ni a
   una lista propia de Tráfico. Es lo que determina el cobro, así que es lo que
   se captura.
2. **El importe que viajará a la prefactura es el `subtotal`**, y el IVA lo
   pondrá la prefactura. (Afecta al trabajo siguiente, no a éste; queda escrito
   para que no se vuelva a decidir.)
3. **Los comisariatos entrarán todos en la prefactura** y quien factura quitará
   los que no procedan. (Igual: es del trabajo siguiente.)

### Por qué el servicio y no el proveedor

Existen ya dos listas y **no coinciden**:

- `fact_proveedores`: `COMEXA`, `MANNY CATERING`, `ARTURO GARDUÑO`, `EOLO`, `OTROS`
- Servicios de la categoría: `Comexa`, `Manny`, `Avemex`, `Fly Across`, `Tercero`

Faltan proveedores para Avemex y Fly Across, y `ARTURO GARDUÑO` no tiene
servicio. Si Tráfico apuntara a `fact_proveedores`, alguien tendría que
mantener una traducción entre las dos listas para siempre. Mantener dos fuentes
de verdad sobre lo mismo es la grieta que ya costó un defecto en el trabajo de
remisiones (la marca vieja `status_prefactura` frente al enlace nuevo), y no se
repite aquí.

## Los datos

**Columna nueva** `fact_servicio_id` en `servicio_comisariatos`, apuntando a
`fact_servicios`. Se llama así, con el prefijo del módulo al que apunta,
porque la tabla vive en Tráfico y un `servicio_id` a secas no diría a qué
catálogo pertenece. Ninguna columna de la tabla choca con ese nombre.

- **Nullable.** Las diez filas de hoy no tienen proveedor elegido y no se les
  inventa uno.
- **Borrado restringido.** Un servicio que ya identificó un comisariato no debe
  poder desaparecer y dejar el registro sin explicación. El catálogo además no
  borra: desactiva.

**`catering` se queda y deja de escribirse.** Pasa a ser historia: el texto que
alguien tecleó antes de que existiera la lista. El formulario ya no lo rellena.
Donde se lee —tabla y PDF— se muestra el nombre del servicio cuando lo hay y el
texto viejo cuando no, de modo que ninguna fila pierde lo que decía.

**Relleno de las filas existentes**, en la misma migración:

| Filas | catering | Queda apuntando a |
|---|---|---|
| 3, 5, 6, 8, 9 | `Comexa` | 36 (`Comisariato_Comexa`) |
| 4, 7, 10 | `Mannys`, `Manny`, `Mannys Catering` | 48 (`Comisariato_Manny`) |
| 1, 2 | `F`, `fd` | nulo |

El relleno empareja por texto (contiene «comexa» o «manny», sin distinguir
mayúsculas). Lo que no empareja se queda en nulo: adivinar ahí sería inventar.

**Fuera de este trabajo:** tirar la columna `catering`. Es una decisión aparte,
que se podrá tomar cuando lleve meses sin escribirse.

## La lista

**Un endpoint propio en las rutas de Tráfico**,
`GET /api/ServicioComisariato/proveedores`, que devuelve los servicios
**activos** de la categoría Comisariatos, y de cada uno **solo `id` y nombre**.
Se llama «proveedores» porque es lo que son para quien captura en Tráfico,
aunque del otro lado sean servicios del catálogo.

No se expone el catálogo entero. El margen y el precio son asunto de
facturación, y un usuario de Tráfico no tiene por qué ver cuánto se carga
encima de lo que entregó un proveedor. Esto además evita tener que darle a
Tráfico permiso sobre el catálogo de facturación.

El grupo de rutas `ServicioComisariato` usa hoy solo `auth:sanctum`, sin
middleware de subdepartamento, al contrario que las de facturación. El endpoint
nuevo **sigue la convención del grupo en el que vive**: no se le inventa un
permiso que sus hermanas no tienen.

**Los nombres se muestran tal como están en el catálogo**
(`Comisariato_Comexa`, `Comisariato, Tercero`). No se les quita el prefijo al
pintarlos: sería lógica escondida que mentiría en cuanto alguien diera de alta
un proveedor con otro nombre. Si los nombres molestan, el arreglo es
renombrarlos en la pantalla de servicios, que ya existe. Queda como sugerencia,
fuera de este trabajo.

## La pantalla

**El campo de captura** pasa de texto libre a lista desplegable, y **sigue
siendo obligatorio**, como lo es hoy. Nadie se queda atascado por no encontrar
su proveedor: `Comisariato, Tercero` es la opción paraguas y ya existe.

Al editar un registro antiguo la lista aparece vacía y hay que elegir. Es
deliberado: tocar una ficha vieja es la ocasión natural de arreglarla, y son
diez.

**Si el catálogo no tiene ningún servicio de comisariato activo**, la lista
saldría vacía y nadie podría guardar sin entender por qué. La pantalla lo dice
con todas las letras. El aviso sale **donde de verdad bloquea** —el formulario
de captura— y no en cada pantalla que lo consulte.

**El filtro de la tabla** pasa de caja de texto (`catering LIKE`) a la misma
lista, más una opción **«Sin proveedor»** para encontrar las que quedaron sin
elegir. El buscador general no se toca: sigue encontrando el texto viejo, así
que nada de lo capturado se vuelve inalcanzable.

**La tabla y el PDF** muestran el nombre del servicio cuando lo hay y el texto
viejo cuando no.

## Validación

La validación de alta y edición está hoy **en línea en el controlador y
duplicada**. Como este trabajo cambia justo esas reglas, se extrae a Form
Requests, que es la convención del proyecto.

**La regla que importa no es que el servicio exista, sino que sea de la
categoría Comisariatos y esté activo.** Comprobar solo la existencia dejaría
pasar el id de Combustible o de un Tránsito, y el comisariato acabaría
cobrándose como otra cosa. Es la misma forma de defecto que apareció en el
trabajo de remisiones —una referencia no atada a lo que significa— y aquí se
evita desde el principio.

Mensajes de error en español, como el resto del módulo.

## Pruebas

El peso está en el servidor, que es donde esto se sostiene.

- **Form Request:** acepta un servicio activo de Comisariatos; rechaza uno de
  otra categoría, uno dado de baja y uno inexistente.
- **Alta y edición:** guardan el servicio elegido y **ya no escriben
  `catering`**.
- **Migración de relleno:** las cinco filas de Comexa y las tres de Manny
  quedan apuntando a su servicio; las dos restantes, en nulo. Son diez filas:
  se comprueba entera.
- **Endpoint:** devuelve solo servicios activos de la categoría, **y solo id y
  nombre**. Esta prueba parece de más hasta que alguien añade un campo al
  recurso y filtra el margen a Tráfico sin querer.

**Del front no hay pruebas automáticas en este proyecto.** La evidencia es
`npx tsc --noEmit` contra su línea base y `npm run build`, más comprobación en
el navegador.

Las pruebas corren **en serie** (`php artisan test`), nunca con `--parallel`.

## Qué queda fuera, a propósito

- **El enlace con las prefacturas.** Es el trabajo siguiente y tendrá su propia
  spec. Esta pieza existe para que aquél pueda saber qué margen aplicar.
- **Tirar la columna `catering`.**
- **Renombrar los cinco servicios del catálogo** para que se lean limpios.
- **Normalizar `forma_pago`**, que también es texto libre con cuatro grafías de
  «cargo a la matrícula». No hace falta para este trabajo porque se decidió que
  todos los comisariatos entren en la prefactura y facturación quite los que no
  procedan. Si esa decisión cambiara, esto volvería a ser necesario.
- **Los importes `subtotal` y `total`**, que se teclean a mano sin que nada
  relacione uno con otro, y que hoy se contradicen en varias filas (`total`
  menor que `subtotal`). Se decidió que el que viaja es `subtotal`; ordenarlos
  es otro trabajo.

## Riesgos conocidos

**El controlador crea aeronaves a partir de texto libre.** `store()` llama a
`buscarOCrear()` con la matrícula tecleada. Ahí nacieron `XA AMI` y `YV2770`, y
`YV2770` es una de las **seis parejas de matrículas duplicadas** que son la
misma aeronave escrita con otro guion (la peor, `XA-VIZ` / `XAVIZ`, con 38
remisiones). Es la misma enfermedad que ya obligó a tolerar el guion en el alta
manual de remisiones. No se toca en este trabajo, pero **importará en el
enlace con facturación**: un comisariato capturado contra `XAVIZ` no aparecerá
en la prefactura de `XA-VIZ`.

**El módulo tiene poco uso.** Diez registros en cinco meses, y dos de ellos son
claramente pruebas. El diseño no depende de volumen, pero conviene saber que
estas decisiones se toman sobre una muestra pequeña.

**`GET eliminar/{id}` borra con un GET.** Es anterior a este trabajo y queda
fuera, pero está anotado porque un GET que modifica datos es un problema que
alguien debería mirar.
