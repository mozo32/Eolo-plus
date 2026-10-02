<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Las tres notas de una prefactura.
 *
 * Columnas y no tabla aparte porque el origen ya es uno-a-uno: `tb_notas` tiene una
 * fila por folio con los tres campos, que tres pantallas distintas del sistema
 * viejo guardan por separado. Los largos son los del origen.
 *
 * Solo la EXTERNA se imprime: `invoice.php:272` es el único que lee `tb_notas` y
 * solo lee `nota_ext`. La interna es para el departamento y la de factura viaja al
 * dato fiscal.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fact_prefacturas', function (Blueprint $table) {
            $table->string('nota_interna', 200)->nullable()->after('tipo_destino');
            $table->string('nota_externa', 200)->nullable()->after('nota_interna');
            $table->string('nota_factura', 100)->nullable()->after('nota_externa');
        });
    }

    public function down(): void
    {
        Schema::table('fact_prefacturas', function (Blueprint $table) {
            $table->dropColumn(['nota_interna', 'nota_externa', 'nota_factura']);
        });
    }
};
