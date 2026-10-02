<?php

namespace App\Services;

use RuntimeException;

/**
 * Falta el servicio de catálogo de un cargo de estancia (no existe, o está dado de
 * baja). El mensaje ya le dice a la persona qué hacer, así que el endpoint lo
 * devuelve tal cual como 422 en lugar de dejarlo caer a un 500 genérico.
 */
class ServicioDeEstanciaNoDisponibleException extends RuntimeException {}
