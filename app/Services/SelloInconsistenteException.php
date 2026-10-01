<?php

namespace App\Services;

use RuntimeException;

/** El sello recién escrito no coincide con lo que derivan los renglones: el cierre se revierte. */
class SelloInconsistenteException extends RuntimeException {}
