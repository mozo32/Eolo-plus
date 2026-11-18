<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\EntregaTurnoSeguridad\IndexEntregaTurnoSeguridadRequest;
use App\Http\Requests\EntregaTurnoSeguridad\StoreEntregaTurnoSeguridadRequest;
use App\Http\Requests\EntregaTurnoSeguridad\UpdateEntregaTurnoSeguridadRequest;
use App\Models\EntregaTurnoSeguridad;
use App\Models\Firma;
use App\Models\PernoctaDia;
use App\Support\ResumenDelDiaSeguridad;
use App\Support\VentanasDeFecha;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class EntregaTurnoSeguridadController extends Controller
{
    /** `consultaFiltrada()` sigue pidiendo un `Request`: un Form Request lo es. */
    public function index(IndexEntregaTurnoSeguridadRequest $request): JsonResponse
    {
        /*
         * El techo es tan necesario como el piso: sin él, un `per_page=100000`
         * arrastra toda la tabla con sus firmas.
         */
        $porPagina = min(100, max(1, (int) $request->integer('per_page', 10)));

        $relevos = $this->consultaFiltrada($request)
            ->with(['usuario:id,name', 'firmas'])
            ->orderByDesc('fecha_hora')
            ->orderByDesc('id')
            ->paginate($porPagina);

        return response()->json([
            'data' => $this->renglones($relevos->getCollection()),
            'meta' => [
                'current_page' => $relevos->currentPage(),
                'last_page' => $relevos->lastPage(),
                'per_page' => $relevos->perPage(),
                'total' => $relevos->total(),
            ],
        ]);
    }

    /**
     * Un renglón por relevo.
     *
     * @param  Collection<int, EntregaTurnoSeguridad>  $relevos
     * @return list<array{id: int, fecha: string, hora: string, nombre: string, firmas_faltantes: list<string>, pernocta: int}>
     */
    private function renglones(Collection $relevos): array
    {
        $pernoctas = $this->pernoctasDeLaPagina($relevos);

        return $relevos
            ->map(fn (EntregaTurnoSeguridad $relevo): array => [
                'id' => $relevo->id,
                'fecha' => $relevo->fecha_hora->toDateString(),
                'hora' => $relevo->fecha_hora->format('H:i'),
                'nombre' => $relevo->usuario?->name ?? '',
                'firmas_faltantes' => $relevo->firmasFaltantes(),
                'pernocta' => $this->pernoctaDe(
                    $relevo,
                    (int) ($pernoctas[$relevo->fecha_hora->toDateString()] ?? 0),
                ),
            ])
            ->values()
            ->all();
    }

    /**
     * La pernocta de cada día de la página, en UNA consulta.
     *
     * Se pide por fecha y no por relevo a propósito: llamar al servicio del
     * resumen por renglón son nueve consultas cada uno, noventa para pintar
     * diez. Si la página sale vacía no se consulta nada.
     *
     * @param  Collection<int, EntregaTurnoSeguridad>  $relevos
     * @return Collection<string, int>
     */
    private function pernoctasDeLaPagina(Collection $relevos): Collection
    {
        $fechas = $relevos
            ->map(static fn (EntregaTurnoSeguridad $relevo): string => $relevo->fecha_hora->toDateString())
            ->unique()
            ->values()
            ->all();

        if ($fechas === []) {
            return collect();
        }

        return PernoctaDia::query()
            ->whereIn('fecha', $fechas)
            ->selectRaw('fecha, COUNT(*) as total')
            ->groupBy('fecha')
            ->pluck('total', 'fecha');
    }

    /**
     * La pernocta que enseña la tabla: la congelada si el relevo lo está, y
     * si no la del día, que viene contada para toda la página.
     */
    private function pernoctaDe(EntregaTurnoSeguridad $relevo, int $enVivo): int
    {
        if ($relevo->resumen === null) {
            return $enVivo;
        }

        foreach ($relevo->resumen as $renglon) {
            if (($renglon['clave'] ?? null) === 'pernocta') {
                return (int) ($renglon['total'] ?? 0);
            }
        }

        return 0;
    }

    private function consultaFiltrada(Request $request): Builder
    {
        $query = EntregaTurnoSeguridad::activas();

        if ($request->filled('search')) {
            $buscado = $request->string('search')->toString();
            $query->whereHas(
                'usuario',
                static fn (Builder $usuario): Builder => $usuario->where('name', 'like', "%{$buscado}%")
            );
        }

        if ($request->filled('fecha_inicio')) {
            $query->whereDate('fecha_hora', '>=', $request->string('fecha_inicio')->toString());
        }

        if ($request->filled('fecha_fin')) {
            $query->whereDate('fecha_hora', '<=', $request->string('fecha_fin')->toString());
        }

        $estado = $request->string('estado')->toString();

        /*
         * El estado se juzga por RELEVO y no por día. Antes se calculaba por
         * día porque el día tenía dos puestos y uno firmado no hacía completo
         * al otro; sin puesto, cada relevo responde por sí mismo. Los
         * `whereHas` heredan el `wherePivot('status', 'A')` de `firmas()`, así
         * que una firma retirada no cuenta como puesta.
         */
        if ($estado === 'falta_jefe_area') {
            $query->whereDoesntHave(
                'firmas',
                static fn (Builder $firma): Builder => $firma->where('firmables.rol', EntregaTurnoSeguridad::ROL_JEFE_AREA)
            );
        }

        if ($estado === 'falta_fbo') {
            $query->whereDoesntHave(
                'firmas',
                static fn (Builder $firma): Builder => $firma->where('firmables.rol', EntregaTurnoSeguridad::ROL_FBO)
            );
        }

        if ($estado === 'completas') {
            foreach (EntregaTurnoSeguridad::ROLES_DE_CIERRE as $rol) {
                $query->whereHas(
                    'firmas',
                    static fn (Builder $firma): Builder => $firma->where('firmables.rol', $rol)
                );
            }
        }

        return $query;
    }

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
            'data' => $this->detalle($relevo->fresh()->load(['usuario:id,name', 'firmas'])),
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
            EntregaTurnoSeguridad::ROL_JEFE_AREA => 'Firma del jefe de área',
            EntregaTurnoSeguridad::ROL_FBO => 'Firma del FBO',
            default => ucfirst(str_replace('_', ' ', $rol)),
        };
    }

    /**
     * Los relevos que a QUIEN PREGUNTA le falta firmar.
     *
     * No es una lista fija: un jefe de área ve los que no tienen su firma,
     * un FBO los que no tienen la suya, y un administrador los que no tienen
     * alguna de las dos. Quien no pueda firmar ninguna recibe la cola vacía,
     * porque una cola de trabajo ajena no es información, es ruido.
     *
     * De lo más viejo a lo más nuevo a propósito: es una cola de trabajo, y
     * lo que lleva días sin firmar es lo que corre prisa.
     */
    public function pendientes(Request $request): JsonResponse
    {
        $usuario = $request->user();
        $esAdmin = $usuario->hasRole('admin');

        $roles = array_values(array_filter(
            EntregaTurnoSeguridad::ROLES_DE_CIERRE,
            static fn (string $rol): bool => $esAdmin || $usuario->hasRole($rol),
        ));

        if ($roles === []) {
            return response()->json(['data' => []]);
        }

        $relevos = EntregaTurnoSeguridad::activas()
            ->with(['usuario:id,name', 'firmas'])
            ->where(function (Builder $query) use ($roles): void {
                foreach ($roles as $rol) {
                    $query->orWhereDoesntHave(
                        'firmas',
                        static fn (Builder $firma): Builder => $firma->where('firmables.rol', $rol)
                    );
                }
            })
            ->orderBy('fecha_hora')
            ->orderBy('id')
            ->get()
            ->map(static fn (EntregaTurnoSeguridad $relevo): array => [
                'id' => $relevo->id,
                'nombre' => $relevo->usuario?->name ?? '',
                'fecha' => $relevo->fecha_hora->toDateString(),
                'hora' => $relevo->fecha_hora->format('H:i'),
                'falta' => array_values(array_intersect($relevo->firmasFaltantes(), $roles)),
            ])
            ->all();

        return response()->json(['data' => $relevos]);
    }

    public function show(int $id): JsonResponse
    {
        $relevo = EntregaTurnoSeguridad::activas()
            ->with(['usuario:id,name', 'firmas'])
            ->find($id);

        if ($relevo === null) {
            return response()->json(['message' => 'El relevo no existe.'], 404);
        }

        return response()->json(['data' => $this->detalle($relevo)]);
    }

    public function update(UpdateEntregaTurnoSeguridadRequest $request, int $id): JsonResponse
    {
        $usuario = $request->user();

        if (! $usuario->hasAnyRole(['fbo', 'jefe_area', 'admin'])) {
            return response()->json([
                'message' => 'Solo el jefe de área, el FBO y el administrador pueden editar un relevo.',
            ], 403);
        }

        $relevo = EntregaTurnoSeguridad::activas()->with('firmas')->find($id);

        if ($relevo === null) {
            return response()->json(['message' => 'El relevo no existe.'], 404);
        }

        $validado = $request->validated();
        $firmaEntrega = $validado['firma_quien_entrega'] ?? null;
        $firmaJefe = $validado['firma_jefe_area'] ?? null;
        $firmaFbo = $validado['firma_fbo'] ?? null;
        unset($validado['firma_quien_entrega'], $validado['firma_jefe_area'], $validado['firma_fbo']);

        /*
         * Tener permiso para EDITAR no es tener permiso para firmar por otro.
         * Sin esta guardia, un jefe de área podría poner la firma del FBO y
         * cerrar el relevo él solo, que es justo lo que las tres firmas
         * vienen a impedir.
         */
        $esAdmin = $usuario->hasRole('admin');

        /*
         * Una cadena vacía es el «no firmé» que `guardarFirmaBase64` ignora:
         * los tres guardias juzgan lo mismo que ese método, o sea que solo
         * cuenta como intento de firmar lo que trae contenido.
         */
        $intentaJefe = is_string($firmaJefe) && trim($firmaJefe) !== '';
        $intentaFbo = is_string($firmaFbo) && trim($firmaFbo) !== '';
        $intentaEntrega = is_string($firmaEntrega) && trim($firmaEntrega) !== '';

        if ($intentaJefe && ! $esAdmin && ! $usuario->hasRole(EntregaTurnoSeguridad::ROL_JEFE_AREA)) {
            return response()->json(['message' => 'Solo el jefe de área puede poner su firma.'], 403);
        }

        if ($intentaFbo && ! $esAdmin && ! $usuario->hasRole(EntregaTurnoSeguridad::ROL_FBO)) {
            return response()->json(['message' => 'Solo el FBO puede poner su firma.'], 403);
        }

        /*
         * Reponer la firma de quien entrega RETIRA la original, así que sin
         * esta guardia cualquier editor sustituiría en silencio la firma de
         * quien entregó el turno. Va después del `find` porque necesita al
         * dueño del relevo.
         */
        if ($intentaEntrega && ! $esAdmin && $relevo->user_id !== $usuario->id) {
            return response()->json([
                'message' => 'Solo quien entregó el turno o el administrador puede reponer su firma.',
            ], 403);
        }

        /*
         * Un relevo con las tres firmas es un documento que describe UN día:
         * si cambiara de día, `fecha` diría hoy y las cifras congeladas
         * seguirían siendo las de ayer. Cambiar la hora dentro del mismo día
         * sí se permite, y cambiar el día de un relevo sin congelar también
         * (así se firman desde la cola los relevos viejos).
         */
        if (
            $relevo->resumen !== null
            && isset($validado['fecha_hora'])
            && VentanasDeFecha::diaQueGuardaElModelo($validado['fecha_hora']) !== $relevo->fecha_hora->toDateString()
        ) {
            return response()->json([
                'message' => 'Un relevo ya firmado por los tres no puede cambiar de día.',
            ], 422);
        }

        DB::transaction(function () use ($relevo, $validado, $firmaEntrega, $firmaJefe, $firmaFbo): void {
            if ($validado !== []) {
                $relevo->update($validado);
            }

            if (is_string($firmaEntrega)) {
                $this->guardarFirmaBase64($firmaEntrega, EntregaTurnoSeguridad::ROL_QUIEN_ENTREGA, $relevo);
            }

            if (is_string($firmaJefe)) {
                $this->guardarFirmaBase64($firmaJefe, EntregaTurnoSeguridad::ROL_JEFE_AREA, $relevo);
            }

            if (is_string($firmaFbo)) {
                $this->guardarFirmaBase64($firmaFbo, EntregaTurnoSeguridad::ROL_FBO, $relevo);
            }

            $this->congelarSiCerro($relevo);
        });

        return response()->json([
            'message' => 'Relevo actualizado correctamente',
            'data' => $this->detalle($relevo->fresh()->load(['usuario:id,name', 'firmas'])),
        ]);
    }

    /**
     * Guarda el resumen del día en cuanto el relevo queda cerrado.
     *
     * Se llama DESPUÉS de adjuntar las firmas y dentro de la misma
     * transacción. El `load` es obligatorio y no redundante: `update` trae el relevo con las
     * firmas ya cargadas, y sin él la colección sería la de antes de adjuntar.
     *
     * No recalcula lo ya congelado. Un relevo cerrado es un documento:
     * reponer una firma no cambia el día que describe.
     */
    private function congelarSiCerro(EntregaTurnoSeguridad $relevo): void
    {
        if ($relevo->resumen !== null) {
            return;
        }

        $relevo->load('firmas');

        if (! $relevo->estaCerrado()) {
            return;
        }

        $relevo->update(['resumen' => ResumenDelDiaSeguridad::para($relevo->fecha_hora)]);
    }

    public function eliminar(Request $request, int $id): JsonResponse
    {
        if (! $request->user()->hasAnyRole(['fbo', 'jefe_area', 'admin'])) {
            return response()->json([
                'message' => 'Solo el jefe de área, el FBO y el administrador pueden eliminar un relevo.',
            ], 403);
        }

        $relevo = EntregaTurnoSeguridad::activas()->find($id);

        if ($relevo === null) {
            return response()->json(['message' => 'El relevo no existe.'], 404);
        }

        $relevo->update(['status' => 'N']);

        return response()->json(['message' => 'Relevo eliminado correctamente']);
    }

    /**
     * El relevo como lo espera la pantalla: el nombre resuelto, el día y la
     * hora por separado en 24 horas, y las firmas con su URL.
     *
     * Las firmas cuyo archivo ya no está en el disco se omiten en vez de
     * devolver una URL muerta que el navegador pintaría como imagen rota.
     *
     * @return array<string, mixed>
     */
    private function detalle(EntregaTurnoSeguridad $relevo): array
    {
        $firmas = $relevo->firmas
            ->filter(static fn (Firma $firma): bool => Storage::disk($firma->disk ?? 'public')->exists($firma->path))
            ->map(static fn (Firma $firma): array => [
                'id' => $firma->id,
                'rol' => $firma->pivot->rol,
                'tag' => $firma->pivot->tag,
                'orden' => $firma->pivot->orden,
                'url' => $firma->url(),
            ])
            ->values()
            ->all();

        return [
            'id' => $relevo->id,
            'nombre' => $relevo->usuario?->name ?? '',
            'fecha' => $relevo->fecha_hora->toDateString(),
            'hora' => $relevo->fecha_hora->format('H:i'),
            'fecha_hora' => $relevo->fecha_hora->format('Y-m-d H:i:s'),
            'resumen' => [
                /*
                 * `congelado` sale de si la columna tiene algo, no de un
                 * campo dentro del JSON: un relevo cerrado guarda sus
                 * renglones y deja de consultar; uno abierto los recalcula
                 * en cada lectura y sus números crecen con el día.
                 */
                'congelado' => $relevo->resumen !== null,
                'renglones' => $relevo->resumen ?? ResumenDelDiaSeguridad::para($relevo->fecha_hora),
            ],
            'observaciones' => $relevo->observaciones,
            'firmas' => $firmas,
        ];
    }
}
