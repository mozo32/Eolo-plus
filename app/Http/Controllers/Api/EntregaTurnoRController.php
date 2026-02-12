<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\EntregaTurnoR;
use App\Models\Firma;
use App\Models\Bitacora;
use Illuminate\Support\Facades\Auth;
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
                'encabezado'        => $request->formData['encabezado'],
                'comunicaciones'    => $request->formData['comunicaciones'],
                'vehiculos'         => $request->vehiculos,
                'barras_remolque'   => $request->barrasRemolque,
                'gpus'              => $request->gpus,
                'carrito_golf'      => $request->carritoGolf,
                'aeronaves'         => $request->aeronaves,
                'nombre_entrega'    => $request->firmas['entrega']['nombre'] ?? null,
                'nombre_jefe_area'  => $request->firmas['jefe']['nombre'] ?? null,
                'nombre_recibe'     => $request->firmas['recibe']['nombre'] ?? null,
                'user_id'           => Auth::id(),

            ]);

            $this->guardarFirmaBase64($request->firmas['entrega']['firma'] ?? '', 'quien_entrega', $entrega);
            $this->guardarFirmaBase64($request->firmas['jefe']['firma'] ?? '', 'jefe_rampa', $entrega);
            $this->guardarFirmaBase64($request->firmas['recibe']['firma'] ?? '', 'quien_recibe', $entrega);

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

    public function index()
    {
        $entrega = EntregaTurnoR::with([
            'firmas' => function ($q) {
                $q->withPivot(['rol', 'tag', 'orden', 'status']);
            },
        ])
        ->where('user_id', Auth::id())
        ->latest()
        ->first();

        if (!$entrega) {
            return response()->json(null);
        }

        $firmasRequeridas = $entrega->firmas->filter(function ($firma) {
            return $firma->pivot->status === 'A' &&
                in_array($firma->pivot->rol, ['quien_entrega', 'quien_recibe']);
        })->count();

        if ($firmasRequeridas < 2) {
            return response()->json($entrega);
        }

        return response()->json(null);
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
                'encabezado'      => $request->formData['encabezado'],
                'comunicaciones'  => $request->formData['comunicaciones'],
                'vehiculos'       => $request->vehiculos,
                'barras_remolque' => $request->barrasRemolque,
                'gpus'            => $request->gpus,
                'carrito_golf'    => $request->carritoGolf,
                'aeronaves'       => $request->aeronaves,
                'nombre_entrega'    => $request->firmas['entrega']['nombre'] ?? null,
                'nombre_jefe_area'  => $request->firmas['jefe']['nombre'] ?? null,
                'nombre_recibe'     => $request->firmas['recibe']['nombre'] ?? null,
                'user_id'           => Auth::id(),
            ]);

            $this->guardarFirmaBase64($request->firmas['entrega']['firma'] ?? '', 'quien_entrega', $entregaTurnoR);
            $this->guardarFirmaBase64($request->firmas['jefe']['firma'] ?? '', 'jefe_rampa', $entregaTurnoR);
            $this->guardarFirmaBase64($request->firmas['recibe']['firma'] ?? '', 'quien_recibe', $entregaTurnoR);

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
    public function reportesPendientesJefe()
    {
        try {
            $reportes = EntregaTurnoR::whereDoesntHave('firmas', function ($query) {
                    $query->where('firmables.rol', 'jefe_rampa')
                        ->where('firmables.status', 'A');
                })
                ->with(['usuario'])
                ->latest()
                ->get();
            $reportes->load([
                'firmas' => fn ($q) => $q->withPivot(['rol', 'tag', 'orden', 'status']),
            ]);
            return response()->json($reportes);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error al consultar reportes',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
