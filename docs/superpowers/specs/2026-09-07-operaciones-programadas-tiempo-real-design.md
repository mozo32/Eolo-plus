# Operaciones Programadas en tiempo real — Diseño

Fecha: 2026-09-07
Módulos: Despacho (Operaciones Programadas), Tráfico/Rampa (Operaciones Diarias), Despacho (WalkAround)
Estado: aprobado por el usuario

## Objetivo

Que la pantalla de Operaciones Programadas y los selectores de Operaciones Diarias y
WalkAround reaccionen en tiempo real, reutilizando el mecanismo que ya usa Remisiones. No se
introduce tecnología nueva ni una segunda configuración de broadcasting.

## Mecanismo existente que se reutiliza

| Pieza | Estado actual en Remisiones |
|---|---|
| Evento | `App\Events\RemisionCreada`, `ShouldBroadcastNow`, canal público `remisiones`, `broadcastWith` devuelve solo `['id']` |
| Emisión | `RemisionController::store`, después de que `DB::transaction` retorna, dentro de `try/catch` con `Log::warning` |
| Transporte | Reverb (`BROADCAST_CONNECTION=reverb`), `configureEcho` en `resources/js/app.tsx` |
| Suscripción | `useEchoPublic('remisiones', 'RemisionCreada', cb)` de `@laravel/echo-react` |
| Autorización | Ninguna: canal público. `channels.php` solo define `App.Models.User.{id}` |
| Actualización | Refetch silencioso con página y filtros leídos desde `useRef` |

Se conserva el mismo enfoque: canal público, evento con carga mínima, `useEchoPublic` y
refetch en lugar de parcheo local del arreglo.

## Backend

### Evento

`App\Events\OperacionProgramadaCambio`, `ShouldBroadcastNow`, canal público
`operaciones-programadas`.

```
broadcastWith(): { id, accion, fecha, tipo, fecha_anterior, modulo }
```

- `accion`: `creada` | `actualizada` | `eliminada` | `utilizada`.
- `fecha_anterior`: solo en `actualizada`, para detectar que la operación cambió de día.
- `modulo`: solo en `utilizada`; `operaciones_diarias` o `walkaround`.

La carga es mínima y no lleva datos sensibles. Sirve para que cada cliente decida si vale la
pena consultar: una pantalla situada en otra fecha ignora el evento sin tocar la red.

Un método estático `OperacionProgramadaCambio::emitir(...)` envuelve el `event()` en el mismo
`try/catch` con `Log::warning` que usa Remisiones, para no repetirlo en cada punto de emisión.
Si Reverb está caído, el guardado no falla.

### Puntos de emisión

Siempre después de que la transacción confirmó.

| Dónde | Acción |
|---|---|
| `OperacionProgramadaController@store` | `creada` |
| `OperacionProgramadaController@update` | `actualizada`, con `fecha_anterior` |
| `OperacionProgramadaController@destroy` | `eliminada` |
| `OperacionesDiariasController@store` | `utilizada`, módulo `operaciones_diarias`, solo si `vincular()` creó el uso |
| `WalkAroundController@store` | `utilizada`, módulo `walkaround`, después del `DB::commit()` |

En Operaciones Diarias la programada vinculada se captura con `use (&$programadaUsada)` dentro
de la closure de `DB::transaction` y el evento se emite fuera de ella. Si la transacción falla
o la validación de secuencia responde 422, no hay evento.

No se agregan endpoints ni migraciones.

## Frontend

### `useCanalProgramadas(alCambiar)`

Un solo archivo concentra lo delicado:

- `useEchoPublic('operaciones-programadas', 'OperacionProgramadaCambio', cb)`: el hook de la
  librería ya resuelve suscripción única, limpieza al desmontar y el doble montaje de
  React Strict Mode.
- Coalescencia: un `setTimeout` de 250 ms agrupa ráfagas, de modo que varios eventos seguidos
  producen una sola consulta.
- Reconexión: `useConnectionStatus()` de `@laravel/echo-react`; al volver a `connected`
  después de haber estado caído, resincroniza contra el servidor.
- Cambio de día: temporizador de 60 s que no toca la red, solo compara `fechaHoy()` con la
  anterior, más `visibilitychange` y `focus`. La recarga se dispara únicamente cuando el
  string de fecha cambia.

### Consumidores

`useOperacionesProgramadas` (pantalla de Despacho): refetch del día consultado cuando
`payload.fecha` o `payload.fecha_anterior` coinciden con él.

`useProgramadasPendientes(modulo)` (nuevo, para Operaciones Diarias y WalkAround): dueño de la
lista de pendientes de hoy para su módulo. Devuelve `{ operaciones, total, cargando, recargar }`.

### Filtro de eventos

