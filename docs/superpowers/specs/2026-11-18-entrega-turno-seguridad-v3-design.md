# Entrega de Turno de Seguridad — tercera versión: un relevo por día

**Fecha:** 2026-11-18
**Rama de origen:** `entrega-turno-seguridad`
**Spec que sustituye:** `docs/superpowers/specs/2026-11-09-entrega-turno-seguridad-v2-design.md`

La v2 quitó las ocho casillas que alguien marcaba y las sustituyó por conteos
leídos de los demás módulos de Seguridad. Esa consulta automática deja sin
razón de ser a lo que quedaba del diseño original: si el relevo ya no se
contesta a mano, no hace falta llenarlo dos veces al día ni decir desde qué
puesto se llenó.

Esta versión elimina el puesto —caseta y plataforma— y con él el agrupamiento
por fecha en la tabla. El relevo pasa a ser **un documento por registro**.

Lo que **no** cambia: la ventana de hoy y ayer, el borrado lógico, las tres
firmas y sus permisos, el congelado al cerrar, la cola de pendientes, el botón
FILTRAR, que todos los roles vean la vista previa y el diseño visual de las
pantallas.

---

## 1. Lo que se elimina

**El puesto, entero.** La columna `seccion` se borra de la base. Con ella se
van las constantes `SECCION_CASETA`, `SECCION_PLATAFORMA` y `SECCIONES` del
modelo, la regla `seccion` de los tres Form Request, el filtro de puesto del
listado, el selector del formulario, el modal `SelectorSeccion` y las dos
columnas CASETA y PLATAFORMA de la tabla.

**El agrupamiento por día.** El listado paginaba días y armaba por cada uno
dos celdas, una por puesto. Ahora pagina registros: un renglón por relevo.

No se pone candado de uno por día. Lo decidió el usuario y coincide con lo que
el modelo ya argumentaba: un relevo extra —un turno partido, una emergencia—
es un dato verdadero y el sistema no debe negarse a guardarlo. Lo que
desaparece es la *obligación* de llenarlo dos veces, no la *posibilidad*.

Como consecuencia, el campo `extras` del listado también se va: existía solo
para avisar de que un puesto tenía más de un registro ese día, y sin
agrupamiento cada registro es su propio renglón.

## 2. Los relevos que ya existen

La base tiene cinco relevos: dos de caseta y tres de plataforma, con un día
que trae los dos puestos y otro con dos registros del mismo. Los cinco están
congelados.

Ninguno se pierde ni se fusiona. Cada uno pasa a ser un renglón con su fecha,
su hora, su firma y su resumen; lo único que pierden es la etiqueta del
puesto, que ya no significa nada. El día que traía los dos puestos sale como
dos renglones de la misma fecha, que es exactamente lo que son.

El `down()` de la migración devuelve la columna pero no sus valores: eso se
pierde de verdad. Está aceptado.

## 3. El texto de «sin registros»

El resumen sigue trayendo sus seis renglones siempre, también cuando todos
valen cero. Cambia lo que dicen al valer cero:

| Renglón | Antes | Ahora |
|---|---|---|
| Los cinco de dos lados | `Sin registros` | **`No hay movimientos`** |
| `pernocta` | `Sin pernoctas` | **`No hay pernoctas`** |

La pernocta no dice «no hay movimientos» a propósito: una aeronave que se
queda a dormir no se mueve, y la frase sería falsa. Las dos se parecen para
que la columna lea igual.

### El texto ya congelado

Un relevo cerrado guarda su resumen y deja de consultar, así que los cinco que
existen seguirían diciendo `Sin registros` para siempre. La misma migración
reescribe esa frase dentro del JSON congelado, autorizado por el usuario.

Reescribe **solo el texto**. Las cifras —`entradas`, `salidas`, `total`— no se
tocan: son lo que hace del relevo un documento, y cambiarlas sería falsificarlo.
Cambiar una frase que se deriva de esas cifras no cambia lo que el documento
dice.

La migración recorre los relevos con `resumen` no nulo y, renglón por renglón,
sustituye `Sin registros` por `No hay movimientos` y `Sin pernoctas` por `No
hay pernoctas`. El `down()` hace la sustitución inversa.

## 4. El listado

`GET /api/EntregaTurnoSeguridad` pasa de paginar días a paginar relevos.

El piso y el techo de `per_page` se quedan como están: un `0` o un `-5` dan 1
y un `100000` da 100. Hay pruebas que lo exigen.

El orden es `fecha_hora` descendente y, a igualdad, `id` descendente: lo más
reciente primero, y los dos registros de un mismo día legado salen juntos y en
orden.

### Lo que se borra del controlador

Esta versión quita código en vez de añadirlo. Dejan de existir:

