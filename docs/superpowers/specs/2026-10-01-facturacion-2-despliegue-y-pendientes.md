# Bloque 2 — Guía de despliegue y pendientes abiertos

**Fecha:** 2026-10-01 · **Rama:** `facturacion-2-prefactura` (ramada de `facturacion-1b-catalogos`)

Acompaña a `2026-10-01-facturacion-2-prefactura-design.md` y continúa la guía del
bloque anterior, `2026-09-30-facturacion-1b-despliegue-y-pendientes.md`, a la que
remite en varios puntos en lugar de repetirla. Recoge lo que hay que hacer **antes**
de poner el bloque en producción, lo que la suite no puede demostrar, y el resultado
real de la comprobación contra el histórico.

Cada afirmación de esta guía está respaldada por el código de la rama o por una
medición que se nombra. Donde algo **no** se midió, se dice.

## Lo que hizo esta rama

Trae a Eolo-plus la prefactura: el encabezado, sus renglones, los totales derivados,
el cierre con folio, los cargos de estancia desde las tarifas de la matrícula, el
paquete internacional, los endpoints con permisos y bitácora, las pantallas (lista y
editor) y el comando `facturacion:comparar-prefacturas`, que contrasta la aritmética
contra el histórico del sistema viejo sin escribir nada.

Tres decisiones de diseño que explican el resto de la guía:

- **Los totales no se guardan en un borrador: se derivan** de los renglones. Solo al
  cerrar se sellan (`subtotal_sellado`, `iva_sellado`, `total_sellado`,
  `iva_tasa_sellada`). El `importe` de un renglón nunca se guarda. Guardarlo es la
  redundancia que dejó al sistema viejo con encabezados cuyo total no corresponde a
  sus renglones.
- **El folio sale de un contador con `lockForUpdate()`**, no de `MAX(folio) + 1`. El
  sistema viejo sí usa `MAX + 1` (`a_pref.php`, líneas 24 a 38: lee el último folio de
  `tb_hprefactura` y suma uno), un mecanismo que permite duplicados. **Que ese mecanismo
  sea lo que produjo sus 207 folios duplicados no está demostrado**: ver «Los 207 folios
  duplicados: qué son» más abajo.
- **Una prefactura cerrada no se edita**: el invariante vive en el modelo, en el
  servicio y en los endpoints, no solo en la pantalla.

## Este bloque SÍ toca código del 1b

Igual que el 1b lo dijo del 1a. Las tablas nuevas no tocan nada existente, pero el
código sí. Respecto a `facturacion-1b-catalogos` cambian estos archivos del 1b:

- `ImportadorMatriculas`: ahora asigna `concepto` y `en_paquete_internacional`, y casa
  por `concepto` los servicios que lo llevan. En `ImportarMatriculasPrefactura` solo
  cambió el texto de la lista de lo que `--forzar` pisa.
- `FactServicio`, `StoreServicioRequest` y `UpdateServicioRequest`: el vínculo del
  combustible pasó de una guarda por **nombre** a la columna `concepto`; las guardas de
  validación por nombre se retiraron.
- `FactPrecioCombustible`: la sincronía del precio busca el servicio por `concepto`.
- `Bitacora`: un módulo nuevo para prefacturas.

Los controladores de los cinco catálogos del 1b **no** se modificaron (comprobado
con `git diff --stat facturacion-1b-catalogos HEAD -- app`), y por eso sus
pendientes siguen abiertos (ver «La deuda que este bloque NO retira»).

**Backend y frontend se despliegan juntos**, y hay que reconstruir el frontend: la
pantalla nueva espera endpoints que solo existen en el backend nuevo. El backend
nuevo con el frontend viejo no se rompe (las rutas solo se agregan), pero no habría
menú ni pantalla.

## Orden de despliegue

