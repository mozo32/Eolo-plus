# Migración de Prefacturas — Bloque 2: la prefactura

**Fecha:** 2026-10-01 · **Rama:** `facturacion-2-prefactura` · base: la punta de
`facturacion-1b-catalogos`

Los bloques 1a y 1b trajeron los cimientos: el catálogo de matrículas con sus
cuatro tarifas, y los cinco catálogos de facturación (clientes, categorías de
servicio, servicios, formas de pago, proveedores). Este bloque construye el
documento en sí.

## Qué entra y qué no

**Entra:** el encabezado de la prefactura, sus renglones, los cargos de estancia
contra las tarifas de la matrícula, el paquete internacional, los totales con
IVA, el ciclo borrador → cerrada con folio, dos pantallas, y un comando que
verifica la aritmética contra las 4,053 prefacturas históricas.

**No entra, queda para el bloque 3:** los pagos (`tb_formas_pago`, que admite
varios por prefactura, con cambio), las notas (`tb_notas`, con nota interna,
externa y de factura), la impresión, y la corrección de una prefactura ya
cerrada.

**Premisa:** los dos sistemas conviven. Este bloque no apaga Prefactura.

## El dato real del sistema viejo

Todo lo que sigue está verificado contra el volcado de producción del
2026-09-29 (`fact-fbo-prod`).

| Tabla | Filas | Qué es |
|---|---|---|
| `tb_prefcatura` | 9 | Las prefacturas **abiertas** en este momento, una por matrícula |
| `tb_hprefactura` | 4,054 | El histórico cerrado |
| `tb_venta` | 10,310 | Los renglones, colgados del **folio**, no del id del encabezado |
| `tb_formas_pago` | 3,534 | Pagos (bloque 3) |
| `tb_llegadas` | 3,867 | Llegada, salida y duración de la estancia |
| `tb_notas` | 215 | Notas (bloque 3) |

### El folio está roto en el origen

Se asigna leyendo el mayor y sumándole uno (`$folp = $hpref3+1` en `a_pref.php`),
sin transacción, sin tabla de contador y sin índice único, y sobre las dos tablas
a la vez. Consecuencia medida: **207 folios aparecen más de una vez en el
histórico, 290 filas de más.** El folio 3922 aparece ocho veces, todas de la
misma matrícula y con el mismo total: es el mismo documento guardado varias
veces, no documentos distintos. Y como `tb_venta` cuelga del folio, **los
renglones de esos duplicados están mezclados entre sí.**

Hay un borrador abierto desde 2025-06-25 sentado sobre el folio 791.

### Los totales guardados no corresponden a sus renglones

Comparando los 3,494 encabezados de folio **no duplicado** contra la suma de sus
propios renglones:

| Diferencia | Prefacturas |
|---|---|
| Hasta 2 centavos | 3,034 |
| Hasta 1 peso | 422 |
| Hasta 100 pesos | 1 |
| **Más de 100 pesos** | **37** |

Las primeras 3,456 son ruido de redondeo: `tb_venta.precio_u` es **float** y el
importe se calcula en PHP antes de guardarse redondeado, así que el subtotal del
encabezado y la suma de los renglones derivan por centavos.

Las 37 restantes están estructuralmente mal. El folio 2622 guarda un subtotal de
33,744.00 contra 4,744.00 de renglones — **29,000 pesos**. El 1031 guarda
16,876.00 contra 700.00.

### El IVA es 16% uniforme

En las 3,998 prefacturas con subtotal mayor que cero la tasa es exactamente
0.1600, sin una sola exención. Las 73 que a primera vista no cuadraban eran el
float otra vez: 65,092.20 × 0.16 da 10,414.752 y la columna `float` guarda
10,414.8.

### Los cargos de estancia no se calculan: se teclean

`insert22.php` recibe por POST cuántas pernoctas, cuántos tránsitos de 2 h y
cuántos de 12 h, y aplica a esas cantidades las tarifas de la matrícula. Las
fechas se guardan y de ellas sale días/horas/minutos en `tb_llegadas`, pero **la
cantidad facturada la decide la persona.** Y solo si `id_estatus = 1`
(Tránsito): una aeronave en Guarda no paga estancia.

Los tres servicios de estancia tienen precio `99.0000` en el catálogo, que es
relleno — su precio real sale siempre de la matrícula.

### Los precios internacionales hardcodeados sí coinciden con el catálogo

`insert22.php` inserta cuatro servicios con precio fijo cuando el destino es
internacional. Los cuatro coinciden exactamente con `tb_servicio.precio_u`:

