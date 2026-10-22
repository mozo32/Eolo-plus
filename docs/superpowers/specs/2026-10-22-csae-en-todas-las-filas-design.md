# Operaciones Diarias: la visita de CSAE se ve en todas las filas que cruza

**Fecha:** 2026-10-22
**Rama base:** `vehiculos-tabla-desactivar` (punta `7b228f1`, 2486 pruebas en verde)
**Caso que lo motiva:** `XB-GTH` llega el 24/06 12:01 y sale el 24/06 13:52; vuelve a
entrar el 25/06 11:27 y sale el 25/06 14:37. Su corrida de CSAE va del 24/06 12:30 al
25/06 14:37, cruza las dos estancias, y hoy solo aparece en la segunda.

## Qué resuelve

El Excel de Operaciones Diarias muestra, junto a cada estancia, las corridas de motor de
CSAE que le corresponden. Cuando una corrida es larga y cruza varias estancias, hoy
aparece en una sola fila: la de la llegada más reciente. En la fila donde la corrida
empezó no hay nada, y quien busca ahí concluye que no hubo mantenimiento.

## Lo que ya estaba decidido, y por qué importa

**Esto que se pide existió y se quitó como defecto.** La regla vive en
`app/Support/RelacionOperacionCSAE.php`, con 39 pruebas. Tres se llaman «DEFECTO doble
conteo», y una de ellas dice literalmente *«una corrida que cruza dos estancias se queda
con la de llegada más reciente»*. Que la visita apareciera en varias filas fue reportado
como error y se corrigió asignando cada corrida a una sola estancia.

Ninguna de las dos peticiones está equivocada. Lo que ocurrió es que **se resolvió un
problema tapando el otro**: para que los totales no contaran de más, se dejó de mostrar
la visita en las filas anteriores. Esta spec separa las dos cosas que estaban pegadas:
**dónde se muestra** una visita y **dónde se cuenta**.

## El dato de hoy

| Medida | Valor |
|---|---|
| Corridas de CSAE con entrada | 73 |
| …sin salida registrada | 5 |
| Rango | 2026-02-06 a 2026-10-06 |

Cuántas estancias cruza cada corrida, con la regla de solape que ya existe:

| Estancias que cruza | Corridas | Qué les pasa hoy |
|---|---|---|
| 0 | 14 | Salen como huérfanas. No cambian |
| 1 | 46 | Aparecen en su única fila. No cambian |
| 2 | 10 | **Aparecen en 1 de 2 filas** |
| 3 | 3 | **Aparecen en 1 de 3 filas** |

**13 corridas de 73** cambian. Ejemplos reales: `XA-MYK` tiene una corrida del 17/04 al
21/08 que cruza tres estancias; `XB-RQD` y `XB-SYJ` cruzan dos cada una.

## Hechos medidos que deciden el diseño

### 1. La regla de solape ya es correcta; lo que sobra es el descarte

`RelacionOperacionCSAE::estanciaMasReciente` recorre las estancias que solapan con la
corrida y devuelve **una**: la de llegada más reciente. El cálculo de solape identifica
correctamente las dos estancias de `XB-GTH`; es el `return` el que tira la primera.

No hay que tocar la aritmética del solape. Solo hay que dejar de descartar.

### 2. El miedo que documenta la clase no se materializa

El comentario de la clase justifica el descarte así: *«Eso es lo que hace seguro dejar
sin techo una estancia sin salida: la siguiente llegada se queda la corrida»*. Una
estancia sin salida no tiene fin, así que solapa con todo lo posterior.

Medido: hay **31 llegadas sin salida posterior**, y **cero** corridas cuyo conjunto de
estancias solapadas cambie si a una estancia sin salida se le pone como techo la
siguiente llegada de la misma matrícula. El riesgo es teórico con los datos de hoy, así
que esta spec **no** añade ese techo: sería código defendiendo un caso que no ocurre, y
el reparto a todas las estancias no lo necesita para ser correcto — solo lo necesitaría
para ser *estrecho*, que no es lo que se pide.

### 3. El Excel no usa los totales que el backend calcula

`excelService.ts` declara `cantidad_visitas_csae`, `minutos_estancia_csae_total` y
`salidas_csae_pendientes` en su tipo, pero **no lee ninguno**: recalcula todo desde
`movimientos_csae` (`const cantidadVisitasCsae = movimientosCsae.length`).

Consecuencia directa: para que una fila «se vea pero no cuente» **no basta con poner sus
agregados en cero**. Hay que decírselo al Excel con un campo propio.

### 4. La clase tiene un solo consumidor

`RelacionOperacionCSAE` se usa únicamente en
`OperacionesDiariasController::obtenerExcel`, y solo `excelService.ts` lee los campos que
decora. La pantalla de Operaciones Diarias no pasa por aquí. El alcance del cambio es el
Excel y nada más.

