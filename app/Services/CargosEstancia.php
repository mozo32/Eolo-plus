<?php

namespace App\Services;

use App\Models\FactAeronave;
use App\Models\FactPrefactura;
use App\Models\FactServicio;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use RuntimeException;

/**
 * Los cargos que no se capturan uno por uno: la estancia y el paquete
 * internacional.
 *
 * Dos reglas del sistema viejo que aquí se hacen cumplir:
 *
 * 1. El precio de los tres servicios de estancia NO sale del catálogo —ahí vale
 *    99.00, que es relleno— sino de la tarifa de la matrícula. `insert22.php`
 *    hace lo mismo pasando `$Costp`, `$costt2` y `$costt12` explícitamente.
 * 2. Solo se cobran si la aeronave está en Tránsito (`if($estatus == 1)` en el
 *    original). Es la regla que el bloque 1a dejó sin aplicar a propósito.
 *
 * Las cantidades las teclea la persona. NO se derivan de las fechas: eso
 * cambiaría cobros y necesitaría su propia verificación contra el histórico.
 *
 * GUARDA DE PREFACTURA CERRADA. Los renglones de una prefactura cerrada no se
 * tocan, y el modelo `FactPrefacturaRenglon` lo hace cumplir con eventos
 * `saving`/`deleting`. Pero el borrado masivo de `recalcular()`
 * (`renglones()->whereIn(...)->delete()`) es del constructor de consultas y NO
 * dispara esos eventos, así que no pasa por esa guarda. Por eso cada método de
 * aquí, DENTRO de su transacción, toma `lockForUpdate()` sobre la prefactura y
 * comprueba `estaCerrada()` contra lo leído de la base (no contra la instancia
 * recibida, que puede estar obsoleta). El candado es el mismo que toma
 * `CierrePrefactura`, de modo que el cierre y esto se serializan: sin él, el
 * cierre de otra sesión podía sellar entre la lectura y la escritura, y el
 * documento salía cobrando menos de lo que tiene, con el folio ya consumido.
 * Nunca se usa `increment()`/`decrement()` sobre renglones: se saltan la guarda.
 */
class CargosEstancia
{
    /**
     * Reemplaza los renglones de estancia de la prefactura (y solo esos: lo capturado
     * a mano no se toca). Una aeronave en Guarda, o sin ficha, no recibe ninguno nuevo
     * y además pierde los que ya tuviera, como en el sistema viejo.
     *
     * @return array{renglones: int, motivo: ?string} `motivo` dice por qué no se
     *                                                generó ningún renglón (o por qué faltó alguno), para que la pantalla
     *                                                lo explique en lugar de quedarse callada.
     *
     * @throws RenglonDePrefacturaCerradaException si la prefactura ya está cerrada.
     */
    public function recalcular(FactPrefactura $prefactura, int $pernoctas, int $transitos2h, int $transitos12h): array
    {
        if ($pernoctas < 0 || $transitos2h < 0 || $transitos12h < 0) {
            throw new InvalidArgumentException('Las cantidades de estancia no pueden ser negativas.');
        }

        return DB::transaction(function () use ($prefactura, $pernoctas, $transitos2h, $transitos12h) {
            $actual = $this->bloquearBorrador($prefactura);

            // La ficha se lee aquí, ya con candado, y no de la relación cacheada: el
            // estatus pudo cambiar (a Guarda, por ejemplo) desde que se cargó la instancia.
            $satelite = FactAeronave::query()->where('aeronave_id', $actual->aeronave_id)->first();

            // En el sistema viejo el DELETE de los servicios de estancia es INCONDICIONAL
            // (`insert22.php:82`) y el `if($estatus == 1)` que decide si se vuelven a
            // cobrar empieza mucho después (`:114`). Una aeronave en Guarda (o sin ficha)
            // pierde sus cargos de estancia previos y no recibe ninguno nuevo. Dejarlos
            // haría que el operador cerrara creyendo que no hay estancia y se facturara
            // a una aeronave que no la paga.
            if ($satelite === null) {
                $quitados = $this->quitarEstancia($actual);

                return [
                    'renglones' => 0,
                    'motivo' => 'La matrícula no tiene ficha de facturación, así que no hay tarifas de estancia que aplicar.'.$this->nota($quitados),
                ];
            }

            if ($satelite->estatus === FactAeronave::ESTATUS_GUARDA) {
                $quitados = $this->quitarEstancia($actual);

                return [
                    'renglones' => 0,
                    'motivo' => 'La aeronave está en Guarda y una aeronave en Guarda no paga estancia. Si corresponde cobrarla, corrige el estatus de la aeronave a Tránsito y vuelve a recalcular.'.$this->nota($quitados),
                ];
            }

            $conceptos = [
                [FactServicio::CONCEPTO_ESTANCIA_PERNOCTA, 'pernocta', $pernoctas, $satelite->tarifaPernocta()],
                [FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H, 'tránsito de 2 horas', $transitos2h, $satelite->tarifaTransito2h()],
                [FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H, 'tránsito de 12 horas', $transitos12h, $satelite->tarifaTransito12h()],
            ];

            // Se reemplazan solo los de estancia. Este borrado es masivo y no pasa
            // por la guarda del modelo: lo protege el candado y la comprobación de arriba.
            $ordenes = $actual->renglones()
                ->whereIn('concepto', FactServicio::CONCEPTOS_ESTANCIA)
                ->pluck('orden', 'concepto');

            $this->quitarEstancia($actual);

            $creados = 0;
            $sinTarifa = [];

            foreach ($conceptos as [$concepto, $etiqueta, $cantidad, $tarifa]) {
                if ($cantidad === 0) {
                    continue;
                }

                // Solo activos, igual que el paquete internacional: un servicio dado de
                // baja no se sigue cobrando.
                $servicio = FactServicio::porConcepto($concepto)->activos()->first();

                if ($servicio === null) {
                    // Lanza dentro de la transacción: el borrado de arriba se revierte.
                    throw new RuntimeException("No existe un servicio activo con concepto '{$concepto}'. Corre el importador de catálogos o reactívalo.");
                }

                if ($tarifa === null) {
                    $sinTarifa[] = $etiqueta;

                    continue;
                }

                // `$tarifa` llega como cadena decimal y se congela tal cual: nada de float.
                $actual->renglones()->create([
                    'servicio_id' => $servicio->id,
                    'nombre_servicio' => $servicio->nombre,
                    'precio_unitario' => $tarifa,
                    'cantidad' => $cantidad,
                    'es_de_tercero' => false,
                    'margen' => 0,
                    'ajuste_precio' => FactServicio::AJUSTE_NINGUNO,
                    'concepto' => $concepto,
                    'orden' => $ordenes[$concepto] ?? ($this->maximoOrden($actual) + 1),
                ]);

                $creados++;
            }

            $motivo = null;

            if ($sinTarifa !== []) {
                $motivo = 'No hay tarifa de '.implode(', ', $sinTarifa).' ni en la matrícula ni en su categoría, así que no se cobró.';
            } elseif ($creados === 0) {
                $motivo = 'Todas las cantidades de estancia están en cero, así que no hay nada que cobrar.';
            }

            return ['renglones' => $creados, 'motivo' => $motivo];
        });
    }

