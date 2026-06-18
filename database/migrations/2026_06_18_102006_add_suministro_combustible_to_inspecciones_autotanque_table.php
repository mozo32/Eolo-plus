<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inspecciones_autotanque', function (Blueprint $table) {
            $table
                ->json('suministro_combustible')
                ->nullable()
                ->after('porcentaje_combustible');
        });
    }

    public function down(): void
    {
        Schema::table('inspecciones_autotanque', function (Blueprint $table) {
            $table->dropColumn('suministro_combustible');
        });
    }
};
