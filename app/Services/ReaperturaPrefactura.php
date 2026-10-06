<?php

namespace App\Services;

use App\Models\Bitacora;
use App\Models\FactPrefactura;
use App\Models\FactPrefacturaVersion;
use Illuminate\Support\Facades\DB;

/**
 * Reabre una prefactura cerrada: guarda el documento que se imprimió como una versión y la
 * deja editable, con su folio.
 *
 * El folio NO se libera ni se vuelve a pedir: es el mismo documento corregido, no otro.
 * Quien lo conserva es `CierrePrefactura::cerrar()`, que pide folio nuevo solo si la
 * prefactura no tiene.
 */
class ReaperturaPrefactura
{
    public function __construct(private DocumentoDePrefactura $documento) {}

    /**
     * @throws PrefacturaNoReabribleException si no está cerrada o su sello no cuadra.
     * @throws \UnexpectedValueException si un renglón o la tasa no se reconocen (el
     *                                   controlador lo traduce a 422).
     */
    public function reabrir(FactPrefactura $prefactura, int $userId, string $motivo): FactPrefactura
    {
        // Falla rápido sin abrir transacción; se REPITE adentro, ya con candado, porque la
        // instancia recibida pudo quedar vieja.
        if (! $prefactura->estaCerrada()) {
            throw new PrefacturaNoReabribleException('Solo una prefactura cerrada se reabre.');
        }

        return DB::transaction(function () use ($prefactura, $userId, $motivo) {
            // CANDADO antes de leer los renglones: sin él, dos sesiones reabriendo a la vez
            // tomarían dos instantáneas de lo mismo y pelearían por el número de versión.
            $actual = FactPrefactura::query()->whereKey($prefactura->id)->lockForUpdate()->firstOrFail();

            if (! $actual->estaCerrada()) {
                throw new PrefacturaNoReabribleException('Solo una prefactura cerrada se reabre.');
            }

            $actual->load(['renglones', 'pagos.formaPago', 'cliente', 'aeronave.tipoAeronave', 'satelite.categoria', 'cerradaPor']);

            if ($actual->selloDiscrepa()) {
                throw new PrefacturaNoReabribleException(
                    'El sello de esta prefactura no coincide con sus renglones, así que no se puede reabrir. Aclara la diferencia primero.'
                );
            }

            $documento = $this->documento->instantanea($actual);

            $version = ((int) FactPrefacturaVersion::query()
                ->where('prefactura_id', $actual->id)
                ->max('version')) + 1;

            FactPrefacturaVersion::create([
                'prefactura_id' => $actual->id,
                'version' => $version,
                'folio' => $actual->folio,
                'subtotal_sellado' => $actual->subtotal_sellado,
                'iva_sellado' => $actual->iva_sellado,
                'total_sellado' => $actual->total_sellado,
                'iva_tasa_sellada' => $actual->iva_tasa_sellada,
                'cerrada_at' => $actual->cerrada_at,
                'cerrada_por' => $actual->cerrada_por,
                'reabierta_at' => now(),
                'reabierta_por' => $userId,
                'motivo' => $motivo,
                'documento' => $documento,
            ]);

            // El sello se LIMPIA: su único dueño es ahora la versión. Dejarlo aquí sería un
            // número sin dueño esperando que alguien lo lea como vigente.
            $actual->update([
                'estado' => FactPrefactura::ESTADO_REABIERTA,
                'subtotal_sellado' => null,
                'iva_sellado' => null,
                'total_sellado' => null,
                'iva_tasa_sellada' => null,
                'cerrada_at' => null,
                'cerrada_por' => null,
            ]);

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_ACTUALIZAR,
                descripcion: "Se reabrió la prefactura con folio {$actual->folio} para corregirla (versión {$version} guardada). Motivo: {$motivo}",
                usuarioId: $userId,
                registroId: $actual->id,
                datosAnteriores: [
                    'estado' => FactPrefactura::ESTADO_CERRADA,
                    'subtotal' => (string) $documento['subtotal'],
                    'iva' => (string) $documento['iva'],
                    'total' => (string) $documento['total'],
                ],
                datosNuevos: ['estado' => FactPrefactura::ESTADO_REABIERTA, 'version_guardada' => $version],
            );

            return $actual->fresh();
        });
    }
}
