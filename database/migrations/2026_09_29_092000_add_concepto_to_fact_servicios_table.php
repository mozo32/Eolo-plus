<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Identifica por una columna propia los servicios que el código tiene que
 * reconocer, en lugar de por su nombre.
 *
 * El bloque 1b sostenía el vínculo del combustible con una guarda que impedía
 * renombrarlo. El bloque 2 necesita reconocer siete filas más —tres de estancia,
 * cuatro del paquete internacional— y siete guardas por nombre no es sostenible:
 * `utf8mb4_unicode_ci` pliega acentos, así que la comparación por nombre siempre
 * va a tener bordes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fact_servicios', function (Blueprint $table) {
            $table->string('concepto', 32)->nullable()->unique()->after('nombre');
            $table->boolean('en_paquete_internacional')->default(false)->after('concepto');
        });
    }

    public function down(): void
    {
        Schema::table('fact_servicios', function (Blueprint $table) {
            $table->dropUnique(['concepto']);
            $table->dropColumn(['concepto', 'en_paquete_internacional']);
        });
    }
};
