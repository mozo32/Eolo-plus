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
        Schema::table('inspecciones_autotanque', function (Blueprint $table) {
            $table->foreignId('turno_autotanque_id')
                  ->nullable()
                  ->after('id')
                  ->unique()
                  ->constrained('turnos_autotanque')
                  ->onDelete('cascade');
            $table->char('status', 1)
                  ->default('A')
                  ->after('danos_grafico');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inspecciones_autotanque', function (Blueprint $table) {
            $table->dropForeign(['turno_autotanque_id']);
            $table->dropColumn(['turno_autotanque_id', 'status']);
        });
    }
};
