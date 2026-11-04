# SDD ledger — plan: docs/superpowers/plans/2026-11-04-entrega-turno-seguridad.md

Spec: docs/superpowers/specs/2026-11-04-entrega-turno-seguridad-design.md
Rama: entrega-turno-seguridad (rama en el sitio, no worktree)
MERGE_BASE: 0c3da53

## Decision de taller

Ruling: se trabaja en una rama en el sitio y no en un worktree — .env,
vendor/ y node_modules/ no estan en git, y un worktree exigiria composer
install, npm install y copiar el .env antes de correr una prueba. Cuesta
aislamiento: si algo sale mal se arregla con git, no tirando una carpeta.

## Barrido previo de conflictos

### Pares de tareas que comparten archivo o interfaz

| Tareas | Lo que una produce vs lo que la otra consume | Hallazgo |
|---|---|---|
| T2,T3,T4,T5 | EntregaTurnoSeguridadController.php y routes/api.php, cada una agrega metodos y rutas | Limpio. Cada tarea agrega, ninguna reescribe. El orden de rutas (pendientes y eliminar antes de /{id}) esta dicho en T4 y T5. |
| T1 -> T2,T3,T4,T5 | modelo, constantes, scopeActivas, tieneFirmaDe, firmasAll | Limpio. Los nombres que usan T3 y T5 existen en el modelo de T1. |
| T2 -> T4 | guardarFirmaBase64(string,string,EntregaTurnoSeguridad): void | Limpio. T4 lo llama con la misma firma. |
| T2 -> T8 | StoreEntregaTurnoSeguridadRequest.rules() | Limpio. T8 solo agrega la regla a fecha_hora y borra la nota del docblock. |
| T4 -> T8 | UpdateEntregaTurnoSeguridadRequest.rules() | Limpio, igual que el anterior. |
| T3 -> T6 | forma del renglon {fecha,frente,atras} y de la seccion | Limpio. SeccionRelevo y FilaRelevo de types.ts coinciden campo por campo con seccionDelDia. |
| T4 -> T6 | forma de detalle() | Limpio. DetalleRelevo lleva las mismas claves mas Record<Casilla,boolean>. |
| T5 -> T6 | forma de pendientes | Limpio. PendienteRelevo coincide. |
| T6 -> T7,T9,T10 | types.ts y el store | Limpio. |
| T7 -> T8 | FormEntregaTurno.tsx | Limpio. T8 solo cuelga useVentanaDeFecha del input de dia. |
| T6,T7,T9,T10 | EntregaTurno.tsx, que las cuatro tocan | Limpio por orden: T6 deja el armazon, T7 cuelga el formulario, T9 la tabla, T10 las dos vistas. |
| T9 -> T10 | onVerPrevia de la tabla vs la prop de la vista previa | **CONFLICTO.** T9 declara onVerPrevia=(fecha: string) y T10 declara <VistaPreviaEntregaTurno fila={FilaRelevo}>. La pagina no tiene las filas (las tiene la tabla), asi que no puede convertir una fecha en FilaRelevo. |
| T8 | VentanasDeFecha.php y VentanasDeFechaTest.php | Limpio. Ninguna otra tarea los toca. |

### Cada tarea contra si misma

| Tarea | Hallazgo |
|---|---|
| T1 | Limpio. Las pruebas usan firmasAll() y el modelo lo define; la prueba de nombres de indice asserta los dos que la migracion escribe. |
| T2 | Limpio. firma_quien_entrega vacia la rechaza `required`; sin sesion da 401 por auth:sanctum; el store devuelve 201 y assertSuccessful lo cubre. |
| T3 | Un riesgo chico, ver abajo. Lo demas limpio: whereIn con lista vacia da 0=1 (correcto para falta_fbo) y whereNotIn vacia no restringe (correcto para completas). |
| T4 | Limpio. Con solo firma_fbo el $validado queda vacio y el update se salta por el `if`. user_id no esta en rules, asi que validated() lo descarta. |
| T5 | Limpio. |
| T6 | Limpio, con una concesion: fechaHoy() y horaAhora() leen la zona del equipo y no la de Mexico. Es lo que hace todo el proyecto (fechaHoy() de Rampa); el servidor es el que manda. |
| T7 | Limpio. fecha + hora se juntan en fecha_hora, que es lo que la regla `date` espera. |
| T8 | Limpio. La ventana juzga el dia por diaQueGuardaElModelo, que sirve igual para un datetime. |
| T9 | Limpio. pernoctaDelDia dedupe con Set, que conserva el orden de insercion, y el frente se mete primero. |
| T10 | Limpio. |

## Rulings del barrido

Ruling 1: onVerPrevia de la tabla pasa la FilaRelevo completa, no la
fecha — `onVerPrevia={(fila: FilaRelevo) => void}`. La tabla ya tiene la
fila; mandar solo la fecha obligaria a la pagina a buscar un renglon que
nunca tuvo, o a pedirlo otra vez al servidor. Se corrige en el plan antes
de despachar T9. Si me equivoco cuesta cambiar una firma de prop y sus
dos usos.

Ruling 2: en la prueba del buscador de T3, el segundo relevo lleva un
nombre explicito en vez del que invente la factory. Con un nombre al azar
existe la posibilidad remota de que contenga «Robles» y la prueba falle
sin motivo. Si me equivoco no cuesta nada: una linea mas en la prueba.

## Bitacora

Task 1: despachada (BASE a2ef163, modelo haiku — el pliego trae el codigo
completo, asi que es transcripcion mas pruebas)
Task 1: DONE (commit fc66536, 6 pruebas 21 asertos, en serie)
Task 1: Ruling: la prueba del largo del indice es una tautologia — asserta
  strlen de dos literales que la propia prueba escribe, asi que un cambio de
  nombre en la migracion no la rompe. Es defecto del plan, no del
  implementador, y lo levanto el. Se corrige para que lea los nombres reales
  del esquema con Schema::getIndexes('entregas_turno_seguridad'). Entra en la
  vuelta de arreglos junto con lo que traiga la revision, para no gastar dos
  despachos. Si me equivoco cuesta una prueba reescrita.
Task 1: revision (sonnet) — spec OK, calidad aprobada. 1 Importante
  (plan-mandated: la prueba tautologica del indice), 3 menores, 2 avisos de
  «no verificable desde el diff».
Task 1: los dos avisos resueltos por mi:
  - firmables tiene rol, tag, orden, status y timestamps: leido de
    2025_12_16_175452_firmables.php antes de escribir la spec. No es hueco.
  - el commit fc66536 trae exactamente los tres archivos (git show --stat), y
    .claude/, CLAUDE.md, boost.json y .env.respaldo siguen sin rastrear.
Task 1: minor (deferred): firmasAll() no lleva withTimestamps() y firmas() si,
  asi que un attach por firmasAll deja el pivote sin fechas. Hoy solo las
  pruebas atachan por ahi; en produccion se usa firmas(). CSAE tiene el mismo
  desnivel, asi que arreglarlo aqui solo lo deja distinto del hermano.
Task 1: minor (deferred): el bloque de comentario de la migracion no es
  PHPDoc. Lo mandaba asi el plan y el contenido lo justifica.
Task 1: minor (deferred): sin pruebas de PERNOCTA_ESTADOS, usuario() ni el
  cast de fecha_hora. Cobertura opcional.
Task 1: Ruling (refina el anterior): el arreglo NO usa
  Schema::getForeignKeys() como sugirio el revisor. El grammar de sqlite
  (SQLiteGrammar::getForeignKey) emite «foreign key(...) references ...» sin
  nombre de restriccion, asi que ahi no hay nombre que medir y el aserto
  probaria nada. La prueba lee solo Schema::getIndexes(), con un guardia de
  lista no vacia y un toContain del nombre esperado. El largo de la FK (40
  caracteres) queda por construccion de la convencion de Laravel, no por
  aserto. Si me equivoco, el riesgo es no cubrir un nombre de FK largo —
  imposible hoy, porque la migracion no nombra ninguna a mano.
