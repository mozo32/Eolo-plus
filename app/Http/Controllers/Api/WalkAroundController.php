<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\WalkAround;
use App\Models\WalkaroundChecklist;
use App\Models\WalkaroundMarcaDanio;
use App\Models\Imagen;
use App\Models\Firma;
use App\Models\Aeronave;
use App\Models\Departamento;
use App\Models\Personal;
use App\Models\Bitacora;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Http;

class WalkAroundController extends Controller
{
    /**
     * LISTADO (para fetchWalkarounds)
     * GET /api/walkarounds?q=&page=
     */
    public function index(Request $request)
    {
        $q = trim((string) $request->get('q', ''));

        $query = WalkAround::query()
            ->select([
                'id',
                'fecha',
                'movimiento',
                'matricula',
                'tipo',
                'hora',
                'destino',
                'procedensia',
                'created_at',
            ])
            ->orderByDesc('id');

        if ($q !== '') {
            $query->where(function ($sub) use ($q) {
                $sub->where('matricula', 'like', "%{$q}%")
                    ->orWhere('destino', 'like', "%{$q}%")
                    ->orWhere('procedensia', 'like', "%{$q}%")
                    ->orWhere('tipo', 'like', "%{$q}%")
                    ->orWhere('movimiento', 'like', "%{$q}%")
                    ->orWhere('fecha', 'like', "%{$q}%");
            });
        }


        if ($request->filled('movimiento')) {
            $query->where('movimiento', $request->movimiento);
        }

        if ($request->filled('tipo')) {
            $query->where('tipo', $request->tipo);
        }

        if ($request->filled('fecha_inicio')) {
            $query->whereDate('fecha', '>=', $request->fecha_inicio);
        }

        if ($request->filled('fecha_fin')) {
            $query->whereDate('fecha', '<=', $request->fecha_fin);
        }

        return response()->json($query->paginate(5));
    }