| id | Servicio | Hardcodeado | Catálogo |
|---|---|---|---|
| 9 | DSMES - salida | 4060.50 | 4060.5000 |
| 10 | DSM - salida | 348 | 348.0000 |
| 14 | Mex-eAPI - salida | 900 | 900.0000 |
| 93 | Servicios Internacionales - salida | 750 | 750.0000 |

Leerlos del catálogo no cambia ningún cobro.

### Campos del origen que no se traen

- **`tb_venta.agrupar`** vale 0 en 10,300 de 10,310 filas. Es una función que se
  construyó y se abandonó.
- **`tb_venta.Id_proveedor`** vale 5 en las 10,310, porque `insert22.php` lo trae
  hardcodeado (`$proveedor = 5`). El dato no significa nada.
- `tb_venta.remision` **sí** se usa, en 2,155 renglones (21%): se trae.

### Nota de método

`servicio <> TRIM(servicio)` **no** encuentra espacios finales en MySQL, porque
la collation es PAD SPACE y considera iguales `'X '` y `'X'`. Hay que medir con
`CHAR_LENGTH`. Este error ya se cometió una vez en el bloque 1b y se propagó a
tres documentos antes de que una revisión lo cazara.

## Las cinco decisiones

| Decisión | Elegido |
|---|---|
| **Alcance** | Llegar a una prefactura que produzca los mismos números y se pueda verificar contra el histórico. Pagos e impresión al bloque 3. |
| **Origen de una prefactura** | Independiente, con sugerencia: nace a mano, pero si hay una llegada sin facturar la pantalla la ofrece y el vínculo se graba si se usa. |
| **Folio** | Serie propia y separada, **arrancando en 10000**. Índice único y contador con bloqueo de fila, nunca `MAX+1`. |
| **Totales** | Derivar siempre mientras es borrador; sellar al cerrar. La discrepancia entre sello y derivación se vuelve visible, no silenciosa. |
| **Histórico** | No se trae nada ahora. La verificación lee y compara, sin escribir. |

Las razones de cada una están en el cuerpo de este documento. La del folio
merece repetirse: mientras los dos sistemas convivan, compartir un contador con
un sistema que ya se duplica solo es pedir que el problema se mezcle entre los
dos, y un folio duplicado *entre* sistemas es mucho peor de diagnosticar que uno
duplicado dentro de uno.

## Modelo de datos

### `fact_prefacturas`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | bigint | |
| `folio` | unsigned int, **nullable**, **unique** | Nulo mientras es borrador. Único cuando no lo es. |
| `estado` | `borrador` \| `cerrada`, index | |
| `aeronave_id` | FK → `aeronaves` | La matrícula del catálogo del 1a, nunca texto libre |
| `cliente_id` | FK → `fact_clientes`, nullable | Nulo al abrir; obligatorio al cerrar |
| `llegada_at` | datetime, nullable | |
| `salida_at` | datetime, nullable | |
| `origen` | string(120), nullable | Texto, como `operaciones_diarias.lugar` |
| `destino` | string(120), nullable | |
| `operacion_llegada_id` | FK → `operaciones_diarias`, nullable | Se graba solo si se usó la sugerencia |
| `operacion_salida_id` | FK → `operaciones_diarias`, nullable | |
| `tipo_destino` | `nacional` \| `internacional`, **default `nacional`** | Dispara el paquete internacional |
| `subtotal_sellado` | decimal(12,2), nullable | El sello, llenado al cerrar |
| `iva_sellado` | decimal(12,2), nullable | |
| `total_sellado` | decimal(12,2), nullable | |
| `iva_tasa_sellada` | decimal(5,4), nullable | La tasa con la que se selló |
| `cerrada_at` | datetime, nullable | |
| `cerrada_por` | FK → `users`, nullable | |
| `user_id` | FK → `users` | Quién la elaboró |
| `status` | char(1), default `A`, index | La baja lógica del proyecto |
| timestamps | | |

El índice único del folio es **parcial por convención**: en MySQL un índice
único admite varios NULL, así que `unique(folio)` ya permite muchos borradores
sin folio y a la vez impide dos folios iguales. No hace falta un índice
filtrado.

