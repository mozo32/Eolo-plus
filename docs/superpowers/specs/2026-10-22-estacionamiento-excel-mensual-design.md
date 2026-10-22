# Estacionamiento subterráneo: descargable de Excel mensual

**Fecha:** 2026-10-22
**Rama base:** `vehiculos-tabla-desactivar` (punta `3ef5b4f`, 2459 pruebas en verde)
**Referencia pedida:** «como el de pernoctas por día»
(`resources/js/pages/seguridad/pernoctaDia/`), de donde se toman tanto la forma del
reporte —la rejilla de días— como el flujo con vista previa.

## Qué resuelve

Hoy los registros del estacionamiento solo se miran en pantalla, mes a mes. No hay forma
de sacarlos a una hoja de cálculo para contar cuántos días ocupó un cajón cada coche,
compararlo entre meses, o mandárselo a nadie.

## El dato de hoy

| Medida | Valor |
|---|---|
| Registros | 2 961 |
| Rango | 2026-02-14 a 2026-10-07 |
| Días con ronda | 128 |
| Placas distintas | 479 |
| Pares (placa, día) únicos | 2 491 |

Por mes:

| Mes | Registros | Placas | Días con ronda |
|---|---|---|---|
| 2026-02 | 200 | 111 | 10 |
| 2026-03 | 404 | 145 | 21 |
| 2026-04 | 431 | 132 | 16 |
| 2026-05 | 460 | 138 | 16 |
| 2026-06 | 350 | 93 | 14 |
| 2026-07 | 387 | 97 | 15 |
| 2026-08 | 328 | 62 | 16 |
| 2026-09 | 322 | 64 | 15 |
| 2026-10 | 79 | 30 | 5 |

Ningún campo viene vacío en ningún registro.

## Hechos medidos que deciden el diseño

### 1. El módulo NO modela estancias con entrada y salida

`fecha_salida` existe en la tabla, en `$fillable` y en `$casts` del modelo, pero **nada de
la aplicación la escribe**: los únicos sitios que escriben un `fecha_salida` son
`RegistroVisitantesController` y el formulario de CSAE, que son otros módulos. Los **2 961
registros tienen `fecha_salida` en NULL**, sin una sola excepción.

Lo que el módulo registra es **una fila por vehículo por cada día que la ronda lo ve**.
Lo confirma `EstacionamientoSubterraneoController::vehiculosMasDeCincoDias`, que para
contar días no resta fechas: agrupa por `UPPER(placas), DATE(fecha_ingreso)` y busca
rachas de días consecutivos con una consulta de huecos e islas.

Es el mismo modelo que pernoctas —una observación diaria de presencia—, y por eso la
rejilla encaja sin inventar ninguna regla de derivación: **un día se marca si existe un
registro de esa placa ese día**. No hay nada que calcular entre dos fechas.

### 2. La celda marca presencia, no cuenta registros

De los 2 491 pares (placa, día) únicos, **469 tienen más de un registro**. Si la celda
contara filas en vez de marcar presencia, los totales saldrían inflados en esos casos.
`show()` ya usa `GROUP_CONCAT(DISTINCT DAY(...))` por el mismo motivo.

### 3. Las rondas no son diarias

Entre 10 y 21 días con registro por mes, de 28 a 31 posibles. La rejilla tendrá columnas
vacías por diseño, y un hueco significa «ese día no hubo ronda», no «no había coches».

### 4. El endpoint que ya existe produce filas de más

`show($fecha)` agrupa por `(placas, vehiculo, matricula)`, no por placa. Una placa cuyo
`vehiculo` se escribió distinto algún día sale en **dos filas, con sus días repartidos
entre ellas y dos TOTALES equivocados**:

| Mes | Filas que devuelve `show()` | Placas reales | De más |
|---|---|---|---|
| 2026-09 | 71 | 64 | 7 |
| 2026-05 | 142 | 138 | 4 |
| **2026-03** | **202** | **145** | **57 (39%)** |

Por eso la exportación no reutiliza ese endpoint. No es preferencia: en marzo daría un
reporte un 39% equivocado.

### 5. Las placas ya están limpias

479 distintas tal cual, 479 aplicando `UPPER`, 479 aplicando `UPPER(TRIM(...))`. No hay
variantes de mayúsculas ni espacios sobrantes. La normalización se aplica igualmente,
porque es lo que ya hace `vehiculosMasDeCincoDias` y cuesta nada, pero no arregla nada
que esté roto hoy.

### 6. `oficial` es una constante y `llaves` es un hecho de la ronda

`oficial` vale la cadena literal «Oficial de Turno» en los 2 961 registros: no identifica
a nadie. `llaves` describe si ese día se dejaron las llaves, que es una propiedad de la
observación, no del coche. Ninguno de los dos entra en una rejilla cuya fila es una placa.

