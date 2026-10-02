<?php

namespace App\Services;

use RuntimeException;

/**
 * Falta el servicio de catálogo de la comisión Amex (no existe, o está dado de
 * baja). El mensaje ya dice qué hacer, así que el endpoint lo devuelve tal cual
 * como 422 en lugar de dejarlo caer a un 500 genérico — la misma lección que el
 * bloque 2 aprendió con `ServicioDeEstanciaNoDisponibleException`, que tampoco
 * tiene `render()`: el controlador la atrapa y le pone su código.
 */
class ServicioDeComisionNoDisponibleException extends RuntimeException {}
