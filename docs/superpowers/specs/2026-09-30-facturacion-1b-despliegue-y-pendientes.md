# Bloque 1b — Guía de despliegue y pendientes abiertos

**Fecha:** 2026-09-30 · **Rama:** `facturacion-1b-catalogos` (ramada de `facturacion-1a-matriculas`)

Acompaña a `2026-09-28-facturacion-catalogos-design.md` y continúa la guía del
bloque anterior, `2026-09-29-facturacion-1a-despliegue-y-pendientes.md`. Recoge lo
que hay que verificar **antes** de poner el bloque en producción y lo que la
corrida real va a mostrar sin que sea un error.

## Lo que hizo esta rama

Trae a Eolo-plus cinco catálogos del sistema de prefacturación: clientes,
servicios, categorías de servicio, formas de pago y proveedores. Cada uno tiene
su modelo, su tabla, su importación desde `fact-fbo`, sus endpoints con permisos
y su pantalla (las categorías de servicio viven en un modal dentro de Servicios).

Además cierra una dependencia que los datos reales revelaron: el precio del
servicio **Combustible JET A-1** debe seguir al precio Eolo del combustible.
`actualizar_combustible.php` del sistema viejo hace ambas cosas a la vez; sin
replicar la segunda, el combustible se seguiría cobrando al precio anterior
aunque la pantalla mostrara el nuevo. `FactPrecioCombustible::registrar()` ahora
sincroniza el servicio dentro de la misma transacción.

## Este bloque SÍ toca código del 1a

Conviene decirlo sin rodeos, porque la versión anterior de esta guía afirmaba lo
contrario. Las tablas nuevas no tocan nada existente, pero el código sí:

- **Componentes compartidos de las pantallas del 1a** se refactorizaron para
  servir a las cuatro pantallas nuevas: `PantallaCatalogo`, `CampoMonto`,
  `ModalBase`, `ModalCatalogo`, `formato.ts` y el hook `useAeronavesFacturables`.
  Las cuatro pantallas del 1a (aeronaves facturables, categorías de aeronave,
  tipos de motor y combustible) los usan.
- **Dos archivos de prueba del 1a** se editaron: `ImportadorMatriculasTest` y
  `EndpointsCatalogosTest`, además de `tests/Pest.php`.
- **Código de servidor del 1a**: `ImportadorMatriculas`, el comando
  `facturacion:importar-matriculas`, `FactPrecioCombustible`, el seeder de
  subdepartamentos, `routes/web.php` y `routes/api.php`. Las rutas solo se
  agregan; ningún controlador del 1a se modificó.
- **Frontend del 1a**: además de los componentes de arriba, el store
  `apiFacturacionCatalogos.ts`.

Consecuencias para el despliegue:

1. **Backend y frontend se despliegan juntos**, y hay que **reconstruir el
   frontend** (`npm ci && npm run build`). La razón es de un solo sentido: el
   frontend nuevo (pantallas nuevas, menú y componentes compartidos) espera
   endpoints y rutas que solo existen en el backend nuevo. El backend nuevo con
   el frontend viejo no se rompe, porque las rutas solo se agregan, pero deja
   sin reconstruir las pantallas y el menú.
2. **Las cuatro pantallas del 1a no tienen pruebas automáticas de interfaz.**
   Después de desplegar, conviene abrirlas a mano y probar en cada una: cargar,
   crear, editar, y el modal de montos. Es la única red para el refactor de los
   componentes compartidos; la suite de PHP no la cubre.

## Orden de despliegue

```bash
git pull
composer install --no-dev --optimize-autoloader

# Todas las migraciones crean tablas nuevas; ninguna toca datos existentes.
php artisan migrate

# 1. Simulación del importador: lee fact-fbo, escribe y revierte.
#    LEER ENTERA la salida: la lista de tablas que --forzar va a pisar, los
#    hallazgos esperados y que no haya "nombre repetido" (ver abajo).
php artisan facturacion:importar-matriculas

# 2. Aplicar. Si el 1a ya está en uso, fact_aeronaves tiene filas y el comando
#    se negará sin --forzar. LEER "Qué pisa --forzar" antes de agregarlo.
php artisan facturacion:importar-matriculas --aplicar --forzar

# 3. Comprobar los conteos contra las tablas (SQL en la sección de collation).

# 4. Permisos
php artisan db:seed --class=FacturacionSubdepartamentosSeeder

php artisan optimize:clear
npm ci && npm run build
```

