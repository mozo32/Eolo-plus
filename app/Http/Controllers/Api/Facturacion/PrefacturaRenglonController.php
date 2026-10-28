<?php

namespace App\Http\Controllers\Api\Facturacion;

use App\Http\Controllers\Api\Facturacion\Concerns\RechazaPrefacturaCerrada;
use App\Http\Controllers\Controller;
use App\Http\Requests\Facturacion\StoreRenglonRequest;
use App\Models\Aeronave;
use App\Models\Bitacora;
use App\Models\FactAeronave;
use App\Models\FactPrefactura;
use App\Models\FactPrefacturaRenglon;
use App\Models\FactServicio;
use App\Models\Remision;
use App\Models\ServicioComisariato;
use App\Services\CargosEstancia;
use App\Services\ComisariatosFacturables;
use App\Services\RemisionesFacturables;
use App\Services\RenglonDeComisariato;
use App\Services\ServicioDeEstanciaNoDisponibleException;
use App\Support\PrecioDeRenglon;
use App\Support\VentanaDeEstancia;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Renglones de una prefactura: alta y baja, y los dos recálculos de cargos.
 *
 * Cada escritura toma el candado de la prefactura DENTRO de su transacción, el
 * mismo que toma `CierrePrefactura`, de modo que cerrar y escribir renglones se
 * serializan. Si la prefactura se cierra entre el chequeo rápido del trait y el
 * candado, la guarda del modelo o `CargosEstancia` lanzan
 * `RenglonDePrefacturaCerradaException`, que se traduce sola a 409.
 *
 * Nunca se usa `increment()`/`decrement()` ni escrituras masivas sobre renglones:
 * se saltan la guarda del modelo.
 */
class PrefacturaRenglonController extends Controller
{
    use RechazaPrefacturaCerrada;

