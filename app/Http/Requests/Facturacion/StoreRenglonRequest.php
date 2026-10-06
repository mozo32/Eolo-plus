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
            'proveedor_id' => ['nullable', 'integer', Rule::exists('fact_proveedores', 'id')->where('status', 'A')],
            'remision' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * Los cinco servicios de estancia no se agregan a mano: su precio real sale de la
     * tarifa de la matrícula y el del catálogo es relleno (99.00 en los tres tramos y 0.0000 en los dos ajustes). Agregarlos aquí
     * congelaría ese relleno en el renglón, sin forma de corregirlo, y además
     * duplicaría el cobro cuando se recalcule la estancia.
     */
    private function noEsServicioDeEstancia(string $atributo, mixed $valor, \Closure $fallar): void
    {
        $esEstancia = FactServicio::query()
            ->whereKey($valor)
            ->whereIn('concepto', FactServicio::CONCEPTOS_ESTANCIA)
            ->exists();

        if ($esEstancia) {
            $fallar('Los cargos de estancia no se agregan a mano: los pone «Recalcular estancia», porque su precio sale de la tarifa de la matrícula y no del catálogo.');
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
            'proveedor_id.integer' => 'El proveedor no es válido.',
            'proveedor_id.exists' => 'El proveedor no existe o está dado de baja.',
            'remision.string' => 'La remisión debe ser texto.',
            'remision.max' => 'La remisión no puede pasar de 255 caracteres.',
        ];
    }
}
