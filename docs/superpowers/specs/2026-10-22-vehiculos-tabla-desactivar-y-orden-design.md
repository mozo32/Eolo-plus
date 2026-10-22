# Movimientos de vehículos Eolo: número económico, desactivar y orden por uso

**Fecha:** 2026-10-22
**Rama base:** `main` (punta `dbf0ce9`, 2412 pruebas en verde)
**Proyecto hermano:** la exportación a Excel con selección por casillas es un trabajo
aparte, con su propia spec. Ver «Lo que no entra».

## Qué resuelve

Tres cosas que el departamento pidió sobre la tabla principal de
`MovimientosVehiculoEolo`:

1. La columna «Vehículo» no dice cuál es el número económico, que es como el personal
   identifica cada unidad en la planta.
2. No hay forma de retirar un vehículo de circulación. Cuando una unidad se vende, se
   da de baja o entra a taller largo, sigue apareciendo igual que las demás y cualquiera
   puede registrarle una salida.
3. La tabla sale en el orden en que la base devuelve las filas, así que la unidad que se
   usa todos los días puede quedar debajo de una que se usa una vez al mes.

## El dato de hoy

Seis vehículos y 1 389 movimientos, en `vehiculos` y `movimientos_vehiculos` de la base
propia. No interviene ninguna conexión externa.

| Vehículo (`id`) | Nombre | `estado` | Movimientos |
|---|---|---|---|
| `01-KIA` | KIA | En Planta | 933 |
| `TC-84` | SUBURBAN | En Planta | 336 |
| `N-15` | NISSAN | En Planta | 56 |
| `12` | NISSAN | En Ruta | 45 |
| `EP-16` | URVAN | En Planta | 10 |
| `IKON` | IKON | En Ruta | 9 |

## Hechos medidos que deciden el diseño

### 1. El `id` ya ES el número económico

`vehiculos.id` es un `varchar(255)` que hace de clave primaria, y contiene `01-KIA`,
`12`, `EP-16`, `IKON`, `N-15`, `TC-84`. El modelo lo declara con `$keyType = 'string'` e
`$incrementing = false`.

**No hace falta ningún dato nuevo para el punto 1**: lo que hay que mostrar debajo del
nombre ya viaja en la respuesta.

### 2. `estado` es dónde está el vehículo, no si está de alta

Es un `enum('En Planta','En Ruta')`. Es el dato con el que se decide si al vehículo le
toca registrar entrada o salida. Meter ahí un tercer valor «Desactivado» convertiría
«dado de baja» en una posición física y rompería esa decisión.

### 3. Dos de los seis vehículos están «En Ruta» ahora mismo

`12` (NISSAN) e `IKON`. Si se permitiera desactivar una unidad mientras está fuera, esa
unidad no podría registrar nunca su entrada y quedaría «En Ruta» para siempre, con una
bitácora que termina en una salida sin cierre.

### 4. La relación `Vehiculo::movimientos()` está ROTA

Apunta a `Movimiento::class`, y esa clase no existe: el modelo se llama
`movimientoVehiculo`. Comprobado — `Vehiculo::withCount('movimientos')` lanza
`Class "App\Models\Movimiento" not found`.

Nadie la usaba, así que el defecto estaba dormido. El punto 3 de esta spec la despierta:
contar movimientos por vehículo es exactamente lo que necesita el orden nuevo.

### 5. El orden por uso sí distingue

De 933 a 9 movimientos. No es un reordenamiento cosmético: separa la unidad de uso
diario de la que se mueve una vez al mes.

### 6. Los tres roles pedidos existen con estos identificadores

`fbo` (FBO), `admin2` (Administrativo) y `admin` (Administrador). El proyecto comprueba
roles en el servidor con `$user->hasRole('x')` (por ejemplo
`OperacionesDiariasController::cancelar`), y la pantalla los lee de las props de Inertia
en `auth.user.roles`.

**Ojo:** el patrón que hay hoy en otras pantallas lee `roles?.[0]?.slug`, o sea solo el
PRIMER rol. Un usuario con dos roles donde el permitido no fuera el primero se quedaría
sin el botón. Esta pantalla no repite ese patrón: comprueba la lista entera.

