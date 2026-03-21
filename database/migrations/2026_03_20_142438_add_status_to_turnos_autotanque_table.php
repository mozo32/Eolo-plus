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
        Schema::table('turnos_autotanque', function (Blueprint $table) {
            $table->char('status', 1)->default('A')->after('diferenciaFinal');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('turnos_autotanque', function (Blueprint $table) {
            $table->dropColumn('status');
        });
    }
};
