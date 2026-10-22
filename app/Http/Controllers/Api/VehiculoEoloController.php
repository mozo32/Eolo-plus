<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Bitacora;
use App\Models\Vehiculo;
use App\Models\movimientoVehiculo;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use App\Models\Imagen;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class VehiculoEoloController extends Controller
{
    /**
     * Roles que pueden dar de baja o de alta un vehículo. Se comprueba la lista
     * entera de roles del usuario, no el primero: con dos roles, el permitido
     * podría no ser el primero.
     */
    private const ROLES_PARA_CAMBIAR_ACTIVO = ['fbo', 'admin2', 'admin'];

    public function index()
    {
        try {
            $vehiculos = Vehiculo::query()
                ->withCount('movimientos')
                ->orderByDesc('activo')
                ->orderByDesc('movimientos_count')
                ->orderBy('id')
                ->get()
                ->map(function (Vehiculo $v) {
                    return [
                        'id' => $v->id,
                        'nombre' => $v->nombre,
                        'estado' => $v->estado,
                        'ultimaActividad' => $v->ultima_actividad ?? 'N/A',
                        'activo' => $v->activo,
                        'movimientos' => $v->movimientos_count,
                    ];
                });

            return response()->json($vehiculos, 200);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function cambiarActivo(Request $request, string $id)
    {
        if (! $request->user()?->hasAnyRole(self::ROLES_PARA_CAMBIAR_ACTIVO)) {
            return response()->json([
                'message' => 'No tienes permiso para dar de baja o de alta un vehículo.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'activo' => 'required|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors(),
            ], 422);
        }

        $vehiculo = Vehiculo::findOrFail($id);
        $activo = $request->boolean('activo');

        if (! $activo && $vehiculo->estado === 'En Ruta') {
            return response()->json([
                'message' => "El vehículo {$vehiculo->id} está En Ruta. Registra su entrada antes de desactivarlo.",
            ], 409);
        }

        $vehiculo->update(['activo' => $activo]);

        Bitacora::log(
            Bitacora::MODULO_MOVIMIENTOS_VEHICULOS,
            $activo ? Bitacora::ACCION_ACTIVAR : Bitacora::ACCION_DESACTIVAR,
            ($activo ? 'Reactivó' : 'Desactivó')." el vehículo {$vehiculo->id} ({$vehiculo->nombre})",
            datosNuevos: ['vehiculo_id' => $vehiculo->id, 'activo' => $activo],
        );

        return response()->json([
            'message' => $activo
                ? 'Vehículo reactivado'
                : 'Vehículo desactivado',
            'vehiculo' => [
                'id' => $vehiculo->id,
                'nombre' => $vehiculo->nombre,
                'estado' => $vehiculo->estado,
                'activo' => $vehiculo->activo,
            ],
        ], 200);
    }

    public function registrarMovimiento(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'vehiculo_id'  => 'required|exists:vehiculos,id',
            'movimiento'   => 'required|in:Salida,Entrada',
            'chofer'       => 'required|string|max:255',
            'kilometraje'  => 'required|numeric',
            'gasolina'     => 'required|string|max:50',
            'destino'      => 'nullable|string|max:255',
            'autoriza'     => 'nullable|string|max:255',
            'matricula'    => 'nullable|string|max:255',
            'motivo'       => 'nullable|string|max:255',
            'notas'        => 'nullable|string',

            'evidencias'   => 'required|array|min:1',
            'evidencias.*' => 'required|image|mimes:jpg,jpeg,png,webp|max:10240',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors()
            ], 422);
        }

        $rutasGuardadas = [];

        try {
            return DB::transaction(function () use ($request, &$rutasGuardadas) {
                $movimiento = movimientoVehiculo::create([
                    'vehiculo_id'   => $request->vehiculo_id,
                    'tipo'          => $request->movimiento,
                    'chofer'        => $request->chofer,
                    'kilometraje'   => $request->kilometraje,
                    'gasolina'      => $request->gasolina,
                    'destino'       => $request->destino,
                    'autoriza'      => $request->autoriza,
                    'matricula'     => $request->matricula,
                    'motivo'        => $request->motivo,
                    'observaciones' => $request->notas,
                ]);

                foreach ($request->file('evidencias', []) as $orden => $archivo) {
                    $imagen = $this->guardarImagenSubida(
                        $archivo,
                        "movimientos-vehiculos/{$movimiento->id}",
                        $rutasGuardadas
                    );

                    $movimiento->imagenes()->attach($imagen->id, [
                        'tag'    => 'evidencia',
                        'orden'  => $orden,
                        'status' => 'A',
                    ]);
                }

                $vehiculo = Vehiculo::findOrFail($request->vehiculo_id);

                $vehiculo->update([
                    'estado' => $request->movimiento === 'Salida'
                        ? 'En Ruta'
                        : 'En Planta',
                    'ultima_actividad' => now(),
                ]);

                $imagenes = $movimiento->imagenes()
                    ->get()
                    ->map(function (Imagen $imagen) {
                        $disk = $imagen->disk ?? 'public';

                        return [
                            'id'     => $imagen->id,
                            'url'    => Storage::disk($disk)->url($imagen->path),
                            'tag'    => $imagen->pivot->tag,
                            'orden'  => $imagen->pivot->orden,
                            'status' => $imagen->pivot->status,
                        ];
                    })
                    ->values();

                return response()->json([
                    'message'    => 'Movimiento registrado con éxito',
                    'vehiculo'   => $vehiculo,
                    'movimiento' => $movimiento,
                    'imagenes'   => $imagenes,
                ], 201);
            });
        } catch (\Throwable $e) {
            if (!empty($rutasGuardadas)) {
                Storage::disk('public')->delete($rutasGuardadas);
            }

            return response()->json([
                'message' => 'Error al procesar el registro',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    public function obtenerHistorial(Request $request, $id)
    {
        $movimientos = movimientoVehiculo::where('vehiculo_id', $id)
            ->with('imagenes')
            ->when($request->chofer, function ($query, $chofer) {
                $query->where(
                    'chofer',
                    'like',
                    '%' . $chofer . '%'
                );
            })
            ->when($request->tipo, function ($query, $tipo) {
                $query->where('tipo', $tipo);
            })
            ->when($request->fecha_inicio, function ($query, $fechaInicio) {
                $query->whereDate(
                    'created_at',
                    '>=',
                    $fechaInicio
                );
            })
            ->when($request->fecha_fin, function ($query, $fechaFin) {
                $query->whereDate(
                    'created_at',
                    '<=',
                    $fechaFin
                );
            })
            ->orderBy('created_at', 'desc')
            ->get();

        $movimientos->each(function ($movimiento) {
            $imagenes = $movimiento->imagenes
                ->map(function (Imagen $imagen) {
                    $disk = $imagen->disk ?? 'public';
                    $path = $imagen->path;

                    $url = null;
                    $error = null;

                    if (
                        $path &&
                        Storage::disk($disk)->exists($path)
                    ) {
                        $url = Storage::disk($disk)->url($path);
                    } else {
                        $error = 'archivo_no_encontrado';
                    }

                    return [
                        'id'     => $imagen->id,
                        'url'    => $url,
                        'tag'    => $imagen->pivot->tag ?? null,
                        'orden'  => $imagen->pivot->orden ?? 0,
                        'status' => $imagen->pivot->status ?? null,
                        'error'  => $error,
                    ];
                })
                ->values();

            $movimiento->setRelation(
                'imagenes',
                $imagenes
            );
        });

        return response()->json($movimientos);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id' => 'required|string|unique:vehiculos,id|max:50',
            'nombre' => 'required|string|max:255',
            'estado' => 'required|in:En Planta,En Ruta'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'El ID ya existe o los datos son inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $vehiculo = Vehiculo::create([
                'id' => $request->id,
                'nombre' => $request->nombre,
                'estado' => $request->estado,
                'ultima_actividad' => null
            ]);

            return response()->json([
                'message' => 'Vehículo creado con éxito',
                'vehiculo' => $vehiculo
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error al guardar en la base de datos',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    private function guardarImagenSubida(UploadedFile $archivo, string $folder, array &$rutasGuardadas): Imagen {
        $path = $archivo->store($folder, 'public');

        if (!$path) {
            throw new \RuntimeException(
                'No fue posible guardar una de las evidencias fotográficas.'
            );
        }

        $rutasGuardadas[] = $path;

        return Imagen::create([
            'disk'          => 'public',
            'path'          => $path,
            'original_name' => $archivo->getClientOriginalName(),
            'mime'          => $archivo->getMimeType() ?? 'image/jpeg',
            'size'          => (int) $archivo->getSize(),
        ]);
    }
}
