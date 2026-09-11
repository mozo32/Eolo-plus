<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Matrículas con movimientos restringidos.
 *
 * Solo tres columnas funcionales: la matrícula es la llave primaria y cada
 * booleano indica si ese movimiento está restringido (true) o permitido (false).
 * No lleva timestamps: el rastro de quién y cuándo queda en la bitácora.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('matriculas_restringidas', function (Blueprint $table) {
            $table->string('matricula', 20)->primary();
            $table->boolean('llegada')->default(false);
            $table->boolean('salida')->default(false);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('matriculas_restringidas');
    }
};
