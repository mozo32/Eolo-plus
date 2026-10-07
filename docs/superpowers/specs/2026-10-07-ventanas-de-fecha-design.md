# Ventanas de fecha en los formularios de registro

**Fecha:** 2026-10-07
**Estado:** especificación aprobada, pendiente de plan de implementación
**Alcance:** todo el sistema salvo facturación (que no tiene este problema: sus fechas son de llegada y salida de la operación, no de registro)

## 1. El problema

Hoy **ningún calendario del sistema tiene restricción**. Medido: 81 inputs de fecha en 56
ficheros, y **ninguno** con `min` ni `max`. Cualquiera puede registrar una entrega de turno
con fecha del año que viene, o una llegada de hace seis meses, y el sistema lo acepta en
silencio.

Lo que se quiere: que la fecha de un registro no pueda ser futura, y que hacia atrás solo se
pueda retroceder lo razonable para cada formulario.

## 2. La regla

**Cada formulario tiene una ventana**, no hay una sola regla global. Tres clases:

| Clase | Ventana | Por qué |
|---|---|---|
| Se llena en el momento | hoy y **ayer** | Entrega de turno, check list, préstamos: se capturan mientras ocurren, y un día de margen cubre al que lo cierra a la mañana siguiente |
| Registra un hecho que pudo pasar antes | hasta **3 días** atrás | Llegadas, salidas, walk around: tres días cubren un fin de semana, así que lo del viernes se captura el lunes |
| Operaciones Programadas | **futuro permitido**, sin límite atrás | Es lo contrario de la regla por naturaleza: se programa lo que todavía no ha pasado |

**Nunca se permite el futuro**, salvo en Operaciones Programadas.

**Los filtros de búsqueda y de reportes NO se tocan.** Restringirlos haría imposible consultar
el mes pasado, que es para lo que existen.

## 3. Dónde vive la política

Una clase, `App\Support\VentanasDeFecha`, con la tabla como constante. Cada formulario tiene
una **clave**, y la clase traduce una clave a dos fechas concretas:

```php
'turno.entrega'         => ['atras' => 1,    'futuro' => false],
'operaciones.llegada'   => ['atras' => 3,    'futuro' => false],
'programadas.operacion' => ['atras' => null, 'futuro' => true],
```

**`atras` se cuenta inclusive y en días de calendario**, no en horas: `atras => 1` significa
que el mínimo es *hoy menos un día*, así que valen **hoy y ayer**, dos días en total. `atras => 3`
da cuatro días: hoy y los tres anteriores. El máximo es **hoy**, salvo con `futuro => true`, que
no pone máximo. `atras => null` no pone mínimo. Se dice aquí porque el error de un día es el
fallo clásico de las ventanas de fecha, y las pruebas de §7 atacan justo los bordes.

Tres decisiones dentro de esto, y ninguna es obvia:

**Es código, no configuración en base de datos.** Cambiar una ventana será un cambio con su
diff y su despliegue. Para una regla sobre la integridad de los datos eso es una virtud: queda
escrito quién la cambió y por qué, en vez de aparecer una fila editada que nadie recuerda.

**Una clave desconocida lanza, no asume.** Si alguien pide `operaciones.llegadaa`, la clase
lanza en lugar de devolver un valor por omisión. Un valor por omisión silencioso sería peor que
no tener regla: un formulario quedaría sin restricción, o restringido de más, y nadie se
enteraría hasta que alguien no pudiera trabajar. Es el criterio del `match` sin `default` que
el proyecto ya usa en `CargosEstancia`.

**La excepción se nombra, no se omite.** Operaciones Programadas **está** en la tabla, con
`futuro: true`. No es «el formulario que nos saltamos»: es uno más con su ventana declarada,
para que dentro de un año se vea que fue deliberado.

## 4. El servidor

El proyecto valida **en línea**: solo hay 8 Form Requests y 25 controladores con
`$request->validate([...])`, con reglas del estilo `'fecha' => 'required|date'`. El diseño
encaja en eso en lugar de pedir que lo reescriban.

Una regla de validación, `App\Rules\DentroDeLaVentana`, que recibe la clave y lee la misma
tabla:

```php
'fecha' => ['required', 'date', new DentroDeLaVentana('operaciones.llegada')],
```

Una línea por endpoint, y funciona igual en una validación en línea que dentro de un Form
Request.

**El mensaje dice las dos fechas concretas**, no «fecha inválida»: «La fecha tiene que estar
entre el 05/10/2026 y el 07/10/2026.» Quien lo lea sabe qué hacer sin preguntar.

## 5. El navegador

`HandleInertiaRequests` publica las ventanas ya calculadas, junto a lo que ya publica del
usuario:

