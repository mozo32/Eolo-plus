<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ServicioComisariato\GuardarEvidenciaComisariatoRequest;
use App\Models\Imagen;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Models\ServicioComisariato;
use App\Rules\DentroDeLaVentana;
use App\Support\VentanasDeFecha;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ServicioComisariatoController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'catering'       => ['nullable', 'string', 'max:150'],
            'formaPago'      => ['nullable', 'string', 'max:100'],
            'fechaEntrega'   => ['required', 'date', new DentroDeLaVentana('comisariato.entrega')],
            'horaEntrega'    => ['required', 'date_format:H:i'],
            'matricula'      => ['nullable', 'string', 'max:50'],
            'detalle'        => ['nullable', 'string'],
            'solicitadoPor'  => ['nullable', 'string', 'max:150'],
            'atendio'        => ['nullable', 'string', 'max:150'],
            'subtotal'       => ['required', 'numeric', 'min:0'],
            'total'          => ['required', 'numeric', 'min:0'],
        ]);
        $infoMatricula = DB::connection('remota')
                    ->table('tb_matricula as m')
                    ->leftJoin('tb_estatus as e', 'e.id_estatus', '=', 'm.id_estatus')
                    ->leftJoin('tb_tipo as t', 't.id_tipo', '=', 'm.id_tipo')
                    ->leftJoin('tb_categoria as c', 'c.id_categoria', '=', 'm.id_categoria')
                    ->where('m.matricula', $validated['matricula'])
                    ->select(
                        'm.matricula',
                        'e.estatus',
                        't.tipo',
                        'c.categoria'
                    )
                    ->first();

        if (!$infoMatricula) {
            DB::connection('remota')
            ->table('tb_matricula')
            ->insert([
                'matricula' => $validated['matricula'],
                'id_estatus'     => 1,
                'id_tipo'        => 0,
                'id_categoria'   => 0,
                'id_motor'       => 0,
                'id_aterrizaje'  => 0,
                'id_transito2h'  => 0,
                'id_transito12h' => 0,
                'id_pernocta'    => 0,
                'd_vuelos'       => 0,
            ]);

        }
        $servicio = ServicioComisariato::create([
            'user_id'        => Auth::id(),
            'catering'       => $validated['catering'] ?? null,
            'forma_pago'     => $validated['formaPago'] ?? null,
            'fecha_entrega'  => $validated['fechaEntrega'],
            'hora_entrega'   => $validated['horaEntrega'],
            'matricula'      => $validated['matricula'] ?? null,
            'detalle'        => $validated['detalle'] ?? null,
            'solicitado_por' => $validated['solicitadoPor'] ?? null,
            'atendio'        => $validated['atendio'] ?? null,
            'subtotal'       => $validated['subtotal'],
            'total'          => $validated['total'],
        ]);
        return response()->json([
            'message' => 'Servicio de comisariato guardado correctamente',
            'data' => $servicio,
        ], 201);
    }
    public function index(Request $request)
    {
        $query = ServicioComisariato::query()
            ->where('status', 'A');

        if ($request->filled('id')) {
            $query->where('id', $request->id);
        }

        if ($request->filled('search')) {
            $search = trim($request->search);

            $query->where(function ($q) use ($search) {
                $q->where('matricula', 'like', "%{$search}%")
                    ->orWhere('catering', 'like', "%{$search}%")
                    ->orWhere('forma_pago', 'like', "%{$search}%")
                    ->orWhere('detalle', 'like', "%{$search}%")
                    ->orWhere('solicitado_por', 'like', "%{$search}%")
                    ->orWhere('atendio', 'like', "%{$search}%");
            });
        }

        if ($request->filled('catering')) {
            $query->where('catering', 'like', '%' . trim($request->catering) . '%');
        }

        if ($request->filled('matricula')) {
            $query->where('matricula', 'like', '%' . trim($request->matricula) . '%');
        }

        if ($request->filled('forma_pago')) {
            $query->where('forma_pago', 'like', '%' . trim($request->forma_pago) . '%');
        }

        if ($request->filled('fechaInicio') && $request->filled('fechaFin')) {
            $query->whereBetween('fecha_entrega', [
                $request->fechaInicio,
                $request->fechaFin,
            ]);
        } elseif ($request->filled('fechaInicio')) {
            $query->whereDate('fecha_entrega', $request->fechaInicio);
        }

        $perPage = (int) $request->get('per_page', 10);

        return response()->json(
            $query->orderBy('created_at', 'desc')
                ->paginate($perPage)
        );
    }
    public function show(ServicioComisariato $servicioComisariato)
    {
        /*
         * La relación NO se carga con `load()` a propósito: `toArray()`
         * serializaría la colección entera de imágenes con sus columnas
         * internas, y la pantalla solo necesita tres campos.
         */
        $evidencias = $servicioComisariato->evidencias()
            ->orderBy('imageables.orden')
            ->orderBy('imagens.id')
            ->get()
            ->map(static fn (Imagen $imagen): array => [
                'id' => $imagen->id,
                'url' => $imagen->url,
                'orden' => (int) $imagen->pivot->orden,
            ])
            ->values()
            ->all();

        return response()->json([
            ...$servicioComisariato->toArray(),
            'evidencias' => $evidencias,
        ]);
    }

    /**
     * Guarda UNA evidencia del servicio.
     *
     * El `orden` sale del máximo de TODAS —también las retiradas— más uno:
     * dos evidencias distintas no pueden haber ocupado nunca el mismo sitio.
     */
    public function guardarEvidencia(
        GuardarEvidenciaComisariatoRequest $request,
        ServicioComisariato $servicioComisariato
    ): JsonResponse {
        $imagen = $this->guardarImagenBase64(
            $request->validated()['foto'],
            'evidencias/ServicioComisariato/'.now()->format('Y/m')
        );

        $maximo = $servicioComisariato->evidenciasAll()->max('imageables.orden');
        $orden = $maximo === null ? 0 : (int) $maximo + 1;

        $servicioComisariato->evidencias()->attach($imagen->id, [
            'tag' => 'evidencia',
            'orden' => $orden,
            'status' => 'A',
        ]);

        return response()->json([
            'message' => 'Evidencia guardada correctamente',
            'data' => [
                'id' => $imagen->id,
                'url' => $imagen->url,
                'orden' => $orden,
            ],
        ], 201);
    }

    /**
     * Retira una evidencia de ESTE servicio.
     *
     * Pide los dos ids a propósito. `imageables` es polimórfica y una misma
     * imagen puede colgar de más de un dueño; sin el servicio por delante, un
     * id equivocado despegaría la foto de otro registro —de un Walk Around,
     * por ejemplo— sin que nadie se enterara.
     */
    public function eliminarEvidencia(ServicioComisariato $servicioComisariato, int $imagenId): JsonResponse
    {
        $retiradas = $servicioComisariato->evidencias()
            ->newPivotStatement()
            ->where('imageable_type', ServicioComisariato::class)
            ->where('imageable_id', $servicioComisariato->id)
            ->where('imagen_id', $imagenId)
            ->where('status', 'A')
            ->update(['status' => 'N', 'updated_at' => now()]);

        if ($retiradas === 0) {
            return response()->json(['message' => 'La evidencia no existe o no es de este servicio.'], 404);
        }

        return response()->json(['message' => 'Evidencia eliminada correctamente']);
    }

    /**
     * Escribe la imagen en el disco `public` y registra su `Imagen`.
     *
     * La extensión sale de una lista cerrada y no de partir el mime, a
     * propósito: `MovimientoCSAEController` sí lo parte y arrastra ese defecto
     * (un SVG quedaba como `.svg+xml`). Aquí no se copia.
     */
    private function guardarImagenBase64(string $base64, string $carpeta): Imagen
    {
        [$meta, $contenido] = explode(',', $base64);
        preg_match('/data:(.*?);base64/', $meta, $coincidencias);

        $mime = $coincidencias[1] ?? 'image/jpeg';
        $extension = match ($mime) {
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => 'jpg',
        };

        $ruta = $carpeta.'/'.Str::uuid().'.'.$extension;

        Storage::disk('public')->put($ruta, base64_decode($contenido));

        return Imagen::create([
            'disk' => 'public',
            'path' => $ruta,
            'original_name' => basename($ruta),
            'mime' => $mime,
            'size' => Storage::disk('public')->size($ruta),
        ]);
    }
    public function update(Request $request, ServicioComisariato $servicioComisariato)
    {
        DB::beginTransaction();

        try {
            $this->validarFechaSiCambia($request, $servicioComisariato);

            $validated = $request->validate([
                'catering'       => ['nullable', 'string', 'max:150'],
                'formaPago'      => ['nullable', 'string', 'max:100'],
                'fechaEntrega'   => ['required', 'date'],
                'horaEntrega'    => ['required', 'date_format:H:i'],
                'matricula'      => ['nullable', 'string', 'max:50'],
                'detalle'        => ['nullable', 'string'],
                'solicitadoPor'  => ['nullable', 'string', 'max:150'],
                'atendio'        => ['nullable', 'string', 'max:150'],
                'subtotal'       => ['required', 'numeric', 'min:0'],
                'total'          => ['required', 'numeric', 'min:0'],
            ]);

            $servicioComisariato->update([
                'user_id'        => Auth::id(),
                'catering'       => $validated['catering'] ?? null,
                'forma_pago'     => $validated['formaPago'] ?? null,
                'fecha_entrega'  => $validated['fechaEntrega'],
                'hora_entrega'   => $validated['horaEntrega'],
                'matricula'      => $validated['matricula'] ?? null,
                'detalle'        => $validated['detalle'] ?? null,
                'solicitado_por' => $validated['solicitadoPor'] ?? null,
                'atendio'        => $validated['atendio'] ?? null,
                'subtotal'       => $validated['subtotal'],
                'total'          => $validated['total'],
                ]);


            DB::commit();


            return response()->json([
                'message' => 'Actualizado correctamente',
                'data' => $servicioComisariato,
            ]);

        } catch (ValidationException $e) {
            DB::rollBack();

            throw $e;
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Error al actualizar',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
    /**
     * Una edición solo juzga la fecha de entrega cuando CAMBIA.
     *
     * Un servicio guardado con una fecha que ya quedó fuera de la ventana conserva esa fecha
     * intacta; exigirle la ventana bloquearía cualquier corrección del resto del registro. Lo
     * que la ventana impide es poner una fecha fuera de ella.
     */
    private function validarFechaSiCambia(Request $request, ServicioComisariato $servicio): void
    {
        $recibidaComoDia = VentanasDeFecha::diaQueGuardaElModelo($request->input('fechaEntrega'));

        if ($recibidaComoDia !== null && $recibidaComoDia === $servicio->fecha_entrega?->toDateString()) {
            return;
        }

        $request->validate([
            'fechaEntrega' => ['required', 'date', new DentroDeLaVentana('comisariato.entrega')],
        ]);
    }

    public function eliminar($id)
    {
        try {
            $comisariato = ServicioComisariato::find($id);

            if (!$comisariato) {
                return response()->json([
                    'message' => 'El registro no existe.'
                ], 404);
            }
            DB::transaction(function () use ($comisariato, $id) {
                $comisariato->update([
                    'status' => 'N'
                ]);
            });

            return response()->json([
                'message' => 'Registro cancelados correctamente',
                'data' => $comisariato
            ]);

        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Error al intentar eliminar el registro',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
