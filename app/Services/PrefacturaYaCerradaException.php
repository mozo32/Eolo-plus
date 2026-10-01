<?php

namespace App\Services;

use RuntimeException;

/** Se intentó cerrar una prefactura que ya estaba cerrada. */
class PrefacturaYaCerradaException extends RuntimeException {}
