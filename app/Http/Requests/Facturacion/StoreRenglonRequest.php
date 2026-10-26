<?php

namespace App\Http\Requests\Facturacion;

use App\Models\FactServicio;
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
            'aeronave_id' => ['bail', 'nullable', 'integer', Rule::exists('aeronaves', 'id'), $this->soloParaTransito(...)],
            'proveedor_id' => ['nullable', 'integer', Rule::exists('fact_proveedores', 'id')->where('status', 'A')],
            'remision' => ['nullable', 'string', 'max:255'],
        ];
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
            'aeronave_id.integer' => 'La matrícula no es válida.',
            'aeronave_id.exists' => 'Esa matrícula no está en el sistema.',
            'proveedor_id.integer' => 'El proveedor no es válido.',
            'proveedor_id.exists' => 'El proveedor no existe o está dado de baja.',
            'remision.string' => 'La remisión debe ser texto.',
            'remision.max' => 'La remisión no puede pasar de 255 caracteres.',
        ];
    }
}
