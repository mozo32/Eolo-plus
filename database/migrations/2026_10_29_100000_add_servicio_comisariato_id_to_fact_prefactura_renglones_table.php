<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * El renglón que nació de un comisariato guarda cuál fue.
 *
 * Es lo ÚNICO que marca un comisariato como ya cobrado: a diferencia de las remisiones, aquí
 * no hay una marca anterior equivalente a `status_prefactura`, así que no hay dos fuentes de
 * verdad que sincronizar.
 *
 * `nullOnDelete` y no `restrict`: si alguien borra el comisariato de Tráfico, el renglón ya
 * cobrado no debe desaparecer de un documento; se queda huérfano y visible.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fact_prefactura_renglones', function (Blueprint $tabla) {
            $tabla->foreignId('servicio_comisariato_id')
                ->nullable()
                ->after('remision_combustible_id')
                ->constrained('servicio_comisariatos')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('fact_prefactura_renglones', function (Blueprint $tabla) {
            $tabla->dropForeign(['servicio_comisariato_id']);
            $tabla->dropColumn('servicio_comisariato_id');
        });
    }
};
