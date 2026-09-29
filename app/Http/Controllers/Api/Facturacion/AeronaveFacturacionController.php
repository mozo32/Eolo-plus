<?php

namespace App\Http\Controllers\Api\Facturacion;

use App\Http\Controllers\Controller;
use App\Http\Requests\Facturacion\UpdateAeronaveFacturacionRequest;
use App\Models\Bitacora;
use App\Models\FactAeronave;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Atributos de cobro de cada matrícula (satélite `fact_aeronaves`): categoría,
 * tipo de motor, estatus, derecho de vuelos y tarifas propias.
 *
 * Las matrículas se crean solas al darse de alta la aeronave; aquí solo se
 * consultan y se editan. Escribir exige el subdepartamento factAeronaves.
 */
class AeronaveFacturacionController extends Controller
{
    private const PER_PAGE_PERMITIDOS = [10, 20, 50, 100];

    private const CAMPOS_BITACORA = [
        'categoria_aeronave_id', 'tipo_motor_id', 'estatus', 'cobra_derecho_vuelos',
        'tarifa_pernocta', 'tarifa_transito_2h', 'tarifa_transito_12h', 'tarifa_aterrizaje',
    ];

    /**
     * Filtros: `q` (matrícula), `estatus`, `sin_categoria=1` (las que aún no se
     * pueden facturar).
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        if (! in_array($perPage, self::PER_PAGE_PERMITIDOS, true)) {
            $perPage = 20;
        }

        $query = FactAeronave::query()
            ->select('fact_aeronaves.*')
            ->join('aeronaves', 'aeronaves.id', '=', 'fact_aeronaves.aeronave_id')
            ->with(['aeronave:id,matricula', 'categoria', 'tipoMotor'])
            ->orderBy('aeronaves.matricula');

        if ($request->filled('q')) {
            $query->where('aeronaves.matricula', 'LIKE', '%'.strtoupper(trim((string) $request->query('q'))).'%');
        }

        if (in_array($request->query('estatus'), [FactAeronave::ESTATUS_GUARDA, FactAeronave::ESTATUS_TRANSITO], true)) {
            $query->where('fact_aeronaves.estatus', $request->query('estatus'));
        }

        if ($request->boolean('sin_categoria')) {
            $query->whereNull('fact_aeronaves.categoria_aeronave_id');
        }

        $pagina = $query->paginate($perPage)->appends($request->query());
        $pagina->through(fn (FactAeronave $satelite) => $this->presentar($satelite));

        return response()->json($pagina);
    }

    public function update(UpdateAeronaveFacturacionRequest $request, int $id): JsonResponse
    {
        $satelite = FactAeronave::query()->with('aeronave:id,matricula')->findOrFail($id);
        $anteriores = $this->datosBitacora($satelite);

        // validated() solo trae lo que llegó: una tarifa ausente no se toca.
        $satelite->update($request->validated());
        $satelite->load(['categoria', 'tipoMotor']);

        Bitacora::log(
            modulo: Bitacora::MODULO_FACTURACION_CATALOGOS,
            accion: Bitacora::ACCION_ACTUALIZAR,
            descripcion: "Se actualizaron los datos de facturación de la matrícula {$satelite->aeronave?->matricula}.",
            registroId: $satelite->id,
            datosAnteriores: $anteriores,
            datosNuevos: $this->datosBitacora($satelite),
        );

        return response()->json([
            'message' => 'Datos de facturación actualizados correctamente.',
            'aeronave' => $this->presentar($satelite),
        ]);
    }

    /** Tarifas propias tal como se capturan, y las efectivas ya resueltas (propia o heredada). */
    private function presentar(FactAeronave $satelite): array
    {
        return [
            'id' => $satelite->id,
            'aeronave_id' => $satelite->aeronave_id,
            'matricula' => $satelite->aeronave?->matricula,
            'categoria_aeronave_id' => $satelite->categoria_aeronave_id,
            'categoria' => $satelite->categoria,
            'tipo_motor_id' => $satelite->tipo_motor_id,
            'tipo_motor' => $satelite->tipoMotor,
            'estatus' => $satelite->estatus,
            'cobra_derecho_vuelos' => $satelite->cobra_derecho_vuelos,
            'tarifa_pernocta' => $satelite->tarifa_pernocta,
            'tarifa_transito_2h' => $satelite->tarifa_transito_2h,
            'tarifa_transito_12h' => $satelite->tarifa_transito_12h,
            'tarifa_aterrizaje' => $satelite->tarifa_aterrizaje,
            'tarifa_pernocta_efectiva' => $satelite->tarifaPernocta(),
            'tarifa_transito_2h_efectiva' => $satelite->tarifaTransito2h(),
            'tarifa_transito_12h_efectiva' => $satelite->tarifaTransito12h(),
            'tarifa_aterrizaje_efectiva' => $satelite->tarifaAterrizaje(),
        ];
    }

    private function datosBitacora(FactAeronave $satelite): array
    {
        return ['matricula' => $satelite->aeronave?->matricula] + $satelite->only(self::CAMPOS_BITACORA);
    }
}
