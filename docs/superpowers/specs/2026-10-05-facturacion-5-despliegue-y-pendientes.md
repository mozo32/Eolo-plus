# Bloque 5 — Guía de despliegue y pendientes abiertos

**Fecha:** 2026-10-05 · **Rama:** `facturacion` (base del bloque: `bd21cd0`, el último commit del bloque 4; el commit de la especificación, `13944b7`, y el del plan, `e22739f`, quedan **dentro** del bloque)

Acompaña a `2026-10-05-facturacion-5-agrupar-saldo-estancia-design.md` y continúa la guía del bloque
anterior, `2026-10-05-facturacion-4-despliegue-y-pendientes.md`, a la que **remite** en varios puntos
en lugar de repetirla (a su vez continúa la del 3, `2026-10-02-facturacion-3-despliegue-y-pendientes.md`).
Recoge lo que hay que hacer **antes** de poner el bloque en producción, lo que las pruebas no pueden
demostrar, y lo que alguien tiene que mirar con sus ojos.

Cada afirmación de esta guía está respaldada por el código de la rama o por una medición que se nombra.
Donde algo **no** se comprobó, se dice.

**Nada de esta rama llega a `main` hasta que el departamento de facturación pruebe y apruebe.** Esta guía
es lo que ese departamento y quien despliegue van a seguir.

**Los comandos de esta guía son de bash** (`ls -l`, comentarios con `#`): córrelos desde Git Bash o WSL (la
pila es XAMPP sobre Windows y `cmd` no los entiende). Las sentencias SQL se pegan en el cliente `mysql`.

**La rama `facturacion` sigue sin estar en el remoto.** `git ls-remote --heads origin` (comprobado el
2026-10-05) lista `dev`, `firma-en-entrega-turno`, `main`, `produccion` y `reverb-declarado`, y **no**
`facturacion`. Sin `git push -u origin facturacion` el servidor no tiene nada que traer, y con `main` activo
en el servidor `git pull` no trae este bloque.

## Lo que hizo esta rama

Doce commits de producto (de `91ac51a` a `32071d9`) con tres funciones nuevas, y uno más, `0311314`, que corrige el importador (ver «El ajuste de estancia depende de que los servicios 109 y 110 estén importados»):

- **Agrupar renglones al imprimir.** Cada renglón gana una etiqueta opcional, `grupo`. En el documento, los
  renglones con la misma etiqueta salen como **una sola fila**: la etiqueta como concepto, la **suma** de sus
  importes, y **sin remisión, sin precio unitario y sin cantidad** (un grupo no tiene un valor único de
  ninguno de los tres). La fila ocupa el lugar del renglón de `orden` menor del grupo. **Agrupar no toca el
  dinero**: es solo una etiqueta, y ninguna fórmula de subtotal, IVA o total la lee.
  Ruta: `PATCH /api/facturacion/prefacturas/{id}/renglones/{renglon}/grupo` (etiqueta, o `null` para
  desagrupar). El editor gana los botones **Agrupar**, **Cambiar grupo** y **Desagrupar** en cada renglón.
- **Saldo a favor como forma de pago.** Existe una forma de pago con concepto `saldo_a_favor`, que se aplica
  contra la cuenta **sin bajar el subtotal ni el IVA**, y **no genera cambio**.
- **Ajuste de estancia.** «Recalcular estancia» gana dos cantidades, **Ajustes de 2 h a 12 h** y **Ajustes de
  12 h a pernocta**. Cada ajuste cobra la **diferencia** entre dos tarifas de la matrícula (tránsito 12 h menos
  tránsito 2 h; pernocta menos tránsito 12 h), calculada con `bcsub`, no el tramo entero. Si falta una de las
  dos tarifas, o la diferencia es cero o negativa, **no se cobra** y la respuesta dice por qué.

**Subdepartamentos:** no hay uno nuevo (las rutas nuevas cuelgan de `factPrefacturas`, el del bloque 2).
**Dependencias:** `composer.json`, `composer.lock`, `package.json` y `package-lock.json` **no cambian** en este
bloque (`git diff --stat e22739f HEAD` sobre los cuatro sale vacío), así que **no hay dependencia nueva**: el
`composer install` es el de siempre, y lo que la guía del 4 dice de reverb y DomPDF no cambia aquí.

## Lo que este bloque corrige del sistema viejo

Es la razón de ser del bloque y el departamento lo va a notar:

- **Agrupar ya no puede perder dinero.** En el viejo, agrupar ponía en cero el importe de los renglones
  elegidos y creaba un renglón «Otros» con la suma. Se usó **5 veces en casi dos años**; en 4 el «Otros»
  cuadró y en la quinta, **el folio 932**, se pusieron a cero dos renglones por **14.344,00** y el «Otros»
  **nunca se creó**: se cerró cobrando **17.755,00** cuando debían ser **32.099,00**, sin aviso y sin rastro.
  Ahora agrupar es solo una etiqueta y no hay nada que poner en cero. (El folio 932 fue **uno** de cinco usos:
  no es que el viejo perdiera dinero siempre.)
- **Desagrupar ya no pierde el margen ni borra «Otros» capturados a mano.** El viejo restauraba
  `precio × cantidad` (sin margen ni ajuste de precio) y borraba **todos** los renglones del servicio 104, y en
  el histórico hay **54** escritos a mano, en 49 folios. Ahora desagrupar es poner la etiqueta en `null`.
- **El saldo a favor ya no baja el IVA.** El viejo lo capturaba como renglón con precio negativo (4 casos en el
  histórico, servicio 91, remisión «SaldoaFavor»), lo que reducía la base gravable. Ahora es una forma de pago.
- **El ajuste de estancia rechaza una diferencia cero o negativa.** `insert_ajusteestancia.php` no tiene
  ninguna guarda, y el viejo hacía elegir el tramo a mano en una prefactura nueva.

