# Entrega de Turno de Seguridad

Fecha: 2026-11-04

Un módulo nuevo en Seguridad para registrar la entrega de turno: quién
entregó, qué alcanzó a revisar, qué observó y las dos firmas que cierran
el relevo.

---

## 1. Qué se pide

Seguridad trabaja en dos puestos, **frente** y **atrás**. Al cerrar el
turno, cada puesto deja dicho cuáles de sus diez puntos alcanzó a
revisar, escribe lo que haya que advertir al siguiente turno, firma, y
el FBO firma de recibido.

Hoy eso no se registra en ninguna parte. Lo que se pide es:

- una tabla con el mismo sistema de filtrado que Operaciones Diarias,
- tres acciones por renglón: editar, vista previa y eliminar,
- editar y eliminar reservadas a `fbo` y `admin`; la vista previa para
  todos,
- un formulario con el nombre tomado del usuario que inició sesión, la
  fecha y hora del día en hora de México, los diez apartados a contestar
  — ocho casillas, la pernocta mensual con tres estados y las
  observaciones en texto libre — y dos firmas,
- todo con las fechas en 24 horas y con el diseño que el proyecto ya
  trae.

## 2. Por qué no se reúsa la entrega de turno de Despacho

Ya existe una tabla `entregas_turno`, de Despacho, con firmas
polimórficas y la misma idea de relevo. No se reúsa, y no es por
comodidad: sus campos son otros. Despacho registra copiadoras, fondo de
documentación, equipo de oficina y el estado de la caja fuerte.
Seguridad registra aviones de CSAE, resguardo vehicular, posiciones,
vehículos y visitantes. No se cruza ni una columna.

Compartir la tabla obligaría a dejar en nulo la mitad de las columnas en
cada renglón y a adivinar, al leer, de qué área es el registro. El
módulo va por su cuenta, en su propia tabla, y lo único que comparte con
Despacho es la maquinaria de firmas — que ya es compartida por otros
siete modelos.

## 3. Los datos

### 3.1 La tabla

Tabla `entregas_turno_seguridad`. **Un registro por sección**, no por
día.

| columna | tipo | nota |
|---|---|---|
| `id` | bigint | |
| `user_id` | FK `users` | de aquí sale el nombre de quien entrega |
| `fecha_hora` | datetime | el instante del relevo |
| `seccion` | varchar(10) | `frente` o `atras` |
| `aviones_csae` | boolean, default false | |
| `combustible` | boolean, default false | |
| `resguardo_vehicular` | boolean, default false | |
| `estacionamiento` | boolean, default false | |
| `posiciones` | boolean, default false | |
| `vehiculos` | boolean, default false | |
| `operaciones` | boolean, default false | |
| `visitantes` | boolean, default false | |
| `pernocta_mensual` | char(1), default `R` | `S` hecho, `N` no hecho, `R` sin revisar |
| `observaciones` | text, nullable | texto libre |
| `status` | char(1), default `A` | borrado lógico |
| timestamps | | |

**Las letras son `A` activo y `N` retirado**, tanto en el registro como
en el pivote de firmas. Así lo hace todo el servidor —
`MovimientoCSAEController::eliminar()` escribe `'N'`, y los siete
módulos que retiran una firma escriben `'N'` en el pivote. La letra `I`
no existe en el servidor; aparece solo en una comparación de
`VistaPreviaCsae.tsx` que, por eso, nunca se cumple. No se copia esa
comparación.

Ocho casillas, un tri-estado y un texto. Sin marcar quiere decir que no
se hizo: no hay un tercer estado escondido en los ocho booleanos.

El nombre de los índices se mantiene corto a propósito. MySQL rechaza
identificadores de más de 64 caracteres y sqlite no, así que una
migración con nombres largos pasa todas las pruebas y revienta en
producción; ya pasó una vez en este proyecto. El índice de llave
foránea queda en `entregas_turno_seguridad_user_id_foreign`, de 39
caracteres.

### 3.2 Por qué columnas booleanas y no un JSON

Despacho guarda sus listas de revisión en columnas JSON. Aquí no, por
una razón concreta: la lista es fija y la van a querer contar. «Cuántos
días del mes no se revisó combustible» es una pregunta de una sola
consulta con columnas, y de leer fila por fila en PHP con un JSON. Ocho
`tinyint` cuestan ocho bytes por renglón; la consulta que ahorran vale
más que eso.

### 3.3 Por qué no hay candado de uno por día y sección