## Alcance

**Entra:**

1. Una corrida de CSAE se reparte a **todas** las estancias que cruza, no solo a la más
   reciente.
2. Una de esas estancias es la **dueña** y conserva los totales; las demás son
   **referencias**.
3. El Excel deja **ESTANCIA CSAE vacía** en las filas de referencia, y pinta el resto
   igual que hoy.
4. Un campo nuevo en el contrato entre el backend y el Excel para distinguirlas.

**No entra:**

- **Cambiar quién es la dueña.** Sigue siendo la estancia de llegada más reciente, igual
  que hoy. Mover los totales de sitio no es lo que se pidió y cambiaría dónde cuadran los
  números de quien ya usa el reporte.
- **Poner techo a las estancias sin salida** (hecho 2).
- **Quitar los tres agregados que el Excel no lee** (hecho 3). Son parte del contrato que
  las pruebas verifican; limpiarlos es otro trabajo.
- **Cambiar el texto de MANTENIMIENTO CSAE.** Ver «Riesgos».
- **La pantalla de Operaciones Diarias.** No consume esta clase (hecho 4).
- **Los huérfanos.** Una corrida que no cruza ninguna estancia sigue saliendo aparte,
  exactamente igual.

## Decisiones tomadas

| # | Decisión | Por qué |
|---|---|---|
| 1 | Se muestra en todas, se cuenta en una | Es lo pedido sin reabrir el doble conteo que ya se cerró |
| 2 | La dueña es la de llegada más reciente | Es la regla de hoy; los totales no se mueven de sitio |
| 3 | La señal es el hueco en ESTANCIA CSAE, no una etiqueta | No mete texto nuevo en una columna que hoy solo dice SI o NO, y deja la columna sumando exacto |
| 4 | Un campo booleano nuevo, `csae_es_referencia` | El Excel recalcula desde `movimientos_csae` (hecho 3), así que poner los agregados en cero no bastaría |
| 5 | Los agregados van en cero en las filas de referencia | Mantiene la invariante que la prueba del doble conteo verifica, aunque el Excel no los lea |
| 6 | No se toca el cálculo del solape | Ya identifica correctamente las estancias (hecho 1) |

## Arquitectura

### Backend

En `RelacionOperacionCSAE::relacionar`, el método privado `estanciaMasReciente` pasa a
devolver **todas** las estancias que solapan, de la más antigua a la más reciente, en vez
de solo la última. La aritmética del solape se copia tal cual.

El reparto cambia así: la corrida se añade a la lista de visitas de **cada** estancia que
cruza. La **última** de esa lista —la de llegada más reciente, la misma que hoy— se marca
como dueña.

`decorar` gana un campo y una rama. El contrato de cada operación pasa de siete campos a
ocho:

```
mantenimiento_csae           true en todas las filas que cruza la corrida
fecha_hora_csae              la entrada de la primera visita, en todas
fecha_hora_salida_csae       la salida de la primera visita, en todas
movimientos_csae             las visitas, en todas
csae_es_referencia           NUEVO: true si muestra corridas y no posee ninguna
cantidad_visitas_csae        cuántas corridas POSEE esta estancia
minutos_estancia_csae_total  la suma de las que POSEE
salidas_csae_pendientes      las pendientes de las que POSEE
```

Una fila sin corridas se queda como hoy: todo vacío, `csae_es_referencia` en `false`.

**El caso mixto, definido a propósito.** Una estancia puede poseer una corrida y a la vez
reflejar otra: posee las corridas cuya estancia más reciente es ella, y refleja las que
también cruza pero cuya más reciente es posterior. Con los datos de hoy esto **no ocurre
ninguna vez** —57 estancias poseen alguna corrida, 16 reflejan alguna, y la intersección
es cero— pero la estructura lo permite y la regla no puede quedar al azar:

- Los tres agregados cuentan **solo las corridas que la estancia posee**. Así la suma
  sobre todas las filas sigue siendo exactamente el número de corridas, que es la
  invariante que la prueba del doble conteo verifica.
- `csae_es_referencia` es `true` solo cuando la estancia **muestra corridas y no posee
  ninguna**. Una fila mixta posee algo, así que va en `false`.
- En consecuencia, una fila mixta **sí** llena ESTANCIA CSAE, y lo hace con el tiempo de
  las corridas que posee, no con el de todas las que enseña.

Los huérfanos no cambian: una corrida que no cruza ninguna estancia sigue yendo a
`huerfanos_csae`.

### El Excel

`excelService.ts` lee el campo nuevo igual que lee los demás: de la llegada, y si no, de
la salida. Cuando la fila es de referencia, la celda **ESTANCIA CSAE** se deja vacía. Las
otras tres celdas del grupo CSAE —MANTENIMIENTO, FECHA-HORA LLEGADA, FECHA-HORA SALIDA—
se pintan exactamente igual que hoy.

