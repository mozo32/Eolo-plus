# Finalización manual y vista pública para televisión — Diseño

Fecha: 2026-09-11
Módulo: Despacho · Operaciones Programadas
Estado: aprobado por el usuario

## Objetivo

1. Permitir que Despacho finalice a mano una operación programada desde la tabla
   administrativa, sin crear registro en Operaciones Diarias.
2. Que la vista para televisión abra sin iniciar sesión, exponiendo únicamente lo que muestra y
   recibiendo tiempo real por un canal propio.

## Hallazgos que condicionan el diseño

- El canal interno `operaciones-programadas` ya es público (calcado de Remisiones) y por él
  viaja también `MatriculaRestringidaCambio`. Por decisión del usuario, en esta ronda se deja
  como está y se crea un canal aparte para la televisión; privatizar el interno queda para una
  ronda propia junto con Remisiones.
- El scope `pendientesPara('operaciones_diarias')` aceptaba `A` y `R` y excluía por uso; una
  operación finalizada a mano quedaría en `R` sin uso y seguiría contando para Operaciones
  Diarias. Se corrige.

## Finalización manual

`POST /api/OperacionesProgramadas/{id}/finalizar`, dentro del grupo `auth:sanctum` +
`subdep:operacionesProgramadas`. Siempre por ID.

Atomicidad: una sola sentencia condicional, `UPDATE ... SET status='R' WHERE id=? AND
status='A'`. Si no afecta filas, la operación ya no estaba pendiente y se responde 409 con
`codigo: 'ya_no_pendiente'`. Solo cuando afecta una fila se escribe la bitácora y, después del
commit, se emite el evento. La segunda de dos peticiones concurrentes no emite nada.

Bitácora: constante nueva `ACCION_FINALIZAR`; `usuario_id` y `elabora` ya registran quién. Sin
columnas nuevas.

Evento: `OperacionProgramadaCambio` con `ACCION_FINALIZADA`. Los tres listeners existentes
reaccionan sin cambios: el tablero refetchea por fecha; Operaciones Diarias refetchea y la
operación ya no viene; WalkAround refetchea y la sigue viendo.

Defensa extra: `vincular()` rechaza con 422 que Operaciones Diarias vincule una operación ya en
`R`. Para WalkAround `R` sigue permitido.

## Regla corregida de pendientes

| Módulo | Estados pendientes |
|---|---|
| Operaciones Diarias | solo `A` |
| WalkAround | `A` y `R`, sin uso propio |

Para Operaciones Diarias, `R` significa "ya no me hace falta", haya llegado por su propio
registro o por la mano de Despacho. `coincidencias` y la detección al capturar usan el mismo
scope.

## Vista pública

Ruta de la página `operacionesProgramadas/pantalla` fuera del grupo `auth` + `verified`, sin
middleware. `HandleInertiaRequests` tolera invitado y la página no usa `AppLayout`.

Endpoint público de lectura en un controlador separado: `PantallaProgramadasController@index`,
`GET /api/pantalla/operaciones-programadas`, sin auth, con `throttle:60,1`. Consulta solo
`activas()` de la fecha local de hoy, calculada en el servidor, y responde a través de
`OperacionPantallaResource` exclusivamente:

```
id · tipo · matricula · equipo · hora · lugar · pax · fp · observaciones
```

Se expone `id` porque es la `key` de React y lo que evita duplicar filas al recibir varios
eventos de la misma operación. El controlador administrativo no se toca.

## Canal de la televisión

`pantalla-programadas`, público. `OperacionProgramadaCambio::broadcastOn()` devuelve el canal
interno y el de televisión con la misma carga mínima. `MatriculaRestringidaCambio` no se emite al
canal de televisión. `useCanalProgramadas` gana un parámetro `canal` opcional.

## Frontend

Tabla administrativa: acción `Finalizar` con `CircleCheck`, solo fuera de `modoPantalla`.
Confirmación con SweetAlert2 con los textos del usuario, incluida la aclaración de que no crea
registro diario. Conjunto `finalizando` que deshabilita el botón de la fila; al 2xx refetch; al
409 aviso y refetch; en otro error la fila se queda, el botón se rehabilita y se muestra el
mensaje. Nunca se cambia el estado local antes de la respuesta.

Vista pública: hook `usePantallaProgramadas` que consulta el endpoint público, escucha
`pantalla-programadas`, reemplaza las listas completas, cambia de día con el reloj existente y
resincroniza cada 15 minutos. `useSesionViva` se elimina. Tipo estrecho `OperacionPantalla`;
`OperacionProgramada` lo extiende.

## Archivos

Crear: `PantallaProgramadasController.php`, `OperacionPantallaResource.php`,
`usePantallaProgramadas.ts`, `PantallaPublicaTest.php`, `FinalizarProgramadaTest.php`.

Modificar: `routes/web.php`, `routes/api.php`, `OperacionProgramadaController.php`,
`OperacionProgramada.php`, `OperacionProgramadaCambio.php`, `Bitacora.php`,
`apiOperacionesProgramadas.ts`, `types.ts`, `useCanalProgramadas.ts`,
`useOperacionesProgramadas.ts`, `TablaOperacionesProgramadas.tsx`,
`PantallaOperacionesProgramadas.tsx`, `OperacionesProgramadasIndex.tsx`.

Eliminar: `useSesionViva.ts`. Sin migración.

## Pruebas

Finalizar: pendiente pasa a `R` sin crear `OperacionDiaria`; la segunda petición recibe 409 y no
emite evento; cancelada y realizada por Operaciones Diarias responden 409; queda en bitácora con
el usuario; sale del listado y de los pendientes de Operaciones Diarias; sigue en los de
WalkAround; Rampa 403; invitado 401.

Público, sin `actingAs`: página 200 con su componente; endpoint 200 con exactamente las nueve
llaves; sin `status`, `modulos_usados` ni `user_id`; solo activas de hoy; todos los endpoints de
escritura 401; el canal de televisión está en `broadcastOn()` del evento de operaciones y no en
el de restricciones. Verificación en vivo de la ruta pública en el navegador, sin sesión.

## Decisiones tomadas

1. `R` es terminal para Operaciones Diarias y pendiente para WalkAround.
2. `id` va en la respuesta pública.
3. `throttle:60,1` en el endpoint público.
4. El evento se emite a los dos canales en vez de crear un evento nuevo.
5. Se elimina `useSesionViva`; la resincronización cada 15 minutos vive en el hook público.
