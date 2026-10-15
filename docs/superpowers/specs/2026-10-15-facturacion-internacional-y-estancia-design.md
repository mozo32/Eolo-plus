# Paquetes internacionales por dirección, y estancia calculada desde las fechas

**Fecha:** 2026-10-15
**Rama base:** `facturacion` (punta `e7946e4`, 3367 pruebas en verde)
**Bloques previos:** `2026-10-01-facturacion-2-prefactura-design.md` (el paquete
internacional y `CargosEstancia` nacen ahí), `2026-10-02-facturacion-3-pagos-y-notas-design.md`

## Qué resuelve

Dos defectos del módulo de Prefacturas que el departamento ve todos los días.

**El paquete internacional carga los servicios equivocados.** Hoy una prefactura
que se marca internacional recibe cuatro servicios de *salida* (DSMES, DSM,
Mex-eAPI salida, Servicios Internacionales salida). Los de *entrada* no existen en
ningún paquete, así que una aeronave que llega del extranjero no recibe ninguno de
los suyos y el operador los teclea a mano.

**La estancia se teclea entera.** El operador sabe cuándo llegó y cuándo salió la
aeronave, y aun así escribe a mano cuántas pernoctas y cuántos tránsitos cobrar.
El sistema viejo lo calcula solo al guardar la salida.

Esto no añade un bloque nuevo a la migración: corrige y completa el bloque 2.

## Lo que se revierte, y por qué se puede

`CargosEstancia` lleva escrito, desde el bloque 2, que las cantidades **no** se
derivan de las fechas:

> Las cantidades las teclea la persona. NO se derivan de las fechas: eso cambiaría
> cobros y necesitaría su propia verificación contra el histórico.

Esa decisión era correcta en su momento y se revierte aquí porque **la
verificación ya está hecha** (ver «Hechos medidos», punto 3). La condición que
ponía el bloque 2 se cumple; sin ella, esta spec no existiría.

## El dato de origen

Base legada, conexión `remota`, apuntando a `fact_fbo_20261014` (volcado del
2026-10-14). **Solo se lee.**

| Tabla | Filas | Para qué |
|---|---|---|
| `tb_llegadas` | 3 971 | `Fecha_lleg`, `Fecha_sal`, `id_origen`, `id_destino` por folio. Es la tabla que permite verificar la regla de estancia. |
| `tb_venta` | 10 587 | Las cantidades realmente cobradas de cada servicio. |
| `tb_servicio` | 54 | Los nombres y los ids de los servicios de los dos paquetes. |
| `tb_destino` | 2 | 1 = Nacional, 2 = Internacional. |

## Hechos medidos que deciden el diseño

### 1. El paquete no es uno, son dos, y los dispara una dirección distinta

`tb_llegadas` guarda `id_origen` e `id_destino` por separado. Cruzando esas dos
columnas con los servicios realmente cobrados en cada folio:

| Combinación | Folios | Servicios de ENTRADA | Servicios de SALIDA |
|---|---|---|---|
| nacional → nacional | 3 398 | ~0 % | ~1 % |
| **internacional** → nacional | 220 | **58 %** (DSMEE) | ~3 % |
| **internacional** → **internacional** | 99 | **69 %** | **80 %** (DSMES) |
| nacional → **internacional** | 166 | ~2 % | **72 %** |

El contraste es inequívoco: entre el ~1 % y el 58-80 % no hay ambigüedad. **El
origen internacional pide el paquete de entrada; el destino internacional, el de
salida, y son independientes.**

Las cifras no llegan al 100 % porque el operador borra después lo que no aplica.
Eso no debilita la conclusión: lo que se mide es qué paquete se carga, no cuántos
servicios sobreviven a la edición.

### 2. De 485 folios internacionales, 386 lo son en una sola dirección

220 llegan del extranjero y salen a destino nacional; 166 al revés. Solo 99 lo son
en las dos. **Un único interruptor «es internacional» cargaría el paquete
equivocado en el 80 % de los casos**, y el operador tendría que borrar a mano
justo lo que esto viene a ahorrarle.

### 3. La regla de estancia acierta en el 86,1 % de 2 803 folios históricos