```bash
git pull
composer install --no-dev --optimize-autoloader

# CUATRO migraciones, todas aditivas. Ninguna modifica ni borra filas existentes:
#   2026_09_29_092000  agrega a fact_servicios las columnas `concepto` (única, nula)
#                      y `en_paquete_internacional` (0 por omisión)
#   2026_09_29_092100  crea fact_prefacturas
#   2026_09_29_092200  crea fact_prefactura_renglones
#   2026_09_29_092300  siembra en fact_configuracion el contador del folio (10000)
php artisan migrate

# +- ¿QUÉ BASE ES ESTA? Los pasos 1 a 3 dependen de la respuesta ----------------+
# | (a) El 1b NO estaba aplicado (se despliegan juntos): pasos 1 a 3 tal como    |
# |     están; la primera --aplicar ya asigna conceptos y marcas.                |
# | (b) El 1b YA ESTABA en uso, sea cual sea el motivo: NO correr los pasos 1 a  |
# |     3. Usar la OPCIÓN B de la guía del 1b (sección «Precio del combustible»),|
# |     que asigna solo concepto y marcas con un UPDATE dirigido y no toca nada  |
# |     más. El criterio es «el 1b ya estaba en uso», NO «alguien editó          |
# |     servicios»: --forzar pisa SEIS tablas (aeronaves, categorías de          |
# |     aeronave, tipos de motor, precio de combustible, clientes y servicios),  |
# |     y quien editó tarifas de matrícula pero no servicios perdería justo las  |
# |     tarifas de estancia que este bloque cobra.                               |
# +------------------------------------------------------------------------------+

# SOLO PARA EL CASO (a). En el caso (b) saltar a la opción B.
# 1. Simulación del importador: lee fact-fbo, escribe y revierte.
#    LEER ENTERA la salida, sobre todo la lista de tablas que --forzar pisa.
php artisan facturacion:importar-matriculas | tee storage/logs/facturacion-importacion-$(date +%F).log

# 2. Aplicar. --forzar hace falta porque fact_aeronaves ya tiene filas.
php artisan facturacion:importar-matriculas --aplicar --forzar | tee -a storage/logs/facturacion-importacion-$(date +%F).log

# 3. Comprobar que concepto y marcas quedaron (SQL de «Verificación» más abajo).

# La comprobación de que el dinero cuadra contra el histórico. SOLO LEE.
# Ver «El resultado real del comando de comparación» para leer su salida.
php artisan facturacion:comparar-prefacturas | tee storage/logs/facturacion-comparacion-$(date +%F).log

php artisan db:seed --class=FacturacionSubdepartamentosSeeder
php artisan optimize:clear
npm ci && npm run build
```

Después, asignar el subdepartamento **`factPrefacturas`** desde Gestión de usuarios,
con la función de agrupar por departamento. El rol administrador ve «Prefacturas» sin
asignación, porque su menú está escrito aparte en `navigation.ts` (igual que con las
entradas del 1b). La entrada va en el primer nivel del módulo Facturación, junto a
«Aeronaves facturables» y «Clientes», no dentro de «Catálogos».

### Paso obligatorio: volver a correr el importador

**Si el 1b ya estaba en uso, el «importador» de este paso es la OPCIÓN B de la guía
del 1b (UPDATE dirigido), no `--forzar`**: ver el cuadro de decisión de arriba y
«Qué pisa `--forzar`» más abajo. `--forzar` revierte a los valores del sistema viejo
cualquier tarifa, RFC o precio editado a mano en seis tablas y **eso cambia cobros**.

**Es el paso más fácil de omitir y el que más rompe.** La migración `092000` agrega
`concepto` y `en_paquete_internacional` y los deja en **NULL y 0 en las filas que ya
existen**. Hasta que alguien los asigne:

- **los cargos de estancia fallan.** `CargosEstancia::recalcular()` busca cada
  servicio por su concepto entre los activos y, si no lo encuentra, lanza
  `No existe un servicio activo con concepto 'estancia_...'. Corre el importador de
  catálogos o reactívalo.` (la transacción se revierte entera, incluido el borrado de
  la estancia previa). Solo ocurre cuando la cantidad de ese concepto es mayor que
  cero, así que **puede pasar desapercibido hasta el primer operador que cargue una
  pernocta**;
- **el paquete internacional no agrega nada**, y esto es **silencioso**: filtra por
  `en_paquete_internacional = 1`, no encuentra ninguno y devuelve cero renglones agregados
  sin error;
- **la sincronía del precio del combustible no actualiza nada**, también sin error ni
  rastro, porque no encuentra el servicio por su concepto.

El importador asigna **cuatro conceptos** (`combustible`, `estancia_transito_2h`,
`estancia_transito_12h`, `estancia_pernocta`, que corresponden a los ids viejos 7, 2,
3 y 4) y **cuatro marcas de paquete internacional** (ids viejos 9, 10, 14 y 93): ocho
servicios en total. Los tres de estancia y los cuatro del paquete son siete; el
combustible es el octavo y es el que arrastra el precio.

El importador solo asigna un concepto a una fila que lo tiene en NULL y nunca cambia
uno ya puesto.

### Qué pisa `--forzar`

Remite a la sección **«Qué pisa `--forzar`»** de la guía del 1b, que tiene la tabla
completa de tablas y columnas, y a la advertencia de que cualquier tarifa, RFC o
precio editado a mano desde las pantallas se revierte al valor del sistema viejo y
**eso cambia cobros**. No se repite aquí para que no haya dos listas que diverjan.

`--forzar` pisa **seis** tablas: aeronaves (estatus, categoría, motor, derecho de
vuelos y tarifas propias), categorías de aeronave (tarifas de pernocta y tránsito),
tipos de motor (tarifa de aterrizaje), precio vigente del combustible, clientes (RFC,
correo y teléfono) y servicios (categoría, precio, margen, ajuste y, en algunos, nombre).

Lo único que este bloque agrega a esa lista: para los servicios que **casan con el
origen** (por nombre, o por concepto los cuatro que lo llevan), `--forzar` reescribe la
marca `en_paquete_internacional` desde el origen (solo los ids viejos 9, 10, 14 y 93
quedan en 1) y asigna `concepto` solo a las filas que lo tienen en NULL; nunca cambia
uno ya asignado.

