<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\EntregaTurnoSeguridad\StoreEntregaTurnoSeguridadRequest;
use App\Models\EntregaTurnoSeguridad;
use App\Models\Firma;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
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

    public function index(Request $request): JsonResponse
    {
        $porPagina = max(1, (int) $request->integer('per_page', 10));

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
     * Trae los registros con UNA consulta por rango y descarta en PHP los
     * días que no son de la página. Los días de una página son pocos y
     * cada uno tiene dos registros, así que sobra traer de más; la
     * alternativa sería un `IN` sobre la expresión del día, que no gana
     * nada y enreda la consulta.
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
            ->whereBetween('fecha_hora', [
                Carbon::parse(min($diasDeLaPagina))->startOfDay(),
                Carbon::parse(max($diasDeLaPagina))->endOfDay(),
            ])
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
     * @return list<string>
     */
    private function diasIncompletos(): array
    {
        return EntregaTurnoSeguridad::activas()
            ->whereDoesntHave(
                'firmas',
                static fn (Builder $firma): Builder => $firma->where('firmables.rol', EntregaTurnoSeguridad::ROL_FBO)
            )
            ->pluck('fecha_hora')
            ->map(static fn (Carbon $fecha): string => $fecha->toDateString())
            ->unique()
            ->values()
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