```
ventanasDeFecha: { 'operaciones.llegada': { min: '2026-10-04', max: '2026-10-07' }, … }
```

Cada input recibe dos atributos, sin tocar estilos ni estructura:

```jsx
<input type="date" min={ventanas['operaciones.llegada'].min} max={…} … />
```

El peso es despreciable: veintiuna entradas de dos fechas.

**Se eligió esto y no un componente `<InputFecha>` compartido** por el riesgo, no por la
elegancia: los 81 inputs están hechos a mano, cada uno con sus clases, y sustituirlos en código
que ya usa gente puede romper una pantalla visualmente. Dos atributos por sitio se revisan de un
vistazo. Desde aquí se puede crecer hacia el componente sin rehacer nada.

**Límite conocido y aceptado:** una pestaña abierta desde anoche lleva la ventana de ayer, así
que pasada la medianoche el calendario dejaría elegir una fecha que el servidor ya rechaza. No
se resuelve recalculando en el navegador: el reloj del cliente puede estar mal, y entonces el
problema sería peor. **El navegador guía y el servidor decide**; quien se encuentre ese caso
recibe el mensaje con las dos fechas y recarga. Lo que no puede pasar, y no pasa, es que el
dato entre mal.

## 5 bis. Editar un registro que ya existe

**Descubierto al implementar, y no estaba previsto:** varios endpoints de edición **no validaban
la fecha en absoluto**. Al añadir la regla aparece un problema que la ventana sola no resuelve:
si se exigiera siempre, **corregir los pasajeros de un registro de hace una semana daría 422**,
aunque nadie tocara su fecha.

**La regla al editar: no puedes PONER una fecha fuera de ventana, pero puedes DEJAR la que ya
estaba.** Es decir, la validación corre solo cuando la fecha recibida **difiere** de la guardada,
falta, o es ilegible. Verificado con peticiones reales: vieja → la misma pasa; vieja → otra vieja
distinta se rechaza; vieja → hoy pasa; y volver después a la vieja original se rechaza, así que
**no se puede «lavar» una fecha** pasando por una válida.

**Y en la pantalla, el calendario refleja esa misma regla**: `useVentanaDeFecha(clave,
fechaOriginal?)` devuelve la **unión** de la ventana con la fecha que el registro ya tenía, de modo
que editar un registro viejo no queda bloqueado por el navegador. Se eligió así, y no desactivando
la validación nativa del formulario con `noValidate`, porque esos formularios tienen más de ocho
campos `required` que se perderían.

## 5 ter. La regla juzga el MISMO día que se guarda

**Corregido tras un defecto introducido durante la implementación.** La regla llegó a convertir la
fecha a la zona del servidor antes de juzgarla, mientras el cast `date` del modelo guardaba el día
que traía el desfase de la cadena. Con `\"2026-10-08T00:30:00+14:00\"` la regla veía el día 7 en
México, **aceptaba**, y la base guardaba el **8**: mañana. Verificado con peticiones reales.

**La regla no convierte de zona.** Juzga la cadena como la interpretará el modelo, así que lo que se
comprueba y lo que se escribe coinciden por construcción. Una cadena con desfase que caiga fuera de
la ventana **se rechaza**, que es lo correcto: el día que importa es el que queda guardado.

## 6. Qué formulario lleva qué ventana

De los 81 calendarios, **12 son filtros** y **21 llevan ventana**. El resto (48) son rangos de
búsqueda y de reportes identificados por su nombre (`fechaInicio`, `fechaFin`, `desde`, `hasta`,
`startDate`, `endDate`, los de PDF).

### Excepción — futuro permitido

| Pantalla | Clave |
|---|---|
| `despacho/operacionesProgramadas/OperacionProgramadaModal` | `programadas.operacion` |

### Hoy y ayer (1 día atrás)

| Pantalla |
|---|
| `Trafico/checkListTurno/CheckListTurnoForm` |
| `Trafico/checkListTurno/sections/HotTrasComiCoor` |
| `Rampa/entregaTurnoR/RampaForm` |
| `Rampa/Autotanque/SeccionInicio` |
| `Rampa/Autotanque/SeccionCierre` |
| `Trafico/prestamoChalecos/PrestamoChalecoForm` |
| `Rampa/relacionPlanta/PrestamoModal` |
| `seguridad/estacionamientoSubTerraneo/RoundRegisterForm` |

### Tres días atrás

