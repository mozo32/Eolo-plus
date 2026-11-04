# Menores aparcados — para la revisión final de rama

Veinticuatro hallazgos menores que se dejaron a propósito durante las diez
tareas, agrupados por tema. Cada uno lleva por qué se aparcó. La revisión
final decide cuáles bloquean la fusión.

**Lo que NO está aquí:** los hallazgos Critical e Important, que se
arreglaron todos en su tarea, y los defectos del plan, que se corrigieron
en el plan y en la spec. Esto es solo lo diferido.

---

## A. Endurecimiento de validación — agrupados a propósito

Se juntaron para arreglarlos en **una sola ola** y que las reglas no
queden distintas entre sí. Es el grupo con más razón para entrar antes de
la fusión.

1. **La regex de las firmas cierra con `$`**, que en PHP sin el
   modificador `D` también acepta un salto de línea final. Y el `{16,}`
   admite un cuerpo de solo `=`, que decodifica a vacío. Ninguno es
   explotable —lo peor es un archivo de cero bytes— pero el apriete es
   `[A-Za-z0-9+/]{16,}={0,2}\z`. Afecta a **los dos** Form Request, de
   alta y de edición: se aprietan juntos o quedan desalineados.
2. **El query string del `index` no se valida.** Un `?search[]=x` llega
   como arreglo a `->string()` y revienta con 500 en vez de 422. Y `%` y
   `_` en `search` funcionan como comodines de `LIKE`. Falta el Form
   Request que el CLAUDE.md del proyecto pide. Sin consecuencia de
   seguridad: todo va con bindings.

## B. Limpieza del controlador

El controlador acumuló las cinco tareas del servidor. El revisor de la
Tarea 5 propuso, y se aplazó a propósito porque las cinco tareas
siguientes eran de navegador y no lo tocaban:

3. Un scope `sinFirmaFbo()` en el modelo, para que el controlador deje de
   conocer el nombre de la tabla pivote.
4. Un recurso o un método del modelo para el mapeo a
   `{id, nombre, hora, firmado_fbo, pernocta_mensual, extras}`.
5. La lógica de firmas (`guardarFirmaBase64`,
   `guardarFirmaArchivoBase64`, `humanizeRol`) a un servicio.
6. **El nombre de tabla `firmables.` va escrito a mano** en dos
   consultas. Funciona porque es la tabla pivote del `morphToMany`, pero
   se rompería en silencio si la relación cambiara. Lo cierra el scope
   del punto 3.

## C. Escala y límites

7. **`pendientes` no tiene paginación ni límite.** Una cola sin firmar de
   meses crece sin tope. No se tocó porque cambiaría la forma de la API y
   la Tarea 10 tendría que manejarla; conviene decidirlo con la pantalla
   ya hecha y con datos reales.
8. **`diasIncompletos` hace una ida aparte a la base** en vez de una
   subconsulta. Con volúmenes de seguridad es holgado.

## D. Consistencia de las respuestas

9. **Un 422 llega antes que un 403 o un 404** en editar y en eliminar,
   porque el Form Request corre antes que el controlador. Así que un
   `empleado` con datos inválidos lee «dato inválido» donde esperaba «no
   tienes permiso», y un relevo ya borrado con fecha vieja lee «fecha
   fuera de ventana» en vez de «no existe». No hay escritura ni fuga: es
   un orden de respuestas. Moverlo a `authorize()` partiría la misma
   decisión entre dos sitios, porque `eliminar` no tiene Form Request.
10. **Un 200 con cuerpo que no es JSON** vuelve como `{}` y `leerJson` lo
    da por éxito, así que el consumidor leería `data` indefinido. Ya
    existía antes de los arreglos y el servidor siempre manda JSON.

## E. Pruebas

11. **`firmasAll()` no lleva `withTimestamps()` y `firmas()` sí**, así que
    un `attach` por ahí deja el pivote sin fechas. Hoy solo las pruebas
    atachan por ese camino; en producción se usa `firmas()`. CSAE tiene
    el mismo desnivel, así que arreglarlo solo aquí dejaría los dos
    hermanos distintos sin que nadie sepa por qué.
12. **La prueba del desempate de la cola discrimina en sqlite** porque sin
    el `orderBy('id')` devolvió `[2,1]`. En un motor que por casualidad
    devuelva por id al empatar, pasaría sin el desempate. **Producción es
    MySQL**, así que esa prueba protege menos allá que aquí. El
    comportamiento es correcto en los dos; lo que varía es la vigilancia.
13. **El borde inferior del rango de fechas no discrimina.** Comparado
    como cadena, un datetime de medianoche sí es mayor que la fecha, así
    que `where` y `whereDate` se comportan igual ahí. El único borde que
    distingue es el superior, y ése sí está cubierto. La prueba vale, pero
    su nombre promete dos bordes y vigila uno.
14. **Sin pruebas de `PERNOCTA_ESTADOS`, de `usuario()` ni del cast de
    `fecha_hora`.** Cobertura opcional.
15. **Los ayudantes de Pest `pendientes` y `relevoEn` son genéricos** y
    globales de toda la suite. Hoy no chocan —comprobado con dos
    patrones—, pero un homónimo futuro en otra carpeta daría el fatal por
    redeclaración que el sufijo de `usuarioFboDePendientes` existe para
    evitar.
16. **Tres pruebas del listado quedaron al final del archivo** y no junto
    a sus hermanas. Estético.
17. **El nombre de la prueba del dataset de firmas promete solo SVG** y
    cubre también `text/html`. Cosmético.
