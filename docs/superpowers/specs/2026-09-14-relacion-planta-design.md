# Relación de planta — control de préstamo de la GPU N.115

**Fecha:** 2026-09-14
**Área:** Rampa
**Estado:** aprobado

## Objetivo

Registrar el préstamo y la entrega de la única planta de energía (GPU N.115):
a qué empresa y a qué aeronave se presta, la lectura inicial y final del
horómetro y el tiempo total de uso. Un préstamo y su entrega son **el mismo
registro**; nunca se crean dos filas.

No hay catálogo ni selector de equipos: el módulo es exclusivo de la GPU N.115.

## Decisiones

| Tema | Decisión |
|---|---|
| Permisos | Subdepartamento `relacionPlanta` en Rampa. `POST /prestar` y `PATCH /{id}/finalizar` exigen `subdep:relacionPlanta`; consultar (`actual`, `historico`) abierto a cualquier usuario autenticado. Admin siempre pasa. El subdepartamento es además lo que hace aparecer el módulo en el menú de un usuario no admin. |
| Empresa | Input de texto obligatorio, `trim`, máx. 120. Sin catálogo. Un `<datalist>` con las empresas ya usadas en esta misma tabla (`GET /RelacionPlanta/empresas`) ayuda a que los nombres queden consistentes. |
| Matrícula | `InputMatricula` (el mismo de Operaciones Diarias, Programadas y Remisiones). Mayúsculas, guiones válidos, reglas de matrículas nuevas intactas. |
| Unidad del tiempo | **Horas decimales**, `decimal(8,2)`, misma unidad que el horómetro: `tiempo = horometro_fin − horometro_inicio` es una resta directa que backend y frontend verifican sin conversión. `HH:MM` es solo presentación. No se guarda en minutos para no mantener dos unidades ni redondear al convertir. |
| Quién prestó / finalizó | `Bitacora` (módulo `RELACION_PLANTA`, acciones `CREAR` y `FINALIZAR`). Sin columnas `user_id`. |
| Tiempo real | No se agrega canal. La tarjeta se recarga tras cada acción y al recibir un 409. |
| Fechas | `fechaHoy()` de `despacho/operacionesProgramadas/types.ts` (Intl, `America/Mexico_City`). Nunca `toISOString()`. |

## Datos

Tabla `relaciones_planta`:

| Columna | Tipo | Notas |
|---|---|---|
| id | bigint | |
| fecha | date | fecha del préstamo, editable al registrar |
| empresa | string(120) | |
| matricula | string(20) | index |
| horometro_inicio | decimal(10,2) | ≥ 0 |
| horometro_fin | decimal(10,2) nullable | null mientras está en uso; ≥ inicio al finalizar |
| tiempo | decimal(8,2) nullable | horas decimales; null mientras está en uso |
| status | string(12) | `en_uso` \| `finalizado`, index |
| created_at / updated_at | timestamps | |

Modelo `App\Models\RelacionPlanta`: constantes `STATUS_EN_USO`, `STATUS_FINALIZADO`,
`EQUIPO = 'GPU N.115'`; casts `fecha:date`, horómetros y tiempo `decimal:2`;
scopes `enUso()` y `finalizadas()`. Sin relaciones Eloquent.

## Backend

### Rutas

```
routes/api.php  (auth:sanctum, prefix RelacionPlanta)
  GET   /actual                 → actual      (abierto)
  GET   /historico              → historico   (abierto)
  GET   /empresas               → empresas    (abierto)
  POST  /prestar                → prestar     (subdep:relacionPlanta)
  PATCH /{id}/finalizar         → finalizar   (subdep:relacionPlanta, whereNumber)

routes/web.php  (auth)
  GET /relacionPlanta → Inertia 'Rampa/RelacionPlanta'  name relacionPlanta
```

### `actual`
Devuelve el préstamo `en_uso` (a lo sumo uno) o `null`, con `equipo: 'GPU N.115'`.

### `prestar` — `PrestarRelacionPlantaRequest`
Reglas: `fecha` required date; `empresa` required string max 120 (se `trim`ea);
`matricula` required string max 20 (se normaliza a mayúsculas);
`horometro_inicio` required numeric min 0 max 99999999.99.

