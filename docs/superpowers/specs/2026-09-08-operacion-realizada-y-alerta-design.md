# Estado "realizada", fin de la validación de secuencia y alerta de restricciones — Diseño

Fecha: 2026-09-08
Módulo: Despacho · Operaciones Programadas
Estado: aprobado por el usuario

## Objetivo

Tres cambios sobre el módulo existente:

1. Un estado nuevo que marca la operación programada como realizada cuando se registra en
   Operaciones Diarias, de modo que sale del tablero de Despacho.
2. Retirar la validación de secuencia de movimientos al programar; queda solo la validación de
   matrículas restringidas.
3. Un icono de alerta junto al título que despliega la lista de matrículas restringidas.

## 1. El estado "realizada"

`status` pasa de dos valores a tres: `A` activa, `I` cancelada y `R` realizada. La columna ya es
`char(1)`, así que no hace falta migración.

El comportamiento pedido —que la operación salga del tablero de Despacho pero siga disponible
para WalkAround— se apoya en piezas que ya existen:

- La tabla de Despacho filtra por `activas()`, así que una operación en `R` sale del tablero.
- El panel de WalkAround filtra por "no tiene uso en mi módulo", no por estado.
- El evento `utilizada` viaja con `modulo: 'operaciones_diarias'` y el hook de WalkAround ya
  ignora los eventos de otros módulos, así que su lista y su badge no se alteran.

Cambios reales:

| Dónde | Cambio |
|---|---|
| `OperacionProgramada::vincular()` | Cuando el módulo es Operaciones Diarias, marca `status = 'R'` junto con el uso, dentro de la misma transacción |
| `OperacionProgramada::scopePendientesPara()` | Acepta `A` y `R`; excluye solo las canceladas |
| `OperacionProgramada::vincular()` | Deja de rechazar por `status !== 'A'`: solo rechaza las canceladas |

Solo Operaciones Diarias marca `R`. El uso en WalkAround registra su uso y no cambia el estado.

`update` y `destroy` sobre una operación realizada responden 422 con un mensaje propio, distinto
del de cancelada. Desde la interfaz es inalcanzable porque ya no aparece en el tablero; es la
defensa del endpoint.

## 2. Fin de la validación de secuencia al programar

Se eliminan las tres llamadas a `SecuenciaMovimientoService::validarProgramada` en
`OperacionProgramadaController`. Al programar queda únicamente la validación de matrículas
restringidas.

`validarProgramada()` y `lineaDeTiempo()` quedan sin consumidores y se borran del servicio en
lugar de dejarlas engañando a quien lea el código; git las conserva. `validarFinal()`,
`normalizar()`, `etiqueta()` y `movimientoOpuesto()` se quedan intactos: son los que usan
Operaciones Diarias y WalkAround, y esa regla sigue viva sin cambios.

El endpoint de vista previa deja de validar secuencia, así que se renombra de
`/validar-secuencia` a `/validar-movimiento` y responde solo con `restriccion`. Únicamente el
frontend propio lo consume. En el modal desaparece la franja ámbar de secuencia y se conserva la
roja de restricción.

## 3. Alerta de restricciones

`AlertaRestricciones.tsx` junto al título: icono `ShieldAlert` en rojo con el conteo, oculto
cuando no hay ninguna restricción. Se despliega al pasar el mouse y también al hacer clic; el
clic lo fija para que funcione en móvil, donde no hay hover. Cada matrícula se muestra con el
movimiento bloqueado: Llegada, Salida o Ambas.

El `GET` de restricciones sale del grupo de permisos de Despacho y queda con solo
`auth:sanctum`, para que lo vea cualquiera que abra la pantalla. `POST`, `PUT` y `DELETE` siguen
detrás de `subdep:operacionesProgramadas`: consultar quién está restringido lo puede cualquiera,
cambiarlo no.

La pantalla monta una sola instancia de `useMatriculasRestringidas` y comparte los datos con el
icono y el objeto completo con el modal, de modo que no se duplican consultas ni listeners. El
modal deja de llamar al hook por su cuenta.

## Archivos

Modificar: `OperacionProgramada.php`, `OperacionProgramadaController.php`,
`SecuenciaMovimientoService.php`, `routes/api.php`, `apiOperacionesProgramadas.ts`,
`OperacionProgramadaModal.tsx`, `OperacionesProgramadasIndex.tsx`,
`MatriculasRestringidasModal.tsx`, `useMatriculasRestringidas.ts`.

Crear: `AlertaRestricciones.tsx`.

Sin migración.

## Pruebas

Se retiran o invierten los casos que hoy afirman lo contrario de lo pedido: los siete de
`validarProgramada` en `SecuenciaMovimientoTest`; el de "rechaza una llegada que rompe la
secuencia" en el CRUD, que pasa a comprobar que ahora se permite; y en `TiempoRealTest` y
`RestriccionMatriculaTest`, los casos que usaban la secuencia como ejemplo de rechazo pasan a
usar una restricción.

Se agregan: que Operaciones Diarias deje la programada en `R`; que salga del listado de
Despacho; que siga apareciendo en los pendientes de WalkAround; que WalkAround pueda usarla
después y que su uso no cambie el estado; que una cancelada siga sin poder vincularse; que
editar o borrar una realizada responda 422; que programar dos llegadas seguidas ahora se
permita; y que la restricción siga bloqueando.

## Decisiones tomadas

1. Se borra el código muerto de secuencia en programadas en vez de dejarlo sin usar.
2. El endpoint se renombra a `/validar-movimiento` para que el nombre diga la verdad.
3. Una sola instancia del hook de restricciones por pantalla, compartida entre icono y modal.
4. Solo Operaciones Diarias marca `R`; el uso en WalkAround no cambia el estado.