Las mediciones del viejo salen de `fact-fbo-prod` (retrato al 2026-09-28). **Ver «Hay dos bases» en la deuda.**

## Orden de despliegue, y la trampa

Esta vez hay **dos migraciones nuevas y un seeder**, y **el orden del seeder importa** (la trampa de más abajo).

```bash
# Nada nuevo en composer ni en npm: el `composer install` es el de la guía del 4.
git pull
composer install --no-dev --optimize-autoloader
php artisan --version                      # debe responder; si falla, PARAR (ver la guía del 4)

# DOS migraciones, ambas aditivas. Ninguna borra filas:
#   2026_09_29_094000_seed_conceptos_de_ajuste_de_estancia
#       asigna el concepto a DOS servicios que YA ESTÉN IMPORTADOS, buscándolos POR NOMBRE EXACTO
#       (si el catálogo aún no se importó, no asigna nada: entonces lo hace el importador, por id 109 y 110):
#         'Ajuste de Estancia_de 2 hrs a 12 hrs'    -> estancia_ajuste_2h_12h
#         'Ajuste de Estancia_de 12 hrs a pernocta' -> estancia_ajuste_12h_pernocta
#       Si el servicio no está en fact_servicios, no hace nada y no avisa.
#   2026_09_29_094100_add_grupo_to_fact_prefactura_renglones_table
#       agrega `grupo` (string 60, nula, con índice) después de `remision`
php artisan migrate

# --- Aquí se decide por la base (ver «Qué base es esta», más abajo) ---

# CASO (a), base SIN catálogos importados: primero el importador, después el seeder.
# 1. Simulación (lee fact-fbo, escribe y revierte). LEER ENTERA la salida.
php artisan facturacion:importar-matriculas | tee storage/logs/facturacion-importacion-$(date +%F).log
# 2. Aplicar. Sin --forzar primero: si la guarda se niega por datos de bloques anteriores,
#    esa base es el caso (b), o hay que leer «Qué pisa --forzar» en las guías del 1b y del 2.
php artisan facturacion:importar-matriculas --aplicar | tee -a storage/logs/facturacion-importacion-$(date +%F).log

# La forma de pago «Saldo a favor». SIEMPRE DESPUÉS del importador. Se corre a mano.
php artisan db:seed --class=FacturacionFormasPagoSeeder

# Los dos conceptos de ajuste y la forma «Saldo a favor»: COMPROBAR con el SQL de «Verificación».

php artisan optimize:clear
npm ci && npm run build
```

**Backend y frontend se despliegan juntos**, y hay que reconstruir el frontend: sin él no hay botones de
agrupar ni los dos campos de ajuste, y el departamento no vería el cambio.

### Por qué el importador va ANTES que el seeder

El seeder crea **una fila** en `fact_formas_pago`, y esa tabla está en la lista de «solo agregan» de la guarda de
`facturacion:importar-matriculas --aplicar` (`app/Console/Commands/ImportarMatriculasPrefactura.php`, constante
`SOLO_AGREGAN`). La guarda **se niega sin `--forzar`** si alguna de esas tablas ya tiene filas. Con el seeder
corrido primero, el importador responde (reproducido en una base sqlite recién migrada y sembrada):

```
--aplicar se negó porque Eolo-plus ya tiene datos en tablas que la importación toca. No se escribió nada.
  - fact_formas_pago: 1 filas
```

Es un aviso **falso**: no hay datos del departamento que proteger, la «fila» es la que acaba de sembrar el
seeder. Y la salida obvia, `--forzar`, **no es inocente**: pisa seis tablas (ver «Qué pisa `--forzar`» en las
guías del 1b y del 2). Por eso el orden es importador primero, seeder después. **Al revés no funciona** en una
base nueva. En el orden correcto el seeder no estorba: el importador solo **agrega** a esa tabla
(`firstOrCreate`, nunca borra), así que la fila sembrada **sobrevive a una reimportación** (comprobado por
lectura de `ImportadorMatriculas::importarCatalogoSimple`; ninguna prueba lo ejecuta con la fila sembrada).

### Por qué el seeder NO está en `DatabaseSeeder`

Por la misma guarda. Un `php artisan db:seed` completo en una instalación nueva correría el seeder antes de que
nadie importe los catálogos, y dejaría la tabla con una fila: el siguiente `--aplicar` se negaría con el aviso
falso. Y no es una migración, por una razón de fondo: `fact_formas_pago` es un **espejo del catálogo del origen**
y las pruebas de los bloques anteriores fijan su contenido exacto (una exige que tras una simulación la tabla
siga con 0 filas); una migración la sembraría en toda base. Hay una prueba que falla si alguien vuelve a sembrarla
por migración. Sigue el patrón de `FacturacionSubdepartamentosSeeder`: filas que el sistema necesita y el origen no
trae, con `firstOrCreate`, invocado a mano.

El seeder es **idempotente y no pisa lo que el operador editó**: corrido dos veces (comprobado) deja **una**
fila, `Saldo a favor`, concepto `saldo_a_favor`, estado `A`. Si alguien creó a mano una forma llamada igual y sin
concepto, se la **adopta** (se le asigna el concepto) en lugar de chocar con el índice único de `nombre`.

**Sin el seeder, la forma «Saldo a favor» no existe y no aparece en el panel de cobro**: no hay error, simplemente
no hay opción. `PanelCobro.tsx` (`resources/js/pages/Facturacion/components/`) solo excluye Amex
(`status === 'A' && concepto !== 'amex'`), así que la fila aparece por sí sola en cuanto existe y está activa.

### El ajuste de estancia depende de que los servicios 109 y 110 estén importados

El ajuste busca dos servicios del catálogo **por concepto** (`estancia_ajuste_2h_12h` y
`estancia_ajuste_12h_pernocta`). Si no existen, activos y con ese concepto, el operador recibe un 422 al pedirlo
(`ServicioDeEstanciaNoDisponibleException`: «No existe un servicio activo con concepto
'estancia_ajuste_2h_12h'…»). Hay **dos caminos** que les ponen el concepto, y conviene saber cuál es cuál:

