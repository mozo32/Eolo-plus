<?php

namespace App\Services;

use App\Models\FactAeronave;
use App\Models\FactPrefactura;
use App\Models\FactServicio;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

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
     * Los renglones que ya eran cortesía lo siguen siendo (por concepto): se conserva
     * y el `motivo` lo dice, con el importe que no se cobra.
     *
     * @return array{renglones: int, motivo: ?string} `motivo` dice por qué no se
     *                                                generó ningún renglón (o por qué faltó alguno) y qué cortesías se
     *                                                conservaron, para que la pantalla lo explique en lugar de quedarse callada.
     *
     * @throws RenglonDePrefacturaCerradaException si la prefactura ya está cerrada.
     * @throws ServicioDeEstanciaNoDisponibleException si falta (o está de baja) el servicio de un concepto con cantidad; se revierte todo.
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

            // La cortesía se lee ANTES del borrado, igual que el orden: quien corrige una
            // cantidad de pernoctas no está cambiando de opinión sobre la cortesía.
            $cortesias = $actual->renglones()
                ->whereIn('concepto', FactServicio::CONCEPTOS_ESTANCIA)
                ->pluck('es_cortesia', 'concepto');

            $this->quitarEstancia($actual);

            $creados = 0;
            $sinTarifa = [];
            $conservadas = [];

            foreach ($conceptos as [$concepto, $etiqueta, $cantidad, $tarifa]) {
                if ($cantidad === 0) {
                    continue;
                }

                // Solo activos, igual que el paquete internacional: un servicio dado de
                // baja no se sigue cobrando.
                $servicio = FactServicio::porConcepto($concepto)->activos()->first();

                if ($servicio === null) {
                    // Lanza dentro de la transacción: el borrado de arriba se revierte.
                    throw new ServicioDeEstanciaNoDisponibleException("No existe un servicio activo con concepto '{$concepto}'. Corre el importador de catálogos o reactívalo.");
                }

                if ($tarifa === null) {
                    $sinTarifa[] = $etiqueta;

                    continue;
                }

                // `$tarifa` llega como cadena decimal y se congela tal cual: nada de float.
                $renglon = $actual->renglones()->create([
                    'servicio_id' => $servicio->id,
                    'nombre_servicio' => $servicio->nombre,
                    'precio_unitario' => $tarifa,
                    'cantidad' => $cantidad,
                    'es_de_tercero' => false,
                    'margen' => 0,
                    'ajuste_precio' => FactServicio::AJUSTE_NINGUNO,
                    'concepto' => $concepto,
                    'orden' => $ordenes[$concepto] ?? ($this->maximoOrden($actual) + 1),
                    'es_cortesia' => (bool) ($cortesias[$concepto] ?? false),
                ]);

                if ($renglon->es_cortesia) {
                    $conservadas[] = "{$etiqueta} (no se cobran {$renglon->importeSinCortesia()})";
                }

                $creados++;
            }

            $motivo = null;

            if ($sinTarifa !== []) {
                $motivo = 'No hay tarifa de '.implode(', ', $sinTarifa).' ni en la matrícula ni en su categoría, así que no se cobró.';
            } elseif ($creados === 0) {
                $motivo = 'Todas las cantidades de estancia están en cero, así que no hay nada que cobrar.';
            }

            // Conservar la cortesía no puede pasar en silencio: al subir una cantidad crece
            // lo que se deja de cobrar, y el operador debe verlo.
            if ($conservadas !== []) {
                $cuantos = count($conservadas);
                $aviso = ($cuantos === 1 ? 'Se conservó la cortesía de 1 renglón de estancia: ' : "Se conservó la cortesía de {$cuantos} renglones de estancia: ")
                    .implode(', ', $conservadas).'.';
                $motivo = $motivo === null ? $aviso : $motivo.' '.$aviso;
            }

            return ['renglones' => $creados, 'motivo' => $motivo];
        });
    }

    /**
     * Agrega los servicios del paquete internacional que falten, con el precio del
     * catálogo. Solo se agregan los ACTIVOS: uno dado de baja no se cobra, y eso es
     * correcto, pero NO puede pasar en silencio. Un paquete que agrega 3 de 4 cobra
     * de menos y el toast diría «agregado», así que el resultado dice qué faltó.
     *
     * `renglones` es cuántos agregó. `activos` es cuántos servicios activos tiene el
     * paquete en el catálogo y `faltantes` los nombres de los dados de baja que no se
     * agregaron. `en_paquete` es cuántos servicios del paquete tiene la prefactura al
     * terminar (los agregados y los que ya estaban): si es 0, el destino NO debe
     * marcarse internacional. `motivo` lo dice con palabras, para que la pantalla lo
     * explique en lugar de quedarse callada.
     *
     * @return array{renglones: int, en_paquete: int, activos: int, faltantes: list<string>, motivo: ?string}
     *
     * @throws RenglonDePrefacturaCerradaException si la prefactura ya está cerrada.
     */
    public function agregarPaqueteInternacional(FactPrefactura $prefactura): array
    {
        return DB::transaction(function () use ($prefactura) {
            $actual = $this->bloquearBorrador($prefactura);

            // `array_filter`: un `NOT IN` con un NULL en la lista no devuelve nada.
            $yaPuestos = array_values(array_filter($actual->renglones()->pluck('servicio_id')->all()));

            // El paquete COMPLETO, activo o no: hace falta saber qué quedó fuera y por qué.
            $paquete = FactServicio::query()
                ->where('en_paquete_internacional', true)
                ->orderBy('id')
                ->get();

            $servicios = $paquete
                ->where('status', FactServicio::STATUS_ACTIVO)
                ->whereNotIn('id', $yaPuestos);

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

            // Un servicio dado de baja que ya está en los renglones no «falta»: ya se cobra.
            $dadosDeBaja = $paquete
                ->where('status', '!=', FactServicio::STATUS_ACTIVO)
                ->whereNotIn('id', $yaPuestos)
                ->pluck('nombre')
                ->all();

            $enPaquete = $paquete->whereIn('id', $yaPuestos)->count() + $creados;

            return [
                'renglones' => $creados,
                'en_paquete' => $enPaquete,
                'activos' => $paquete->where('status', FactServicio::STATUS_ACTIVO)->count(),
                'faltantes' => $dadosDeBaja,
                'motivo' => $this->motivoDelPaquete($paquete->count(), $creados, $dadosDeBaja),
            ];
        });
    }

    /**
     * @param  list<string>  $dadosDeBaja  nombres de los servicios del paquete que no se agregaron por estar de baja
     */
    private function motivoDelPaquete(int $marcados, int $creados, array $dadosDeBaja): ?string
    {
        if ($dadosDeBaja !== []) {
            $nombres = implode(', ', $dadosDeBaja);
            $activos = $marcados - count($dadosDeBaja);
            $cuantos = count($dadosDeBaja) === 1 ? '1 servicio del paquete está dado de baja' : count($dadosDeBaja).' servicios del paquete están dados de baja';

            if ($activos === 0 && $creados === 0) {
                return "No se agregó ningún servicio del paquete internacional: {$cuantos} en el catálogo ({$nombres}) y no hay ninguno activo. Reactívalos en el catálogo de servicios y vuelve a intentarlo.";
            }

            return "El paquete internacional quedó incompleto y se cobra de menos: {$cuantos} en el catálogo y no se agregó ({$nombres}). Si corresponde cobrarlo, reactívalo en el catálogo y agrégalo con AGREGAR SERVICIO.";
        }

        if ($marcados === 0) {
            return 'El catálogo no tiene ningún servicio marcado como paquete internacional, así que no se agregó nada. Reimporta el catálogo de servicios o márcalos en la pantalla de servicios.';
        }

        return null;
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
