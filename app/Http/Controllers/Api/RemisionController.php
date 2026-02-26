<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Remision;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;
use App\Models\Firma;

class RemisionController extends Controller
{
    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'fecha'          => 'required|date',
                'operador'       => 'required|string',
                'cliente'        => 'required|string',
                'formaPago'      => 'required|string',
                'matricula'      => 'required|string',
                'horaLlegada'    => 'required|string|max:5',
                'lecturaInicial' => 'required|numeric',
                'lecturaFinal'   => 'required|numeric',
            ]);
            return DB::transaction(function () use ($request) {
                $ultimoId = Remision::max('id') ?? 0;
                $nuevoFolio = "EOLO-" . str_pad($ultimoId + 1, 4, '0', STR_PAD_LEFT);
                $remision = Remision::create([
                    'folio'           => $nuevoFolio,
                    'fecha'           => $request->fecha,
                    'operador'        => $request->operador,
                    'cliente'         => $request->cliente,
                    'requisicion'     => $request->requisicion,
                    'forma_pago'      => $request->formaPago,
                    'aeronave_tipo'   => $request->aeronaveTipo,
                    'matricula'       => $request->matricula,
                    'destino'         => $request->destino,
                    'hora_llegada'    => $request->horaLlegada,
                    'hora_inicial'    => $request->horaInicial,
                    'hora_final'      => $request->horaFinal,
                    'lectura_inicial' => $request->lecturaInicial,
                    'lectura_final'   => $request->lecturaFinal,
                    'total_litros'    => (float)$request->lecturaFinal - (float)$request->lecturaInicial,
                ]);

                $this->guardarFirmaBase64($request->firmaCliente ?? '', 'cliente', $remision);
                $this->guardarFirmaBase64($request->firmaOperador ?? '', 'operador', $remision);

                return response()->json([
                    'message' => 'Remisión guardada con éxito',
                    'id'      => $remision->id
                ], 201);
            });

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error al procesar el registro',
                'error'   => $e->getMessage()
            ], 500);
        }
    }

    public function index(Request $request)
    {
        $fecha = $request->query('fecha', now()->toDateString());
        $remisiones = Remision::whereDate('fecha', $fecha)
            ->orderBy('fecha', 'desc')
            ->get();

        return response()->json($remisiones);
    }
    private function guardarFirmaBase64(string $value, string $rol, Remision $entrega): void
    {
        if (trim($value) === '') return;
        if (!str_contains($value, 'base64,')) {
            return;
        }
        $entrega->firmas()
            ->newPivotStatement()
            ->where('firmable_type', Remision::class)
            ->where('firmable_id', $entrega->id)
            ->where('rol', $rol)
            ->where('status', 'A')
            ->update(['status' => 'N']);

        $firma = $this->guardarFirmaArchivoBase64(
            $value,
            'firmas/Remision/' . now()->format('Y/m')
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
            'cliente' => 'Firma de cliente',
            'operador'    => 'Firma del operdor',
            default         => ucfirst(str_replace('_', ' ', $rol)),
        };
    }
}