| Pantalla |
|---|
| `Trafico/operacionesDiarias/FormLlegada` |
| `Trafico/operacionesDiarias/FormSalida` |
| `Trafico/operacionesDiarias/OperacionesDiariasForm` |
| `despacho/components/walkAround/WalkAroundForm` |
| `despacho/componentes2/steps/GeneralInfo` |
| `Rampa/Autotanque/EoloForm` |
| `Trafico/servicioComisariato/ServicioComisariatoForm` |
| `seguridad/MovimientoAvionesCSAE/MovimientoCSAEEntrada` |
| `seguridad/MovimientoAvionesCSAE/MovimientoCSAESalida` |
| `seguridad/pernoctaDia/PernoctaDiaForm` |
| `Trafico/controlMedicamento/ControlMedicamentoForm` |

### Las claves

Las claves siguen el patrón `modulo.formulario` —`turno.entrega`, `operaciones.llegada`—, y
**el plan de implementación fija la lista exacta**, una por cada una de las 21 pantallas de
arriba. No se escriben aquí para no tener dos listas que puedan desincronizarse: la de la
tabla de `VentanasDeFecha` es la que manda, y esta especificación dice qué pantalla va en qué
grupo.

### Una pieza más

`pages/DateTimeInput.tsx` tiene que **aceptar y reenviar** `min`/`max`. No es un sitio nuevo: es
el conducto por el que pasan las dos pantallas CSAE de la tabla anterior.

### Los 12 que NO se tocan, y por qué

Se verificaron uno a uno leyendo el código, porque acertar por intuición habría dejado una
pantalla inusable:

| Pantalla | Qué es |
|---|---|
| `operacionesDiarias/OperacionesDiariasIndex:46` | Selector del día que se lista; recarga al cambiarlo |
| `operacionesProgramadas/OperacionesProgramadasIndex:81` | Lo mismo, en la barra de la lista |
| `controlMedicamento/InventoryTable:195` | «Fecha de cierre» **busca** cierres existentes (`onBuscarCierres`), no crea ninguno |
| `controlMedicamento/MedicamentosModule:796, 821, 841` | `filtrosMovimientos`: una fecha y un rango Desde/Hasta |
| `seguridad/PernoctaDia:1523, 1550, 1579` | `filtrosEdicion`: periodo día o rango |
| `seguridad/MovimientoAvionesCSAE:325, 348, 364` | `borrador.fechaInicio`/`fechaFin`: periodo y rango |

## 7. Qué se prueba

- **La política**: una clave conocida da las dos fechas esperadas; **una clave desconocida
  lanza**. Esto último es la red de todo lo demás.
- **La regla de validación**: acepta hoy, acepta el borde de la ventana, **rechaza el día
  anterior al borde** y **rechaza mañana**. Los bordes son donde fallan las reglas de fechas.
- **El futuro**: `programadas.operacion` acepta una fecha futura y **ninguna otra clave lo
  hace**. Una prueba que recorra la tabla entera, para que un formulario nuevo mal declarado
  salga en rojo.
- **Que el endpoint rechaza de verdad**: una petición real con una fecha fuera de ventana
  devuelve 422 con el mensaje que nombra las dos fechas, y **no escribe nada**.
- **Que los filtros siguen libres**: una consulta por un rango del mes pasado sigue
  funcionando. Es la prueba de que no rompimos los reportes.

## 8. Lo que NO entra

- **Un permiso para saltarse la ventana.** Se consideró y se descartó por ahora: si alguien
  necesita registrar algo de hace una semana, la salida es ampliar la ventana de ese formulario
  en la tabla, y queda registrado. Un permiso de excepción invitaría a usarlo en lugar de
  corregir la ventana.
  **(Corregido 2026-10-07: esto decía «un cambio de una línea», y ya no lo es.** Una prueba fija
  la tabla entera con sus 19 valores escritos a mano, así que cambiar una ventana exige tocar
  los dos sitios. Es deliberado: se midió que, sin esa prueba, pasar `csae.entrada` de 3 a 9
  días dejaba la suite en verde, y para una regla de integridad de datos eso pesa más que la
  comodidad de editar un solo renglón.)
- **Recalcular la ventana en el navegador** para la pestaña abierta de un día para otro. Ver §5.
- **Un componente de fecha unificado.** Ver §5.
- **Los 48 rangos de búsqueda y reportes**, ni los 12 filtros de §6.
- **Facturación.** Sus fechas son de llegada y salida de la operación, no de registro, y tienen
  sus propias reglas.

## 9. Decisiones registradas

- La ventana es **por formulario**, no global: el usuario la eligió así tras ver que una regla
  única de «hoy y ayer» impediría capturar el lunes lo ocurrido el viernes.
- La regla vive en **las dos capas**, calendario y servidor. Solo en el calendario sería
  decoración: se salta con las herramientas del navegador o con una petición directa.
- El valor por omisión de los formularios que registran un hecho pasado es **3 días**, elegido
  por cubrir un fin de semana. Queda por confirmar en uso si Control de Medicamento y Pernocta
  necesitan más margen.
