<?php

namespace App\Http\Requests\Facturacion;

use App\Models\FactAeronave;
use App\Models\FactCategoriaAeronave;
use App\Models\FactTipoMotor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAeronaveFacturacionRequest extends FormRequest
{
    private const TARIFAS_PROPIAS = [
        'tarifa_pernocta' => 'tarifa de pernocta',
        'tarifa_transito_2h' => 'tarifa de tránsito de 2 horas',
        'tarifa_transito_12h' => 'tarifa de tránsito de 12 horas',
        'tarifa_aterrizaje' => 'tarifa de aterrizaje',
    ];

    /** El acceso lo resuelve el middleware subdep:factAeronaves. */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Las tarifas propias son la excepción de las matrículas que no siguen a su
     * categoría o motor. `sometimes`: si no vienen no se tocan; si vienen como
     * null se quitan y la matrícula vuelve a heredar. Cero es válido.
     *
     * A una categoría o motor dados de baja no se puede asignar una matrícula,
     * salvo que ya lo tuviera (para poder editar el resto sin perderlo).
     */
    public function rules(): array
    {
        $actual = FactAeronave::query()->find($this->route('id'));

        $reglas = [
            'categoria_aeronave_id' => [
                'sometimes', 'nullable', 'integer',
                $this->catalogoActivo((new FactCategoriaAeronave)->getTable(), FactCategoriaAeronave::STATUS_ACTIVO, $actual?->categoria_aeronave_id),
            ],
            'tipo_motor_id' => [
                'sometimes', 'nullable', 'integer',
                $this->catalogoActivo((new FactTipoMotor)->getTable(), FactTipoMotor::STATUS_ACTIVO, $actual?->tipo_motor_id),
            ],
            'estatus' => ['required', Rule::in([FactAeronave::ESTATUS_GUARDA, FactAeronave::ESTATUS_TRANSITO])],
            'cobra_derecho_vuelos' => ['required', 'boolean'],
        ];

        foreach (array_keys(self::TARIFAS_PROPIAS) as $campo) {
            $reglas[$campo] = ['sometimes', 'nullable', 'numeric', 'min:0', 'max:99999999.99'];
        }

        return $reglas;
    }

    private function catalogoActivo(string $tabla, string $statusActivo, ?int $idActual): \Illuminate\Validation\Rules\Exists
    {
        return Rule::exists($tabla, 'id')->where(function ($query) use ($statusActivo, $idActual) {
            // Agrupado: sin el paréntesis, el orWhere anularía la condición sobre el id que se valida.
            $query->where(function ($grupo) use ($statusActivo, $idActual) {
                $grupo->where('status', $statusActivo);

                if ($idActual !== null) {
                    $grupo->orWhere('id', $idActual);
                }
            });
        });
    }

    public function messages(): array
    {
        $mensajes = [
            'categoria_aeronave_id.integer' => 'La categoría no es válida.',
            'categoria_aeronave_id.exists' => 'La categoría elegida no existe o está dada de baja.',
            'tipo_motor_id.integer' => 'El tipo de motor no es válido.',
            'tipo_motor_id.exists' => 'El tipo de motor elegido no existe o está dado de baja.',
            'estatus.required' => 'El estatus es obligatorio.',
            'estatus.in' => 'El estatus debe ser guarda o tránsito.',
            'cobra_derecho_vuelos.required' => 'Debe indicarse si se cobra derecho de vuelos.',
            'cobra_derecho_vuelos.boolean' => 'El cobro de derecho de vuelos debe ser verdadero o falso.',
        ];

        foreach (self::TARIFAS_PROPIAS as $campo => $nombre) {
            $mensajes["{$campo}.numeric"] = "La {$nombre} debe ser numérica.";
            $mensajes["{$campo}.min"] = "La {$nombre} no puede ser negativa.";
            $mensajes["{$campo}.max"] = "La {$nombre} es demasiado grande.";
        }

        return $mensajes;
    }
}
