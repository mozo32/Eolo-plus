<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Imagen;
use App\Models\Remision;
use App\Models\SumaAutotanque;
use App\Models\TurnoAutotanque;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class TurnoAutotanqueController extends Controller
{
    public function store(Request $request)
    {
        $rutasGuardadas = [];
        $rutasAEliminar = [];

        try {
            $validated = $request->validate([
                'id' => 'nullable|integer',
                'nombre' => 'required|string',
                'fecha' => 'required|date',
                'cmIni' => 'required|numeric',
                'litrosIni' => 'required|numeric',
                'totalizadorIni' => 'required|numeric',
                'nombreCierre' => 'nullable|string',
                'fechaCierre' => 'nullable|date',
                'cmCierre' => 'nullable|numeric',
                'litrosCierre' => 'nullable|numeric',
                'totalizadorCierre' => 'nullable|numeric',
                'resumen.totalVendidos' => 'required|numeric',
                'resumen.totalSuman' => 'nullable|numeric',
                'resumen.balanceAritmetico' => 'required|numeric',
                'resumen.balanceFisico' => 'required|numeric',
                'resumen.diferenciaFinal' => 'required|numeric',
                'remisiones' => 'nullable|array',
                'remisiones.*.id' => 'nullable',
                'remisiones.*.folio' => 'required|string',
                'remisiones.*.litros' => 'nullable|numeric',
                'remisiones.*.isCancelled' => 'nullable|boolean',
                'entradasASA' => 'nullable|array',
                'entradasASA.*.id' => 'nullable|integer',
                'entradasASA.*.litros' => 'required|numeric',
                'entradasASA.*.remision' => 'required|string|max:50',
                'entradasASA.*.tomaFisicaCm' => 'nullable|numeric|min:0|max:138',
                'entradasASA.*.tomaFisicaLitros' => 'nullable|numeric|min:0',
                'entradasASA.*.evidencias' => 'nullable|array',
                'entradasASA.*.evidencias.*' => 'image|mimes:jpg,jpeg,png,webp|max:10240',
            ]);

            $turno = DB::transaction(function () use (
                $validated,
                $request,
                &$rutasGuardadas,
                &$rutasAEliminar
            ) {
                $turno = TurnoAutotanque::updateOrCreate(
                    [
                        'id' => $request->id,
                    ],
                    [
                        'user_id' => Auth::id(),
                        'nombre' => $validated['nombre'],
                        'fecha' => $validated['fecha'],
                        'cmIni' => $validated['cmIni'],
                        'litrosIni' => $validated['litrosIni'],
                        'totalizadorIni' => $validated['totalizadorIni'],
                        'nombreCierre' => $validated['nombreCierre'] ?? '',
                        'fechaCierre' => $validated['fechaCierre'] ?? now(),
                        'cmCierre' => $validated['cmCierre'] ?? 0,
                        'litrosCierre' => $validated['litrosCierre'] ?? 0,
                        'totalizadorCierre' => $validated['totalizadorCierre'] ?? 0,
                        'totalVendidos' => $validated['resumen']['totalVendidos'],
                        'balanceAritmetico' => $validated['resumen']['balanceAritmetico'],
                        'balanceFisico' => $validated['resumen']['balanceFisico'],
                        'diferenciaFinal' => $validated['resumen']['diferenciaFinal'],
                    ],
                );

                $remisiones = $validated['remisiones'] ?? [];

                if (!empty($remisiones)) {
                    $folios = collect($remisiones)
                        ->pluck('folio')
                        ->filter()
                        ->values();

                    if ($folios->isNotEmpty()) {
                        Remision::whereIn(
                            'folio',
                            $folios,
                        )->update([
                            'id_turno' => $turno->id,
                        ]);
                    }
                }

                $precio = DB::connection('remota')
                    ->table('tb_combustible')
                    ->value('pasa');

                $precio = $precio
                    ? (float) $precio
                    : 0;

                $sumasExistentes = SumaAutotanque::where(
                    'id_turno',
                    $turno->id,
                )
                    ->get()
                    ->keyBy('id');

                $entradas = $validated['entradasASA'] ?? [];

                foreach ($entradas as $index => $entrada) {
                    $idEntrada = isset($entrada['id'])
                        ? (int) $entrada['id']
                        : null;

                    if ($idEntrada) {
                        $suma = $sumasExistentes->get(
                            $idEntrada,
                        );

                        if (!$suma) {
                            throw new \RuntimeException(
                                'La entrada ASA indicada no pertenece al turno actual.',
                            );
                        }

                        $sumasExistentes->forget(
                            $idEntrada,
                        );
                    } else {
                        $suma = new SumaAutotanque();
                        $suma->id_turno = $turno->id;
                    }

                    $suma->litros = $entrada['litros'];
                    $suma->costo = $precio;
                    $suma->folio = $entrada['remision'];

                    $suma->toma_fisica_cm =
                        $entrada['tomaFisicaCm'] ??
                        null;

                    $suma->toma_fisica_litros =
                        $entrada['tomaFisicaLitros'] ??
                        null;

                    $suma->save();

                    $archivos = $request->file(
                        "entradasASA.{$index}.evidencias",
                        [],
                    );

                    if (!is_array($archivos)) {
                        $archivos = [$archivos];
                    }

                    $ultimoOrden = $suma
                        ->imagenes()
                        ->max('imageables.orden');

                    $ordenInicial = $ultimoOrden === null
                        ? 0
                        : ((int) $ultimoOrden + 1);

                    foreach ($archivos as $orden => $archivo) {
                        if (
                            !$archivo instanceof UploadedFile
                        ) {
                            continue;
                        }

                        $imagen = $this->guardarImagenSubida(
                            $archivo,
                            "autotanque/sumas/{$suma->id}",
                            $rutasGuardadas,
                        );

                        $suma->imagenes()->attach(
                            $imagen->id,
                            [
                                'tag' => 'evidencia',
                                'observacion' => null,
                                'alerta' => false,
                                'orden' => $ordenInicial + $orden,
                                'status' => 'A',
                            ],
                        );
                    }
                }

                foreach ($sumasExistentes as $sumaEliminar) {
                    $sumaEliminar->load('imagenes');

                    foreach ($sumaEliminar->imagenes as $imagen) {
                        $rutasAEliminar[] = [
                            'disk' => $imagen->disk ?? 'public',
                            'path' => $imagen->path,
                        ];

                        $sumaEliminar
                            ->imagenes()
                            ->detach(
                                $imagen->id,
                            );

                        $imagen->delete();
                    }

                    $sumaEliminar->delete();
                }

                return $turno;
            });

            foreach ($rutasAEliminar as $archivoEliminar) {
                if (
                    !empty(
                        $archivoEliminar['path']
                    )
                ) {
                    Storage::disk(
                        $archivoEliminar['disk'],
                    )->delete(
                        $archivoEliminar['path'],
                    );
                }
            }

            $sumas = SumaAutotanque::where(
                'id_turno',
                $turno->id,
            )
                ->with('imagenes')
                ->get();

            return response()->json([
                'message' => $request->id
                    ? 'Turno actualizado correctamente'
                    : 'Turno creado correctamente',
                'data' => $turno,
                'sumaAutotanque' => $sumas,
            ], 201);
        } catch (\Throwable $e) {
            if (!empty($rutasGuardadas)) {
                Storage::disk('public')
                    ->delete(
                        $rutasGuardadas,
                    );
            }

            return response()->json([
                'message' => 'Error al procesar el turno',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function checkActiveTurno()
    {
        try {
            $turnoActivo = TurnoAutotanque::where(
                function ($query) {
                    $query
                        ->whereNull(
                            'totalizadorCierre',
                        )
                        ->orWhere(
                            'nombreCierre',
                            '',
                        )
                        ->orWhereNull(
                            'fechaCierre',
                        )
                        ->orWhere(
                            'fechaCierre',
                            '',
                        )
                        ->orWhereNull(
                            'cmCierre',
                        )
                        ->orWhere(
                            'cmCierre',
                            0,
                        )
                        ->orWhereNull(
                            'litrosCierre',
                        )
                        ->orWhere(
                            'litrosCierre',
                            0,
                        )
                        ->orWhereNull(
                            'totalizadorCierre',
                        )
                        ->orWhere(
                            'totalizadorCierre',
                            0,
                        );
                },
            )
                ->where('status', 'A')
                ->latest()
                ->first();

            if (!$turnoActivo) {
                return response()->json([
                    'active' => false,
                ]);
            }

            $remision = Remision::where(
                'id_turno',
                $turnoActivo->id,
            )->get();

            $sumaAutotanque = SumaAutotanque::with(
                'imagenes',
            )
                ->where(
                    'id_turno',
                    $turnoActivo->id,
                )
                ->get();

            return response()->json([
                'active' => true,
                'data' => [
                    'turno' => $turnoActivo,
                    'remision' => $remision,
                    'sumaAutotanque' => $sumaAutotanque,
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function getLastTotalizador()
    {
        $ultimoTurno = TurnoAutotanque::latest(
            'id',
        )->first();

        return response()->json([
            'totalizador' => $ultimoTurno
                ? $ultimoTurno->totalizadorCierre
                : null,
        ]);
    }

    public function cancelarRemision(
        Request $request,
        $folio,
    ) {
        try {
            $remision = Remision::where(
                'id',
                $folio,
            )->first();

            if (!$remision) {
                return response()->json([
                    'error' => 'Remisión no encontrada: ' . $folio,
                ], 404);
            }

            $remision->update([
                'status' => 'N',
            ]);

            return response()->json([
                'message' => 'Remisión cancelada correctamente',
                'folio' => $folio,
            ], 200);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'No se pudo cancelar la remisión',
                'details' => $e->getMessage(),
            ], 500);
        }
    }

    public function index(Request $request)
    {
        $id = $request->query('id');
        $responsable = $request->query(
            'responsable',
        );
        $estado = $request->query(
            'estado',
        );
        $inspeccion = $request->query(
            'inspeccion',
        );
        $diferencia = $request->query(
            'diferencia',
        );
        $start = $request->query(
            'start',
        );
        $end = $request->query(
            'end',
        );
        $perPage = $request->query(
            'per_page',
            15,
        );

        $query = TurnoAutotanque::query()
            ->with(
                'inspeccion:id,turno_autotanque_id',
            )
            ->where(
                'status',
                'A',
            );

        $query->when(
            $id,
            function ($q, $id) {
                $q->where(
                    'id',
                    $id,
                );
            },
        );

        $query->when(
            $responsable,
            function ($q, $responsable) {
                $q->where(
                    function ($sub) use (
                        $responsable
                    ) {
                        $sub
                            ->where(
                                'nombre',
                                'like',
                                "%{$responsable}%",
                            )
                            ->orWhere(
                                'nombreCierre',
                                'like',
                                "%{$responsable}%",
                            );
                    },
                );
            },
        );

        $query->when(
            $start && $end,
            function ($q) use (
                $start,
                $end
            ) {
                if ($start === $end) {
                    $q->whereDate(
                        'fecha',
                        $start,
                    );
                } else {
                    $q->whereBetween(
                        'fecha',
                        [
                            $start . ' 00:00:00',
                            $end . ' 23:59:59',
                        ],
                    );
                }
            },
        );

        $query->when(
            $diferencia !== null &&
                $diferencia !== '',
            function (
                $q,
                $diferencia
            ) {
                $q->where(
                    'diferenciaFinal',
                    'like',
                    "%{$diferencia}%",
                );
            },
        );

        $turnos = $query
            ->orderBy(
                'id',
                'desc',
            )
            ->paginate(
                $perPage,
            );

        $turnos
            ->getCollection()
            ->transform(
                function ($turno) {
                    $turno->tiene_inspeccion =
                        $turno->inspeccion !==
                        null;

                    unset(
                        $turno->inspeccion,
                    );

                    $turno->finalizado =
                        !empty(
                            $turno->nombreCierre
                        ) &&
                        !empty(
                            $turno->fechaCierre
                        ) &&
                        $turno->cmCierre !==
                            null &&
                        $turno->litrosCierre !==
                            null &&
                        $turno->totalizadorCierre !==
                            null;

                    return $turno;
                },
            );

        if (
            $estado !== null &&
            $estado !== ''
        ) {
            $filtered = $turnos
                ->getCollection()
                ->filter(
                    function ($item) use (
                        $estado
                    ) {
                        return $item->finalizado ==
                            $estado;
                    },
                );

            $turnos->setCollection(
                $filtered->values(),
            );
        }

        if (
            $inspeccion !== null &&
            $inspeccion !== ''
        ) {
            $filtered = $turnos
                ->getCollection()
                ->filter(
                    function ($item) use (
                        $inspeccion
                    ) {
                        return $item->tiene_inspeccion ==
                            $inspeccion;
                    },
                );

            $turnos->setCollection(
                $filtered->values(),
            );
        }

        return response()->json(
            $turnos,
        );
    }

    public function show($id)
    {
        $turno = TurnoAutotanque::with([
            'inspeccion.firmas',
            'inspeccion.imagenes',
        ])
            ->where(
                'id',
                $id,
            )
            ->first();

        if (!$turno) {
            return response()->json([
                'message' => 'Registro no encontrado',
            ], 404);
        }

        $remision = Remision::where(
            'id_turno',
            $id,
        )->get();

        $sumaAutotanque = SumaAutotanque::with(
            'imagenes',
        )
            ->where(
                'id_turno',
                $id,
            )
            ->get();

        $inspeccionData = null;

        if ($turno->inspeccion) {
            $inspeccion =
                $turno->inspeccion;

            $inspeccion->firmas->map(
                function ($firma) {
                    $firma->url =
                        Storage::url(
                            $firma->path,
                        );

                    return $firma;
                },
            );

            $inspeccion->imagenes->map(
                function ($imagen) {
                    $imagen->url =
                        Storage::url(
                            $imagen->path,
                        );

                    return $imagen;
                },
            );

            $inspeccionData =
                $inspeccion;
        }

        return response()->json([
            'message' => 'Se encontró el registro',
            'data' => [
                'turno' => $turno,
                'remision' => $remision,
                'sumaAutotanque' => $sumaAutotanque,
                'inspeccion' => $inspeccionData,
            ],
        ]);
    }

    public function eliminar($id)
    {
        try {
            $autotanque = TurnoAutotanque::with(
                'inspeccion',
            )->find(
                $id,
            );

            if (!$autotanque) {
                return response()->json([
                    'message' => 'El registro no existe.',
                ], 404);
            }

            DB::transaction(
                function () use (
                    $autotanque,
                    $id
                ) {
                    $autotanque->update([
                        'status' => 'N',
                    ]);

                    Remision::where(
                        'id_turno',
                        $id,
                    )->update([
                        'status' => 'N',
                    ]);

                    if (
                        $autotanque->inspeccion
                    ) {
                        $autotanque
                            ->inspeccion
                            ->update([
                                'status' => 'N',
                            ]);
                    }
                },
            );

            return response()->json([
                'message' => 'Registro, remisiones e inspección cancelados correctamente',
                'data' => $autotanque,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Error al intentar eliminar el registro',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function obtenerExcel(
        Request $request,
    ) {
        $id = $request->query('id');

        $responsable = $request->query(
            'responsable',
        );

        $estado = $request->query(
            'estado',
        );

        $inspeccion = $request->query(
            'inspeccion',
        );

        $diferencia = $request->query(
            'diferencia',
        );

        $start = $request->query(
            'fechaInicio',
        );

        $end = $request->query(
            'fechaFin',
        );

        $query = TurnoAutotanque::query()
            ->with(
                'inspeccion:id,turno_autotanque_id',
            )
            ->where(
                'status',
                'A',
            );

        $query->when(
            $id,
            function ($q, $id) {
                $q->where(
                    'id',
                    $id,
                );
            },
        );

        $query->when(
            $responsable,
            function ($q, $responsable) {
                $q->where(
                    function ($sub) use (
                        $responsable
                    ) {
                        $sub
                            ->where(
                                'nombre',
                                'like',
                                "%{$responsable}%",
                            )
                            ->orWhere(
                                'nombreCierre',
                                'like',
                                "%{$responsable}%",
                            );
                    },
                );
            },
        );

        $query->when(
            $start && $end,
            function ($q) use (
                $start,
                $end
            ) {
                if ($start === $end) {
                    $q->whereDate(
                        'fecha',
                        $start,
                    );
                } else {
                    $q->whereBetween(
                        'fecha',
                        [
                            $start . ' 00:00:00',
                            $end . ' 23:59:59',
                        ],
                    );
                }
            },
        );

        $query->when(
            $diferencia !== null &&
                $diferencia !== '',
            function (
                $q,
                $diferencia
            ) {
                $q->where(
                    'diferenciaFinal',
                    'like',
                    "%{$diferencia}%",
                );
            },
        );

        $turnos = $query
            ->orderBy(
                'fecha',
                'asc',
            )
            ->get();

        $turnos->transform(
            function ($turno) {
                $turno->tiene_inspeccion =
                    $turno->inspeccion !==
                    null;

                unset(
                    $turno->inspeccion,
                );

                $turno->finalizado =
                    !empty(
                        $turno->nombreCierre
                    ) &&
                    !empty(
                        $turno->fechaCierre
                    ) &&
                    $turno->cmCierre !==
                        null &&
                    $turno->litrosCierre !==
                        null &&
                    $turno->totalizadorCierre !==
                        null;

                return $turno;
            },
        );

        if (
            $estado !== null &&
            $estado !== ''
        ) {
            $turnos = $turnos
                ->filter(
                    function ($item) use (
                        $estado
                    ) {
                        return $item->finalizado ==
                            $estado;
                    },
                )
                ->values();
        }

        if (
            $inspeccion !== null &&
            $inspeccion !== ''
        ) {
            $turnos = $turnos
                ->filter(
                    function ($item) use (
                        $inspeccion
                    ) {
                        return $item->tiene_inspeccion ==
                            $inspeccion;
                    },
                )
                ->values();
        }

        return response()->json(
            $turnos,
        );
    }

    private function guardarImagenSubida(
        UploadedFile $archivo,
        string $folder,
        array &$rutasGuardadas
    ): Imagen {
        $path = $archivo->store(
            $folder,
            'public',
        );

        if (!$path) {
            throw new \RuntimeException(
                'No fue posible guardar una de las evidencias fotográficas.',
            );
        }

        $rutasGuardadas[] = $path;

        return Imagen::create([
            'disk' => 'public',
            'path' => $path,
            'original_name' => $archivo->getClientOriginalName(),
            'mime' => $archivo->getMimeType() ?? 'image/jpeg',
            'size' => (int) $archivo->getSize(),
        ]);
    }
}
