<?php

namespace App\Support;

use Illuminate\Support\Carbon;
use InvalidArgumentException;

/**
 * Qué fechas puede elegir cada formulario, en UN solo sitio.
 *
 * La leen la regla de validación del servidor (`App\Rules\DentroDeLaVentana`) y las props
 * que `HandleInertiaRequests` publica al navegador. Si cada capa tuviera su copia podrían
 * divergir, y entonces el calendario ofrecería una fecha que el servidor rechaza.
 *
 * Es código y no configuración en base de datos a propósito: cambiar una ventana es una
 * decisión sobre la integridad de los datos, y así queda con su diff y su revisión en vez
 * de aparecer como una fila editada que nadie recuerda.
 *
 * `atras` se cuenta INCLUSIVE y en días de calendario: `1` deja hoy y ayer —dos días—, y
 * `3` deja cuatro. `null` no pone mínimo. `futuro` solo es `true` en Operaciones
 * Programadas, que por naturaleza registra lo que todavía no ha pasado.
 *
 * OJO con el punto: las claves lo llevan pero NO son anidamiento. Viajan al navegador como
 * claves literales, así que no se leen con `->where('ventanasDeFecha.a.b')` ni con
 * `data_get()` por ruta (los buscarían anidados y no los hallarían): se lee
 * `$page->toArray()['props']['ventanasDeFecha'][$clave]`.
 */
final class VentanasDeFecha
{
    /** @var array<string, array{atras: ?int, futuro: bool}> */
    public const CLAVES = [
        // Se llenan en el momento: un día de margen para quien cierra a la mañana siguiente.
        'turno.checklist' => ['atras' => 1, 'futuro' => false],
        'turno.entrega_rampa' => ['atras' => 1, 'futuro' => false],
        'autotanque.turno_inicio' => ['atras' => 1, 'futuro' => false],
        'autotanque.turno_cierre' => ['atras' => 1, 'futuro' => false],
        'chalecos.prestamo' => ['atras' => 1, 'futuro' => false],
        'planta.prestamo' => ['atras' => 1, 'futuro' => false],
        'estacionamiento.ronda' => ['atras' => 1, 'futuro' => false],

        // Registran un hecho que pudo pasar antes: tres días cubren un fin de semana, así
        // que lo del viernes se captura el lunes.
        'operaciones.llegada' => ['atras' => 3, 'futuro' => false],
        'operaciones.salida' => ['atras' => 3, 'futuro' => false],
        'operaciones.registro' => ['atras' => 3, 'futuro' => false],
        'despacho.walk_around' => ['atras' => 3, 'futuro' => false],
        'despacho.informacion_general' => ['atras' => 3, 'futuro' => false],
        'autotanque.servicio' => ['atras' => 3, 'futuro' => false],
        'comisariato.entrega' => ['atras' => 3, 'futuro' => false],
        'csae.entrada' => ['atras' => 3, 'futuro' => false],
        'csae.salida' => ['atras' => 3, 'futuro' => false],
        'pernocta.dia' => ['atras' => 3, 'futuro' => false],
        'medicamento.movimiento' => ['atras' => 3, 'futuro' => false],

        // La excepción, NOMBRADA y no omitida: se programa lo que aún no ha ocurrido.
        'programadas.operacion' => ['atras' => null, 'futuro' => true],
    ];

    /**
     * @return array{min: ?string, max: ?string} fechas `Y-m-d`, o null donde no hay límite
     */
    public static function para(string $clave): array
    {
        // Lanza en vez de asumir: un valor por omisión silencioso dejaría un formulario sin
        // restricción, o restringido de más, y nadie lo sabría hasta que alguien no pudiera
        // trabajar.
        if (! array_key_exists($clave, self::CLAVES)) {
            throw new InvalidArgumentException("Ventana de fecha desconocida: '{$clave}'.");
        }

        ['atras' => $atras, 'futuro' => $futuro] = self::CLAVES[$clave];
        $hoy = Carbon::today();

        return [
            'min' => $atras === null ? null : $hoy->copy()->subDays($atras)->toDateString(),
            'max' => $futuro ? null : $hoy->toDateString(),
        ];
    }

    /** @return array<string, array{min: ?string, max: ?string}> */
    public static function todas(): array
    {
        $ventanas = [];

        foreach (array_keys(self::CLAVES) as $clave) {
            $ventanas[$clave] = self::para($clave);
        }

        return $ventanas;
    }
}
