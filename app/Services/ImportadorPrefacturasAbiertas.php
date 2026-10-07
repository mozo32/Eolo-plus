<?php

namespace App\Services;

use App\Models\Aeronave;
use App\Models\FactCliente;
use App\Models\FactPrefactura;
use App\Models\FactPrefacturaRenglon;
use App\Models\FactProveedor;
use App\Models\FactServicio;
use App\Support\ImporteServicio;
use App\Support\NombreDeCatalogo;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Trae las prefacturas ABIERTAS del sistema viejo (`tb_prefcatura`) como borradores de
 * Eolo-plus. Las cerradas NO son cosa suya: eso es otro trabajo, con otras decisiones.
 *
 * Entran CON su folio de origen. La regla del cierre ya lo contempla —una prefactura que
 * ya trae folio lo conserva y no toca el contador—, así que la que el departamento
 * capturó hoy como 4185 se cerrará siendo la 4185 y no hay que explicarle a nadie por qué
 * cambió de número. Los folios viejos llegan hasta 4123 y nuestra serie arranca en 10000,
 * así que no chocan.
 *
 * Es idempotente por folio: volver a correrlo no duplica nada.
 */
class ImportadorPrefacturasAbiertas
{
    /** Lo que `tb_llegadas` guarda en `id_destino`. El 0 es «sin definir». */
    private const DESTINO_NACIONAL = 1;

    private const DESTINO_INTERNACIONAL = 2;

    /** Valores que el origen usa como «vacío» en los textos de origen y destino. */
    private const TEXTO_VACIO = ['', '0', 'N/A', 'n/a', '-', '--'];

    private ResultadoImportacion $resultado;

