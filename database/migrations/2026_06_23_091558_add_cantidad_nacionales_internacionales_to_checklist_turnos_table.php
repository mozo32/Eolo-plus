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
        Schema::table('checklist_turnos', function (Blueprint $table) {
            $table->integer('cantidad_nacionales')->default(0)->after('cantidad_operaciones');
            $table->integer('cantidad_internacionales')->default(0)->after('cantidad_nacionales');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('checklist_turnos', function (Blueprint $table) {
            $table->dropColumn([
                'cantidad_nacionales',
                'cantidad_internacionales',
            ]);
        });
    }
};