### 7. Los datos de identificación varían en una minoría de placas

Porcentaje de placas con un solo valor distinto en todo el histórico:

| Campo | Estable |
|---|---|
| `vehiculo` | 434/479 (91%) |
| `color` | 438/479 (91%) |
| `matricula` | 405/479 (85%) |
| `responsable` | 401/479 (84%) |

Como no son estables del todo, la fila necesita una regla: se toma el valor del
**registro más reciente del mes**, entendiendo «más reciente» como el de mayor
`fecha_ingreso` y, si dos empatan al segundo, el de mayor `id`. Sin ese desempate la
fila dependería del orden en que la base devuelva las filas, que no está garantizado.

## Alcance

**Entra:**

1. Un botón de Excel en cada mes de la lista «Registros por Periodo».
2. Un modal de vista previa que enseña la rejilla antes de descargar.
3. Una descarga: un libro, una hoja, la rejilla del mes.
4. Un endpoint nuevo que devuelve la rejilla ya agregada por placa.

**No entra:**

- **Arreglar `show()`.** Su defecto de agrupación (hecho 4) afecta hoy a la pantalla de
  detalle, que en marzo enseña 202 filas donde hay 145 coches. Es un arreglo real y
  pendiente, pero es de esa pantalla, no de esta exportación, y tocarlo cambiaría lo que
  ve el usuario en un sitio que nadie ha pedido cambiar. Queda señalado para su propio
  trabajo.
- **`fecha_salida`.** No se empieza a escribir, ni se calcula nada con ella. Que esté
  muerta es un hallazgo de esta spec, no un problema que esta spec resuelva.
- **Las columnas `oficial` y `llaves`** (hecho 6).
- **Exportar varios meses en un archivo.** El módulo está organizado por mes y el reporte
  de pernoctas es mensual. Un rango de meses sería otra cosa.
- **Candado de rol y rastro en bitácora.** Ver «Decisiones».

## Decisiones tomadas

| # | Decisión | Por qué |
|---|---|---|
| 1 | Rejilla de días, una fila por placa | Es la forma del reporte que se pidió por su nombre |
| 2 | Todas las columnas del mes, 1 a 28/29/30/31 | El archivo no cambia de ancho entre meses y un hueco dice «no hubo ronda» (hecho 3) |
| 3 | La celda marca presencia; el TOTAL son días distintos | Si contara registros, los 469 pares duplicados inflarían los totales (hecho 2) |
| 4 | Endpoint nuevo en vez de reutilizar `show()` | `show()` parte placas en varias filas: 39% de más en marzo (hecho 4) |
| 5 | Agrupar por `UPPER(TRIM(placas))` | Es lo que ya hace `vehiculosMasDeCincoDias`; hoy no cambia nada (hecho 5) pero evita que un espacio futuro parta una fila |
| 6 | Los cinco datos de identificación salen del registro más reciente del mes | No son estables en el 9–16% de las placas (hecho 7); el más reciente es lo que haría una persona |
| 7 | Fuera `oficial` y `llaves` | Una constante y un hecho de la ronda (hecho 6) |
| 8 | La vista previa y la descarga usan exactamente las mismas filas | Es lo que hace la vista previa digna de confianza; mismo invariante que la exportación de vehículos |
| 9 | Sin candado de rol | Es la misma información que ya está en la pantalla de detalle |
| 10 | Sin rastro en bitácora | Ninguna de las siete exportaciones del proyecto lo deja; `ACCION_EXPORTAR` está declarada y nadie la invoca |

## Arquitectura

### Servidor

**`GET /api/EstacionamientoSubTerraneo/Excel/{mes}`** (nuevo), dentro del grupo
`['api','auth:sanctum']` con prefijo `EstacionamientoSubTerraneo`, junto a las rutas que
ya hay.

`{mes}` llega como `YYYY-MM`. Si no cuadra con ese formato, 422.

Devuelve un objeto con el mes y sus filas:

```
mes    'YYYY-MM'
dias   número de días que tiene ese mes (28, 29, 30 o 31)
filas  [
         placas       UPPER(TRIM(placas))
         vehiculo     del registro más reciente del mes
         color        idem
         matricula    idem
         responsable  idem
         dias         [3, 4, 7, …]  días del mes con registro, ascendente, sin repetir
         total        número de días distintos
       ]
```

Las filas salen ordenadas por `placas` ascendente, que es un orden estable y es como se
busca una placa a ojo en una hoja.

`dias` viaja como lista de números de día y no como una fila de ceros y unos: es la misma
información en una décima parte del JSON, y es la forma que ya usa `show()` con su
`asistencias`.

El endpoint devuelve `filas: []` para un mes sin registros, no un 404: un mes vacío es
una respuesta válida, no un error.

### Pantalla

