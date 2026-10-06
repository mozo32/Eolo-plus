<?php

namespace App\Http\Controllers\Api\Facturacion;

use App\Http\Controllers\Api\Facturacion\Concerns\RechazaPrefacturaCerrada;
use App\Http\Controllers\Controller;
use App\Http\Requests\Facturacion\ReabrirPrefacturaRequest;
use App\Http\Requests\Facturacion\StorePrefacturaRequest;
use App\Http\Requests\Facturacion\UpdateNotasRequest;
use App\Http\Requests\Facturacion\UpdatePrefacturaRequest;
use App\Models\Bitacora;
use App\Models\FactPrefactura;
use App\Models\FactPrefacturaRenglon;
use App\Models\OperacionDiaria;
use App\Services\CierrePrefactura;
use App\Services\PrefacturaDescartadaException;
use App\Services\PrefacturaIncompletaException;
use App\Services\PrefacturaSinCobroException;
use App\Services\PrefacturaYaCerradaException;
use App\Services\ReaperturaPrefactura;
use App\Services\RenglonDePrefacturaCerradaException;
use App\Services\SelloInconsistenteException;
use App\Services\TotalesNoCalculablesException;
use DateTimeInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use UnexpectedValueException;

/**
 * Prefacturas: lista, ficha, alta, edición, cierre y descarte.
 *
 * Consultar es para cualquier usuario con sesión; escribir exige el
 * subdepartamento factPrefacturas (ver routes/api.php). Toda escritura y su
 * registro en bitácora van en la MISMA transacción: si la bitácora falla, la
 * escritura se revierte (el patrón de `CierrePrefactura`).
 *
 * Los totales salen de los métodos del modelo (`subtotal()`, `iva()`, `total()`);
 * aquí no hay aritmética de dinero.
 */
class PrefacturaController extends Controller
{
    use RechazaPrefacturaCerrada;

    private const PER_PAGE_PERMITIDOS = [10, 20, 50, 100];