**Elegir entre las dos vías:** si el 1b ya estaba en uso, se usa la **opción B** de la
guía del 1b: los `UPDATE` dirigidos (con `SET NAMES utf8mb4;` obligatorio, su
comprobación B.0 previa y su verificación posterior), **en lugar de** los pasos 1 a 3.
La opción A (`--forzar`) queda para cuando el 1b y el 2 se despliegan juntos, o para
una base de pruebas.

### Verificación (haya sido el importador o la opción B)

```sql
SET NAMES utf8mb4;
SELECT concepto, nombre FROM fact_servicios WHERE concepto IS NOT NULL;   -- 4 filas
SELECT id, nombre FROM fact_servicios WHERE en_paquete_internacional = 1;  -- 4 filas
```

Cuatro conceptos (`combustible`, `estancia_pernocta`, `estancia_transito_2h`,
`estancia_transito_12h`) y cuatro marcas (`DSMES`, `DSM`, `Mex-eAPI` y `Servicios
Internacionales`, todos «- salida»). Contar no basta: se listan.

### Después de la opción B: comprobar el precio del combustible

El importador, al final de su corrida, restablece el invariante «el precio del
servicio de combustible es el precio Eolo vigente». **La opción B no lo hace.** Si
alguien registró un precio de combustible entre `migrate` y el `UPDATE`, la sincronía
no encontró el servicio (su concepto aún era NULL) y el servicio quedó con el precio
anterior: la pantalla de Combustible dice una cosa y el catálogo cobra otra, sin error.
Comprobar:

```sql
SELECT s.precio_unitario AS precio_del_servicio, p.precio_eolo AS precio_eolo_vigente
  FROM fact_servicios s,
       (SELECT precio_eolo FROM fact_precios_combustible WHERE vigencia_fin IS NULL ORDER BY id DESC LIMIT 1) p
 WHERE s.concepto = 'combustible';
```

Las dos columnas deben ser iguales. Si no lo son, **volver a registrar el precio desde
la pantalla de Combustible** (la sincronía ya encuentra el servicio y deja rastro en la
bitácora con el valor anterior), no corregir el servicio a mano. **Teclear el precio de
Eolo explícitamente, igual al vigente**: si se deja que la pantalla lo calcule con la
fórmula a partir del precio ASA, puede salir un diezmilésimo distinto (la guía del 1b
documenta 26.0640 contra 26.0639), y entonces el servicio tampoco coincidirá. Repetir
la consulta de arriba después.

### ATENCIÓN: revertir este bloque DESTRUYE prefacturas

**No ejecutar `php artisan migrate:rollback` en una base con prefacturas.**
`migrate:rollback` no revierte «una migración»: **revierte el último lote**, que es
este despliegue entero (las cuatro migraciones; en una base nueva, donde todo corrió en
un solo lote, incluso las anteriores: se comprobó en una base de prueba, donde
`migrate:rollback --pretend` lista el borrado de todas). Los `down()` de este bloque son:

| Migración | Lo que hace su `down()` |
|---|---|
| `092300` | **borra la fila del contador** `prefactura_folio_siguiente` |
| `092200` | `DROP TABLE fact_prefactura_renglones`: **todos los renglones** |
| `092100` | `DROP TABLE fact_prefacturas`: **todas las prefacturas, cerradas incluidas, con sus folios y sellos** |
| `092000` | quita `concepto` y `en_paquete_internacional` de `fact_servicios` |

Quien ejecute el rollback con prefacturas ya cerradas **pierde todos los documentos
emitidos y sus folios**, sin copia en ningún otro lado: el sistema viejo no las tiene
(sus folios son menores de 10000). Además, aunque solo se revirtiera `092300`, volver
a migrar resembraría el contador en **10000** y el siguiente cierre intentaría un folio
que ya existe; el índice único lo rechazaría y el cierre fallaría hasta ajustar el
contador a mano.

Reglas:

- **Antes de migrar**, sacar copia de `fact_prefacturas`, `fact_prefactura_renglones`,
  `fact_servicios` y `fact_configuracion` (por ejemplo con `mysqldump`).
- **Después del primer cierre, ninguna migración de este bloque se revierte.** Si hay
  que dar marcha atrás del despliegue, se vuelve al código anterior y las tablas y
  columnas se dejan donde están. Se espera que el código del 1b las ignore (las
  columnas nuevas son nulas o tienen valor por omisión), pero **eso no se probó**.
- Si de verdad hace falta revertir una sola migración, y **solo en una base sin
  prefacturas cerradas**: `--step=N` cuenta desde la migración más reciente de toda la
  base, no desde la que dice `--path`, y `--path` solo filtra qué archivos acepta
  (una que no coincide sale como «Migration not found» y no se hace nada). Por eso:

  ```bash
  php artisan migrate:status        # ver cuáles son las más recientes
  php artisan migrate:rollback --pretend --step=1 --path=database/migrations/2026_09_29_092300_seed_folio_prefactura_en_fact_configuracion.php
  ```

  **Leer la salida de `--pretend`**: debe listar exactamente las sentencias de esa
  migración y ningún «Migration not found». Solo entonces repetir el comando sin
  `--pretend`. Una migración intermedia (`092200`, `092100`) no se puede revertir sin
  revertir antes las posteriores, porque el rollback va en orden inverso.

