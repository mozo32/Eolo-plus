# Entrega de Turno de Seguridad — segunda versión

**Fecha:** 2026-11-09
**Rama de origen:** `entrega-turno-seguridad`
**Spec que sustituye:** `docs/superpowers/specs/2026-11-04-entrega-turno-seguridad-design.md`

La primera versión del módulo entró completa y probada. Esta segunda cambia
cómo se contesta el relevo: las casillas que alguien marcaba se sustituyen por
conteos leídos de las tablas de los demás módulos de Seguridad, y el cierre
pasa de dos firmas a tres.

Lo que **no** cambia: la ventana de hoy y ayer, el borrado lógico, la
paginación por día, el botón FILTRAR, que todos los roles vean la vista previa
y el diseño visual de las pantallas.

---

## 1. Vocabulario: caseta y plataforma

Los dos puestos dejan de llamarse frente y atrás.

| Antes | Ahora |
|---|---|
| `frente` | `caseta` |
| `atras` | `plataforma` |

Se renombra **el valor que se guarda**, no solo la etiqueta. Mantener
`frente` en la base mientras la gente dice «caseta» deja una traducción
mental en cada lectura futura del código; la base tiene tres relevos, así que
migrarlos cuesta un `UPDATE` de tres renglones y es reversible.

`plataforma` mide exactamente 10 caracteres y la columna es
`string('seccion', 10)`: cabe justo. Se ensancha a 16 en la misma migración
para que no quede un borde en el límite. Al modificar la columna hay que
repetir TODOS sus atributos o Laravel los pierde.

Las constantes pasan a `SECCION_CASETA = 'caseta'` y
`SECCION_PLATAFORMA = 'plataforma'`, y `SECCIONES` las lista en ese orden. En
pantalla, las dos columnas de la tabla se titulan CASETA y PLATAFORMA.

## 2. Lo que se elimina

Desaparecen las **ocho casillas** —no solo combustible y posiciones—, porque
las seis restantes dejan de contestarse a mano:

`aviones_csae`, `combustible`, `resguardo_vehicular`, `estacionamiento`,
`posiciones`, `vehiculos`, `operaciones`, `visitantes`.

Desaparece también `pernocta_mensual` con sus tres estados (`S`, `N`, `R`).

Con ellas se van: la constante `CASILLAS`, los ocho `casts` a booleano, su
validación en los Form Requests de alta y edición, el bloque de casillas del
formulario, el selector de los tres estados de pernocta y las claves
correspondientes del contrato de la API.

Los tres relevos existentes pierden esos datos. Son de prueba y el usuario lo
aceptó al aprobar el diseño.

## 3. El resumen del día

Un servicio nuevo, `app/Support/ResumenDelDiaSeguridad`, con un único método
público:

```php
/** @return list<array{clave: string, titulo: string, texto: string, ...}> */
public static function para(CarbonInterface $dia): array
```

Seis consultas de conteo por llamada, no una por renglón y por relevo. La
zona horaria de la aplicación ya es `America/Mexico_City`, así que las fechas
guardadas están en hora de México y las comparaciones son directas, sin
conversión.

El servicio devuelve **solo los renglones**. El envoltorio con `congelado`
—el de §8— lo arma el controlador, que es quien sabe si el relevo está
cerrado; el servicio no conoce relevos, solo fechas.

Un mismo registro puede contar de los dos lados: un avión de CSAE que entró y
salió el mismo día suma una entrada y una salida. Eso es lo que se quiere, y
por eso cada lado se cuenta por su propia columna de fecha en vez de contar
filas.

### De dónde sale cada renglón