- `filasDeLosDias()` y `seccionDelDia()` — armaban las dos celdas del día.
- `diasSinFirmaDe()` y `diasIncompletos()` — calculaban el estado por día.
- La constante `DIA` y los `whereIn(DB::raw(...))` que la usaban.

Sobrevive `pernoctaDe()`, que decide si la pernocta sale congelada o en vivo.

### El filtro de estado

Pasa a juzgarse por registro, que es lo que lo simplifica:

| `estado` | Antes | Ahora |
|---|---|---|
| `falta_jefe_area` | días con algún registro sin esa firma | `whereDoesntHave` esa firma |
| `falta_fbo` | días con algún registro sin esa firma | `whereDoesntHave` esa firma |
| `completas` | días a los que no les falta ninguna | `whereHas` las dos de cierre |

Con un relevo al día las dos lecturas dicen lo mismo. En los días legados con
dos registros, la nueva juzga cada renglón por su cuenta, que es más honesto:
antes un día en que la caseta había firmado y la plataforma no quedaba
marcado como incompleto en los dos lados.

Los `whereHas` y `whereDoesntHave` heredan el `wherePivot('status', 'A')` de la
relación `firmas()`, así que una firma retirada no cuenta como puesta.

### La pernocta de la página

Se sigue pidiendo **una sola vez** para toda la página, agrupada por fecha, y
no por relevo: llamar al servicio del resumen por renglón serían nueve
consultas por relevo, noventa para pintar diez.

Las fechas se sacan de los relevos de la página, deduplicadas. Si la página
sale vacía, la consulta no se hace.

## 5. La tabla

Seis columnas:

| Fecha | Hora | Quien entrega | Pernocta del día | Estado | Acciones |
|---|---|---|---|---|---|

Un renglón por relevo, con `key` en el `id`. El encabezado del panel deja de
decir «Relevos por día» y dice **«Relevos»**.

La columna **Estado** lleva el distintivo que hoy vive dentro de la celda del
puesto: verde «Firmado» cuando no falta ninguna firma de cierre, naranja
«Falta jefe de área» / «Falta FBO» cuando falta una, «Faltan 2» cuando faltan
las dos.

**Editar y eliminar actúan directo sobre el renglón.** Ya no hay nada que
preguntar: `SelectorSeccion` se borra y con él el estado `eligiendo` de la
tabla y las funciones `pedirAccion()` e `idUnicoDe()`.

De `CeldasRelevo.tsx` sobrevive solo el distintivo. `CeldaSeccion` pasa a
llamarse `DistintivoFirmas` y recibe los roles faltantes en vez de una
sección; `pernoctaDelDia()` desaparece —la pernocta ahora es un número del
renglón, no la conciliación de dos puestos— e `idUnicoDe()` también.

### La fila de filtros

Se va el select de puesto. Quedan, bajo su columna: el botón de periodo en
Fecha, el buscador de nombre en Quien entrega, el select de estado en Estado y
la X de limpiar en Acciones. Hora y Pernocta no llevan filtro; sus celdas
quedan vacías para que la fila siga cuadrando con los encabezados.

## 6. El formulario

Se quita el bloque «Puesto» completo —los dos botones y su `MensajeError`— y
`seccion` sale de los dos payloads. Lo demás queda igual: entrega, fecha,
hora, resumen del día, observaciones y las firmas según el rol.

## 7. La vista previa

Pasa de dos columnas a un documento.

Hoy recibe la fila del día, pide los dos relevos en paralelo y pinta dos
`Columna`, con «Sin entregar» donde faltaba un puesto. Ahora recibe **un id**,
pide **un** relevo y pinta: nombre y hora, los seis renglones del resumen,
observaciones y las tres firmas.

Se van el tipo `Detalles`, el componente `Columna` y el recorrido de
`SECCIONES`. El encabezado toma la fecha del propio detalle.

## 8. Contrato de la API

Las rutas no cambian. Cambian las formas.

### `GET /api/EntregaTurnoSeguridad` — un renglón por relevo

```json
{
  "data": [
    {
      "id": 12,
      "fecha": "2026-11-18",
      "hora": "14:30",
      "nombre": "Juan Pérez",
      "firmas_faltantes": ["fbo"],
      "pernocta": 7
    }
  ],
  "meta": { "current_page": 1, "last_page": 3, "per_page": 10, "total": 25 }
}
```

`total` pasa a contar **relevos**, no días. `firmas_faltantes` y `pernocta`
significan lo mismo que en la v2. Desaparecen el envoltorio por fecha con sus
claves `caseta` y `plataforma`, y el campo `extras`.

El query string acepta `page`, `per_page`, `search`, `estado`, `fecha_inicio`
y `fecha_fin`. **`seccion` ya no se acepta**; si llega, se ignora por no estar
en las reglas.

