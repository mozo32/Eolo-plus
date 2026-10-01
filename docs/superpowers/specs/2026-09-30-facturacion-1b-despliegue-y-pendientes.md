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
# Bloque 2 sobre una base que ya tenía el 1b: la migración deja `concepto` en NULL
# y hay que asignarlo (sección «Precio del combustible»: reimportar PISA precios;
# hay un UPDATE dirigido que no los toca). Si 1b y 2 van juntos, no hace falta.

# 1. Simulación del importador: lee fact-fbo, escribe y revierte.
#    LEER ENTERA la salida: la lista de tablas que --forzar va a pisar, los
#    hallazgos esperados y que no haya "nombre repetido" (ver abajo).
#    GUARDAR LA SALIDA: el comando NO escribe ningún log en archivo (la
#    especificación prometía storage/logs/facturacion-importacion-AAAA-MM-DD.log,
#    pero no existe: todo va a consola) y el paso 3 necesita leer los conteos.
php artisan facturacion:importar-matriculas | tee storage/logs/facturacion-importacion-$(date +%F).log

# 2. Aplicar. Si el 1a ya está en uso, fact_aeronaves tiene filas y el comando
#    se negará sin --forzar. LEER "Qué pisa --forzar" antes de agregarlo.
php artisan facturacion:importar-matriculas --aplicar --forzar | tee -a storage/logs/facturacion-importacion-$(date +%F).log

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
| `fact_servicios` | nombre, concepto, marca de paquete internacional, categoría, precio, margen y ajuste de precio |

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

La simulación ya no dirá "Sin hallazgos". De los cinco catálogos salen
**exactamente cinco** hallazgos, todos esperados. Estos son los renglones
literales, en el orden en que el comando los imprime (comprobados corriendo la
simulación contra `fact-fbo-prod`):

```
Cliente sin nombre en tb_clientes (id 28): no se importa.
Categoría de servicio con espacios raros en tb_categoria_serv (id 3): 'Combustible & Servicios ' se importa como 'Combustible & Servicios'.
Servicio con espacios raros en tb_servicio (id 15): 'Basura Internacional by SENASICA ' se importa como 'Basura Internacional by SENASICA'.
Servicio con espacios raros en tb_servicio (id 37): 'Despacho de Vuelos Internacionales ' se importa como 'Despacho de Vuelos Internacionales'.
Proveedor con espacios raros en tb_proveedor (id 4): 'ARTURO<NBSP>GARDUÑO' se importa como 'ARTURO GARDUÑO'.
```

- **Cliente id 28** tiene nombre, RFC, correo y teléfono **todos vacíos**: es una
  fila fantasma del origen. El importador la omite, porque el nombre es su llave de
  idempotencia. Por eso `tb_clientes` tiene 195 filas y el reporte cuenta
  **194 clientes**: no es una fusión silenciosa (ver el paso obligatorio de abajo).
- **Categoría de servicio id 3** y **servicios id 15 y id 37** traen un espacio al
  final; se importan sin él.
- **Proveedor id 4** trae un espacio duro (U+00A0) en lugar de un espacio normal.
  El reporte lo imprime literalmente como `<NBSP>`; se importa con espacio normal.

Nadie debe "arreglar" esto en el origen: es el importador haciendo su trabajo.

**Una versión anterior de esta guía decía "al menos dos" y listaba dos.** El error
venía de medir las filas sucias con `servicio <> TRIM(servicio)`: la collation de
MySQL es **PAD SPACE**, así que `'X '` y `'X'` son iguales en una comparación y esa
consulta siempre devuelve 0. Para buscar espacios sobrantes hay que comparar
longitudes, nunca `TRIM`:

```sql
SELECT id_servicio, CONCAT('[', servicio, ']')
FROM tb_servicio
WHERE CHAR_LENGTH(servicio) <> CHAR_LENGTH(TRIM(servicio))
   OR HEX(servicio) LIKE '%C2A0%';   -- U+00A0 en utf8
```

**Un sexto renglón puede aparecer, y solo en una segunda corrida:** el de la
corrección del precio del servicio de combustible.

```
El precio del servicio 'Combustible JET A-1' se corrigió de 26.0640 a <vigente>: el origen traía 26.0640, pero el precio Eolo vigente en Eolo-plus es <vigente> y el precio de ese servicio debe seguirlo. Se conserva el vigente, no el del origen.
```

