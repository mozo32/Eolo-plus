<?php

namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\ChecklistTurno;
use App\Models\Firma;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ChecklistTurnoController extends Controller
{
    public function store(Request $request)
    {
        DB::beginTransaction();

        try {
            $validated = $request->validate([
                'nombreEmpleado' => 'required|string|max:255',
                'fecha' => 'required|date',

                'recibeTurnoCon' => 'required|array',
                'observaciones_recibe' => 'nullable|string',

                'revisionSalas' => 'required|array',
                'HotTrasComiCoor' => 'nullable|array',

                'revision_base_operaciones' => 'required|boolean',
                'envia_informe_diario' => 'required|boolean',
                'envia_resumen_semanal' => 'required|boolean',

                'entregaTurnoCon' => 'required|array',
                'observaciones_entrega' => 'nullable|string',

                'cantidad_pasajeros' => 'required|integer|min:0',
                'cantidad_operaciones' => 'required|integer|min:0',

            ]);

            $checklist = ChecklistTurno::create([
                'nombre_empleado' => $validated['nombreEmpleado'],
                'fecha' => $validated['fecha'],

                'recibe_turno_con' => $validated['recibeTurnoCon'],
                'observaciones_recibe' => $validated['observaciones_recibe'] ?? null,

                'revision_salas' => $validated['revisionSalas'],
                'hot_tras_comi_coor' => $validated['HotTrasComiCoor'] ?? [],

                'revision_base_operaciones' => $validated['revision_base_operaciones'],
                'envia_informe_diario' => $validated['envia_informe_diario'],
                'envia_resumen_semanal' => $validated['envia_resumen_semanal'],

                'entrega_turno_con' => $validated['entregaTurnoCon'],
                'observaciones_entrega' => $validated['observaciones_entrega'] ?? null,

                'cantidad_pasajeros' => $validated['cantidad_pasajeros'],
                'cantidad_operaciones' => $validated['cantidad_operaciones'],
            ]);

            $this->guardarFirmaBase64(
                $request->firma ?? '',
                'firma_validacion',
                $checklist
            );
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

    /**
     * === MÉTODOS REUTILIZADOS ===
     */

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

        $query = ChecklistTurno::query();

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('nombre_empleado', 'like', "%{$search}%");
            });
        }

        $perPage = $request->get('per_page', 10);

        return response()->json(
            $query->orderBy('created_at', 'desc')
                ->paginate($perPage)
        );
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
                'recibeTurnoCon' => 'required|array',
                'observaciones_recibe' => 'nullable|string',
                'revisionSalas' => 'required|array',
                'HotTrasComiCoor' => 'nullable|array',
                'revision_base_operaciones' => 'required|boolean',
                'envia_informe_diario' => 'required|boolean',
                'envia_resumen_semanal' => 'required|boolean',
                'entregaTurnoCon' => 'required|array',
                'observaciones_entrega' => 'nullable|string',
                'cantidad_pasajeros' => 'required|integer|min:0',
                'cantidad_operaciones' => 'required|integer|min:0',
            ]);

            $checklistTurno->update([
                'nombre_empleado' => $validated['nombreEmpleado'],
                'fecha' => $validated['fecha'],
                'recibe_turno_con' => $validated['recibeTurnoCon'],
                'observaciones_recibe' => $validated['observaciones_recibe'] ?? null,
                'revision_salas' => $validated['revisionSalas'],
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

}
