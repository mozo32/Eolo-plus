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
 * En `invoice.php`, que es la variante viva del PDF, solo sale la EXTERNA
 * (`invoice.php:272` lee `nota_ext`). La interna es para el departamento. Otras
 * variantes también leen `nota_ext`, y `Prefectura/invoice_cerradas.php:267-300` lee
 * además `nota_fac` y la imprime en un bloque «Notas Facturación»: si `nota_factura`
 * debe imprimirse en el documento nuevo es una decisión abierta del bloque 4.
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
