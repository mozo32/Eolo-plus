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
        Schema::table('sumas_autotanque', function (Blueprint $table) {
            $table->decimal('costo', 15, 4)->nullable()->after('litros');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sumas_autotanque', function (Blueprint $table) {
            $table->dropColumn('costo');
        });
    }
};
