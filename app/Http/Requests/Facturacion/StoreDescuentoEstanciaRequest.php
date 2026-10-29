<?php

namespace App\Http\Requests\Facturacion;

use App\Models\FactPrefactura;
use App\Support\DescuentoDeEstancia;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * La forma de un descuento de estancia: de qué renglón sale y qué tramos se perdonan.
 *
 * `renglon_id` no es decoración: de él hereda el descuento su `grupo`, que es la
 * decisión 4 de la spec y lo que hacía el sistema viejo (`aplicar_descuento.php` copia
 * el `agrupar` del renglón de origen). Tiene que ser un renglón DE ESTA prefactura:
 * sin esa comprobación, el grupo de un documento ajeno entraría en este.
 */
class StoreDescuentoEstanciaRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'renglon_id' => ['bail', 'required', 'integer', $this->deEstaPrefacturaYDeEstancia(...)],
            'conceptos' => ['required', 'array', 'min:1'],
            'conceptos.*' => ['distinct', Rule::in(DescuentoDeEstancia::conceptosDescontables())],
        ];
    }

    /**
     * El renglón de origen tiene que ser de esta prefactura y cobrar uno de los tres
     * tramos descontables. Los dos ajustes de estancia no abren el modal, así que
     * tampoco lo abren por endpoint.
     */
    private function deEstaPrefacturaYDeEstancia(string $atributo, mixed $valor, \Closure $fallar): void
    {
        $prefactura = FactPrefactura::find($this->route('id'));

        // Sin prefactura el controlador ya devuelve 404; no se inventa una comprobación.
        if ($prefactura === null) {
            return;
        }

        $renglon = $prefactura->renglones()->whereKey($valor)->first();

        if ($renglon === null) {
            $fallar('Ese renglón no es de esta prefactura.');

            return;
        }

        if (! in_array($renglon->concepto, DescuentoDeEstancia::conceptosDescontables(), true)) {
            $fallar('El descuento se aplica desde un renglón de tránsito o de pernocta.');
        }
    }

    public function messages(): array
    {
        return [
            'renglon_id.required' => 'Indica desde qué renglón se aplica el descuento.',
            'renglon_id.integer' => 'El renglón no es válido.',
            'conceptos.required' => 'Elige al menos un tramo que descontar.',
            'conceptos.array' => 'Los tramos a descontar van en una lista.',
            'conceptos.min' => 'Elige al menos un tramo que descontar.',
            'conceptos.*.in' => 'Solo se descuentan la pernocta y los tránsitos de 2 y de 12 horas.',
            'conceptos.*.distinct' => 'Ese tramo viene repetido en la lista.',
        ];
    }
}