### `fact_prefactura_renglones`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | bigint | |
| `prefactura_id` | FK → `fact_prefacturas`, cascade | |
| `servicio_id` | FK → `fact_servicios` | |
| `nombre_servicio` | string(120) | **Congelado** |
| `precio_unitario` | decimal(10,4) | **Congelado** |
| `cantidad` | unsigned int | |
| `es_de_tercero` | boolean | **Congelado** |
| `margen` | decimal(5,2) | **Congelado** |
| `ajuste_precio` | string(16) | **Congelado** |
| `concepto` | string(32), nullable | Copia del `concepto` del servicio, para poder recalcular estancia sin ids hardcodeados |
| `proveedor_id` | FK → `fact_proveedores`, nullable | Los 15 servicios de tercero lo necesitan de verdad |
| `remision` | string(255), nullable | |
| `orden` | unsigned smallint | Acomodo en pantalla. Se asigna como `max(orden) + 1` dentro de la prefactura al agregar el renglón; al recalcular estancia, los renglones de estancia conservan el `orden` que tenían si ya existían. |
| timestamps | | |

**El renglón congela todo lo que determina su importe.** Si mañana alguien edita
el catálogo, ningún documento se mueve. El sistema viejo ya lo hace con
`precio_u`.

**`importe` NO se guarda: se deriva.** Es una función pura de los campos
congelados, y guardarlo es exactamente la redundancia que produjo los 37 casos de
hasta 29,000 pesos. Lo único redundante del modelo es el sello, y es deliberado.

### `fact_servicios` gana dos columnas

| Campo | Tipo | Valores |
|---|---|---|
| `concepto` | string(32), nullable, **unique** | `combustible`, `estancia_pernocta`, `estancia_transito_2h`, `estancia_transito_12h` |
| `en_paquete_internacional` | boolean, default false | Las cuatro del paquete |

**Por qué.** Al cerrar el 1b el único servicio especial era el combustible, y se
resolvió con una guarda que impide renombrarlo. El bloque 2 necesita identificar
**siete filas más**: tres de estancia y cuatro del paquete. Sostener siete
acoplamientos por nombre, con siete guardas, es insostenible, y seguiría
dependiendo de que nadie escriba un nombre con un acento distinto — riesgo real,
porque `utf8mb4_unicode_ci` pliega acentos.

El importador los asigna **por el id viejo**, que es estable y es exactamente lo
que el sistema viejo usa: `combustible` ← 7, `estancia_transito_2h` ← 2,
`estancia_transito_12h` ← 3, `estancia_pernocta` ← 4, y el paquete ← 9, 10, 14,
93.

**Esto retira deuda:** la guarda de `UpdateServicioRequest` que impide renombrar
el servicio de combustible se elimina, porque el vínculo deja de ser el nombre.
Con ella se van sus pruebas de caja y acentos, que existían solo para sostener
ese acoplamiento.

### `fact_configuracion` gana la tasa de IVA

La clave `iva_tasa`, con 0.16 por omisión, en la misma tabla que ya guarda la
fórmula del combustible. Una prefactura abierta deriva su IVA de la tasa
vigente; una cerrada ya lo tiene sellado, así que un cambio de tasa no mueve
documentos viejos.

## El dinero

### Una sola implementación de la fórmula

La fórmula ya existe en dos lugares, verificados idénticos: `FactServicio::importe()`
en PHP y `importeVistaPrevia` en `formato.ts`. Si el renglón implementara la suya
serían **tres**.

Se extrae a un solo lugar que recibe precio, cantidad, margen y ajuste, y tanto
`FactServicio::importe()` como el renglón lo llaman. `importe()` consigue así su
primer llamador en producción — hasta hoy solo lo ejercitaban las pruebas.

La fórmula, que no cambia:

```
ajustado = segun ajuste_precio:
    'ninguno'      -> precio
    'mas_5'        -> precio * 1.05
    'sin_iva'      -> precio / 1.16
    'comision_131' -> p1 = precio / 1.31 ;  p1 * 0.15 + p1
conMargen = ajustado + (ajustado * margen / 100)
importe   = conMargen * cantidad, a dos decimales
```

### Los cargos de estancia

Se arman con `FactAeronave::tarifaPernocta()`, `tarifaTransito2h()` y
`tarifaTransito12h()`, **y solo si la aeronave está en Tránsito**. Esa es la
regla que el bloque 1a dejó deliberadamente sin aplicar, y este es su lugar.

Las cantidades las teclea la persona, como hoy. **No se derivan de las fechas.**
Derivarlas sería un cambio de cobro y necesitaría su propia verificación contra
el histórico; no entra aquí.

Recalcular estancia borra los renglones cuyo `concepto` empieza por `estancia_`
y los vuelve a poner, sin tocar nada capturado a mano. Es lo que hoy hace
`DELETE ... WHERE id_servicio BETWEEN 2 AND 4`, pero sin ids hardcodeados.