18. **La corrección del `whereIn` frente al rango no tiene prueba y no
    puede tenerla:** misma salida, distinto coste. Queda el docblock.

## F. Cosméticos y tipos

19. **Dos bloques de comentario no son PHPDoc** —en la migración y dentro
    de `index()`—, contra la guía del proyecto. Los mandaba así el plan y
    el contenido los justifica.
20. **`FirmaRelevo.rol` es `string`** y no una unión de los dos roles. No
    miente, y las pantallas comparan contra las constantes.
21. **`horaAhora` está duplicada** con
    `pages/despacho/operacionesProgramadas/types.ts:94`. Su sitio sería
    `lib/`, junto a `fechaHoy`, pero mudarla obliga a tocar un módulo
    ajeno a este trabajo.
22. **Los modales no cierran con Escape ni llevan `role="dialog"»**, igual
    que el resto de los modales del proyecto. Cambiarlo solo aquí los
    dejaría distintos.
23. **Los filtros de sección y estado no alinean uno a uno con sus
    columnas**, porque cada fila es un día completo y esos filtros no son
    de columna. Es una rareza visual real y **solo se juzga mirando la
    pantalla**.
24. **`setPagina(1)` iba dentro del updater de `setBusqueda`** — ya
    corregido en la Tarea 10. Se deja anotado por si quedó rastro.

---

## Limitación conocida — decisión del usuario, no un defecto

**Los registros extra de una sección no se pueden editar ni eliminar
desde la pantalla.** Si alguien registra dos relevos del mismo puesto el
mismo día —raro por construcción, pero el sistema lo permite a
propósito—, la fila enseña el más reciente y dice cuántos hay, pero el
más viejo queda inalcanzable.

La spec prometía que el selector los listaría y el diseño no lo permite:
el renglón del listado lleva un solo id por sección. Cerrarlo pediría que
la API devolviera los ids de los extras, más tipos, selector y pruebas.
La spec ya está corregida y la limitación documentada.

---

## Fuera del alcance de esta rama — ya hay tarea abierta

Dos defectos preexistentes del proyecto que esta rama **no** introdujo,
descubiertos al endurecer este módulo. Cada uno tiene su chip:

- **XSS almacenado por SVG en las firmas de otros siete módulos.**
  `MovimientoCSAEController` y compañía validan las firmas con
  `sometimes|nullable|string` y sacan la extensión partiendo el mime, así
  que un `data:image/svg+xml` se guarda en el disco público con extensión
  `.svg+xml` y ejecuta su script al abrirlo. Este módulo quedó cerrado;
  los otros no.
- **El borrado por GET en toda la API.** `GET /api/<Modulo>/eliminar/{id}`
  muta estado sin protección CSRF. Mitigado a medias porque las cookies
  van en `same_site=lax`, así que un `<img>` no lleva la sesión y el
  ataque exige que la víctima pulse un enlace. Es la convención del
  proyecto en al menos siete módulos, así que desviarse solo aquí dejaría
  la API incoherente sin cerrar el agujero.

---

## Añadido al cerrar la Tarea 10

25. **La prueba del contrato escribe a mano los tres estados de la pernocta**
    en vez de usar `EntregaTurnoSeguridad::PERNOCTA_ESTADOS`, que **sí**
    existe (`EntregaTurnoSeguridad.php:37`) y que usan los dos Form Request
    en su `Rule::in`. El implementador afirmó que no existía; se verificó
    que sí. Si alguien agregara un cuarto estado, la validación lo
    aceptaría y la lista de la prueba no, así que la prueba fallaría sin que
    nada estuviera roto. Una línea.

## Añadidos por la re-revisión de la ola final

26. **`PayloadRelevoNuevo` hereda `firma_fbo?` de `PayloadRelevo`**, así que
    `tsc` no atraparía a quien vuelva a meter ese campo en el payload de
    alta —el defecto que la ola final acaba de cerrar. Lo que de verdad fija
    la decisión es la prueba de servidor, que es la red más fuerte; un
    `Omit<PayloadRelevo, 'firma_fbo'>` lo cerraría también del lado del tipo.
27. **`IndexEntregaTurnoSeguridadRequest` repite los literales
    `'falta_fbo'` y `'completas'`**, que el controlador vuelve a escribir en
    su filtro. Sin constante compartida, un renombre puede separarlos. Es
    simétrico a lo que el punto 25 resolvió para `PERNOCTA_ESTADOS`.
28. **`MenuDelModuloTest` re-deriva el slug de un literal** en vez de leerlo
    del valor que el seeder guardó o del `route` que publica el servidor, así
    que es más una prueba de `Str::slug` que del contrato. Una versión más
    fuerte y todavía en PHP: una petición Inertia como usuario no-admin
    asignado al subdepartamento, afirmando que
    `auth.user.departamentos[0].subdepartamentos[0].route` vale
    `'seguridad.entregaturnoseguridad'`. El renombre del seeder **sí** queda
    atrapado hoy por otra de las tres pruebas.
29. **Caveat de la collation, para tenerlo presente y no para arreglarlo
    aquí:** la collation que manda en la comparación del buscador es la de la
    **columna**, no la de la conexión. Si `eolo_plus` se hubiera construido
    desde un dump con una collation sensible a acentos, la búsqueda acentuada
    fallaría también en producción —y fallaría igual en los otros tres
    buscadores por nombre del proyecto, así que seguiría sin ser defecto de
    esta rama.