Sale cuando ya se capturó un precio de combustible desde la pantalla después del
primer import: `importarServicios()` escribe el precio del origen en todos los
servicios, incluido ese, y el importador lo devuelve al precio vigente al final de
la corrida. **Es lo correcto y hay que dejarlo así**: sin esa corrección la
pantalla mostraría el precio nuevo y el catálogo cobraría el viejo. Queda en la
bitácora con el valor anterior. En la primera corrida no aparece, porque el valor
del origen y el vigente coinciden.

**Los hallazgos del 1a siguen apareciendo.** La guía del 1a
(`2026-09-29-facturacion-1a-despliegue-y-pendientes.md`) explica que el renglón
de la matrícula `ZZ-GFT` aparece en cada corrida mientras no se corrija el origen,
y hay más de matrículas y tarifas. Un hallazgo que no sea de esos ni de estos cinco
(seis con el del precio del combustible) sí merece revisión.

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

**Lo que el reporte y las tablas deben decir hoy**, con el volcado actual de
`fact-fbo-prod` (`COUNT(*)` del origen contra el conteo del reporte):

| Catálogo | Filas en el origen | Importables | Por qué la diferencia |
|---|---|---|---|
| clientes | 195 | **194** | el cliente id 28 no tiene nombre y se omite (lleva su propio hallazgo) |
| servicios | 54 | 54 | — |
| categorias_servicio | 13 | 13 | — |
| formas_pago | 7 | 7 | — |
| proveedores | 5 | 5 | — |

**Los 194 clientes NO son una fusión silenciosa.** Es la única diferencia esperada
entre el origen y el reporte, y viene con su hallazgo (`Cliente sin nombre en
tb_clientes (id 28)`). Lo que hay que comparar es el conteo del reporte contra el
`COUNT(*)` de `fact_clientes`, y esos dos sí deben ser **194** exactos. Cualquier
otra diferencia, o un 194 sin ese hallazgo, sí es una fusión.

Si hay diferencia, dos nombres del origen colapsaron en MySQL: revisar cuáles y
corregir el origen o decidir a mano cuál conserva el dato.

## Precio del combustible

El servicio de combustible (`Combustible JET A-1`) es el único cuyo precio sigue
al del combustible. El sistema viejo lo apunta por id fijo (`id_servicio = 7`).