Lo normal son dos entregas al día, una por puesto. Lo tentador es poner
un índice único sobre `(fecha, seccion)` para garantizarlo. No se pone.

Si alguna vez hay un relevo extra — un turno partido, una emergencia, un
cambio de guardia a media noche — el sistema no tiene por qué negarse a
registrarlo. En vez del candado, la tabla **agrupa por día de
calendario**: si una sección entregó dos veces el mismo día, su casilla
dice «2 registros» y el selector de acciones las lista. Se degrada bien
en vez de rechazar un dato verdadero.

### 3.4 Los tres estados de la pernocta mensual

Los otros ocho puntos son diarios: no marcado significa «hoy no lo
hice», y eso es una falta. La pernocta es mensual, así que «hoy no la
hice» es lo normal casi todos los días del mes, y leerlo como falta
sería mentir.

Por eso lleva tres estados y nace en `R`, **sin revisar**. El `N`, «no
hecho», se escoge a mano, y ahí sí quiere decir que tocaba y no se hizo.

## 4. Las firmas

Van por la tabla `firmables` que ya existe, con `morphToMany` como en
`MovimientoCSAE`:

```php
public function firmas()
{
    return $this->morphToMany(Firma::class, 'firmable', 'firmables')
        ->withPivot(['rol', 'tag', 'orden', 'status'])
        ->wherePivot('status', 'A')
        ->withTimestamps();
}
```

Dos roles: `quien_entrega` y `fbo`. Se guardan igual que en
`MovimientoCSAEController::guardarFirmaBase64()` — llega un base64, la
firma anterior de ese rol pasa a `status = 'N'` en el pivote y se
engancha la nueva. No se inventa maquinaria.

**El relevo se guarda con la firma de quien entrega nada más.** El FBO
firma después, y para eso tiene un botón de pendientes que consulta los
registros a los que les falta su firma, calcado del
`ChecklistEquipoSeguridad/pendientes` que ya existe.

Como los registros son dos, **el FBO firma cada sección por separado**.
Si el frente entregó y el de atrás no, pendientes enseña solo el del
frente.

## 5. La API

Prefijo `EntregaTurnoSeguridad`, bajo `['api', 'auth:sanctum']`, como el
resto:

| verbo | ruta | qué hace |
|---|---|---|
| GET | `/` | el listado, agrupado por día y paginado por día |
| GET | `/pendientes` | los registros sin la firma del FBO |
| GET | `/{id}` | el detalle de un registro, con sus firmas |
| POST | `/` | crea un registro |
| PUT | `/{id}` | lo edita — solo `fbo` y `admin` |
| GET | `/eliminar/{id}` | borrado lógico — solo `fbo` y `admin` |

El `GET /eliminar/{id}` es raro para un borrado, pero es la forma que
usa el módulo hermano de Seguridad y la convención manda sobre el gusto.

**La firma del FBO llega por ese mismo `PUT`**, en un campo `firma_fbo`
con el base64. No hay una ruta aparte para firmar: el FBO ya tiene
permiso de `PUT`, y una segunda ruta que hiciera lo mismo sería otra
puerta que cuidar.

### La paginación se cuenta en días, no en registros

El listado paginaría mal si contara registros: una página de diez
registros puede partir un día a la mitad y dejar el frente en una página
y el de atrás en la siguiente. Se resuelve con dos consultas:

```php
$dias = EntregaTurnoSeguridad::query()
    ->where('status', 'A')
    ->selectRaw('DATE(fecha_hora) as dia')
    ->groupBy('dia')
    ->orderByDesc('dia')
    ->paginate($perPage);
```

y después se traen todos los registros cuyo `DATE(fecha_hora)` cae en
esos días. La paginación cuenta días; el renglón nunca sale partido.

### Los filtros deciden qué días salen, no qué secciones se ven

Si se filtra por «falta la firma del FBO», aparecen los **días** que
tienen al menos un registro sin firmar — pero el renglón sigue mostrando
las dos secciones completas. Esconder la sección ya firmada haría que el
renglón mintiera sobre lo que pasó ese día.

### La forma de cada renglón

```json
{
  "fecha": "2026-11-04",
  "frente": {
    "id": 12,
    "nombre": "Juan Pérez",
    "hora": "07:30",
    "firmado_fbo": true,
    "pernocta_mensual": "R",
    "extras": 0
  },
  "atras": null
}
```