**`VehicleDashboard.tsx`** gana un botón de Excel en la celda «Acciones» de cada mes,
junto a los que ya hay. **Ojo:** el `<tr>` entero lleva `onClick={() => handleOpenDetail(mes)}`,
así que el botón nuevo tiene que llamar a `stopPropagation` o al pulsarlo se abrirá
también el detalle del mes.

**`ModalExcelEstacionamiento.tsx`** (nuevo) recibe el mes, consulta al abrirse, enseña la
rejilla y descarga. A diferencia del modal de la exportación de vehículos, aquí **no hay
filtros**: el mes es el único parámetro y ya viene elegido, así que la consulta se lanza
al abrir y no hay ningún botón de «Consultar».

La vista previa enseña **todas las filas** —como mucho 145, el peor mes medido— con
scroll horizontal, porque la rejilla es ancha. No se recorta: con 145 filas no hace falta,
y así la vista previa es literalmente el archivo.

**`excelEstacionamientoService.ts`** (nuevo) arma el libro con ExcelJS y lo entrega con
`file-saver`, siguiendo `ExcelPernoctaDia.ts`. El archivo se llama
`estacionamiento-YYYY-MM.xlsx`.

**`apiEstacionamientoSubterraneo.ts`** gana `getExcel(mes)`.

### El libro

Una hoja. Título en la primera fila, combinado: `SEPTIEMBRE 2026`, en mayúsculas y en
español, como el de pernoctas.

Encabezado: `PLACAS`, `VEHÍCULO`, `COLOR`, `MATRÍCULA`, `RESPONSABLE`, después una columna
por cada día del mes numerada `1`…`N`, y `TOTAL` al final.

Cada celda de día lleva `1` si la placa tiene registro ese día y se deja vacía si no. El
`TOTAL` es la cuenta de días.

La fila de encabezado va fija al desplazarse y las cinco primeras columnas también, para
que al llegar al día 28 se siga viendo de qué placa es la fila.

### Errores

| Caso | Qué pasa |
|---|---|
| Mes con formato inválido | 422 nombrando el parámetro; solo se alcanza llamando a mano |
| Mes sin registros | 200 con `filas: []`; el modal dice «No hay registros en este mes» y la descarga queda inactiva |
| Falla la red al consultar | Mensaje dentro del modal, que no se cierra |
| Falla la generación del libro | Mensaje dentro del modal; la vista previa se conserva |

### Pruebas

En Pest, en serie, sobre sqlite.

**Una placa con varios registros el mismo día cuenta un solo día.** Es el hecho 2, y es
lo que separa este reporte de uno con los totales inflados.

**Una placa cuyo `vehiculo` cambió entre días sale en UNA fila, no en dos.** Es el
defecto medido de `show()` (hecho 4) y la razón de que este endpoint exista; una prueba
que falle si alguien «simplificara» el agrupamiento al de allá.

**Los cinco datos de identificación salen del registro más reciente del mes**: con dos
registros de la misma placa y valores distintos, gana el posterior.

**Los días salen ascendentes, sin repetir, y el total cuadra con su longitud.**

**Solo entran los registros del mes pedido**: con registros en dos meses, pedir uno no
trae los del otro, ni siquiera los del último día del mes anterior.

**`dias` es correcto en el borde del mes**: un registro el día 1 y otro el último día
aparecen como tales.

**El número de días del mes es el del calendario**: febrero de 2026 da 28; un mes de 31
da 31. Sin esto, la rejilla podría quedarse corta de columnas.

**Un mes sin registros devuelve 200 con `filas: []`**, no un 404.

**Un mes mal formado devuelve 422.**

**Las placas se agrupan normalizadas**: dos registros con la misma placa en distinta caja
de letras caen en la misma fila. Hoy no ocurre en los datos (hecho 5), y precisamente por
eso la prueba es el único sitio donde esa regla queda fijada.

Del lado de la pantalla no hay nada que probar automáticamente: el proyecto no tiene
ningún ejecutor de pruebas de JavaScript. La verificación es `npx tsc --noEmit` contra la
línea base y `npm run build`.

## Riesgos

**La rejilla tendrá más columnas vacías que llenas.** Entre 10 y 21 días de ronda sobre
28–31 columnas. Es lo decidido y es información —dice qué días no hubo ronda—, pero el
primer día sorprende a quien espere una hoja llena.

**El reporte hereda los errores de captura.** Una placa tecleada mal un día es una fila
más en la rejilla, con un solo día. No es un defecto de la exportación: es lo que hay en
la base, y el Excel lo hace visible por primera vez. Puede que eso genere trabajo de
limpieza que hoy nadie ve.

**`show()` sigue roto.** Esta spec lo mide y lo deja documentado, pero no lo toca. Quien
compare el Excel con la pantalla de detalle del mismo mes verá distinto número de filas,
y el Excel será el correcto. Conviene arreglar `show()` pronto, aunque sea después.
