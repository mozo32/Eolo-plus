# Migración de Prefacturas — Bloque 1b: catálogos de facturación

**Fecha:** 2026-09-28 · **Área:** Facturación (nueva) · **Estado:** aprobado

El sistema de Prefacturas (`C:\xampp\htdocs\EOLO\Prefectura`, PHP plano sobre
MySQL `fact-fbo`) se migra a Eolo-plus. El flujo de prefactura, el cálculo de
estancia, el PDF y el cierre son bloques posteriores.

> **Este documento se partió en dos.** Al escribir el plan de implementación se
> descubrió que Eolo-plus ya depende de la base de Prefacturas: nueve
> controladores leen y escriben `tb_matricula`, `tb_tipo` y `tb_combustible` por
> la conexión `remota`. Todo lo relacionado con la matrícula se movió al bloque
> **1a**, en `2026-09-28-facturacion-1a-matriculas-design.md`, que va primero
> porque es el que puede romper producción.
>
> **Este documento es ahora el bloque 1b** y cubre solo los catálogos que no
> tocan nada existente: clientes, servicios y sus categorías, formas de pago y
> proveedores. Las secciones sobre categorías de aeronave, tipos de motor,
> combustible y `fact_aeronaves` quedan **sustituidas** por las del bloque 1a,
> igual que la decisión de un solo subdepartamento `catalogosFacturacion`: el
> menú se construye desde los subdepartamentos, así que cada pantalla lleva el
> suyo.

## Por qué este bloque va primero

Las tarifas del sistema viejo están escritas dentro del código PHP, repartidas
entre `Reglleg.php`, `insert22.php` y `altaserv.php`. Construir primero el flujo
obligaría a copiar esos precios "temporalmente" a la versión nueva. Empezar por
el catálogo obliga a sacarlos a la luz desde el principio.

El primer entregable es el **reporte del importador en modo simulación**, que
valida que el modelo nuevo aguanta los datos reales antes de que se construya
nada encima.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Base de datos | Tablas nuevas en la base de Eolo-plus. El historial de `fact-fbo` se importa una sola vez. El sistema viejo se apaga al terminar la migración completa. |
| Reglas de negocio | Las fórmulas de estancia y los montos se replican **idénticos** (ningún cobro cambia). Lo que cambia es dónde viven: los precios pasan de código a catálogo editable. |
| Llegada y salida | La prefactura (bloque 2) precargará fecha, hora y lugar desde `operaciones_diarias` y permitirá corregirlos. Nacional/Internacional se sigue preguntando porque hoy no se registra. |
| Área | Departamento nuevo `Facturacion`. Subdepartamento `catalogosFacturacion` para este bloque. |
| Nombres de tabla | Prefijo `fact_` en todas las tablas del módulo. Se aparta de la convención del proyecto (`operaciones_diarias`, `prestamos_chalecos`) a propósito: los nombres genéricos (`clientes`, `servicios`, `proveedores`) chocarían con otros módulos y el prefijo deja claro qué pertenece a Facturación. |
| Aeronaves | Tabla satélite colgada de `aeronaves`, no se duplican matrículas ni se modifica la tabla existente. |

## El hallazgo que define el modelo

`tb_matricula` guarda cuatro llaves de tarifa por avión
(`id_pernocta`, `id_transito2h`, `id_transito12h`, `id_aterrizaje`), lo que
sugiere precios por matrícula. No lo son. En `altamatri.php:46-57`, al dar de
alta una matrícula las tarifas se **copian de otra matrícula**:

```php
// aterrizaje: de otra matrícula con el MISMO MOTOR
SELECT id_aterrizaje FROM tb_matricula WHERE id_motor='$tm' LIMIT 1

// pernocta y tránsitos: de otra matrícula con la MISMA CATEGORÍA
SELECT id_estatus,id_transito2h,id_transito12h,id_pernocta
FROM tb_matricula WHERE id_categoria='$id_categoria' LIMIT 1
```

La regla implícita es:

- **Pernocta y tránsitos (2h y 12h) dependen de la categoría de la aeronave.**
- **El aterrizaje depende del tipo de motor.**

Cuatro tablas de tarifas más cuatro llaves por matrícula se reducen a dos tablas
de tarifas.

**Riesgo abierto:** ese `LIMIT 1` toma una matrícula cualquiera de la categoría.
Si alguien editó tarifas a mano, puede haber aviones de la misma categoría con
precios distintos. No se pudo verificar sin acceso a la base. **Es la validación
número 1 del importador**; si aparece la divergencia, este modelo se revisa antes
de continuar.