Con una aeronave en Guarda el recálculo no produce renglones **y la pantalla
dice por qué**, en lugar de quedarse callada. Si corresponde cobrar estancia, hay que corregir el estatus de la aeronave a
Tránsito y volver a recalcular: el servicio de estancia no se agrega a mano, porque
su precio sale de la tarifa de la matrícula y no del catálogo.

### El paquete internacional

Al marcar la prefactura como internacional se agregan los cuatro servicios con
`en_paquete_internacional`, con el precio **del catálogo**. Verificado: los
cuatro precios hardcodeados del sistema viejo coinciden exactamente con el
catálogo.

### La asignación del folio

Esto merece ser explícito, porque es el defecto que se le critica al sistema
viejo y es fácil reproducirlo sin darse cuenta.

**La serie arranca en 10000.** El mayor folio del origen es 4121 y hay nueve
borradores abiertos hasta 4123, así que 10000 deja casi seis mil de holgura: ni
un folio nuevo puede coincidir con uno viejo, y de un folio se sabe al instante
qué sistema lo emitió.

**El contador vive en `fact_configuracion`**, bajo la clave
`prefactura_folio_siguiente`, con 10000 por omisión. Al cerrar, dentro de la
misma transacción: se lee la fila del contador **con `lockForUpdate()`**, se usa
su valor como folio, y se incrementa. El bloqueo de fila serializa dos cierres
simultáneos, así que el segundo espera y se lleva el folio siguiente.

**NO se usa `MAX(folio) + 1`.** Es exactamente lo que hace el sistema viejo
(`$folp = $hpref3+1`) y es lo que produjo sus 207 folios duplicados: entre leer
el máximo y escribir, otra sesión lee el mismo máximo. El índice único queda
como última red, no como el mecanismo.

### El sello al cerrar

Dentro de la misma transacción que asigna el folio:

```
subtotal = suma de los importes derivados de los renglones
iva      = subtotal * iva_tasa vigente
total    = subtotal + iva
```

Los tres a decimal(12,2), más la tasa usada. Una vez sellado, nada lo mueve.

## Flujo y pantallas

Subdepartamento nuevo: **`factPrefacturas`**. Endpoints bajo `api/facturacion`,
siguiendo el patrón del 1b: toda ruta de escritura con `subdep:factPrefacturas` y
403 a quien no lo tenga.

### La lista

Prefacturas con filtro por estado, matrícula, cliente y rango de fechas,
paginada del servidor. Reutiliza `useListaPaginada`, que el 1b ya extrajo y que
resuelve debounce, descarte de respuestas viejas y corrección de página fuera de
rango. Un borrador se identifica por matrícula y fecha; una cerrada, por su
folio.

### El editor

No es una pantalla de catálogo, así que `PantallaCatalogo` no aplica: es un
documento. Tres zonas — encabezado, renglones, totales.

**La sugerencia** vive en el encabezado: al teclear la matrícula, si hay una
llegada en `operaciones_diarias` sin prefactura, la pantalla la ofrece. Si se
acepta, precarga fecha, hora y lugar y graba el vínculo. **La ausencia de una
operación no bloquea nada.**

**Los renglones** se agregan desde el catálogo con su cantidad. Tres acciones
aparte: recalcular estancia, marcar internacional, y quitar un renglón.

**Los totales salen siempre del servidor.** La pantalla no suma ni calcula
ningún total: muestra `subtotal`, `iva` y `total` tal como los devuelve la API, que
los toma de los métodos del modelo (`subtotal()`, `iva()`, `total()`) o, en una
cerrada, del sello. `importeVistaPrevia` existe y está verificado contra el PHP,
pero se usa **solo** para la vista previa del renglón que se está tecleando en el
modal: el navegador da respuesta inmediata al capturar, y en cuanto el renglón se
guarda, la cifra que vale es la que devuelve el servidor. Es el mismo patrón del
precio de combustible sugerido del 1a: el cliente propone, el servidor decide.

La razón: la cifra que se cobra no puede depender de que dos implementaciones de la
fórmula (PHP y TypeScript) coincidan en el último centavo ni de aritmética de coma
flotante en el navegador. Si la pantalla sumara por su cuenta, un redondeo distinto
mostraría un total que no es el que se sella.

### Cerrar

Atómico: `UPDATE ... WHERE id = ? AND estado = 'borrador'`, y **409** si no
afectó ninguna fila. Dos personas no pueden cerrar la misma prefactura ni
consumir dos folios para un documento. Es el patrón de las bajas lógicas del 1a
y 1b, aplicado donde más importa, porque aquí lo que se consume es un folio.

Abrir es libre; cerrar exige estar completo: **matrícula, cliente y al menos un
renglón.** Sin cliente no se puede facturar, y es mejor que lo diga el sistema al
cerrar que descubrirlo con un folio ya consumido.

