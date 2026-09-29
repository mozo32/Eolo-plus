<?php

namespace App\Services;

use App\Models\Aeronave;
use App\Models\FactAeronave;
use App\Models\FactCategoriaAeronave;
use App\Models\FactPrecioCombustible;
use App\Models\FactTipoMotor;
use App\Models\TipoAeronave;
use App\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Trae de la base de Prefacturas (`fact-fbo`, conexión `remota`) lo que cuelga
 * de la matrícula.
 *
 * La simulación recorre el mismo camino que la ejecución real y revierte al
 * final: así el reporte refleja lo que de verdad pasaría, y no una estimación.
 *
 * Tarifas: el modelo "una tarifa por categoría" se cumple para la mayoría de
 * las matrículas, no para todas. La categoría (o el motor, en el aterrizaje)
 * guarda la tarifa modal de sus matrículas, y una matrícula solo llena su
 * columna propia cuando se aparta de esa moda; en el resto queda NULL. Así el
 * cobro no cambia para nadie y la excepción queda a la vista.
 */
class ImportadorMatriculas
{
    /** Hallazgos individuales de matrículas solo locales antes de resumirlos. */
    private const MAX_HUERFANAS_LISTADAS = 25;

    private ResultadoImportacion $resultado;

    public function ejecutar(bool $aplicar): ResultadoImportacion
    {
        $this->resultado = new ResultadoImportacion();

        // Todas las claves existen aunque valgan 0, para que el reporte sea
        // comparable entre corridas.
        foreach ([
            'tipos', 'categorias', 'motores', 'matriculas', 'aeronaves_creadas',
            'matriculas_sin_categoria', 'matriculas_duplicadas',
            'matriculas_con_estancia_propia', 'matriculas_con_aterrizaje_propio',
            'matriculas_solo_locales', 'precios_combustible',
        ] as $clave) {
            $this->resultado->contar($clave, 0);
        }

        DB::beginTransaction();

        try {
            $matriculas = $this->leerMatriculas();

            $tipos = $this->importarTipos();
            [$categorias, $modasCategoria] = $this->importarCategorias($matriculas);
            [$motores, $modasMotor] = $this->importarMotores($matriculas);
            $this->importarMatriculas($matriculas, $tipos, $categorias, $modasCategoria, $motores, $modasMotor);
            $this->importarCombustible();

            $aplicar ? DB::commit() : DB::rollBack();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        $this->resultado->aplicado = $aplicar;

        return $this->resultado;
    }

    private function legacy(string $tabla): Builder
    {
        return DB::connection('remota')->table($tabla);
    }

    /** Un valor de tarifa del origen como número con dos decimales; null si no hay dato. */
    private static function tarifa(mixed $valor): ?float
    {
        return $valor === null ? null : round((float) $valor, 2);
    }

    /**
     * El valor más frecuente. En un empate gana el que apareció primero (las
     * matrículas llegan ordenadas por id), de modo que dos corridas dan lo mismo.
     *
     * @param  array<int,?float>  $valores
     */
    private static function moda(array $valores): ?float
    {
        $cuentas = [];

        foreach ($valores as $valor) {
            if ($valor === null) {
                continue;
            }

            $llave = number_format($valor, 2, '.', '');
            $cuentas[$llave] = ($cuentas[$llave] ?? 0) + 1;
        }

        $mejor = null;
        $max = 0;

        foreach ($cuentas as $llave => $cuantas) {
            if ($cuantas > $max) {
                $mejor = (float) $llave;
                $max = $cuantas;
            }
        }

        return $mejor;
    }

    /** Solo se guarda como propia la tarifa que se aparta de la moda; sin moda (matrícula sin categoría o motor), la suya es la única. */
    private static function propia(?float $valor, ?float $moda): ?float
    {
        if ($valor === null) {
            return null;
        }

        return $moda !== null && abs($valor - $moda) < 0.005 ? null : $valor;
    }

    /**
     * Las matrículas del origen con sus tarifas ya resueltas, sin repetidas.
     * Para las repetidas gana la de menor id_matricula.
     *
     * @return array<string,object> matrícula normalizada => fila
     */
    private function leerMatriculas(): array
    {
        $filas = $this->legacy('tb_matricula as m')
            ->leftJoin('tb_pernocta as p', 'p.id_pernocta', '=', 'm.id_pernocta')
            ->leftJoin('tb_transito2h as t2', 't2.id_transito2h', '=', 'm.id_transito2h')
            ->leftJoin('tb_transito12h as t12', 't12.id_transito12h', '=', 'm.id_transito12h')
            ->leftJoin('tb_aterrisaje as a', 'a.id_aterrizaje', '=', 'm.id_aterrizaje')
            ->orderBy('m.id_matricula')
            ->select('m.*', 'p.pernocta as v_pernocta', 't2.transito as v_transito2h', 't12.transito12 as v_transito12h', 'a.aterrizaje as v_aterrizaje')
            ->get();

        $unicas = [];

        foreach ($filas as $fila) {
            $matricula = mb_strtoupper(trim((string) $fila->matricula));

            if ($matricula === '') {
                continue;
            }

            // Validación 2: matrículas repetidas en el origen.
            if (isset($unicas[$matricula])) {
                $this->resultado->hallazgo("Matrícula repetida en tb_matricula: {$matricula}. Se importa una sola vez.");
                $this->resultado->contar('matriculas_duplicadas');

                continue;
            }

            $fila->matricula = $matricula;
            $fila->pernocta = self::tarifa($fila->v_pernocta);
            $fila->transito2h = self::tarifa($fila->v_transito2h);
            $fila->transito12h = self::tarifa($fila->v_transito12h);
            $fila->aterrizaje = self::tarifa($fila->v_aterrizaje);

            $unicas[$matricula] = $fila;
        }

        return $unicas;
    }

    /** @return array<int,int> id_tipo viejo => id de tipo_aeronaves */
    private function importarTipos(): array
    {
        $mapa = [];
        $vistos = [];

        foreach ($this->legacy('tb_tipo')->get() as $fila) {
            $nombre = trim((string) $fila->tipo);

            if ($nombre === '') {
                continue;
            }

            $llave = mb_strtolower($nombre);

            // Validación 5: el mismo tipo escrito de dos formas distintas.
            if (isset($vistos[$llave])) {
                $this->resultado->hallazgo("Tipo duplicado con distinta escritura: '{$vistos[$llave]}' y '{$nombre}'.");
            }

            $vistos[$llave] = $nombre;

            $tipo = TipoAeronave::query()->whereRaw('LOWER(nombre) = ?', [$llave])->first()
                ?? TipoAeronave::create(['nombre' => $nombre]);

            $mapa[$fila->id_tipo] = $tipo->id;
            $this->resultado->contar('tipos');
        }

        return $mapa;
    }

    /**
     * La tarifa de una categoría es la moda de sus matrículas, campo por campo:
     * el sistema viejo las copiaba con LIMIT 1 desde una matrícula vecina, así
     * que una categoría puede mezclar valores. Las que se aparten conservarán
     * la suya (ver importarMatriculas).
     *
     * @param  array<string,object>  $matriculas
     * @return array{0: array<int,int>, 1: array<int,array{pernocta: float, transito2h: float, transito12h: float}>}
     *                                     [id_categoria viejo => id local, id_categoria viejo => modas]
     */
    private function importarCategorias(array $matriculas): array
    {
        $mapa = [];
        $modas = [];

        foreach ($this->legacy('tb_categoria')->get() as $fila) {
            $nombre = trim((string) $fila->categoria);

            if ($nombre === '' || (int) $fila->id_categoria === 0) {
                continue;
            }

            $miembros = array_filter($matriculas, fn ($m) => (int) $m->id_categoria === (int) $fila->id_categoria);

            if ($miembros === []) {
                $this->resultado->hallazgo("La categoría '{$nombre}' no tiene matrículas: no se importa porque no hay de dónde deducir sus tarifas.");

                continue;
            }

            $moda = [
                'pernocta' => self::moda(array_column($miembros, 'pernocta')),
                'transito2h' => self::moda(array_column($miembros, 'transito2h')),
                'transito12h' => self::moda(array_column($miembros, 'transito12h')),
            ];

            // Validación 1: divergencia de tarifas dentro de una misma categoría.
            $combinaciones = [];

            foreach ($miembros as $m) {
                $llave = implode('|', [$m->pernocta ?? 's/d', $m->transito2h ?? 's/d', $m->transito12h ?? 's/d']);
                $combinaciones[$llave] = ($combinaciones[$llave] ?? 0) + 1;
            }

            if (count($combinaciones) > 1) {
                arsort($combinaciones);

                $detalle = collect($combinaciones)
                    ->map(function ($cuantas, $llave) {
                        [$p, $t2, $t12] = explode('|', $llave);

                        return "pernocta {$p} / 2h {$t2} / 12h {$t12} en {$cuantas} matrículas";
                    })
                    ->implode('; ');

                $this->resultado->hallazgo("La categoría '{$nombre}' tiene tarifas distintas entre sus matrículas: {$detalle}. La categoría guarda la más frecuente de cada tarifa y las matrículas que se apartan conservan la suya.");
            }

            foreach ($moda as $campo => $valor) {
                if ($valor === null) {
                    $this->resultado->hallazgo("La categoría '{$nombre}' no tiene ninguna matrícula con tarifa de {$campo} resuelta en el origen: se guarda en 0.");
                }
            }

            $categoria = FactCategoriaAeronave::updateOrCreate(
                ['nombre' => $nombre],
                [
                    'tarifa_pernocta' => $moda['pernocta'] ?? 0,
                    'tarifa_transito_2h' => $moda['transito2h'] ?? 0,
                    'tarifa_transito_12h' => $moda['transito12h'] ?? 0,
                ],
            );

            $mapa[$fila->id_categoria] = $categoria->id;
            $modas[$fila->id_categoria] = $moda;
            $this->resultado->contar('categorias');
        }

        return [$mapa, $modas];
    }

    /**
     * La tarifa de aterrizaje de un tipo de motor es la moda de las matrículas
     * que lo usan.
     *
     * @param  array<string,object>  $matriculas
     * @return array{0: array<int,int>, 1: array<int,?float>} [id_motor viejo => id local, id_motor viejo => moda]
     */
    private function importarMotores(array $matriculas): array
    {
        $mapa = [];
        $modas = [];

        foreach ($this->legacy('tb_motor')->get() as $fila) {
            $nombre = trim((string) $fila->motor);

            if ($nombre === '' || (int) $fila->id_motor === 0) {
                continue;
            }

            $miembros = array_filter($matriculas, fn ($m) => (int) $m->id_motor === (int) $fila->id_motor);
            $moda = self::moda(array_column($miembros, 'aterrizaje'));

            $conDato = array_filter(array_column($miembros, 'aterrizaje'), fn ($v) => $v !== null);
            $distintas = count(array_unique($conDato));

            if ($distintas > 1) {
                $this->resultado->hallazgo("El motor '{$nombre}' tiene {$distintas} tarifas de aterrizaje distintas entre sus matrículas. El motor guarda la más frecuente ({$moda}) y las matrículas que se apartan conservan la suya.");
            }

            $motor = FactTipoMotor::updateOrCreate(
                ['nombre' => $nombre],
                ['tarifa_aterrizaje' => $moda ?? 0],
            );

            $mapa[$fila->id_motor] = $motor->id;
            $modas[$fila->id_motor] = $moda;
            $this->resultado->contar('motores');
        }

        return [$mapa, $modas];
    }

    /**
     * @param  array<string,object>  $matriculas
     * @param  array<int,int>  $tipos
     * @param  array<int,int>  $categorias
     * @param  array<int,array{pernocta: float, transito2h: float, transito12h: float}>  $modasCategoria
     * @param  array<int,int>  $motores
     * @param  array<int,?float>  $modasMotor
     */
    private function importarMatriculas(array $matriculas, array $tipos, array $categorias, array $modasCategoria, array $motores, array $modasMotor): void
    {
        foreach ($matriculas as $matricula => $fila) {
            $tipoId = $tipos[$fila->id_tipo] ?? null;

            $aeronave = Aeronave::firstOrCreate(
                ['matricula' => $matricula],
                ['aeronave_id' => $tipoId],
            );

            if ($aeronave->wasRecentlyCreated) {
                $this->resultado->contar('aeronaves_creadas');
            } elseif ($aeronave->aeronave_id === null && $tipoId !== null) {
                // Dada de alta por captura sin tipo: se completa, pero nunca se pisa un tipo que ya tenía.
                $aeronave->update(['aeronave_id' => $tipoId]);
            }

            $categoriaId = $categorias[$fila->id_categoria] ?? null;

            // Validación 4: el id_categoria = 0 del sistema viejo (o una categoría que no se pudo importar).
            if ($categoriaId === null) {
                $this->resultado->contar('matriculas_sin_categoria');

                if ((int) $fila->id_categoria !== 0) {
                    $this->resultado->hallazgo("La matrícula {$matricula} apunta a la categoría {$fila->id_categoria}, que no se importó: queda sin categoría.");
                }
            }

            $motorId = $motores[$fila->id_motor] ?? null;
            $modaCategoria = $categoriaId !== null ? $modasCategoria[$fila->id_categoria] : null;
            $modaMotor = $motorId !== null ? $modasMotor[$fila->id_motor] : null;

            $propias = [
                'tarifa_pernocta' => self::propia($fila->pernocta, $modaCategoria['pernocta'] ?? null),
                'tarifa_transito_2h' => self::propia($fila->transito2h, $modaCategoria['transito2h'] ?? null),
                'tarifa_transito_12h' => self::propia($fila->transito12h, $modaCategoria['transito12h'] ?? null),
                'tarifa_aterrizaje' => self::propia($fila->aterrizaje, $modaMotor),
            ];

            foreach ([
                'pernocta' => $fila->pernocta, 'tránsito de 2h' => $fila->transito2h,
                'tránsito de 12h' => $fila->transito12h, 'aterrizaje' => $fila->aterrizaje,
            ] as $nombre => $valor) {
                if ($valor === null) {
                    $this->resultado->hallazgo("La matrícula {$matricula} apunta a una tarifa de {$nombre} que no existe en el origen: no se le guarda tarifa propia y cobrará la de su categoría o motor.");
                }
            }

            $estatusOrigen = (int) $fila->id_estatus;

            // tb_estatus: 1 = Transito (paga estancia), 2 = Guarda (contrato de hangar).
            if (! in_array($estatusOrigen, [1, 2], true)) {
                $this->resultado->hallazgo("La matrícula {$matricula} tiene id_estatus {$estatusOrigen}, que no existe en tb_estatus: se importa como guarda.");
            }

            // updateOrCreate y no firstOrCreate: si la fila ya existía (alta por
            // captura antes de la migración del estatus por omisión), se corrige.
            // Las tarifas propias van siempre explícitas para que un nuevo
            // corrido también borre las que ya no apliquen.
            FactAeronave::updateOrCreate(
                ['aeronave_id' => $aeronave->id],
                [
                    'categoria_aeronave_id' => $categoriaId,
                    'tipo_motor_id' => $motorId,
                    'estatus' => $estatusOrigen === 1
                        ? FactAeronave::ESTATUS_TRANSITO
                        : FactAeronave::ESTATUS_GUARDA,
                    'cobra_derecho_vuelos' => (int) $fila->d_vuelos === 0,
                ] + $propias,
            );

            if ($propias['tarifa_pernocta'] !== null || $propias['tarifa_transito_2h'] !== null || $propias['tarifa_transito_12h'] !== null) {
                $this->resultado->contar('matriculas_con_estancia_propia');
            }

            if ($propias['tarifa_aterrizaje'] !== null) {
                $this->resultado->contar('matriculas_con_aterrizaje_propio');
            }

            $this->resultado->contar('matriculas');
        }

        // Validación 3: matrículas locales que el sistema viejo no conoce.
        $huerfanas = Aeronave::query()->pluck('matricula')
            ->filter(fn ($m) => ! isset($matriculas[mb_strtoupper(trim((string) $m))]))
            ->values();

        $this->resultado->contar('matriculas_solo_locales', $huerfanas->count());

        foreach ($huerfanas->take(self::MAX_HUERFANAS_LISTADAS) as $matricula) {
            $this->resultado->hallazgo("La matrícula {$matricula} existe en Eolo-plus pero no en tb_matricula.");
        }

        if ($huerfanas->count() > self::MAX_HUERFANAS_LISTADAS) {
            $resto = $huerfanas->count() - self::MAX_HUERFANAS_LISTADAS;
            $this->resultado->hallazgo("...y {$resto} matrículas más que existen en Eolo-plus pero no en tb_matricula.");
        }
    }

    private function importarCombustible(): void
    {
        $fila = $this->legacy('tb_combustible')->orderBy('id_combustible')->first();

        if (! $fila) {
            return;
        }

        $usuario = User::query()->orderBy('id')->value('id');

        if ($usuario === null) {
            $this->resultado->hallazgo('No hay usuarios en Eolo-plus: el precio de combustible no se pudo importar.');

            return;
        }

        $datos = [
            'precio_asa' => $fila->pasa,
            'precio_eolo' => $fila->p_combustible,
            'user_id' => $usuario,
        ];

        // Un nuevo corrido actualiza el precio que el importador dejó vigente...
        $importado = FactPrecioCombustible::query()
            ->whereNull('vigencia_fin')
            ->whereDate('vigencia_inicio', $fila->f_ini)
            ->first();

        if ($importado) {
            $importado->update($datos);
        } elseif (FactPrecioCombustible::query()->exists()) {
            // ...pero si ya hay otro precio (capturado después), tb_combustible
            // es una foto vieja: importarla lo desbancaría como vigente.
            $this->resultado->hallazgo('Ya hay precios de combustible en Eolo-plus: no se importa el de tb_combustible para no reemplazar el vigente.');

            return;
        } else {
            FactPrecioCombustible::create($datos + ['vigencia_inicio' => $fila->f_ini, 'vigencia_fin' => null]);
        }

        $this->resultado->contar('precios_combustible');
    }
}
