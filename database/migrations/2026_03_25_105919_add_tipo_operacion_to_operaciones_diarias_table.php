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
        Schema::table('operaciones_diarias', function (Blueprint $table) {
            $table->string('tipo_operacion')->nullable()->after('tipo_cliente')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('operaciones_diarias', function (Blueprint $table) {
            $table->dropColumn(['tipo_operacion']);
        });
    }
};
