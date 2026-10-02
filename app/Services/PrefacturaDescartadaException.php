<?php

namespace App\Services;

use RuntimeException;

/** Se intentó cerrar un borrador descartado: cerrarlo consumiría un folio para un documento que la lista nunca muestra. */
class PrefacturaDescartadaException extends RuntimeException {}
