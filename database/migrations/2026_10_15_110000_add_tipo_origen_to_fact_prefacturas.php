<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * De dónde VIENE el vuelo, aparte de a dónde va.
 *
 * El sistema viejo lo guarda así (`tb_llegadas.id_origen` e `id_destino`) y el
 * histórico dice por qué importa: de 485 folios internacionales, 386 lo son en una
 * sola dirección. Con un único campo se cargaría el paquete equivocado en el 80%.
 *
 * Por omisión nacional, que es el caso de 3398 de 3883 folios: ninguna prefactura
 * existente cambia de comportamiento.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fact_prefacturas', function (Blueprint $table) {
            $table->string('tipo_origen', 15)->default('nacional')->after('operacion_salida_id');
        });
    }

    public function down(): void
    {
        Schema::table('fact_prefacturas', function (Blueprint $table) {
            $table->dropColumn('tipo_origen');
        });
    }
};
