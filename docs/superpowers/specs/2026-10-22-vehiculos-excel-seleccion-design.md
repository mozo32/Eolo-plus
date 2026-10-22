# Movimientos de vehículos Eolo: exportar a Excel los vehículos seleccionados

**Fecha:** 2026-10-22
**Rama base:** `vehiculos-tabla-desactivar` (punta `27575ed`, 2444 pruebas en verde)
**Proyecto hermano:** este trabajo es el punto 2 de la petición original. Los puntos
1, 3 y 4 —número económico, desactivar vehículo y orden por uso— ya están hechos y
tienen su propia spec: `2026-10-22-vehiculos-tabla-desactivar-y-orden-design.md`.
Esta spec se apoya en ellos: la columna de casillas se añade *antes* de la columna
«Vehículo / N. económico», que allí se creó.

## Qué resuelve

Hoy la bitácora de un vehículo solo se puede mirar en pantalla, de uno en uno, dentro
de un modal. No hay forma de sacar los movimientos de varias unidades a la vez, ni de
llevárselos a una hoja de cálculo para sumarlos, compararlos o mandarlos a nadie.

El departamento quiere seleccionar las unidades que le interesan, acotar por chofer,
fechas y tipo de movimiento, ver lo que va a salir antes de bajarlo, y descargar un
Excel.

## El dato de hoy

| Medida | Valor |
|---|---|
| Vehículos | 6 |
| Movimientos | 1 389 |
| Rango de fechas | 2026-02-06 a 2026-10-08 |
| Filas de evidencia fotográfica | 307 |

Llenado de cada campo, sobre los 1 389 movimientos:

| Campo | Lleno |
|---|---|
| `gasolina` | 1 389 |
| `destino` | 1 236 |
| `autoriza` | 695 |
| `matricula` | 560 |
| `motivo` | 560 |
| `observaciones` | 46 |

`matricula` y `motivo` coinciden en 560: son el par que liga un viaje con una aeronave.

## Hechos medidos que deciden el diseño

### 1. En este proyecto el Excel se arma en el CLIENTE

No hay ningún paquete de Excel en `composer.json` —ni Maatwebsite, ni PhpSpreadsheet,
ni openspout—. Las seis exportaciones que existen se arman en TypeScript; el servidor
solo sirve las filas. `package.json` trae `exceljs`, `file-saver`, `xlsx` y
`xlsx-js-style`, así que hay más de un estilo en circulación: el precedente que esta
spec sigue es el de operaciones diarias, que usa **ExcelJS + file-saver**.

### 2. Y cada exportación tiene su propio endpoint `/Excel/`

`routes/api.php` ya expone cuatro: `OperacionesDiarias`, `Remision`, `TurnoAutotanque`
e `InspeccioAutotanque`, todos como `GET .../Excel/`. Es el patrón de la casa; esta
exportación lo sigue en vez de inventar otro.

### 3. Ya existe un modal casi idéntico al que se pide

`resources/js/pages/Trafico/operacionesDiarias/ExcelOperacionesModal.tsx` (599 líneas)
hace exactamente el flujo pedido: filtros, vista previa, descarga. Y declara en su
propia interfaz el invariante que importa: «La vista previa y la descarga utilizan
exactamente las mismas filas». Esta pantalla lo hereda.

### 4. `obtenerHistorial` no sirve como fuente para el Excel

Por dos razones distintas:

- **Es de un vehículo a la vez.** La ruta es `/vehiculos/{id}/movimientos`.
- **Hace trabajo de disco que el Excel no necesita.** Por cada imagen de cada
  movimiento llama a `Storage::disk($disk)->exists($path)` para construir su URL. En
  una exportación de la flota entera eso son hasta 307 llamadas al sistema de archivos
  para producir datos que el libro de Excel no contiene.

Por eso el endpoint es nuevo y devuelve filas planas sin imágenes, no un bucle de seis
llamadas al que ya existe.

### 5. `HistorialVehiculo` filtra al teclear; aquí no

`HistorialVehiculo.tsx` recarga en un `useEffect` cada vez que cambia cualquier filtro.
La petición pide «un botón que diga consultar», así que este modal **no** consulta
hasta que lo pulsan. Se reutilizan los cuatro campos —chofer, fecha inicio, fecha fin,
tipo— no el disparador.

### 6. `ACCION_EXPORTAR` existe en `Bitacora` y nadie la usa

La constante está declarada en `app/Models/Bitacora.php:32`. Un `grep` de
`ACCION_EXPORTAR` sobre `app/` no devuelve ninguna llamada: **ninguna exportación del
proyecto deja rastro**. Esta tampoco: ver «Decisiones».