1. **El importador** (`facturacion:importar-matriculas`) los asigna por el **id del origen**, 109 y 110
   (`CONCEPTOS_POR_ID_VIEJO` en `app/Services/ImportadorMatriculas.php`, junto a los ids 7, 2, 3, 4 y 100). **Es el
   camino principal.** Los ids son estables porque el sistema viejo los compara literalmente
   (`insert_ajusteestancia.php`: `if ($ajuste==110)`, `elseif($ajuste==109)`), igual que con los otros cinco.
   Lo cubren dos pruebas en `ImportadorCatalogosTest.php`; quitar las dos entradas las hace fallar.
2. **La migración `094000`**, que los busca **por nombre exacto** entre los servicios que **ya** estén en
   `fact_servicios` cuando corre. Es el camino para una base donde los catálogos ya estaban importados (el 1b o el
   2 en uso) y no se quiere reimportar. **Corre una sola vez**: si se migra con `fact_servicios` vacía (el orden de
   las guías 2 y 3), asigna cero filas, no avisa y no vuelve a correr; entonces el concepto lo pone el importador.

> **Historia, por si alguien trae una base anterior:** la rama tuvo durante su desarrollo **solo** el camino 2, y
> el importador **no** conocía el 109 ni el 110 (se midió: tras importar quedaban con concepto `null`). Una base
> que se migró **e importó con esa versión** tiene los dos servicios sin concepto: ver la **nota de rescate**, más
> abajo. Con el importador de este commit el problema no se produce.

**Qué base es esta:**

| Caso | Qué pasa | Qué hacer |
|---|---|---|
| **(a)** Los catálogos **no** se han importado | `migrate` corre con `fact_servicios` vacía y la `094000` no asigna nada; después **el importador asigna 109 y 110** | Importador → seeder → **verificar** |
| **(b)** Los catálogos **ya** estaban importados | La `094000` los encuentra **por nombre** y asigna | **No correr el importador** (`--forzar` pisa seis tablas). Seeder → **verificar** |

**Verificación (la comprobación que sigue siendo obligatoria en las dos bases).** Con `SET NAMES utf8mb4;` (el
cliente `mysql` de Windows arranca en cp850 y una sentencia con acento afecta 0 filas **sin error**). **Tiene que
haber exactamente dos filas, con los dos conceptos**, y una forma de pago `saldo_a_favor`:

```sql
SET NAMES utf8mb4;
SELECT id, nombre, concepto, status FROM fact_servicios
 WHERE concepto IN ('estancia_ajuste_2h_12h', 'estancia_ajuste_12h_pernocta') ORDER BY concepto;   -- 2 filas, status A
SELECT id, nombre, concepto FROM fact_servicios WHERE nombre LIKE 'Ajuste de Estancia%' ORDER BY id; -- tiene que haber SOLO esas 2 (ver abajo)
SELECT id, nombre, concepto, status FROM fact_formas_pago WHERE concepto = 'saldo_a_favor';          -- 1 fila, status A
```

**La primera consulta no ve las filas duplicadas**, porque filtra por concepto: una base que reimportó con la versión anterior del importador y quedó con **cuatro** filas pasa esa verificación enseñando dos. Por eso está la segunda, que lista **todas** las que se llaman «Ajuste de Estancia…»: si salen más de dos, las que no tienen concepto son copias. **El arreglo del importador (`0311314`) impide crear copias nuevas pero no limpia las viejas**; borrarlas o dejarlas es una decisión a mano (comprobar antes que ningún renglón las use), y no se escribe aquí un `DELETE`.

Si la primera no da dos filas, el origen no trae los servicios 109 y 110 (o alguien los renombró, en el caso b,
y la búsqueda por nombre de la migración no los encontró): hay que resolverlo **antes** de seguir. Con el
importador de este commit, eso solo ocurre si el origen no los tiene.

**Nota de rescate (NO es un paso del despliegue): solo para una base que ya se migró e importó con la versión
anterior del importador**, y por eso tiene los dos servicios sin concepto. La salida limpia es un `UPDATE`
dirigido, que no toca ningún precio. **No es idéntico a la migración**: la migración toma la fila de `id` menor
con ese nombre **sea cual sea su concepto** (no filtra `concepto IS NULL`); este `UPDATE` solo toca filas **sin**
concepto, así que es más prudente. En el caso realista (dos filas sin concepto) da lo mismo. Volver a importar también los arreglaría, pero exige `--forzar`, que pisa seis tablas:

```sql
SET NAMES utf8mb4;
UPDATE fact_servicios SET concepto = 'estancia_ajuste_2h_12h'
 WHERE concepto IS NULL AND nombre = 'Ajuste de Estancia_de 2 hrs a 12 hrs' ORDER BY id LIMIT 1;
UPDATE fact_servicios SET concepto = 'estancia_ajuste_12h_pernocta'
 WHERE concepto IS NULL AND nombre = 'Ajuste de Estancia_de 12 hrs a pernocta' ORDER BY id LIMIT 1;
```

**Estas dos sentencias no se probaron contra MySQL** (no hay una base con el catálogo a mano, y el
`UPDATE ... ORDER BY ... LIMIT` es sintaxis de MySQL que sqlite no admite). El `mysql` en lote **aborta el resto
del script al primer error** (por ejemplo, un `concepto` que ya lleva otra fila, por el índice único). **Repite la
verificación después.**

**Reimportar ya no duplica los dos servicios. Medido** (sqlite, importador real): con los dos servicios ya
creados **con** su concepto (lo que deja la migración) y reimportando, `fact_servicios` queda con **2** filas; y
con los dos creados **sin** concepto (el estado de una base de la versión anterior), importar, aplicar la
migración y reimportar, también **2** filas con sus dos conceptos. El ensayo equivalente antes del arreglo (importar, asignar los conceptos y reimportar) daba **4**.
Las dos pruebas nuevas del importador fijan el primer caso.