Task 1: fix round 1/5 (1 atendido, 0 abiertos — la prueba del indice ahora lee
  Schema::getIndexes con guardia de lista no vacia y toContain del nombre;
  control negativo hecho y restaurado; commits fc66536..5158b58)
Task 1: complete (commits a2ef163..5158b58, revision limpia)
Task 2: despachada (BASE 17537c4, modelo sonnet — cuatro archivos con
  integracion de rutas y una transaccion, no es pura transcripcion)
Task 2: DONE_WITH_CONCERNS (commit 3122e86, 18 pruebas 53 asertos en
  tests/Feature/EntregaTurnoSeguridad/, Tarea 1 incluida)
Task 2: verificado por mi — routes/api.php quedo limpio tras el incidente del
  sed: el diff del commit trae solo el `use` y el grupo de rutas, y php -l no
  reporta errores.
Task 2: Ruling: la validacion de la firma es un hueco de MI plan y se arregla
  antes de la revision, porque es correccion y no observacion. Con
  firma_quien_entrega = "abc" la regla required|string pasa, el guardia de
  guardarFirmaBase64 hace return en silencio y el relevo se crea con 201 SIN
  firma — exactamente lo que la spec declara obligatorio. La regla pasa a
  exigir la forma: regex de data:image/<tipo>;base64, mas una prueba que
  comprueba que un texto cualquiera se rechaza y no crea nada. El guardia del
  controlador se queda como defensa, no como validacion. Lo levanto el
  implementador. Si me equivoco, el costo es rechazar una firma con un mime
  raro; la unica fuente es SignaturePad, que emite image/png.
Task 2: Ruling: la misma regla de forma va al UpdateEntregaTurnoSeguridadRequest
  de la Tarea 4, para firma_quien_entrega y firma_fbo, con sometimes+nullable
  por delante. Sin eso el PUT tendria el mismo hueco y el FBO podria quedar
  «firmado» sin firma. Se lleva en el despacho de la Tarea 4.
Task 2: arreglo previo a la revision hecho (commit b313bca, 19 pruebas 55
  asertos; control negativo: la prueba nueva paso sin error de validacion
  antes de la regla). El informe ya trae la salida literal.
Task 2: Ruling: el UpdateRequest de la Tarea 4 lleva ademas un
  prepareForValidation que pasa '' a null en las dos firmas. `nullable` solo
  se salta las reglas con null, no con '', asi que un formulario de React que
  arranque con useState('') habria recibido 422 por NO haber firmado. Dos
  pruebas nuevas en la Tarea 4 lo cubren. Si me equivoco cuesta un
  prepareForValidation de seis lineas.
Task 2: revision (sonnet) — spec OK, calidad aprobada, 0 Critical, 0
  Important, 5 menores.
Task 2: el aviso de «no verificable» resuelto por mi: no hay morph map en el
  proyecto (nada de morphMap ni enforceMorphMap en app/, bootstrap/ ni
  config/), asi que firmable_type guarda el FQCN y el
  EntregaTurnoSeguridad::class del newPivotStatement es correcto.
