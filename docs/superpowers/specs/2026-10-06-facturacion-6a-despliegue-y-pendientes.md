# Bloque 6a — Despliegue y pendientes

**Fecha:** 2026-10-06
**Rama:** `facturacion` (33 commits sobre `7bebe0f`)
**Especificación:** `2026-10-06-facturacion-6a-corregir-cerrada-design.md`
**Plan:** `../plans/2026-10-06-facturacion-6a-corregir-cerrada.md`
**Estado de la suite al cerrar:** 1154 pruebas, 0 fallos, en serie
**Revisión final:** `listo para que el departamento lo pruebe con datos reales`

## 1. Qué añade este bloque

Hasta ahora una prefactura cerrada era inmutable: un documento emitido no se tocaba. Ahora se
puede **corregir**.

- **Reabrir** una cerrada la vuelve editable **conservando su folio**. Lo hace un permiso
  propio, `factReabrirPrefactura`, distinto del de capturar.
- Antes de abrir nada se guarda el **documento que ya se imprimió** como una versión, completo,
  en `fact_prefactura_versiones`.
- Mientras está reabierta **no se imprime de ninguna forma** —ni documento ni cotización— y
  **no se descarta**.
- Al volver a cerrarla **se vuelve a sellar y conserva el folio**: el contador no avanza.
- El papel corregido dice **«Corregida — sustituye a la versión del …»**, y una versión
  sustituida se puede **reimprimir** marcada como **NO VIGENTE**.

## 2. La secuencia de despliegue

```bash
# 1. Una migración nueva. Aditiva: crea `fact_prefactura_versiones` y no toca nada existente.
php artisan migrate

# 2. El seeder de subdepartamentos, OTRA VEZ: ahora tiene diez entradas y la nueva es
#    `factReabrirPrefactura`. Es idempotente (`firstOrCreate`), así que repetirlo no duplica nada.
php artisan db:seed --class=FacturacionSubdepartamentosSeeder

# 3. El frontend. Hay pantalla nueva (botón, modal, avisos, lista de versiones, insignia).
npm ci && npm run build

# 4. Cachés.
php artisan optimize:clear
```

**No hay importador que correr en este bloque**, y no se toca ningún catálogo.

### El paso que se olvida, y qué pasa si se olvida

El del **seeder**. Sin él, el subdepartamento `factReabrirPrefactura` no existe, nadie lo tiene,
y **el botón REABRIR no aparece para nadie** — ni siquiera para quien debería tenerlo. El
síntoma es exactamente el de «esto no se entregó».

**Medido el 2026-10-06 en la base de desarrollo `eolo_plus`:** no existe el departamento
Facturación **ni ninguno** de los diez subdepartamentos `fact*` (5 departamentos y 28
subdepartamentos, ninguno de facturación). Ese seeder **nunca se ha corrido ahí**. Las guías de
los bloques 1a, 1b y 2 ya lo mandan; no es un hueco de documentación, es un paso que se saltó.
Conviene comprobarlo antes de dar por buena cualquier base:

```sql
SET NAMES utf8mb4;
SELECT COUNT(*) FROM departamentos WHERE nombre = 'Facturacion';   -- 1
SELECT nombre FROM subdepartamentos
 WHERE nombre LIKE 'fact%' ORDER BY nombre;                        -- 10 filas
```

## 3. A quién hay que dar qué

Esto no lo resuelve el despliegue: es una decisión. Y tiene dos capas que se confunden con
facilidad.

| Para | Hace falta |
|---|---|
| **Llegar a la pantalla de prefacturas** | el **departamento** Facturación y el subdepartamento `factPrefacturas` |
| **Ver y usar el botón REABRIR** | `factReabrirPrefactura`, **o** ser `admin` |

**Por qué son dos capas.** El **menú** se arma desde los departamentos del usuario
(`HandleInertiaRequests::mapUser()` anida los subdepartamentos dentro de sus departamentos), así
que sin el departamento la pantalla no se alcanza. La **bandera del botón**, en cambio, consulta
`$user->subdepartamentos()` **directo**, igual que el middleware: `User::puedeEnSubdepartamento()`
es la única regla y la usan los dos. Así que `factReabrirPrefactura` se concede **además** de lo
que la persona ya tenía, no en su lugar.

Y un detalle del middleware que conviene saber: además del subdepartamento exige uno de los
roles `empleado`, `jefe_area` o `fbo`. Cualquier otro rol —salvo `admin`, que pasa siempre—
recibe 403 «Rol no autorizado» aunque tenga el subdepartamento.

**Recomendación:** darlo a quien supervise, no a todo el mundo, y ampliarlo después si hace
falta. Reabrir es deshacer un documento que ya salió al cliente; repartir el permiso es fácil,
recogerlo no.

## 4. Verificación

```sql
SET NAMES utf8mb4;

-- La tabla nueva, con su único compuesto y las dos FK en SET NULL.
SHOW CREATE TABLE fact_prefactura_versiones;

-- El subdepartamento nuevo.
SELECT nombre, status FROM subdepartamentos WHERE nombre = 'factReabrirPrefactura';  -- 1 fila, A

-- Nadie debería tener versiones todavía.
SELECT COUNT(*) FROM fact_prefactura_versiones;                                       -- 0
```