### `GET /api/EntregaTurnoSeguridad/{id}` — detalle

Igual que en la v2 **sin la clave `seccion`**. El resumen, sus seis renglones
y `congelado` no cambian.

### `POST /api/EntregaTurnoSeguridad` — alta

Acepta `fecha_hora`, `observaciones` y `firma_quien_entrega`. Ya no acepta
`seccion`.

### `PUT /api/EntregaTurnoSeguridad/{id}` — edición

Acepta `fecha_hora`, `observaciones` y las tres firmas. Ya no acepta
`seccion`. La regla de ventana sobre `fecha_hora` se queda tal cual: solo se
aplica si el día cambia, porque aplicarla siempre dejaría inservible la cola
de pendientes.

### `GET /api/EntregaTurnoSeguridad/pendientes`

Cada renglón pierde `seccion`. El resto —`id`, `nombre`, `fecha`, `hora`,
`falta`— no cambia.

## 9. Base de datos

Una sola migración, `v3_entrega_turno_seguridad_sin_seccion`, con su `down`:

```
up:
  reescribir el texto de los resúmenes congelados
  dropIndex('entregas_turno_seg_fecha_seccion_idx')
  dropColumn('seccion')
  index(['fecha_hora'], 'entregas_turno_seg_fecha_idx')

down:
  dropIndex('entregas_turno_seg_fecha_idx')
  string('seccion', 16) con 'caseta' por defecto
  index(['fecha_hora', 'seccion'], 'entregas_turno_seg_fecha_seccion_idx')
  deshacer la reescritura del texto
```

El orden importa en `up`: la reescritura primero, porque si la migración
fallara a medio camino es mejor haber perdido una frase que una columna.

### El índice no es un detalle

La tabla nació con un índice compuesto sobre `(fecha_hora, seccion)`, con el
nombre puesto a mano y corto para no pasarse de los 64 caracteres que MySQL
acepta.

**Soltar ese índice no es opcional:** SQLite —el motor de las pruebas— se
niega a borrar una columna que está indexada, así que un `dropColumn` a secas
reventaría la suite. En MySQL el índice sobreviviría degradado a
`(fecha_hora)` con un nombre que menciona una columna que ya no existe, lo
cual es peor que un error: funciona y miente.

Después se crea `entregas_turno_seg_fecha_idx` sobre `fecha_hora` sola, que es
lo que el listado ordena y filtra ahora que no hay puesto. Mide 28 caracteres.

Los pasos van en **tres** llamadas a `Schema::table` separadas —soltar índice,
soltar columna, crear índice— y no en una: dentro de un mismo `Blueprint`,
Laravel no garantiza que el `dropIndex` se ejecute antes del `dropColumn`.

El valor por defecto de `down` es `'caseta'` y los valores originales no
vuelven. La migración lo dice en un comentario.

`eolo_plus` es la base real del usuario: **la migración no se corre sin su
permiso explícito**, ni aquí ni en el servidor de pruebas. Escribirla es parte
del trabajo; aplicarla es una decisión suya.

## 10. Archivos que se tocan

**Backend**

| Archivo | Qué |
|---|---|
| `database/migrations/2026_11_18_*_v3_entrega_turno_seguridad_sin_seccion.php` | nuevo |
| `app/Models/EntregaTurnoSeguridad.php` | fuera las tres constantes, `seccion` del `fillable`, y el docblock que describe dos filas por día |
| `app/Http/Controllers/Api/EntregaTurnoSeguridadController.php` | `index` paginando relevos; fuera cuatro métodos privados, la constante `DIA` y `seccion` de `detalle` y `pendientes` |
| `app/Http/Requests/.../IndexEntregaTurnoSeguridadRequest.php` | fuera la regla y el mensaje de `seccion` |
| `app/Http/Requests/.../StoreEntregaTurnoSeguridadRequest.php` | idem |
| `app/Http/Requests/.../UpdateEntregaTurnoSeguridadRequest.php` | idem |
| `app/Support/ResumenDelDiaSeguridad.php` | las dos frases de cero |

**Frontend** (todo bajo `resources/js/pages/seguridad/`)

| Archivo | Qué |
|---|---|
| `entregaTurno/types.ts` | fuera `SECCIONES`, `Seccion`, `ETIQUETA_SECCION` y `SeccionRelevo`; `FilaRelevo` se vuelve plana; `seccion` fuera de `DetalleRelevo`, `PendienteRelevo`, los dos payloads y `FiltrosRelevo` |
| `entregaTurno/CeldasRelevo.tsx` | solo el distintivo, renombrado |
| `entregaTurno/TablaEntregaTurno.tsx` | seis columnas, un renglón por relevo, sin selector |
| `entregaTurno/FilaFiltros.tsx` | fuera el select de puesto; celdas recolocadas |
| `entregaTurno/FormEntregaTurno.tsx` | fuera el bloque «Puesto» |
| `entregaTurno/VistaPreviaEntregaTurno.tsx` | un documento en vez de dos columnas; recibe un id |
| `entregaTurno/PendientesDeFirma.tsx` | fuera `ETIQUETA_SECCION[pendiente.seccion]` del renglón |
| `entregaTurno/SelectorSeccion.tsx` | **se borra** |
| `EntregaTurno.tsx` | `previa` pasa de `FilaRelevo` a `number` |

