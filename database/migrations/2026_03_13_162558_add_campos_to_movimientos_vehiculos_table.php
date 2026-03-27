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
        Schema::table('movimientos_vehiculos', function (Blueprint $table) {
            $table->string('matricula', 20)->nullable()->after('observaciones');
            $table->text('motivo')->nullable()->after('matricula');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('movimientos_vehiculos', function (Blueprint $table) {
            $table->dropColumn(['matricula', 'motivo']);
        });
    }
};
