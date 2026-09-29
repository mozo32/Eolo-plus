<?php

namespace App\Http\Controllers\Api\Facturacion;

use App\Http\Controllers\Controller;
use App\Http\Requests\Facturacion\StorePrecioCombustibleRequest;
use App\Models\Bitacora;
use App\Models\FactPrecioCombustible;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Precio del combustible con vigencias. Un precio nuevo cierra el anterior;
 * los precios no se editan ni se borran, así el histórico es verificable.
 * Escribir exige el subdepartamento factCombustible (ver routes/api.php).
 */
class PrecioCombustibleController extends Controller
{
    private const PER_PAGE_PERMITIDOS = [10, 20, 50, 100];

    /** Histórico paginado, del más reciente al más antiguo. */
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        if (! in_array($perPage, self::PER_PAGE_PERMITIDOS, true)) {
            $perPage = 20;
        }

        return response()->json(
            FactPrecioCombustible::query()
                ->with('capturadoPor:id,name')
                ->orderByDesc('id')
                ->paginate($perPage)
        );
    }

    /** El precio en uso, o null si todavía no se ha registrado ninguno. */
    public function vigente(): JsonResponse
    {
        return response()->json(['precio' => FactPrecioCombustible::vigente()]);
    }

    public function store(StorePrecioCombustibleRequest $request): JsonResponse
    {
        $datos = $request->validated();

        $precio = FactPrecioCombustible::registrar(
            (float) $datos['precio_asa'],
            isset($datos['precio_eolo']) ? (float) $datos['precio_eolo'] : null,
            (int) $request->user()->id,
        );

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_CREAR,
            descripcion: "Se registró el precio del combustible: ASA {$precio->precio_asa}, Eolo {$precio->precio_eolo}.",
            registroId: $precio->id,
            datosNuevos: [
                'precio_asa' => $precio->precio_asa,
                'precio_eolo' => $precio->precio_eolo,
                'vigencia_inicio' => $precio->vigencia_inicio?->format('Y-m-d'),
            ],
        );

        return response()->json([
            'message' => 'Precio de combustible registrado correctamente.',
            'precio' => $precio,
        ], 201);
    }
}
