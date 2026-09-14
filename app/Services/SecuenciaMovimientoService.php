<?php

namespace App\Services;

use App\Models\OperacionDiaria;
use App\Models\WalkAround;

/**
 * Regla única de secuencia de movimientos de una matrícula.
 *
 * Antes esta regla vivía duplicada dentro de OperacionesDiariasController::store
 * y de WalkAroundController::store. Aquí queda centralizada para que ambos
 * módulos compartan el mismo criterio. Operaciones Programadas ya no la aplica:
 * al programar solo se revisan las matrículas restringidas.
 *
 * Cada módulo conserva su propio historial: Operaciones Diarias valida contra
 * operaciones_diarias y WalkAround contra walk_arounds. No se unifican, porque
 * hoy son secuencias independientes.
 */
class SecuenciaMovimientoService
{
    public const FUENTE_OPERACIONES_DIARIAS = 'operaciones_diarias';
    public const FUENTE_WALKAROUND = 'walkaround';

    public const LLEGADA = 'llegada';
    public const SALIDA = 'salida';

    /**
     * Unifica el vocabulario: WalkAround usa Entrada/Salida y Operaciones
     * Diarias usa Llegada/Salida para el mismo concepto.
     */
    public static function normalizar(?string $movimiento): string
    {
        $valor = strtolower(trim((string) $movimiento));

        return match ($valor) {
            'entrada', 'llegada' => self::LLEGADA,
            'salida' => self::SALIDA,
            default => $valor,
        };
    }

    /**
     * Etiqueta visible del movimiento según el módulo que la muestra.
     */
    public static function etiqueta(string $movimientoNormalizado, string $fuente): string
    {
        if ($movimientoNormalizado === self::SALIDA) {
            return 'Salida';
        }

        return $fuente === self::FUENTE_WALKAROUND ? 'Entrada' : 'Llegada';
    }

    /**
     * Movimiento que debe existir antes de poder repetir el actual.
     */
    public static function movimientoOpuesto(string $movimientoNormalizado, string $fuente): string
    {
        $opuesto = $movimientoNormalizado === self::LLEGADA
            ? self::SALIDA
            : self::LLEGADA;

        return self::etiqueta($opuesto, $fuente);
    }

    public static function ultimoMovimientoOperacionDiaria(string $matricula): ?OperacionDiaria
    {
        // Una operación cancelada no es un movimiento: no cuenta en la secuencia.
        return OperacionDiaria::activas()
            ->where('matricula', $matricula)
            ->orderByDesc('fecha')
            ->orderByDesc('hora')
            ->orderByDesc('id')
            ->first();
    }

    public static function ultimoMovimientoWalkAround(string $matricula): ?WalkAround
    {
        return WalkAround::where('matricula', $matricula)
            ->orderByDesc('fecha')
            ->orderByDesc('hora')
            ->orderByDesc('id')
            ->first();
    }

    /**
     * Validación definitiva, la que se ejecuta al guardar el registro real.
     *
     * Reproduce exactamente el mensaje y la carga que cada módulo devolvía antes,
     * para no alterar lo que el frontend ya muestra.
     *
     * @return array{valido: bool, message: string|null, data: array|null, ultimo: mixed}
     */
    public static function validarFinal(
        string $matricula,
        string $movimientoEntrada,
        string $fuente
    ): array {
        $nuevo = self::normalizar($movimientoEntrada);

        $ultimo = $fuente === self::FUENTE_WALKAROUND
            ? self::ultimoMovimientoWalkAround($matricula)
            : self::ultimoMovimientoOperacionDiaria($matricula);

        if (! $ultimo) {
            return self::resultadoValido();
        }

        $anterior = self::normalizar(
            $fuente === self::FUENTE_WALKAROUND
                ? $ultimo->movimiento
                : $ultimo->tipo
        );

        if ($anterior !== $nuevo) {
            return self::resultadoValido($ultimo);
        }

        $debeSer = self::movimientoOpuesto($nuevo, $fuente);

        if ($fuente === self::FUENTE_WALKAROUND) {
            return [
                'valido' => false,
                'message' => "La matrícula {$matricula} ya cuenta con un registro de {$movimientoEntrada}. Debe registrar una {$debeSer} primero.",
                'data' => [
                    'ultimo_movimiento' => $ultimo->movimiento,
                    'fecha' => $ultimo->fecha,
                    'hora' => $ultimo->hora,
                ],
                'ultimo' => $ultimo,
            ];
        }

        return [
            'valido' => false,
            'message' => "La matrícula ya cuenta con un registro de {$movimientoEntrada}. Debe registrar una {$debeSer} primero.",
            'data' => null,
            'ultimo' => $ultimo,
        ];
    }

    private static function resultadoValido($ultimo = null): array
    {
        return [
            'valido' => true,
            'message' => null,
            'data' => null,
            'ultimo' => $ultimo,
        ];
    }
}
