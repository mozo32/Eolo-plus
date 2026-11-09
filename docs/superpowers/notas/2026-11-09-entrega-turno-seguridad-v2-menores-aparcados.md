# Entrega de Turno v2 — lo que quedó aparcado

**Fecha:** 2026-11-09
**Rama:** `entrega-turno-seguridad`
**Rango:** `78a7f7c..a669b46`, 17 commits
**Spec:** `docs/superpowers/specs/2026-11-09-entrega-turno-seguridad-v2-design.md`

Catorce menores salieron de las ocho revisiones por tarea. La revisión final
de rama los trió: cuatro se cerraron en la ola de arreglos, uno estaba mal
diagnosticado, y los nueve restantes esperan. Aquí están los que esperan, con
el motivo por el que no se arreglaron.

---

## 1. La carrera entre las dos firmas de cierre

Si el jefe de área y el FBO firman **a la vez**, cada transacción ve solo su
propia firma sin confirmar, ninguna de las dos congela el resumen, y el relevo
queda cerrado con `resumen` en `null`.

Hay una segunda mitad, **más probable** que la del mismo milisegundo: si una
petición carga el relevo con `resumen = null`, otra lo cierra y congela, y la
primera termina después, la primera pasa su guardia con el valor viejo en
memoria y **sobrescribe** el resumen ya congelado. Como es el mismo día, las
cifras solo crecen, así que el daño es pequeño — pero contradice el «no
recalcula lo ya congelado» que una prueba vigila.

**Coste de dejarlo:** un relevo cerrado puede servir indefinidamente un
resumen en vivo, con `congelado: false` en el detalle y la pernocta de hoy en
la tabla, hasta que alguien vuelva a escribir sobre él. No se cura solo si
nadie lo toca.

**Cómo se cierra:** mover el `find` dentro de la transacción y pedirlo con
`lockForUpdate()`. Cierra las dos mitades de una vez; cuando se arregle, que
se arreglen las dos.

**Por qué se aparcó:** pide bloqueo de fila que el plan no anticipó, por un
suceso que exige dos firmas simultáneas sobre el mismo relevo.

## 2. `whereDate` sobre columnas DATE pierde el índice

`operaciones_diarias.fecha` y `registro_visitantes.fecha_entrada`/`fecha_salida`
son DATE, pero sus modelos castean a `date` y sqlite entonces guarda
`00:00:00`, así que una igualdad directa daría cero en las pruebas. Por eso
usan `whereDate`, que da el mismo conteo en MySQL pero no aprovecha el índice
`operaciones_diarias (fecha, tipo)`.

**Por qué se aparcó:** a miles de filas no se nota, y cambiarlo pide una
medición propia. El servicio lleva un comentario que explica qué columnas son
DATE y cuáles DATETIME, para que el siguiente que pase no «unifique» y rompa
el conteo en las pruebas.

> La nota original decía que `pernocta_dia.fecha` funcionaba «por accidente»
> por no tener cast. La revisión final lo desmintió: esa columna es DATE y
> **no** tiene cast, así que su `where('fecha', ...)` es lo correcto y además
> aprovecha índice. Convertirla a `whereDate` lo empeoraría.

## 3. El orden entre el 422 de forma y el 403 de rol

Un PUT con una firma mal formada **y** del rol equivocado recibe 422, no 403,
porque el Form Request valida antes de que el controlador mire el rol. No es
un fallo de seguridad: ninguna de las dos peticiones escribe nada.

## 4. Huecos de cobertura que no mienten

Ninguno de estos es una prueba que pase por la razón equivocada; son caminos
sin prueba:

- La rama de `pernoctaDe` que devuelve 0 cuando un resumen congelado no trae
  renglón de pernocta. Es inalcanzable por construcción: el servicio siempre
  produce los seis renglones.
- La cola de pendientes con un usuario que tenga **los dos** roles de cierre,
  y el administrador cuando falta **una sola** firma.
- Una firma retirada reflejada en `falta`.
- La prueba «mandar casillas en el alta no crea columnas ni revienta» afirma
  que `resumen` es nulo, cosa que ya era cierta antes del cambio. Su
  `assertSuccessful()` sí lleva la garantía que el nombre promete.
- Las pruebas de sección afirman que el alta tiene éxito, pero no que el valor
  se guarde.
- La prueba de pernocta siembra solo el día anterior, no el siguiente, a
  diferencia del resto de su archivo.

## 5. Cosmético

- `(int) ($pernoctas[$dia] ?? 0)` se calcula dos veces por día en
  `filasDeLosDias`.
- `TablaEntregaTurno.tsx` queda en 293 líneas, bajo el tope de 300 del
  proyecto pero cerca.
- `detalle()` dispara las nueve consultas del resumen en cada lectura de un
  relevo abierto, y la vista previa pide los dos puestos, así que son 18 por
  vista previa. Es consecuencia directa del «en vivo» de la §4.
- `pendientes()` no tiene tope ni ventana de fechas, y `diasIncompletos()`
  fusiona dos consultas en un `whereIn` sin tope. A dos relevos por día son
  ~365 cadenas al año. Heredado de la primera versión.

---

## Lo que la ola de arreglos SÍ cerró

Para que no se busquen dos veces:

- Un relevo congelado ya **no puede cambiar de día** (422).
- `firma_quien_entrega` solo la puede reponer **el dueño del relevo o un
  administrador** (403 para los demás).
- Los tres guardias de rol tratan la cadena vacía como «no firmé».
- `FormEntregaTurno.tsx` perdió la aserción `as Seccion` que cegaba al
  compilador.
- `ROLES_DE_CIERRE` se borró de `types.ts`: nadie lo usaba.
- Los docblocks que decían «los dos roles» y «la cola del FBO» dicen la
  verdad.

## Decisión del usuario pendiente

El guardia de `firma_quien_entrega` lo decidí yo, en ausencia del usuario, por
el criterio de que en un documento cuyo valor son las firmas el defecto debe
ser el restrictivo, y de que la §6 de la spec no concede a nadie «firmar como
quien entrega» al editar. **Si el FBO necesita legítimamente rehacer una firma
emborronada ajena, hay que relajarlo.**

Efecto lateral que conviene conocer: el dueño de un relevo necesita además rol
de editor (`fbo`, `jefe_area` o `admin`) para reponer su propia firma, porque
el primer guardia de `update()` filtra antes. Un usuario común que creó su
relevo no puede editarlo — comportamiento anterior a esta rama.