    /**
     * Agrega los servicios del paquete internacional que falten, con el precio del
     * catálogo. Devuelve cuántos agregó.
     *
     * @throws RenglonDePrefacturaCerradaException si la prefactura ya está cerrada.
     */
    public function agregarPaqueteInternacional(FactPrefactura $prefactura): int
    {
        return DB::transaction(function () use ($prefactura) {
            $actual = $this->bloquearBorrador($prefactura);

            // `array_filter`: un `NOT IN` con un NULL en la lista no devuelve nada.
            $yaPuestos = array_values(array_filter($actual->renglones()->pluck('servicio_id')->all()));

            $servicios = FactServicio::query()
                ->where('en_paquete_internacional', true)
                ->where('status', FactServicio::STATUS_ACTIVO)
                ->whereNotIn('id', $yaPuestos)
                ->orderBy('id')
                ->get();

            $orden = $this->maximoOrden($actual);
            $creados = 0;

            foreach ($servicios as $servicio) {
                $actual->renglones()->create([
                    'servicio_id' => $servicio->id,
                    'nombre_servicio' => $servicio->nombre,
                    'precio_unitario' => $servicio->precio_unitario,
                    'cantidad' => 1,
                    'es_de_tercero' => $servicio->es_de_tercero,
                    'margen' => $servicio->margen,
                    'ajuste_precio' => $servicio->ajuste_precio,
                    'concepto' => null,
                    'orden' => ++$orden,
                ]);

                $creados++;
            }

            return $creados;
        });
    }

    /**
     * Borra los renglones de estancia y devuelve cuántos quitó. Es un borrado MASIVO
     * y no pasa por la guarda del modelo: solo se llama con el candado tomado y la
     * prefactura ya comprobada como borrador (`bloquearBorrador()`).
     */
    private function quitarEstancia(FactPrefactura $prefactura): int
    {
        return $prefactura->renglones()->whereIn('concepto', FactServicio::CONCEPTOS_ESTANCIA)->delete();
    }

    private function nota(int $quitados): string
    {
        return match (true) {
            $quitados === 0 => '',
            $quitados === 1 => ' Se quitó 1 renglón de estancia que ya tenía la prefactura.',
            default => " Se quitaron {$quitados} renglones de estancia que ya tenía la prefactura.",
        };
    }

    /**
     * La prefactura leída de la base con `lockForUpdate()`, y rechazada si está
     * cerrada. Debe llamarse DENTRO de una transacción, antes de leer o escribir
     * renglones.
     */
    private function bloquearBorrador(FactPrefactura $prefactura): FactPrefactura
    {
        $actual = FactPrefactura::query()->whereKey($prefactura->id)->lockForUpdate()->firstOrFail();

        if ($actual->estaCerrada()) {
            throw new RenglonDePrefacturaCerradaException;
        }

        return $actual;
    }

    /** `reorder()`: la relación trae `ORDER BY`, que un agregado sin `GROUP BY` no admite en MySQL estricto. */
    private function maximoOrden(FactPrefactura $prefactura): int
    {
        return (int) $prefactura->renglones()->reorder()->max('orden');
    }
}
