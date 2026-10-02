<?php

namespace App\Services;

use UnexpectedValueException;

/**
 * No se pudo cerrar porque los totales no se pueden calcular: la tasa de IVA o el ajuste
 * de un renglón tienen un valor que no se reconoce.
 *
 * Es SUBCLASE de `UnexpectedValueException` (lo que `total()` lanzaba antes, así que
 * quien ya la esperaba sigue funcionando) y existe aparte para que el endpoint la
 * distinga de la OTRA `UnexpectedValueException` del cierre: `siguienteFolio()` la lanza
 * con el contador corrupto, y decirle al operador «totales no calculables» cuando el
 * problema es el contador lo mandaría a corregir lo que no es. La excepción original
 * viaja como `getPrevious()`.
 */
class TotalesNoCalculablesException extends UnexpectedValueException {}
