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

class InspeccioAutotanqueController extends Controller
{
    public function store(Request $request)
    {
        $inspeccion = inspeccionAutotanque::create([
            'turno_autotanque_id' => $request->turno_id,
            'fecha_inspeccion' => Carbon::parse($request->fecha),
            'operador' => $request->operador,
            'kilometraje' => $request->km,
            'porcentaje_combustible' => $request->combustible,
            'checklist_respuestas' => $request->checklist,
            'danos_grafico' => $request->danos,
        ]);
        $this->guardarFirmaBase64($request->firmas['entrega']['imagen'] ?? '', 'quien_entrega', $inspeccion);
        $this->guardarFirmaBase64($request->firmas['operaciones']['imagen'] ?? '', 'fbo', $inspeccion);
        $this->guardarFirmaBase64($request->firmas['receptor']['imagen'] ?? '', 'quien_recibe', $inspeccion);
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

}
