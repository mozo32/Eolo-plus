<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\EntregaTurnoSeguridad\StoreEntregaTurnoSeguridadRequest;
use App\Models\EntregaTurnoSeguridad;
use App\Models\Firma;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class EntregaTurnoSeguridadController extends Controller
{
    public function store(StoreEntregaTurnoSeguridadRequest $request): JsonResponse
    {
        $validado = $request->validated();
        $firma = $validado['firma_quien_entrega'];
        unset($validado['firma_quien_entrega']);

        $relevo = DB::transaction(function () use ($validado, $firma, $request): EntregaTurnoSeguridad {
            $relevo = EntregaTurnoSeguridad::create([
                ...$validado,
                'user_id' => $request->user()->id,
            ]);

            $this->guardarFirmaBase64($firma, EntregaTurnoSeguridad::ROL_QUIEN_ENTREGA, $relevo);

            return $relevo;
        });

        return response()->json([
            'message' => 'Relevo registrado correctamente',
            'data' => $relevo->load(['usuario:id,name', 'firmas']),
        ], 201);
    }

    /**
     * Guarda una firma nueva y retira la anterior de ese mismo rol.
     *
     * Retirar es poner el pivote en `N`, que es lo que hacen los otros
     * siete módulos con firmas. La relación `firmas()` filtra por `A`, así
     * que la anterior deja de verse sin borrarse: queda el historial.
     */
    private function guardarFirmaBase64(string $value, string $rol, EntregaTurnoSeguridad $relevo): void
    {
        if (trim($value) === '') {
            return;
        }

        if (! str_contains($value, 'base64,')) {
            return;
        }

        $relevo->firmas()
            ->newPivotStatement()
            ->where('firmable_type', EntregaTurnoSeguridad::class)
            ->where('firmable_id', $relevo->id)
            ->where('rol', $rol)
            ->where('status', 'A')
            ->update(['status' => 'N']);

        $firma = $this->guardarFirmaArchivoBase64(
            $value,
            'firmas/EntregaTurnoSeguridad/'.now()->format('Y/m')
        );

        $relevo->firmas()->attach($firma->id, [
            'rol' => $rol,
            'tag' => $this->humanizeRol($rol),
            'orden' => 0,
            'status' => 'A',
        ]);
    }

    /**
     * Escribe la imagen en el disco `public` y registra su `Firma`.
     *
     * La extensión sale de una lista cerrada y no de partir el mime, a
     * propósito: `MovimientoCSAEController` sí lo parte y arrastra ese
     * defecto (un SVG quedaba como `.svg+xml`). Aquí no se copia; no lo
     * «unifiques» con ese módulo.
     */
    private function guardarFirmaArchivoBase64(string $base64, string $folder): Firma
    {
        [$meta, $content] = explode(',', $base64);
        preg_match('/data:(.*?);base64/', $meta, $matches);

        $mime = $matches[1] ?? 'image/png';
        $extension = match ($mime) {
            'image/jpeg', 'image/jpg' => 'jpg',
            'image/webp' => 'webp',
            default => 'png',
        };

        $fileName = Str::uuid().'.'.$extension;
        $path = $folder.'/'.$fileName;

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
            EntregaTurnoSeguridad::ROL_QUIEN_ENTREGA => 'Firma de quien entrega',
            EntregaTurnoSeguridad::ROL_FBO => 'Firma del FBO',
            default => ucfirst(str_replace('_', ' ', $rol)),
        };
    }
}