Dentro de `DB::transaction`:
1. `RelacionPlanta::enUso()->lockForUpdate()->first()`. En InnoDB el
   `SELECT … FOR UPDATE` sobre `status='en_uso'` (indexado) bloquea el hueco y
   serializa a dos usuarios que intenten prestar a la vez; el segundo espera y
   al continuar ya ve el préstamo del primero. En sqlite (pruebas) la
   transacción serializa por sí sola.
2. Si existe → **409** `{ message, codigo: 'gpu_en_uso', matricula }` con el
   mensaje exacto: *"La GPU N.115 se encuentra en uso por la matrícula
   {matricula}. Debe registrarse su entrega antes de iniciar otro préstamo."*
3. Si no → `create` con `horometro_fin = null`, `tiempo = null`,
   `status = en_uso`; `Bitacora::log(RELACION_PLANTA, CREAR, …)`.
4. **201** `{ message: 'Préstamo registrado correctamente.', prestamo }`.

### `finalizar` — `FinalizarRelacionPlantaRequest`
Reglas: `horometro_fin` required numeric min 0; `tiempo` nullable numeric min 0.

Dentro de `DB::transaction`:
1. `findOrFail($id)` con `lockForUpdate()`.
2. Si `status !== en_uso` → **409** `{ codigo: 'ya_finalizado' }`, mensaje
   *"Este préstamo ya fue finalizado por otro usuario."*
3. Si `horometro_fin < horometro_inicio` → **422** con el mensaje exacto:
   *"El horómetro final no puede ser menor que el horómetro inicial."*
   (campo `horometro_fin`).
4. `tiempo` = el enviado si viene (numérico ≥ 0), si no `round(fin − inicio, 2)`.
5. Actualización **atómica**: `UPDATE … SET horometro_fin, tiempo,
   status='finalizado', updated_at WHERE id=? AND status='en_uso'`. 0 filas →
   mismo 409 `ya_finalizado`.
6. `Bitacora::log(RELACION_PLANTA, FINALIZAR, …)` con anteriores/nuevos.
7. **200** `{ message: 'Entrega registrada correctamente.', prestamo }`.

### `historico`
Paginado. Query params: `page`, `per_page` ∈ {10, 20, 50, 100} (default 20),
`fecha_inicio`, `fecha_fin`, `empresa` (LIKE), `matricula` (LIKE, mayúsculas),
`status` (`en_uso` | `finalizado` | vacío). Orden: `en_uso` primero, luego
`fecha desc`, `id desc`. Respuesta: paginador estándar de Laravel
(`data`, `current_page`, `last_page`, `per_page`, `total`, `from`, `to`).

### `empresas`
`DISTINCT empresa ORDER BY empresa` de la propia tabla, opcional `q` LIKE, máx. 20.

### Seeder
`RelacionPlantaSubdepartamentoSeeder`: Departamento `Rampa` → subdepartamento
`relacionPlanta` (`firstOrCreate`). Registrado en `DatabaseSeeder`.

### Bitácora
`Bitacora::MODULO_RELACION_PLANTA = 'RELACION_PLANTA'`.

## Frontend

```
resources/js/pages/Rampa/RelacionPlanta.tsx        página (AppLayout, breadcrumbs, Head)
resources/js/pages/Rampa/relacionPlanta/
  types.ts            Prestamo, FiltrosHistorico, MetaPaginacion, PER_PAGE_OPCIONES,
                      horasAHHMM(), calcularTiempo(), puedeOperarPlanta(user)
  useRelacionPlanta.ts   actual, cargando, prestar(), finalizar(), recargar()
  useHistoricoPlanta.ts  filtros, pagina, porPagina, meta, registros, tablaRef,
                         cambiarPagina() (scroll al inicio de la tabla)
  TarjetaGpu.tsx      tarjeta de estado (Disponible / En uso) + botón de acción
  PrestamoModal.tsx   fecha, empresa (datalist), InputMatricula, horómetro inicial
  EntregaModal.tsx    inicial (solo lectura), final, tiempo editable + HH:MM
  TablaHistorico.tsx  tabla estilo Rampa, fila de filtros en thead, badges,
                      paginación con selector por página
resources/js/stores/apiRelacionPlanta.ts   ErrorApi (status, codigo), 5 funciones
```

### Visual
- Encabezado como Remisiones: título `RELACIÓN DE PLANTA`, subtítulo
  `CONTROL DE PRÉSTAMO · GPU N.115`, botón `FILTRAR`.