## Alcance

**Entra:**

1. Una columna de casillas antes de «Vehículo / N. económico», con casilla de
   seleccionar todo en la cabecera.
2. Un botón «Excel» junto a «Nuevo Vehículo», inactivo mientras no haya selección.
3. Un modal con los cuatro filtros de `HistorialVehiculo` y un botón «Consultar».
4. Una vista previa de las primeras 100 filas, con el total a la vista.
5. Una descarga: un libro, una hoja, doce columnas fijas, todas las filas.
6. Un endpoint nuevo que sirve los movimientos de varios vehículos a la vez.

**No entra:**

- **Emparejar salidas con entradas en viajes.** Un renglón por movimiento, que es lo
  que se pidió. Emparejar exigiría una regla nueva para las salidas sin entrada y las
  entradas huérfanas, y medirla contra los 1 389 movimientos antes de confiar en ella.
- **Las evidencias fotográficas.** No caben en una celda y son el motivo del trabajo de
  disco del hecho 4.
- **Rastro en bitácora de quién exportó.** Ver «Decisiones».
- **Programar el reporte o mandarlo por correo.** No se pidió.
- **Ordenar la tabla principal desde la pantalla.** Sigue fuera, como en la spec hermana.

## Decisiones tomadas

| # | Decisión | Por qué |
|---|---|---|
| 1 | Una sola hoja, con columna «Vehículo» y «N. económico» | Deja que el propio Excel filtre, ordene y totalice sobre el conjunto; una hoja por unidad impediría comparar |
| 2 | Las doce columnas siempre, en orden fijo | El archivo tiene siempre la misma forma; ocultar una columna vacía es un clic, pero un archivo que cambia de forma según el filtro rompe a quien lo procese |
| 3 | La vista previa muestra 100 filas y el total | Su trabajo es confirmar que son los datos correctos, no leerlos; así el modal abre al instante con 1 389 filas detrás |
| 4 | Un renglón por movimiento | Es lo pedido, y una salida sin su entrada se ve igual que las demás |
| 5 | Un vehículo desactivado SÍ se exporta | Su bitácora es consultable por diseño (decisión 6 de la spec hermana); exportar es leer |
| 6 | Sin candado de rol | Es la misma información que esa persona ya tiene delante en la tabla y en el modal de historial |
| 7 | Sin rastro en bitácora | Ninguna exportación del proyecto lo deja (hecho 6). Añadirlo solo aquí haría incoherente el registro: parecería que esta es la única exportación que ocurre |
| 8 | La vista previa y la descarga usan exactamente las mismas filas | Es lo que hace la vista previa digna de confianza, y el invariante que ya declara el modal de operaciones (hecho 3) |
| 9 | El endpoint rechaza una lista de vehículos vacía | Sin eso, un descuido en la pantalla exporta la flota entera en silencio |
| 10 | La selección vive en `ControlVehiculos`, no en la fila | La tabla se recarga entera tras cada movimiento y tras cada cambio de `activo`; un estado guardado en la fila se perdería en cada recarga |

## Arquitectura

### Servidor

**`GET /api/VehiculoEolo/Excel/`** (nuevo), dentro del grupo `['api','auth:sanctum']`
con prefijo `VehiculoEolo`, junto a las rutas que ya hay.

Parámetros de consulta:

| Parámetro | Regla |
|---|---|
| `vehiculos` | obligatorio, arreglo, mínimo 1; cada elemento debe existir en `vehiculos.id` |
| `chofer` | opcional, coincidencia parcial |
| `tipo` | opcional, `Entrada` o `Salida` |
| `fecha_inicio` | opcional, fecha |
| `fecha_fin` | opcional, fecha |

Los cuatro filtros opcionales se comportan **igual que en `obtenerHistorial`**: `chofer`
es un `like %…%`, y las fechas comparan contra `created_at` con `whereDate`, inclusivas
por los dos extremos.

Devuelve un arreglo plano, ordenado por `created_at` descendente y luego por
`vehiculo_id`, con un objeto por movimiento:

```
vehiculo        nombre del vehículo
numeroEconomico vehiculos.id
fechaHora       created_at, 'Y-m-d H:i'
tipo            Entrada | Salida
chofer
kilometraje
gasolina
destino
autoriza
matricula
motivo
observaciones
```

Sin imágenes, sin relación `imagenes`, sin tocar el disco.

`vehiculos` llega como arreglo porque un Excel de una sola unidad es el mismo caso con
un elemento: no hay una segunda ruta para el caso de uno.

### Pantalla

