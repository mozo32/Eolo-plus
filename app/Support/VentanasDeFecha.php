<?php

namespace App\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Date;
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

    /**
     * El día (`Y-m-d`) que quedaría guardado en una columna con cast `date` si se le asigna
     * este valor, o null si el valor no se puede leer como día.
     *
     * Es la ÚNICA definición de «qué día es esta fecha» para la regla y para la comparación de
     * la edición. Copia el comportamiento de `HasAttributes::asDateTime()` de la versión
     * instalada de Laravel (el cast `date` guarda `fromDateTime()` = `asDateTime()` formateado):
     *
     * - un valor NUMÉRICO es un timestamp Unix, no una fecha: `"20261007"` es 1970-08-23 y
     *   `"2026"` es 1969-12-31. `Carbon::parse` los leería como 7 de octubre de 2026 y hoy, y
     *   la regla dejaría pasar un día que la base no guarda;
     * - `Y-m-d` exacto se toma tal cual;
     * - lo demás se intenta como `Y-m-d H:i:s` y, si no, con `Carbon::parse`, conservando el
     *   desfase que traiga la cadena (no se convierte de zona: el modelo tampoco).
     *
     * Si cambia la versión de Laravel, la prueba que lee la columna tras escribir cadenas
     * hostiles es la que avisa de que esta copia se quedó atrás.
     */
    public static function diaQueGuardaElModelo(mixed $valor): ?string
    {
        if ((! is_string($valor) && ! is_int($valor) && ! is_float($valor)) || empty($valor)) {
            return null;
        }

        return rescue(function () use ($valor): string {
            if (is_numeric($valor)) {
                return Date::createFromTimestamp($valor, date_default_timezone_get())->toDateString();
            }

            if (preg_match('/^(\d{4})-(\d{1,2})-(\d{1,2})$/', $valor)) {
                return Date::instance(Carbon::createFromFormat('Y-m-d', $valor)->startOfDay())->toDateString();
            }

            try {
                $fecha = Date::createFromFormat('Y-m-d H:i:s', $valor);
            } catch (InvalidArgumentException) {
                $fecha = false;
            }

            return ($fecha ?: Date::parse($valor))->toDateString();
        }, null, false);
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
