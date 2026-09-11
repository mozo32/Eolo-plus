<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * El campo FP deja de ser una bandera Sí/No y pasa a ser texto libre y opcional.
 *
 * La columna fp_folio se conserva intacta: por ahora está oculta en formularios
 * y tablas, pero no se elimina ni se vacía.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('operaciones_programadas', function (Blueprint $table) {
            $table->string('fp', 100)->nullable()->default(null)->change();
        });

        // Normaliza lo que quedó de la bandera anterior: "no presentado" pasa a
        // null y "presentado" conserva el folio capturado, si lo hubiera.
        DB::table('operaciones_programadas')
            ->whereIn('fp', ['0', ''])
            ->update(['fp' => null]);

        DB::table('operaciones_programadas')
            ->where('fp', '1')
            ->update([
                'fp' => DB::raw("COALESCE(NULLIF(fp_folio, ''), 'SÍ')"),
            ]);
    }

    public function down(): void
    {
        DB::table('operaciones_programadas')
            ->whereNull('fp')
            ->update(['fp' => '0']);

        DB::table('operaciones_programadas')
            ->where('fp', '!=', '0')
            ->update(['fp' => '1']);

        Schema::table('operaciones_programadas', function (Blueprint $table) {
            $table->boolean('fp')->default(false)->change();
        });
    }
};