## Datos

### Tarifas

Tabla `fact_categorias_aeronave`:

| Columna | Tipo | Notas |
|---|---|---|
| id | bigint | |
| nombre | string(60) | único |
| tarifa_pernocta | decimal(10,2) | |
| tarifa_transito_2h | decimal(10,2) | |
| tarifa_transito_12h | decimal(10,2) | |
| status | char(1) | `A`/`N`, baja lógica |
| timestamps | | |

Tabla `fact_tipos_motor`:

| Columna | Tipo | Notas |
|---|---|---|
| id | bigint | |
| nombre | string(60) | único |
| tarifa_aterrizaje | decimal(10,2) | |
| status | char(1) | |
| timestamps | | |

Tabla `fact_precios_combustible`:

| Columna | Tipo | Notas |
|---|---|---|
| id | bigint | |
| precio | decimal(10,4) | el sistema viejo usa 4 decimales en `p_combustible` |
| vigencia_inicio | date | index |
| vigencia_fin | date nullable | nulo = vigente |
| user_id | FK users | quién lo capturó |
| timestamps | | |

El precio vigente es el de `vigencia_fin` nula; al capturar uno nuevo se cierra
el anterior con la fecha del día anterior, dentro de una transacción.

### Catálogos

Tabla `fact_clientes`:

| Columna | Tipo | Notas |
|---|---|---|
| id | bigint | |
| nombre | string(160) | index |
| rfc | string(13) nullable | index; puede faltar en registros viejos |
| correo | string(120) nullable | |
| telefono | string(20) nullable | |
| status | char(1) | |
| timestamps | | |

`tb_clientes` arrastra hoy un `fol_prefactura`, lo que crea un cliente nuevo por
cada prefactura. Aquí el cliente existe una vez y la prefactura lo referencia.

Tabla `fact_categorias_servicio`:

| Columna | Tipo | Notas |
|---|---|---|
| id | bigint | |
| nombre | string(80) | único |
| status | char(1) | |
| timestamps | | |

Tabla `fact_servicios`:

| Columna | Tipo | Notas |
|---|---|---|
| id | bigint | |
| categoria_servicio_id | FK fact_categorias_servicio | |
| nombre | string(120) | index |
| precio_unitario | decimal(10,2) | |
| es_de_tercero | boolean | default false |
| margen | decimal(5,2) | porcentaje; default 0, y 50 cuando `es_de_tercero` |
| ajuste_precio | string(16) | `ninguno` \| `mas_5` \| `sin_iva` \| `comision_131` |
| status | char(1) | |
| timestamps | | |

Tabla `fact_formas_pago`:

| Columna | Tipo | Notas |
|---|---|---|
| id | bigint | |
| nombre | string(60) | único |
| status | char(1) | |
| timestamps | | |

Tabla `fact_proveedores`:

| Columna | Tipo | Notas |
|---|---|---|
| id | bigint | |
| nombre | string(120) | |
| status | char(1) | |
| timestamps | | |

### Enlace con las aeronaves existentes

Tabla `fact_aeronaves` (satélite 1-1 de `aeronaves`):

| Columna | Tipo | Notas |
|---|---|---|
| id | bigint | |
| aeronave_id | FK aeronaves | único, `cascadeOnDelete` |
| categoria_aeronave_id | FK fact_categorias_aeronave | determina pernocta y tránsitos |
| tipo_motor_id | FK fact_tipos_motor | determina aterrizaje |
| estatus | string(10) | `guarda` \| `transito` |
| cobra_derecho_vuelos | boolean | default true |
| timestamps | | |

`aeronaves` no se modifica: la usan otros módulos. Una matrícula que nunca se
factura simplemente no tiene fila aquí.

`estatus` reproduce `tb_estatus`: `id_estatus = 1` es `transito` y `2` es `guarda`.
Solo las de `transito` generan cargos de estancia (`insert22.php` lo condiciona con
`if($estatus == 1)`); una aeronave en guarda tiene contrato de hangar y no paga
estancia suelta. Una matrícula nueva nace en `transito`, como el alta antigua.

## Dos reglas que salen del código

### Recargo de terceros

`altaserv.php:60-70` decide por número de ID:

```php
if ($serv < 94)  → precio tal cual
if ($serv > 93)  → precio + 50%
```

El 93 es la frontera entre servicios propios y de terceros. Insertar un servicio
nuevo rompe la regla. Pasa a ser `es_de_tercero` + `margen` (50 por omisión,
editable). El cálculo se conserva exacto:

