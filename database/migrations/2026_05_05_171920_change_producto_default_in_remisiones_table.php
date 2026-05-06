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
            $table->string('producto')->default('Turbosina JET A')->change();
        });
        DB::table('remisiones')
            ->where('producto', 'TURBOSINA')
            ->update(['producto' => 'Turbosina JET A']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('remisiones')
            ->where('producto', 'Turbosina JET A')
            ->update(['producto' => 'TURBOSINA']);

        Schema::table('remisiones', function (Blueprint $table) {
            $table->string('producto')->default('TURBOSINA')->change();
        });
    }
};
