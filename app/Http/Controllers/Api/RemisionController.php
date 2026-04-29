<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Remision;
use App\Models\OperacionDiaria;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;
use App\Models\Firma;
use Illuminate\Support\Facades\Mail;
use App\Mail\RemisionMail;
use Illuminate\Http\JsonResponse;

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
        $query = Remision::where('status', 'A');
        if (!$vinculado) {
            $query->whereNull('id_turno');
        }

        if ($request->filled('folio')) {
            $query->where('folio', 'LIKE', '%' . $request->query('folio') . '%');
        }

        if ($request->filled('matricula')) {
            $query->where('matricula', 'LIKE', '%' . $request->query('matricula') . '%');
        }

        if ($request->filled('cantidad')) {
            $query->where('total_litros', '>=', $request->query('cantidad'));
        }

        $type = $request->query('type', 'day');
        $start = $request->query('start');
        $end = $request->query('end');

        switch ($type) {
            case 'range':
            case 'rango':
                if ($start && $end) {
                    $query->whereBetween('fecha', [$start, $end]);
                }
                break;

            case 'month':
            case 'mes':
                if ($start) {
                    $date = \Carbon\Carbon::parse($start);
                    $query->whereMonth('fecha', $date->month)
                        ->whereYear('fecha', $date->year);
                }
                break;

            case 'year':
            case 'año':
                if ($start) {
                    $query->whereYear('fecha', \Carbon\Carbon::parse($start)->year);
                }
                break;

            case 'day':
            case 'dia':
            default:
                $fecha = $start ?? $request->query('date') ?? now()->format('Y-m-d');
                $query->whereDate('fecha', $fecha);
                break;
        }

        $remisiones = $query->orderBy('id', 'desc')->paginate($perPage);

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
                'formaPago'      => 'required|string',
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
    public function obtenerExcel(Request $request)
    {
        $query = Remision::where('status', 'A');

        if ($request->filled('buscar')) {
            $query->where('folio', 'LIKE', '%' . $request->query('buscar') . '%');
        }
        if ($request->filled('matricula')) {
            $query->where('matricula', 'LIKE', '%' . $request->query('matricula') . '%');
        }

        if ($request->filled('cantidad')) {
            $query->where('total_litros', '>=', $request->query('cantidad'));
        }

        $type = $request->query('periodo', 'dia');
        $start = $request->query('fechaInicio');
        $end = $request->query('fechaFin');

        switch ($type) {
            case 'range':
            case 'rango':
                if ($start && $end) {
                    $query->whereBetween('fecha', [$start, $end]);
                }
                break;

            case 'month':
            case 'mes':
                if ($start) {
                    $date = \Carbon\Carbon::parse($start);
                    $query->whereMonth('fecha', $date->month)
                        ->whereYear('fecha', $date->year);
                }
                break;

            case 'year':
            case 'año':
                if ($start) {
                    $query->whereYear('fecha', \Carbon\Carbon::parse($start)->year);
                }
                break;

            case 'day':
            case 'dia':
            default:
                $fecha = $start ?? $request->query('date') ?? now()->format('Y-m-d');
                $query->whereDate('fecha', $fecha);
                break;
        }

        $remisiones = $query->orderBy('id', 'desc')->get();

        $remisionesConDetalle = $remisiones->map(function ($remision) {
            $operacion = OperacionDiaria::where('matricula', $remision->matricula)
                ->select('tipo_cliente')
                ->latest('fecha')
                ->first();

            $remision->tipo_cliente = $operacion ? $operacion->tipo_cliente : 'N/A';
            return $remision;
        });

        return response()->json($remisionesConDetalle);
    }
}