```
importe = (precio + precio * margen/100) * cantidad
```

### Servicios con fórmula propia

También en `altaserv.php`:

| ID viejo | Fórmula | `ajuste_precio` |
|---|---|---|
| 106 | `precio × 1.05` | `mas_5` |
| 107 | `precio ÷ 1.16` | `sin_iva` |
| 113 | `(precio ÷ 1.31) × 1.15 + (precio ÷ 1.31)` | `comision_131` |
| resto | sin ajuste | `ninguno` |

El ajuste se aplica al precio unitario **antes** del margen y de la cantidad,
igual que hoy.

## Pantallas

Cada catálogo tiene su propia pantalla, sin pestañas. Todas bajo el área
Facturación con `subdep:catalogosFacturacion`:

| Pantalla | Ruta Inertia | Contenido |
|---|---|---|
| Clientes | `Facturacion/Clientes` | Tabla con buscador (nombre/RFC) y paginación; alta y edición en modal. |
| Servicios | `Facturacion/Servicios` | Tabla con filtro por categoría, precio, margen y ajuste. Las categorías de servicio se administran desde un modal de esta misma pantalla: son una clasificación de los servicios, no un catálogo que se consulte por sí solo. |
| Categorías de aeronave | `Facturacion/CategoriasAeronave` | Categoría y sus tres tarifas: pernocta, tránsito 2h y tránsito 12h. |
| Tipos de motor | `Facturacion/TiposMotor` | Tipo de motor y su tarifa de aterrizaje. |
| Combustible | `Facturacion/Combustible` | Precio vigente e historial de vigencias. |
| Formas de pago | `Facturacion/FormasPago` | Catálogo corto: efectivo, tarjeta, transferencia. |
| Proveedores | `Facturacion/Proveedores` | Catálogo de proveedores. |
| Aeronaves facturables | `Facturacion/AeronavesFacturacion` | Asigna categoría, motor, estatus y derecho de vuelos por matrícula. Reutiliza el autocompletado de matrícula existente. |

### Menú

Ocho entradas sueltas saturarían la barra lateral, así que el área Facturación
agrupa las seis de catálogo puro bajo un nodo **Catálogos** usando el mecanismo
`children` que `navigation.ts` ya emplea en Rampa → Combustible. Quedan en el
primer nivel **Clientes** y **Aeronaves facturables**, que son las de uso diario:

```
Facturacion
 ├─ Clientes
 ├─ Aeronaves facturables
 └─ Catálogos
     ├─ Servicios
     ├─ Categorías de aeronave
     ├─ Tipos de motor
     ├─ Combustible
     ├─ Formas de pago
     └─ Proveedores
```

Son pantallas independientes con su propia ruta; el agrupamiento es solo del
menú.

### Regla común

Un servicio o una tarifa ya usado en una prefactura **no se borra, se desactiva**
(`status = 'N'`), igual que la cancelación de operaciones. Cambiar un precio no
altera prefacturas ya emitidas: el precio se copia al concepto al facturar, que
es como funciona hoy y debe conservarse.

## Endpoints

Prefijo `api/facturacion`, middleware `auth:sanctum`. Consultar requiere sesión;
escribir requiere `subdep:catalogosFacturacion`. Admin siempre pasa.

Las rutas van en kebab-case y **sin** el prefijo `fact_`, que es solo de las
tablas. Por cada catálogo (`clientes`, `servicios`, `categorias-servicio`,
`categorias-aeronave`, `tipos-motor`, `formas-pago`, `proveedores`,
`precios-combustible`, `aeronaves-facturacion`):

- `GET /` — listado paginado con filtros propios de cada uno
- `POST /` — alta
- `PUT /{id}` — edición
- `PATCH /{id}/desactivar` — baja lógica, atómica (`WHERE id=? AND status='A'`,
  409 si ya estaba dada de baja)

Cada escritura registra en bitácora con `Bitacora::MODULO_FACTURACION_CATALOGOS`.

## Importador

Comando de Artisan, no pantalla:

```bash
php artisan facturacion:importar              # simulación, no escribe
php artisan facturacion:importar --aplicar    # ejecuta
```

Conexión **de solo lectura** a `fact-fbo`, declarada en `config/database.php`
como conexión `prefactura_legacy` y configurada por `.env`
(`LEGACY_DB_HOST`, `LEGACY_DB_DATABASE`, `LEGACY_DB_USERNAME`,
`LEGACY_DB_PASSWORD`). Nunca credenciales en el código.

Orden de importación, que respeta las dependencias:

