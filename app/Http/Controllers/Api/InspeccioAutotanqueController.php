<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Firma;
use App\Models\inspeccionAutotanque;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use App\Models\Imagen;
use Illuminate\Support\Facades\Cache;
use App\Models\InspeccionCombustibles;

class InspeccioAutotanqueController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'turno_id' => 'required',
            'fecha' => 'required',
        ]);

        try {
            return DB::transaction(function () use ($request) {
                $inspeccion = InspeccionAutotanque::updateOrCreate(
                    ['turno_autotanque_id' => $request->turno_id],
                    [
                        'fecha_inspeccion'       => Carbon::parse($request->fecha),
                        'operador'               => $request->operador,
                        'kilometraje'            => $request->km,
                        'porcentaje_combustible' => $request->combustible,
                        'checklist_respuestas'   => $request->checklist,
                        'danos_grafico'          => $request->danos,
                    ]
                );

                if (!empty($request->firmas['entrega']['imagen'])) {
                    $this->guardarFirmaBase64($request->firmas['entrega']['imagen'], 'quien_entrega', $inspeccion);
                }
                if (!empty($request->firmas['operaciones']['imagen'])) {
                    $this->guardarFirmaBase64($request->firmas['operaciones']['imagen'], 'fbo', $inspeccion);
                }
                if (!empty($request->firmas['receptor']['imagen'])) {
                    $this->guardarFirmaBase64($request->firmas['receptor']['imagen'], 'quien_recibe', $inspeccion);
                }

                if ($request->has('evidencias') && is_array($request->evidencias)) {
                    $folder = 'evidencias/autotanques/' . now()->format('Y/m');

                    foreach ($request->evidencias as $index => $base64Data) {
                        if (!empty($base64Data)) {
                            $imagen = $this->guardarImagenBase64($base64Data, $folder);

                            $inspeccion->imagenes()->attach($imagen->id, [
                                'tag'         => 'EVIDENCIA_GENERAL',
                                'observacion' => 'Evidencia #' . ($index + 1),
                                'alerta'      => false,
                                'status'      => 'A'
                            ]);
                        }
                    }
                }

                return response()->json([
                    'message' => 'Inspección y evidencias guardadas correctamente',
                    'data' => $inspeccion->load('imagenes')
                ], 200);
            });

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error al procesar la inspección',
                'error' => $e->getMessage()
            ], 500);
        }
    }
    public function showTurno($id)
    {
        try {
            $inspeccion = InspeccionAutotanque::with(['firmas', 'imagenes' => function($query) {
                    $query->where('imageables.status', 'A'); // Solo imágenes activas
                }])
                ->where('turno_autotanque_id', $id)
                ->first();

            if (!$inspeccion) {
                return response()->json([
                    'message' => 'No se encontró una inspección para este turno',
                    'data' => null
                ], 200);
            }

            $firmasMapeadas = $inspeccion->firmas->mapWithKeys(function ($firma) {
                return [
                    $firma->pivot->tag => \Illuminate\Support\Facades\Storage::url($firma->path)
                ];
            });

            $fotosMapeadas = $inspeccion->imagenes->map(function ($img) {
                return [
                    'id'          => $img->id,
                    'url'         => \Illuminate\Support\Facades\Storage::url($img->path),
                    'tag'         => $img->pivot->tag,
                    'observacion' => $img->pivot->observacion,
                ];
            });

            return response()->json([
                'checklist'    => $inspeccion->checklist_respuestas,
                'km'           => $inspeccion->kilometraje,
                'combustible'  => $inspeccion->porcentaje_combustible,
                'danos'        => $inspeccion->danos_grafico,
                'operador'     => $inspeccion->operador,
                'firmas_db'    => $firmasMapeadas,
                'evidencias'   => $fotosMapeadas, // <-- Nueva clave con las fotos
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error al obtener los datos de la inspección',
                'error'   => $e->getMessage()
            ], 500);
        }
    }
    private function guardarFirmaBase64(string $value, string $rol, inspeccionAutotanque $entrega): void
    {
        if (trim($value) === '') return;
        if (!str_contains($value, 'base64,')) {
            return;
        }
        $entrega->firmas()
            ->newPivotStatement()
            ->where('firmable_type', inspeccionAutotanque::class)
            ->where('firmable_id', $entrega->id)
            ->where('rol', $rol)
            ->where('status', 'A')
            ->update(['status' => 'N']);

        $firma = $this->guardarFirmaArchivoBase64(
            $value,
            'firmas/EntregaTurnoAutotanque/' . now()->format('Y/m')
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
            'fbo'           => 'Firma fbo',
            'quien_recibe'  => 'Firma quien recibe',
            default         => ucfirst(str_replace('_', ' ', $rol)),
        };
    }

    public function validarColor(Request $request)
    {
        $request->validate([
            'image' => 'required|string',
            'tipo'  => 'required|string'
        ]);

        try {
            $tipo = $request->input('tipo');
            $base64Image = $request->input('image');
            $imageData = base64_decode(preg_replace('#^data:image/\w+;base64,#i', '', $base64Image));

            $img = imagecreatefromstring($imageData);
            if (!$img) {
                return response()->json(['alerta' => false, 'mensaje' => 'Error al procesar imagen'], 400);
            }

            $width = imagesx($img);
            $height = imagesy($img);
            $centerX = (int)($width / 2);
            $centerY = (int)($height / 2);
            $rgb = imagecolorat($img, $centerX, $centerY);

            $r = ($rgb >> 16) & 0xFF;
            $g = ($rgb >> 8) & 0xFF;
            $b = $rgb & 0xFF;

            $hsl = $this->rgbToHsl($r, $g, $b);
            $h = $hsl['h'];
            $s = $hsl['s'];
            $v = $hsl['v'];

            $coloresAprendidos = Cache::get("colores_manuales_{$tipo}", []);
            foreach ($coloresAprendidos as $ca) {
                if (abs($h - $ca) <= 7) {
                    imagedestroy($img);
                    return response()->json([
                        'alerta' => true,
                        'mensaje' => "ALERTA: DETECTADO POR APRENDIZAJE PREVIO",
                        'debug' => [
                            'h' => $h,
                            's' => round($s, 2),
                            'rgb' => "R:$r G:$g B:$b",
                            'aprendizaje' => true
                        ]
                    ]);
                }
            }

            $alerta = false;
            $mensaje = "PRODUCTO CONFORME";

            if ($tipo === 'SHELL') {
                if ($h >= 75 && $h <= 250 && $s > 0.15) {
                    $alerta = true;
                    $mensaje = ($h > 160) ? "PRODUCTO NO CONFORME (AZUL)" : "PRODUCTO NO CONFORME (VERDE)";
                } else {
                    $mensaje = "PRODUCTO CONFORME (AMARILLO)";
                }
            } else {
                if ($h >= 280 && $h <= 360 && $s > 0.15 && $v > 0.2) {
                    $alerta = true;
                    $mensaje = "ALERTA: TONO ROSA DETECTADO (AGUA PRESENTE)";
                }
            }

            imagedestroy($img);

            return response()->json([
                'alerta' => $alerta,
                'mensaje' => $mensaje,
                'debug' => [
                    'h' => $h,
                    's' => round($s, 2),
                    'rgb' => "R:$r G:$g B:$b"
                ]
            ]);

        } catch (\Exception $e) {
            Log::error("Error en validación de color: " . $e->getMessage());
            return response()->json(['alerta' => false, 'mensaje' => 'Error interno del servidor'], 500);
        }
    }


    private function rgbToHsl($r, $g, $b) {
        $r /= 255; $g /= 255; $b /= 255;
        $max = \max($r, $g, $b);
        $min = \min($r, $g, $b);

        $h = 0; $s = 0; $v = $max;
        $delta = $max - $min;

        if ($delta != 0) {
            $s = $delta / $max;
            if ($max == $r) {
                $h = \fmod(($g - $b) / $delta, 6);
            } else if ($max == $g) {
                $h = (($b - $r) / $delta) + 2;
            } else {
                $h = (($r - $g) / $delta) + 4;
            }

            $h = \round($h * 60);
            if ($h < 0) {
                $h += 360;
            }
        }

        return ['h' => $h, 's' => $s, 'v' => $v];
    }

    public function guardarInspeccionCompleta(Request $request)
    {
        $request->validate([
            'shell' => 'array',
            'hydrokit' => 'array',
        ]);

        try {
            return DB::transaction(function () use ($request) {
                $inspeccion = InspeccionCombustibles::create([
                    'user_id' => Auth::id() ?? 1,
                    'fecha' => now(),
                ]);

                $folder = 'inspecciones/combustibles/' . now()->format('Y/m');

                if ($request->has('shell')) {
                    foreach ($request->shell as $item) {
                        $this->procesarEvidencia($item, 'SHELL', $inspeccion, $folder);
                    }
                }
                if ($request->has('hydrokit')) {
                    foreach ($request->hydrokit as $item) {
                        $this->procesarEvidencia($item, 'HYDROKIT', $inspeccion, $folder);
                    }
                }

                return response()->json([
                    'success' => true,
                    'message' => 'Inspección guardada correctamente',
                    'id' => $inspeccion->id
                ]);
            });
        } catch (\Throwable $e) {
            // Esto te dirá el archivo, la línea y el mensaje real del error
            return response()->json([
                'success' => false,
                'message' => 'Error en el servidor: ' . $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ], 500);
        }
    }
    private function procesarEvidencia(array $data, string $modulo, InspeccionCombustibles $inspeccion, string $folder): void
    {
        if (empty($data['file'])) return;

        $imagen = $this->guardarImagenBase64($data['file'], $folder);

        $inspeccion->imagenes()->attach($imagen->id, [
            'tag'         => $modulo,          // 'SHELL' o 'HYDROKIT'
            'observacion' => $data['observacion'],
            'alerta'      => $data['alertaRosa'],
            'status'      => 'A'
        ]);
    }
    private function guardarImagenBase64(string $base64, string $folder): Imagen
    {
        if (!str_contains($base64, ',')) {
            throw new \Exception('Formato base64 inválido');
        }

        [$meta, $content] = explode(',', $base64);
        $binaryData = base64_decode($content);
        $src = imagecreatefromstring($binaryData);
        if (!$src) throw new \Exception('No se pudo procesar la imagen');

        $width = imagesx($src);
        $height = imagesy($src);

        // 1. Reducimos más la resolución para asegurar un peso bajo (ej. 480px)
        // 640px suele pesar más de 10KB a menos que la calidad sea muy mala.
        $newWidth = 480;
        $newHeight = floor($height * ($newWidth / $width));

        $tmp = imagecreatetruecolor($newWidth, $newHeight);

        // Preservar calidad en el redimensionamiento
        imagecopyresampled($tmp, $src, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);

        // 2. Cambiamos extensión a .jpg
        $fileName = Str::uuid() . '.jpg';
        $path = $folder . '/' . $fileName;
        $fullPath = Storage::disk('public')->path($path);

        if (!file_exists(dirname($fullPath))) {
            mkdir(dirname($fullPath), 0755, true);
        }

        // 3. Guardar como JPEG con calidad baja para forzar el peso (calidad entre 30 y 50)
        // Nota: 10KB es un límite extremadamente agresivo para una foto.
        imagejpeg($tmp, $fullPath, 40);

        imagedestroy($src);
        imagedestroy($tmp);

        return Imagen::create([
            'disk'          => 'public',
            'path'          => $path,
            'original_name' => $fileName,
            'mime'          => 'image/jpeg', // Cambiado de image/webp
            'size'          => Storage::disk('public')->size($path),
        ]);
    }
    public function indexCombustibles(Request $request)
    {
        $inspecciones = InspeccionCombustibles::with('user:id,name')
            ->where('status', 'A')
            ->withCount('imagenes')

            ->when($request->id, function ($query, $id) {
                $query->where('id', $id);
            })

            ->when($request->inspector, function ($query, $inspector) {
                $query->whereHas('user', function ($q) use ($inspector) {
                    $q->where('name', 'like', '%' . $inspector . '%');
                });
            })

            ->when($request->start && $request->end, function ($query) use ($request) {
                $query->whereBetween('fecha', [$request->start . ' 00:00:00', $request->end . ' 23:59:59']);
            })

            ->orderBy('fecha', 'desc')
            ->orderBy('id', 'desc')
            ->paginate($request->per_page ?? 20);

        return response()->json($inspecciones);
    }
    public function showCombustibles($id)
    {
        try {
            $inspeccion = InspeccionCombustibles::with(['imagenes' => function($query) {
                $query->orderBy('imageables.tag', 'asc');
            }])->find($id);

            if (!$inspeccion) {
                return response()->json(['mensaje' => 'Inspección no encontrada'], 404);
            }

            $resultado = [
                'id' => $inspeccion->id,
                'fecha' => $inspeccion->fecha,
                'usuario_id' => $inspeccion->user_id,
                'evidencias' => $inspeccion->imagenes->map(function ($img) {
                    return [
                        'id' => $img->id,
                        'url' => $img->url,
                        'modulo' => $img->pivot->tag,
                        'observacion' => $img->pivot->observacion,
                        'alerta' => (bool)$img->pivot->alerta,
                        'status' => $img->pivot->status,
                    ];
                })
            ];

            return response()->json($resultado);

        } catch (\Exception $e) {
            Log::error("Error al obtener inspección: " . $e->getMessage());
            return response()->json(['mensaje' => 'Error al recuperar los datos'], 500);
        }
    }
    public function aprenderColorManual(Request $request)
    {
        $request->validate([
            'h' => 'required|numeric',
            'tipo' => 'required|string'
        ]);

        $tipo = $request->tipo;
        $nuevoH = $request->h;

        $key = "colores_manuales_{$tipo}";
        $colores = Cache::get($key, []);

        if (!in_array($nuevoH, $colores)) {
            $colores[] = $nuevoH;
            Cache::forever($key, $colores);
        }

        return response()->json(['success' => true]);
    }
    public function eliminar($id)
    {
        try {
            $registro = InspeccionCombustibles::find($id);
            if (!$registro) {
                return response()->json([
                    'message' => 'El registro no existe.'
                ], 404);
            }
            $registro->update([
                'status' => 'N'
            ]);
            $registro->imagenesAll()->get()->each(function ($imagen) {
                $imagen->update(['status' => 'N']);
            });

            $registro->firmasAll()->get()->each(function ($firma) {
                $firma->update(['status' => 'N']);
            });
            return response()->json([
                'message' => 'Inspección eliminado correctamente (lógicamente)',
                'data' => $registro
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Error al intentar eliminar el registro',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
