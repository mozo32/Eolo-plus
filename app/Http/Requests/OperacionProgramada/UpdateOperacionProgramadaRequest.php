<?php

namespace App\Http\Requests\OperacionProgramada;

/**
 * Al actualizar aplican las mismas reglas que al crear; lo que cambia es que la
 * validación de secuencia ignora la propia operación, cosa que resuelve el
 * controlador con el id de la ruta.
 */
class UpdateOperacionProgramadaRequest extends StoreOperacionProgramadaRequest
{
}
