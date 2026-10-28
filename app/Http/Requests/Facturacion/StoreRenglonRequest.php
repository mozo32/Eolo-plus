<?php

namespace App\Http\Requests\Facturacion;

use App\Models\FactPrefactura;
use App\Models\FactServicio;
use App\Models\ServicioComisariato;
use App\Services\ComisariatosFacturables;
use App\Services\RemisionesFacturables;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRenglonRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            // `bail`: el rechazo de estancia consulta el catálogo y solo tiene sentido si el servicio existe.
            'servicio_id' => [
                'bail',
                'required',
                'integer',
                Rule::exists('fact_servicios', 'id')->where('status', 'A'),
                $this->noEsServicioDeEstancia(...),
            ],
            'cantidad' => ['required', 'integer', 'min:1', 'max:9999'],
            'precio_unitario' => ['bail', 'nullable', 'numeric', 'min:0', 'max:999999.9999', $this->hasta4Decimales(...)],
            'aeronave_id' => ['bail', 'nullable', 'integer', Rule::exists('aeronaves', 'id'), $this->soloParaTransito(...)],
            'remision_combustible_id' => ['bail', 'nullable', 'integer', Rule::exists('remisiones', 'id')->where('status', 'A'), $this->soloParaCombustible(...)],
            'servicio_comisariato_id' => ['bail', 'nullable', 'integer', Rule::exists('servicio_comisariatos', 'id')->where('status', 'A'), $this->soloSiPuedeCobrarse(...)],
            'proveedor_id' => ['nullable', 'integer', Rule::exists('fact_proveedores', 'id')->where('status', 'A')],
            'remision' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * El comisariato tiene que tener proveedor y ser de LA MATRÍCULA de esta prefactura.
     *
     * Sin proveedor no hay servicio con el que armar el renglón (`servicio_id` es NOT NULL). Lo
     * de la matrícula es lo que ata el alta a mano a la misma regla que la automática: el
     * buscador es un campo editable y, sin esto, tecleando otra matrícula se le cobraría a este
     * cliente el comisariato de otra aeronave. Se compara con `esLaMismaAeronave()`, la misma
     * tolerancia del guion y los espacios que usa el alta a mano de remisiones, y NO con el
     * `normalizarMatricula()` a secas de la vía automática: ver el docblock de `esLaMismaAeronave()`,
     * más abajo en este fichero, cuyo argumento aplica aquí palabra por palabra (un comisariato de `XA AMI` no tendría ninguna vía
     * de cobro). La vía automática sigue emparejando por texto exacto, por decisión aceptada.
     */
    private function soloSiPuedeCobrarse(string $atributo, mixed $valor, \Closure $fallar): void
    {
        $comisariato = ServicioComisariato::find($valor);

        if ($comisariato === null) {
            return;
        }

        if ($comisariato->fact_servicio_id === null) {
            $fallar('Ese comisariato no tiene proveedor asignado, así que no hay servicio con el que cobrarlo. Asígnaselo en Tráfico primero.');

            return;
        }

        $prefactura = FactPrefactura::with('aeronave')->find($this->route('id'));

        // Sin prefactura el controlador ya devuelve 404; no se inventa una comparación.
        if ($prefactura === null) {
            return;
        }

        $dePrefactura = $prefactura->aeronave?->matricula;

        if ($dePrefactura === null
            || ! $this->esLaMismaAeronave($comisariato->matricula, $dePrefactura)) {
            $fallar("Ese comisariato es de {$comisariato->matricula} y esta prefactura es de ".($dePrefactura ?? 'una aeronave sin matrícula').': el comisariato de otra aeronave no se cobra aquí.');
        }
    }

    /**
     * `fact_prefactura_renglones.precio_unitario` es `decimal(10,4)`: un quinto decimal se
     * perdería al escribir y el renglón cobraría algo distinto de lo que se tecleó, en silencio.
     *
     * Los ceros de relleno no cuentan: `25.99400000` es el mismo precio de cuatro decimales, y
     * rechazarlo sería un rechazo sin motivo para quien escribe con el teclado numérico.
     */
    private function hasta4Decimales(string $atributo, mixed $valor, \Closure $fallar): void
    {
        $texto = (string) $valor;

        if (! str_contains($texto, '.')) {
            return;
        }

        if (strlen(rtrim(substr($texto, strpos($texto, '.') + 1), '0')) > 4) {
            $fallar('El precio unitario admite máximo 4 decimales.');
        }
    }

    /** Los tres tramos de tránsito, que SÍ se pueden cobrar a nombre de otra aeronave. */
    private function esTramoDeTransito(mixed $servicioId): bool
    {
        return FactServicio::query()
            ->whereKey($servicioId)
            ->whereIn('concepto', [
                FactServicio::CONCEPTO_ESTANCIA_TRANSITO_2H,
                FactServicio::CONCEPTO_ESTANCIA_TRANSITO_12H,
                FactServicio::CONCEPTO_ESTANCIA_PERNOCTA,
            ])
            ->exists();
    }

    /**
     * Los servicios de estancia no se agregan a mano, con UNA excepción.
     *
     * Su precio real sale de la tarifa de la matrícula y el del catálogo es relleno (99.00 en los
     * tres tramos y 0.0000 en los dos ajustes). Agregarlos a secas congelaría ese relleno en el
     * renglón, sin forma de corregirlo, y además duplicaría el cobro al recalcular la estancia.
     *
     * LA EXCEPCIÓN: los tres TRAMOS de tránsito sí se agregan cuando vienen con `aeronave_id`, es
     * decir cuando se cobra el tránsito de OTRA aeronave. Ahí el precio sale de la tarifa de esa
     * aeronave y el renglón se guarda sin concepto, así que no hay relleno ni doble cobro. Los dos
     * AJUSTES no tienen excepción: son para subir de tramo la estancia propia.
     */
    private function noEsServicioDeEstancia(string $atributo, mixed $valor, \Closure $fallar): void
    {
        $esEstancia = FactServicio::query()
            ->whereKey($valor)
            ->whereIn('concepto', FactServicio::CONCEPTOS_ESTANCIA)
            ->exists();

        if (! $esEstancia) {
            return;
        }

        if ($this->filled('aeronave_id') && $this->esTramoDeTransito($valor)) {
            return;
        }

        $fallar('Los cargos de estancia no se agregan a mano: los pone «Estancia y ajustes», porque su precio sale de la tarifa de la matrícula y no del catálogo.');
    }

    /** `aeronave_id` no significa nada en un servicio normal: aceptarlo escondería un error de quien llama. */
    private function soloParaTransito(string $atributo, mixed $valor, \Closure $fallar): void
    {
        if (! $this->esTramoDeTransito($this->input('servicio_id'))) {
            $fallar('La matrícula solo se indica al cobrar el tránsito de otra aeronave.');
        }
    }

    /**
     * La remisión solo tiene sentido en el servicio de combustible, solo si tiene precio y
     * solo si es de LA MATRÍCULA de esta prefactura.
     *
     * Lo de la matrícula: la vía automática está atada a ella (`deLaMatricula()`), y el alta a
     * mano no lo estaba. El buscador del modal arranca con la matrícula de la prefactura pero
     * es un campo editable, así que tecleando otra salían sus remisiones y el alta las
     * aceptaba: se le cobraba al cliente de este documento el combustible de otra aeronave,
     * con su folio ajeno impreso en el renglón. Cobrar el combustible de otra aeronave sería
     * una funcionalidad deliberada —como ya lo es el tránsito ajeno, que tiene su propio campo
     * de matrícula— y no un agujero. El buscador SIGUE ofreciéndolas: lo que no se puede es
     * darlas de alta.
     *
     * La comparación de la matrícula tolera el guion, y solo aquí: ver `esLaMismaAeronave()`.
     */
    private function soloParaCombustible(string $atributo, mixed $valor, \Closure $fallar): void
    {
        $esCombustible = FactServicio::query()
            ->whereKey($this->input('servicio_id'))
            ->where('concepto', FactServicio::CONCEPTO_COMBUSTIBLE)
            ->exists();

        if (! $esCombustible) {
            $fallar('La remisión solo se indica al cobrar combustible.');

            return;
        }

        $remision = \App\Models\Remision::find($valor);

        if ($remision === null) {
            return;
        }

        if ($remision->precio === null) {
            $fallar('Esa remisión no tiene precio registrado, así que no hay nada que cobrar. Captúralo en Rampa primero.');

            return;
        }

        $dePrefactura = FactPrefactura::with('aeronave')->find($this->route('id'))?->aeronave?->matricula;

        // Sin prefactura o sin matrícula no hay nada contra qué contrastar: el controlador ya
        // devuelve 404 si la prefactura no existe, y el rechazo no se inventa una comparación.
        if ($dePrefactura === null) {
            return;
        }

        if (! $this->esLaMismaAeronave($remision->matricula, $dePrefactura)) {
            $fallar("Esa remisión es de {$remision->matricula} y esta prefactura es de {$dePrefactura}: el combustible de otra aeronave no se cobra aquí. Si la matrícula se capturó mal en Rampa, corrígela allí.");
        }
    }

    /**
     * Si las dos matrículas son la misma aeronave, tolerando el guion.
     *
     * `normalizarMatricula()` iguala mayúsculas y espacios de los extremos, y con eso bastaba
     * para lo que la revisión pedía. Pero en `eolo_plus` hay SEIS parejas que son la misma
     * aeronave escrita con otro guion, cada grafía con su propia fila en `aeronaves`: la peor
     * es `XA-VIZ` / `XAVIZ`, con 38 remisiones y 28 de ellas con precio; también
     * `XA--JMB` / `XA-JMB`, `XA--DJT` / `XA-DJT`, `XA--MHA` / `XA-MHA`, `XA--ZZZ` / `XA-ZZZ` y
     * `YV-2770` / `YV2770`. La vía automática nunca las trajo, así que el alta a mano era el
     * ÚNICO modo de cobrar esa carga con SU precio y SUS litros; atar el alta a la matrícula
     * sin mirar el guion lo cerró, y el rodeo que quedaba —un renglón de combustible suelto—
     * cobra al precio de HOY del catálogo y deja la remisión sin marcar, que es justamente la
     * contabilidad manual que este trabajo existe para quitar.
     *
     * La tolerancia vive AQUÍ y no en `normalizarMatricula()` a propósito: esa la usa
     * `deLaMatricula()`, o sea la vía AUTOMÁTICA, que empezaría a arrastrar sola el combustible
     * de `XA-VIZ` a las prefacturas de `XAVIZ`. Son dos filas distintas en `aeronaves` y puede
     * que estén así por una razón: es una decisión con dinero detrás, no un retoque de
     * validación. Aquí hay un humano eligiendo una remisión concreta en el buscador.
     *
     * La comparan las dos altas a mano, la de remisiones (`$deRemision`) y la de comisariatos, que
     * llega con la matrícula del comisariato en ese mismo primer parámetro.
     */
    private function esLaMismaAeronave(?string $deRemision, ?string $dePrefactura): bool
    {
        $remision = RemisionesFacturables::normalizarMatricula($deRemision);
        $prefactura = RemisionesFacturables::normalizarMatricula($dePrefactura);

        if ($remision === $prefactura) {
            return true;
        }

        return $this->sinGuionesNiEspacios($remision) === $this->sinGuionesNiEspacios($prefactura);
    }

    /** La matrícula reducida a letras y dígitos: `XA--VIZ`, `XA-VIZ` y `XA VIZ` dan `XAVIZ`. */
    private function sinGuionesNiEspacios(string $matricula): string
    {
        return (string) preg_replace('/[\s-]+/u', '', $matricula);
    }

    public function messages(): array
    {
        return [
            'servicio_id.required' => 'Elige el servicio que se va a agregar.',
            'servicio_id.integer' => 'El servicio no es válido.',
            'servicio_id.exists' => 'El servicio no existe o está dado de baja.',
            'cantidad.required' => 'La cantidad es obligatoria.',
            'cantidad.integer' => 'La cantidad debe ser un número entero.',
            'cantidad.min' => 'La cantidad debe ser al menos 1.',
            'cantidad.max' => 'La cantidad no puede pasar de 9,999.',
            'precio_unitario.numeric' => 'El precio unitario debe ser un importe numérico, sin signos ni comas.',
            'precio_unitario.min' => 'El precio unitario no puede ser negativo.',
            'precio_unitario.max' => 'El precio unitario es demasiado grande.',
            'aeronave_id.integer' => 'La matrícula no es válida.',
            'aeronave_id.exists' => 'Esa matrícula no está en el sistema.',
            'remision_combustible_id.integer' => 'La remisión no es válida.',
            'remision_combustible_id.exists' => 'Esa remisión no existe o está dada de baja.',
            'servicio_comisariato_id.integer' => 'El comisariato no es válido.',
            'servicio_comisariato_id.exists' => 'Ese comisariato no existe o está dado de baja.',
            'proveedor_id.integer' => 'El proveedor no es válido.',
            'proveedor_id.exists' => 'El proveedor no existe o está dado de baja.',
            'remision.string' => 'La remisión debe ser texto.',
            'remision.max' => 'La remisión no puede pasar de 255 caracteres.',
        ];
    }
}
