# Préstamo de chalecos — backend y conexión a base de datos

**Fecha:** 2026-09-22 · **Área:** Tráfico · **Estado:** aprobado

El prototipo frontend (modal, tabla, filtros, devolución) ya está aprobado y
vive en `resources/js/pages/Trafico/prestamoChalecos/`, con datos simulados en
memoria. Aquí se le da persistencia real.

## Decisiones

| Tema | Decisión |
|---|---|
| Foto de la INE | Disco **privado** (`local`, `storage/app/prestamos-chalecos/AAAA/MM`). Es una identificación oficial: no puede quedar en `public` con URL abierta como las evidencias de vehículos. Se sirve por `GET /api/PrestamoChalecos/{id}/ine`, que exige sesión. |
| Modelo de imagen | Se reutiliza `App\Models\Imagen` (el mismo de WalkAround y Vehículos EOLO) y la mecánica de `VehiculoEoloController::guardarImagenSubida`, cambiando el disco. FK directa `foto_ine_imagen_id` en lugar de la tabla polimórfica: es una sola foto por préstamo. |
| Quién entrega | Usuarios del área de **Trafico** con vínculo activo. La consulta se extrae a `User::scopeDelAreaDeTrafico()` y Control de Medicamentos pasa a usarla (hoy la tiene duplicada en su controlador). |
| Permisos | Subdepartamento `prestamoChalecos` (Tráfico) para crear y devolver; consultar abierto a autenticados. Admin siempre pasa. |
| Filtro de fecha | El `ModalPeriodo` creado para Relación de planta se mueve a `resources/js/components/ModalPeriodo.tsx` y lo comparten ambos módulos: día, rango, mes, año. |
| Estado | Se conserva el filtro de estado en esta tabla (a diferencia de Relación de planta). |

## Datos

Tabla `prestamos_chalecos`:

| Columna | Tipo | Notas |
|---|---|---|
| id | bigint | |
| fecha | date | index; fecha del préstamo |
| nombre_recibe | string(120) | |
| usuario_entrega_id | FK users | quien entrega (debe ser de Tráfico al guardar) |
| foto_ine_imagen_id | FK imagens nullable | `nullOnDelete` |
| estado | string(12) | `prestado` \| `devuelto`, index |
| fecha_devolucion | datetime nullable | |
| devuelto_por_user_id | FK users nullable | |
| user_id | FK users | auditoría: quién capturó |
| timestamps | | |

Modelo `PrestamoChaleco`: constantes `ESTADO_PRESTADO`/`ESTADO_DEVUELTO`,
scopes `prestados()`/`devueltos()`, relaciones `entregadoPor`, `devueltoPor`,
`capturadoPor`, `fotoIne`.

## Endpoints (`auth:sanctum`, prefijo `PrestamoChalecos`)

- `GET /` — histórico paginado. Filtros: `nombre` (LIKE sobre `nombre_recibe`),
  `fecha_inicio`, `fecha_fin` (whereDate), `estado`, `per_page` ∈ {10,20,50}.
  Orden: prestados primero, luego `fecha desc`, `id desc`. Incluye
  `entregado_por`, `devuelto_por` y si tiene foto.
- `GET /personal` — usuarios de Tráfico `[{id, name}]` ordenados por nombre.
- `POST /` — `multipart/form-data`: `fecha` (date), `nombre_recibe`
  (required max 120, trim), `usuario_entrega_id` (required, existe y es de
  Tráfico → si no, 422 "La persona seleccionada no pertenece al área de
  Tráfico."), `foto_ine` (`required|image|mimes:jpg,jpeg,png,webp|max:10240`).
  Crea en estado `prestado`; bitácora `CREAR`. Si algo falla, se borra el
  archivo guardado. **subdep:prestamoChalecos**
- `PATCH /{id}/devolver` — atómico: `UPDATE … WHERE id=? AND estado='prestado'`.
  0 filas → **409** `{codigo:'ya_devuelto'}`. Guarda `fecha_devolucion` (hora
  del servidor) y `devuelto_por_user_id`; bitácora `FINALIZAR`.
  **subdep:prestamoChalecos**
- `GET /{id}/ine` — `Storage::disk('local')->response()` de la imagen; 404 si el
  préstamo no tiene foto o el archivo no existe. Solo autenticados.

Bitácora: `Bitacora::MODULO_PRESTAMO_CHALECOS = 'PRESTAMO_CHALECOS'`.
Seeder `PrestamoChalecosSubdepartamentoSeeder` (Tráfico → `prestamoChalecos`).

## Frontend

- `usePrestamosChalecos` consulta el API (paginación en servidor), recarga tras
  prestar y devolver. Se eliminan `prestamosSimulados.ts` y
  `usuariosTraficoSimulados.ts`.
- `types.ts`: `PrestamoChaleco` pasa a la forma del API (`entregado_por`,
  `foto_ine_url`, `fecha_devolucion`); `FiltrosPrestamos` gana `periodo`,
  `fecha_inicio`, `fecha_fin` y conserva `nombre` y `estado`.
- `ModalPeriodo` compartido en `components/`.
- `PrestamoChalecoForm` envía `FormData`; el select de quién entrega se llena
  desde `/personal` y preselecciona al usuario actual solo si es de Tráfico.
- La columna Evidencia INE usa `/api/PrestamoChalecos/{id}/ine`.

## Pruebas

`tests/Feature/PrestamoChalecos/`: creación (archivo en disco privado con
`Storage::fake`, fila, bitácora, foto obligatoria y validada), quien entrega
debe ser de Tráfico, 401/403 de permisos, devolución atómica con 409 en la
segunda, `/ine` protegido y 404 sin foto, histórico (orden, filtro por rango y
por estado, paginación) y `/personal`. Más `tsc`, `eslint`, `npm run build`.

## Fuera de alcance
Edición y eliminación de préstamos, tiempo real, exportaciones, más de una foto.