**Un detalle de catálogo que no cambia lo que se cobra:** como los ids 109 y 110 pasan de 93, el importador los
marca `es_de_tercero` y con `margen` 50 **en el catálogo** (`ULTIMO_SERVICIO_PROPIO = 93`). El ajuste de
estancia **no lo usa**: `CargosEstancia::recalcular()` crea el renglón con `es_de_tercero = false` y `margen = 0`
y el precio de la diferencia de tarifas. Se ve en la pantalla de catálogo y puede sorprender; no afecta al cobro.

Qué se comprobó de esta sección: los nombres de las migraciones, de los servicios y de los conceptos, contra los
archivos de la rama; las dos migraciones y el seeder **se ejecutaron de verdad** sobre una base sqlite recién
creada, con `php artisan migrate` y `php artisan db:seed --class=FacturacionFormasPagoSeeder`. **Contra MySQL no se
ejecutó nada de esto.**

## ATENCIÓN: las advertencias de rollback de los bloques 2, 3 y 4 siguen vigentes

**OJO CON EL ORDEN DE LAS MIGRACIONES: la última del proyecto NO es de este bloque.** Hay una migración
**posterior** a las dos nuevas, `2026_09_29_099000_add_unique_matricula_to_aeronaves` (los nombres de las del
bloque llevan fecha 2026-09-29, igual que las anteriores, y `099000` queda después de `094000` y `094100`). Por
eso **`php artisan migrate:rollback --step=1` revertiría esa**, la restricción única de matrículas, y no
ninguna de las de este bloque; y `--step=2` revertiría `099000` y `094100` (lo comprobé en sqlite). Para tocar una
migración concreta, la forma de la guía del 3, **mirando antes lo que va a hacer**:
`php artisan migrate:rollback --pretend --step=1 --path=database/migrations/<archivo>.php`.

`php artisan migrate:rollback` **no pregunta** y revierte **el último lote entero**, no «una migración». El
`down()` de la tabla de pagos (`2026_09_29_093100`) es un `dropIfExists`: un rollback **después de que alguien
cobre pierde TODOS los pagos**. Si los bloques 2, 3 y 5 se desplegaron en un solo `migrate`, el lote incluye todo
eso. Detalle y reglas en «ATENCIÓN: revertir este bloque DESTRUYE pagos» de la guía del bloque 3.

Lo que añaden **estas** dos migraciones al rollback (el orden, arriba):

- `094100` (`grupo`): su `down()` quita el índice y la columna. **Pierde las etiquetas de grupo**, no dinero:
  los importes no dependen de ellas. Probado en sqlite (`migrate:rollback --step=2` la revirtió y la columna
  desapareció); no en MySQL.
- `094000` (conceptos): su `down()` pone `concepto = NULL` en las dos filas. No borra nada.
- **Dar marcha atrás al código sin migraciones**: el código anterior no lee la columna `grupo` ni los conceptos
  nuevos, así que debería ser seguro; **no se probó** volver atrás sobre una base ya migrada. Lo que se pierde es
  la función.

## Resultado de las pruebas al cierre

**1088 pruebas en verde (4616 aserciones)**, medidas con `php artisan test` **en serie** el 2026-10-05 (1034 al
empezar el bloque: **+54**). `npx tsc --noEmit` solo da el error preexistente de
`resources/js/actions/App/Http/Controllers/Api/WalkAroundController.ts(905,5)`; `eslint` sobre los tres archivos
de frontend del bloque sale limpio y `npm run build` termina bien (comprobado hoy: sale 0, y no modifica ningún
archivo versionado).

**`php artisan test --parallel` no se usa en esta máquina** (da fallos falsos, ajenos; ver la guía del 1b): **la
suite se corre en serie.** Las pruebas corren sobre sqlite en memoria, igual que el resto: lo que sqlite no
puede demostrar (puntos 1 a 6 de las guías de los bloques 2 y 3) **sigue pendiente** de MySQL real.

**Este proyecto no tiene pruebas de frontend** (ni vitest ni testing-library): los diálogos de agrupar, los
avisos y los dos campos de ajuste están verificados solo por **lectura del código, `tsc`, `eslint` y el build**.
**Nadie los ha usado en un navegador.**

**La revisión final del bloque entero (todo el diff, de una pasada) no se había hecho al escribir esta guía.**
Cada task tuvo la suya; si la final cambia algo, esta guía se corrige.

## Lo que hay que probar a mano, y es lo más importante del bloque

### 1. IMPRIMIR UNA PREFACTURA CON UN GRUPO Y MIRAR LA HOJA

**Es lo más importante que el departamento tiene que decidir, y nadie lo ha visto.** `pdftoppm` no está
instalado en la máquina de desarrollo (comprobado: no aparece en el `PATH`; sí hay `pdftotext`), así que
**ninguna persona ha visto cómo queda la fila del grupo**. Las pruebas garantizan el contenido; que la hoja se
vea bien no lo puede comprobar ninguna.

La fila de un grupo lleva **tres huecos**: **remisión, precio unitario y cantidad**, porque un grupo no tiene
un valor único de ninguno de los tres. **No salen en blanco: salen como un guion «—»** (la plantilla escribe
`—` cuando falta el dato, y una prueba exige exactamente tres guiones en esa fila). La pregunta para el
departamento es si **tres guiones en una fila** se lee bien, o si preferirían las celdas vacías, la etiqueta
ocupando varias columnas, o que la fila lleve algún dato más. Es un cambio de plantilla, pero es una decisión de
contenido que debe tomarse **mirando la hoja**, no adivinándola.

**Cómo producirla:** en un borrador de prueba, con al menos tres renglones, pulsar **Agrupar** en dos de ellos
con la misma etiqueta (p. ej. «Rampa»), y luego **Cotizar** (borrador) o cerrar e imprimir. Verlo **en pantalla y
en papel**, si es lo que se entrega al cliente.

