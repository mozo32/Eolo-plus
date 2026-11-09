<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\EntregaTurnoSeguridad\IndexEntregaTurnoSeguridadRequest;
use App\Http\Requests\EntregaTurnoSeguridad\StoreEntregaTurnoSeguridadRequest;
use App\Http\Requests\EntregaTurnoSeguridad\UpdateEntregaTurnoSeguridadRequest;
use App\Models\EntregaTurnoSeguridad;
use App\Models\Firma;
use App\Support\ResumenDelDiaSeguridad;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class EntregaTurnoSeguridadController extends Controller
{
    /**
     * La expresión del día.
     *
     * Vive en una constante porque la usan el agrupamiento y el filtro por
     * estado, y tienen que ser la MISMA: si una dijera `DATE(fecha_hora)` y
     * la otra `fecha_hora`, el filtro excluiría horas en vez de días y
     * nadie lo notaría hasta que un día saliera a medias.
     */
    private const DIA = 'DATE(fecha_hora)';

    /** `consultaFiltrada()` sigue pidiendo un `Request`: un Form Request lo es. */
    public function index(IndexEntregaTurnoSeguridadRequest $request): JsonResponse
    {
        /*
         * El techo es tan necesario como el piso: sin él, un `per_page=100000`
         * pide cien mil días y arrastra toda la tabla con sus firmas.
         */
        $porPagina = min(100, max(1, (int) $request->integer('per_page', 10)));

        $dias = $this->consultaFiltrada($request)
            ->selectRaw(self::DIA.' as dia')
            ->groupBy('dia')
            ->orderByDesc('dia')
            ->paginate($porPagina);

        $diasDeLaPagina = array_map(
            static fn (mixed $fila): string => (string) (is_array($fila) ? $fila['dia'] : $fila->dia),
            $dias->items()
        );

        return response()->json([
            'data' => $this->filasDeLosDias($diasDeLaPagina),
            'meta' => [
                'current_page' => $dias->currentPage(),
                'last_page' => $dias->lastPage(),
                'per_page' => $dias->perPage(),
                'total' => $dias->total(),
            ],
        ]);
    }

    /**
     * Un renglón por día, con sus dos secciones.
     *
     * Pide exactamente los días de la página con un `IN` sobre la misma
     * expresión del día que usa el agrupamiento.
     *
     * NO se usa un rango entre el día más viejo y el más nuevo. Parecía
     * más simple, pero con un filtro disperso —un buscador que acierte un
     * día por mes— una página de diez días abarca casi un año y trae
     * cientos de registros para pintar diez renglones.
     *
     * @param  list<string>  $diasDeLaPagina
     * @return list<array{fecha: string, frente: ?array, atras: ?array}>
     */
    private function filasDeLosDias(array $diasDeLaPagina): array
    {
        if ($diasDeLaPagina === []) {
            return [];
        }

        $registros = EntregaTurnoSeguridad::activas()
            ->with(['usuario:id,name', 'firmas'])
            ->whereIn(DB::raw(self::DIA), $diasDeLaPagina)
            ->get()
            ->groupBy(
                static fn (EntregaTurnoSeguridad $relevo): string => $relevo->fecha_hora->toDateString()
            );

        return array_map(
            fn (string $dia): array => [
                'fecha' => $dia,
                'frente' => $this->seccionDelDia($registros->get($dia, collect()), EntregaTurnoSeguridad::SECCION_FRENTE),
                'atras' => $this->seccionDelDia($registros->get($dia, collect()), EntregaTurnoSeguridad::SECCION_ATRAS),
            ],
            $diasDeLaPagina
        );
    }

    /**
     * Lo que se enseña de una sección, o null si ese puesto no entregó.
     *
     * Con más de un registro de la misma sección ese día devuelve el MÁS
     * RECIENTE y cuenta los demás en `extras`. No se descarta ninguno: la
     * tabla no tiene candado de uno por día y sección a propósito.
     *
     * @param  Collection<int, EntregaTurnoSeguridad>  $delDia
     * @return array{id: int, nombre: string, hora: string, firmado_fbo: bool, pernocta_mensual: string, extras: int}|null
     */
    private function seccionDelDia(Collection $delDia, string $seccion): ?array
    {
        $deLaSeccion = $delDia->where('seccion', $seccion)->sortByDesc('fecha_hora')->values();

        if ($deLaSeccion->isEmpty()) {
            return null;
        }

        /** @var EntregaTurnoSeguridad $reciente */
        $reciente = $deLaSeccion->first();

        return [
            'id' => $reciente->id,
            'nombre' => $reciente->usuario?->name ?? '',
            'hora' => $reciente->fecha_hora->format('H:i'),
            'firmado_fbo' => $reciente->tieneFirmaDe(EntregaTurnoSeguridad::ROL_FBO),
            'pernocta_mensual' => $reciente->pernocta_mensual,
            'extras' => $deLaSeccion->count() - 1,
        ];
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

        if ($request->filled('seccion')) {
            $query->where('seccion', $request->string('seccion')->toString());
        }

        if ($request->filled('fecha_inicio')) {
            $query->whereDate('fecha_hora', '>=', $request->string('fecha_inicio')->toString());
        }

        if ($request->filled('fecha_fin')) {
            $query->whereDate('fecha_hora', '<=', $request->string('fecha_fin')->toString());
        }

        $estado = $request->string('estado')->toString();

        if ($estado === 'falta_fbo') {
            $query->whereIn(DB::raw(self::DIA), $this->diasIncompletos());
        }

        if ($estado === 'completas') {
            $query->whereNotIn(DB::raw(self::DIA), $this->diasIncompletos());
        }

        return $query;
    }

    /**
     * Los días que tienen al menos un registro sin la firma del FBO.
     *
     * Se calcula por DÍA y no por registro porque el estado es del día: un
     * día en que el frente firmó y el de atrás no está incompleto, y un
     * filtro por registro lo daría por completo a través del frente.
     *
     * La base agrupa y devuelve días, no fechas completas: traer un renglón
     * por registro sin firmar y deduplicar en PHP crecía sin tope con el
     * historial, y en un mes en que el FBO se atrasara serían sesenta
     * valores para distinguir treinta días.
     *
     * @return list<string>
     */
    private function diasIncompletos(): array
    {
        return EntregaTurnoSeguridad::activas()
            ->whereDoesntHave(
                'firmas',
                static fn (Builder $firma): Builder => $firma->where('firmables.rol', EntregaTurnoSeguridad::ROL_FBO)
            )
            ->selectRaw(self::DIA.' as dia')
            ->distinct()
            ->pluck('dia')
            ->all();
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
     * Los relevos a los que les falta la firma del FBO.
     *
     * De lo más viejo a lo más nuevo a propósito: es una cola de trabajo, y
     * lo que lleva días sin firmar es lo que corre prisa.
     */
    public function pendientes(): JsonResponse
    {
        $relevos = EntregaTurnoSeguridad::activas()
            ->with('usuario:id,name')
            ->whereDoesntHave(
                'firmas',
                static fn (Builder $firma): Builder => $firma->where('firmables.rol', EntregaTurnoSeguridad::ROL_FBO)
            )
            ->orderBy('fecha_hora')
            ->orderBy('id')
            ->get()
            ->map(static fn (EntregaTurnoSeguridad $relevo): array => [
                'id' => $relevo->id,
                'nombre' => $relevo->usuario?->name ?? '',
                'fecha' => $relevo->fecha_hora->toDateString(),
                'hora' => $relevo->fecha_hora->format('H:i'),
                'seccion' => $relevo->seccion,
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

        if (is_string($firmaJefe) && ! $esAdmin && ! $usuario->hasRole(EntregaTurnoSeguridad::ROL_JEFE_AREA)) {
            return response()->json(['message' => 'Solo el jefe de área puede poner su firma.'], 403);
        }

        if (is_string($firmaFbo) && ! $esAdmin && ! $usuario->hasRole(EntregaTurnoSeguridad::ROL_FBO)) {
            return response()->json(['message' => 'Solo el FBO puede poner su firma.'], 403);
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
     * transacción. El `load` es obligatorio: la relación que trae el modelo
     * es la de antes de adjuntar, así que sin releerla la firma recién
     * puesta no contaría y el relevo nunca se cerraría.
     * El `load` es obligatorio y no redundante: `update` trae el relevo con las
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
            'seccion' => $relevo->seccion,
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
