<?php

namespace App\Http\Controllers\Api\Facturacion;

use App\Http\Controllers\Api\Facturacion\Concerns\RechazaPrefacturaCerrada;
use App\Http\Controllers\Controller;
use App\Http\Requests\Facturacion\StorePagoRequest;
use App\Models\FactPrefactura;
use App\Services\PagoNoPermitidoException;
use App\Services\PagosPrefactura;
use App\Services\PrefacturaDescartadaException;
use App\Services\RenglonDePrefacturaCerradaException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Los pagos de una prefactura. Solo en borrador: al cerrar quedan congelados como
 * los renglones y los totales, porque un documento emitido no cambia.
 *
 * `RenglonDePrefacturaCerradaException` tiene su propio `render()` y se traduce
 * sola a 409; aquí solo se atrapa lo que es propio de los pagos.
 */
class PrefacturaPagoController extends Controller
{
    use RechazaPrefacturaCerrada;

    public function store(StorePagoRequest $request, int $id, PagosPrefactura $pagos): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazoRapido($prefactura)) {
            return $respuesta;
        }

        try {
            $pago = $pagos->registrar(
                $prefactura,
                (int) $request->validated()['forma_pago_id'],
                (string) $request->validated()['monto'],
                $request->user()->id,
            );
        } catch (PagoNoPermitidoException $e) {
            return response()->json(['message' => $e->getMessage(), 'codigo' => $e->codigo], 422);
        } catch (PrefacturaDescartadaException $e) {
            return $this->descartadaBajoCandado($e);
        }

        return response()->json([
            'message' => 'Pago registrado.',
            'pago_id' => $pago->id,
            'prefactura' => app(PrefacturaController::class)->fichaDe($id),
        ], 201);
    }

    public function destroy(Request $request, int $id, int $pago, PagosPrefactura $pagos): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazoRapido($prefactura)) {
            return $respuesta;
        }

        try {
            $pagos->quitar($prefactura, $pago, $request->user()->id);
        } catch (PrefacturaDescartadaException $e) {
            return $this->descartadaBajoCandado($e);
        }

        return response()->json([
            'message' => 'Pago eliminado.',
            'prefactura' => app(PrefacturaController::class)->fichaDe($id),
        ]);
    }

    /** Se descartó entre el chequeo rápido y el candado: se responde igual que el chequeo rápido. */
    private function descartadaBajoCandado(PrefacturaDescartadaException $e): JsonResponse
    {
        return response()->json(['message' => $e->getMessage(), 'codigo' => 'ya_descartada'], 409);
    }
}
