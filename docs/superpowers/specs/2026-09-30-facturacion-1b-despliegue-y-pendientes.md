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
  subdepartamentos, `routes/web.php`, `routes/api.php` y el store
  `apiFacturacionCatalogos.ts`.

Consecuencias para el despliegue:

1. **Backend y frontend se despliegan juntos**, y hay que **reconstruir el
   frontend** (`npm ci && npm run build`). Un frontend viejo contra el backend
   nuevo, o al revés, deja pantallas del 1a rotas.
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
#    Ver las dos secciones siguientes: el reporte NO saldrá limpio, y hay una
#    condición obligatoria antes de pasar al paso 2.
php artisan facturacion:importar-matriculas

# 2. Aplicar. Si el 1a ya se importó, fact_aeronaves tiene filas y el comando
#    se negará sin --forzar. Es idempotente: las matrículas no se duplican.
php artisan facturacion:importar-matriculas --aplicar --forzar

# 3. Permisos
php artisan db:seed --class=FacturacionSubdepartamentosSeeder

php artisan optimize:clear
npm ci && npm run build
```

Después, asignar los cuatro subdepartamentos nuevos (`factClientes`,
`factServicios`, `factFormasPago`, `factProveedores`) desde Gestión de usuarios,
con la función de agrupar por departamento. El rol administrador ve las cuatro
entradas sin asignación, porque su menú está escrito aparte en `navigation.ts`.

## Lo que la corrida real va a producir y que NO es un error

La simulación ya no dirá "Sin hallazgos". Saldrán **al menos dos** hallazgos de
normalización de nombres, ambos esperados. Dicen "con espacios raros" y muestran
el nombre original y el que se importa:

- **Categoría de servicio id 3**: viene como `"Combustible & Servicios "`, con un
  espacio al final. Se importa sin él.
- **Proveedor id 4**: viene como `"ARTURO\u{00A0}GARDUÑO"`, con un espacio duro
  (U+00A0) en lugar de un espacio normal. Se importa con espacio normal.

Nadie debe intentar "arreglar" esto en el origen: es el importador haciendo su
trabajo. Un hallazgo distinto de estos dos sí merece revisión.

## Paso obligatorio antes de `--aplicar`: CERO hallazgos de "nombre repetido"

**Antes de correr con `--aplicar`, correr la simulación contra la base real y
exigir cero hallazgos de "nombre repetido" en los cinco catálogos.** El renglón
dice `con nombre repetido en <tabla>`.

Por qué es obligatorio y no una formalidad: el importador decide en PHP qué dos
nombres son "el mismo" (minúsculas y sin acentos), y la base decide en MySQL con
la collation `utf8mb4_unicode_ci`. Si las dos no coinciden, dos filas que el
importador considera distintas chocarían en el índice único de MySQL en plena
corrida. SQLite compara binario, así que **las pruebas automáticas no pueden
demostrar que coinciden**; la única forma de comprobarlo es esta corrida contra
la base real. La simulación escribe de verdad dentro de una transacción y la revierte, así
que si las dos llaves no coinciden, MySQL lo delata. Con cero hallazgos de
"nombre repetido" **y** la corrida terminando sin excepción (una de clave
duplicada significa que no coinciden), queda comprobado.

Si aparece alguno, **no aplicar**: corregir el origen o revisar qué filas
colapsan, y repetir la simulación.

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
- El origen guarda 26.0640 y la fórmula `(ASA + 0.50) × 1.15` con ASA 22.1643
  daría 26.0639. El importador respeta el valor almacenado, así que tras importar
  el servicio queda en 26.0640, igual que hoy; la diferencia de un diezmilésimo
  aparece solo al capturar un precio nuevo con la fórmula (ver la guía del 1a).

## Verificaciones que faltan contra MySQL real

1. **La corrida de simulación descrita arriba.** Es la verificación de la
   collation contra el importador y es obligatoria.
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
