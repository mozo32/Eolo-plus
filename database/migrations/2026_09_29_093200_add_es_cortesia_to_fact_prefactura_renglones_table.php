<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La cortesía: un renglón que se ve en el documento pero no se cobra.
 *
 * Columna propia y no el texto `'cortesia'` en `remision`, que es lo que hace el
 * sistema viejo (`Prefectura/cortecia.php:16`) en el MISMO campo donde van las
 * remisiones reales (`HANDLING`, `9226`, `N/A`). 130 renglones del histórico están
 * así; el bloque 6 los traduce a esta columna y deja `remision` para lo que es.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fact_prefactura_renglones', function (Blueprint $table) {
            $table->boolean('es_cortesia')->default(false)->after('remision');
        });
    }

    public function down(): void
    {
        Schema::table('fact_prefactura_renglones', function (Blueprint $table) {
            $table->dropColumn('es_cortesia');
        });
    }
};
