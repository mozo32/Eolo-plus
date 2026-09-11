<?php

namespace App\Services;

use App\Models\MatriculaRestringida;

/**
 * Única fuente de la regla de matrículas restringidas.
 *
 * Vive aparte de SecuenciaMovimientoService porque son dos reglas distintas: una
 * mira el orden de los movimientos y esta mira si el movimiento está permitido.
 * Ambas se ejecutan al programar, primero esta por ser la consulta más barata y
 * la de mensaje más accionable.
 */
class RestriccionMatriculaService
{
    public const CODIGO = 'movimiento_restringido';

    public static function restriccionDe(?string $matricula): ?MatriculaRestringida
    {
        $normalizada = MatriculaRestringida::normalizar($matricula);

        if ($normalizada === '') {
            return null;
        }

        return MatriculaRestringida::query()->find($normalizada);
    }

    /**
     * ¿Se puede programar este movimiento para esta matrícula?
     *
     * Una matrícula sin registro, o con el booleano de ese movimiento en false,
     * queda permitida.
     *
     * @return array{permitido: bool, message: string|null}
     */
    public static function validar(?string $matricula, string $tipo): array
    {
        $normalizada = MatriculaRestringida::normalizar($matricula);
        $movimiento = SecuenciaMovimientoService::normalizar($tipo);
        $restriccion = self::restriccionDe($normalizada);

        if (! $restriccion || ! $restriccion->restringe($movimiento)) {
            return ['permitido' => true, 'message' => null];
        }

        return [
            'permitido' => false,
            'message' => sprintf(
                'La %s de la matrícula %s está restringida. Favor de hablar con el personal correspondiente.',
                $movimiento,
                $normalizada
            ),
        ];
    }
}