Reconstruyendo la duración desde `tb_llegadas` y comparando contra las cantidades
cobradas en `tb_venta` para los servicios 2 (`Tránsito 02 hrs`), 3 (`Tránsito 12
hrs`) y 4 (`Tránsito 24 hrs - pernocta`):

| | |
|---|---|
| Folios comparados | 2 803 |
| La regla acierta | **2 412 (86,1 %)** |
| Falla | 391 (13,9 %) |
| Con fechas inservibles (salida anterior a la llegada, o nulas) | 31 |

Los desajustes se agrupan, y ninguno parece una regla distinta:

| Casos | Patrón | Lectura |
|---|---|---|
| 125 | se predice un tramo corto que no se cobró | cortesía del operador en un resto pequeño |
| 79 | resto de 2 a 12 h cobrado como `02 hrs` | redondeo a la baja del operador |
| ~90 | estancias larguísimas a tanto alzado | un folio de 133 días cobró 1 pernocta |

### 3b. Una medición mía fue engañosa, y conviene dejarlo escrito

Al sacar una tabla de «resto → qué se cobró», filtré a los folios cuyas pernoctas
ya cuadraban con los días completos. Esa tabla parecía decir que un resto de más
de 12 h cobra `Tránsito 12 hrs`. Es falso: el filtro excluía precisamente los
casos en que ese resto se convierte en una pernocta más. Al aplicar esa
«corrección» el acierto **cayó del 86,1 % al 62,0 %**.

La regla buena es la de abajo. Quien revise esta spec no debe rehacer ese atajo.

### 4. «Despacho de Vuelos» no es un servicio internacional

Aparece en el **53 % de los folios puramente nacionales**. Estaba en la lista de
siete que el departamento describió, y se deja fuera del paquete: cargarlo solo en
las internacionales lo haría aparecer justo donde menos corresponde. Se sigue
agregando a mano, como hoy.

`Mex-eAPI - entrada` aparece solo en el 4-6 % de las llegadas internacionales. Se
**conserva** en el paquete por decisión del departamento, que manda sobre el
histórico: el histórico refleja lo que quedó tras editar, no lo que se cargó.

### 5. Los campos de fecha son `datetime-local`

`EditorPrefactura.tsx` usa `<input type="datetime-local">` para llegada y salida.
El navegador lo pinta según el idioma del sistema: en español sale un selector de
12 horas con AM/PM y la hora se teclea por casillas. `<input type="time">` tiene
exactamente el mismo problema y no sirve como recambio.

## Alcance

**Entra:**

1. `tipo_origen` en la prefactura, junto al `tipo_destino` que ya existe.
2. El catálogo distingue paquete de entrada y de salida.
3. Marcar el origen internacional carga el paquete de entrada; marcar el destino,
   el de salida.
4. La hora de llegada y de salida se escribe en formato de 24 horas.
5. Al guardar la salida, las cantidades de estancia se calculan desde las fechas.
6. Un comando de verificación que contrasta el cálculo contra el histórico.

**No entra:**

- **Los dos ajustes de estancia** (de 2 h a 12 h y de 12 h a pernocta) siguen
  siendo manuales. El histórico no da para derivarlos y forzarlo cambiaría cobros
  sin evidencia.
- **El 13,9 % de casos que la regla no reproduce.** No se intenta modelar la
  cortesía del operador ni los acuerdos a tanto alzado: para eso las cantidades
  siguen siendo editables.
- **Las prefacturas cerradas.** Ni el paquete ni el cálculo las tocan; la guarda de
  `CargosEstancia` ya lo impide y no se relaja.
- **Reinterpretar las prefacturas existentes.** `tipo_destino` conserva su
  significado, así que ninguna fila actual cambia de sentido.

## Decisiones tomadas