    public function store(StoreRenglonRequest $request, int $id): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazoRapido($prefactura)) {
            return $respuesta;
        }

        $servicio = FactServicio::findOrFail($request->validated()['servicio_id']);

        // El tránsito de OTRA aeronave: el precio sale de la tarifa de esa aeronave y el nombre
        // dice de quién es. Se guarda SIN concepto de estancia, que es lo que lo hace sobrevivir
        // a «Estancia y ajustes» —que borra por concepto— sin duplicarse.
        $ajena = null;

        if ($request->validated()['aeronave_id'] ?? null) {
            $ajena = $this->resolverTransitoAjeno($prefactura, $servicio, (int) $request->validated()['aeronave_id']);

            if ($ajena instanceof JsonResponse) {
                return $ajena;
            }
        }

        // El combustible nacido de una remisión toma de ella su precio y sus litros: el precio
        // del catálogo es el vigente, y una carga de hace un mes no se recobra al de hoy.
        $remision = null;

        if ($request->validated()['remision_combustible_id'] ?? null) {
            $remision = Remision::findOrFail($request->validated()['remision_combustible_id']);
        }

        // El comisariato elegido a mano: su renglón lo arma `RenglonDeComisariato`, el mismo sitio
        // que usa la vía automática, y no este método.
        $comisariato = null;

        if ($request->validated()['servicio_comisariato_id'] ?? null) {
            $comisariato = ServicioComisariato::with('factServicio')->findOrFail($request->validated()['servicio_comisariato_id']);
        }

        $renglon = DB::transaction(function () use ($request, $id, $servicio, $ajena, $remision, $comisariato) {
            $actual = $this->bloquear($id);

            if ($respuesta = $this->rechazarSiDescartada($actual)) {
                return $respuesta;
            }

            // Tomada por OTRO documento se puede elegir a mano; repetida en ESTE, no. Se mira
            // aquí, con el candado puesto, para que dos altas simultáneas no la cobren dos veces.
            if ($remision !== null && $actual->renglones()->where('remision_combustible_id', $remision->id)->exists()) {
                return response()->json([
                    'message' => 'Esa remisión ya está cobrada en este documento.',
                    'errors' => ['remision_combustible_id' => ['Esa remisión ya está cobrada en este documento.']],
                ], 422);
            }

            // Repetido en ESTE documento no, y se mira con el candado puesto.
            if ($comisariato !== null && $actual->renglones()->where('servicio_comisariato_id', $comisariato->id)->exists()) {
                return response()->json([
                    'message' => 'Ese comisariato ya está cobrado en este documento.',
                    'errors' => ['servicio_comisariato_id' => ['Ese comisariato ya está cobrado en este documento.']],
                ], 422);
            }

            // Tomado por OTRO documento tampoco, y aquí NO como en remisiones: allí «tomada» puede ser una
            // marca puesta a mano sin renglón detrás, y elegirla la rescata. Aquí «tomado» es siempre un
            // renglón vivo en una prefactura activa, o sea dinero ya cobrándose.
            if ($comisariato !== null && ($otro = ComisariatosFacturables::quienLoTiene($comisariato)) !== null) {
                $mensaje = "Ese comisariato ya está cobrado en {$otro}. Quítalo de allí primero si hay que moverlo a este documento.";

                return response()->json([
                    'message' => $mensaje,
                    'errors' => ['servicio_comisariato_id' => [$mensaje]],
                ], 422);
            }

            if ($comisariato !== null) {
                $precioDelRegistro = RenglonDeComisariato::precioHeredado($comisariato);
                // `reorder()`: la relación trae ORDER BY, que un agregado no admite en MySQL estricto.
                $renglon = $actual->renglones()->create(
                    RenglonDeComisariato::atributos(
                        $comisariato,
                        (int) $actual->renglones()->reorder()->max('orden') + 1,
                        $request->validated()['precio_unitario'] ?? null,
                    ),
                );

                // Ponerlo a propósito revoca el «este no entra» de una baja anterior.
                ComisariatosFacturables::revocarExclusion($actual, $comisariato->id);

                Bitacora::log(
                    modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                    accion: Bitacora::ACCION_CREAR,
                    descripcion: "Se agregó el servicio {$renglon->nombre_servicio} a la prefactura {$actual->id} por {$renglon->importe()}.".$this->avisoDePrecioCapturado($renglon, $precioDelRegistro),
                    usuarioId: $request->user()->id,
                    registroId: $actual->id,
                    datosNuevos: ['renglon_id' => $renglon->id, 'importe' => $renglon->importe()],
                );

                return $renglon;
            }

            // El precio sale del registro que corresponda —la remisión, la tarifa de la aeronave
            // o el catálogo— salvo que la petición traiga uno tecleado. `PrecioDeRenglon` decide
            // cuál se guarda y si cuenta como capturado a mano, en un solo sitio para las dos
            // vías. Lo tecleado sustituye SOLO al precio: margen, ajuste, tercero, concepto y
            // cantidad siguen su propia regla, justo debajo.
            $precioDelRegistro = $remision !== null ? $remision->precio : ($ajena === null ? $servicio->precio_unitario : $ajena['precio']);
            $precio = PrecioDeRenglon::resolver($request->validated()['precio_unitario'] ?? null, $precioDelRegistro);

            // El renglón CONGELA lo que determina su importe: si el catálogo cambia
            // mañana, este documento no se mueve.
            $renglon = $actual->renglones()->create([
                'servicio_id' => $servicio->id,
                'nombre_servicio' => $remision !== null ? "{$servicio->nombre} — {$remision->folio}" : ($ajena === null ? $servicio->nombre : $ajena['nombre']),
                'precio_unitario' => $precio['precio'],
                'precio_capturado' => $precio['capturado'],
                'cantidad' => $remision !== null ? (int) $remision->total_litros : $request->validated()['cantidad'],
                'remision_combustible_id' => $remision?->id,
                // El precio del ajeno sale de la tarifa de la aeronave, no del catálogo, así que los
                // ajustes del catálogo (margen, ajuste de precio, tercero) no le aplican: es lo mismo
                // que hace CargosEstancia con los cargos propios, que escriben false, 0 y «ninguno».
                'es_de_tercero' => $ajena === null && $remision === null ? $servicio->es_de_tercero : false,
                'margen' => $ajena === null && $remision === null ? $servicio->margen : 0,
                'ajuste_precio' => $ajena === null && $remision === null ? $servicio->ajuste_precio : FactServicio::AJUSTE_NINGUNO,
                'concepto' => $ajena === null ? $servicio->concepto : null,
                'proveedor_id' => $request->validated()['proveedor_id'] ?? null,
                'remision' => $request->validated()['remision'] ?? null,
                // `reorder()`: la relación trae ORDER BY, que un agregado no admite en MySQL estricto.
                'orden' => (int) $actual->renglones()->reorder()->max('orden') + 1,
            ]);

            // Ponerla a propósito revoca el «esta no entra» de una baja anterior: si no, la
            // remisión quedaría marcada como excluida con su renglón puesto.
            if ($remision !== null) {
                RemisionesFacturables::revocarExclusion($actual, $remision->id);
            }

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_CREAR,
                descripcion: "Se agregó el servicio {$renglon->nombre_servicio} a la prefactura {$actual->id} por {$renglon->importe()}.".$this->avisoDePrecioCapturado($renglon, $precioDelRegistro),
                usuarioId: $request->user()->id,
                registroId: $actual->id,
                datosNuevos: ['renglon_id' => $renglon->id, 'importe' => $renglon->importe()],
            );

            return $renglon;
        });

        if ($renglon instanceof JsonResponse) {
            return $renglon;
        }

        return response()->json([
            'message' => 'Renglón agregado.',
            'renglon_id' => $renglon->id,
        ], 201);
    }

    /**
     * Los comisariatos de la matrícula de la prefactura para el buscador del modal, con sus marcas.
     *
     * Hermano de `remisiones()`. No acota por ventana a propósito: es para los que la
     * sincronización automática no cubre.
     *
     * @return JsonResponse lista de objetos con `id`, `fecha_entrega`, `hora_entrega`, `subtotal`,
     *                      `forma_pago`, `proveedor`, `tomado_por`, `en_este_documento`,
     *                      `sin_proveedor` y `sin_importe`
     */
    public function comisariatos(int $id): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);
        $matricula = (string) $prefactura->aeronave?->matricula;

        if ($matricula === '') {
            return response()->json([]);
        }

        $comisariatos = ComisariatosFacturables::paraElegir($matricula, $prefactura->id)
            ->map(fn (ServicioComisariato $c) => [
                'id' => $c->id,
                'fecha_entrega' => $c->fecha_entrega?->toDateString(),
                'hora_entrega' => $c->hora_entrega?->format('H:i'),
                'subtotal' => $c->subtotal,
                'forma_pago' => $c->forma_pago,
                'proveedor' => $c->factServicio?->nombre,
                'tomado_por' => $c->tomado_por,
                'en_este_documento' => $c->en_este_documento,
                'sin_proveedor' => $c->sin_proveedor,
                'sin_importe' => $c->sin_importe,
            ])
            ->all();

        return response()->json($comisariatos);
    }

    /** Las remisiones de una matrícula para el buscador del modal, con sus marcas. */
    public function remisiones(Request $request, int $id): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);
        $q = $request->query('q', '');
        $matricula = is_string($q) ? trim($q) : '';

        if ($matricula === '') {
            $matricula = (string) $prefactura->aeronave?->matricula;
        }

        if ($matricula === '') {
            return response()->json(['remisiones' => []]);
        }

        $remisiones = RemisionesFacturables::paraElegir($matricula, $prefactura->id)
            ->map(fn (Remision $r) => [
                'id' => $r->id,
                'folio' => $r->folio,
                'fecha' => $r->fecha,
                'hora_inicial' => $r->hora_inicial,
                'total_litros' => $r->total_litros,
                'precio' => $r->precio,
                'tomada_por' => $r->tomada_por,
                'en_este_documento' => $r->en_este_documento,
                'sin_precio' => $r->sin_precio,
            ])
            ->all();

        return response()->json(['remisiones' => $remisiones]);
    }

    /**
     * Trae a la prefactura las remisiones de combustible de su matrícula que caen en su estancia.
     *
     * Es IDEMPOTENTE: una remisión ya cobrada aquí está tomada por su propio renglón, así que
     * `candidatas()` no la vuelve a devolver. Llamarlo diez veces deja el mismo resultado que
     * llamarlo una, y por eso el editor puede llamarlo en cada carga sin pensarlo.
     *
     * Solo AÑADE. Las remisiones que quedan fuera de la ventana tras acotarla se reportan para
     * que la pantalla avise, pero el renglón no se toca: nada desaparece solo de un documento
     * de cobro. Tampoco trae las que el operador quitó a mano de ESTA prefactura: eso lo
     * resuelve `candidatas()` con la tabla de exclusiones.
     *
     * Si falta el servicio de combustible activo responde 422 SOLO cuando había candidatas que
     * traer, que es cuando de verdad se pierde algo; sin candidatas la falta no afecta a este
     * documento y la respuesta es la normal.
     */
    public function sincronizarRemisiones(Request $request, int $id): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazoRapido($prefactura) ?? $this->rechazarSincronizarSiReabierta($prefactura)) {
            return $respuesta;
        }

        return DB::transaction(function () use ($id, $request) {
            $actual = $this->bloquear($id);

            if ($respuesta = $this->rechazarSiDescartada($actual) ?? $this->rechazarSincronizarSiReabierta($actual)) {
                return $respuesta;
            }

            // Las candidatas se leen ANTES que el servicio, porque son ellas las que deciden
            // si la falta del servicio es un fallo. Dentro del candado, como los inserts.
            $candidatas = RemisionesFacturables::candidatas($actual);

            // `activos()`, igual que `CargosEstancia` en sus tres sitios y que el paquete
            // internacional: un servicio dado de baja no se sigue cobrando. Dar de baja el
            // combustible es la única palanca del usuario para decir «deja de cobrarlo desde
            // aquí», y la vía manual ya la respeta (`StoreRenglonRequest` exige `status` A).
            // `concepto` es UNIQUE en `fact_servicios`, así que `first()` no elige entre dos.
            $servicio = FactServicio::porConcepto(FactServicio::CONCEPTO_COMBUSTIBLE)->activos()->first();

            // Sin servicio activo la sincronización NO se inventa un renglón. Pero el aviso es
            // solo cuando SE PIERDE algo: había litros que cobrar y no hay con qué. Si no hay
            // ninguna candidata, la falta del servicio no afecta a este documento y no se dejó
            // de hacer nada, así que la respuesta es la normal con `agregados: 0`. Un aviso que
            // salta cuando no se ha perdido nada es el que se aprende a cerrar sin leer, y
            // entonces se cierra también el que sí importa.
            if ($servicio === null && $candidatas->isNotEmpty()) {
                return response()->json([
                    'message' => 'No hay un servicio de combustible activo en el catálogo, así que no hay con qué cobrarlo. Reactívalo desde el catálogo de servicios si el combustible se debe seguir cobrando.',
                    'codigo' => 'sin_servicio_de_combustible',
                ], 422);
            }

            $orden = (int) $actual->renglones()->reorder()->max('orden');
            $agregados = 0;

            // Si se llega aquí con `$servicio` nulo es porque no hay ninguna candidata, así
            // que este bucle no corre ni una vuelta: el único camino que usa `$servicio` exige
            // que lo haya.
            foreach ($candidatas as $remision) {
                $actual->renglones()->create([
                    'servicio_id' => $servicio->id,
                    'remision_combustible_id' => $remision->id,
                    'nombre_servicio' => "{$servicio->nombre} — {$remision->folio}",
                    'precio_unitario' => $remision->precio,
                    'cantidad' => (int) $remision->total_litros,
                    'es_de_tercero' => false,
                    'margen' => 0,
                    'ajuste_precio' => FactServicio::AJUSTE_NINGUNO,
                    'concepto' => FactServicio::CONCEPTO_COMBUSTIBLE,
                    'orden' => ++$orden,
                ]);

                $agregados++;
            }

            if ($agregados > 0) {
                Bitacora::log(
                    modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                    accion: Bitacora::ACCION_CREAR,
                    descripcion: "Se trajeron {$agregados} remisiones de combustible a la prefactura {$actual->id}.",
                    usuarioId: $request->user()->id,
                    registroId: $actual->id,
                );
            }

            return response()->json([
                'agregados' => $agregados,
                'fuera_de_ventana' => $this->remisionesFueraDeVentana($actual),
            ]);
        });
    }

    /**
     * Trae a la prefactura los comisariatos de Tráfico de su matrícula que caen en su estancia.
     *
     * Hermano de `sincronizarRemisiones()`: mismas guardas, mismo candado dentro de la
     * transacción, mismo orden de rechazos y misma bitácora. Es IDEMPOTENTE y solo AÑADE; lo
     * que el operador quitó a mano de ESTA prefactura no vuelve (lo resuelve `candidatas()`).
     *
     * No hay un caso «falta el servicio»: el proveedor viaja en cada comisariato y `candidatas()`
     * ya descarta los que no lo tienen. El renglón lo arma `RenglonDeComisariato`, que toma el
     * margen y el ajuste del servicio: aquí el margen es el negocio, al revés que en combustible.
     */
    public function sincronizarComisariatos(Request $request, int $id): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazoRapido($prefactura) ?? $this->rechazarSincronizarSiReabierta($prefactura, 'comisariatos')) {
            return $respuesta;
        }

        return DB::transaction(function () use ($id, $request) {
            $actual = $this->bloquear($id);

            if ($respuesta = $this->rechazarSiDescartada($actual) ?? $this->rechazarSincronizarSiReabierta($actual, 'comisariatos')) {
                return $respuesta;
            }

            $candidatas = ComisariatosFacturables::candidatas($actual);

            $orden = (int) $actual->renglones()->reorder()->max('orden');
            $agregados = 0;

            foreach ($candidatas as $comisariato) {
                $actual->renglones()->create(RenglonDeComisariato::atributos($comisariato, ++$orden));

                $agregados++;
            }

            if ($agregados > 0) {
                Bitacora::log(
                    modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                    accion: Bitacora::ACCION_CREAR,
                    descripcion: "Se trajeron {$agregados} comisariatos a la prefactura {$actual->id}.",
                    usuarioId: $request->user()->id,
                    registroId: $actual->id,
                );
            }

            return response()->json(['agregados' => $agregados]);
        });
    }

    /**
     * Una reabierta es un documento ya emitido que alguien abrió para corregir algo concreto:
     * que al abrirlo le aparezcan solos renglones de combustible le cambia el total a espaldas de
     * quien lo reabrió. La sincronización automática no la toca; el alta a mano SÍ funciona en
     * ella, que es como se corrige a propósito.
     */
    private function rechazarSincronizarSiReabierta(FactPrefactura $prefactura, string $que = 'remisiones'): ?JsonResponse
    {
        if (! $prefactura->estaReabierta()) {
            return null;
        }

        return response()->json([
            'message' => 'Esta prefactura está reabierta: '.($que === 'comisariatos'
                ? 'no se le traen comisariatos solos. Elige los que correspondan'
                : 'no se le traen remisiones solas. Elige las que correspondan').' desde «Agregar servicio».',
            'codigo' => 'reabierta',
        ], 409);
    }

    /**
     * La frase que añade a la bitácora el precio que se cobró y el que habría aplicado.
     *
     * Vacía cuando el precio se heredó, que es el caso normal. Sin esta línea, un precio tecleado
     * sería un cambio de dinero sin rastro: el renglón puede quedar con un precio que ya no
     * coincide con la remisión o el comisariato del que nació, y ese registro sigue marcado como
     * cobrado.
     */
    private function avisoDePrecioCapturado(FactPrefacturaRenglon $renglon, string|float $precioDelRegistro): string
    {
        if (! $renglon->precio_capturado) {
            return '';
        }

        return " Precio capturado a mano: {$renglon->precio_unitario} en vez de ".number_format((float) $precioDelRegistro, 4, '.', '').'.';
    }

    /**
     * Los renglones de remisión de esta prefactura cuya remisión ya no cae en su ventana.
     *
     * Solo para avisar. Pasa cuando la salida se corrige a una hora anterior a una carga que ya
     * estaba cobrada. Lee la MISMA `VentanaDeEstancia` que `RemisionesFacturables`: con su
     * propia copia de la regla avisó de renglones que para la sincronización seguían dentro.
     *
     * @return array<int, array{renglon_id: int, folio: string}>
     */
    private function remisionesFueraDeVentana(FactPrefactura $prefactura): array
    {
        $renglones = $prefactura->renglones()->whereNotNull('remision_combustible_id')->get();

        if ($renglones->isEmpty()) {
            return [];
        }

        // Una sola consulta para todas: buscarlas de una en una dentro del filtro seria N+1.
        $remisiones = Remision::whereKey($renglones->pluck('remision_combustible_id'))->get()->keyBy('id');

        $ventana = VentanaDeEstancia::de($prefactura->llegada_at, $prefactura->salida_at);

        // Sin ventana posible no hay de qué avisar: `candidatas()` no trae nada tampoco.
        if ($ventana === null) {
            return [];
        }

        return $renglones
            ->filter(function ($renglon) use ($remisiones, $ventana) {
                $remision = $remisiones->get($renglon->remision_combustible_id);

                return $remision !== null
                    && ! $ventana->contiene(RemisionesFacturables::momentoDe($remision));
            })
            ->map(fn ($renglon) => [
                'renglon_id' => $renglon->id,
                'folio' => $remisiones->get($renglon->remision_combustible_id)->folio,
            ])
            ->values()
            ->all();
    }

    public function destroy(Request $request, int $id, int $renglon): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazoRapido($prefactura)) {
            return $respuesta;
        }

        $rechazo = DB::transaction(function () use ($request, $id, $renglon) {
            $actual = $this->bloquear($id);

            if ($respuesta = $this->rechazarSiDescartada($actual)) {
                return $respuesta;
            }

            // Borrado por modelo: dispara `deleting` y con él la guarda de cerrada.
            $fila = $actual->renglones()->whereKey($renglon)->firstOrFail();
            $nombre = $fila->nombre_servicio;
            $remisionId = $fila->remision_combustible_id;
            $comisariatoId = $fila->servicio_comisariato_id;
            $fila->delete();

            // Quitar el renglón LIBERA la remisión, y la pantalla sincroniza en cada carga: sin
            // apuntar la decisión, lo que el operador quita a propósito vuelve a entrar solo.
            // Se revoca dándola de alta a mano otra vez en esta misma prefactura.
            if ($remisionId !== null) {
                RemisionesFacturables::excluir($actual, $remisionId, $request->user()->id);
            }

            // Lo mismo con el comisariato: quitar el renglón lo libera y la pantalla sincroniza en
            // cada carga. Se revoca dándolo de alta a mano otra vez en esta misma prefactura.
            if ($comisariatoId !== null) {
                ComisariatosFacturables::excluir($actual, $comisariatoId, $request->user()->id);
            }

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_ELIMINAR,
                descripcion: "Se quitó el servicio {$nombre} de la prefactura {$actual->id}."
                    .($remisionId === null ? '' : ' Esa remisión ya no se traerá sola a este documento.')
                    .($comisariatoId === null ? '' : ' Ese comisariato ya no se traerá solo a este documento.'),
                usuarioId: $request->user()->id,
                registroId: $actual->id,
                datosAnteriores: ['renglon_id' => $renglon, 'nombre_servicio' => $nombre]
                    + ($remisionId === null ? [] : ['remision_combustible_id' => $remisionId])
                    + ($comisariatoId === null ? [] : ['servicio_comisariato_id' => $comisariatoId]),
            );

            return null;
        });

        return $rechazo ?? response()->json(['message' => 'Renglón eliminado.']);
    }

    /**
     * Marca o desmarca un renglón como cortesía: se sigue viendo en el documento,
     * pero su importe es 0.
     *
     * Escritura POR MODELO (`$fila->update()`), nunca masiva: así pasa por la guarda
     * de `saving` que rechaza una prefactura cerrada.
     *
     * La bitácora dice la cifra que deja de cobrarse (al marcar) o que vuelve a
     * cobrarse (al quitar): en los dos casos `importeSinCortesia()`, que no depende
     * del estado del renglón. Tomar `importe()` antes del cambio al marcar y después
     * al quitar da lo mismo solo si la petición cambia algo; si repite el valor
     * actual, `importe()` ya es 0.00 y el registro diría «por 0.00».
     */
    public function cortesia(Request $request, int $id, int $renglon): JsonResponse
    {
        $datos = $request->validate(['es_cortesia' => ['required', 'boolean']]);
        $marcar = (bool) $datos['es_cortesia'];

        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazoRapido($prefactura)) {
            return $respuesta;
        }

        $resultado = DB::transaction(function () use ($request, $id, $renglon, $marcar) {
            $actual = $this->bloquear($id);

            if ($respuesta = $this->rechazarSiDescartada($actual)) {
                return $respuesta;
            }

            $fila = $actual->renglones()->whereKey($renglon)->firstOrFail();

            // Sin cambio no hay escritura ni bitácora. Se escribe igual por modelo
            // cuando hay cambio, para que la guarda de cerrada se dispare.
            if ($fila->es_cortesia === $marcar) {
                return $actual;
            }

            $fila->update(['es_cortesia' => $marcar]);

            $importe = $fila->importeSinCortesia();
            $descripcion = $marcar
                ? "Se marcó como cortesía el servicio {$fila->nombre_servicio} de la prefactura {$actual->id}: deja de cobrarse {$importe}."
                : "Se quitó la cortesía del servicio {$fila->nombre_servicio} de la prefactura {$actual->id}: vuelve a cobrarse {$importe}.";

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_ACTUALIZAR,
                descripcion: $descripcion,
                usuarioId: $request->user()->id,
                registroId: $actual->id,
                datosAnteriores: ['renglon_id' => $fila->id, 'es_cortesia' => ! $marcar],
                datosNuevos: ['renglon_id' => $fila->id, 'es_cortesia' => $marcar, 'importe' => $importe],
            );

            return $actual;
        });

        if ($resultado instanceof JsonResponse) {
            return $resultado;
        }

        return response()->json([
            'message' => $marcar ? 'Renglón marcado como cortesía.' : 'Cortesía quitada.',
            'prefactura' => app(PrefacturaController::class)->fichaDe($resultado->id),
        ]);
    }

    /**
     * Agrupa o desagrupa un renglón: `grupo` es la etiqueta, o `null` para desagrupar.
     *
     * NO toca el dinero, y eso es el invariante del bloque: `subtotal()` sigue sumando el
     * importe de cada renglón, uno por uno, y el grupo está pensado solo para el documento
     * impreso. Por eso no hace falta ninguna guarda contra perder dinero: no hay nada que
     * poner en cero.
     *
     * Una etiqueta en blanco DESAGRUPA: `ConvertEmptyStringsToNull` convierte la cadena vacía
     * en `null` en toda la aplicación. Exigir una etiqueta no vacía al agrupar es de la pantalla.
     *
     * Que el grupo quede congelado al cerrar sale de la guarda de `FactPrefacturaRenglon`,
     * que rechaza cualquier escritura por modelo sobre una prefactura cerrada.
     */
    public function grupo(Request $request, int $id, int $renglon): JsonResponse
    {
        $datos = $request->validate(
            ['grupo' => ['present', 'nullable', 'string', 'max:60']],
            [
                'grupo.present' => 'Indica la etiqueta del grupo, o null para desagrupar.',
                'grupo.max' => 'La etiqueta del grupo no puede pasar de 60 caracteres.',
            ],
        );
        $etiqueta = $datos['grupo'];

        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazoRapido($prefactura)) {
            return $respuesta;
        }

        $resultado = DB::transaction(function () use ($request, $id, $renglon, $etiqueta) {
            $actual = $this->bloquear($id);

            if ($respuesta = $this->rechazarSiDescartada($actual)) {
                return $respuesta;
            }

            $fila = $actual->renglones()->whereKey($renglon)->firstOrFail();
            $anterior = $fila->grupo;

            // Sin cambio no hay escritura ni bitácora.
            if ($anterior === $etiqueta) {
                return $actual;
            }

            $fila->update(['grupo' => $etiqueta]);

            $descripcion = $etiqueta === null
                ? "Se desagrupó el servicio {$fila->nombre_servicio} de la prefactura {$actual->id}: salía en el grupo «{$anterior}»."
                : "Se agrupó el servicio {$fila->nombre_servicio} de la prefactura {$actual->id} en el grupo «{$etiqueta}».";

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_ACTUALIZAR,
                descripcion: $descripcion,
                usuarioId: $request->user()->id,
                registroId: $actual->id,
                datosAnteriores: ['renglon_id' => $fila->id, 'grupo' => $anterior],
                datosNuevos: ['renglon_id' => $fila->id, 'grupo' => $etiqueta],
            );

            return $actual;
        });

        if ($resultado instanceof JsonResponse) {
            return $resultado;
        }

        return response()->json([
            'message' => $etiqueta === null ? 'Renglón desagrupado.' : 'Renglón agrupado.',
            'prefactura' => app(PrefacturaController::class)->fichaDe($resultado->id),
        ]);
    }

    public function estancia(Request $request, int $id, CargosEstancia $cargos): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazoRapido($prefactura)) {
            return $respuesta;
        }

        $datos = $request->validate([
            'pernoctas' => ['required', 'integer', 'min:0', 'max:999'],
            'transitos_2h' => ['required', 'integer', 'min:0', 'max:999'],
            'transitos_12h' => ['required', 'integer', 'min:0', 'max:999'],
            'ajustes_2h_12h' => ['sometimes', 'integer', 'min:0', 'max:999'],
            'ajustes_12h_pernocta' => ['sometimes', 'integer', 'min:0', 'max:999'],
        ], $this->mensajesDeEstancia());

        // La transacción de afuera deja la bitácora en la misma que el servicio:
        // `CargosEstancia` abre la suya, que aquí queda anidada.
        try {
            $resultado = DB::transaction(function () use ($request, $prefactura, $cargos, $datos) {
                // Candado y guarda de descartada ANTES del servicio. La de cerrada sigue
                // siendo del servicio (su excepción se traduce sola a 409).
                if ($respuesta = $this->rechazarSiDescartada($this->bloquear($prefactura->id))) {
                    return $respuesta;
                }

                $resultado = $cargos->recalcular(
                    $prefactura,
                    $datos['pernoctas'],
                    $datos['transitos_2h'],
                    $datos['transitos_12h'],
                    $datos['ajustes_2h_12h'] ?? 0,
                    $datos['ajustes_12h_pernocta'] ?? 0,
                );

                Bitacora::log(
                    modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                    accion: Bitacora::ACCION_ACTUALIZAR,
                    descripcion: "Se recalculó la estancia de la prefactura {$prefactura->id}: {$resultado['renglones']} renglones.",
                    usuarioId: $request->user()->id,
                    registroId: $prefactura->id,
                    datosNuevos: $datos,
                );

                return $resultado;
            });
        } catch (ServicioDeEstanciaNoDisponibleException $e) {
            // Nada quedó escrito (la transacción se revirtió). El mensaje ya dice qué
            // hacer; sin esta captura, con APP_DEBUG=false Laravel lo reemplaza por
            // un «Server Error» y la persona nunca lo lee.
            return response()->json(['message' => $e->getMessage(), 'codigo' => 'servicio_estancia_no_disponible'], 422);
        }

        if ($resultado instanceof JsonResponse) {
            return $resultado;
        }

        return response()->json([
            'message' => $resultado['motivo'] ?? 'Estancia recalculada.',
            'renglones' => $resultado['renglones'],
            'motivo' => $resultado['motivo'],
        ]);
    }

    public function internacional(Request $request, int $id, CargosEstancia $cargos): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazoRapido($prefactura)) {
            return $respuesta;
        }

        $resultado = DB::transaction(function () use ($request, $prefactura, $cargos) {
            if ($respuesta = $this->rechazarSiDescartada($this->bloquear($prefactura->id))) {
                return $respuesta;
            }

            // El servicio toma el candado y rechaza una cerrada ANTES de que se escriba
            // nada: por eso el cambio de destino va después, ya con la fila bloqueada y
            // comprobada como borrador.
            $resultado = $cargos->agregarPaqueteInternacional($prefactura, FactServicio::PAQUETE_SALIDA);

            // Solo se marca internacional si la prefactura TIENE algo del paquete (lo que
            // se agregó ahora o lo que ya estaba). Marcarla sin ninguno la deja en un
            // callejón: la insignia dice Internacional, la tabla no tiene el paquete y el
            // editor ya no ofrece el botón, que solo sale con destino nacional.
            $marcada = $resultado['en_paquete'] > 0;

            if ($marcada) {
                $prefactura->update(['tipo_destino' => FactPrefactura::DESTINO_INTERNACIONAL]);
            }

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_ACTUALIZAR,
                descripcion: $marcada
                    ? "Se marcó internacional la prefactura {$prefactura->id} y se agregaron {$resultado['renglones']} servicios del paquete."
                    : "Se intentó marcar internacional la prefactura {$prefactura->id}: no se agregó ningún servicio del paquete y sigue nacional.",
                usuarioId: $request->user()->id,
                registroId: $prefactura->id,
                datosNuevos: [
                    'tipo_destino' => $marcada ? FactPrefactura::DESTINO_INTERNACIONAL : $prefactura->tipo_destino,
                    'servicios_agregados' => $resultado['renglones'],
                    'servicios_faltantes' => $resultado['faltantes'],
                ],
            );

            return $resultado;
        });

        if ($resultado instanceof JsonResponse) {
            return $resultado;
        }

        return response()->json([
            'message' => $resultado['motivo'] ?? 'Paquete internacional agregado.',
            'renglones' => $resultado['renglones'],
            'motivo' => $resultado['motivo'],
        ]);
    }

    /**
     * Marca que el vuelo LLEGÓ del extranjero y carga el paquete de entrada.
     *
     * Hermano de `internacional()`, que hace lo propio con la salida. Son endpoints
     * separados porque las dos direcciones son independientes: medido, 386 de 485
     * folios internacionales lo son en una sola. Este no toca `tipo_destino`.
     */
    public function origenInternacional(Request $request, int $id, CargosEstancia $cargos): JsonResponse
    {
        $prefactura = FactPrefactura::findOrFail($id);

        if ($respuesta = $this->rechazoRapido($prefactura)) {
            return $respuesta;
        }

        $resultado = DB::transaction(function () use ($request, $prefactura, $cargos) {
            if ($respuesta = $this->rechazarSiDescartada($this->bloquear($prefactura->id))) {
                return $respuesta;
            }

            $resultado = $cargos->agregarPaqueteInternacional($prefactura, FactServicio::PAQUETE_ENTRADA);

            // Igual que con el destino: solo se marca si la prefactura TIENE algo del
            // paquete de entrada, lo agregado ahora o lo que ya estaba.
            $marcada = $resultado['en_paquete'] > 0;

            if ($marcada) {
                $prefactura->update(['tipo_origen' => FactPrefactura::DESTINO_INTERNACIONAL]);
            }

            Bitacora::log(
                modulo: Bitacora::MODULO_FACTURACION_PREFACTURAS,
                accion: Bitacora::ACCION_ACTUALIZAR,
                descripcion: $marcada
                    ? "Se marcó el origen internacional de la prefactura {$prefactura->id} y se agregaron {$resultado['renglones']} servicios del paquete de entrada."
                    : "Se intentó marcar el origen internacional de la prefactura {$prefactura->id}: no se agregó ningún servicio del paquete de entrada y sigue nacional.",
                usuarioId: $request->user()->id,
                registroId: $prefactura->id,
                datosNuevos: [
                    'tipo_origen' => $marcada ? FactPrefactura::DESTINO_INTERNACIONAL : $prefactura->tipo_origen,
                    'servicios_agregados' => $resultado['renglones'],
                    'servicios_faltantes' => $resultado['faltantes'],
                ],
            );

            return $resultado;
        });

        if ($resultado instanceof JsonResponse) {
            return $resultado;
        }

        return response()->json([
            'message' => $resultado['motivo'] ?? 'Paquete de entrada agregado.',
            'renglones' => $resultado['renglones'],
            'motivo' => $resultado['motivo'],
        ]);
    }

    /**
     * La prefactura leída con candado, dentro de la transacción. Con ella se
     * comprueba «descartada» bajo el mismo candado que `descartar`, no solo en el
     * chequeo rápido: entre el `findOrFail` y aquí otra sesión pudo descartarla.
     */
    private function bloquear(int $id): FactPrefactura
    {
        return FactPrefactura::query()->whereKey($id)->lockForUpdate()->firstOrFail();
    }

    private function mensajesDeEstancia(): array
    {
        $mensajes = [];

        foreach (['pernoctas' => 'las pernoctas', 'transitos_2h' => 'los tránsitos de 2 horas', 'transitos_12h' => 'los tránsitos de 12 horas', 'ajustes_2h_12h' => 'los ajustes de 2 h a 12 h', 'ajustes_12h_pernocta' => 'los ajustes de 12 h a pernocta'] as $campo => $nombre) {
            $mensajes["{$campo}.required"] = "Indica la cantidad de {$nombre} (puede ser 0).";
            $mensajes["{$campo}.integer"] = "La cantidad de {$nombre} debe ser un número entero.";
            $mensajes["{$campo}.min"] = "La cantidad de {$nombre} no puede ser negativa.";
            $mensajes["{$campo}.max"] = "La cantidad de {$nombre} no puede pasar de 999.";
        }

        return $mensajes;
    }

    /**
     * El nombre y el precio de un tránsito cobrado a nombre de otra aeronave, o el 422 que
     * corresponda.
     *
     * @return array{nombre: string, precio: string}|JsonResponse
     */
    private function resolverTransitoAjeno(FactPrefactura $prefactura, FactServicio $servicio, int $aeronaveId): array|JsonResponse
    {
        if ($aeronaveId === (int) $prefactura->aeronave_id) {
            return $this->rechazoDeMatricula('Para la estancia de esta aeronave usa «Estancia y ajustes»: por aquí el cargo se duplicaría al recalcular.');
        }

        $ficha = FactAeronave::query()->with('aeronave')->where('aeronave_id', $aeronaveId)->first();
        $matricula = $ficha?->aeronave?->matricula ?? Aeronave::whereKey($aeronaveId)->value('matricula') ?? '';

        if ($ficha === null) {
            return $this->rechazoDeMatricula("{$matricula} no tiene ficha de facturación, así que no hay tarifas que aplicar.");
        }

        if ($ficha->estatus === FactAeronave::ESTATUS_GUARDA) {
            return $this->rechazoDeMatricula("{$matricula} está en Guarda y una aeronave en Guarda no paga estancia.");
        }

        $tarifa = match ($servicio->concepto) {
            FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H => $ficha->tarifaTransito2h(),
            FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H => $ficha->tarifaTransito12h(),
            FactServicio::CONCEPTO_ESTANCIA_PERNOCTA => $ficha->tarifaPernocta(),
        };

        if ($tarifa === null) {
            return $this->rechazoDeMatricula("{$matricula} no tiene tarifa de «{$servicio->nombre}», ni propia ni por su categoría, así que no hay precio que cobrar.");
        }

        return ['nombre' => "{$servicio->nombre} — {$matricula}", 'precio' => (string) $tarifa];
    }

    private function rechazoDeMatricula(string $mensaje): JsonResponse
    {
        return response()->json(['message' => $mensaje, 'errors' => ['aeronave_id' => [$mensaje]]], 422);
    }
}
