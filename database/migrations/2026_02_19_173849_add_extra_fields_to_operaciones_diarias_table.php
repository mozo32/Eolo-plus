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
            $table->string('impulso')->nullable()->after('pax');
            $table->string('nombre')->nullable()->after('impulso');
            $table->string('tipo_cliente')->nullable()->after('nombre');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('operaciones_diarias', function (Blueprint $table) {
            $table->dropColumn(['impulso', 'nombre', 'tipo_cliente']);
        });
    }
};