Task 2: Ruling: SUBO a Important lo que el revisor puso como menor. Aceptar
  cualquier image/* permite image/svg+xml; el archivo va al disco public y un
  SVG abierto por su URL corre su script en el origen de la aplicacion, con el
  endpoint de crear abierto a cualquiera con sesion: XSS almacenado. Entra a
  arreglo ahora. Lista blanca png/jpeg/webp, cuerpo de 16+ caracteres base64
  (antes «data:image/png;base64,» escribia cero bytes) y extension por match
  en vez de partir el mime, que dejaba un .svg+xml. Se separa a proposito de
  MovimientoCSAEController, que arrastra el defecto. Si me equivoco, el costo
  es rechazar un mime de imagen exotico que SignaturePad nunca emite.
Task 2: Ruling: medido por mi contra la suite, usuarioConRol ya existe en
  tests/Feature/OperacionesDiarias/CancelarOperacionTest.php y la Tarea 5 la
  redeclaraba. En Pest son globales: fatal por redeclaracion, invisible al
  correr solo la carpeta del modulo. Renombrada a usuarioFboDePendientes en el
  plan. Comprobe los otros 15 nombres de ayudante con dos patrones y no choca
  ninguno mas. Si me equivoco no cuesta nada.
Task 2: minor (deferred): las pruebas no cubren un data:text/html, solo 'abc'
  — resuelto de paso en el arreglo con un dataset.
Task 2: minor (deferred): los dos guardias con return silencioso de
  guardarFirmaBase64 quedan inalcanzables aqui pero la Tarea 4 los reusa en el
  PUT; ahi el UpdateRequest ya lleva la misma regla de forma por ruling
  anterior.
Task 2: fix round 2/5 (1 atendido, 0 abiertos — lista blanca de tipos,
  extension por match, archivo comprobado en disco, codigo muerto fuera;
  control negativo: SVG y cabecera sin cuerpo se aceptaban antes;
  commits b313bca..bdcd6de)
Task 2: el re-revisor confirmo el punto central: una firma real de
  toDataURL("image/png") pasa (base64 con relleno '=' incluido, ~90
  caracteres de cuerpo contra el minimo de 16) y data:image/svg+xml se
  rechaza. Sin falsos negativos para los tres tipos permitidos.
Task 2: minor (deferred, PARA LA REVISION FINAL): la regex cierra con `$`, que
  en PHP sin el modificador D tambien acepta un salto de linea final; y
  {16,} admite un cuerpo de solo '=' que decodifica a vacio. Ninguno es
  explotable: lo peor es un archivo de cero bytes. Se aprietan los DOS
  Form Request de una vez en la ola de arreglos final, con
  [A-Za-z0-9+/]{16,}={0,2}\z, para que la regla de crear y la de editar no
  queden distintas. Arreglarlo ahora costaria una tercera vuelta sobre esta
  tarea y dejaria las dos reglas desalineadas hasta la Tarea 4.
Task 2: minor (deferred): el nombre de la prueba del dataset promete solo SVG
  y cubre tambien text/html. Cosmetico.
Task 2: complete (commits 17537c4..bdcd6de, revision limpia)
Task 3: despachada (BASE bdcd6de, modelo sonnet — agrupamiento por dia,
  paginacion de dias y cuatro filtros: es logica, no transcripcion)
Task 3: DONE_WITH_CONCERNS (commit 2449da0, 37 pruebas 117 asertos en la
  carpeta del modulo; roja previa: 15 fallos por 405)
Task 3: cinco inquietudes adjudicadas, cuatro son defectos de MI plan:
Task 3: Ruling: (2) filasDeLosDias traia el rango completo entre el dia mas
  viejo y el mas nuevo de la pagina. Mi plan lo justificaba por escrito
  diciendo que «los dias de una pagina son pocos»: es FALSO con filtros
  dispersos — un buscador que acierte un dia por mes hace que diez dias
  abarquen casi un anio y traiga cientos de registros para pintar diez
  renglones. Pasa a whereIn(DB::raw(self::DIA), $dias), que es el mismo
  mecanismo que ya usa consultaFiltrada, asi que no agrega concepto nuevo.
  Si me equivoco, un IN con cien dias es mas lento que un BETWEEN; a cambio
  nunca trae lo que no va a usar.
Task 3: Ruling: (1) diasIncompletos sacaba una fila por registro sin firmar de
  TODA la tabla y deduplicaba en PHP, sin tope. Ahora agrupa en la base con
  selectRaw+distinct y devuelve dias. Si me equivoco no cuesta nada: misma
  semantica, menos filas.
Task 3: Ruling: (3) per_page solo tenia piso. Techo de 100 con su prueba. Si
  me equivoco, alguien que quisiera 200 dias de un jalon tendra que paginar.
Task 3: Ruling: (4) tiene razon y es una critica fina — la prueba de falta_fbo
  NO puede distinguir filtrar por dia de filtrar por registro, porque para
  ese filtro los dos dan el mismo conjunto de dias. La que vigila la
  diferencia es «completas», y existe. La prueba se renombra por lo que si
  comprueba y gana el caso del dia enteramente firmado, en vez de quedarse
  prometiendo una garantia que no da.
Task 3: Ruling: (5) hizo bien en NO agregar el use de MorphToMany: mi pliego
  lo listaba y el codigo no lo usa. Sin cambio.
Task 3: revision (sonnet) — spec OK, calidad aprobada, 0 Critical, 0
  Important, 7 menores. Confirmo lo que me preocupaba: la prueba de
  «completas» SI distingue filtrar por dia de filtrar por registro, y la de
  paginacion si distingue dias de registros.
Task 3: los tres avisos de «no verificable» resueltos: status es asignable en
  masa (esta en el fillable de la Tarea 1), tieneFirmaDe y activas quedaron
  probados en la Tarea 1, y la autorizacion mas fina llega en la Tarea 4
  (editar y eliminar), que es donde corresponde.
Task 3: Ruling: SUBO los menores 1, 2 y 3, que son la misma patologia de toda
  la sesion — pruebas que seguirian verdes sin la garantia que dicen vigilar.
  Pesa que las Tareas 4 y 5 van a editar ESTE controlador, asi que el
  guardia del activas() vale ahora y no solo en la revision final. Son
  cambios solo de prueba, en un archivo. Si me equivoco, el costo es una
  vuelta de arreglos de prueba.
Task 3: minor (deferred, PARA LA OLA FINAL): el query string del index no se
  valida — un ?search[]=x revienta en ->string() con 500 en vez de 422, y %
  y _ en search funcionan como comodines. Falta el FormRequest que pide el
  CLAUDE.md. Se junta con los dos aprietes de regex ya diferidos para hacer
  UNA ola de endurecimiento de validacion, en vez de tres vueltas sueltas.
  Sin consecuencia de seguridad: todo va con bindings.
Task 3: minor (deferred): diasIncompletos hace una ida aparte a la base en vez
  de una subconsulta. Con volumenes de seguridad es holgado.
Task 3: minor (deferred): el bloque de comentario dentro de index() no es
  PHPDoc. Lo mandaba el plan y es cosmetico.
Task 3: minor (deferred): la correccion del whereIn frente al rango no tiene
  prueba y no puede tenerla — misma salida, distinto coste. Queda el docblock.
Task 3: fix round 2/5 (3 atendidos, 0 abiertos — las tres pruebas vigilan de
  verdad su garantia, comprobado por mutacion: sin activas() da «2 is
  identical to 1», sin sortByDesc da «3 is identical to 1», y con where en
  vez de whereDate desaparece el 2026-11-05. El re-revisor confirmo que cada
  rojo corresponde al defecto vigilado y no a otro motivo; commits
  5645e12..1e40891)
Task 3: verificado por mi — 1e40891 toca solo el archivo de prueba y el
  controlador es identico byte a byte entre 5645e12 y 1e40891, asi que las
  tres mutaciones se revirtieron bien.
Task 3: minor (deferred): el borde INFERIOR del rango a 00:00 no discrimina
  where de whereDate (como cadena, el datetime de medianoche si es mayor que
  la fecha). El unico borde que distingue es el superior, y ese si esta
  cubierto. La prueba vale, pero su nombre promete dos bordes y vigila uno.
Task 3: minor (deferred): las tres pruebas nuevas quedaron al final del
  archivo y no junto a sus hermanas. Estetico.
Task 3: complete (commits bdcd6de..1e40891, revision limpia)
Task 4: despachada (BASE 1e40891, modelo sonnet — tres metodos, permisos en el
  servidor y la forma del detalle). Pliego re-extraido para que incluya los
  arreglos de seguridad de la Tarea 2 que ya se llevaron al plan.
  Se le pidio comprobacion por mutacion de las dos pruebas de permisos.
Task 4: DONE_WITH_CONCERNS (commit 43f5468, 58 pruebas 162 asertos; roja
  previa: 15 fallos por 404 de ruta ausente)
Task 4: comprobacion de permisos por mutacion OK — sustituyendo la revision
  de rol por `false`, las dos pruebas del empleado recibieron 200 en vez de
  403. Vigilan el permiso y no otra cosa.
Task 4: Ruling: NO subo la inquietud 1 (un empleado con datos invalidos recibe
  422 antes que 403, porque el Form Request corre antes que la revision de
  rol). Su arreglo propuesto —mover la revision a authorize()— es mas
  idiomatico, pero: no hay escritura ni fuga, el proyecto revisa roles en el
  controlador por costumbre (OperacionesDiariasController:660), y `eliminar`
  no tiene Form Request, asi que moverlo partiria el patron entre dos sitios.
  Queda diferido. Si me equivoco, el coste es que un cliente mal escrito lea
  «dato invalido» donde esperaba «no tienes permiso».
Task 4: Ruling: SI arreglo la inquietud 2. Su prueba del 404 pasaria tambien
  si alguien borrara la ruta, porque Laravel devuelve 404 sin ruta: daria por
  vigilado un guardia que ya no corre. Se asserta el mensaje, que solo
  escribe el controlador, y se extiende a show y update, que tenian el mismo
  hueco y ni prueba. Una linea por prueba. Si me equivoco, el coste es que
  cambiar el texto del mensaje rompa tres pruebas.
Task 4: revision (sonnet) — spec NO CUMPLE por un hallazgo Important, calidad
  «needs fixes». 0 Critical, 1 Important, 4 menores.
Task 4: Ruling CORRECTOR: mi ruling del prepareForValidation era FALSO. Dije
  que hacia falta pasar '' a null porque `nullable` no se salta la regex con
  cadena vacia. Verificado en el framework: ConvertEmptyStringsToNull esta en
  la pila global (Foundation/Configuration/Middleware.php:462) y
  bootstrap/app.php no lo quita, asi que '' llega como null y mi condicion
  nunca se cumplia. Codigo inalcanzable con una prueba que pasaba sin el, y
  con un docblock mio afirmando lo contrario. Sexto caso de prueba-que-no-
  prueba de la sesion, y el primero que invente de cero en vez de heredarlo.
  Se quita el metodo; la prueba se queda con su comentario corregido, porque
  el comportamiento de punta a punta si vale y avisaria si alguien
  desactivara el middleware.
Task 4: Ruling: SUBO el menor 2 — no habia prueba de que un relevo eliminado
  deje de poder verse y editarse, asi que quitar el activas() de show o de
  update no rompia nada. Un borrado que no borra. Dos asertos en una prueba.
Task 4: Ruling: SUBO el menor 1 — whereNumber('id') en las tres rutas. Los
  metodos reciben int $id, asi que /abc revienta con TypeError y 500 en vez
  de 404. Una palabra por ruta, y deja el prefijo libre para rutas literales
  como «pendientes», que llega en la Tarea 5.
Task 4: Ruling: el aviso de que un fbo o admin puede reemplazar tambien la
  firma de quien entrega se QUEDA como esta. La spec da a fbo y admin derecho
  de edicion sobre el registro y no excluye las firmas; restringirlo seria
  inventar una regla que el usuario no pidio. El riesgo esta mitigado: la
  firma anterior no se borra, queda en el pivote con status N, asi que el
  reemplazo es auditable. Si me equivoco, un FBO puede sustituir la firma de
  otra persona y solo se nota mirando el historial del pivote.
Task 4: minor (deferred): los archivos de firma escritos por
  guardarFirmaBase64 no se revierten si la transaccion falla despues.
  Quedarian huerfanos en el disco. Poco probable y de bajo impacto; cerrarlo
  bien pide una estrategia de limpieza, no un parche.
Task 4: minor (deferred): el controlador acumula cuatro tareas y empieza a
  pedir partirse. El propio revisor recomienda extraer las firmas a un
  servicio en la tarea SIGUIENTE y no antes. La Tarea 5 solo agrega
  «pendientes» y las Tareas 6 a 10 son de navegador, asi que ya no crece
  mucho mas: lo valora la revision final de rama, que vera el archivo entero.
Task 4: fix round 2/5 (3 atendidos, 0 abiertos — prepareForValidation fuera
  con nota de por que no debe volver, prueba del relevo eliminado con
  mutacion por endpoint, whereNumber en las tres rutas; commits
  5fbef9f..2f2eaf6)
Task 4: el re-revisor confirmo que el comentario nuevo de la prueba de la
  firma vacia describe con exactitud lo que si vigila, y que la prueba del
  relevo eliminado rompe por separado en show y en update.
Task 4: Ruling: la deuda del whereNumber sin prueba la recoge la Tarea 5 en
  vez de una vuelta propia. Es la misma clase de defecto (garantia que nadie
  vigila) pero son dos lineas, y la Tarea 5 ya toca routes/api.php. Llevado
  al plan como un paso explicito para que el pliego lo arrastre.
Task 4: complete (commits 1e40891..2f2eaf6, revision limpia)
Task 5: DONE (commit 985cead, 68 pruebas 184 asertos; las dos mutaciones
  pedidas fallaron como se esperaba)
Task 5: revision (sonnet) — spec OK, calidad «needs fixes». 0 Critical, 1
  Important, 5 menores. Confirmo que la prueba de orden SI distingue
  fecha_hora de id (el nuevo se crea primero), y que no hay N+1.
Task 5: Ruling: el Important entra. El filtro firmables.rol de pendientes() no
  tenia quien lo vigilara — todas las firmas de prueba eran del FBO. Y la
  consecuencia es peor que una prueba floja: store adjunta la firma de quien
  entrega a TODOS los relevos, asi que sin el filtro cada relevo contaria
  como firmado y la cola del FBO quedaria SIEMPRE VACIA, con la funcion
  entera muerta y la suite en verde. Septimo caso de la sesion. El ayudante
  pasa a recibir el rol por parametro (firmarConRol, nombre comprobado libre).
Task 5: Ruling: SUBO el menor del orden inestable. Frente y atras pueden
  compartir fecha_hora y entonces el orden lo decide la base y cambia entre
  corridas: una cola de trabajo que se reordena sola. Un ->orderBy('id') de
  desempate y su prueba.
Task 5: Ruling: SUBO el menor del whereNumber parcial. Solo GET /{id} tenia
  guardia; PUT y eliminar no. Misma deuda una capa mas abajo. Pasa a un
  dataset de las tres rutas.
Task 5: Ruling: el aviso de que pendientes() no exige rol se QUEDA sin
  revision de rol. No filtra nada nuevo: index y show ya estan abiertos a
  cualquiera con sesion por decision de la spec, y la cola es una vista de
  conveniencia sobre datos ya legibles. Anadir un rol aqui y no en index
  seria incoherente. Si me equivoco, un empleado puede ver que relevos le
  faltan por firmar al FBO, que ya puede ver en el listado.
Task 5: minor (deferred): el nombre de tabla «firmables.» va escrito a mano en
  la consulta. Se rompe en silencio si la relacion cambia. Se arregla con el
  scope del modelo que propone el revisor, dentro de la limpieza del
  controlador.
Task 5: minor (deferred): pendientes no tiene paginacion ni limite. Una cola
  sin firmar de meses crece sin tope. No se toca ahora porque cambiaria la
  forma de la API y la Tarea 10 tendria que manejarla; lo valora la revision
  final con la pantalla ya hecha.
Task 5: minor (deferred): los ayudantes «pendientes» y «relevoEn» son
  genericos y globales de la suite. Hoy no chocan (comprobado), pero un
  homonimo futuro en otra carpeta daria el fatal que el sufijo de
  usuarioFboDePendientes quiso evitar.
Task 5: minor (deferred): el controlador pide partirse. El revisor propone un
  scope sinFirmaFbo() en el modelo, un recurso para el mapeo, y las firmas a
  un servicio. Las cinco tareas que quedan son de navegador y no lo tocan,
  asi que la limpieza no bloquea nada: lo valora la revision final de rama,
  que vera el archivo entero de una vez.
Task 5: fix round 1/5 (3 atendidos, 0 abiertos — filtro de rol con prueba que
  usa SOLO la firma de quien entrega, desempate por id, dataset de las tres
  rutas; commits 985cead..77fca6f)
Task 5: el re-revisor no encontro ningun camino por el que el filtro de rol
  pudiera caerse sin prueba, y confirmo que el renombrado no cambio el rol de
  ninguna llamada existente.
Task 5: dato de campo que vale mas que la mutacion: al restaurar la mutacion A
  el implementador perdio el ->orderBy('id') por accidente y la prueba nueva
  del desempate LO DETECTO. Deteccion real, no provocada.
Task 5: minor (deferred): la prueba del desempate discrimina en sqlite porque
  sin el orderBy devolvio [2,1]. En un motor que por casualidad devuelva por
  id al empatar, podria pasar sin el desempate. Produccion es MySQL, asi que
  la prueba protege menos alla que aqui. El comportamiento es correcto en los
  dos; lo que varia es la vigilancia.
Task 5: complete (commits 2f2eaf6..77fca6f, revision limpia)

## Servidor completo: 5 de 10 tareas, 72 pruebas, 188 asertos

## Suite COMPLETA en verde tras cerrar el servidor

2574 passed (5135 assertions), 182.09s, ARTISAN_EXIT=0 leido de artisan y no
de tail. Guardada en suite-completa.txt.

Comprobacion cruzada: antes de la rama la suite daba 2502 pruebas y 4947
asertos. La diferencia es 72 pruebas y 188 asertos, exactamente lo que el
modulo agrego. Eso descarta a la vez una colision de ayudantes de Pest,
una rotura en el resto del proyecto, y una prueba nueva que no se hubiera
registrado.

Task 6: despachada (BASE 6f129be, modelo sonnet — primera de navegador).
Task 6: Ruling: el plan mandaba importar el ayudante de ruta
  entregaTurnoSeguridad antes de que existiera. resources/js/routes/ esta en
  .gitignore (linea 8) y lo genera Wayfinder al compilar, y el implementador
  no tiene permiso para compilar: se habria atascado ante un import roto sin
  motivo visible. Se agrega un paso de php artisan wayfinder:generate ANTES
  del import, que es artisan y no compilacion. Si me equivoco, el coste es un
  comando de mas que no hace dano.
Task 6: DONE_WITH_CONCERNS (commit ab6cfde, tsc con exactamente el error de
  base; wayfinder:generate --with-form corrio bien y el ayudante quedo
  disponible; nada generado se commiteo)
Task 6: Ruling: el fechaHoy del plan era un defecto GRAVE y el implementador
  acerto al quitarlo. resources/js/lib/fechaHoy.ts toma el dia del SERVIDOR
  porque es el mismo reloj con que valida DentroDeLaVentana, y
  tests/Feature/FechaHoyTest.php:281 exige que sea la unica definicion. Mi
  version con la zona del equipo rompia esa prueba y reintroducia el 422 que
  el ayudante existe para evitar — en el modulo que estrena ventana de fecha
  en la Tarea 8. Las Tareas 7, 9 y 10 importan de @/lib/fechaHoy.
Task 6: Ruling: horaAhora SE QUEDA con el reloj del equipo. El dia viene del
  servidor y la hora del equipo, lo que parece incoherente, pero el propio
  docblock de fechaHoy dice que el reloj del equipo sigue corriendo desde el
  ancla del servidor, asi que es su mismo modelo. La ventana valida el dia,
  no la hora, asi que no hay 422; lo peor es una hora propuesta con el
  desfase del equipo, visible y corregible a mano. Si me equivoco, alguien
  con el reloj mal guarda una hora equivocada que nadie corrige.
Task 6: Ruling: wayfinder:generate lleva --with-form. vite.config.ts usa
  formVariants: true, asi que sin la bandera desaparecen las variantes .form
  de login, delete-user y otras, y tsc pasa de un error a decenas. Llevado al
  plan.
Task 6: Ruling: store pasa a devolver detalle(), como update. Devolver el
  modelo crudo en POST y el detalle en PUT son dos formas del mismo recurso y
  obligan a tipar una como unknown. Las pruebas de la Tarea 2 no asertan el
  cuerpo, asi que no se rompe ninguna.
Task 6: Ruling: fuera el data-puede-editar. Era para que puedeEditar no
  quedara sin usar, pero tsconfig tiene noUnusedLocals COMENTADO: una
  variable sin leer no es error. Un atributo del DOM sin significado para
  callar un error que no existe es peor que la variable.
Task 6: Ruling: orden fuera del tipo FirmaRelevo. Viene del pivote sin cast y
  nadie lo lee. Tiparlo seria prometer sin comprobar, para un dato que no se
  usa.
Task 6: Ruling: el GET /eliminar que cambia estado SE QUEDA. Es un riesgo real
  de CSRF, pero: es la convencion del proyecto en al menos siete modulos,
  config/session.php deja same_site en «lax», asi que una peticion embebida
  (img, script) NO lleva la cookie y el ataque exige que la victima pulse un
  enlace. Desviarse solo aqui dejaria la API incoherente. Se abre tarea
  aparte para todo el proyecto. Si me equivoco, un enlace malicioso pulsado
  por un FBO borra un relevo, que es recuperable: el borrado es logico.
Task 6: arreglo previo a la revision hecho (commit 506c3db — store devuelve
  detalle(), fuera el data-puede-editar y fuera `orden` del tipo). 72 pruebas
  siguen en verde y tsc con solo el error de base. Informe puesto al dia con
  las inquietudes obsoletas marcadas, no borradas.
Task 6: verificado por mi — las tres respuestas del controlador (crear,
  detalle, editar) pasan ya por detalle(), y no quedan data-puede-editar ni
  `orden` en los tipos.
Task 6: revision (sonnet) — spec OK, calidad APROBADA, 0 Critical, 0
  Important, 5 menores. Comparo los tipos campo por campo contra las cinco
  respuestas del controlador: coinciden.
Task 6: el aviso de FechaHoyTest resuelto por mi — corri la prueba y pasa (37
  pruebas, exit 0). El comentario que menciona fechaHoy no tropieza con ella.
Task 6: Ruling: SUBO tres de los cinco menores porque son los cimientos de la
  Tarea 7, no pulido:
  - leerJson tiraba los errors y el status de un 422: el formulario no podria
    pintar un error por campo ni distinguir 403 de 404 de 422, que el servidor
    manda con la misma forma {message}. Pasa a ErrorDeApi con status y errors.
  - store() no refrescaba y update() si. create() devuelve solo los atributos
    pasados, asi que omitir pernocta_mensual dejaba el valor por omision de la
    columna sin cargar y el 201 devolvia null donde el tipo promete S|N|R. Un
    tipo que miente, justo lo que habia pedido evitar. Ninguna prueba lo
    atrapaba: las de la Tarea 2 releen la base, no la respuesta.
  - el payload iba como Record<string, unknown>. Sin pruebas de JavaScript, un
    nombre de campo mal escrito llega a produccion y el servidor lo descarta
    al validar, perdiendo el dato en silencio.
Task 6: minor (deferred): FirmaRelevo.rol es string y no una union de los dos
  roles. No miente y las Tareas 9 y 10 comparan contra las constantes.
Task 6: minor (deferred): horaAhora esta duplicada con
  pages/despacho/operacionesProgramadas/types.ts:94. Su sitio seria lib/,
  junto a fechaHoy, pero mudarla obliga a tocar un modulo ajeno. Cuatro
  lineas de funcion pura contra acoplar los tipos de dos areas.

## Leccion de operacion, culpa mia

NO lanzar `npm run build` mientras un implementador esta vivo. El plugin de
Wayfinder regenera resources/js/actions durante la compilacion, asi que un
`tsc` simultaneo lee esa carpeta a medio escribir y saca errores TS2307
fantasma sobre Settings/ProfileController y PasswordController. Paso en la
Tarea 6 porque lance la compilacion en el mismo turno en que pedi el informe.
De la 7 a la 10: compilar solo cuando no haya nadie corriendo.
Task 6: fix round 2/5 (3 atendidos, 0 abiertos — ErrorDeApi con status y
  errors, fresh() en store(), payload tipado; commits 506c3db..8a505da)
Task 6: evidencia final del navegador, levantada por mi SIN nadie corriendo:
  npm run build exit 0 en 2m45s; npx tsc --noEmit con exactamente el error de
  base TS1117 en WalkAroundController.ts:905.
Task 6: minor (deferred): un 200 con cuerpo que no es JSON vuelve como {} y
  leerJson lo da por exito, asi que el consumidor leeria data indefinido. Ya
  existia antes del arreglo y el servidor siempre manda JSON.
Task 6: Ruling: el re-revisor destapo que el tipado del payload NO protege si
  el formulario lo arma con spread por una variable sin anotar — TypeScript
  solo comprueba propiedades sobrantes en literales frescos. Mi plan de la
  Tarea 7 lo armaba justo asi, asi que el tipado que acabamos de agregar
  habria sido de adorno. Corregido en el plan: la variable va anotada. Si me
  equivoco no cuesta nada: una anotacion de mas.
Task 6: Ruling: el formulario lee los errores con instanceof ErrorDeApi y no
  suponiendo que todo error trae status. Un fallo de red lanza un TypeError
  pelado desde fetch. Llevado al plan con el manejo de 403 y 404 por separado.
Task 6: complete (commits 6f129be..8a505da, revision limpia)
Task 7: DONE_WITH_CONCERNS (commit 4c9c97f; tsc con exactamente el error de
  base. FormEntregaTurno.tsx 284 lineas, EntregaTurno.tsx 72. Ninguno pasa de
  300.)
Task 7: Ruling: ACEPTO su desvio del pliego. La firma de quien entrega es
  obligatoria al crear y opcional al editar. El servidor ya lo decia
  (sometimes|nullable en el UpdateRequest) y mi pliego no distinguia los dos
  modos. Exigirla al editar obligaria a redibujar la firma de otra persona
  para corregir una casilla: falsificarla. Llevado al plan.
Task 7: Ruling: la firma guardada SE ENSENA, pero lo recoge la Tarea 8 en vez
  de una vuelta propia: la 8 ya toca FormEntregaTurno.tsx para colgar la
  ventana de fecha. Importa porque quien edita puede dibujar encima de una
  firma buena sin saber que existia, y el dato esta en firmas[].url. Lleva
  nota de que reemplazar no destruye: el servidor retira la anterior con el
  pivote en N.
Task 7: los avisos 3 y 4 son aciertos suyos, no hallazgos: dos payloads
  anotados uno por modo (que es exactamente lo que pedi), y remontaje por
  `key` mas null al cerrar para que el estado no arrastre lo escrito antes.
Task 7: el aviso 7 resuelto por mi — .gitattributes dice `* text=auto eol=lf`
  y los tres archivos del modulo ya estan en LF dentro de git. El aviso de
  CRLF era git cumpliendo lo que el repositorio manda. Sin accion.
Task 7: minor (deferred): el modal no cierra con Escape, igual que el de
  MovimientoAvionesCSAE. Consistente con el proyecto.
Task 8: Ruling (hallado por mi en el chequeo previo, leyendo el docblock de
  useVentanaDeFecha): DentroDeLaVentana NO conoce el valor anterior, juzga la
  fecha que llega. Mi plan ponia la regla sin condicion en el UpdateRequest y
  el formulario manda fecha_hora siempre, asi que un PUT sobre un relevo de
  hace tres dias daba 422 y el FBO no podria firmar justo los relevos que la
  cola de pendientes saca a flote, ordenados de mas viejo primero. La cola
  habria quedado inservible para su caso principal.
  El proyecto ya lo resolvio: spec de ventanas seccion 5 bis, «no puedes
  PONER una fecha fuera de ventana, pero puedes DEJAR la que ya estaba», con
  el patron en MovimientoCSAEController:251 y 307-312. Se adapta al Form
  Request. Cuatro pruebas nuevas, incluida la del lavado de fecha.
  Si me equivoco, el coste es una condicion de mas en las reglas.
Task 8: DONE_WITH_CONCERNS (commit d6c73c0, seis archivos en un solo commit)
Task 8: resultados — 80 pruebas 203 asertos en la carpeta del modulo (72 + 8);
  VentanasDeFechaTest 27 pruebas 186 asertos EN VERDE, que es la que vigila
  que no rompimos la politica compartida de doce modulos; tsc con solo el
  error de base, comprobado dos veces.
Task 8: la mutacion CONFIRMO el defecto que predije: poniendo `true` donde va
  $this->cambiaElDia(), la prueba «el FBO puede firmar un relevo viejo
  dejando su fecha» falla con 422. Las otras tres de edicion siguen pasando,
  asi que cada una vigila lo suyo.
Task 8: Ruling: ACEPTO su correccion del pliego. Mi prueba usaba
  firmaBase64Valida() de otro archivo: en Pest eso funciona con la suite
  completa pero no al correr el archivo suelto. Un archivo de pruebas que
  depende de que otro se haya cargado es fragil; tres copias de un PNG de un
  pixel cuestan menos que esa dependencia escondida. Llevado al plan.
Task 8: revision (sonnet) — spec OK, calidad APROBADA, 0 Critical, 0
  Important, 4 menores. Confirmo los CINCO sitios de la clave y que la
  mutacion corresponde al defecto vigilado.
Task 8: build exit 0 en 2m31s.
Task 8: los dos avisos resueltos por mi — FirmaRelevo SI tiene url (el
  revisor no lo veia en el diff), y el desfase del plan con
  firmaBase64Valida ya estaba corregido en e641654, antes de su revision.
Task 8: analisis del revisor que vale apuntar: la prueba del «lavado» pasa por
  la razon correcta pero es REDUNDANTE — cualquier implementacion que compare
  contra lo guardado en ese momento la satisface, y «otra fecha vieja» ya
  cubre lo mismo. Lo unico que agrega es comprobar el estado persistido tras
  el rechazo. Se queda: documenta explicitamente la propiedad que la spec de
  ventanas nombra, y es honesta. Pero su valor de cobertura es menor del que
  yo le atribui al escribirla.
Task 8: Ruling: SUBO el menor del tamanio. FormEntregaTurno.tsx quedo en 313
  lineas, por encima del limite de 300 que yo mismo puse en el plan y repeti
  en el despacho. Las Tareas 9 y 10 no tocan ese archivo, asi que si no se
  extrae ahora se queda asi para siempre. Se saca FirmaActual a su propio
  archivo. Ignorar un limite que yo enuncie en voz alta, sin motivo, es la
  clase de deriva silenciosa que llevo toda la rama persiguiendo.
Task 8: Ruling: SUBO dos huecos de cobertura de la edicion, los dos del caso
  real del FBO firmando: mismo dia con otra hora sobre un relevo viejo (debe
  pasar, y documenta que la comparacion es por DIA y no por instante), y
  fecha_hora ausente en un PUT (el caso de mandar solo la firma).
Task 8: minor (deferred): un relevo retirado o inexistente con fecha vieja da
  422 antes del 404, y un usuario sin rol da 422 antes del 403, porque el
  Form Request corre antes que el controlador. Mismo caso que ya diferi en la
  Tarea 4 y por el mismo motivo: no hay escritura ni fuga, solo un orden de
  respuestas.
Task 8: fix round 1/5 (2 atendidos, 0 abiertos — FirmaActual extraido sin
  cambio de comportamiento, formulario a 299 lineas, dos pruebas de edicion;
  commits d6c73c0..46fbf4f)
Task 8: Ruling: el Minor del re-revisor va al despacho de la Tarea 9 en vez de
  un ciclo propio. El comentario de la prueba del PUT sin fecha_hora atribuye
  al `sometimes` un comportamiento que Laravel da igual: `date` y
  DentroDeLaVentana no son reglas implicitas, asi que se saltan solas cuando
  el campo falta, y la prueba pasaria incluso quitando el `sometimes`. La
  prueba protege el flujo; lo que miente es una clausula del comentario. Es
  una linea y la Tarea 9 no toca ese archivo, pero gastar un despacho y una
  re-revision en un comentario seria desproporcionado.
Task 8: complete (commits 995f321..46fbf4f, revision limpia)
Task 9: Ruling (chequeo previo): etiquetaPeriodo ya existe dos veces en el
  proyecto, tipada contra el tipo de filtros de cada modulo. La tercera copia
  es el patron, no un olor; unificarlas pediria tocar dos modulos ajenos. Se
  tipa contra el RangoPeriodo que ModalPeriodo exporta.
Task 8: evidencia final del navegador: npm run build exit 0 tras el arreglo.
Task 9: DONE_WITH_CONCERNS (commit 6076a35; tsc con solo el error de base,
  82 pruebas 208 asertos). Informe con salida literal tras pedirselo.
Task 9: partio la tabla por su cuenta al llegar a 324 lineas — saco
  CeldasRelevo.tsx (58) y PaginadorRelevos.tsx (59), y dejo
  TablaEntregaTurno.tsx en 290, SelectorSeccion.tsx en 62, types.ts en 149 y
  la pagina en 99. Los seis bajo el limite de 300. Era lo pedido: decidirlo
  al escribir y no refactorizar despues.
Task 9: resolvio por su cuenta un caso borde que yo no habia previsto — al
  borrar el ultimo renglon de la ultima pagina, la tabla retrocede a la
  ultima pagina que exista en vez de quedarse en una vacia.
Task 9: Ruling: acepto que un 404 al eliminar solo recargue la lista sin
  avisar. Si otro ya lo borro, recargar ES la recuperacion correcta: el
  renglon desaparece, que es lo que el usuario queria. Si me equivoco, alguien
  se queda sin saber por que su clic no hizo nada visible.
Task 9: minor (deferred): los filtros de seccion y estado no alinean uno a uno
  con sus columnas, porque cada fila es un dia completo y esos filtros no son
  de columna. Es una rareza visual real y solo se juzga mirando la pantalla:
  va a la revision final y a la verificacion en navegador.
Task 9: los avisos 1, 2 y 6 sin accion — la vista previa es de la Tarea 10, el
  borrado por GET ya tiene su chip para todo el proyecto, y los finales de
  linea los resolvi en la Tarea 7 (.gitattributes normaliza a LF).
Task 9: revision (sonnet) — calidad APROBADA. 0 Critical, 1 Important
  (plan-mandated), 9 menores. Comparo la tabla contra la API real: los campos
  existen, extras se trata bien, pernocta_mensual nunca llega null (char(1)
  con default R).
Task 9: el revisor confirmo cosas que no le pedi y valen: el efecto usa una
  bandera `vigente` mas clearTimeout, asi que una respuesta lenta NO pisa una
  mas nueva; y el 404 al eliminar se distingue con instanceof ErrorDeApi.
Task 9: Ruling: el distintivo se queda en TEXTO y corrijo la spec, no el
  codigo. Mi spec decia ✓/⏳ y el fragmento de mi plan decia «Firmado»/«Falta
  FBO»; el implementador siguio el fragmento. Gana el texto porque las tablas
  del proyecto usan etiquetas de texto, un reloj de arena no dice QUE falta, y
  un simbolo solo no se lee en voz alta. ES un cambio sobre algo que el
  usuario aprobo, asi que se lo señalo explicitamente por si prefiere los
  simbolos.
Task 9: Ruling: los registros extra de una seccion NO se pueden editar ni
  eliminar desde la pantalla, y mi spec prometia que el selector los listaria.
  El diseño no lo permite: el renglon lleva un solo id por seccion. Corrijo la
  SPEC en vez de inventar API nueva: el caso es raro por construccion («cero
  casi siempre» lo dice la propia spec) y cerrarlo es trabajo de API, tipos,
  selector y pruebas. Queda como limitacion conocida, dicha al usuario. Si me
  equivoco, un relevo duplicado queda inalcanzable hasta que se amplie la API.
Task 9: fix round 1/5 (5 atendidos — pie del paginador tras error, demora solo
  en el buscador, editar recarga en 404, selector no se abre sin secciones, un
  solo contador; commits 6076a35..996d552)
Task 9: volvio a partir el archivo por su cuenta al subir a 320: saco
  FilaFiltros.tsx (71) y dejo la tabla en 276. Segunda vez que respeta el
  limite sin recordatorio.
Task 9: INTERFAZ NUEVA que la Tarea 10 debe conocer: la tabla gano una prop
  obligatoria `onRecargar: () => void`, que no estaba en el pliego. Hacia
  falta para juntar los dos contadores de recarga en uno. La tabla la llama
  tras eliminar.
Task 9: los finales de linea no son accion — .gitattributes normaliza a LF al
  commitear, verificado en la Tarea 7. Como esten en el disco es indiferente.
Task 9: el re-revisor confirmo los dos juicios pedidos: el corte de
  FilaFiltros esta bien trazado (el estado se queda en la tabla, FilaFiltros
  es presentacion pura con 6 props, y las dos props de cambio responden a una
  diferencia real de comportamiento), y onRecargar es la forma correcta — el
  dueño unico del contador es la pagina, asi que no puede desincronizarse.
Task 9: minor (llevado a la Tarea 10): setPagina(1) va dentro del updater de
  setBusqueda, un efecto dentro de algo que deberia ser puro. Funciona por
  idempotencia y en StrictMode el updater corre dos veces sin dano, pero es
  una trampa para quien lo edite. Una linea; la lleva el despacho de la 10.
Task 9: build exit 0 en 1m25s tras el arreglo.
Task 9: complete (commits 46fbf4f..996d552, revision limpia)
Task 10: Ruling (chequeo previo): los pendientes son un CAJON LATERAL y no un
  modal. El proyecto ya tiene tres pantallas de pendientes y la mas hermana
  (Rampa/checkListEquipo/PendientesDrawer.tsx) consume el mismo tipo de
  endpoint y resuelve esto en 101 lineas, con estado vacio incluido. Mi plan
  decia modal: habria sido inventar otra forma para el mismo problema en el
  mismo proyecto. Sexto acierto del chequeo previo.
Task 10: DONE_WITH_CONCERNS (commit 6a358f8). VistaPreviaEntregaTurno.tsx 162,
  PendientesFirmaFbo.tsx 97, EntregaTurno.tsx 133, TablaEntregaTurno.tsx 274.
  Ninguno pasa de 300 y no hizo falta partir nada.
Task 10: sus seis inquietudes, cinco sin accion — roles bien leidos, el
  onFirmar que cierra el cajon y abre edicion es el flujo previsto, la
  sangria es estetica y pint esta prohibido, usar Python en vez de sed fue
  correcto, y los finales de linea ya estaban resueltos. La sexta (sin
  verificar en navegador) es mia.
Task 10: noto que el pliego pedia la suite completa en su paso 5 y mi despacho
  dijo solo la carpeta: siguio mi instruccion Y me aviso. Orden correcto.

## VERIFICACION COMPLETA tras terminar el plan

Suite completa: 2584 passed (5163 assertions), ARTISAN_EXIT=0, 177.62s
Build: exit 0, 1m34s
tsc: exactamente el error de base TS1117 en WalkAroundController.ts:905

Cuadre contra el estado previo a la rama (2502 pruebas / 4947 asertos):
- +82 pruebas, exactamente las del modulo. No se agrego ninguna en otro sitio.
- +216 asertos, ocho mas que los 208 del modulo. Los ocho son de
  VentanasDeFechaTest: la Tarea 8 agrego una clave a la tabla de ventanas y
  varias de sus pruebas recorren esa tabla, asi que una clave suma asertos
  sin sumar pruebas. Cuadra exacto.

Menores aparcados puestos en limpio y agrupados en ocho temas:
.superpowers/sdd/2026-11-04-entrega-turno-seguridad/menores-aparcados.md
Task 10: revision (sonnet) — spec OK en lo sustancial, calidad APROBADA. 0
  Critical, 1 Important, 4 menores. Comprobo la vista previa contra el
  contrato real de `detalle`: los campos existen, los roles coinciden, y la
  comparacion muerta de 'I' NO se copio.
Task 10: Ruling: el Important entra. Los errores se leen con instanceof Error
  en vez de ErrorDeApi, asi que un fallo de red muestra al usuario el
  «Failed to fetch» del navegador, en INGLES, en una aplicacion en español.
  Son tres sitios: la vista previa, el cajon y la pagina (este ultimo viene de
  la Tarea 9).
Task 10: Ruling: SUBO el menor del ciclo del FBO. Tras firmar vuelve a la
  tabla y tiene que reabrir PENDIENTES para el siguiente. Es el flujo
  PRINCIPAL de la funcion: una cola que te obliga a reabrirla tras cada
  elemento pelea contra su proposito. Un booleano y una condicion. Si me
  equivoco, el cajon se reabre cuando alguien no lo queria.
Task 10: Ruling: SUBO el parpadeo — `cargando` nace en false, asi que al
  cambiar de fila hay un render con contenido vacio antes del loader. Una
  linea, y es visible.
Task 10: Ruling: SUBO su ultima sugerencia, que es el mejor hallazgo de la
  tarea y no se me habia ocurrido: una prueba de Pest que fije la forma de
  `show`. La vista previa lee esas claves POR NOMBRE y tsc no atraparia que
  alguien renombre una en el servidor. Es la UNICA cobertura real disponible
  sin corredor de JavaScript en toda la fase de navegador. Verificado que la
  prueba existente solo fija nombre, hora, fecha y el rol de una firma: no
  cubre las ocho casillas, observaciones, pernocta_mensual ni firmas[].url.
Task 10: fix round 1 (4 atendidos — ErrorDeApi en tres sitios, el ciclo del
  FBO vuelve a la cola, el parpadeo, y la prueba del contrato de show;
  commit a05de93; 83 pruebas 232 asertos; mutacion confirmada: renombrando
  observaciones en el servidor, la prueba nueva falla)
Task 10: ME CORRIGIO un arreglo que dicte. Dije inicializar `cargando` en true
  y no sirve: el primer render con `fila` ya ocurrio con el valor viejo. Lo
  derivo con `cargando || (!error && !detalles)`, que es mejor. Y encontro el
  mismo parpadeo en el cajon, que yo no habia visto, y lo arreglo con
  pendientes === null como estado de carga.
Task 10: Ruling: el tope de 300 lineas NO aplica a los archivos de prueba.
  EditarYEliminarRelevoTest.php quedo en 303 y el implementador pregunto antes
  de partirlo, que fue lo correcto. Lo enuncie de forma amplia («ningun
  archivo pasa de 300») cuando lo que me preocupaba eran los componentes y el
  controlador: un componente de 300 lineas hace varias cosas, un archivo de
  pruebas de 300 son pruebas. Y partirlo exigiria mover tres ayudantes que
  solo viven ahi, lo que daria o duplicacion o la dependencia entre archivos
  de prueba que RECHAZAMOS en la Tarea 8 por fragil. Scope honesto del limite
  en vez de fingir que no lo dije asi. Si me equivoco, ese archivo seguira
  creciendo sin freno.
Task 10: acepto que si `editar` falla viniendo de la cola, la cola se reabra.
  El Swal ya avisa, y la cola se vuelve a pedir al abrirse, asi que el relevo
  borrado desaparece de la lista: es la recuperacion correcta.
Task 10: re-revision — HALLAZGOS ABIERTOS. 1, 3 y 4 atendidos; el 2 no.
Task 10: el re-revisor encontro un CIERRE OBSOLETO que dos revisiones
  anteriores no vieron, y que ninguna prueba ni la compilacion podrian ver:
  onFirmar hace setVeniaDeLaCola(true) y llama editar(id) en el mismo
  instante, asi que esa `editar` ve la bandera en false. Dos consecuencias:
  (a) el `if (veniaDeLaCola)` de su catch es codigo muerto, asi que la
  recuperacion que yo di por buena —reabrir la cola si el relevo ya fue
  borrado— NO ocurre; (b) la bandera queda encendida tras el fallo porque
  cerrarForm no corre, asi que al crear despues un relevo nuevo se le reabre
  la cola sin pedirla. El camino feliz si funciona, porque `guardado` se
  vuelve a crear en el render siguiente.
Task 10: Ruling: entra el arreglo del cierre obsoleto, pasando «venia de la
  cola» como ARGUMENTO en vez de leer el estado, y limpiando la bandera
  incondicionalmente en el catch. Leer estado dentro de una funcion llamada
  en el mismo turno de render es el error de fondo, no la bandera.
Task 10: Ruling: SUBO el menor del cajon. Al reabrir se ve un render con la
  lista vieja, que incluye el relevo recien firmado, antes del loader. Eso
  mina exactamente lo que el arreglo 2 vino a conseguir: que el ciclo se
  sienta terminado. Se pone pendientes en null al CERRAR.
Task 10: Ruling: SUBO la limitacion que señalo del punto 4. toHaveKey solo
  vigila presencia, no tipo: una casilla que pasara de booleano a cadena, o
  una url que llegara null, no se detectarian. Esa prueba es la UNICA red que
  cruza la frontera PHP/TypeScript, asi que una red con agujeros de tipo da
  falsa tranquilidad. Se agregan asertos de tipo.
Task 10: el re-revisor confirmo que el estado `pendientes === null` SI
  distingue cargando de vacio: [] da «¡Al dia!», null sin error da el loader,
  null con error da el error. Sin riesgo de falso «¡Al dia!».
Task 10: y confirmo que el razonamiento con el que me corrigio es correcto,
  revisando los cuatro casos: sin fila devuelve null, con error cae a la rama
  de error, el detalle vacio es truthy y las columnas manejan null, y al
  abrir desde cerrado el primer render ya muestra el loader.
Task 10: fix round 2 (3 atendidos — cierre obsoleto resuelto pasando el dato
  como argumento, el cajon limpia al cerrar, la prueba del contrato vigila
  tipos; commit 6fc656f; 83 pruebas 243 asertos; mutacion confirmada: una
  casilla como cadena da «Failed asserting that '' is of type bool»)
Task 10: CORRIJO una afirmacion suya. Dijo que PERNOCTA_ESTADOS no existe en
  el modelo. SI existe, en EntregaTurnoSeguridad.php:37, y los dos Form
  Request la usan en su Rule::in. Su prueba quedo con las tres constantes
  escritas a mano. No es grave pero si real: si alguien agregara un cuarto
  estado, la validacion lo aceptaria y la lista de la prueba no, asi que
  fallaria sin que nada estuviera roto. Una linea, a la ola final.
Task 10: complete (commits c7fbf5e..6fc656f, con un menor diferido)

## PLAN COMPLETO — las diez tareas cerradas

## VERIFICACION DEFINITIVA sobre la punta de la rama (6fc656f)

Suite completa: 2585 passed (5198 assertions), ARTISAN_EXIT=0, 337.84s
Build: exit 0
tsc: exactamente el error de base TS1117 en WalkAroundController.ts:905

Cuadre final contra el estado previo a la rama (2502 / 4947):
- +83 pruebas = exactamente las del modulo. Ninguna en otro sitio.
- +251 asertos = 243 del modulo + 8 de VentanasDeFechaTest (la clave nueva que
  recorren varias de sus pruebas).
- Y 5198 - 5187 = 11, los asertos de tipo de la ultima vuelta: ocho de las
  casillas booleanas, uno de la url, uno de la pernocta y uno del formato de
  la hora. Exacto, sin residuo.

Diff de la rama: 28 archivos de codigo, 3582 lineas, todas añadidas y sin
borrados. Mas 894 lineas en spec y plan.

Revision final de rama despachada en opus, con el triaje de los 25 menores
aparcados y la pregunta explicita de que deberia comprobarse a mano.

## REVISION FINAL DE RAMA (opus) — «listo con arreglos»

1 CRITICO, 5 Important, 13 menores, mas triaje de los 25 aparcados y una
lista de ocho comprobaciones manuales.

CRITICO verificado por mi linea por linea: el modulo era inalcanzable desde
el menu para todo usuario no administrador, incluidos los 37 fbo.
navigation.ts arma el menu de DOS maneras —una lista a mano para admin
(:168) y una construccion desde los subdepartamentos filtrada por
ROUTE_CONFIG, que descarta en silencio lo que no conoce (:261)—, las dos
excluyentes porque HandleInertiaRequests:79 manda departamentos vacio a los
admin. entregaturnoseguridad no estaba en el mapa. Defecto de MI spec, que
describia una de las dos ramas porque solo lei la seccion de Seguridad de la
lista a mano y nunca el archivo entero. Ninguna de las 2585 pruebas podia
verlo.

## OLA FINAL (opus) — 4 commits: 5aad87d, 681cc2d, 0fc1b14, 8e78d0b

94 pruebas del modulo (261 asertos) con 1 skipped declarado;
VentanasDeFechaTest 27 en verde; tsc con solo el error de base.

Mutacion de la firma de relleno: antes del apriete 201 en verde (el agujero
era real), despues 422. Confirmado.

HALLAZGO NUEVO suyo, bien manejado: la prueba del buscador con mayusculas y
acento FALLA en sqlite. El LIKE de sqlite pliega solo ASCII, asi que el
SANCHEZ que manda el .toUpperCase() del front no empareja con la a acentuada
guardada. En produccion SI funciona (utf8mb4_unicode_ci en
config/database.php:56). Latente y ajeno a este modulo: el mismo
.toUpperCase() esta en cuatro modulos mas. Dejo la prueba con ->skip() y su
razon para que el hallazgo salga impreso en cada corrida.

Sus dos preguntas, verificadas por mi:
(a) CONFIRMADA y es importante: el seeder crea el subdepartamento pero
  HandleInertiaRequests lo filtra con whereIn('id', $userSubIds), asi que el
  usuario tiene que tenerlo ASIGNADO en el pivote. El arreglo del critico es
  necesario y NO suficiente: alguien debe asignarlo desde Usuarios. Hizo bien
  en no inventar una asignacion masiva de los 37 fbo, que es decision de
  permisos y tocaria la base real.
(b) RESUELTA A SU FAVOR: lei los departamentos reales de eolo_plus y existe
  «4 => Seguridad» con ese nombre exacto, asi que su firstOrCreate encontrara
  el existente y no creara duplicado. Hizo bien en pedir confirmacion.
(c) El menu queda sin cobertura automatica, declarado. Fijo la mitad PHP en
  MenuDelModuloTest: el seeder, su idempotencia, y que
  Str::slug('entregaTurnoSeguridad') === 'entregaturnoseguridad', asi que un
  renombre del subdepartamento se caza en vez de apagar el menu en silencio.
(d) El controlador son 446 lineas y la spec afirmaba lo contrario. Corregido
  en la spec (ef9d812) en vez de fingir que se cumple.