> **Actualización del bloque 2.** Este apartado describía un vínculo por **nombre**
> (`FactPrecioCombustible::SERVICIO_COMBUSTIBLE`) sostenido por dos guardas de
> validación. Eso ya no existe: el vínculo es la columna `fact_servicios.concepto`
> (valor `combustible`, única), y la sincronía busca con
> `FactServicio::porConcepto(FactServicio::CONCEPTO_COMBUSTIBLE)`. Las guardas de
> `StoreServicioRequest` / `UpdateServicioRequest` se retiraron junto con sus 16
> pruebas (`NombreServicioCombustibleTest`).
>
> **Renombrar ya no rompe la sincronía del precio, pero tampoco se conserva.** El
> importador identifica estas filas por su concepto y, en cada corrida, les
> devuelve el nombre del origen. Un renombre hecho en pantalla aguanta hasta el
> siguiente `--forzar`.
>
> ### Obligatorio al desplegar el bloque 2 sobre una base que ya tenía el 1b
>
> La migración agrega `concepto` y `en_paquete_internacional`, y deja **`concepto`
> en NULL y la marca en 0 en las filas ya importadas**. Mientras sea así:
>
> - **la sincronía del precio de combustible no encuentra ningún servicio y no
>   actualiza nada**, sin error ni rastro;
> - los cargos de estancia (Tasks 4 y 5) no encuentran sus tres servicios y el
>   paquete internacional no agrega nada.
>
> **Este paso solo hace falta si el bloque 1b ya estaba aplicado.** Si el 1b y el 2
> se despliegan juntos, la primera `--aplicar` ya asigna los conceptos y las marcas
> y no hay nada que hacer.
>
> Hay dos caminos. **Elegir uno antes de correr nada:**
>
> **A. Volver a correr el importador (pisa precios).**
> `php artisan facturacion:importar-matriculas --aplicar --forzar`. El `--forzar`
> **no es opcional**: `fact_servicios` ya tiene filas y el comando se niega sin él.
> Y **`--forzar` reescribe nombre, concepto, marca de paquete, categoría, precio,
> margen y ajuste de TODOS los servicios desde el origen**: un precio que alguien
> corrigió a mano en la pantalla de servicios **vuelve al del sistema viejo y eso
> cambia cobros**. Leer antes la tabla de «Qué pisa `--forzar`» (arriba) y la
> lista que imprime la simulación. Solo es sensato si nadie ha editado servicios
> desde la importación.
>
> **B. Asignar solo los siete a mano (no toca ningún precio).** Es la vía para una
> base en producción con precios editados. Pegar tal cual en MySQL; cada `UPDATE`
> solo toca filas que aún no tienen concepto:
>
> ```sql
> UPDATE fact_servicios SET concepto = 'combustible'           WHERE concepto IS NULL AND nombre = 'Combustible JET A-1';
> UPDATE fact_servicios SET concepto = 'estancia_transito_2h'  WHERE concepto IS NULL AND nombre = 'Tránsito 02 hrs';
> UPDATE fact_servicios SET concepto = 'estancia_transito_12h' WHERE concepto IS NULL AND nombre = 'Tránsito 12 hrs';
> UPDATE fact_servicios SET concepto = 'estancia_pernocta'     WHERE concepto IS NULL AND nombre = 'Tránsito 24 hrs - pernocta';
>
> UPDATE fact_servicios SET en_paquete_internacional = 1
>  WHERE nombre IN ('DSMES - salida', 'DSM - salida', 'Mex-eAPI - salida', 'Servicios Internacionales - salida');
> ```
>
> Los ids de `fact_servicios` **no** son los ids del sistema viejo (se asignan al
> importar), por eso se filtra por nombre; la comparación de MySQL ignora la caja y
> los acentos. Si alguno de los nombres se corrigió a mano, el `UPDATE` no afecta
> ninguna fila: la verificación de abajo lo delata. En ese caso usar
> `WHERE id = <id>` con el id que dé `SELECT id, nombre FROM fact_servicios`.
>
> ### Verificación (cubre los siete, haya sido A o B)
>
> ```sql
> SELECT concepto, nombre FROM fact_servicios WHERE concepto IS NOT NULL;      -- 4 filas
> SELECT COUNT(*) FROM fact_servicios WHERE en_paquete_internacional = 1;       -- 4
> ```
>
> Deben salir **cuatro** filas con los conceptos `combustible`, `estancia_pernocta`,
> `estancia_transito_2h` y `estancia_transito_12h`, y **cuatro** marcas. Si falta
> alguno, los cargos de estancia fallan y el paquete internacional no agrega nada.
>
> El importador casa los servicios con concepto **por su concepto** y los demás por
> nombre, así que reimportar tras renombrar el combustible no choca con el índice
> único. Si coexisten la fila con concepto renombrada y otra sin concepto con el
> nombre del origen, la corrida lo reporta como hallazgo (los dos ids) en lugar de
> dejar dos filas iguales en silencio.

- La sincronía solo toca el servicio **activo**. Dado de baja, o inexistente,
  registrar un precio nuevo funciona igual y no cambia nada en servicios. **Ojo con
  la reactivación**: mientras está de baja, cada precio que se registre lo deja
  atrás y **no queda ningún rastro en la bitácora** de que se lo saltó, así que al
  reactivarlo aparece con el precio que tenía antes de la baja, no con el vigente.
  Si se reactiva, hay que registrar un precio (o corregirle el precio a mano) para
  volver a alinearlo.
- **La importación también restablece el invariante**, al final de la corrida: si el
  origen trae un precio distinto del vigente, el importador deja el del vigente y
  lo dice en un hallazgo (ver "Lo que la corrida real va a producir").
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
2. **La sincronía busca por `concepto`** (bloque 2), ya no por nombre: no depende
   de la collation. Vale confirmar en MySQL, tras volver a correr el importador,
   que registrar un precio actualiza el servicio.
3. **Transacción del importador**: sigue siendo una sola transacción, ahora con
   más tablas. La guía del 1a pide medir cuánto tarda; repetir la medición con
   los cinco catálogos incluidos.