Es un cambio en una sola de las cuatro celdas del grupo, en el punto donde hoy se arma
`partesEstanciaCsae`.

La vista previa y la descarga usan las mismas filas —el módulo ya declara ese
invariante—, así que las dos cambian a la vez sin tocar nada más.

### Errores

| Caso | Qué pasa |
|---|---|
| Corrida que no cruza ninguna estancia | Huérfana, igual que hoy |
| Corrida sin salida | Dura hasta `ahora` y se reparte igual; la dueña suma su pendiente |
| Corrida con salida anterior a la entrada | Dato malo; se trata como hoy, sin romper |
| Corrida sin fecha de entrada | Se ignora, ni se reparte ni es huérfana, igual que hoy |
| Estancia que el filtro deja fuera | El historial decide el reparto; solo se decoran las filas presentes, igual que hoy |

## Pruebas

En Pest, en serie, sobre sqlite. El archivo `tests/Feature/RelacionOperacionCSAETest.php`
ya tiene 39 pruebas.

### El guardarraíl que no se toca

**`'DEFECTO doble conteo: la suma de visitas de todas las estancias es el numero de
corridas, ni una de mas'` debe seguir pasando SIN modificarla.** Verifica que
`cantidad_visitas_csae`, `salidas_csae_pendientes` y `minutos_estancia_csae_total`
sumados sobre todas las filas dan exactamente el número de corridas.

Si esa prueba sigue verde sin tocarla, el defecto que se cerró no ha vuelto. Es el
criterio con el que se juzga este trabajo.

### Las dos pruebas que sí cambian, y por qué

Las dos afirman que la fila anterior queda **vacía**, que es precisamente lo que esta
spec revierte. Cambian su aserción sobre la fila anterior y **conservan intacta** la que
dice dónde se cuenta:

- `'DEFECTO doble conteo: con dos llegadas abiertas la corrida posterior a la segunda
  sale SOLO bajo la segunda'` → la primera llegada pasa a **mostrar** la corrida, y la
  segunda sigue siendo la que la cuenta.
- `'DEFECTO doble conteo: una corrida que cruza dos estancias se queda con la de llegada
  mas reciente'` → igual: la primera la muestra, la segunda la cuenta.

Ninguna otra de las 39 se modifica. Si al implementar hace falta tocar una tercera, es
señal de que algo del diseño no encaja y hay que pararse, no ajustarla.

### Las pruebas nuevas

**El caso `XB-GTH` completo**, con sus dos llegadas y sus dos salidas y la corrida que
las cruza: las dos filas muestran la corrida, y solo la segunda la cuenta.

**Una corrida que cruza tres estancias** aparece en las tres y cuenta en una.

**Una fila de referencia trae las fechas y los agregados en cero**: `movimientos_csae`
lleno, `mantenimiento_csae` verdadero, `fecha_hora_csae` puesta, y
`cantidad_visitas_csae`, `minutos_estancia_csae_total` y `salidas_csae_pendientes` en 0.

**`csae_es_referencia` es `false` en la dueña** y en una fila sin corridas.

**Una corrida que cruza una sola estancia no la marca como referencia**: es el caso de
las 46 que no deben cambiar.

**Una fila mixta posee y refleja a la vez**: una estancia que posee una corrida y
refleja otra lleva `csae_es_referencia` en `false`, y sus agregados cuentan solo la que
posee. Hoy no ocurre en los datos, y por eso la prueba es el único sitio donde esa regla
queda fijada.

**Los huérfanos no cambian**: una corrida que no cruza ninguna estancia sigue en
`huerfanos_csae` y en ninguna fila.

### El Excel

No hay ejecutor de pruebas de JavaScript en el proyecto. La verificación es
`npx tsc --noEmit` contra la línea base de 1 error preexistente, `npm run build`, y una
pasada por el navegador sobre la base de desarrollo comprobando el caso `XB-GTH`: las dos
filas con las fechas de CSAE, y ESTANCIA CSAE llena en una sola.

## Riesgos

**MANTENIMIENTO CSAE dirá «SI (1 VISITA)» también en las filas de referencia.** Ese texto
es por fila y no se suma, así que no rompe ningún total, pero leído en vertical parecerá
que hubo más visitas de las que hubo. El hueco en ESTANCIA CSAE es la señal que las
distingue. Si resulta confuso en uso, cambiar ese texto es un trabajo aparte y pequeño.

**Quien haya aprendido a leer «columnas de CSAE vacías» como «esta llegada no tuvo
mantenimiento» verá datos en más filas que antes.** Es el cambio pedido, pero es visible
el primer día.

**Las tres columnas de agregados siguen sin usarse en el Excel.** Esta spec las mantiene
correctas porque las pruebas las verifican, pero nadie las lee. Si alguien las da por
muertas y las borra, la invariante del doble conteo se queda sin quien la sostenga.
