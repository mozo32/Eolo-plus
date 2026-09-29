# Migración de Prefacturas — Bloque 1a: independizar el catálogo de matrículas

**Fecha:** 2026-09-28 · **Área:** Facturación (nueva) · **Estado:** implementado (2026-09-29)

Primer bloque de la migración descrita en
`2026-09-28-facturacion-catalogos-design.md`, que pasa a ser el bloque **1b**.

## El problema que resuelve

Eolo-plus **ya depende de la base de datos de Prefacturas**. La conexión
`remota` de `config/database.php:115` apunta a `fact-fbo`, y nueve controladores
la usan:

```
AeronaveController · WalkAroundController · OperacionesDiariasController
MovimientoCSAEController · PernoctaDiaController · RemisionController
ServicioComisariatoController · TurnoAutotanqueController
```

| Tabla remota | Usos | Acceso |
|---|---|---|
| `tb_matricula` | 17 | lectura **y escritura** |
| `tb_tipo` | 6 | lectura **y escritura** |
| `tb_combustible` | 2 | lectura |

`tb_matricula` es hoy la **fuente de verdad de matrículas para todo Eolo-plus**:
el autocompletado que usan Operaciones Diarias, WalkAround, Remisiones,
Préstamo de chalecos y Comisariato lee de ahí
(`AeronaveController::autocomplete`). La tabla local `aeronaves` es un
complemento, y por eso nunca tuvo índice único en `matricula`.

Además, cinco controladores **dan de alta matrículas dentro de la base de
Prefacturas** cuando no existen, siempre con el mismo cuerpo
(`id_categoria = 0`, `id_motor = 0`, …), que es el registro incompleto que
`a_pref.php` desvía a `Actualizar_matri.php`.

**Consecuencia:** el día que se apague Prefacturas, esos nueve controladores
dejan de funcionar. Este bloque corta esa dependencia con el sistema viejo
todavía encendido como respaldo.

## Alcance

**Entra:** todo lo que cuelga de la matrícula.

- `aeronaves` se vuelve la tabla autoritativa, con índice único en `matricula`
- `tipo_aeronaves` absorbe `tb_tipo`
- Atributos de facturación de la matrícula: categoría, tipo de motor, estatus
- Precio de combustible
- Un servicio único que centraliza buscar y dar de alta matrículas, hoy
  duplicado en cinco controladores
- Reapuntar los nueve controladores
- Cuatro pantallas de administración

**No entra** (queda en 1b): clientes, servicios y sus categorías, formas de pago
y proveedores.

## Decisiones

| Tema | Decisión |
|---|---|
| Dónde viven las matrículas | En `aeronaves`, la tabla que ya existe. No se crea una tabla paralela: sería un tercer lugar donde buscar la misma matrícula. |
| Tipos de aeronave | `tb_tipo` se funde en `tipo_aeronaves`, que ya existe y ya tiene FK desde `aeronaves`. |
| Atributos de facturación | En la satélite `fact_aeronaves`, no en `aeronaves`: la categoría y el motor solo importan para cobrar, y `aeronaves` la usan módulos que no facturan. |
| Índice único | Se agrega a `aeronaves.matricula`, previa depuración de duplicados. Sin él, la satélite 1-1 no se puede garantizar. |
| Alta automática | Se conserva: si una matrícula no existe al capturar una operación, se crea. Lo que cambia es que se crea en `aeronaves` y por un solo camino. |
| Combustible | Se conservan los **dos** precios (ASA y Eolo) porque hay controladores que usan cada uno, y se agrega historial de vigencias. |

## Datos

### `aeronaves` — se modifica

| Cambio | Detalle |
|---|---|
| `matricula` | pasa a `unique`, en migración aparte y posterior a la depuración |
| `aeronave_id` | se vuelve `nullable`: hoy es obligatoria, pero las altas automáticas no conocen el tipo (`id_tipo = 0` en el sistema viejo) |

No se agregan columnas: los atributos de facturación van en la satélite.

### `fact_categorias_aeronave`

| Columna | Tipo | Notas |
|---|---|---|
| id | bigint | |
| nombre | string(60) | único |
| tarifa_pernocta | decimal(10,2) | |
| tarifa_transito_2h | decimal(10,2) | |
| tarifa_transito_12h | decimal(10,2) | |
| status | char(1) | `A`/`N` |
| timestamps | | |

