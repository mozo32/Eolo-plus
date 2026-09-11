# Vista para televisión de Operaciones Programadas — Diseño

Fecha: 2026-09-10
Módulo: Despacho · Operaciones Programadas
Estado: aprobado por el usuario

Alcance de esta entrega: los puntos 1 a 4 de la solicitud. La detección de operaciones
programadas al escribir la matrícula en Operaciones Diarias y WalkAround queda para una entrega
posterior, para que cada mitad se revise por separado.

## Objetivo

Una segunda vista de Operaciones Programadas, de solo lectura, pensada para mostrarse en una
televisión, de modo que Rampa y Tráfico consulten las operaciones del día sin entrar a la
pantalla administrativa. La vista administrativa no cambia.

## Ruta

`operacionesProgramadas/pantalla`, nombre `pantallaProgramadas`, dentro del grupo `auth` +
`verified` que ya usan las demás pantallas. Se mantiene la convención camelCase del proyecto.
Cualquier usuario autenticado entra; sin sesión, redirige al login. No es una pantalla pública.

## Lo que ya existe y se reutiliza

`useOperacionesProgramadas` cubre casi todo el comportamiento pedido:

| Requisito | Cómo ya está resuelto |
|---|---|
| Solo pendientes de hoy | El hook arranca en `fechaHoy()` y el endpoint filtra por `activas()` |
| Una realizada o cancelada desaparece | Ambas dejan de ser `activas()` y el evento dispara el refetch |
| Sin recargar la página | Refetch silencioso por el canal |
| Fecha local, nunca UTC | `fechaHoy()` con `Intl` y `America/Mexico_City` |
| Cambio de día | Reloj de 60 s en `useCanalProgramadas`, sin tocar la red |
| Sin listeners duplicados | `useEchoPublic` con dependencias vacías |

La vista de televisión usa ese mismo hook sin renderizar el selector de fecha ni los tabs. Como
el usuario nunca cambia la fecha, la bandera `siguiendoHoy` permanece en `true` y el cambio de
día a medianoche ocurre solo. No se agregan endpoints ni eventos nuevos.

## La tabla, con variante

`TablaOperacionesProgramadas` recibe `modoPantalla?: boolean`, y `onEditar` y `onEliminar` pasan
a ser opcionales. Es una variante del componente existente, no una copia.

En modo pantalla:

- Se ocultan las columnas ID y Opciones.
- Tipografía grande: encabezados mayores, matrícula muy destacada, resto del texto ampliado.
- Filas altas y con más separación.
- Encabezado fijo cuando la lista pasa del alto de la pantalla.
- Sin paginación: se muestran todas las operaciones del día y se hace scroll.
- Mensaje vacío grande y centrado: "No hay salidas programadas para hoy." o "No hay llegadas
  programadas para hoy.".

Las medidas viven en un objeto de estilos que se elige según el modo, para que el JSX siga
siendo uno solo y las dos vistas no se separen con el tiempo.

Las columnas se conservan: Salidas con Matrícula, Equipo, Hora, Destino, PAX, FP y
Observaciones; Llegadas con Matrícula, Equipo, Hora, Origen, PAX y Observaciones.

## La página

`PantallaOperacionesProgramadas.tsx`, sin `AppLayout`, sin sidebar, sin menú y sin encabezado
del sistema. Contenedor a pantalla completa sobre fondo oscuro, con un encabezado mínimo que
muestra la fecha de hoy y un reloj, y debajo las dos tablas: SALIDAS arriba y LLEGADAS abajo,
cada una con su título.

Pensada para 1920×1080 y responsive hacia abajo. El fondo oscuro se lee mejor a distancia y
cansa menos en una pantalla encendida todo el día.

No hay botones de crear, restringir, actualizar ni eliminar, ni columna de opciones.

## Acceso desde la vista administrativa

Botón `Vista para pantalla` con icono `Tv`, junto a `Programar operación` y `Restringir`,
como enlace con `target="_blank"` y `rel="noopener noreferrer"`, de modo que abre en otra
pestaña y la pantalla administrativa se conserva. Visible para cualquiera que ya esté en esa
pantalla, que es el mismo permiso que tiene la ruta de televisión.

## Sesión viva

`useSesionViva(15)` dispara cada quince minutos el refetch que ya existe, en lugar de agregar un
endpoint de ping. Mantiene viva la sesión de Laravel —que expira a los 120 minutos sin
peticiones— y de paso sirve de red por si se perdió algún evento del websocket. Son cuatro
peticiones por hora y solo en la vista de televisión.

Esto no sustituye al broadcasting, que sigue siendo quien actualiza los datos: es un latido de
sesión.

## Archivos

Crear: `PantallaOperacionesProgramadas.tsx`, `useSesionViva.ts`.

Modificar: `routes/web.php`, `TablaOperacionesProgramadas.tsx`,
`OperacionesProgramadasIndex.tsx`, y `resources/js/routes/index.ts` regenerado por wayfinder.

Sin migración, sin endpoints nuevos y sin cambios de backend más allá de la ruta.

## Pruebas

Pest: que la ruta exista y renderice el componente correcto; que un invitado sea redirigido al
login; y que un usuario de otra área, como Rampa, sí pueda entrar, que es el propósito de la
vista.

Lo visual —tamaños, encabezado fijo, contraste a distancia— no se verifica automáticamente y se
reporta como pendiente de revisión en la televisión real.

## Decisiones tomadas

1. Fondo oscuro en la televisión, en vez del gris claro de la aplicación.
2. El latido de sesión reutiliza el refetch existente, sin endpoint nuevo.
3. Sin paginación en modo pantalla: scroll con encabezado fijo.
4. El botón lo ve cualquiera que esté en la pantalla administrativa, igual que el permiso de la
   ruta.
