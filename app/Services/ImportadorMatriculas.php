<?php

namespace App\Services;

use App\Models\Aeronave;
use App\Models\FactAeronave;
use App\Models\FactCategoriaAeronave;
use App\Models\FactCategoriaServicio;
use App\Models\FactCliente;
use App\Models\FactFormaPago;
use App\Models\FactPrecioCombustible;
use App\Models\FactProveedor;
use App\Models\FactServicio;
use App\Models\FactTipoMotor;
use App\Models\TipoAeronave;
use App\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

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

    /** Desde el id 94 los servicios del sistema viejo son de tercero (`altaserv.php`). */
    private const ULTIMO_SERVICIO_PROPIO = 93;

    /** Porcentaje que el sistema viejo le suma a los servicios de tercero. */
    private const MARGEN_TERCERO = 50;

    /** Ids de los tres servicios con fórmula propia en `altaserv.php`. */
    private const SERVICIO_MAS_5 = 106;

    private const SERVICIO_SIN_IVA = 107;

    private const SERVICIO_COMISION_131 = 113;

    private ResultadoImportacion $resultado;

    /** @var array<int,string> id_categoria viejo => nombre, para los hallazgos */
    private array $nombresCategoria = [];

    /** @var array<int,string> id_motor viejo => nombre, para los hallazgos */
    private array $nombresMotor = [];

    public function ejecutar(bool $aplicar): ResultadoImportacion
    {
        $this->resultado = new ResultadoImportacion();
        $this->nombresCategoria = [];
        $this->nombresMotor = [];

        // Todas las claves existen aunque valgan 0, para que el reporte sea
        // comparable entre corridas.
        foreach ([
            'tipos', 'categorias', 'motores', 'matriculas', 'aeronaves_creadas',
            'matriculas_sin_categoria', 'matriculas_duplicadas',
            'matriculas_con_estancia_propia', 'matriculas_con_aterrizaje_propio',
            'matriculas_sin_categoria_con_tarifa_propia',
            'matriculas_sin_motor', 'matriculas_sin_motor_con_aterrizaje_propio',
            'matriculas_con_tarifa_huerfana', 'matriculas_con_tarifa_huerfana_sin_destino', 'matriculas_solo_locales', 'precios_combustible',
            'clientes', 'categorias_servicio', 'servicios', 'servicios_de_tercero', 'servicios_sin_categoria',
            'formas_pago', 'proveedores',
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
            $this->importarClientes();
            [$categoriasServicio, $categoriasSinNombre] = $this->importarCategoriasServicio();
            $this->importarServicios($categoriasServicio, $categoriasSinNombre);
            $this->importarFormasPago();
            $this->importarProveedores();

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

    /**
     * Llave con la que MySQL considera iguales dos nombres: las columnas únicas
     * de fact_categorias_aeronave y fact_tipos_motor usan utf8mb4_unicode_ci,
     * que no distingue caja ni acentos ('Ligera' = 'ligéra'). Sin esta llave, dos
     * nombres así se detectarían distintos aquí y se fundirían en una sola fila
     * al importar.
     */
    private static function llaveNombre(string $nombre): string
    {
        return mb_strtolower(Str::ascii($nombre));
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
            // Este orden decide el cobro, no es cosmético. Para las matrículas
            // repetidas gana la fila de menor id_matricula (ver el `isset` de
            // abajo), y las repetidas pueden divergir en datos: XA-TVA y XB-ODW
            // tienen una fila con categoría y tarifas y otra con categoría 0 y
            // todo NULL. Qué fila gana decide lo que se cobra.
            //
            // Gana la de menor id porque así lo resuelve el sistema viejo: sus
            // consultas hacen `WHERE matricula = ?` sin ORDER BY (a_pref.php,
            // insert22.php), y en InnoDB eso devuelve por orden de clave
            // primaria, así que la primera fila es la de menor id_matricula. (Las
            // consultas de tarifas, además, hacen INNER JOIN y descartan por sí
            // solas la fila con todo en 0; en los datos actuales las dos vías
            // llevan a la misma fila.) La coincidencia es por herencia del orden
            // del PK, no porque nadie lo decidiera: si se cambia o se quita este
            // orderBy, deja de coincidir sin que nada falle.
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
        $vistos = [];

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

            // Validación 6: dos categorías que la base local no distingue. Solo
            // cuentan las que de verdad se importan (arriba se descartaron las
            // vacías). updateOrCreate las funde: la segunda pisa las tarifas de la
            // primera y las matrículas de la primera heredarían las de la segunda.
            $llave = self::llaveNombre($nombre);

            if (isset($vistos[$llave])) {
                $this->resultado->hallazgo("Categoría duplicada con distinta escritura: '{$vistos[$llave]}' y '{$nombre}'. La base local las trata como una sola: la segunda pisa las tarifas de la primera y las matrículas de la primera heredarían las de la segunda, así que el cobro puede cambiar. Corregir el origen antes de aplicar.");
            }

            $vistos[$llave] = $nombre;

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
            $this->nombresCategoria[$fila->id_categoria] = $nombre;
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
        $vistos = [];

        foreach ($this->legacy('tb_motor')->get() as $fila) {
            $nombre = trim((string) $fila->motor);

            if ($nombre === '' || (int) $fila->id_motor === 0) {
                continue;
            }

            // Validación 7: dos motores que la base local no distingue (ver
            // importarCategorias): la segunda tarifa de aterrizaje pisaría la
            // primera para todas las matrículas de ese motor.
            $llave = self::llaveNombre($nombre);

            if (isset($vistos[$llave])) {
                $this->resultado->hallazgo("Motor duplicado con distinta escritura: '{$vistos[$llave]}' y '{$nombre}'. La base local los trata como uno solo: la segunda tarifa de aterrizaje pisa la primera y las matrículas del primero heredarían la del segundo, así que el cobro puede cambiar. Corregir el origen antes de aplicar.");
            }

            $vistos[$llave] = $nombre;

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
            $this->nombresMotor[$fila->id_motor] = $nombre;
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

            // Facturabilidad en el origen. insert22.php resuelve las cuatro tarifas
            // con un INNER JOIN a tb_pernocta, tb_transito2h, tb_transito12h y
            // tb_aterrisaje: si falta CUALQUIERA (el id no existe en su tabla),
            // la consulta devuelve cero filas y esa matrícula no factura ningún
            // concepto de estancia. No basta con mirar cada tarifa por separado.
            //
            // En Eolo-plus, en cambio, cada tarifa se resuelve por su cuenta: la
            // que existe se cobra, y la que falta hereda de la categoría (las tres
            // de estancia) o del motor (aterrizaje) si los hay. Por eso una
            // matrícula a la que le falta una sola tarifa, sin dónde heredarla,
            // dejaría de estar exenta en el origen y facturaría las demás aquí.
            // Solo si en Eolo-plus tampoco resuelve nada (las cuatro faltan y no
            // hay categoría ni motor) ningún cobro cambia.
            $estancia = [
                'pernocta' => $fila->pernocta,
                'tránsito de 2h' => $fila->transito2h,
                'tránsito de 12h' => $fila->transito12h,
            ];
            $tarifasOrigen = $estancia + ['aterrizaje' => $fila->aterrizaje];

            $faltan = array_keys(array_filter($tarifasOrigen, fn ($valor) => $valor === null));

            if ($faltan !== []) {
                $conTarifa = array_keys(array_filter($tarifasOrigen, fn ($valor) => $valor !== null));
                $heredanDeCategoria = $categoriaId !== null ? array_values(array_intersect($faltan, array_keys($estancia))) : [];
                $heredaDelMotor = $motorId !== null && in_array('aterrizaje', $faltan, true);

                if ($conTarifa === [] && $heredanDeCategoria === [] && ! $heredaDelMotor) {
                    $this->resultado->contar('matriculas_con_tarifa_huerfana_sin_destino');
                } else {
                    $cobrara = [];

                    if ($conTarifa !== []) {
                        $cobrara[] = implode(', ', $conTarifa).' con su tarifa del origen';
                    }

                    if ($heredanDeCategoria !== []) {
                        $cobrara[] = implode(', ', $heredanDeCategoria)." heredada de la categoría '{$this->nombresCategoria[$fila->id_categoria]}'";
                    }

                    if ($heredaDelMotor) {
                        $cobrara[] = "aterrizaje heredado del motor '{$this->nombresMotor[$fila->id_motor]}'";
                    }

                    $this->resultado->contar('matriculas_con_tarifa_huerfana');
                    $this->resultado->hallazgo("La matrícula {$matricula} no era facturable en el origen: le faltan ".implode(', ', $faltan).' y el sistema viejo resuelve las cuatro tarifas con un INNER JOIN, así que sin cualquiera de ellas no facturaba ningún concepto de estancia. En Eolo-plus sí cobrará ('.implode('; ', $cobrara).'), así que puede cobrar distinto del origen.');
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

            $conEstanciaPropia = $propias['tarifa_pernocta'] !== null
                || $propias['tarifa_transito_2h'] !== null
                || $propias['tarifa_transito_12h'] !== null;

            // Solo son excepciones reales las que se apartan de una moda que existe;
            // sin categoría o sin motor no hay contra qué compararse y se cuentan aparte.
            if ($conEstanciaPropia) {
                $this->resultado->contar($categoriaId !== null ? 'matriculas_con_estancia_propia' : 'matriculas_sin_categoria_con_tarifa_propia');
            }

            if ($motorId === null) {
                $this->resultado->contar('matriculas_sin_motor');
            }

            if ($propias['tarifa_aterrizaje'] !== null) {
                $this->resultado->contar($motorId !== null ? 'matriculas_con_aterrizaje_propio' : 'matriculas_sin_motor_con_aterrizaje_propio');
            }

            $this->resultado->contar('matriculas');
        }

        $sinDestino = $this->resultado->conteos['matriculas_con_tarifa_huerfana_sin_destino'];

        if ($sinDestino > 0) {
            $this->resultado->hallazgo("{$sinDestino} matrículas no tienen ninguna de las cuatro tarifas en el origen y no tienen categoría ni motor de dónde heredarlas: el sistema viejo no les facturaba estancia y Eolo-plus tampoco, así que ningún cobro cambia. Las que sí tienen alguna tarifa, o categoría o motor donde heredar, llevan renglón propio arriba.");
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

    /*
     * Catálogos de facturación (bloque 1b).
     *
     * Los conteos de estos catálogos son filas del origen procesadas, no filas
     * escritas: en una segunda corrida `clientes` sigue diciendo lo mismo aunque
     * no se cree ninguna. Es a propósito, para que el reporte sea comparable
     * entre corridas; lo que no se procesa (nombre vacío, repetido) no cuenta y
     * sale como hallazgo.
     */

    /**
     * Los clientes se traen uno a uno, sin deduplicar por RFC.
     *
     * El RFC se repite de forma legítima: `XAXX010101000` (público en general)
     * lo comparten 22 clientes sin relación entre sí en los datos reales, y
     * `XEXX010101000` otros 5. Deduplicar por él fusionaría clientes distintos.
     * El nombre sí es la llave de idempotencia, para que volver a correr el
     * importador no duplique. Es seguro hoy porque los 195 nombres del origen
     * son únicos, pero no es una garantía del modelo: si aparecieran dos
     * clientes reales con el mismo nombre, esto los fusionaría. Por eso el
     * segundo se omite (gana el de menor id) y se reporta como hallazgo antes
     * de aplicar. Se compara con `llaveCatalogo` porque la columna de la base
     * nueva no distingue caja ni acentos.
     */
    private function importarClientes(): void
    {
        $vistos = [];

        foreach ($this->legacy('tb_clientes')->orderBy('id_cliente')->get() as $fila) {
            $nombre = $this->nombreCatalogo($fila->nombre, 'tb_clientes', $fila->id_cliente, 'Cliente');

            if ($nombre === null) {
                continue;
            }

            $llave = self::llaveCatalogo($nombre);

            if (isset($vistos[$llave])) {
                $this->hallazgoRepetido('Cliente', 'tb_clientes', $fila->id_cliente, $nombre, $vistos[$llave]);

                continue;
            }

            $vistos[$llave] = $nombre;

            FactCliente::updateOrCreate(
                ['nombre' => $nombre],
                [
                    'rfc' => $this->oNulo($fila->rfc ?? null),
                    'correo' => $this->oNulo($fila->correo ?? null),
                    'telefono' => $this->oNulo($fila->telefono ?? null),
                ],
            );

            $this->resultado->contar('clientes');
        }
    }

    /**
     * La categoría 0 del sistema viejo significa "sin categoría", no es una fila
     * real. Si dos categorías comparten nombre (para la base nueva), la segunda
     * se omite pero su id viejo apunta a la misma fila que la primera, para que
     * sus servicios no queden huérfanos por un duplicado del origen.
     *
     * @return array{0: array<int,int>, 1: array<int,true>} [id_categorias viejo => id de
     *                                                       fact_categorias_servicio, ids viejos sin nombre]
     */
    private function importarCategoriasServicio(): array
    {
        $mapa = [];
        $sinNombre = [];
        $vistos = [];

        foreach ($this->legacy('tb_categoria_serv')->orderBy('id_categorias')->get() as $fila) {
            $idViejo = (int) $fila->id_categorias;

            if ($idViejo === 0) {
                continue;
            }

            $nombre = $this->nombreCatalogo($fila->categoras, 'tb_categoria_serv', $idViejo, 'Categoría de servicio');

            if ($nombre === null) {
                $sinNombre[$idViejo] = true;

                continue;
            }

            $llave = self::llaveCatalogo($nombre);

            if (isset($vistos[$llave])) {
                $this->hallazgoRepetido('Categoría de servicio', 'tb_categoria_serv', $idViejo, $nombre, $vistos[$llave]['nombre']);
                $mapa[$idViejo] = $vistos[$llave]['id'];

                continue;
            }

            $mapa[$idViejo] = FactCategoriaServicio::firstOrCreate(['nombre' => $nombre])->id;
            $vistos[$llave] = ['nombre' => $nombre, 'id' => $mapa[$idViejo]];
            $this->resultado->contar('categorias_servicio');
        }

        return [$mapa, $sinNombre];
    }

    /**
     * El sistema viejo decide el recargo de tercero por el número de id y los
     * ajustes con tres `if` sobre ids concretos (`altaserv.php`). Aquí esa
     * clasificación se traduce a columnas una sola vez, en la importación.
     *
     * El precio se pasa tal como llega (decimal(10,4) en ambos lados), sin
     * convertirlo a float.
     *
     * @param  array<int,int>  $categorias
     * @param  array<int,true>  $categoriasSinNombre
     */
    private function importarServicios(array $categorias, array $categoriasSinNombre): void
    {
        $vistos = [];

        foreach ($this->legacy('tb_servicio')->orderBy('id_servicio')->get() as $fila) {
            $idViejo = (int) $fila->id_servicio;
            $nombre = $this->nombreCatalogo($fila->servicio, 'tb_servicio', $idViejo, 'Servicio');

            if ($nombre === null) {
                continue;
            }

            $llave = self::llaveCatalogo($nombre);

            if (isset($vistos[$llave])) {
                $this->hallazgoRepetido('Servicio', 'tb_servicio', $idViejo, $nombre, $vistos[$llave]);

                continue;
            }

            $vistos[$llave] = $nombre;

            $idCategoriaVieja = (int) $fila->id_categorias;
            $categoriaId = $categorias[$idCategoriaVieja] ?? null;
            $esDeTercero = $idViejo > self::ULTIMO_SERVICIO_PROPIO;

            if ($categoriaId === null) {
                $this->resultado->contar('servicios_sin_categoria');

                if (isset($categoriasSinNombre[$idCategoriaVieja])) {
                    $this->resultado->hallazgo("Servicio '{$nombre}' (id {$idViejo}) apunta a la categoría {$idCategoriaVieja}, que existe en tb_categoria_serv pero está sin nombre y no se importó: queda sin categoría.");
                } elseif ($idCategoriaVieja !== 0) {
                    $this->resultado->hallazgo("Servicio '{$nombre}' (id {$idViejo}) apunta a la categoría {$idCategoriaVieja}, que no existe en tb_categoria_serv: queda sin categoría.");
                }
            }

            if ($esDeTercero) {
                $this->resultado->contar('servicios_de_tercero');
            }

            FactServicio::updateOrCreate(
                ['nombre' => $nombre],
                [
                    'categoria_servicio_id' => $categoriaId,
                    // `tb_servicio.precio_u` es NOT NULL en el origen, así que el
                    // `?? 0` no se alcanza hoy. No es un cobro que pueda volverse
                    // 0 en silencio: solo evita un null en la columna si el
                    // origen cambiara.
                    'precio_unitario' => $fila->precio_u ?? 0,
                    'es_de_tercero' => $esDeTercero,
                    'margen' => $esDeTercero ? self::MARGEN_TERCERO : 0,
                    'ajuste_precio' => match ($idViejo) {
                        self::SERVICIO_MAS_5 => FactServicio::AJUSTE_MAS_5,
                        self::SERVICIO_SIN_IVA => FactServicio::AJUSTE_SIN_IVA,
                        self::SERVICIO_COMISION_131 => FactServicio::AJUSTE_COMISION_131,
                        default => FactServicio::AJUSTE_NINGUNO,
                    },
                ],
            );

            $this->resultado->contar('servicios');
        }
    }

    private function importarFormasPago(): void
    {
        $this->importarCatalogoSimple(
            'tb_tip_fpago', 'id_tipo_formas', 'tipo_forma', 'Forma de pago', FactFormaPago::class, 'formas_pago',
        );
    }

    private function importarProveedores(): void
    {
        $this->importarCatalogoSimple(
            'tb_proveedor', 'id_proveedor', 'proveedor', 'Proveedor', FactProveedor::class, 'proveedores',
        );
    }

    /**
     * Catálogos de solo nombre, con `firstOrCreate`. Su columna `nombre` es única
     * con collation que no distingue caja ni acentos, así que 'EOLO' y 'Eolo'
     * serían la misma fila: el segundo se omite y se reporta en lugar de contarse.
     *
     * @param  class-string<\Illuminate\Database\Eloquent\Model>  $modelo
     */
    private function importarCatalogoSimple(string $tabla, string $llavePrimaria, string $columna, string $etiqueta, string $modelo, string $conteo): void
    {
        $vistos = [];

        foreach ($this->legacy($tabla)->orderBy($llavePrimaria)->get() as $fila) {
            $id = $fila->{$llavePrimaria};
            $nombre = $this->nombreCatalogo($fila->{$columna}, $tabla, $id, $etiqueta);

            if ($nombre === null) {
                continue;
            }

            $llave = self::llaveCatalogo($nombre);

            if (isset($vistos[$llave])) {
                $this->hallazgoRepetido($etiqueta, $tabla, $id, $nombre, $vistos[$llave]);

                continue;
            }

            $vistos[$llave] = $nombre;

            $modelo::firstOrCreate(['nombre' => $nombre]);
            $this->resultado->contar($conteo);
        }
    }

    /**
     * Nombre listo para guardar, o null si la fila no se importa (nombre vacío,
     * con hallazgo). Recorta los extremos y colapsa cada corrida de espacio en
     * blanco, U+00A0 incluido, a un espacio simple: un espacio duro rompe la
     * búsqueda por texto (nadie lo teclea) y uno final sale impreso en la
     * prefactura. Si hubo que normalizar, se reporta con el id y los dos valores.
     */
    private function nombreCatalogo(mixed $crudo, string $tabla, int|string $id, string $etiqueta): ?string
    {
        $original = (string) $crudo;
        $colapsado = preg_replace('/[\s\p{Z}]+/u', ' ', $original);
        $nombre = trim($colapsado ?? $original);

        if ($nombre === '') {
            $this->resultado->hallazgo("{$etiqueta} sin nombre en {$tabla} (id {$id}): no se importa.");

            return null;
        }

        if ($nombre !== $original) {
            $visible = str_replace("\u{00A0}", '<NBSP>', $original);
            $this->resultado->hallazgo("{$etiqueta} con espacios raros en {$tabla} (id {$id}): '{$visible}' se importa como '{$nombre}'.");
        }

        return $nombre;
    }

    private function hallazgoRepetido(string $etiqueta, string $tabla, int|string $id, string $nombre, string $primero): void
    {
        $this->resultado->hallazgo("{$etiqueta} con nombre repetido en {$tabla}: '{$nombre}' (id {$id}) es igual a '{$primero}' para la base nueva. Se importa una sola vez, con los datos del primero; revísalo antes de aplicar.");
    }

    /**
     * `llaveNombre`, pero sin colapsar los nombres que no tienen equivalente
     * ASCII: `Str::ascii('日本')` es '' y todos compartirían la misma llave.
     */
    private static function llaveCatalogo(string $nombre): string
    {
        $llave = self::llaveNombre($nombre);

        return $llave === '' ? mb_strtolower($nombre) : $llave;
    }

    /** Una cadena vacía del origen es un dato ausente, no una cadena. */
    private function oNulo(mixed $valor): ?string
    {
        $valor = trim((string) $valor);

        return $valor === '' ? null : $valor;
    }
}