## Deuda conocida

- **Pantallas sin pruebas automáticas**: las ocho pantallas de catálogos (cuatro
  del 1a, cuatro del 1b) se verifican solo con `tsc`, `eslint` y el build.
- La deuda de `routes/api.php` (rutas preexistentes sin autenticación) descrita
  en la guía del 1a sigue abierta.
- **No hay log en archivo.** La especificación prometía
  `storage/logs/facturacion-importacion-AAAA-MM-DD.log` y no se implementó: la
  única salida del importador es la consola. Mientras no exista, hay que redirigir
  la salida a mano (`| tee ...`, ya está en el orden de despliegue), porque el paso
  obligatorio de los conteos exige volver a leerla.
- **El cliente id 241 queda con un correo que su propia validación rechaza.**
  `AEROTRANSPORTES INTERNACIONALES DE TORREON SA DE CV` trae `correo = '.'` en el
  origen; el importador lo guarda tal cual (solo convierte la cadena vacía en NULL),
  y `StoreClienteRequest` pide `email`. Consecuencia: **cualquier edición de ese
  cliente responderá 422** aunque solo se le cambie el teléfono, hasta que se le
  corrija el correo (o se le ponga vacío) en la pantalla. Es una sola fila y el
  mensaje dice qué pasa ("El correo no tiene un formato válido."), pero hay que
  saberlo para no buscar un fallo donde no hay.
  Los otros cuatro correos raros del origen (ids 250, 261, 287 y 288, sin punto en
  el dominio) **sí pasan** la regla `email` de Laravel, que no consulta DNS. Solo el
  241 molesta.
- **Divergencia con la especificación, a propósito: los clientes duplicados se
  reportan por NOMBRE, no por RFC.** La spec hablaba de deduplicar por RFC; sería
  destructivo, porque 22 clientes sin relación entre sí comparten `XAXX010101000`
  (público en general) y otros 5 `XEXX010101000`. La llave de idempotencia es el
  nombre y el hallazgo de repetidos también.
- **Divergencia con la especificación, a propósito: la validación de "servicios con
  id > 93 marcados como propios" no existe porque es vacía por construcción.** El
  importador **deriva** `es_de_tercero` de ese mismo id (`$idViejo >
  ULTIMO_SERVICIO_PROPIO`), así que la comprobación no podría fallar nunca: se
  estaría comparando el dato consigo mismo.

## Hallazgos menores que se dejaron fuera a propósito

Las siete tasks y la revisión final de la rama adjudicaron estos hallazgos y
decidieron no arreglarlos ahora. **Ninguno toca un cobro ni un permiso.** Se
anotan aquí porque son la mejor lista de arranque del bloque 2, y porque el
registro de ejecución donde vivían no se versiona.

### Para unificar en el bloque 2

- **Dos patrones de bitácora en la misma rama.** `FactPrecioCombustible::registrar()`
  escribe su bitácora **dentro** de la transacción, con prueba de atomicidad; los 30
  `Bitacora::log` de los nueve controladores la escriben **fuera** y sin transacción,
  así que un fallo después del `UPDATE` dejaría la fila escrita sin rastro. La
  escritura más importante del bloque es atómica con su rastro y las demás no.
  Unificar hacia el patrón de `registrar()`.
- **Dos altas simultáneas del mismo nombre dan 500 en lugar de 422.** Las dos pasan
  la validación y la segunda revienta contra el índice único. Solo alcanza a
  categorías de servicio, formas de pago y proveedores (los tres con `nombre`
  único), exige dos POST en la misma ventana de milisegundos sobre catálogos de 13,
  7 y 5 filas, y la consecuencia es ruido: el reintento da el 422 correcto y ningún
  dato se pierde. Arreglarlo bien son cinco controladores, incluidos dos del 1a.
- ~~Identificar el servicio de combustible con una columna propia~~ **Resuelto en el
  bloque 2** (columna `concepto`). Sigue siendo cierto que el invariante «el precio
  del servicio es el precio Eolo vigente» depende de que la sincronía corra, no de
  una restricción de la base: si una ruta nueva escribe `fact_servicios.precio_unitario`
  en masa, el hueco se reabre.