## El folio arranca en 10000

La migración `092300` siembra `prefactura_folio_siguiente = 10000` en
`fact_configuracion`. Se eligió así porque **el mayor folio del sistema viejo es 4121**
(medido contra `fact-fbo-prod`: `MAX(fol_prefactura) = 4121`) y sus borradores
abiertos llegan a 4123 (dato del diseño del bloque, no vuelto a medir al escribir esta
guía). Consecuencias, que son el motivo del salto:

- **Mientras los dos sistemas convivan, ningún folio puede coincidir**, y no hay
  carrera de numeración entre ellos.
- **De un folio se sabe al instante qué sistema lo emitió**: menos de 10000, el
  sistema viejo; 10000 o más, Eolo-plus.

El contador se siembra en la migración y **no** lo crea el cierre: un `insert ignore`
en cada cierre provoca deadlock bajo InnoDB (ERROR 1213), y se midió (ver abajo).
Si la fila falta, el cierre lanza `ModelNotFoundException` sin consumir folio; el
remedio es correr la migración.

La tasa de IVA se toma de `fact_configuracion.iva_tasa`; si esa fila no existe se usa
`0.16`. Al cerrar, la tasa usada se sella en `iva_tasa_sellada`.

## El barrido PHP contra TypeScript

La vista previa del importe en el modal de renglón (`importeVistaPrevia` en
`resources/js/pages/Facturacion/components/formato.ts`) es una copia en TypeScript de
la fórmula de `App\Support\ImporteServicio`. **La autoridad es el PHP**: el servidor es
quien calcula los totales y la pantalla solo los muestra.

Resultado del barrido de la Task 1: **512 combinaciones (8 precios × 4 cantidades × 4
márgenes × 4 ajustes), cero diferencias** entre `ImporteServicio::calcular()` y
`importeVistaPrevia(...).toFixed(2)`.

**Hay que volver a correrlo si alguien toca `ImporteServicio` o `importeVistaPrevia`.**
La prueba permanente (`tests/Unit/ImporteServicioTest.php`) clava los valores del lado
de PHP pero **no** prueba la equivalencia entre los dos lados, y lo dice en un
comentario.

**Los scripts del barrido NO están en el repositorio** (vivieron en un directorio
temporal de la sesión) y los ocho precios originales no se conservaron. Para rehacerlo:
transpilar `formato.ts` a CommonJS con esbuild; generar las 512 combinaciones (8 precios
que incluyan los extremos, como 0.0001 y el máximo permitido × 4 cantidades × 4 márgenes
× 4 ajustes); calcular cada una con `ImporteServicio::calcular()` en PHP y con
`importeVistaPrevia(...).toFixed(2)` en Node; y exigir cero diferencias. Si nadie va a
hacer eso, la instrucción de «volverlo a correr» no se puede cumplir tal como está, y
la única red es la prueba que clava el lado de PHP.

## Lo que sqlite no puede demostrar

La suite corre sobre sqlite en memoria. Sqlite **ignora `lockForUpdate()`**, compara
texto en binario y no aplica concurrencia real. Lo que sigue depende de esas tres cosas
y hay que probarlo contra MySQL real, **antes** de que dos operadores usen el módulo a la vez.

### 1. El contador del folio serializa dos cierres simultáneos — YA SE MIDIÓ (el índice único, no)

Es la única parte de esta lista verificada con concurrencia real, y **no** fue contra la
base de producción sino contra MariaDB local. **Qué se demostró exactamente:** que el
contador con `lockForUpdate()` serializa los cierres. Con 60 de 60 folios distintos y
cero errores, **el índice único de `folio` nunca llegó a dispararse**: no se demostró que
aguante un duplicado, solo que el mecanismo de arriba no produce ninguno. La medición
viene de la revisión de la Task 4, hecha antes del HEAD final, **y no se repitió sobre
el código actual**.

- Dos procesos PHP contra MariaDB, con arranque sincronizado y 60 prefacturas,
  llamando al `CierrePrefactura::cerrar()` real: **60 cierres, 60 folios distintos y
  contiguos (10000 a 10059), cero errores.**
- Con 15 ms de espera inyectada tras cada sentencia, y con las dos sesiones peleando por
  las **mismas** 60 prefacturas: 60 cierres y 60 `PrefacturaYaCerradaException` del que
  pierde, sin huecos ni duplicados.
- **El control**: el flujo anterior (con `insertOrIgnore` del contador en cada cierre)
  reprodujo el deadlock (ERROR 1213) en unos **20 de 60** cierres con el mismo montaje.
  Eso valida que la medición sí detecta el problema.

Lo que esta medición **no** cubre: el montaje no forma parte de la suite ni del
repositorio, se corrió contra MariaDB y no contra la versión de MySQL de producción,
midió el servicio y no el endpoint HTTP, y es de una revisión anterior al HEAD final.
Repetirla sobre el código desplegado, en la base real, es sensato y barato.

