# Ventanas de fecha: lo que dicen los datos que ya hay

Medido el 2026-10-07 contra la base de desarrollo `eolo_plus`, comparando, en cada
tabla, la **fecha que el formulario guarda** con su `created_at` —es decir, cuántos
días después del hecho se registró—. Es la pregunta que decide si una ventana es
holgada o estrecha, y no estaba contestada en ninguna parte.

**Para qué sirve esta nota:** las ventanas las eligió el departamento formulario por
formulario, y se implementan tal como se pidieron. Esto no las discute; solo pone
delante lo que la ventana habría rechazado si hubiera existido, para que las pruebas
del departamento sepan dónde mirar.

## Donde la ventana no estorba

| Tabla | Filas | Días de atraso máximo | Fuera de ventana |
|---|---|---|---|
| `operaciones_diarias` | 60 | 1 | **0** |
| `remisiones` (servicio autotanque) | 72 | 0 | **0** |
| `turnos_autotanque` | 31 | 0 | **0** |
| `control_medicamentos` | 4 | 0 | **0** |
| `prestamos_chalecos` | 2 | 0 | **0** |
| `relaciones_planta` | 3 | 0 | **0** |

Seis de las doce tablas se registran **el mismo día**, sin una sola excepción. Para
esas, la ventana es invisible: nadie va a notarla.

## Donde la ventana habría rechazado filas que existen

| Tabla | Filas | Fuera de ventana | El caso peor |
|---|---|---|---|
| `movimientos_csae` | 11 | **5** | tres entradas registradas 61, 77 y 80 días después |
| `estacionamiento_subterraneos` | 411 | **12** | ocho filas con fecha de 100 a 134 días **por delante** del registro |
| `checklist_turnos` | 20 | 2 | un día por delante |
| `walk_arounds` | 20 | 2 | tres días por delante |
| `pernocta_dia` | 9 | 2 | una fila 147 días después |

Dos lecturas posibles de esto, y **no puedo distinguirlas desde aquí**:

1. Es la forma real de trabajar —se captura con retraso cuando el turno fue intenso—,
   y entonces la ventana de esos formularios está estrecha y hay que ampliarla en la
   tabla antes de que esto llegue a producción.
2. Son filas cargadas de golpe o importadas, y su `created_at` no dice cuándo se
   capturaron de verdad. En `estacionamiento_subterraneos` las ocho filas de 100 a 134
   días tienen `created_at` de marzo y fecha de julio, lo que apunta a esto.

**Lo que hay que preguntar al departamento**, con nombre y apellido:

- **CSAE**: ¿es normal registrar una entrada dos meses después? Si lo es, `csae.entrada`
  y `csae.salida` necesitan más de tres días.
- **Estacionamiento subterráneo**: ¿se registra una ronda con fecha por delante? La
  ventana actual **no permite ninguna fecha futura**, y hay 12 filas que sí la tienen.
- **Pernocta**: la fila de 147 días, ¿fue una carga o una captura tardía?

## Un caso aparte: la sección `HotTrasComiCoor` del checklist

El plan le asignaba la ventana del checklist (hoy y ayer). Los datos dicen que **esa
fecha no es de registro**: de 13 checklists con renglones, varios tienen renglones con
fecha **posterior** a la del checklist —hasta 15 días—, porque son servicios de hotel,
transporte y comisariato **ya reservados**. Es una fecha de servicio, como las de
Operaciones Programadas.

**Decisión:** queda fuera. La ventana se queda en la fecha de cabecera del checklist,
que sí es la de registro. Poner una ventana de dos días a un servicio reservado para
la semana que viene habría roto la captura, y lo habría roto en silencio hasta que
alguien lo intentara.