| # | Decisión | Por qué |
|---|---|---|
| 1 | Dos interruptores, origen y destino, no uno | 386 de 485 folios internacionales lo son en una sola dirección (hecho 2) |
| 2 | El paquete de entrada son 6 servicios, sin «Despacho de Vuelos» | Está en el 53 % de los folios nacionales (hecho 4) |
| 3 | Un resto de más de 12 h redondea a una pernocta más | 86,1 % contra 62,0 % de la alternativa (hechos 3 y 3b) |
| 4 | El cálculo propone y el operador puede corregir | El 13,9 % que no reproduce es dinero y tiene explicación humana |
| 4b | Solo se recalcula cuando la salida CAMBIA, no en cada guardado | Si no, un guardado por otro motivo borra la corrección manual sin avisar |
| 5 | La hora es un campo de texto `HH:MM`, no `type="time"` | `type="time"` repite el defecto de idioma (hecho 5) |
| 6 | El criterio de aceptación es reproducir el 86,1 % | Si sale otra cifra, el código no hace lo que la medición dice |
| 7 | Los paquetes se identifican por id del ORIGEN, no por id local | El importador renumera: `Servicios Internacionales - entrada` es 92 allá y 38 aquí |

## Arquitectura

### Datos

**`fact_prefacturas`** gana una columna:

```
tipo_origen  enum('nacional','internacional')  NOT NULL  default 'nacional'
```

Misma forma que `tipo_destino`, para que las dos se lean igual. Por omisión
nacional: ninguna prefactura existente cambia de comportamiento.

**`fact_servicios`** cambia la columna del paquete:

```
en_paquete_internacional  boolean        -->  paquete_internacional  enum('entrada','salida') NULL
```

La migración traduce: las filas hoy marcadas pasan a `salida`, y los seis de
entrada se marcan `entrada`. Los ids del origen que definen cada paquete viven en
`ImportadorMatriculas`, donde ya vive hoy la lista:

| Paquete | Ids del origen | Servicios |
|---|---|---|
| `salida` | 9, 10, 14, 93 | DSMES-salida, DSM-salida, Mex-eAPI-salida, Servicios Internacionales-salida |
| `entrada` | 8, 11, 12, 13, 15, 92 | DSMEE-entrada, DNR-entrada, AIU, Mex-eAPI-entrada, Basura SENASICA, Servicios Internacionales-entrada |

La migración debe emparejar **por nombre**, no por id, porque los ids locales no
coinciden con los del origen. Si un nombre no se encuentra, la migración lo deja
registrado y sigue: un paquete incompleto se detecta en pantalla (el aviso de
`agregarPaqueteInternacional` ya existe), pero una migración que falle a medias
deja el catálogo en un estado peor.

### Componentes

**`CalculadoraEstancia`** (nuevo, `app/Services/`). Puro: sin base de datos, sin
estado, sin dependencias. Es la pieza que se puede probar a fondo y contrastar
contra 2 803 folios sin montar nada.

```php
/** @return array{pernoctas: int, transitos2h: int, transitos12h: int} */
public static function tramos(CarbonInterface $llegada, CarbonInterface $salida): array
```

La regla, en minutos:

```
duración = salida - llegada
si duración <= 0          -> todo en cero
días      = intdiv(duración, 1440)
resto     = duración % 1440

resto == 0                -> pernoctas = días
resto <= 120              -> pernoctas = días, transitos2h = 1
resto <= 720              -> pernoctas = días, transitos12h = 1
resto > 720               -> pernoctas = dias + 1
```

Una salida anterior o igual a la llegada devuelve ceros en lugar de lanzar: el
editor ya valida ese caso y la calculadora no debe ser una segunda puerta que
responda distinto.

**`CargosEstancia::agregarPaqueteInternacional()`** pasa a recibir cuál paquete.
Todo lo demás se conserva sin tocar: el candado sobre la prefactura, el rechazo de
una cerrada, no duplicar lo ya puesto, y el aviso con nombre y apellido de los
servicios dados de baja que no se agregaron.

**`CargosEstancia::recalcular()`** no cambia. Sigue recibiendo las cinco
cantidades y poniendo las tarifas de la matrícula, aplicando la regla de Guarda y
conservando las cortesías. La calculadora le da las tres primeras; los dos ajustes
siguen llegando del formulario.

### Flujo