Para comprobar que el índice único existe y rechaza (en una **copia** de la base, no
en producción), con dos prefacturas cerradas de prueba:
`UPDATE fact_prefacturas SET folio = <folio de la otra> WHERE id = <esta>;` debe fallar
con el error 1062 (entrada duplicada).

### 2. El cierre atómico devuelve 409 bajo dos conexiones reales

El endpoint de cierre toma el candado y atrapa `PrefacturaYaCerradaException`, que
traduce a **409 `ya_cerrada`**; descartar es un `UPDATE ... WHERE status = 'A' AND
estado = 'borrador'` que devuelve 409 si no afecta filas. La suite lo prueba con
peticiones **secuenciales** (prueba el 409 y la transición, no la atomicidad). La medición
del punto anterior vio la excepción del perdedor, **no la respuesta HTTP**. Falta
disparar dos peticiones `POST .../cerrar` y dos de «descartar contra cerrar» simultáneas
contra la misma prefactura y comprobar que exactamente una gana y la otra recibe 409,
sin folio consumido por el borrador descartado.

### 3. El `lockForUpdate()` del cierre y de los cargos de estancia sirve de verdad

El del cierre se ejercitó en la medición del punto 1 (el contador y la fila de la
prefactura). **Falta** comprobar los demás sitios donde se toma el candado, que sqlite
ignora:

- `CargosEstancia` (recalcular estancia y paquete internacional): el candado debe
  serializar una recalculación contra un cierre. Sin él, un renglón que otra sesión
  agregue o reemplace durante el cierre podría quedar fuera del sello, y el documento
  se emitiría cobrando de menos con el folio ya consumido.
- El alta y el borrado de renglones (`PrefacturaRenglonController`) y la edición del
  encabezado (`PrefacturaController::update`).

La prueba: dos sesiones, una cerrando y otra agregando un renglón o recalculando
estancia sobre la misma prefactura. El resultado correcto es que el sello coincida
siempre con los renglones de la prefactura cerrada, o que la que llegó tarde reciba 409.
El código tiene una segunda red (el cierre compara su sello contra la derivación y
lanza `SelloInconsistenteException` si no coinciden, con el folio sin consumir), pero
esa comparación **solo es coherente bajo REPEATABLE READ**, que `config/database.php`
no fija; es el valor por omisión de InnoDB, y conviene confirmarlo en la base real.

### 4. La collation no colapsa dos valores distintos de `concepto`

`fact_servicios.concepto` es `varchar(32)` **único** y se compara con la collation de la
columna (`utf8mb4_unicode_ci`, que pliega mayúsculas y acentos y, por ser PAD SPACE, no
distingue espacios finales); sqlite compara binario y no puede demostrar nada de esto.
Con los cuatro valores que existen hoy (ASCII, distintos entre sí) el riesgo es teórico,
pero es barato de comprobar y es exactamente la clase de cosa que la guía del 1b
documentó para los nombres:

```sql
SHOW FULL COLUMNS FROM fact_servicios LIKE 'concepto';   -- ver la collation
SELECT COUNT(*) AS filas, COUNT(DISTINCT BINARY concepto) AS distintos_binario,
       COUNT(DISTINCT concepto) AS distintos_collation
  FROM fact_servicios WHERE concepto IS NOT NULL;         -- 4, 4, 4
```

Las tres cifras deben ser iguales. Si `distintos_collation` es menor que `distintos_binario`,
dos conceptos colapsan y la búsqueda por concepto puede devolver la fila equivocada.
Además, una vez asignados, comprobar que cada concepto se encuentra una sola vez (el
paso de «Verificación» de arriba).

## El resultado real del comando de comparación

`php artisan facturacion:comparar-prefacturas` **solo lee**: lo fijan tres pruebas (cero
filas nuevas, mismos conteos en origen antes y después, y una captura de toda
sentencia en cualquier conexión que exige que todas sean `select` y todas vayan por
`remota`). Es la red que dice si el dinero cuadra. Esta es su salida real contra el
volcado de producción (`fact-fbo-prod`, conexión `remota`), sin tocar ninguna tolerancia:

| Comparación | Idénticas | Redondeo | Estructurales |
|---|---|---|---|
| Subtotal contra la suma recalculada de los renglones (3,557 comparadas) | 2,964 | 422 | 171 |
| IVA contra el 16% del subtotal guardado (3,494 comparadas) | 3,451 (3,077 exactas al centavo) | 43 | **0** |
| Total contra subtotal + IVA guardados (3,494 comparadas) | 3,053 (2,738 exactas al centavo) | 441 | **0** |

Las 171 estructurales del subtotal son tres cosas distintas, que el comando separa:
113 en las que el subtotal y los renglones no cuadran, 46 con subtotal guardado en cero
y 12 sin renglones (de estas últimas, ver la primera pregunta de negocio).

Además:

- **188 renglones** (de 10,310) cuyo `importe` guardado no corresponde a su propio
  `precio_u × cantidad`: 156 por más de 2 centavos y 32 por 2 centavos o menos. El peor:
  folio 866, renglón 5446, guardado 0.00 y recalculado **13,644.00**.
