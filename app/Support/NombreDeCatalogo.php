<?php

namespace App\Support;

/**
 * La normalización de un nombre que viene del sistema viejo, en UN solo sitio.
 *
 * La usan el importador de catálogos, que crea las filas con el nombre ya normalizado,
 * y el importador de prefacturas abiertas, que tiene que RESOLVER contra esas filas. Si
 * cada uno normalizara por su cuenta podrían divergir, y entonces un servicio con un
 * espacio raro en el origen —los hay: 'Basura Internacional by SENASICA ' con espacio
 * final— se crearía con un nombre y se buscaría con otro, y el renglón se perdería.
 */
final class NombreDeCatalogo
{
    /**
     * Colapsa cualquier racha de espacios —incluidos los invisibles de la categoría
     * `\p{Z}`, como el NBSP que trae 'ARTURO<NBSP>GARDUÑO'— en un espacio simple, y
     * recorta los extremos.
     */
    public static function normalizar(string $crudo): string
    {
        $colapsado = preg_replace('/[\s\p{Z}]+/u', ' ', $crudo);

        return trim($colapsado ?? $crudo);
    }
}
