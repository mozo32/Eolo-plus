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
            $table->dropColumn('requisicion');
            $table->decimal('presionDif', 8, 2)->nullable()->after('forma_pago');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('remisiones', function (Blueprint $table) {
            $table->string('requisicion')->nullable()->after('cliente_vuelo');
            $table->dropColumn('presionDif');
        });
    }
};
