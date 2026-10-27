# Los comisariatos entran solos en la prefactura

**Fecha:** 2026-10-27
**Módulos:** Facturación (prefacturas) ← Tráfico (Servicio Comisariato)
**Estado:** aprobado en conversación, pendiente de plan
**Precedente:** `2026-10-26-facturacion-remisiones-de-combustible-design.md`
**Requisito previo, ya hecho:** `2026-10-27-trafico-proveedor-de-comisariato-design.md`

## Por qué

Al abrir una prefactura, los comisariatos de esa matrícula entregados durante
la estancia deben aparecer solos como renglones, y poder buscarse a mano desde
el modal de agregar servicio. Es lo mismo que ya se hizo con las remisiones de
combustible.

Esto no se podía construir antes: hasta hace unos commits el proveedor del
comisariato era texto libre, y sin saber qué proveedor es no se sabe qué margen
aplicar. Ese trabajo ya está hecho y es lo que habilita éste.

## Lo que los datos NO pueden decirnos

Con las remisiones, cada decisión se apoyó en 330 registros: cuántas caían en
ventana, cuántas estaban tomadas, cuántas sin precio. **Aquí los datos no
sirven de guía, y conviene saberlo al leer esta spec.**

Medido hoy: de los **once** comisariatos activos, **diez pertenecen a aeronaves
que no tienen ni una sola prefactura**. El único que cae dentro de una ventana
es un registro de prueba creado hoy. Las prefacturas activas van del
2026-05-09 al 2026-10-26; los comisariatos, del 2026-02-12 al 2026-06-30.

Los dos módulos no se tocan en los datos existentes. Esto es fontanería para lo
que viene, y el diseño se apoya en razonamiento y en el precedente de
remisiones, no en medición.

## Decisiones tomadas

1. **El emparejamiento es por el TEXTO de la matrícula**, no por el id de la
   aeronave. Se valoró añadir `aeronave_id` al comisariato —ahora que la
   matrícula se elige de una lista, sería exacto— y se descartó por coste.
   **El coste de esta decisión, que es conocido y aceptado:** existen seis
   parejas de matrículas que son la misma aeronave con otra grafía
   (`XA-VIZ`/`XAVIZ`, `XA--JMB`/`XA-JMB`, `XA--DJT`/`XA-DJT`,
   `XA--MHA`/`XA-MHA`, `XA--ZZZ`/`XA-ZZZ`, `YV-2770`/`YV2770`). Un comisariato
   capturado como `YV2770` **no aparecerá** en la prefactura de `YV-2770`.
   Queda escrito aquí para que, cuando alguien pregunte por qué falta un
   comisariato, la respuesta esté a mano.
2. **Entran todos los de la ventana**, sin mirar la forma de pago, y quien
   factura quita los que no procedan.
3. **El importe que viaja es el `subtotal`** del comisariato; el IVA lo pone la
   prefactura.
4. **Un comisariato con importe 0 SÍ entra**, marcado para revisar: puede ser
   una cortesía o un importe que falta por capturar, y eso lo sabe quien
   factura, no el sistema.

## Los datos

**Columna nueva `servicio_comisariato_id`** en `fact_prefactura_renglones`,
nullable, con llave foránea a `servicio_comisariatos`. Ninguna columna de esa
tabla choca con ese nombre.

Es **lo único** que marca un comisariato como ya cobrado. A diferencia de las
remisiones, aquí no existe una marca anterior equivalente a
`status_prefactura`, así que no hay dos fuentes de verdad que sincronizar. Esta
parte es más simple que su precedente.

**Tabla nueva de exclusiones**, hermana de
`fact_prefactura_remisiones_excluidas` y con su misma forma: `prefactura_id`,
`servicio_comisariato_id`, `user_id`, con llaves foráneas en cascada y único
por la pareja.