**`ControlVehiculos.tsx`** gana un `Set<string>` con los ids seleccionados y el estado
de apertura del modal. Pasa a `TablaVehiculos` la selección, el conmutador de una fila
y el de seleccionar todo. El botón «Excel» vive junto a «Nuevo Vehículo» en la cabecera
y se activa con el primer id seleccionado.

**`TablaVehiculos.tsx`** gana la columna de casillas, primera, con la casilla de
cabecera. Esa casilla refleja tres estados: vacía si no hay nada seleccionado, marcada
si están todos, indeterminada si hay algunos.

**`FilaVehiculo.tsx`** gana su casilla como primera celda. Nada más: las cuatro acciones
y la insignia de desactivado se quedan como están.

**`ExcelVehiculosModal.tsx`** (nuevo) es el modal: los cuatro filtros, «Consultar», la
tabla de vista previa y «Descargar Excel». Mantiene las filas consultadas en su estado;
el botón de descarga está inactivo hasta que una consulta devuelve al menos una fila, y
se vuelve a desactivar si cambian los filtros sin volver a consultar — así no se puede
descargar algo distinto de lo que se está viendo.

**`excelVehiculosService.ts`** (nuevo) arma el libro con ExcelJS y lo entrega con
`file-saver`, siguiendo `resources/js/pages/Trafico/operacionesDiarias/excelService.ts`.
Recibe las mismas filas que pinta la vista previa. El archivo se llama
`movimientos-vehiculos-YYYY-MM-DD.xlsx` con la fecha de la descarga.

**`apiVehiculoEolo.ts`** gana `getExcel(vehiculoIds, filtros)`, que arma la cadena de
consulta con `URLSearchParams` y `vehiculos[]` repetido una vez por id.

### Errores

| Caso | Qué pasa |
|---|---|
| Ningún vehículo seleccionado | El botón «Excel» no se activa; no hay nada que pulsar |
| Lista de vehículos vacía llegando al servidor | 422; solo se alcanza llamando a mano |
| Un id que no existe | 422 de validación, nombrando el parámetro |
| La consulta no devuelve filas | «No hay movimientos con esos filtros»; la descarga sigue inactiva |
| Falla la red al consultar | Mensaje dentro del modal, que no se cierra, y los filtros se conservan |
| Falla la generación del libro | Mensaje dentro del modal; la vista previa se conserva |
| Un vehículo desactivado entre los seleccionados | Se exporta con normalidad (decisión 5) |

### Pruebas

En Pest, en serie, sobre sqlite.

**El filtro por varios vehículos**, que es lo único que el endpoint hace y que no hacía
nada antes: con tres vehículos y movimientos en los tres, pedir dos devuelve los
movimientos de esos dos y ninguno del tercero.

**Cada filtro opcional por separado**: chofer parcial, tipo, fecha inicio y fecha fin,
cada uno con una prueba que falle si ese filtro se quitara. Las fechas, inclusivas en
los dos extremos, con un movimiento justo en cada borde.

**Los filtros combinados**: vehículo y fecha a la vez, para que no baste con que cada
uno funcione aislado.

**Un vehículo desactivado se exporta**: es la decisión 5, y es exactamente lo que
alguien «arreglaría» por error más adelante.

**La respuesta no trae imágenes**: ninguna clave de imagen en ningún objeto. Esta
prueba es la que protege el hecho 4 de una regresión que volvería a cargar el disco.

**La lista vacía se rechaza** con 422, y **un id inexistente** también.

**La forma de cada fila**: las doce claves, con los nombres exactos que consume el
servicio de Excel.

Del lado de la pantalla no hay nada que probar automáticamente: el proyecto no tiene
ningún ejecutor de pruebas de JavaScript. La verificación es `npx tsc --noEmit` contra
la línea base y `npm run build`.

## Riesgos

**La vista previa enseña 100 filas y la descarga trae todas.** Es deliberado y está
rotulado en pantalla, pero es la clase de cosa que alguien lee mal una vez. El
encabezado dice el total, no solo lo mostrado.

**Doce columnas con tres casi vacías.** `observaciones` viene lleno en 46 de 1 389
filas. El archivo tendrá columnas que casi siempre están en blanco; es el precio de que
siempre tenga la misma forma, y fue una decisión explícita.

**El endpoint nuevo no lleva candado de rol.** Es coherente con que cualquiera que abra
la pantalla ya ve esos mismos datos, pero concentra en una sola llamada lo que antes
costaba seis modales. Si el departamento decide más adelante que exportar debe limitarse
—como se limitó desactivar—, es un `hasAnyRole` en una línea y una prueba, igual que allá.
