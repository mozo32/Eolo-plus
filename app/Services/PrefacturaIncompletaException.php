<?php

namespace App\Services;

use RuntimeException;

/** Se intentó cerrar una prefactura a la que le falta el cliente o los renglones. */
class PrefacturaIncompletaException extends RuntimeException {}
