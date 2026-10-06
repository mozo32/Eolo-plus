# Task 7 - la prueba maestra: informe

Estado: DONE. Suite entera en serie: 1140 pasan, 0 fallan (1139 + la nueva).

## Que se anadio
Una prueba al final de `tests/Feature/Facturacion/DocumentoDeVersionTest.php`:
`LA PRUEBA MAESTRA: el ciclo entero por la API, y la version 1 reimpresa es el papel que salio, no el corregido`.
No se tocaron las pruebas existentes ni se duplico ninguna. Reutiliza `vistaDelPapel()`, `prefacturaCerradaParaDocumento()`, `renglonDe()`, `completarParaCerrar()`, `formasDePago()` y `usuarioConSubdepartamento()`.

Recorrido (todo por HTTP salvo el servicio nuevo, que usa `renglonDe()`):
1. GET `/pdf` del documento cerrado (captura lo que recibe la vista, y su texto).
2. PATCH `/reabrir`: 403 con `factPrefacturas`, 200 con `factReabrirPrefactura`.
3. Correcciones con el usuario normal de captura, una por clase:
   - importe de un renglon: PATCH `/renglones/{id}/cortesia` (el de 100.00 deja de cobrarse);
   - falta un servicio: `renglonDe(250.0, 2)`;
   - cobro: DELETE del pago exacto y POST de uno de 600.00 en efectivo (cambio);
   - cabecera: PUT del encabezado (destino `MMUN`), PATCH `/notas` (nota externa) y cliente nuevo.
4. PATCH `/cerrar`, sin confirmaciones (600.00 cubre 580.00).
5. GET `/versiones/1/pdf`, y despues GET `/pdf` de la vigente en la misma prueba.

## Que aporta que no aportaran las tareas 2 y 6
- Task 2 (HTML vivo == HTML hidratado): circular en las cifras. Esta anade el ancla a literales que la propia prueba siembra: la version 1 reimpresa trae `100.00 / 16.00 / 16% / 116.00 / cambio 0.00`, una fila de importe `100.00`, pago `116.00`, destino `MMTO`, nota y cliente originales, y la firma de quien cerro el original (leida de la base). La vigente trae otros literales en las cuatro clases (`500.00 / 80.00 / 580.00 / cambio 20.00`, 2 filas, pago `600.00`, `MMUN`, nota nueva, cliente nuevo, firma de quien cerro la correccion). Verificado con mutacion: con `total` falso en `cifrasDeCerrada()`, la prueba de la Task 2 SIGUE pasando y esta cae.
- Task 6 (cifras desde el JSON, marcas excluyentes): ya ancla a literales y llega por el endpoint de versiones, pero reabre y cierra por servicio y corrige por modelos. Esta recorre el ciclo real por los endpoints, con el permiso propio de reapertura (403/200) y con cuatro clases de correccion a la vez, incluida la nota externa por su endpoint y el cobro quitado/puesto por los suyos.
- Ademas, comparaciones que ninguna tenia: lo que la plantilla lee del modelo (`$delModelo`: folio, fechas, cliente con 3 campos, matricula, tipo, categoria, pagos) de la reimpresion igual al del original; y el TEXTO del papel reimpreso, quitada la marca «VERSION 1 - REEMPLAZADA ... NO VIGENTE», es identico al del documento original (la unica diferencia con lo que salio es la marca).
- El folio no cambia en el ciclo; la vigente dice `sustituye` con la fecha de cierre original; `FactPrefacturaVersion` queda con 1 fila.

Algo ya cubierto y no duplicado: la identidad HTML vivo/hidratado (Task 2), las marcas excluyentes, la tasa de IVA conservada, la baja y los 404 (Task 6). No hay parte de la prueba del brief que fuera redundante hasta el punto de omitirla.

## Mutaciones (aplicadas y comprobadas con `git diff` antes de correr; todas revertidas)
1. `version()` devuelve el documento de la prefactura VIVA (modelo, cifras y firma vivos): la prueba cae en el ancla (`500.00` en lugar de `100.00`). Tambien caen 6 pruebas mas del fichero, varias con 500 por la mutacion tosca (la reabierta sin cifras selladas).
2. `total` falso (`+1`) en `cifrasDeCerrada()`: la prueba de la Task 2 pasa; esta falla.
3. Correccion que no cambia nada (bloques a-d anulados): falla al comprobar los literales sellados de la vigente (`500.00`...), es decir, distingue el antes del despues.
Tras revertir: `git diff --stat` solo muestra el fichero de prueba; pint limpio.

## Dudas / notas
- Un primer intento comparaba el texto de la reimpresion sin la marca contra el original y fallo solo por un doble espacio que deja quitar la marca; se normalizo el espacio en blanco en la comparacion (no se relajo ninguna cifra).
- El importe de un renglon se cambia con el endpoint de cortesia (no hay endpoint de cantidad). Si el departamento corrige cantidades borrando y volviendo a agregar, el camino es el mismo `store`/`destroy`.
- `usuarioConSubdepartamento` da un solo subdepartamento, por eso la prueba usa dos usuarios (jefe de reapertura y captura); como efecto, la firma de la vigente (captura) difiere de la del original y se comprueba.
