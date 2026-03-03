<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('remisiones', function (Blueprint $table) {
            $table->foreignId('id_turno')
                  ->nullable()
                  ->after('id')
                  ->constrained('turnos_autotanque')
                  ->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('remisiones', function (Blueprint $table) {
            $table->dropForeign(['id_turno']);
            $table->dropColumn('id_turno');
        });
    }
};