- **207 folios duplicados** en el origen (497 filas), **excluidos** de las tres
  comparaciones de arriba, porque `tb_venta` cuelga del folio y con un folio repetido
  se sumarían los renglones de todos los encabezados.

Cómo leerlo:

- **IVA y total: cero estructurales.** Ningún IVA se aleja más de 12 centavos del 16%
  redondeado, y las diferencias son simétricas alrededor de cero (3,077 exactas, 156 en
  −0.01 y 198 en +0.01): no hay sesgo hacia un lado, que es lo que dejaría un
  truncamiento sistemático. El desglose de «exactas al centavo» existe precisamente
  porque la tolerancia de 2 centavos de «idénticas» habría escondido un truncamiento.
- **El total difiere de subtotal + IVA hasta por 49 centavos en 441 prefacturas, y eso
  NO es ruido de float.** Leyendo el IVA a precisión completa, ninguna de esas 441 queda
  a menos de 1.1 centavos del total guardado (medición del revisor del comando). Lo que
  muestra el dato es otra cosa: ver «El total que no sale de subtotal + IVA» más abajo.
  Alguien que lea «es ruido de float» y descarte estas diferencias estaría descartando
  hasta 49 centavos por prefactura con una causa que no es esa.
- **Las clasificaciones dependen de cómo se lea el float** (ver «Las tres lecturas del
  FLOAT»), pero solo mueven el desglose de «exactas al centavo» y los renglones de uno o
  dos centavos; **no explican las diferencias del total**.
- **Los números pueden moverse** si el volcado se refresca. No es una regresión: el
  comando mide el origen tal como está.

### El total que no sale de subtotal + IVA

**Patrón medido** (en el volcado, con la lectura SQL del float y una tolerancia de 1.1
centavos, que no es la del comando: las cifras no son comparables una a una con las 441):
de las 3,494 prefacturas comparadas, 3,350 tienen un total igual a 1.16 × la suma de sus
renglones (`precio_u × cantidad`); de las 605 cuyo total difiere de subtotal + IVA
(leído a precisión completa) en 1.1 centavos o más, **579 coinciden con 1.16 × la suma
de los renglones** y 26 no se explican con eso; y 739 tienen el subtotal guardado a
1.1 centavos o más de la suma de sus renglones.

Dicho de otra manera: **el encabezado guarda un subtotal redondeado mientras el total
(y el IVA) salen de la suma exacta.** Dos casos concretos:

- **Folio 5**: subtotal guardado 289,480.00; renglones suman 289,480.50; total guardado
  335,797.38, que es exactamente 1.16 × 289,480.50.
- **Folio 2629**: subtotal guardado 110,659.00; renglones suman 110,658.54; total guardado
  128,363.91, que es 1.16 × 110,658.54 redondeado a centavos.

**Mecanismo: hipótesis NO verificada.** El sistema viejo calcula subtotal, IVA y total a
la vez desde `SUM(importe)` de los renglones en `Servicios_p.php` (líneas 52 a 64), lo que daría un
subtotal exacto; y existe otro camino, `actualizar_tot.php`, que escribe
subtotal, IVA y total tal como los manda el navegador por POST. Que ese camino (o
cualquier otro) sea el origen del subtotal redondeado **no se comprobó**: ni se
rastreó qué pantalla llama a cuál ni se cruzó contra las filas afectadas. Tampoco el IVA
sigue un patrón verificado: el del folio 5 (46,316.90) no es 16% ni de 289,480.00 ni
de 289,480.50. Hasta que alguien lo investigue, lo único afirmable es el patrón.

Para el bloque nuevo la consecuencia práctica es que el sistema nuevo, que deriva
subtotal, IVA y total de la misma suma, **no reproduce esos totales**: sale 1.16 ×
suma de renglones, con el subtotal también exacto. Cuál de los dos documentos es el
«correcto» para esas prefacturas es una pregunta de negocio (y de la importación del
histórico, ver bloque 3).

### Advertencia de alcance

**El comando prueba la aritmética, no el extremo a extremo.** Comprueba que, dados los
mismos renglones, el mismo precio y la misma cantidad, la fórmula da el mismo importe,
que el subtotal es la suma, que el IVA es el 16% y que el total es la suma. **No**
comprueba que se cobre lo correcto: las cantidades de estancia (cuántas pernoctas, cuántos
tránsitos) las **teclea una persona** y no son reproducibles desde el dato. Si alguien
cobró dos pernoctas donde correspondían tres, este comando no lo detecta.

Tampoco ejercita el código de producción: detectaría que el sistema viejo se desvía del
16%, no que `FactPrefactura::iva()` redondee mal. Eso lo cubre `PrefacturaTotalesTest`.
Lo que sí garantiza es que la fórmula del IVA (`FactPrefactura::calcularIva()`) vive en un
solo lugar y que el comando la llama en lugar de copiarla; una prueba con la
mutación comprobada (cambiar `0.005` por `0` la hace fallar) lo fija.

## Cuatro cosas del dato de origen que son preguntas para el negocio

