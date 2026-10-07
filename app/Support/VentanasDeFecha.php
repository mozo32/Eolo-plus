<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Model;
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
     * la edición, y NO la reimplementa: le pregunta al propio Eloquent (`fromDateTime()`, lo
     * que el cast `date` guarda al asignar). Una copia se quedaba atrás sola: así lo demostró
     * quitarle la zona a la rama de timestamps, que la suite no notó.
     *
     * Por eso `Carbon::parse` NO sirve para esto: un valor numérico lo guarda Eloquent como
     * timestamp Unix (`"20261007"` es 1970-08-23, `"2026"` es 1969-12-31) y `parse` lo leería
     * como el 7 de octubre de 2026 y hoy; y una cadena con desfase conserva el día que trae
     * escrito, sin convertirlo de zona.
     *
     * El modelo es anónimo a propósito: la usan todos los módulos, no debe quedar atada a uno.
     * Lo vacío (`""`, `0`, `"0"`, `false`, `null`) y lo que no es string ni número devuelve
     * null sin preguntarle al modelo: ahí Eloquent devuelve el literal o lanza, y esos valores
     * los rechazan `required` y `date`, que van delante.
     */
    public static function diaQueGuardaElModelo(mixed $valor): ?string
    {
        if ((! is_string($valor) && ! is_int($valor) && ! is_float($valor)) || empty($valor)) {
            return null;
        }

        static $modelo = null;
        $modelo ??= new class extends Model
        {
            protected $casts = ['dia' => 'date'];

            protected $dateFormat = 'Y-m-d H:i:s';
        };

        $guardado = rescue(fn () => $modelo->fromDateTime($valor), null, false);

        // Se devuelve el dia TAL COMO lo escribe Eloquent, incluso con un anio de mas de cuatro
        // cifras (`"20261007120000"` se guarda como el anio 644015). Ese texto nunca cae entre el
        // suelo y el techo (`Y-m-d`) al compararlos como cadenas, asi que la regla lo rechaza.
        return is_string($guardado) ? strtok($guardado, ' ') : null;
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