- Tarjeta grande: icono `BatteryCharging`, nombre `GPU N.115`, pill de estado.
  - **Disponible:** borde/fondo esmeralda, "Sin préstamo abierto", botón
    `Registrar préstamo` (teal `#00677F`).
  - **En uso:** borde/fondo ámbar; MATRÍCULA, EMPRESA, FECHA, HORÓMETRO
    INICIAL; botón `Registrar entrega` (ámbar).
  - Sin permiso: la tarjeta y el histórico se ven, sin botones.
- Histórico: columnas #, FECHA, EMPRESA, MATRÍCULA, HORÓM. INICIAL, HORÓM.
  FINAL, TIEMPO (`0.75 h · 00:45`), ESTADO (badge ámbar `EN USO` / esmeralda
  `FINALIZADO`). Filtros: rango de fechas, empresa, matrícula, estado. Estado
  de carga, mensaje sin resultados, `overflow-x-auto` para móvil.
- Paginación: `PÁGINA X DE Y`, selector `10/20/50/100 por página`,
  ANTERIOR/SIGUIENTE; al cambiar de página `tablaRef.scrollIntoView`.

### Flujo de préstamo
Modal con `fecha = fechaHoy()` editable, empresa obligatoria, matrícula con
`InputMatricula`, horómetro inicial (`type=number`, `step=0.01`, `min=0`).
Al guardar: POST; éxito → toast "Préstamo registrado correctamente.", cerrar,
recargar tarjeta e histórico. 409 `gpu_en_uso` → Swal error con título **GPU no
disponible** y el mensaje del backend, y se recarga la tarjeta.

### Flujo de entrega
Modal con inicial en solo lectura, final y tiempo. `tiempo` se recalcula cada
vez que cambia el final (`calcularTiempo`, 2 decimales) y se coloca en el
campo; el usuario puede editarlo; si vuelve a cambiar el final, se recalcula
(se pierde la edición manual, que es lo pedido). Junto al campo:
`≈ HH:MM` y la leyenda *"horas decimales · 0.50 h = 30 min"*. Si final <
inicial: mensaje rojo bajo el campo y botón deshabilitado. Confirmación Swal
antes de enviar. Éxito → toast, tarjeta a Disponible, histórico recargado.
409 `ya_finalizado` → Swal informativo y recarga.

### Menú
`ROUTE_CONFIG.relacionplanta = { href: relacionPlanta, title: 'Relación de planta' }`
y el ítem `{ id: 'rampa-planta', title: 'Relación de planta', href: relacionPlanta() }`
en el bloque admin de Rampa.

## Errores y respuestas

| Caso | HTTP | `codigo` |
|---|---|---|
| Sin sesión | 401 | — |
| Sin subdepartamento (prestar/finalizar) | 403 | — |
| Validación de campos | 422 | — |
| Final < inicial | 422 | — (`errors.horometro_fin`) |
| Ya hay préstamo abierto | 409 | `gpu_en_uso` |
| Préstamo ya finalizado | 409 | `ya_finalizado` |
| Id inexistente | 404 | — |

## Pruebas (Pest, sqlite en memoria)

`tests/Feature/RelacionPlanta/`:
- `PrestarPlantaTest`: actual vacío → `null`; prestar guarda solo inicial
  (fin y tiempo null, status en_uso, empresa trim, matrícula mayúsculas);
  segundo préstamo → 409 con mensaje exacto y matrícula; invitado 401;
  usuario sin subdep 403; admin y usuario con subdep pasan; bitácora CREAR;
  validaciones (horómetro negativo, empresa vacía).
- `FinalizarPlantaTest`: calcula `fin − inicio` cuando no viene tiempo;
  acepta tiempo manual; final < inicial → 422 con mensaje exacto; finalizar
  dos veces → 409; tras finalizar `actual` es null y se puede prestar de
  nuevo; el registro es el mismo id; bitácora FINALIZAR; 403 sin subdep.
- `HistoricoPlantaTest`: orden (en_uso primero, luego fecha desc); filtros
  por rango, empresa, matrícula, status; `per_page` respetado y acotado.
- Frontend: `tsc`, `eslint`, `npm run build`, recorrido manual en navegador.

## Fuera de alcance
Editar o eliminar registros finalizados, reactivar, más de una GPU, tiempo
real, exportaciones.
