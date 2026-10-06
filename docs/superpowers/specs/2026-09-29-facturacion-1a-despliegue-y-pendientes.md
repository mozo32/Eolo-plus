# Bloque 1a — Guía de despliegue y pendientes abiertos

**Fecha:** 2026-09-29 · **Rama:** `facturacion-1a-matriculas` · 25 commits · 382 pruebas

Acompaña a `2026-09-29-facturacion-1a-matriculas-design.md`. Recoge lo que hay que
decidir y verificar **antes** de poner esto en producción, y lo que queda como
deuda conocida.

## Lo que hizo esta rama

Eolo-plus dependía de la base de datos del sistema de prefacturación (`fact-fbo`)
para resolver matrículas: nueve controladores leían y escribían `tb_matricula`,
`tb_tipo` y `tb_combustible` por la conexión `remota`, y cinco daban de alta
matrículas ahí. El día que ese sistema se apagara, cinco módulos en producción
dejaban de funcionar.

Ahora el catálogo vive en Eolo-plus con sus tarifas, un comando importa los datos
históricos, y **ningún controlador usa ya esa conexión** — hay una prueba que
falla si alguien la reintroduce.

## Decisión pendiente antes de importar: la matrícula ZZ-GFT

Es la **única** cuyo cobro cambiaría, confirmado contra dos conjuntos de datos: la copia local (817 matrículas importables) y el volcado de producción del 2026-09-29 (835 importables, 45 con tarifa de estancia propia). Se enumeró el conjunto completo por
SQL sobre las 823 filas del origen y no hay una segunda.

`ZZ-GFT` (categoría III) tiene `id_pernocta = 19` e `id_transito12h = 20`
apuntando a filas que no existen en las tablas de tarifas. El sistema viejo
resuelve las cuatro tarifas con un solo `INNER JOIN` a las cuatro tablas
(`insert22.php:35-41`), así que con una sola faltante la consulta devuelve cero
filas y lanza excepción: **hoy esa matrícula no puede facturar estancia de ningún
concepto**, ni siquiera los dos que sí resuelven.

| Concepto | Origen hoy | Tras migrar |
|---|---|---|
| Pernocta | no facturable | 4,676.00 (heredada de la categoría III) |
| Tránsito 2 h | no facturable | 1,144.50 (propia) |
| Tránsito 12 h | no facturable | 2,338.00 (heredada) |
| Aterrizaje | no facturable | 1,059.00 (propia) |
| Derecho de vuelos | $900 | $900 (igual) |

**Dos opciones:**
1. **Corregir el origen antes de importar** (recomendado): asignarle en
   `tb_matricula` los ids de tarifa correctos. El importador traería los valores
   reales y la invariante quedaría perfecta.
2. **Aceptar que herede** las tarifas de su categoría, sabiendo que pasa de no
   facturar a facturar.

El importador la reporta con nombre y detalle en cada corrida, así que no se
puede aplicar sin verla.

## Filas de prueba en la copia local de `fact-fbo` — NO en producción

> **NO BORRES POR ID.** Una versión anterior de esta guía decía que había que
> borrar a mano los ids 886-889 de `tb_matricula` y 200-202 de `tb_tipo`. Eso
> era **falso y peligroso**: en la base de producción esos mismos ids guardan
> datos reales. Verificado contra el volcado del 2026-09-29:
>
> | id | `tb_matricula` en producción | id | `tb_tipo` en producción |
> |---|---|---|---|
> | 886 | `N950PC` | 200 | `GFL6` |
> | 887 | `XB-TIG` | 201 | `B505` |
> | 888 | `N423RB` | 202 | `BELL505` |
> | 889 | `XB-RAJ` | | |
>
> Borrar por id habría destruido cuatro matrículas y tres tipos de aeronave
> reales.

Una corrida accidental de pruebas escribió `XA-NUEVA`, `XA-REPE`, `XA-VIEJA` y
`XA-PASO` en `tb_matricula`, y `Learjet 45`, `Cessna 208` y `Otro` en `tb_tipo`,
**solo en la copia local de desarrollo**. Verificado: en producción no existe
ninguna de las siete filas (`WHERE matricula IN (...)` devuelve cero).

Así que **no hay nada que borrar en producción**. Si alguna vez hace falta
limpiar una copia local, hágalo **por nombre y nunca por id**:

```sql
DELETE FROM tb_matricula WHERE matricula IN ('XA-NUEVA','XA-REPE','XA-VIEJA','XA-PASO');
DELETE FROM tb_tipo      WHERE tipo      IN ('Learjet 45','Cessna 208','Otro');
```