- **`FactServicio::importe()` no tiene ningún llamador en producción todavía.** Hoy
  solo lo ejercitan las pruebas, así que ninguna imprecisión de redondeo puede
  llegar a una factura antes del bloque 2 — que es cuando además hará falta un
  `precioUnitarioFinal()` que hoy no existe.
- **Cinco modelos del módulo repiten las mismas constantes de estatus, `$fillable`
  y scope `activos()`.** Un trait los uniría.

### Rastro de la sincronía del importador

- La bitácora de la corrección dice «pasó de 26.0640 a 28.1750» aunque el valor
  previo a la corrida ya era 28.1750: `importarServicios` lo pisó antes, dentro de
  la misma transacción. El rastro describe la secuencia real pero **sobre-reporta el
  cambio neto**, y se repite en cada `--forzar`.
- Ese rastro se atribuye al **usuario de menor id**, no a quien corrió el comando.
  Es la misma convención que ya usaba `importarCombustible`.

### Pruebas que no prueban lo que su título promete

Se dejaron con la limitación escrita en un comentario, en lugar de borrarlas o de
fingir que cubren más:

- Las de «el ajuste va antes del margen» **no pueden distinguir el orden**, porque
  ajuste, margen y cantidad son todos multiplicativos y conmutan (verificado sobre
  200 mil precios: el importe es idéntico invertido).
- Las de longitud y de collation **no las puede hacer cumplir sqlite**, que ignora
  `varchar(N)` y compara texto en binario. La garantía real es el modo estricto de
  MySQL más la collation de las columnas.
- La de «desactivar y reactivar es atómico» hace peticiones secuenciales: prueba el
  409 y la transición, no la atomicidad, que no se puede demostrar en un proceso
  sqlite sin concurrencia real.
- La de idempotencia del importador **no distinguiría un `updateOrCreate` con los
  mismos valores**, porque Eloquent no ejecuta UPDATE sobre un modelo limpio y
  `updated_at` no se movería.
- Ninguna prueba fija el `->index()` del RFC ni el desempate por `id` de la
  paginación de clientes: quitarlos no rompería nada.

### Frontend

- La pila de Escape de `ModalBase` depende de la identidad de los callbacks. En el
  caso apilado los dos modales se re-registran en el mismo commit y en orden de
  árbol, así que hoy funciona; no se encontró ningún camino de fallo. Además
  `splice(indexOf(yo), 1)` borraría el último elemento si `yo` no estuviera en la
  pila, y la guarda cuesta una línea.
- El texto del estado vacío de Clientes diría «Aún no hay clientes» cuando todos
  estuvieran de baja, porque la pantalla abre en «activas» y ese es el filtro vacío.
- **El apilado de modales y la búsqueda con espera no se probaron en navegador.**

### Otros

- No se escapan `%` ni `_` en el parámetro de búsqueda `q`, igual que en la pantalla
  de aeronaves del 1a: un `%` tecleado actúa como comodín. Sin riesgo de inyección
  (el valor va enlazado). Si molesta, se corrige en los dos controladores a la vez
  con una cláusula `ESCAPE` explícita.
- `q` llegando como arreglo (`?q[]=x`) pasaría `filled` y el `(string)` daría 500.
  Mismo patrón exacto en el controlador de aeronaves del 1a.
- El respaldo de `llaveCatalogo` cuando el ASCII queda vacío solo pliega caja, así
  que un par de nombres cirílicos que difieran solo en acento contaría dos veces
  aunque MySQL deje una fila. No ocurre con nombres en español.
- **El comando se sigue llamando `facturacion:importar-matriculas`** aunque ya
  importe cinco catálogos que no son matrículas. Renombrarlo rompería esta guía.
- **La conexión legada de solo lectura que pedía la especificación no existe.** El
  importador usa `remota`, que en los entornos actuales es `root`. Ningún
  controlador ni modelo la usa (hay una prueba que falla si alguien la
  reintroduce), pero la nota de seguridad de la spec —crear un usuario de solo
  lectura y rotar credenciales— sigue pendiente.

## Nota de entorno

`php artisan test --parallel` produce **22 fallos falsos** en la máquina de
desarrollo actual, también en la rama sin tocar y en pruebas ajenas a facturación
(`ControlMedicamento`). **La suite se corre en serie.** Si se monta integración
continua con `--parallel`, va a desconfiar de la suite sin motivo.
