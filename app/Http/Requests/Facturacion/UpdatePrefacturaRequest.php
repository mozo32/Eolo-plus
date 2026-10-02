<?php

namespace App\Http\Requests\Facturacion;

use App\Models\FactPrefactura;
use Closure;
use Illuminate\Validation\Rule;

/**
 * Mismas reglas que el alta, salvo el destino.
 *
 * El alta solo acepta `nacional`: el destino internacional lo pone la acción del
 * paquete, que además agrega sus servicios. Pero editar el encabezado reenvía el
 * destino que la prefactura YA tiene, así que una internacional tiene que poder
 * reenviar `internacional` — si no, su encabezado deja de guardarse y, sin cliente,
 * nunca se puede cerrar. Lo que no puede es cambiarlo: el destino se mueve solo por
 * su propia acción.
 */
class UpdatePrefacturaRequest extends StorePrefacturaRequest
{
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'tipo_destino' => [
                'required',
                Rule::in([FactPrefactura::DESTINO_NACIONAL, FactPrefactura::DESTINO_INTERNACIONAL]),
                function (string $atributo, mixed $valor, Closure $falla): void {
                    $actual = FactPrefactura::query()->whereKey($this->route('id'))->value('tipo_destino');

                    // Sin fila que comparar no se estorba: el controlador responde 404.
                    if ($actual !== null && $valor !== $actual) {
                        $falla("El destino de una prefactura no se cambia al editar el encabezado: sigue siendo «{$actual}».");
                    }
                },
            ],
        ];
    }
}