    /**
     * DETALLE
     * GET /api/walkarounds/{walkAround}
     */
    public function show(WalkAround $walkAround)
    {

        $walkAround->load([
            'checklist:id,walk_around_id,checklist_avion,checklist_helicoptero',
            'marcasDanio:id,walk_around_id,x,y,z,descripcion,severidad',
            'imagenes' => fn ($q) => $q->withPivot(['tag', 'orden', 'status']),

            'firmas'   => fn ($q) => $q->withPivot(['rol', 'tag', 'orden', 'status']),
        ]);
        $imagenes = $walkAround->imagenes->map(function (Imagen $img) {
            $disk = $img->disk ?? 'public';
            $path = $img->path;

            if (!$path || !Storage::disk($disk)->exists($path)) {
                return [
                    'id'     => $img->id,
                    'url'    => null,
                    'tag'    => $img->pivot->tag ?? null,
                    'status' => $img->pivot->status ?? null,
                    'orden'  => $img->pivot->orden ?? 0,
                    'error'  => 'archivo_no_encontrado',
                ];
            }

            return [
                'id'     => $img->id,
                'url'    => Storage::disk($disk)->url($path),
                'tag'    => $img->pivot->tag ?? null,
                'status' => $img->pivot->status ?? null,
                'orden'  => $img->pivot->orden ?? 0,
            ];
        })->values();

        $firmas = $walkAround->firmas->map(function (Firma $firma) {
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
        $tipoAeronaveDb = DB::connection('remota')
            ->table('tb_matricula as m')
            ->leftJoin('tb_tipo as t', 't.id_tipo', '=', 'm.id_tipo')
            ->where('m.matricula', $walkAround->matricula)
            ->select(
                't.tipo',
            )
            ->first();

        return response()->json([
            'id'                        => $walkAround->id,
            'fecha'                     => $walkAround->fecha,
            'movimiento'                => $walkAround->movimiento,
            'matricula'                 => $walkAround->matricula,
            'tipo'                      => $walkAround->tipo,
            'tipoAeronave'              => $walkAround->tipo_aeronave ?? $tipoAeronaveDb->tipo,
            'hora'                      => $walkAround->hora,
            'destino'                   => $walkAround->destino,
            'procedensia'               => $walkAround->procedensia,

            'observaciones'             => $walkAround->observaciones,
            'elabora_departamento_id'   => $walkAround->elabora_departamento_id,
            'elabora_personal_id'       => $walkAround->elabora_personal_id,
            'elabora'                   => $walkAround->elabora,
            'responsable'               => $walkAround->responsable,
            'jefe_area'                 => $walkAround->jefe_area,
            'fbo'                       => $walkAround->fbo,

            'checklists' => [
                'checklist_avion'       => optional($walkAround->checklist)->checklist_avion,
                'checklist_helicoptero' => optional($walkAround->checklist)->checklist_helicoptero,
            ],

            'marcas_danio' => $walkAround->marcasDanio->map(fn ($m) => [
                'x'           => (float) $m->x,
                'y'           => (float) $m->y,
                'z'           => (float) $m->z,
                'descripcion' => $m->descripcion,
                'severidad'   => $m->severidad,
            ])->values(),

            'numero_estaticas' => $walkAround->numero_estaticas,
            'imagenes'         => $imagenes,
            'firmas'           => $firmas,
        ]);
    }

    /**
     * ELIMINAR
     * GET /api/walkarounds/{walkAround}
     */
    public function destroy(WalkAround $walkAround)
    {
        DB::beginTransaction();

        try {
            // 1) WalkAround
            $walkAround->update(['status' => 'N']);

            // 2) Checklist
            WalkaroundChecklist::where('walk_around_id', $walkAround->id)
                ->update(['status' => 'N']);

            // 3) Marcas de daño
            WalkaroundMarcaDanio::where('walk_around_id', $walkAround->id)
                ->update(['status' => 'N']);

            // 4) IMÁGENES (tabla imagenes)
            $walkAround->imagenesAll()->get()->each(function ($imagen) {
                $imagen->update(['status' => 'N']);
            });

            // 5) FIRMAS (tabla firmas)
            $walkAround->firmasAll()->get()->each(function ($firma) {
                $firma->update(['status' => 'N']);
            });
            // ===== BITÁCORA =====
            Bitacora::log(
                'WalkAround',
                'Eliminar',
                "Se elimino WalkAround ID {$walkAround->id} | Matrícula: {$walkAround->matricula}",
                auth()->id(),
                auth()->id(),
            );
            DB::commit();

            return response()->json([
                'message' => 'WalkAround eliminado lógicamente'
            ]);

        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Error al eliminar WalkAround',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * ACTIVAR
     * GET /api/walkarounds/{walkAround}
     */
    public function active($id)
    {
        DB::beginTransaction();

        try {
            $walkAround = WalkAround::withoutGlobalScope('activos')
                ->where('id', $id)
                ->firstOrFail();

            // 1) WalkAround
            $walkAround->update(['status' => 'A']);

            // 2) Checklist
            $walkAround->checklistAll()?->update(['status' => 'A']);

            // 3) Marcas de daño
            $walkAround->marcasDanioAll()->update(['status' => 'A']);

            // 4) IMÁGENES (tabla imagenes)
            $walkAround->imagenesAll()->get()->each(function ($imagen) {
                $imagen->update(['status' => 'A']);
            });

            // 5) FIRMAS (tabla firmas)
            $walkAround->firmasAll()->get()->each(function ($firma) {
                $firma->update(['status' => 'A']);
            });

            // ===== BITÁCORA =====
            Bitacora::log(
                'WalkAround',
                'Activar',
                "Se activo el WalkAround ID {$walkAround->id} | Matrícula: {$walkAround->matricula}",
                auth()->id(),
                auth()->id(),
            );
            DB::commit();

            return response()->json([
                'message' => 'WalkAround activado correctamente'
            ], 200);

        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Error al activar WalkAround',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function basurero()
    {
        $rows = WalkAround::withoutGlobalScope('activos')
            ->where('status', 'N')
            ->orderByDesc('fecha')
            ->get();

        return response()->json($rows);
    }

    /**
     * CREAR
     * POST /api/walkarounds
     */
    public function store(Request $request)
    {
        DB::beginTransaction();

        try {
            $dbMatricula = DB::connection('remota')
                ->table('tb_matricula as m')
                ->where('m.matricula', $request->matricula)
                ->first();

            if (! $dbMatricula) {
                DB::connection('remota')
                    ->table('tb_matricula')
                    ->insert([
                        'matricula' => $request->matricula,
                    ]);
            }

            $walkAround = WalkAround::create([
                'fecha'                     => $request->fecha,
                'movimiento'                => $request->movimiento,
                'matricula'                 => $request->matricula,
                'tipo_aeronave_id'          => $request->AeronaveId,
                'tipo'                      => $request->tipo,
                'tipo_aeronave'             => $request->tipoAeronave,
                'hora'                      => $request->hora,
                'destino'                   => $request->destino,
                'procedensia'               => $request->procedensia,
                'observaciones'             => $request->observaciones,
                'elabora_departamento_id'   => $request->elabora_departamento_id,
                'elabora_personal_id'       => $request->elabora_personal_id,
                'elabora'                   => $request->elabora,
                'responsable'               => $request->responsable,
                'jefe_area'                 => $request->jefeArea,
                'fbo'                       => $request->fbo,
                'numero_estaticas'          => $request->numeroEstatica,
            ]);

            WalkaroundChecklist::create([
                'walk_around_id'        => $walkAround->id,
                'checklist_avion'       => $request->checklistAvion ?: null,
                'checklist_helicoptero' => $request->checklistHelicoptero ?: null,
            ]);

            if (is_array($request->marcaDanos)) {
                foreach ($request->marcaDanos as $punto) {
                    WalkaroundMarcaDanio::create([
                        'walk_around_id' => $walkAround->id,
                        'x'              => $punto['x'],
                        'y'              => $punto['y'],
                        'z'              => $punto['z'] ?? 0,
                        'descripcion'    => $punto['descripcion'] ?? null,
                        'severidad'      => $punto['severidad'] ?? null,
                    ]);
                }
            }

            if (is_array($request->fotos)) {
                foreach ($request->fotos as $index => $base64) {
                    $imagen = $this->guardarImagenBase64(
                        $base64,
                        'walkaround/' . now()->format('Y/m')
                    );

                    $walkAround->imagenes()->attach($imagen->id, [
                        'tag'    => 'evidencia',
                        'orden'  => $index,
                        'status' => 'A',
                    ]);
                }
            }

            // ===== FIRMAS =====
            $this->guardarFirmaBase64($request->firmaJefeAreaBase64 ?? '', 'jefe_area', $walkAround);
            $this->guardarFirmaBase64($request->firmaFboBase64 ?? '', 'fbo', $walkAround);
            $this->guardarFirmaBase64($request->firmaResponsableBase64 ?? '', 'responsable', $walkAround);

            // ===== BITÁCORA =====
            Bitacora::log(
                'WalkAround',
                'CREAR',
                "Se registró WalkAround ID {$walkAround->id} | Matrícula: {$walkAround->matricula} | Tipo: {$walkAround->tipo}",
                auth()->id(),
                $request->elabora
            );

            DB::commit();

            return response()->json([
                'message' => 'WalkAround guardado correctamente',
                'id'      => $walkAround->id,
            ], 201);

        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Error al guardar WalkAround',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * ACTUALIZAR
     * PUT/PATCH /api/walkarounds/{walkAround}
     */
    public function update(Request $request, WalkAround $walkAround)
    {
        DB::beginTransaction();

        try {
            $walkAround->update([
                'fecha'            => $request->fecha,
                'movimiento'       => $request->movimiento,
                'matricula'        => $request->matricula,
                'tipo_aeronave_id' => $request->AeronaveId,
                'tipo'             => $request->tipo,
                'hora'             => $request->hora,
                'destino'          => $request->destino,
                'procedensia'      => $request->procedensia,
                'observaciones'    => $request->observaciones,
                'elabora'          => $request->elabora,
                'responsable'      => $request->responsable,
                'jefe_area'        => $request->jefeArea,
                'fbo'              => $request->fbo,
                'numero_estaticas' => $request->numeroEstatica,
            ]);

            WalkaroundChecklist::updateOrCreate(
                ['walk_around_id' => $walkAround->id],
                [
                    'checklist_avion'       => $request->checklistAvion ?: null,
                    'checklist_helicoptero' => $request->checklistHelicoptero ?: null,
                ]
            );

            $walkAround->marcasDanio()->delete();

            if (is_array($request->marcaDanos)) {
                foreach ($request->marcaDanos as $punto) {
                    WalkaroundMarcaDanio::create([
                        'walk_around_id' => $walkAround->id,
                        'x'              => $punto['x'],
                        'y'              => $punto['y'],
                        'z'              => $punto['z'],
                        'descripcion'    => $punto['descripcion'] ?? null,
                        'severidad'      => $punto['severidad'] ?? null,
                    ]);
                }
            }

            // Fotos: desactivar existentes
            if (!empty($request->desactivar_imagen_ids)) {
                $walkAround->imagenes()
                    ->newPivotStatement()
                    ->where('imageable_type', WalkAround::class)
                    ->where('imageable_id', $walkAround->id)
                    ->whereIn('imagen_id', $request->desactivar_imagen_ids)
                    ->update(['status' => 'N']);
            }

            // Fotos nuevas
            if (!empty($request->fotos)) {
                $startOrden = (int) ($walkAround->imagenes()->max('imageables.orden') ?? -1) + 1;

                foreach ($request->fotos as $i => $base64) {
                    $imagen = $this->guardarImagenBase64(
                        $base64,
                        'walkaround/' . now()->format('Y/m')
                    );

                    $walkAround->imagenes()->attach($imagen->id, [
                        'tag'    => 'evidencia',
                        'orden'  => $startOrden + $i,
                        'status' => 'A',
                    ]);
                }
            }

            // ===== FIRMAS =====
            $this->guardarFirmaBase64($request->firmaJefeAreaBase64 ?? '', 'jefe_area', $walkAround);
            $this->guardarFirmaBase64($request->firmaFboBase64 ?? '', 'fbo', $walkAround);
            $this->guardarFirmaBase64($request->firmaResponsableBase64 ?? '', 'responsable', $walkAround);

            // ===== BITÁCORA =====
            Bitacora::log(
                'WalkAround',
                'ACTUALIZAR',
                "Se actualizó WalkAround ID {$walkAround->id} | Matrícula: {$walkAround->matricula}",
                auth()->id(),
                $request->elabora
            );

            DB::commit();

            return response()->json([
                'message' => 'WalkAround actualizado correctamente',
                'id'      => $walkAround->id,
            ], 200);

        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Error al actualizar WalkAround',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }
    public function updateFirma(Request $request, WalkAround $walkAround)
    {
        DB::beginTransaction();

        try {


            // ===== FIRMAS =====
            $this->guardarFirmaBase64($request->firmaJefeAreaBase64 ?? '', 'jefe_area', $walkAround);
            $this->guardarFirmaBase64($request->firmaFboBase64 ?? '', 'fbo', $walkAround);
            $this->guardarFirmaBase64($request->firmaResponsableBase64 ?? '', 'responsable', $walkAround);

            // ===== BITÁCORA =====
            Bitacora::log(
                'WalkAround',
                'ACTUALIZAR',
                "Se firmo WalkAround ID {$walkAround->id} | Matrícula: {$walkAround->matricula}",
                auth()->id(),
                $request->elabora
            );

            DB::commit();

            return response()->json([
                'message' => 'WalkAround actualizado correctamente',
                'id'      => $walkAround->id,
            ], 200);

        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Error al actualizar WalkAround',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    private function guardarImagenBase64(string $base64, string $folder): Imagen
    {
        if (!str_contains($base64, ',')) {
            throw new \Exception('Formato base64 inválido');
        }

        [$meta, $content] = explode(',', $base64);
        preg_match('/data:(.*?);base64/', $meta, $matches);

        $mime = $matches[1] ?? 'image/jpeg';
        $extension = explode('/', $mime)[1] ?? 'jpg';

        $fileName = Str::uuid() . '.' . $extension;
        $path = $folder . '/' . $fileName;

        Storage::disk('public')->put($path, base64_decode($content));

        return Imagen::create([
            'disk'          => 'public',
            'path'          => $path,
            'original_name' => $fileName,
            'mime'          => $mime,
            'size'          => Storage::disk('public')->size($path),
        ]);
    }

    private function guardarFirmaBase64(string $base64, string $rol, WalkAround $walkAround): void
    {
        $base64 = (string) $base64;
        if (trim($base64) === '') return;
        $walkAround->firmas()
            ->newPivotStatement()
            ->where('firmable_type', WalkAround::class)
            ->where('firmable_id', $walkAround->id)
            ->where('rol', $rol)
            ->where('status', 'A')
            ->update(['status' => 'N']);

        $firma = $this->guardarFirmaArchivoBase64($base64, 'firmas/WalkAround/' . now()->format('Y/m'));

        $walkAround->firmas()->attach($firma->id, [
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
            'jefe_area'   => 'Firma Jefe de área',
            'fbo'         => 'Firma VoBo FBO',
            'responsable' => 'Firma Responsable',
            default       => ucfirst(str_replace('_', ' ', $rol)),
        };
    }

    public function departamentos()
    {
        return response()->json(
            Departamento::select('id', 'nombre')
                ->orderBy('nombre')
                ->get()
        );
    }
    public function personal(Request $request)
    {
        $request->validate([
            'departamento_id' => 'required|exists:departamentos,id',
        ]);

        return response()->json(
            Personal::whereHas('puesto.departamento', function ($q) use ($request) {
                $q->where('id', $request->departamento_id);
            })
            ->select('id', 'nombre')
            ->orderBy('nombre')
            ->get()
        );
    }
    public function bitacora(Request $request)
    {
        $query = Bitacora::with('usuario')
            ->orderBy('created_at', 'desc');
        if ($request->filled('q')) {
            $q = $request->q;

            $query->where(function ($sub) use ($q) {
                $sub->where('modulo', 'like', "%{$q}%")
                    ->orWhere('accion', 'like', "%{$q}%")
                    ->orWhere('descripcion', 'like', "%{$q}%")
                    ->orWhere('elabora', 'like', "%{$q}%");
            });
        }

        if ($request->filled('accion')) {
            $query->where('accion', $request->accion);
        }
        if ($request->filled('desde')) {
            $query->whereDate('fecha', '>=', $request->desde);
        }

        if ($request->filled('hasta')) {
            $query->whereDate('fecha', '<=', $request->hasta);
        }

        $bitacoras = $query->paginate(20);

        return response()->json($bitacoras);
    }
}
