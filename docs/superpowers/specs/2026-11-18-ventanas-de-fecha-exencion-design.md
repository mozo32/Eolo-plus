# FBO y administradores quedan exentos de las ventanas de fecha

**Fecha:** 2026-11-18
**Rama de origen:** `entrega-turno-seguridad`
**Spec que amplía:** `docs/superpowers/specs/2026-10-07-ventanas-de-fecha-design.md`

Los formularios del proyecto limitan la fecha que se puede escribir: hacia atrás
unos pocos días, y en casi todos sin futuro. Esa ventana protege de dedazos en la
captura diaria, pero también impide corregir un registro viejo: quien tiene que
arreglar el error de la semana pasada no puede.

Esta versión exime de la ventana a quien tiene rol **`fbo`** o **`admin`**. Para
ellos desaparecen los dos límites: pueden escribir cualquier fecha, pasada o
futura.

Lo que **no** cambia: las ventanas en sí, el hook del navegador, las dieciocho
pantallas que lo usan, y el comportamiento para todos los demás roles.

---

## 1. Qué se exime y a quién

| Rol | Usuarios hoy | ¿Exento? |
|---|---|---|
| `admin` — Administrador | 3 | **sí** |
| `fbo` — FBO | 4 | **sí** |
| `jefe_area` — Jefe de Área | 4 | no |
| `admin2` — Administrativo | 6 | no |
| `fac` — Facturación | 3 | no |
| `empleado` — Empleado | 34 | no |

Siete usuarios de cincuenta y cuatro. `admin2` se llama «Administrativo» y es el
que más fácil se confunde con `admin`: **no entra**. `jefe_area` tampoco, aunque
en Seguridad sea autoridad de cierre junto al FBO.

**Una petición sin sesión no está exenta.** El predicado recibe `null` y
responde que no: la regla falla cerrada, que es la única forma segura de
equivocarse.

**Se levantan los dos límites**, no solo el del pasado. Lo decidió el usuario
sabiendo que eso permite fechar un registro en el futuro.

## 2. Dónde vive la excepción

El problema real de este cambio no es decidir quién está exento, sino que **el
calendario del navegador y la regla del servidor digan lo mismo**. Hoy ya tiran
de la misma fuente: `VentanasDeFecha::para()` alimenta tanto a la regla como a la
prop de Inertia que lee el hook. La excepción se mete ahí dentro, y esa propiedad
se conserva sola.

`VentanasDeFecha` gana un predicado y un parámetro:

```php
public static function exentoDeVentana(?User $usuario): bool
{
    return $usuario !== null && $usuario->hasAnyRole(['fbo', 'admin']);
}

public static function para(string $clave, ?User $usuario = null): array
public static function todas(?User $usuario = null): array
```

Con un usuario exento, `para()` devuelve `['min' => null, 'max' => null]` —la
forma que la clase ya usa para «sin límite»— **después** de comprobar que la
clave existe. Una clave desconocida sigue lanzando: que el usuario sea
administrador no convierte un error de programación en silencio.

El parámetro es opcional y va al final, así que las llamadas que no lo pasan se
comportan igual que hoy. No hay que tocar ningún otro consumidor.

### Los dos consumidores

**La regla.** `DentroDeLaVentana::validate` pasa a pedir
`VentanasDeFecha::para($this->clave, auth()->user())`. Si vuelve sin límites, no
juzga nada y la validación pasa.

Esto hace que la regla deje de ser pura: su resultado depende de quién manda la
petición. Es aceptable y hay que decirlo en su docblock —el trabajo de la regla
es validar **una petición**, y quién la firma es parte de la petición— pero quien
la lea tiene que enterarse sin deducirlo.

**El middleware.** `HandleInertiaRequests` ya tiene `$user` en el alcance para
armar `auth.user`; pasa a `VentanasDeFecha::todas($user)`. Para un exento, las
dieciocho ventanas viajan como `{min: null, max: null}`.

### Por qué el front no se toca

`useVentanaDeFecha` ya devuelve `undefined` cuando la ventana no trae límite, y
un `<input type="date">` sin `min` ni `max` acepta cualquier día. Las dieciocho
pantallas que usan el hook y el propio hook **no cambian ni una línea**. La
lógica de `fechaOriginal` —ensanchar la ventana para no bloquear la edición de un
registro viejo— se vuelve inerte para los exentos, porque no hay ventana que
ensanchar, y sigue intacta para los demás.

## 3. Lo que esto le hace a las pruebas que ya existen

Esto es la mayor parte del trabajo y la razón de que el cambio no sea pequeño.

`tests/Feature/VentanasDeFechaEndpointsTest.php` tiene **162 pruebas**, y **159
corren como `usuarioAdmin()`**, un ayudante de `tests/Pest.php` que adjunta el
rol `admin` de verdad. De ellas, **78 exigen un rechazo 422** y **59 esperan
éxito**.

En el momento en que `admin` quede exento:

- las **78** que esperan el rechazo **fallarían**, porque el rechazo deja de ocurrir;
- las **59** que esperan éxito **pasarían por el motivo equivocado**: tendrían
  éxito porque la regla se salta, no porque la fecha esté dentro de la ventana.