### `fact_tipos_motor`

| Columna | Tipo | Notas |
|---|---|---|
| id | bigint | |
| nombre | string(60) | único |
| tarifa_aterrizaje | decimal(10,2) | |
| status | char(1) | |
| timestamps | | |

### `fact_aeronaves` — satélite 1-1 de `aeronaves`

| Columna | Tipo | Notas |
|---|---|---|
| id | bigint | |
| aeronave_id | FK aeronaves | único, `cascadeOnDelete` |
| categoria_aeronave_id | FK fact_categorias_aeronave nullable | nulo = matrícula incompleta |
| tipo_motor_id | FK fact_tipos_motor nullable | |
| estatus | string(10) | `guarda` \| `transito`, default `transito` (`tb_estatus`: id 1 = Transito, id 2 = Guarda; el alta antigua siempre usaba id 1) |
| cobra_derecho_vuelos | boolean | default true |
| timestamps | | |

`categoria_aeronave_id` nula reproduce el `id_categoria = 0` del sistema viejo:
la matrícula existe pero no se puede facturar todavía.

### `fact_precios_combustible`

| Columna | Tipo | Notas |
|---|---|---|
| id | bigint | |
| precio_asa | decimal(10,4) | lo que cuesta; `tb_combustible.pasa` |
| precio_eolo | decimal(10,4) | lo que se cobra; `tb_combustible.p_combustible` |
| vigencia_inicio | date | index |
| vigencia_fin | date nullable | nulo = vigente |
| user_id | FK users | quién lo capturó |
| timestamps | | |

**La fórmula del precio Eolo sale del código.** Hoy
`actualizar_combustible.php:11` calcula:

```php
$peolo = ($pasa + 0.50) * 1.15;
```

El `+0.50` y el `1.15` quedan como columnas en una fila de configuración del
módulo, no escritos en el código. La pantalla propone el precio Eolo calculado y
permite sobrescribirlo, porque hoy se guarda el resultado y no la fórmula.

`tb_combustible` es hoy **una sola fila** que se sobrescribe
(`WHERE id_combustible = 1`): no hay historial. El historial de vigencias es
nuevo; la importación trae esa fila como el registro vigente.

## El servicio de catálogo

Cinco controladores repiten hoy la misma secuencia: buscar la matrícula, y si no
existe insertarla con el mismo cuerpo de ceros. Se extrae a
`App\Services\CatalogoAeronaves`:

```php
// Busca la matrícula y devuelve sus datos de catálogo, o null si no existe.
public function buscar(string $matricula): ?DatosAeronave

// Devuelve la aeronave, creándola si no existía. Reemplaza los cinco inserts
// duplicados. El tipo se resuelve o se crea por nombre, como hoy hace tb_tipo.
public function buscarOCrear(string $matricula, ?string $tipo = null): Aeronave

// Autocompletado: matrículas que contienen el texto, máximo 10, como hoy.
public function autocompletar(string $texto, int $limite = 10): array
```

`DatosAeronave` es un objeto de solo lectura con `matricula`, `tipo`, `estatus` y
`categoria`, que son exactamente los cuatro campos que hoy devuelve el join
remoto a `tb_matricula`, `tb_estatus`, `tb_tipo` y `tb_categoria`.

La creación corre dentro de una transacción y se apoya en el índice único: dos
capturas simultáneas de la misma matrícula no producen dos filas. Quien pierde
la carrera atrapa `UniqueConstraintViolationException` y relee con un bloqueo
compartido (`sharedLock`), que rompe el snapshot de REPEATABLE READ sin la
mejora de bloqueo que causaría deadlock con tres o más peticiones. Lo mismo vale
para el registro satélite de `fact_aeronaves`.
Quien pierde la carrera queda con un bloqueo compartido sobre la fila de la
ganadora que InnoDB no libera hasta el commit, así que no escribe en ella:
cualquier `UPDATE` sería otra mejora S->X con riesgo de deadlock. Por eso no
completa el tipo; si la ganadora dejó el tipo vacío, lo llena la siguiente
captura con tipo por el camino normal.