**El índice único se llama `fact_prefactura_comisariato_excluido_unique`** (43
caracteres), con el nombre puesto a mano. El automático de Laravel
pasaría de los 64 caracteres que admite MySQL y la migración fallaría entera —
le pasó a la tabla hermana y no se detectó hasta ejecutarla contra la base
real, porque las pruebas corren en sqlite, que no tiene ese límite. Cualquier
nombre generado de esta migración se comprueba por debajo de 64.

**No se generalizan las dos tablas de exclusiones en una sola.** Serían dos
conceptos distintos metidos en una abstracción que nadie ha pedido, y la de
remisiones ya está en producción.

## La ventana

La misma que en combustible: desde la llegada de la prefactura hasta su salida,
ambos extremos incluidos. Si la estancia sigue abierta —sin salida
registrada—, hasta ahora.

El momento del comisariato se compone de `fecha_entrega` (columna `date`) y
`hora_entrega` (columna `time`). **La consulta se parte igual que en
remisiones**: el filtro por día en SQL y la hora exacta en PHP. Al escribir
esta spec afirmé que aquí sería más limpio porque las columnas son del tipo que
dicen ser; es falso, y lo corrijo. Combinar fecha y hora en SQL sigue pidiendo
funciones distintas en MySQL y en sqlite, así que la partición hace falta por
el mismo motivo que allí.

Un detalle que sí cambia: el modelo castea `hora_entrega` como `datetime:H:i`,
así que al leerla en PHP llega como una fecha-hora con el día de HOY. Hay que
tomar solo su parte horaria y montarla sobre `fecha_entrega`.

## Qué entra solo

Entran los comisariatos **activos**, de la matrícula de la prefactura, dentro
de la ventana, **con proveedor**, que no estén ya cobrados en una prefactura
activa, y que no hayan sido excluidos a mano de esa prefactura.

**La sincronización no corre** sobre una prefactura cerrada, descartada ni
**reabierta**. Lo de reabierta es una lección del trabajo anterior: una
reabierta es un documento ya emitido que alguien abrió para corregir algo
concreto, y que al abrirlo le aparezcan renglones solos le cambia el total a
espaldas de quien lo reabrió. A mano sí se puede agregar, que es como se
corrige a propósito.

**Lo que se quita a mano no vuelve.** Al quitar un renglón de comisariato se
apunta la exclusión; el alta manual del mismo comisariato la revoca.

## Qué NO entra, y cómo se ve

- **Sin proveedor.** No es una elección: `fact_prefactura_renglones.servicio_id`
  es NOT NULL, así que sin servicio no hay renglón posible. Aparece en el
  buscador marcado «sin proveedor» y no se puede elegir, para que quien factura
  vea que existe y pueda ir a arreglarlo en Tráfico.
- **Ya cobrado en otro documento.** Aparece marcado con el documento que lo
  tiene. Igual que en remisiones, se puede elegir a propósito para rescatar una
  marca puesta por error.
- **Ya en este documento.** Aparece marcado y **deshabilitado**: repetirlo en
  el mismo documento no tiene ningún caso legítimo.

## El renglón

- **Servicio:** el proveedor del comisariato (`fact_servicio_id`).
- **Precio unitario:** el `subtotal` del comisariato.
- **Cantidad:** 1.
- **`margen`, `ajuste_precio` y `es_de_tercero`: del SERVICIO**, como en
  cualquier alta normal.

**Esto es lo contrario de lo que se hizo con el combustible, y a propósito.**
Allí se forzó margen 0 y ajuste ninguno porque el precio de la remisión era el
precio final y un margen de catálogo encima lo habría falseado. Aquí el margen
**es** el negocio: Comexa al 0 %, los otros cuatro al 50 % con su ajuste
propio. Tomar 0 en vez del catálogo cobraría de menos en cuatro de cinco
proveedores.