| clave | titulo | Tabla | Entradas | Salidas | Se descartan |
|---|---|---|---|---|---|
| `aviones_csae` | Aviones de CSAE | `movimientos_csae` | `DATE(fecha_hora_entrada)` | `DATE(fecha_hora_salida)` | `status <> 'A'` |
| `resguardo_vehicular` | Resguardo vehicular | `estacionamiento_subterraneos` | `DATE(fecha_ingreso)` | `DATE(fecha_salida)` | — |
| `vehiculos` | Vehículos | `movimientos_vehiculos` | `tipo = 'Entrada'` | `tipo = 'Salida'` | — |
| `operaciones` | Operaciones | `operaciones_diarias` | `tipo = 'llegada'` | `tipo = 'salida'` | `status` falso |
| `visitantes` | Visitantes | `registro_visitantes` | `DATE(fecha_entrada)` | `DATE(fecha_salida)` | — |
| `pernocta` | Pernocta del día | `pernocta_dia` | — | — | — |

`resguardo_vehicular` y el antiguo `estacionamiento` son lo mismo —lo
confirmó el usuario—, así que se funden en un solo renglón. «Resguardo
vehicular» no tiene tabla propia en el proyecto: solo existía como casilla de
este módulo.

`vehiculos` y `operaciones` agrupan por `tipo` sobre el día:
`movimientos_vehiculos` por `DATE(created_at)` y `operaciones_diarias` por su
columna `fecha`.

`pernocta` cuenta filas de `pernocta_dia` cuya `fecha` es la del relevo.

### El texto de cada renglón

Se arma en PHP y viaja ya armado, para que la pantalla no tenga que saber
pluralizar en español:

- Si entradas y salidas son cero: **«Sin registros»**.
- Si no: **«{n} entrada{s} y {m} salida{s}»**, con singular cuando el número
  es 1. En `operaciones` la palabra es **llegadas** en vez de entradas, porque
  es la que usa su propio módulo (`tipo` es `llegada`/`salida`); en
  `resguardo_vehicular` es **ingresos**, por la misma razón (`fecha_ingreso`).
- `pernocta`: cero → **«Sin pernoctas»**; uno → **«1 aeronave»**; más →
  **«{n} aeronaves»**.

Cada renglón viaja además con sus números crudos (`entradas`, `salidas` o
`total`), para que las pruebas afirmen sobre cifras y no sobre cadenas.

## 4. Congelado al cerrar

Columna nueva en `entregas_turno_seguridad`:

```php
$table->json('resumen')->nullable();
```

Lo que se guarda ahí es el arreglo de renglones tal cual lo devuelve
`ResumenDelDiaSeguridad::para()`, sin envolver: el `congelado` del contrato
sale de si esta columna es `null` o no, no de un campo dentro del JSON.

- Mientras al relevo le falte **alguna** de las tres firmas, `resumen` está en
  `null` y la API devuelve el cálculo en vivo. Los números crecen con el día.
- En el momento en que entra **la tercera firma**, el controlador calcula el
  resumen una vez y lo guarda en esa columna, dentro de la misma operación que
  guarda la firma.
- A partir de ahí la API sirve siempre lo guardado. Un relevo cerrado no
  vuelve a cambiar de cifras aunque alguien edite o borre un registro viejo de
  otro módulo.
- Si después de cerrado se retira y repone una firma, el resumen **no** se
  recalcula: ya está congelado y la fecha del documento no cambió.

Los dos relevos de un mismo día —caseta y plataforma— llevan cada uno su
propio resumen, congelado en el momento en que se cerró. Si se cerraron a
horas distintas, sus cifras pueden diferir. Es consecuencia directa de
congelar al cerrar y está aceptado.

## 5. Las tres firmas

| Firma | `rol` en `firmables` | Quién la pone | Cuándo |
|---|---|---|---|
| Quien entrega | `quien_entrega` | el usuario con la sesión abierta | al crear |
| Jefe de área | `jefe_area` | rol `jefe_area` | al editar |
| FBO | `fbo` | rol `fbo` | al editar |

**No hay orden.** Cada quien firma cuando entra; el relevo se cierra cuando
están las tres, sin importar cuál llegó primero.

El modelo gana `ROL_JEFE_AREA = 'jefe_area'` junto a las dos constantes que
ya tiene, y `humanizeRol()` gana su caso para que el `tag` de la firma diga
«Jefe de área».

El rol `jefe_area` ya existe en la base (id 3, nombre «Jefe de Área»), así que
no hay seeder de roles que escribir.