`null` quiere decir que esa sección no entregó. `extras` cuenta los
registros adicionales de la misma sección ese día — cero casi siempre.

Cuando `extras` no es cero, el renglón enseña **el registro más
reciente** de esa sección y dice cuántos hay.

**Limitación conocida, y conviene decirla:** los registros más viejos de
esa sección quedan visibles como número pero **no se pueden editar ni
eliminar desde la pantalla**. Una versión anterior de esta spec prometía
que el selector los listaría, y el diseño no lo permite: el renglón del
listado lleva un solo id por sección. Listarlos pediría que la API
devolviera también los ids de los extras.

Se deja así porque el caso es raro por construcción —la propia spec dice
«cero casi siempre»— y cerrarlo bien es trabajo de API, tipos, selector y
pruebas. Queda anotado para decidirlo con el módulo en uso.

## 6. La tabla en pantalla

### 6.1 Sobre qué se construye

Operaciones Diarias arma su tabla a mano: `OperacionesCards.tsx` tiene
1307 líneas con la tabla, los filtros, el modal de fechas y la
paginación escritos ahí mismo. Copiar esas 1307 líneas no es la única
salida, pero tampoco lo es el componente genérico que parecía estar ahí
para eso.

Existe `components/DataTable.tsx`, un componente de tabla genérico.
**No se usa.** No hay ni una importación de él en todo
`resources/js/pages`, y además su vocabulario visual es otro:
`rounded-xl`, `bg-muted/50`, `text-muted-foreground`. Las tablas de
Seguridad y de Tráfico usan `rounded`, `border-slate-200` y
encabezados `text-[9px] font-black uppercase text-slate-400`. Montar
esta tabla sobre `DataTable` se vería distinto de todo el resto, que es
exactamente lo contrario de lo que se pidió.

**Lo que sí se reúsa es `components/ModalPeriodo.tsx`**, que es
compartido de verdad — Relación de planta y Préstamo de chalecos ya lo
traen — y es el mismo modal de fechas de Operaciones Diarias.

Así que: el modal de periodo se importa, y la tabla se escribe a mano
con las clases estándar, siguiendo
`TablaPrestamosChalecos.tsx`, que resuelve una tabla con filtros,
paginación y acciones en 285 líneas. Sus constantes `TH` y `FILTRO` se
copian tal cual; son las de la tabla estándar.

`DataTable.tsx` no se toca ni se borra en este trabajo: es código
muerto, pero borrarlo es otra tarea y no esta.

### 6.2 Las columnas

Una fila por día:

| Fecha | Frente | Atrás | Pernocta mensual | Acciones |
|---|---|---|---|---|
| 04/11/2026 | Juan Pérez · 07:30 ✓ | Luis Gómez · 19:00 ⏳ | Sin revisar | 👁 ✏ 🗑 |

El distintivo de cada sección es una etiqueta de texto:

- **Firmado** — el FBO ya firmó,
- **Falta FBO** — falta su firma,
- **—** esa sección no entregó.

Van en texto y no en símbolos (✓ / ⏳), que es lo que decía una versión
anterior de esta spec, por tres razones: las tablas del proyecto usan
etiquetas de texto —`prestado` y `devuelto` en Préstamo de chalecos—, un
reloj de arena no dice **qué** falta mientras «Falta FBO» sí, y un símbolo
solo no se lee en voz alta. Los símbolos eran taquigrafía para explicar
tres estados en una tabla de markdown, no una decisión de pantalla.

La columna de pernocta mensual imprime una sola etiqueta cuando las dos
secciones coinciden. **Si discrepan, imprime las dos**, el frente
primero: `Hecho / Sin revisar`. Resumirlo a un solo valor obligaría a
decidir cuál de los dos gana, y cualquier elección borraría lo que una
de las dos secciones dijo.

### 6.3 Los filtros

- buscador por nombre de quien entregó,
- periodo con `ModalPeriodo` — sus cuatro modos son `dia`, `rango`,
  `mes` y `año`,
- sección: ambas, frente, atrás,
- estado: «todas»; «falta la firma del FBO», que trae los días con al
  menos un registro sin firmar; y «completas», los días en que toda
  sección que entregó ya tiene sus dos firmas,
- limpiar.

**No se arrastran** los filtros propios de Operaciones Diarias — equipo,
lugar, tipo de operación, pax, eqp, cliente, matrícula. En una entrega
de turno no significan nada, y heredarlos sería dejar cinco controles
muertos en pantalla.

### 6.4 Las acciones

