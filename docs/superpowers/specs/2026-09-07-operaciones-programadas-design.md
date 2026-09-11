# Operaciones Programadas — Diseño

Fecha: 2026-09-07
Módulo: Despacho
Estado: aprobado por el usuario

## Objetivo

Permitir que Despacho programe llegadas y salidas para una fecha determinada. Una operación programada es planeación, no una operación terminada. Sirve además como origen para iniciar registros en Operaciones Diarias y en WalkAround, precargando la información en lugar de capturarla desde cero.

## Estructura de datos

No se modifica ninguna tabla existente. Se agregan dos tablas.

### `operaciones_programadas`

| Columna | Tipo | Nota |
|---|---|---|
| `id` | bigint | |
| `user_id` | FK users, nullOnDelete | quién programó |
| `fecha` | date | |
| `tipo` | enum `llegada` / `salida` | mismo vocabulario que `operaciones_diarias` |
| `matricula` | string(20) | |
| `equipo` | string(50) | |
| `hora` | time | |
| `lugar` | string(100) nullable | destino si salida, origen si llegada |
| `pax` | unsignedSmallInteger nullable | |
| `fp` | string(100) nullable | texto libre del plan de vuelo, solo salida |
| `fp_folio` | string(50) nullable | **oculto**: no se muestra ni se escribe; se conserva el histórico |
| `observaciones` | text nullable | |
| `status` | char(1) default `A` | `A` activa, `I` cancelada |

Índices: `(fecha, tipo)`, `matricula`, `status`.

### `operacion_programada_usos`

Estado de utilización independiente por módulo.

| Columna | Tipo | Nota |
|---|---|---|
| `id` | bigint | |
| `operacion_programada_id` | FK cascadeOnDelete | |
| `usable_type` / `usable_id` | morphs | `OperacionDiaria` o `WalkAround` |
| `user_id` | FK users nullable | quién la usó |
| `timestamps` | | |

Índice único `(operacion_programada_id, usable_type)`: la base de datos garantiza que una misma programación no se use dos veces dentro del mismo módulo, y que sí pueda usarse una vez en cada uno.

Se eligió tabla intermedia polimórfica en lugar de columnas de estado porque es el patrón que ya usa el proyecto (`firmables`, `imageables`), conserva trazabilidad completa (qué registro final, quién, cuándo) y evita tocar `operaciones_diarias` y `walk_arounds`.

### Borrado

Nunca hay borrado físico. `status = 'I'` es el borrado lógico, igual que en WalkAround. Si la programada tiene usos registrados, la UI ofrece "Cancelar" y advierte que ya está vinculada a un registro terminado.

## Regla de secuencia

La regla vive hoy duplicada e inline en `OperacionesDiariasController::store` (contra `operaciones_diarias`, vocabulario `llegada`/`salida`) y en `WalkAroundController::store` (contra `walk_arounds`, vocabulario `Entrada`/`Salida`). Son dos historiales independientes.

Se extrae a `app/Services/SecuenciaMovimientoService.php`:

- `normalizar($movimiento)` — `Entrada|Llegada|llegada` → `llegada`; `Salida` → `salida`.
- `ultimoMovimientoOperacionDiaria($matricula)` — orden `fecha`, `hora`, `id` descendente.
- `ultimoMovimientoWalkAround($matricula)` — igual, sobre `walk_arounds`.
- `validarFinal($matricula, $movimiento, $fuente)` — regla actual, mensaje idéntico.
- `validarProgramada($matricula, $tipo, $fecha, $hora, $ignorarId)`.

`OperacionesDiariasController::store` y `WalkAroundController::store` pasan a llamar a `validarFinal()`. El texto del mensaje y el código 422 quedan idénticos para no romper el frontend existente. No se unifican las dos secuencias.

`validarProgramada()` arma una línea de tiempo de la matrícula con los movimientos reales de `operaciones_diarias` más las programadas activas, ordenada por `(fecha, hora, id)`, inserta el nuevo evento y valida únicamente los vecinos: si el evento inmediatamente anterior o el inmediatamente posterior tienen el mismo tipo, responde 422. Se validan vecinos y no toda la línea para no bloquear matrículas cuyo historial actual ya está desalineado.

Una programación nunca sustituye la validación definitiva: al guardar en Operaciones Diarias o en WalkAround se vuelve a ejecutar `validarFinal()` contra los registros reales.

## Flujo entre los tres módulos

