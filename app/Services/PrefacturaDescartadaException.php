<?php

namespace App\Services;

use RuntimeException;

/**
 * Se intentó cerrar, o cobrar, un borrador descartado: cerrarlo consumiría un folio para un
 * documento que la lista nunca muestra, y un pago sobre él quedaría en un documento que nadie ve.
 */
class PrefacturaDescartadaException extends RuntimeException {}