Las firmas siguen guardándose como hoy: `morphToMany` sobre `firmables` con
`status` `A`, y al reponer una se retira la anterior del mismo rol poniendo su
pivote en `N`. La validación de la imagen no cambia: la misma expresión que
exige `data:image/(png|jpe?g|webp);base64,` con cuerpo.

## 6. Permisos

| Acción | Antes | Ahora |
|---|---|---|
| Ver y vista previa | todos | todos |
| Crear | todos | todos |
| Editar y eliminar | `fbo`, `admin` | `fbo`, `jefe_area`, `admin` |
| Firmar como jefe de área | — | `jefe_area`, `admin` |
| Firmar como FBO | `fbo`, `admin` | `fbo`, `admin` |

El control vive en el controlador, como en todo el proyecto: no hay
`app/Policies`. Los dos `hasAnyRole(['fbo', 'admin'])` de `update` y
`eliminar` pasan a incluir `jefe_area`. Además, `update` rechaza con 403 que
alguien firme una casilla que no le toca: un `jefe_area` que mande
`firma_fbo`, o un `fbo` que mande `firma_jefe_area`. El `admin` puede mandar
cualquiera.

En el frontend, `puedeEditar` pasa de `tieneRol('fbo', 'admin')` a
`tieneRol('fbo', 'jefe_area', 'admin')`, y el formulario enseña solo la
casilla de firma que el usuario puede poner.

## 7. Listado, distintivo y cola de pendientes

**Distintivo de cada sección**, hoy de dos estados, pasa a cuatro, según
cuántas de las tres firmas faltan:

| Faltan | Texto |
|---|---|
| ninguna | Firmado |
| solo la del jefe | Falta jefe de área |
| solo la del FBO | Falta FBO |
| las dos | Faltan 2 |

**Filtro por estado**, hoy `falta_fbo` / `completas`, pasa a tres valores:
`completas`, `falta_jefe_area`, `falta_fbo`. Los dos últimos no son
excluyentes entre sí: un relevo al que le faltan las dos aparece en ambos.

**Cola de pendientes.** Hoy `GET /pendientes` lista fijo los relevos sin firma
del FBO. Pasa a depender de quién pregunta:

- rol `jefe_area`: los relevos activos sin firma de jefe de área;
- rol `fbo`: los relevos activos sin firma de FBO;
- `admin`: los relevos activos a los que les falte cualquiera de las dos;
- quien no tenga ninguno de esos roles: lista vacía.

Un usuario con los dos roles ve la unión. Cada renglón de la cola indica qué
firma le falta, para que el administrador sepa qué va a poner.

## 8. Contrato de la API

Las rutas no cambian. Cambian las formas.

### `GET /api/EntregaTurnoSeguridad` — fila de un día

Por cada sección (`caseta`, `plataforma`), en lugar de `firmado_fbo` y
`pernocta_mensual`:

```json
{
  "id": 12,
  "nombre": "Juan Pérez",
  "hora": "14:30",
  "firmas_faltantes": ["fbo"],
  "pernocta": 7,
  "extras": 0
}
```

`firmas_faltantes` lista los roles que faltan, de los dos que cierran
(`jefe_area`, `fbo`); vacío quiere decir cerrado. `pernocta` es el número del
renglón de pernocta del resumen de ESE relevo —congelado si lo está, en vivo
si no—, que es lo que pinta la columna de la tabla. Cuando el día tiene las
dos secciones, la columna enseña el de la más reciente, que es la misma sobre
la que actúan los botones de la fila.

### `GET /api/EntregaTurnoSeguridad/{id}` — detalle

Se van las ocho claves booleanas y `pernocta_mensual`. Entra `resumen`:

```json
{
  "id": 12,
  "nombre": "Juan Pérez",
  "fecha": "2026-11-09",
  "hora": "14:30",
  "fecha_hora": "2026-11-09 14:30:00",
  "seccion": "caseta",
  "observaciones": "…",
  "resumen": {
    "congelado": true,
    "renglones": [
      { "clave": "aviones_csae", "titulo": "Aviones de CSAE", "texto": "3 entradas y 2 salidas", "entradas": 3, "salidas": 2 },
      { "clave": "resguardo_vehicular", "titulo": "Resguardo vehicular", "texto": "5 ingresos y 4 salidas", "entradas": 5, "salidas": 4 },
      { "clave": "vehiculos", "titulo": "Vehículos", "texto": "8 entradas y 7 salidas", "entradas": 8, "salidas": 7 },
      { "clave": "operaciones", "titulo": "Operaciones", "texto": "4 llegadas y 3 salidas", "entradas": 4, "salidas": 3 },
      { "clave": "visitantes", "titulo": "Visitantes", "texto": "12 entradas y 9 salidas", "entradas": 12, "salidas": 9 },
      { "clave": "pernocta", "titulo": "Pernocta del día", "texto": "7 aeronaves", "total": 7 }
    ]
  },
  "firmas": [ { "id": 1, "rol": "quien_entrega", "tag": "Quien entrega", "orden": 1, "url": "…" } ]
}
```

Los seis renglones viajan siempre, en ese orden, aunque todos valgan cero.

### `POST /api/EntregaTurnoSeguridad` — alta

Acepta `fecha_hora`, `seccion`, `observaciones` y `firma_quien_entrega`. Ya
no acepta las ocho casillas ni `pernocta_mensual`; si llegan, se ignoran por
no estar en las reglas. Devuelve el detalle, con el resumen en vivo.

### `PUT /api/EntregaTurnoSeguridad/{id}` — edición

Acepta `fecha_hora`, `observaciones`, `firma_jefe_area` y `firma_fbo`. La
regla de ventana sobre `fecha_hora` se mantiene tal cual: solo se aplica si
el día cambia, porque aplicarla siempre dejaría inservible la cola de
pendientes.

### `GET /api/EntregaTurnoSeguridad/pendientes`

Cada renglón gana `falta`, con los roles que le faltan a ese relevo de entre
los que quien pregunta puede firmar. Cuando faltan los dos y pregunta un
administrador, el renglón aparece una vez con `falta: ["jefe_area", "fbo"]`.

## 9. Base de datos

Una sola migración, con su `down`:

1. Ensanchar `seccion` de `string(10)` a `string(16)`, repitiendo sus
   atributos.
2. `UPDATE` de los datos: `frente` → `caseta`, `atras` → `plataforma`.
3. Quitar las ocho columnas booleanas y `pernocta_mensual`.
4. Añadir `resumen` JSON nullable.

El índice `entregas_turno_seg_fecha_seccion_idx` sobre
`(fecha_hora, seccion)` se conserva con su nombre. Al ensanchar una columna
indexada MySQL reconstruye el índice solo; no hay que tocarlo.

El `down` invierte los cuatro pasos. Las ocho booleanas vuelven con su
`default(false)` y `pernocta_mensual` con `default('R')`: los datos viejos no
se recuperan, pero la forma sí.

## 10. Archivos que se tocan

**Backend**
- `database/migrations/<marca de tiempo>_v2_entrega_turno_seguridad.php`
  (nuevo; la marca la pone `php artisan make:migration`)
- `app/Support/ResumenDelDiaSeguridad.php` (nuevo)
- `app/Models/EntregaTurnoSeguridad.php`
- `app/Http/Controllers/Api/EntregaTurnoSeguridadController.php`
- `app/Http/Requests/EntregaTurnoSeguridad/IndexEntregaTurnoSeguridadRequest.php`
- `app/Http/Requests/EntregaTurnoSeguridad/StoreEntregaTurnoSeguridadRequest.php`
- `app/Http/Requests/EntregaTurnoSeguridad/UpdateEntregaTurnoSeguridadRequest.php`