**Una prefactura cerrada no se edita.** Encabezado y renglones quedan de solo
lectura, y **el endpoint lo hace cumplir**, no solo la pantalla. Corregir una
cerrada es del bloque 3; en el sistema viejo eso se hace a mano sobre la base y
no hay que replicarlo por accidente.

### Bitácora

Toda escritura se registra, con el patrón atómico de
`FactPrecioCombustible::registrar()` —dentro de la transacción— y **no** el de
los controladores del 1b, que escriben fuera. El cierre de una prefactura es la
escritura donde el rastro no puede faltar. Esto retira la otra deuda anotada al
cerrar el 1b.

## Verificación contra el histórico

`facturacion:comparar-prefacturas`, de **solo lectura**. Nunca escribe.

Lee cada prefactura del histórico con sus renglones y recalcula con el código
nuevo usando **los mismos precios y las mismas cantidades que el sistema viejo
guardó**. Clasifica, porque ya sabemos que no todo va a coincidir y eso es
correcto:

| Clase | Esperado | Significado |
|---|---|---|
| Idénticas | ~3,034 | La fórmula coincide |
| Dentro de un peso | ~422 | Redondeo del float viejo. El número nuevo es el correcto |
| Estructurales | 37 | El total guardado no corresponde a sus renglones. Se enumeran una por una |
| Folio duplicado | 207 folios, 290 filas | Se excluyen y se reportan aparte |

### Qué prueba esto y qué no

**Prueba la fidelidad de la aritmética:** dados los mismos renglones, el mismo
precio y la misma cantidad, la fórmula da el mismo importe, el subtotal es la
suma, el IVA es 16% y el total es la suma.

**No prueba el extremo a extremo**, porque las cantidades de estancia las teclea
una persona y no son reproducibles desde el dato. Si alguien cobró dos pernoctas
donde correspondían tres, ninguna comparación lo detecta. Se dice explícitamente
para no prometer una red que no existe.

## Pruebas y sus límites

Pest sobre sqlite, como todo el proyecto. Más una prueba que vale por sí sola:
**que la fórmula del renglón, la de `FactServicio::importe()` y la de TypeScript
den el mismo número** sobre un barrido de precios, cantidades, márgenes y
ajustes. Hoy hay dos implementaciones verificadas idénticas; cuando se extraigan
a una, esa prueba es lo que evita que vuelvan a separarse.

Tres cosas que **sqlite no puede demostrar** y que van a la guía de despliegue:

1. Que el índice único del folio aguante **dos cierres simultáneos**.
2. Que el cierre atómico devuelva 409 bajo **dos conexiones reales**.
3. Que la collation no colapse dos valores distintos de `concepto`.

## Deuda que este bloque retira

- La identificación del servicio de combustible **por su nombre** pasa a ser una
  columna propia, y con ella se va la guarda de `UpdateServicioRequest`.
- `FactServicio::importe()` deja de ser código que solo ejercitan las pruebas.
- La regla de que una aeronave en **Guarda no paga estancia** queda aplicada.
- La bitácora del documento más importante queda **atómica con su escritura**.

## Deuda que este bloque NO retira

- Los **500 en lugar de 422** de dos altas simultáneas del mismo nombre en los
  catálogos del 1b, y la bitácora fuera de transacción de **sus** controladores.
  Este bloque usa el patrón correcto en lo nuevo; unificar los nueve
  controladores viejos es una tarea aparte.
- El nombre del comando `facturacion:importar-matriculas`, que ya importa mucho
  más que matrículas.
- Los 19 hallazgos menores listados en la guía de despliegue del 1b.

## Lo que queda abierto para el bloque 3

- **Pagos**: varios por prefactura, con cambio (`tb_formas_pago`, 3,534 filas).
- **Notas**: interna, externa y de factura (`tb_notas`, 215 filas).
- **Impresión** de la prefactura.
- **Corrección de una prefactura cerrada**, con su rastro.
- **La importación del histórico**, que hoy es parcial por construcción porque
  pagos y notas no tienen tabla. Cuando la tengan hay que decidir dos cosas: qué
  hacer con los 207 folios duplicados (consolidar, marcar, o dejarlos en el
  sistema viejo) y qué hacer con los 37 totales discrepantes. **[Corregido 2026-10-06: la cifra se midió y son 830, el 22% de los 3,764 folios, no 37; la peor diferencia es el folio 3544 por 561,749.93, no el 2622 por 29,000. Ver la guía de despliegue del bloque 5.]** **El usuario pidió
  aviso explícito cuando esto sea posible.**