- [ ] **La fila del grupo se lee bien**: la etiqueta como concepto, los tres guiones, el importe a la derecha.
- [ ] **Ocupa el lugar del primer renglón del grupo**, no el del último. Con renglones intercalados
      (grupo, suelto, grupo) el grupo sale donde estaba su primer renglón y el suelto después.
- [ ] **La suma de la hoja cuadra con el total**: con un grupo puesto, sumar a mano los importes de **todas** las
      filas (la del grupo y las sueltas) y comprobar que da el **subtotal** del documento, y que subtotal + IVA
      es el total. La suma del grupo se hace con `bcadd` sobre los importes que el servidor ya calculó, y una
      prueba fija que cuadra con el subtotal, pero **nadie la ha leído en una hoja**.
- [ ] **Dos grupos distintos** salen como dos filas, cada una en su lugar, y un grupo de **un solo renglón** sale
      con su etiqueta en lugar del nombre del servicio (es un uso permitido: renombrar un concepto de cara al
      cliente).
- [ ] **Cotización y documento emitido dicen lo mismo**: la fila del grupo es idéntica en las dos.
- [ ] Lo de la hoja que ya pedía la guía del 4 (logo, tabla que no se corta, acentos, pie, precio unitario sin
      `$`) **sigue pendiente** y se mira en la misma sentada.

### 2. Agrupar una cortesía: el papel deja de mostrar que fue gratis

**Una cortesía dentro de un grupo contribuye 0.00 a la suma y la fila del grupo no lleva la marca «(Cortesía)»:
el cliente deja de ver que ese servicio fue gratis.** El **total sigue correcto**. Es una consecuencia legítima
de agrupar y está decidida, pero hay que verla:

- [ ] **Agrupar un renglón que es cortesía**: la pantalla **avisa antes** («Dentro de un grupo su importe cuenta
      como 0.00 y la fila del grupo no lleva la marca de cortesía…»). Confirmar y mirar el papel: el servicio
      gratis ya no se distingue. Cancelar el aviso no debe agrupar nada.
- [ ] **El camino inverso**: marcar como cortesía un renglón que **ya está** en un grupo también avisa. Y
      **cambiar de grupo** una cortesía que ya estaba agrupada **no** vuelve a avisar (ya estaba escondida).
- [ ] **Un grupo cuyos renglones son todos cortesías** sale con importe `0.00` y **sin marca**; está decidido y lo
      fija una prueba. Que el departamento lo vea y confirme que es lo que quiere.

### 3. Un ajuste de estancia con tarifas reales

Solo se ha probado con tarifas de prueba (por ejemplo 1.000 y 1.500, que dan 500,00). **Probarlo con una
matrícula real que tenga las tres tarifas** (`tarifa_transito_2h`, `tarifa_transito_12h`, `tarifa_pernocta`; son
`decimal(10,2)`):

- [ ] En «Recalcular estancia», **Ajustes de 2 h a 12 h = 1** cobra **exactamente tarifa de 12 h − tarifa de
      2 h**, y **no** la tarifa de 12 h entera. **Ajustes de 12 h a pernocta = 1** cobra pernocta − tarifa de
      12 h. Hacer la resta a mano y compararla con el renglón.
- [ ] Una matrícula con **una tarifa sin capturar**: el ajuste **no se cobra** y el mensaje dice cuál falta. (El
      caso peligroso sin la guarda era que faltara solo la **menor**: se cobraría la mayor **entera**. Hay una
      prueba para los dos ajustes.)
- [ ] Una matrícula cuya tarifa menor es **igual o mayor** que la mayor: no se crea renglón, y el mensaje dice
      las dos tarifas.
- [ ] Recalcular otra vez **reemplaza** los ajustes anteriores y **conserva** la cortesía que alguien les marcó.
- [ ] **No se puede agregar a mano** un renglón de ajuste de estancia (el alta de renglones lo rechaza).
- [ ] **Cómo sale el nombre en el papel.** La hoja nueva imprime el nombre del servicio tal cual está en el
      catálogo: **«Ajuste de Estancia_de 2 hrs a 12 hrs»** y **«Ajuste de Estancia_de 12 hrs a pernocta»**, con el
      guion bajo. **El papel viejo los reescribía a «Ajuste de Estancia»** (`invoice21.php:189`, y lo mismo en
      `invoice.php:190` e `invoicecot.php:190`). Es una decisión pendiente y no un defecto descubierto al imprimir:
      **preguntar al departamento si lo quieren así.** No se arregla renombrando el servicio en el catálogo: la
      siguiente importación le devuelve el nombre del origen (para las filas con concepto el nombre viaja con los
      valores que importa `ImportadorMatriculas::importarServicioConConcepto`).
- [ ] **Hay que haber hecho antes la verificación SQL de arriba**; sin ella esto da 422.

### 4. Un pago con saldo a favor: el IVA no baja

- [ ] **Antes de seguir, la forma «Saldo a favor» tiene que aparecer en el panel de cobro.** Si no aparece,
      falta el seeder (o está inactiva).
- [ ] En una prefactura con IVA, anotar **subtotal, IVA y total**; registrar un pago con «Saldo a favor» por parte
      o por todo el importe; comprobar que **subtotal e IVA no cambian** (en el viejo, el saldo a favor como
      renglón negativo bajaba el IVA).
- [ ] **No genera cambio**: un pago de saldo a favor **mayor** que lo que falta se trata como **cobrado de más**,
      no como cambio (el cambio se limita al efectivo). Probar también efectivo y saldo a favor juntos: el cambio
      es solo el del efectivo.
- [ ] Imprimir esa prefactura: la forma de pago sale con su nombre (la plantilla imprime el nombre de la forma).

### 5. Las pantallas de agrupar, en el navegador

Sin pruebas de frontend, **que alguien las use**:

- [ ] **Agrupar** abre un diálogo con un campo de etiqueta; si la prefactura ya tiene grupos, ofrece **un botón
      por etiqueta existente** para copiarla con un clic.
- [ ] Una etiqueta **en blanco no se deja enviar** («Escribe la etiqueta del grupo…»). Es importante: el servidor
      lee el blanco como `null`, o sea, **desagrupa**.
- [ ] Una etiqueta de más de 60 caracteres se rechaza.
- [ ] «Rampa» y luego «rampa»: la pantalla **rechaza la segunda** y nombra la existente.
- [ ] Tras agrupar, el renglón muestra su etiqueta; **Cambiar grupo** y **Desagrupar** funcionan; desagrupar deja
      el renglón con su importe, margen y cantidad **intactos**.
- [ ] En una prefactura **cerrada** no se puede cambiar el grupo (409 `ya_cerrada`; lo fija una prueba) y el
      documento reimpreso sale igual.

## Las limitaciones, dichas y no escondidas

- **El sistema no lleva la cuenta del saldo a favor de cada cliente.** El importe lo escribe el operador, igual
  que el efectivo: **no hay tabla de saldos y nada valida contra ella**. Si facturación espera que el sistema le
  impida aplicar más saldo del que el cliente tiene, **eso es otro bloque** y hay que decidirlo; hoy el control
  es del operador.
- **La etiqueta del grupo no tiene catálogo.** La pantalla ofrece las etiquetas que ya existen en esa
  prefactura y **rechaza una que solo difiera en mayúsculas** («Rampa»/«rampa»), pero **no cubre acentos ni
  espacios internos**: «Rampa» y «Rámpa», o «Rampa norte» y «Rampa  norte», son **dos grupos** y el documento
  imprimiría dos filas donde el operador quiso una. La etiqueta **es** la identidad del grupo.
- **Una etiqueta en blanco desagrupa (200), y esto CONTRADICE lo que la especificación decía** (la tabla «Qué se rechaza» pedía 422 para «etiqueta vacía o solo espacios»; la especificación se **enmendó** en esta ronda para decir lo que se entrega). Es una desviación decidida, no un descuido: quien apruebe comparando ambos documentos no debe encontrar una contradicción sin explicación. La razón: **`ConvertEmptyStringsToNull`** convierte el blanco en `null` antes de validar, que es el contrato para desagrupar, y se prefirió no abrir una excepción en el middleware global por un solo endpoint. La pantalla lo impide, y
  además **comprueba contra la respuesta del servidor** que el renglón quedó agrupado de verdad: si la etiqueta
  llegó vacía (por ejemplo, de solo caracteres invisibles, que el `trim` de JavaScript no recorta y el de Laravel
  sí), sale una advertencia y no el aviso de éxito. **Quien llame al endpoint directamente, sin la pantalla,
  puede desagrupar sin querer** enviando una etiqueta en blanco.
- **Una cortesía dentro de un grupo deja de verse** en el papel (arriba). La pantalla lo avisa; el sistema no lo
  impide.
- **Un grupo no tiene remisión, precio ni cantidad**: salen como guion. Si el departamento necesita esos datos en
  la fila del grupo, hay que decidir cuáles y de dónde.
- **El ajuste de estancia depende de que existan, activos y con concepto, dos servicios del catálogo.** Si
  alguien los da de baja o los renombra y reimporta, deja de funcionar (422). Ver arriba.

## La deuda que este bloque NO retira

**De los bloques anteriores, sigue igual** (los archivos de este bloque no la tocan): todo lo que la guía del
bloque 4 lista en «La deuda que este bloque NO retira» y «De los bloques anteriores, sigue abierta sin
cambios». Se resume aquí **solo para que nadie crea que se resolvió**; el detalle y las cifras están en esa guía
y en las del 1b, 2 y 3:

- La ruta `GET /api/ControlMedicamento/exportar-pdf` **funciona y no tiene puerta departamental** (cualquier
  usuario autenticado); las dos vías de PDF sin unificar; el mensaje impreciso del trait
  `RechazaPrefacturaCerrada`; DomPDF escribe en `storage/` y en el temporal y **no se comprobó en producción**;
  el `chroot` de DomPDF y el logo; **el RFC del cliente no sale en el papel nuevo**; la cotización que mezcla
  dos lecturas de los renglones.
- **El CAMBIO de un documento emitido no está sellado** (advertencia para el bloque 6, en la guía del 4).
- La conexión `remota` con credenciales de escritura; **ninguna restricción única** sobre
  `fact_prefacturas.operacion_llegada_id`; reabrir una cerrada no está protegido en el modelo; cobrar una
  cerrada está decidido que no y no se ha probado; **los puntos 1 a 6 de «Lo que sqlite no puede demostrar»**
  de las guías del 2 y del 3 siguen sin probarse contra MySQL real y hay que probarlos **antes** de que dos
  operadores usen el módulo a la vez; la **URL del PDF pegada en una pestaña nueva** (sesión Sanctum) sigue sin
  casilla marcada.
- **La importación del histórico sigue siendo parcial hasta el bloque 6**, y llega con decisiones pendientes que
  la guía del 3 lista en «La importación del histórico: el aviso que el usuario pidió». **Este bloque no la
  completa.**
- **El descuento de importe libre no se hace**, por decisión de la especificación: la cortesía del bloque 3
  cubre los 4 casos legítimos y el saldo a favor los otros 4; los 2 restantes son justo lo que el botón viejo
  hacía mal. (La guía del 4 lo daba como «bloque 5, pendiente»: ya no lo es.)

**Nueva, descubierta o dejada por este bloque:**

- **Resuelto en este bloque, y es lo más importante que se descubrió:** el importador **no** asignaba el concepto a
  los servicios 109 y 110, así que en una instalación real el ajuste de estancia no funcionaba, y reimportar
  duplicaba los dos servicios. Se arregló en `0311314` (`CONCEPTOS_POR_ID_VIEJO` ganó el 109 y el 110) con dos
  pruebas en `ImportadorCatalogosTest.php`; quitar las dos entradas las hace fallar. Tras el arreglo, reimportar
  deja **2** filas (antes, 4). Queda la **nota de rescate** de arriba para una base que ya pasó por la versión
  anterior, y la migración `094000` se conserva como respaldo para las bases ya importadas.
