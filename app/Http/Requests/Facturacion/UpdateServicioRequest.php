<?php

namespace App\Http\Requests\Facturacion;

use App\Models\FactPrecioCombustible;
use App\Models\FactServicio;
use Illuminate\Validation\Validator;

/**
 * Mismas reglas que el alta, incluida la validación cruzada de tercero y margen,
 * más la guarda del servicio de combustible.
 */
class UpdateServicioRequest extends StoreServicioRequest
{
    /**
     * A las reglas del alta se suma una propia: el servicio de combustible no se
     * puede renombrar.
     *
     * `FactPrecioCombustible::registrar()` sincroniza el precio de ese servicio
     * buscándolo por su nombre, porque al importar no queda un id estable que
     * apuntar (el sistema viejo usa un id fijo). Si alguien lo renombra, la
     * sincronía deja de encontrarlo y no falla: simplemente no actualiza nada, y
     * el combustible se sigue cobrando al precio anterior mientras la pantalla de
     * precios muestra el nuevo. Es justo el fallo que la sincronía existe para
     * evitar, así que se rechaza con un mensaje que dice por qué en lugar de
     * dejarlo pasar.
     */
    public function after(): array
    {
        return array_merge(parent::after(), [function (Validator $validator) {
            if ($validator->errors()->has('nombre')) {
                return;
            }

            $id = $this->route('id');

            if ($id === null) {
                return;
            }

            $actual = FactServicio::query()->find($id);

            if ($actual === null || ! self::esNombreDeCombustible($actual->nombre)) {
                return;
            }

            if (! self::esNombreDeCombustible((string) $this->input('nombre'))) {
                $validator->errors()->add(
                    'nombre',
                    'Este servicio no se puede renombrar: su nombre es el vínculo con el precio del combustible, '
                    .'y al cambiarlo el precio dejaría de actualizarse solo. Puedes editar sus demás campos.'
                );
            }
        }]);
    }

    /**
     * Comparación insensible a la caja, que es como la resuelve MySQL con la
     * collation de la columna (`utf8mb4_unicode_ci`). Así la guarda protege los
     * mismos nombres que la sincronía llegaría a actualizar, nunca menos.
     *
     * El `trim` aplica al nombre GUARDADO: el recibido ya viene recortado por el
     * middleware `TrimStrings`, así que de ese lado no hace nada.
     */
    private static function esNombreDeCombustible(string $nombre): bool
    {
        return mb_strtolower(trim($nombre)) === mb_strtolower(FactPrecioCombustible::SERVICIO_COMBUSTIBLE);
    }
}
