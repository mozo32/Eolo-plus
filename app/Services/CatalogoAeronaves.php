<?php
// app/Services/CatalogoAeronaves.php

namespace App\Services;

use App\Models\Aeronave;
use App\Models\FactAeronave;
use App\Models\TipoAeronave;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * Punto único de acceso al catálogo de matrículas.
 *
 * Reemplaza la lógica que vivía duplicada en cinco controladores contra la
 * conexión `remota` a la base de Prefacturas: buscar la matrícula y, si no
 * existía, insertarla con un cuerpo de ceros.
 */
class CatalogoAeronaves
{
    public function buscar(string $matricula): ?DatosAeronave
    {
        $aeronave = Aeronave::query()
            ->with(['tipoAeronave', 'facturacion.categoria'])
            ->where('matricula', $this->normalizar($matricula))
            ->first();

        if (! $aeronave) {
            return null;
        }

        return new DatosAeronave(
            matricula: $aeronave->matricula,
            tipo: $aeronave->tipoAeronave?->nombre,
            estatus: $aeronave->facturacion?->estatus ?? FactAeronave::ESTATUS_TRANSITO,
            categoria: $aeronave->facturacion?->categoria?->nombre,
        );
    }

    /**
     * Devuelve la aeronave, creándola si no existía. Una aeronave que ya
     * existe no cambia de tipo: el dato del catálogo manda sobre el que venga
     * en la captura. Solo se completa un tipo que faltaba (nulo).
     */
    public function buscarOCrear(string $matricula, ?string $tipo = null): Aeronave
    {
        $matricula = $this->normalizar($matricula);

        return DB::transaction(function () use ($matricula, $tipo) {
            $aeronave = Aeronave::query()->where('matricula', $matricula)->first();
            $creada = false;

            if (! $aeronave) {
                try {
                    $aeronave = Aeronave::create([
                        'matricula' => $matricula,
                        'aeronave_id' => $this->resolverTipo($tipo),
                    ]);
                    $creada = true;
                } catch (UniqueConstraintViolationException) {
                    // Otra petición dio de alta la misma matrícula entre nuestra
                    // lectura y nuestro insert: el índice único de
                    // aeronaves.matricula la rechazó. La fila existe, hay que
                    // encontrarla. Repetir el first() aquí no sirve: en MySQL con
                    // REPEATABLE READ la transacción conserva el snapshot de su
                    // primer SELECT y no vería una fila confirmada después. Una
                    // lectura con bloqueo va a la versión más reciente confirmada
                    // (y, si la otra petición aún no confirma, espera a que lo
                    // haga). Esto también funciona si el llamador ya abrió una
                    // transacción propia, donde salirse de esta no bastaría.
                    $aeronave = Aeronave::query()
                        ->where('matricula', $matricula)
                        ->lockForUpdate()
                        ->firstOrFail();
                }
            }

            if (! $creada && $aeronave->aeronave_id === null) {
                // Una aeronave dada de alta sin tipo aprende el primero que
                // llegue. Completar un hueco no cambia un valor: si ya tenía
                // tipo, este bloque no se ejecuta. El whereNull evita pisar el
                // tipo que otra petición haya fijado entre la lectura y la
                // escritura.
                $tipoId = $this->resolverTipo($tipo);

                if ($tipoId !== null) {
                    Aeronave::query()
                        ->whereKey($aeronave->id)
                        ->whereNull('aeronave_id')
                        ->update(['aeronave_id' => $tipoId]);

                    $aeronave->refresh();
                }
            }

            // Una aeronave dada de alta antes de este módulo no tiene satélite.
            // Solo se intenta crear si falta: insertar siempre provocaría una
            // violación del índice único de fact_aeronaves.aeronave_id en cada
            // consulta.
            if (! FactAeronave::where('aeronave_id', $aeronave->id)->exists()) {
                try {
                    // El estatus se fija aquí y no se deja al default de la base:
                    // una matrícula nueva es 'transito', como la creaba el sistema
                    // viejo (id_estatus = 1), y eso es lo que decide si paga
                    // estancia.
                    FactAeronave::create([
                        'aeronave_id' => $aeronave->id,
                        'estatus' => FactAeronave::ESTATUS_TRANSITO,
                    ]);
                } catch (UniqueConstraintViolationException) {
                    // Otra petición lo creó primero. Basta con que exista, y se
                    // respeta el suyo. No se relee: con createOrFirst la relectura
                    // caería en el snapshot de la transacción y volvería a lanzar.
                }
            }

            return $aeronave->load(['tipoAeronave', 'facturacion']);
        });
    }

    /** @return string[] */
    public function autocompletar(string $texto, int $limite = 10): array
    {
        $texto = $this->normalizar($texto);

        if ($texto === '') {
            return [];
        }

        return Aeronave::query()
            ->where('matricula', 'like', "%{$texto}%")
            ->orderBy('matricula')
            ->limit($limite)
            ->pluck('matricula')
            ->all();
    }

    /** Busca el tipo por nombre sin distinguir mayúsculas, o lo crea. */
    private function resolverTipo(?string $tipo): ?int
    {
        $tipo = trim((string) $tipo);

        if ($tipo === '') {
            return null;
        }

        $existente = TipoAeronave::query()
            ->whereRaw('LOWER(nombre) = ?', [mb_strtolower($tipo)])
            ->first();

        return $existente?->id ?? TipoAeronave::create(['nombre' => $tipo])->id;
    }

    private function normalizar(string $matricula): string
    {
        return mb_strtoupper(trim($matricula));
    }
}
