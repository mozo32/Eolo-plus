# Restricción de matrículas — Diseño

Fecha: 2026-09-08
Módulo: Despacho · Operaciones Programadas
Estado: aprobado por el usuario

## Objetivo

Permitir que Despacho marque matrículas cuya llegada, salida o ambas quedan restringidas, e
impedir que se programe un movimiento restringido. Se construye sobre el módulo existente sin
rehacerlo.

## Tabla y modelo

```php
Schema::create('matriculas_restringidas', function (Blueprint $table) {
    $table->string('matricula', 20)->primary();
    $table->boolean('llegada')->default(false);
    $table->boolean('salida')->default(false);
});
```

Tres columnas, sin `id` y sin timestamps. El modelo declara `$primaryKey = 'matricula'`,
`$keyType = 'string'`, `$incrementing = false` y `$timestamps = false`.

`llegada = true` significa que la llegada está restringida; `false`, permitida. Lo mismo para
`salida`. Los cuatro estados son válidos.

Como no hay timestamps, cada alta, cambio de switch y borrado se registra en la Bitácora con
módulo `MATRICULAS_RESTRINGIDAS`, de modo que se conserva quién y cuándo sin ensuciar la tabla.

## Validación centralizada

`app/Services/RestriccionMatriculaService.php`, hermano de `SecuenciaMovimientoService`:

- `restriccionDe(string $matricula): ?MatriculaRestringida`
- `validar(string $matricula, string $tipo): array{permitido: bool, message: ?string}`

El mensaje lo arma el servicio, no el controlador:
"La salida de la matrícula XA-ABC está restringida. Favor de hablar con el personal
correspondiente."

Se invoca en `OperacionProgramadaController::store` siempre, y en `::update` solo cuando cambia
la matrícula o el tipo. Así una operación que ya existía puede corregirse en hora, destino o PAX
aunque su movimiento haya quedado restringido después, y no puede convertirse en un movimiento
restringido.

La restricción se evalúa **antes** que la regla de secuencia: es la consulta más barata y su
mensaje es el más accionable. La regla de secuencia sigue ejecutándose después, sin cambios.

La respuesta de rechazo es 422 con `{ message, codigo: 'movimiento_restringido' }`. El `codigo`
permite al modal distinguir esta alerta de cualquier otro error y mostrar el aviso bloqueante
con un único botón "Entendido", sin opción de continuar.

## Endpoints

Prefijo `/api/MatriculasRestringidas`, todo el grupo bajo `auth:sanctum` y
`subdep:operacionesProgramadas`. El único consumidor es el modal de Despacho, así que tampoco
la lectura queda abierta.

| Método | Ruta | Acción |
|---|---|---|
| `GET` | `/` | Listado completo, ordenado por matrícula |
| `POST` | `/` | Alta con ambos switches en `false` |
| `PUT` | `/{matricula}` | Actualiza `llegada` y `salida` |
| `DELETE` | `/{matricula}` | Elimina la restricción |

La matrícula se normaliza en el Form Request: se recortan espacios, se pasa a mayúsculas y se
conservan guiones. El controlador resuelve el registro a mano en lugar de usar binding
implícito, para que `xa-abc` encuentre a `XA-ABC`.

Un alta duplicada responde 422 con "La matrícula seleccionada ya se encuentra en la lista de
restricciones". El índice único de la tabla lo respalda.

Se acepta cualquier matrícula válida, exista o no en el catálogo remoto, para permitir
restringir de forma preventiva.

## Tiempo real

Evento nuevo `MatriculaRestringidaCambio` en el mismo canal público `operaciones-programadas`:

```
{ matricula, accion: 'agregada' | 'actualizada' | 'eliminada', llegada, salida }
```

`useCanalProgramadas` gana un parámetro `evento` opcional cuyo valor por omisión es el actual,
así los tres consumidores existentes no cambian y el hook de restricciones reutiliza la
coalescencia y la resincronización por reconexión en lugar de copiarlas.

La lista del modal se reemplaza completa en cada recarga, de modo que no puede duplicar filas.
`useEchoPublic` sigue encargándose de la suscripción única y de limpiar el listener al
desmontar.

## Frontend

- `SwitchRestriccion.tsx`: switch propio en Tailwind con `role="switch"`, `aria-checked` y
  `aria-label`. No se usa PrimeReact: hoy solo aporta CSS y sus componentes traerían otro
  lenguaje visual.
- `useMatriculasRestringidas.ts`: dueño de la lista, el alta, el cambio de switch, el borrado y
  la suscripción al canal. El cambio de switch es optimista con reversión: pinta el valor nuevo,
  deshabilita ese switch y, si el servidor falla, regresa al valor anterior y muestra el error.
  Un conjunto de matrículas en vuelo evita que los clics repetidos manden varias peticiones.
- `MatriculasRestringidasModal.tsx`: `InputMatricula` —el mismo componente, servicio y endpoint
  que usa el formulario de programar— junto al botón `Agregar`, y debajo la tabla con Matrícula,
  Llegada, Salida y Acciones, con los estilos de las tablas actuales. Maneja carga, error y
  vacío, recarga al abrirse y confirma el borrado con "¿Deseas eliminar las restricciones de la
  matrícula {matricula}?". Agregar limpia el input y deja el modal abierto.
- `OperacionesProgramadasIndex.tsx`: se elimina `xl:grid-cols-2`, de modo que en `Ambas` las
  tablas quedan verticales con Salidas arriba y Llegadas abajo en cualquier pantalla. Las
  pestañas individuales no cambian. Botón `Restringir` con el icono `ShieldBan` a la derecha de
  `Programar operación`, visible solo para admin o para quien tenga el subdepartamento
  `operacionesProgramadas`.
- `OperacionProgramadaModal.tsx`: la respuesta de la vista previa que ya se consulta gana un
  campo `restriccion`, así que la franja roja anticipada no cuesta ninguna petición extra. El
  botón de guardar sigue habilitado y, al presionarlo, el 422 produce la alerta bloqueante.

## Alcance sobre lo existente

Agregar una restricción no elimina ni cancela operaciones programadas, no toca registros
históricos, no cambia el contador de pendientes, no marca operaciones como utilizadas y no
elimina nada de Operaciones Diarias ni de WalkAround. La restricción actúa únicamente al crear o
actualizar una operación programada.

## Pruebas

Pest: la matriz completa de los cuatro estados contra los dos tipos de movimiento; matrícula sin
registro permitida; alta duplicada rechazada; normalización de minúsculas y espacios; el borrado
no toca el catálogo ni las operaciones ya programadas; actualizar solo la hora de una operación
restringida se permite y cambiarle el tipo no; la secuencia se sigue validando después de la
restricción; el evento se emite en las tres acciones y no se emite cuando la operación falla; y
un `POST` directo al endpoint con una matrícula restringida se rechaza igual.

## Decisiones tomadas

1. Bitácora en lugar de timestamps, para no perder el rastro de quién restringió qué.
2. Todo el grupo de endpoints bajo permisos de Despacho, incluida la lectura.
3. La restricción se valida antes que la secuencia.
4. Switch propio en Tailwind, no PrimeReact.
5. Al actualizar, la restricción bloquea solo si cambia la matrícula o el tipo.
6. Se acepta restringir matrículas que aún no existen en el catálogo.