    public function ejecutar(bool $aplicar, int $userId): ResultadoImportacion
    {
        $this->resultado = new ResultadoImportacion;

        // Todas las claves arrancan en cero para que la tabla del comando sea comparable
        // entre corridas, igual que en el importador de catálogos.
        foreach ([
            'abiertas_en_el_origen', 'prefacturas', 'renglones',
            'prefacturas_ya_estaban', 'prefacturas_sin_matricula',
            'prefacturas_sin_cliente', 'prefacturas_sin_llegada',
            'renglones_sin_servicio', 'renglones_sin_proveedor',
        ] as $clave) {
            $this->resultado->contar($clave, 0);
        }

        DB::beginTransaction();

        try {
            $this->importar($userId);

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

    private function importar(int $userId): void
    {
        $matriculas = $this->legacy('tb_matricula')->pluck('matricula', 'id_matricula');
        $clientes = $this->legacy('tb_clientes')->pluck('nombre', 'id_cliente');
        $servicios = $this->legacy('tb_servicio')->pluck('servicio', 'id_servicio');
        $proveedores = $this->legacy('tb_proveedor')->pluck('proveedor', 'id_proveedor');

        $llegadas = $this->legacy('tb_llegadas')->get()->keyBy('fol_prefactura');

        // Los renglones de TODAS las abiertas de una vez: una consulta en lugar de una por
        // folio. Son pocas prefacturas, pero `tb_venta` tiene diez mil filas.
        $folios = $this->legacy('tb_prefcatura')->pluck('fol_prefactura')->all();
        $renglonesPorFolio = $folios === []
            ? collect()
            : $this->legacy('tb_venta')->whereIn('fol_prefactura', $folios)->orderBy('id_venta')->get()->groupBy('fol_prefactura');

        $yaEstan = FactPrefactura::query()->whereIn('folio', $folios)->pluck('folio')->all();

        foreach ($this->legacy('tb_prefcatura')->orderBy('fol_prefactura')->get() as $abierta) {
            $this->resultado->contar('abiertas_en_el_origen');
            $folio = (int) $abierta->fol_prefactura;

            if (in_array($folio, $yaEstan, true)) {
                $this->resultado->contar('prefacturas_ya_estaban');

                continue;
            }

            $aeronave = $this->aeronaveDe($abierta, $matriculas, $folio);

            if ($aeronave === null) {
                continue;
            }

            $llegada = $llegadas->get($folio);

            if ($llegada === null) {
                $this->resultado->contar('prefacturas_sin_llegada');
                $this->resultado->hallazgo("El folio {$folio} no tiene fila en tb_llegadas: entra sin fechas, sin origen ni destino, y como nacional. Hay que capturarlos antes de cerrarlo.");
            }

            $prefactura = FactPrefactura::create([
                'folio' => $folio,
                'estado' => FactPrefactura::ESTADO_BORRADOR,
                'aeronave_id' => $aeronave->id,
                'cliente_id' => $this->clienteDe($abierta, $clientes, $folio),
                'llegada_at' => $this->fecha($llegada?->Fecha_lleg),
                'salida_at' => $this->fecha($llegada?->Fecha_sal),
                'origen' => $this->texto($llegada?->origen),
                'destino' => $this->texto($llegada?->destino),
                'tipo_destino' => $this->tipoDestino($llegada?->id_destino, $folio),
                'user_id' => $userId,
                'status' => FactPrefactura::STATUS_ACTIVO,
            ]);

            $this->resultado->contar('prefacturas');
            $this->renglonesDe($prefactura, $renglonesPorFolio->get($folio, collect()), $servicios, $proveedores, $folio);
            $this->avisarDeLoRaro($abierta, $folio);
        }
    }

    private function aeronaveDe(object $abierta, $matriculas, int $folio): ?Aeronave
    {
        $matricula = $matriculas[$abierta->id_matricula] ?? null;

        $aeronave = $matricula === null
            ? null
            : Aeronave::query()->where('matricula', NombreDeCatalogo::normalizar((string) $matricula))->first();

        if ($aeronave !== null) {
            return $aeronave;
        }

        // `fact_prefacturas.aeronave_id` es NOT NULL: sin aeronave no hay prefactura que
        // crear. No se inventa una: se dice cuál quedó fuera y por qué.
        $this->resultado->contar('prefacturas_sin_matricula');
        $this->resultado->hallazgo($matricula === null
            ? "El folio {$folio} apunta a la matrícula {$abierta->id_matricula}, que ya no existe en tb_matricula: NO se importa."
            : "El folio {$folio} usa la matrícula '{$matricula}', que no está en el catálogo de Eolo-plus: NO se importa. Corre antes el importador de catálogos.");

        return null;
    }

    private function clienteDe(object $abierta, $clientes, int $folio): ?int
    {
        $nombre = $clientes[$abierta->id_cliente] ?? null;

        if ($nombre === null || NombreDeCatalogo::normalizar((string) $nombre) === '') {
            $this->resultado->contar('prefacturas_sin_cliente');

            return null;
        }

        $cliente = FactCliente::query()->where('nombre', NombreDeCatalogo::normalizar((string) $nombre))->first();

        if ($cliente === null) {
            $this->resultado->contar('prefacturas_sin_cliente');
            $this->resultado->hallazgo("El folio {$folio} tiene el cliente '{$nombre}', que no está en el catálogo de Eolo-plus: entra sin cliente y no se podrá cerrar hasta que se le ponga uno.");

            return null;
        }

        return $cliente->id;
    }

    /**
     * @param  \Illuminate\Support\Collection<int,object>  $renglones
     */
    private function renglonesDe(FactPrefactura $prefactura, $renglones, $servicios, $proveedores, int $folio): void
    {
        $orden = 0;

        foreach ($renglones as $renglon) {
            $nombre = $servicios[$renglon->id_servicio] ?? null;

            $servicio = $nombre === null
                ? null
                : FactServicio::query()->where('nombre', NombreDeCatalogo::normalizar((string) $nombre))->first();

            if ($servicio === null) {
                $this->resultado->contar('renglones_sin_servicio');
                $cual = $nombre === null
                    ? (string) $renglon->id_servicio
                    : $renglon->id_servicio." (\'".$nombre."\')";

                $this->resultado->hallazgo("El folio {$folio} tiene un renglón con el servicio {$cual}, que no está en el catálogo de Eolo-plus: ese renglón NO se importa y la prefactura entra sin él. Revisa su total antes de cerrarla.");

                continue;
            }

            FactPrefacturaRenglon::create([
                'prefactura_id' => $prefactura->id,
                'servicio_id' => $servicio->id,
                // Se congela el nombre y el precio DEL ORIGEN, no los del catálogo: lo que
                // importa es reproducir lo que el sistema viejo cobró.
                'nombre_servicio' => NombreDeCatalogo::normalizar((string) $nombre),
                'precio_unitario' => $renglon->precio_u,
                'cantidad' => (int) $renglon->cantidad,
                'es_de_tercero' => (bool) $servicio->es_de_tercero,
                // Margen CERO y ajuste NINGUNO a propósito: en Eolo-plus el importe se
                // deriva de precio × cantidad con el margen y el ajuste aplicados, y el
                // `precio_u` del origen ya es el precio final que se cobró. Heredar el
                // margen del catálogo cobraría de más sobre un precio que ya lo incluye.
                'margen' => '0.00',
                'ajuste_precio' => ImporteServicio::AJUSTE_NINGUNO,
                // El concepto SÍ sale del catálogo: es lo que hace que un renglón de
                // estancia se comporte como tal en el editor.
                'concepto' => $servicio->concepto,
                'proveedor_id' => $this->proveedorDe($renglon, $proveedores),
                'remision' => $this->texto($renglon->remision ?? null),
                'es_cortesia' => false,
                'orden' => $orden++,
            ]);

            $this->resultado->contar('renglones');
            $this->avisarSiElImporteNoCuadra($renglon, $folio);
        }
    }

    private function proveedorDe(object $renglon, $proveedores): ?int
    {
        $nombre = $proveedores[$renglon->Id_proveedor ?? 0] ?? null;

        if ($nombre === null) {
            return null;
        }

        $proveedor = FactProveedor::query()->where('nombre', NombreDeCatalogo::normalizar((string) $nombre))->first();

        if ($proveedor === null) {
            $this->resultado->contar('renglones_sin_proveedor');

            return null;
        }

        return $proveedor->id;
    }

    /**
     * El origen guarda `importe` y Eolo-plus lo DERIVA. Con margen cero y sin ajuste la
     * fórmula es la misma, así que una diferencia significa que ese renglón traía algo
     * que no entendimos, y hay que mirarlo antes de cobrarlo.
     */
    private function avisarSiElImporteNoCuadra(object $renglon, int $folio): void
    {
        $derivado = ImporteServicio::calcular((float) $renglon->precio_u, (int) $renglon->cantidad, 0.0, ImporteServicio::AJUSTE_NINGUNO);
        $delOrigen = number_format((float) $renglon->importe, 2, '.', '');

        if (bccomp($derivado, $delOrigen, 2) !== 0) {
            $this->resultado->hallazgo("El folio {$folio} tiene un renglón cuyo importe en el origen es {$delOrigen} y aquí se deriva {$derivado}. Entra con el precio y la cantidad del origen; revisa la diferencia antes de cerrarlo.");
        }
    }

    private function avisarDeLoRaro(object $abierta, int $folio): void
    {
        $estatus = (string) ($abierta->Estatus ?? '');

        if ($estatus !== '' && $estatus !== '1') {
            $this->resultado->hallazgo("El folio {$folio} tiene Estatus '{$estatus}' en el origen, distinto del 1 habitual. Se importa igual, como borrador, pero no sabemos qué significa ese estado: conviene mirarlo.");
        }
    }

    /** `0000-00-00` y la cadena vacía son el «sin fecha» del origen, no una fecha. */
    private function fecha(?string $crudo): ?string
    {
        $limpio = trim((string) $crudo);

        if ($limpio === '' || str_starts_with($limpio, '0000-00-00')) {
            return null;
        }

        return $limpio;
    }

    private function texto(?string $crudo): ?string
    {
        $limpio = NombreDeCatalogo::normalizar((string) $crudo);

        return in_array($limpio, self::TEXTO_VACIO, true) ? null : $limpio;
    }

    /**
     * `tipo_destino` es NOT NULL y decide si se cobra IVA, así que no puede quedarse sin
     * valor. El origen trae 0 cuando nadie lo capturó, y en esos casos su encabezado SÍ
     * lleva el 16% —se midió en los folios 3694 y 4180—, así que lo fiel es nacional.
     */
    private function tipoDestino(mixed $idDestino, int $folio): string
    {
        return match ((int) $idDestino) {
            self::DESTINO_INTERNACIONAL => FactPrefactura::DESTINO_INTERNACIONAL,
            default => FactPrefactura::DESTINO_NACIONAL,
        };
    }
}
