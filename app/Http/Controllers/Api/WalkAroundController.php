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
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Http;
use Illuminate\Http\JsonResponse;

class WalkAroundController extends Controller
{
    /**
     * LISTADO (para fetchWalkarounds)
     * GET /api/walkarounds?q=&page=
     */
    public function index(Request $request)
    {
        $q = trim((string) $request->get('q', ''));
        $ubicacion = trim((string) $request->get('ubicacion', ''));

        $query = WalkAround::query()
            ->select([
                'id', 'fecha', 'movimiento', 'matricula',
                'tipo', 'tipo_aeronave', 'hora',
                'destino', 'procedensia', 'created_at'
            ]);

        if ($q !== '') {
            $query->where('matricula', 'like', "%{$q}%");
        }

        if ($ubicacion !== '') {
            $query->where(function($sub) use ($ubicacion) {
                $sub->where('procedensia', 'like', "%{$ubicacion}%")
                    ->orWhere('destino', 'like', "%{$ubicacion}%");
            });
        }

        if ($request->filled('movimiento')) {
            $query->where('movimiento', $request->movimiento);
        }

        if ($request->filled('fecha_inicio') && $request->filled('fecha_fin')) {
            $query->whereBetween('fecha', [$request->fecha_inicio, $request->fecha_fin]);
        }

        $query->orderByDesc('fecha')
          ->orderByDesc('hora');

        return response()->json($query->paginate($request->get('per_page', 20)));
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
                'WALKAROUND',
                Bitacora::ACCION_ELIMINAR,
                "Se eliminó el WalkAround #{$walkAround->id} de la matrícula {$walkAround->matricula}."
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
        $ultimoRegistro = WalkAround::where('matricula', $request->metadata['matricula'])
            ->orderByDesc('fecha')
            ->orderByDesc('hora')
            ->first();

        if ($ultimoRegistro) {
            $movimientoAnterior = strtolower($ultimoRegistro->movimiento);
            $movimientoNuevo = strtolower($request->metadata['movimiento']);
            if ($movimientoAnterior === $movimientoNuevo) {
                $debeSer = ($movimientoNuevo === 'entrada') ? 'Salida' : 'Entrada';
                return response()->json([
                    'message' => "La matrícula {$request->metadata['matricula']} ya cuenta con un registro de {$request->metadata['movimiento']}. Debe registrar una {$debeSer} primero.",
                    'data' => [
                        'ultimo_movimiento' => $ultimoRegistro->movimiento,
                        'fecha' => $ultimoRegistro->fecha,
                        'hora' => $ultimoRegistro->hora
                    ],
                ], 422);
            }
        }
        DB::beginTransaction();
        try {
            $tipoExistente = DB::connection('remota')
                ->table('tb_tipo')
                ->where('tipo', $request->metadata['tipo'])
                ->first();

            $idTipo = $tipoExistente ? $tipoExistente->id_tipo : DB::connection('remota')->table('tb_tipo')->insertGetId([
                'tipo' => $request->metadata['tipo']
            ]);

            $dbMatricula = DB::connection('remota')
                ->table('tb_matricula')
                ->where('matricula', $request->metadata['matricula'])
                ->first();

            if (!$dbMatricula) {
                DB::connection('remota')->table('tb_matricula')->insert([
                    'matricula'      => $request->metadata['matricula'],
                    'id_estatus'     => 1,
                    'id_tipo'        => $idTipo,
                    'id_categoria'   => 0,
                    'id_motor'       => 0,
                    'id_aterrizaje'  => 0,
                    'id_transito2h'  => 0,
                    'id_transito12h' => 0,
                    'id_pernocta'    => 0,
                    'd_vuelos'       => 0,
                ]);
            }

            $walkAround = WalkAround::create([
                'fecha'                    => $request->metadata['fecha'],
                'movimiento'               => $request->metadata['movimiento'],
                'matricula'                => $request->metadata['matricula'],
                'tipo'                     => $request->metadata['aeronave'],
                'tipo_aeronave'            => $request->metadata['tipo'],
                'hora'                     => $request->metadata['hora'],
                'destino'                  => $request->metadata['destino'],
                'procedensia'              => $request->metadata['procedencia'],
                'observaciones'            => $request->cierreYFirmas['observaciones'] ?? null,
                'elabora'                  => auth()->user()->name,
                'responsable'              => $request->cierreYFirmas['nombreResponsable'],
                'jefe_area'                => $request->cierreYFirmas['nombreJefe'],
                'fbo'                      => $request->cierreYFirmas['nombreFbo'],
                'numero_estaticas'         => $request->inspeccionTecnica['numeroEstaticas'] ?? 0,
                'elabora_departamento_id'  => auth()->id(),
                'elabora_personal_id'      => auth()->id(),
                'tipo_aeronave_id'         => $idTipo,
            ]);

            $esAvion = ($request->metadata['aeronave'] === 'Avión');
            $checklistPuro = $request->inspeccionTecnica['checklist'] ?? [];

            WalkaroundChecklist::create([
                'walk_around_id'        => $walkAround->id,
                'checklist_avion'       => $esAvion ? $checklistPuro : null,
                'checklist_helicoptero' => !$esAvion ? $checklistPuro : null,
            ]);

            if (isset($request->inspeccionTecnica['puntos3D']) && is_array($request->inspeccionTecnica['puntos3D'])) {
                foreach ($request->inspeccionTecnica['puntos3D'] as $punto) {
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

            if (isset($request->inspeccionTecnica['fotos']) && is_array($request->inspeccionTecnica['fotos'])) {
                foreach ($request->inspeccionTecnica['fotos'] as $index => $fotoData) {
                    $base64String = is_array($fotoData) ? ($fotoData['dataUrl'] ?? null) : $fotoData;

                    if (!empty($base64String)) {
                        $imagen = $this->guardarImagenBase64(
                            $base64String,
                            'walkaround/' . now()->format('Y/m')
                        );

                        $walkAround->imagenes()->attach($imagen->id, [
                            'tag'    => 'evidencia',
                            'orden'  => $index,
                            'status' => 'A',
                        ]);
                    }
                }
            }

            $this->guardarFirmaBase64($request->cierreYFirmas['firmaJefe'] ?? '', 'jefe_area', $walkAround);
            $this->guardarFirmaBase64($request->cierreYFirmas['firmaFbo'] ?? '', 'fbo', $walkAround);
            $this->guardarFirmaBase64($request->cierreYFirmas['firmaResponsable'] ?? '', 'responsable', $walkAround);

            Bitacora::log(
                'WALKAROUND',
                Bitacora::ACCION_CREAR,
                "Se creó el WalkAround #{$walkAround->id} de la matrícula {$walkAround->matricula}."
            );
            DB::commit();
            return response()->json(['message' => 'WalkAround guardado correctamente', 'id' => $walkAround->id], 201);

        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Error al guardar WalkAround',
                'error'   => $e->getMessage(),
                'line'    => $e->getLine()
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
            $metadata = $request->input('metadata', []);
            $inspeccionTecnica = $request->input('inspeccionTecnica', []);
            $cierreYFirmas = $request->input('cierreYFirmas', []);

            $cambiosAnteriores = [];
            $cambiosNuevos = [];

            $normalizarParaBitacora = static function ($valor) {
                if ($valor instanceof \DateTimeInterface) {
                    return $valor->format('Y-m-d H:i:s');
                }

                if ($valor instanceof \Illuminate\Contracts\Support\Arrayable) {
                    return $valor->toArray();
                }

                return $valor;
            };

            $nuevosDatosPrincipales = [
                'fecha' => $metadata['fecha'],
                'movimiento' => $metadata['movimiento'],
                'matricula' => $metadata['matricula'],
                'tipo' => $metadata['aeronave'],
                'tipo_aeronave' => $metadata['tipo'],
                'hora' => $metadata['hora'],
                'destino' => $metadata['destino'],
                'procedensia' => $metadata['procedencia'],
                'observaciones' => $cierreYFirmas['observaciones'] ?? null,
                'responsable' => $cierreYFirmas['nombreResponsable'] ?? null,
                'jefe_area' => $cierreYFirmas['nombreJefe'] ?? null,
                'fbo' => $cierreYFirmas['nombreFbo'] ?? null,
                'numero_estaticas' => $inspeccionTecnica['numeroEstaticas'] ?? 0,
            ];

            $datosPrincipalesAnteriores = [];

            foreach (array_keys($nuevosDatosPrincipales) as $campo) {
                $datosPrincipalesAnteriores[$campo] = $normalizarParaBitacora(
                    $walkAround->getAttribute($campo)
                );
            }

            $walkAround->fill($nuevosDatosPrincipales);

            foreach ($walkAround->getDirty() as $campo => $nuevoValor) {
                $cambiosAnteriores['datos_principales'][$campo] =
                    $datosPrincipalesAnteriores[$campo] ?? null;

                $cambiosNuevos['datos_principales'][$campo] =
                    $normalizarParaBitacora(
                        $walkAround->getAttribute($campo)
                    );
            }

            $walkAround->save();

            $esAvion = ($metadata['aeronave'] === 'Avión');
            $checklistPuro = $inspeccionTecnica['checklist'] ?? [];

            $nuevoChecklist = [
                'checklist_avion' => $esAvion
                    ? $checklistPuro
                    : null,

                'checklist_helicoptero' => !$esAvion
                    ? $checklistPuro
                    : null,
            ];

            $checklist = WalkaroundChecklist::firstOrNew([
                'walk_around_id' => $walkAround->id,
            ]);

            $checklistAnterior = [
                'checklist_avion' => $normalizarParaBitacora(
                    $checklist->checklist_avion
                ),
                'checklist_helicoptero' => $normalizarParaBitacora(
                    $checklist->checklist_helicoptero
                ),
            ];

            $checklist->fill($nuevoChecklist);

            foreach ($checklist->getDirty() as $campo => $nuevoValor) {
                if ($campo === 'walk_around_id') {
                    continue;
                }

                $cambiosAnteriores['checklist'][$campo] =
                    $checklistAnterior[$campo] ?? null;

                $cambiosNuevos['checklist'][$campo] =
                    $normalizarParaBitacora(
                        $checklist->getAttribute($campo)
                    );
            }

            $checklist->save();

            if (
                array_key_exists('puntos3D', $inspeccionTecnica) &&
                is_array($inspeccionTecnica['puntos3D'])
            ) {
                $puntosAnteriores = $walkAround
                    ->marcasDanio()
                    ->orderBy('id')
                    ->get([
                        'x',
                        'y',
                        'z',
                        'descripcion',
                        'severidad',
                    ])
                    ->map(function ($punto) {
                        return [
                            'x' => round((float) $punto->x, 6),
                            'y' => round((float) $punto->y, 6),
                            'z' => round((float) ($punto->z ?? 0), 6),
                            'descripcion' => $punto->descripcion,
                            'severidad' => $punto->severidad,
                        ];
                    })
                    ->values()
                    ->toArray();

                $puntosNuevos = collect($inspeccionTecnica['puntos3D'])
                    ->map(function ($punto) {
                        return [
                            'x' => round((float) ($punto['x'] ?? 0), 6),
                            'y' => round((float) ($punto['y'] ?? 0), 6),
                            'z' => round((float) ($punto['z'] ?? 0), 6),
                            'descripcion' => $punto['descripcion'] ?? null,
                            'severidad' => $punto['severidad'] ?? null,
                        ];
                    })
                    ->values()
                    ->toArray();

                if (
                    json_encode($puntosAnteriores, JSON_UNESCAPED_UNICODE) !==
                    json_encode($puntosNuevos, JSON_UNESCAPED_UNICODE)
                ) {
                    $cambiosAnteriores['marcas_danio'] = $puntosAnteriores;
                    $cambiosNuevos['marcas_danio'] = $puntosNuevos;

                    $walkAround->marcasDanio()->delete();

                    foreach ($puntosNuevos as $punto) {
                        WalkaroundMarcaDanio::create([
                            'walk_around_id' => $walkAround->id,
                            'x' => $punto['x'],
                            'y' => $punto['y'],
                            'z' => $punto['z'],
                            'descripcion' => $punto['descripcion'],
                            'severidad' => $punto['severidad'],
                        ]);
                    }
                }
            }

            $imagenesAgregadas = [];

            $cantidadImagenesAntes = $walkAround
                ->imagenes()
                ->count();

            $fotos = $inspeccionTecnica['fotos'] ?? [];

            if (is_array($fotos)) {
                $ultimoOrden = $walkAround
                    ->imagenes()
                    ->max('imageables.orden');

                $ordenActual = $ultimoOrden === null
                    ? 0
                    : ((int) $ultimoOrden + 1);

                foreach ($fotos as $fotoData) {
                    $base64String = $this->obtenerBase64Imagen($fotoData);

                    if ($base64String === null) {
                        continue;
                    }

                    $imagen = $this->guardarImagenBase64(
                        $base64String,
                        'walkaround/' . now()->format('Y/m')
                    );

                    $walkAround->imagenes()->attach($imagen->id, [
                        'tag' => 'evidencia',
                        'orden' => $ordenActual,
                        'status' => 'A',
                    ]);

                    $imagenesAgregadas[] = [
                        'imagen_id' => $imagen->id,
                        'tag' => 'evidencia',
                        'orden' => $ordenActual,
                    ];

                    $ordenActual++;
                }
            }

            if (!empty($imagenesAgregadas)) {
                $cambiosAnteriores['imagenes'] = [
                    'cantidad' => $cantidadImagenesAntes,
                    'agregadas' => [],
                ];

                $cambiosNuevos['imagenes'] = [
                    'cantidad' => $cantidadImagenesAntes + count($imagenesAgregadas),
                    'agregadas' => $imagenesAgregadas,
                ];
            }

            $firmasActualizadas = [];

            $firmasRecibidas = [
                'jefe_area' => $cierreYFirmas['firmaJefe'] ?? '',
                'fbo' => $cierreYFirmas['firmaFbo'] ?? '',
                'responsable' => $cierreYFirmas['firmaResponsable'] ?? '',
            ];

            foreach ($firmasRecibidas as $rol => $firma) {
                $esFirmaNueva =
                    is_string($firma) &&
                    str_starts_with($firma, 'data:image/');

                if ($esFirmaNueva) {
                    $firmasActualizadas[] = $rol;
                }

                $this->procesarFirmaUpdate(
                    $firma,
                    $rol,
                    $walkAround
                );
            }

            if (!empty($firmasActualizadas)) {
                $cambiosAnteriores['firmas'] = [
                    'actualizadas' => [],
                ];

                $cambiosNuevos['firmas'] = [
                    'actualizadas' => $firmasActualizadas,
                ];
            }

            if (!empty($cambiosNuevos)) {
                $etiquetasSecciones = [
                    'datos_principales' => 'datos principales',
                    'checklist' => 'checklist',
                    'marcas_danio' => 'marcas de daño',
                    'imagenes' => 'fotografías',
                    'firmas' => 'firmas',
                ];

                $seccionesModificadas = array_map(
                    function ($seccion) use ($etiquetasSecciones) {
                        return $etiquetasSecciones[$seccion] ?? $seccion;
                    },
                    array_keys($cambiosNuevos)
                );

                $descripcion =
                    "Se actualizó el WalkAround #{$walkAround->id} " .
                    "de la matrícula {$walkAround->matricula}. " .
                    "Secciones modificadas: " .
                    implode(', ', $seccionesModificadas) .
                    '.';

                if (!empty($cambiosNuevos['datos_principales'])) {
                    $camposPrincipales = array_keys(
                        $cambiosNuevos['datos_principales']
                    );

                    $descripcion .=
                        ' Campos modificados: ' .
                        implode(', ', $camposPrincipales) .
                        '.';
                }

                Bitacora::log(
                    modulo: 'WALKAROUND',
                    accion: Bitacora::ACCION_ACTUALIZAR,
                    descripcion: $descripcion,
                    registroId: $walkAround->id,
                    datosAnteriores: $cambiosAnteriores,
                    datosNuevos: $cambiosNuevos,
                );
            }

            DB::commit();

            return response()->json([
                'message' => 'WalkAround actualizado correctamente',
                'id' => $walkAround->id,
                'cambios_registrados' => !empty($cambiosNuevos),
                'secciones_modificadas' => array_keys($cambiosNuevos),
                'imagenes_agregadas' => count($imagenesAgregadas),
            ], 200);
        } catch (\Throwable $e) {
            DB::rollBack();

            report($e);

            return response()->json([
                'message' => 'Error al actualizar WalkAround',
                'error' => $e->getMessage(),
                'line' => $e->getLine(),
            ], 500);
        }
    }
    private function obtenerBase64Imagen($fotoData): ?string
    {
        if (is_string($fotoData)) {
            return str_starts_with($fotoData, 'data:image/')
                ? $fotoData
                : null;
        }

        if (!is_array($fotoData)) {
            return null;
        }

        $base64 = $fotoData['dataUrl']
            ?? $fotoData['base64']
            ?? $fotoData['data_url']
            ?? $fotoData['preview']
            ?? $fotoData['src']
            ?? null;

        if (
            !is_string($base64) ||
            !str_starts_with($base64, 'data:image/')
        ) {
            return null;
        }

        return $base64;
    }
    private function procesarFirmaUpdate(
        $firmaData,
        string $rol,
        WalkAround $walkAround
    ): void {
        if (
            is_string($firmaData) &&
            str_starts_with($firmaData, 'data:image/')
        ) {
            $this->guardarFirmaBase64(
                $firmaData,
                $rol,
                $walkAround
            );
        }
    }

    public function updateFirma(Request $request, WalkAround $walkAround)
    {
        DB::beginTransaction();

        try {
            // Quita o comenta el dd para probar:
            // dd($request);

            // ===== 1. ACTUALIZAR NOMBRES EN LA TABLA WALKAROUNDS =====
            $walkAround->update([
                'responsable' => $request->responsable,
                'jefe_area'   => $request->jefeArea,
                'fbo'         => $request->fbo,
            ]);

            // ===== 2. PROCESAR Y GUARDAR LAS FIRMAS (BLOB/ARCHIVOS) =====
            $this->guardarFirmaBase64($request->firmaJefeAreaBase64 ?? '', 'jefe_area', $walkAround);
            $this->guardarFirmaBase64($request->firmaFboBase64 ?? '', 'fbo', $walkAround);
            $this->guardarFirmaBase64($request->firmaResponsableBase64 ?? '', 'responsable', $walkAround);



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
        if (
            !preg_match(
                '/^data:image\/([a-zA-Z0-9.+-]+);base64,/',
                $base64,
                $coincidencias
            )
        ) {
            throw new \Exception(
                'La imagen recibida no tiene un formato Base64 válido.'
            );
        }

        [$meta, $contenidoBase64] = explode(',', $base64, 2);

        $contenido = base64_decode(
            $contenidoBase64,
            true
        );

        if ($contenido === false) {
            throw new \Exception(
                'No se pudo decodificar la imagen Base64.'
            );
        }

        $tipo = strtolower($coincidencias[1] ?? 'jpeg');

        $extensionesPermitidas = [
            'jpeg' => 'jpg',
            'jpg' => 'jpg',
            'png' => 'png',
            'webp' => 'webp',
            'gif' => 'gif',
        ];

        $extension = $extensionesPermitidas[$tipo] ?? null;

        if ($extension === null) {
            throw new \Exception(
                "El tipo de imagen {$tipo} no está permitido."
            );
        }

        $fileName = Str::uuid()->toString() . '.' . $extension;
        $path = trim($folder, '/') . '/' . $fileName;

        $guardada = Storage::disk('public')->put(
            $path,
            $contenido
        );

        if (!$guardada) {
            throw new \Exception(
                'No fue posible guardar la imagen.'
            );
        }

        return Imagen::create([
            'disk' => 'public',
            'path' => $path,
            'original_name' => $fileName,
            'mime' => 'image/' . $tipo,
            'size' => strlen($contenido),
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
        $request->validate([
            'q'        => ['nullable', 'string', 'max:150'],
            'accion'   => ['nullable', 'string', 'max:50'],
            'desde'    => ['nullable', 'date'],
            'hasta'    => ['nullable', 'date', 'after_or_equal:desde'],
            'page'     => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $perPage = (int) $request->input('per_page', 20);

        $query = Bitacora::query()
            ->with([
                'usuario:id,name,email'
            ])
            ->orderByDesc('created_at');

        /*
        * Si tu tabla de bitácora contiene registros de varios módulos
        * y quieres mostrar solamente WalkAround, puedes habilitar:
        *
        * $query->where('modulo', 'WalkAround');
        */

        if ($request->filled('q')) {
            $q = trim($request->input('q'));

            $query->where(function ($subQuery) use ($q) {
                $subQuery
                    ->where('modulo', 'like', "%{$q}%")
                    ->orWhere('accion', 'like', "%{$q}%")
                    ->orWhere('descripcion', 'like', "%{$q}%")
                    ->orWhere('elabora', 'like', "%{$q}%")
                    ->orWhereHas('usuario', function ($usuarioQuery) use ($q) {
                        $usuarioQuery
                            ->where('name', 'like', "%{$q}%")
                            ->orWhere('email', 'like', "%{$q}%");
                    });
            });
        }

        if ($request->filled('accion')) {
            $query->where(
                'accion',
                strtoupper($request->input('accion'))
            );
        }

        if ($request->filled('desde')) {
            $query->whereDate(
                'fecha',
                '>=',
                $request->input('desde')
            );
        }

        if ($request->filled('hasta')) {
            $query->whereDate(
                'fecha',
                '<=',
                $request->input('hasta')
            );
        }

        $bitacoras = $query
            ->paginate($perPage)
            ->appends($request->query());

        return response()->json($bitacoras);
    }
    public function buscarPorMatricula(string $matricula): JsonResponse
    {
        try {
            $infoMatricula = DB::connection('remota')
                ->table('tb_matricula as m')
                ->leftJoin('tb_estatus as e', 'e.id_estatus', '=', 'm.id_estatus')
                ->leftJoin('tb_tipo as t', 't.id_tipo', '=', 'm.id_tipo')
                ->leftJoin('tb_categoria as c', 'c.id_categoria', '=', 'm.id_categoria')
                ->where('m.matricula', $matricula)
                ->select(
                    't.tipo',
                )
                ->first();
            return response()->json($infoMatricula);

        } catch (\Throwable $e) {
            \Log::error('Error al buscar aeronave: ' . $e->getMessage());
            return response()->json(['error' => 'Error interno del servidor'], 500);
        }
    }

    public function pendientesFirmar(Request $request)
    {
        $rol = $request->query('rol');
        $query = Walkaround::query();

        switch ($rol) {
            case 'admin':
            case 'fbo':
                $query->where(function($q) {
                    $q->whereDoesntHave('firmas', function($f) {
                        $f->where('rol', 'jefe_area');
                    })
                    ->orWhereDoesntHave('firmas', function($f) {
                        $f->where('rol', 'fbo');
                    })
                    ->orWhereDoesntHave('firmas', function($f) {
                        $f->where('rol', 'responsable');
                    });
                });
                break;

            case 'empleado':
                $query->whereDoesntHave('firmas', function($f) {
                    $f->where('rol', 'responsable');
                });
                break;

            case 'jefe_area':
                $query->whereDoesntHave('firmas', function($f) {
                    $f->where('rol', 'jefe_area');
                });
                break;

            default:
                return response()->json([]);
        }

        $pendientes = $query->get();

        return response()->json($pendientes);
    }
}