No son defectos del código del bloque 2: son hallazgos del sistema viejo que la red
destapó. Van aquí porque alguien tiene que decidirlas, y **el comando las muestra, no las
esconde** (excluirlas habría ocultado cientos de miles de pesos).

1. **19 encabezados con dinero y sin un solo renglón, 307,972.60 pesos en total.**
   Son **19 filas de `tb_hprefactura` en 14 folios distintos** con subtotal mayor que
   cero y ningún renglón en `tb_venta`. El folio **2698** solo son **73,898.80**. Otros:
   3299 y 3541 (24,790.00 cada uno) y el folio 6 (20,913.00). El comando las clasifica
   como estructurales «sin renglones», pero **cuenta 12 filas en 12 folios, por
   192,309.20, no 19**, porque excluye los folios duplicados y dos de estos 14 lo son: el
   **3599** (4 filas, 115,063.40) y el **3800** (3 filas, 600.00). Comprobación:
   192,309.20 + 115,063.40 + 600.00 = 307,972.60. O sea que **los 115,663.40 de esos dos
   folios están en el dato y el comando no los ve**. ¿Son prefacturas capturadas y luego
   vaciadas? ¿Cobros reales sin detalle? No se sabe, y solo el negocio puede decirlo.
2. **46 prefacturas con subtotal guardado en cero** y renglones que suman más de un peso.
   El encabezado dice que no hay nada que cobrar y el detalle dice que sí.
3. **188 renglones cuyo importe guardado no corresponde a su precio por cantidad**, 156
   de ellos por más de 2 centavos, el peor por 13,644.00 (folio 866). Los 32 restantes son
   ruido del float, ver abajo.
4. **86 renglones en 42 folios cuyo folio no tiene encabezado en `tb_hprefactura`, por
   933,929.15 pesos** (suma de `importe`; con `precio_u × cantidad` salen 933,929.16).
   Cuentan dentro de los 10,310 «renglones revisados», pero **ninguna comparación los ve**:
   las de subtotal, IVA y total parten del encabezado, y la de renglones solo compara
   cada uno consigo mismo. Es casi un millón de pesos que la red no mira y de los que
   nadie sabe qué son (¿prefacturas borradas, renglones huérfanos de un fallo, folios de
   otra serie?).

Las 113 estructurales restantes (subtotal y renglones que no cuadran, con ambos
presentes) son la discrepancia de aritmética propiamente dicha; el comando las lista
con `--detalle=N` (por omisión enumera 20 por lista), y su destino es la segunda de
las dos decisiones del bloque 3.

## Los 207 folios duplicados: qué son

El sistema viejo calcula el folio con `MAX + 1` (`a_pref.php`, líneas 24 a 38), un
mecanismo que **sí permite** que dos sesiones tomen el mismo número. Pero que eso
produjera los 207 duplicados **no está demostrado**, y el dato apunta en otra dirección
(medido contra `fact-fbo-prod`): son 207 folios con 497 filas (154 con dos filas, hasta
8); **206 de los 207 tienen una sola matrícula y los 207 caen en un solo día**. El
folio 3922 tiene 8 filas, todas de una matrícula y un día. El único con dos matrículas
es el folio 1 (2 filas, el mismo día).

Eso se parece más a **re-guardados del mismo documento** que a dos operadores peleando
por el número. Puede haber algo de carrera, pero no se demostró. **Importa porque la
decisión del bloque 3 —cuál fila conserva cada folio— depende de entender qué son**: si
son re-guardados, probablemente la última versión es la vigente y las demás son
historia; si fueran documentos distintos con el mismo número, no se puede descartar
ninguno. Esto último es una hipótesis, no una recomendación.

## Las tres lecturas del FLOAT

Explican las diferencias de centavos **en los renglones y en el desglose de «exactas»**,
y el comando las documenta en su cabecera. **No explican las diferencias del total** (ver
«El total que no sale de subtotal + IVA»):

1. **`precio_u` e `iva` son `FLOAT` (precisión simple) en el origen.** Un precio como
   8114.15 no existe en float32: se guarda como 8114.150390625. Toda comparación de
   dinero contra ese dato arrastra ruido de centavos.
2. **SQL y PDO decodifican el mismo float32 de manera distinta.** Midiendo dentro de
   SQL, MySQL multiplica el valor binario real del float32 y salen **238 renglones** que
   no cuadran; por PDO el valor llega como el texto más corto («8114.15») y PHP lo vuelve
   double, y salen **188**. Los 156 renglones por más de 2 centavos salen igual en las dos
   lecturas; los 50 de diferencia (238 − 188) y tres prefacturas que cambian de clase
   entre «idéntica» y «redondeo» son ruido puro del float32. El comando usa la lectura de
   PDO, que es la que corresponde a lo que el sistema nuevo hace con el dato (el precio tal
   como se ve).
3. **MySQL entrega un `FLOAT` por texto con unos 6 dígitos significativos.** El IVA real
   46316.8984375 llega como «46316.9». Para IVA de cinco cifras eso mete hasta 5 centavos
   de error de **lectura** en ese IVA. Leyendo el IVA dentro de SQL con `iva + 0e0` (lectura
   binaria completa) salen las mismas clases (3,451 / 43 / 0) y 3,099 exactas en vez de
   3,077: las clases no cambian, solo el desglose de exactas. **Por lo tanto este efecto
   no explica ni los 43 de redondeo del IVA ni los 441 del total**; moverlos a otra clase
   exigiría un cambio que la lectura completa no produjo.