1. Despacho programa. `validarProgramada()` responde 422 si rompe la secuencia. Se inserta en `operaciones_programadas` con `status = 'A'`.
2. Operaciones Diarias consulta `GET /pendientes?modulo=operaciones_diarias&fecha=`, que excluye las programadas que ya tienen uso en Operaciones Diarias. El panel lateral abre `FormLlegada` / `FormSalida` precargado. Al guardar, `POST /OperacionesDiarias` recibe `operacion_programada_id`; dentro de la misma transacción se ejecuta `validarFinal()`, se da de alta la matrícula nueva en `remota` por el flujo actual, se inserta la operación y se registra el uso.
3. WalkAround consulta `GET /pendientes?modulo=walkaround&fecha=`, independiente del anterior. Precarga el paso 1 de `WalkAroundFormV2` y registra el uso en su propia transacción.

Mapeo hacia WalkAround: `llegada → Entrada`, `salida → Salida`; `lugar → procedencia` o `destino` según el tipo; `equipo → tipo`. `pax`, `fp` y `fp_folio` no existen en WalkAround y se ignoran.

El registro manual se conserva en ambos módulos como alternativa; no se elimina ninguna funcionalidad existente.

## Pantalla

Página `despacho/OperacionesProgramadas.tsx` con `AppLayout`, `Head` y breadcrumbs. Sin librerías nuevas: Tailwind a mano, iconos `lucide-react`, confirmaciones con SweetAlert2, paleta slate con acento `#00677F`.

- Header con título `Operaciones Programadas`, botón `Programar operación` y selector de fecha con default hoy en `America/Mexico_City`.
- Tabs `Ambas | Salidas | Llegadas`, default `Ambas`, con el markup de `MedicamentosModule`.
- En `Ambas`, `grid grid-cols-1 xl:grid-cols-2`: en móvil las tablas se apilan.
- Una sola `TablaOperacionesProgramadas` parametrizada por tipo decide las columnas (Destino + FP para salidas, Origen para llegadas). Recibe un objeto tipado y replica los estilos de las tablas de WalkAround y Operaciones Diarias, incluida la barra de paginación.
- `OperacionProgramadaModal` sirve para crear y para editar. La hora se captura a mano en formato de 24 horas (`HH:mm`, validado con `^([01]\d|2[0-3]):[0-5]\d$` en frontend y backend) y FP es un texto libre opcional que se guarda como `null` cuando queda vacío.
- Matrícula: reutiliza `@/pages/InputMatricula` y `obtenerInfoMatriculaApi`. Autocompleta, precarga `equipo` desde `tb_tipo` y, si no existe, muestra el mismo `Swal` de `WalkAroundFormV2` ("La matrícula X no existe. ¿Continuar?"). Solo continúa al confirmar. Programar no registra nada en `tb_matricula`; eso sigue ocurriendo solo al finalizar el registro real. La lógica queda centralizada en `useMatriculaProgramada`.
- Estado en `useOperacionesProgramadas.ts`.
- `ProgramadasPendientesPanel.tsx` es el panel lateral compartido por los dos módulos consumidores, con el diseño de `MatriculasPendientes.tsx`. Arranca en la fecha local de hoy y lista todas las operaciones del día sin filtrar por hora; si la hora programada todavía no llega, pide una confirmación informativa antes de precargar.

## Permisos

Se reutiliza el middleware `subdep` (`CheckSubDepartamento`), ya aliaseado en `bootstrap/app.php` pero nunca aplicado.

- `POST`, `PUT`, `DELETE` → `subdep:operacionesProgramadas`: solo Despacho y admin.
- `GET /` y `GET /pendientes` → solo `auth:sanctum`: cualquier área que use Operaciones Diarias o WalkAround.

Un seeder agrega el subdepartamento `operacionesProgramadas` bajo `Despacho`. No se aplica el middleware a rutas existentes; no se tocan permisos de otros departamentos.

## Pruebas

Pest sobre sqlite en memoria, según `phpunit.xml`. Se cubren: CRUD y borrado lógico; llegada bloqueada tras llegada y permitida tras salida; inserción entre dos programadas; unicidad del uso por módulo; pendientes que desaparecen de un módulo y siguen en el otro; 403 para usuario sin el subdepartamento.

Limitación: el `store` de Operaciones Diarias y el de WalkAround escriben en la conexión `remota` (`fact-fbo`), inexistente en el entorno de pruebas, por lo que sus tests de integración end-to-end no se ejecutan automáticamente.

## Decisiones tomadas donde el proyecto no definía el comportamiento

1. Primera llegada sin historial: se permite. La regla "una llegada exige una salida previa" se aplica solo cuando existe historial, porque el código actual de Operaciones Diarias permite una llegada sin registros previos y bloquearla impediría programar el primer arribo de una aeronave nueva.
2. `pax` es nullable en la programación; Operaciones Diarias lo sigue exigiendo al finalizar.
3. Se usa `DELETE /{id}` en lugar del patrón `GET eliminar/{id}` de otros módulos, siguiendo a WalkAround, que es el módulo hermano dentro de Despacho.
4. Un uso no se libera si después se borra el registro final: la programada no vuelve a quedar pendiente, para evitar duplicados.