Después, asignar los cuatro subdepartamentos nuevos (`factClientes`,
`factServicios`, `factFormasPago`, `factProveedores`) desde Gestión de usuarios,
con la función de agrupar por departamento. El rol administrador ve las cuatro
entradas sin asignación, porque su menú está escrito aparte en `navigation.ts`.

## Qué pisa `--forzar`

Que el importador sea idempotente solo significa que las matrículas no se
duplican, y es lo de menos. Lo que importa es que **vuelve a escribir encima de
filas que ya existen**. Si el bloque 1a ya está en uso, `--forzar` no es la
excepción sino el camino normal, y esto es lo que se sobreescribe (la lista
sale de `SOBREESCRIBEN` en `ImportarMatriculasPrefactura.php`):

| Tabla | Lo que se pisa |
|---|---|
| `fact_aeronaves` | estatus, categoría, motor, derecho de vuelos y tarifas propias |
| `fact_categorias_aeronave` | tarifas de pernocta y tránsito 2 h / 12 h |
| `fact_tipos_motor` | tarifa de aterrizaje |
| `fact_precios_combustible` | el precio vigente, solo si coincide la fecha de inicio |
| `fact_clientes` | RFC, correo y teléfono |
| `fact_servicios` | categoría, precio, margen y ajuste de precio |

Cualquier tarifa, RFC o precio **editado a mano desde las pantallas** desde el
último import se revierte al valor del sistema viejo, y eso cambia cobros.
Además, `fact_categorias_servicio`, `fact_formas_pago` y `fact_proveedores` solo
agregan lo que falta: si en pantalla se renombró una fila, la original se recrea
y quedan dos.