## Reapuntar los controladores

Cada uno cambia su bloque `DB::connection('remota')` por una llamada al
servicio. El contrato de respuesta hacia el frontend **no cambia**: mismos
nombres de campo, mismos valores.

| Controlador | Qué usa hoy | Qué usará |
|---|---|---|
| `AeronaveController::buscarPorMatricula` | join remoto → `tipo` | `buscar()->tipo` |
| `AeronaveController::autocomplete` | `tb_matricula` like | `autocompletar()` |
| `OperacionesDiariasController` | `tb_tipo` + alta en `tb_matricula` | `buscarOCrear($matricula, $equipo)` |
| `WalkAroundController` | `tb_tipo` + alta en `tb_matricula` | `buscarOCrear()` |
| `MovimientoCSAEController` | `tb_tipo` + alta en `tb_matricula` | `buscarOCrear()` |
| `PernoctaDiaController` | join remoto + alta + listado | `buscar()`, `buscarOCrear()`, `autocompletar()` |
| `ServicioComisariatoController` | join remoto + alta | `buscar()`, `buscarOCrear()` |
| `RemisionController` | `tb_combustible.p_combustible` | precio Eolo vigente |
| `TurnoAutotanqueController` | `tb_combustible.pasa` | precio ASA vigente |

Al terminar, `config/database.php` conserva la conexión `remota` porque la usará
el importador, pero **ningún controlador la referencia**. Una prueba lo verifica.

## Importador

```bash
php artisan facturacion:importar-matriculas              # simulación
php artisan facturacion:importar-matriculas --aplicar
```

Lee de la conexión `remota` ya configurada. Orden:

```
tb_tipo → tipo_aeronaves
tb_categoria + tarifas → fact_categorias_aeronave
tb_motor + tb_aterrisaje → fact_tipos_motor
tb_matricula → aeronaves + fact_aeronaves
tb_combustible → fact_precios_combustible
```

Idempotente: empata por nombre (tipo, categoría, motor) y por matrícula.

### Validaciones que reporta

1. **Matrículas de una misma categoría con tarifas distintas.** El sistema viejo
   copia las tarifas de una matrícula vecina con `LIMIT 1`, así que el modelo
   "tarifa por categoría" solo se sostiene si no hay divergencia. Si aparece, se
   detiene y se revisa el modelo antes de aplicar.
2. **Matrículas repetidas** en `tb_matricula` o en `aeronaves`. Se reportan y se
   omiten; si ya hay repetidas en `aeronaves`, la migración del índice único falla listándolas y deben depurarse.
3. **Matrículas en `aeronaves` que no están en `tb_matricula`**, y al revés.
4. **Matrículas con `id_categoria = 0`**: se importan con
   `categoria_aeronave_id` nula y se cuentan en el reporte.
5. **Tipos duplicados** entre `tb_tipo` y `tipo_aeronaves` con distinta
   escritura (mayúsculas, espacios).

## Pantallas

Cuatro, cada una con su subdepartamento propio.

| Pantalla | Ruta Inertia | Subdepartamento |
|---|---|---|
| Aeronaves facturables | `Facturacion/AeronavesFacturacion` | `factAeronaves` |
| Categorías de aeronave | `Facturacion/CategoriasAeronave` | `factCategoriasAeronave` |
| Tipos de motor | `Facturacion/TiposMotor` | `factTiposMotor` |
| Combustible | `Facturacion/Combustible` | `factCombustible` |

**Corrección respecto al bloque 1b tal como está escrito:** ahí se propuso un
solo subdepartamento `catalogosFacturacion` para todas las pantallas. No
funciona: `HandleInertiaRequests` construye el menú a partir de los
subdepartamentos del usuario (`route` = `slug(departamento).slug(subdepartamento)`)
y `navigation.ts` los resuelve contra `ROUTE_CONFIG`. Un solo subdepartamento
produce una sola entrada de menú. Por eso **cada pantalla lleva el suyo**, lo que
además da permisos más finos. Asignarlos en bloque es barato con la función de
agrupar por departamento que se agregó a Gestión de usuarios.

En el menú, las tres de catálogo puro se agrupan bajo un nodo **Catálogos** con
el mecanismo `children` que `navigation.ts` ya usa en Rampa → Combustible.
**Aeronaves facturables** queda en el primer nivel.