- **El mensaje de `ServicioDeEstanciaNoDisponibleException` dice «Corre el importador de catálogos», y no
  existe ningún comando con ese nombre.** `app/Console/Commands/` solo tiene `CompararPagos`,
  `CompararPrefacturas` e `ImportarMatriculasPrefactura` (`facturacion:importar-matriculas`, que **sí** importa los
  catálogos pero conserva el nombre del bloque 1a). Falta decidir si el mensaje nombra ese comando o se escribe
  uno nuevo. **Y ahora importa más:** el ajuste de estancia depende de que esos servicios estén importados, así que
  el operador que vea ese mensaje necesita saber qué comando correr. **El mismo texto vive en
  `PagosPrefactura.php:199`**, para la comisión Amex.
- **`EditorPrefactura.tsx` pasa de las 1.250 líneas** (**1.272** al cerrar el bloque, contadas con `wc -l`; eran
  1.104 al empezar el bloque, en `bd21cd0` y en `e22739f`: el 1.097 de la guía del 4 era el valor **antes** de su revisión final, así que el bloque 5 añadió **168 líneas**, no 175). Está decidido que **no se parte en este bloque**; el
  candidato natural a componente es **la fila de renglón con sus diálogos**.
- **`pint --dirty` no se puede correr sobre seis archivos que este bloque tocó**: **`routes/api.php`**,
  **`ImportadorMatriculas.php`** e **`ImportadorCatalogosTest.php`** (PHP: `pint`) y **`EditorPrefactura.tsx`**,
  **`ModalEstancia.tsx`** y **`apiFacturacionCatalogos.ts`** (TypeScript: `prettier`, no pint, que solo toca PHP; el
  `package.json` tiene `format` y `format:check`). **Los seis violaban el estilo antes del bloque.** Comprobado: la versión de `routes/api.php` en `e22739f` y la de `HEAD`
  dan **el mismo resultado** con pint (**67 líneas cambiadas, 128 líneas de diff**, sobre una copia fuera del
  repositorio; la task 4 midió «129» imprimiendo otra cuenta: mismo orden de magnitud), y `npx prettier --check`
  marca los tres `.tsx`/`.ts` en `e22739f` y en `HEAD` (comprobado archivo por archivo); y `ImportadorMatriculas.php` e `ImportadorCatalogosTest.php` ya fallaban `pint --test` en `HEAD` antes del arreglo del importador (copias fuera del repositorio). Por eso a ninguno se le corrió `pint --dirty`, y las correcciones de la revisión final se hicieron a mano. Y `pint --dirty` sobre un archivo así lo
  reformatea **entero**: ese es el ruido ajeno que se evitó al descartar su resultado. Es un **conflicto real con
  la regla del `CLAUDE.md` del proyecto** («ejecuta `vendor/bin/pint --dirty` antes de terminar»). Conviene que
  alguien decida si se formatean esos seis archivos **en un commit propio**, que no mezcle lógica.
- **El papel nuevo imprime los nombres crudos del catálogo, y el viejo reescribía varios.** Es una capa entera de
  reescritura que la plantilla del bloque 4 no replica, y es **más grande que los dos nombres de ajuste**. En
  `invoice21.php:187-189` (y en `invoice.php` e `invoicecot.php`, con la misma lógica; los tres definen
  `$ids = [91, 103];`): los servicios **91 y 103** salen como **«Otros servicios»**; `Comisariato_Manny` y
  `Comisariato_Avemex` salen como **«Comisariato»**; y los dos ajustes de estancia salen como **«Ajuste de
  Estancia»**. La plantilla nueva imprime `nombre_servicio` tal cual. **Importa dos veces:** por este hallazgo
  generalizado (todo el departamento va a ver nombres distintos en el papel), **y porque el servicio 91 es
  exactamente donde viven los 4 negativos de «Saldo a favor»** que el bloque 6 va a importar, cuya hoja antigua
  decía «Otros servicios». **No se tocó la impresión en este bloque** (es territorio del bloque 4 y afecta a más
  servicios): hay que decidir si la plantilla replica la reescritura, y dónde vive esa regla (renombrar en el
  catálogo no basta: la importación devuelve el nombre del origen).
- **El índice de `grupo` no tiene hoy ninguna consulta que servir** (nada filtra ni ordena por esa columna). Lo pedía
  la especificación y es inocuo; se deja.
- **El alcance de `--forzar` creció:** el aviso que imprime el importador dice ahora «el nombre solo en los
  servicios que llevan concepto», sin número (decía «cuatro»; con este bloque son **siete** —ids 7, 2, 3, 4, 100,
  109 y 110— y era la tercera vez que esa frase envejecía). No se pudo usar `count(self::CONCEPTOS_POR_ID_VIEJO)`:
  `SOBREESCRIBEN` es una constante y `count()` no se admite en una expresión constante.
- **Una mutación sobrevive, y es inalcanzable.** Sumar el grupo con `array_sum` + `number_format` en lugar de
  `bcadd` no rompe ninguna prueba. Se usa `bcadd` **por coherencia con el resto del modelo** (`subtotalDerivado()`
  suma con `bcadd`) y para no depender de `float`, **no por una diferencia que se pueda alcanzar**: el importe de
  un renglón llega a ~10^10 (`decimal(12,2)`), con margen máximo a ~10^11, y un `double` no pierde el centavo hasta
  ~10^13; harían falta cientos de renglones en el máximo. **Y hay un argumento mejor, de la revisión final:** todos los sumandos son múltiplos exactos de 0.01, así que la suma exacta también lo es y **nunca cae sobre un medio centavo**; para que el redondeo eligiera mal haría falta un error acumulado de 0.005 o más, es decir magnitudes de ~10^13. No es improbable: es **inalcanzable**. Un revisor hizo la cuenta por su lado y coincide. Se
  declara en lugar de callarla: una mutación superviviente declarada vale más que una silenciosa.
