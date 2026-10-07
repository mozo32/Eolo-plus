<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bitacora;
use App\Models\Imagen;
use App\Models\PrestamoChaleco;
use App\Models\User;
use App\Rules\DentroDeLaVentana;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Préstamo de chalecos al personal visitante (Tráfico).
 *
 * La fotografía de la INE se guarda con la misma mecánica que las evidencias
 * de Movimientos de vehículos EOLO (modelo Imagen + $archivo->store), pero en
 * el disco privado: es una identificación oficial y no puede quedar accesible
 * por URL. Se entrega por el endpoint `ine`, que exige sesión.
 */
class PrestamoChalecoController extends Controller
{
    private const DISCO_INE = 'local';

    private const PER_PAGE_PERMITIDOS = [10, 20, 50];

    /** Histórico paginado: prestados primero, luego del más reciente al más antiguo. */
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 10);
        if (! in_array($perPage, self::PER_PAGE_PERMITIDOS, true)) {
            $perPage = 10;
        }

        $query = PrestamoChaleco::query()->with(['entregadoPor:id,name', 'devueltoPor:id,name']);

        if ($request->filled('nombre')) {
            $query->where('nombre_recibe', 'LIKE', '%'.trim((string) $request->query('nombre')).'%');
        }

        if ($request->filled('fecha_inicio')) {
            $query->whereDate('fecha', '>=', $request->query('fecha_inicio'));
        }

        if ($request->filled('fecha_fin')) {
            $query->whereDate('fecha', '<=', $request->query('fecha_fin'));
        }

        if (in_array($request->query('estado'), [PrestamoChaleco::ESTADO_PRESTADO, PrestamoChaleco::ESTADO_DEVUELTO], true)) {
            $query->where('estado', $request->query('estado'));
        }

        $registros = $query
            ->orderByRaw("CASE WHEN estado = '".PrestamoChaleco::ESTADO_PRESTADO."' THEN 0 ELSE 1 END")
            ->orderByDesc('fecha')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->appends($request->query());

        return response()->json($registros);
    }

    /** Personal de Tráfico para el selector "Nombre de quien entrega el chaleco". */
    public function personal(): JsonResponse
    {
        return response()->json(
            User::query()->delAreaDeTrafico()->orderBy('name')->get(['id', 'name'])
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'fecha' => ['required', 'date_format:Y-m-d', new DentroDeLaVentana('chalecos.prestamo')],
            'nombre_recibe' => ['required', 'string', 'max:120'],
            'usuario_entrega_id' => [
                'required',
                'integer',
                Rule::exists('users', 'id'),
                function (string $attribute, mixed $value, \Closure $fail) {
                    if (! User::query()->delAreaDeTrafico()->whereKey($value)->exists()) {
                        $fail('La persona seleccionada no pertenece al área de Tráfico.');
                    }
                },
            ],
            'foto_ine' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
        ]);

        $rutaGuardada = null;

        try {
            $prestamo = DB::transaction(function () use ($validated, $request, &$rutaGuardada) {
                $imagen = $this->guardarFotoIne($request->file('foto_ine'), $rutaGuardada);

                $prestamo = PrestamoChaleco::create([
                    'fecha' => $validated['fecha'],
                    'nombre_recibe' => trim($validated['nombre_recibe']),
                    'usuario_entrega_id' => $validated['usuario_entrega_id'],
                    'foto_ine_imagen_id' => $imagen->id,
                    'estado' => PrestamoChaleco::ESTADO_PRESTADO,
                    'fecha_devolucion' => null,
                    'user_id' => $request->user()->id,
                ]);

                Bitacora::log(
                    modulo: Bitacora::MODULO_PRESTAMO_CHALECOS,
                    accion: Bitacora::ACCION_CREAR,
                    descripcion: "Se prestó un chaleco a {$prestamo->nombre_recibe}.",
                    registroId: $prestamo->id,
                    datosAnteriores: null,
                    datosNuevos: $this->datosBitacora($prestamo),
                );

                return $prestamo;
            });
        } catch (\Throwable $e) {
            // La fila no se creó: el archivo tampoco debe quedarse.
            if ($rutaGuardada) {
                Storage::disk(self::DISCO_INE)->delete($rutaGuardada);
            }

            throw $e;
        }

        return response()->json([
            'message' => 'Préstamo registrado correctamente.',
            'prestamo' => $prestamo->load(['entregadoPor:id,name']),
        ], 201);
    }

    /** Marca el chaleco como devuelto. Atómico: dos usuarios no lo cierran dos veces. */
    public function devolver(Request $request, int $id): JsonResponse
    {
        $prestamo = PrestamoChaleco::findOrFail($id);
        $anteriores = $this->datosBitacora($prestamo);

        $afectadas = PrestamoChaleco::query()
            ->whereKey($prestamo->id)
            ->where('estado', PrestamoChaleco::ESTADO_PRESTADO)
            ->update([
                'estado' => PrestamoChaleco::ESTADO_DEVUELTO,
                'fecha_devolucion' => now(),
                'devuelto_por_user_id' => $request->user()->id,
                'updated_at' => now(),
            ]);

        if ($afectadas !== 1) {
            return response()->json([
                'message' => 'Este chaleco ya fue marcado como devuelto.',
                'codigo' => 'ya_devuelto',
            ], 409);
        }

        $prestamo->refresh();

        Bitacora::log(
            modulo: Bitacora::MODULO_PRESTAMO_CHALECOS,
            accion: Bitacora::ACCION_FINALIZAR,
            descripcion: "{$prestamo->nombre_recibe} devolvió el chaleco.",
            registroId: $prestamo->id,
            datosAnteriores: $anteriores,
            datosNuevos: $this->datosBitacora($prestamo),
        );

        return response()->json([
            'message' => 'El chaleco fue marcado como devuelto.',
            'prestamo' => $prestamo->load(['entregadoPor:id,name', 'devueltoPor:id,name']),
        ]);
    }

    /** Fotografía de la INE: disco privado, solo para usuarios con sesión. */
    public function ine(int $id): StreamedResponse
    {
        $prestamo = PrestamoChaleco::with('fotoIne')->findOrFail($id);
        $imagen = $prestamo->fotoIne;

        abort_if(! $imagen || ! Storage::disk($imagen->disk)->exists($imagen->path), 404);

        return Storage::disk($imagen->disk)->response(
            $imagen->path,
            $imagen->original_name,
            ['Content-Type' => $imagen->mime ?: 'image/jpeg']
        );
    }

    /** Misma mecánica que las evidencias de vehículos, pero en disco privado. */
    private function guardarFotoIne(UploadedFile $archivo, ?string &$rutaGuardada): Imagen
    {
        $path = $archivo->store('prestamos-chalecos/'.now()->format('Y/m'), self::DISCO_INE);

        if (! $path) {
            throw new \RuntimeException('No fue posible guardar la fotografía de la INE.');
        }

        $rutaGuardada = $path;

        return Imagen::create([
            'disk' => self::DISCO_INE,
            'path' => $path,
            'original_name' => $archivo->getClientOriginalName(),
            'mime' => $archivo->getMimeType() ?? 'image/jpeg',
            'size' => (int) $archivo->getSize(),
        ]);
    }

    private function datosBitacora(PrestamoChaleco $prestamo): array
    {
        return [
            'fecha' => $prestamo->fecha?->format('Y-m-d'),
            'nombre_recibe' => $prestamo->nombre_recibe,
            'usuario_entrega_id' => $prestamo->usuario_entrega_id,
            'estado' => $prestamo->estado,
            'fecha_devolucion' => $prestamo->fecha_devolucion?->format('Y-m-d H:i'),
        ];
    }
}
