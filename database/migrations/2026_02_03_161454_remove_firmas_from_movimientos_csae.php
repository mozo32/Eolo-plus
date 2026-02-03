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
        Schema::table('movimientos_csae', function (Blueprint $table) {
            $table->dropColumn([
                'firma_entrada',
                'firma_salida',
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('movimientos_csae', function (Blueprint $table) {
            $table->string('firma_entrada', 100);
            $table->string('firma_salida', 100)->nullable();
        });
    }
};