## Alcance

**Entra:**

1. La columna pasa a «Vehículo / N. económico» y muestra el `id` bajo el nombre.
2. Una acción para desactivar y reactivar un vehículo, con dos candados en el servidor.
3. Un vehículo inactivo no registra entradas ni salidas; su bitácora se consulta igual.
4. La tabla se ordena por número de movimientos, con los desactivados al fondo.
5. Un vehículo desactivado se distingue a simple vista en la tabla.
6. La relación `movimientos()` del modelo, arreglada.

**No entra:**

- **La exportación a Excel con casillas de selección** (punto 2 de la petición
  original). Es un trabajo aparte: necesita un endpoint que devuelva los movimientos de
  VARIOS vehículos a la vez, que hoy no existe —el que hay es de uno en uno—, más un
  modal con filtros, vista previa y descarga. Tiene su propia spec.
- **Borrar un vehículo.** Desactivar es reversible y conserva la bitácora, que es lo
  que se pidió. Un borrado perdería los 1 389 movimientos históricos.
- **Un motivo de la desactivación.** No se pidió. Si el departamento lo necesita
  después, es una columna más y no cambia nada de lo de aquí.
- **Reordenar la tabla desde la pantalla.** El orden lo fija el servidor. No se pidieron
  cabeceras ordenables.

## Decisiones tomadas

| # | Decisión | Por qué |
|---|---|---|
| 1 | Columna nueva `activo`, no un valor más en `estado` | `estado` es la posición física y la usa la lógica de entrada/salida (hecho 2) |
| 2 | No se puede desactivar un vehículo «En Ruta» | Si no, queda fuera para siempre sin poder cerrar su movimiento (hecho 3) |
| 3 | El candado de rol vive en el SERVIDOR, no solo en la pantalla | Esconder un botón no impide mandar la petición a mano |
| 4 | Se comprueba la lista ENTERA de roles, no `roles[0]` | Un usuario con dos roles perdería el permiso por el orden (hecho 6) |
| 5 | Desactivar es reversible, con la misma acción | «Desactivar» sin vuelta atrás sería un borrado disfrazado |
| 6 | La bitácora de un inactivo se sigue consultando | Lo pidió el departamento de forma explícita |
| 7 | El orden lo calcula el servidor, no la pantalla | La pantalla no debe decidir el orden de unos datos que no cuenta |
| 8 | Un desactivado lleva insignia | Sin ella, la única pista es que le faltan botones, y eso se lee como un fallo |

## Arquitectura

### Datos

Una migración añade a `vehiculos`:

```
activo  boolean  NOT NULL  default true
```

Por omisión verdadero: los seis vehículos actuales siguen funcionando igual y ninguna
pantalla cambia de comportamiento hasta que alguien desactive algo.

El `down()` la quita. No hay dato que preservar al revertir: un `activo = false` perdido
se vuelve a poner con un clic.

### Modelo

`Vehiculo::movimientos()` pasa a apuntar a `movimientoVehiculo::class` (hecho 4). La
clave ajena es `vehiculo_id`, que en la tabla de movimientos es la cadena del id, igual
que la clave primaria.

`activo` entra en `$fillable` y se castea a `boolean`.

### Servidor

**`index()`** devuelve dos campos más por vehículo, `activo` y `movimientos`, y los
ordena:

```
ORDER BY activo DESC, movimientos_count DESC
```

Los activos primero, y dentro de cada grupo los más usados arriba. Un desactivado con
933 movimientos va debajo de un activo con 9: lo que se quiere arriba es lo que se puede
usar hoy.

Se arma con `withCount('movimientos')`, que con seis vehículos es una consulta
agregada y no un recorrido.

**`PATCH /api/VehiculoEolo/vehiculos/{id}/activo`** (nuevo) recibe el cuerpo
`{ "activo": false }` —booleano obligatorio— y aplica, en este orden:

1. Si quien pide no tiene ninguno de los roles `fbo`, `admin2` o `admin` → **403**.
2. Si se pide desactivar y el vehículo está «En Ruta» → **409**, con un mensaje que diga
   que primero hay que registrar su entrada.
