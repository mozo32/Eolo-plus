<?php

namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\ChecklistTurno;
use App\Models\Firma;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use App\Models\NotaOperacional;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class ChecklistTurnoController extends Controller
{
    public function store(Request $request)
    {
        DB::beginTransaction();

        try {
            $validated = $request->validate([
                'nombreEmpleado' => 'required|string|max:255',
                'fecha' => 'required|date',
                'recibeTurnoCon' => 'nullable|array',
                'observaciones_recibe' => 'nullable|string',
                'revisionSalas' => 'nullable|array',
                'observaciones_salas' => 'nullable|string',
                'HotTrasComiCoor' => 'nullable|array',
                'revision_base_operaciones' => 'nullable|boolean',
                'envia_informe_diario' => 'nullable|boolean',
                'envia_resumen_semanal' => 'nullable|boolean',
                'entregaTurnoCon' => 'nullable|array',
                'observaciones_entrega' => 'nullable|string',
                'cantidad_pasajeros' => 'nullable|integer|min:0',
                'cantidad_operaciones' => 'nullable|integer|min:0',
            ]);

            $checklist = ChecklistTurno::create([
                'nombre_empleado' => $validated['nombreEmpleado'],
                'fecha' => $validated['fecha'],
                'recibe_turno_con' => $validated['recibeTurnoCon'] ?? [],
                'observaciones_recibe' => $validated['observaciones_recibe'] ?? null,
                'revision_salas' => $validated['revisionSalas'] ?? [],
                'observaciones_salas' => $validated['observaciones_salas'] ?? null,
                'hot_tras_comi_coor' => $validated['HotTrasComiCoor'] ?? [],
                'revision_base_operaciones' => $validated['revision_base_operaciones'] ?? false,
                'envia_informe_diario' => $validated['envia_informe_diario'] ?? false,
                'envia_resumen_semanal' => $validated['envia_resumen_semanal'] ?? false,
                'entrega_turno_con' => $validated['entregaTurnoCon'] ?? [],
                'observaciones_entrega' => $validated['observaciones_entrega'] ?? null,
                'cantidad_pasajeros' => $validated['cantidad_pasajeros'] ?? 0,
                'cantidad_operaciones' => $validated['cantidad_operaciones'] ?? 0,
            ]);
            if ($request->filled('firma')) {
                $this->guardarFirmaBase64($request->firma, 'firma_validacion', $checklist);
            }

            DB::commit();

            return response()->json([
                'message' => 'Checklist guardado correctamente',
                'data' => $checklist,
            ], 201);

        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Error al guardar checklist',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    private function guardarFirmaBase64(string $value, string $rol, ChecklistTurno $checklist): void
    {
        if (trim($value) === '') return;
        if (!str_contains($value, 'base64,')) return;

        // Desactivar firma anterior
        $checklist->firmas()
            ->newPivotStatement()
            ->where('firmable_type', ChecklistTurno::class)
            ->where('firmable_id', $checklist->id)
            ->where('rol', $rol)
            ->where('status', 'A')
            ->update(['status' => 'N']);

        // Guardar archivo
        $firma = $this->guardarFirmaArchivoBase64(
            $value,
            'firmas/ChecklistTurno/' . now()->format('Y/m')
        );

        // Asociar
        $checklist->firmas()->attach($firma->id, [
            'rol'    => $rol,
            'tag'    => $this->humanizeRol($rol),
            'orden'  => 0,
            'status' => 'A',
        ]);
    }

    private function guardarFirmaArchivoBase64(string $base64, string $folder): Firma
    {
        [$meta, $content] = explode(',', $base64);
        preg_match('/data:(.*?);base64/', $meta, $matches);

        $mime = $matches[1] ?? 'image/png';
        $extension = explode('/', $mime)[1] ?? 'png';

        $fileName = Str::uuid() . '.' . $extension;
        $path = $folder . '/' . $fileName;

        Storage::disk('public')->put($path, base64_decode($content));

        return Firma::create([
            'disk'          => 'public',
            'path'          => $path,
            'original_name' => $fileName,
            'mime'          => $mime,
            'size'          => Storage::disk('public')->size($path),
            'sha1'          => sha1_file(Storage::disk('public')->path($path)),
        ]);
    }

    private function humanizeRol(string $rol): string
    {
        return match ($rol) {
            'firma_validacion'  => 'Firma validacion',
            default         => ucfirst(str_replace('_', ' ', $rol)),
        };
    }
    public function index(Request $request)
    {
        $query = ChecklistTurno::with(['firmas' => function($q) {
            $q->wherePivot('status', 'A');
        }]);
        $query->where('status', 'A');
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where('nombre_empleado', 'like', "%{$search}%");
        }
        if ($request->filled('estado')) {
            $estado = $request->estado;

            if ($estado === 'finalizado') {
                $query->whereNotNull('cantidad_pasajeros')
                    ->whereNotNull('cantidad_operaciones')
                    ->whereHas('firmas', function($q) {
                        $q->wherePivot('status', 'A');
                    });
            } elseif ($estado === 'sin finalizar') {
                $query->where(function($q) {
                    $q->whereNull('cantidad_pasajeros')
                    ->orWhereNull('cantidad_operaciones')
                    ->orWhereDoesntHave('firmas', function($sq) {
                        $sq->wherePivot('status', 'A');
                    });
                });
            }
        }

        $perPage = $request->get('per_page', 10);

        $resultados = $query->orderBy('created_at', 'desc')->paginate($perPage);
        return response()->json($resultados);
    }

    public function show(ChecklistTurno $checklistTurno)
    {
        $checklistTurno->load([
            'firmas' => fn ($q) => $q->withPivot(['rol', 'tag', 'orden', 'status']),
        ]);

        $firmas = $checklistTurno->firmas->map(function (Firma $firma) {

            $disk = $firma->disk ?? 'public';
            $path = $firma->path;

            $base = [
                'id'     => $firma->id,
                'rol'    => $firma->pivot->rol ?? null,
                'tag'    => $firma->pivot->tag ?? null,
                'orden'  => $firma->pivot->orden ?? 0,
                'status' => $firma->pivot->status ?? 'A',
            ];

            if (!$path || !Storage::disk($disk)->exists($path)) {
                return array_merge($base, [
                    'url'   => null,
                    'error' => 'firma_no_encontrada',
                ]);
            }

            return array_merge($base, [
                'url' => Storage::disk($disk)->url($path),
            ]);
        })->values();

        $checklistTurno->setRelation('firmas', $firmas);
        return response()->json($checklistTurno);
    }
    public function update(Request $request, ChecklistTurno $checklistTurno)
    {
        DB::beginTransaction();

        try {
            $validated = $request->validate([
                'nombreEmpleado' => 'required|string|max:255',
                'fecha' => 'required|date',
                'recibeTurnoCon' => 'nullable|array',
                'observaciones_recibe' => 'nullable|string',
                'revisionSalas' => 'nullable|array',
                'observaciones_salas' => 'nullable|string',
                'HotTrasComiCoor' => 'nullable|array',
                'revision_base_operaciones' => 'nullable|boolean',
                'envia_informe_diario' => 'nullable|boolean',
                'envia_resumen_semanal' => 'nullable|boolean',
                'entregaTurnoCon' => 'nullable|array',
                'observaciones_entrega' => 'nullable|string',
                'cantidad_pasajeros' => 'nullable|integer|min:0',
                'cantidad_operaciones' => 'nullable|integer|min:0',
            ]);

            $checklistTurno->update([
                'nombre_empleado' => $validated['nombreEmpleado'],
                'fecha' => $validated['fecha'],
                'recibe_turno_con' => $validated['recibeTurnoCon'],
                'observaciones_recibe' => $validated['observaciones_recibe'] ?? null,
                'revision_salas' => $validated['revisionSalas'],
                'observaciones_salas' => $validated['observaciones_salas'] ?? null,
                'hot_tras_comi_coor' => $validated['HotTrasComiCoor'] ?? [],
                'revision_base_operaciones' => $validated['revision_base_operaciones'],
                'envia_informe_diario' => $validated['envia_informe_diario'],
                'envia_resumen_semanal' => $validated['envia_resumen_semanal'],
                'entrega_turno_con' => $validated['entregaTurnoCon'],
                'observaciones_entrega' => $validated['observaciones_entrega'] ?? null,
                'cantidad_pasajeros' => (int) $validated['cantidad_pasajeros'],
                'cantidad_operaciones' => (int) $validated['cantidad_operaciones'],
            ]);

            if (str_contains($request->firma ?? '', 'base64,')) {
                $this->guardarFirmaBase64(
                    $request->firma,
                    'firma_validacion',
                    $checklistTurno
                );
            }

            DB::commit();

            $checklistTurno->load('firmas');

            return response()->json([
                'message' => 'Checklist actualizado correctamente',
                'data' => $checklistTurno,
            ]);

        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Error al actualizar checklist',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
    public function eliminar($id)
    {
        try {
            $registro = ChecklistTurno::find($id);

            if (!$registro) {
                return response()->json([
                    'message' => 'El registro no existe.'
                ], 404);
            }
            $registro->update([
                'status' => 'N'
            ]);
            return response()->json([
                'message' => 'Checklist eliminado correctamente (lógicamente)',
                'data' => $registro
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Error al intentar eliminar el registro',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function checkPendiente()
    {
        $pendiente = ChecklistTurno::where('status', 'A')
            ->where(function($q) {
                $q->whereNull('cantidad_pasajeros')
                    ->orWhereNull('cantidad_operaciones')
                    ->orWhereDoesntHave('firmas', function($sq) {
                        $sq->where('firmables.status', 'A');
                    });
            })
            ->orderBy('created_at', 'desc')
            ->first();

        if (!$pendiente) {
            return response()->json(null, 200);
        }

        return response()->json($pendiente);
    }
    public function storenota(Request $request): JsonResponse
    {
        $request->validate([
            'descripcion' => 'required|string|min:3',
        ]);


        try {

            $nota = NotaOperacional::create([
                // Corregido: Se cambia 'uppercase()' por soporte nativo multibyte de PHP para evitar errores
                'descripcion'          => mb_strtoupper($request->descripcion, 'UTF-8'),
                'departamento_id'      =>  7,
                'subdepartamento_id'   => 16,
                'creado_por_user_id'   => Auth::id(),
                'validado_por_user_id' => null,
            ]);

            return response()->json([
                'ok' => true,
                'message' => 'Nota registrada con éxito.',
                'data' => $nota
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'ok' => false,
                'message' => 'Error interno al procesar el guardado de la nota.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function indexnota(): JsonResponse
    {
        try {
            $notas = NotaOperacional::with(['departamento:id,nombre', 'subdepartamento:id,nombre'])
                ->whereNull('validado_por_user_id')
                ->where('departamento_id', 7)
                ->where('subdepartamento_id', 16)
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json([
                'ok' => true,
                'data' => $notas
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'ok' => false,
                'message' => 'Error al obtener el listado de notas pendientes.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function validarnota(NotaOperacional $notaOperacional): JsonResponse
    {
        try {
            if ($notaOperacional->validado_por_user_id !== null) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Esta nota ya ha sido validada anteriormente.'
                ], 422);
            }

            $notaOperacional->validado_por_user_id = Auth::id();
            $notaOperacional->save();
            $notaOperacional->load(['departamento:id,nombre', 'subdepartamento:id,nombre']);

            return response()->json([
                'ok' => true,
                'message' => 'Nota validada con éxito.',
                'data' => $notaOperacional
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'ok' => false,
                'message' => 'Error interno al procesar la validación de la nota.',
                'error' => $e->getMessage()
            ], 500);
        }
    }
    public function aprobarTurno(Request $request, $id)
    {
        DB::beginTransaction();

        try {
            // 1. Buscamos el registro real de la base de datos usando el ID
            $checklistTurno = ChecklistTurno::findOrFail($id);

            // 2. Comprobamos la validación DIRECTAMENTE en el modelo encontrado
            if ($checklistTurno->validado_por_user_id !== null) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Este checklist de turno ya fue validado anteriormente.'
                ], 422);
            }

            // 3. Ejecutamos la validación (esto devuelve un ARRAY en $validated)
            $validated = $request->validate([
                'nombreEmpleado' => 'required|string|max:255',
                'fecha' => 'required|date',
                'recibeTurnoCon' => 'nullable|array',
                'observaciones_recibe' => 'nullable|string',
                'revisionSalas' => 'nullable|array',
                'observaciones_salas' => 'nullable|string',
                'HotTrasComiCoor' => 'nullable|array',
                'revision_base_operaciones' => 'nullable|boolean',
                'envia_informe_diario' => 'nullable|boolean',
                'envia_resumen_semanal' => 'nullable|boolean',
                'entregaTurnoCon' => 'nullable|array',
                'observaciones_entrega' => 'nullable|string',
                'cantidad_pasajeros' => 'nullable|integer|min:0',
                'cantidad_operaciones' => 'nullable|integer|min:0',
            ]);

            // 4. Actualizamos usando la nomenclatura de corchetes obligatoria para arrays de PHP
            $checklistTurno->update([
                'nombre_empleado'           => $validated['nombreEmpleado'],
                'fecha'                     => $validated['fecha'],
                'recibe_turno_con'          => $validated['recibeTurnoCon'],
                'observaciones_recibe'      => $validated['observaciones_recibe'] ?? null,
                'revision_salas'            => $validated['revisionSalas'],
                'observaciones_salas'       => $validated['observaciones_salas'] ?? null,
                'hot_tras_comi_coor'        => $validated['HotTrasComiCoor'] ?? [],
                'revision_base_operaciones' => $validated['revision_base_operaciones'] ?? false,
                'envia_informe_diario'      => $validated['envia_informe_diario'] ?? false,
                'envia_resumen_semanal'     => $validated['envia_resumen_semanal'] ?? false,
                'entrega_turno_con'         => $validated['entregaTurnoCon'],
                'observaciones_entrega'     => $validated['observaciones_entrega'] ?? null,
                'cantidad_pasajeros'        => (int) ($validated['cantidad_pasajeros'] ?? 0),
                'cantidad_operaciones'      => (int) ($validated['cantidad_operaciones'] ?? 0),
                'validado_por_user_id'      => Auth::id(), // Registra al supervisor firmado
            ]);

            // Guardado de la firma
            if (str_contains($request->firma ?? '', 'base64,')) {
                $this->guardarFirmaBase64(
                    $request->firma,
                    'firma_validacion',
                    $checklistTurno
                );
            }

            DB::commit();

            $checklistTurno->load('firmas');

            return response()->json([
                'ok' => true,
                'message' => 'Checklist validado correctamente',
                'data' => $checklistTurno,
            ]);

        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'ok' => false,
                'message' => 'Error al actualizar y validar el checklist',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
