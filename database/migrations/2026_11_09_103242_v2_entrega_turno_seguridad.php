<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * La segunda versión del relevo de turno de Seguridad.
 *
 * Las ocho casillas y la pernocta mensual dejan de contestarse a mano: los
 * números salen ahora de los módulos que registran cada cosa. En su lugar
 * entra `resumen`, donde se congela el conteo del día cuando el relevo
 * queda cerrado con sus tres firmas.
 */
return new class extends Migration
{
    /** @var list<string> */
    private const CASILLAS_QUE_SE_VAN = [
        'aviones_csae',
        'combustible',
        'resguardo_vehicular',
        'estacionamiento',
        'posiciones',
        'vehiculos',
        'operaciones',
        'visitantes',
    ];

    public function up(): void
    {
        /*
         * Primero se ensancha y después se renombra, en ese orden.
         *
         * «plataforma» mide exactamente 10 y la columna nació con 10: cabe
         * justo. Al modificar una columna hay que repetir TODOS sus
         * atributos o Laravel los pierde, así que se aprovecha el paso para
         * dejar holgura en vez de quedarse en el borde.
         */
        Schema::table('entregas_turno_seguridad', function (Blueprint $table) {
            $table->string('seccion', 16)->change();
        });

        DB::table('entregas_turno_seguridad')
            ->where('seccion', 'frente')
            ->update(['seccion' => 'caseta']);

        DB::table('entregas_turno_seguridad')
            ->where('seccion', 'atras')
            ->update(['seccion' => 'plataforma']);

        Schema::table('entregas_turno_seguridad', function (Blueprint $table) {
            $table->dropColumn([...self::CASILLAS_QUE_SE_VAN, 'pernocta_mensual']);
        });

        Schema::table('entregas_turno_seguridad', function (Blueprint $table) {
            $table->json('resumen')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('entregas_turno_seguridad', function (Blueprint $table) {
            $table->dropColumn('resumen');
        });

        Schema::table('entregas_turno_seguridad', function (Blueprint $table) {
            foreach (self::CASILLAS_QUE_SE_VAN as $casilla) {
                $table->boolean($casilla)->default(false);
            }

            $table->char('pernocta_mensual', 1)->default('R');
        });

        DB::table('entregas_turno_seguridad')
            ->where('seccion', 'caseta')
            ->update(['seccion' => 'frente']);

        DB::table('entregas_turno_seguridad')
            ->where('seccion', 'plataforma')
            ->update(['seccion' => 'atras']);

        Schema::table('entregas_turno_seguridad', function (Blueprint $table) {
            $table->string('seccion', 10)->change();
        });
    }
};