3. Si no, se escribe `activo` y se deja rastro (ver abajo).

Es idempotente: desactivar algo ya inactivo responde 200 y no cambia nada. Así un doble
clic o una petición repetida no son un caso especial.

Reactivar no lleva el candado de «En Ruta»: un vehículo inactivo está siempre En Planta,
porque no pudo salir.

**`registrarMovimiento()`** rechaza con **409** cualquier entrada o salida de un vehículo
inactivo, con un mensaje que nombre al vehículo.

**`obtenerHistorial()`** NO cambia. La bitácora de un inactivo se consulta igual.

### Pantalla

`TablaVehiculos.tsx` cambia la cabecera. `FilaVehiculo.tsx` apila nombre e id y pinta la
insignia del desactivado. La cuarta acción se añade en la misma columna:

- No se dibuja si el usuario no tiene ninguno de los tres roles.
- Se dibuja deshabilitada, con el motivo, si el vehículo está «En Ruta».
- Pide confirmación antes de actuar, como el resto de acciones de la pantalla.

Los botones de registrar entrada y salida no se dibujan para un vehículo inactivo. El de
la bitácora sí.

El tipo de `types.ts` gana `activo: boolean` y `movimientos: number`.

### El rastro de quién desactivó

**Este controlador no usa `Bitacora` hoy** —lo comprobé— así que registrar ahí es sumar
una dependencia que el módulo no tenía. Se suma igualmente, y solo para esta acción.

La razón: desactivar deja un vehículo sin poder trabajar, está limitado a tres roles, y
la pregunta que va a llegar cuando ocurra es «¿quién lo desactivó y cuándo?». Sin
rastro, la respuesta es que no se sabe. El resto del controlador se queda como está: no
se añade bitácora a registrar movimientos ni a dar de alta, porque eso ya tiene su propio
registro en `movimientos_vehiculos` y no es lo que esta spec viene a resolver.

Si el departamento prefiere no tener ese registro, se quita y el resto no cambia.

### Errores

| Caso | Qué pasa |
|---|---|
| Sin rol permitido | 403 y la pantalla no dibuja el botón. Los dos, no uno |
| Desactivar algo «En Ruta» | 409 con el motivo; el botón ya salía deshabilitado |
| Movimiento de un inactivo | 409 nombrando al vehículo |
| Id que no existe | 404, como el resto del controlador |
| Bitácora de un inactivo | Funciona. Es el caso que el departamento pidió conservar |

### Pruebas

En Pest, en serie, sobre sqlite.

**El candado de rol**, que es el que protege de verdad: los tres roles permitidos
desactivan, y un `empleado` recibe 403 y el vehículo no cambia. Se comprueba leyendo la
columna, no la respuesta.

**El candado de «En Ruta»**: desactivar uno fuera da 409 y lo deja activo; tras registrar
su entrada, la misma petición funciona.

**La consecuencia**: un inactivo no registra entrada ni salida (409 las dos), y su
bitácora responde 200 con sus movimientos.

**Reactivar** devuelve el permiso de registrar.

**El orden**: con vehículos de distinto número de movimientos y alguno desactivado, la
respuesta sale activos primero por movimientos descendente y desactivados al fondo. Una
prueba que falle si se ordenara solo por movimientos sin mirar `activo`.

**La relación arreglada**: `withCount('movimientos')` devuelve la cuenta correcta. Hoy
esa llamada lanza una excepción, así que la prueba falla antes del arreglo.

## Riesgos

**Un vehículo desactivado por error deja de poder trabajar.** Por eso la acción es
reversible, pide confirmación y está limitada a tres roles. El daño máximo es que alguien
con permiso tenga que volver a pulsar.

**El orden cambia lo que el personal está acostumbrado a ver.** Hoy `01-KIA` puede estar
en cualquier posición y mañana estará siempre arriba. Es lo pedido, pero es un cambio
visible el primer día.

**La relación rota puede tener más hermanos.** Se arregla la de `Vehiculo` porque esta
spec la necesita; no se audita el resto de modelos, que queda fuera de alcance.
