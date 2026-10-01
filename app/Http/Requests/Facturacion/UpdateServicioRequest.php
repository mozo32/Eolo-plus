<?php

namespace App\Http\Requests\Facturacion;

/**
 * Mismas reglas que el alta, incluida la validación cruzada de tercero y margen.
 *
 * Antes sumaba una guarda propia que impedía renombrar el servicio de combustible,
 * porque el nombre era el vínculo con la sincronía del precio. Ese vínculo ahora
 * es la columna `concepto`, así que el servicio se puede renombrar libremente.
 */
class UpdateServicioRequest extends StoreServicioRequest {}
