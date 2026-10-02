<?php

namespace App\Services;

use App\Models\Bitacora;
use App\Models\FactConfiguracion;
use App\Models\FactPrefactura;
use Illuminate\Support\Facades\DB;
use UnexpectedValueException;

/**
 * Cierra una prefactura: le asigna folio, le sella los totales y lo registra.
 *
 * Todo en una transacción, y el folio sale de un contador leído con
 * `lockForUpdate()`. NO se usa `MAX(folio) + 1`: eso es lo que hace el sistema
 * viejo (`$folp = $hpref3+1` en `a_pref.php`) y es lo que produjo sus 207 folios
 * duplicados, porque entre leer el máximo y escribir otra sesión lee el mismo
 * máximo. El índice único de `folio` queda como última red, no como mecanismo.
 */
class CierrePrefactura
{
    public const CLAVE_FOLIO = 'prefactura_folio_siguiente';

    /** La serie propia arranca aquí: el mayor folio del sistema viejo es 4121 y sus borradores llegan a 4123. */
    public const FOLIO_INICIAL = 10000;

    /**
     * `$confirmarSinCobro` es la confirmación explícita de cerrar con los pagos por debajo
     * del total. Por defecto NO: quien cierra sin cobro completo tiene que decirlo.
     *
     * @throws PrefacturaSinCobroException si los pagos no cubren el total y no se confirmó.
     * @throws TotalesNoCalculablesException si la tasa de IVA o un renglón no se reconocen.
     */
    public function cerrar(FactPrefactura $prefactura, int $userId, bool $confirmarSinCobro = false): FactPrefactura
    {
        // Falla rápido sin abrir transacción; se REPITE adentro, ya con candado,
        // porque la instancia recibida pudo quedar vieja.
        if ($prefactura->estaCerrada()) {
            throw new PrefacturaYaCerradaException('Esta prefactura ya está cerrada.');
        }

        return DB::transaction(function () use ($prefactura, $userId, $confirmarSinCobro) {
            // CANDADO antes de leer los renglones. Sin él, un renglón que otra sesión
            // agregue durante el cierre queda fuera del sello: el documento se emite
            // cobrando menos de lo que tiene, y el folio ya se consumió.
            $prefactura = FactPrefactura::query()->whereKey($prefactura->id)->lockForUpdate()->firstOrFail();

            if ($prefactura->estaCerrada()) {
                throw new PrefacturaYaCerradaException('Esta prefactura ya está cerrada.');
            }

            // Un folio es lo único que no se puede des-consumir. El endpoint ya rechaza un
            // borrador descartado, pero el invariante vive aquí también: cerrar desde
            // código no debe gastar un folio en un documento que nadie ve.
            if ($prefactura->status === FactPrefactura::STATUS_INACTIVO) {
                throw new PrefacturaDescartadaException('Este borrador está descartado: no se puede cerrar.');
            }

            if ($prefactura->cliente_id === null) {
                throw new PrefacturaIncompletaException('Falta el cliente: sin cliente no se puede facturar.');
            }

            if ($prefactura->renglones()->count() === 0) {
                throw new PrefacturaIncompletaException('La prefactura no tiene ningún renglón.');
            }

            // Los totales se leen ANTES de consumir el folio y de cambiar el estado:
            // si la tasa de IVA es ilegible esto lanza y el folio no se gasta. Se usan
            // los métodos del modelo, NO una copia de la fórmula (el redondeo del IVA
            // vive en `FactPrefactura::iva()`), y van antes del cambio de estado porque
            // los totales deciden por `estaCerrada()`.
            //
            // SOLO estas lecturas se envuelven: `siguienteFolio()` lanza también
            // `UnexpectedValueException` (contador corrupto) y no debe confundirse con esto.
            try {
                $subtotal = $prefactura->subtotal();
                $tasa = $prefactura->ivaTasa();
                $iva = $prefactura->iva();
                $total = $prefactura->total();
            } catch (UnexpectedValueException $e) {
                throw new TotalesNoCalculablesException($e->getMessage(), previous: $e);
            }

            // El aviso del cobro va DESPUÉS de los totales (necesita el total) y ANTES
            // del folio (si lanza, no se gasta). El sistema viejo deja imprimir sin
            // cobrar —289 de sus 3,764 cerradas no tienen pago— así que esto NO bloquea:
            // pide una confirmación explícita, que es lo que el viejo no hacía. Solo la
            // FALTA de cobro la pide: una prefactura sobrepagada cierra sin confirmar.
            //
            // Lo que se cierra SIN cobro completo queda dicho en la bitácora (abajo): sin
            // ese rastro, a posteriori sería tan silencioso como en el sistema viejo.
            $pagado = $prefactura->pagado();
            $faltante = null;

            if (bccomp($pagado, $total, 2) < 0) {
                if (! $confirmarSinCobro) {
                    throw new PrefacturaSinCobroException(bcsub($total, $pagado, 2));
                }

                $faltante = bcsub($total, $pagado, 2);
            }

            $folio = $this->siguienteFolio();

            // Respaldo, no mecanismo: la fila ya está en X por el `lockForUpdate` de
            // arriba, así que ninguna otra sesión pudo cerrarla desde entonces. Si aun
            // así no afecta ninguna fila, no se emite nada y la transacción se revierte
            // con el folio incluido.
            $filas = FactPrefactura::query()
                ->where('id', $prefactura->id)
                ->where('estado', FactPrefactura::ESTADO_BORRADOR)
                ->update([
                    'folio' => $folio,
                    'estado' => FactPrefactura::ESTADO_CERRADA,
                    'subtotal_sellado' => $subtotal,
                    'iva_sellado' => $iva,
                    'total_sellado' => $total,
                    'iva_tasa_sellada' => $tasa,
                    'cerrada_at' => now(),
                    'cerrada_por' => $userId,
                    'updated_at' => now(),
                ]);

            if ($filas === 0) {
                throw new PrefacturaYaCerradaException('Esta prefactura ya está cerrada.');
            }

            // El sello sale de varias lecturas (renglones y tasa) y solo es coherente
            // si el aislamiento es REPEATABLE READ, que `config/database.php` no fija.
            // Se compara con la derivación ya sellada: si algo se movió entre lecturas,
            // se revierte antes de que el folio quede consumido.
            $cerrada = FactPrefactura::query()->findOrFail($prefactura->id);

            if ($cerrada->selloDiscrepa()) {
                throw new SelloInconsistenteException(
                    'El sello no coincide con los renglones; el cierre se canceló y no consumió folio.'
                );
            }

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_FINALIZAR,
                descripcion: "Se cerró la prefactura con folio {$folio} por un total de {$total}."
                    .($faltante === null ? '' : " Se confirmó cerrar sin cobro completo: pagado {$pagado}, faltan {$faltante}."),
                usuarioId: $userId,
                registroId: $prefactura->id,
                datosNuevos: [
                    'folio' => $folio,
                    'subtotal' => $subtotal,
                    'iva_tasa' => $tasa,
                    'iva' => $iva,
                    'total' => $total,
                ] + ($faltante === null ? [] : [
                    'pagado' => $pagado,
                    'faltante' => $faltante,
                    'confirmado_sin_cobro' => true,
                ]),
            );

            return $cerrada;
        });
    }

    /**
     * El contador, con bloqueo de fila. La fila la siembra una migración: aquí NO se
     * crea, porque un `insert ignore` en cada cierre provoca deadlock bajo InnoDB
     * (candado compartido por el duplicado, luego dos exclusivos que se esperan).
     */
    private function siguienteFolio(): int
    {
        $fila = FactConfiguracion::query()
            ->where('clave', self::CLAVE_FOLIO)
            ->lockForUpdate()
            ->firstOrFail();

        // Un contador corrupto no se interpreta: `(int) 'x'` daría folio 0.
        if (preg_match('/^[1-9]\d*$/', (string) $fila->valor) !== 1) {
            throw new UnexpectedValueException(
                "El contador '".self::CLAVE_FOLIO."' no es un entero positivo: '{$fila->valor}'"
            );
        }

        $folio = (int) $fila->valor;
        $fila->update(['valor' => (string) ($folio + 1)]);

        return $folio;
    }
}
