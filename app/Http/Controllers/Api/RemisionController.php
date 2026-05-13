<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Remision;
use App\Models\PaymentMethod;
use App\Models\OperacionDiaria;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;
use App\Models\Firma;
use App\Models\SumaAutotanque;
use Illuminate\Support\Facades\Mail;
use App\Mail\RemisionMail;
use Illuminate\Http\JsonResponse;
use App\Models\TurnoAutotanque;

class RemisionController extends Controller
{
    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'fecha'          => 'required|date',
                'operador'       => 'required|string',
                'cliente'        => 'required|string',
                'formaPago'      => 'nullable|string',
                'matricula'      => 'required|string',
                'horaLlegada'    => 'required|string|max:5',
                'lecturaInicial' => 'required|numeric',
                'lecturaFinal'   => 'required|numeric',
            ]);

            return DB::transaction(function () use ($request) {
                $ultimoId = Remision::max('id') ?? 0;
                $nuevoFolio = "EOLO-" . str_pad($ultimoId + 1, 4, '0', STR_PAD_LEFT);

                $precio = DB::connection('remota')
                    ->table('tb_combustible')
                    ->value('p_combustible');

                if (!$precio) {
                    $precio = 0;
                }

                $remision = Remision::create([
                    'folio'           => $nuevoFolio,
                    'fecha'           => $request->fecha,
                    'operador'        => $request->operador,
                    'cliente'         => $request->cliente,
                    'presionDif'     => $request->presionDif,
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
                    'precio'          => $precio,
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
        $perPage = $request->query('per_page', 20);
        $vinculado = $request->boolean('vinculado');
        $start = $request->query('start');
        $end = $request->query('end');
        $type = $request->query('type', 'day');
        $folio = $request->query('folio');
        $matricula = $request->query('matricula');
        $litros = $request->query('cantidad');

        $queryRemisiones = DB::table('remisiones')
            ->select(
                'id', DB::raw("'R' as tipo"), 'matricula', 'folio', 'destino', 'created_at',
                'total_litros as litros', 'fecha', 'hora_llegada', 'id_turno'
            )
            ->where('status', 'A');

        $queryAutotanques = DB::table('sumas_autotanque')
            ->select(
                'id', DB::raw("'A' as tipo"), DB::raw("'ASA' as matricula"), 'folio', DB::raw("NULL as destino"),
                'created_at', 'litros', DB::raw("DATE(created_at) as fecha"),
                DB::raw("NULL as hora_llegada"), 'id_turno'
            );

        if (!$vinculado) {
            $queryRemisiones->whereNull('id_turno');
            $queryAutotanques->whereNull('id_turno');
        }
        $this->applyDateFilters($queryRemisiones, $type, $start, $end, $request, 'fecha');
        $this->applyDateFilters($queryAutotanques, $type, $start, $end, $request, 'created_at');

        if ($request->filled('folio')) {
            $queryRemisiones->where('folio', 'LIKE', '%' . $folio . '%');
            $queryAutotanques->where('folio', 'LIKE', '%' . $folio . '%');
        }

        if ($request->filled('matricula')) {
            $queryRemisiones->where('matricula', 'LIKE', '%' . $matricula . '%');
            if (strtoupper($matricula) !== 'ASA' && strpos('ASA', strtoupper($matricula)) === false) {
                $queryAutotanques->whereRaw('1 = 0');
            }
        }

        if ($request->filled('cantidad')) {
            $queryRemisiones->where('total_litros', '>=', $litros);
            $queryAutotanques->where('litros', '>=', $litros);
        }

        $finalQuery = $queryRemisiones->unionAll($queryAutotanques);

        $results = DB::table(DB::raw("({$finalQuery->toSql()}) as combined"))
            ->mergeBindings($finalQuery)
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        return response()->json($results);
    }

    public function obtenerExcel(Request $request)
    {
        $perPage = $request->query('per_page', 20);
        $vinculado = $request->boolean('vinculado');
        $start = $request->query('start');
        $end = $request->query('end');
        $type = $request->query('periodo', 'day');
        $folio = $request->query('folio');
        $matricula = $request->query('matricula');
        $litros = $request->query('cantidad');

        $queryRemisiones = DB::table('remisiones')
        ->select(
            DB::raw("'R' as tipo"),
            'folio',
            'fecha',
            'matricula',
            DB::raw("'' as vta"),
            DB::raw("'' as factura"),
            'precio as precio_venta',
            'total_litros as litros',
            DB::raw("(total_litros * precio) as importe"),
            'cliente',
            'forma_pago',
            DB::raw("MONTHNAME(fecha) as mes"),
            'status',
            'created_at',
            'id'
        )
        ->where('status', 'A');

        $queryAutotanques = DB::table('sumas_autotanque')
        ->select(
            DB::raw("'A' as tipo"),
            'folio',
            DB::raw("DATE(created_at) as fecha"),
            DB::raw("'ASA' as matricula"),
            DB::raw("'' as vta"),
            DB::raw("'' as factura"),
            'costo as precio_venta',
            'litros',
            DB::raw("(litros * costo) as importe"),
            DB::raw("'' as cliente"),
            DB::raw("'' as forma_pago"),
            DB::raw("'' as mes"),
            DB::raw("'Finalizado' as status"),
            'created_at',
            'id'
        );

        $this->applyDateFilters($queryRemisiones, $type, $start, $end, $request, 'fecha');
        $this->applyDateFilters($queryAutotanques, $type, $start, $end, $request, DB::raw('DATE(created_at)'));

        if ($request->filled('matricula')) {
            $mat = strtoupper($request->query('matricula'));
            $queryRemisiones->where('matricula', 'LIKE', '%' . $mat . '%');
            if (strpos('ASA', $mat) === false) {
                $queryAutotanques->whereRaw('1 = 0');
            }
        }

        if ($request->filled('cantidad')) {
            $queryRemisiones->where('total_litros', '>=', $litros);
            $queryAutotanques->where('litros', '>=', $litros);
        }

        $finalQuery = $queryRemisiones->unionAll($queryAutotanques);

        $results = DB::table(DB::raw("({$finalQuery->toSql()}) as combined"))
            ->mergeBindings($finalQuery)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($results);
    }

    private function applyDateFilters($query, $type, $start, $end, $request, $column)
    {
        switch ($type) {
            case 'range':
            case 'rango':
                if ($start && $end) {
                    $query->whereBetween($column, [$start, $end]);
                }
                break;

            case 'month':
            case 'mes':
                if ($start) {
                    $date = \Carbon\Carbon::parse($start);
                    $query->whereMonth($column, $date->month)
                        ->whereYear($column, $date->year);
                }
                break;

            case 'year':
            case 'año':
                if ($start) {
                    $query->whereYear($column, \Carbon\Carbon::parse($start)->year);
                }
                break;

            case 'day':
            case 'dia':
            default:
                $fecha = $start ?? $request->query('date') ?? now()->format('Y-m-d');
                $query->whereDate($column, $fecha);
                break;
        }
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
    public function show($id)
    {
        $remision = Remision::with('firmas')->find($id);

        if (!$remision) {
            return response()->json(['message' => 'Remisión no encontrada'], 404);
        }

        return response()->json($remision);
    }

    public function update(Request $request, $id)
    {
        try {
            $remision = Remision::findOrFail($id);

            $validated = $request->validate([
                'fecha'          => 'required|date',
                'operador'       => 'required|string',
                'cliente'        => 'required|string',
                'formaPago'      => 'nullable|string',
                'matricula'      => 'required|string',
                'horaLlegada'    => 'required|string|max:5',
                'lecturaInicial' => 'required|numeric',
                'lecturaFinal'   => 'required|numeric',
            ]);

            return DB::transaction(function () use ($request, $remision) {
                $remision->update([
                    'fecha'           => $request->fecha,
                    'operador'        => $request->operador,
                    'cliente'         => $request->cliente,
                    'presionDif'      => $request->presionDif,
                    'forma_pago'      => $request->formaPago,
                    'aeronave_tipo'   => $request->aeronaveTipo,
                    'matricula'       => $request->matricula,
                    'destino'         => $request->destino,
                    'hora_llegada'    => $request->horaLlegada,
                    'hora_inicial'    => $request->horaInicial,
                    'hora_final'      => $request->horaFinal,
                    'lectura_inicial' => $request->lecturaInicial,
                    'lectura_final'   => $request->lecturaFinal,
                    'total_litros'    => (float)$request->lecturaFinal - (float)$request->lecturaInicial ,
                ]);
                if ($request->filled('firmaCliente')) {
                    $this->guardarFirmaBase64($request->firmaCliente, 'cliente', $remision);
                }
                if ($request->filled('firmaOperador')) {
                    $this->guardarFirmaBase64($request->firmaOperador, 'operador', $remision);
                }

                return response()->json([
                    'message' => 'Remisión actualizada con éxito',
                    'data'    => $remision
                ]);
            });

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error al actualizar el registro',
                'error'   => $e->getMessage()
            ], 500);
        }
    }

    public function matriculaHora($matricula){
        $op = OperacionDiaria::where('matricula', $matricula)
                            ->where('tipo', 'llegada')
                            ->selectRaw("DATE_FORMAT(hora, '%H:%i') as hora")
                            ->orderBy('fecha', 'desc')
                            ->orderBy('hora', 'desc')
                            ->first();

        return response()->json($op);
    }

    public function ultimaLectura(){
        $rem = Remision::select('lectura_final', 'id')
                        ->latest()
                        ->first();
        return response()->json($rem);
    }
    public function enviarCorreo(Request $request) {
        $request->validate([
            'id' => 'required|exists:remisiones,id',
            'email' => 'required|email'
        ]);

        config([
            'mail.default' => 'smtp',
            'mail.mailers.smtp.host' => 'smtp.gmail.com',
            'mail.mailers.smtp.port' => 587,
            'mail.mailers.smtp.encryption' => 'tls',
            'mail.mailers.smtp.username' => 'mozorodriguez32@gmail.com',
            'mail.mailers.smtp.password' => 'truaoxrvmrxxsxnn',
            'mail.from.address' => 'mozorodriguez32@gmail.com',
            'mail.from.name' => 'Eolo Plus',
        ]);

        $remision = Remision::findOrFail($request->id);

        try {
            Mail::to($request->email)->send(new RemisionMail($remision));
            return response()->json(['message' => '¡Correo enviado con éxito a Gmail!']);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error de conexión con Gmail',
                'error' => $e->getMessage()
            ], 500);
        }
    }
    public function obtenerResponsablesPorMatricula(string $matricula): JsonResponse
    {
        $nombres = Remision::where('matricula', $matricula)
            ->whereNotNull('cliente')
            ->where('cliente', '!=', '')
            ->select(DB::raw('DISTINCT UPPER(TRIM(cliente)) as nombre_limpio'))
            ->pluck('nombre_limpio');
        return response()->json($nombres);
    }

    public function formaPago(){
        $rem = PaymentMethod::select('name', 'id')->get();

        return response()->json($rem);
    }

    public function combustibleAsa() {
        $ultimoRegistro = TurnoAutotanque::select('diferenciaFinal')->latest()->first();

        if ($ultimoRegistro) {
            return $ultimoRegistro;
        }

        return response()->json(['message' => 'No hay registros'], 404);
    }
}
