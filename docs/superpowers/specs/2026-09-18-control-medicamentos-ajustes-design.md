# Control de Medicamentos — seis ajustes

**Fecha:** 2026-09-18 · **Área:** Tráfico · **Estado:** aprobado

## Contexto encontrado

- `ultimosMovimientos` es un `UNION` al vuelo de `entrega_medicamentos` y `control_medicamentos`; registrar o reabastecer un medicamento no deja rastro.
- Roles reales: `admin`, `jefe_area`, `fbo`. `PUT /medicamento/{id}` (reabastecer) no valida rol.
- El PDF se genera en el navegador con `@react-pdf/renderer` (`PdfExporterControlMedicamento.tsx`) desde `GET /ControlMedicamento/index?fecha_inicio&fecha_fin` y se descarga de inmediato. Patrón de vista previa existente: `ReporteRapidoOperacionesModal.tsx` (blob + `iframe`).
- El cierre pasa todas las entregas `A → N` sin guardar a qué cierre pertenecen.
- "Quién entrega" es un input `readOnly` que no se envía; `storeEntrega` guarda `user_id = Auth::id()`.

## Cambios

### 1. Movimientos persistentes
- Tabla `movimientos_medicamentos`: `id`, `medicamento_id` FK, `tipo` string(20) (`NUEVO` | `REABASTECIMIENTO`), `cantidad` int, `user_id` FK, timestamps, índice `created_at`.
- Modelo `MovimientoMedicamento` (`TIPO_NUEVO`, `TIPO_REABASTECIMIENTO`).
- `agregarMedicamento` y `reabastecer` insertan la fila dentro de su transacción.
- `ultimosMovimientos`: tercera rama del `UNION`; todas las ramas agregan `usuario` (nombre). `tipo` del filtro acepta `NUEVO` y `REABASTECIMIENTO`. Ids con prefijo `mov-`.
- Frontend: tipos y etiquetas nuevas, icono, cantidad `+N`, línea "por {usuario}", opciones de filtro.

### 2. Permiso de reabastecer
- Backend: `reabastecer` exige `hasAnyRole(['admin','jefe_area','fbo'])`, si no → 403 `{message: 'No tienes permiso para reabastecer stock.'}`.
- Frontend: `puedeReabastecer` en `MedicamentosModule`; la pestaña Reabastecer no se muestra sin permiso y `view` cae a `entrega`.

### 3. Vista previa del PDF
- `PdfExporterControlMedicamento` genera el blob con el mismo `CierreMedicamentoPdfDoc` y abre un modal (estructura de `ReporteRapidoOperacionesModal`) con `iframe`, botones **Descargar PDF** y **Cerrar**. No descarga al abrir. Descargar usa el mismo blob. La URL se revoca al cerrar.

### 4. Entregas del turno en el PDF
- Migración sobre `entrega_medicamentos`: `control_medicamento_id` nullable FK + índice, y `entregado_por_user_id` nullable FK. Backfill: para cada cierre en orden cronológico, entregas `N` con `created_at ≤ cierre.created_at` y sin vínculo se asignan a ese cierre.
- `store()` (cierre): `A → N` fijando `control_medicamento_id`.
- `index` carga `entregas.medicamento` y `entregas.entregadoPor`.
- PDF: por cierre, sección "ENTREGAS DE MEDICAMENTOS DEL TURNO" (receptor, medicamento, cantidad, entregó, fecha y hora) o "No se registraron entregas de medicamentos durante este turno".
- Regla: una entrega pertenece al cierre con `control_medicamento_id = cierre.id`.

### 5. Inventario Actual
- Quitar encabezado y celda "Entregados", `colSpan` 5 → 4. Cálculo interno y `total_entregado` intactos.

### 6. Quién entrega
- `GET /api/ControlMedicamento/personal` → `[{id, name}]` ordenados por nombre (autenticado).
- `storeEntrega`: `entregaUserId` `required|integer|exists:users,id` → `entregado_por_user_id`; `user_id` sigue siendo `Auth::id()`.
- Frontend: `<select>` con el estilo del selector de medicamento, valor inicial `auth.user.id`, obligatorio.
- Movimientos y PDF muestran `entregado_por` y caen a `user_id` si es null.

## Fuera de alcance
Rediseño visual, tiempo real, edición/eliminación de movimientos, cambios en el cierre más allá del vínculo de entregas.

## Pruebas
`tests/Feature/ControlMedicamento/`: movimientos (NUEVO, REABASTECIMIENTO, orden, usuario, filtro), permisos de reabastecer (empleado 403; admin/jefe_area/fbo 200), entrega guarda `entregado_por_user_id` distinto de `user_id` y lo exige, cierre vincula solo entregas abiertas, `index` devuelve entregas por cierre, `personal` lista usuarios. `tsc`, `eslint`, `npm run build`.