En `SHOW CREATE TABLE` tienen que aparecer: `UNIQUE (prefactura_id, version)`,
`cerrada_por` y `reabierta_por` con **`ON DELETE SET NULL`**, y `cerrada_at` y `reabierta_at`
como **`datetime`** (no `timestamp`: un `timestamp` convertiría la hora con la zona de la sesión
y la hora de una versión podría dejar de coincidir con la del documento original).

## 5. Qué hay que probar a mano

Esto es lo que el departamento tiene que recorrer, en este orden. Las cifras del ejemplo son
las de una prefactura cualquiera.

- [ ] **Antes de nada, que el botón aparezca.** En una prefactura **cerrada**, con un usuario
      que tenga `factReabrirPrefactura`, tiene que verse **REABRIR PARA CORREGIR**. Con un
      usuario que solo tenga `factPrefacturas`, **no** tiene que verse.
- [ ] **El modal.** Pide un motivo de al menos 10 caracteres y no deja seguir sin él. Y lee el
      recuadro naranja: dice que **reabrir no se puede deshacer**. Conviene leerlo una vez.
- [ ] **Reabrir.** Anotar **el folio antes**. Después de reabrir: el folio es **el mismo**, hay
      un aviso permanente que lo dice, y los totales ya no están sellados.
- [ ] **Que no se pueda imprimir.** Con la prefactura reabierta, intentar el documento y la
      cotización: las dos tienen que negarse con un mensaje que explique que hay que volver a
      cerrarla. **Y DESCARTAR no debe ofrecerse.**
- [ ] **Corregir las cuatro cosas**: agregar un servicio que faltaba, cambiar un cobro, editar
      la cabecera o una nota, y quitar un servicio que no iba.
- [ ] **Volver a cerrar.** El botón dice **CERRAR DE NUEVO** y su confirmación dice que **se
      conserva el folio**. Tras cerrar: **mismo folio**, totales sellados de nuevo.
- [ ] **El papel corregido.** Imprimir: tiene que decir **«Corregida — sustituye a la versión
      del …»** con la fecha del documento anterior.
- [ ] **La versión anterior.** En la lista de versiones, abrir su PDF: tiene que mostrar **las
      cifras viejas** —no las corregidas— y estar marcado **NO VIGENTE**.
- [ ] **Y el folio no se gastó.** Crear una prefactura nueva y cerrarla: su folio tiene que ser
      el siguiente de la serie, **sin huecos** por la corrección.

## 6. Lo que el departamento tiene que saber antes de usarlo

- **Reabrir no se puede deshacer.** No hay «cancelar la reapertura»: lo único posible es volver
  a cerrar, y eso ya produce sus efectos. Si se reabre **la fila equivocada**, cerrar de nuevo
  —aunque no se corrija nada— deja el documento con **la fecha de hoy**, con **«Elaborado por»
  de quien lo cerró**, marcado como **«Corregida»**, y con una versión guardada para siempre. El
  modal lo advierte.
- **La cantidad de un renglón no se edita.** No existe esa acción: para corregir un importe hay
  que **quitar el renglón y volverlo a agregar**. La pantalla lo dice en dos sitios, para que
  nadie busque un campo que no existe.
- **Una reabierta que se quede así es un folio consumido y no reemitido**, es decir un hueco en
  la secuencia. Aparece distinguida en la lista, con su propia insignia y su filtro, para que se
  vea. Si le borran todos los renglones o le quitan el cliente, **no se puede volver a cerrar**
  hasta arreglarlo: el cierre lo dice con un 422 que nombra qué falta.

## 7. Pendientes que este bloque deja escritos

- **Una versión guardada hoy dejaría de reimprimirse con un 500** el día que alguien añada una
  clave a `DocumentoDePrefactura::instantanea()`, porque `hidratar()` lee sus claves sin valor
  por omisión. **Es deuda del bloque 6b y su arreglo ya está decidido:** que `hidratar()` use
  `?? null` en las claves nuevas y que `version()` degrade a **422** nombrando el folio y el
  número de versión, en vez de reventar. **Hay que hacerlo ANTES del siguiente cambio de
  `instantanea()`**, no después.
- **Dos guardas sin prueba que las ejerza**, por un límite del motor y no por descuido: el
  `lockForUpdate()` de la reapertura y el `whereIn` del cierre. sqlite no emite candados, así
  que una mutación que los quite no hace fallar nada. Están razonadas en la especificación.
- **La pantalla de Facturación entera no soporta modo oscuro** —no tiene ni un `dark:`—, así que
  lo nuevo tampoco. Es deuda de la pantalla, no de este bloque.
- **Si conservar la fecha y la firma originales al volver a cerrar** es lo correcto, o si el
  documento corregido debe llevar la fecha de la corrección (lo que hace hoy), es una decisión
  del departamento. Hoy lleva la de la corrección, que es defendible: es un papel nuevo y lo
  firma quien responde por las cifras nuevas.

## 8. Cuidado con el rollback

`down()` **borra la tabla con las versiones dentro**, y `php artisan migrate:rollback` a secas
revierte **el lote completo**, no una migración (está medido y documentado en la guía del bloque
5). Mientras esta migración sea la única de su lote y la tabla esté vacía, un rollback es
inocuo. **Después de que el departamento haya corregido una sola prefactura, deja de serlo:** un
rollback sería pérdida de documentos emitidos.