**La simulación imprime esa lista de tablas con su número de filas** ("Se
sobreescriben (lo editado desde la aplicación se pierde)"). Hay que leerla antes
de agregar `--forzar`, y si alguna tabla tiene ediciones hechas a mano que deban
sobrevivir, no aplicar hasta resolverlo.

## Lo que la corrida real va a producir y que NO es un error

La simulación ya no dirá "Sin hallazgos". Saldrán **al menos dos** hallazgos de
normalización de nombres, ambos esperados. Los renglones exactos son:

```
Categoría de servicio con espacios raros en tb_categoria_serv (id 3): 'Combustible & Servicios ' se importa como 'Combustible & Servicios'.
Proveedor con espacios raros en tb_proveedor (id 4): 'ARTURO<NBSP>GARDUÑO' se importa como 'ARTURO GARDUÑO'.
```

- **Categoría de servicio id 3** trae un espacio al final; se importa sin él.
- **Proveedor id 4** trae un espacio duro (U+00A0) en lugar de un espacio normal.
  El reporte lo imprime literalmente como `<NBSP>`; se importa con espacio normal.

Nadie debe "arreglar" esto en el origen: es el importador haciendo su trabajo.

**Los hallazgos del 1a siguen apareciendo.** La guía del 1a
(`2026-09-29-facturacion-1a-despliegue-y-pendientes.md`) explica que el renglón
de la matrícula `ZZ-GFT` aparece en cada corrida mientras no se corrija el origen,
y hay más de matrículas y tarifas. Un hallazgo que no sea de esos ni de estos dos
sí merece revisión.

## Paso obligatorio: collation de MySQL contra la llave del importador

El importador decide en PHP qué dos nombres son "el mismo" (minúsculas y sin
acentos), y la base lo decide en MySQL con la collation `utf8mb4_unicode_ci`. Si
no coinciden, el resultado es silencioso, sin excepción:

- Los cinco catálogos escriben por nombre con `firstOrCreate` o `updateOrCreate`.
  Si MySQL considera iguales dos nombres que el PHP ve distintos, el SELECT previo
  **encuentra** la fila existente y no inserta: las dos se funden en silencio y el
  conteo del reporte sale inflado.
- `fact_clientes.nombre` y `fact_servicios.nombre` no son únicos (solo tienen
  índice), así que ahí ni siquiera una clave duplicada podría delatar nada.

SQLite compara binario, así que las pruebas automáticas no pueden demostrar que
las dos llaves coinciden. Hay que comprobarlo contra la base real, en dos pasos.

**Antes de `--aplicar`: cero hallazgos de "nombre repetido"** en los cinco
catálogos (el renglón dice `con nombre repetido en <tabla>`). Esto **no es
suficiente**: solo prueba que la llave del PHP no vio repetidos. No dice nada de
lo que MySQL considera igual.

**Después de `--aplicar`: comparar cada conteo del reporte contra el `COUNT(*)`
de su tabla.** Cualquier diferencia es una fusión silenciosa. Funciona para los
cinco, incluidos los dos sin índice único. Las tablas del 1b son nuevas, así que
en la primera aplicación empiezan vacías y deben coincidir exactamente:

```sql
SELECT 'clientes'            AS concepto, COUNT(*) AS filas FROM fact_clientes
UNION ALL SELECT 'servicios',            COUNT(*) FROM fact_servicios
UNION ALL SELECT 'categorias_servicio',  COUNT(*) FROM fact_categorias_servicio
UNION ALL SELECT 'formas_pago',          COUNT(*) FROM fact_formas_pago
UNION ALL SELECT 'proveedores',          COUNT(*) FROM fact_proveedores;
```

Se compara con las filas `clientes`, `servicios`, `categorias_servicio`,
`formas_pago` y `proveedores` de la tabla de conteos que imprime el comando. Si
una tabla ya tenía filas antes de aplicar (por ejemplo, en una segunda corrida),
la comparación solo vale contra el aumento, no contra el total.

Si hay diferencia, dos nombres del origen colapsaron en MySQL: revisar cuáles y
corregir el origen o decidir a mano cuál conserva el dato.

## Precio del combustible

El servicio `Combustible JET A-1` es el único cuyo precio sigue al del
combustible. El sistema viejo lo apunta por id fijo (`id_servicio = 7`);
aquí no hay un id estable tras la importación, así que el vínculo es el
**nombre**, definido en `FactPrecioCombustible::SERVICIO_COMBUSTIBLE`.

- `UpdateServicioRequest` **impide renombrar** ese servicio: si se renombrara, la
  sincronía dejaría de encontrarlo y no fallaría, simplemente no actualizaría
  nada.
- La sincronía solo toca el servicio **activo**. Dado de baja, o inexistente,
  registrar un precio nuevo funciona igual y no cambia nada en servicios.
- **Cada cambio deja rastro en la bitácora** (módulo `FACTURACION_CATALOGOS`,
  acción `ACTUALIZAR`, con el precio anterior y el nuevo del servicio). Es el
  único precio que este bloque cambia a propósito; ahí está la respuesta a por
  qué ese servicio cobra lo que cobra.
- El origen guarda 26.0640 y la fórmula `(ASA + 0.50) × 1.15` con ASA 22.1643
  daría 26.0639. El importador respeta el valor almacenado, así que tras importar
  el servicio queda en 26.0640, igual que hoy; la diferencia de un diezmilésimo
  aparece solo al capturar un precio nuevo con la fórmula (ver la guía del 1a).

## Verificaciones que faltan contra MySQL real

1. **Los dos pasos de la collation descritos arriba**, antes y después de
   `--aplicar`. Son obligatorios.
2. **El `where` por nombre de la sincronía** se resuelve con la collation de la
   columna (insensible a la caja). En las pruebas, sobre SQLite, es binario; la
   guarda de `UpdateServicioRequest` usa comparación insensible a la caja para
   proteger al menos los mismos nombres. Vale confirmar en MySQL que registrar un
   precio actualiza el servicio.
3. **Transacción del importador**: sigue siendo una sola transacción, ahora con
   más tablas. La guía del 1a pide medir cuánto tarda; repetir la medición con
   los cinco catálogos incluidos.

## Deuda conocida

- **Pantallas sin pruebas automáticas**: las ocho pantallas de catálogos (cuatro
  del 1a, cuatro del 1b) se verifican solo con `tsc`, `eslint` y el build.
- La deuda de `routes/api.php` (rutas preexistentes sin autenticación) descrita
  en la guía del 1a sigue abierta.
