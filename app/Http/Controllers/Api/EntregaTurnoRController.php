<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\EntregaTurnoR;
use App\Models\Firma;
use App\Models\Bitacora;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class EntregaTurnoRController extends Controller
{
    public function store(Request $request)
    {
        DB::beginTransaction();

        try {
            $entrega = EntregaTurnoR::create([
                'encabezado'      => $request->encabezado,
                'comunicaciones'  => $request->comunicaciones,
                'vehiculos'       => $request->vehiculos,
                'barras_remolque' => $request->barrasRemolque,
                'gpus'            => $request->gpus,
                'carrito_golf'    => $request->carritoGolf,
                'aeronaves'       => $request->aeronaves,
            ]);

            $this->guardarFirmaBase64($request->firmas['quienEntrega'] ?? '', 'quien_entrega', $entrega);
            $this->guardarFirmaBase64($request->firmas['jefeRampa'] ?? '', 'jefe_rampa', $entrega);
            $this->guardarFirmaBase64($request->firmas['quienRecibe'] ?? '', 'quien_recibe', $entrega);

            /*
            Bitacora::log(
                'EntregaTurnoR',
                'CREAR',
                "Se registró Entrega de Turno ID {$entrega->id}",
                auth()->id(),
                auth()->user()->name ?? null
            );
            */

            DB::commit();

            return response()->json([
                'message' => 'Entrega de turno guardada correctamente',
                'data' => $entrega
            ], 201);

        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Error al guardar entrega de turno',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    private function guardarFirmaBase64(string $value, string $rol, EntregaTurnoR $entrega): void
    {
        if (trim($value) === '') return;
        if (!str_contains($value, 'base64,')) {
            return;
        }
        $entrega->firmas()
            ->newPivotStatement()
            ->where('firmable_type', EntregaTurnoR::class)
            ->where('firmable_id', $entrega->id)
            ->where('rol', $rol)
            ->where('status', 'A')
            ->update(['status' => 'N']);

        $firma = $this->guardarFirmaArchivoBase64(
            $value,
            'firmas/EntregaTurnoR/' . now()->format('Y/m')
        );

        $entrega->firmas()->attach($firma->id, [
            'rol'    => $rol,
            'tag'    => $this->humanizeRol($rol),
            'orden'  => 0,
            'status' => 'A',
        ]);
    }

    private function guardarFirmaArchivoBase64(string $base64, string $folder): Firma
    {
        if (!str_contains($base64, ',')) {
            throw new \Exception('Formato base64 inválido');
        }

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
            'quien_entrega' => 'Firma quien entrega',
            'jefe_rampa'    => 'Firma Jefe de Rampa',
            'quien_recibe'  => 'Firma quien recibe',
            default         => ucfirst(str_replace('_', ' ', $rol)),
        };
    }

    public function index(Request $request)
    {
        $query = EntregaTurnoR::query();

        if ($request->filled('search')) {
            $search = $request->search;

            $query->where(function ($q) use ($search) {
                $q->where('encabezado->jefeTurno', 'like', "%{$search}%")
                ->orWhere('encabezado->fecha', 'like', "%{$search}%");
            });
        }

        $perPage = $request->get('per_page', 10);

        return response()->json(
            $query->orderBy('created_at', 'desc')
                ->paginate($perPage)
        );
    }

    public function show(EntregaTurnoR $entregaTurnoR)
    {
        $entregaTurnoR->load([
            'firmas' => fn ($q) => $q->withPivot(['rol', 'tag', 'orden', 'status']),
        ]);

        $firmas = $entregaTurnoR->firmas->map(function (Firma $firma) {
            $disk = $firma->disk ?? 'public';
            $path = $firma->path;

            if (!$path || !Storage::disk($disk)->exists($path)) {
                return [
                    'id'     => $firma->id,
                    'url'    => null,
                    'rol'    => $firma->pivot->rol ?? null,
                    'tag'    => $firma->pivot->tag ?? null,
                    'orden'  => $firma->pivot->orden ?? 0,
                    'status' => $firma->pivot->status ?? 'A',
                    'error'  => 'firma_no_encontrada',
                ];
            }

            return [
                'id'     => $firma->id,
                'url'    => Storage::disk($disk)->url($path),
                'rol'    => $firma->pivot->rol ?? null,
                'tag'    => $firma->pivot->tag ?? null,
                'orden'  => $firma->pivot->orden ?? 0,
                'status' => $firma->pivot->status ?? 'A',
            ];
        })->values();

        return response()->json([
            'id'                => $entregaTurnoR->id,
            'encabezado'        => $entregaTurnoR->encabezado,
            'comunicaciones'    => $entregaTurnoR->comunicaciones,
            'vehiculos'         => $entregaTurnoR->vehiculos,
            'barras_remolque'   => $entregaTurnoR->barras_remolque,
            'gpus'              => $entregaTurnoR->gpus,
            'carrito_golf'      => $entregaTurnoR->carrito_golf,
            'aeronaves'         => $entregaTurnoR->aeronaves,
            'firmas'            => $firmas,
            'created_at'        => $entregaTurnoR->created_at,
            'updated_at'        => $entregaTurnoR->updated_at,
        ]);
    }
    public function update(Request $request, EntregaTurnoR $entregaTurnoR)
    {
        DB::beginTransaction();

        try {
            $entregaTurnoR->update([
                'encabezado'      => $request->encabezado,
                'comunicaciones'  => $request->comunicaciones,
                'vehiculos'       => $request->vehiculos,
                'barras_remolque' => $request->barrasRemolque,
                'gpus'            => $request->gpus,
                'carrito_golf'    => $request->carritoGolf,
                'aeronaves'       => $request->aeronaves,
            ]);

            $this->guardarFirmaBase64(
                $request->firmas['quienEntrega'] ?? '',
                'quien_entrega',
                $entregaTurnoR
            );

            $this->guardarFirmaBase64(
                $request->firmas['jefeRampa'] ?? '',
                'jefe_rampa',
                $entregaTurnoR
            );

            $this->guardarFirmaBase64(
                $request->firmas['quienRecibe'] ?? '',
                'quien_recibe',
                $entregaTurnoR
            );

            DB::commit();

            return response()->json([
                'message' => 'Entrega de turno actualizada correctamente',
                'data'    => $entregaTurnoR->fresh('firmas'),
            ]);

        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Error al actualizar entrega de turno',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }
}
