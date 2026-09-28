<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Categoría de la aeronave y sus tarifas de estancia.
 *
 * En el sistema viejo estas tarifas colgaban de cada matrícula por llave
 * foránea, pero `altamatri.php` las copiaba de otra matrícula de la misma
 * categoría: la dependencia real es de la categoría, no del avión.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_categorias_aeronave', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 60)->unique();
            $table->decimal('tarifa_pernocta', 10, 2);
            $table->decimal('tarifa_transito_2h', 10, 2);
            $table->decimal('tarifa_transito_12h', 10, 2);
            $table->char('status', 1)->default('A')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_categorias_aeronave');
    }
};