La vista previa abre el día completo, con las dos secciones.

Editar y eliminar actúan sobre **un registro**, no sobre el día: borrar
«el día» borraría el trabajo de otra persona. Cuando el día tiene dos
secciones, la acción abre un selector que pregunta sobre cuál. Cuando
tiene una sola, entra directo sin preguntar.

## 7. El formulario

- **Nombre:** se muestra el del usuario autenticado y no se puede
  escribir. El servidor lo toma de `$request->user()`, nunca de lo que
  llegue en la petición.
- **Fecha y hora:** se propone el instante actual en hora de México, en
  24 horas.
- **Sección:** frente o atrás, a escoger.
- **Ocho casillas** con sus etiquetas tal como se pidieron.
- **Pernocta mensual:** tres opciones, con «sin revisar» marcada al
  abrir.
- **Observaciones:** área de texto libre. Vacía quiere decir que no hubo
  observaciones.
- **Firma de quien entrega:** obligatoria al crear. Al editar no se pide:
  el `PUT` conserva la anterior si no llega una nueva, y exigirla
  obligaría a quien corrige una casilla a redibujar la firma de otra
  persona, que es falsificarla.
- **Firma del FBO:** **no se pide al crear.** El campo no aparece hasta
  que el relevo existe.

  Una versión anterior de esta spec decía «opcional al crear», lo que
  contradecía la §4 —«el relevo se guarda con la firma de quien entrega
  nada más»— y el formulario acabó ofreciendo al FBO un campo que el
  servidor descartaba al validar: dibujaba su firma, leía «relevo
  registrado correctamente», y la firma no existía. Manda la §4. El FBO
  firma después, por la cola de pendientes.

## 8. La vista previa

Modal, con la forma de `VistaPreviaCsae.tsx`: dos columnas lado a lado,
Frente y Atrás. Cada una con sus nueve puntos en ✓/✗, la pernocta
mensual con su estado escrito, el texto de las observaciones y las dos
firmas como imagen, leídas por el `rol` del pivote igual que el
`getFirmaByRol` que esa vista ya tiene.

Una sección que no entregó se dibuja como «sin entregar», no como una
columna de casillas vacías — vacío y no entregado no son lo mismo.

## 9. Permisos

El front esconde botones, y eso no es un permiso. Van los dos lados.

**Navegador:** `tieneRol('fbo', 'admin')`, con el mismo juego de
`rolesUsuario` y `tieneRol` de `MovimientoAvionesCSAE.tsx`. Quien no
tenga el rol no ve el lápiz ni el bote.

**Servidor:** `$request->user()->hasAnyRole(['fbo', 'admin'])` o 403, en
`update` y en el borrado, como ya lo hace
`OperacionesDiariasController`. El proyecto no tiene `app/Policies`, así
que la revisión va en el controlador: es su convención, no un atajo.

`store` queda abierto a cualquiera con acceso al módulo. El rol de
administrador se llama `admin`.

Eliminar siempre es lógico: `status = 'N'`. El renglón se queda en la
base.

## 10. La fecha: 24 horas y hora de México

La aplicación ya corre en la zona de México: `config('app.timezone')`
vale `America/Mexico_City`. La fecha se guarda como `datetime` y se
muestra siempre en 24 horas, con los ayudantes de formato que
`VistaPreviaCsae.tsx` ya trae: `dd/mm/aaaa` para el día y `HH:mm` para
la hora, sin `am`/`pm` en ninguna pantalla del módulo.

### La ventana de fecha es obligatoria

El proyecto no deja que un formulario con fecha elija el día libremente.
Hay una política en un solo sitio, `App\Support\VentanasDeFecha`, que
dice cuántos días atrás y si se admite el futuro, y la leen tanto la
regla del servidor (`App\Rules\DentroDeLaVentana`) como las props que
`HandleInertiaRequests` publica al navegador. No es opcional: hay
pruebas que exigen que cada clave de la tabla se use en el servidor **y**
en el navegador.

La clave de este módulo es **`seguridad.entrega_turno`**, con
`['atras' => 1, 'futuro' => false]` — hoy y ayer. Es la misma ventana de
`turno.checklist` y `turno.entrega_rampa`, y por la misma razón: se
llena en el momento, con un día de margen para quien cierra a la mañana
siguiente. No tiene sentido registrar un relevo de la semana pasada, ni
uno que todavía no ocurrió.

Agregar la clave obliga a tocar **cuatro** sitios, y los cuatro son
parte del trabajo:

1. `App\Support\VentanasDeFecha::CLAVES`
2. `tests/Feature/VentanasDeFechaTest.php`, donde la tabla está
   duplicada a propósito para que cambiarla exija reconocerlo
3. el Form Request, con la regla pegada a `date` o `date_format`
4. el formulario, con `useVentanaDeFecha('seguridad.entrega_turno', …)`,
   pasándole la fecha original cuando se está editando

## 11. Los archivos

**Servidor**

- migración de `entregas_turno_seguridad`
- `app/Models/EntregaTurnoSeguridad.php`
- `app/Http/Controllers/Api/EntregaTurnoSeguridadController.php`
- `app/Http/Requests/EntregaTurnoSeguridad/StoreEntregaTurnoSeguridadRequest.php`
- `app/Http/Requests/EntregaTurnoSeguridad/UpdateEntregaTurnoSeguridadRequest.php`
- `app/Support/VentanasDeFecha.php` — la clave nueva
- `tests/Feature/VentanasDeFechaTest.php` — la tabla duplicada
- `routes/api.php`, `routes/web.php`

**Navegador**

- `resources/js/components/navigation.ts` — el menú. **Ojo: se arma de
  DOS maneras y hay que tocar las dos.** Esto costó un defecto crítico en
  este módulo y conviene que no se repita:

  - `getNavModules` tiene una rama `if (user.isAdmin)` (línea 168) con la
    lista escrita a mano. Ahí va el renglón nuevo.
  - **Para todos los demás usuarios**, el menú se construye recorriendo
    `user.departamentos[].subdepartamentos[]` y pasando cada ruta por
    `ROUTE_CONFIG`; lo que no esté en ese mapa **se descarta en silencio**
    (línea 261: `if (!routeKey || !ROUTE_CONFIG[routeKey]) return null;`).
  - Las dos ramas son excluyentes: `HandleInertiaRequests:79` manda
    `departamentos` vacío a los administradores.

  Así que un módulo que solo se agregue a la lista de admin **no existe
  para nadie más**. Hacen falta tres piezas, siguiendo el precedente de
  `PrestamoChalecosSubdepartamentoSeeder`:

  1. la entrada en `ROUTE_CONFIG`;
  2. un seeder que cree el `SubDepartamento` cuyo nombre **slugifique a
     esa misma llave** (`Str::slug('entregaTurnoSeguridad')` da
     `entregaturnoseguridad`);
  3. el registro de ese seeder en `DatabaseSeeder`, donde ya viven otros
     cuatro iguales.

- `resources/js/pages/seguridad/entregaTurno/types.ts` — tipos,
  etiquetas y ayudantes del módulo
- `resources/js/pages/seguridad/EntregaTurno.tsx` — la página
- `resources/js/pages/seguridad/entregaTurno/TablaEntregaTurno.tsx`
- `resources/js/pages/seguridad/entregaTurno/FilaFiltros.tsx`
- `resources/js/pages/seguridad/entregaTurno/CeldasRelevo.tsx`
- `resources/js/pages/seguridad/entregaTurno/PaginadorRelevos.tsx`
- `resources/js/pages/seguridad/entregaTurno/FormEntregaTurno.tsx`
- `resources/js/pages/seguridad/entregaTurno/FirmaActual.tsx`
- `resources/js/pages/seguridad/entregaTurno/VistaPreviaEntregaTurno.tsx`
- `resources/js/pages/seguridad/entregaTurno/SelectorSeccion.tsx`
- `resources/js/pages/seguridad/entregaTurno/PendientesFirmaFbo.tsx`
- `resources/js/stores/apiEntregaTurnoSeguridad.ts`

**Ningún archivo del navegador pasa de las trescientas líneas**, y eso
explica por qué hay más archivos de los que esta lista tenía al
principio: la tabla y el formulario se partieron al escribirlos, no
después. `FilaFiltros`, `CeldasRelevo`, `PaginadorRelevos` y
`FirmaActual` salieron de ahí.

**El controlador es la excepción, y conviene decirlo en vez de afirmar lo
contrario:** acumuló las cinco tareas del servidor y quedó en 442 líneas.
Partirlo —un scope `sinFirmaFbo()` en el modelo, un recurso para el
mapeo, y la lógica de firmas a un servicio— está aparcado a propósito,
porque es refactor sin cambio de comportamiento y las cinco tareas
siguientes eran de navegador y no lo tocaban.