**Frontend**
- `resources/js/pages/seguridad/EntregaTurno.tsx`
- `resources/js/pages/seguridad/entregaTurno/FormEntregaTurno.tsx`
- `resources/js/pages/seguridad/entregaTurno/VistaPreviaEntregaTurno.tsx`
- `resources/js/pages/seguridad/entregaTurno/TablaEntregaTurno.tsx`
- `resources/js/pages/seguridad/entregaTurno/CeldasRelevo.tsx`
- `resources/js/pages/seguridad/entregaTurno/FilaFiltros.tsx`
- `resources/js/pages/seguridad/entregaTurno/SelectorSeccion.tsx`
- `resources/js/pages/seguridad/entregaTurno/PendientesFirmaFbo.tsx` (se
  renombra a `PendientesDeFirma.tsx`: ya no es solo del FBO)
- `resources/js/pages/seguridad/entregaTurno/types.ts`
- `resources/js/stores/apiEntregaTurnoSeguridad.ts`

Ningún archivo de pantalla debe pasar de 300 líneas. El controlador ya es una
excepción declarada; el resumen vive en su propio servicio justamente para no
engordarlo más.

## 11. Pruebas

Las 81 pruebas del módulo siguen siendo la red. Las que afirman sobre
casillas, sobre `pernocta_mensual` o sobre `frente`/`atras` se reescriben.

**Nuevas, por lo menos:**

- Del servicio de resumen, uno por renglón: que cuenta lo del día, que **no**
  cuenta lo del día anterior ni el siguiente, y que descarta lo dado de baja
  donde la tabla tiene estatus (`movimientos_csae`, `operaciones_diarias`).
- Que los seis renglones viajan siempre, en orden, aunque todos valgan cero.
- Los textos: cero, uno y varios, para comprobar el singular y «Sin
  registros» / «Sin pernoctas».
- Que el resumen se congela **exactamente** al entrar la tercera firma: con
  dos firmas sigue en `null`, con la tercera se guarda.
- Que un relevo congelado no cambia de cifras cuando se añade después un
  registro a una tabla de origen de ese mismo día.
- Que la cola de pendientes depende del rol de quien pregunta, y que quien no
  tiene ninguno de los dos roles recibe lista vacía.
- Que el orden de las dos firmas da igual: jefe y luego FBO cierra, FBO y
  luego jefe también.
- Que un `jefe_area` no puede poner la firma del FBO y viceversa, y que el
  `admin` sí puede ambas.
- Que la migración de datos convierte `frente` en `caseta` y `atras` en
  `plataforma`, y que el filtro por sección responde a los nombres nuevos.

El frontend no tiene corredor de pruebas en el proyecto: su evidencia es
`npm run build` en verde y `npx tsc --noEmit` con el único error de base
conocido (`WalkAroundController.ts:905`, generado por Wayfinder).

## 12. Riesgos y limitaciones conocidas

**`movimientos_vehiculos` no tiene fecha del hecho.** Sus columnas son
`vehiculo_id`, `tipo`, `chofer`, `kilometraje`, `gasolina`, `destino`,
`autoriza`, `observaciones`, `matricula`, `motivo` y los timestamps. El
conteo tiene que salir de `created_at`, que es cuándo se capturó el
movimiento, no cuándo ocurrió: un vehículo que salió a las 23:50 y se capturó
a las 00:30 cae en el día siguiente. Las otras cinco tablas sí tienen fecha
del hecho. Queda documentado, no se corrige en esta rama: arreglarlo pide
tocar el módulo de vehículos.

**Un relevo cerrado y uno abierto del mismo día pueden enseñar cifras
distintas**, porque el primero está congelado y el segundo no. Es el precio
del congelado al cierre y está aceptado.

**Los relevos extra siguen sin poder editarse.** Si una sección tiene más de
un relevo el mismo día, la fila enseña el más reciente y dice cuántos hay,
pero el más viejo sigue inalcanzable desde la pantalla. Es la limitación que
ya traía la primera versión y esta no la toca.

## 13. Fuera de alcance

- El XSS almacenado por SVG en las firmas de los otros siete módulos.
- El borrado por `GET` en toda la API.
- Las 29 mejoras menores aparcadas en
  `docs/superpowers/notas/2026-11-04-entrega-turno-seguridad-menores-aparcados.md`.
