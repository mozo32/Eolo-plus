<?php

namespace App\Http\Requests\Facturacion;

use App\Models\FactCategoriaServicio;
use App\Models\FactPrecioCombustible;
use App\Models\FactServicio;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;
use Illuminate\Validation\Validator;

class StoreServicioRequest extends FormRequest
{
    /** El acceso lo resuelve el middleware subdep:factServicios. */
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        // Solo se normaliza un valor escalar: un arreglo (nombre[]=x) debe llegar a la
        // validación y fallar con 422, no romper aquí con un 500.
        if (is_scalar($this->input('nombre')) || $this->input('nombre') === null) {
            $this->merge(['nombre' => trim((string) $this->input('nombre'))]);
        }
    }

    /**
     * Cero es un precio válido: los servicios de tercero se teclean al capturar.
     * El tope del precio sigue a la columna decimal(10,4): seis enteros y cuatro
     * decimales, 999999.9999. Uno más grande llegaría a la base y lanzaría un 500.
     * El margen sigue a decimal(5,2): tope 999.99.
     *
     * A una categoría dada de baja no se puede asignar un servicio, salvo que ya
     * la tuviera (para poder editar el resto sin perderla): el mismo criterio que
     * UpdateAeronaveFacturacionRequest en el bloque 1a.
     */
    public function rules(): array
    {
        // En un alta no hay id de ruta. Sin la guarda, `find(null)` lanzaria un
        // `where id is null` contra la base en cada POST: inocuo pero inutil.
        $id = $this->route('id');
        $actual = $id === null ? null : FactServicio::query()->find($id);

        return [
            'categoria_servicio_id' => ['nullable', 'integer', $this->categoriaActiva($actual?->categoria_servicio_id)],
            'nombre' => ['required', 'string', 'max:120'],
            'precio_unitario' => ['required', 'numeric', 'min:0', 'decimal:0,4', 'max:999999.9999'],
            'es_de_tercero' => ['required', 'boolean'],
            'margen' => ['required', 'numeric', 'min:0', 'max:999.99', 'decimal:0,2'],
            'ajuste_precio' => ['required', 'in:ninguno,mas_5,sin_iva,comision_131'],
        ];
    }

    private function categoriaActiva(?int $idActual): Exists
    {
        return Rule::exists((new FactCategoriaServicio)->getTable(), 'id')->where(function ($query) use ($idActual) {
            // Agrupado: sin el paréntesis, el orWhere anularía la condición sobre el id que se valida.
            $query->where(function ($grupo) use ($idActual) {
                $grupo->where('status', FactCategoriaServicio::STATUS_ACTIVO);

                if ($idActual !== null) {
                    $grupo->orWhere('id', $idActual);
                }
            });
        });
    }

    /**
     * Invariante: es de tercero si y solo si el margen es mayor a 0.
     *
     * Se rechaza, no se corrige: normalizar en silencio un campo que determina
     * un cobro escondería el error de quien captura. Solo se evalúa cuando los
     * dos campos ya pasaron su propia validación, para no duplicar mensajes.
     */
    public function after(): array
    {
        return [$this->reglaDeTerceroYMargen(), $this->reglaDelNombreReservado()];
    }

    private function reglaDeTerceroYMargen(): callable
    {
        return function (Validator $validator) {
            if ($validator->errors()->hasAny(['es_de_tercero', 'margen'])) {
                return;
            }

            $esDeTercero = filter_var($this->input('es_de_tercero'), FILTER_VALIDATE_BOOLEAN);
            $margen = $this->input('margen');

            if ($esDeTercero && (float) $margen <= 0) {
                $validator->errors()->add(
                    'margen',
                    "Combinación no válida: el servicio es de tercero y trae margen {$margen}. Si es de tercero, el margen debe ser mayor a 0."
                );
            }

            if (! $esDeTercero && (float) $margen > 0) {
                $validator->errors()->add(
                    'margen',
                    "Combinación no válida: el servicio no es de tercero y trae margen {$margen}. Si no es de tercero, el margen debe ser 0."
                );
            }
        };
    }

    /**
     * El nombre del servicio de combustible está reservado: ningún otro registro
     * puede llevarlo, ni por alta ni por edición.
     *
     * `FactPrecioCombustible` sincroniza el precio buscando POR NOMBRE y
     * actualizando TODOS los servicios activos que casen, porque la columna solo
     * tiene `->index()` y el nombre no es único. Así que traer otro servicio a ese
     * nombre no lo "esconde": lo mete dentro de la sincronía. Un 'Slot MMTO' de
     * 19,250.0000 renombrado así pasaría a cobrar el precio del combustible en la
     * siguiente captura, y eso sí cambia un cobro, hacia abajo y en silencio.
     *
     * Es el complemento de la guarda de `UpdateServicioRequest`, que cubre el
     * sentido contrario (sacar al servicio de combustible de ese nombre). Las dos
     * son excluyentes: esta solo dispara cuando el nombre GUARDADO no es el del
     * combustible, y aquella solo cuando sí lo es.
     */
    private function reglaDelNombreReservado(): callable
    {
        return function (Validator $validator) {
            if ($validator->errors()->has('nombre')) {
                return;
            }

            if (! self::esNombreDeCombustible((string) $this->input('nombre'))) {
                return;
            }

            $id = $this->route('id');
            $actual = $id === null ? null : FactServicio::query()->find($id);

            // Editar un id que no existe responde 404 en el controlador; la guarda
            // no debe adelantarse con un 422 que diría algo falso.
            if ($id !== null && $actual === null) {
                return;
            }

            // Es el propio servicio de combustible conservando su nombre: pasa.
            if ($actual !== null && self::esNombreDeCombustible($actual->nombre)) {
                return;
            }

            $validator->errors()->add(
                'nombre',
                'Ese nombre está reservado al servicio que sigue el precio del combustible: su precio se actualiza solo '
                .'cada vez que se registra un precio nuevo, y cualquier otro servicio que se llame igual quedaría dentro '
                .'de esa actualización y cobraría el precio del combustible. Usa un nombre distinto.'
            );
        };
    }

    /**
     * Comparación insensible a la caja Y a los acentos, que es como la resuelve
     * MySQL con la collation de la columna (`utf8mb4_unicode_ci`). Así las guardas
     * protegen los mismos nombres que la sincronía llegaría a actualizar, nunca
     * menos.
     *
     * Los acentos importan y no es teórico: `utf8mb4_unicode_ci` pliega el primer
     * nivel de la UCA, así que para MySQL 'Combustíble JET A-1' ES
     * 'Combustible JET A-1' (comprobado: la comparación devuelve 1). Con solo
     * `mb_strtolower`, renombrar un servicio con un acento de más burlaba la
     * guarda y la sincronía igual le fijaba el precio del combustible: un
     * servicio de 19,250.00 pasaba a cobrar 26.0639. De ahí el `Str::ascii`, que
     * es la misma normalización que usa `ImportadorMatriculas::llaveNombre()`.
     *
     * El `trim` aplica al nombre GUARDADO: el recibido ya viene recortado por
     * `prepareForValidation` y por el middleware `TrimStrings`.
     */
    protected static function esNombreDeCombustible(string $nombre): bool
    {
        return self::llaveComparable($nombre) === self::llaveComparable(FactPrecioCombustible::SERVICIO_COMBUSTIBLE);
    }

    private static function llaveComparable(string $nombre): string
    {
        return mb_strtolower(Str::ascii(trim($nombre)));
    }

    public function messages(): array
    {
        return [
            'categoria_servicio_id.integer' => 'La categoría del servicio no es válida.',
            'categoria_servicio_id.exists' => 'La categoría del servicio no existe o está dada de baja.',
            'nombre.required' => 'El nombre del servicio es obligatorio.',
            'nombre.string' => 'El nombre del servicio debe ser texto.',
            'nombre.max' => 'El nombre no puede pasar de 120 caracteres.',
            'precio_unitario.required' => 'El precio unitario es obligatorio.',
            'precio_unitario.numeric' => 'El precio unitario debe ser numérico.',
            'precio_unitario.min' => 'El precio unitario no puede ser negativo.',
            'precio_unitario.decimal' => 'El precio unitario admite hasta 4 decimales.',
            'precio_unitario.max' => 'El precio unitario no puede pasar de 999,999.9999.',
            'es_de_tercero.required' => 'Indica si el servicio es de tercero.',
            'es_de_tercero.boolean' => 'El valor de "es de tercero" debe ser sí o no.',
            'margen.required' => 'El margen es obligatorio (0 si el servicio no es de tercero).',
            'margen.numeric' => 'El margen debe ser numérico.',
            'margen.min' => 'El margen no puede ser negativo.',
            'margen.max' => 'El margen no puede pasar de 999.99.',
            'margen.decimal' => 'El margen admite hasta 2 decimales.',
            'ajuste_precio.required' => 'El ajuste de precio es obligatorio.',
            'ajuste_precio.in' => 'El ajuste de precio no es válido: usa ninguno, mas_5, sin_iva o comision_131.',
        ];
    }
}