`resources/js/stores/apiEntregaTurnoSeguridad.ts` no cambia de forma: importa
los tipos y los sigue importando. Se revisa su docblock, que menciona la
pernocta mensual de la v1.

## 11. Pruebas

Diez archivos, 2 226 líneas.

| Archivo | Qué le pasa |
|---|---|
| `ListadoPorDiaTest.php` (446) | su contrato entero es el agrupamiento: se reescribe como `ListadoDeRelevosTest.php` |
| `EsquemaV2Test.php` (135) | pasa a exigir que `seccion` **no** esté y que el índice se llame `entregas_turno_seg_fecha_idx`; fuera la prueba de las constantes de sección |
| `CrearRelevoTest.php` (207) | `seccion` fuera del payload; una prueba nueva de que mandarla no rompe nada |
| `EditarYEliminarRelevoTest.php` (322) | `seccion` fuera del payload y de las aserciones |
| `PendientesDeFirmaTest.php` (217) | `seccion` fuera del renglón esperado |
| `ModeloEntregaTurnoSeguridadTest.php` (107) | `seccion` fuera del sembrado; el nombre de índice que exige pasa a ser el nuevo, y sigue midiendo que ninguno pase de 64 caracteres |
| `VentanaDeFechaDelRelevoTest.php` (169) | `seccion` fuera del payload |
| `CongelarResumenTest.php` (307) | `seccion` fuera del sembrado |
| `ResumenDelDiaTest.php` (274) | las dos frases de cero |
| `MenuDelModuloTest.php` (42) | no la toca nada |

Lo que el listado nuevo tiene que demostrar:

- Un relevo por renglón, con sus seis claves y sin `caseta`/`plataforma`.
- `total` cuenta relevos: dos relevos del mismo día dan `total: 2`.
- Orden descendente por fecha y hora.
- Los tres valores de `estado` filtran por registro.
- El filtro por fechas y el buscador de nombre siguen funcionando.
- `per_page` sigue con su piso de 1 y su techo de 100.
- La pernocta sale congelada si el relevo lo está y en vivo si no.
- Un `?seccion=caseta` no filtra nada ni revienta.

Las pruebas corren **en serie** (`php artisan test`), nunca con `--parallel`.

### La reescritura del texto congelado sí se prueba

Las pruebas arrancan con la base vacía, así que la migración de datos no
encuentra nada que reescribir por sí sola. `EsquemaV2Test` lo resuelve
sembrando filas crudas con resúmenes congelados, haciendo un rollback de un
solo paso sobre esta migración y volviendo a migrar. Prueba las dos
direcciones (frases viejas al bajar, nuevas al subir), que las cifras quedan
byte a byte idénticas y que una fila sin frases de cero no se toca. Leer los
cinco relevos reales tras la migración sigue siendo un paso del plan, como
confirmación, no como sustituto.

## 12. Riesgos y limitaciones conocidas

**La rama `main` no sabe de esto.** `eolo_plus` es una sola base: al volver a
`main`, su código buscará la columna `seccion`, que ya no existe. Pasó lo mismo
con la v2 y la nota sigue valiendo: el módulo no se puede abrir desde `main`
mientras la base esté migrada.

**El servidor de pruebas (192.168.7.229) tiene su propia base.** Esta
migración hay que correrla allá también, y su volcado trae relevos con
`seccion` propios.

**Dos relevos del mismo día ya no se ven como uno.** Es lo pedido, pero quien
mirara la tabla esperando «un renglón por día» verá dos en esas dos fechas
legadas. No es un defecto: es el dato.

**La frase reescrita no es reversible con exactitud** si alguien hubiera
escrito a mano «No hay movimientos» en un resumen congelado antes de la
migración. No puede pasar: el texto solo lo escribe `ResumenDelDiaSeguridad`.

## 13. Fuera de alcance

- Candado de uno por día, en cualquier forma: ni 422, ni aviso, ni índice
  único.
- Fusionar los dos relevos de los días legados en uno.
- Tocar los demás módulos de Seguridad o lo que el resumen les consulta.
- Combustible y Posiciones siguen sin renglón: no tienen tabla propia en el
  proyecto, como ya decidió la v2.
- PDF descargable del relevo. La vista previa se queda como vista previa.
