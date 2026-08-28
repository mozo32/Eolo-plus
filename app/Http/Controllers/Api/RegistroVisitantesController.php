<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Firma;
use App\Models\RegistroVisitante;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class RegistroVisitantesController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:255',
            'procedencia' => 'required|string|max:255',
            'a_quien_visita' => 'required|string|max:255',
            'gafete' => 'required|string|max:50',
            'tipo_gafete' => 'required|string|in:Rojo,Verde',
            'empresa' => 'required|string',
            'autoriza' => 'required|string',
            'fechaRegistro' => 'required|string',
            'horaEntrada' => 'required|string',
            'firma_entrada' => [
                'required',
                'string',
                function ($attribute, $value, $fail) {
                    if (!str_contains($value, 'base64,')) {
                        $fail('La firma del visitante no tiene un formato válido.');
                    }
                },
            ],
        ]);

        DB::beginTransaction();

        try {
            $registro = new RegistroVisitante();
            $registro->forceFill([
                'nombre' => $validated['nombre'],
                'procedencia' => $validated['procedencia'],
                'a_quien_visita' => $validated['a_quien_visita'],
                'gafete' => $validated['gafete'],
                'tipo_gafete' => $validated['tipo_gafete'],
                'empresa' => $validated['empresa'],
                'autoriza' => $validated['autoriza'],
                'fecha_entrada' => $validated['fechaRegistro'],
                'hora_entrada' => $validated['horaEntrada'],
                'user_id' => Auth::id(),
            ]);
            $registro->save();

            $this->guardarFirmaBase64(
                $validated['firma_entrada'],
                'firma_entrada',
                $registro,
            );

            DB::commit();

            return response()->json([
                'message' => 'Entrada registrada con éxito',
                'data' => $registro,
            ], 201);
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Error al guardar el registro del visitante',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function salida(
        Request $request,
        RegistroVisitante $registroVisitante,
    ) {
        $validated = $request->validate([
            'fechaSalida' => 'required|string',
            'horaSalida' => 'required|string',
            'firma_salida' => [
                'required',
                'string',
                function ($attribute, $value, $fail) {
                    if (!str_contains($value, 'base64,')) {
                        $fail('La firma de salida no tiene un formato válido.');
                    }
                },
            ],
        ]);

        DB::beginTransaction();

        try {
            $registroVisitante->update([
                'fecha_salida' => $validated['fechaSalida'],
                'hora_salida' => $validated['horaSalida'],
            ]);

            $this->guardarFirmaBase64(
                $validated['firma_salida'],
                'firma_salida',
                $registroVisitante,
            );

            DB::commit();

            return response()->json([
                'message' => 'Salida registrada correctamente',
                'data' => $registroVisitante,
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Error al actualizar salida',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function index(Request $request)
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'fecha' => ['nullable', 'date'],
            'fechaInicio' => ['nullable', 'date'],
            'fechaFin' => ['nullable', 'date'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => [
                'nullable',
                'integer',
                'in:5,10,20,50,100',
            ],
        ]);

        $search = trim($validated['search'] ?? '');

        $fechaInicio =
            $validated['fechaInicio']
            ?? $validated['fecha']
            ?? null;

        $fechaFin =
            $validated['fechaFin']
            ?? $validated['fecha']
            ?? null;

        $perPage = (int) (
            $validated['per_page'] ?? 10
        );

        $query = RegistroVisitante::query()
            ->when(
                $search !== '',
                function ($query) use ($search) {
                    $query->where(
                        function ($subquery) use ($search) {
                            $subquery
                                ->where(
                                    'nombre',
                                    'like',
                                    "%{$search}%"
                                )
                                ->orWhere(
                                    'gafete',
                                    'like',
                                    "%{$search}%"
                                )
                                ->orWhere(
                                    'tipo_gafete',
                                    'like',
                                    "%{$search}%"
                                )
                                ->orWhere(
                                    'procedencia',
                                    'like',
                                    "%{$search}%"
                                );
                        }
                    );
                }
            )
            ->when(
                $fechaInicio,
                fn ($query, $fechaInicio) =>
                    $query->whereDate(
                        'fecha_entrada',
                        '>=',
                        $fechaInicio
                    )
            )
            ->when(
                $fechaFin,
                fn ($query, $fechaFin) =>
                    $query->whereDate(
                        'fecha_entrada',
                        '<=',
                        $fechaFin
                    )
            )
            ->orderByDesc('fecha_entrada')
            ->orderByDesc('hora_entrada')
            ->orderByDesc('id');

        return response()->json(
            $query
                ->paginate($perPage)
                ->withQueryString()
        );
    }

    public function pendientes()
    {
        $registros = RegistroVisitante::query()
            ->where(function ($query) {
                $query
                    ->whereNull('hora_salida')
                    ->orWhere('hora_salida', '');
            })
            ->orderBy('fecha_entrada')
            ->orderBy('hora_entrada')
            ->orderBy('id')
            ->get([
                'id',
                'nombre',
                'procedencia',
                'gafete',
                'tipo_gafete',
                'fecha_entrada',
                'hora_entrada',
                'fecha_salida',
                'hora_salida',
            ]);

        return response()->json([
            'data' => $registros,
            'total' => $registros->count(),
        ]);
    }

    private function guardarFirmaBase64(
        string $value,
        string $rol,
        RegistroVisitante $registro,
    ): void {
        if (trim($value) === '' || !str_contains($value, 'base64,')) {
            return;
        }

        $registro->firmas()
            ->newPivotStatement()
            ->where('firmable_type', RegistroVisitante::class)
            ->where('firmable_id', $registro->id)
            ->where('rol', $rol)
            ->where('status', 'A')
            ->update(['status' => 'N']);

        $firma = $this->guardarFirmaArchivoBase64(
            $value,
            'firmas/RegistroVisitante/' . now()->format('Y/m'),
        );

        $registro->firmas()->attach($firma->id, [
            'rol' => $rol,
            'tag' => $this->humanizeRol($rol),
            'orden' => 0,
            'status' => 'A',
        ]);
    }

    private function guardarFirmaArchivoBase64(
        string $base64,
        string $folder,
    ): Firma {
        [$meta, $content] = explode(',', $base64, 2);
        preg_match('/data:(.*?);base64/', $meta, $matches);

        $mime = $matches[1] ?? 'image/png';
        $extension = explode('/', $mime)[1] ?? 'png';
        $fileName = Str::uuid() . '.' . $extension;
        $path = $folder . '/' . $fileName;

        Storage::disk('public')->put($path, base64_decode($content));

        return Firma::create([
            'disk' => 'public',
            'path' => $path,
            'original_name' => $fileName,
            'mime' => $mime,
            'size' => Storage::disk('public')->size($path),
            'sha1' => sha1_file(Storage::disk('public')->path($path)),
        ]);
    }

    private function humanizeRol(string $rol): string
    {
        return match ($rol) {
            'firma_entrada' => 'Firma de entrada del visitante',
            'firma_salida' => 'Firma de salida del visitante',
            default => ucfirst(str_replace('_', ' ', $rol)),
        };
    }
}