## Lo que queda para el bloque 3

- **Pagos**: 3,534 filas en el origen.
- **Notas**: 215.
- **Impresión** de la prefactura cerrada.
- **Corregir una prefactura cerrada.** Hoy una cerrada no se edita ni se descarta, y no
  hay camino para corregirla; el endpoint lo dice (409 `ya_cerrada`).
- **La importación del histórico.** Sigue siendo **parcial mientras pagos y notas no
  tengan tabla**: importar prefacturas sin sus pagos dejaría saldos que no se pueden
  calcular. Y arrastra **dos decisiones** que hay que tomar antes:
  - qué hacer con los **207 folios duplicados** (497 filas): hoy el comando los excluye
    porque no se pueden comparar; una importación tiene que decidir cuál conserva cada
    folio, y para eso hay que entender primero qué son (ver «Los 207 folios duplicados:
    qué son»: el dato sugiere re-guardados, no una carrera de numeración);
  - qué hacer con las **estructurales** (171 en el subtotal, ver arriba), con los 86
    renglones sin encabezado y con los totales que no salen de subtotal + IVA:
    importarlos tal cual trae al sistema nuevo documentos cuyo total no corresponde a
    su detalle, y el sello de una cerrada impide corregirlos después.

**El usuario pidió aviso explícito cuando eso sea posible**: cuando pagos y notas ya
tengan tabla y la importación del histórico deje de ser parcial, hay que decirlo en voz
alta en lugar de esperar a que alguien pregunte.

## La deuda que este bloque NO retira

Del propio bloque 2:

- **`CierrePrefactura::cerrar()` no rechaza prefacturas descartadas.** La guarda del
  folio vive solo en HTTP (`rechazarSiDescartada()` en el controlador, bajo candado), a
  diferencia del invariante de «cerrada», que vive en el modelo y el servicio. Cualquier
  llamador futuro (el bloque 3, un importador) que invoque `cerrar()` directamente podría
  cerrar un borrador descartado y consumir un folio para un documento que nadie ve.
- **No hay restricción única sobre `fact_prefacturas.operacion_llegada_id`**, ni
  comprobación en el Form Request: dos operadores pueden crear dos borradores sobre la
  **misma llegada** a la vez. El filtro «llegadas sin facturar» solo protege a quien
  consulta después de que el primero guardó.
- **Reabrir una cerrada no está protegido en el modelo.** `FactPrefactura` no tiene
  guarda sobre el cambio de `estado`; las defensas son las de los endpoints y la guarda
  de renglones del modelo `FactPrefacturaRenglon`. Un `update` directo (tinker, un
  llamador futuro) podría devolver una cerrada a borrador, con su folio y su sello puestos.
- Menores del bloque que quedaron fuera a propósito: el total del cuadro de confirmación
  del cierre puede estar desactualizado si otro operador cambió renglones (el servidor
  sella lo que tiene, no lo que decía el cuadro); el aviso de estancia sobrevive a
  acciones posteriores; crear un borrador antes de que cargue la consulta de llegadas
  pierde el vínculo sin avisar; sin probar `salida_at` con `llegada_at` ausente en la
  regla `after_or_equal`; y la insensibilidad a mayúsculas de la matrícula depende de la
  collation de MySQL.
- **Sin pruebas de interfaz**: las dos pantallas nuevas se verifican con `tsc`, `eslint` y
  el build, igual que las del bloque anterior. Conviene abrirlas a mano tras desplegar:
  crear un borrador, agregar un renglón, recalcular estancia, marcar internacional,
  cerrar, y una cerrada en solo lectura.

Heredada del 1b y **no retirada** (los controladores de los catálogos del 1b no se
tocaron):

- **El 500 en lugar de 422** de dos altas simultáneas del mismo nombre en categorías de
  servicio, formas de pago y proveedores, y su **bitácora fuera de transacción** (los
  `Bitacora::log` de los controladores del 1b se escriben fuera de ella). La bitácora del
  bloque 2 sí va dentro de la transacción.
- **El comando se sigue llamando `facturacion:importar-matriculas`** aunque importe cinco
  catálogos que no son matrículas. Renombrarlo rompería esta guía y la del 1b.
- **Los hallazgos menores del 1b que siguen abiertos**: la lista completa está en la
  sección «Hallazgos menores que se dejaron fuera a propósito» de la guía del 1b. Lo
  que el bloque 2 resolvió de ella es solo la columna `concepto` del combustible; la
  unificación de patrones de bitácora, las pruebas que no prueban lo que su título
  promete y los pendientes de frontend siguen como estaban.

## Nota de entorno

`php artisan test --parallel` produce falsos fallos en la máquina de desarrollo actual
(ver la guía del 1b). **La suite se corre en serie.** Al cierre de este bloque son **749
pruebas** en verde.
