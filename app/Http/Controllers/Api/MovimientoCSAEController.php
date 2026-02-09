<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MovimientoCSAE;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;
use App\Models\Firma;

class MovimientoCSAEController extends Controller
{
    /**
     * Guarda la ENTRADA del movimiento
     */
    public function store(Request $request)
    {
        DB::beginTransaction();

        try {
            $validated = $request->validate([
                'fecha_hora_entrada'    => 'required|date',
                'matricula'             => 'required|string|max:20',
                'tipo_aeronave'         => 'required|string|max:50',
                'como_llega'            => 'required|string|max:50',
                'transportista'         => 'required|string|max:100',
                'firma_entrada'         => 'required|string',
                'observaciones_entrada' => 'nullable|string',
            ]);

            $ver = MovimientoCSAE::where('matricula', $validated['matricula'])
                                    ->whereNull('fecha_hora_salida')
                                    ->first();
            if ($ver) {
                return response()->json(['message' => 'Ya hay un registro activo de esta matrícula'], 422);
            }

            $tipoExistente = DB::connection('remota')
                ->table('tb_tipo')
                ->where('tipo', $validated['tipo_aeronave'])
                ->first();

            if (!$tipoExistente) {
                $idTipo = DB::connection('remota')->table('tb_tipo')->insertGetId([
                    'tipo' => $validated['tipo_aeronave']
                ]);
            } else {
                $idTipo = $tipoExistente->id_tipo;
            }
            $infoMatricula = DB::connection('remota')
                ->table('tb_matricula as m')
                ->where('m.matricula', $validated['matricula'])
                ->first();

            if (!$infoMatricula) {
                DB::connection('remota')->table('tb_matricula')->insert([
                    'matricula'      => $validated['matricula'],
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

            $movimiento = MovimientoCSAE::create([
                'fecha_hora_entrada'    => $validated['fecha_hora_entrada'],
                'matricula'             => $validated['matricula'],
                'tipo_aeronave'         => $validated['tipo_aeronave'],
                'como_llega'            => $validated['como_llega'],
                'transportista'         => $validated['transportista'],
                'observaciones_entrada' => $validated['observaciones_entrada'] ?? null,
                'user_entrada_id'       => Auth::id(),
            ]);

            $this->guardarFirmaBase64($request->firma_entrada, 'firma_entrada', $movimiento);

            DB::commit();

            return response()->json([
                'message' => 'Movimiento registrado correctamente',
                'data' => $movimiento,
            ], 201);

        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Error al guardar movimiento',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
    public function index(Request $request)
    {

        $query = MovimientoCSAE::query();

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('matricula', 'like', "%{$search}%");
                $q->where('tipo_aeronave', 'like', "%{$search}%");
            });
        }

        $perPage = $request->get('per_page', 10);

        return response()->json(
            $query->orderBy('created_at', 'desc')
                ->paginate($perPage)
        );
    }
    public function show(MovimientoCSAE $movimientoCSAE)
    {
        $movimientoCSAE->load([
            'firmas' => fn ($q) => $q->withPivot(['rol', 'tag', 'orden', 'status']),
        ]);

        $firmas = $movimientoCSAE->firmas->map(function (Firma $firma) {

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

        $movimientoCSAE->setRelation('firmas', $firmas);

        return response()->json($movimientoCSAE);
    }
    public function salida(Request $request, MovimientoCSAE $movimientoCSAE)
    {
        DB::beginTransaction();

        try {
            $validated = $request->validate([
                'fecha_hora_salida'    => 'nullable|date',
                'firma_salida'         => 'nullable|string',
                'observaciones_salida' => 'nullable|string',
            ]);

            $movimientoCSAE->update([
                'fecha_hora_salida'    => $validated['fecha_hora_salida'] ?? null,
                'observaciones_salida' => $validated['observaciones_salida'] ?? null,
                'user_salida_id'       => Auth::id(),
            ]);

            if (str_contains($request->firma_salida ?? '', 'base64,')) {
                $this->guardarFirmaBase64(
                    $request->firma_salida,
                    'firma_salida',
                    $movimientoCSAE
                );
            }

            DB::commit();

            return response()->json([
                'message' => 'Salida registrada correctamente',
                'data' => $movimientoCSAE,
            ]);

        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Error al actualizar salida',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
    private function guardarFirmaBase64(string $value, string $rol, MovimientoCSAE $movimiento): void
    {
        if (trim($value) === '') return;
        if (!str_contains($value, 'base64,')) return;

        // Desactivar firma anterior
        $movimiento->firmas()
            ->newPivotStatement()
            ->where('firmable_type', MovimientoCSAE::class)
            ->where('firmable_id', $movimiento->id)
            ->where('rol', $rol)
            ->where('status', 'A')
            ->update(['status' => 'N']);

        $firma = $this->guardarFirmaArchivoBase64(
            $value,
            'firmas/MovimientoCSAE/' . now()->format('Y/m')
        );

        $movimiento->firmas()->attach($firma->id, [
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
            'firma_entrada' => 'Firma de entrada',
            'firma_salida'  => 'Firma de salida',
            default         => ucfirst(str_replace('_', ' ', $rol)),
        };
    }
}
