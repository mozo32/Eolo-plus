<?php

namespace App\Http\Requests\OperacionProgramada;

use Illuminate\Foundation\Http\FormRequest;

class StoreOperacionProgramadaRequest extends FormRequest
{
    /**
     * El acceso lo resuelve el middleware subdep:operacionesProgramadas.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Normaliza igual que el resto de módulos: matrícula y equipo en mayúsculas,
     * tipo en minúsculas y hora recortada a HH:mm.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'tipo' => strtolower(trim((string) $this->input('tipo'))),
            'matricula' => strtoupper(trim((string) $this->input('matricula'))),
            'equipo' => strtoupper(trim((string) $this->input('equipo'))),
            'lugar' => $this->filled('lugar')
                ? strtoupper(trim((string) $this->input('lugar')))
                : null,
            'hora' => $this->horaNormalizada(),
            // FP es texto libre y opcional: vacío se guarda como null.
            'fp' => $this->filled('fp')
                ? trim((string) $this->input('fp'))
                : null,
        ]);
    }

    /**
     * Recorta los segundos solo cuando la hora ya viene en formato válido
     * (HH:mm:ss). Cualquier otro texto llega intacto a la validación para que
     * sea rechazado: "8:30", "25:00", "12:70" o un formato con AM/PM.
     */
    private function horaNormalizada(): string
    {
        $hora = trim((string) $this->input('hora'));

        if (preg_match('/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/', $hora)) {
            return substr($hora, 0, 5);
        }

        return $hora;
    }

    public function rules(): array
    {
        return [
            'fecha' => ['required', 'date'],
            'tipo' => ['required', 'in:llegada,salida'],
            'matricula' => ['required', 'string', 'max:20'],
            'equipo' => ['required', 'string', 'max:50'],
            // Hora en formato de 24 horas: 08:30, 16:45, 23:10.
            'hora' => ['required', 'date_format:H:i', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'lugar' => ['nullable', 'string', 'max:100'],
            'pax' => ['nullable', 'integer', 'min:0'],
            'fp' => ['nullable', 'string', 'max:100'],
            // Oculto por ahora en formularios y tablas; la regla se conserva por
            // si vuelve a habilitarse. Nunca se escribe desde aquí.
            'fp_folio' => ['nullable', 'string', 'max:50'],
            'observaciones' => ['nullable', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'tipo.in' => 'El tipo de operación debe ser llegada o salida.',
            'hora.date_format' => 'La hora debe tener el formato HH:mm (24 horas).',
            'hora.regex' => 'La hora debe estar entre 00:00 y 23:59 con el formato HH:mm.',
        ];
    }

    /**
     * Datos ya normalizados listos para persistir.
     *
     * El FP solo aplica a las salidas. El folio del plan de vuelo está oculto
     * por ahora, así que nunca se escribe: al actualizar, el valor histórico
     * guardado en la base de datos se conserva tal cual.
     */
    public function datosOperacion(): array
    {
        $datos = $this->validated();

        unset($datos['fp_folio']);

        if ($datos['tipo'] === 'llegada') {
            $datos['fp'] = null;
        }

        return $datos;
    }
}
