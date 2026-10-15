<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * El paquete internacional no es uno, son dos, y los dispara una dirección distinta:
 * el origen internacional pide los servicios de ENTRADA y el destino los de SALIDA.
 * Medido sobre el histórico: de 485 folios internacionales, 386 lo son en una sola
 * dirección, así que un único paquete acierta en el 20% de los casos.
 *
 * El emparejamiento es por NOMBRE y no por id: el importador renumera los servicios
 * al traerlos, y `Servicios Internacionales - entrada` es el 92 en el origen y el 38
 * aquí. Un nombre que no se encuentre se registra y la migración sigue: dejar el
 * catálogo a medias sería peor que un paquete incompleto, que la pantalla ya avisa.
 */
return new class extends Migration
{
    public const ENTRADA = [
        'DSMEE - entrada',
        'DNR - entrada',
        'Autorización de Internacion unica - AIU',
        'Mex-eAPI - entrada',
        'Basura Internacional by SENASICA',
        'Servicios Internacionales - entrada',
    ];

    public const SALIDA = [
        'DSMES - salida',
        'DSM - salida',
        'Mex-eAPI - salida',
        'Servicios Internacionales - salida',
    ];

    public function up(): void
    {
        Schema::table('fact_servicios', function (Blueprint $table) {
            $table->string('paquete_internacional', 10)->nullable()->after('concepto');
        });

        $resultado = self::marcarPaquetes();

        if ($resultado['no_encontrados'] !== []) {
            Log::warning('Servicios del paquete internacional que no están en el catálogo y quedaron sin marcar', [
                'nombres' => $resultado['no_encontrados'],
            ]);
        }

        Schema::table('fact_servicios', function (Blueprint $table) {
            $table->dropColumn('en_paquete_internacional');
        });
    }

    /**
     * Marca los dos paquetes por nombre. Público y estático para que la prueba pueda
     * invocarlo sobre servicios que ella misma crea: en sqlite la tabla nace vacía.
     *
     * Un nombre que no esté en el catálogo se devuelve en `no_encontrados` y la
     * migración sigue. Dejar el catálogo a medias sería peor que un paquete
     * incompleto, que `agregarPaqueteInternacional()` ya avisa por pantalla.
     *
     * @return array{entrada: int, salida: int, no_encontrados: list<string>}
     */
    public static function marcarPaquetes(): array
    {
        $existentes = DB::table('fact_servicios')
            ->whereIn('nombre', array_merge(self::ENTRADA, self::SALIDA))
            ->pluck('nombre')
            ->all();

        return [
            'entrada' => DB::table('fact_servicios')->whereIn('nombre', self::ENTRADA)->update(['paquete_internacional' => 'entrada']),
            'salida' => DB::table('fact_servicios')->whereIn('nombre', self::SALIDA)->update(['paquete_internacional' => 'salida']),
            'no_encontrados' => array_values(array_diff(array_merge(self::ENTRADA, self::SALIDA), $existentes)),
        ];
    }

    public function down(): void
    {
        Schema::table('fact_servicios', function (Blueprint $table) {
            $table->boolean('en_paquete_internacional')->default(false)->after('concepto');
        });

        DB::table('fact_servicios')->whereIn('nombre', self::SALIDA)->update(['en_paquete_internacional' => true]);

        Schema::table('fact_servicios', function (Blueprint $table) {
            $table->dropColumn('paquete_internacional');
        });
    }
};