La segunda mitad es la peligrosa. Un verde que no demuestra nada es peor que un
rojo.

**Esas 162 pruebas pasan a correr con un usuario NO exento.** Existen para
demostrar que la ventana muerde, así que su sujeto tiene que ser alguien a quien
muerda. Se les da un usuario con rol `empleado` —el de la mayoría de la
plantilla y el caso que esas pruebas describen de verdad— mediante un ayudante
`usuarioEmpleado()` en `tests/Pest.php`, hermano del `usuarioAdmin()` que ya
existe.

**Comprobado que el cambio de usuario no provoca 403.** El riesgo era que alguna
de esas pruebas usara `usuarioAdmin()` porque el endpoint exige rol, no por
casualidad; entonces un `empleado` recibiría 403 en vez del 422 que la prueba
espera, y el arreglo sería mentir sobre la causa. El único guardia de rol de
todo el proyecto está en `ControlMedicamentoController::reabastecer`, y este
archivo golpea `POST /api/ControlMedicamento` y `PUT /api/ControlMedicamento/{id}`,
nunca `reabastecer`. Ninguno de los quince endpoints que toca comprueba roles.

`tests/Feature/VentanasDeFechaTest.php` (24 pruebas) trabaja sobre la clase de
soporte y un usuario sin roles; **no le afecta**.

## 4. Las pruebas nuevas

Un archivo propio para la excepción, porque es una regla de permisos y merece
leerse junta:

- Un `fbo` guarda una fecha de hace un mes, muy fuera de la ventana.
- Un `admin` guarda una fecha de hace un mes.
- Un `fbo` guarda una fecha **futura** en una clave que no admite futuro.
- Un `empleado` con la misma fecha recibe 422: la ventana sigue viva.
- Un `jefe_area` recibe 422: la lista de exentos es exactamente la que dice.
- `exentoDeVentana(null)` responde que **no**. Se prueba sobre el predicado y no
  contra un endpoint a propósito: todos están tras `auth:sanctum`, así que una
  petición sin sesión recibe 401 y nunca llega a la regla. Probarlo por ahí daría
  un verde que no habla de la exención.
- `VentanasDeFecha::para()` con una clave desconocida sigue lanzando aunque el
  usuario sea administrador.
- `VentanasDeFecha::todas($exento)` devuelve las dieciocho claves con `min` y
  `max` en `null`; con un `empleado`, las devuelve con sus límites.
- La prop `ventanasDeFecha` que llega a Inertia va sin límites para un exento y
  con límites para quien no lo está.

El endpoint para los casos de ida y vuelta es uno del que ya existan pruebas de
ventana, para no inventar un escenario nuevo.

## 5. Archivos que se tocan

| Archivo | Qué |
|---|---|
| `app/Support/VentanasDeFecha.php` | `exentoDeVentana()`, y el usuario opcional en `para()` y `todas()` |
| `app/Rules/DentroDeLaVentana.php` | pide la ventana del usuario autenticado; docblock sobre su impureza |
| `app/Http/Middleware/HandleInertiaRequests.php` | una línea: `todas($user)` |
| `tests/Feature/VentanasDeFechaEndpointsTest.php` | sus 162 pruebas pasan a un usuario `empleado` |
| `tests/Feature/VentanasDeFecha/ExencionPorRolTest.php` | nuevo |
| `tests/Pest.php` | un ayudante para el usuario no exento, junto a `usuarioAdmin()` |

No hay migración: los roles y la tabla pivote ya existen. No se toca ningún
controlador, ningún Form Request, ni nada bajo `resources/js`.

## 6. Riesgos y limitaciones conocidas

**Siete personas pueden escribir cualquier fecha, incluida una futura.** Es lo
pedido y conviene que esté escrito: un movimiento fechado el mes que viene ya no
lo impide nada, y el que lo escriba no verá ningún aviso.

**La regla pasa a depender del usuario autenticado.** Un comando de consola o un
job que valide con esta regla no tendrá usuario y quedará sujeto a la ventana.
Hoy no hay ninguno; si lo hubiera, tendría que pasar el usuario explícitamente.

**La exención es por rol, no por formulario.** No se puede eximir a un FBO del
relevo de Seguridad pero no del comisariato. Si algún día hace falta esa
distinción, el sitio es `exentoDeVentana()`, que ya recibe la clave por su
llamador y podría recibirla también a ella.

**Cambiar el rol de alguien cambia su ventana sin avisar.** Un usuario al que se
le quita `fbo` empezará a encontrarse el límite sin que nada se lo explique, más
allá del mensaje de la propia regla, que sí nombra las dos fechas.

## 7. Fuera de alcance

- Incluir `jefe_area`, `admin2` o `fac`.
- Un permiso específico de «saltarse la ventana» separado del rol.
- Registrar en bitácora quién usó la exención.
- Avisar en pantalla de que uno está exento.
- Cambiar las ventanas de ninguna clave.
- Tocar el hook `useVentanaDeFecha` o cualquiera de las dieciocho pantallas.