Con el código nuevo no puede repetirse: `TestCase` apunta la conexión `remota` a
un destino inválido durante las pruebas, así que cualquier escritura accidental
revienta.

## Orden de despliegue

```bash
git pull
composer install --no-dev --optimize-autoloader

# 1. Migraciones. La última QUE TOCA aeronaves crea el índice único en aeronaves.matricula y lleva
#    guardia: si hay matrículas repetidas, falla listándolas sin dejar nada a
#    medias. Nota: `migrate --step` NO excluye migraciones, solo las separa en
#    lotes; no sirve para dejar el índice para después.
php artisan migrate

# 2. Depurar los duplicados que la guardia haya listado, y repetir el migrate.

# 3. Simulación del importador: lee fact-fbo, escribe y revierte.
#    REVISAR EL REPORTE, en particular el renglón de ZZ-GFT.
php artisan facturacion:importar-matriculas

# 4. Aplicar. Si el sistema siguió capturando entre el paso 1 y este, habrá
#    filas en fact_aeronaves y el comando se negará: entonces usar --forzar.
#    El updateOrCreate corrige el estatus de esas filas nuevas.
php artisan facturacion:importar-matriculas --aplicar [--forzar]

# 5. Permisos
php artisan db:seed --class=FacturacionSubdepartamentosSeeder

php artisan optimize:clear
npm ci && npm run build
```

**Backend y frontend se despliegan juntos.** Si sube el frontend nuevo contra el
backend viejo, `ajuste` y `margen` llegan indefinidos y la pantalla del precio de
combustible muestra `NaN`.

Después, asignar los cuatro subdepartamentos de Facturación (`factAeronaves`,
`factCategoriasAeronave`, `factTiposMotor`, `factCombustible`) desde Gestión de
usuarios, con la función de agrupar por departamento.

**El precio de combustible está vigente**: ASA 22.1643, Eolo 26.0640, con
vigencia del 2022-09-26 al 2028-09-26. El importador trae el valor almacenado tal
cual, así que ningún cobro cambia. (Nota menor: la fórmula `(ASA + 0.50) × 1.15`
daría 26.0639, un diezmilésimo menos que lo guardado; la pantalla propone el
calculado al capturar uno nuevo, pero la importación respeta el original.)

## Verificaciones que faltan contra MySQL real

Las pruebas corren en SQLite, donde los bloqueos no hacen nada y la comparación
de texto es binaria. Por orden de prioridad:

1. **El importador corre en una sola transacción** que abarca 817 matrículas y
   mantiene bloqueos sobre el índice único durante toda la corrida. Cualquier
   captura simultánea esperará o dará deadlock. Medir cuánto tarda y decidir si
   hace falta una ventana de mantenimiento.
2. **Deadlock del lote de Pernocta del día**: dos lotes concurrentes con
   matrículas nuevas. Ya se ordenan antes del bucle para prevenirlo, pero nunca
   se probó contra InnoDB.
3. **La carrera de `buscarOCrear`** con dos conexiones bajo REPEATABLE READ, y
   con tres o más peticiones simultáneas sobre la misma matrícula nueva.
4. **Collation `utf8mb4_unicode_ci`**: en producción `XA-ABC`, `xa-abc` y
   `XA-ABC ` son la misma matrícula y el índice único las rechaza; en las pruebas
   coexisten. Vale correr la suite contra MySQL una vez.

## Deuda conocida, con dueño pendiente

- **`routes/api.php:42-48` sigue sin autenticación**, incluidas `POST /aeronaves`
  y `POST /nuevo-tipo-aeronaves`. Son rutas preexistentes, pero ahora escriben en
  el catálogo autoritativo de facturación: un POST anónimo crea también la fila
  satélite. No se tocó en esta rama porque poner `auth:sanctum` puede romper el
  `fetch` del frontend, que no envía token CSRF. **Merece su propia tarea.**
- **`FactAeronave::tarifa*()` no mira el estatus.** Devuelve la tarifa resuelta
  por herencia; que una aeronave en Guarda no pague estancia lo tiene que aplicar
  el módulo de facturación del bloque 2. Las pantallas ya lo advierten.
- Los ~45 hallazgos menores restantes (calidad de pruebas, accesibilidad de
  modales, textos) están en el registro de ejecución de la rama y son la mejor
  lista de arranque para el bloque 1b.