- **Hay dos bases del sistema viejo.** `conexion.php` (`Prefectura/conexion.php`) lee `fact-fbo`, que llega al
  **2026-08-21**; las mediciones de este bloque (folio 932, los 54 «Otros», los 10 renglones negativos, los 5
  usos de agrupar) son de `fact-fbo-prod`, que llega al **2026-09-28**. **La importación del bloque 6 necesita una
  copia fresca**, y conviene repetir las mediciones sobre ella. (Las fechas son las de la especificación; esta
  guía no volvió a medirlas.)
- **La base MySQL local de desarrollo no está migrada** al estado del bloque 2: comprobado, `fact_servicios`
  existe, tiene **0 filas** y **no tiene la columna `concepto`**. Las pruebas corren en sqlite y no se nota, pero
  quien quiera probar a mano en local tiene que **migrar primero** (y, por lo de arriba, importar y comprobar los
  conceptos de ajuste).
- **`CLAUDE.md` está sin seguimiento en git** (`git status` lo muestra como `??`), así que las guías del proyecto
  no llegan a nadie más ni sobreviven a un clon limpio. **`boost.json` está igual.**
- **Los 10 renglones negativos del histórico**, para el bloque 6:
  - Los **6** de remisión «Cortesía» (folios 3090, 3393, 3507, 3508, 3640 y 3646) entran como `es_cortesia` sobre
    el cargo que cancelan. **Cuatro cancelan exactamente** su cargo (3393, 3508, 3640 y 3646). **Dos necesitan
    decisión humana**, y no por la misma razón: el **3090** **no tiene ningún cargo que cancelar** (−1.615,00 sin
    un Tránsito 02 que lo respalde, sobre una cuenta de 86.568,30) y el **3507** **cancela de más** (−606,05
    contra un cargo de 527,00: 79,05 de exceso). Las dos son el defecto del botón viejo, que ofrece la tarifa
    **vigente** de la matrícula y no el precio congelado del renglón.
  - Los **4** de «Saldo a favor» (folios 3109, 3118, 3160 y 3746, escritos a mano en el servicio 91) entran como
    pagos con la forma nueva.
- **`grupo()` devuelve 200 sin pasar por la guarda de cerrada** cuando la etiqueta pedida es la que el renglón ya
  tiene (salida temprana idéntica a la de `cortesia()`). Solo difiere de un 409 en una carrera estrecha, sobre una
  prefactura recién cerrada y con el mismo valor, y **no escribe nada**. Se dejó como está por simetría.
- **Si existiera una forma «Saldo a favor» con otro concepto**, el seeder chocaría con el índice único. Requiere
  manipular la base a mano (la pantalla de catálogo no asigna `concepto`); falla ruidosamente y no pisa nada.
- **Menores del ajuste de estancia aceptados**: el `.required` de las dos reglas `sometimes` nunca se dispara (lo
  produce el bucle que arma los mensajes), y `detalleSinPrecio()` relee las tarifas en lugar de recibirlas.
  Ninguno afecta al dinero.
- **La rama de producción es `main`, y ya tiene el arreglo de reverb. RESUELTO el 2026-10-06.**
  Lo confirmó el responsable del proyecto. Comprobado: `origin/main` está en **`94a3a19`**, cuyo
  `composer.json` declara `laravel/reverb: ^1.12` y `pusher/pusher-php-server: ^7.3`. Así que
  **un `composer install` limpio en producción ya no rompe `artisan`**, que era el riesgo que la guía
  del bloque 4 dejaba abierto.

  Queda una nota, no un riesgo: el remoto tiene además una rama `produccion` (`a30bfb9`) que **no**
  contiene `94a3a19` y tiene un commit que `main` no tiene. **No es la rama del servidor**, pero si
  alguien la despliega alguna vez, ahí sí falta el arreglo. Conviene fusionarla o retirarla para que
  no confunda a quien venga después.

## Resumen: lo que hay que hacer, en orden

1. **Subir `facturacion` al remoto** (hoy solo existe en local) y que sea la rama activa del servidor.
2. `git pull` y `composer install --no-dev --optimize-autoloader`; `php artisan --version` tiene que responder.
3. **`php artisan migrate`**: las dos migraciones nuevas (`094000` y `094100`).
4. **Si los catálogos no están importados** (caso a): `php artisan facturacion:importar-matriculas` y, tras leer
   la simulación, `--aplicar`. **Si ya lo estaban** (caso b): no correr el importador.
5. **Después, y solo después**: `php artisan db:seed --class=FacturacionFormasPagoSeeder`. Al revés, la guarda del
   importador se niega con un aviso falso.
6. **Comprobar con el SQL de «Verificación»** que hay **dos** servicios con los conceptos de ajuste y **una**
   forma `saldo_a_favor`. Si faltan los de ajuste, el origen no trae los servicios 109 y 110 (o es una base de la versión anterior del importador: ver la **nota de rescate**).
7. `php artisan optimize:clear` y `npm ci && npm run build`.
8. **Que alguien imprima una prefactura con un grupo y mire la hoja** (los tres guiones; la suma contra el
   total), y que pruebe el ajuste con tarifas reales, el saldo a favor (el IVA no baja) y el aviso de agrupar una
   cortesía. Con la lista de arriba.
9. Solo entonces, que el departamento decida si aprueba.

**Aparte, para quien decida:** la rama `produccion` del remoto, que no es la del servidor y no tiene el
arreglo de reverb; el mensaje que nombra un comando
inexistente; formatear `routes/api.php`, `EditorPrefactura.tsx` y los dos archivos del importador en un commit propio; y, para el bloque 6, una
copia fresca de la base del viejo.
