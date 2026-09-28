<?php
// database/migrations/2026_09_28_090600_add_tarifas_propias_to_fact_aeronaves.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tarifas propias de una matrícula, que ganan sobre las de su categoría.
 *
 * El diseño asumió que la tarifa dependía solo de la categoría, pero en la base
 * real 41 de 763 matrículas tienen la suya (la categoría VI concentra 25). Como
 * la migración no puede cambiar ningún cobro, la categoría queda como valor por
 * omisión y estas columnas guardan la excepción. Nulo significa "cobra la de su
 * categoría"; un cero es un precio válido de cortesía.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fact_aeronaves', function (Blueprint $table) {
            $table->decimal('tarifa_pernocta', 10, 2)->nullable()->after('tipo_motor_id');
            $table->decimal('tarifa_transito_2h', 10, 2)->nullable()->after('tarifa_pernocta');
            $table->decimal('tarifa_transito_12h', 10, 2)->nullable()->after('tarifa_transito_2h');
            $table->decimal('tarifa_aterrizaje', 10, 2)->nullable()->after('tarifa_transito_12h');
        });
    }

    public function down(): void
    {
        Schema::table('fact_aeronaves', function (Blueprint $table) {
            $table->dropColumn([
                'tarifa_pernocta',
                'tarifa_transito_2h',
                'tarifa_transito_12h',
                'tarifa_aterrizaje',
            ]);
        });
    }
};
