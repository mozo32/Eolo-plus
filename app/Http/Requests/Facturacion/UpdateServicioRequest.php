<?php

namespace App\Http\Requests\Facturacion;

/**
 * Mismas reglas que el alta, incluida la validación cruzada de tercero y margen.
 *
 * Antes sumaba una guarda propia que impedía renombrar el servicio de combustible,
 * porque el nombre era el vínculo con la sincronía del precio. Ese vínculo ahora
 * es la columna `concepto`, así que renombrarlo ya no rompe la sincronía (el
 * importador sí le devuelve el nombre del origen en cada corrida).
 */
class UpdateServicioRequest extends StoreServicioRequest {}
