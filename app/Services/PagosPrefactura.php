<?php

namespace App\Services;

use App\Models\Bitacora;
use App\Models\FactFormaPago;
use App\Models\FactPrefactura;
use App\Models\FactPrefacturaPago;
use App\Models\FactServicio;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use UnexpectedValueException;

/**
 * Los pagos de una prefactura, con las reglas por forma de pago.
 *
 * Cada operación toma `lockForUpdate()` sobre la prefactura DENTRO de su
 * transacción —el mismo candado que toma `CierrePrefactura`— de modo que cobrar y
 * cerrar se serializan: sin él, un pago que entra durante el cierre quedaría fuera
 * de la comprobación de cobro y el documento saldría diciendo otra cosa.
 *
 * Las reglas salen de `Prefectura/mpago.php` y se identifican por el CONCEPTO de la
 * forma de pago, no por su nombre, que se edita en pantalla.
 */
class PagosPrefactura
{
    /** El máximo de `fact_prefactura_pagos.monto`, `decimal(12,2)`. */
    public const MONTO_MAXIMO = '9999999999.99';

    /**
     * `$monto` es una cadena decimal positiva y se queda como cadena: nunca float. Acepta
     * lo mismo que `StorePagoRequest` (`+5.00`, `.50`, `5.`) y lo guarda con dos decimales.
     *
     * @throws InvalidArgumentException si `$monto` no es un decimal positivo de hasta dos decimales.
     * @throws PagoNoPermitidoException si `$monto` pasa del máximo de la columna (`monto_fuera_de_rango`).
     * @throws RenglonDePrefacturaCerradaException si la prefactura ya está cerrada.
     * @throws PrefacturaDescartadaException si el borrador está descartado.
     * @throws PagoNoPermitidoException si una regla de cobro lo rechaza.
     */
    public function registrar(FactPrefactura $prefactura, int $formaPagoId, string $monto, int $userId): FactPrefacturaPago
    {
        $monto = $this->normalizarMonto($monto);

        return DB::transaction(function () use ($prefactura, $formaPagoId, $monto, $userId) {
            $actual = $this->bloquearBorrador($prefactura);

            // Se lee aquí, dentro de la transacción, y se exige activa: el Form Request ya lo
            // validó, pero este servicio también lo llama la acción de Amex y no confía en
            // nadie. Sin `lockForUpdate()` a propósito: la fila de una forma de pago la
            // comparten todos los cobros de todas las prefacturas, y un candado exclusivo
            // ahí los serializaría a todos.
            $forma = FactFormaPago::query()->activos()->find($formaPagoId);

            if ($forma === null) {
                throw new PagoNoPermitidoException('Esa forma de pago no existe o está dada de baja.', 'forma_de_pago_no_disponible');
            }

            $this->exigirQueLaReglaLoPermita($actual, $forma, $monto);

            $pago = $actual->pagos()->create([
                'forma_pago_id' => $forma->id,
                'monto' => $monto,
                'user_id' => $userId,
            ]);

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_CREAR,
                descripcion: "Se registró un pago de {$monto} con {$forma->nombre} en la prefactura {$actual->id}.",
                usuarioId: $userId,
                registroId: $actual->id,
                datosNuevos: ['pago_id' => $pago->id, 'forma_pago' => $forma->nombre, 'monto' => $monto],
            );

            return $pago;
        });
    }

    /**
     * Baja lógica, y con ella la comisión que ese pago hubiera creado.
     *
     * Quita SOLO la comisión que este pago creó, no todas las de la prefactura, que
     * es lo que hace `eliminar_f.php` del sistema viejo: ahí un segundo pago Amex
     * perdería su comisión al borrar el primero.
     *
     * Funciona igual cuando el pago no tiene renglón de comisión: es lo normal (solo
     * Amex lo tiene) y también lo que queda cuando ese renglón se borró por otra vía
     * (el endpoint de renglones, en un borrador), que deja `renglon_comision_id` en NULL.
     *
     * @throws RenglonDePrefacturaCerradaException si la prefactura ya está cerrada.
     * @throws PrefacturaDescartadaException si el borrador está descartado.
     */
    public function quitar(FactPrefactura $prefactura, int $pagoId, int $userId): void
    {
        DB::transaction(function () use ($prefactura, $pagoId, $userId) {
            $actual = $this->bloquearBorrador($prefactura);
            $pago = $actual->pagos()->whereKey($pagoId)->firstOrFail();
            $forma = $pago->formaPago;
            $monto = (string) $pago->monto;

            // Borrado POR MODELO del renglón: dispara `deleting` y con él la guarda de
            // cerrada. Nunca un `delete()` masivo.
            //
            // El importe de la comisión es solo para la bitácora, y NO puede impedir la
            // baja: con un ajuste de precio ilegible `importe()` lanza, y un cobro que no se
            // puede deshacer deja el documento sin corrección posible. Se reporta y el
            // borrado sigue adelante.
            $comision = $pago->renglonComision;
            $importeComision = null;
            $importeIlegible = false;

            if ($comision !== null) {
                try {
                    $importeComision = $comision->importe();
                } catch (UnexpectedValueException $e) {
                    report($e);
                    $importeIlegible = true;
                }

                $comision->delete();
            }

            $pago->update(['status' => FactPrefacturaPago::STATUS_INACTIVO]);

            $conComision = match (true) {
                $comision === null => '',
                $importeIlegible => ' y se quitó su comisión (su importe no se pudo calcular)',
                default => " y se quitó su comisión de {$importeComision}",
            };

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_ELIMINAR,
                descripcion: "Se quitó el pago de {$monto} con {$forma->nombre} de la prefactura {$actual->id}{$conComision}.",
                usuarioId: $userId,
                registroId: $actual->id,
                datosAnteriores: [
                    'pago_id' => $pago->id,
                    'forma_pago' => $forma->nombre,
                    'monto' => $monto,
                    'comision' => $importeComision,
                    'comision_quitada' => $comision !== null,
                ],
            );
        });
    }

    /**
     * Las reglas de cobro, por concepto de la forma de pago: efectivo, AvCard y el tope de
     * las demás salen de `mpago.php`; la de Amex es de este módulo (el viejo la resolvía
     * en otra pantalla).
     *
     * @throws PagoNoPermitidoException
     */
    private function exigirQueLaReglaLoPermita(FactPrefactura $prefactura, FactFormaPago $forma, string $monto): void
    {
        if ($forma->concepto === FactFormaPago::CONCEPTO_AMEX) {
            throw new PagoNoPermitidoException(
                'El pago con Amex se registra desde su propia acción, que además agrega la comisión.',
                'amex_por_su_endpoint',
            );
        }

        if ($forma->concepto === FactFormaPago::CONCEPTO_AVCARD) {
            // El combustible se reconoce por concepto: `id_servicio = 7` es del viejo.
            if ($prefactura->renglones()->where('concepto', FactServicio::CONCEPTO_COMBUSTIBLE)->exists()) {
                throw new PagoNoPermitidoException(
                    "{$forma->nombre} no se puede usar en una prefactura que tiene combustible.",
                    'avcard_con_combustible',
                );
            }

            // Sin tope, como el viejo. Puede dejarla sobrepagada y la pantalla lo avisa.
            return;
        }

        if ($forma->concepto === FactFormaPago::CONCEPTO_EFECTIVO) {
            // El efectivo puede exceder: el exceso es cambio.
            return;
        }

        try {
            $falta = $prefactura->porCobrar();
        } catch (UnexpectedValueException $e) {
            // La tasa de IVA o un renglón no se reconocen: no hay total contra el que topar.
            // Se reporta: bloquea TODOS los cobros con tarjeta y el 422 culpa al pago.
            report($e);

            throw new PagoNoPermitidoException(
                'No se puede calcular lo que falta por cobrar: un renglón o la tasa de IVA tienen un valor que no se reconoce.',
                'totales_no_calculables',
            );
        }

        if (bccomp($monto, $falta, 2) > 0) {
            throw new PagoNoPermitidoException(
                "El monto supera lo que falta por cobrar: faltan {$falta}.",
                'supera_lo_que_falta',
            );
        }
    }

    /**
     * El mismo candado y la misma guarda que usa `CargosEstancia`, y además la de
     * descartado: el controlador la comprueba en el chequeo rápido, pero entre ese
     * chequeo y este candado otra sesión pudo descartar el borrador.
     */
    private function bloquearBorrador(FactPrefactura $prefactura): FactPrefactura
    {
        $actual = FactPrefactura::query()->whereKey($prefactura->id)->lockForUpdate()->firstOrFail();

        if ($actual->estaCerrada()) {
            throw new RenglonDePrefacturaCerradaException;
        }

        if ($actual->status === FactPrefactura::STATUS_INACTIVO) {
            throw new PrefacturaDescartadaException('Este borrador está descartado: ya no se puede modificar ni cerrar.');
        }

        return $actual;
    }

    /**
     * Un decimal positivo de hasta dos decimales, con exactamente dos: así entra a `bc` y a
     * la bitácora. Tan tolerante como `StorePagoRequest` (`numeric` + `decimal:0,2`): acepta
     * un `+` inicial, `.50` y `5.`; quien escribe `.50` en un campo de importe no debe
     * recibir un error de servidor. No acepta notación científica ni espacios.
     */
    private function normalizarMonto(string $monto): string
    {
        if (! preg_match('/^\+?(\d+(\.\d{0,2})?|\.\d{1,2})$/', $monto)) {
            throw new InvalidArgumentException("El monto '{$monto}' no es un decimal positivo de hasta dos decimales.");
        }

        $monto = ltrim($monto, '+');

        // `bc` es estricto con los extremos: se completan a mano.
        if (str_starts_with($monto, '.')) {
            $monto = '0'.$monto;
        }

        if (str_ends_with($monto, '.')) {
            $monto .= '0';
        }

        $monto = bcadd($monto, '0', 2);

        if (bccomp($monto, '0.00', 2) <= 0) {
            throw new InvalidArgumentException("El monto '{$monto}' no es un decimal positivo de hasta dos decimales.");
        }

        // El máximo de `decimal(12,2)`, el mismo que `StorePagoRequest`: la acción de Amex
        // llama sin Form Request, y sin esto un monto mayor reventaría la base.
        if (bccomp($monto, self::MONTO_MAXIMO, 2) > 0) {
            throw new PagoNoPermitidoException(
                'El monto pasa del máximo que admite un pago: '.self::MONTO_MAXIMO.'.',
                'monto_fuera_de_rango',
            );
        }

        return $monto;
    }
}