    /** Los campos de la cabecera que `update()` puede cambiar y que se registran en bitácora. */
    private const CAMPOS_REGISTRADOS = [
        'aeronave_id', 'cliente_id', 'llegada_at', 'salida_at', 'origen', 'destino',
        'operacion_llegada_id', 'operacion_salida_id', 'tipo_destino',
    ];

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'desde' => ['nullable', 'date'],
            'hasta' => ['nullable', 'date'],
        ], [
            'desde.date' => 'La fecha «desde» no es una fecha válida.',
            'hasta.date' => 'La fecha «hasta» no es una fecha válida.',
        ]);

        $perPage = (int) $request->query('per_page', 20);
        if (! in_array($perPage, self::PER_PAGE_PERMITIDOS, true)) {
            $perPage = 20;
        }

        $query = FactPrefactura::query()
            ->with(['aeronave:id,matricula', 'cliente:id,nombre'])
            ->where('status', FactPrefactura::STATUS_ACTIVO)
            ->orderByDesc('id');

        if (in_array($request->query('estado'), [
            FactPrefactura::ESTADO_BORRADOR,
            FactPrefactura::ESTADO_CERRADA,
            FactPrefactura::ESTADO_REABIERTA,
        ], true)) {
            $query->where('estado', $request->query('estado'));
        }

        // Va AGRUPADO: sin el paréntesis, el OR se comería los filtros de arriba.
        if ($request->filled('q')) {
            $patron = '%'.trim((string) $request->query('q')).'%';
            $query->where(function ($busqueda) use ($patron) {
                $busqueda->whereHas('aeronave', fn ($a) => $a->where('matricula', 'LIKE', $patron))
                    ->orWhereHas('cliente', fn ($c) => $c->where('nombre', 'LIKE', $patron))
                    ->orWhere('folio', 'LIKE', $patron);
            });
        }

        // `desde` y `hasta` filtran por la fecha de LLEGADA, que es la que la lista
        // muestra (no por `created_at`: el operador filtraría por una fecha y vería otra).
        // `llegada_at` admite nulos, y a propósito: con un filtro de fechas activo, un
        // borrador sin llegada capturada queda FUERA, porque no tiene fecha que comparar.
        // Sin filtro, sale en la lista como cualquier otro.
        if ($request->filled('desde')) {
            $query->whereDate('llegada_at', '>=', $request->query('desde'));
        }

        if ($request->filled('hasta')) {
            $query->whereDate('llegada_at', '<=', $request->query('hasta'));
        }

        $pagina = $query->paginate($perPage)->appends($request->query());
        $pagina->through(fn (FactPrefactura $p) => $this->presentar($p, conRenglones: false));

        return response()->json($pagina);
    }

    /**
     * Las llegadas de una matrícula que la pantalla puede ofrecer al abrir una
     * prefactura: solo las que NINGUNA prefactura activa ha tomado ya
     * (`fact_prefacturas.operacion_llegada_id`). Una prefactura descartada no
     * reserva su operación. Es de lectura, como el resto: sin `subdep:`.
     *
     * La matrícula es exacta (no un LIKE) y solo salen operaciones activas, que es lo
     * que el resto del sistema entiende por operación vigente. Las más recientes primero.
     */
    public function llegadasSinFacturar(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'matricula' => ['required', 'string', 'max:20'],
            'max' => ['nullable', 'integer', 'min:1', 'max:20'],
        ], [
            'matricula.required' => 'Indica la matrícula.',
            'matricula.string' => 'La matrícula debe ser texto.',
            'matricula.max' => 'La matrícula no puede pasar de 20 caracteres.',
            'max.integer' => 'El máximo debe ser un número entero.',
            'max.min' => 'El máximo debe ser al menos 1.',
            'max.max' => 'El máximo no puede pasar de 20.',
        ]);

        // `whereNotNull` dentro de la subconsulta: un `NOT IN` con un NULL en la lista no devuelve nada.
        $tomadas = FactPrefactura::query()
            ->where('status', FactPrefactura::STATUS_ACTIVO)
            ->whereNotNull('operacion_llegada_id')
            ->select('operacion_llegada_id');

        $llegadas = OperacionDiaria::query()
            ->activas()
            ->llegadas()
            ->where('matricula', strtoupper(trim($datos['matricula'])))
            ->whereNotIn('id', $tomadas)
            ->orderByDesc('fecha')
            ->orderByDesc('hora')
            ->orderByDesc('id')
            ->limit((int) ($datos['max'] ?? 5))
            ->get(['id', 'matricula', 'fecha', 'hora', 'lugar']);

        return response()->json(['data' => $llegadas]);
    }

    public function show(int $id): JsonResponse
    {
        $prefactura = FactPrefactura::with(['renglones', 'aeronave:id,matricula', 'cliente:id,nombre'])->findOrFail($id);

        return response()->json(['prefactura' => $this->presentar($prefactura, conRenglones: true)]);
    }

    public function store(StorePrefacturaRequest $request): JsonResponse
    {
        $prefactura = DB::transaction(function () use ($request) {
            $prefactura = FactPrefactura::create($request->validated() + [
                'estado' => FactPrefactura::ESTADO_BORRADOR,
                'user_id' => $request->user()->id,
                'status' => FactPrefactura::STATUS_ACTIVO,
            ]);

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_CREAR,
                descripcion: "Se abrió un borrador de prefactura para la matrícula {$prefactura->aeronave->matricula}.",
                usuarioId: $request->user()->id,
                registroId: $prefactura->id,
                datosNuevos: $this->datosRegistrados($prefactura),
            );

            return $prefactura;
        });

        return response()->json([
            'message' => 'Borrador de prefactura creado.',
            'prefactura' => $this->presentar($prefactura->fresh(), conRenglones: true),
        ], 201);
    }

    public function update(UpdatePrefacturaRequest $request, int $id): JsonResponse
    {
        $resultado = DB::transaction(function () use ($request, $id) {
            // CANDADO y comprobación DENTRO de la transacción: leer el estado antes y
            // escribir después deja una ventana en la que otra sesión puede cerrar, y
            // la cabecera de un documento ya emitido cambiaría debajo de su sello.
            $prefactura = FactPrefactura::query()->whereKey($id)->lockForUpdate()->firstOrFail();

            if ($respuesta = $this->rechazarSiCerrada($prefactura)) {
                return $respuesta;
            }

            if ($respuesta = $this->rechazarSiDescartada($prefactura)) {
                return $respuesta;
            }

            $antes = $this->datosRegistrados($prefactura);
            $prefactura->update($request->validated());

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_ACTUALIZAR,
                descripcion: "Se editó el borrador de prefactura {$prefactura->id}.",
                usuarioId: $request->user()->id,
                registroId: $prefactura->id,
                datosAnteriores: $antes,
                datosNuevos: $this->datosRegistrados($prefactura->fresh()),
            );

            return $prefactura;
        });

        if ($resultado instanceof JsonResponse) {
            return $resultado;
        }

        return response()->json([
            'message' => 'Prefactura actualizada.',
            'prefactura' => $this->presentar($resultado->fresh(), conRenglones: true),
        ]);
    }

    public function cerrar(Request $request, int $id, CierrePrefactura $cierre): JsonResponse
    {
        // En dos sentencias: con `(bool) $datos['x'] ?? false` en una sola, la
        // precedencia del cast se come al `??` y la clave ausente revienta.
        $datos = $request->validate([
            'confirmar_sin_cobro' => ['sometimes', 'boolean'],
            // La cifra que quien confirmó vio. Viaja como cadena y entra a `bc` sin pasar por float.
            'faltante_confirmado' => ['sometimes', 'nullable', 'numeric', 'decimal:0,2', 'min:0'],
        ], [
            'confirmar_sin_cobro.boolean' => 'La confirmación de cerrar sin cobro debe ser verdadera o falsa.',
            'faltante_confirmado.numeric' => 'El faltante confirmado debe ser un importe numérico.',
            'faltante_confirmado.decimal' => 'El faltante confirmado no puede tener más de dos decimales.',
            'faltante_confirmado.min' => 'El faltante confirmado no puede ser negativo.',
        ]);
        $confirmar = (bool) ($datos['confirmar_sin_cobro'] ?? false);
        $faltanteConfirmado = isset($datos['faltante_confirmado']) ? bcadd((string) $datos['faltante_confirmado'], '0', 2) : null;

        try {
            $resultado = DB::transaction(function () use ($request, $id, $cierre, $confirmar, $faltanteConfirmado) {
                // El candado se toma aquí, antes de decidir, para que descartar y
                // cerrar se serialicen: sin él, un borrador descartado entre la
                // lectura y el cierre consumiría un folio para un documento oculto.
                // `CierrePrefactura` repite el candado (es el mismo, no se bloquea
                // a sí mismo) y registra su propia bitácora.
                $prefactura = FactPrefactura::query()->whereKey($id)->lockForUpdate()->firstOrFail();

                if ($respuesta = $this->rechazarSiDescartada($prefactura)) {
                    return $respuesta;
                }

                return $cierre->cerrar($prefactura, $request->user()->id, $confirmar, $faltanteConfirmado);
            });
        } catch (PrefacturaYaCerradaException|RenglonDePrefacturaCerradaException $e) {
            return response()->json(['message' => $e->getMessage(), 'codigo' => 'ya_cerrada'], 409);
        } catch (PrefacturaDescartadaException $e) {
            return response()->json(['message' => $e->getMessage(), 'codigo' => 'ya_descartada'], 409);
        } catch (PrefacturaIncompletaException $e) {
            return response()->json(['message' => $e->getMessage(), 'codigo' => 'incompleta'], 422);
        } catch (PrefacturaSinCobroException $e) {
            // No es un fallo: es la confirmación que falta. Nada quedó escrito y el folio
            // no se consumió; la pantalla vuelve a llamar con `confirmar_sin_cobro`.
            return response()->json([
                'message' => $e->getMessage(),
                'codigo' => 'sin_cobro',
                'faltante' => $e->faltante,
            ], 422);
        } catch (TotalesNoCalculablesException $e) {
            // Ni confirmando se puede cerrar: no hay total que sellar. Se reporta (la
            // transacción se revirtió y nada más lo registra) y se dice qué corregir.
            // El código es el mismo que usa `PagosPrefactura` para esta causa.
            report($e->getPrevious() ?? $e);

            return response()->json([
                'message' => 'No se puede cerrar: un renglón o la tasa de IVA tienen un valor que no se reconoce. Corrígelo (el ajuste de precio del renglón o la tasa de IVA en la configuración) y vuelve a cerrar.',
                'codigo' => 'totales_no_calculables',
            ], 422);
        } catch (SelloInconsistenteException) {
            // El cierre se abortó porque el sello no coincidía con la derivación, casi
            // siempre porque otra sesión tocó los renglones. Nada quedó escrito y el folio
            // no se consumió, así que reintentar es seguro.
            return response()->json([
                'message' => 'El cierre se canceló porque los totales cambiaron mientras se cerraba. Nada se guardó; vuelve a intentarlo.',
                'codigo' => 'sello_inconsistente',
            ], 409);
        }

        if ($resultado instanceof JsonResponse) {
            return $resultado;
        }

        return response()->json([
            'message' => "Prefactura cerrada con folio {$resultado->folio}.",
            'prefactura' => $this->presentar($resultado, conRenglones: true),
        ]);
    }

    /**
     * Reabre una cerrada para corregirla. El documento anterior queda guardado como versión
     * antes de que nada cambie.
     */
    public function reabrir(ReabrirPrefacturaRequest $request, int $id, ReaperturaPrefactura $reapertura): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazarSiDescartada($prefactura)) {
            return $respuesta;
        }

        try {
            $reabierta = $reapertura->reabrir(
                $prefactura,
                $request->user()->id,
                $request->validated()['motivo'],
            );
        } catch (UnexpectedValueException $e) {
            report($e);

            return response()->json([
                'message' => 'No se puede guardar el documento anterior: un renglón o la tasa de IVA tienen un valor que no se reconoce. Corrígelo antes de reabrir.',
                'codigo' => 'totales_no_calculables',
            ], 422);
        }

        // `PrefacturaNoReabribleException` NO se atrapa aquí: define `render()`, que es el
        // método que Laravel invoca, y se traduce sola a 409 —igual que ya hace
        // `RenglonDePrefacturaCerradaException`.

        return response()->json([
            'message' => "Prefactura {$reabierta->folio} reabierta para corregirse.",
            'prefactura' => $this->presentar($reabierta, conRenglones: true),
        ]);
    }

    /**
     * Las tres notas. Solo en borrador: al cerrar, el documento ya salió, y la nota
     * externa se imprime en él.
     */
    public function notas(UpdateNotasRequest $request, int $id): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazoRapido($prefactura)) {
            return $respuesta;
        }

        $resultado = DB::transaction(function () use ($request, $id) {
            // La guarda se REPITE con candado: entre el chequeo rápido y aquí otra
            // sesión pudo cerrar o descartar.
            $actual = FactPrefactura::query()->whereKey($id)->lockForUpdate()->firstOrFail();

            if ($respuesta = $this->rechazoRapido($actual)) {
                return $respuesta;
            }

            // Se lee con `validated()`, NO con `input()`: `validated()` omite las claves que
            // no vinieron, y por eso guardar solo la externa no toca las otras dos.
            $cambios = collect($request->validated())
                ->filter(fn ($valor, $campo) => $actual->{$campo} !== $valor)
                ->all();

            // Sin cambio no hay escritura ni bitácora (como `cortesia()`): un PATCH vacío,
            // o que repite lo guardado, no deja una entrada con «antes» igual a «después».
            if ($cambios === []) {
                return $actual;
            }

            $campos = ['nota_interna', 'nota_externa', 'nota_factura'];
            $antes = $actual->only($campos);
            $actual->update($cambios);

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_ACTUALIZAR,
                descripcion: "Se guardaron las notas de la prefactura {$actual->id}.",
                usuarioId: $request->user()->id,
                registroId: $actual->id,
                datosAnteriores: $antes,
                datosNuevos: $actual->fresh()->only($campos),
            );

            return $actual;
        });

        if ($resultado instanceof JsonResponse) {
            return $resultado;
        }

        return response()->json(['message' => 'Notas guardadas.', 'prefactura' => $this->fichaDe($id)]);
    }

    /**
     * Baja lógica de un borrador abierto por error. Atómica, como el resto del
     * proyecto: `WHERE id = ? AND status = 'A' AND estado = 'borrador'`. El `estado` excluye
     * a propósito a las REABIERTAS: su folio ya se consumió, y descartarlas lo perdería y
     * haría desaparecer de la lista un documento que ya salió al cliente.
     *
     * Una prefactura cerrada NO se descarta: ya es un documento emitido con su
     * folio consumido. Para corregirla se reabre (ver `reabrir()`).
     */
    public function descartar(Request $request, int $id): JsonResponse
    {
        $rechazo = DB::transaction(function () use ($request, $id) {
            $filas = FactPrefactura::query()
                ->where('id', $id)
                ->where('status', FactPrefactura::STATUS_ACTIVO)
                ->where('estado', FactPrefactura::ESTADO_BORRADOR)
                ->update(['status' => FactPrefactura::STATUS_INACTIVO, 'updated_at' => now()]);

            if ($filas === 0) {
                // Solo ahora se lee, para decir POR QUÉ no se afectó nada: una cerrada
                // (documento emitido) o un borrador que ya estaba descartado. Leerla
                // antes y decidir con eso daría el motivo equivocado si otra sesión
                // cierra en medio.
                $actual = FactPrefactura::query()->findOrFail($id);

                if ($actual->estaReabierta()) {
                    return response()->json([
                        'message' => 'Esta prefactura está reabierta para corregirse: su folio ya se consumió y no se descarta.',
                        'codigo' => 'reabierta',
                    ], 409);
                }

                return $actual->estaCerrada()
                    ? response()->json([
                        'message' => 'Esta prefactura ya está cerrada: un documento emitido no se descarta.',
                        'codigo' => 'ya_cerrada',
                    ], 409)
                    : response()->json([
                        'message' => 'Este borrador ya estaba descartado.',
                        'codigo' => 'ya_descartada',
                    ], 409);
            }

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_DESACTIVAR,
                descripcion: "Se descartó el borrador de prefactura {$id}.",
                usuarioId: $request->user()->id,
                registroId: $id,
            );

            return null;
        });

        return $rechazo ?? response()->json(['message' => 'Borrador descartado.']);
    }

    /**
     * La ficha completa de una prefactura, para que otro controlador del módulo
     * devuelva el mismo cuerpo que `show()` sin copiar `presentar()`.
     */
    public function fichaDe(int $id): array
    {
        return $this->presentar(FactPrefactura::findOrFail($id)->fresh(), conRenglones: true);
    }

    /**
     * La cabecera tal como se registra en bitácora. Las fechas van como texto: un
     * objeto Carbon se serializaría con otro formato y el antes y el después no
     * serían comparables.
     */
    private function datosRegistrados(FactPrefactura $p): array
    {
        $datos = [];

        foreach (self::CAMPOS_REGISTRADOS as $campo) {
            $valor = $p->{$campo};
            $datos[$campo] = $valor instanceof DateTimeInterface ? $valor->format('Y-m-d H:i:s') : $valor;
        }

        return $datos;
    }

    /**
     * El JSON de una prefactura. Se arma a mano, SIN `toArray()`: el renglón declara
     * `$appends = ['importe']`, y serializarlo llamaría a `importe()`, que lanza con
     * un ajuste desconocido y reventaría la respuesta entera.
     *
     * Una fila corrupta no tumba el listado: el cálculo que lanza
     * `UnexpectedValueException` (ajuste desconocido, tasa ilegible) se reporta al
     * registro de errores y esa fila sale con el campo en null y un aviso en español.
     */
    private function presentar(FactPrefactura $p, bool $conRenglones): array
    {
        $datos = [
            'id' => $p->id,
            'folio' => $p->folio,
            'estado' => $p->estado,
            'status' => $p->status,
            'matricula' => $p->aeronave?->matricula,
            'cliente' => $p->cliente?->nombre,
            'cliente_id' => $p->cliente_id,
            'aeronave_id' => $p->aeronave_id,
            'llegada_at' => $p->llegada_at?->toDateTimeString(),
            'salida_at' => $p->salida_at?->toDateTimeString(),
            'origen' => $p->origen,
            'destino' => $p->destino,
            'tipo_destino' => $p->tipo_destino,
            'nota_interna' => $p->nota_interna,
            'nota_externa' => $p->nota_externa,
            'nota_factura' => $p->nota_factura,
            'cerrada_at' => $p->cerrada_at?->toDateTimeString(),
        ] + $this->totales($p) + $this->verificacionDelSello($p);

        if ($conRenglones) {
            // El cobro solo va en la ficha: el listado no lo muestra y cada fila costaría una docena de consultas.
            $datos += $this->cobro($p);

            $datos['renglones'] = $p->renglones->map(fn (FactPrefacturaRenglon $r) => [
                'id' => $r->id,
                'servicio_id' => $r->servicio_id,
                'nombre_servicio' => $r->nombre_servicio,
                'precio_unitario' => (string) $r->precio_unitario,
                'cantidad' => $r->cantidad,
                'margen' => (string) $r->margen,
                'ajuste_precio' => $r->ajuste_precio,
                'concepto' => $r->concepto,
                'remision' => $r->remision,
                'es_cortesia' => $r->es_cortesia,
                'grupo' => $r->grupo,
            ] + $this->importeDelRenglon($r))->all();
        }

        return $datos;
    }

    /** @return array{subtotal: ?string, iva: ?string, iva_tasa: ?string, total: ?string, totales_error: ?string} */
    private function totales(FactPrefactura $p): array
    {
        try {
            return [
                'subtotal' => $p->subtotal(),
                'iva' => $p->iva(),
                'iva_tasa' => $p->ivaTasa(),
                'total' => $p->total(),
                'totales_error' => null,
            ];
        } catch (UnexpectedValueException $e) {
            report($e);

            return [
                'subtotal' => null,
                'iva' => null,
                'iva_tasa' => null,
                'total' => null,
                'totales_error' => 'No se pueden calcular los totales: un renglón o la tasa de IVA tienen un valor que no se reconoce.',
            ];
        }
    }

    /**
     * Si el sello de una cerrada ya no coincide con lo que derivan sus renglones, se
     * dice. `sello_discrepa` es `null` cuando no se pudo verificar (y entonces
     * `sello_error` lo explica): no verificar no es lo mismo que verificar y estar bien.
     *
     * @return array{sello_discrepa: ?bool, sello_discrepancias: array, sello_error: ?string}
     */
    private function verificacionDelSello(FactPrefactura $p): array
    {
        try {
            $discrepancias = $p->discrepanciasDelSello();

            return [
                'sello_discrepa' => $discrepancias !== [],
                'sello_discrepancias' => $discrepancias,
                'sello_error' => null,
            ];
        } catch (UnexpectedValueException $e) {
            report($e);

            return [
                'sello_discrepa' => null,
                'sello_discrepancias' => [],
                'sello_error' => 'No se pudo verificar el sello contra los renglones: un renglón o la tasa de IVA tienen un valor que no se reconoce.',
            ];
        }
    }

    /**
     * Lo cobrado. El sobrepago se parte: `cambio` es lo que se devuelve y no puede
     * pasar del efectivo que entró; `cobrado_de_mas` es el resto, que se corrige
     * cambiando el pago. Los dos pueden ser distintos de cero a la vez.
     *
     * @return array{pagado: string, por_cobrar: ?string, sobrepago: ?string, cambio: ?string, cobrado_de_mas: ?string, cobro_error: ?string, pagos: array}
     */
    private function cobro(FactPrefactura $p): array
    {
        // Si los totales no se pudieron calcular, tampoco lo que depende de ellos: lo
        // pagado sí, porque no depende de la tasa de IVA.
        $error = null;

        try {
            $porCobrar = $p->porCobrar();
            $sobrepago = $p->sobrepago();
            $cambio = $p->cambio();
            $cobradoDeMas = $p->cobradoDeMas();
        } catch (UnexpectedValueException) {
            // Ya lo reportó `totales()`, que corre en la misma ficha.
            $porCobrar = $sobrepago = $cambio = $cobradoDeMas = null;
            $error = 'No se puede calcular lo que falta por cobrar ni el cambio: un renglón o la tasa de IVA tienen un valor que no se reconoce.';
        }

        return [
            'pagado' => $p->pagado(),
            'por_cobrar' => $porCobrar,
            'sobrepago' => $sobrepago,
            'cambio' => $cambio,
            'cobrado_de_mas' => $cobradoDeMas,
            'cobro_error' => $error,
            'pagos' => $p->pagos()->with('formaPago')->get()->map(fn ($pago) => [
                'id' => $pago->id,
                'forma_pago_id' => $pago->forma_pago_id,
                'forma_pago' => $pago->formaPago?->nombre,
                'concepto' => $pago->formaPago?->concepto,
                'monto' => (string) $pago->monto,
                'es_comision_amex' => $pago->renglon_comision_id !== null,
            ])->all(),
        ];
    }

    /** @return array{importe: ?string, importe_error: ?string} */
    private function importeDelRenglon(FactPrefacturaRenglon $renglon): array
    {
        try {
            return ['importe' => $renglon->importe(), 'importe_error' => null];
        } catch (UnexpectedValueException $e) {
            report($e);

            return ['importe' => null, 'importe_error' => 'El ajuste de precio de este renglón no se reconoce.'];
        }
    }
}