| Evento | Pantalla de Despacho | Badge y lista de mi módulo |
|---|---|---|
| `creada`, `actualizada`, `eliminada` | refetch si toca la fecha vista | refetch si `fecha` o `fecha_anterior` es hoy |
| `utilizada` con `modulo` propio | refetch | refetch: el contador baja |
| `utilizada` con `modulo` ajeno | refetch si toca la fecha vista | se ignora, sin petición |

La última fila es lo que mantiene los contadores independientes: usar una programación en
Operaciones Diarias no genera tráfico ni cambios en el contador de WalkAround.

### Refetch en lugar de parcheo

Al recibir un evento relevante se vuelve a pedir el día completo. Con eso quedan cubiertos el
cambio de fecha, el cambio de llegada a salida, los totales, la paginación y el borrado, y los
duplicados son imposibles: el servidor es la única fuente de verdad y la lista se reemplaza
completa, nunca se concatena.

### Contadores

Cada módulo monta su propio `useProgramadasPendientes(modulo)`, que consulta
`/pendientes?modulo=…&fecha=hoy`. Ese endpoint ya excluye por módulo mediante la tabla
`operacion_programada_usos`. El contador es la longitud de esa lista: una sola consulta
alimenta el badge y el panel.

El número solo baja cuando el servidor deja de devolver la operación, y el servidor solo la
retira cuando el uso quedó grabado en la transacción del guardado. Abrir o seleccionar no
cambia nada; un guardado fallido tampoco.

No existe un estado global de "utilizada" en el frontend.

### `BadgeProgramadas`

Círculo rojo con texto blanco en la esquina del botón existente, oculto cuando el total es 0,
con `aria-label` que indica cuántas operaciones hay disponibles y `aria-live="polite"`.

### Panel de pendientes

Pasa a recibir `operaciones` y `cargando` por prop desde el hook del padre, para que badge y
lista compartan una consulta. Conserva su selector de fecha: mientras esté en hoy usa los datos
del hook, y si el usuario elige otro día hace una consulta puntual para esa fecha sin afectar
al badge, que sigue contando hoy.

El panel no se cierra solo ni borra lo que el usuario haya capturado.

### Carrera entre dos usuarios

Si llega `utilizada` con el módulo propio y un id que coincide con una pestaña abierta:

1. Advertencia con SweetAlert.
2. La pestaña sigue abierta con lo capturado, pero queda desvinculada: el padre pone su
   `operacionProgramadaId` en null y los formularios lo sincronizan, de modo que al guardar
   viaja sin `operacion_programada_id` y entra como captura manual.

La defensa final sigue siendo el backend: el índice único y el 422 de `vincular()`.

## Archivos

Crear: `app/Events/OperacionProgramadaCambio.php`, `useCanalProgramadas.ts`,
`useProgramadasPendientes.ts`, `BadgeProgramadas.tsx`,
`tests/Feature/OperacionesProgramadas/TiempoRealTest.php`.

Modificar: `OperacionProgramadaController.php`, `OperacionesDiariasController.php`,
`WalkAroundController.php`, `useOperacionesProgramadas.ts`, `ProgramadasPendientesPanel.tsx`,
`OperacionesCards.tsx`, `TablaWalkAround.tsx`, `FormLlegada.tsx`, `FormSalida.tsx`,
`WalkAroundFormV2.tsx`.

Sin migraciones y sin dependencias nuevas: `@laravel/echo-react`, `laravel-echo`, `pusher-js` y
Reverb ya están, y `configureEcho` en `app.tsx` no se toca.

## Pruebas

Automáticas con Pest y `Event::fake()`: que cada acción emita `OperacionProgramadaCambio` con
la acción, la fecha y el módulo correctos; que `actualizada` lleve `fecha_anterior`; que no se
emita cuando la validación de secuencia rechaza o el guardado falla; que `utilizada` se emita
por separado para cada módulo. Se re-ejecutan los 38 tests existentes del módulo.

Manuales con dos pestañas: los quince criterios de aceptación. Requieren `reverb:start` y
`artisan serve`; lo que no se pueda verificar en vivo se reporta como pendiente en lugar de
darse por bueno.

## Decisiones tomadas donde el proyecto no definía el comportamiento

1. El cambio de día no mueve la fecha si el usuario la eligió a mano: en la pantalla de
   Despacho la fecha avanza sola solo cuando se estaba viendo hoy.
2. Un evento con campo `accion` en lugar de cuatro clases de evento: menos archivos y un solo
   listener por pantalla.
3. El badge cuenta siempre hoy, aunque el panel esté mostrando otro día.
4. Sin sonido de notificación, a diferencia de Remisiones.
5. Canal público, igual que Remisiones: la carga del evento no incluye datos sensibles y cada
   cliente vuelve a consultar por la API autenticada.