```
El operador marca el ORIGEN internacional
  -> agregarPaqueteInternacional(prefactura, ENTRADA)
  -> 6 renglones, los que falten

El operador marca el DESTINO internacional
  -> agregarPaqueteInternacional(prefactura, SALIDA)
  -> 4 renglones, los que falten

El operador guarda la cabecera con llegada Y salida
  -> CalculadoraEstancia::tramos(llegada, salida)
  -> CargosEstancia::recalcular(prefactura, ...tramos, ajustes del formulario)
  -> los renglones quedan puestos, y editables
```

El cálculo se dispara **solo si hay llegada y salida, y solo cuando la salida
CAMBIA**. Las dos condiciones importan:

- Guardar una cabecera con la llegada sola no toca la estancia: la aeronave sigue
  en tierra y todavía no hay nada que cobrar.
- Guardar la cabecera por otro motivo —corregir el cliente, el origen— **no vuelve
  a calcular**. Si no fuera así, un operador que corrigió a mano las cantidades del
  13,9 % perdería su corrección la próxima vez que tocara cualquier otro campo, sin
  avisarle. El mismo criterio y por la misma razón que
  `OperacionesDiariasController::validarFechaSiCambia()`, que ya existe en el
  proyecto: la regla se aplica al dato que cambia, no a cada guardado.

Para volver a calcular sin cambiar la salida está el botón de recalcular estancia,
que ya existe.

### Errores

| Caso | Qué pasa |
|---|---|
| Salida anterior a la llegada | El editor ya lo rechaza antes de enviar; la calculadora devuelve ceros si llega igualmente |
| Aeronave en Guarda o sin ficha | `recalcular()` ya lo resuelve: no cobra estancia y lo explica. No cambia |
| Prefactura cerrada | `CargosEstancia` ya la rechaza con su candado. No cambia |
| Un servicio del paquete dado de baja | Ya se avisa por nombre. Se conserva para los dos paquetes |
| La hora escrita no es `HH:MM` válida | El campo lo rechaza antes de enviar, con mensaje |

### Pruebas

**`CalculadoraEstancia`** lleva pruebas unitarias con los casos frontera, que son
donde vive el riesgo: resto exacto de 0, de 120 y de 121 minutos, de 720 y de 721,
duración de cero, salida anterior a la llegada, y los dos ejemplos que dio el
departamento (7 días exactos → 7 pernoctas; 7 días y 8:15 → 7 pernoctas y 1
tránsito de 12 h).

**Los paquetes** se prueban como se prueba hoy el que existe: que agrega los que
faltan y no duplica los puestos, que un servicio de baja no se agrega y se avisa,
que marcar origen no toca el destino ni al revés, y que una prefactura cerrada se
rechaza.

**El comando de verificación** `facturacion:comparar-estancia` es de solo lectura,
hermano de `comparar-prefacturas` y `comparar-pagos`. Recorre `tb_llegadas`,
aplica `CalculadoraEstancia` y contrasta contra `tb_venta`. Su salida incluye el
porcentaje de acierto y los patrones de desajuste agrupados.

**Criterio de aceptación:** ese comando debe reportar **86,1 % sobre 2 803
folios**. No es una meta aproximada: es la cifra que produjo la medición que
justifica esta spec. Una cifra distinta significa que el código no implementa la
regla medida, y hay que averiguar por qué antes de seguir.

## Riesgos

**Cambiar cobros sin querer.** Es el riesgo real y por eso el cálculo propone en
lugar de imponer, y por eso las cantidades siguen siendo editables. El comando de
verificación es la red: si una refactorización futura altera la regla, el
porcentaje se mueve y se nota.

**La frontera de las 2 horas es la más borrosa del histórico.** En el tramo de 2 a
4 horas, 228 folios cobraron `12 hrs` y 80 cobraron `02 hrs`. La regla elige
`12 hrs` por mayoría. Es la zona donde más veces el operador tendrá que corregir, y
conviene saberlo antes de que alguien lo reporte como defecto.

**Dos interruptores son más que uno.** Añadir `tipo_origen` significa una columna,
un control en pantalla y un endpoint más. El hecho 2 lo justifica, pero si el
departamento acaba marcando los dos siempre juntos, sobra uno. Conviene mirarlo a
los tres meses.