El límite no aplica a los archivos de **prueba**. Trescientas líneas de
pruebas son pruebas; partirlas obligaría a mover sus ayudantes y a crear
la dependencia entre archivos de prueba que este trabajo rechazó por
frágil —un archivo que solo funciona si antes se cargó otro.

## 12. Qué se prueba

Pruebas de característica en Pest, contra la API, corridas en serie:

1. el nombre sale del usuario autenticado, no de lo que manda el
   navegador: una petición que trae otro `user_id` guarda el del
   autenticado
2. la fecha se guarda y se devuelve en hora de México
3. `pernocta_mensual` nace en `R` cuando no se manda
4. `pernocta_mensual` acepta `S`, `N` y `R`, y rechaza cualquier otra
   cosa
5. `seccion` acepta `frente` y `atras`, y rechaza cualquier otra cosa
6. dos secciones el mismo día devuelven **un** renglón, con las dos
   llenas
7. un día con una sola sección devuelve la otra en `null`
8. tres registros de la misma sección el mismo día devuelven un renglón
   con `extras` en 2
9. la paginación cuenta días: con once días y diez por página, la
   primera página trae diez renglones completos, ninguno partido
10. el filtro «falta la firma del FBO» trae el día, y el renglón sigue
    mostrando las dos secciones
11. cuando las dos secciones discrepan en la pernocta mensual, el
    renglón devuelve los dos estados
12. un `empleado` recibe 403 al editar y al eliminar
13. `fbo` y `admin` pasan en los dos
14. eliminar solo cambia `status` a `N`; el renglón sigue en la base y
    desaparece del listado
15. se guarda con la firma de quien entrega nada más, sin la del FBO
16. `pendientes` lista solo los registros sin la firma del FBO, y deja
    de listar uno en cuanto se firma
17. firmar de nuevo el mismo rol deja la firma anterior en
    `status = 'N'` y una sola activa
18. la ventana de fecha rechaza un relevo de hace una semana y uno de
    mañana, y acepta hoy y ayer

Las pruebas que ya existen en `tests/Feature/VentanasDeFechaTest.php`
cubren el resto de la clave nueva por sí solas: que esté usada en el
servidor y en el navegador, y que la regla vaya pegada a `date`.

Del navegador la prueba es `npm run build` en verde y
`npx tsc --noEmit` con el único error de base que el proyecto ya
arrastra. No hay corredor de pruebas de JavaScript en este proyecto.

## 13. Lo que NO entra

- exportar a Excel o a PDF,
- avisos o notificaciones cuando falta una firma,
- un candado de una entrega por sección por día,
- los filtros propios de Operaciones Diarias,
- reutilizar la tabla de Despacho,
- editar el nombre de quien entrega,
- subfilas desplegables en la tabla: el día se abre en la vista previa.

## 14. Decisiones registradas

1. **Módulo independiente del de Despacho.** No se cruza una sola
   columna; compartir la tabla dejaría la mitad en nulo.
2. **Un registro por sección, una fila por día.** Dos personas
   distintas entregan, y cada una es dueña de lo que escribió.
3. **Editar y eliminar preguntan sobre qué sección.** Con una sola
   sección entran directo.
4. **Observaciones es caja de texto.** Un checkbox de «ya comenté mis
   observaciones» no guarda la observación.
5. **Crear está abierto a cualquiera con acceso; editar y eliminar solo
   `fbo` y `admin`.**
6. **Se guarda con la firma de quien entrega; el FBO firma después** y
   tiene un botón de pendientes.
7. **Ocho columnas booleanas, no un JSON**, para poder contarlas.
8. **Sin índice único por día y sección**, para no rechazar un relevo
   extra verdadero.
9. **Se reúsa `ModalPeriodo`; la tabla se escribe a mano con las clases
   estándar**, siguiendo `TablaPrestamosChalecos`. No se usa
   `DataTable`: nadie lo importa y su aspecto no es el del proyecto.
10. **La paginación cuenta días, no registros**, para no partir un
    renglón.
11. **El filtro decide qué días aparecen; el renglón siempre muestra las
    dos secciones.**
12. **Si las dos secciones discrepan en la pernocta mensual, se imprimen
    los dos estados.**
13. **La pernocta mensual nace en «sin revisar»**, porque es el estado
    verdadero casi todos los días del mes.
14. **La ventana de fecha es `seguridad.entrega_turno`, hoy y ayer**, la
    misma que los otros dos relevos del proyecto.
