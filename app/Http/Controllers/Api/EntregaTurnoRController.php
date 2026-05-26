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

    public function index(Request $request)
    {
        $query = EntregaTurnoR::with([
            'firmas' => function ($q) {
                $q->withPivot(['rol', 'tag', 'orden', 'status']);
            },
        ]);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('id', 'like', "%{$search}%")
                ->orWhere('encabezado->jefeTurno', 'like', "%{$search}%");
            });
        }

        if ($request->filled('periodo')) {
            $inicio = $request->fechaInicio;
            $fin = $request->fechaFin;

            switch ($request->periodo) {
                case 'dia':
                    $query->whereDate('encabezado->fecha', $inicio);
                    break;
                case 'rango':
                case 'mes':
                case 'año':
                    $query->whereBetween('encabezado->fecha', [$inicio, $fin]);
                    break;
            }
        }

        if ($request->filled('jefeTurno')) {
            $query->where('encabezado->jefeTurno', 'like', "%{$request->jefeTurno}%");
        }

        if ($request->filled('nombreEntrega')) {
            $query->where('nombre_entrega', 'like', "%{$request->nombreEntrega}%");
        }

        if ($request->filled('nombreRecibe')) {
            $query->where('nombre_recibe', 'like', "%{$request->nombreRecibe}%");
        }

        $entregas = $query->latest()->paginate(10);

        $entregas->getCollection()->transform(function ($entrega) {
            $firmasCompletasCount = $entrega->firmas->filter(function ($firma) {
                return $firma->pivot->status === 'A' &&
                    in_array($firma->pivot->rol, ['quien_entrega', 'quien_recibe']);
            })->count();

            $entrega->esta_firmado = ($firmasCompletasCount >= 2);
            $entrega->conteo_firmas = $firmasCompletasCount;
            return $entrega;
        });

        return response()->json($entregas);
    }

    public function show(EntregaTurnoR $entregaTurnoR)
    {

        $entregaTurnoR->load(['firmas' => function ($q) {
            $q->withPivot(['rol', 'tag', 'orden', 'status']);
        }]);

        return response()->json($entregaTurnoR);
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
    public function updateFirmas(Request $request, EntregaTurnoR $entregaTurnoR)
    {
        DB::beginTransaction();

        try {
            // 1. Actualizar los nombres de los firmantes si vienen en el request
            $entregaTurnoR->update([
                'nombre_entrega'   => $request->firmas['entrega']['nombre'] ?? $entregaTurnoR->nombre_entrega,
                'nombre_jefe_area' => $request->firmas['jefe']['nombre'] ?? $entregaTurnoR->nombre_jefe_area,
                'nombre_recibe'    => $request->firmas['recibe']['nombre'] ?? $entregaTurnoR->nombre_recibe,
            ]);

            // 2. Procesar las firmas solo si son Base64 (nuevas)
            // La función guardarFirmaBase64 ya tiene validaciones internas
            if (isset($request->firmas['entrega']['firma'])) {
                $this->guardarFirmaBase64($request->firmas['entrega']['firma'], 'quien_entrega', $entregaTurnoR);
            }

            if (isset($request->firmas['jefe']['firma'])) {
                $this->guardarFirmaBase64($request->firmas['jefe']['firma'], 'jefe_rampa', $entregaTurnoR);
            }

            if (isset($request->firmas['recibe']['firma'])) {
                $this->guardarFirmaBase64($request->firmas['recibe']['firma'], 'quien_recibe', $entregaTurnoR);
            }

            DB::commit();

            return response()->json([
                'message' => 'Firmas actualizadas correctamente',
                'data'    => $entregaTurnoR->fresh('firmas'),
            ]);

        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Error al actualizar las firmas',
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
    public function buscarUsuariosRampa(Request $request)
    {
        try {
            $search = $request->query('q');

            // Si el parámetro viene vacío, retornamos un array vacío de inmediato
            if (blank($search)) {
                return response()->json([]);
            }

            // Realizamos la búsqueda en la tabla de usuarios
            $usuarios = \App\Models\User::select('id', 'name')
                ->where('name', 'like', "%{$search}%")
                ->orderBy('name', 'asc')
                ->take(10) // Limitamos a 10 resultados para optimizar la carga de la red
                ->get();

            return response()->json($usuarios);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error al buscar usuarios',
                'error' => $e->getMessage()
            ], 500);
        }
    }
    public function verificarUltimoTurno()
    {
        try {
            $ultimoReporte = EntregaTurnoR::latest()->first();

            if (!$ultimoReporte) {
                return response()->json([
                    'turno_abierto' => false,
                    'reporte_id' => null
                ]);
            }
            $tieneFirmaRecibe = DB::table('firmables')
                ->where('firmable_type', EntregaTurnoR::class)
                ->where('firmable_id', $ultimoReporte->id)
                ->where('rol', 'quien_recibe')
                ->where('status', 'A')
                ->exists();

            $estaCerrado = !empty($ultimoReporte->nombre_recibe) && $tieneFirmaRecibe;

            return response()->json([
                'turno_abierto' => !$estaCerrado,
                'reporte_id' => !$estaCerrado ? $ultimoReporte->id : null
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error al verificar el último turno',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
