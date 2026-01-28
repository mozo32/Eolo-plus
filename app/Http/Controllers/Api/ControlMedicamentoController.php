<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ControlMedicamento;
use App\Models\Firma;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Carbon\Carbon;

class ControlMedicamentoController extends Controller
{
    /**
     * Guardar control diario de medicamentos
     */
    public function store(Request $request)
    {
        DB::beginTransaction();

        try {
            $validated = $request->validate([
                'responsable'   => 'required|string|max:255',
                'fecha'         => 'required|date',
                'dia'           => 'required|string|max:15',
                'firma'         => 'required|string',
                'medicamentos'  => 'required|array|min:1',
            ]);

            foreach ($validated['medicamentos'] as $nombre => $data) {

                if (!isset($data['inicio'], $data['final'])) {
                    return response()->json([
                        'message' => "El medicamento {$nombre} está incompleto",
                    ], 422);
                }

                if (!is_numeric($data['inicio']) || !is_numeric($data['final'])) {
                    return response()->json([
                        'message' => "Inicio y Final deben ser numéricos en {$nombre}",
                    ], 422);
                }

                if ($data['final'] > $data['inicio']) {
                    return response()->json([
                        'message' => "En {$nombre}, el FINAL no puede ser mayor al INICIO",
                    ], 422);
                }
            }

            // Crear control (SIN FIRMA)
            $control = ControlMedicamento::create([
                'responsable'  => $validated['responsable'],
                'fecha'        => $validated['fecha'],
                'dia'          => $validated['dia'],
                'medicamentos' => $validated['medicamentos'],
                'user_id'      => auth()->id(),
            ]);

            // Guardar firma (MISMO PATRÓN QUE CHECKLIST)
            $this->guardarFirmaBase64(
                $validated['firma'],
                'firma_responsable',
                $control
            );

            DB::commit();

            return response()->json([
                'message' => 'Control de medicamentos guardado correctamente',
                'data'    => $control->load('firmas'),
            ], 201);

        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Error al guardar el control de medicamentos',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    private function guardarFirmaBase64(
        string $value,
        string $rol,
        ControlMedicamento $control
    ): void {
        if (trim($value) === '') return;
        if (!str_contains($value, 'base64,')) return;

        // Desactivar firma anterior
        $control->firmas()
            ->newPivotStatement()
            ->where('firmable_type', ControlMedicamento::class)
            ->where('firmable_id', $control->id)
            ->where('rol', $rol)
            ->where('status', 'A')
            ->update(['status' => 'N']);

        // Guardar archivo
        $firma = $this->guardarFirmaArchivoBase64(
            $value,
            'firmas/ControlMedicamento/' . now()->format('Y/m')
        );

        // Asociar
        $control->firmas()->attach($firma->id, [
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
            'firma_responsable' => 'Firma Responsable',
            default => ucfirst(str_replace('_', ' ', $rol)),
        };
    }

    public function index(Request $request)
    {
        $query = ControlMedicamento::with('firmas')
            ->orderBy('fecha', 'asc');

        if ($request->filled('week')) {
            [$year, $week] = explode('-W', $request->week);

            $startOfWeek = Carbon::now()
                ->setISODate($year, $week)
                ->startOfWeek(Carbon::MONDAY)
                ->toDateString();

            $endOfWeek = Carbon::now()
                ->setISODate($year, $week)
                ->endOfWeek(Carbon::SUNDAY)
                ->toDateString();

            $query->whereBetween('fecha', [$startOfWeek, $endOfWeek]);
        }

        if ($request->filled('search')) {
            $query->where('responsable', 'like', '%' . $request->search . '%');
        }

        $controles = $query->get()->map(function ($control) {

            $control->setRelation(
                'firmas',
                $control->firmas->map(function (Firma $firma) {

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
                })->values()
            );

            return $control;
        });
        return response()->json($controles);
    }

    public function current(Request $request)
    {
        $today = Carbon::today()->toDateString();
        $yesterday = Carbon::yesterday()->toDateString();

        $control = ControlMedicamento::with('firmas')
            ->whereDate('fecha', $today)
            ->orderBy('created_at', 'desc')
            ->first();

        $dataYesterday = ControlMedicamento::with('firmas')
            ->whereDate('fecha', $yesterday)
            ->orderBy('created_at', 'desc')
            ->first();

        if (!$control) {
            return response()->json(null);
        }

        $control->setRelation(
            'firmas',
            $control->firmas->map(function ($firma) {

                $disk = $firma->disk ?? 'public';
                $path = $firma->path;

                return [
                    'id'    => $firma->id,
                    'rol'   => $firma->pivot->rol ?? null,
                    'tag'   => $firma->pivot->tag ?? null,
                    'orden' => $firma->pivot->orden ?? 0,
                    'status'=> $firma->pivot->status ?? 'A',
                    'url'   => $path
                        ? Storage::disk($disk)->url($path)
                        : null,
                ];
            })->values()
        );
        return response()->json($control);
    }

    public function update(Request $request, ControlMedicamento $controlMedicamento)
    {
        DB::beginTransaction();

        try {
            $validated = $request->validate([
                'responsable'   => 'required|string|max:255',
                'fecha'         => 'required|date',
                'dia'           => 'required|string|max:15',
                'firma'         => 'nullable|string',
                'medicamentos'  => 'required|array|min:1',
            ]);

            foreach ($validated['medicamentos'] as $nombre => $data) {

                if (!isset($data['inicio'], $data['final'])) {
                    return response()->json([
                        'message' => "El medicamento {$nombre} está incompleto",
                    ], 422);
                }

                if (!is_numeric($data['inicio']) || !is_numeric($data['final'])) {
                    return response()->json([
                        'message' => "Inicio y Final deben ser numéricos en {$nombre}",
                    ], 422);
                }

                if ($data['final'] > $data['inicio']) {
                    return response()->json([
                        'message' => "En {$nombre}, el FINAL no puede ser mayor al INICIO",
                    ], 422);
                }
            }

            $controlMedicamento->update([
                'responsable'  => $validated['responsable'],
                'fecha'        => $validated['fecha'],
                'dia'          => $validated['dia'],
                'medicamentos' => $validated['medicamentos'],
            ]);

            if (!empty($validated['firma'])) {
                $this->guardarFirmaBase64(
                    $validated['firma'],
                    'firma_responsable',
                    $controlMedicamento
                );
            }

            DB::commit();

            return response()->json([
                'message' => 'Control de medicamentos actualizado correctamente',
                'data'    => $controlMedicamento->load('firmas'),
            ], 200);

        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Error al actualizar el control de medicamentos',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }
}