**Las dos vías —automática y manual— construyen el renglón en un solo sitio.**
En el trabajo de remisiones cada una lo armaba por su cuenta y divergieron en
tres campos (`margen`, `ajuste_precio`, `es_de_tercero`) sin que nadie lo viera
hasta la revisión final de rama. Aquí no pueden separarse porque no hay dos
sitios donde hacerlo.

## La pantalla

**En la tabla de renglones**, un comisariato traído muestra su forma de pago
**tal como está escrita** en el registro de Tráfico.

Se valoró que la pantalla marcara los que no parecen «cargo a la matrícula»
para que saltaran a la vista los de efectivo, y **se descartó**: en diez filas
hay cuatro grafías de «cargo» (`Cargo a la matrícula`, `Cargo a matricula`,
`Cargo`, `Cargo matricula`), más `Efectivo`, `Credito` y una que dice `G`. Una
regla sobre ese texto marcaría `Credito` —que seguramente sí se factura— y
acertaría por casualidad en el resto. Enseñar el texto sirve para lo mismo sin
fingir una interpretación que el dato no soporta. Cuando `forma_pago` se
normalice, se podrá automatizar.

**Los de importe 0 se marcan para revisar.** La marca se deriva del propio
importe, sin columna nueva.

**En el modal de agregar servicio**, al elegir la categoría Comisariatos y su
servicio, aparece un buscador de comisariatos de esa matrícula, con las marcas
descritas arriba.

## Pruebas

- Los bordes de la ventana, incluida la estancia sin salida registrada.
- El emparejamiento por matrícula, y que una matrícula distinta no se cuele.
- Que no se cobre dos veces: ni en otro documento ni en el mismo.
- Que la exclusión aguante una recarga y que el alta manual la revoque.
- **Que las dos vías produzcan renglones idénticos campo por campo**, con el
  margen y el ajuste del servicio, no con ceros.
- El marcado del importe 0 y el rechazo del comisariato sin proveedor.
- Que una prefactura cerrada, descartada o reabierta **no** sincronice.
- Los nombres de los identificadores de las dos migraciones, por debajo de 64
  caracteres. **No hay relleno que probar**: la columna nace nula y ningún
  renglón existente apunta a un comisariato.

Las pruebas corren **en serie**, nunca con `--parallel`, sobre sqlite en
memoria. Del front no hay lanzador: la evidencia es `npx tsc --noEmit` contra
su línea base más `npm run build`, y comprobación en el navegador.

## Qué queda fuera, a propósito

- **Normalizar `forma_pago`**, que sigue siendo texto libre con cuatro grafías
  de lo mismo.
- **Limpiar las seis parejas de matrículas duplicadas.** Es el arreglo de fondo
  del coste aceptado en la decisión 1, y toca datos de varios módulos.
- **Cualquier cambio en el módulo de Tráfico.** Su parte ya está hecha.
- **El seeder del catálogo de Comisariatos.** Sin esos cinco servicios el
  módulo de Tráfico no deja capturar, así que este trabajo tampoco tendría nada
  que traer; pero sembrar márgenes es una decisión de negocio del usuario.
- **El `total` del comisariato**, que se teclea a mano aparte del `subtotal` y
  que hoy se contradice con él en varias filas. Viaja el `subtotal`; ordenar el
  otro es otro trabajo.

## Riesgos conocidos

**El emparejamiento por texto y las matrículas duplicadas**, ya descrito en la
decisión 1. Es el riesgo principal y es una consecuencia aceptada.

**El módulo tiene muy poco uso.** Once registros en ocho meses, y las
decisiones se han tomado sobre esa muestra. Si el volumen crece de golpe,
conviene volver a medir antes de dar por buenas las marcas y los filtros.

**La carrera entre dos borradores de la misma matrícula.** Si dos prefacturas
activas de la misma aeronave solapan sus ventanas, el mismo comisariato podría
disputarse entre ambas. Es el mismo caso que quedó abierto en remisiones y se
resuelve igual: gana quien lo cobre primero, y el otro lo ve marcado como
tomado.