```
fact_categorias_aeronave + fact_tipos_motor (con sus tarifas)
  → fact_aeronaves
  → fact_clientes
  → fact_categorias_servicio → fact_servicios
  → fact_precios_combustible → fact_formas_pago → fact_proveedores
```

**Idempotente**: empata por llave natural (matrícula, RFC o nombre del cliente,
nombre del servicio), nunca por ID. Se puede correr las veces que haga falta.

### Validaciones que reporta

1. **Matrículas de una misma categoría con tarifas distintas.** Si aparece, el
   modelo "tarifa por categoría" no se sostiene y hay que revisarlo.
2. **Matrículas en `fact-fbo` que no existen en `aeronaves`**, y al revés.
3. **Clientes duplicados** por RFC o por nombre (esperados: hoy se crea uno por
   prefactura).
4. **Servicios con ID > 93 marcados como propios**, o menores marcados como de
   tercero.
5. **Matrículas con `id_categoria = 0`**, que hoy `a_pref.php` desvía a
   `Actualizar_matri.php`.
6. **Matrículas repetidas en `aeronaves`.** La columna `matricula` de esa tabla
   **no tiene índice único**, y el importador empata por matrícula para crear la
   fila satélite 1-1. Si hay repetidas no puede decidir a cuál colgarla: las
   reporta y las **omite** en lugar de elegir una al azar, para que se depuren
   antes de aplicar. Poner el índice único en `aeronaves` queda fuera de este
   bloque: esa tabla la usan otros módulos y merece su propia revisión.

La simulación imprime el conteo por tabla y la lista de hallazgos, y deja el
detalle en `storage/logs/facturacion-importacion-AAAA-MM-DD.log`.

## Pruebas

`tests/Feature/Facturacion/`, con Pest:

- Por catálogo: 403 sin el subdepartamento, 401 sin sesión, alta, edición, baja
  lógica atómica (409 en la segunda), validación de campos y registro en
  bitácora.
- Precio de combustible: al capturar uno nuevo se cierra el anterior y solo
  queda uno vigente.
- Servicios: el importe respeta margen y `ajuste_precio` en los cuatro casos.
- Importador, con una sqlite que imita `fact-fbo`: idempotencia (dos corridas
  dejan el mismo resultado), detección de la divergencia de tarifas,
  deduplicación de clientes, y que la simulación no escriba nada.

## Entregables

- Migraciones de las 8 tablas de catálogo + `fact_aeronaves` (9 en total)
- Modelos, controladores, Form Requests y rutas
- Seeder del departamento `Facturacion` y el subdepartamento
  `catalogosFacturacion`
- Constante `Bitacora::MODULO_FACTURACION_CATALOGOS`
- Comando `facturacion:importar` con simulación y reporte
- 8 pantallas independientes con sus stores tipados y componentes, agrupadas en el menú
- Suite de pruebas
- Entrada de menú por área en `navigation.ts`

## Fuera de alcance en este bloque

El flujo de prefactura, el cálculo de estancia, el PDF, el cierre y la
reimpresión, la agrupación, las cotizaciones, el ajuste de estancia y la comisión
Amex. Son los bloques 2, 3 y 4, cada uno con su propio diseño.

## Pendientes que requieren respuesta del usuario

1. **Significado de `d_vuelos`.** `a_pref.php` cobra un servicio de $900 cuando
   vale 0, y todas las altas de matrícula lo escriben en 0 siempre, por lo que
   hoy se cobra a todos. Se modeló como `cobra_derecho_vuelos` con valor
   verdadero por omisión, que reproduce el comportamiento actual. Falta confirmar
   en qué caso no debe cobrarse.
2. **Acceso de lectura a `fact-fbo`** (host, usuario, contraseña) para correr la
   simulación. Sin esto el importador se puede escribir, pero no se puede
   entregar el reporte de hallazgos.

## Nota de seguridad

El sistema viejo **no tiene autenticación real**: `Loginusr.php` consulta el
usuario y la contraseña en dos queries independientes, así que cualquier
contraseña existente en la tabla autentica a cualquier usuario; además nunca
llama a `session_start()`, por lo que `menu_fact.php` se abre escribiendo la URL.
Al quedar dentro de Eolo-plus el módulo estará detrás de sesión y permisos: hay
que avisar al personal que hoy entra sin restricción, y asignarles el
subdepartamento antes de apagar el sistema viejo.

Las credenciales de `fact-fbo` están en texto plano en `conexion.php`, dentro del
repositorio. Conviene rotarlas y crear un usuario de solo lectura para el
importador.