## Endpoints

Prefijo `api/facturacion`, middleware `auth:sanctum`. Consultar requiere sesión;
escribir requiere el subdepartamento de esa pantalla. Admin siempre pasa.

- `aeronaves` — `GET /`, `PUT /{id}` (asignar categoría, motor, estatus,
  derecho de vuelos)
- `categorias-aeronave` — `GET /`, `POST /`, `PUT /{id}`, `PATCH /{id}/desactivar`
- `tipos-motor` — igual
- `precios-combustible` — `GET /`, `GET /vigente`, `POST /` (cierra el anterior)

Baja lógica atómica: `UPDATE ... WHERE id = ? AND status = 'A'`, 409 si ya
estaba dada de baja. Cada escritura registra en bitácora con
`Bitacora::MODULO_FACTURACION_CATALOGOS`.

## Pruebas

`tests/Feature/Facturacion/`:

- **Servicio de catálogo:** `buscar` devuelve los cuatro campos; `buscarOCrear`
  crea una sola fila ante dos llamadas con la misma matrícula; el tipo se
  reutiliza si ya existe con ese nombre.
- **Controladores reapuntados:** por cada uno, que la respuesta conserve los
  mismos campos que hoy y que la matrícula nueva quede en `aeronaves`. Una
  prueba recorre `app/Http/Controllers` y falla si alguno vuelve a mencionar
  `connection('remota')`.
- **Catálogos:** 401 sin sesión, 403 sin el subdepartamento, alta, edición, baja
  lógica atómica (409 en la segunda), bitácora.
- **Combustible:** al capturar un precio se cierra la vigencia anterior y solo
  queda uno vigente; el precio Eolo propuesto sigue `(asa + ajuste) × margen`.
- **Importador:** con una sqlite que imita `fact-fbo`, que sea idempotente, que
  detecte la divergencia de tarifas, que reporte duplicados sin importarlos y
  que la simulación no escriba nada.

## Entregables

- Migraciones: `fact_categorias_aeronave`, `fact_tipos_motor`, `fact_aeronaves`,
  `fact_precios_combustible`, configuración del módulo, y dos que modifican
  `aeronaves` (nullable en `aeronave_id`, único en `matricula`)
- Modelos y sus relaciones
- `App\Services\CatalogoAeronaves` y el objeto `DatosAeronave`
- Nueve controladores reapuntados
- Comando `facturacion:importar-matriculas`
- Seeder del departamento `Facturacion` y sus cuatro subdepartamentos
- Constante `Bitacora::MODULO_FACTURACION_CATALOGOS`
- Cuatro pantallas con sus stores y componentes
- Entradas en `ROUTE_CONFIG` y agrupación en `navigation.ts`
- Suite de pruebas

## Orden de despliegue

El índice único en `aeronaves.matricula` va en la **última** migración
(`2026_09_29_099000_add_unique_matricula_to_aeronaves`, que debe seguir
ordenando después de todas las demás). Su `up()` revisa antes las matrículas
repetidas y, si las hay, falla con un mensaje que las lista; las migraciones
anteriores ya quedaron aplicadas. `php artisan migrate --step` no sirve para
excluirla: solo pone cada migración en su propio lote.

1. `php artisan migrate` (si hay matrículas repetidas falla limpio al final:
   depurarlas y volver a correrlo)
2. `php artisan facturacion:importar-matriculas` (simulación) y revisar el reporte
3. `php artisan facturacion:importar-matriculas --aplicar`
4. `php artisan db:seed --class=FacturacionSubdepartamentosSeeder`
5. Asignar los subdepartamentos desde Gestión de usuarios
6. `npm run build`

## Pendiente que requiere respuesta del usuario

**Significado de `d_vuelos`.** `a_pref.php` cobra un servicio de $900 cuando vale
0, y todas las altas lo escriben en 0 siempre, por lo que hoy se cobra a todos.
Se modeló como `cobra_derecho_vuelos` con valor verdadero por omisión, que
reproduce el comportamiento actual. Falta confirmar en qué caso no debe cobrarse.
No bloquea este bloque: el cargo se aplica en el bloque 2.
