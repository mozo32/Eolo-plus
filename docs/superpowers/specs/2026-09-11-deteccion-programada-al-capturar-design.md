# Detección de operaciones programadas al capturar la matrícula — Diseño

Fecha: 2026-09-11
Módulos: Operaciones Diarias, WalkAround, Operaciones Programadas
Estado: aprobado por el usuario

Segunda mitad de la solicitud del 10 de septiembre (puntos 5 a 11). La vista de televisión
ya se entregó por separado.

## Objetivo

Cuando el usuario capture una matrícula a mano en Operaciones Diarias o en WalkAround —en vez
de usar el botón de programadas— el sistema detecta si esa matrícula tiene una operación
programada para hoy del mismo tipo y ofrece cargarla. El registro imprevisto sigue disponible
exactamente como hoy.

## Un solo hook de detección

`useDeteccionProgramada({ modulo, tipo, matricula, fecha, activo, onVincular, onDesvincular })`
en `operacionesProgramadas/`, compartido por `FormLlegada`, `FormSalida` y el paso 1 de
`WalkAroundFormV2`.

- Debounce de 500 ms sobre `(matricula, tipo, fecha)`. Solo consulta cuando la matrícula está
  completa según las mismas expresiones que valida `InputMatricula`, normalizada como en todo el
  sistema (sin espacios, mayúsculas, guiones intactos).
- Expone `buscarAhora()` para disparar sin esperar: al elegir una sugerencia y al perder el
  foco.
- Recuerda la decisión por clave `matricula|tipo|fecha`: no vuelve a preguntar por la misma
  combinación después de cargar o de continuar manualmente.
- No toca el estado del formulario: resuelve a través de `onVincular(precarga)` y
  `onDesvincular()`.

## El endpoint

`GET /api/OperacionesProgramadas/coincidencias?matricula=&tipo=&modulo=&fecha=`, solo
`auth:sanctum`. Reutiliza el scope `pendientesPara(modulo)` más matrícula exacta, fecha y tipo.
Responde `{ coincidencias: [...], del_otro_tipo: n }`. Como el scope ya excluye por módulo, una
operación realizada en Operaciones Diarias sigue apareciendo para WalkAround.

## El dueño del vínculo sigue siendo el padre

`OperacionesCards` y `TablaWalkAround` conservan `precargas{pestaña}` y lo bajan como
`datosProgramados`. El formulario detecta; el padre decide.

Al elegir "Cargar operación" el formulario llama `onVincular(precarga)`. El padre revisa si otra
pestaña ya tiene ese `operacionProgramadaId`: si sí, advierte, cambia el foco a esa pestaña y
devuelve `false`; si no, guarda la precarga para esta pestaña y devuelve `true`. Solo entonces el
formulario rellena los campos compatibles. El `operacion_programada_id` llega por el
`datosProgramados` que ya sincroniza el efecto existente.

El mismo guardia de unicidad se aplica al flujo del botón de programadas (`abrirDesdeProgramada`),
que hasta ahora no lo tenía.

## Los tres desenlaces

- Ninguna coincidencia: silencio. Si `del_otro_tipo > 0`, franja informativa discreta dentro del
  formulario, sin bloquear.
- Una coincidencia: alerta "Operación programada encontrada" con "Cargar operación" y
  "Continuar manualmente". Cargar rellena solo matrícula, equipo, hora, lugar, PAX y
  observaciones; conserva lo que el usuario ya escribió en campos ajenos a la programación; y si
  la hora aún no llega dispara la misma confirmación de hora futura del panel. Continuar
  manualmente registra la decisión y el payload viaja con `continuar_manual: true`.
- Varias coincidencias: alerta con `input: 'radio'`, una opción por operación (hora, origen o
  destino, equipo, PAX, observaciones) y "Continuar manualmente" como cancelación. Nunca se
  elige la primera automáticamente; se conserva el ID exacto de la elegida.

## Re-búsqueda al cambiar datos

Si la pestaña está vinculada y cambian matrícula, tipo o fecha, el hook llama `onDesvincular()`,
el padre limpia la precarga, el `operacion_programada_id` cae a `null` por el efecto existente, y
se vuelve a buscar. Nunca sobrevive un ID que no corresponda al formulario.

## Backend: coherencia al guardar

`vincular()` verifica, leyendo del propio registro final, que la programada coincida en
matrícula (normalizadas), tipo (`normalizar` entiende Entrada/Llegada) y fecha (día exacto). Un
desajuste aborta con 422 y la transacción hace rollback. Se suma a lo que ya había: no
cancelada, no usada en este módulo. Operaciones Diarias marca `realizada` en la misma
transacción; WalkAround solo registra su uso.

`continuar_manual = true` hace que el backend ignore cualquier `operacion_programada_id`
recibido. El backend nunca vinculó por coincidencia de matrícula, fecha u hora; solo por ID
explícito. La bandera es un cinturón extra.

## Archivos

Crear: `useDeteccionProgramada.ts`, `coincidenciasProgramadas.ts`, `DeteccionProgramadaTest.php`.

Modificar: `OperacionProgramadaController.php`, `OperacionProgramada.php`,
`OperacionesDiariasController.php`, `WalkAroundController.php`, `routes/api.php`,
`apiOperacionesProgramadas.ts`, `InputMatricula.tsx`, `MatriculaAutocomplete.tsx`,
`FormLlegada.tsx`, `FormSalida.tsx`, `WalkAroundFormV2.tsx`, `GeneralInfo.tsx`,
`OperacionesCards.tsx`, `TablaWalkAround.tsx`, `ProgramadasPendientesPanel.tsx`, `types.ts`.

Sin migración.

## Pruebas

Endpoint: coincidencia exacta; el tipo contrario no se devuelve pero se cuenta; realizada en
Operaciones Diarias aparece para WalkAround y no para Operaciones Diarias; cancelada nunca;
minúsculas encuentran la programada; varias del mismo tipo devuelve todas.

Coherencia: matrícula, tipo o fecha distintos → 422 con rollback; `Entrada` vinculando una
`llegada` → pasa; `continuar_manual` con ID presente → no crea uso ni marca realizada.

Lo de navegador (debounce, alertas, cambio de foco entre pestañas) se revisa en pantalla.

## Decisiones tomadas

1. Fecha estricta: programada y registro real deben ser del mismo día.
2. Sin detección en modo edición: solo en registros nuevos.
3. Selector de varias con alerta de radio, no modal nuevo.
4. El guardia de unicidad entre pestañas se aplica también al botón de programadas.
